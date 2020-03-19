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
import { R3FactoryTarget, compileFactoryFunction } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { prepareSyntheticListenerFunctionName, prepareSyntheticPropertyName, typeWithParameters } from '../util';
import { MIN_STYLING_BINDING_SLOTS_REQUIRED, StylingBuilder } from './styling_builder';
import { BindingScope, TemplateDefinitionBuilder, ValueConverter, makeBindingParser, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, chainedInstruction, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
const EMPTY_ARRAY = [];
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
const ATTR_REGEX = /attr\.([^\]]+)/;
function baseDirectiveFields(meta, constantPool, bindingParser) {
    const definitionMap = new DefinitionMap();
    const selectors = core.parseSelectorToR3Selector(meta.selector);
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
        definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(e => o.literal(e))));
    }
    return definitionMap;
}
/**
 * Add features to the definition map.
 */
function addFeatures(definitionMap, meta) {
    // e.g. `features: [NgOnChangesFeature]`
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
    const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
    addFeatures(definitionMap, meta);
    const expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    const type = createTypeForDef(meta, R3.DirectiveDefWithMeta);
    return { expression, type };
}
/**
 * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
 */
export function compileComponentFromMetadata(meta, constantPool, bindingParser) {
    const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
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
    // e.g. `decls: 2`
    definitionMap.set('decls', o.literal(templateBuilder.getConstCount()));
    // e.g. `vars: 2`
    definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
    // e.g. `consts: [['one', 'two'], ['three', 'four']]
    const consts = templateBuilder.getConsts();
    if (consts.length > 0) {
        definitionMap.set('consts', o.literalArr(consts));
    }
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
    const expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()]);
    const type = createTypeForDef(meta, R3.ComponentDefWithMeta);
    return { expression, type };
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
    const factoryRes = compileFactoryFunction(Object.assign(Object.assign({}, meta), { injectFn: R3.directiveInject, target: R3FactoryTarget.Directive }));
    const ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
    const directiveDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
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
    const name = identifierName(component.type);
    name || error(`Cannot resolver the name of ${component.type}`);
    const definitionField = outputCtx.constantPool.propertyNameOf(2 /* Component */);
    const summary = component.toSummary();
    // Compute the R3ComponentMetadata from the CompileDirectiveMetadata
    const meta = Object.assign(Object.assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector)), { selector: component.selector, template: { nodes: render3Ast.nodes }, directives: [], pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesAndPipesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, interpolation: DEFAULT_INTERPOLATION_CONFIG, animations: null, viewProviders: component.viewProviders.length > 0 ? new o.WrappedNodeExpr(component.viewProviders) : null, relativeContextFilePath: '', i18nUseExternalIds: true });
    const res = compileComponentFromMetadata(meta, outputCtx.constantPool, bindingParser);
    const factoryRes = compileFactoryFunction(Object.assign(Object.assign({}, meta), { injectFn: R3.directiveInject, target: R3FactoryTarget.Directive }));
    const ngFactoryDefStatement = new o.ClassStmt(name, null, [new o.ClassField('ɵfac', o.INFERRED_TYPE, [o.StmtModifier.Static], factoryRes.factory)], [], new o.ClassMethod(null, [], []), []);
    const componentDefStatement = new o.ClassStmt(name, null, [new o.ClassField(definitionField, o.INFERRED_TYPE, [o.StmtModifier.Static], res.expression)], [], new o.ClassMethod(null, [], []), []);
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
    const parameters = [getQueryPredicate(query, constantPool), o.literal(query.descendants)];
    if (query.read) {
        parameters.push(query.read);
    }
    return parameters;
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
function createContentQueriesFunction(queries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    for (const query of queries) {
        const queryInstruction = query.static ? R3.staticContentQuery : R3.contentQuery;
        // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
        createStatements.push(o.importExpr(queryInstruction)
            .callFn([o.variable('dirIndex'), ...prepareQueryParams(query, constantPool)])
            .toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
        const temporary = tempAllocator();
        const getQueryList = o.importExpr(R3.loadQuery).callFn([]);
        const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        const updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    }
    const contentQueriesFnName = name ? `${name}_ContentQueries` : null;
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
    const selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;
    return o.expressionType(o.importExpr(typeBase, [
        typeWithParameters(meta.type.type, meta.typeArgumentCount),
        selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
        meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
        stringMapAsType(meta.inputs),
        stringMapAsType(meta.outputs),
        stringArrayAsType(meta.queries.map(q => q.propertyName)),
    ]));
}
// Define and update any view queries
function createViewQueriesFunction(viewQueries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    viewQueries.forEach((query) => {
        const queryInstruction = query.static ? R3.staticViewQuery : R3.viewQuery;
        // creation, e.g. r3.viewQuery(somePredicate, true);
        const queryDefinition = o.importExpr(queryInstruction).callFn(prepareQueryParams(query, constantPool));
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
        const temporary = tempAllocator();
        const getQueryList = o.importExpr(R3.loadQuery).callFn([]);
        const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        const updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    });
    const viewQueryFnName = name ? `${name}_Query` : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
    const bindingContext = o.variable(CONTEXT_NAME);
    const styleBuilder = new StylingBuilder(bindingContext);
    const { styleAttr, classAttr } = hostBindingsMetadata.specialAttributes;
    if (styleAttr !== undefined) {
        styleBuilder.registerStyleAttr(styleAttr);
    }
    if (classAttr !== undefined) {
        styleBuilder.registerClassAttr(classAttr);
    }
    const createStatements = [];
    const updateStatements = [];
    const hostBindingSourceSpan = typeSourceSpan;
    const directiveSummary = metadataAsSummary(hostBindingsMetadata);
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings && eventBindings.length) {
        const listeners = createHostListeners(eventBindings, name);
        createStatements.push(...listeners);
    }
    // Calculate the host property bindings
    const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    const allOtherBindings = [];
    // We need to calculate the total amount of binding slots required by
    // all the instructions together before any value conversions happen.
    // Value conversions may require additional slots for interpolation and
    // bindings with pipes. These calculates happen after this block.
    let totalHostVarsCount = 0;
    bindings && bindings.forEach((binding) => {
        const name = binding.name;
        const stylingInputWasSet = styleBuilder.registerInputBasedOnName(name, binding.expression, binding.sourceSpan);
        if (stylingInputWasSet) {
            totalHostVarsCount += MIN_STYLING_BINDING_SLOTS_REQUIRED;
        }
        else {
            allOtherBindings.push(binding);
            totalHostVarsCount++;
        }
    });
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
    const propertyBindings = [];
    const attributeBindings = [];
    const syntheticHostBindings = [];
    allOtherBindings.forEach((binding) => {
        // resolve literal arrays and literal objects
        const value = binding.expression.visit(getValueConverter());
        const bindingExpr = bindingFn(bindingContext, value);
        const { bindingName, instruction, isAttribute } = getBindingNameAndInstruction(binding);
        const securityContexts = bindingParser.calcPossibleSecurityContexts(selector, bindingName, isAttribute)
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
        const instructionParams = [o.literal(bindingName), bindingExpr.currValExpr];
        if (sanitizerFn) {
            instructionParams.push(sanitizerFn);
        }
        updateStatements.push(...bindingExpr.stmts);
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
    const hostAttrs = convertAttributesToExpressions(hostBindingsMetadata.attributes);
    styleBuilder.assignHostAttrs(hostAttrs, definitionMap);
    if (styleBuilder.hasBindings) {
        // finally each binding that was registered in the statement above will need to be added to
        // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
        // are evaluated and updated for the element.
        styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(instruction => {
            if (instruction.calls.length > 0) {
                const calls = [];
                instruction.calls.forEach(call => {
                    // we subtract a value of `1` here because the binding slot was already allocated
                    // at the top of this method when all the input bindings were counted.
                    totalHostVarsCount +=
                        Math.max(call.allocateBindingSlots - MIN_STYLING_BINDING_SLOTS_REQUIRED, 0);
                    calls.push(convertStylingCall(call, bindingContext, bindingFn));
                });
                updateStatements.push(chainedInstruction(instruction.reference, calls).toStmt());
            }
        });
    }
    if (totalHostVarsCount) {
        definitionMap.set('hostVars', o.literal(totalHostVarsCount));
    }
    if (createStatements.length > 0 || updateStatements.length > 0) {
        const hostBindingsFnName = name ? `${name}_HostBindings` : null;
        const statements = [];
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
    return convertPropertyBinding(null, implicit, value, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
}
function convertStylingCall(call, bindingContext, bindingFn) {
    return call.params(value => bindingFn(bindingContext, value).currValExpr);
}
function getBindingNameAndInstruction(binding) {
    let bindingName = binding.name;
    let instruction;
    // Check to see if this is an attr binding or a property binding
    const attrMatches = bindingName.match(ATTR_REGEX);
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
    return { bindingName, instruction, isAttribute: !!attrMatches };
}
function createHostListeners(eventBindings, name) {
    const listeners = [];
    const syntheticListeners = [];
    const instructions = [];
    eventBindings.forEach(binding => {
        let bindingName = binding.name && sanitizeIdentifier(binding.name);
        const bindingFnName = binding.type === 1 /* Animation */ ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        const handlerName = name && bindingName ? `${name}_${bindingFnName}_HostBindingHandler` : null;
        const params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), handlerName);
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
    const summary = metadataAsSummary(bindings);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBZ0csY0FBYyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFDLFdBQVcsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRTdGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUU3RCxPQUFPLEVBQWdCLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNoRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxlQUFlLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDdEUsT0FBTyxFQUFDLFdBQVcsSUFBSSxFQUFFLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsb0NBQW9DLEVBQUUsNEJBQTRCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFHL0csT0FBTyxFQUFDLGtDQUFrQyxFQUFFLGNBQWMsRUFBeUIsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RyxPQUFPLEVBQUMsWUFBWSxFQUFFLHlCQUF5QixFQUFF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QUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3BEO0tBQ0Y7SUFFRCxPQUFPLEVBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FDOUIsUUFBNEIsRUFBRSxVQUEyQjtJQUMzRCxNQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM1Qyw0RUFBNEU7SUFDNUUsZ0VBQWdFO0lBQ2hFLE1BQU0sYUFBYSxHQUFHLGlCQUFpQixFQUFFLENBQUM7SUFDMUMsYUFBYSxDQUFDLDRCQUE0QixDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNoRSxhQUFhLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzdELE9BQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQztBQUM5QixDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsTUFBZ0IsRUFBRSxRQUFnQixFQUFFLFlBQW9CO0lBQzdFLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7SUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsT0FBTyxTQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7U2hhZG93Q3NzfSBmcm9tICcuLi8uLi9zaGFkb3dfY3NzJztcbmltcG9ydCB7Q09OVEVOVF9BVFRSLCBIT1NUX0FUVFJ9IGZyb20gJy4uLy4uL3N0eWxlX2NvbXBpbGVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dCwgZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtSM0ZhY3RvcnlUYXJnZXQsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb259IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSZW5kZXIzUGFyc2VSZXN1bHR9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZSwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7TUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRCwgU3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbkNhbGx9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlciwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm59IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY2hhaW5lZEluc3RydWN0aW9uLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgZ2V0UXVlcnlQcmVkaWNhdGUsIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfQVJSQVk6IGFueVtdID0gW107XG5cbi8vIFRoaXMgcmVnZXggbWF0Y2hlcyBhbnkgYmluZGluZyBuYW1lcyB0aGF0IGNvbnRhaW4gdGhlIFwiYXR0ci5cIiBwcmVmaXgsIGUuZy4gXCJhdHRyLnJlcXVpcmVkXCJcbi8vIElmIHRoZXJlIGlzIGEgbWF0Y2gsIHRoZSBmaXJzdCBtYXRjaGluZyBncm91cCB3aWxsIGNvbnRhaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHRvIGJpbmQuXG5jb25zdCBBVFRSX1JFR0VYID0gL2F0dHJcXC4oW15cXF1dKykvO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGNvbnN0IHNlbGVjdG9ycyA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihtZXRhLnNlbGVjdG9yKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBhc0xpdGVyYWwoc2VsZWN0b3JzKSk7XG4gIH1cblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBlLmcuIGBjb250ZW50UXVlcmllczogKHJmLCBjdHgsIGRpckluZGV4KSA9PiB7IC4uLiB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YS5xdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEudmlld1F1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChyZiwgY3R4KSA9PiB7IC4uLiB9XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2hvc3RCaW5kaW5ncycsIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhLmhvc3QsIG1ldGEudHlwZVNvdXJjZVNwYW4sIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YS5zZWxlY3RvciB8fCAnJywgbWV0YS5uYW1lLCBkZWZpbml0aW9uTWFwKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMsIHRydWUpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSB8IFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGEpLnZpZXdQcm92aWRlcnM7XG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICBpZiAoZmVhdHVyZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZlYXR1cmVzJywgby5saXRlcmFsQXJyKGZlYXR1cmVzKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzRGlyZWN0aXZlRGVmIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBjb25zdCB0eXBlID0gY3JlYXRlVHlwZUZvckRlZihtZXRhLCBSMy5EaXJlY3RpdmVEZWZXaXRoTWV0YSk7XG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvckF0dHJpYnV0ZXMubWFwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gdmFsdWUgIT0gbnVsbCA/IG8ubGl0ZXJhbCh2YWx1ZSkgOiBvLmxpdGVyYWwodW5kZWZpbmVkKSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAvKiBmb3JjZVNoYXJlZCAqLyB0cnVlKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgdGhlIENTUyBtYXRjaGVyIHRoYXQgcmVjb2duaXplIGRpcmVjdGl2ZVxuICBsZXQgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwgPSBudWxsO1xuXG4gIGlmIChtZXRhLmRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyKCk7XG4gICAgZm9yIChjb25zdCB7c2VsZWN0b3IsIGV4cHJlc3Npb259IG9mIG1ldGEuZGlyZWN0aXZlcykge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH1cbiAgICBkaXJlY3RpdmVNYXRjaGVyID0gbWF0Y2hlcjtcbiAgfVxuXG4gIC8vIGUuZy4gYHRlbXBsYXRlOiBmdW5jdGlvbiBNeUNvbXBvbmVudF9UZW1wbGF0ZShfY3R4LCBfY20pIHsuLi59YFxuICBjb25zdCB0ZW1wbGF0ZVR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZVR5cGVOYW1lID8gYCR7dGVtcGxhdGVUeXBlTmFtZX1fVGVtcGxhdGVgIDogbnVsbDtcblxuICBjb25zdCBkaXJlY3RpdmVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBwaXBlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgY2hhbmdlRGV0ZWN0aW9uID0gbWV0YS5jaGFuZ2VEZXRlY3Rpb247XG5cbiAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICBjb25zdCB0ZW1wbGF0ZUJ1aWxkZXIgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLlJPT1RfU0NPUEUsIDAsIHRlbXBsYXRlVHlwZU5hbWUsIG51bGwsIG51bGwsIHRlbXBsYXRlTmFtZSxcbiAgICAgIGRpcmVjdGl2ZU1hdGNoZXIsIGRpcmVjdGl2ZXNVc2VkLCBtZXRhLnBpcGVzLCBwaXBlc1VzZWQsIFIzLm5hbWVzcGFjZUhUTUwsXG4gICAgICBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgLy8gV2UgbmVlZCB0byBwcm92aWRlIHRoaXMgc28gdGhhdCBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY29tcG9uZW50cyBrbm93IHdoYXRcbiAgLy8gcHJvamVjdGVkIGNvbnRlbnQgYmxvY2tzIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgY29tcG9uZW50IHdoZW4gaXQgaXMgaW5zdGFudGlhdGVkLlxuICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnbmdDb250ZW50U2VsZWN0b3JzJywgbmdDb250ZW50U2VsZWN0b3JzKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGRlY2xzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgLy8gZS5nLiBgY29uc3RzOiBbWydvbmUnLCAndHdvJ10sIFsndGhyZWUnLCAnZm91ciddXVxuICBjb25zdCBjb25zdHMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RzKCk7XG4gIGlmIChjb25zdHMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWxBcnIoY29uc3RzKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG5cbiAgLy8gZS5nLiBgZGlyZWN0aXZlczogW015RGlyZWN0aXZlXWBcbiAgaWYgKGRpcmVjdGl2ZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgZGlyZWN0aXZlc0V4cHI6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKGRpcmVjdGl2ZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgZGlyZWN0aXZlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGRpcmVjdGl2ZXNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGRpcmVjdGl2ZXNFeHByKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHBpcGVzOiBbTXlQaXBlXWBcbiAgaWYgKHBpcGVzVXNlZC5zaXplKSB7XG4gICAgbGV0IHBpcGVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20ocGlwZXNVc2VkKSk7XG4gICAgaWYgKG1ldGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSkge1xuICAgICAgcGlwZXNFeHByID0gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChwaXBlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIHBpcGVzRXhwcik7XG4gIH1cblxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBudWxsKSB7XG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZDtcbiAgfVxuXG4gIC8vIGUuZy4gYHN0eWxlczogW3N0cjEsIHN0cjJdYFxuICBpZiAobWV0YS5zdHlsZXMgJiYgbWV0YS5zdHlsZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3R5bGVWYWx1ZXMgPSBtZXRhLmVuY2Fwc3VsYXRpb24gPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCA/XG4gICAgICAgIGNvbXBpbGVTdHlsZXMobWV0YS5zdHlsZXMsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6XG4gICAgICAgIG1ldGEuc3R5bGVzO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBzdHlsZVZhbHVlcy5tYXAoc3RyID0+IG8ubGl0ZXJhbChzdHIpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgby5saXRlcmFsQXJyKHN0cmluZ3MpKTtcbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBPbmx5IHNldCB0aGUgY2hhbmdlIGRldGVjdGlvbiBmbGFnIGlmIGl0J3MgZGVmaW5lZCBhbmQgaXQncyBub3QgdGhlIGRlZmF1bHQuXG4gIGlmIChjaGFuZ2VEZXRlY3Rpb24gIT0gbnVsbCAmJiBjaGFuZ2VEZXRlY3Rpb24gIT09IGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdjaGFuZ2VEZXRlY3Rpb24nLCBvLmxpdGVyYWwoY2hhbmdlRGV0ZWN0aW9uKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oXG4gICAgICB7Li4ubWV0YSwgaW5qZWN0Rm46IFIzLmRpcmVjdGl2ZUluamVjdCwgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuRGlyZWN0aXZlfSk7XG4gIGNvbnN0IG5nRmFjdG9yeURlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZCgnybVmYWMnLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCBmYWN0b3J5UmVzLmZhY3RvcnkpXSwgW10sXG4gICAgICBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSk7XG4gIGNvbnN0IGRpcmVjdGl2ZURlZlN0YXRlbWVudCA9IG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5nRmFjdG9yeURlZlN0YXRlbWVudCwgZGlyZWN0aXZlRGVmU3RhdGVtZW50KTtcbn1cblxuLyoqXG4gKiBBIHdyYXBwZXIgYXJvdW5kIGBjb21waWxlQ29tcG9uZW50YCB3aGljaCBkZXBlbmRzIG9uIHJlbmRlcjIgZ2xvYmFsIGFuYWx5c2lzIGRhdGEgYXMgaXRzIGlucHV0XG4gKiBpbnN0ZWFkIG9mIHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKlxuICogYFIzQ29tcG9uZW50TWV0YWRhdGFgIGlzIGNvbXB1dGVkIGZyb20gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIG90aGVyIHN0YXRpY2FsbHkgcmVmbGVjdGVkXG4gKiBpbmZvcm1hdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tUmVuZGVyMihcbiAgICBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCByZW5kZXIzQXN0OiBSZW5kZXIzUGFyc2VSZXN1bHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBkaXJlY3RpdmVUeXBlQnlTZWw6IE1hcDxzdHJpbmcsIGFueT4sXG4gICAgcGlwZVR5cGVCeU5hbWU6IE1hcDxzdHJpbmcsIGFueT4pIHtcbiAgY29uc3QgbmFtZSA9IGlkZW50aWZpZXJOYW1lKGNvbXBvbmVudC50eXBlKSAhO1xuICBuYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZXIgdGhlIG5hbWUgb2YgJHtjb21wb25lbnQudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLkNvbXBvbmVudCk7XG5cbiAgY29uc3Qgc3VtbWFyeSA9IGNvbXBvbmVudC50b1N1bW1hcnkoKTtcblxuICAvLyBDb21wdXRlIHRoZSBSM0NvbXBvbmVudE1ldGFkYXRhIGZyb20gdGhlIENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YVxuICBjb25zdCBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhID0ge1xuICAgIC4uLmRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudCwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHNlbGVjdG9yOiBjb21wb25lbnQuc2VsZWN0b3IsXG4gICAgdGVtcGxhdGU6IHtub2RlczogcmVuZGVyM0FzdC5ub2Rlc30sXG4gICAgZGlyZWN0aXZlczogW10sXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgIHN0eWxlczogKHN1bW1hcnkudGVtcGxhdGUgJiYgc3VtbWFyeS50ZW1wbGF0ZS5zdHlsZXMpIHx8IEVNUFRZX0FSUkFZLFxuICAgIGVuY2Fwc3VsYXRpb246XG4gICAgICAgIChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuZW5jYXBzdWxhdGlvbikgfHwgY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCxcbiAgICBpbnRlcnBvbGF0aW9uOiBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLFxuICAgIGFuaW1hdGlvbnM6IG51bGwsXG4gICAgdmlld1Byb3ZpZGVyczpcbiAgICAgICAgY29tcG9uZW50LnZpZXdQcm92aWRlcnMubGVuZ3RoID4gMCA/IG5ldyBvLldyYXBwZWROb2RlRXhwcihjb21wb25lbnQudmlld1Byb3ZpZGVycykgOiBudWxsLFxuICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gIH07XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEobWV0YSwgb3V0cHV0Q3R4LmNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGZhY3RvcnlSZXMgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKFxuICAgICAgey4uLm1ldGEsIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0LkRpcmVjdGl2ZX0pO1xuICBjb25zdCBuZ0ZhY3RvcnlEZWZTdGF0ZW1lbnQgPSBuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoJ8m1ZmFjJywgby5JTkZFUlJFRF9UWVBFLCBbby5TdG10TW9kaWZpZXIuU3RhdGljXSwgZmFjdG9yeVJlcy5mYWN0b3J5KV0sIFtdLFxuICAgICAgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pO1xuICBjb25zdCBjb21wb25lbnREZWZTdGF0ZW1lbnQgPSBuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZ0ZhY3RvcnlEZWZTdGF0ZW1lbnQsIGNvbXBvbmVudERlZlN0YXRlbWVudCk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgZ2l2ZW4gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIGEgYENvbXBpbGVSZWZsZWN0b3JgLlxuICovXG5mdW5jdGlvbiBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShcbiAgICBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICAvLyBUaGUgZ2xvYmFsLWFuYWx5c2lzIGJhc2VkIEl2eSBtb2RlIGluIG5nYyBpcyBubyBsb25nZXIgdXRpbGl6ZWQvc3VwcG9ydGVkLlxuICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkJyk7XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICAgIHN0YXRpYzogISFxdWVyeS5zdGF0aWNcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCBwYXJhbWV0ZXJzID0gW2dldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCBjb25zdGFudFBvb2wpLCBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMpXTtcbiAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICBwYXJhbWV0ZXJzLnB1c2gocXVlcnkucmVhZCk7XG4gIH1cbiAgcmV0dXJuIHBhcmFtZXRlcnM7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgcXVlcmllcykge1xuICAgIGNvbnN0IHF1ZXJ5SW5zdHJ1Y3Rpb24gPSBxdWVyeS5zdGF0aWMgPyBSMy5zdGF0aWNDb250ZW50UXVlcnkgOiBSMy5jb250ZW50UXVlcnk7XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5jb250ZW50UXVlcnkoZGlySW5kZXgsIHNvbWVQcmVkaWNhdGUsIHRydWUsIG51bGwpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgby5pbXBvcnRFeHByKHF1ZXJ5SW5zdHJ1Y3Rpb24pXG4gICAgICAgICAgICAuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpLCAuLi5wcmVwYXJlUXVlcnlQYXJhbXMocXVlcnksIGNvbnN0YW50UG9vbCkgYXMgYW55XSlcbiAgICAgICAgICAgIC50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkUXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCBjb250ZW50UXVlcmllc0ZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9Db250ZW50UXVlcmllc2AgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtcbiAgICAgICAgbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCksXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oJ2RpckluZGV4JywgbnVsbClcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGNvbnRlbnRRdWVyaWVzRm5OYW1lKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXNUeXBlKHN0cjogc3RyaW5nKTogby5UeXBlIHtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKHN0cikpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdNYXBBc1R5cGUobWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgc3RyaW5nW119KTogby5UeXBlIHtcbiAgY29uc3QgbWFwVmFsdWVzID0gT2JqZWN0LmtleXMobWFwKS5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IEFycmF5LmlzQXJyYXkobWFwW2tleV0pID8gbWFwW2tleV1bMF0gOiBtYXBba2V5XTtcbiAgICByZXR1cm4ge1xuICAgICAga2V5LFxuICAgICAgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZSksXG4gICAgICBxdW90ZWQ6IHRydWUsXG4gICAgfTtcbiAgfSk7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbE1hcChtYXBWYWx1ZXMpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXJyYXlBc1R5cGUoYXJyOiBzdHJpbmdbXSk6IG8uVHlwZSB7XG4gIHJldHVybiBhcnIubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKGFyci5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG8uTk9ORV9UWVBFO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUeXBlRm9yRGVmKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIHR5cGVCYXNlOiBvLkV4dGVybmFsUmVmZXJlbmNlKTogby5UeXBlIHtcbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IG1ldGEuc2VsZWN0b3IgIT09IG51bGwgPyBtZXRhLnNlbGVjdG9yLnJlcGxhY2UoL1xcbi9nLCAnJykgOiBudWxsO1xuXG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcih0eXBlQmFzZSwgW1xuICAgIHR5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc2VsZWN0b3JGb3JUeXBlICE9PSBudWxsID8gc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSkgOiBvLk5PTkVfVFlQRSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5leHBvcnRBcykgOiBvLk5PTkVfVFlQRSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5pbnB1dHMpLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLm91dHB1dHMpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdKSk7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24oXG4gICAgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICB2aWV3UXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgY29uc3QgcXVlcnlJbnN0cnVjdGlvbiA9IHF1ZXJ5LnN0YXRpYyA/IFIzLnN0YXRpY1ZpZXdRdWVyeSA6IFIzLnZpZXdRdWVyeTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLnZpZXdRdWVyeShzb21lUHJlZGljYXRlLCB0cnVlKTtcbiAgICBjb25zdCBxdWVyeURlZmluaXRpb24gPVxuICAgICAgICBvLmltcG9ydEV4cHIocXVlcnlJbnN0cnVjdGlvbikuY2FsbEZuKHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKHF1ZXJ5RGVmaW5pdGlvbi50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkUXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH0pO1xuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9RdWVyeWAgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHZpZXdRdWVyeUZuTmFtZSk7XG59XG5cbi8vIFJldHVybiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgaG9zdEJpbmRpbmdzTWV0YWRhdGE6IFIzSG9zdE1ldGFkYXRhLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBzZWxlY3Rvcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgYmluZGluZ0NvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihiaW5kaW5nQ29udGV4dCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzO1xuICBpZiAoc3R5bGVBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIoc3R5bGVBdHRyKTtcbiAgfVxuICBpZiAoY2xhc3NBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIoY2xhc3NBdHRyKTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IHR5cGVTb3VyY2VTcGFuO1xuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkoaG9zdEJpbmRpbmdzTWV0YWRhdGEpO1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzLCBuYW1lKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goLi4ubGlzdGVuZXJzKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBiaW5kaW5ncyA9IGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICBjb25zdCBhbGxPdGhlckJpbmRpbmdzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG5cbiAgLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIHRvdGFsIGFtb3VudCBvZiBiaW5kaW5nIHNsb3RzIHJlcXVpcmVkIGJ5XG4gIC8vIGFsbCB0aGUgaW5zdHJ1Y3Rpb25zIHRvZ2V0aGVyIGJlZm9yZSBhbnkgdmFsdWUgY29udmVyc2lvbnMgaGFwcGVuLlxuICAvLyBWYWx1ZSBjb252ZXJzaW9ucyBtYXkgcmVxdWlyZSBhZGRpdGlvbmFsIHNsb3RzIGZvciBpbnRlcnBvbGF0aW9uIGFuZFxuICAvLyBiaW5kaW5ncyB3aXRoIHBpcGVzLiBUaGVzZSBjYWxjdWxhdGVzIGhhcHBlbiBhZnRlciB0aGlzIGJsb2NrLlxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gMDtcbiAgYmluZGluZ3MgJiYgYmluZGluZ3MuZm9yRWFjaCgoYmluZGluZzogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICBjb25zdCBuYW1lID0gYmluZGluZy5uYW1lO1xuICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9XG4gICAgICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlcklucHV0QmFzZWRPbk5hbWUobmFtZSwgYmluZGluZy5leHByZXNzaW9uLCBiaW5kaW5nLnNvdXJjZVNwYW4pO1xuICAgIGlmIChzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVEO1xuICAgIH0gZWxzZSB7XG4gICAgICBhbGxPdGhlckJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQrKztcbiAgICB9XG4gIH0pO1xuXG4gIGxldCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIGNvbnN0IGdldFZhbHVlQ29udmVydGVyID0gKCkgPT4ge1xuICAgIGlmICghdmFsdWVDb252ZXJ0ZXIpIHtcbiAgICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxWYXJzQ291bnQgPSB0b3RhbEhvc3RWYXJzQ291bnQ7XG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsVmFyc0NvdW50O1xuICAgICAgfTtcbiAgICAgIHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksICAvLyBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgICAgICAgIGhvc3RWYXJzQ291bnRGbixcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpOyAgLy8gcGlwZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVDb252ZXJ0ZXI7XG4gIH07XG5cbiAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBhdHRyaWJ1dGVCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBzeW50aGV0aWNIb3N0QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgYWxsT3RoZXJCaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgIGNvbnN0IHZhbHVlID0gYmluZGluZy5leHByZXNzaW9uLnZpc2l0KGdldFZhbHVlQ29udmVydGVyKCkpO1xuICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICBjb25zdCB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZX0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmcpO1xuXG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhzZWxlY3RvciwgYmluZGluZ05hbWUsIGlzQXR0cmlidXRlKVxuICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IGNvcmUuU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuXG4gICAgbGV0IHNhbml0aXplckZuOiBvLkV4dGVybmFsRXhwcnxudWxsID0gbnVsbDtcbiAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGgpIHtcbiAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCA9PT0gMiAmJlxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkwpID4gLTEgJiZcbiAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMKSA+IC0xKSB7XG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3Igc29tZSBVUkwgYXR0cmlidXRlcyAoc3VjaCBhcyBcInNyY1wiIGFuZCBcImhyZWZcIikgdGhhdCBtYXkgYmUgYSBwYXJ0XG4gICAgICAgIC8vIG9mIGRpZmZlcmVudCBzZWN1cml0eSBjb250ZXh0cy4gSW4gdGhpcyBjYXNlIHdlIHVzZSBzcGVjaWFsIHNhbnRpdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zID0gW28ubGl0ZXJhbChiaW5kaW5nTmFtZSksIGJpbmRpbmdFeHByLmN1cnJWYWxFeHByXTtcbiAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgIH1cblxuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG5cbiAgICBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmhvc3RQcm9wZXJ0eSkge1xuICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uID09PSBSMy5hdHRyaWJ1dGUpIHtcbiAgICAgIGF0dHJpYnV0ZUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLnVwZGF0ZVN5bnRoZXRpY0hvc3RCaW5kaW5nKSB7XG4gICAgICBzeW50aGV0aWNIb3N0QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihpbnN0cnVjdGlvblBhcmFtcykudG9TdG10KCkpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHByb3BlcnR5QmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuaG9zdFByb3BlcnR5LCBwcm9wZXJ0eUJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoYXR0cmlidXRlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuYXR0cmlidXRlLCBhdHRyaWJ1dGVCaW5kaW5ncykudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKHN5bnRoZXRpY0hvc3RCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICBjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMudXBkYXRlU3ludGhldGljSG9zdEJpbmRpbmcsIHN5bnRoZXRpY0hvc3RCaW5kaW5ncykudG9TdG10KCkpO1xuICB9XG5cbiAgLy8gc2luY2Ugd2UncmUgZGVhbGluZyB3aXRoIGRpcmVjdGl2ZXMvY29tcG9uZW50cyBhbmQgYm90aCBoYXZlIGhvc3RCaW5kaW5nXG4gIC8vIGZ1bmN0aW9ucywgd2UgbmVlZCB0byBnZW5lcmF0ZSBhIHNwZWNpYWwgaG9zdEF0dHJzIGluc3RydWN0aW9uIHRoYXQgZGVhbHNcbiAgLy8gd2l0aCBib3RoIHRoZSBhc3NpZ25tZW50IG9mIHN0eWxpbmcgYXMgd2VsbCBhcyBzdGF0aWMgYXR0cmlidXRlcyB0byB0aGUgaG9zdFxuICAvLyBlbGVtZW50LiBUaGUgaW5zdHJ1Y3Rpb24gYmVsb3cgd2lsbCBpbnN0cnVjdCBhbGwgaW5pdGlhbCBzdHlsaW5nIChzdHlsaW5nXG4gIC8vIHRoYXQgaXMgaW5zaWRlIG9mIGEgaG9zdCBiaW5kaW5nIHdpdGhpbiBhIGRpcmVjdGl2ZS9jb21wb25lbnQpIHRvIGJlIGF0dGFjaGVkXG4gIC8vIHRvIHRoZSBob3N0IGVsZW1lbnQgYWxvbmdzaWRlIGFueSBvZiB0aGUgcHJvdmlkZWQgaG9zdCBhdHRyaWJ1dGVzIHRoYXQgd2VyZVxuICAvLyBjb2xsZWN0ZWQgZWFybGllci5cbiAgY29uc3QgaG9zdEF0dHJzID0gY29udmVydEF0dHJpYnV0ZXNUb0V4cHJlc3Npb25zKGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXMpO1xuICBzdHlsZUJ1aWxkZXIuYXNzaWduSG9zdEF0dHJzKGhvc3RBdHRycywgZGVmaW5pdGlvbk1hcCk7XG5cbiAgaWYgKHN0eWxlQnVpbGRlci5oYXNCaW5kaW5ncykge1xuICAgIC8vIGZpbmFsbHkgZWFjaCBiaW5kaW5nIHRoYXQgd2FzIHJlZ2lzdGVyZWQgaW4gdGhlIHN0YXRlbWVudCBhYm92ZSB3aWxsIG5lZWQgdG8gYmUgYWRkZWQgdG9cbiAgICAvLyB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgY29tcG9uZW50L2RpcmVjdGl2ZSB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIHNvIHRoYXQgdGhlIGJpbmRpbmdzXG4gICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgc3R5bGVCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnMoZ2V0VmFsdWVDb252ZXJ0ZXIoKSkuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICBpZiAoaW5zdHJ1Y3Rpb24uY2FsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBjYWxsczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuXG4gICAgICAgIGluc3RydWN0aW9uLmNhbGxzLmZvckVhY2goY2FsbCA9PiB7XG4gICAgICAgICAgLy8gd2Ugc3VidHJhY3QgYSB2YWx1ZSBvZiBgMWAgaGVyZSBiZWNhdXNlIHRoZSBiaW5kaW5nIHNsb3Qgd2FzIGFscmVhZHkgYWxsb2NhdGVkXG4gICAgICAgICAgLy8gYXQgdGhlIHRvcCBvZiB0aGlzIG1ldGhvZCB3aGVuIGFsbCB0aGUgaW5wdXQgYmluZGluZ3Mgd2VyZSBjb3VudGVkLlxuICAgICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPVxuICAgICAgICAgICAgICBNYXRoLm1heChjYWxsLmFsbG9jYXRlQmluZGluZ1Nsb3RzIC0gTUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRCwgMCk7XG4gICAgICAgICAgY2FsbHMucHVzaChjb252ZXJ0U3R5bGluZ0NhbGwoY2FsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbikpO1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2goY2hhaW5lZEluc3RydWN0aW9uKGluc3RydWN0aW9uLnJlZmVyZW5jZSwgY2FsbHMpLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdFZhcnMnLCBvLmxpdGVyYWwodG90YWxIb3N0VmFyc0NvdW50KSk7XG4gIH1cblxuICBpZiAoY3JlYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwIHx8IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGhvc3RCaW5kaW5nc0ZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9Ib3N0QmluZGluZ3NgIDogbnVsbDtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICBpZiAodXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLCBzdGF0ZW1lbnRzLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYmluZGluZ0ZuKGltcGxpY2l0OiBhbnksIHZhbHVlOiBBU1QpIHtcbiAgcmV0dXJuIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICBudWxsLCBpbXBsaWNpdCwgdmFsdWUsICdiJywgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3R5bGluZ0NhbGwoXG4gICAgY2FsbDogU3R5bGluZ0luc3RydWN0aW9uQ2FsbCwgYmluZGluZ0NvbnRleHQ6IGFueSwgYmluZGluZ0ZuOiBGdW5jdGlvbikge1xuICByZXR1cm4gY2FsbC5wYXJhbXModmFsdWUgPT4gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSkuY3VyclZhbEV4cHIpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KTpcbiAgICB7YmluZGluZ05hbWU6IHN0cmluZywgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzQXR0cmlidXRlOiBib29sZWFufSB7XG4gIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgbGV0IGluc3RydWN0aW9uICE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgYW4gYXR0ciBiaW5kaW5nIG9yIGEgcHJvcGVydHkgYmluZGluZ1xuICBjb25zdCBhdHRyTWF0Y2hlcyA9IGJpbmRpbmdOYW1lLm1hdGNoKEFUVFJfUkVHRVgpO1xuICBpZiAoYXR0ck1hdGNoZXMpIHtcbiAgICBiaW5kaW5nTmFtZSA9IGF0dHJNYXRjaGVzWzFdO1xuICAgIGluc3RydWN0aW9uID0gUjMuYXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLnVwZGF0ZVN5bnRoZXRpY0hvc3RCaW5kaW5nO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmhvc3RQcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGU6ICEhYXR0ck1hdGNoZXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sIG5hbWU/OiBzdHJpbmcpOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3QgbGlzdGVuZXJzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0xpc3RlbmVyczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBpbnN0cnVjdGlvbnM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBldmVudEJpbmRpbmdzLmZvckVhY2goYmluZGluZyA9PiB7XG4gICAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBiaW5kaW5nLnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoYmluZGluZ05hbWUsIGJpbmRpbmcudGFyZ2V0T3JQaGFzZSkgOlxuICAgICAgICBiaW5kaW5nTmFtZTtcbiAgICBjb25zdCBoYW5kbGVyTmFtZSA9IG5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHtuYW1lfV8ke2JpbmRpbmdGbk5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IHBhcmFtcyA9IHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhCb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChiaW5kaW5nKSwgaGFuZGxlck5hbWUpO1xuXG4gICAgaWYgKGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICBzeW50aGV0aWNMaXN0ZW5lcnMucHVzaChwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0ZW5lcnMucHVzaChwYXJhbXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHN5bnRoZXRpY0xpc3RlbmVycy5sZW5ndGggPiAwKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goXG4gICAgICAgIGNoYWluZWRJbnN0cnVjdGlvbihSMy5jb21wb25lbnRIb3N0U3ludGhldGljTGlzdGVuZXIsIHN5bnRoZXRpY0xpc3RlbmVycykudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKGxpc3RlbmVycy5sZW5ndGggPiAwKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goY2hhaW5lZEluc3RydWN0aW9uKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIHJldHVybiBpbnN0cnVjdGlvbnM7XG59XG5cbmZ1bmN0aW9uIG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGE6IFIzSG9zdE1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgLy8gVGhpcyBpcyB1c2VkIGJ5IHRoZSBCaW5kaW5nUGFyc2VyLCB3aGljaCBvbmx5IGRlYWxzIHdpdGggbGlzdGVuZXJzIGFuZCBwcm9wZXJ0aWVzLiBUaGVyZSdzIG5vXG4gICAgLy8gbmVlZCB0byBwYXNzIGF0dHJpYnV0ZXMgdG8gaXQuXG4gICAgaG9zdEF0dHJpYnV0ZXM6IHt9LFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEubGlzdGVuZXJzLFxuICAgIGhvc3RQcm9wZXJ0aWVzOiBtZXRhLnByb3BlcnRpZXMsXG4gIH0gYXMgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnk7XG4gIC8vIGNsYW5nLWZvcm1hdCBvblxufVxuXG5cbmZ1bmN0aW9uIHR5cGVNYXBUb0V4cHJlc3Npb25NYXAoXG4gICAgbWFwOiBNYXA8c3RyaW5nLCBTdGF0aWNTeW1ib2w+LCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+IHtcbiAgLy8gQ29udmVydCBlYWNoIG1hcCBlbnRyeSBpbnRvIGFub3RoZXIgZW50cnkgd2hlcmUgdGhlIHZhbHVlIGlzIGFuIGV4cHJlc3Npb24gaW1wb3J0aW5nIHRoZSB0eXBlLlxuICBjb25zdCBlbnRyaWVzID0gQXJyYXkuZnJvbShtYXApLm1hcChcbiAgICAgIChba2V5LCB0eXBlXSk6IFtzdHJpbmcsIG8uRXhwcmVzc2lvbl0gPT4gW2tleSwgb3V0cHV0Q3R4LmltcG9ydEV4cHIodHlwZSldKTtcbiAgcmV0dXJuIG5ldyBNYXAoZW50cmllcyk7XG59XG5cbmNvbnN0IEhPU1RfUkVHX0VYUCA9IC9eKD86XFxbKFteXFxdXSspXFxdKXwoPzpcXCgoW15cXCldKylcXCkpJC87XG4vLyBSZXByZXNlbnRzIHRoZSBncm91cHMgaW4gdGhlIGFib3ZlIHJlZ2V4LlxuY29uc3QgZW51bSBIb3N0QmluZGluZ0dyb3VwIHtcbiAgLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiLCBvciBcImF0dHIucm9sZVwiIGZyb20gXCJbYXR0ci5yb2xlXVwiLCBvciBAYW5pbSBmcm9tIFtAYW5pbV1cbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxufVxuXG4vLyBEZWZpbmVzIEhvc3QgQmluZGluZ3Mgc3RydWN0dXJlIHRoYXQgY29udGFpbnMgYXR0cmlidXRlcywgbGlzdGVuZXJzLCBhbmQgcHJvcGVydGllcyxcbi8vIHBhcnNlZCBmcm9tIHRoZSBgaG9zdGAgb2JqZWN0IGRlZmluZWQgZm9yIGEgVHlwZS5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhvc3RCaW5kaW5ncyhob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgby5FeHByZXNzaW9ufSk6XG4gICAgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO30gPSB7fTtcblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhob3N0KSkge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcblxuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgLy8gc3ludGhldGljIHByb3BlcnRpZXMgKHRoZSBvbmVzIHRoYXQgaGF2ZSBhIGBAYCBhcyBhIHByZWZpeClcbiAgICAgIC8vIGFyZSBzdGlsbCB0cmVhdGVkIHRoZSBzYW1lIGFzIHJlZ3VsYXIgcHJvcGVydGllcy4gVGhlcmVmb3JlXG4gICAgICAvLyB0aGVyZSBpcyBubyBwb2ludCBpbiBzdG9yaW5nIHRoZW0gaW4gYSBzZXBhcmF0ZSBtYXAuXG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBzcGVjaWFsQXR0cmlidXRlc307XG59XG5cbi8qKlxuICogVmVyaWZpZXMgaG9zdCBiaW5kaW5ncyBhbmQgcmV0dXJucyB0aGUgbGlzdCBvZiBlcnJvcnMgKGlmIGFueSkuIEVtcHR5IGFycmF5IGluZGljYXRlcyB0aGF0IGFcbiAqIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzIGhhcyBubyBlcnJvcnMuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdzIHNldCBvZiBob3N0IGJpbmRpbmdzIHRvIHZlcmlmeS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIHNvdXJjZSBzcGFuIHdoZXJlIGhvc3QgYmluZGluZ3Mgd2VyZSBkZWZpbmVkLlxuICogQHJldHVybnMgYXJyYXkgb2YgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCBhIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5SG9zdEJpbmRpbmdzKFxuICAgIGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3MsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFBhcnNlRXJyb3JbXSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShiaW5kaW5ncyk7XG4gIC8vIFRPRE86IGFic3RyYWN0IG91dCBob3N0IGJpbmRpbmdzIHZlcmlmaWNhdGlvbiBsb2dpYyBhbmQgdXNlIGl0IGluc3RlYWQgb2ZcbiAgLy8gY3JlYXRpbmcgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIEFTVHMgdG8gZGV0ZWN0IGVycm9ycyAoRlctOTk2KVxuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKHN1bW1hcnksIHNvdXJjZVNwYW4pO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLmVycm9ycztcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7IHJldHVybiBzaGFkb3dDc3MgIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7IH0pO1xufVxuIl19