/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import * as o from '../../output/output_ast';
import { sanitizeIdentifier } from '../../parse_util';
import { isIframeSecuritySensitiveAttr } from '../../schema/dom_security_schema';
import { CssSelector } from '../../selector';
import { ShadowCss } from '../../shadow_css';
import { CompilationJobKind } from '../../template/pipeline/src/compilation';
import { emitHostBindingFunction, emitTemplateFn, transform } from '../../template/pipeline/src/emit';
import { ingestComponent, ingestHostBinding } from '../../template/pipeline/src/ingest';
import { USE_TEMPLATE_PIPELINE } from '../../template/pipeline/switch';
import { error } from '../../util';
import { BoundEvent } from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { prepareSyntheticListenerFunctionName, prepareSyntheticPropertyName, typeWithParameters } from '../util';
import { MIN_STYLING_BINDING_SLOTS_REQUIRED, StylingBuilder } from './styling_builder';
import { BindingScope, makeBindingParser, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn, TemplateDefinitionBuilder, ValueConverter } from './template';
import { asLiteral, conditionallyCreateDirectiveBindingLiteral, CONTEXT_NAME, DefinitionMap, getInstructionStatements, getQueryPredicate, RENDER_FLAGS, TEMPORARY_NAME, temporaryAllocator } from './util';
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
const ATTR_REGEX = /attr\.([^\]]+)/;
const COMPONENT_VARIABLE = '%COMP%';
const HOST_ATTR = `_nghost-${COMPONENT_VARIABLE}`;
const CONTENT_ATTR = `_ngcontent-${COMPONENT_VARIABLE}`;
function baseDirectiveFields(meta, constantPool, bindingParser) {
    const definitionMap = new DefinitionMap();
    const selectors = core.parseSelectorToR3Selector(meta.selector);
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.type.value);
    // e.g. `selectors: [['', 'someDir', '']]`
    if (selectors.length > 0) {
        definitionMap.set('selectors', asLiteral(selectors));
    }
    if (meta.queries.length > 0) {
        // e.g. `contentQueries: (rf, ctx, dirIndex) => { ... }
        definitionMap.set('contentQueries', createContentQueriesFunction(meta.isSignal, meta.queries, constantPool, meta.name));
    }
    if (meta.viewQueries.length) {
        definitionMap.set('viewQuery', createViewQueriesFunction(meta.isSignal, meta.viewQueries, constantPool, meta.name));
    }
    // e.g. `hostBindings: (rf, ctx) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || '', meta.name, meta.isSignal, definitionMap));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateDirectiveBindingLiteral(meta.inputs, true));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateDirectiveBindingLiteral(meta.outputs));
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(e => o.literal(e))));
    }
    if (meta.isStandalone) {
        definitionMap.set('standalone', o.literal(true));
    }
    if (meta.isSignal) {
        definitionMap.set('signals', o.literal(true));
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
    const inputKeys = Object.keys(meta.inputs);
    if (providers || viewProviders) {
        const args = [providers || new o.LiteralArrayExpr([])];
        if (viewProviders) {
            args.push(viewProviders);
        }
        features.push(o.importExpr(R3.ProvidersFeature).callFn(args));
    }
    for (const key of inputKeys) {
        if (meta.inputs[key].transformFunction !== null) {
            features.push(o.importExpr(R3.InputTransformsFeatureFeature));
            break;
        }
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
    // TODO: better way of differentiating component vs directive metadata.
    if (meta.hasOwnProperty('template') && meta.isStandalone) {
        features.push(o.importExpr(R3.StandaloneFeature));
    }
    if (meta.hostDirectives?.length) {
        features.push(o.importExpr(R3.HostDirectivesFeature).callFn([createHostDirectivesFeatureArg(meta.hostDirectives)]));
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
    const expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()], undefined, true);
    const type = createDirectiveType(meta);
    return { expression, type, statements: [] };
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
    // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
    const templateTypeName = meta.name;
    const templateName = templateTypeName ? `${templateTypeName}_Template` : null;
    // Template compilation is currently conditional as we're in the process of rewriting it.
    if (!USE_TEMPLATE_PIPELINE) {
        // This is the main path currently used in compilation, which compiles the template with the
        // legacy `TemplateDefinitionBuilder`.
        const template = meta.template;
        const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.createRootScope(), 0, templateTypeName, null, null, templateName, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.deferBlocks, new Map());
        const templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
        // We need to provide this so that dynamically generated components know what
        // projected content blocks to pass through to the component when it is
        //     instantiated.
        const ngContentSelectors = templateBuilder.getNgContentSelectors();
        if (ngContentSelectors) {
            definitionMap.set('ngContentSelectors', ngContentSelectors);
        }
        // e.g. `decls: 2`
        // definitionMap.set('decls', o.literal(tpl.root.decls!));
        definitionMap.set('decls', o.literal(templateBuilder.getConstCount()));
        // e.g. `vars: 2`
        // definitionMap.set('vars', o.literal(tpl.root.vars!));
        definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
        // Generate `consts` section of ComponentDef:
        // - either as an array:
        //   `consts: [['one', 'two'], ['three', 'four']]`
        // - or as a factory function in case additional statements are present (to support i18n):
        //   `consts: () => { var i18n_0; if (ngI18nClosureMode) {...} else {...} return [i18n_0];
        //   }`
        const { constExpressions, prepareStatements } = templateBuilder.getConsts();
        if (constExpressions.length > 0) {
            let constsExpr = o.literalArr(constExpressions);
            // Prepare statements are present - turn `consts` into a function.
            if (prepareStatements.length > 0) {
                constsExpr = o.arrowFn([], [...prepareStatements, new o.ReturnStatement(constsExpr)]);
            }
            definitionMap.set('consts', constsExpr);
        }
        definitionMap.set('template', templateFunctionExpression);
    }
    else {
        // This path compiles the template using the prototype template pipeline. First the template is
        // ingested into IR:
        const tpl = ingestComponent(meta.name, meta.isSignal, meta.template.nodes, constantPool, meta.relativeContextFilePath, meta.i18nUseExternalIds);
        // Then the IR is transformed to prepare it for cod egeneration.
        transform(tpl, CompilationJobKind.Tmpl);
        // Finally we emit the template function:
        const templateFn = emitTemplateFn(tpl, constantPool);
        if (tpl.contentSelectors !== null) {
            definitionMap.set('ngContentSelectors', tpl.contentSelectors);
        }
        definitionMap.set('decls', o.literal(tpl.root.decls));
        definitionMap.set('vars', o.literal(tpl.root.vars));
        if (tpl.consts.length > 0) {
            if (tpl.constsInitializers.length > 0) {
                definitionMap.set('consts', o.arrowFn([], [
                    ...tpl.constsInitializers, new o.ReturnStatement(o.literalArr(tpl.consts))
                ]));
            }
            else {
                definitionMap.set('consts', o.literalArr(tpl.consts));
            }
        }
        definitionMap.set('template', templateFn);
    }
    if (meta.declarationListEmitMode !== 3 /* DeclarationListEmitMode.RuntimeResolved */ &&
        meta.declarations.length > 0) {
        definitionMap.set('dependencies', compileDeclarationList(o.literalArr(meta.declarations.map(decl => decl.type)), meta.declarationListEmitMode));
    }
    else if (meta.declarationListEmitMode === 3 /* DeclarationListEmitMode.RuntimeResolved */) {
        const args = [meta.type.value];
        if (meta.rawImports) {
            args.push(meta.rawImports);
        }
        definitionMap.set('dependencies', o.importExpr(R3.getComponentDepsFactory).callFn(args));
    }
    if (meta.encapsulation === null) {
        meta.encapsulation = core.ViewEncapsulation.Emulated;
    }
    // e.g. `styles: [str1, str2]`
    if (meta.styles && meta.styles.length) {
        const styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
            compileStyles(meta.styles, CONTENT_ATTR, HOST_ATTR) :
            meta.styles;
        const styleNodes = styleValues.reduce((result, style) => {
            if (style.trim().length > 0) {
                result.push(constantPool.getConstLiteral(o.literal(style)));
            }
            return result;
        }, []);
        if (styleNodes.length > 0) {
            definitionMap.set('styles', o.literalArr(styleNodes));
        }
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
    // Setting change detection flag
    if (meta.changeDetection !== null) {
        if (typeof meta.changeDetection === 'number' &&
            meta.changeDetection !== core.ChangeDetectionStrategy.Default) {
            // changeDetection is resolved during analysis. Only set it if not the default.
            definitionMap.set('changeDetection', o.literal(meta.changeDetection));
        }
        else if (typeof meta.changeDetection === 'object') {
            // changeDetection is not resolved during analysis (e.g., we are in local compilation mode).
            // So place it as is.
            definitionMap.set('changeDetection', meta.changeDetection);
        }
    }
    const expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()], undefined, true);
    const type = createComponentType(meta);
    return { expression, type, statements: [] };
}
/**
 * Creates the type specification from the component meta. This type is inserted into .d.ts files
 * to be consumed by upstream compilations.
 */
export function createComponentType(meta) {
    const typeParams = createBaseDirectiveTypeParams(meta);
    typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
    typeParams.push(o.expressionType(o.literal(meta.isStandalone)));
    typeParams.push(createHostDirectivesType(meta));
    // TODO(signals): Always include this metadata starting with v17. Right
    // now Angular v16.0.x does not support this field and library distributions
    // would then be incompatible with v16.0.x framework users.
    if (meta.isSignal) {
        typeParams.push(o.expressionType(o.literal(meta.isSignal)));
    }
    return o.expressionType(o.importExpr(R3.ComponentDeclaration, typeParams));
}
/**
 * Compiles the array literal of declarations into an expression according to the provided emit
 * mode.
 */
function compileDeclarationList(list, mode) {
    switch (mode) {
        case 0 /* DeclarationListEmitMode.Direct */:
            // directives: [MyDir],
            return list;
        case 1 /* DeclarationListEmitMode.Closure */:
            // directives: function () { return [MyDir]; }
            return o.arrowFn([], list);
        case 2 /* DeclarationListEmitMode.ClosureResolved */:
            // directives: function () { return [MyDir].map(ng.resolveForwardRef); }
            const resolvedList = list.prop('map').callFn([o.importExpr(R3.resolveForwardRef)]);
            return o.arrowFn([], resolvedList);
        case 3 /* DeclarationListEmitMode.RuntimeResolved */:
            throw new Error(`Unsupported with an array of pre-resolved dependencies`);
    }
}
function prepareQueryParams(query, constantPool) {
    const parameters = [getQueryPredicate(query, constantPool), o.literal(toQueryFlags(query))];
    if (query.read) {
        parameters.push(query.read);
    }
    return parameters;
}
/**
 * Translates query flags into `TQueryFlags` type in packages/core/src/render3/interfaces/query.ts
 * @param query
 */
function toQueryFlags(query) {
    return (query.descendants ? 1 /* QueryFlags.descendants */ : 0 /* QueryFlags.none */) |
        (query.static ? 2 /* QueryFlags.isStatic */ : 0 /* QueryFlags.none */) |
        (query.emitDistinctChangesOnly ? 4 /* QueryFlags.emitDistinctChangesOnly */ : 0 /* QueryFlags.none */);
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
function createContentQueriesFunction(isSignal, queries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    for (const query of queries) {
        if (isSignal) {
            createStatements.push(o.importExpr(R3.contentQueryCreate)
                .callFn([
                o.variable(CONTEXT_NAME).prop(query.propertyName),
                // TODO(signals): `dirIndex` is not actually used at all. Can remove?
                o.variable('dirIndex'), ...prepareQueryParams(query, constantPool)
            ])
                .toStmt());
            continue;
        }
        // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
        createStatements.push(o.importExpr(R3.contentQuery)
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
    const body = [
        renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, createStatements),
    ];
    // Signal directives may not generate update statements.
    if (updateStatements.length > 0) {
        body.push(renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateStatements));
    }
    return o.fn([
        new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null),
        new o.FnParam('dirIndex', null)
    ], body, o.INFERRED_TYPE, null, contentQueriesFnName);
}
function stringAsType(str) {
    return o.expressionType(o.literal(str));
}
function stringMapAsLiteralExpression(map) {
    const mapValues = Object.keys(map).map(key => {
        const value = Array.isArray(map[key]) ? map[key][0] : map[key];
        return {
            key,
            value: o.literal(value),
            quoted: true,
        };
    });
    return o.literalMap(mapValues);
}
function stringArrayAsType(arr) {
    return arr.length > 0 ? o.expressionType(o.literalArr(arr.map(value => o.literal(value)))) :
        o.NONE_TYPE;
}
function createBaseDirectiveTypeParams(meta) {
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    const selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;
    return [
        typeWithParameters(meta.type.type, meta.typeArgumentCount),
        selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
        meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
        o.expressionType(getInputsTypeExpression(meta)),
        o.expressionType(stringMapAsLiteralExpression(meta.outputs)),
        stringArrayAsType(meta.queries.map(q => q.propertyName)),
    ];
}
function getInputsTypeExpression(meta) {
    return o.literalMap(Object.keys(meta.inputs).map(key => {
        const value = meta.inputs[key];
        return {
            key,
            value: o.literalMap([
                { key: 'alias', value: o.literal(value.bindingPropertyName), quoted: true },
                { key: 'required', value: o.literal(value.required), quoted: true }
            ]),
            quoted: true
        };
    }));
}
/**
 * Creates the type specification from the directive meta. This type is inserted into .d.ts files
 * to be consumed by upstream compilations.
 */
export function createDirectiveType(meta) {
    const typeParams = createBaseDirectiveTypeParams(meta);
    // Directives have no NgContentSelectors slot, but instead express a `never` type
    // so that future fields align.
    typeParams.push(o.NONE_TYPE);
    typeParams.push(o.expressionType(o.literal(meta.isStandalone)));
    typeParams.push(createHostDirectivesType(meta));
    // TODO(signals): Always include this metadata starting with v17. Right
    // now Angular v16.0.x does not support this field and library distributions
    // would then be incompatible with v16.0.x framework users.
    if (meta.isSignal) {
        typeParams.push(o.expressionType(o.literal(meta.isSignal)));
    }
    return o.expressionType(o.importExpr(R3.DirectiveDeclaration, typeParams));
}
// Define and update any view queries
function createViewQueriesFunction(isSignal, viewQueries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    viewQueries.forEach((query) => {
        if (isSignal) {
            createStatements.push(o.importExpr(R3.viewQueryCreate)
                .callFn([
                o.variable(CONTEXT_NAME).prop(query.propertyName),
                ...prepareQueryParams(query, constantPool)
            ])
                .toStmt());
            return;
        }
        // creation, e.g. r3.viewQuery(somePredicate, true);
        const queryDefinition = o.importExpr(R3.viewQuery).callFn(prepareQueryParams(query, constantPool));
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
    const body = [
        renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, createStatements),
    ];
    // Signal directives may not generate update statements.
    if (updateStatements.length > 0) {
        body.push(renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateStatements));
    }
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], body, o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, isSignal, definitionMap) {
    const bindings = bindingParser.createBoundHostProperties(hostBindingsMetadata.properties, typeSourceSpan);
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(hostBindingsMetadata.listeners, typeSourceSpan);
    if (USE_TEMPLATE_PIPELINE) {
        // The parser for host bindings treats class and style attributes specially -- they are
        // extracted into these separate fields. This is not the case for templates, so the compiler can
        // actually already handle these special attributes internally. Therefore, we just drop them
        // into the attributes map.
        if (hostBindingsMetadata.specialAttributes.styleAttr) {
            hostBindingsMetadata.attributes['style'] =
                o.literal(hostBindingsMetadata.specialAttributes.styleAttr);
        }
        if (hostBindingsMetadata.specialAttributes.classAttr) {
            hostBindingsMetadata.attributes['class'] =
                o.literal(hostBindingsMetadata.specialAttributes.classAttr);
        }
        const hostJob = ingestHostBinding({
            isSignal,
            componentName: name,
            properties: bindings,
            events: eventBindings,
            attributes: hostBindingsMetadata.attributes,
        }, constantPool);
        transform(hostJob, CompilationJobKind.Host);
        definitionMap.set('hostAttrs', hostJob.root.attributes);
        const varCount = hostJob.root.vars;
        if (varCount !== null && varCount > 0) {
            definitionMap.set('hostVars', o.literal(varCount));
        }
        return emitHostBindingFunction(hostJob);
    }
    const bindingContext = o.variable(CONTEXT_NAME);
    const styleBuilder = new StylingBuilder(bindingContext);
    const { styleAttr, classAttr } = hostBindingsMetadata.specialAttributes;
    if (styleAttr !== undefined) {
        styleBuilder.registerStyleAttr(styleAttr);
    }
    if (classAttr !== undefined) {
        styleBuilder.registerClassAttr(classAttr);
    }
    const createInstructions = [];
    const updateInstructions = [];
    const updateVariables = [];
    const hostBindingSourceSpan = typeSourceSpan;
    if (eventBindings && eventBindings.length) {
        createInstructions.push(...createHostListeners(eventBindings, name));
    }
    // Calculate the host property bindings
    const allOtherBindings = [];
    // We need to calculate the total amount of binding slots required by
    // all the instructions together before any value conversions happen.
    // Value conversions may require additional slots for interpolation and
    // bindings with pipes. These calculates happen after this block.
    let totalHostVarsCount = 0;
    bindings && bindings.forEach((binding) => {
        const stylingInputWasSet = styleBuilder.registerInputBasedOnName(binding.name, binding.expression, hostBindingSourceSpan);
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
    for (const binding of allOtherBindings) {
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
                // of different security contexts. In this case we use special sanitization function and
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
        else {
            // If there was no sanitization function found based on the security context
            // of an attribute/property binding - check whether this attribute/property is
            // one of the security-sensitive <iframe> attributes.
            // Note: for host bindings defined on a directive, we do not try to find all
            // possible places where it can be matched, so we can not determine whether
            // the host element is an <iframe>. In this case, if an attribute/binding
            // name is in the `IFRAME_SECURITY_SENSITIVE_ATTRS` set - append a validation
            // function, which would be invoked at runtime and would have access to the
            // underlying DOM element, check if it's an <iframe> and if so - runs extra checks.
            if (isIframeSecuritySensitiveAttr(bindingName)) {
                instructionParams.push(o.importExpr(R3.validateIframeAttribute));
            }
        }
        updateVariables.push(...bindingExpr.stmts);
        if (instruction === R3.hostProperty) {
            propertyBindings.push(instructionParams);
        }
        else if (instruction === R3.attribute) {
            attributeBindings.push(instructionParams);
        }
        else if (instruction === R3.syntheticHostProperty) {
            syntheticHostBindings.push(instructionParams);
        }
        else {
            updateInstructions.push({ reference: instruction, paramsOrFn: instructionParams, span: null });
        }
    }
    for (const bindingParams of propertyBindings) {
        updateInstructions.push({ reference: R3.hostProperty, paramsOrFn: bindingParams, span: null });
    }
    for (const bindingParams of attributeBindings) {
        updateInstructions.push({ reference: R3.attribute, paramsOrFn: bindingParams, span: null });
    }
    for (const bindingParams of syntheticHostBindings) {
        updateInstructions.push({ reference: R3.syntheticHostProperty, paramsOrFn: bindingParams, span: null });
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
            for (const call of instruction.calls) {
                // we subtract a value of `1` here because the binding slot was already allocated
                // at the top of this method when all the input bindings were counted.
                totalHostVarsCount +=
                    Math.max(call.allocateBindingSlots - MIN_STYLING_BINDING_SLOTS_REQUIRED, 0);
                updateInstructions.push({
                    reference: instruction.reference,
                    paramsOrFn: convertStylingCall(call, bindingContext, bindingFn),
                    span: null
                });
            }
        });
    }
    if (totalHostVarsCount) {
        definitionMap.set('hostVars', o.literal(totalHostVarsCount));
    }
    if (createInstructions.length > 0 || updateInstructions.length > 0) {
        const hostBindingsFnName = name ? `${name}_HostBindings` : null;
        const statements = [];
        if (createInstructions.length > 0) {
            statements.push(renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, getInstructionStatements(createInstructions)));
        }
        if (updateInstructions.length > 0) {
            statements.push(renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateVariables.concat(getInstructionStatements(updateInstructions))));
        }
        return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], statements, o.INFERRED_TYPE, null, hostBindingsFnName);
    }
    return null;
}
function bindingFn(implicit, value) {
    return convertPropertyBinding(null, implicit, value, 'b');
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
            instruction = R3.syntheticHostProperty;
        }
        else {
            instruction = R3.hostProperty;
        }
    }
    return { bindingName, instruction, isAttribute: !!attrMatches };
}
function createHostListeners(eventBindings, name) {
    const listenerParams = [];
    const syntheticListenerParams = [];
    const instructions = [];
    for (const binding of eventBindings) {
        let bindingName = binding.name && sanitizeIdentifier(binding.name);
        const bindingFnName = binding.type === 1 /* ParsedEventType.Animation */ ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        const handlerName = name && bindingName ? `${name}_${bindingFnName}_HostBindingHandler` : null;
        const params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), handlerName);
        if (binding.type == 1 /* ParsedEventType.Animation */) {
            syntheticListenerParams.push(params);
        }
        else {
            listenerParams.push(params);
        }
    }
    for (const params of syntheticListenerParams) {
        instructions.push({ reference: R3.syntheticHostListener, paramsOrFn: params, span: null });
    }
    for (const params of listenerParams) {
        instructions.push({ reference: R3.listener, paramsOrFn: params, span: null });
    }
    return instructions;
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
        else if (matches[1 /* HostBindingGroup.Binding */] != null) {
            if (typeof value !== 'string') {
                // TODO(alxhub): make this a diagnostic.
                throw new Error(`Property binding must be string`);
            }
            // synthetic properties (the ones that have a `@` as a prefix)
            // are still treated the same as regular properties. Therefore
            // there is no point in storing them in a separate map.
            properties[matches[1 /* HostBindingGroup.Binding */]] = value;
        }
        else if (matches[2 /* HostBindingGroup.Event */] != null) {
            if (typeof value !== 'string') {
                // TODO(alxhub): make this a diagnostic.
                throw new Error(`Event binding must be string`);
            }
            listeners[matches[2 /* HostBindingGroup.Event */]] = value;
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
    // TODO: abstract out host bindings verification logic and use it instead of
    // creating events and properties ASTs to detect errors (FW-996)
    const bindingParser = makeBindingParser();
    bindingParser.createDirectiveHostEventAsts(bindings.listeners, sourceSpan);
    bindingParser.createBoundHostProperties(bindings.properties, sourceSpan);
    return bindingParser.errors;
}
function compileStyles(styles, selector, hostSelector) {
    const shadowCss = new ShadowCss();
    return styles.map(style => {
        return shadowCss.shimCssText(style, selector, hostSelector);
    });
}
function createHostDirectivesType(meta) {
    if (!meta.hostDirectives?.length) {
        return o.NONE_TYPE;
    }
    return o.expressionType(o.literalArr(meta.hostDirectives.map(hostMeta => o.literalMap([
        { key: 'directive', value: o.typeofExpr(hostMeta.directive.type), quoted: false },
        { key: 'inputs', value: stringMapAsLiteralExpression(hostMeta.inputs || {}), quoted: false },
        { key: 'outputs', value: stringMapAsLiteralExpression(hostMeta.outputs || {}), quoted: false },
    ]))));
}
function createHostDirectivesFeatureArg(hostDirectives) {
    const expressions = [];
    let hasForwardRef = false;
    for (const current of hostDirectives) {
        // Use a shorthand if there are no inputs or outputs.
        if (!current.inputs && !current.outputs) {
            expressions.push(current.directive.type);
        }
        else {
            const keys = [{ key: 'directive', value: current.directive.type, quoted: false }];
            if (current.inputs) {
                const inputsLiteral = createHostDirectivesMappingArray(current.inputs);
                if (inputsLiteral) {
                    keys.push({ key: 'inputs', value: inputsLiteral, quoted: false });
                }
            }
            if (current.outputs) {
                const outputsLiteral = createHostDirectivesMappingArray(current.outputs);
                if (outputsLiteral) {
                    keys.push({ key: 'outputs', value: outputsLiteral, quoted: false });
                }
            }
            expressions.push(o.literalMap(keys));
        }
        if (current.isForwardReference) {
            hasForwardRef = true;
        }
    }
    // If there's a forward reference, we generate a `function() { return [HostDir] }`,
    // otherwise we can save some bytes by using a plain array, e.g. `[HostDir]`.
    return hasForwardRef ?
        new o.FunctionExpr([], [new o.ReturnStatement(o.literalArr(expressions))]) :
        o.literalArr(expressions);
}
/**
 * Converts an input/output mapping object literal into an array where the even keys are the
 * public name of the binding and the odd ones are the name it was aliased to. E.g.
 * `{inputOne: 'aliasOne', inputTwo: 'aliasTwo'}` will become
 * `['inputOne', 'aliasOne', 'inputTwo', 'aliasTwo']`.
 *
 * This conversion is necessary, because hosts bind to the public name of the host directive and
 * keeping the mapping in an object literal will break for apps using property renaming.
 */
export function createHostDirectivesMappingArray(mapping) {
    const elements = [];
    for (const publicName in mapping) {
        if (mapping.hasOwnProperty(publicName)) {
            elements.push(o.literal(publicName), o.literal(mapping[publicName]));
        }
    }
    return elements.length > 0 ? o.literalArr(elements) : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRWhGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pGLE9BQU8sRUFBQyw2QkFBNkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRyxPQUFPLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDdEYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUF3QixrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUdySSxPQUFPLEVBQUMsa0NB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ZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHJ9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7U2hhZG93Q3NzfSBmcm9tICcuLi8uLi9zaGFkb3dfY3NzJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2JLaW5kfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zcmMvY29tcGlsYXRpb24nO1xuaW1wb3J0IHtlbWl0SG9zdEJpbmRpbmdGdW5jdGlvbiwgZW1pdFRlbXBsYXRlRm4sIHRyYW5zZm9ybX0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2VtaXQnO1xuaW1wb3J0IHtpbmdlc3RDb21wb25lbnQsIGluZ2VzdEhvc3RCaW5kaW5nfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zcmMvaW5nZXN0JztcbmltcG9ydCB7VVNFX1RFTVBMQVRFX1BJUEVMSU5FfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zd2l0Y2gnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge0JvdW5kRXZlbnR9IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZSwgUjNDb21waWxlZEV4cHJlc3Npb24sIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGEsIFIzVGVtcGxhdGVEZXBlbmRlbmN5fSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge01JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIFN0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm4sIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7YXNMaXRlcmFsLCBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwsIENPTlRFWFRfTkFNRSwgRGVmaW5pdGlvbk1hcCwgZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzLCBnZXRRdWVyeVByZWRpY2F0ZSwgSW5zdHJ1Y3Rpb24sIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuXG4vLyBUaGlzIHJlZ2V4IG1hdGNoZXMgYW55IGJpbmRpbmcgbmFtZXMgdGhhdCBjb250YWluIHRoZSBcImF0dHIuXCIgcHJlZml4LCBlLmcuIFwiYXR0ci5yZXF1aXJlZFwiXG4vLyBJZiB0aGVyZSBpcyBhIG1hdGNoLCB0aGUgZmlyc3QgbWF0Y2hpbmcgZ3JvdXAgd2lsbCBjb250YWluIHRoZSBhdHRyaWJ1dGUgbmFtZSB0byBiaW5kLlxuY29uc3QgQVRUUl9SRUdFWCA9IC9hdHRyXFwuKFteXFxdXSspLztcblxuXG5jb25zdCBDT01QT05FTlRfVkFSSUFCTEUgPSAnJUNPTVAlJztcbmNvbnN0IEhPU1RfQVRUUiA9IGBfbmdob3N0LSR7Q09NUE9ORU5UX1ZBUklBQkxFfWA7XG5jb25zdCBDT05URU5UX0FUVFIgPSBgX25nY29udGVudC0ke0NPTVBPTkVOVF9WQVJJQUJMRX1gO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGNvbnN0IHNlbGVjdG9ycyA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihtZXRhLnNlbGVjdG9yKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yczogW1snJywgJ3NvbWVEaXInLCAnJ11dYFxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3JzJywgYXNMaXRlcmFsKHNlbGVjdG9ycykpO1xuICB9XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gZS5nLiBgY29udGVudFF1ZXJpZXM6IChyZiwgY3R4LCBkaXJJbmRleCkgPT4geyAuLi4gfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY29udGVudFF1ZXJpZXMnLFxuICAgICAgICBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKG1ldGEuaXNTaWduYWwsIG1ldGEucXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAndmlld1F1ZXJ5JyxcbiAgICAgICAgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLmlzU2lnbmFsLCBtZXRhLnZpZXdRdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgICAgICAgbWV0YS5ob3N0LCBtZXRhLnR5cGVTb3VyY2VTcGFuLCBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wsIG1ldGEuc2VsZWN0b3IgfHwgJycsXG4gICAgICAgICAgbWV0YS5uYW1lLCBtZXRhLmlzU2lnbmFsLCBkZWZpbml0aW9uTWFwKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBvLmxpdGVyYWxBcnIobWV0YS5leHBvcnRBcy5tYXAoZSA9PiBvLmxpdGVyYWwoZSkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5pc1N0YW5kYWxvbmUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3RhbmRhbG9uZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2lnbmFscycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBBZGQgZmVhdHVyZXMgdG8gdGhlIGRlZmluaXRpb24gbWFwLlxuICovXG5mdW5jdGlvbiBhZGRGZWF0dXJlcyhcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGF8UjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4pIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KS52aWV3UHJvdmlkZXJzO1xuICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhtZXRhLmlucHV0cyk7XG5cbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cbiAgZm9yIChjb25zdCBrZXkgb2YgaW5wdXRLZXlzKSB7XG4gICAgaWYgKG1ldGEuaW5wdXRzW2tleV0udHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGwpIHtcbiAgICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLklucHV0VHJhbnNmb3Jtc0ZlYXR1cmVGZWF0dXJlKSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICAvLyBUT0RPOiBiZXR0ZXIgd2F5IG9mIGRpZmZlcmVudGlhdGluZyBjb21wb25lbnQgdnMgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICBpZiAobWV0YS5oYXNPd25Qcm9wZXJ0eSgndGVtcGxhdGUnKSAmJiBtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlN0YW5kYWxvbmVGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLkhvc3REaXJlY3RpdmVzRmVhdHVyZSkuY2FsbEZuKFtjcmVhdGVIb3N0RGlyZWN0aXZlc0ZlYXR1cmVBcmcoXG4gICAgICAgIG1ldGEuaG9zdERpcmVjdGl2ZXMpXSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcbiAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID0gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgY29tcG9uZW50IGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0NvbXBvbmVudE1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsXG4gICAgICAgICAgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgLy8gVGVtcGxhdGUgY29tcGlsYXRpb24gaXMgY3VycmVudGx5IGNvbmRpdGlvbmFsIGFzIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIHJld3JpdGluZyBpdC5cbiAgaWYgKCFVU0VfVEVNUExBVEVfUElQRUxJTkUpIHtcbiAgICAvLyBUaGlzIGlzIHRoZSBtYWluIHBhdGggY3VycmVudGx5IHVzZWQgaW4gY29tcGlsYXRpb24sIHdoaWNoIGNvbXBpbGVzIHRoZSB0ZW1wbGF0ZSB3aXRoIHRoZVxuICAgIC8vIGxlZ2FjeSBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAuXG5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gICAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLmNyZWF0ZVJvb3RTY29wZSgpLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICAgIFIzLm5hbWVzcGFjZUhUTUwsIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzLCBtZXRhLmRlZmVyQmxvY2tzLFxuICAgICAgICBuZXcgTWFwKCkpO1xuXG4gICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgdGhpcyBzbyB0aGF0IGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjb21wb25lbnRzIGtub3cgd2hhdFxuICAgIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzXG4gICAgLy8gICAgIGluc3RhbnRpYXRlZC5cbiAgICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycykge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgfVxuXG4gICAgLy8gZS5nLiBgZGVjbHM6IDJgXG4gICAgLy8gZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xzJywgby5saXRlcmFsKHRwbC5yb290LmRlY2xzISkpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgICAvLyBlLmcuIGB2YXJzOiAyYFxuICAgIC8vIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRwbC5yb290LnZhcnMhKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICAgIC8vIEdlbmVyYXRlIGBjb25zdHNgIHNlY3Rpb24gb2YgQ29tcG9uZW50RGVmOlxuICAgIC8vIC0gZWl0aGVyIGFzIGFuIGFycmF5OlxuICAgIC8vICAgYGNvbnN0czogW1snb25lJywgJ3R3byddLCBbJ3RocmVlJywgJ2ZvdXInXV1gXG4gICAgLy8gLSBvciBhcyBhIGZhY3RvcnkgZnVuY3Rpb24gaW4gY2FzZSBhZGRpdGlvbmFsIHN0YXRlbWVudHMgYXJlIHByZXNlbnQgKHRvIHN1cHBvcnQgaTE4bik6XG4gICAgLy8gICBgY29uc3RzOiAoKSA9PiB7IHZhciBpMThuXzA7IGlmIChuZ0kxOG5DbG9zdXJlTW9kZSkgey4uLn0gZWxzZSB7Li4ufSByZXR1cm4gW2kxOG5fMF07XG4gICAgLy8gICB9YFxuICAgIGNvbnN0IHtjb25zdEV4cHJlc3Npb25zLCBwcmVwYXJlU3RhdGVtZW50c30gPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RzKCk7XG4gICAgaWYgKGNvbnN0RXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IGNvbnN0c0V4cHI6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkFycm93RnVuY3Rpb25FeHByID0gby5saXRlcmFsQXJyKGNvbnN0RXhwcmVzc2lvbnMpO1xuICAgICAgLy8gUHJlcGFyZSBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50IC0gdHVybiBgY29uc3RzYCBpbnRvIGEgZnVuY3Rpb24uXG4gICAgICBpZiAocHJlcGFyZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdHNFeHByID0gby5hcnJvd0ZuKFtdLCBbLi4ucHJlcGFyZVN0YXRlbWVudHMsIG5ldyBvLlJldHVyblN0YXRlbWVudChjb25zdHNFeHByKV0pO1xuICAgICAgfVxuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIGNvbnN0c0V4cHIpO1xuICAgIH1cblxuICAgIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGlzIHBhdGggY29tcGlsZXMgdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBwcm90b3R5cGUgdGVtcGxhdGUgcGlwZWxpbmUuIEZpcnN0IHRoZSB0ZW1wbGF0ZSBpc1xuICAgIC8vIGluZ2VzdGVkIGludG8gSVI6XG4gICAgY29uc3QgdHBsID0gaW5nZXN0Q29tcG9uZW50KFxuICAgICAgICBtZXRhLm5hbWUsIG1ldGEuaXNTaWduYWwsIG1ldGEudGVtcGxhdGUubm9kZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCxcbiAgICAgICAgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMpO1xuXG4gICAgLy8gVGhlbiB0aGUgSVIgaXMgdHJhbnNmb3JtZWQgdG8gcHJlcGFyZSBpdCBmb3IgY29kIGVnZW5lcmF0aW9uLlxuICAgIHRyYW5zZm9ybSh0cGwsIENvbXBpbGF0aW9uSm9iS2luZC5UbXBsKTtcblxuICAgIC8vIEZpbmFsbHkgd2UgZW1pdCB0aGUgdGVtcGxhdGUgZnVuY3Rpb246XG4gICAgY29uc3QgdGVtcGxhdGVGbiA9IGVtaXRUZW1wbGF0ZUZuKHRwbCwgY29uc3RhbnRQb29sKTtcblxuICAgIGlmICh0cGwuY29udGVudFNlbGVjdG9ycyAhPT0gbnVsbCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIHRwbC5jb250ZW50U2VsZWN0b3JzKTtcbiAgICB9XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodHBsLnJvb3QuZGVjbHMgYXMgbnVtYmVyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodHBsLnJvb3QudmFycyBhcyBudW1iZXIpKTtcbiAgICBpZiAodHBsLmNvbnN0cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAodHBsLmNvbnN0c0luaXRpYWxpemVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmFycm93Rm4oW10sIFtcbiAgICAgICAgICAuLi50cGwuY29uc3RzSW5pdGlhbGl6ZXJzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKVxuICAgICAgICBdKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGbik7XG4gIH1cblxuICBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkICYmXG4gICAgICBtZXRhLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkZXBlbmRlbmNpZXMnLFxuICAgICAgICBjb21waWxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgICAgICAgby5saXRlcmFsQXJyKG1ldGEuZGVjbGFyYXRpb25zLm1hcChkZWNsID0+IGRlY2wudHlwZSkpLCBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSA9PT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkKSB7XG4gICAgY29uc3QgYXJncyA9IFttZXRhLnR5cGUudmFsdWVdO1xuICAgIGlmIChtZXRhLnJhd0ltcG9ydHMpIHtcbiAgICAgIGFyZ3MucHVzaChtZXRhLnJhd0ltcG9ydHMpO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVwZW5kZW5jaWVzJywgby5pbXBvcnRFeHByKFIzLmdldENvbXBvbmVudERlcHNGYWN0b3J5KS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHlsZU5vZGVzID0gc3R5bGVWYWx1ZXMucmVkdWNlKChyZXN1bHQsIHN0eWxlKSA9PiB7XG4gICAgICBpZiAoc3R5bGUudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVzdWx0LnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWwoc3R5bGUpKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sIFtdIGFzIG8uRXhwcmVzc2lvbltdKTtcblxuICAgIGlmIChzdHlsZU5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3R5bGVOb2RlcykpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBTZXR0aW5nIGNoYW5nZSBkZXRlY3Rpb24gZmxhZ1xuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIG1ldGEuY2hhbmdlRGV0ZWN0aW9uID09PSAnbnVtYmVyJyAmJlxuICAgICAgICBtZXRhLmNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgcmVzb2x2ZWQgZHVyaW5nIGFuYWx5c2lzLiBPbmx5IHNldCBpdCBpZiBub3QgdGhlIGRlZmF1bHQuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKG1ldGEuY2hhbmdlRGV0ZWN0aW9uKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YS5jaGFuZ2VEZXRlY3Rpb24gPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgbm90IHJlc29sdmVkIGR1cmluZyBhbmFseXNpcyAoZS5nLiwgd2UgYXJlIGluIGxvY2FsIGNvbXBpbGF0aW9uIG1vZGUpLlxuICAgICAgLy8gU28gcGxhY2UgaXQgYXMgaXMuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgbWV0YS5jaGFuZ2VEZXRlY3Rpb24pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgdHlwZSBzcGVjaWZpY2F0aW9uIGZyb20gdGhlIGNvbXBvbmVudCBtZXRhLiBUaGlzIHR5cGUgaXMgaW5zZXJ0ZWQgaW50byAuZC50cyBmaWxlc1xuICogdG8gYmUgY29uc3VtZWQgYnkgdXBzdHJlYW0gY29tcGlsYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pik6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgdHlwZVBhcmFtcy5wdXNoKHN0cmluZ0FycmF5QXNUeXBlKG1ldGEudGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzKSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQ29tcG9uZW50RGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgYXJyYXkgbGl0ZXJhbCBvZiBkZWNsYXJhdGlvbnMgaW50byBhbiBleHByZXNzaW9uIGFjY29yZGluZyB0byB0aGUgcHJvdmlkZWQgZW1pdFxuICogbW9kZS5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZURlY2xhcmF0aW9uTGlzdChcbiAgICBsaXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIG1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKTogby5FeHByZXNzaW9uIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3Q6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlOlxuICAgICAgLy8gZGlyZWN0aXZlczogZnVuY3Rpb24gKCkgeyByZXR1cm4gW015RGlyXTsgfVxuICAgICAgcmV0dXJuIG8uYXJyb3dGbihbXSwgbGlzdCk7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQ6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbTXlEaXJdLm1hcChuZy5yZXNvbHZlRm9yd2FyZFJlZik7IH1cbiAgICAgIGNvbnN0IHJlc29sdmVkTGlzdCA9IGxpc3QucHJvcCgnbWFwJykuY2FsbEZuKFtvLmltcG9ydEV4cHIoUjMucmVzb2x2ZUZvcndhcmRSZWYpXSk7XG4gICAgICByZXR1cm4gby5hcnJvd0ZuKFtdLCByZXNvbHZlZExpc3QpO1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB3aXRoIGFuIGFycmF5IG9mIHByZS1yZXNvbHZlZCBkZXBlbmRlbmNpZXNgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCksIG8ubGl0ZXJhbCh0b1F1ZXJ5RmxhZ3MocXVlcnkpKV07XG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vKipcbiAqIEEgc2V0IG9mIGZsYWdzIHRvIGJlIHVzZWQgd2l0aCBRdWVyaWVzLlxuICpcbiAqIE5PVEU6IEVuc3VyZSBjaGFuZ2VzIGhlcmUgYXJlIGluIHN5bmMgd2l0aCBgcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnRlcmZhY2VzL3F1ZXJ5LnRzYFxuICovXG5leHBvcnQgY29uc3QgZW51bSBRdWVyeUZsYWdzIHtcbiAgLyoqXG4gICAqIE5vIGZsYWdzXG4gICAqL1xuICBub25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgcXVlcnkgc2hvdWxkIGRlc2NlbmQgaW50byBjaGlsZHJlbi5cbiAgICovXG4gIGRlc2NlbmRhbnRzID0gMGIwMDAxLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgY2FuIGJlIGNvbXB1dGVkIHN0YXRpY2FsbHkgYW5kIGhlbmNlIGNhbiBiZSBhc3NpZ25lZCBlYWdlcmx5LlxuICAgKlxuICAgKiBOT1RFOiBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIFZpZXdFbmdpbmUuXG4gICAqL1xuICBpc1N0YXRpYyA9IDBiMDAxMCxcblxuICAvKipcbiAgICogSWYgdGhlIGBRdWVyeUxpc3RgIHNob3VsZCBmaXJlIGNoYW5nZSBldmVudCBvbmx5IGlmIGFjdHVhbCBjaGFuZ2UgdG8gcXVlcnkgd2FzIGNvbXB1dGVkICh2cyBvbGRcbiAgICogYmVoYXZpb3Igd2hlcmUgdGhlIGNoYW5nZSB3YXMgZmlyZWQgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHdhcyByZWNvbXB1dGVkLCBldmVuIGlmIHRoZSByZWNvbXB1dGVkXG4gICAqIHF1ZXJ5IHJlc3VsdGVkIGluIHRoZSBzYW1lIGxpc3QuKVxuICAgKi9cbiAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgPSAwYjAxMDAsXG59XG5cbi8qKlxuICogVHJhbnNsYXRlcyBxdWVyeSBmbGFncyBpbnRvIGBUUXVlcnlGbGFnc2AgdHlwZSBpbiBwYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2ludGVyZmFjZXMvcXVlcnkudHNcbiAqIEBwYXJhbSBxdWVyeVxuICovXG5mdW5jdGlvbiB0b1F1ZXJ5RmxhZ3MocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG51bWJlciB7XG4gIHJldHVybiAocXVlcnkuZGVzY2VuZGFudHMgPyBRdWVyeUZsYWdzLmRlc2NlbmRhbnRzIDogUXVlcnlGbGFncy5ub25lKSB8XG4gICAgICAocXVlcnkuc3RhdGljID8gUXVlcnlGbGFncy5pc1N0YXRpYyA6IFF1ZXJ5RmxhZ3Mubm9uZSkgfFxuICAgICAgKHF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8gUXVlcnlGbGFncy5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSA6IFF1ZXJ5RmxhZ3Mubm9uZSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgaXNTaWduYWw6IGJvb2xlYW4sIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgcXVlcmllcykge1xuICAgIGlmIChpc1NpZ25hbCkge1xuICAgICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5jb250ZW50UXVlcnlDcmVhdGUpXG4gICAgICAgICAgICAgIC5jYWxsRm4oW1xuICAgICAgICAgICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKS5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSksXG4gICAgICAgICAgICAgICAgLy8gVE9ETyhzaWduYWxzKTogYGRpckluZGV4YCBpcyBub3QgYWN0dWFsbHkgdXNlZCBhdCBhbGwuIENhbiByZW1vdmU/XG4gICAgICAgICAgICAgICAgby52YXJpYWJsZSgnZGlySW5kZXgnKSwgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpXG4gICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgIC50b1N0bXQoKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5jb250ZW50UXVlcnkoZGlySW5kZXgsIHNvbWVQcmVkaWNhdGUsIHRydWUsIG51bGwpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLmNvbnRlbnRRdWVyeSlcbiAgICAgICAgICAgIC5jYWxsRm4oW28udmFyaWFibGUoJ2RpckluZGV4JyksIC4uLnByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSBhcyBhbnldKVxuICAgICAgICAgICAgLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnRRdWVyaWVzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGw7XG4gIGNvbnN0IGJvZHkgPSBbXG4gICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgXTtcblxuICAvLyBTaWduYWwgZGlyZWN0aXZlcyBtYXkgbm90IGdlbmVyYXRlIHVwZGF0ZSBzdGF0ZW1lbnRzLlxuICBpZiAodXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgYm9keS5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICB9XG5cbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgYm9keSwgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd8c3RyaW5nW119KTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAobWFwVmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXJyYXlBc1R5cGUoYXJyOiBSZWFkb25seUFycmF5PHN0cmluZ3xudWxsPik6IG8uVHlwZSB7XG4gIHJldHVybiBhcnIubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKGFyci5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG8uTk9ORV9UWVBFO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlW10ge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gbWV0YS5zZWxlY3RvciAhPT0gbnVsbCA/IG1ldGEuc2VsZWN0b3IucmVwbGFjZSgvXFxuL2csICcnKSA6IG51bGw7XG5cbiAgcmV0dXJuIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpLFxuICAgIHNlbGVjdG9yRm9yVHlwZSAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShzZWxlY3RvckZvclR5cGUpIDogby5OT05FX1RZUEUsXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FycmF5QXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgby5leHByZXNzaW9uVHlwZShnZXRJbnB1dHNUeXBlRXhwcmVzc2lvbihtZXRhKSksXG4gICAgby5leHByZXNzaW9uVHlwZShzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKG1ldGEub3V0cHV0cykpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdO1xufVxuXG5mdW5jdGlvbiBnZXRJbnB1dHNUeXBlRXhwcmVzc2lvbihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChPYmplY3Qua2V5cyhtZXRhLmlucHV0cykubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBtZXRhLmlucHV0c1trZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsTWFwKFtcbiAgICAgICAge2tleTogJ2FsaWFzJywgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZS5iaW5kaW5nUHJvcGVydHlOYW1lKSwgcXVvdGVkOiB0cnVlfSxcbiAgICAgICAge2tleTogJ3JlcXVpcmVkJywgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZS5yZXF1aXJlZCksIHF1b3RlZDogdHJ1ZX1cbiAgICAgIF0pLFxuICAgICAgcXVvdGVkOiB0cnVlXG4gICAgfTtcbiAgfSkpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIHR5cGUgc3BlY2lmaWNhdGlvbiBmcm9tIHRoZSBkaXJlY3RpdmUgbWV0YS4gVGhpcyB0eXBlIGlzIGluc2VydGVkIGludG8gLmQudHMgZmlsZXNcbiAqIHRvIGJlIGNvbnN1bWVkIGJ5IHVwc3RyZWFtIGNvbXBpbGF0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgLy8gRGlyZWN0aXZlcyBoYXZlIG5vIE5nQ29udGVudFNlbGVjdG9ycyBzbG90LCBidXQgaW5zdGVhZCBleHByZXNzIGEgYG5ldmVyYCB0eXBlXG4gIC8vIHNvIHRoYXQgZnV0dXJlIGZpZWxkcyBhbGlnbi5cbiAgdHlwZVBhcmFtcy5wdXNoKG8uTk9ORV9UWVBFKTtcbiAgdHlwZVBhcmFtcy5wdXNoKG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKG1ldGEuaXNTdGFuZGFsb25lKSkpO1xuICB0eXBlUGFyYW1zLnB1c2goY3JlYXRlSG9zdERpcmVjdGl2ZXNUeXBlKG1ldGEpKTtcbiAgLy8gVE9ETyhzaWduYWxzKTogQWx3YXlzIGluY2x1ZGUgdGhpcyBtZXRhZGF0YSBzdGFydGluZyB3aXRoIHYxNy4gUmlnaHRcbiAgLy8gbm93IEFuZ3VsYXIgdjE2LjAueCBkb2VzIG5vdCBzdXBwb3J0IHRoaXMgZmllbGQgYW5kIGxpYnJhcnkgZGlzdHJpYnV0aW9uc1xuICAvLyB3b3VsZCB0aGVuIGJlIGluY29tcGF0aWJsZSB3aXRoIHYxNi4wLnggZnJhbWV3b3JrIHVzZXJzLlxuICBpZiAobWV0YS5pc1NpZ25hbCkge1xuICAgIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU2lnbmFsKSkpO1xuICB9XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5EaXJlY3RpdmVEZWNsYXJhdGlvbiwgdHlwZVBhcmFtcykpO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIGlzU2lnbmFsOiBib29sZWFuLCB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIG5hbWU/OiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdGVtcEFsbG9jYXRvciA9IHRlbXBvcmFyeUFsbG9jYXRvcih1cGRhdGVTdGF0ZW1lbnRzLCBURU1QT1JBUllfTkFNRSk7XG5cbiAgdmlld1F1ZXJpZXMuZm9yRWFjaCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgIGlmIChpc1NpZ25hbCkge1xuICAgICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihSMy52aWV3UXVlcnlDcmVhdGUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKS5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50b1N0bXQoKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMudmlld1F1ZXJ5KHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9XG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy52aWV3UXVlcnkpLmNhbGxGbihwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnksIGNvbnN0YW50UG9vbCkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFF1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9KTtcblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fUXVlcnlgIDogbnVsbDtcbiAgY29uc3QgYm9keSA9IFtcbiAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICBdO1xuXG4gIC8vIFNpZ25hbCBkaXJlY3RpdmVzIG1heSBub3QgZ2VuZXJhdGUgdXBkYXRlIHN0YXRlbWVudHMuXG4gIGlmICh1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBib2R5LnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKSk7XG4gIH1cblxuICByZXR1cm4gby5mbihcbiAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sIGJvZHksXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHZpZXdRdWVyeUZuTmFtZSk7XG59XG5cbi8vIFJldHVybiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgaG9zdEJpbmRpbmdzTWV0YWRhdGE6IFIzSG9zdE1ldGFkYXRhLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBzZWxlY3Rvcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsXG4gICAgaXNTaWduYWw6IGJvb2xlYW4sIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXApOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhob3N0QmluZGluZ3NNZXRhZGF0YS5wcm9wZXJ0aWVzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoaG9zdEJpbmRpbmdzTWV0YWRhdGEubGlzdGVuZXJzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgaWYgKFVTRV9URU1QTEFURV9QSVBFTElORSkge1xuICAgIC8vIFRoZSBwYXJzZXIgZm9yIGhvc3QgYmluZGluZ3MgdHJlYXRzIGNsYXNzIGFuZCBzdHlsZSBhdHRyaWJ1dGVzIHNwZWNpYWxseSAtLSB0aGV5IGFyZVxuICAgIC8vIGV4dHJhY3RlZCBpbnRvIHRoZXNlIHNlcGFyYXRlIGZpZWxkcy4gVGhpcyBpcyBub3QgdGhlIGNhc2UgZm9yIHRlbXBsYXRlcywgc28gdGhlIGNvbXBpbGVyIGNhblxuICAgIC8vIGFjdHVhbGx5IGFscmVhZHkgaGFuZGxlIHRoZXNlIHNwZWNpYWwgYXR0cmlidXRlcyBpbnRlcm5hbGx5LiBUaGVyZWZvcmUsIHdlIGp1c3QgZHJvcCB0aGVtXG4gICAgLy8gaW50byB0aGUgYXR0cmlidXRlcyBtYXAuXG4gICAgaWYgKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgICAgaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlc1snc3R5bGUnXSA9XG4gICAgICAgICAgby5saXRlcmFsKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cik7XG4gICAgfVxuICAgIGlmIChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICAgIGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXNbJ2NsYXNzJ10gPVxuICAgICAgICAgIG8ubGl0ZXJhbChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3RKb2IgPSBpbmdlc3RIb3N0QmluZGluZyhcbiAgICAgICAge1xuICAgICAgICAgIGlzU2lnbmFsLFxuICAgICAgICAgIGNvbXBvbmVudE5hbWU6IG5hbWUsXG4gICAgICAgICAgcHJvcGVydGllczogYmluZGluZ3MsXG4gICAgICAgICAgZXZlbnRzOiBldmVudEJpbmRpbmdzLFxuICAgICAgICAgIGF0dHJpYnV0ZXM6IGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXMsXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnN0YW50UG9vbCk7XG4gICAgdHJhbnNmb3JtKGhvc3RKb2IsIENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KTtcblxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0QXR0cnMnLCBob3N0Sm9iLnJvb3QuYXR0cmlidXRlcyk7XG5cbiAgICBjb25zdCB2YXJDb3VudCA9IGhvc3RKb2Iucm9vdC52YXJzO1xuICAgIGlmICh2YXJDb3VudCAhPT0gbnVsbCAmJiB2YXJDb3VudCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbCh2YXJDb3VudCkpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0SG9zdEJpbmRpbmdGdW5jdGlvbihob3N0Sm9iKTtcbiAgfVxuICBjb25zdCBiaW5kaW5nQ29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgY29uc3Qgc3R5bGVCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKGJpbmRpbmdDb250ZXh0KTtcblxuICBjb25zdCB7c3R5bGVBdHRyLCBjbGFzc0F0dHJ9ID0gaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXM7XG4gIGlmIChzdHlsZUF0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cihzdHlsZUF0dHIpO1xuICB9XG4gIGlmIChjbGFzc0F0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cihjbGFzc0F0dHIpO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlSW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG4gIGNvbnN0IHVwZGF0ZUluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICBjb25zdCB1cGRhdGVWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBjb25zdCBob3N0QmluZGluZ1NvdXJjZVNwYW4gPSB0eXBlU291cmNlU3BhbjtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjcmVhdGVJbnN0cnVjdGlvbnMucHVzaCguLi5jcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3MsIG5hbWUpKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBhbGxPdGhlckJpbmRpbmdzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG5cbiAgLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIHRvdGFsIGFtb3VudCBvZiBiaW5kaW5nIHNsb3RzIHJlcXVpcmVkIGJ5XG4gIC8vIGFsbCB0aGUgaW5zdHJ1Y3Rpb25zIHRvZ2V0aGVyIGJlZm9yZSBhbnkgdmFsdWUgY29udmVyc2lvbnMgaGFwcGVuLlxuICAvLyBWYWx1ZSBjb252ZXJzaW9ucyBtYXkgcmVxdWlyZSBhZGRpdGlvbmFsIHNsb3RzIGZvciBpbnRlcnBvbGF0aW9uIGFuZFxuICAvLyBiaW5kaW5ncyB3aXRoIHBpcGVzLiBUaGVzZSBjYWxjdWxhdGVzIGhhcHBlbiBhZnRlciB0aGlzIGJsb2NrLlxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gMDtcbiAgYmluZGluZ3MgJiYgYmluZGluZ3MuZm9yRWFjaCgoYmluZGluZzogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKFxuICAgICAgICBiaW5kaW5nLm5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgICBpZiAoc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gTUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWxsT3RoZXJCaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50Kys7XG4gICAgfVxuICB9KTtcblxuICBsZXQgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBjb25zdCBnZXRWYWx1ZUNvbnZlcnRlciA9ICgpID0+IHtcbiAgICBpZiAoIXZhbHVlQ29udmVydGVyKSB7XG4gICAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICAgIH07XG4gICAgICB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCAgLy8gbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICAgICAgICBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTsgIC8vIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlQ29udmVydGVyO1xuICB9O1xuXG4gIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljSG9zdEJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGFsbE90aGVyQmluZGluZ3MpIHtcbiAgICAvLyByZXNvbHZlIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG9iamVjdHNcbiAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdChnZXRWYWx1ZUNvbnZlcnRlcigpKTtcbiAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUpO1xuXG4gICAgY29uc3Qge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGV9ID0gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nKTtcblxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3IsIGJpbmRpbmdOYW1lLCBpc0F0dHJpYnV0ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBjb3JlLlNlY3VyaXR5Q29udGV4dC5OT05FKTtcblxuICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoKSB7XG4gICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCkgPiAtMSkge1xuICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHNvbWUgVVJMIGF0dHJpYnV0ZXMgKHN1Y2ggYXMgXCJzcmNcIiBhbmQgXCJocmVmXCIpIHRoYXQgbWF5IGJlIGEgcGFydFxuICAgICAgICAvLyBvZiBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW5pdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zID0gW28ubGl0ZXJhbChiaW5kaW5nTmFtZSksIGJpbmRpbmdFeHByLmN1cnJWYWxFeHByXTtcbiAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0XG4gICAgICAvLyBvZiBhbiBhdHRyaWJ1dGUvcHJvcGVydHkgYmluZGluZyAtIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXNcbiAgICAgIC8vIG9uZSBvZiB0aGUgc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMuXG4gICAgICAvLyBOb3RlOiBmb3IgaG9zdCBiaW5kaW5ncyBkZWZpbmVkIG9uIGEgZGlyZWN0aXZlLCB3ZSBkbyBub3QgdHJ5IHRvIGZpbmQgYWxsXG4gICAgICAvLyBwb3NzaWJsZSBwbGFjZXMgd2hlcmUgaXQgY2FuIGJlIG1hdGNoZWQsIHNvIHdlIGNhbiBub3QgZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgIC8vIHRoZSBob3N0IGVsZW1lbnQgaXMgYW4gPGlmcmFtZT4uIEluIHRoaXMgY2FzZSwgaWYgYW4gYXR0cmlidXRlL2JpbmRpbmdcbiAgICAgIC8vIG5hbWUgaXMgaW4gdGhlIGBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTYCBzZXQgLSBhcHBlbmQgYSB2YWxpZGF0aW9uXG4gICAgICAvLyBmdW5jdGlvbiwgd2hpY2ggd291bGQgYmUgaW52b2tlZCBhdCBydW50aW1lIGFuZCB3b3VsZCBoYXZlIGFjY2VzcyB0byB0aGVcbiAgICAgIC8vIHVuZGVybHlpbmcgRE9NIGVsZW1lbnQsIGNoZWNrIGlmIGl0J3MgYW4gPGlmcmFtZT4gYW5kIGlmIHNvIC0gcnVucyBleHRyYSBjaGVja3MuXG4gICAgICBpZiAoaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIoYmluZGluZ05hbWUpKSB7XG4gICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5pbXBvcnRFeHByKFIzLnZhbGlkYXRlSWZyYW1lQXR0cmlidXRlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlVmFyaWFibGVzLnB1c2goLi4uYmluZGluZ0V4cHIuc3RtdHMpO1xuXG4gICAgaWYgKGluc3RydWN0aW9uID09PSBSMy5ob3N0UHJvcGVydHkpIHtcbiAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuYXR0cmlidXRlKSB7XG4gICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uID09PSBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHkpIHtcbiAgICAgIHN5bnRoZXRpY0hvc3RCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogaW5zdHJ1Y3Rpb24sIHBhcmFtc09yRm46IGluc3RydWN0aW9uUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nUGFyYW1zIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5ob3N0UHJvcGVydHksIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBhdHRyaWJ1dGVCaW5kaW5ncykge1xuICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLmF0dHJpYnV0ZSwgcGFyYW1zT3JGbjogYmluZGluZ1BhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nUGFyYW1zIG9mIHN5bnRoZXRpY0hvc3RCaW5kaW5ncykge1xuICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKFxuICAgICAgICB7cmVmZXJlbmNlOiBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHksIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzKTtcbiAgc3R5bGVCdWlsZGVyLmFzc2lnbkhvc3RBdHRycyhob3N0QXR0cnMsIGRlZmluaXRpb25NYXApO1xuXG4gIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3MpIHtcbiAgICAvLyBmaW5hbGx5IGVhY2ggYmluZGluZyB0aGF0IHdhcyByZWdpc3RlcmVkIGluIHRoZSBzdGF0ZW1lbnQgYWJvdmUgd2lsbCBuZWVkIHRvIGJlIGFkZGVkIHRvXG4gICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgIC8vIGFyZSBldmFsdWF0ZWQgYW5kIHVwZGF0ZWQgZm9yIHRoZSBlbGVtZW50LlxuICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKGdldFZhbHVlQ29udmVydGVyKCkpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgZm9yIChjb25zdCBjYWxsIG9mIGluc3RydWN0aW9uLmNhbGxzKSB7XG4gICAgICAgIC8vIHdlIHN1YnRyYWN0IGEgdmFsdWUgb2YgYDFgIGhlcmUgYmVjYXVzZSB0aGUgYmluZGluZyBzbG90IHdhcyBhbHJlYWR5IGFsbG9jYXRlZFxuICAgICAgICAvLyBhdCB0aGUgdG9wIG9mIHRoaXMgbWV0aG9kIHdoZW4gYWxsIHRoZSBpbnB1dCBiaW5kaW5ncyB3ZXJlIGNvdW50ZWQuXG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPVxuICAgICAgICAgICAgTWF0aC5tYXgoY2FsbC5hbGxvY2F0ZUJpbmRpbmdTbG90cyAtIE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIDApO1xuXG4gICAgICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICByZWZlcmVuY2U6IGluc3RydWN0aW9uLnJlZmVyZW5jZSxcbiAgICAgICAgICBwYXJhbXNPckZuOiBjb252ZXJ0U3R5bGluZ0NhbGwoY2FsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbiksXG4gICAgICAgICAgc3BhbjogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdFZhcnMnLCBvLmxpdGVyYWwodG90YWxIb3N0VmFyc0NvdW50KSk7XG4gIH1cblxuICBpZiAoY3JlYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDAgfHwgdXBkYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKGNyZWF0ZUluc3RydWN0aW9ucykpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLFxuICAgICAgICAgIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQoZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKHVwZGF0ZUluc3RydWN0aW9ucykpKSk7XG4gICAgfVxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLCBzdGF0ZW1lbnRzLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYmluZGluZ0ZuKGltcGxpY2l0OiBhbnksIHZhbHVlOiBBU1QpIHtcbiAgcmV0dXJuIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcobnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3R5bGluZ0NhbGwoXG4gICAgY2FsbDogU3R5bGluZ0luc3RydWN0aW9uQ2FsbCwgYmluZGluZ0NvbnRleHQ6IGFueSwgYmluZGluZ0ZuOiBGdW5jdGlvbikge1xuICByZXR1cm4gY2FsbC5wYXJhbXModmFsdWUgPT4gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSkuY3VyclZhbEV4cHIpO1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KTpcbiAgICB7YmluZGluZ05hbWU6IHN0cmluZywgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzQXR0cmlidXRlOiBib29sZWFufSB7XG4gIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgbGV0IGluc3RydWN0aW9uITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5hdHRyaWJ1dGU7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJpbmRpbmcuaXNBbmltYXRpb24pIHtcbiAgICAgIGJpbmRpbmdOYW1lID0gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShiaW5kaW5nTmFtZSk7XG4gICAgICAvLyBob3N0IGJpbmRpbmdzIHRoYXQgaGF2ZSBhIHN5bnRoZXRpYyBwcm9wZXJ0eSAoZS5nLiBAZm9vKSBzaG91bGQgYWx3YXlzIGJlIHJlbmRlcmVkXG4gICAgICAvLyBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcG9uZW50IGFuZCBub3QgdGhlIHBhcmVudC4gVGhlcmVmb3JlIHRoZXJlIGlzIGEgc3BlY2lhbFxuICAgICAgLy8gY29tcGF0aWJpbGl0eSBpbnN0cnVjdGlvbiBhdmFpbGFibGUgZm9yIHRoaXMgcHVycG9zZS5cbiAgICAgIGluc3RydWN0aW9uID0gUjMuc3ludGhldGljSG9zdFByb3BlcnR5O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmhvc3RQcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGU6ICEhYXR0ck1hdGNoZXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sIG5hbWU/OiBzdHJpbmcpOiBJbnN0cnVjdGlvbltdIHtcbiAgY29uc3QgbGlzdGVuZXJQYXJhbXM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljTGlzdGVuZXJQYXJhbXM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGV2ZW50QmluZGluZ3MpIHtcbiAgICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IGJpbmRpbmcudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShiaW5kaW5nTmFtZSwgYmluZGluZy50YXJnZXRPclBoYXNlKSA6XG4gICAgICAgIGJpbmRpbmdOYW1lO1xuICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gbmFtZSAmJiBiaW5kaW5nTmFtZSA/IGAke25hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKEJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGJpbmRpbmcpLCBoYW5kbGVyTmFtZSk7XG5cbiAgICBpZiAoYmluZGluZy50eXBlID09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zLnB1c2gocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdGVuZXJQYXJhbXMucHVzaChwYXJhbXMpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgcGFyYW1zIG9mIHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMuc3ludGhldGljSG9zdExpc3RlbmVyLCBwYXJhbXNPckZuOiBwYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgcGFyYW1zIG9mIGxpc3RlbmVyUGFyYW1zKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMubGlzdGVuZXIsIHBhcmFtc09yRm46IHBhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgcmV0dXJuIGluc3RydWN0aW9ucztcbn1cblxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuLy8gRGVmaW5lcyBIb3N0IEJpbmRpbmdzIHN0cnVjdHVyZSB0aGF0IGNvbnRhaW5zIGF0dHJpYnV0ZXMsIGxpc3RlbmVycywgYW5kIHByb3BlcnRpZXMsXG4vLyBwYXJzZWQgZnJvbSB0aGUgYGhvc3RgIG9iamVjdCBkZWZpbmVkIGZvciBhIFR5cGUuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ3xvLkV4cHJlc3Npb259KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO30gPSB7fTtcblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhob3N0KSkge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcblxuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgLy8gc3ludGhldGljIHByb3BlcnRpZXMgKHRoZSBvbmVzIHRoYXQgaGF2ZSBhIGBAYCBhcyBhIHByZWZpeClcbiAgICAgIC8vIGFyZSBzdGlsbCB0cmVhdGVkIHRoZSBzYW1lIGFzIHJlZ3VsYXIgcHJvcGVydGllcy4gVGhlcmVmb3JlXG4gICAgICAvLyB0aGVyZSBpcyBubyBwb2ludCBpbiBzdG9yaW5nIHRoZW0gaW4gYSBzZXBhcmF0ZSBtYXAuXG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBzcGVjaWFsQXR0cmlidXRlc307XG59XG5cbi8qKlxuICogVmVyaWZpZXMgaG9zdCBiaW5kaW5ncyBhbmQgcmV0dXJucyB0aGUgbGlzdCBvZiBlcnJvcnMgKGlmIGFueSkuIEVtcHR5IGFycmF5IGluZGljYXRlcyB0aGF0IGFcbiAqIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzIGhhcyBubyBlcnJvcnMuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdzIHNldCBvZiBob3N0IGJpbmRpbmdzIHRvIHZlcmlmeS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIHNvdXJjZSBzcGFuIHdoZXJlIGhvc3QgYmluZGluZ3Mgd2VyZSBkZWZpbmVkLlxuICogQHJldHVybnMgYXJyYXkgb2YgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCBhIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5SG9zdEJpbmRpbmdzKFxuICAgIGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3MsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFBhcnNlRXJyb3JbXSB7XG4gIC8vIFRPRE86IGFic3RyYWN0IG91dCBob3N0IGJpbmRpbmdzIHZlcmlmaWNhdGlvbiBsb2dpYyBhbmQgdXNlIGl0IGluc3RlYWQgb2ZcbiAgLy8gY3JlYXRpbmcgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIEFTVHMgdG8gZGV0ZWN0IGVycm9ycyAoRlctOTk2KVxuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGJpbmRpbmdzLmxpc3RlbmVycywgc291cmNlU3Bhbik7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhiaW5kaW5ncy5wcm9wZXJ0aWVzLCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGJpbmRpbmdQYXJzZXIuZXJyb3JzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHtcbiAgICByZXR1cm4gc2hhZG93Q3NzIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlc1R5cGUobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZSB7XG4gIGlmICghbWV0YS5ob3N0RGlyZWN0aXZlcz8ubGVuZ3RoKSB7XG4gICAgcmV0dXJuIG8uTk9ORV9UWVBFO1xuICB9XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKG1ldGEuaG9zdERpcmVjdGl2ZXMubWFwKGhvc3RNZXRhID0+IG8ubGl0ZXJhbE1hcChbXG4gICAge2tleTogJ2RpcmVjdGl2ZScsIHZhbHVlOiBvLnR5cGVvZkV4cHIoaG9zdE1ldGEuZGlyZWN0aXZlLnR5cGUpLCBxdW90ZWQ6IGZhbHNlfSxcbiAgICB7a2V5OiAnaW5wdXRzJywgdmFsdWU6IHN0cmluZ01hcEFzTGl0ZXJhbEV4cHJlc3Npb24oaG9zdE1ldGEuaW5wdXRzIHx8IHt9KSwgcXVvdGVkOiBmYWxzZX0sXG4gICAge2tleTogJ291dHB1dHMnLCB2YWx1ZTogc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihob3N0TWV0YS5vdXRwdXRzIHx8IHt9KSwgcXVvdGVkOiBmYWxzZX0sXG4gIF0pKSkpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlc0ZlYXR1cmVBcmcoXG4gICAgaG9zdERpcmVjdGl2ZXM6IE5vbk51bGxhYmxlPFIzRGlyZWN0aXZlTWV0YWRhdGFbJ2hvc3REaXJlY3RpdmVzJ10+KTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgZXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGxldCBoYXNGb3J3YXJkUmVmID0gZmFsc2U7XG5cbiAgZm9yIChjb25zdCBjdXJyZW50IG9mIGhvc3REaXJlY3RpdmVzKSB7XG4gICAgLy8gVXNlIGEgc2hvcnRoYW5kIGlmIHRoZXJlIGFyZSBubyBpbnB1dHMgb3Igb3V0cHV0cy5cbiAgICBpZiAoIWN1cnJlbnQuaW5wdXRzICYmICFjdXJyZW50Lm91dHB1dHMpIHtcbiAgICAgIGV4cHJlc3Npb25zLnB1c2goY3VycmVudC5kaXJlY3RpdmUudHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGtleXMgPSBbe2tleTogJ2RpcmVjdGl2ZScsIHZhbHVlOiBjdXJyZW50LmRpcmVjdGl2ZS50eXBlLCBxdW90ZWQ6IGZhbHNlfV07XG5cbiAgICAgIGlmIChjdXJyZW50LmlucHV0cykge1xuICAgICAgICBjb25zdCBpbnB1dHNMaXRlcmFsID0gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkoY3VycmVudC5pbnB1dHMpO1xuICAgICAgICBpZiAoaW5wdXRzTGl0ZXJhbCkge1xuICAgICAgICAgIGtleXMucHVzaCh7a2V5OiAnaW5wdXRzJywgdmFsdWU6IGlucHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY3VycmVudC5vdXRwdXRzKSB7XG4gICAgICAgIGNvbnN0IG91dHB1dHNMaXRlcmFsID0gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkoY3VycmVudC5vdXRwdXRzKTtcbiAgICAgICAgaWYgKG91dHB1dHNMaXRlcmFsKSB7XG4gICAgICAgICAga2V5cy5wdXNoKHtrZXk6ICdvdXRwdXRzJywgdmFsdWU6IG91dHB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZXhwcmVzc2lvbnMucHVzaChvLmxpdGVyYWxNYXAoa2V5cykpO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50LmlzRm9yd2FyZFJlZmVyZW5jZSkge1xuICAgICAgaGFzRm9yd2FyZFJlZiA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgdGhlcmUncyBhIGZvcndhcmQgcmVmZXJlbmNlLCB3ZSBnZW5lcmF0ZSBhIGBmdW5jdGlvbigpIHsgcmV0dXJuIFtIb3N0RGlyXSB9YCxcbiAgLy8gb3RoZXJ3aXNlIHdlIGNhbiBzYXZlIHNvbWUgYnl0ZXMgYnkgdXNpbmcgYSBwbGFpbiBhcnJheSwgZS5nLiBgW0hvc3REaXJdYC5cbiAgcmV0dXJuIGhhc0ZvcndhcmRSZWYgP1xuICAgICAgbmV3IG8uRnVuY3Rpb25FeHByKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KG8ubGl0ZXJhbEFycihleHByZXNzaW9ucykpXSkgOlxuICAgICAgby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhbiBpbnB1dC9vdXRwdXQgbWFwcGluZyBvYmplY3QgbGl0ZXJhbCBpbnRvIGFuIGFycmF5IHdoZXJlIHRoZSBldmVuIGtleXMgYXJlIHRoZVxuICogcHVibGljIG5hbWUgb2YgdGhlIGJpbmRpbmcgYW5kIHRoZSBvZGQgb25lcyBhcmUgdGhlIG5hbWUgaXQgd2FzIGFsaWFzZWQgdG8uIEUuZy5cbiAqIGB7aW5wdXRPbmU6ICdhbGlhc09uZScsIGlucHV0VHdvOiAnYWxpYXNUd28nfWAgd2lsbCBiZWNvbWVcbiAqIGBbJ2lucHV0T25lJywgJ2FsaWFzT25lJywgJ2lucHV0VHdvJywgJ2FsaWFzVHdvJ11gLlxuICpcbiAqIFRoaXMgY29udmVyc2lvbiBpcyBuZWNlc3NhcnksIGJlY2F1c2UgaG9zdHMgYmluZCB0byB0aGUgcHVibGljIG5hbWUgb2YgdGhlIGhvc3QgZGlyZWN0aXZlIGFuZFxuICoga2VlcGluZyB0aGUgbWFwcGluZyBpbiBhbiBvYmplY3QgbGl0ZXJhbCB3aWxsIGJyZWFrIGZvciBhcHBzIHVzaW5nIHByb3BlcnR5IHJlbmFtaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSG9zdERpcmVjdGl2ZXNNYXBwaW5nQXJyYXkobWFwcGluZzogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6XG4gICAgby5MaXRlcmFsQXJyYXlFeHByfG51bGwge1xuICBjb25zdCBlbGVtZW50czogby5MaXRlcmFsRXhwcltdID0gW107XG5cbiAgZm9yIChjb25zdCBwdWJsaWNOYW1lIGluIG1hcHBpbmcpIHtcbiAgICBpZiAobWFwcGluZy5oYXNPd25Qcm9wZXJ0eShwdWJsaWNOYW1lKSkge1xuICAgICAgZWxlbWVudHMucHVzaChvLmxpdGVyYWwocHVibGljTmFtZSksIG8ubGl0ZXJhbChtYXBwaW5nW3B1YmxpY05hbWVdKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGVsZW1lbnRzLmxlbmd0aCA+IDAgPyBvLmxpdGVyYWxBcnIoZWxlbWVudHMpIDogbnVsbDtcbn1cbiJdfQ==