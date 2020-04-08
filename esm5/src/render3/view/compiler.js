/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __assign, __read, __spread, __values } from "tslib";
import { identifierName, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import * as o from '../../output/output_ast';
import { CssSelector, SelectorMatcher } from '../../selector';
import { ShadowCss } from '../../shadow_css';
import { CONTENT_ATTR, HOST_ATTR } from '../../style_compiler';
import { error } from '../../util';
import { BoundEvent } from '../r3_ast';
import { compileFactoryFunction, R3FactoryTarget } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { prepareSyntheticListenerFunctionName, prepareSyntheticPropertyName, typeWithParameters } from '../util';
import { MIN_STYLING_BINDING_SLOTS_REQUIRED, StylingBuilder } from './styling_builder';
import { BindingScope, makeBindingParser, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn, TemplateDefinitionBuilder, ValueConverter } from './template';
import { asLiteral, chainedInstruction, conditionallyCreateMapObjectLiteral, CONTEXT_NAME, DefinitionMap, getQueryPredicate, RENDER_FLAGS, TEMPORARY_NAME, temporaryAllocator } from './util';
var EMPTY_ARRAY = [];
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
var ATTR_REGEX = /attr\.([^\]]+)/;
function baseDirectiveFields(meta, constantPool, bindingParser) {
    var definitionMap = new DefinitionMap();
    var selectors = core.parseSelectorToR3Selector(meta.selector);
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.internalType);
    // e.g. `selectors: [['', 'someDir', '']]`
    if (selectors.length > 0) {
        definitionMap.set('selectors', asLiteral(selectors));
    }
    if (meta.queries.length > 0) {
        // e.g. `contentQueries: (rf, ctx, dirIndex) => { ... }
        definitionMap.set('contentQueries', createContentQueriesFunction(meta.queries, constantPool, meta.name));
    }
    if (meta.viewQueries.length) {
        definitionMap.set('viewQuery', createViewQueriesFunction(meta.viewQueries, constantPool, meta.name));
    }
    // e.g. `hostBindings: (rf, ctx) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || '', meta.name, definitionMap));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs, true));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(function (e) { return o.literal(e); })));
    }
    return definitionMap;
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
    if (meta.fullInheritance) {
        features.push(o.importExpr(R3.CopyDefinitionFeature));
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
    var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
    addFeatures(definitionMap, meta);
    var expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    var typeParams = createDirectiveTypeParams(meta);
    var type = o.expressionType(o.importExpr(R3.DirectiveDefWithMeta, typeParams));
    return { expression: expression, type: type };
}
/**
 * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
 */
export function compileComponentFromMetadata(meta, constantPool, bindingParser) {
    var e_1, _a;
    var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
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
            for (var _b = __values(meta.directives), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = _c.value, selector_1 = _d.selector, expression_1 = _d.expression;
                matcher.addSelectables(CssSelector.parse(selector_1), expression_1);
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
    var templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
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
    var expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()]);
    var typeParams = createDirectiveTypeParams(meta);
    typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
    var type = o.expressionType(o.importExpr(R3.ComponentDefWithMeta, typeParams));
    return { expression: expression, type: type };
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
    var factoryRes = compileFactoryFunction(__assign(__assign({}, meta), { injectFn: R3.directiveInject, target: R3FactoryTarget.Directive }));
    var ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
    var directiveDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(ngFactoryDefStatement, directiveDefStatement);
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
    var meta = __assign(__assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector)), { selector: component.selector, template: { nodes: render3Ast.nodes, ngContentSelectors: render3Ast.ngContentSelectors }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
    var res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
    var factoryRes = compileFactoryFunction(__assign(__assign({}, meta), { injectFn: R3.directiveInject, target: R3FactoryTarget.Directive }));
    var ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
    var componentDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(ngFactoryDefStatement, componentDefStatement);
}
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
            descendants: query.descendants,
            read: read,
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
    var parameters = [getQueryPredicate(query, constantPool), o.literal(query.descendants)];
    if (query.read) {
        parameters.push(query.read);
    }
    return parameters;
}
function convertAttributesToExpressions(attributes) {
    var e_2, _a;
    var values = [];
    try {
        for (var _b = __values(Object.getOwnPropertyNames(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
    var tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    try {
        for (var queries_1 = __values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
            var query = queries_1_1.value;
            var queryInstruction = query.static ? R3.staticContentQuery : R3.contentQuery;
            // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
            createStatements.push(o.importExpr(queryInstruction)
                .callFn(__spread([o.variable('dirIndex')], prepareQueryParams(query, constantPool)))
                .toStmt());
            // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
            var temporary = tempAllocator();
            var getQueryList = o.importExpr(R3.loadQuery).callFn([]);
            var refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
            var updateDirective = o.variable(CONTEXT_NAME)
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
        new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null),
        new o.FnParam('dirIndex', null)
    ], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
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
function createDirectiveTypeParams(meta) {
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    var selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;
    return [
        typeWithParameters(meta.type.type, meta.typeArgumentCount),
        selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
        meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
        stringMapAsType(meta.inputs),
        stringMapAsType(meta.outputs),
        stringArrayAsType(meta.queries.map(function (q) { return q.propertyName; })),
    ];
}
// Define and update any view queries
function createViewQueriesFunction(viewQueries, constantPool, name) {
    var createStatements = [];
    var updateStatements = [];
    var tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    viewQueries.forEach(function (query) {
        var queryInstruction = query.static ? R3.staticViewQuery : R3.viewQuery;
        // creation, e.g. r3.viewQuery(somePredicate, true);
        var queryDefinition = o.importExpr(queryInstruction).callFn(prepareQueryParams(query, constantPool));
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
        var temporary = tempAllocator();
        var getQueryList = o.importExpr(R3.loadQuery).callFn([]);
        var refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        var updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    });
    var viewQueryFnName = name ? name + "_Query" : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
    var bindingContext = o.variable(CONTEXT_NAME);
    var styleBuilder = new StylingBuilder(bindingContext);
    var _a = hostBindingsMetadata.specialAttributes, styleAttr = _a.styleAttr, classAttr = _a.classAttr;
    if (styleAttr !== undefined) {
        styleBuilder.registerStyleAttr(styleAttr);
    }
    if (classAttr !== undefined) {
        styleBuilder.registerClassAttr(classAttr);
    }
    var createStatements = [];
    var updateStatements = [];
    var hostBindingSourceSpan = typeSourceSpan;
    var directiveSummary = metadataAsSummary(hostBindingsMetadata);
    // Calculate host event bindings
    var eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings && eventBindings.length) {
        var listeners = createHostListeners(eventBindings, name);
        createStatements.push.apply(createStatements, __spread(listeners));
    }
    // Calculate the host property bindings
    var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    var allOtherBindings = [];
    // We need to calculate the total amount of binding slots required by
    // all the instructions together before any value conversions happen.
    // Value conversions may require additional slots for interpolation and
    // bindings with pipes. These calculates happen after this block.
    var totalHostVarsCount = 0;
    bindings && bindings.forEach(function (binding) {
        var name = binding.name;
        var stylingInputWasSet = styleBuilder.registerInputBasedOnName(name, binding.expression, binding.sourceSpan);
        if (stylingInputWasSet) {
            totalHostVarsCount += MIN_STYLING_BINDING_SLOTS_REQUIRED;
        }
        else {
            allOtherBindings.push(binding);
            totalHostVarsCount++;
        }
    });
    var valueConverter;
    var getValueConverter = function () {
        if (!valueConverter) {
            var hostVarsCountFn = function (numSlots) {
                var originalVarsCount = totalHostVarsCount;
                totalHostVarsCount += numSlots;
                return originalVarsCount;
            };
            valueConverter = new ValueConverter(constantPool, function () { return error('Unexpected node'); }, // new nodes are illegal here
            hostVarsCountFn, function () { return error('Unexpected pipe'); }); // pipes are illegal here
        }
        return valueConverter;
    };
    var propertyBindings = [];
    var attributeBindings = [];
    var syntheticHostBindings = [];
    allOtherBindings.forEach(function (binding) {
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
                sanitizerFn = o.importExpr(R3.sanitizeUrlOrResourceUrl);
            }
            else {
                sanitizerFn = resolveSanitizationFn(securityContexts[0], isAttribute);
            }
        }
        var instructionParams = [o.literal(bindingName), bindingExpr.currValExpr];
        if (sanitizerFn) {
            instructionParams.push(sanitizerFn);
        }
        updateStatements.push.apply(updateStatements, __spread(bindingExpr.stmts));
        if (instruction === R3.hostProperty) {
            propertyBindings.push(instructionParams);
        }
        else if (instruction === R3.attribute) {
            attributeBindings.push(instructionParams);
        }
        else if (instruction === R3.updateSyntheticHostBinding) {
            syntheticHostBindings.push(instructionParams);
        }
        else {
            updateStatements.push(o.importExpr(instruction).callFn(instructionParams).toStmt());
        }
    });
    if (propertyBindings.length > 0) {
        updateStatements.push(chainedInstruction(R3.hostProperty, propertyBindings).toStmt());
    }
    if (attributeBindings.length > 0) {
        updateStatements.push(chainedInstruction(R3.attribute, attributeBindings).toStmt());
    }
    if (syntheticHostBindings.length > 0) {
        updateStatements.push(chainedInstruction(R3.updateSyntheticHostBinding, syntheticHostBindings).toStmt());
    }
    // since we're dealing with directives/components and both have hostBinding
    // functions, we need to generate a special hostAttrs instruction that deals
    // with both the assignment of styling as well as static attributes to the host
    // element. The instruction below will instruct all initial styling (styling
    // that is inside of a host binding within a directive/component) to be attached
    // to the host element alongside any of the provided host attributes that were
    // collected earlier.
    var hostAttrs = convertAttributesToExpressions(hostBindingsMetadata.attributes);
    styleBuilder.assignHostAttrs(hostAttrs, definitionMap);
    if (styleBuilder.hasBindings) {
        // finally each binding that was registered in the statement above will need to be added to
        // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
        // are evaluated and updated for the element.
        styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(function (instruction) {
            if (instruction.calls.length > 0) {
                var calls_1 = [];
                instruction.calls.forEach(function (call) {
                    // we subtract a value of `1` here because the binding slot was already allocated
                    // at the top of this method when all the input bindings were counted.
                    totalHostVarsCount +=
                        Math.max(call.allocateBindingSlots - MIN_STYLING_BINDING_SLOTS_REQUIRED, 0);
                    calls_1.push(convertStylingCall(call, bindingContext, bindingFn));
                });
                updateStatements.push(chainedInstruction(instruction.reference, calls_1).toStmt());
            }
        });
    }
    if (totalHostVarsCount) {
        definitionMap.set('hostVars', o.literal(totalHostVarsCount));
    }
    if (createStatements.length > 0 || updateStatements.length > 0) {
        var hostBindingsFnName = name ? name + "_HostBindings" : null;
        var statements = [];
        if (createStatements.length > 0) {
            statements.push(renderFlagCheckIfStmt(1 /* Create */, createStatements));
        }
        if (updateStatements.length > 0) {
            statements.push(renderFlagCheckIfStmt(2 /* Update */, updateStatements));
        }
        return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], statements, o.INFERRED_TYPE, null, hostBindingsFnName);
    }
    return null;
}
function bindingFn(implicit, value) {
    return convertPropertyBinding(null, implicit, value, 'b', BindingForm.TrySimple, function () { return error('Unexpected interpolation'); });
}
function convertStylingCall(call, bindingContext, bindingFn) {
    return call.params(function (value) { return bindingFn(bindingContext, value).currValExpr; });
}
function getBindingNameAndInstruction(binding) {
    var bindingName = binding.name;
    var instruction;
    // Check to see if this is an attr binding or a property binding
    var attrMatches = bindingName.match(ATTR_REGEX);
    if (attrMatches) {
        bindingName = attrMatches[1];
        instruction = R3.attribute;
    }
    else {
        if (binding.isAnimation) {
            bindingName = prepareSyntheticPropertyName(bindingName);
            // host bindings that have a synthetic property (e.g. @foo) should always be rendered
            // in the context of the component and not the parent. Therefore there is a special
            // compatibility instruction available for this purpose.
            instruction = R3.updateSyntheticHostBinding;
        }
        else {
            instruction = R3.hostProperty;
        }
    }
    return { bindingName: bindingName, instruction: instruction, isAttribute: !!attrMatches };
}
function createHostListeners(eventBindings, name) {
    var listeners = [];
    var syntheticListeners = [];
    var instructions = [];
    eventBindings.forEach(function (binding) {
        var bindingName = binding.name && sanitizeIdentifier(binding.name);
        var bindingFnName = binding.type === 1 /* Animation */ ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        var handlerName = name && bindingName ? name + "_" + bindingFnName + "_HostBindingHandler" : null;
        var params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), handlerName);
        if (binding.type == 1 /* Animation */) {
            syntheticListeners.push(params);
        }
        else {
            listeners.push(params);
        }
    });
    if (syntheticListeners.length > 0) {
        instructions.push(chainedInstruction(R3.componentHostSyntheticListener, syntheticListeners).toStmt());
    }
    if (listeners.length > 0) {
        instructions.push(chainedInstruction(R3.listener, listeners).toStmt());
    }
    return instructions;
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
        var _b = __read(_a, 2), key = _b[0], type = _b[1];
        return [key, outputCtx.importExpr(type)];
    });
    return new Map(entries);
}
var HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
export function parseHostBindings(host) {
    var e_4, _a;
    var attributes = {};
    var listeners = {};
    var properties = {};
    var specialAttributes = {};
    try {
        for (var _b = __values(Object.keys(host)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
/**
 * Verifies host bindings and returns the list of errors (if any). Empty array indicates that a
 * given set of host bindings has no errors.
 *
 * @param bindings set of host bindings to verify.
 * @param sourceSpan source span where host bindings were defined.
 * @returns array of errors associated with a given set of host bindings.
 */
export function verifyHostBindings(bindings, sourceSpan) {
    var summary = metadataAsSummary(bindings);
    // TODO: abstract out host bindings verification logic and use it instead of
    // creating events and properties ASTs to detect errors (FW-996)
    var bindingParser = makeBindingParser();
    bindingParser.createDirectiveHostEventAsts(summary, sourceSpan);
    bindingParser.createBoundHostProperties(summary, sourceSpan);
    return bindingParser.errors;
}
function compileStyles(styles, selector, hostSelector) {
    var shadowCss = new ShadowCss();
    return styles.map(function (style) {
        return shadowCss.shimCssText(style, selector, hostSelector);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFHSCxPQUFPLEVBQWdHLGNBQWMsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRXpLLE9BQU8sRUFBQyxXQUFXLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUU3RixPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUVuQyxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxXQUFXLEVBQUUsZUFBZSxFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDNUQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQzNDLE9BQU8sRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFDLE1BQU0sc0JBQXNCLENBQUM7QUFFN0QsT0FBTyxFQUFDLEtBQUssRUFBZ0IsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUNyQyxPQUFPLEVBQUMsc0JBQXNCLEVBQXdCLGVBQWUsRUFBMkIsTUFBTSxlQUFlLENBQUM7QUFDdEgsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsb0NBQW9DLEVBQUUsNEJBQTRCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHL0csT0FBTyxFQUFDLGtDQUFrQyxFQUFFLGNBQWMsRUFBeUIsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RyxPQUFPLEVBQUMsWUFBWSxFQUFF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QWEsQ0FBQyxNQUFnQixFQUFFLFFBQWdCLEVBQUUsWUFBb0I7SUFDN0UsSUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztJQUNsQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLO1FBQ3JCLE9BQU8sU0FBVSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uLy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSwgQ29tcGlsZVF1ZXJ5TWV0YWRhdGEsIENvbXBpbGVUb2tlbk1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZSwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbCwgRGVmaW5pdGlvbktpbmR9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7REVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJR30gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2ludGVycG9sYXRpb25fY29uZmlnJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yLCBPdXRwdXRDb250ZXh0fSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgUjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeVRhcmdldCwgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7UjNDb21wb25lbnREZWYsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlRGVmLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge01JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIFN0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm4sIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7YXNMaXRlcmFsLCBjaGFpbmVkSW5zdHJ1Y3Rpb24sIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIGdldFF1ZXJ5UHJlZGljYXRlLCBSRU5ERVJfRkxBR1MsIFRFTVBPUkFSWV9OQU1FLCB0ZW1wb3JhcnlBbGxvY2F0b3J9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IEVNUFRZX0FSUkFZOiBhbnlbXSA9IFtdO1xuXG4vLyBUaGlzIHJlZ2V4IG1hdGNoZXMgYW55IGJpbmRpbmcgbmFtZXMgdGhhdCBjb250YWluIHRoZSBcImF0dHIuXCIgcHJlZml4LCBlLmcuIFwiYXR0ci5yZXF1aXJlZFwiXG4vLyBJZiB0aGVyZSBpcyBhIG1hdGNoLCB0aGUgZmlyc3QgbWF0Y2hpbmcgZ3JvdXAgd2lsbCBjb250YWluIHRoZSBhdHRyaWJ1dGUgbmFtZSB0byBiaW5kLlxuY29uc3QgQVRUUl9SRUdFWCA9IC9hdHRyXFwuKFteXFxdXSspLztcblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogRGVmaW5pdGlvbk1hcCB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBjb25zdCBzZWxlY3RvcnMgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IobWV0YS5zZWxlY3Rvcik7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yczogW1snJywgJ3NvbWVEaXInLCAnJ11dYFxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3JzJywgYXNMaXRlcmFsKHNlbGVjdG9ycykpO1xuICB9XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gZS5nLiBgY29udGVudFF1ZXJpZXM6IChyZiwgY3R4LCBkaXJJbmRleCkgPT4geyAuLi4gfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY29udGVudFF1ZXJpZXMnLCBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKG1ldGEucXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLnZpZXdRdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgICAgICAgbWV0YS5ob3N0LCBtZXRhLnR5cGVTb3VyY2VTcGFuLCBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wsIG1ldGEuc2VsZWN0b3IgfHwgJycsXG4gICAgICAgICAgbWV0YS5uYW1lLCBkZWZpbml0aW9uTWFwKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YXxSM0NvbXBvbmVudE1ldGFkYXRhKSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YS5wcm92aWRlcnM7XG4gIGNvbnN0IHZpZXdQcm92aWRlcnMgPSAobWV0YSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhKS52aWV3UHJvdmlkZXJzO1xuICBpZiAocHJvdmlkZXJzIHx8IHZpZXdQcm92aWRlcnMpIHtcbiAgICBjb25zdCBhcmdzID0gW3Byb3ZpZGVycyB8fCBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFtdKV07XG4gICAgaWYgKHZpZXdQcm92aWRlcnMpIHtcbiAgICAgIGFyZ3MucHVzaCh2aWV3UHJvdmlkZXJzKTtcbiAgICB9XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuUHJvdmlkZXJzRmVhdHVyZSkuY2FsbEZuKGFyZ3MpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnVzZXNJbmhlcml0YW5jZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLkluaGVyaXREZWZpbml0aW9uRmVhdHVyZSkpO1xuICB9XG4gIGlmIChtZXRhLmZ1bGxJbmhlcml0YW5jZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLkNvcHlEZWZpbml0aW9uRmVhdHVyZSkpO1xuICB9XG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuTmdPbkNoYW5nZXNGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgY29uc3QgdHlwZVBhcmFtcyA9IGNyZWF0ZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YSk7XG4gIGNvbnN0IHR5cGUgPSBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5EaXJlY3RpdmVEZWZXaXRoTWV0YSwgdHlwZVBhcmFtcykpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsXG4gICAgICAgICAgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBmb3IgKGNvbnN0IHtzZWxlY3RvciwgZXhwcmVzc2lvbn0gb2YgbWV0YS5kaXJlY3RpdmVzKSB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IHBpcGVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBjaGFuZ2VEZXRlY3Rpb24gPSBtZXRhLmNoYW5nZURldGVjdGlvbjtcblxuICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgY29uc3RhbnRQb29sLCBCaW5kaW5nU2NvcGUuUk9PVF9TQ09QRSwgMCwgdGVtcGxhdGVUeXBlTmFtZSwgbnVsbCwgbnVsbCwgdGVtcGxhdGVOYW1lLFxuICAgICAgZGlyZWN0aXZlTWF0Y2hlciwgZGlyZWN0aXZlc1VzZWQsIG1ldGEucGlwZXMsIHBpcGVzVXNlZCwgUjMubmFtZXNwYWNlSFRNTCxcbiAgICAgIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzKTtcblxuICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbiA9IHRlbXBsYXRlQnVpbGRlci5idWlsZFRlbXBsYXRlRnVuY3Rpb24odGVtcGxhdGUubm9kZXMsIFtdKTtcblxuICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgdGhpcyBzbyB0aGF0IGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjb21wb25lbnRzIGtub3cgd2hhdFxuICAvLyBwcm9qZWN0ZWQgY29udGVudCBibG9ja3MgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBjb21wb25lbnQgd2hlbiBpdCBpcyBpbnN0YW50aWF0ZWQuXG4gIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IHRlbXBsYXRlQnVpbGRlci5nZXROZ0NvbnRlbnRTZWxlY3RvcnMoKTtcbiAgaWYgKG5nQ29udGVudFNlbGVjdG9ycykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCduZ0NvbnRlbnRTZWxlY3RvcnMnLCBuZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICB9XG5cbiAgLy8gZS5nLiBgZGVjbHM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgLy8gZS5nLiBgdmFyczogMmBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICAvLyBlLmcuIGBjb25zdHM6IFtbJ29uZScsICd0d28nXSwgWyd0aHJlZScsICdmb3VyJ11dXG4gIGNvbnN0IGNvbnN0cyA9IHRlbXBsYXRlQnVpbGRlci5nZXRDb25zdHMoKTtcbiAgaWYgKGNvbnN0cy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIG8ubGl0ZXJhbEFycihjb25zdHMpKTtcbiAgfVxuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcblxuICAvLyBlLmcuIGBkaXJlY3RpdmVzOiBbTXlEaXJlY3RpdmVdYFxuICBpZiAoZGlyZWN0aXZlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBkaXJlY3RpdmVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20oZGlyZWN0aXZlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBkaXJlY3RpdmVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZGlyZWN0aXZlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgZGlyZWN0aXZlc0V4cHIpO1xuICB9XG5cbiAgLy8gZS5nLiBgcGlwZXM6IFtNeVBpcGVdYFxuICBpZiAocGlwZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgcGlwZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShwaXBlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBwaXBlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHBpcGVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgcGlwZXNFeHByKTtcbiAgfVxuXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IG51bGwpIHtcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgLy8gZS5nLiBgc3R5bGVzOiBbc3RyMSwgc3RyMl1gXG4gIGlmIChtZXRhLnN0eWxlcyAmJiBtZXRhLnN0eWxlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdHlsZVZhbHVlcyA9IG1ldGEuZW5jYXBzdWxhdGlvbiA9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkID9cbiAgICAgICAgY29tcGlsZVN0eWxlcyhtZXRhLnN0eWxlcywgQ09OVEVOVF9BVFRSLCBIT1NUX0FUVFIpIDpcbiAgICAgICAgbWV0YS5zdHlsZXM7XG4gICAgY29uc3Qgc3RyaW5ncyA9IHN0eWxlVmFsdWVzLm1hcChzdHIgPT4gby5saXRlcmFsKHN0cikpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3RyaW5ncykpO1xuICB9IGVsc2UgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIHN0eWxlLCBkb24ndCBnZW5lcmF0ZSBjc3Mgc2VsZWN0b3JzIG9uIGVsZW1lbnRzXG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5Ob25lO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdmlldyBlbmNhcHN1bGF0aW9uIGlmIGl0J3Mgbm90IHRoZSBkZWZhdWx0IHZhbHVlXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZW5jYXBzdWxhdGlvbicsIG8ubGl0ZXJhbChtZXRhLmVuY2Fwc3VsYXRpb24pKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGFuaW1hdGlvbjogW3RyaWdnZXIoJzEyMycsIFtdKV1gXG4gIGlmIChtZXRhLmFuaW1hdGlvbnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2RhdGEnLCBvLmxpdGVyYWxNYXAoW3trZXk6ICdhbmltYXRpb24nLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIGZsYWcgaWYgaXQncyBkZWZpbmVkIGFuZCBpdCdzIG5vdCB0aGUgZGVmYXVsdC5cbiAgaWYgKGNoYW5nZURldGVjdGlvbiAhPSBudWxsICYmIGNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NoYW5nZURldGVjdGlvbicsIG8ubGl0ZXJhbChjaGFuZ2VEZXRlY3Rpb24pKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lQ29tcG9uZW50KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuXG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGEpO1xuICB0eXBlUGFyYW1zLnB1c2goc3RyaW5nQXJyYXlBc1R5cGUobWV0YS50ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMpKTtcbiAgY29uc3QgdHlwZSA9IG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkNvbXBvbmVudERlZldpdGhNZXRhLCB0eXBlUGFyYW1zKSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlRGlyZWN0aXZlYCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzRGlyZWN0aXZlTWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcikge1xuICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oXG4gICAgICB7Li4ubWV0YSwgaW5qZWN0Rm46IFIzLmRpcmVjdGl2ZUluamVjdCwgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuRGlyZWN0aXZlfSk7XG4gIGNvbnN0IG5nRmFjdG9yeURlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZCgnybVmYWMnLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCBmYWN0b3J5UmVzLmZhY3RvcnkpXSwgW10sXG4gICAgICBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSk7XG4gIGNvbnN0IGRpcmVjdGl2ZURlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5nRmFjdG9yeURlZlN0YXRlbWVudCwgZGlyZWN0aXZlRGVmU3RhdGVtZW50KTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlQ29tcG9uZW50YCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzQ29tcG9uZW50TWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0OiBSZW5kZXIzUGFyc2VSZXN1bHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBkaXJlY3RpdmVUeXBlQnlTZWw6IE1hcDxzdHJpbmcsIGFueT4sXG4gICAgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIGFueT4pIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGNvbXBvbmVudC50eXBlKSE7XG4gIG5hbWUgfHwgZXJyb3IoYENhbm5vdCByZXNvbHZlciB0aGUgbmFtZSBvZiAke2NvbXBvbmVudC50eXBlfWApO1xuXG4gIGNvbnN0IGRlZmluaXRpb25GaWVsZCA9IG91dHB1dEN0eC5jb25zdGFudFBvb2wucHJvcGVydHlOYW1lT2YoRGVmaW5pdGlvbktpbmQuQ29tcG9uZW50KTtcblxuICBjb25zdCBzdW1tYXJ5ID0gY29tcG9uZW50LnRvU3VtbWFyeSgpO1xuXG4gIC8vIENvbXB1dGUgdGhlIFIzQ29tcG9uZW50TWV0YWRhdGEgZnJvbSB0aGUgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhXG4gIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEgPSB7XG4gICAgLi4uZGlyZWN0aXZlTWV0YWRhdGFGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LCBvdXRwdXRDdHgsIHJlZmxlY3RvciksXG4gICAgc2VsZWN0b3I6IGNvbXBvbmVudC5zZWxlY3RvcixcbiAgICB0ZW1wbGF0ZToge25vZGVzOiByZW5kZXIzQXN0Lm5vZGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnM6IHJlbmRlcjNBc3QubmdDb250ZW50U2VsZWN0b3JzfSxcbiAgICBkaXJlY3RpdmVzOiBbXSxcbiAgICBwaXBlczogdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChwaXBlVHlwZUJ5TmFtZSwgb3V0cHV0Q3R4KSxcbiAgICB2aWV3UXVlcmllczogcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQudmlld1F1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgd3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZTogZmFsc2UsXG4gICAgc3R5bGVzOiAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLnN0eWxlcykgfHwgRU1QVFlfQVJSQVksXG4gICAgZW5jYXBzdWxhdGlvbjpcbiAgICAgICAgKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5lbmNhcHN1bGF0aW9uKSB8fCBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkLFxuICAgIGludGVycG9sYXRpb246IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsXG4gICAgYW5pbWF0aW9uczogbnVsbCxcbiAgICB2aWV3UHJvdmlkZXJzOlxuICAgICAgICBjb21wb25lbnQudmlld1Byb3ZpZGVycy5sZW5ndGggPiAwID8gbmV3IG8uV3JhcHBlZE5vZGVFeHByKGNvbXBvbmVudC52aWV3UHJvdmlkZXJzKSA6IG51bGwsXG4gICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIGkxOG5Vc2VFeHRlcm5hbElkczogdHJ1ZSxcbiAgfTtcbiAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oXG4gICAgICB7Li4ubWV0YSwgaW5qZWN0Rm46IFIzLmRpcmVjdGl2ZUluamVjdCwgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuRGlyZWN0aXZlfSk7XG4gIGNvbnN0IG5nRmFjdG9yeURlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZCgnybVmYWMnLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCBmYWN0b3J5UmVzLmZhY3RvcnkpXSwgW10sXG4gICAgICBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSk7XG4gIGNvbnN0IGNvbXBvbmVudERlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5nRmFjdG9yeURlZlN0YXRlbWVudCwgY29tcG9uZW50RGVmU3RhdGVtZW50KTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8vIFRoZSBnbG9iYWwtYW5hbHlzaXMgYmFzZWQgSXZ5IG1vZGUgaW4gbmdjIGlzIG5vIGxvbmdlciB1dGlsaXplZC9zdXBwb3J0ZWQuXG4gIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQnKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlUXVlcnlNZXRhZGF0YWAgaW50byBgUjNRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBSM1F1ZXJ5TWV0YWRhdGFbXSB7XG4gIHJldHVybiBxdWVyaWVzLm1hcChxdWVyeSA9PiB7XG4gICAgbGV0IHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAocXVlcnkucmVhZCAmJiBxdWVyeS5yZWFkLmlkZW50aWZpZXIpIHtcbiAgICAgIHJlYWQgPSBvdXRwdXRDdHguaW1wb3J0RXhwcihxdWVyeS5yZWFkLmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3BlcnR5TmFtZTogcXVlcnkucHJvcGVydHlOYW1lLFxuICAgICAgZmlyc3Q6IHF1ZXJ5LmZpcnN0LFxuICAgICAgcHJlZGljYXRlOiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEocXVlcnkuc2VsZWN0b3JzLCBvdXRwdXRDdHgpLFxuICAgICAgZGVzY2VuZGFudHM6IHF1ZXJ5LmRlc2NlbmRhbnRzLFxuICAgICAgcmVhZCxcbiAgICAgIHN0YXRpYzogISFxdWVyeS5zdGF0aWNcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCBwYXJhbWV0ZXJzID0gW2dldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCBjb25zdGFudFBvb2wpLCBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMpXTtcbiAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICBwYXJhbWV0ZXJzLnB1c2gocXVlcnkucmVhZCk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgcXVlcmllcykge1xuICAgIGNvbnN0IHF1ZXJ5SW5zdHJ1Y3Rpb24gPSBxdWVyeS5zdGF0aWMgPyBSMy5zdGF0aWNDb250ZW50UXVlcnkgOiBSMy5jb250ZW50UXVlcnk7XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5jb250ZW50UXVlcnkoZGlySW5kZXgsIHNvbWVQcmVkaWNhdGUsIHRydWUsIG51bGwpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgby5pbXBvcnRFeHByKHF1ZXJ5SW5zdHJ1Y3Rpb24pXG4gICAgICAgICAgICAuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpLCAuLi5wcmVwYXJlUXVlcnlQYXJhbXMocXVlcnksIGNvbnN0YW50UG9vbCkgYXMgYW55XSlcbiAgICAgICAgICAgIC50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkUXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCBjb250ZW50UXVlcmllc0ZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9Db250ZW50UXVlcmllc2AgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtcbiAgICAgICAgbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCksXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oJ2RpckluZGV4JywgbnVsbClcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGNvbnRlbnRRdWVyaWVzRm5OYW1lKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXNUeXBlKHN0cjogc3RyaW5nKTogby5UeXBlIHtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKHN0cikpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdNYXBBc1R5cGUobWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfHN0cmluZ1tdfSk6IG8uVHlwZSB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogUmVhZG9ubHlBcnJheTxzdHJpbmd8bnVsbD4pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlW10ge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gbWV0YS5zZWxlY3RvciAhPT0gbnVsbCA/IG1ldGEuc2VsZWN0b3IucmVwbGFjZSgvXFxuL2csICcnKSA6IG51bGw7XG5cbiAgcmV0dXJuIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpLFxuICAgIHNlbGVjdG9yRm9yVHlwZSAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShzZWxlY3RvckZvclR5cGUpIDogby5OT05FX1RZUEUsXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FycmF5QXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEuaW5wdXRzKSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5vdXRwdXRzKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIHZpZXdRdWVyaWVzLmZvckVhY2goKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpID0+IHtcbiAgICBjb25zdCBxdWVyeUluc3RydWN0aW9uID0gcXVlcnkuc3RhdGljID8gUjMuc3RhdGljVmlld1F1ZXJ5IDogUjMudmlld1F1ZXJ5O1xuXG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMudmlld1F1ZXJ5KHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9XG4gICAgICAgIG8uaW1wb3J0RXhwcihxdWVyeUluc3RydWN0aW9uKS5jYWxsRm4ocHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfSk7XG5cbiAgY29uc3Qgdmlld1F1ZXJ5Rm5OYW1lID0gbmFtZSA/IGAke25hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBob3N0QmluZGluZ3NNZXRhZGF0YTogUjNIb3N0TWV0YWRhdGEsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHNlbGVjdG9yOiBzdHJpbmcsIG5hbWU6IHN0cmluZyxcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBiaW5kaW5nQ29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgY29uc3Qgc3R5bGVCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKGJpbmRpbmdDb250ZXh0KTtcblxuICBjb25zdCB7c3R5bGVBdHRyLCBjbGFzc0F0dHJ9ID0gaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXM7XG4gIGlmIChzdHlsZUF0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cihzdHlsZUF0dHIpO1xuICB9XG4gIGlmIChjbGFzc0F0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cihjbGFzc0F0dHIpO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gdHlwZVNvdXJjZVNwYW47XG4gIGNvbnN0IGRpcmVjdGl2ZVN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShob3N0QmluZGluZ3NNZXRhZGF0YSk7XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3MsIG5hbWUpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaCguLi5saXN0ZW5lcnMpO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGJpbmRpbmdzID0gYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGNvbnN0IGFsbE90aGVyQmluZGluZ3M6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcblxuICAvLyBXZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgdG90YWwgYW1vdW50IG9mIGJpbmRpbmcgc2xvdHMgcmVxdWlyZWQgYnlcbiAgLy8gYWxsIHRoZSBpbnN0cnVjdGlvbnMgdG9nZXRoZXIgYmVmb3JlIGFueSB2YWx1ZSBjb252ZXJzaW9ucyBoYXBwZW4uXG4gIC8vIFZhbHVlIGNvbnZlcnNpb25zIG1heSByZXF1aXJlIGFkZGl0aW9uYWwgc2xvdHMgZm9yIGludGVycG9sYXRpb24gYW5kXG4gIC8vIGJpbmRpbmdzIHdpdGggcGlwZXMuIFRoZXNlIGNhbGN1bGF0ZXMgaGFwcGVuIGFmdGVyIHRoaXMgYmxvY2suXG4gIGxldCB0b3RhbEhvc3RWYXJzQ291bnQgPSAwO1xuICBiaW5kaW5ncyAmJiBiaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBiaW5kaW5nLm5hbWU7XG4gICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID1cbiAgICAgICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShuYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgaWYgKHN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFsbE90aGVyQmluZGluZ3MucHVzaChiaW5kaW5nKTtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCsrO1xuICAgIH1cbiAgfSk7XG5cbiAgbGV0IHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgY29uc3QgZ2V0VmFsdWVDb252ZXJ0ZXIgPSAoKSA9PiB7XG4gICAgaWYgKCF2YWx1ZUNvbnZlcnRlcikge1xuICAgICAgY29uc3QgaG9zdFZhcnNDb3VudEZuID0gKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFZhcnNDb3VudCA9IHRvdGFsSG9zdFZhcnNDb3VudDtcbiAgICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IG51bVNsb3RzO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxWYXJzQ291bnQ7XG4gICAgICB9O1xuICAgICAgdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgICAgY29uc3RhbnRQb29sLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIG5vZGUnKSwgIC8vIG5ldyBub2RlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgICAgICAgaG9zdFZhcnNDb3VudEZuLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIHBpcGUnKSk7ICAvLyBwaXBlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZUNvbnZlcnRlcjtcbiAgfTtcblxuICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0hvc3RCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBhbGxPdGhlckJpbmRpbmdzLmZvckVhY2goKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQoZ2V0VmFsdWVDb252ZXJ0ZXIoKSk7XG4gICAgY29uc3QgYmluZGluZ0V4cHIgPSBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKTtcblxuICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZyk7XG5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgYmluZGluZ1BhcnNlci5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHNlbGVjdG9yLCBiaW5kaW5nTmFtZSwgaXNBdHRyaWJ1dGUpXG4gICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICBsZXQgc2FuaXRpemVyRm46IG8uRXh0ZXJuYWxFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCkge1xuICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTCkgPiAtMSAmJlxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwpID4gLTEpIHtcbiAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnRcbiAgICAgICAgLy8gb2YgZGlmZmVyZW50IHNlY3VyaXR5IGNvbnRleHRzLiBJbiB0aGlzIGNhc2Ugd2UgdXNlIHNwZWNpYWwgc2FudGl0aXphdGlvbiBmdW5jdGlvbiBhbmRcbiAgICAgICAgLy8gc2VsZWN0IHRoZSBhY3R1YWwgc2FuaXRpemVyIGF0IHJ1bnRpbWUgYmFzZWQgb24gYSB0YWcgbmFtZSB0aGF0IGlzIHByb3ZpZGVkIHdoaWxlXG4gICAgICAgIC8vIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgc2FuaXRpemVyRm4gPSBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmxPclJlc291cmNlVXJsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNhbml0aXplckZuID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKHNlY3VyaXR5Q29udGV4dHNbMF0sIGlzQXR0cmlidXRlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25QYXJhbXMgPSBbby5saXRlcmFsKGJpbmRpbmdOYW1lKSwgYmluZGluZ0V4cHIuY3VyclZhbEV4cHJdO1xuICAgIGlmIChzYW5pdGl6ZXJGbikge1xuICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChzYW5pdGl6ZXJGbik7XG4gICAgfVxuXG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcblxuICAgIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuaG9zdFByb3BlcnR5KSB7XG4gICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmF0dHJpYnV0ZSkge1xuICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMudXBkYXRlU3ludGhldGljSG9zdEJpbmRpbmcpIHtcbiAgICAgIHN5bnRoZXRpY0hvc3RCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKGluc3RydWN0aW9uUGFyYW1zKS50b1N0bXQoKSk7XG4gICAgfVxuICB9KTtcblxuICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5ob3N0UHJvcGVydHksIHByb3BlcnR5QmluZGluZ3MpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChhdHRyaWJ1dGVCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5hdHRyaWJ1dGUsIGF0dHJpYnV0ZUJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoc3ludGhldGljSG9zdEJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIGNoYWluZWRJbnN0cnVjdGlvbihSMy51cGRhdGVTeW50aGV0aWNIb3N0QmluZGluZywgc3ludGhldGljSG9zdEJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICAvLyBzaW5jZSB3ZSdyZSBkZWFsaW5nIHdpdGggZGlyZWN0aXZlcy9jb21wb25lbnRzIGFuZCBib3RoIGhhdmUgaG9zdEJpbmRpbmdcbiAgLy8gZnVuY3Rpb25zLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGEgc3BlY2lhbCBob3N0QXR0cnMgaW5zdHJ1Y3Rpb24gdGhhdCBkZWFsc1xuICAvLyB3aXRoIGJvdGggdGhlIGFzc2lnbm1lbnQgb2Ygc3R5bGluZyBhcyB3ZWxsIGFzIHN0YXRpYyBhdHRyaWJ1dGVzIHRvIHRoZSBob3N0XG4gIC8vIGVsZW1lbnQuIFRoZSBpbnN0cnVjdGlvbiBiZWxvdyB3aWxsIGluc3RydWN0IGFsbCBpbml0aWFsIHN0eWxpbmcgKHN0eWxpbmdcbiAgLy8gdGhhdCBpcyBpbnNpZGUgb2YgYSBob3N0IGJpbmRpbmcgd2l0aGluIGEgZGlyZWN0aXZlL2NvbXBvbmVudCkgdG8gYmUgYXR0YWNoZWRcbiAgLy8gdG8gdGhlIGhvc3QgZWxlbWVudCBhbG9uZ3NpZGUgYW55IG9mIHRoZSBwcm92aWRlZCBob3N0IGF0dHJpYnV0ZXMgdGhhdCB3ZXJlXG4gIC8vIGNvbGxlY3RlZCBlYXJsaWVyLlxuICBjb25zdCBob3N0QXR0cnMgPSBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcyk7XG4gIHN0eWxlQnVpbGRlci5hc3NpZ25Ib3N0QXR0cnMoaG9zdEF0dHJzLCBkZWZpbml0aW9uTWFwKTtcblxuICBpZiAoc3R5bGVCdWlsZGVyLmhhc0JpbmRpbmdzKSB7XG4gICAgLy8gZmluYWxseSBlYWNoIGJpbmRpbmcgdGhhdCB3YXMgcmVnaXN0ZXJlZCBpbiB0aGUgc3RhdGVtZW50IGFib3ZlIHdpbGwgbmVlZCB0byBiZSBhZGRlZCB0b1xuICAgIC8vIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSBjb21wb25lbnQvZGlyZWN0aXZlIHRlbXBsYXRlRm4vaG9zdEJpbmRpbmdzRm4gc28gdGhhdCB0aGUgYmluZGluZ3NcbiAgICAvLyBhcmUgZXZhbHVhdGVkIGFuZCB1cGRhdGVkIGZvciB0aGUgZWxlbWVudC5cbiAgICBzdHlsZUJ1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyhnZXRWYWx1ZUNvbnZlcnRlcigpKS5mb3JFYWNoKGluc3RydWN0aW9uID0+IHtcbiAgICAgIGlmIChpbnN0cnVjdGlvbi5jYWxscy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGNhbGxzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG5cbiAgICAgICAgaW5zdHJ1Y3Rpb24uY2FsbHMuZm9yRWFjaChjYWxsID0+IHtcbiAgICAgICAgICAvLyB3ZSBzdWJ0cmFjdCBhIHZhbHVlIG9mIGAxYCBoZXJlIGJlY2F1c2UgdGhlIGJpbmRpbmcgc2xvdCB3YXMgYWxyZWFkeSBhbGxvY2F0ZWRcbiAgICAgICAgICAvLyBhdCB0aGUgdG9wIG9mIHRoaXMgbWV0aG9kIHdoZW4gYWxsIHRoZSBpbnB1dCBiaW5kaW5ncyB3ZXJlIGNvdW50ZWQuXG4gICAgICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9XG4gICAgICAgICAgICAgIE1hdGgubWF4KGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHMgLSBNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVELCAwKTtcbiAgICAgICAgICBjYWxscy5wdXNoKGNvbnZlcnRTdHlsaW5nQ2FsbChjYWxsLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZ0ZuKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBjYWxscykudG9TdG10KCkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHRvdGFsSG9zdFZhcnNDb3VudCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbCh0b3RhbEhvc3RWYXJzQ291bnQpKTtcbiAgfVxuXG4gIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgfHwgdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sIHN0YXRlbWVudHMsXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgaG9zdEJpbmRpbmdzRm5OYW1lKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBiaW5kaW5nRm4oaW1wbGljaXQ6IGFueSwgdmFsdWU6IEFTVCkge1xuICByZXR1cm4gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgIG51bGwsIGltcGxpY2l0LCB2YWx1ZSwgJ2InLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRTdHlsaW5nQ2FsbChcbiAgICBjYWxsOiBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKSB7XG4gIHJldHVybiBjYWxsLnBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24hOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGlzIGlzIGFuIGF0dHIgYmluZGluZyBvciBhIHByb3BlcnR5IGJpbmRpbmdcbiAgY29uc3QgYXR0ck1hdGNoZXMgPSBiaW5kaW5nTmFtZS5tYXRjaChBVFRSX1JFR0VYKTtcbiAgaWYgKGF0dHJNYXRjaGVzKSB7XG4gICAgYmluZGluZ05hbWUgPSBhdHRyTWF0Y2hlc1sxXTtcbiAgICBpbnN0cnVjdGlvbiA9IFIzLmF0dHJpYnV0ZTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoYmluZGluZy5pc0FuaW1hdGlvbikge1xuICAgICAgYmluZGluZ05hbWUgPSBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGJpbmRpbmdOYW1lKTtcbiAgICAgIC8vIGhvc3QgYmluZGluZ3MgdGhhdCBoYXZlIGEgc3ludGhldGljIHByb3BlcnR5IChlLmcuIEBmb28pIHNob3VsZCBhbHdheXMgYmUgcmVuZGVyZWRcbiAgICAgIC8vIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21wb25lbnQgYW5kIG5vdCB0aGUgcGFyZW50LiBUaGVyZWZvcmUgdGhlcmUgaXMgYSBzcGVjaWFsXG4gICAgICAvLyBjb21wYXRpYmlsaXR5IGluc3RydWN0aW9uIGF2YWlsYWJsZSBmb3IgdGhpcyBwdXJwb3NlLlxuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy51cGRhdGVTeW50aGV0aWNIb3N0QmluZGluZztcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5ob3N0UHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLCBuYW1lPzogc3RyaW5nKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IGxpc3RlbmVyczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBzeW50aGV0aWNMaXN0ZW5lcnM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgZXZlbnRCaW5kaW5ncy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoYmluZGluZy5uYW1lKTtcbiAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gYmluZGluZy50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGJpbmRpbmdOYW1lLCBiaW5kaW5nLnRhcmdldE9yUGhhc2UpIDpcbiAgICAgICAgYmluZGluZ05hbWU7XG4gICAgY29uc3QgaGFuZGxlck5hbWUgPSBuYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7bmFtZX1fJHtiaW5kaW5nRm5OYW1lfV9Ib3N0QmluZGluZ0hhbmRsZXJgIDogbnVsbDtcbiAgICBjb25zdCBwYXJhbXMgPSBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoYmluZGluZyksIGhhbmRsZXJOYW1lKTtcblxuICAgIGlmIChiaW5kaW5nLnR5cGUgPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgc3ludGhldGljTGlzdGVuZXJzLnB1c2gocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdGVuZXJzLnB1c2gocGFyYW1zKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChzeW50aGV0aWNMaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKFxuICAgICAgICBjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuY29tcG9uZW50SG9zdFN5bnRoZXRpY0xpc3RlbmVyLCBzeW50aGV0aWNMaXN0ZW5lcnMpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5saXN0ZW5lciwgbGlzdGVuZXJzKS50b1N0bXQoKSk7XG4gIH1cblxuICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5IHtcbiAgLy8gY2xhbmctZm9ybWF0IG9mZlxuICByZXR1cm4ge1xuICAgIC8vIFRoaXMgaXMgdXNlZCBieSB0aGUgQmluZGluZ1BhcnNlciwgd2hpY2ggb25seSBkZWFscyB3aXRoIGxpc3RlbmVycyBhbmQgcHJvcGVydGllcy4gVGhlcmUncyBub1xuICAgIC8vIG5lZWQgdG8gcGFzcyBhdHRyaWJ1dGVzIHRvIGl0LlxuICAgIGhvc3RBdHRyaWJ1dGVzOiB7fSxcbiAgICBob3N0TGlzdGVuZXJzOiBtZXRhLmxpc3RlbmVycyxcbiAgICBob3N0UHJvcGVydGllczogbWV0YS5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuLy8gRGVmaW5lcyBIb3N0IEJpbmRpbmdzIHN0cnVjdHVyZSB0aGF0IGNvbnRhaW5zIGF0dHJpYnV0ZXMsIGxpc3RlbmVycywgYW5kIHByb3BlcnRpZXMsXG4vLyBwYXJzZWQgZnJvbSB0aGUgYGhvc3RgIG9iamVjdCBkZWZpbmVkIGZvciBhIFR5cGUuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ3xvLkV4cHJlc3Npb259KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO30gPSB7fTtcblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhob3N0KSkge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcblxuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgLy8gc3ludGhldGljIHByb3BlcnRpZXMgKHRoZSBvbmVzIHRoYXQgaGF2ZSBhIGBAYCBhcyBhIHByZWZpeClcbiAgICAgIC8vIGFyZSBzdGlsbCB0cmVhdGVkIHRoZSBzYW1lIGFzIHJlZ3VsYXIgcHJvcGVydGllcy4gVGhlcmVmb3JlXG4gICAgICAvLyB0aGVyZSBpcyBubyBwb2ludCBpbiBzdG9yaW5nIHRoZW0gaW4gYSBzZXBhcmF0ZSBtYXAuXG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBzcGVjaWFsQXR0cmlidXRlc307XG59XG5cbi8qKlxuICogVmVyaWZpZXMgaG9zdCBiaW5kaW5ncyBhbmQgcmV0dXJucyB0aGUgbGlzdCBvZiBlcnJvcnMgKGlmIGFueSkuIEVtcHR5IGFycmF5IGluZGljYXRlcyB0aGF0IGFcbiAqIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzIGhhcyBubyBlcnJvcnMuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdzIHNldCBvZiBob3N0IGJpbmRpbmdzIHRvIHZlcmlmeS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIHNvdXJjZSBzcGFuIHdoZXJlIGhvc3QgYmluZGluZ3Mgd2VyZSBkZWZpbmVkLlxuICogQHJldHVybnMgYXJyYXkgb2YgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCBhIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5SG9zdEJpbmRpbmdzKFxuICAgIGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3MsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShiaW5kaW5ncyk7XG4gIC8vIFRPRE86IGFic3RyYWN0IG91dCBob3N0IGJpbmRpbmdzIHZlcmlmaWNhdGlvbiBsb2dpYyBhbmQgdXNlIGl0IGluc3RlYWQgb2ZcbiAgLy8gY3JlYXRpbmcgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIEFTVHMgdG8gZGV0ZWN0IGVycm9ycyAoRlctOTk2KVxuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKHN1bW1hcnksIHNvdXJjZVNwYW4pO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLmVycm9ycztcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7XG4gICAgcmV0dXJuIHNoYWRvd0NzcyEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICB9KTtcbn1cbiJdfQ==