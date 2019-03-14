/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
import { compileFactoryFunction } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { prepareSyntheticListenerFunctionName, prepareSyntheticPropertyName, typeWithParameters } from '../util';
import { StylingBuilder } from './styling_builder';
import { BindingScope, TemplateDefinitionBuilder, ValueConverter, makeBindingParser, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
const EMPTY_ARRAY = [];
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
const ATTR_REGEX = /attr\.([^\]]+)/;
function getStylingPrefix(name) {
    return name.substring(0, 5); // style or class
}
function baseDirectiveFields(meta, constantPool, bindingParser) {
    const definitionMap = new DefinitionMap();
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.type);
    // e.g. `selectors: [['', 'someDir', '']]`
    definitionMap.set('selectors', createDirectiveSelector(meta.selector));
    // e.g. `factory: () => new MyApp(directiveInject(ElementRef))`
    const result = compileFactoryFunction({
        name: meta.name,
        type: meta.type,
        deps: meta.deps,
        injectFn: R3.directiveInject,
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
    const hostVarsCount = Object.keys(meta.host.properties)
        .filter(name => {
        const prefix = getStylingPrefix(name);
        return prefix !== 'style' && prefix !== 'class';
    })
        .length;
    const elVarExp = o.variable('elIndex');
    const contextVarExp = o.variable(CONTEXT_NAME);
    const styleBuilder = new StylingBuilder(elVarExp, contextVarExp);
    const { styleAttr, classAttr } = meta.host.specialAttributes;
    if (styleAttr !== undefined) {
        styleBuilder.registerStyleAttr(styleAttr);
    }
    if (classAttr !== undefined) {
        styleBuilder.registerClassAttr(classAttr);
    }
    // e.g. `hostBindings: (rf, ctx, elIndex) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta, elVarExp, contextVarExp, meta.host.attributes, styleBuilder, bindingParser, constantPool, hostVarsCount));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs, true));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(e => o.literal(e))));
    }
    return { definitionMap, statements: result.statements };
}
/**
 * Add features to the definition map.
 */
function addFeatures(definitionMap, meta) {
    // e.g. `features: [NgOnChangesFeature()]`
    const features = [];
    const providers = meta.providers;
    const viewProviders = meta.viewProviders;
    if (providers || viewProviders) {
        const args = [providers || new o.LiteralArrayExpr([])];
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
    const { definitionMap, statements } = baseDirectiveFields(meta, constantPool, bindingParser);
    addFeatures(definitionMap, meta);
    const expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    if (!meta.selector) {
        throw new Error(`Directive ${meta.name} has no selector, please add it!`);
    }
    const type = createTypeForDef(meta, R3.DirectiveDefWithMeta);
    return { expression, type, statements };
}
/**
 * Compile a base definition for the render3 runtime as defined by {@link R3BaseRefMetadata}
 * @param meta the metadata used for compilation.
 */
export function compileBaseDefFromMetadata(meta) {
    const definitionMap = new DefinitionMap();
    if (meta.inputs) {
        const inputs = meta.inputs;
        const inputsMap = Object.keys(inputs).map(key => {
            const v = inputs[key];
            const value = Array.isArray(v) ? o.literalArr(v.map(vx => o.literal(vx))) : o.literal(v);
            return { key, value, quoted: false };
        });
        definitionMap.set('inputs', o.literalMap(inputsMap));
    }
    if (meta.outputs) {
        const outputs = meta.outputs;
        const outputsMap = Object.keys(outputs).map(key => {
            const value = o.literal(outputs[key]);
            return { key, value, quoted: false };
        });
        definitionMap.set('outputs', o.literalMap(outputsMap));
    }
    const expression = o.importExpr(R3.defineBase).callFn([definitionMap.toLiteralMap()]);
    const type = new o.ExpressionType(o.importExpr(R3.BaseDef));
    return { expression, type };
}
/**
 * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
 */
export function compileComponentFromMetadata(meta, constantPool, bindingParser) {
    const { definitionMap, statements } = baseDirectiveFields(meta, constantPool, bindingParser);
    addFeatures(definitionMap, meta);
    const selector = meta.selector && CssSelector.parse(meta.selector);
    const firstSelector = selector && selector[0];
    // e.g. `attr: ["class", ".my.app"]`
    // This is optional an only included if the first selector of a component specifies attributes.
    if (firstSelector) {
        const selectorAttributes = firstSelector.getAttrs();
        if (selectorAttributes.length) {
            definitionMap.set('attrs', constantPool.getConstLiteral(o.literalArr(selectorAttributes.map(value => value != null ? o.literal(value) : o.literal(undefined))), 
            /* forceShared */ true));
        }
    }
    // Generate the CSS matcher that recognize directive
    let directiveMatcher = null;
    if (meta.directives.length > 0) {
        const matcher = new SelectorMatcher();
        for (const { selector, expression } of meta.directives) {
            matcher.addSelectables(CssSelector.parse(selector), expression);
        }
        directiveMatcher = matcher;
    }
    // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
    const templateTypeName = meta.name;
    const templateName = templateTypeName ? `${templateTypeName}_Template` : null;
    const directivesUsed = new Set();
    const pipesUsed = new Set();
    const changeDetection = meta.changeDetection;
    const template = meta.template;
    const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
    const templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
    // We need to provide this so that dynamically generated components know what
    // projected content blocks to pass through to the component when it is instantiated.
    const ngContentSelectors = templateBuilder.getNgContentSelectors();
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
        let directivesExpr = o.literalArr(Array.from(directivesUsed));
        if (meta.wrapDirectivesAndPipesInClosure) {
            directivesExpr = o.fn([], [new o.ReturnStatement(directivesExpr)]);
        }
        definitionMap.set('directives', directivesExpr);
    }
    // e.g. `pipes: [MyPipe]`
    if (pipesUsed.size) {
        let pipesExpr = o.literalArr(Array.from(pipesUsed));
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
        const styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
            compileStyles(meta.styles, CONTENT_ATTR, HOST_ATTR) :
            meta.styles;
        const strings = styleValues.map(str => o.literal(str));
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
    const selectorForType = (meta.selector || '').replace(/\n/g, '');
    const expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()]);
    const type = createTypeForDef(meta, R3.ComponentDefWithMeta);
    return { expression, type, statements };
}
/**
 * A wrapper around `compileDirective` which depends on render2 global analysis data as its input
 * instead of the `R3DirectiveMetadata`.
 *
 * `R3DirectiveMetadata` is computed from `CompileDirectiveMetadata` and other statically reflected
 * information.
 */
export function compileDirectiveFromRender2(outputCtx, directive, reflector, bindingParser) {
    const name = identifierName(directive.type);
    name || error(`Cannot resolver the name of ${directive.type}`);
    const definitionField = outputCtx.constantPool.propertyNameOf(1 /* Directive */);
    const meta = directiveMetadataFromGlobalMetadata(directive, outputCtx, reflector);
    const res = compileDirectiveFromMetadata(meta, outputCtx.constantPool, bindingParser);
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
    const name = identifierName(component.type);
    name || error(`Cannot resolver the name of ${component.type}`);
    const definitionField = outputCtx.constantPool.propertyNameOf(2 /* Component */);
    const summary = component.toSummary();
    // Compute the R3ComponentMetadata from the CompileDirectiveMetadata
    const meta = Object.assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector), { selector: component.selector, template: { nodes: render3Ast.nodes }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
    const res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
    // Create the partial class to be merged with the actual class.
    outputCtx.statements.push(new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []));
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
    return queries.map(query => {
        let read = null;
        if (query.read && query.read.identifier) {
            read = outputCtx.importExpr(query.read.identifier.reference);
        }
        return {
            propertyName: query.propertyName,
            first: query.first,
            predicate: selectorsFromGlobalMetadata(query.selectors, outputCtx),
            descendants: query.descendants, read,
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
        const selectorStrings = selectors.map(value => value.value);
        selectorStrings.some(value => !value) &&
            error('Found a type among the string selectors expected');
        return outputCtx.constantPool.getConstLiteral(o.literalArr(selectorStrings.map(value => o.literal(value))));
    }
    if (selectors.length == 1) {
        const first = selectors[0];
        if (first.identifier) {
            return outputCtx.importExpr(first.identifier.reference);
        }
    }
    error('Unexpected query form');
    return o.NULL_EXPR;
}
function prepareQueryParams(query, constantPool) {
    const parameters = [
        getQueryPredicate(query, constantPool),
        o.literal(query.descendants),
        query.read || o.literal(null),
    ];
    return parameters;
}
// Turn a directive selector into an R3-compatible selector for directive def
function createDirectiveSelector(selector) {
    return asLiteral(core.parseSelectorToR3Selector(selector));
}
function convertAttributesToExpressions(attributes) {
    const values = [];
    for (let key of Object.getOwnPropertyNames(attributes)) {
        const value = attributes[key];
        values.push(o.literal(key), value);
    }
    return values;
}
// Define and update any content queries
function createContentQueriesFunction(meta, constantPool) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    for (const query of meta.queries) {
        // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
        const args = [o.variable('dirIndex'), ...prepareQueryParams(query, constantPool)];
        const queryInstruction = query.static ? R3.staticContentQuery : R3.contentQuery;
        createStatements.push(o.importExpr(queryInstruction).callFn(args).toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadContentQuery()) && (ctx.someDir = tmp));
        const temporary = tempAllocator();
        const getQueryList = o.importExpr(R3.loadContentQuery).callFn([]);
        const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        const updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    }
    const contentQueriesFnName = meta.name ? `${meta.name}_ContentQueries` : null;
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
    const mapValues = Object.keys(map).map(key => {
        const value = Array.isArray(map[key]) ? map[key][0] : map[key];
        return {
            key,
            value: o.literal(value),
            quoted: true,
        };
    });
    return o.expressionType(o.literalMap(mapValues));
}
function stringArrayAsType(arr) {
    return arr.length > 0 ? o.expressionType(o.literalArr(arr.map(value => o.literal(value)))) :
        o.NONE_TYPE;
}
function createTypeForDef(meta, typeBase) {
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    const selectorForType = (meta.selector || '').replace(/\n/g, '');
    return o.expressionType(o.importExpr(typeBase, [
        typeWithParameters(meta.type, meta.typeArgumentCount),
        stringAsType(selectorForType),
        meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
        stringMapAsType(meta.inputs),
        stringMapAsType(meta.outputs),
        stringArrayAsType(meta.queries.map(q => q.propertyName)),
    ]));
}
// Define and update any view queries
function createViewQueriesFunction(meta, constantPool) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    meta.viewQueries.forEach((query) => {
        const queryInstruction = query.static ? R3.staticViewQuery : R3.viewQuery;
        // creation, e.g. r3.viewQuery(somePredicate, true);
        const queryDefinition = o.importExpr(queryInstruction).callFn(prepareQueryParams(query, constantPool));
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadViewQuery()) && (ctx.someDir = tmp));
        const temporary = tempAllocator();
        const getQueryList = o.importExpr(R3.loadViewQuery).callFn([]);
        const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        const updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    });
    const viewQueryFnName = meta.name ? `${meta.name}_Query` : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(meta, elVarExp, bindingContext, staticAttributesAndValues, styleBuilder, bindingParser, constantPool, hostVarsCount) {
    const createStatements = [];
    const updateStatements = [];
    let totalHostVarsCount = hostVarsCount;
    const hostBindingSourceSpan = meta.typeSourceSpan;
    const directiveSummary = metadataAsSummary(meta);
    let valueConverter;
    const getValueConverter = () => {
        if (!valueConverter) {
            const hostVarsCountFn = (numSlots) => {
                const originalVarsCount = totalHostVarsCount;
                totalHostVarsCount += numSlots;
                return originalVarsCount;
            };
            valueConverter = new ValueConverter(constantPool, () => error('Unexpected node'), // new nodes are illegal here
            hostVarsCountFn, () => error('Unexpected pipe')); // pipes are illegal here
        }
        return valueConverter;
    };
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings && eventBindings.length) {
        const listeners = createHostListeners(bindingContext, eventBindings, meta);
        createStatements.push(...listeners);
    }
    // Calculate the host property bindings
    const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    (bindings || []).forEach((binding) => {
        const name = binding.name;
        const stylingInputWasSet = styleBuilder.registerInputBasedOnName(name, binding.expression, binding.sourceSpan);
        if (!stylingInputWasSet) {
            // resolve literal arrays and literal objects
            const value = binding.expression.visit(getValueConverter());
            const bindingExpr = bindingFn(bindingContext, value);
            const { bindingName, instruction, isAttribute } = getBindingNameAndInstruction(binding);
            const securityContexts = bindingParser.calcPossibleSecurityContexts(meta.selector || '', bindingName, isAttribute)
                .filter(context => context !== core.SecurityContext.NONE);
            let sanitizerFn = null;
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
            const instructionParams = [
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
            updateStatements.push(...bindingExpr.stmts);
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
    const hostAttrs = convertAttributesToExpressions(staticAttributesAndValues);
    const hostInstruction = styleBuilder.buildHostAttrsInstruction(null, hostAttrs, constantPool);
    if (hostInstruction) {
        createStatements.push(createStylingStmt(hostInstruction, bindingContext, bindingFn));
    }
    if (styleBuilder.hasBindings) {
        // singular style/class bindings (things like `[style.prop]` and `[class.name]`)
        // MUST be registered on a given element within the component/directive
        // templateFn/hostBindingsFn functions. The instruction below will figure out
        // what all the bindings are and then generate the statements required to register
        // those bindings to the element via `elementStyling`.
        const elementStylingInstruction = styleBuilder.buildElementStylingInstruction(null, constantPool);
        if (elementStylingInstruction) {
            createStatements.push(createStylingStmt(elementStylingInstruction, bindingContext, bindingFn));
        }
        // finally each binding that was registered in the statement above will need to be added to
        // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
        // are evaluated and updated for the element.
        styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(instruction => {
            updateStatements.push(createStylingStmt(instruction, bindingContext, bindingFn));
        });
    }
    if (totalHostVarsCount) {
        createStatements.unshift(o.importExpr(R3.allocHostVars).callFn([o.literal(totalHostVarsCount)]).toStmt());
    }
    if (createStatements.length > 0 || updateStatements.length > 0) {
        const hostBindingsFnName = meta.name ? `${meta.name}_HostBindings` : null;
        const statements = [];
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
function bindingFn(implicit, value) {
    return convertPropertyBinding(null, implicit, value, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
}
function createStylingStmt(instruction, bindingContext, bindingFn) {
    const params = instruction.buildParams(value => bindingFn(bindingContext, value).currValExpr);
    return o.importExpr(instruction.reference, null, instruction.sourceSpan)
        .callFn(params, instruction.sourceSpan)
        .toStmt();
}
function getBindingNameAndInstruction(binding) {
    let bindingName = binding.name;
    let instruction;
    // Check to see if this is an attr binding or a property binding
    const attrMatches = bindingName.match(ATTR_REGEX);
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
    return { bindingName, instruction, isAttribute: !!attrMatches };
}
function createHostListeners(bindingContext, eventBindings, meta) {
    return eventBindings.map(binding => {
        let bindingName = binding.name && sanitizeIdentifier(binding.name);
        const bindingFnName = binding.type === 1 /* Animation */ ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        const handlerName = meta.name && bindingName ? `${meta.name}_${bindingFnName}_HostBindingHandler` : null;
        const params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), bindingContext, handlerName);
        const instruction = binding.type == 1 /* Animation */ ? R3.componentHostSyntheticListener : R3.listener;
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
    const entries = Array.from(map).map(([key, type]) => [key, outputCtx.importExpr(type)]);
    return new Map(entries);
}
const HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
export function parseHostBindings(host) {
    const attributes = {};
    const listeners = {};
    const properties = {};
    const specialAttributes = {};
    for (const key of Object.keys(host)) {
        const value = host[key];
        const matches = key.match(HOST_REG_EXP);
        if (matches === null) {
            switch (key) {
                case 'class':
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error(`Class binding must be string`);
                    }
                    specialAttributes.classAttr = value;
                    break;
                case 'style':
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error(`Style binding must be string`);
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
                throw new Error(`Property binding must be string`);
            }
            // synthetic properties (the ones that have a `@` as a prefix)
            // are still treated the same as regular properties. Therefore
            // there is no point in storing them in a separate map.
            properties[matches[1 /* Binding */]] = value;
        }
        else if (matches[2 /* Event */] != null) {
            if (typeof value !== 'string') {
                // TODO(alxhub): make this a diagnostic.
                throw new Error(`Event binding must be string`);
            }
            listeners[matches[2 /* Event */]] = value;
        }
    }
    return { attributes, listeners, properties, specialAttributes };
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
    const summary = metadataAsSummary({ host: bindings });
    // TODO: abstract out host bindings verification logic and use it instead of
    // creating events and properties ASTs to detect errors (FW-996)
    const bindingParser = makeBindingParser();
    bindingParser.createDirectiveHostEventAsts(summary, sourceSpan);
    bindingParser.createBoundHostProperties(summary, sourceSpan);
    return bindingParser.errors;
}
function compileStyles(styles, selector, hostSelector) {
    const shadowCss = new ShadowCss();
    return styles.map(style => { return shadowCss.shimCssText(style, selector, hostSelector); });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBZ0csY0FBYyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFDLFdBQVcsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRTdGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBR25DLE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUU3RCxPQUFPLEVBQWdCLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNoRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxzQkFBc0IsRUFBaUMsTUFBTSxlQUFlLENBQUM7QUFDckYsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsb0NBQW9DLEVBQUUsNEJBQTRCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHL0csT0FBTyxFQUFjLGNBQWMsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQzlELE9BQU8sRUFBQyxZQUFZLEVBQUUseUJBQXlCLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLDhCQUE4QixFQUFFLHFCQUFxQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ3BMLE9BQU8sRUFBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLG1DQUFtQyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXhLLE1BQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztBQUU5Qiw2RkFBNkY7QUFDN0YseUZBQXlGO0FBQ3pGLE1BQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDO0FBRXBDLFNBQVMsZ0JBQWdCLENBQUMsSUFBWTtJQUNwQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUUsaUJBQWlCO0FBQ2pELENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUN4QixJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCO0lBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7SUFFMUMsMkJBQTJCO0lBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVyQywwQ0FBMEM7SUFDMUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFHdkUsK0RBQStEO0lBQy9ELE1BQU0sTUFBTSxHQUFHLHNCQUFzQixDQUFDO1FBQ3BDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLFFBQVEsRUFBRSxFQUFFLENBQUMsZUFBZTtLQUM3QixDQUFDLENBQUM7SUFDSCxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFN0MsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDM0IsdURBQXVEO1FBQ3ZELGFBQWEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7S0FDdkY7SUFFRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHlCQUF5QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0tBQy9FO0lBRUQsd0ZBQXdGO0lBQ3hGLHlGQUF5RjtJQUN6RixNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQzVCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNiLE1BQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sTUFBTSxLQUFLLE9BQU8sSUFBSSxNQUFNLEtBQUssT0FBTyxDQUFDO0lBQ2xELENBQUMsQ0FBQztTQUNELE1BQU0sQ0FBQztJQUVsQyxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZDLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0MsTUFBTSxZQUFZLEdBQUcsSUFBSSxjQUFjLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRWpFLE1BQU0sRUFBQyxTQUFTLEVBQUUsU0FBUyxFQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztJQUMzRCxJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUU7UUFDM0IsWUFBWSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQzNDO0lBQ0QsSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFO1FBQzNCLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUMzQztJQUVELG9EQUFvRDtJQUNwRCxhQUFhLENBQUMsR0FBRyxDQUNiLGNBQWMsRUFBRSwwQkFBMEIsQ0FDdEIsSUFBSSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUNqRSxhQUFhLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFFckUseUJBQXlCO0lBQ3pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVwRiwwQkFBMEI7SUFDMUIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsbUNBQW1DLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFaEYsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtRQUMxQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuRjtJQUVELE9BQU8sRUFBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FDaEIsYUFBNEIsRUFBRSxJQUErQztJQUMvRSwwQ0FBMEM7SUFDMUMsTUFBTSxRQUFRLEdBQW1CLEVBQUUsQ0FBQztJQUVwQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ2pDLE1BQU0sYUFBYSxHQUFJLElBQTRCLENBQUMsYUFBYSxDQUFDO0lBQ2xFLElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRTtRQUM5QixNQUFNLElBQUksR0FBRyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksYUFBYSxFQUFFO1lBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDMUI7UUFDRCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDL0Q7SUFFRCxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDeEIsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7S0FDMUQ7SUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztLQUN4RTtJQUNELElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtRQUNuQixhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7S0FDdkQ7QUFDSCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQ3hDLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7SUFDOUIsTUFBTSxFQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUMsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNGLFdBQVcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUzRixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsSUFBSSxDQUFDLElBQUksa0NBQWtDLENBQUMsQ0FBQztLQUMzRTtJQUVELE1BQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUM3RCxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUMsQ0FBQztBQUN4QyxDQUFDO0FBT0Q7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUFDLElBQXVCO0lBQ2hFLE1BQU0sYUFBYSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7SUFDMUMsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1FBQ2YsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUMzQixNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUM5QyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEIsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekYsT0FBTyxFQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0tBQ3REO0lBQ0QsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1FBQ2hCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDaEQsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN0QyxPQUFPLEVBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7S0FDeEQ7SUFFRCxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRXRGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRTVELE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7QUFDNUIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLDRCQUE0QixDQUN4QyxJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCO0lBQzlCLE1BQU0sRUFBQyxhQUFhLEVBQUUsVUFBVSxFQUFDLEdBQUcsbUJBQW1CLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztJQUMzRixXQUFXLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRWpDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkUsTUFBTSxhQUFhLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU5QyxvQ0FBb0M7SUFDcEMsK0ZBQStGO0lBQy9GLElBQUksYUFBYSxFQUFFO1FBQ2pCLE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3BELElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFO1lBQzdCLGFBQWEsQ0FBQyxHQUFHLENBQ2IsT0FBTyxFQUFFLFlBQVksQ0FBQyxlQUFlLENBQ3hCLENBQUMsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUMvQixLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN0RSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzNDO0tBQ0Y7SUFFRCxvREFBb0Q7SUFDcEQsSUFBSSxnQkFBZ0IsR0FBeUIsSUFBSSxDQUFDO0lBRWxELElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzlCLE1BQU0sT0FBTyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDdEMsS0FBSyxNQUFNLEVBQUMsUUFBUSxFQUFFLFVBQVUsRUFBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDcEQsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQ2pFO1FBQ0QsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO0tBQzVCO0lBRUQsa0VBQWtFO0lBQ2xFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQyxNQUFNLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxnQkFBZ0IsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFOUUsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7SUFDL0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7SUFDMUMsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUU3QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQy9CLE1BQU0sZUFBZSxHQUFHLElBQUkseUJBQXlCLENBQ2pELFlBQVksRUFBRSxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFDcEYsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQ3pFLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUUzRCxNQUFNLDBCQUEwQixHQUFHLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRTdGLDZFQUE2RTtJQUM3RSxxRkFBcUY7SUFDckYsTUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUNuRSxJQUFJLGtCQUFrQixFQUFFO1FBQ3RCLGFBQWEsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztLQUM3RDtJQUVELG1CQUFtQjtJQUNuQixhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFeEUsaUJBQWlCO0lBQ2pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUVwRSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBRTFELG1DQUFtQztJQUNuQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUU7UUFDdkIsSUFBSSxjQUFjLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDcEU7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztLQUNqRDtJQUVELHlCQUF5QjtJQUN6QixJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUU7UUFDbEIsSUFBSSxTQUFTLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDMUQ7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN2QztJQUVELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUU7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDO0tBQ3REO0lBRUQsOEJBQThCO0lBQzlCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNyQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2RSxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2hCLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQ3BEO1NBQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7UUFDakUsaUVBQWlFO1FBQ2pFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztLQUNsRDtJQUVELDREQUE0RDtJQUM1RCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtRQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0tBQ25FO0lBRUQseUNBQXlDO0lBQ3pDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDNUIsYUFBYSxDQUFDLEdBQUcsQ0FDYixNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDeEY7SUFFRCwrRUFBK0U7SUFDL0UsSUFBSSxlQUFlLElBQUksSUFBSSxJQUFJLGVBQWUsS0FBSyxJQUFJLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFO1FBQ3ZGLGFBQWEsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO0tBQ2xFO0lBRUQsK0ZBQStGO0lBQy9GLDZDQUE2QztJQUM3QyxNQUFNLGVBQWUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUVqRSxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNGLE1BQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUU3RCxPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUN2QyxTQUF3QixFQUFFLFNBQW1DLEVBQUUsU0FBMkIsRUFDMUYsYUFBNEI7SUFDOUIsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUcsQ0FBQztJQUM5QyxJQUFJLElBQUksS0FBSyxDQUFDLCtCQUErQixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUUvRCxNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLGNBQWMsbUJBQTBCLENBQUM7SUFFeEYsTUFBTSxJQUFJLEdBQUcsbUNBQW1DLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNsRixNQUFNLEdBQUcsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztJQUV0RiwrREFBK0Q7SUFDL0QsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUNyQyxJQUFJLEVBQUUsSUFBSSxFQUNWLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsRUFDN0YsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FDdkMsU0FBd0IsRUFBRSxTQUFtQyxFQUFFLFVBQThCLEVBQzdGLFNBQTJCLEVBQUUsYUFBNEIsRUFBRSxrQkFBb0MsRUFDL0YsY0FBZ0M7SUFDbEMsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUcsQ0FBQztJQUM5QyxJQUFJLElBQUksS0FBSyxDQUFDLCtCQUErQixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUUvRCxNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLGNBQWMsbUJBQTBCLENBQUM7SUFFeEYsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBRXRDLG9FQUFvRTtJQUNwRSxNQUFNLElBQUkscUJBQ0wsbUNBQW1DLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsSUFDdkUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRLEVBQzVCLFFBQVEsRUFBRSxFQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFDLEVBQ25DLFVBQVUsRUFBRSxFQUFFLEVBQ2QsS0FBSyxFQUFFLHNCQUFzQixDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsRUFDeEQsV0FBVyxFQUFFLHlCQUF5QixDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLEVBQ3hFLCtCQUErQixFQUFFLEtBQUssRUFDdEMsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFdBQVcsRUFDcEUsYUFBYSxFQUNULENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQzNGLGFBQWEsRUFBRSw0QkFBNEIsRUFDM0MsVUFBVSxFQUFFLElBQUksRUFDaEIsYUFBYSxFQUNULFNBQVMsQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUM5Rix1QkFBdUIsRUFBRSxFQUFFLEVBQzNCLGtCQUFrQixFQUFFLElBQUksR0FDekIsQ0FBQztJQUNGLE1BQU0sR0FBRyxHQUFHLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRXRGLCtEQUErRDtJQUMvRCxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3JDLElBQUksRUFBRSxJQUFJLEVBQ1YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUM3RixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG1DQUFtQyxDQUN4QyxTQUFtQyxFQUFFLFNBQXdCLEVBQzdELFNBQTJCO0lBQzdCLDZFQUE2RTtJQUM3RSxNQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMseUJBQXlCLENBQzlCLE9BQStCLEVBQUUsU0FBd0I7SUFDM0QsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLElBQUksSUFBSSxHQUFzQixJQUFJLENBQUM7UUFDbkMsSUFBSSxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ3ZDLElBQUksR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzlEO1FBQ0QsT0FBTztZQUNMLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtZQUNoQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7WUFDbEIsU0FBUyxFQUFFLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO1lBQ2xFLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxFQUFFLElBQUk7WUFDcEMsTUFBTSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTTtTQUN2QixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUywyQkFBMkIsQ0FDaEMsU0FBaUMsRUFBRSxTQUF3QjtJQUM3RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pFLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBZSxDQUFDLENBQUM7UUFDdEUsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ2pDLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQzlELE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQ3pDLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDbkU7SUFFRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7WUFDcEIsT0FBTyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDekQ7S0FDRjtJQUVELEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0lBQy9CLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBRUQsU0FBUyxrQkFBa0IsQ0FBQyxLQUFzQixFQUFFLFlBQTBCO0lBQzVFLE1BQU0sVUFBVSxHQUFHO1FBQ2pCLGlCQUFpQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQUM7UUFDdEMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO1FBQzVCLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7S0FDOUIsQ0FBQztJQUNGLE9BQU8sVUFBVSxDQUFDO0FBQ3BCLENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsU0FBUyx1QkFBdUIsQ0FBQyxRQUF1QjtJQUN0RCxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFDO0FBRUQsU0FBUyw4QkFBOEIsQ0FBQyxVQUEwQztJQUVoRixNQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDO0lBQ2xDLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3RELE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDcEM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBRUQsd0NBQXdDO0FBQ3hDLFNBQVMsNEJBQTRCLENBQ2pDLElBQXlCLEVBQUUsWUFBMEI7SUFDdkQsTUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO0lBQzNDLE1BQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUUzRSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDaEMsdUVBQXVFO1FBQ3ZFLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxHQUFHLGtCQUFrQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQVEsQ0FBQyxDQUFDO1FBRXpGLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDO1FBRWhGLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFNUUsc0ZBQXNGO1FBQ3RGLE1BQU0sU0FBUyxHQUFHLGFBQWEsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLE1BQU0sZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO2FBQ25CLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO2FBQ3hCLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0tBQzlEO0lBRUQsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDOUUsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUNQO1FBQ0UsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUM7UUFDN0UsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUM7S0FDaEMsRUFDRDtRQUNFLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUM7UUFDaEUscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQztLQUNqRSxFQUNELENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLEdBQVc7SUFDL0IsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMxQyxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsR0FBdUM7SUFDOUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDM0MsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0QsT0FBTztZQUNMLEdBQUc7WUFDSCxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDdkIsTUFBTSxFQUFFLElBQUk7U0FDYixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEdBQWE7SUFDdEMsT0FBTyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUN0QyxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxJQUF5QixFQUFFLFFBQTZCO0lBQ2hGLCtGQUErRjtJQUMvRiw2Q0FBNkM7SUFDN0MsTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFakUsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFO1FBQzdDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ3JELFlBQVksQ0FBQyxlQUFlLENBQUM7UUFDN0IsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDdkUsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDNUIsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7S0FDekQsQ0FBQyxDQUFDLENBQUM7QUFDTixDQUFDO0FBRUQscUNBQXFDO0FBQ3JDLFNBQVMseUJBQXlCLENBQzlCLElBQXlCLEVBQUUsWUFBMEI7SUFDdkQsTUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO0lBQzNDLE1BQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUUzRSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQXNCLEVBQUUsRUFBRTtRQUNsRCxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUM7UUFFMUUsb0RBQW9EO1FBQ3BELE1BQU0sZUFBZSxHQUNqQixDQUFDLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQ25GLGdCQUFnQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUVoRCxtRkFBbUY7UUFDbkYsTUFBTSxTQUFTLEdBQUcsYUFBYSxFQUFFLENBQUM7UUFDbEMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLE1BQU0sZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO2FBQ25CLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO2FBQ3hCLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNoRSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQy9FO1FBQ0UscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQztRQUNoRSxxQkFBcUIsaUJBQTBCLGdCQUFnQixDQUFDO0tBQ2pFLEVBQ0QsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVELGtFQUFrRTtBQUNsRSxTQUFTLDBCQUEwQixDQUMvQixJQUF5QixFQUFFLFFBQXVCLEVBQUUsY0FBNkIsRUFDakYseUJBQXlELEVBQUUsWUFBNEIsRUFDdkYsYUFBNEIsRUFBRSxZQUEwQixFQUFFLGFBQXFCO0lBRWpGLE1BQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxNQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7SUFFM0MsSUFBSSxrQkFBa0IsR0FBRyxhQUFhLENBQUM7SUFDdkMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFakQsSUFBSSxjQUE4QixDQUFDO0lBQ25DLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxFQUFFO1FBQzdCLElBQUksQ0FBQyxjQUFjLEVBQUU7WUFDbkIsTUFBTSxlQUFlLEdBQUcsQ0FBQyxRQUFnQixFQUFVLEVBQUU7Z0JBQ25ELE1BQU0saUJBQWlCLEdBQUcsa0JBQWtCLENBQUM7Z0JBQzdDLGtCQUFrQixJQUFJLFFBQVEsQ0FBQztnQkFDL0IsT0FBTyxpQkFBaUIsQ0FBQztZQUMzQixDQUFDLENBQUM7WUFDRixjQUFjLEdBQUcsSUFBSSxjQUFjLENBQy9CLFlBQVksRUFDWixHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsRUFBRyw2QkFBNkI7WUFDOUQsZUFBZSxFQUNmLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBRSx5QkFBeUI7U0FDaEU7UUFDRCxPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDLENBQUM7SUFFRixnQ0FBZ0M7SUFDaEMsTUFBTSxhQUFhLEdBQ2YsYUFBYSxDQUFDLDRCQUE0QixDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDeEYsSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRTtRQUN6QyxNQUFNLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0tBQ3JDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2xHLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQXVCLEVBQUUsRUFBRTtRQUNuRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDO1FBQzFCLE1BQU0sa0JBQWtCLEdBQ3BCLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDeEYsSUFBSSxDQUFDLGtCQUFrQixFQUFFO1lBQ3ZCLDZDQUE2QztZQUM3QyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDNUQsTUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUVyRCxNQUFNLEVBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUMsR0FBRyw0QkFBNEIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV0RixNQUFNLGdCQUFnQixHQUNsQixhQUFhLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztpQkFDcEYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbEUsSUFBSSxXQUFXLEdBQXdCLElBQUksQ0FBQztZQUM1QyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRTtnQkFDM0IsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEtBQUssQ0FBQztvQkFDN0IsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN2RCxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtvQkFDcEUscUZBQXFGO29CQUNyRix5RkFBeUY7b0JBQ3pGLG9GQUFvRjtvQkFDcEYsa0NBQWtDO29CQUNsQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsd0JBQXdCLENBQUMsQ0FBQztpQkFDekQ7cUJBQU07b0JBQ0wsV0FBVyxHQUFHLHFCQUFxQixDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO2lCQUN2RTthQUNGO1lBRUQsTUFBTSxpQkFBaUIsR0FBbUI7Z0JBQ3hDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQzthQUMxRixDQUFDO1lBQ0YsSUFBSSxXQUFXLEVBQUU7Z0JBQ2YsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ3JDO1lBQ0QsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsSUFBSSxDQUFDLFdBQVcsRUFBRTtvQkFDaEIseUVBQXlFO29CQUN6RSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUN6QztnQkFDRCxzREFBc0Q7Z0JBQ3RELGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDekM7WUFFRCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNyRjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsMkVBQTJFO0lBQzNFLDRFQUE0RTtJQUM1RSwrRUFBK0U7SUFDL0UsNEVBQTRFO0lBQzVFLGdGQUFnRjtJQUNoRiw4RUFBOEU7SUFDOUUscUJBQXFCO0lBQ3JCLE1BQU0sU0FBUyxHQUFHLDhCQUE4QixDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUUsTUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDOUYsSUFBSSxlQUFlLEVBQUU7UUFDbkIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztLQUN0RjtJQUVELElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRTtRQUM1QixnRkFBZ0Y7UUFDaEYsdUVBQXVFO1FBQ3ZFLDZFQUE2RTtRQUM3RSxrRkFBa0Y7UUFDbEYsc0RBQXNEO1FBQ3RELE1BQU0seUJBQXlCLEdBQzNCLFlBQVksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDcEUsSUFBSSx5QkFBeUIsRUFBRTtZQUM3QixnQkFBZ0IsQ0FBQyxJQUFJLENBQ2pCLGlCQUFpQixDQUFDLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQzlFO1FBRUQsMkZBQTJGO1FBQzNGLDJGQUEyRjtRQUMzRiw2Q0FBNkM7UUFDN0MsWUFBWSxDQUFDLDRCQUE0QixDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDbkYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUNuRixDQUFDLENBQUMsQ0FBQztLQUNKO0lBRUQsSUFBSSxrQkFBa0IsRUFBRTtRQUN0QixnQkFBZ0IsQ0FBQyxPQUFPLENBQ3BCLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztLQUN0RjtJQUVELElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzlELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUMxRSxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBQ3JDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1NBQ25GO1FBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQy9CLFVBQVUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDbkY7UUFDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1A7WUFDRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQztZQUM3RSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQU0sRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDO1NBQzlDLEVBQ0QsVUFBVSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxRQUFhLEVBQUUsS0FBVTtJQUMxQyxPQUFPLHNCQUFzQixDQUN6QixJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsV0FBVyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO0FBQ2xHLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUN0QixXQUF3QixFQUFFLGNBQW1CLEVBQUUsU0FBbUI7SUFDcEUsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUYsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUM7U0FDbkUsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDO1NBQ3RDLE1BQU0sRUFBRSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLE9BQXVCO0lBRTNELElBQUksV0FBVyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDL0IsSUFBSSxXQUFrQyxDQUFDO0lBRXZDLGdFQUFnRTtJQUNoRSxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2xELElBQUksV0FBVyxFQUFFO1FBQ2YsV0FBVyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QixXQUFXLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO0tBQ25DO1NBQU07UUFDTCxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUU7WUFDdkIsV0FBVyxHQUFHLDRCQUE0QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3hELHFGQUFxRjtZQUNyRixtRkFBbUY7WUFDbkYsd0RBQXdEO1lBQ3hELFdBQVcsR0FBRyxFQUFFLENBQUMsOEJBQThCLENBQUM7U0FDakQ7YUFBTTtZQUNMLFdBQVcsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ2xDO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBQyxDQUFDO0FBQ2hFLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUN4QixjQUE0QixFQUFFLGFBQTRCLEVBQzFELElBQXlCO0lBQzNCLE9BQU8sYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNqQyxJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsSUFBSSxzQkFBOEIsQ0FBQyxDQUFDO1lBQzlELG9DQUFvQyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUMxRSxXQUFXLENBQUM7UUFDaEIsTUFBTSxXQUFXLEdBQ2IsSUFBSSxDQUFDLElBQUksSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxhQUFhLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDekYsTUFBTSxNQUFNLEdBQUcsOEJBQThCLENBQ3pDLFVBQVUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUUsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sV0FBVyxHQUNiLE9BQU8sQ0FBQyxJQUFJLHFCQUE2QixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7UUFDaEcsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUMzRCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQXlCO0lBQ2xELG1CQUFtQjtJQUNuQixPQUFPO1FBQ0wsZ0dBQWdHO1FBQ2hHLGlDQUFpQztRQUNqQyxjQUFjLEVBQUUsRUFBRTtRQUNsQixhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1FBQ2xDLGNBQWMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7S0FDVixDQUFDO0lBQzdCLGtCQUFrQjtBQUNwQixDQUFDO0FBR0QsU0FBUyxzQkFBc0IsQ0FDM0IsR0FBOEIsRUFBRSxTQUF3QjtJQUMxRCxpR0FBaUc7SUFDakcsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQy9CLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQTBCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRixPQUFPLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFCLENBQUM7QUFFRCxNQUFNLFlBQVksR0FBRyxxQ0FBcUMsQ0FBQztBQW1CM0QsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQTRDO0lBRTVFLE1BQU0sVUFBVSxHQUFrQyxFQUFFLENBQUM7SUFDckQsTUFBTSxTQUFTLEdBQTRCLEVBQUUsQ0FBQztJQUM5QyxNQUFNLFVBQVUsR0FBNEIsRUFBRSxDQUFDO0lBQy9DLE1BQU0saUJBQWlCLEdBQThDLEVBQUUsQ0FBQztJQUV4RSxLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFeEMsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQ3BCLFFBQVEsR0FBRyxFQUFFO2dCQUNYLEtBQUssT0FBTztvQkFDVixJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTt3QkFDN0Isd0NBQXdDO3dCQUN4QyxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7cUJBQ2pEO29CQUNELGlCQUFpQixDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7b0JBQ3BDLE1BQU07Z0JBQ1IsS0FBSyxPQUFPO29CQUNWLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO3dCQUM3Qix3Q0FBd0M7d0JBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQztxQkFDakQ7b0JBQ0QsaUJBQWlCLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztvQkFDcEMsTUFBTTtnQkFDUjtvQkFDRSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTt3QkFDN0IsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQ3BDO3lCQUFNO3dCQUNMLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7cUJBQ3pCO2FBQ0o7U0FDRjthQUFNLElBQUksT0FBTyxpQkFBMEIsSUFBSSxJQUFJLEVBQUU7WUFDcEQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7Z0JBQzdCLHdDQUF3QztnQkFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO2FBQ3BEO1lBQ0QsOERBQThEO1lBQzlELDhEQUE4RDtZQUM5RCx1REFBdUQ7WUFDdkQsVUFBVSxDQUFDLE9BQU8saUJBQTBCLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDdkQ7YUFBTSxJQUFJLE9BQU8sZUFBd0IsSUFBSSxJQUFJLEVBQUU7WUFDbEQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7Z0JBQzdCLHdDQUF3QztnQkFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO2FBQ2pEO1lBQ0QsU0FBUyxDQUFDLE9BQU8sZUFBd0IsQ0FBQyxHQUFHLEtBQUssQ0FBQztTQUNwRDtLQUNGO0lBRUQsT0FBTyxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQzlCLFFBQTRCLEVBQUUsVUFBMkI7SUFDM0QsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFTLENBQUMsQ0FBQztJQUM3RCw0RUFBNEU7SUFDNUUsZ0VBQWdFO0lBQ2hFLE1BQU0sYUFBYSxHQUFHLGlCQUFpQixFQUFFLENBQUM7SUFDMUMsYUFBYSxDQUFDLDRCQUE0QixDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNoRSxhQUFhLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdELE9BQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsTUFBZ0IsRUFBRSxRQUFnQixFQUFFLFlBQW9CO0lBQzdFLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7SUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsT0FBTyxTQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCB0eXBlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7U2hhZG93Q3NzfSBmcm9tICcuLi8uLi9zaGFkb3dfY3NzJztcbmltcG9ydCB7Q09OVEVOVF9BVFRSLCBIT1NUX0FUVFJ9IGZyb20gJy4uLy4uL3N0eWxlX2NvbXBpbGVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dCwgZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGF9IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSZW5kZXIzUGFyc2VSZXN1bHR9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZSwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtJbnN0cnVjdGlvbiwgU3R5bGluZ0J1aWxkZXJ9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlciwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm59IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIGdldFF1ZXJ5UHJlZGljYXRlLCB0ZW1wb3JhcnlBbGxvY2F0b3J9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IEVNUFRZX0FSUkFZOiBhbnlbXSA9IFtdO1xuXG4vLyBUaGlzIHJlZ2V4IG1hdGNoZXMgYW55IGJpbmRpbmcgbmFtZXMgdGhhdCBjb250YWluIHRoZSBcImF0dHIuXCIgcHJlZml4LCBlLmcuIFwiYXR0ci5yZXF1aXJlZFwiXG4vLyBJZiB0aGVyZSBpcyBhIG1hdGNoLCB0aGUgZmlyc3QgbWF0Y2hpbmcgZ3JvdXAgd2lsbCBjb250YWluIHRoZSBhdHRyaWJ1dGUgbmFtZSB0byBiaW5kLlxuY29uc3QgQVRUUl9SRUdFWCA9IC9hdHRyXFwuKFteXFxdXSspLztcblxuZnVuY3Rpb24gZ2V0U3R5bGluZ1ByZWZpeChuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gbmFtZS5zdWJzdHJpbmcoMCwgNSk7ICAvLyBzdHlsZSBvciBjbGFzc1xufVxuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7ZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXX0ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yczogW1snJywgJ3NvbWVEaXInLCAnJ11dYFxuICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3JzJywgY3JlYXRlRGlyZWN0aXZlU2VsZWN0b3IobWV0YS5zZWxlY3RvcikpO1xuXG5cbiAgLy8gZS5nLiBgZmFjdG9yeTogKCkgPT4gbmV3IE15QXBwKGRpcmVjdGl2ZUluamVjdChFbGVtZW50UmVmKSlgXG4gIGNvbnN0IHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICB0eXBlOiBtZXRhLnR5cGUsXG4gICAgZGVwczogbWV0YS5kZXBzLFxuICAgIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsXG4gIH0pO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZmFjdG9yeScsIHJlc3VsdC5mYWN0b3J5KTtcblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBlLmcuIGBjb250ZW50UXVlcmllczogKHJmLCBjdHgsIGRpckluZGV4KSA9PiB7IC4uLiB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEsIGNvbnN0YW50UG9vbCkpO1xuICB9XG5cbiAgLy8gSW5pdGlhbGl6ZSBob3N0VmFyc0NvdW50IHRvIG51bWJlciBvZiBib3VuZCBob3N0IHByb3BlcnRpZXMgKGludGVycG9sYXRpb25zIGlsbGVnYWwpLFxuICAvLyBleGNlcHQgJ3N0eWxlJyBhbmQgJ2NsYXNzJyBwcm9wZXJ0aWVzLCBzaW5jZSB0aGV5IHNob3VsZCAqbm90KiBhbGxvY2F0ZSBob3N0IHZhciBzbG90c1xuICBjb25zdCBob3N0VmFyc0NvdW50ID0gT2JqZWN0LmtleXMobWV0YS5ob3N0LnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihuYW1lID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGdldFN0eWxpbmdQcmVmaXgobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlZml4ICE9PSAnc3R5bGUnICYmIHByZWZpeCAhPT0gJ2NsYXNzJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5sZW5ndGg7XG5cbiAgY29uc3QgZWxWYXJFeHAgPSBvLnZhcmlhYmxlKCdlbEluZGV4Jyk7XG4gIGNvbnN0IGNvbnRleHRWYXJFeHAgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihlbFZhckV4cCwgY29udGV4dFZhckV4cCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IG1ldGEuaG9zdC5zcGVjaWFsQXR0cmlidXRlcztcbiAgaWYgKHN0eWxlQXR0ciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHN0eWxlQXR0cik7XG4gIH1cbiAgaWYgKGNsYXNzQXR0ciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKGNsYXNzQXR0cik7XG4gIH1cblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChyZiwgY3R4LCBlbEluZGV4KSA9PiB7IC4uLiB9XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2hvc3RCaW5kaW5ncycsIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhLCBlbFZhckV4cCwgY29udGV4dFZhckV4cCwgbWV0YS5ob3N0LmF0dHJpYnV0ZXMsIHN0eWxlQnVpbGRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBob3N0VmFyc0NvdW50KSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiByZXN1bHQuc3RhdGVtZW50c307XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSB8IFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmUoKV1gXG4gIGNvbnN0IGZlYXR1cmVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIGNvbnN0IHByb3ZpZGVycyA9IG1ldGEucHJvdmlkZXJzO1xuICBjb25zdCB2aWV3UHJvdmlkZXJzID0gKG1ldGEgYXMgUjNDb21wb25lbnRNZXRhZGF0YSkudmlld1Byb3ZpZGVycztcbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkuY2FsbEZuKEVNUFRZX0FSUkFZKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBpZiAoIW1ldGEuc2VsZWN0b3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYERpcmVjdGl2ZSAke21ldGEubmFtZX0gaGFzIG5vIHNlbGVjdG9yLCBwbGVhc2UgYWRkIGl0IWApO1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuRGlyZWN0aXZlRGVmV2l0aE1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzQmFzZVJlZk1ldGFEYXRhIHtcbiAgaW5wdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ119O1xuICBvdXRwdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGJhc2UgZGVmaW5pdGlvbiBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHtAbGluayBSM0Jhc2VSZWZNZXRhZGF0YX1cbiAqIEBwYXJhbSBtZXRhIHRoZSBtZXRhZGF0YSB1c2VkIGZvciBjb21waWxhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVCYXNlRGVmRnJvbU1ldGFkYXRhKG1ldGE6IFIzQmFzZVJlZk1ldGFEYXRhKSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBpZiAobWV0YS5pbnB1dHMpIHtcbiAgICBjb25zdCBpbnB1dHMgPSBtZXRhLmlucHV0cztcbiAgICBjb25zdCBpbnB1dHNNYXAgPSBPYmplY3Qua2V5cyhpbnB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdiA9IGlucHV0c1trZXldO1xuICAgICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KHYpID8gby5saXRlcmFsQXJyKHYubWFwKHZ4ID0+IG8ubGl0ZXJhbCh2eCkpKSA6IG8ubGl0ZXJhbCh2KTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIG8ubGl0ZXJhbE1hcChpbnB1dHNNYXApKTtcbiAgfVxuICBpZiAobWV0YS5vdXRwdXRzKSB7XG4gICAgY29uc3Qgb3V0cHV0cyA9IG1ldGEub3V0cHV0cztcbiAgICBjb25zdCBvdXRwdXRzTWFwID0gT2JqZWN0LmtleXMob3V0cHV0cykubWFwKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG8ubGl0ZXJhbChvdXRwdXRzW2tleV0pO1xuICAgICAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbiAgICB9KTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIG8ubGl0ZXJhbE1hcChvdXRwdXRzTWFwKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUJhc2UpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuXG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQmFzZURlZikpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJywgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBmb3IgKGNvbnN0IHtzZWxlY3RvciwgZXhwcmVzc2lvbn0gb2YgbWV0YS5kaXJlY3RpdmVzKSB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IHBpcGVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBjaGFuZ2VEZXRlY3Rpb24gPSBtZXRhLmNoYW5nZURldGVjdGlvbjtcblxuICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgY29uc3RhbnRQb29sLCBCaW5kaW5nU2NvcGUuUk9PVF9TQ09QRSwgMCwgdGVtcGxhdGVUeXBlTmFtZSwgbnVsbCwgbnVsbCwgdGVtcGxhdGVOYW1lLFxuICAgICAgZGlyZWN0aXZlTWF0Y2hlciwgZGlyZWN0aXZlc1VzZWQsIG1ldGEucGlwZXMsIHBpcGVzVXNlZCwgUjMubmFtZXNwYWNlSFRNTCxcbiAgICAgIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzKTtcblxuICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbiA9IHRlbXBsYXRlQnVpbGRlci5idWlsZFRlbXBsYXRlRnVuY3Rpb24odGVtcGxhdGUubm9kZXMsIFtdKTtcblxuICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgdGhpcyBzbyB0aGF0IGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjb21wb25lbnRzIGtub3cgd2hhdFxuICAvLyBwcm9qZWN0ZWQgY29udGVudCBibG9ja3MgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBjb21wb25lbnQgd2hlbiBpdCBpcyBpbnN0YW50aWF0ZWQuXG4gIGNvbnN0IG5nQ29udGVudFNlbGVjdG9ycyA9IHRlbXBsYXRlQnVpbGRlci5nZXROZ0NvbnRlbnRTZWxlY3RvcnMoKTtcbiAgaWYgKG5nQ29udGVudFNlbGVjdG9ycykge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCduZ0NvbnRlbnRTZWxlY3RvcnMnLCBuZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICB9XG5cbiAgLy8gZS5nLiBgY29uc3RzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRDb25zdENvdW50KCkpKTtcblxuICAvLyBlLmcuIGB2YXJzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0VmFyQ291bnQoKSkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcblxuICAvLyBlLmcuIGBkaXJlY3RpdmVzOiBbTXlEaXJlY3RpdmVdYFxuICBpZiAoZGlyZWN0aXZlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBkaXJlY3RpdmVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20oZGlyZWN0aXZlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBkaXJlY3RpdmVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZGlyZWN0aXZlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgZGlyZWN0aXZlc0V4cHIpO1xuICB9XG5cbiAgLy8gZS5nLiBgcGlwZXM6IFtNeVBpcGVdYFxuICBpZiAocGlwZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgcGlwZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShwaXBlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBwaXBlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHBpcGVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgcGlwZXNFeHByKTtcbiAgfVxuXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IG51bGwpIHtcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgLy8gZS5nLiBgc3R5bGVzOiBbc3RyMSwgc3RyMl1gXG4gIGlmIChtZXRhLnN0eWxlcyAmJiBtZXRhLnN0eWxlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdHlsZVZhbHVlcyA9IG1ldGEuZW5jYXBzdWxhdGlvbiA9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkID9cbiAgICAgICAgY29tcGlsZVN0eWxlcyhtZXRhLnN0eWxlcywgQ09OVEVOVF9BVFRSLCBIT1NUX0FUVFIpIDpcbiAgICAgICAgbWV0YS5zdHlsZXM7XG4gICAgY29uc3Qgc3RyaW5ncyA9IHN0eWxlVmFsdWVzLm1hcChzdHIgPT4gby5saXRlcmFsKHN0cikpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3RyaW5ncykpO1xuICB9IGVsc2UgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIHN0eWxlLCBkb24ndCBnZW5lcmF0ZSBjc3Mgc2VsZWN0b3JzIG9uIGVsZW1lbnRzXG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5Ob25lO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdmlldyBlbmNhcHN1bGF0aW9uIGlmIGl0J3Mgbm90IHRoZSBkZWZhdWx0IHZhbHVlXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZW5jYXBzdWxhdGlvbicsIG8ubGl0ZXJhbChtZXRhLmVuY2Fwc3VsYXRpb24pKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGFuaW1hdGlvbjogW3RyaWdnZXIoJzEyMycsIFtdKV1gXG4gIGlmIChtZXRhLmFuaW1hdGlvbnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2RhdGEnLCBvLmxpdGVyYWxNYXAoW3trZXk6ICdhbmltYXRpb24nLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIGZsYWcgaWYgaXQncyBkZWZpbmVkIGFuZCBpdCdzIG5vdCB0aGUgZGVmYXVsdC5cbiAgaWYgKGNoYW5nZURldGVjdGlvbiAhPSBudWxsICYmIGNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NoYW5nZURldGVjdGlvbicsIG8ubGl0ZXJhbChjaGFuZ2VEZXRlY3Rpb24pKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7bm9kZXM6IHJlbmRlcjNBc3Qubm9kZXN9LFxuICAgIGRpcmVjdGl2ZXM6IFtdLFxuICAgIHBpcGVzOiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKHBpcGVUeXBlQnlOYW1lLCBvdXRwdXRDdHgpLFxuICAgIHZpZXdRdWVyaWVzOiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudC52aWV3UXVlcmllcywgb3V0cHV0Q3R4KSxcbiAgICB3cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlOiBmYWxzZSxcbiAgICBzdHlsZXM6IChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuc3R5bGVzKSB8fCBFTVBUWV9BUlJBWSxcbiAgICBlbmNhcHN1bGF0aW9uOlxuICAgICAgICAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pIHx8IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbjogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICBhbmltYXRpb25zOiBudWxsLFxuICAgIHZpZXdQcm92aWRlcnM6XG4gICAgICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LnZpZXdQcm92aWRlcnMpIDogbnVsbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIC8vIFRoZSBnbG9iYWwtYW5hbHlzaXMgYmFzZWQgSXZ5IG1vZGUgaW4gbmdjIGlzIG5vIGxvbmdlciB1dGlsaXplZC9zdXBwb3J0ZWQuXG4gIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQnKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlUXVlcnlNZXRhZGF0YWAgaW50byBgUjNRdWVyeU1ldGFkYXRhYC5cbiAqL1xuZnVuY3Rpb24gcXVlcmllc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBSM1F1ZXJ5TWV0YWRhdGFbXSB7XG4gIHJldHVybiBxdWVyaWVzLm1hcChxdWVyeSA9PiB7XG4gICAgbGV0IHJlYWQ6IG8uRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAocXVlcnkucmVhZCAmJiBxdWVyeS5yZWFkLmlkZW50aWZpZXIpIHtcbiAgICAgIHJlYWQgPSBvdXRwdXRDdHguaW1wb3J0RXhwcihxdWVyeS5yZWFkLmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHByb3BlcnR5TmFtZTogcXVlcnkucHJvcGVydHlOYW1lLFxuICAgICAgZmlyc3Q6IHF1ZXJ5LmZpcnN0LFxuICAgICAgcHJlZGljYXRlOiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEocXVlcnkuc2VsZWN0b3JzLCBvdXRwdXRDdHgpLFxuICAgICAgZGVzY2VuZGFudHM6IHF1ZXJ5LmRlc2NlbmRhbnRzLCByZWFkLFxuICAgICAgc3RhdGljOiAhIXF1ZXJ5LnN0YXRpY1xuICAgIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVUb2tlbk1ldGFkYXRhYCBmb3IgcXVlcnkgc2VsZWN0b3JzIGludG8gZWl0aGVyIGFuIGV4cHJlc3Npb24gZm9yIGEgcHJlZGljYXRlXG4gKiB0eXBlLCBvciBhIGxpc3Qgb2Ygc3RyaW5nIHByZWRpY2F0ZXMuXG4gKi9cbmZ1bmN0aW9uIHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShcbiAgICBzZWxlY3RvcnM6IENvbXBpbGVUb2tlbk1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IG8uRXhwcmVzc2lvbnxzdHJpbmdbXSB7XG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMSB8fCAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxICYmIHNlbGVjdG9yc1swXS52YWx1ZSkpIHtcbiAgICBjb25zdCBzZWxlY3RvclN0cmluZ3MgPSBzZWxlY3RvcnMubWFwKHZhbHVlID0+IHZhbHVlLnZhbHVlIGFzIHN0cmluZyk7XG4gICAgc2VsZWN0b3JTdHJpbmdzLnNvbWUodmFsdWUgPT4gIXZhbHVlKSAmJlxuICAgICAgICBlcnJvcignRm91bmQgYSB0eXBlIGFtb25nIHRoZSBzdHJpbmcgc2VsZWN0b3JzIGV4cGVjdGVkJyk7XG4gICAgcmV0dXJuIG91dHB1dEN0eC5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JTdHJpbmdzLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpO1xuICB9XG5cbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSkge1xuICAgIGNvbnN0IGZpcnN0ID0gc2VsZWN0b3JzWzBdO1xuICAgIGlmIChmaXJzdC5pZGVudGlmaWVyKSB7XG4gICAgICByZXR1cm4gb3V0cHV0Q3R4LmltcG9ydEV4cHIoZmlyc3QuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgfVxuXG4gIGVycm9yKCdVbmV4cGVjdGVkIHF1ZXJ5IGZvcm0nKTtcbiAgcmV0dXJuIG8uTlVMTF9FWFBSO1xufVxuXG5mdW5jdGlvbiBwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCksXG4gICAgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzKSxcbiAgICBxdWVyeS5yZWFkIHx8IG8ubGl0ZXJhbChudWxsKSxcbiAgXTtcbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbi8vIFR1cm4gYSBkaXJlY3RpdmUgc2VsZWN0b3IgaW50byBhbiBSMy1jb21wYXRpYmxlIHNlbGVjdG9yIGZvciBkaXJlY3RpdmUgZGVmXG5mdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nIHwgbnVsbCk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBhc0xpdGVyYWwoY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHNlbGVjdG9yKSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdGVtcEFsbG9jYXRvciA9IHRlbXBvcmFyeUFsbG9jYXRvcih1cGRhdGVTdGF0ZW1lbnRzLCBURU1QT1JBUllfTkFNRSk7XG5cbiAgZm9yIChjb25zdCBxdWVyeSBvZiBtZXRhLnF1ZXJpZXMpIHtcbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5jb250ZW50UXVlcnkoZGlySW5kZXgsIHNvbWVQcmVkaWNhdGUsIHRydWUsIG51bGwpO1xuICAgIGNvbnN0IGFyZ3MgPSBbby52YXJpYWJsZSgnZGlySW5kZXgnKSwgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpIGFzIGFueV07XG5cbiAgICBjb25zdCBxdWVyeUluc3RydWN0aW9uID0gcXVlcnkuc3RhdGljID8gUjMuc3RhdGljQ29udGVudFF1ZXJ5IDogUjMuY29udGVudFF1ZXJ5O1xuXG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihxdWVyeUluc3RydWN0aW9uKS5jYWxsRm4oYXJncykudG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZENvbnRlbnRRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRDb250ZW50UXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCBjb250ZW50UXVlcmllc0ZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNUeXBlKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdfSk6IG8uVHlwZSB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogc3RyaW5nW10pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHlwZUZvckRlZihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCB0eXBlQmFzZTogby5FeHRlcm5hbFJlZmVyZW5jZSk6IG8uVHlwZSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIodHlwZUJhc2UsIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5leHBvcnRBcykgOiBvLk5PTkVfVFlQRSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5pbnB1dHMpLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLm91dHB1dHMpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdKSk7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24oXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdGVtcEFsbG9jYXRvciA9IHRlbXBvcmFyeUFsbG9jYXRvcih1cGRhdGVTdGF0ZW1lbnRzLCBURU1QT1JBUllfTkFNRSk7XG5cbiAgbWV0YS52aWV3UXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgY29uc3QgcXVlcnlJbnN0cnVjdGlvbiA9IHF1ZXJ5LnN0YXRpYyA/IFIzLnN0YXRpY1ZpZXdRdWVyeSA6IFIzLnZpZXdRdWVyeTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLnZpZXdRdWVyeShzb21lUHJlZGljYXRlLCB0cnVlKTtcbiAgICBjb25zdCBxdWVyeURlZmluaXRpb24gPVxuICAgICAgICBvLmltcG9ydEV4cHIocXVlcnlJbnN0cnVjdGlvbikuY2FsbEZuKHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKHF1ZXJ5RGVmaW5pdGlvbi50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkVmlld1F1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFZpZXdRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfSk7XG5cbiAgY29uc3Qgdmlld1F1ZXJ5Rm5OYW1lID0gbWV0YS5uYW1lID8gYCR7bWV0YS5uYW1lfV9RdWVyeWAgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHZpZXdRdWVyeUZuTmFtZSk7XG59XG5cbi8vIFJldHVybiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgZWxWYXJFeHA6IG8uUmVhZFZhckV4cHIsIGJpbmRpbmdDb250ZXh0OiBvLlJlYWRWYXJFeHByLFxuICAgIHN0YXRpY0F0dHJpYnV0ZXNBbmRWYWx1ZXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSwgc3R5bGVCdWlsZGVyOiBTdHlsaW5nQnVpbGRlcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgaG9zdFZhcnNDb3VudDogbnVtYmVyKTogby5FeHByZXNzaW9ufFxuICAgIG51bGwge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gaG9zdFZhcnNDb3VudDtcbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gbWV0YS50eXBlU291cmNlU3BhbjtcbiAgY29uc3QgZGlyZWN0aXZlU3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGEpO1xuXG4gIGxldCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIGNvbnN0IGdldFZhbHVlQ29udmVydGVyID0gKCkgPT4ge1xuICAgIGlmICghdmFsdWVDb252ZXJ0ZXIpIHtcbiAgICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxWYXJzQ291bnQgPSB0b3RhbEhvc3RWYXJzQ291bnQ7XG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsVmFyc0NvdW50O1xuICAgICAgfTtcbiAgICAgIHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksICAvLyBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgICAgICAgIGhvc3RWYXJzQ291bnRGbixcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpOyAgLy8gcGlwZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVDb252ZXJ0ZXI7XG4gIH07XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBjcmVhdGVIb3N0TGlzdGVuZXJzKGJpbmRpbmdDb250ZXh0LCBldmVudEJpbmRpbmdzLCBtZXRhKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goLi4ubGlzdGVuZXJzKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBiaW5kaW5ncyA9IGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICAoYmluZGluZ3MgfHwgW10pLmZvckVhY2goKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPVxuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKG5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgYmluZGluZy5zb3VyY2VTcGFuKTtcbiAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdChnZXRWYWx1ZUNvbnZlcnRlcigpKTtcbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZyk7XG5cbiAgICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhtZXRhLnNlbGVjdG9yIHx8ICcnLCBiaW5kaW5nTmFtZSwgaXNBdHRyaWJ1dGUpXG4gICAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBjb3JlLlNlY3VyaXR5Q29udGV4dC5OT05FKTtcblxuICAgICAgbGV0IHNhbml0aXplckZuOiBvLkV4dGVybmFsRXhwcnxudWxsID0gbnVsbDtcbiAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCkge1xuICAgICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkwpID4gLTEgJiZcbiAgICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwpID4gLTEpIHtcbiAgICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHNvbWUgVVJMIGF0dHJpYnV0ZXMgKHN1Y2ggYXMgXCJzcmNcIiBhbmQgXCJocmVmXCIpIHRoYXQgbWF5IGJlIGEgcGFydFxuICAgICAgICAgIC8vIG9mIGRpZmZlcmVudCBzZWN1cml0eSBjb250ZXh0cy4gSW4gdGhpcyBjYXNlIHdlIHVzZSBzcGVjaWFsIHNhbnRpdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgICAgLy8gc2VsZWN0IHRoZSBhY3R1YWwgc2FuaXRpemVyIGF0IHJ1bnRpbWUgYmFzZWQgb24gYSB0YWcgbmFtZSB0aGF0IGlzIHByb3ZpZGVkIHdoaWxlXG4gICAgICAgICAgLy8gaW52b2tpbmcgc2FuaXRpemF0aW9uIGZ1bmN0aW9uLlxuICAgICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2FuaXRpemVyRm4gPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oc2VjdXJpdHlDb250ZXh0c1swXSwgaXNBdHRyaWJ1dGUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtcbiAgICAgICAgZWxWYXJFeHAsIG8ubGl0ZXJhbChiaW5kaW5nTmFtZSksIG8uaW1wb3J0RXhwcihSMy5iaW5kKS5jYWxsRm4oW2JpbmRpbmdFeHByLmN1cnJWYWxFeHByXSlcbiAgICAgIF07XG4gICAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChzYW5pdGl6ZXJGbik7XG4gICAgICB9XG4gICAgICBpZiAoIWlzQXR0cmlidXRlKSB7XG4gICAgICAgIGlmICghc2FuaXRpemVyRm4pIHtcbiAgICAgICAgICAvLyBhcHBlbmQgYG51bGxgIGluIGZyb250IG9mIGBuYXRpdmVPbmx5YCBmbGFnIGlmIG5vIHNhbml0aXplciBmbiBkZWZpbmVkXG4gICAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGhvc3QgYmluZGluZ3MgbXVzdCBoYXZlIG5hdGl2ZU9ubHkgcHJvcCBzZXQgdG8gdHJ1ZVxuICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8ubGl0ZXJhbCh0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oaW5zdHJ1Y3Rpb25QYXJhbXMpLnRvU3RtdCgpKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhzdGF0aWNBdHRyaWJ1dGVzQW5kVmFsdWVzKTtcbiAgY29uc3QgaG9zdEluc3RydWN0aW9uID0gc3R5bGVCdWlsZGVyLmJ1aWxkSG9zdEF0dHJzSW5zdHJ1Y3Rpb24obnVsbCwgaG9zdEF0dHJzLCBjb25zdGFudFBvb2wpO1xuICBpZiAoaG9zdEluc3RydWN0aW9uKSB7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKGNyZWF0ZVN0eWxpbmdTdG10KGhvc3RJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICB9XG5cbiAgaWYgKHN0eWxlQnVpbGRlci5oYXNCaW5kaW5ncykge1xuICAgIC8vIHNpbmd1bGFyIHN0eWxlL2NsYXNzIGJpbmRpbmdzICh0aGluZ3MgbGlrZSBgW3N0eWxlLnByb3BdYCBhbmQgYFtjbGFzcy5uYW1lXWApXG4gICAgLy8gTVVTVCBiZSByZWdpc3RlcmVkIG9uIGEgZ2l2ZW4gZWxlbWVudCB3aXRoaW4gdGhlIGNvbXBvbmVudC9kaXJlY3RpdmVcbiAgICAvLyB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIGZ1bmN0aW9ucy4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgZmlndXJlIG91dFxuICAgIC8vIHdoYXQgYWxsIHRoZSBiaW5kaW5ncyBhcmUgYW5kIHRoZW4gZ2VuZXJhdGUgdGhlIHN0YXRlbWVudHMgcmVxdWlyZWQgdG8gcmVnaXN0ZXJcbiAgICAvLyB0aG9zZSBiaW5kaW5ncyB0byB0aGUgZWxlbWVudCB2aWEgYGVsZW1lbnRTdHlsaW5nYC5cbiAgICBjb25zdCBlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uID1cbiAgICAgICAgc3R5bGVCdWlsZGVyLmJ1aWxkRWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbihudWxsLCBjb25zdGFudFBvb2wpO1xuICAgIGlmIChlbGVtZW50U3R5bGluZ0luc3RydWN0aW9uKSB7XG4gICAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgY3JlYXRlU3R5bGluZ1N0bXQoZWxlbWVudFN0eWxpbmdJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgIH1cblxuICAgIC8vIGZpbmFsbHkgZWFjaCBiaW5kaW5nIHRoYXQgd2FzIHJlZ2lzdGVyZWQgaW4gdGhlIHN0YXRlbWVudCBhYm92ZSB3aWxsIG5lZWQgdG8gYmUgYWRkZWQgdG9cbiAgICAvLyB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgY29tcG9uZW50L2RpcmVjdGl2ZSB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIHNvIHRoYXQgdGhlIGJpbmRpbmdzXG4gICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgc3R5bGVCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnMoZ2V0VmFsdWVDb252ZXJ0ZXIoKSkuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goY3JlYXRlU3R5bGluZ1N0bXQoaW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnVuc2hpZnQoXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5hbGxvY0hvc3RWYXJzKS5jYWxsRm4oW28ubGl0ZXJhbCh0b3RhbEhvc3RWYXJzQ291bnQpXSkudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCB8fCB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKSxcbiAgICAgICAgICBuZXcgby5GblBhcmFtKGVsVmFyRXhwLm5hbWUgISwgby5OVU1CRVJfVFlQRSlcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNUKSB7XG4gIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgbnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSwgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3R5bGluZ1N0bXQoXG4gICAgaW5zdHJ1Y3Rpb246IEluc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBudWxsLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLmNhbGxGbihwYXJhbXMsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4pXG4gICAgICAudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24gITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50QXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmNvbXBvbmVudEhvc3RTeW50aGV0aWNQcm9wZXJ0eTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50UHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhcbiAgICBiaW5kaW5nQ29udGV4dDogby5FeHByZXNzaW9uLCBldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlN0YXRlbWVudFtdIHtcbiAgcmV0dXJuIGV2ZW50QmluZGluZ3MubWFwKGJpbmRpbmcgPT4ge1xuICAgIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoYmluZGluZy5uYW1lKTtcbiAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gYmluZGluZy50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGJpbmRpbmdOYW1lLCBiaW5kaW5nLnRhcmdldE9yUGhhc2UpIDpcbiAgICAgICAgYmluZGluZ05hbWU7XG4gICAgY29uc3QgaGFuZGxlck5hbWUgPVxuICAgICAgICBtZXRhLm5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHttZXRhLm5hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKFxuICAgICAgICBCb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChiaW5kaW5nKSwgYmluZGluZ0NvbnRleHQsIGhhbmRsZXJOYW1lKTtcbiAgICBjb25zdCBpbnN0cnVjdGlvbiA9XG4gICAgICAgIGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID8gUjMuY29tcG9uZW50SG9zdFN5bnRoZXRpY0xpc3RlbmVyIDogUjMubGlzdGVuZXI7XG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihpbnN0cnVjdGlvbikuY2FsbEZuKHBhcmFtcykudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgLy8gVGhpcyBpcyB1c2VkIGJ5IHRoZSBCaW5kaW5nUGFyc2VyLCB3aGljaCBvbmx5IGRlYWxzIHdpdGggbGlzdGVuZXJzIGFuZCBwcm9wZXJ0aWVzLiBUaGVyZSdzIG5vXG4gICAgLy8gbmVlZCB0byBwYXNzIGF0dHJpYnV0ZXMgdG8gaXQuXG4gICAgaG9zdEF0dHJpYnV0ZXM6IHt9LFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuLy8gRGVmaW5lcyBIb3N0IEJpbmRpbmdzIHN0cnVjdHVyZSB0aGF0IGNvbnRhaW5zIGF0dHJpYnV0ZXMsIGxpc3RlbmVycywgYW5kIHByb3BlcnRpZXMsXG4vLyBwYXJzZWQgZnJvbSB0aGUgYGhvc3RgIG9iamVjdCBkZWZpbmVkIGZvciBhIFR5cGUuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IG8uRXhwcmVzc2lvbn0pOlxuICAgIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gIGNvbnN0IGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3Qgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9ID0ge307XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoaG9zdCkpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG5cbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENsYXNzIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHlsZSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSBvLmxpdGVyYWwodmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ10gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmVudCBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgc3BlY2lhbEF0dHJpYnV0ZXN9O1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIGhvc3QgYmluZGluZ3MgYW5kIHJldHVybnMgdGhlIGxpc3Qgb2YgZXJyb3JzIChpZiBhbnkpLiBFbXB0eSBhcnJheSBpbmRpY2F0ZXMgdGhhdCBhXG4gKiBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncyBoYXMgbm8gZXJyb3JzLlxuICpcbiAqIEBwYXJhbSBiaW5kaW5ncyBzZXQgb2YgaG9zdCBiaW5kaW5ncyB0byB2ZXJpZnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBzb3VyY2Ugc3BhbiB3aGVyZSBob3N0IGJpbmRpbmdzIHdlcmUgZGVmaW5lZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIGVycm9ycyBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUhvc3RCaW5kaW5ncyhcbiAgICBiaW5kaW5nczogUGFyc2VkSG9zdEJpbmRpbmdzLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBQYXJzZUVycm9yW10ge1xuICBjb25zdCBzdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkoeyBob3N0OiBiaW5kaW5ncyB9IGFzIGFueSk7XG4gIC8vIFRPRE86IGFic3RyYWN0IG91dCBob3N0IGJpbmRpbmdzIHZlcmlmaWNhdGlvbiBsb2dpYyBhbmQgdXNlIGl0IGluc3RlYWQgb2ZcbiAgLy8gY3JlYXRpbmcgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIEFTVHMgdG8gZGV0ZWN0IGVycm9ycyAoRlctOTk2KVxuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKHN1bW1hcnksIHNvdXJjZVNwYW4pO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLmVycm9ycztcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7IHJldHVybiBzaGFkb3dDc3MgIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7IH0pO1xufVxuIl19