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
    // e.g. `attributes: ['role', 'listbox']`
    definitionMap.set('attributes', createHostAttributesArray(allOtherAttributes));
    // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta, elVarExp, contextVarExp, styleBuilder, bindingParser, constantPool, hostVarsCount));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs, true));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
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
        features.push(o.importExpr(R3.ProvidersFeature).callFn(args));
    }
    if (meta.usesInheritance) {
        features.push(o.importExpr(R3.InheritDefinitionFeature));
    }
    if (meta.lifecycle.usesOnChanges) {
        features.push(o.importExpr(R3.NgOnChangesFeature));
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
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    var selectorForType = (meta.selector || '').replace(/\n/g, '');
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
    var templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
    var templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
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
function createQueryDefinition(query, constantPool, idx) {
    var predicate = getQueryPredicate(query, constantPool);
    // e.g. r3.query(null, somePredicate, false) or r3.query(0, ['div'], false)
    var parameters = [
        o.literal(idx, o.INFERRED_TYPE),
        predicate,
        o.literal(query.descendants),
    ];
    if (query.read) {
        parameters.push(query.read);
    }
    return o.importExpr(R3.query).callFn(parameters);
}
// Turn a directive selector into an R3-compatible selector for directive def
function createDirectiveSelector(selector) {
    return asLiteral(core.parseSelectorToR3Selector(selector));
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
            return o.importExpr(R3.registerContentQuery)
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
        var temporary_1 = temporaryAllocator(statements_1, TEMPORARY_NAME);
        // const $instance$ = $r3$.ɵload(dirIndex);
        statements_1.push(directiveInstanceVar_1.set(o.importExpr(R3.load).callFn([o.variable('dirIndex')]))
            .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
        meta.queries.forEach(function (query, idx) {
            var loadQLArg = o.variable('queryStartIndex');
            var getQueryList = o.importExpr(R3.loadQueryList).callFn([
                idx > 0 ? loadQLArg.plus(o.literal(idx)) : loadQLArg
            ]);
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
    var tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    for (var i = 0; i < meta.viewQueries.length; i++) {
        var query = meta.viewQueries[i];
        // creation, e.g. r3.Q(0, somePredicate, true);
        var queryDefinition = createQueryDefinition(query, constantPool, i);
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.qR(tmp = r3.ɵload(0)) && (ctx.someDir = tmp));
        var temporary = tempAllocator();
        var getQueryList = o.importExpr(R3.load).callFn([o.literal(i)]);
        var refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        var updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    }
    var viewQueryFnName = meta.name ? meta.name + "_Query" : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
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
        if (styleBuilder.hasBindingsOrInitialValues()) {
            // since we're dealing with directives here and directives have a hostBinding
            // function, we need to generate special instructions that deal with styling
            // (both bindings and initial values). The instruction below will instruct
            // all initial styling (styling that is inside of a host binding within a
            // directive) to be attached to the host element of the directive.
            var hostAttrsInstruction = styleBuilder.buildDirectiveHostAttrsInstruction(null, constantPool);
            if (hostAttrsInstruction) {
                createStatements.push(createStylingStmt(hostAttrsInstruction, bindingContext, bindingFn));
            }
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
        return o.importExpr(R3.listener).callFn(params).toStmt();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFHSCxPQUFPLEVBQWdHLGNBQWMsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRXpLLE9BQU8sRUFBQyxXQUFXLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUU3RixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUVuQyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFDekQsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUU3RCxPQUFPLEVBQWdCLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNoRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNyRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxvQ0FBb0MsRUFBRSw0QkFBNEIsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUcvRyxPQUFPLEVBQUMsY0FBYyxFQUFxQixNQUFNLG1CQUFtQixDQUFDO0FBQ3JFLE9BQU8sRUFBQyxZQUFZLEVBQUUseUJBQXlCLEVBQUUsY0FBYyxFQUFFLDhCQUE4QixFQUFFLHFCQUFxQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ2pLLE9BQU8sRUFBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLG1DQUFtQyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXhLLElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztBQUU5Qiw2RkFBNkY7QUFDN0YseUZBQXlGO0FBQ3pGLElBQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDO0FBRXBDLFNBQVMsZ0JBQWdCLENBQUMsUUFBZ0I7SUFDeEMsT0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNoRCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtJQUM5QixJQUFNLGFBQWEsR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO0lBRTFDLDJCQUEyQjtJQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFckMsMENBQTBDO0lBQzFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHVCQUF1QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBR3ZFLCtEQUErRDtJQUMvRCxJQUFNLE1BQU0sR0FBRyxzQkFBc0IsQ0FBQztRQUNwQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7UUFDZixRQUFRLEVBQUUsRUFBRSxDQUFDLGVBQWU7S0FDN0IsQ0FBQyxDQUFDO0lBQ0gsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRTdDLGFBQWEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFFdEYsYUFBYSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRXRGLHdGQUF3RjtJQUN4Rix5RkFBeUY7SUFDekYsSUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztTQUM1QixNQUFNLENBQUMsVUFBQSxJQUFJO1FBQ1YsSUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsT0FBTyxNQUFNLEtBQUssT0FBTyxJQUFJLE1BQU0sS0FBSyxPQUFPLENBQUM7SUFDbEQsQ0FBQyxDQUFDO1NBQ0QsTUFBTSxDQUFDO0lBRWxDLElBQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDdkMsSUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMvQyxJQUFNLFlBQVksR0FBRyxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFakUsSUFBTSxrQkFBa0IsR0FBUSxFQUFFLENBQUM7SUFDbkMsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDekMsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFCLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pDLFFBQVEsSUFBSSxFQUFFO1lBQ1osc0RBQXNEO1lBQ3RELEtBQUssT0FBTztnQkFDVixZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RDLE1BQU07WUFDUixzREFBc0Q7WUFDdEQsS0FBSyxPQUFPO2dCQUNWLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsTUFBTTtZQUNSO2dCQUNFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFDakMsTUFBTTtTQUNUO0tBQ0Y7SUFFRCx5Q0FBeUM7SUFDekMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUseUJBQXlCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBRS9FLG9EQUFvRDtJQUNwRCxhQUFhLENBQUMsR0FBRyxDQUNiLGNBQWMsRUFDZCwwQkFBMEIsQ0FDdEIsSUFBSSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUVsRyx5QkFBeUI7SUFDekIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsbUNBQW1DLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRXBGLDBCQUEwQjtJQUMxQixhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUVoRixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFO1FBQzFCLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7S0FDekQ7SUFFRCxPQUFPLEVBQUMsYUFBYSxlQUFBLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FDaEIsYUFBNEIsRUFBRSxJQUErQztJQUMvRSx3Q0FBd0M7SUFDeEMsSUFBTSxRQUFRLEdBQW1CLEVBQUUsQ0FBQztJQUVwQyxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ2pDLElBQU0sYUFBYSxHQUFJLElBQTRCLENBQUMsYUFBYSxDQUFDO0lBQ2xFLElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRTtRQUM5QixJQUFNLElBQUksR0FBRyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksYUFBYSxFQUFFO1lBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDMUI7UUFDRCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDL0Q7SUFFRCxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDeEIsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7S0FDMUQ7SUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0tBQ3BEO0lBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ25CLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUN2RDtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FDeEMsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtJQUN4QixJQUFBLDJEQUFvRixFQUFuRixnQ0FBYSxFQUFFLDBCQUFvRSxDQUFDO0lBQzNGLFdBQVcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakMsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUzRiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLElBQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRWpFLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUM3RCxPQUFPLEVBQUMsVUFBVSxZQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsVUFBVSxZQUFBLEVBQUMsQ0FBQztBQUN4QyxDQUFDO0FBT0Q7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUFDLElBQXVCO0lBQ2hFLElBQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7SUFDMUMsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ2YsSUFBTSxRQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUMzQixJQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUc7WUFDM0MsSUFBTSxDQUFDLEdBQUcsUUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3RCLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQWIsQ0FBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RixPQUFPLEVBQUMsR0FBRyxLQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0tBQ3REO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2hCLElBQU0sU0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsSUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHO1lBQzdDLElBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDdEMsT0FBTyxFQUFDLEdBQUcsS0FBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztLQUN4RDtJQUVELElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFdEYsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFNUQsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFDLENBQUM7QUFDNUIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDRCQUE0QixDQUN4QyxJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCOztJQUN4QixJQUFBLDJEQUFvRixFQUFuRixnQ0FBYSxFQUFFLDBCQUFvRSxDQUFDO0lBQzNGLFdBQVcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFakMsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuRSxJQUFNLGFBQWEsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTlDLG9DQUFvQztJQUNwQywrRkFBK0Y7SUFDL0YsSUFBSSxhQUFhLEVBQUU7UUFDakIsSUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEQsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUU7WUFDN0IsYUFBYSxDQUFDLEdBQUcsQ0FDYixPQUFPLEVBQUUsWUFBWSxDQUFDLGVBQWUsQ0FDeEIsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQy9CLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBdkQsQ0FBdUQsQ0FBQyxDQUFDO1lBQ3RFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDM0M7S0FDRjtJQUVELG9EQUFvRDtJQUNwRCxJQUFJLGdCQUFnQixHQUF5QixJQUFJLENBQUM7SUFFbEQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDOUIsSUFBTSxPQUFPLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQzs7WUFDdEMsS0FBcUMsSUFBQSxLQUFBLGlCQUFBLElBQUksQ0FBQyxVQUFVLENBQUEsZ0JBQUEsNEJBQUU7Z0JBQTNDLElBQUEsYUFBc0IsRUFBckIsd0JBQVEsRUFBRSw0QkFBVTtnQkFDOUIsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVEsQ0FBQyxFQUFFLFlBQVUsQ0FBQyxDQUFDO2FBQ2pFOzs7Ozs7Ozs7UUFDRCxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7S0FDNUI7SUFFRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHlCQUF5QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0tBQy9FO0lBRUQsa0VBQWtFO0lBQ2xFLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQyxJQUFNLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUksZ0JBQWdCLGNBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRTlFLElBQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO0lBQy9DLElBQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO0lBQzFDLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7SUFFN0MsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUMvQixJQUFNLGVBQWUsR0FBRyxJQUFJLHlCQUF5QixDQUNqRCxZQUFZLEVBQUUsWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQ3BGLElBQUksQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQzNGLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUUzRCxJQUFNLDBCQUEwQixHQUFHLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRTdGLG1CQUFtQjtJQUNuQixhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFeEUsaUJBQWlCO0lBQ2pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUVwRSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBRTFELG1DQUFtQztJQUNuQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUU7UUFDdkIsSUFBSSxjQUFjLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDcEU7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztLQUNqRDtJQUVELHlCQUF5QjtJQUN6QixJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUU7UUFDbEIsSUFBSSxTQUFTLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDMUQ7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN2QztJQUVELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUU7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDO0tBQ3REO0lBRUQsOEJBQThCO0lBQzlCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNyQyxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2RSxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2hCLElBQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFkLENBQWMsQ0FBQyxDQUFDO1FBQ3ZELGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFO1FBQ2pFLGlFQUFpRTtRQUNqRSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7S0FDbEQ7SUFFRCw0REFBNEQ7SUFDNUQsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7UUFDMUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztLQUNuRTtJQUVELHlDQUF5QztJQUN6QyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO1FBQzVCLGFBQWEsQ0FBQyxHQUFHLENBQ2IsTUFBTSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3hGO0lBRUQsK0VBQStFO0lBQy9FLElBQUksZUFBZSxJQUFJLElBQUksSUFBSSxlQUFlLEtBQUssSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU8sRUFBRTtRQUN2RixhQUFhLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztLQUNsRTtJQUVELCtGQUErRjtJQUMvRiw2Q0FBNkM7SUFDN0MsSUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFakUsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzRixJQUFNLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFFN0QsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLFVBQVUsWUFBQSxFQUFDLENBQUM7QUFDeEMsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FDdkMsU0FBd0IsRUFBRSxTQUFtQyxFQUFFLFNBQTJCLEVBQzFGLGFBQTRCO0lBQzlCLElBQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7SUFDOUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxpQ0FBK0IsU0FBUyxDQUFDLElBQU0sQ0FBQyxDQUFDO0lBRS9ELElBQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsY0FBYyxtQkFBMEIsQ0FBQztJQUV4RixJQUFNLElBQUksR0FBRyxtQ0FBbUMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xGLElBQU0sR0FBRyxHQUFHLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRXRGLCtEQUErRDtJQUMvRCxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3JDLElBQUksRUFBRSxJQUFJLEVBQ1YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUM3RixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUN2QyxTQUF3QixFQUFFLFNBQW1DLEVBQUUsVUFBOEIsRUFDN0YsU0FBMkIsRUFBRSxhQUE0QixFQUFFLGtCQUFvQyxFQUMvRixjQUFnQztJQUNsQyxJQUFNLElBQUksR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBRyxDQUFDO0lBQzlDLElBQUksSUFBSSxLQUFLLENBQUMsaUNBQStCLFNBQVMsQ0FBQyxJQUFNLENBQUMsQ0FBQztJQUUvRCxJQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLGNBQWMsbUJBQTBCLENBQUM7SUFFeEYsSUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBRXRDLG9FQUFvRTtJQUNwRSxJQUFNLElBQUksd0JBQ0wsbUNBQW1DLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsSUFDdkUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQzVCLFFBQVEsRUFBRSxFQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFDLEVBQ25DLFVBQVUsRUFBRSxFQUFFLEVBQ2QsS0FBSyxFQUFFLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsRUFDeEQsV0FBVyxFQUFFLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLEVBQ3hFLCtCQUErQixFQUFFLEtBQUssRUFDdEMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVcsRUFDcEUsYUFBYSxFQUNULENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQzNGLGFBQWEsRUFBRSw0QkFBNEIsRUFDM0MsVUFBVSxFQUFFLElBQUksRUFDaEIsYUFBYSxFQUNULFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUM5Rix1QkFBdUIsRUFBRSxFQUFFLEVBQzNCLGtCQUFrQixFQUFFLElBQUksR0FDekIsQ0FBQztJQUNGLElBQU0sR0FBRyxHQUFHLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRXRGLCtEQUErRDtJQUMvRCxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3JDLElBQUksRUFBRSxJQUFJLEVBQ1YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUM3RixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG1DQUFtQyxDQUN4QyxTQUFtQyxFQUFFLFNBQXdCLEVBQzdELFNBQTJCO0lBQzdCLElBQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUN0QyxJQUFNLElBQUksR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBRyxDQUFDO0lBQzlDLElBQUksSUFBSSxLQUFLLENBQUMsaUNBQStCLFNBQVMsQ0FBQyxJQUFNLENBQUMsQ0FBQztJQUUvRCxPQUFPO1FBQ0wsSUFBSSxNQUFBO1FBQ0osSUFBSSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDcEQsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixjQUFjLEVBQ1YsY0FBYyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDckYsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO1FBQzVCLElBQUksRUFBRSw4QkFBOEIsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUM7UUFDMUUsT0FBTyxFQUFFLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDO1FBQ2hFLFNBQVMsRUFBRTtZQUNULGFBQWEsRUFDVCxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBQSxTQUFTLElBQUksT0FBQSxTQUFTLElBQUksY0FBYyxDQUFDLFNBQVMsRUFBckMsQ0FBcUMsQ0FBQztTQUMzRjtRQUNELElBQUksRUFBRTtZQUNKLFVBQVUsRUFBRSxTQUFTLENBQUMsY0FBYztZQUNwQyxTQUFTLEVBQUUsT0FBTyxDQUFDLGFBQWE7WUFDaEMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxjQUFjO1NBQ25DO1FBQ0QsTUFBTSxFQUFFLFNBQVMsQ0FBQyxNQUFNO1FBQ3hCLE9BQU8sRUFBRSxTQUFTLENBQUMsT0FBTztRQUMxQixlQUFlLEVBQUUsS0FBSztRQUN0QixRQUFRLEVBQUUsSUFBSTtRQUNkLFNBQVMsRUFBRSxTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDOUYsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMseUJBQXlCLENBQzlCLE9BQStCLEVBQUUsU0FBd0I7SUFDM0QsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSztRQUN0QixJQUFJLElBQUksR0FBc0IsSUFBSSxDQUFDO1FBQ25DLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUN2QyxJQUFJLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM5RDtRQUNELE9BQU87WUFDTCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO1lBQ2xCLFNBQVMsRUFBRSwyQkFBMkIsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQztZQUNsRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJLE1BQUE7U0FDckMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQVMsMkJBQTJCLENBQ2hDLFNBQWlDLEVBQUUsU0FBd0I7SUFDN0QsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6RSxJQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLEtBQWUsRUFBckIsQ0FBcUIsQ0FBQyxDQUFDO1FBQ3RFLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxDQUFDLEtBQUssRUFBTixDQUFNLENBQUM7WUFDakMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7UUFDOUQsT0FBTyxTQUFTLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FDekMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBaEIsQ0FBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuRTtJQUVELElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7UUFDekIsSUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtZQUNwQixPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN6RDtLQUNGO0lBRUQsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDL0IsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3JCLENBQUM7QUFFRCxTQUFTLHFCQUFxQixDQUMxQixLQUFzQixFQUFFLFlBQTBCLEVBQUUsR0FBa0I7SUFDeEUsSUFBTSxTQUFTLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRXpELDJFQUEyRTtJQUMzRSxJQUFNLFVBQVUsR0FBRztRQUNqQixDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDO1FBQy9CLFNBQVM7UUFDVCxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7S0FDN0IsQ0FBQztJQUVGLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtRQUNkLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzdCO0lBRUQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELDZFQUE2RTtBQUM3RSxTQUFTLHVCQUF1QixDQUFDLFFBQXVCO0lBQ3RELE9BQU8sU0FBUyxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzdELENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLFVBQWU7O0lBQ2hELElBQU0sTUFBTSxHQUFtQixFQUFFLENBQUM7O1FBQ2xDLEtBQWdCLElBQUEsS0FBQSxpQkFBQSxNQUFNLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUEsZ0JBQUEsNEJBQUU7WUFBbkQsSUFBSSxHQUFHLFdBQUE7WUFDVixJQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztTQUMvQzs7Ozs7Ozs7O0lBQ0QsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNyQixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDN0I7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxvRUFBb0U7QUFDcEUsU0FBUyw0QkFBNEIsQ0FDakMsSUFBeUIsRUFBRSxZQUEwQjtJQUN2RCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ3ZCLElBQU0sVUFBVSxHQUFrQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEtBQXNCO1lBQ3hFLElBQU0sZUFBZSxHQUFHLHFCQUFxQixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekUsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztpQkFDdkMsTUFBTSxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztpQkFDakQsTUFBTSxFQUFFLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLElBQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUM5RCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFDN0MsUUFBUSxDQUFDLENBQUMsQ0FBSSxRQUFRLG9CQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNyRDtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELDJFQUEyRTtBQUMzRSxTQUFTLG1DQUFtQyxDQUFDLElBQXlCO0lBQ3BFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzNCLElBQU0sWUFBVSxHQUFrQixFQUFFLENBQUM7UUFDckMsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUMzQixJQUFNLFVBQVUsR0FBRztZQUNqQixJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUM7WUFDeEMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUM7U0FDaEQsQ0FBQztRQUNGLElBQU0sc0JBQW9CLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRCxrQkFBa0I7UUFDbEIsSUFBTSxXQUFTLEdBQUcsa0JBQWtCLENBQUMsWUFBVSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRWpFLDJDQUEyQztRQUMzQyxZQUFVLENBQUMsSUFBSSxDQUFDLHNCQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUMzRSxVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUMsS0FBc0IsRUFBRSxHQUFXO1lBQ3ZELElBQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNoRCxJQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUM7Z0JBQ3pELEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3JELENBQUMsQ0FBQztZQUNILElBQU0saUJBQWlCLEdBQUcsV0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3hELElBQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBRW5GLElBQU0sZUFBZSxHQUFHLHNCQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO2lCQUN4QyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3hGLElBQU0sOEJBQThCLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBRTdFLFlBQVUsQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMzRCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUCxVQUFVLEVBQUUsWUFBVSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUM3QyxRQUFRLENBQUMsQ0FBQyxDQUFJLFFBQVEsMkJBQXdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzVEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsU0FBUyxZQUFZLENBQUMsR0FBVztJQUMvQixPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxHQUF1QztJQUM5RCxJQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEdBQUc7UUFDeEMsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0QsT0FBTztZQUNMLEdBQUcsS0FBQTtZQUNILEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztZQUN2QixNQUFNLEVBQUUsSUFBSTtTQUNiLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsR0FBYTtJQUN0QyxPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRSxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3RDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLElBQXlCLEVBQUUsUUFBNkI7SUFDaEYsK0ZBQStGO0lBQy9GLDZDQUE2QztJQUM3QyxJQUFNLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUVqRSxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUU7UUFDN0Msa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDckQsWUFBWSxDQUFDLGVBQWUsQ0FBQztRQUM3QixJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDbEUsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDNUIsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsWUFBWSxFQUFkLENBQWMsQ0FBQyxDQUFDO0tBQ3pELENBQUMsQ0FBQyxDQUFDO0FBQ04sQ0FBQztBQUVELHFDQUFxQztBQUNyQyxTQUFTLHlCQUF5QixDQUM5QixJQUF5QixFQUFFLFlBQTBCO0lBQ3ZELElBQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxJQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7SUFDM0MsSUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFM0UsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ2hELElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFbEMsK0NBQStDO1FBQy9DLElBQU0sZUFBZSxHQUFHLHFCQUFxQixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRWhELGtFQUFrRTtRQUNsRSxJQUFNLFNBQVMsR0FBRyxhQUFhLEVBQUUsQ0FBQztRQUNsQyxJQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRixJQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQzthQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQzthQUN4QixHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztLQUM5RDtJQUVELElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLElBQUksQ0FBQyxJQUFJLFdBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ2hFLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUCxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFDL0U7UUFDRSxxQkFBcUIsaUJBQTBCLGdCQUFnQixDQUFDO1FBQ2hFLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUM7S0FDakUsRUFDRCxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBRUQsa0VBQWtFO0FBQ2xFLFNBQVMsMEJBQTBCLENBQy9CLElBQXlCLEVBQUUsUUFBdUIsRUFBRSxjQUE2QixFQUNqRixZQUE0QixFQUFFLGFBQTRCLEVBQUUsWUFBMEIsRUFDdEYsYUFBcUI7O0lBQ3ZCLElBQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxJQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7SUFFM0MsSUFBSSxrQkFBa0IsR0FBRyxhQUFhLENBQUM7SUFDdkMsSUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ2xELElBQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFakQsZ0NBQWdDO0lBQ2hDLElBQU0sYUFBYSxHQUNmLGFBQWEsQ0FBQyw0QkFBNEIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3hGLElBQUksYUFBYSxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUU7UUFDekMsSUFBTSxTQUFTLEdBQUcsbUJBQW1CLENBQUMsY0FBYyxFQUFFLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMzRSxnQkFBZ0IsQ0FBQyxJQUFJLE9BQXJCLGdCQUFnQixtQkFBUyxTQUFTLEdBQUU7S0FDckM7SUFFRCx1Q0FBdUM7SUFDdkMsSUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFFbEcsSUFBTSxTQUFTLEdBQUcsVUFBQyxRQUFhLEVBQUUsS0FBVTtRQUMxQyxPQUFPLHNCQUFzQixDQUN6QixJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsV0FBVyxDQUFDLFNBQVMsRUFBRSxjQUFNLE9BQUEsS0FBSyxDQUFDLDBCQUEwQixDQUFDLEVBQWpDLENBQWlDLENBQUMsQ0FBQztJQUNsRyxDQUFDLENBQUM7SUFDRixJQUFJLFFBQVEsRUFBRTtRQUNaLElBQU0sZUFBZSxHQUFHLFVBQUMsUUFBZ0I7WUFDdkMsSUFBTSxpQkFBaUIsR0FBRyxrQkFBa0IsQ0FBQztZQUM3QyxrQkFBa0IsSUFBSSxRQUFRLENBQUM7WUFDL0IsT0FBTyxpQkFBaUIsQ0FBQztRQUMzQixDQUFDLENBQUM7UUFDRixJQUFNLGNBQWMsR0FBRyxJQUFJLGNBQWMsQ0FDckMsWUFBWTtRQUNaLGdDQUFnQyxDQUFDLGNBQU0sT0FBQSxLQUFLLENBQUMsaUJBQWlCLENBQUMsRUFBeEIsQ0FBd0IsRUFBRSxlQUFlO1FBQ2hGLDRCQUE0QixDQUFDLGNBQU0sT0FBQSxLQUFLLENBQUMsaUJBQWlCLENBQUMsRUFBeEIsQ0FBd0IsQ0FBQyxDQUFDOztZQUVqRSxLQUFzQixJQUFBLGFBQUEsaUJBQUEsUUFBUSxDQUFBLGtDQUFBLHdEQUFFO2dCQUEzQixJQUFNLE9BQU8scUJBQUE7Z0JBQ2hCLElBQU0sTUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQzFCLElBQU0sV0FBVyxHQUFHLGdCQUFnQixDQUFDLE1BQUksQ0FBQyxDQUFDO2dCQUMzQyxJQUFJLFdBQVcsS0FBSyxPQUFPLEVBQUU7b0JBQ3JCLElBQUEsK0JBQStDLEVBQTlDLDhCQUFZLEVBQUUsY0FBZ0MsQ0FBQztvQkFDdEQsWUFBWSxDQUFDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7aUJBQzdGO3FCQUFNLElBQUksV0FBVyxLQUFLLE9BQU8sRUFBRTtvQkFDbEMsWUFBWSxDQUFDLGtCQUFrQixDQUMzQixrQkFBa0IsQ0FBQyxNQUFJLENBQUMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7aUJBQ3BGO3FCQUFNO29CQUNMLDZDQUE2QztvQkFDN0MsSUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7b0JBQ3ZELElBQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBRS9DLElBQUEsMENBQStFLEVBQTlFLDRCQUFXLEVBQUUsNEJBQVcsRUFBRSw0QkFBb0QsQ0FBQztvQkFFdEYsSUFBTSxnQkFBZ0IsR0FDbEIsYUFBYTt5QkFDUiw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDO3lCQUMzRSxNQUFNLENBQUMsVUFBQSxPQUFPLElBQUksT0FBQSxPQUFPLEtBQUssSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQXJDLENBQXFDLENBQUMsQ0FBQztvQkFFbEUsSUFBSSxXQUFXLEdBQXdCLElBQUksQ0FBQztvQkFDNUMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUU7d0JBQzNCLElBQUksZ0JBQWdCLENBQUMsTUFBTSxLQUFLLENBQUM7NEJBQzdCLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs0QkFDdkQsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7NEJBQ3BFLHdGQUF3Rjs0QkFDeEYsc0ZBQXNGOzRCQUN0RixvRkFBb0Y7NEJBQ3BGLGtDQUFrQzs0QkFDbEMsV0FBVyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLENBQUM7eUJBQ3pEOzZCQUFNOzRCQUNMLFdBQVcsR0FBRyxxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQzt5QkFDdkU7cUJBQ0Y7b0JBRUQsSUFBTSxpQkFBaUIsR0FBbUI7d0JBQ3hDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztxQkFDMUYsQ0FBQztvQkFDRixJQUFJLFdBQVcsRUFBRTt3QkFDZixpQkFBaUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7cUJBQ3JDO29CQUNELElBQUksQ0FBQyxXQUFXLEVBQUU7d0JBQ2hCLElBQUksQ0FBQyxXQUFXLEVBQUU7NEJBQ2hCLHlFQUF5RTs0QkFDekUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt5QkFDekM7d0JBQ0Qsc0RBQXNEO3dCQUN0RCxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3FCQUN6QztvQkFFRCxnQkFBZ0IsQ0FBQyxJQUFJLE9BQXJCLGdCQUFnQixtQkFBUyxXQUFXLENBQUMsS0FBSyxHQUFFO29CQUM1QyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2lCQUNyRjthQUNGOzs7Ozs7Ozs7UUFFRCxJQUFJLFlBQVksQ0FBQywwQkFBMEIsRUFBRSxFQUFFO1lBQzdDLDZFQUE2RTtZQUM3RSw0RUFBNEU7WUFDNUUsMEVBQTBFO1lBQzFFLHlFQUF5RTtZQUN6RSxrRUFBa0U7WUFDbEUsSUFBTSxvQkFBb0IsR0FDdEIsWUFBWSxDQUFDLGtDQUFrQyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztZQUN4RSxJQUFJLG9CQUFvQixFQUFFO2dCQUN4QixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7YUFDM0Y7WUFFRCxnRkFBZ0Y7WUFDaEYsdUVBQXVFO1lBQ3ZFLDZFQUE2RTtZQUM3RSxrRkFBa0Y7WUFDbEYsc0RBQXNEO1lBQ3RELElBQU0seUJBQXlCLEdBQzNCLFlBQVksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDcEUsSUFBSSx5QkFBeUIsRUFBRTtnQkFDN0IsZ0JBQWdCLENBQUMsSUFBSSxDQUNqQixpQkFBaUIsQ0FBQyx5QkFBeUIsRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUM5RTtZQUVELDJGQUEyRjtZQUMzRiwyRkFBMkY7WUFDM0YsNkNBQTZDO1lBQzdDLFlBQVksQ0FBQyw0QkFBNEIsQ0FBQyxjQUFjLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxXQUFXO2dCQUMzRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ25GLENBQUMsQ0FBQyxDQUFDO1NBQ0o7S0FDRjtJQUVELElBQUksa0JBQWtCLEVBQUU7UUFDdEIsZ0JBQWdCLENBQUMsT0FBTyxDQUNwQixDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7S0FDdEY7SUFFRCxJQUFJLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUM5RCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFJLElBQUksQ0FBQyxJQUFJLGtCQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUMxRSxJQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBQ3JDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1NBQ25GO1FBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQy9CLFVBQVUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDbkY7UUFDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1A7WUFDRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQztZQUM3RSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQU0sRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDO1NBQzlDLEVBQ0QsVUFBVSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUN0QixXQUErQixFQUFFLGNBQW1CLEVBQUUsU0FBbUI7SUFDM0UsSUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLFNBQVMsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUMsV0FBVyxFQUE1QyxDQUE0QyxDQUFDLENBQUM7SUFDOUYsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUM7U0FDbkUsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDO1NBQ3RDLE1BQU0sRUFBRSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLE9BQXVCO0lBRTNELElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDL0IsSUFBSSxXQUFrQyxDQUFDO0lBRXZDLGdFQUFnRTtJQUNoRSxJQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2xELElBQUksV0FBVyxFQUFFO1FBQ2YsV0FBVyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QixXQUFXLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO0tBQ25DO1NBQU07UUFDTCxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUU7WUFDdkIsV0FBVyxHQUFHLDRCQUE0QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3hELHFGQUFxRjtZQUNyRixtRkFBbUY7WUFDbkYsd0RBQXdEO1lBQ3hELFdBQVcsR0FBRyxFQUFFLENBQUMsOEJBQThCLENBQUM7U0FDakQ7YUFBTTtZQUNMLFdBQVcsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ2xDO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsV0FBVyxhQUFBLEVBQUUsV0FBVyxhQUFBLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FDeEIsY0FBNEIsRUFBRSxhQUE0QixFQUMxRCxJQUF5QjtJQUMzQixPQUFPLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBQSxPQUFPO1FBQzlCLElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25FLElBQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxJQUFJLHNCQUE4QixDQUFDLENBQUM7WUFDOUQsb0NBQW9DLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQzFFLFdBQVcsQ0FBQztRQUNoQixJQUFNLFdBQVcsR0FDYixJQUFJLENBQUMsSUFBSSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUksSUFBSSxDQUFDLElBQUksU0FBSSxhQUFhLHdCQUFxQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDekYsSUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQ3pDLFVBQVUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUUsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3RFLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQzNELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBeUI7SUFDbEQsbUJBQW1CO0lBQ25CLE9BQU87UUFDTCxjQUFjLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVO1FBQ3BDLGFBQWEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVM7UUFDbEMsY0FBYyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVTtLQUNWLENBQUM7SUFDN0Isa0JBQWtCO0FBQ3BCLENBQUM7QUFHRCxTQUFTLHNCQUFzQixDQUMzQixHQUE4QixFQUFFLFNBQXdCO0lBQzFELGlHQUFpRztJQUNqRyxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FDL0IsVUFBQyxFQUFXO1lBQVgsMEJBQVcsRUFBVixXQUFHLEVBQUUsWUFBSTtRQUE4QixPQUFBLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFBakMsQ0FBaUMsQ0FBQyxDQUFDO0lBQ2hGLE9BQU8sSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUIsQ0FBQztBQUVELElBQU0sWUFBWSxHQUFHLHFDQUFxQyxDQUFDO0FBVTNELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxJQUE2QjtJQUs3RCxJQUFNLFVBQVUsR0FBNEIsRUFBRSxDQUFDO0lBQy9DLElBQU0sU0FBUyxHQUE0QixFQUFFLENBQUM7SUFDOUMsSUFBTSxVQUFVLEdBQTRCLEVBQUUsQ0FBQztJQUUvQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUc7UUFDM0IsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLElBQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEMsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQ3BCLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDekI7YUFBTSxJQUFJLE9BQU8saUJBQTBCLElBQUksSUFBSSxFQUFFO1lBQ3BELDhEQUE4RDtZQUM5RCw4REFBOEQ7WUFDOUQsdURBQXVEO1lBQ3ZELFVBQVUsQ0FBQyxPQUFPLGlCQUEwQixDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3ZEO2FBQU0sSUFBSSxPQUFPLGVBQXdCLElBQUksSUFBSSxFQUFFO1lBQ2xELFNBQVMsQ0FBQyxPQUFPLGVBQXdCLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDcEQ7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sRUFBQyxVQUFVLFlBQUEsRUFBRSxTQUFTLFdBQUEsRUFBRSxVQUFVLFlBQUEsRUFBQyxDQUFDO0FBQzdDLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBQyxNQUFnQixFQUFFLFFBQWdCLEVBQUUsWUFBb0I7SUFDN0UsSUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztJQUNsQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQU0sT0FBTyxTQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxJQUFZO0lBQ3RDLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNkLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUN0QixJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtRQUNiLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsSUFBSSxTQUFTLEtBQUssS0FBSyxFQUFFO1lBQ3ZCLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xELFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDckQ7YUFBTTtZQUNMLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3ZEO0tBQ0Y7SUFDRCxPQUFPLEVBQUMsWUFBWSxjQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7dHlwZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyLCBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMsIHJlbmRlckZsYWdDaGVja0lmU3RtdCwgcmVzb2x2ZVNhbml0aXphdGlvbkZufSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBSRU5ERVJfRkxBR1MsIFRFTVBPUkFSWV9OQU1FLCBhc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9BUlJBWTogYW55W10gPSBbXTtcblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cbmZ1bmN0aW9uIGdldFN0eWxpbmdQcmVmaXgocHJvcE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBwcm9wTmFtZS5zdWJzdHJpbmcoMCwgNSkudG9Mb3dlckNhc2UoKTtcbn1cblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKToge2RlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W119IHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKG1ldGEuc2VsZWN0b3IpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnY29udGVudFF1ZXJpZXNSZWZyZXNoJywgY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YSkpO1xuXG4gIC8vIEluaXRpYWxpemUgaG9zdFZhcnNDb3VudCB0byBudW1iZXIgb2YgYm91bmQgaG9zdCBwcm9wZXJ0aWVzIChpbnRlcnBvbGF0aW9ucyBpbGxlZ2FsKSxcbiAgLy8gZXhjZXB0ICdzdHlsZScgYW5kICdjbGFzcycgcHJvcGVydGllcywgc2luY2UgdGhleSBzaG91bGQgKm5vdCogYWxsb2NhdGUgaG9zdCB2YXIgc2xvdHNcbiAgY29uc3QgaG9zdFZhcnNDb3VudCA9IE9iamVjdC5rZXlzKG1ldGEuaG9zdC5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIobmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBnZXRTdHlsaW5nUHJlZml4KG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByZWZpeCAhPT0gJ3N0eWxlJyAmJiBwcmVmaXggIT09ICdjbGFzcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGVuZ3RoO1xuXG4gIGNvbnN0IGVsVmFyRXhwID0gby52YXJpYWJsZSgnZWxJbmRleCcpO1xuICBjb25zdCBjb250ZXh0VmFyRXhwID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICBjb25zdCBzdHlsZUJ1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIoZWxWYXJFeHAsIGNvbnRleHRWYXJFeHApO1xuXG4gIGNvbnN0IGFsbE90aGVyQXR0cmlidXRlczogYW55ID0ge307XG4gIGNvbnN0IGF0dHJOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG1ldGEuaG9zdC5hdHRyaWJ1dGVzKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRyTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhdHRyID0gYXR0ck5hbWVzW2ldO1xuICAgIGNvbnN0IHZhbHVlID0gbWV0YS5ob3N0LmF0dHJpYnV0ZXNbYXR0cl07XG4gICAgc3dpdGNoIChhdHRyKSB7XG4gICAgICAvLyBzdHlsZSBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkIGluIHRoZSBzdHlsaW5nIGNvbnRleHRcbiAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBjbGFzcyBhdHRyaWJ1dGVzIGFyZSBoYW5kbGVkIGluIHRoZSBzdHlsaW5nIGNvbnRleHRcbiAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhbGxPdGhlckF0dHJpYnV0ZXNbYXR0cl0gPSB2YWx1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gZS5nLiBgYXR0cmlidXRlczogWydyb2xlJywgJ2xpc3Rib3gnXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2F0dHJpYnV0ZXMnLCBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KGFsbE90aGVyQXR0cmlidXRlcykpO1xuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgsIGVsSW5kZXgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJyxcbiAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgIG1ldGEsIGVsVmFyRXhwLCBjb250ZXh0VmFyRXhwLCBzdHlsZUJ1aWxkZXIsIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCwgaG9zdFZhcnNDb3VudCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLm91dHB1dHMpKTtcblxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIG8ubGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICByZXR1cm4ge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBBZGQgZmVhdHVyZXMgdG8gdGhlIGRlZmluaXRpb24gbWFwLlxuICovXG5mdW5jdGlvbiBhZGRGZWF0dXJlcyhcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHwgUjNDb21wb25lbnRNZXRhZGF0YSkge1xuICAvLyBlLmcuIGBmZWF0dXJlczogW05nT25DaGFuZ2VzRmVhdHVyZV1gXG4gIGNvbnN0IGZlYXR1cmVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0IHByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICBjb25zdCB2aWV3UHJvdmlkZXJzID0gKG1ldGEgYXMgUjNDb21wb25lbnRNZXRhZGF0YSkudmlld1Byb3ZpZGVycztcbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNEaXJlY3RpdmVEZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkRpcmVjdGl2ZURlZldpdGhNZXRhKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0Jhc2VSZWZNZXRhRGF0YSB7XG4gIGlucHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBbc3RyaW5nLCBzdHJpbmddfTtcbiAgb3V0cHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBiYXNlIGRlZmluaXRpb24gZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB7QGxpbmsgUjNCYXNlUmVmTWV0YWRhdGF9XG4gKiBAcGFyYW0gbWV0YSB0aGUgbWV0YWRhdGEgdXNlZCBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YShtZXRhOiBSM0Jhc2VSZWZNZXRhRGF0YSkge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcbiAgaWYgKG1ldGEuaW5wdXRzKSB7XG4gICAgY29uc3QgaW5wdXRzID0gbWV0YS5pbnB1dHM7XG4gICAgY29uc3QgaW5wdXRzTWFwID0gT2JqZWN0LmtleXMoaW5wdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHYgPSBpbnB1dHNba2V5XTtcbiAgICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheSh2KSA/IG8ubGl0ZXJhbEFycih2Lm1hcCh2eCA9PiBvLmxpdGVyYWwodngpKSkgOiBvLmxpdGVyYWwodik7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBvLmxpdGVyYWxNYXAoaW5wdXRzTWFwKSk7XG4gIH1cbiAgaWYgKG1ldGEub3V0cHV0cykge1xuICAgIGNvbnN0IG91dHB1dHMgPSBtZXRhLm91dHB1dHM7XG4gICAgY29uc3Qgb3V0cHV0c01hcCA9IE9iamVjdC5rZXlzKG91dHB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvLmxpdGVyYWwob3V0cHV0c1trZXldKTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBvLmxpdGVyYWxNYXAob3V0cHV0c01hcCkpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVCYXNlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkJhc2VEZWYpKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvckF0dHJpYnV0ZXMubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gdmFsdWUgIT0gbnVsbCA/IG8ubGl0ZXJhbCh2YWx1ZSkgOiBvLmxpdGVyYWwodW5kZWZpbmVkKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAvKiBmb3JjZVNoYXJlZCAqLyB0cnVlKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIENTUyBtYXRjaGVyIHRoYXQgcmVjb2duaXplIGRpcmVjdGl2ZVxuICBsZXQgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwgPSBudWxsO1xuXG4gIGlmIChtZXRhLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgZm9yIChjb25zdCB7c2VsZWN0b3IsIGV4cHJlc3Npb259IG9mIG1ldGEuZGlyZWN0aXZlcykge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH1cbiAgICBkaXJlY3RpdmVNYXRjaGVyID0gbWF0Y2hlcjtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEsIGNvbnN0YW50UG9vbCkpO1xuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IHBpcGVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBjaGFuZ2VEZXRlY3Rpb24gPSBtZXRhLmNoYW5nZURldGVjdGlvbjtcblxuICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgY29uc3RhbnRQb29sLCBCaW5kaW5nU2NvcGUuUk9PVF9TQ09QRSwgMCwgdGVtcGxhdGVUeXBlTmFtZSwgbnVsbCwgbnVsbCwgdGVtcGxhdGVOYW1lLFxuICAgICAgbWV0YS52aWV3UXVlcmllcywgZGlyZWN0aXZlTWF0Y2hlciwgZGlyZWN0aXZlc1VzZWQsIG1ldGEucGlwZXMsIHBpcGVzVXNlZCwgUjMubmFtZXNwYWNlSFRNTCxcbiAgICAgIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzKTtcblxuICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbiA9IHRlbXBsYXRlQnVpbGRlci5idWlsZFRlbXBsYXRlRnVuY3Rpb24odGVtcGxhdGUubm9kZXMsIFtdKTtcblxuICAvLyBlLmcuIGBjb25zdHM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuXG4gIC8vIGUuZy4gYGRpcmVjdGl2ZXM6IFtNeURpcmVjdGl2ZV1gXG4gIGlmIChkaXJlY3RpdmVzVXNlZC5zaXplKSB7XG4gICAgbGV0IGRpcmVjdGl2ZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShkaXJlY3RpdmVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIGRpcmVjdGl2ZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChkaXJlY3RpdmVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RpcmVjdGl2ZXMnLCBkaXJlY3RpdmVzRXhwcik7XG4gIH1cblxuICAvLyBlLmcuIGBwaXBlczogW015UGlwZV1gXG4gIGlmIChwaXBlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBwaXBlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKHBpcGVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUpIHtcbiAgICAgIHBpcGVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQocGlwZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBwaXBlc0V4cHIpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gc3R5bGUsIGRvbid0IGdlbmVyYXRlIGNzcyBzZWxlY3RvcnMgb24gZWxlbWVudHNcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLk5vbmU7XG4gIH1cblxuICAvLyBPbmx5IHNldCB2aWV3IGVuY2Fwc3VsYXRpb24gaWYgaXQncyBub3QgdGhlIGRlZmF1bHQgdmFsdWVcbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKG1ldGEuZW5jYXBzdWxhdGlvbikpO1xuICB9XG5cbiAgLy8gZS5nLiBgYW5pbWF0aW9uOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbicsIHZhbHVlOiBtZXRhLmFuaW1hdGlvbnMsIHF1b3RlZDogZmFsc2V9XSkpO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdGhlIGNoYW5nZSBkZXRlY3Rpb24gZmxhZyBpZiBpdCdzIGRlZmluZWQgYW5kIGl0J3Mgbm90IHRoZSBkZWZhdWx0LlxuICBpZiAoY2hhbmdlRGV0ZWN0aW9uICE9IG51bGwgJiYgY2hhbmdlRGV0ZWN0aW9uICE9PSBjb3JlLkNoYW5nZURldGVjdGlvblN0cmF0ZWd5LkRlZmF1bHQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKGNoYW5nZURldGVjdGlvbikpO1xuICB9XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuQ29tcG9uZW50RGVmV2l0aE1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZURpcmVjdGl2ZWAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtkaXJlY3RpdmUudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkRpcmVjdGl2ZSk7XG5cbiAgY29uc3QgbWV0YSA9IGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpO1xuICBjb25zdCByZXMgPSBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlQ29tcG9uZW50YCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzQ29tcG9uZW50TWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0OiBSZW5kZXIzUGFyc2VSZXN1bHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBkaXJlY3RpdmVUeXBlQnlTZWw6IE1hcDxzdHJpbmcsIGFueT4sXG4gICAgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIGFueT4pIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGNvbXBvbmVudC50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtjb21wb25lbnQudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkNvbXBvbmVudCk7XG5cbiAgY29uc3Qgc3VtbWFyeSA9IGNvbXBvbmVudC50b1N1bW1hcnkoKTtcblxuICAvLyBDb21wdXRlIHRoZSBSM0NvbXBvbmVudE1ldGFkYXRhIGZyb20gdGhlIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVxuICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgIC4uLmRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudCwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHNlbGVjdG9yOiBjb21wb25lbnQuc2VsZWN0b3IsXG4gICAgdGVtcGxhdGU6IHtub2RlczogcmVuZGVyM0FzdC5ub2Rlc30sXG4gICAgZGlyZWN0aXZlczogW10sXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgIGFuaW1hdGlvbnM6IG51bGwsXG4gICAgdmlld1Byb3ZpZGVyczpcbiAgICAgICAgY29tcG9uZW50LnZpZXdQcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihjb21wb25lbnQudmlld1Byb3ZpZGVycykgOiBudWxsLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgLy8gQ3JlYXRlIHRoZSBwYXJ0aWFsIGNsYXNzIHRvIGJlIG1lcmdlZCB3aXRoIHRoZSBhY3R1YWwgY2xhc3MuXG4gIG91dHB1dEN0eC5zdGF0ZW1lbnRzLnB1c2gobmV3IG8uQ2xhc3NTdG10KFxuICAgICAgbmFtZSwgbnVsbCxcbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKGRlZmluaXRpb25GaWVsZCwgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgcmVzLmV4cHJlc3Npb24pXSxcbiAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSkpO1xufVxuXG4vKipcbiAqIENvbXB1dGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGdpdmVuIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBhIGBDb21waWxlUmVmbGVjdG9yYC5cbiAqL1xuZnVuY3Rpb24gZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCxcbiAgICByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpOiBSM0RpcmVjdGl2ZU1ldGFkYXRhIHtcbiAgY29uc3Qgc3VtbWFyeSA9IGRpcmVjdGl2ZS50b1N1bW1hcnkoKTtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGRpcmVjdGl2ZS50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtkaXJlY3RpdmUudHlwZX1gKTtcblxuICByZXR1cm4ge1xuICAgIG5hbWUsXG4gICAgdHlwZTogb3V0cHV0Q3R4LmltcG9ydEV4cHIoZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlKSxcbiAgICB0eXBlQXJndW1lbnRDb3VudDogMCxcbiAgICB0eXBlU291cmNlU3BhbjpcbiAgICAgICAgdHlwZVNvdXJjZVNwYW4oZGlyZWN0aXZlLmlzQ29tcG9uZW50ID8gJ0NvbXBvbmVudCcgOiAnRGlyZWN0aXZlJywgZGlyZWN0aXZlLnR5cGUpLFxuICAgIHNlbGVjdG9yOiBkaXJlY3RpdmUuc2VsZWN0b3IsXG4gICAgZGVwczogZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZS50eXBlLCBvdXRwdXRDdHgsIHJlZmxlY3RvciksXG4gICAgcXVlcmllczogcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUucXVlcmllcywgb3V0cHV0Q3R4KSxcbiAgICBsaWZlY3ljbGU6IHtcbiAgICAgIHVzZXNPbkNoYW5nZXM6XG4gICAgICAgICAgZGlyZWN0aXZlLnR5cGUubGlmZWN5Y2xlSG9va3Muc29tZShsaWZlY3ljbGUgPT4gbGlmZWN5Y2xlID09IExpZmVjeWNsZUhvb2tzLk9uQ2hhbmdlcyksXG4gICAgfSxcbiAgICBob3N0OiB7XG4gICAgICBhdHRyaWJ1dGVzOiBkaXJlY3RpdmUuaG9zdEF0dHJpYnV0ZXMsXG4gICAgICBsaXN0ZW5lcnM6IHN1bW1hcnkuaG9zdExpc3RlbmVycyxcbiAgICAgIHByb3BlcnRpZXM6IHN1bW1hcnkuaG9zdFByb3BlcnRpZXMsXG4gICAgfSxcbiAgICBpbnB1dHM6IGRpcmVjdGl2ZS5pbnB1dHMsXG4gICAgb3V0cHV0czogZGlyZWN0aXZlLm91dHB1dHMsXG4gICAgdXNlc0luaGVyaXRhbmNlOiBmYWxzZSxcbiAgICBleHBvcnRBczogbnVsbCxcbiAgICBwcm92aWRlcnM6IGRpcmVjdGl2ZS5wcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihkaXJlY3RpdmUucHJvdmlkZXJzKSA6IG51bGxcbiAgfTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlUXVlcnlNZXRhZGF0YWAgaW50byBgUjNRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBSM1F1ZXJ5TWV0YWRhdGFbXSB7XG4gIHJldHVybiBxdWVyaWVzLm1hcChxdWVyeSA9PiB7XG4gICAgbGV0IHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAocXVlcnkucmVhZCAmJiBxdWVyeS5yZWFkLmlkZW50aWZpZXIpIHtcbiAgICAgIHJlYWQgPSBvdXRwdXRDdHguaW1wb3J0RXhwcihxdWVyeS5yZWFkLmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3BlcnR5TmFtZTogcXVlcnkucHJvcGVydHlOYW1lLFxuICAgICAgZmlyc3Q6IHF1ZXJ5LmZpcnN0LFxuICAgICAgcHJlZGljYXRlOiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEocXVlcnkuc2VsZWN0b3JzLCBvdXRwdXRDdHgpLFxuICAgICAgZGVzY2VuZGFudHM6IHF1ZXJ5LmRlc2NlbmRhbnRzLCByZWFkLFxuICAgIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVUb2tlbk1ldGFkYXRhYCBmb3IgcXVlcnkgc2VsZWN0b3JzIGludG8gZWl0aGVyIGFuIGV4cHJlc3Npb24gZm9yIGEgcHJlZGljYXRlXG4gKiB0eXBlLCBvciBhIGxpc3Qgb2Ygc3RyaW5nIHByZWRpY2F0ZXMuXG4gKi9cbmZ1bmN0aW9uIHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBzZWxlY3RvcnM6IENvbXBpbGVUb2tlbk1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IG8uRXhwcmVzc2lvbnxzdHJpbmdbXSB7XG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMSB8fCAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxICYmIHNlbGVjdG9yc1swXS52YWx1ZSkpIHtcbiAgICBjb25zdCBzZWxlY3RvclN0cmluZ3MgPSBzZWxlY3RvcnMubWFwKHZhbHVlID0+IHZhbHVlLnZhbHVlIGFzIHN0cmluZyk7XG4gICAgc2VsZWN0b3JTdHJpbmdzLnNvbWUodmFsdWUgPT4gIXZhbHVlKSAmJlxuICAgICAgICBlcnJvcignRm91bmQgYSB0eXBlIGFtb25nIHRoZSBzdHJpbmcgc2VsZWN0b3JzIGV4cGVjdGVkJyk7XG4gICAgcmV0dXJuIG91dHB1dEN0eC5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JTdHJpbmdzLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpO1xuICB9XG5cbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSkge1xuICAgIGNvbnN0IGZpcnN0ID0gc2VsZWN0b3JzWzBdO1xuICAgIGlmIChmaXJzdC5pZGVudGlmaWVyKSB7XG4gICAgICByZXR1cm4gb3V0cHV0Q3R4LmltcG9ydEV4cHIoZmlyc3QuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgfVxuXG4gIGVycm9yKCdVbmV4cGVjdGVkIHF1ZXJ5IGZvcm0nKTtcbiAgcmV0dXJuIG8uTlVMTF9FWFBSO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVRdWVyeURlZmluaXRpb24oXG4gICAgcXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGlkeDogbnVtYmVyIHwgbnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHByZWRpY2F0ZSA9IGdldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCBjb25zdGFudFBvb2wpO1xuXG4gIC8vIGUuZy4gcjMucXVlcnkobnVsbCwgc29tZVByZWRpY2F0ZSwgZmFsc2UpIG9yIHIzLnF1ZXJ5KDAsIFsnZGl2J10sIGZhbHNlKVxuICBjb25zdCBwYXJhbWV0ZXJzID0gW1xuICAgIG8ubGl0ZXJhbChpZHgsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgcHJlZGljYXRlLFxuICAgIG8ubGl0ZXJhbChxdWVyeS5kZXNjZW5kYW50cyksXG4gIF07XG5cbiAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICBwYXJhbWV0ZXJzLnB1c2gocXVlcnkucmVhZCk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnF1ZXJ5KS5jYWxsRm4ocGFyYW1ldGVycyk7XG59XG5cbi8vIFR1cm4gYSBkaXJlY3RpdmUgc2VsZWN0b3IgaW50byBhbiBSMy1jb21wYXRpYmxlIHNlbGVjdG9yIGZvciBkaXJlY3RpdmUgZGVmXG5mdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nIHwgbnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBhc0xpdGVyYWwoY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHNlbGVjdG9yKSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RBdHRyaWJ1dGVzQXJyYXkoYXR0cmlidXRlczogYW55KTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGZvciAobGV0IGtleSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKSkge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1trZXldO1xuICAgIHZhbHVlcy5wdXNoKG8ubGl0ZXJhbChrZXkpLCBvLmxpdGVyYWwodmFsdWUpKTtcbiAgfVxuICBpZiAodmFsdWVzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBtZXRhLnF1ZXJpZXMubWFwKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgICBjb25zdCBxdWVyeURlZmluaXRpb24gPSBjcmVhdGVRdWVyeURlZmluaXRpb24ocXVlcnksIGNvbnN0YW50UG9vbCwgbnVsbCk7XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnJlZ2lzdGVyQ29udGVudFF1ZXJ5KVxuICAgICAgICAgIC5jYWxsRm4oW3F1ZXJ5RGVmaW5pdGlvbiwgby52YXJpYWJsZSgnZGlySW5kZXgnKV0pXG4gICAgICAgICAgLnRvU3RtdCgpO1xuICAgIH0pO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbbmV3IG8uRm5QYXJhbSgnZGlySW5kZXgnLCBvLk5VTUJFUl9UWVBFKV07XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIHBhcmFtZXRlcnMsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCxcbiAgICAgICAgdHlwZU5hbWUgPyBgJHt0eXBlTmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbCk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gUmV0dXJuIGEgY29udGVudFF1ZXJpZXNSZWZyZXNoIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc1JlZnJlc2hGdW5jdGlvbihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICAgIG5ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgICBuZXcgby5GblBhcmFtKCdxdWVyeVN0YXJ0SW5kZXgnLCBvLk5VTUJFUl9UWVBFKSxcbiAgICBdO1xuICAgIGNvbnN0IGRpcmVjdGl2ZUluc3RhbmNlVmFyID0gby52YXJpYWJsZSgnaW5zdGFuY2UnKTtcbiAgICAvLyB2YXIgJHRtcCQ6IGFueTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wb3JhcnlBbGxvY2F0b3Ioc3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gICAgLy8gY29uc3QgJGluc3RhbmNlJCA9ICRyMyQuybVsb2FkKGRpckluZGV4KTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goZGlyZWN0aXZlSW5zdGFuY2VWYXIuc2V0KG8uaW1wb3J0RXhwcihSMy5sb2FkKS5jYWxsRm4oW28udmFyaWFibGUoJ2RpckluZGV4JyldKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC50b0RlY2xTdG10KG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLkZpbmFsXSkpO1xuXG4gICAgbWV0YS5xdWVyaWVzLmZvckVhY2goKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCBsb2FkUUxBcmcgPSBvLnZhcmlhYmxlKCdxdWVyeVN0YXJ0SW5kZXgnKTtcbiAgICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnlMaXN0KS5jYWxsRm4oW1xuICAgICAgICBpZHggPiAwID8gbG9hZFFMQXJnLnBsdXMoby5saXRlcmFsKGlkeCkpIDogbG9hZFFMQXJnXG4gICAgICBdKTtcbiAgICAgIGNvbnN0IGFzc2lnblRvVGVtcG9yYXJ5ID0gdGVtcG9yYXJ5KCkuc2V0KGdldFF1ZXJ5TGlzdCk7XG4gICAgICBjb25zdCBjYWxsUXVlcnlSZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFthc3NpZ25Ub1RlbXBvcmFyeV0pO1xuXG4gICAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBkaXJlY3RpdmVJbnN0YW5jZVZhci5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5KCkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSgpKTtcbiAgICAgIGNvbnN0IHJlZnJlc2hRdWVyeUFuZFVwZGF0ZURpcmVjdGl2ZSA9IGNhbGxRdWVyeVJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSk7XG5cbiAgICAgIHN0YXRlbWVudHMucHVzaChyZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUudG9TdG10KCkpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIHBhcmFtZXRlcnMsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCxcbiAgICAgICAgdHlwZU5hbWUgPyBgJHt0eXBlTmFtZX1fQ29udGVudFF1ZXJpZXNSZWZyZXNoYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNUeXBlKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdfSk6IG8uVHlwZSB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogc3RyaW5nW10pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHlwZUZvckRlZihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCB0eXBlQmFzZTogby5FeHRlcm5hbFJlZmVyZW5jZSk6IG8uVHlwZSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIodHlwZUJhc2UsIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEuaW5wdXRzKSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5vdXRwdXRzKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXSkpO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWV0YS52aWV3UXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHF1ZXJ5ID0gbWV0YS52aWV3UXVlcmllc1tpXTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIGkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xUih0bXAgPSByMy7JtWxvYWQoMCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwoaSldKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fUXVlcnlgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB2aWV3UXVlcnlGbk5hbWUpO1xufVxuXG4vLyBSZXR1cm4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGVsVmFyRXhwOiBvLlJlYWRWYXJFeHByLCBiaW5kaW5nQ29udGV4dDogby5SZWFkVmFyRXhwcixcbiAgICBzdHlsZUJ1aWxkZXI6IFN0eWxpbmdCdWlsZGVyLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBob3N0VmFyc0NvdW50OiBudW1iZXIpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGxldCB0b3RhbEhvc3RWYXJzQ291bnQgPSBob3N0VmFyc0NvdW50O1xuICBjb25zdCBob3N0QmluZGluZ1NvdXJjZVNwYW4gPSBtZXRhLnR5cGVTb3VyY2VTcGFuO1xuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkobWV0YSk7XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBjcmVhdGVIb3N0TGlzdGVuZXJzKGJpbmRpbmdDb250ZXh0LCBldmVudEJpbmRpbmdzLCBtZXRhKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goLi4ubGlzdGVuZXJzKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBiaW5kaW5ncyA9IGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuXG4gIGNvbnN0IGJpbmRpbmdGbiA9IChpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNUKSA9PiB7XG4gICAgcmV0dXJuIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIG51bGwsIGltcGxpY2l0LCB2YWx1ZSwgJ2InLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gIH07XG4gIGlmIChiaW5kaW5ncykge1xuICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IG51bVNsb3RzO1xuICAgICAgcmV0dXJuIG9yaWdpbmFsVmFyc0NvdW50O1xuICAgIH07XG4gICAgY29uc3QgdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgLyogbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmUgKi8gKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgIC8qIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmUgKi8gKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTtcblxuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBiaW5kaW5ncykge1xuICAgICAgY29uc3QgbmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgICAgIGNvbnN0IHN0eWxlUHJlZml4ID0gZ2V0U3R5bGluZ1ByZWZpeChuYW1lKTtcbiAgICAgIGlmIChzdHlsZVByZWZpeCA9PT0gJ3N0eWxlJykge1xuICAgICAgICBjb25zdCB7cHJvcGVydHlOYW1lLCB1bml0fSA9IHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lKTtcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVJbnB1dChwcm9wZXJ0eU5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgdW5pdCwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSBpZiAoc3R5bGVQcmVmaXggPT09ICdjbGFzcycpIHtcbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NJbnB1dChcbiAgICAgICAgICAgIHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lKS5wcm9wZXJ0eU5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdCh2YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICAgICAgY29uc3Qge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGV9ID0gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nKTtcblxuICAgICAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgICAgIGJpbmRpbmdQYXJzZXJcbiAgICAgICAgICAgICAgICAuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhtZXRhLnNlbGVjdG9yIHx8ICcnLCBiaW5kaW5nTmFtZSwgaXNBdHRyaWJ1dGUpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IGNvcmUuU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuXG4gICAgICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCA9PT0gMiAmJlxuICAgICAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwpID4gLTEpIHtcbiAgICAgICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3Igc29tZSBVUkwgYXR0cmlidXRlcyAoc3VjaCBhcyBcInNyY1wiIGFuZCBcImhyZWZcIikgdGhhdCBtYXkgYmUgYSBwYXJ0IG9mXG4gICAgICAgICAgICAvLyBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW50aXRpemF0aW9uIGZ1bmN0aW9uIGFuZFxuICAgICAgICAgICAgLy8gc2VsZWN0IHRoZSBhY3R1YWwgc2FuaXRpemVyIGF0IHJ1bnRpbWUgYmFzZWQgb24gYSB0YWcgbmFtZSB0aGF0IGlzIHByb3ZpZGVkIHdoaWxlXG4gICAgICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgICAgICBzYW5pdGl6ZXJGbiA9IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmwpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25QYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgICAgIGVsVmFyRXhwLCBvLmxpdGVyYWwoYmluZGluZ05hbWUpLCBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl0pXG4gICAgICAgIF07XG4gICAgICAgIGlmIChzYW5pdGl6ZXJGbikge1xuICAgICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaXNBdHRyaWJ1dGUpIHtcbiAgICAgICAgICBpZiAoIXNhbml0aXplckZuKSB7XG4gICAgICAgICAgICAvLyBhcHBlbmQgYG51bGxgIGluIGZyb250IG9mIGBuYXRpdmVPbmx5YCBmbGFnIGlmIG5vIHNhbml0aXplciBmbiBkZWZpbmVkXG4gICAgICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGhvc3QgYmluZGluZ3MgbXVzdCBoYXZlIG5hdGl2ZU9ubHkgcHJvcCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5saXRlcmFsKHRydWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihpbnN0cnVjdGlvblBhcmFtcykudG9TdG10KCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMoKSkge1xuICAgICAgLy8gc2luY2Ugd2UncmUgZGVhbGluZyB3aXRoIGRpcmVjdGl2ZXMgaGVyZSBhbmQgZGlyZWN0aXZlcyBoYXZlIGEgaG9zdEJpbmRpbmdcbiAgICAgIC8vIGZ1bmN0aW9uLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIHNwZWNpYWwgaW5zdHJ1Y3Rpb25zIHRoYXQgZGVhbCB3aXRoIHN0eWxpbmdcbiAgICAgIC8vIChib3RoIGJpbmRpbmdzIGFuZCBpbml0aWFsIHZhbHVlcykuIFRoZSBpbnN0cnVjdGlvbiBiZWxvdyB3aWxsIGluc3RydWN0XG4gICAgICAvLyBhbGwgaW5pdGlhbCBzdHlsaW5nIChzdHlsaW5nIHRoYXQgaXMgaW5zaWRlIG9mIGEgaG9zdCBiaW5kaW5nIHdpdGhpbiBhXG4gICAgICAvLyBkaXJlY3RpdmUpIHRvIGJlIGF0dGFjaGVkIHRvIHRoZSBob3N0IGVsZW1lbnQgb2YgdGhlIGRpcmVjdGl2ZS5cbiAgICAgIGNvbnN0IGhvc3RBdHRyc0luc3RydWN0aW9uID1cbiAgICAgICAgICBzdHlsZUJ1aWxkZXIuYnVpbGREaXJlY3RpdmVIb3N0QXR0cnNJbnN0cnVjdGlvbihudWxsLCBjb25zdGFudFBvb2wpO1xuICAgICAgaWYgKGhvc3RBdHRyc0luc3RydWN0aW9uKSB7XG4gICAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChob3N0QXR0cnNJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgICAgfVxuXG4gICAgICAvLyBzaW5ndWxhciBzdHlsZS9jbGFzcyBiaW5kaW5ncyAodGhpbmdzIGxpa2UgYFtzdHlsZS5wcm9wXWAgYW5kIGBbY2xhc3MubmFtZV1gKVxuICAgICAgLy8gTVVTVCBiZSByZWdpc3RlcmVkIG9uIGEgZ2l2ZW4gZWxlbWVudCB3aXRoaW4gdGhlIGNvbXBvbmVudC9kaXJlY3RpdmVcbiAgICAgIC8vIHRlbXBsYXRlRm4vaG9zdEJpbmRpbmdzRm4gZnVuY3Rpb25zLiBUaGUgaW5zdHJ1Y3Rpb24gYmVsb3cgd2lsbCBmaWd1cmUgb3V0XG4gICAgICAvLyB3aGF0IGFsbCB0aGUgYmluZGluZ3MgYXJlIGFuZCB0aGVuIGdlbmVyYXRlIHRoZSBzdGF0ZW1lbnRzIHJlcXVpcmVkIHRvIHJlZ2lzdGVyXG4gICAgICAvLyB0aG9zZSBiaW5kaW5ncyB0byB0aGUgZWxlbWVudCB2aWEgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICAgIGNvbnN0IGVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAgIHN0eWxlQnVpbGRlci5idWlsZEVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24obnVsbCwgY29uc3RhbnRQb29sKTtcbiAgICAgIGlmIChlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uKSB7XG4gICAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICAgIGNyZWF0ZVN0eWxpbmdTdG10KGVsZW1lbnRTdHlsaW5nSW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICAgIH1cblxuICAgICAgLy8gZmluYWxseSBlYWNoIGJpbmRpbmcgdGhhdCB3YXMgcmVnaXN0ZXJlZCBpbiB0aGUgc3RhdGVtZW50IGFib3ZlIHdpbGwgbmVlZCB0byBiZSBhZGRlZCB0b1xuICAgICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgICBzdHlsZUJ1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh2YWx1ZUNvbnZlcnRlcikuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdHlsaW5nU3RtdChpbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRvdGFsSG9zdFZhcnNDb3VudCkge1xuICAgIGNyZWF0ZVN0YXRlbWVudHMudW5zaGlmdChcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLmFsbG9jSG9zdFZhcnMpLmNhbGxGbihbby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCldKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwIHx8IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGhvc3RCaW5kaW5nc0ZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oZWxWYXJFeHAubmFtZSAhLCBvLk5VTUJFUl9UWVBFKVxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IFN0eWxpbmdJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQ6IGFueSwgYmluZGluZ0ZuOiBGdW5jdGlvbik6IG8uU3RhdGVtZW50IHtcbiAgY29uc3QgcGFyYW1zID0gaW5zdHJ1Y3Rpb24uYnVpbGRQYXJhbXModmFsdWUgPT4gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSkuY3VyclZhbEV4cHIpO1xuICByZXR1cm4gby5pbXBvcnRFeHByKGluc3RydWN0aW9uLnJlZmVyZW5jZSwgbnVsbCwgaW5zdHJ1Y3Rpb24uc291cmNlU3BhbilcbiAgICAgIC5jYWxsRm4ocGFyYW1zLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLnRvU3RtdCgpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KTpcbiAgICB7YmluZGluZ05hbWU6IHN0cmluZywgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzQXR0cmlidXRlOiBib29sZWFufSB7XG4gIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgbGV0IGluc3RydWN0aW9uICE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgYW4gYXR0ciBiaW5kaW5nIG9yIGEgcHJvcGVydHkgYmluZGluZ1xuICBjb25zdCBhdHRyTWF0Y2hlcyA9IGJpbmRpbmdOYW1lLm1hdGNoKEFUVFJfUkVHRVgpO1xuICBpZiAoYXR0ck1hdGNoZXMpIHtcbiAgICBiaW5kaW5nTmFtZSA9IGF0dHJNYXRjaGVzWzFdO1xuICAgIGluc3RydWN0aW9uID0gUjMuZWxlbWVudEF0dHJpYnV0ZTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoYmluZGluZy5pc0FuaW1hdGlvbikge1xuICAgICAgYmluZGluZ05hbWUgPSBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGJpbmRpbmdOYW1lKTtcbiAgICAgIC8vIGhvc3QgYmluZGluZ3MgdGhhdCBoYXZlIGEgc3ludGhldGljIHByb3BlcnR5IChlLmcuIEBmb28pIHNob3VsZCBhbHdheXMgYmUgcmVuZGVyZWRcbiAgICAgIC8vIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21wb25lbnQgYW5kIG5vdCB0aGUgcGFyZW50LiBUaGVyZWZvcmUgdGhlcmUgaXMgYSBzcGVjaWFsXG4gICAgICAvLyBjb21wYXRpYmlsaXR5IGluc3RydWN0aW9uIGF2YWlsYWJsZSBmb3IgdGhpcyBwdXJwb3NlLlxuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5jb21wb25lbnRIb3N0U3ludGhldGljUHJvcGVydHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc3RydWN0aW9uID0gUjMuZWxlbWVudFByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZTogISFhdHRyTWF0Y2hlc307XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RMaXN0ZW5lcnMoXG4gICAgYmluZGluZ0NvbnRleHQ6IG8uRXhwcmVzc2lvbiwgZXZlbnRCaW5kaW5nczogUGFyc2VkRXZlbnRbXSxcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5TdGF0ZW1lbnRbXSB7XG4gIHJldHVybiBldmVudEJpbmRpbmdzLm1hcChiaW5kaW5nID0+IHtcbiAgICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IGJpbmRpbmcudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShiaW5kaW5nTmFtZSwgYmluZGluZy50YXJnZXRPclBoYXNlKSA6XG4gICAgICAgIGJpbmRpbmdOYW1lO1xuICAgIGNvbnN0IGhhbmRsZXJOYW1lID1cbiAgICAgICAgbWV0YS5uYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7bWV0YS5uYW1lfV8ke2JpbmRpbmdGbk5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IHBhcmFtcyA9IHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhcbiAgICAgICAgQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoYmluZGluZyksIGJpbmRpbmdDb250ZXh0LCBoYW5kbGVyTmFtZSk7XG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5saXN0ZW5lcikuY2FsbEZuKHBhcmFtcykudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgaG9zdEF0dHJpYnV0ZXM6IG1ldGEuaG9zdC5hdHRyaWJ1dGVzLFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KToge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG59IHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGhvc3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXN9O1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHsgcmV0dXJuIHNoYWRvd0NzcyAhLnNoaW1Dc3NUZXh0KHN0eWxlLCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTsgfSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTmFtZWRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiB7cHJvcGVydHlOYW1lOiBzdHJpbmcsIHVuaXQ6IHN0cmluZ30ge1xuICBsZXQgdW5pdCA9ICcnO1xuICBsZXQgcHJvcGVydHlOYW1lID0gJyc7XG4gIGNvbnN0IGluZGV4ID0gbmFtZS5pbmRleE9mKCcuJyk7XG4gIGlmIChpbmRleCA+IDApIHtcbiAgICBjb25zdCB1bml0SW5kZXggPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG4gICAgaWYgKHVuaXRJbmRleCAhPT0gaW5kZXgpIHtcbiAgICAgIHVuaXQgPSBuYW1lLnN1YnN0cmluZyh1bml0SW5kZXggKyAxLCBuYW1lLmxlbmd0aCk7XG4gICAgICBwcm9wZXJ0eU5hbWUgPSBuYW1lLnN1YnN0cmluZyhpbmRleCArIDEsIHVuaXRJbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByb3BlcnR5TmFtZSA9IG5hbWUuc3Vic3RyaW5nKGluZGV4ICsgMSwgbmFtZS5sZW5ndGgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4ge3Byb3BlcnR5TmFtZSwgdW5pdH07XG59XG4iXX0=