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
        definitionMap.set('contentQueries', createContentQueriesFunction(meta.queries, constantPool, meta.name));
    }
    if (meta.viewQueries.length) {
        definitionMap.set('viewQuery', createViewQueriesFunction(meta.viewQueries, constantPool, meta.name));
    }
    // e.g. `hostBindings: (rf, ctx) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || '', meta.name, definitionMap));
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
    const changeDetection = meta.changeDetection;
    // Template compilation is currently conditional as we're in the process of rewriting it.
    if (!USE_TEMPLATE_PIPELINE) {
        // This is the main path currently used in compilation, which compiles the template with the
        // legacy `TemplateDefinitionBuilder`.
        const template = meta.template;
        const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.createRootScope(), 0, templateTypeName, null, null, templateName, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.deferBlocks);
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
        //   `consts: function() { var i18n_0; if (ngI18nClosureMode) {...} else {...} return [i18n_0];
        //   }`
        const { constExpressions, prepareStatements } = templateBuilder.getConsts();
        if (constExpressions.length > 0) {
            let constsExpr = o.literalArr(constExpressions);
            // Prepare statements are present - turn `consts` into a function.
            if (prepareStatements.length > 0) {
                constsExpr = o.fn([], [...prepareStatements, new o.ReturnStatement(constsExpr)]);
            }
            definitionMap.set('consts', constsExpr);
        }
        definitionMap.set('template', templateFunctionExpression);
    }
    else {
        // This path compiles the template using the prototype template pipeline. First the template is
        // ingested into IR:
        const tpl = ingestComponent(meta.name, meta.template.nodes, constantPool, meta.relativeContextFilePath, meta.i18nUseExternalIds);
        // Then the IR is transformed to prepare it for cod egeneration.
        transform(tpl, CompilationJobKind.Tmpl);
        // Finally we emit the template function:
        const templateFn = emitTemplateFn(tpl, constantPool);
        definitionMap.set('decls', o.literal(tpl.root.decls));
        definitionMap.set('vars', o.literal(tpl.root.vars));
        if (tpl.consts.length > 0) {
            if (tpl.constsInitializers.length > 0) {
                definitionMap.set('consts', o.fn([], [...tpl.constsInitializers, new o.ReturnStatement(o.literalArr(tpl.consts))]));
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
    // Only set the change detection flag if it's defined and it's not the default.
    if (changeDetection != null && changeDetection !== core.ChangeDetectionStrategy.Default) {
        definitionMap.set('changeDetection', o.literal(changeDetection));
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
            return o.fn([], [new o.ReturnStatement(list)]);
        case 2 /* DeclarationListEmitMode.ClosureResolved */:
            // directives: function () { return [MyDir].map(ng.resolveForwardRef); }
            const resolvedList = list.prop('map').callFn([o.importExpr(R3.resolveForwardRef)]);
            return o.fn([], [new o.ReturnStatement(resolvedList)]);
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
function createContentQueriesFunction(queries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    for (const query of queries) {
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
    return o.fn([
        new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null),
        new o.FnParam('dirIndex', null)
    ], [
        renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, createStatements),
        renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateStatements)
    ], o.INFERRED_TYPE, null, contentQueriesFnName);
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
function createViewQueriesFunction(viewQueries, constantPool, name) {
    const createStatements = [];
    const updateStatements = [];
    const tempAllocator = temporaryAllocator(updateStatements, TEMPORARY_NAME);
    viewQueries.forEach((query) => {
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
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* core.RenderFlags.Create */, createStatements),
        renderFlagCheckIfStmt(2 /* core.RenderFlags.Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
    const bindings = bindingParser.createBoundHostProperties(hostBindingsMetadata.properties, typeSourceSpan);
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(hostBindingsMetadata.listeners, typeSourceSpan);
    if (USE_TEMPLATE_PIPELINE) {
        // The parser for host bindings treats class and style attributes specially -- they are
        // extracted into these separate fields. This is not the case for templates, so the compiler can
        // actually already handle these special attributes internally. Therefore, we just drop them
        // into the attributes map.
        if (hostBindingsMetadata.specialAttributes.styleAttr) {
            hostBindingsMetadata.attributes.style =
                o.literal(hostBindingsMetadata.specialAttributes.styleAttr);
        }
        if (hostBindingsMetadata.specialAttributes.classAttr) {
            hostBindingsMetadata.attributes.class =
                o.literal(hostBindingsMetadata.specialAttributes.classAttr);
        }
        const hostJob = ingestHostBinding({
            componentName: name,
            properties: bindings,
            events: eventBindings,
            attributes: hostBindingsMetadata.attributes,
        }, bindingParser, constantPool);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRWhGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pGLE9BQU8sRUFBQyw2QkFBNkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRyxPQUFPLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDdEYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUF3QixrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUdySSxPQUFPLEVBQUMsa0NB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QUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVFLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLE9BQStCO0lBRTlFLE1BQU0sUUFBUSxHQUFvQixFQUFFLENBQUM7SUFFckMsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLEVBQUU7UUFDaEMsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3RDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdEU7S0FDRjtJQUVELE9BQU8sUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUM3RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIFBhcnNlZEV2ZW50LCBQYXJzZWRFdmVudFR5cGUsIFBhcnNlZFByb3BlcnR5fSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbiwgc2FuaXRpemVJZGVudGlmaWVyfSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7aXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHJ9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCB7Q3NzU2VsZWN0b3J9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7U2hhZG93Q3NzfSBmcm9tICcuLi8uLi9zaGFkb3dfY3NzJztcbmltcG9ydCB7Q29tcGlsYXRpb25Kb2JLaW5kfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zcmMvY29tcGlsYXRpb24nO1xuaW1wb3J0IHtlbWl0SG9zdEJpbmRpbmdGdW5jdGlvbiwgZW1pdFRlbXBsYXRlRm4sIHRyYW5zZm9ybX0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2VtaXQnO1xuaW1wb3J0IHtpbmdlc3RDb21wb25lbnQsIGluZ2VzdEhvc3RCaW5kaW5nfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zcmMvaW5nZXN0JztcbmltcG9ydCB7VVNFX1RFTVBMQVRFX1BJUEVMSU5FfSBmcm9tICcuLi8uLi90ZW1wbGF0ZS9waXBlbGluZS9zd2l0Y2gnO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge0JvdW5kRXZlbnR9IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZSwgUjNDb21waWxlZEV4cHJlc3Npb24sIHR5cGVXaXRoUGFyYW1ldGVyc30gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzSG9zdE1ldGFkYXRhLCBSM1F1ZXJ5TWV0YWRhdGEsIFIzVGVtcGxhdGVEZXBlbmRlbmN5fSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge01JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIFN0eWxpbmdCdWlsZGVyLCBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgbWFrZUJpbmRpbmdQYXJzZXIsIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycywgcmVuZGVyRmxhZ0NoZWNrSWZTdG10LCByZXNvbHZlU2FuaXRpemF0aW9uRm4sIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7YXNMaXRlcmFsLCBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwsIENPTlRFWFRfTkFNRSwgRGVmaW5pdGlvbk1hcCwgZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzLCBnZXRRdWVyeVByZWRpY2F0ZSwgSW5zdHJ1Y3Rpb24sIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuXG4vLyBUaGlzIHJlZ2V4IG1hdGNoZXMgYW55IGJpbmRpbmcgbmFtZXMgdGhhdCBjb250YWluIHRoZSBcImF0dHIuXCIgcHJlZml4LCBlLmcuIFwiYXR0ci5yZXF1aXJlZFwiXG4vLyBJZiB0aGVyZSBpcyBhIG1hdGNoLCB0aGUgZmlyc3QgbWF0Y2hpbmcgZ3JvdXAgd2lsbCBjb250YWluIHRoZSBhdHRyaWJ1dGUgbmFtZSB0byBiaW5kLlxuY29uc3QgQVRUUl9SRUdFWCA9IC9hdHRyXFwuKFteXFxdXSspLztcblxuXG5jb25zdCBDT01QT05FTlRfVkFSSUFCTEUgPSAnJUNPTVAlJztcbmNvbnN0IEhPU1RfQVRUUiA9IGBfbmdob3N0LSR7Q09NUE9ORU5UX1ZBUklBQkxFfWA7XG5jb25zdCBDT05URU5UX0FUVFIgPSBgX25nY29udGVudC0ke0NPTVBPTkVOVF9WQVJJQUJMRX1gO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGNvbnN0IHNlbGVjdG9ycyA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihtZXRhLnNlbGVjdG9yKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUudmFsdWUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yczogW1snJywgJ3NvbWVEaXInLCAnJ11dYFxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3JzJywgYXNMaXRlcmFsKHNlbGVjdG9ycykpO1xuICB9XG5cbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgLy8gZS5nLiBgY29udGVudFF1ZXJpZXM6IChyZiwgY3R4LCBkaXJJbmRleCkgPT4geyAuLi4gfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnY29udGVudFF1ZXJpZXMnLCBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKG1ldGEucXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnZpZXdRdWVyaWVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAndmlld1F1ZXJ5JywgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihtZXRhLnZpZXdRdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgICAgICAgbWV0YS5ob3N0LCBtZXRhLnR5cGVTb3VyY2VTcGFuLCBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wsIG1ldGEuc2VsZWN0b3IgfHwgJycsXG4gICAgICAgICAgbWV0YS5uYW1lLCBkZWZpbml0aW9uTWFwKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEuaW5wdXRzLCB0cnVlKSk7XG5cbiAgLy8gZS5nICdvdXRwdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlRGlyZWN0aXZlQmluZGluZ0xpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBvLmxpdGVyYWxBcnIobWV0YS5leHBvcnRBcy5tYXAoZSA9PiBvLmxpdGVyYWwoZSkpKSk7XG4gIH1cblxuICBpZiAobWV0YS5pc1N0YW5kYWxvbmUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3RhbmRhbG9uZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc2lnbmFscycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBBZGQgZmVhdHVyZXMgdG8gdGhlIGRlZmluaXRpb24gbWFwLlxuICovXG5mdW5jdGlvbiBhZGRGZWF0dXJlcyhcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGF8UjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4pIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KS52aWV3UHJvdmlkZXJzO1xuICBjb25zdCBpbnB1dEtleXMgPSBPYmplY3Qua2V5cyhtZXRhLmlucHV0cyk7XG5cbiAgaWYgKHByb3ZpZGVycyB8fCB2aWV3UHJvdmlkZXJzKSB7XG4gICAgY29uc3QgYXJncyA9IFtwcm92aWRlcnMgfHwgbmV3IG8uTGl0ZXJhbEFycmF5RXhwcihbXSldO1xuICAgIGlmICh2aWV3UHJvdmlkZXJzKSB7XG4gICAgICBhcmdzLnB1c2godmlld1Byb3ZpZGVycyk7XG4gICAgfVxuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlByb3ZpZGVyc0ZlYXR1cmUpLmNhbGxGbihhcmdzKSk7XG4gIH1cbiAgZm9yIChjb25zdCBrZXkgb2YgaW5wdXRLZXlzKSB7XG4gICAgaWYgKG1ldGEuaW5wdXRzW2tleV0udHJhbnNmb3JtRnVuY3Rpb24gIT09IG51bGwpIHtcbiAgICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLklucHV0VHJhbnNmb3Jtc0ZlYXR1cmVGZWF0dXJlKSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICAvLyBUT0RPOiBiZXR0ZXIgd2F5IG9mIGRpZmZlcmVudGlhdGluZyBjb21wb25lbnQgdnMgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICBpZiAobWV0YS5oYXNPd25Qcm9wZXJ0eSgndGVtcGxhdGUnKSAmJiBtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlN0YW5kYWxvbmVGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLkhvc3REaXJlY3RpdmVzRmVhdHVyZSkuY2FsbEZuKFtjcmVhdGVIb3N0RGlyZWN0aXZlc0ZlYXR1cmVBcmcoXG4gICAgICAgIG1ldGEuaG9zdERpcmVjdGl2ZXMpXSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYSBkaXJlY3RpdmUgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcbiAgY29uc3QgZXhwcmVzc2lvbiA9XG4gICAgICBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldLCB1bmRlZmluZWQsIHRydWUpO1xuICBjb25zdCB0eXBlID0gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgY29tcG9uZW50IGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0NvbXBvbmVudE1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsXG4gICAgICAgICAgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgY2hhbmdlRGV0ZWN0aW9uID0gbWV0YS5jaGFuZ2VEZXRlY3Rpb247XG5cbiAgLy8gVGVtcGxhdGUgY29tcGlsYXRpb24gaXMgY3VycmVudGx5IGNvbmRpdGlvbmFsIGFzIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIHJld3JpdGluZyBpdC5cbiAgaWYgKCFVU0VfVEVNUExBVEVfUElQRUxJTkUpIHtcbiAgICAvLyBUaGlzIGlzIHRoZSBtYWluIHBhdGggY3VycmVudGx5IHVzZWQgaW4gY29tcGlsYXRpb24sIHdoaWNoIGNvbXBpbGVzIHRoZSB0ZW1wbGF0ZSB3aXRoIHRoZVxuICAgIC8vIGxlZ2FjeSBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAuXG5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gICAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLmNyZWF0ZVJvb3RTY29wZSgpLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICAgIFIzLm5hbWVzcGFjZUhUTUwsIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzLCBtZXRhLmRlZmVyQmxvY2tzKTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5ub2RlcywgW10pO1xuXG4gICAgLy8gV2UgbmVlZCB0byBwcm92aWRlIHRoaXMgc28gdGhhdCBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY29tcG9uZW50cyBrbm93IHdoYXRcbiAgICAvLyBwcm9qZWN0ZWQgY29udGVudCBibG9ja3MgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBjb21wb25lbnQgd2hlbiBpdCBpc1xuICAgIC8vICAgICBpbnN0YW50aWF0ZWQuXG4gICAgY29uc3QgbmdDb250ZW50U2VsZWN0b3JzID0gdGVtcGxhdGVCdWlsZGVyLmdldE5nQ29udGVudFNlbGVjdG9ycygpO1xuICAgIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCduZ0NvbnRlbnRTZWxlY3RvcnMnLCBuZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICAgIH1cblxuICAgIC8vIGUuZy4gYGRlY2xzOiAyYFxuICAgIC8vIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0cGwucm9vdC5kZWNscyEpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gICAgLy8gZS5nLiBgdmFyczogMmBcbiAgICAvLyBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0cGwucm9vdC52YXJzISkpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBgY29uc3RzYCBzZWN0aW9uIG9mIENvbXBvbmVudERlZjpcbiAgICAvLyAtIGVpdGhlciBhcyBhbiBhcnJheTpcbiAgICAvLyAgIGBjb25zdHM6IFtbJ29uZScsICd0d28nXSwgWyd0aHJlZScsICdmb3VyJ11dYFxuICAgIC8vIC0gb3IgYXMgYSBmYWN0b3J5IGZ1bmN0aW9uIGluIGNhc2UgYWRkaXRpb25hbCBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50ICh0byBzdXBwb3J0IGkxOG4pOlxuICAgIC8vICAgYGNvbnN0czogZnVuY3Rpb24oKSB7IHZhciBpMThuXzA7IGlmIChuZ0kxOG5DbG9zdXJlTW9kZSkgey4uLn0gZWxzZSB7Li4ufSByZXR1cm4gW2kxOG5fMF07XG4gICAgLy8gICB9YFxuICAgIGNvbnN0IHtjb25zdEV4cHJlc3Npb25zLCBwcmVwYXJlU3RhdGVtZW50c30gPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RzKCk7XG4gICAgaWYgKGNvbnN0RXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IGNvbnN0c0V4cHI6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkZ1bmN0aW9uRXhwciA9IG8ubGl0ZXJhbEFycihjb25zdEV4cHJlc3Npb25zKTtcbiAgICAgIC8vIFByZXBhcmUgc3RhdGVtZW50cyBhcmUgcHJlc2VudCAtIHR1cm4gYGNvbnN0c2AgaW50byBhIGZ1bmN0aW9uLlxuICAgICAgaWYgKHByZXBhcmVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3RzRXhwciA9IG8uZm4oW10sIFsuLi5wcmVwYXJlU3RhdGVtZW50cywgbmV3IG8uUmV0dXJuU3RhdGVtZW50KGNvbnN0c0V4cHIpXSk7XG4gICAgICB9XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgY29uc3RzRXhwcik7XG4gICAgfVxuXG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuICB9IGVsc2Uge1xuICAgIC8vIFRoaXMgcGF0aCBjb21waWxlcyB0aGUgdGVtcGxhdGUgdXNpbmcgdGhlIHByb3RvdHlwZSB0ZW1wbGF0ZSBwaXBlbGluZS4gRmlyc3QgdGhlIHRlbXBsYXRlIGlzXG4gICAgLy8gaW5nZXN0ZWQgaW50byBJUjpcbiAgICBjb25zdCB0cGwgPSBpbmdlc3RDb21wb25lbnQoXG4gICAgICAgIG1ldGEubmFtZSwgbWV0YS50ZW1wbGF0ZS5ub2RlcywgY29uc3RhbnRQb29sLCBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLFxuICAgICAgICBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgICAvLyBUaGVuIHRoZSBJUiBpcyB0cmFuc2Zvcm1lZCB0byBwcmVwYXJlIGl0IGZvciBjb2QgZWdlbmVyYXRpb24uXG4gICAgdHJhbnNmb3JtKHRwbCwgQ29tcGlsYXRpb25Kb2JLaW5kLlRtcGwpO1xuXG4gICAgLy8gRmluYWxseSB3ZSBlbWl0IHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbjpcbiAgICBjb25zdCB0ZW1wbGF0ZUZuID0gZW1pdFRlbXBsYXRlRm4odHBsLCBjb25zdGFudFBvb2wpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0cGwucm9vdC5kZWNscyBhcyBudW1iZXIpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0cGwucm9vdC52YXJzIGFzIG51bWJlcikpO1xuICAgIGlmICh0cGwuY29uc3RzLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmICh0cGwuY29uc3RzSW5pdGlhbGl6ZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgICAnY29uc3RzJyxcbiAgICAgICAgICAgIG8uZm4oW10sIFsuLi50cGwuY29uc3RzSW5pdGlhbGl6ZXJzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKV0pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWxBcnIodHBsLmNvbnN0cykpO1xuICAgICAgfVxuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZuKTtcbiAgfVxuXG4gIGlmIChtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5SdW50aW1lUmVzb2x2ZWQgJiZcbiAgICAgIG1ldGEuZGVjbGFyYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2RlcGVuZGVuY2llcycsXG4gICAgICAgIGNvbXBpbGVEZWNsYXJhdGlvbkxpc3QoXG4gICAgICAgICAgICBvLmxpdGVyYWxBcnIobWV0YS5kZWNsYXJhdGlvbnMubWFwKGRlY2wgPT4gZGVjbC50eXBlKSksIG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUpKTtcbiAgfSBlbHNlIGlmIChtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlID09PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5SdW50aW1lUmVzb2x2ZWQpIHtcbiAgICBjb25zdCBhcmdzID0gW21ldGEudHlwZS52YWx1ZV07XG4gICAgaWYgKG1ldGEucmF3SW1wb3J0cykge1xuICAgICAgYXJncy5wdXNoKG1ldGEucmF3SW1wb3J0cyk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZXBlbmRlbmNpZXMnLCBvLmltcG9ydEV4cHIoUjMuZ2V0Q29tcG9uZW50RGVwc0ZhY3RvcnkpLmNhbGxGbihhcmdzKSk7XG4gIH1cblxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBudWxsKSB7XG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZDtcbiAgfVxuXG4gIC8vIGUuZy4gYHN0eWxlczogW3N0cjEsIHN0cjJdYFxuICBpZiAobWV0YS5zdHlsZXMgJiYgbWV0YS5zdHlsZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3R5bGVWYWx1ZXMgPSBtZXRhLmVuY2Fwc3VsYXRpb24gPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCA/XG4gICAgICAgIGNvbXBpbGVTdHlsZXMobWV0YS5zdHlsZXMsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6XG4gICAgICAgIG1ldGEuc3R5bGVzO1xuICAgIGNvbnN0IHN0eWxlTm9kZXMgPSBzdHlsZVZhbHVlcy5yZWR1Y2UoKHJlc3VsdCwgc3R5bGUpID0+IHtcbiAgICAgIGlmIChzdHlsZS50cmltKCkubGVuZ3RoID4gMCkge1xuICAgICAgICByZXN1bHQucHVzaChjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbChzdHlsZSkpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSwgW10gYXMgby5FeHByZXNzaW9uW10pO1xuXG4gICAgaWYgKHN0eWxlTm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHlsZU5vZGVzKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIHN0eWxlLCBkb24ndCBnZW5lcmF0ZSBjc3Mgc2VsZWN0b3JzIG9uIGVsZW1lbnRzXG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5Ob25lO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdmlldyBlbmNhcHN1bGF0aW9uIGlmIGl0J3Mgbm90IHRoZSBkZWZhdWx0IHZhbHVlXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZW5jYXBzdWxhdGlvbicsIG8ubGl0ZXJhbChtZXRhLmVuY2Fwc3VsYXRpb24pKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGFuaW1hdGlvbjogW3RyaWdnZXIoJzEyMycsIFtdKV1gXG4gIGlmIChtZXRhLmFuaW1hdGlvbnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2RhdGEnLCBvLmxpdGVyYWxNYXAoW3trZXk6ICdhbmltYXRpb24nLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHRoZSBjaGFuZ2UgZGV0ZWN0aW9uIGZsYWcgaWYgaXQncyBkZWZpbmVkIGFuZCBpdCdzIG5vdCB0aGUgZGVmYXVsdC5cbiAgaWYgKGNoYW5nZURldGVjdGlvbiAhPSBudWxsICYmIGNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NoYW5nZURldGVjdGlvbicsIG8ubGl0ZXJhbChjaGFuZ2VEZXRlY3Rpb24pKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgdHlwZSBzcGVjaWZpY2F0aW9uIGZyb20gdGhlIGNvbXBvbmVudCBtZXRhLiBUaGlzIHR5cGUgaXMgaW5zZXJ0ZWQgaW50byAuZC50cyBmaWxlc1xuICogdG8gYmUgY29uc3VtZWQgYnkgdXBzdHJlYW0gY29tcGlsYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pik6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgdHlwZVBhcmFtcy5wdXNoKHN0cmluZ0FycmF5QXNUeXBlKG1ldGEudGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzKSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQ29tcG9uZW50RGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgYXJyYXkgbGl0ZXJhbCBvZiBkZWNsYXJhdGlvbnMgaW50byBhbiBleHByZXNzaW9uIGFjY29yZGluZyB0byB0aGUgcHJvdmlkZWQgZW1pdFxuICogbW9kZS5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZURlY2xhcmF0aW9uTGlzdChcbiAgICBsaXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIG1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKTogby5FeHByZXNzaW9uIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3Q6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlOlxuICAgICAgLy8gZGlyZWN0aXZlczogZnVuY3Rpb24gKCkgeyByZXR1cm4gW015RGlyXTsgfVxuICAgICAgcmV0dXJuIG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQobGlzdCldKTtcbiAgICBjYXNlIERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLkNsb3N1cmVSZXNvbHZlZDpcbiAgICAgIC8vIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtNeURpcl0ubWFwKG5nLnJlc29sdmVGb3J3YXJkUmVmKTsgfVxuICAgICAgY29uc3QgcmVzb2x2ZWRMaXN0ID0gbGlzdC5wcm9wKCdtYXAnKS5jYWxsRm4oW28uaW1wb3J0RXhwcihSMy5yZXNvbHZlRm9yd2FyZFJlZildKTtcbiAgICAgIHJldHVybiBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHJlc29sdmVkTGlzdCldKTtcbiAgICBjYXNlIERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLlJ1bnRpbWVSZXNvbHZlZDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgd2l0aCBhbiBhcnJheSBvZiBwcmUtcmVzb2x2ZWQgZGVwZW5kZW5jaWVzYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCBwYXJhbWV0ZXJzID0gW2dldFF1ZXJ5UHJlZGljYXRlKHF1ZXJ5LCBjb25zdGFudFBvb2wpLCBvLmxpdGVyYWwodG9RdWVyeUZsYWdzKHF1ZXJ5KSldO1xuICBpZiAocXVlcnkucmVhZCkge1xuICAgIHBhcmFtZXRlcnMucHVzaChxdWVyeS5yZWFkKTtcbiAgfVxuICByZXR1cm4gcGFyYW1ldGVycztcbn1cblxuLyoqXG4gKiBBIHNldCBvZiBmbGFncyB0byBiZSB1c2VkIHdpdGggUXVlcmllcy5cbiAqXG4gKiBOT1RFOiBFbnN1cmUgY2hhbmdlcyBoZXJlIGFyZSBpbiBzeW5jIHdpdGggYHBhY2thZ2VzL2NvcmUvc3JjL3JlbmRlcjMvaW50ZXJmYWNlcy9xdWVyeS50c2BcbiAqL1xuZXhwb3J0IGNvbnN0IGVudW0gUXVlcnlGbGFncyB7XG4gIC8qKlxuICAgKiBObyBmbGFnc1xuICAgKi9cbiAgbm9uZSA9IDBiMDAwMCxcblxuICAvKipcbiAgICogV2hldGhlciBvciBub3QgdGhlIHF1ZXJ5IHNob3VsZCBkZXNjZW5kIGludG8gY2hpbGRyZW4uXG4gICAqL1xuICBkZXNjZW5kYW50cyA9IDBiMDAwMSxcblxuICAvKipcbiAgICogVGhlIHF1ZXJ5IGNhbiBiZSBjb21wdXRlZCBzdGF0aWNhbGx5IGFuZCBoZW5jZSBjYW4gYmUgYXNzaWduZWQgZWFnZXJseS5cbiAgICpcbiAgICogTk9URTogQmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBWaWV3RW5naW5lLlxuICAgKi9cbiAgaXNTdGF0aWMgPSAwYjAwMTAsXG5cbiAgLyoqXG4gICAqIElmIHRoZSBgUXVlcnlMaXN0YCBzaG91bGQgZmlyZSBjaGFuZ2UgZXZlbnQgb25seSBpZiBhY3R1YWwgY2hhbmdlIHRvIHF1ZXJ5IHdhcyBjb21wdXRlZCAodnMgb2xkXG4gICAqIGJlaGF2aW9yIHdoZXJlIHRoZSBjaGFuZ2Ugd2FzIGZpcmVkIHdoZW5ldmVyIHRoZSBxdWVyeSB3YXMgcmVjb21wdXRlZCwgZXZlbiBpZiB0aGUgcmVjb21wdXRlZFxuICAgKiBxdWVyeSByZXN1bHRlZCBpbiB0aGUgc2FtZSBsaXN0LilcbiAgICovXG4gIGVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID0gMGIwMTAwLFxufVxuXG4vKipcbiAqIFRyYW5zbGF0ZXMgcXVlcnkgZmxhZ3MgaW50byBgVFF1ZXJ5RmxhZ3NgIHR5cGUgaW4gcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnRlcmZhY2VzL3F1ZXJ5LnRzXG4gKiBAcGFyYW0gcXVlcnlcbiAqL1xuZnVuY3Rpb24gdG9RdWVyeUZsYWdzKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpOiBudW1iZXIge1xuICByZXR1cm4gKHF1ZXJ5LmRlc2NlbmRhbnRzID8gUXVlcnlGbGFncy5kZXNjZW5kYW50cyA6IFF1ZXJ5RmxhZ3Mubm9uZSkgfFxuICAgICAgKHF1ZXJ5LnN0YXRpYyA/IFF1ZXJ5RmxhZ3MuaXNTdGF0aWMgOiBRdWVyeUZsYWdzLm5vbmUpIHxcbiAgICAgIChxdWVyeS5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSA/IFF1ZXJ5RmxhZ3MuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgOiBRdWVyeUZsYWdzLm5vbmUpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTpcbiAgICBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWVzO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgY29udGVudCBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKFxuICAgIHF1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICBmb3IgKGNvbnN0IHF1ZXJ5IG9mIHF1ZXJpZXMpIHtcbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5jb250ZW50UXVlcnkoZGlySW5kZXgsIHNvbWVQcmVkaWNhdGUsIHRydWUsIG51bGwpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChcbiAgICAgICAgby5pbXBvcnRFeHByKFIzLmNvbnRlbnRRdWVyeSlcbiAgICAgICAgICAgIC5jYWxsRm4oW28udmFyaWFibGUoJ2RpckluZGV4JyksIC4uLnByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSBhcyBhbnldKVxuICAgICAgICAgICAgLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucXVlcnlSZWZyZXNoKHRtcCA9IHIzLmxvYWRRdWVyeSgpKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWRRdWVyeSkuY2FsbEZuKFtdKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnRRdWVyaWVzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW1xuICAgICAgICBuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKSxcbiAgICAgICAgbmV3IG8uRm5QYXJhbSgnZGlySW5kZXgnLCBudWxsKVxuICAgICAgXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgY29udGVudFF1ZXJpZXNGbk5hbWUpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzTGl0ZXJhbEV4cHJlc3Npb24obWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfHN0cmluZ1tdfSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcblxuICByZXR1cm4gby5saXRlcmFsTWFwKG1hcFZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogUmVhZG9ubHlBcnJheTxzdHJpbmd8bnVsbD4pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQmFzZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZVtdIHtcbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IG1ldGEuc2VsZWN0b3IgIT09IG51bGwgPyBtZXRhLnNlbGVjdG9yLnJlcGxhY2UoL1xcbi9nLCAnJykgOiBudWxsO1xuXG4gIHJldHVybiBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzZWxlY3RvckZvclR5cGUgIT09IG51bGwgPyBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSA6IG8uTk9ORV9UWVBFLFxuICAgIG1ldGEuZXhwb3J0QXMgIT09IG51bGwgPyBzdHJpbmdBcnJheUFzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIG8uZXhwcmVzc2lvblR5cGUoZ2V0SW5wdXRzVHlwZUV4cHJlc3Npb24obWV0YSkpLFxuICAgIG8uZXhwcmVzc2lvblR5cGUoc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihtZXRhLm91dHB1dHMpKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5wdXRzVHlwZUV4cHJlc3Npb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoT2JqZWN0LmtleXMobWV0YS5pbnB1dHMpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gbWV0YS5pbnB1dHNba2V5XTtcbiAgICByZXR1cm4ge1xuICAgICAga2V5LFxuICAgICAgdmFsdWU6IG8ubGl0ZXJhbE1hcChbXG4gICAgICAgIHtrZXk6ICdhbGlhcycsIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZSksIHF1b3RlZDogdHJ1ZX0sXG4gICAgICAgIHtrZXk6ICdyZXF1aXJlZCcsIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUucmVxdWlyZWQpLCBxdW90ZWQ6IHRydWV9XG4gICAgICBdKSxcbiAgICAgIHF1b3RlZDogdHJ1ZVxuICAgIH07XG4gIH0pKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIHRoZSB0eXBlIHNwZWNpZmljYXRpb24gZnJvbSB0aGUgZGlyZWN0aXZlIG1ldGEuIFRoaXMgdHlwZSBpcyBpbnNlcnRlZCBpbnRvIC5kLnRzIGZpbGVzXG4gKiB0byBiZSBjb25zdW1lZCBieSB1cHN0cmVhbSBjb21waWxhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlR5cGUge1xuICBjb25zdCB0eXBlUGFyYW1zID0gY3JlYXRlQmFzZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YSk7XG4gIC8vIERpcmVjdGl2ZXMgaGF2ZSBubyBOZ0NvbnRlbnRTZWxlY3RvcnMgc2xvdCwgYnV0IGluc3RlYWQgZXhwcmVzcyBhIGBuZXZlcmAgdHlwZVxuICAvLyBzbyB0aGF0IGZ1dHVyZSBmaWVsZHMgYWxpZ24uXG4gIHR5cGVQYXJhbXMucHVzaChvLk5PTkVfVFlQRSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuRGlyZWN0aXZlRGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIHZpZXdRdWVyaWVzLmZvckVhY2goKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpID0+IHtcbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy52aWV3UXVlcnkoc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID1cbiAgICAgICAgby5pbXBvcnRFeHByKFIzLnZpZXdRdWVyeSkuY2FsbEZuKHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKHF1ZXJ5RGVmaW5pdGlvbi50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkUXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH0pO1xuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9RdWVyeWAgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHZpZXdRdWVyeUZuTmFtZSk7XG59XG5cbi8vIFJldHVybiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgaG9zdEJpbmRpbmdzTWV0YWRhdGE6IFIzSG9zdE1ldGFkYXRhLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBzZWxlY3Rvcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgYmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGhvc3RCaW5kaW5nc01ldGFkYXRhLnByb3BlcnRpZXMsIHR5cGVTb3VyY2VTcGFuKTtcblxuICAvLyBDYWxjdWxhdGUgaG9zdCBldmVudCBiaW5kaW5nc1xuICBjb25zdCBldmVudEJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhob3N0QmluZGluZ3NNZXRhZGF0YS5saXN0ZW5lcnMsIHR5cGVTb3VyY2VTcGFuKTtcblxuICBpZiAoVVNFX1RFTVBMQVRFX1BJUEVMSU5FKSB7XG4gICAgLy8gVGhlIHBhcnNlciBmb3IgaG9zdCBiaW5kaW5ncyB0cmVhdHMgY2xhc3MgYW5kIHN0eWxlIGF0dHJpYnV0ZXMgc3BlY2lhbGx5IC0tIHRoZXkgYXJlXG4gICAgLy8gZXh0cmFjdGVkIGludG8gdGhlc2Ugc2VwYXJhdGUgZmllbGRzLiBUaGlzIGlzIG5vdCB0aGUgY2FzZSBmb3IgdGVtcGxhdGVzLCBzbyB0aGUgY29tcGlsZXIgY2FuXG4gICAgLy8gYWN0dWFsbHkgYWxyZWFkeSBoYW5kbGUgdGhlc2Ugc3BlY2lhbCBhdHRyaWJ1dGVzIGludGVybmFsbHkuIFRoZXJlZm9yZSwgd2UganVzdCBkcm9wIHRoZW1cbiAgICAvLyBpbnRvIHRoZSBhdHRyaWJ1dGVzIG1hcC5cbiAgICBpZiAoaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgICBob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzLnN0eWxlID1cbiAgICAgICAgICBvLmxpdGVyYWwoaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKTtcbiAgICB9XG4gICAgaWYgKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikge1xuICAgICAgaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcy5jbGFzcyA9XG4gICAgICAgICAgby5saXRlcmFsKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cik7XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdEpvYiA9IGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgICAgICB7XG4gICAgICAgICAgY29tcG9uZW50TmFtZTogbmFtZSxcbiAgICAgICAgICBwcm9wZXJ0aWVzOiBiaW5kaW5ncyxcbiAgICAgICAgICBldmVudHM6IGV2ZW50QmluZGluZ3MsXG4gICAgICAgICAgYXR0cmlidXRlczogaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcyxcbiAgICAgICAgfSxcbiAgICAgICAgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sKTtcbiAgICB0cmFuc2Zvcm0oaG9zdEpvYiwgQ29tcGlsYXRpb25Kb2JLaW5kLkhvc3QpO1xuXG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RBdHRycycsIGhvc3RKb2Iucm9vdC5hdHRyaWJ1dGVzKTtcblxuICAgIGNvbnN0IHZhckNvdW50ID0gaG9zdEpvYi5yb290LnZhcnM7XG4gICAgaWYgKHZhckNvdW50ICE9PSBudWxsICYmIHZhckNvdW50ID4gMCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RWYXJzJywgby5saXRlcmFsKHZhckNvdW50KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVtaXRIb3N0QmluZGluZ0Z1bmN0aW9uKGhvc3RKb2IpO1xuICB9XG4gIGNvbnN0IGJpbmRpbmdDb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICBjb25zdCBzdHlsZUJ1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIoYmluZGluZ0NvbnRleHQpO1xuXG4gIGNvbnN0IHtzdHlsZUF0dHIsIGNsYXNzQXR0cn0gPSBob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcztcbiAgaWYgKHN0eWxlQXR0ciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHN0eWxlQXR0cik7XG4gIH1cbiAgaWYgKGNsYXNzQXR0ciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgc3R5bGVCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKGNsYXNzQXR0cik7XG4gIH1cblxuICBjb25zdCBjcmVhdGVJbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgY29uc3QgdXBkYXRlSW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG4gIGNvbnN0IHVwZGF0ZVZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IHR5cGVTb3VyY2VTcGFuO1xuICBpZiAoZXZlbnRCaW5kaW5ncyAmJiBldmVudEJpbmRpbmdzLmxlbmd0aCkge1xuICAgIGNyZWF0ZUluc3RydWN0aW9ucy5wdXNoKC4uLmNyZWF0ZUhvc3RMaXN0ZW5lcnMoZXZlbnRCaW5kaW5ncywgbmFtZSkpO1xuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGFsbE90aGVyQmluZGluZ3M6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcblxuICAvLyBXZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgdG90YWwgYW1vdW50IG9mIGJpbmRpbmcgc2xvdHMgcmVxdWlyZWQgYnlcbiAgLy8gYWxsIHRoZSBpbnN0cnVjdGlvbnMgdG9nZXRoZXIgYmVmb3JlIGFueSB2YWx1ZSBjb252ZXJzaW9ucyBoYXBwZW4uXG4gIC8vIFZhbHVlIGNvbnZlcnNpb25zIG1heSByZXF1aXJlIGFkZGl0aW9uYWwgc2xvdHMgZm9yIGludGVycG9sYXRpb24gYW5kXG4gIC8vIGJpbmRpbmdzIHdpdGggcGlwZXMuIFRoZXNlIGNhbGN1bGF0ZXMgaGFwcGVuIGFmdGVyIHRoaXMgYmxvY2suXG4gIGxldCB0b3RhbEhvc3RWYXJzQ291bnQgPSAwO1xuICBiaW5kaW5ncyAmJiBiaW5kaW5ncy5mb3JFYWNoKChiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSkgPT4ge1xuICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxlQnVpbGRlci5yZWdpc3RlcklucHV0QmFzZWRPbk5hbWUoXG4gICAgICAgIGJpbmRpbmcubmFtZSwgYmluZGluZy5leHByZXNzaW9uLCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICAgIGlmIChzdHlsaW5nSW5wdXRXYXNTZXQpIHtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVEO1xuICAgIH0gZWxzZSB7XG4gICAgICBhbGxPdGhlckJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQrKztcbiAgICB9XG4gIH0pO1xuXG4gIGxldCB2YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIGNvbnN0IGdldFZhbHVlQ29udmVydGVyID0gKCkgPT4ge1xuICAgIGlmICghdmFsdWVDb252ZXJ0ZXIpIHtcbiAgICAgIGNvbnN0IGhvc3RWYXJzQ291bnRGbiA9IChudW1TbG90czogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxWYXJzQ291bnQgPSB0b3RhbEhvc3RWYXJzQ291bnQ7XG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsVmFyc0NvdW50O1xuICAgICAgfTtcbiAgICAgIHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICAgIGNvbnN0YW50UG9vbCxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBub2RlJyksICAvLyBuZXcgbm9kZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgICAgICAgIGhvc3RWYXJzQ291bnRGbixcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpOyAgLy8gcGlwZXMgYXJlIGlsbGVnYWwgaGVyZVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVDb252ZXJ0ZXI7XG4gIH07XG5cbiAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBhdHRyaWJ1dGVCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBzeW50aGV0aWNIb3N0QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYWxsT3RoZXJCaW5kaW5ncykge1xuICAgIC8vIHJlc29sdmUgbGl0ZXJhbCBhcnJheXMgYW5kIGxpdGVyYWwgb2JqZWN0c1xuICAgIGNvbnN0IHZhbHVlID0gYmluZGluZy5leHByZXNzaW9uLnZpc2l0KGdldFZhbHVlQ29udmVydGVyKCkpO1xuICAgIGNvbnN0IGJpbmRpbmdFeHByID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSk7XG5cbiAgICBjb25zdCB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZX0gPSBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmcpO1xuXG4gICAgY29uc3Qgc2VjdXJpdHlDb250ZXh0cyA9XG4gICAgICAgIGJpbmRpbmdQYXJzZXIuY2FsY1Bvc3NpYmxlU2VjdXJpdHlDb250ZXh0cyhzZWxlY3RvciwgYmluZGluZ05hbWUsIGlzQXR0cmlidXRlKVxuICAgICAgICAgICAgLmZpbHRlcihjb250ZXh0ID0+IGNvbnRleHQgIT09IGNvcmUuU2VjdXJpdHlDb250ZXh0Lk5PTkUpO1xuXG4gICAgbGV0IHNhbml0aXplckZuOiBvLkV4dGVybmFsRXhwcnxudWxsID0gbnVsbDtcbiAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGgpIHtcbiAgICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCA9PT0gMiAmJlxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkwpID4gLTEgJiZcbiAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuUkVTT1VSQ0VfVVJMKSA+IC0xKSB7XG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3Igc29tZSBVUkwgYXR0cmlidXRlcyAoc3VjaCBhcyBcInNyY1wiIGFuZCBcImhyZWZcIikgdGhhdCBtYXkgYmUgYSBwYXJ0XG4gICAgICAgIC8vIG9mIGRpZmZlcmVudCBzZWN1cml0eSBjb250ZXh0cy4gSW4gdGhpcyBjYXNlIHdlIHVzZSBzcGVjaWFsIHNhbml0aXphdGlvbiBmdW5jdGlvbiBhbmRcbiAgICAgICAgLy8gc2VsZWN0IHRoZSBhY3R1YWwgc2FuaXRpemVyIGF0IHJ1bnRpbWUgYmFzZWQgb24gYSB0YWcgbmFtZSB0aGF0IGlzIHByb3ZpZGVkIHdoaWxlXG4gICAgICAgIC8vIGludm9raW5nIHNhbml0aXphdGlvbiBmdW5jdGlvbi5cbiAgICAgICAgc2FuaXRpemVyRm4gPSBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVVcmxPclJlc291cmNlVXJsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNhbml0aXplckZuID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKHNlY3VyaXR5Q29udGV4dHNbMF0sIGlzQXR0cmlidXRlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25QYXJhbXMgPSBbby5saXRlcmFsKGJpbmRpbmdOYW1lKSwgYmluZGluZ0V4cHIuY3VyclZhbEV4cHJdO1xuICAgIGlmIChzYW5pdGl6ZXJGbikge1xuICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChzYW5pdGl6ZXJGbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIHRoZXJlIHdhcyBubyBzYW5pdGl6YXRpb24gZnVuY3Rpb24gZm91bmQgYmFzZWQgb24gdGhlIHNlY3VyaXR5IGNvbnRleHRcbiAgICAgIC8vIG9mIGFuIGF0dHJpYnV0ZS9wcm9wZXJ0eSBiaW5kaW5nIC0gY2hlY2sgd2hldGhlciB0aGlzIGF0dHJpYnV0ZS9wcm9wZXJ0eSBpc1xuICAgICAgLy8gb25lIG9mIHRoZSBzZWN1cml0eS1zZW5zaXRpdmUgPGlmcmFtZT4gYXR0cmlidXRlcy5cbiAgICAgIC8vIE5vdGU6IGZvciBob3N0IGJpbmRpbmdzIGRlZmluZWQgb24gYSBkaXJlY3RpdmUsIHdlIGRvIG5vdCB0cnkgdG8gZmluZCBhbGxcbiAgICAgIC8vIHBvc3NpYmxlIHBsYWNlcyB3aGVyZSBpdCBjYW4gYmUgbWF0Y2hlZCwgc28gd2UgY2FuIG5vdCBkZXRlcm1pbmUgd2hldGhlclxuICAgICAgLy8gdGhlIGhvc3QgZWxlbWVudCBpcyBhbiA8aWZyYW1lPi4gSW4gdGhpcyBjYXNlLCBpZiBhbiBhdHRyaWJ1dGUvYmluZGluZ1xuICAgICAgLy8gbmFtZSBpcyBpbiB0aGUgYElGUkFNRV9TRUNVUklUWV9TRU5TSVRJVkVfQVRUUlNgIHNldCAtIGFwcGVuZCBhIHZhbGlkYXRpb25cbiAgICAgIC8vIGZ1bmN0aW9uLCB3aGljaCB3b3VsZCBiZSBpbnZva2VkIGF0IHJ1bnRpbWUgYW5kIHdvdWxkIGhhdmUgYWNjZXNzIHRvIHRoZVxuICAgICAgLy8gdW5kZXJseWluZyBET00gZWxlbWVudCwgY2hlY2sgaWYgaXQncyBhbiA8aWZyYW1lPiBhbmQgaWYgc28gLSBydW5zIGV4dHJhIGNoZWNrcy5cbiAgICAgIGlmIChpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cihiaW5kaW5nTmFtZSkpIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb25QYXJhbXMucHVzaChvLmltcG9ydEV4cHIoUjMudmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGUpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVWYXJpYWJsZXMucHVzaCguLi5iaW5kaW5nRXhwci5zdG10cyk7XG5cbiAgICBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmhvc3RQcm9wZXJ0eSkge1xuICAgICAgcHJvcGVydHlCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uID09PSBSMy5hdHRyaWJ1dGUpIHtcbiAgICAgIGF0dHJpYnV0ZUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSkge1xuICAgICAgc3ludGhldGljSG9zdEJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBpbnN0cnVjdGlvbiwgcGFyYW1zT3JGbjogaW5zdHJ1Y3Rpb25QYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IGJpbmRpbmdQYXJhbXMgb2YgcHJvcGVydHlCaW5kaW5ncykge1xuICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLmhvc3RQcm9wZXJ0eSwgcGFyYW1zT3JGbjogYmluZGluZ1BhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nUGFyYW1zIG9mIGF0dHJpYnV0ZUJpbmRpbmdzKSB7XG4gICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMuYXR0cmlidXRlLCBwYXJhbXNPckZuOiBiaW5kaW5nUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJpbmRpbmdQYXJhbXMgb2Ygc3ludGhldGljSG9zdEJpbmRpbmdzKSB7XG4gICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goXG4gICAgICAgIHtyZWZlcmVuY2U6IFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eSwgcGFyYW1zT3JGbjogYmluZGluZ1BhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgLy8gc2luY2Ugd2UncmUgZGVhbGluZyB3aXRoIGRpcmVjdGl2ZXMvY29tcG9uZW50cyBhbmQgYm90aCBoYXZlIGhvc3RCaW5kaW5nXG4gIC8vIGZ1bmN0aW9ucywgd2UgbmVlZCB0byBnZW5lcmF0ZSBhIHNwZWNpYWwgaG9zdEF0dHJzIGluc3RydWN0aW9uIHRoYXQgZGVhbHNcbiAgLy8gd2l0aCBib3RoIHRoZSBhc3NpZ25tZW50IG9mIHN0eWxpbmcgYXMgd2VsbCBhcyBzdGF0aWMgYXR0cmlidXRlcyB0byB0aGUgaG9zdFxuICAvLyBlbGVtZW50LiBUaGUgaW5zdHJ1Y3Rpb24gYmVsb3cgd2lsbCBpbnN0cnVjdCBhbGwgaW5pdGlhbCBzdHlsaW5nIChzdHlsaW5nXG4gIC8vIHRoYXQgaXMgaW5zaWRlIG9mIGEgaG9zdCBiaW5kaW5nIHdpdGhpbiBhIGRpcmVjdGl2ZS9jb21wb25lbnQpIHRvIGJlIGF0dGFjaGVkXG4gIC8vIHRvIHRoZSBob3N0IGVsZW1lbnQgYWxvbmdzaWRlIGFueSBvZiB0aGUgcHJvdmlkZWQgaG9zdCBhdHRyaWJ1dGVzIHRoYXQgd2VyZVxuICAvLyBjb2xsZWN0ZWQgZWFybGllci5cbiAgY29uc3QgaG9zdEF0dHJzID0gY29udmVydEF0dHJpYnV0ZXNUb0V4cHJlc3Npb25zKGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXMpO1xuICBzdHlsZUJ1aWxkZXIuYXNzaWduSG9zdEF0dHJzKGhvc3RBdHRycywgZGVmaW5pdGlvbk1hcCk7XG5cbiAgaWYgKHN0eWxlQnVpbGRlci5oYXNCaW5kaW5ncykge1xuICAgIC8vIGZpbmFsbHkgZWFjaCBiaW5kaW5nIHRoYXQgd2FzIHJlZ2lzdGVyZWQgaW4gdGhlIHN0YXRlbWVudCBhYm92ZSB3aWxsIG5lZWQgdG8gYmUgYWRkZWQgdG9cbiAgICAvLyB0aGUgdXBkYXRlIGJsb2NrIG9mIGEgY29tcG9uZW50L2RpcmVjdGl2ZSB0ZW1wbGF0ZUZuL2hvc3RCaW5kaW5nc0ZuIHNvIHRoYXQgdGhlIGJpbmRpbmdzXG4gICAgLy8gYXJlIGV2YWx1YXRlZCBhbmQgdXBkYXRlZCBmb3IgdGhlIGVsZW1lbnQuXG4gICAgc3R5bGVCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnMoZ2V0VmFsdWVDb252ZXJ0ZXIoKSkuZm9yRWFjaChpbnN0cnVjdGlvbiA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGNhbGwgb2YgaW5zdHJ1Y3Rpb24uY2FsbHMpIHtcbiAgICAgICAgLy8gd2Ugc3VidHJhY3QgYSB2YWx1ZSBvZiBgMWAgaGVyZSBiZWNhdXNlIHRoZSBiaW5kaW5nIHNsb3Qgd2FzIGFscmVhZHkgYWxsb2NhdGVkXG4gICAgICAgIC8vIGF0IHRoZSB0b3Agb2YgdGhpcyBtZXRob2Qgd2hlbiBhbGwgdGhlIGlucHV0IGJpbmRpbmdzIHdlcmUgY291bnRlZC5cbiAgICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9XG4gICAgICAgICAgICBNYXRoLm1heChjYWxsLmFsbG9jYXRlQmluZGluZ1Nsb3RzIC0gTUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRCwgMCk7XG5cbiAgICAgICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe1xuICAgICAgICAgIHJlZmVyZW5jZTogaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgIHBhcmFtc09yRm46IGNvbnZlcnRTdHlsaW5nQ2FsbChjYWxsLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZ0ZuKSxcbiAgICAgICAgICBzcGFuOiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgaWYgKHRvdGFsSG9zdFZhcnNDb3VudCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbCh0b3RhbEhvc3RWYXJzQ291bnQpKTtcbiAgfVxuXG4gIGlmIChjcmVhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCB8fCB1cGRhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGhvc3RCaW5kaW5nc0ZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9Ib3N0QmluZGluZ3NgIDogbnVsbDtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgaWYgKGNyZWF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMoY3JlYXRlSW5zdHJ1Y3Rpb25zKSkpO1xuICAgIH1cbiAgICBpZiAodXBkYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsXG4gICAgICAgICAgdXBkYXRlVmFyaWFibGVzLmNvbmNhdChnZXRJbnN0cnVjdGlvblN0YXRlbWVudHModXBkYXRlSW5zdHJ1Y3Rpb25zKSkpKTtcbiAgICB9XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sIHN0YXRlbWVudHMsXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgaG9zdEJpbmRpbmdzRm5OYW1lKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBiaW5kaW5nRm4oaW1wbGljaXQ6IGFueSwgdmFsdWU6IEFTVCkge1xuICByZXR1cm4gY29udmVydFByb3BlcnR5QmluZGluZyhudWxsLCBpbXBsaWNpdCwgdmFsdWUsICdiJyk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRTdHlsaW5nQ2FsbChcbiAgICBjYWxsOiBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKSB7XG4gIHJldHVybiBjYWxsLnBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24hOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGlzIGlzIGFuIGF0dHIgYmluZGluZyBvciBhIHByb3BlcnR5IGJpbmRpbmdcbiAgY29uc3QgYXR0ck1hdGNoZXMgPSBiaW5kaW5nTmFtZS5tYXRjaChBVFRSX1JFR0VYKTtcbiAgaWYgKGF0dHJNYXRjaGVzKSB7XG4gICAgYmluZGluZ05hbWUgPSBhdHRyTWF0Y2hlc1sxXTtcbiAgICBpbnN0cnVjdGlvbiA9IFIzLmF0dHJpYnV0ZTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoYmluZGluZy5pc0FuaW1hdGlvbikge1xuICAgICAgYmluZGluZ05hbWUgPSBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGJpbmRpbmdOYW1lKTtcbiAgICAgIC8vIGhvc3QgYmluZGluZ3MgdGhhdCBoYXZlIGEgc3ludGhldGljIHByb3BlcnR5IChlLmcuIEBmb28pIHNob3VsZCBhbHdheXMgYmUgcmVuZGVyZWRcbiAgICAgIC8vIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21wb25lbnQgYW5kIG5vdCB0aGUgcGFyZW50LiBUaGVyZWZvcmUgdGhlcmUgaXMgYSBzcGVjaWFsXG4gICAgICAvLyBjb21wYXRpYmlsaXR5IGluc3RydWN0aW9uIGF2YWlsYWJsZSBmb3IgdGhpcyBwdXJwb3NlLlxuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc3RydWN0aW9uID0gUjMuaG9zdFByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZTogISFhdHRyTWF0Y2hlc307XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RMaXN0ZW5lcnMoZXZlbnRCaW5kaW5nczogUGFyc2VkRXZlbnRbXSwgbmFtZT86IHN0cmluZyk6IEluc3RydWN0aW9uW10ge1xuICBjb25zdCBsaXN0ZW5lclBhcmFtczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBzeW50aGV0aWNMaXN0ZW5lclBhcmFtczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuICBjb25zdCBpbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgZXZlbnRCaW5kaW5ncykge1xuICAgIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoYmluZGluZy5uYW1lKTtcbiAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gYmluZGluZy50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGJpbmRpbmdOYW1lLCBiaW5kaW5nLnRhcmdldE9yUGhhc2UpIDpcbiAgICAgICAgYmluZGluZ05hbWU7XG4gICAgY29uc3QgaGFuZGxlck5hbWUgPSBuYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7bmFtZX1fJHtiaW5kaW5nRm5OYW1lfV9Ib3N0QmluZGluZ0hhbmRsZXJgIDogbnVsbDtcbiAgICBjb25zdCBwYXJhbXMgPSBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoQm91bmRFdmVudC5mcm9tUGFyc2VkRXZlbnQoYmluZGluZyksIGhhbmRsZXJOYW1lKTtcblxuICAgIGlmIChiaW5kaW5nLnR5cGUgPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgc3ludGhldGljTGlzdGVuZXJQYXJhbXMucHVzaChwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0ZW5lclBhcmFtcy5wdXNoKHBhcmFtcyk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBwYXJhbXMgb2Ygc3ludGhldGljTGlzdGVuZXJQYXJhbXMpIHtcbiAgICBpbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5zeW50aGV0aWNIb3N0TGlzdGVuZXIsIHBhcmFtc09yRm46IHBhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBwYXJhbXMgb2YgbGlzdGVuZXJQYXJhbXMpIHtcbiAgICBpbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5saXN0ZW5lciwgcGFyYW1zT3JGbjogcGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xufVxuXG5cbmNvbnN0IEhPU1RfUkVHX0VYUCA9IC9eKD86XFxbKFteXFxdXSspXFxdKXwoPzpcXCgoW15cXCldKylcXCkpJC87XG4vLyBSZXByZXNlbnRzIHRoZSBncm91cHMgaW4gdGhlIGFib3ZlIHJlZ2V4LlxuY29uc3QgZW51bSBIb3N0QmluZGluZ0dyb3VwIHtcbiAgLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiLCBvciBcImF0dHIucm9sZVwiIGZyb20gXCJbYXR0ci5yb2xlXVwiLCBvciBAYW5pbSBmcm9tIFtAYW5pbV1cbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxufVxuXG4vLyBEZWZpbmVzIEhvc3QgQmluZGluZ3Mgc3RydWN0dXJlIHRoYXQgY29udGFpbnMgYXR0cmlidXRlcywgbGlzdGVuZXJzLCBhbmQgcHJvcGVydGllcyxcbi8vIHBhcnNlZCBmcm9tIHRoZSBgaG9zdGAgb2JqZWN0IGRlZmluZWQgZm9yIGEgVHlwZS5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhvc3RCaW5kaW5ncyhob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfG8uRXhwcmVzc2lvbn0pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBjb25zdCBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICBjb25zdCBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fSA9IHt9O1xuXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGhvc3QpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBob3N0W2tleV07XG4gICAgY29uc3QgbWF0Y2hlcyA9IGtleS5tYXRjaChIT1NUX1JFR19FWFApO1xuXG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDbGFzcyBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzdHlsZSc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3R5bGUgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gby5saXRlcmFsKHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICAvLyBzeW50aGV0aWMgcHJvcGVydGllcyAodGhlIG9uZXMgdGhhdCBoYXZlIGEgYEBgIGFzIGEgcHJlZml4KVxuICAgICAgLy8gYXJlIHN0aWxsIHRyZWF0ZWQgdGhlIHNhbWUgYXMgcmVndWxhciBwcm9wZXJ0aWVzLiBUaGVyZWZvcmVcbiAgICAgIC8vIHRoZXJlIGlzIG5vIHBvaW50IGluIHN0b3JpbmcgdGhlbSBpbiBhIHNlcGFyYXRlIG1hcC5cbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgbGlzdGVuZXJzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF1dID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXMsIHNwZWNpYWxBdHRyaWJ1dGVzfTtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyBob3N0IGJpbmRpbmdzIGFuZCByZXR1cm5zIHRoZSBsaXN0IG9mIGVycm9ycyAoaWYgYW55KS4gRW1wdHkgYXJyYXkgaW5kaWNhdGVzIHRoYXQgYVxuICogZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MgaGFzIG5vIGVycm9ycy5cbiAqXG4gKiBAcGFyYW0gYmluZGluZ3Mgc2V0IG9mIGhvc3QgYmluZGluZ3MgdG8gdmVyaWZ5LlxuICogQHBhcmFtIHNvdXJjZVNwYW4gc291cmNlIHNwYW4gd2hlcmUgaG9zdCBiaW5kaW5ncyB3ZXJlIGRlZmluZWQuXG4gKiBAcmV0dXJucyBhcnJheSBvZiBlcnJvcnMgYXNzb2NpYXRlZCB3aXRoIGEgZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlIb3N0QmluZGluZ3MoXG4gICAgYmluZGluZ3M6IFBhcnNlZEhvc3RCaW5kaW5ncywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUGFyc2VFcnJvcltdIHtcbiAgLy8gVE9ETzogYWJzdHJhY3Qgb3V0IGhvc3QgYmluZGluZ3MgdmVyaWZpY2F0aW9uIGxvZ2ljIGFuZCB1c2UgaXQgaW5zdGVhZCBvZlxuICAvLyBjcmVhdGluZyBldmVudHMgYW5kIHByb3BlcnRpZXMgQVNUcyB0byBkZXRlY3QgZXJyb3JzIChGVy05OTYpXG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoYmluZGluZ3MubGlzdGVuZXJzLCBzb3VyY2VTcGFuKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGJpbmRpbmdzLnByb3BlcnRpZXMsIHNvdXJjZVNwYW4pO1xuICByZXR1cm4gYmluZGluZ1BhcnNlci5lcnJvcnM7XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVTdHlsZXMoc3R5bGVzOiBzdHJpbmdbXSwgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcbiAgcmV0dXJuIHN0eWxlcy5tYXAoc3R5bGUgPT4ge1xuICAgIHJldHVybiBzaGFkb3dDc3MhLnNoaW1Dc3NUZXh0KHN0eWxlLCBzZWxlY3RvciwgaG9zdFNlbGVjdG9yKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlIHtcbiAgaWYgKCFtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gby5OT05FX1RZUEU7XG4gIH1cblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIobWV0YS5ob3N0RGlyZWN0aXZlcy5tYXAoaG9zdE1ldGEgPT4gby5saXRlcmFsTWFwKFtcbiAgICB7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IG8udHlwZW9mRXhwcihob3N0TWV0YS5kaXJlY3RpdmUudHlwZSksIHF1b3RlZDogZmFsc2V9LFxuICAgIHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihob3N0TWV0YS5pbnB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgICB7a2V5OiAnb3V0cHV0cycsIHZhbHVlOiBzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKGhvc3RNZXRhLm91dHB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgXSkpKSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICBob3N0RGlyZWN0aXZlczogTm9uTnVsbGFibGU8UjNEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdERpcmVjdGl2ZXMnXT4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgbGV0IGhhc0ZvcndhcmRSZWYgPSBmYWxzZTtcblxuICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgaG9zdERpcmVjdGl2ZXMpIHtcbiAgICAvLyBVc2UgYSBzaG9ydGhhbmQgaWYgdGhlcmUgYXJlIG5vIGlucHV0cyBvciBvdXRwdXRzLlxuICAgIGlmICghY3VycmVudC5pbnB1dHMgJiYgIWN1cnJlbnQub3V0cHV0cykge1xuICAgICAgZXhwcmVzc2lvbnMucHVzaChjdXJyZW50LmRpcmVjdGl2ZS50eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qga2V5cyA9IFt7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUsIHF1b3RlZDogZmFsc2V9XTtcblxuICAgICAgaWYgKGN1cnJlbnQuaW5wdXRzKSB7XG4gICAgICAgIGNvbnN0IGlucHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50LmlucHV0cyk7XG4gICAgICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICAgICAga2V5cy5wdXNoKHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogaW5wdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjdXJyZW50Lm91dHB1dHMpIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpO1xuICAgICAgICBpZiAob3V0cHV0c0xpdGVyYWwpIHtcbiAgICAgICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBleHByZXNzaW9ucy5wdXNoKG8ubGl0ZXJhbE1hcChrZXlzKSk7XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnQuaXNGb3J3YXJkUmVmZXJlbmNlKSB7XG4gICAgICBoYXNGb3J3YXJkUmVmID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW0hvc3REaXJdIH1gLFxuICAvLyBvdGhlcndpc2Ugd2UgY2FuIHNhdmUgc29tZSBieXRlcyBieSB1c2luZyBhIHBsYWluIGFycmF5LCBlLmcuIGBbSG9zdERpcl1gLlxuICByZXR1cm4gaGFzRm9yd2FyZFJlZiA/XG4gICAgICBuZXcgby5GdW5jdGlvbkV4cHIoW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKSldKSA6XG4gICAgICBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuIGlucHV0L291dHB1dCBtYXBwaW5nIG9iamVjdCBsaXRlcmFsIGludG8gYW4gYXJyYXkgd2hlcmUgdGhlIGV2ZW4ga2V5cyBhcmUgdGhlXG4gKiBwdWJsaWMgbmFtZSBvZiB0aGUgYmluZGluZyBhbmQgdGhlIG9kZCBvbmVzIGFyZSB0aGUgbmFtZSBpdCB3YXMgYWxpYXNlZCB0by4gRS5nLlxuICogYHtpbnB1dE9uZTogJ2FsaWFzT25lJywgaW5wdXRUd286ICdhbGlhc1R3byd9YCB3aWxsIGJlY29tZVxuICogYFsnaW5wdXRPbmUnLCAnYWxpYXNPbmUnLCAnaW5wdXRUd28nLCAnYWxpYXNUd28nXWAuXG4gKlxuICogVGhpcyBjb252ZXJzaW9uIGlzIG5lY2Vzc2FyeSwgYmVjYXVzZSBob3N0cyBiaW5kIHRvIHRoZSBwdWJsaWMgbmFtZSBvZiB0aGUgaG9zdCBkaXJlY3RpdmUgYW5kXG4gKiBrZWVwaW5nIHRoZSBtYXBwaW5nIGluIGFuIG9iamVjdCBsaXRlcmFsIHdpbGwgYnJlYWsgZm9yIGFwcHMgdXNpbmcgcHJvcGVydHkgcmVuYW1pbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShtYXBwaW5nOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTpcbiAgICBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVsZW1lbnRzOiBvLkxpdGVyYWxFeHByW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHB1YmxpY05hbWUgaW4gbWFwcGluZykge1xuICAgIGlmIChtYXBwaW5nLmhhc093blByb3BlcnR5KHB1YmxpY05hbWUpKSB7XG4gICAgICBlbGVtZW50cy5wdXNoKG8ubGl0ZXJhbChwdWJsaWNOYW1lKSwgby5saXRlcmFsKG1hcHBpbmdbcHVibGljTmFtZV0pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudHMubGVuZ3RoID4gMCA/IG8ubGl0ZXJhbEFycihlbGVtZW50cykgOiBudWxsO1xufVxuIl19