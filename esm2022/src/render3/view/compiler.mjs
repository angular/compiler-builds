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
    // Note: host directives feature needs to be inserted before the
    // inheritance feature to ensure the correct execution order.
    if (meta.hostDirectives?.length) {
        features.push(o.importExpr(R3.HostDirectivesFeature).callFn([createHostDirectivesFeatureArg(meta.hostDirectives)]));
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
 * Creates an AST for a function that contains dynamic imports representing
 * deferrable dependencies.
 */
function createDeferredDepsFunction(constantPool, name, deps) {
    // This defer block has deps for which we need to generate dynamic imports.
    const dependencyExp = [];
    for (const [symbolName, importPath] of deps) {
        // Callback function, e.g. `m () => m.MyCmp;`.
        const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], o.variable('m').prop(symbolName));
        // Dynamic import, e.g. `import('./a').then(...)`.
        const importExpr = (new o.DynamicImportExpr(importPath)).prop('then').callFn([innerFn]);
        dependencyExp.push(importExpr);
    }
    const depsFnExpr = o.arrowFn([], o.literalArr(dependencyExp));
    constantPool.statements.push(depsFnExpr.toDeclStmt(name, o.StmtModifier.Final));
    return o.variable(name);
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
    let allDeferrableDepsFn = null;
    if (meta.deferBlocks.size > 0 && meta.deferrableTypes.size > 0 &&
        meta.deferBlockDepsEmitMode === 1 /* DeferBlockDepsEmitMode.PerComponent */) {
        const fnName = `${templateTypeName}_DeferFn`;
        allDeferrableDepsFn = createDeferredDepsFunction(constantPool, fnName, meta.deferrableTypes);
    }
    // Template compilation is currently conditional as we're in the process of rewriting it.
    if (!USE_TEMPLATE_PIPELINE) {
        // This is the main path currently used in compilation, which compiles the template with the
        // legacy `TemplateDefinitionBuilder`.
        const template = meta.template;
        const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.createRootScope(), 0, templateTypeName, null, null, templateName, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.deferBlocks, new Map(), allDeferrableDepsFn);
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
        const tpl = ingestComponent(meta.name, meta.template.nodes, constantPool, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.deferBlocks, allDeferrableDepsFn);
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
        const values = [
            { key: 'alias', value: o.literal(value.bindingPropertyName), quoted: true },
            { key: 'required', value: o.literal(value.required), quoted: true },
        ];
        // TODO(legacy-partial-output-inputs): Consider always emitting this information,
        // or leaving it as is.
        if (value.isSignal) {
            values.push({ key: 'isSignal', value: o.literal(value.isSignal), quoted: true });
        }
        return { key, value: o.literalMap(values), quoted: true };
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
            hostBindingsMetadata.attributes['style'] =
                o.literal(hostBindingsMetadata.specialAttributes.styleAttr);
        }
        if (hostBindingsMetadata.specialAttributes.classAttr) {
            hostBindingsMetadata.attributes['class'] =
                o.literal(hostBindingsMetadata.specialAttributes.classAttr);
        }
        const hostJob = ingestHostBinding({
            componentName: name,
            componentSelector: selector,
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
    let bindingId = 0;
    const getNextBindingId = () => `${bindingId++}`;
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
        const bindingExpr = bindingFn(bindingContext, value, getNextBindingId);
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
                const { params, stmts } = convertStylingCall(call, bindingContext, bindingFn, getNextBindingId);
                updateVariables.push(...stmts);
                updateInstructions.push({
                    reference: instruction.reference,
                    paramsOrFn: params,
                    span: null,
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
function bindingFn(implicit, value, getNextBindingIdFn) {
    return convertPropertyBinding(null, implicit, value, getNextBindingIdFn());
}
function convertStylingCall(call, bindingContext, bindingFn, getNextBindingIdFn) {
    const stmts = [];
    const params = call.params(value => {
        const result = bindingFn(bindingContext, value, getNextBindingIdFn);
        if (Array.isArray(result.stmts) && result.stmts.length > 0) {
            stmts.push(...result.stmts);
        }
        return result.currValExpr;
    });
    return { params, stmts };
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
/**
 * Encapsulates a CSS stylesheet with emulated view encapsulation.
 * This allows a stylesheet to be used with an Angular component that
 * is using the `ViewEncapsulation.Emulated` mode.
 *
 * @param style The content of a CSS stylesheet.
 * @returns The encapsulated content for the style.
 */
export function encapsulateStyle(style) {
    const shadowCss = new ShadowCss();
    return shadowCss.shimCssText(style, CONTENT_ATTR, HOST_ATTR);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRWhGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pGLE9BQU8sRUFBQyw2QkFBNkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRyxPQUFPLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDdEYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUF3QixrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUdySSxPQUFPLEVBQUMsa0NB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Ozs7OztHQVFHO0FBQ0gsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLE9BQStCO0lBRTlFLE1BQU0sUUFBUSxHQUFvQixFQUFFLENBQUM7SUFFckMsS0FBSyxNQUFNLFVBQVUsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNqQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUN2QyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzdELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge2NvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iS2luZH0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7ZW1pdEhvc3RCaW5kaW5nRnVuY3Rpb24sIGVtaXRUZW1wbGF0ZUZuLCB0cmFuc2Zvcm19IGZyb20gJy4uLy4uL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9lbWl0JztcbmltcG9ydCB7aW5nZXN0Q29tcG9uZW50LCBpbmdlc3RIb3N0QmluZGluZ30gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luZ2VzdCc7XG5pbXBvcnQge1VTRV9URU1QTEFURV9QSVBFTElORX0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3dpdGNoJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIFIzQ29tcGlsZWRFeHByZXNzaW9uLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhLCBSM1RlbXBsYXRlRGVwZW5kZW5jeX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVELCBTdHlsaW5nQnVpbGRlciwgU3R5bGluZ0luc3RydWN0aW9uQ2FsbH0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIG1ha2VCaW5kaW5nUGFyc2VyLCBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMsIHJlbmRlckZsYWdDaGVja0lmU3RtdCwgcmVzb2x2ZVNhbml0aXphdGlvbkZuLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsLCBDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIGdldEluc3RydWN0aW9uU3RhdGVtZW50cywgZ2V0UXVlcnlQcmVkaWNhdGUsIEluc3RydWN0aW9uLCBSRU5ERVJfRkxBR1MsIFRFTVBPUkFSWV9OQU1FLCB0ZW1wb3JhcnlBbGxvY2F0b3J9IGZyb20gJy4vdXRpbCc7XG5cblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cblxuY29uc3QgQ09NUE9ORU5UX1ZBUklBQkxFID0gJyVDT01QJSc7XG5jb25zdCBIT1NUX0FUVFIgPSBgX25naG9zdC0ke0NPTVBPTkVOVF9WQVJJQUJMRX1gO1xuY29uc3QgQ09OVEVOVF9BVFRSID0gYF9uZ2NvbnRlbnQtJHtDT01QT05FTlRfVkFSSUFCTEV9YDtcblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogRGVmaW5pdGlvbk1hcCB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBjb25zdCBzZWxlY3RvcnMgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IobWV0YS5zZWxlY3Rvcik7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlLnZhbHVlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGFzTGl0ZXJhbChzZWxlY3RvcnMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIGUuZy4gYGNvbnRlbnRRdWVyaWVzOiAocmYsIGN0eCwgZGlySW5kZXgpID0+IHsgLi4uIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLnF1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YS52aWV3UXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJyxcbiAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgIG1ldGEuaG9zdCwgbWV0YS50eXBlU291cmNlU3BhbiwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBtZXRhLnNlbGVjdG9yIHx8ICcnLFxuICAgICAgICAgIG1ldGEubmFtZSwgZGVmaW5pdGlvbk1hcCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuaXNTdGFuZGFsb25lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0YW5kYWxvbmUnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NpZ25hbHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCxcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhfFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YS5wcm92aWRlcnM7XG4gIGNvbnN0IHZpZXdQcm92aWRlcnMgPSAobWV0YSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pikudmlld1Byb3ZpZGVycztcbiAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMobWV0YS5pbnB1dHMpO1xuXG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG4gIGZvciAoY29uc3Qga2V5IG9mIGlucHV0S2V5cykge1xuICAgIGlmIChtZXRhLmlucHV0c1trZXldLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5JbnB1dFRyYW5zZm9ybXNGZWF0dXJlRmVhdHVyZSkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIE5vdGU6IGhvc3QgZGlyZWN0aXZlcyBmZWF0dXJlIG5lZWRzIHRvIGJlIGluc2VydGVkIGJlZm9yZSB0aGVcbiAgLy8gaW5oZXJpdGFuY2UgZmVhdHVyZSB0byBlbnN1cmUgdGhlIGNvcnJlY3QgZXhlY3V0aW9uIG9yZGVyLlxuICBpZiAobWV0YS5ob3N0RGlyZWN0aXZlcz8ubGVuZ3RoKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSG9zdERpcmVjdGl2ZXNGZWF0dXJlKS5jYWxsRm4oW2NyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICAgICAgbWV0YS5ob3N0RGlyZWN0aXZlcyldKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICAvLyBUT0RPOiBiZXR0ZXIgd2F5IG9mIGRpZmZlcmVudGlhdGluZyBjb21wb25lbnQgdnMgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICBpZiAobWV0YS5oYXNPd25Qcm9wZXJ0eSgndGVtcGxhdGUnKSAmJiBtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlN0YW5kYWxvbmVGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gQVNUIGZvciBhIGZ1bmN0aW9uIHRoYXQgY29udGFpbnMgZHluYW1pYyBpbXBvcnRzIHJlcHJlc2VudGluZ1xuICogZGVmZXJyYWJsZSBkZXBlbmRlbmNpZXMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkRGVwc0Z1bmN0aW9uKFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lOiBzdHJpbmcsIGRlcHM6IE1hcDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgLy8gVGhpcyBkZWZlciBibG9jayBoYXMgZGVwcyBmb3Igd2hpY2ggd2UgbmVlZCB0byBnZW5lcmF0ZSBkeW5hbWljIGltcG9ydHMuXG4gIGNvbnN0IGRlcGVuZGVuY3lFeHA6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgZm9yIChjb25zdCBbc3ltYm9sTmFtZSwgaW1wb3J0UGF0aF0gb2YgZGVwcykge1xuICAgIC8vIENhbGxiYWNrIGZ1bmN0aW9uLCBlLmcuIGBtICgpID0+IG0uTXlDbXA7YC5cbiAgICBjb25zdCBpbm5lckZuID1cbiAgICAgICAgby5hcnJvd0ZuKFtuZXcgby5GblBhcmFtKCdtJywgby5EWU5BTUlDX1RZUEUpXSwgby52YXJpYWJsZSgnbScpLnByb3Aoc3ltYm9sTmFtZSkpO1xuXG4gICAgLy8gRHluYW1pYyBpbXBvcnQsIGUuZy4gYGltcG9ydCgnLi9hJykudGhlbiguLi4pYC5cbiAgICBjb25zdCBpbXBvcnRFeHByID0gKG5ldyBvLkR5bmFtaWNJbXBvcnRFeHByKGltcG9ydFBhdGgpKS5wcm9wKCd0aGVuJykuY2FsbEZuKFtpbm5lckZuXSk7XG4gICAgZGVwZW5kZW5jeUV4cC5wdXNoKGltcG9ydEV4cHIpO1xuICB9XG5cbiAgY29uc3QgZGVwc0ZuRXhwciA9IG8uYXJyb3dGbihbXSwgby5saXRlcmFsQXJyKGRlcGVuZGVuY3lFeHApKTtcblxuICBjb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKGRlcHNGbkV4cHIudG9EZWNsU3RtdChuYW1lLCBvLlN0bXRNb2RpZmllci5GaW5hbCkpO1xuXG4gIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5PiwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJyxcbiAgICAgICAgICBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JBdHRyaWJ1dGVzLm1hcChcbiAgICAgICAgICAgICAgICAgIHZhbHVlID0+IHZhbHVlICE9IG51bGwgPyBvLmxpdGVyYWwodmFsdWUpIDogby5saXRlcmFsKHVuZGVmaW5lZCkpKSxcbiAgICAgICAgICAgICAgLyogZm9yY2VTaGFyZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGUuZy4gYHRlbXBsYXRlOiBmdW5jdGlvbiBNeUNvbXBvbmVudF9UZW1wbGF0ZShfY3R4LCBfY20pIHsuLi59YFxuICBjb25zdCB0ZW1wbGF0ZVR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZVR5cGVOYW1lID8gYCR7dGVtcGxhdGVUeXBlTmFtZX1fVGVtcGxhdGVgIDogbnVsbDtcblxuXG4gIGxldCBhbGxEZWZlcnJhYmxlRGVwc0ZuOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBpZiAobWV0YS5kZWZlckJsb2Nrcy5zaXplID4gMCAmJiBtZXRhLmRlZmVycmFibGVUeXBlcy5zaXplID4gMCAmJlxuICAgICAgbWV0YS5kZWZlckJsb2NrRGVwc0VtaXRNb2RlID09PSBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLlBlckNvbXBvbmVudCkge1xuICAgIGNvbnN0IGZuTmFtZSA9IGAke3RlbXBsYXRlVHlwZU5hbWV9X0RlZmVyRm5gO1xuICAgIGFsbERlZmVycmFibGVEZXBzRm4gPSBjcmVhdGVEZWZlcnJlZERlcHNGdW5jdGlvbihjb25zdGFudFBvb2wsIGZuTmFtZSwgbWV0YS5kZWZlcnJhYmxlVHlwZXMpO1xuICB9XG5cbiAgLy8gVGVtcGxhdGUgY29tcGlsYXRpb24gaXMgY3VycmVudGx5IGNvbmRpdGlvbmFsIGFzIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIHJld3JpdGluZyBpdC5cbiAgaWYgKCFVU0VfVEVNUExBVEVfUElQRUxJTkUpIHtcbiAgICAvLyBUaGlzIGlzIHRoZSBtYWluIHBhdGggY3VycmVudGx5IHVzZWQgaW4gY29tcGlsYXRpb24sIHdoaWNoIGNvbXBpbGVzIHRoZSB0ZW1wbGF0ZSB3aXRoIHRoZVxuICAgIC8vIGxlZ2FjeSBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAuXG5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gICAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLmNyZWF0ZVJvb3RTY29wZSgpLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICAgIFIzLm5hbWVzcGFjZUhUTUwsIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzLCBtZXRhLmRlZmVyQmxvY2tzLFxuICAgICAgICBuZXcgTWFwKCksIGFsbERlZmVycmFibGVEZXBzRm4pO1xuXG4gICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgdGhpcyBzbyB0aGF0IGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjb21wb25lbnRzIGtub3cgd2hhdFxuICAgIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzXG4gICAgLy8gICAgIGluc3RhbnRpYXRlZC5cbiAgICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycykge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgfVxuXG4gICAgLy8gZS5nLiBgZGVjbHM6IDJgXG4gICAgLy8gZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xzJywgby5saXRlcmFsKHRwbC5yb290LmRlY2xzISkpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgICAvLyBlLmcuIGB2YXJzOiAyYFxuICAgIC8vIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRwbC5yb290LnZhcnMhKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICAgIC8vIEdlbmVyYXRlIGBjb25zdHNgIHNlY3Rpb24gb2YgQ29tcG9uZW50RGVmOlxuICAgIC8vIC0gZWl0aGVyIGFzIGFuIGFycmF5OlxuICAgIC8vICAgYGNvbnN0czogW1snb25lJywgJ3R3byddLCBbJ3RocmVlJywgJ2ZvdXInXV1gXG4gICAgLy8gLSBvciBhcyBhIGZhY3RvcnkgZnVuY3Rpb24gaW4gY2FzZSBhZGRpdGlvbmFsIHN0YXRlbWVudHMgYXJlIHByZXNlbnQgKHRvIHN1cHBvcnQgaTE4bik6XG4gICAgLy8gICBgY29uc3RzOiAoKSA9PiB7IHZhciBpMThuXzA7IGlmIChuZ0kxOG5DbG9zdXJlTW9kZSkgey4uLn0gZWxzZSB7Li4ufSByZXR1cm4gW2kxOG5fMF07XG4gICAgLy8gICB9YFxuICAgIGNvbnN0IHtjb25zdEV4cHJlc3Npb25zLCBwcmVwYXJlU3RhdGVtZW50c30gPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RzKCk7XG4gICAgaWYgKGNvbnN0RXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IGNvbnN0c0V4cHI6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkFycm93RnVuY3Rpb25FeHByID0gby5saXRlcmFsQXJyKGNvbnN0RXhwcmVzc2lvbnMpO1xuICAgICAgLy8gUHJlcGFyZSBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50IC0gdHVybiBgY29uc3RzYCBpbnRvIGEgZnVuY3Rpb24uXG4gICAgICBpZiAocHJlcGFyZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdHNFeHByID0gby5hcnJvd0ZuKFtdLCBbLi4ucHJlcGFyZVN0YXRlbWVudHMsIG5ldyBvLlJldHVyblN0YXRlbWVudChjb25zdHNFeHByKV0pO1xuICAgICAgfVxuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIGNvbnN0c0V4cHIpO1xuICAgIH1cblxuICAgIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGlzIHBhdGggY29tcGlsZXMgdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBwcm90b3R5cGUgdGVtcGxhdGUgcGlwZWxpbmUuIEZpcnN0IHRoZSB0ZW1wbGF0ZSBpc1xuICAgIC8vIGluZ2VzdGVkIGludG8gSVI6XG4gICAgY29uc3QgdHBsID0gaW5nZXN0Q29tcG9uZW50KFxuICAgICAgICBtZXRhLm5hbWUsIG1ldGEudGVtcGxhdGUubm9kZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCxcbiAgICAgICAgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMsIG1ldGEuZGVmZXJCbG9ja3MsIGFsbERlZmVycmFibGVEZXBzRm4pO1xuXG4gICAgLy8gVGhlbiB0aGUgSVIgaXMgdHJhbnNmb3JtZWQgdG8gcHJlcGFyZSBpdCBmb3IgY29kIGVnZW5lcmF0aW9uLlxuICAgIHRyYW5zZm9ybSh0cGwsIENvbXBpbGF0aW9uSm9iS2luZC5UbXBsKTtcblxuICAgIC8vIEZpbmFsbHkgd2UgZW1pdCB0aGUgdGVtcGxhdGUgZnVuY3Rpb246XG4gICAgY29uc3QgdGVtcGxhdGVGbiA9IGVtaXRUZW1wbGF0ZUZuKHRwbCwgY29uc3RhbnRQb29sKTtcblxuICAgIGlmICh0cGwuY29udGVudFNlbGVjdG9ycyAhPT0gbnVsbCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIHRwbC5jb250ZW50U2VsZWN0b3JzKTtcbiAgICB9XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodHBsLnJvb3QuZGVjbHMgYXMgbnVtYmVyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodHBsLnJvb3QudmFycyBhcyBudW1iZXIpKTtcbiAgICBpZiAodHBsLmNvbnN0cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAodHBsLmNvbnN0c0luaXRpYWxpemVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmFycm93Rm4oW10sIFtcbiAgICAgICAgICAuLi50cGwuY29uc3RzSW5pdGlhbGl6ZXJzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKVxuICAgICAgICBdKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGbik7XG4gIH1cblxuICBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkICYmXG4gICAgICBtZXRhLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkZXBlbmRlbmNpZXMnLFxuICAgICAgICBjb21waWxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgICAgICAgby5saXRlcmFsQXJyKG1ldGEuZGVjbGFyYXRpb25zLm1hcChkZWNsID0+IGRlY2wudHlwZSkpLCBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSA9PT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkKSB7XG4gICAgY29uc3QgYXJncyA9IFttZXRhLnR5cGUudmFsdWVdO1xuICAgIGlmIChtZXRhLnJhd0ltcG9ydHMpIHtcbiAgICAgIGFyZ3MucHVzaChtZXRhLnJhd0ltcG9ydHMpO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVwZW5kZW5jaWVzJywgby5pbXBvcnRFeHByKFIzLmdldENvbXBvbmVudERlcHNGYWN0b3J5KS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHlsZU5vZGVzID0gc3R5bGVWYWx1ZXMucmVkdWNlKChyZXN1bHQsIHN0eWxlKSA9PiB7XG4gICAgICBpZiAoc3R5bGUudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVzdWx0LnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWwoc3R5bGUpKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sIFtdIGFzIG8uRXhwcmVzc2lvbltdKTtcblxuICAgIGlmIChzdHlsZU5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3R5bGVOb2RlcykpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBTZXR0aW5nIGNoYW5nZSBkZXRlY3Rpb24gZmxhZ1xuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIG1ldGEuY2hhbmdlRGV0ZWN0aW9uID09PSAnbnVtYmVyJyAmJlxuICAgICAgICBtZXRhLmNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgcmVzb2x2ZWQgZHVyaW5nIGFuYWx5c2lzLiBPbmx5IHNldCBpdCBpZiBub3QgdGhlIGRlZmF1bHQuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKG1ldGEuY2hhbmdlRGV0ZWN0aW9uKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YS5jaGFuZ2VEZXRlY3Rpb24gPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgbm90IHJlc29sdmVkIGR1cmluZyBhbmFseXNpcyAoZS5nLiwgd2UgYXJlIGluIGxvY2FsIGNvbXBpbGF0aW9uIG1vZGUpLlxuICAgICAgLy8gU28gcGxhY2UgaXQgYXMgaXMuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgbWV0YS5jaGFuZ2VEZXRlY3Rpb24pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgdHlwZSBzcGVjaWZpY2F0aW9uIGZyb20gdGhlIGNvbXBvbmVudCBtZXRhLiBUaGlzIHR5cGUgaXMgaW5zZXJ0ZWQgaW50byAuZC50cyBmaWxlc1xuICogdG8gYmUgY29uc3VtZWQgYnkgdXBzdHJlYW0gY29tcGlsYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pik6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgdHlwZVBhcmFtcy5wdXNoKHN0cmluZ0FycmF5QXNUeXBlKG1ldGEudGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzKSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQ29tcG9uZW50RGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgYXJyYXkgbGl0ZXJhbCBvZiBkZWNsYXJhdGlvbnMgaW50byBhbiBleHByZXNzaW9uIGFjY29yZGluZyB0byB0aGUgcHJvdmlkZWQgZW1pdFxuICogbW9kZS5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZURlY2xhcmF0aW9uTGlzdChcbiAgICBsaXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIG1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKTogby5FeHByZXNzaW9uIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3Q6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlOlxuICAgICAgLy8gZGlyZWN0aXZlczogZnVuY3Rpb24gKCkgeyByZXR1cm4gW015RGlyXTsgfVxuICAgICAgcmV0dXJuIG8uYXJyb3dGbihbXSwgbGlzdCk7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQ6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbTXlEaXJdLm1hcChuZy5yZXNvbHZlRm9yd2FyZFJlZik7IH1cbiAgICAgIGNvbnN0IHJlc29sdmVkTGlzdCA9IGxpc3QucHJvcCgnbWFwJykuY2FsbEZuKFtvLmltcG9ydEV4cHIoUjMucmVzb2x2ZUZvcndhcmRSZWYpXSk7XG4gICAgICByZXR1cm4gby5hcnJvd0ZuKFtdLCByZXNvbHZlZExpc3QpO1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB3aXRoIGFuIGFycmF5IG9mIHByZS1yZXNvbHZlZCBkZXBlbmRlbmNpZXNgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCksIG8ubGl0ZXJhbCh0b1F1ZXJ5RmxhZ3MocXVlcnkpKV07XG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vKipcbiAqIEEgc2V0IG9mIGZsYWdzIHRvIGJlIHVzZWQgd2l0aCBRdWVyaWVzLlxuICpcbiAqIE5PVEU6IEVuc3VyZSBjaGFuZ2VzIGhlcmUgYXJlIGluIHN5bmMgd2l0aCBgcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnRlcmZhY2VzL3F1ZXJ5LnRzYFxuICovXG5leHBvcnQgY29uc3QgZW51bSBRdWVyeUZsYWdzIHtcbiAgLyoqXG4gICAqIE5vIGZsYWdzXG4gICAqL1xuICBub25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgcXVlcnkgc2hvdWxkIGRlc2NlbmQgaW50byBjaGlsZHJlbi5cbiAgICovXG4gIGRlc2NlbmRhbnRzID0gMGIwMDAxLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgY2FuIGJlIGNvbXB1dGVkIHN0YXRpY2FsbHkgYW5kIGhlbmNlIGNhbiBiZSBhc3NpZ25lZCBlYWdlcmx5LlxuICAgKlxuICAgKiBOT1RFOiBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIFZpZXdFbmdpbmUuXG4gICAqL1xuICBpc1N0YXRpYyA9IDBiMDAxMCxcblxuICAvKipcbiAgICogSWYgdGhlIGBRdWVyeUxpc3RgIHNob3VsZCBmaXJlIGNoYW5nZSBldmVudCBvbmx5IGlmIGFjdHVhbCBjaGFuZ2UgdG8gcXVlcnkgd2FzIGNvbXB1dGVkICh2cyBvbGRcbiAgICogYmVoYXZpb3Igd2hlcmUgdGhlIGNoYW5nZSB3YXMgZmlyZWQgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHdhcyByZWNvbXB1dGVkLCBldmVuIGlmIHRoZSByZWNvbXB1dGVkXG4gICAqIHF1ZXJ5IHJlc3VsdGVkIGluIHRoZSBzYW1lIGxpc3QuKVxuICAgKi9cbiAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgPSAwYjAxMDAsXG59XG5cbi8qKlxuICogVHJhbnNsYXRlcyBxdWVyeSBmbGFncyBpbnRvIGBUUXVlcnlGbGFnc2AgdHlwZSBpbiBwYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2ludGVyZmFjZXMvcXVlcnkudHNcbiAqIEBwYXJhbSBxdWVyeVxuICovXG5mdW5jdGlvbiB0b1F1ZXJ5RmxhZ3MocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG51bWJlciB7XG4gIHJldHVybiAocXVlcnkuZGVzY2VuZGFudHMgPyBRdWVyeUZsYWdzLmRlc2NlbmRhbnRzIDogUXVlcnlGbGFncy5ub25lKSB8XG4gICAgICAocXVlcnkuc3RhdGljID8gUXVlcnlGbGFncy5pc1N0YXRpYyA6IFF1ZXJ5RmxhZ3Mubm9uZSkgfFxuICAgICAgKHF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8gUXVlcnlGbGFncy5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSA6IFF1ZXJ5RmxhZ3Mubm9uZSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgcXVlcmllcykge1xuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLmNvbnRlbnRRdWVyeShkaXJJbmRleCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSwgbnVsbCk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuY29udGVudFF1ZXJ5KVxuICAgICAgICAgICAgLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKSwgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpIGFzIGFueV0pXG4gICAgICAgICAgICAudG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFF1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9XG5cbiAgY29uc3QgY29udGVudFF1ZXJpZXNGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd8c3RyaW5nW119KTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IG1hcFZhbHVlcyA9IE9iamVjdC5rZXlzKG1hcCkubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KG1hcFtrZXldKSA/IG1hcFtrZXldWzBdIDogbWFwW2tleV07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleSxcbiAgICAgIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUpLFxuICAgICAgcXVvdGVkOiB0cnVlLFxuICAgIH07XG4gIH0pO1xuXG4gIHJldHVybiBvLmxpdGVyYWxNYXAobWFwVmFsdWVzKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXJyYXlBc1R5cGUoYXJyOiBSZWFkb25seUFycmF5PHN0cmluZ3xudWxsPik6IG8uVHlwZSB7XG4gIHJldHVybiBhcnIubGVuZ3RoID4gMCA/IG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsQXJyKGFyci5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG8uTk9ORV9UWVBFO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlW10ge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gbWV0YS5zZWxlY3RvciAhPT0gbnVsbCA/IG1ldGEuc2VsZWN0b3IucmVwbGFjZSgvXFxuL2csICcnKSA6IG51bGw7XG5cbiAgcmV0dXJuIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpLFxuICAgIHNlbGVjdG9yRm9yVHlwZSAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShzZWxlY3RvckZvclR5cGUpIDogby5OT05FX1RZUEUsXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FycmF5QXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgby5leHByZXNzaW9uVHlwZShnZXRJbnB1dHNUeXBlRXhwcmVzc2lvbihtZXRhKSksXG4gICAgby5leHByZXNzaW9uVHlwZShzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKG1ldGEub3V0cHV0cykpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdO1xufVxuXG5mdW5jdGlvbiBnZXRJbnB1dHNUeXBlRXhwcmVzc2lvbihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChPYmplY3Qua2V5cyhtZXRhLmlucHV0cykubWFwKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBtZXRhLmlucHV0c1trZXldO1xuICAgIGNvbnN0IHZhbHVlcyA9IFtcbiAgICAgIHtrZXk6ICdhbGlhcycsIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUuYmluZGluZ1Byb3BlcnR5TmFtZSksIHF1b3RlZDogdHJ1ZX0sXG4gICAgICB7a2V5OiAncmVxdWlyZWQnLCB2YWx1ZTogby5saXRlcmFsKHZhbHVlLnJlcXVpcmVkKSwgcXVvdGVkOiB0cnVlfSxcbiAgICBdO1xuXG4gICAgLy8gVE9ETyhsZWdhY3ktcGFydGlhbC1vdXRwdXQtaW5wdXRzKTogQ29uc2lkZXIgYWx3YXlzIGVtaXR0aW5nIHRoaXMgaW5mb3JtYXRpb24sXG4gICAgLy8gb3IgbGVhdmluZyBpdCBhcyBpcy5cbiAgICBpZiAodmFsdWUuaXNTaWduYWwpIHtcbiAgICAgIHZhbHVlcy5wdXNoKHtrZXk6ICdpc1NpZ25hbCcsIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUuaXNTaWduYWwpLCBxdW90ZWQ6IHRydWV9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2tleSwgdmFsdWU6IG8ubGl0ZXJhbE1hcCh2YWx1ZXMpLCBxdW90ZWQ6IHRydWV9O1xuICB9KSk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgdHlwZSBzcGVjaWZpY2F0aW9uIGZyb20gdGhlIGRpcmVjdGl2ZSBtZXRhLiBUaGlzIHR5cGUgaXMgaW5zZXJ0ZWQgaW50byAuZC50cyBmaWxlc1xuICogdG8gYmUgY29uc3VtZWQgYnkgdXBzdHJlYW0gY29tcGlsYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlVHlwZShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlIHtcbiAgY29uc3QgdHlwZVBhcmFtcyA9IGNyZWF0ZUJhc2VEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGEpO1xuICAvLyBEaXJlY3RpdmVzIGhhdmUgbm8gTmdDb250ZW50U2VsZWN0b3JzIHNsb3QsIGJ1dCBpbnN0ZWFkIGV4cHJlc3MgYSBgbmV2ZXJgIHR5cGVcbiAgLy8gc28gdGhhdCBmdXR1cmUgZmllbGRzIGFsaWduLlxuICB0eXBlUGFyYW1zLnB1c2goby5OT05FX1RZUEUpO1xuICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1N0YW5kYWxvbmUpKSk7XG4gIHR5cGVQYXJhbXMucHVzaChjcmVhdGVIb3N0RGlyZWN0aXZlc1R5cGUobWV0YSkpO1xuICAvLyBUT0RPKHNpZ25hbHMpOiBBbHdheXMgaW5jbHVkZSB0aGlzIG1ldGFkYXRhIHN0YXJ0aW5nIHdpdGggdjE3LiBSaWdodFxuICAvLyBub3cgQW5ndWxhciB2MTYuMC54IGRvZXMgbm90IHN1cHBvcnQgdGhpcyBmaWVsZCBhbmQgbGlicmFyeSBkaXN0cmlidXRpb25zXG4gIC8vIHdvdWxkIHRoZW4gYmUgaW5jb21wYXRpYmxlIHdpdGggdjE2LjAueCBmcmFtZXdvcmsgdXNlcnMuXG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgdHlwZVBhcmFtcy5wdXNoKG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKG1ldGEuaXNTaWduYWwpKSk7XG4gIH1cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkRpcmVjdGl2ZURlY2xhcmF0aW9uLCB0eXBlUGFyYW1zKSk7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSB2aWV3IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24oXG4gICAgdmlld1F1ZXJpZXM6IFIzUXVlcnlNZXRhZGF0YVtdLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgbmFtZT86IHN0cmluZyk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICB2aWV3UXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhKSA9PiB7XG4gICAgLy8gY3JlYXRpb24sIGUuZy4gcjMudmlld1F1ZXJ5KHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9XG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy52aWV3UXVlcnkpLmNhbGxGbihwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnksIGNvbnN0YW50UG9vbCkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFF1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9KTtcblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fUXVlcnlgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB2aWV3UXVlcnlGbk5hbWUpO1xufVxuXG4vLyBSZXR1cm4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgIGhvc3RCaW5kaW5nc01ldGFkYXRhOiBSM0hvc3RNZXRhZGF0YSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgc2VsZWN0b3I6IHN0cmluZywgbmFtZTogc3RyaW5nLFxuICAgIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXApOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhob3N0QmluZGluZ3NNZXRhZGF0YS5wcm9wZXJ0aWVzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoaG9zdEJpbmRpbmdzTWV0YWRhdGEubGlzdGVuZXJzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgaWYgKFVTRV9URU1QTEFURV9QSVBFTElORSkge1xuICAgIC8vIFRoZSBwYXJzZXIgZm9yIGhvc3QgYmluZGluZ3MgdHJlYXRzIGNsYXNzIGFuZCBzdHlsZSBhdHRyaWJ1dGVzIHNwZWNpYWxseSAtLSB0aGV5IGFyZVxuICAgIC8vIGV4dHJhY3RlZCBpbnRvIHRoZXNlIHNlcGFyYXRlIGZpZWxkcy4gVGhpcyBpcyBub3QgdGhlIGNhc2UgZm9yIHRlbXBsYXRlcywgc28gdGhlIGNvbXBpbGVyIGNhblxuICAgIC8vIGFjdHVhbGx5IGFscmVhZHkgaGFuZGxlIHRoZXNlIHNwZWNpYWwgYXR0cmlidXRlcyBpbnRlcm5hbGx5LiBUaGVyZWZvcmUsIHdlIGp1c3QgZHJvcCB0aGVtXG4gICAgLy8gaW50byB0aGUgYXR0cmlidXRlcyBtYXAuXG4gICAgaWYgKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgICAgaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlc1snc3R5bGUnXSA9XG4gICAgICAgICAgby5saXRlcmFsKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cik7XG4gICAgfVxuICAgIGlmIChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICAgIGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXNbJ2NsYXNzJ10gPVxuICAgICAgICAgIG8ubGl0ZXJhbChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3RKb2IgPSBpbmdlc3RIb3N0QmluZGluZyhcbiAgICAgICAge1xuICAgICAgICAgIGNvbXBvbmVudE5hbWU6IG5hbWUsXG4gICAgICAgICAgY29tcG9uZW50U2VsZWN0b3I6IHNlbGVjdG9yLFxuICAgICAgICAgIHByb3BlcnRpZXM6IGJpbmRpbmdzLFxuICAgICAgICAgIGV2ZW50czogZXZlbnRCaW5kaW5ncyxcbiAgICAgICAgICBhdHRyaWJ1dGVzOiBob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzLFxuICAgICAgICB9LFxuICAgICAgICBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wpO1xuICAgIHRyYW5zZm9ybShob3N0Sm9iLCBDb21waWxhdGlvbkpvYktpbmQuSG9zdCk7XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdEF0dHJzJywgaG9zdEpvYi5yb290LmF0dHJpYnV0ZXMpO1xuXG4gICAgY29uc3QgdmFyQ291bnQgPSBob3N0Sm9iLnJvb3QudmFycztcbiAgICBpZiAodmFyQ291bnQgIT09IG51bGwgJiYgdmFyQ291bnQgPiAwKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdFZhcnMnLCBvLmxpdGVyYWwodmFyQ291bnQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdEhvc3RCaW5kaW5nRnVuY3Rpb24oaG9zdEpvYik7XG4gIH1cblxuICBsZXQgYmluZGluZ0lkID0gMDtcbiAgY29uc3QgZ2V0TmV4dEJpbmRpbmdJZCA9ICgpID0+IGAke2JpbmRpbmdJZCsrfWA7XG5cbiAgY29uc3QgYmluZGluZ0NvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihiaW5kaW5nQ29udGV4dCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzO1xuICBpZiAoc3R5bGVBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIoc3R5bGVBdHRyKTtcbiAgfVxuICBpZiAoY2xhc3NBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIoY2xhc3NBdHRyKTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZUluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICBjb25zdCB1cGRhdGVJbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgY29uc3QgdXBkYXRlVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gdHlwZVNvdXJjZVNwYW47XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY3JlYXRlSW5zdHJ1Y3Rpb25zLnB1c2goLi4uY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzLCBuYW1lKSk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYWxsT3RoZXJCaW5kaW5nczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuXG4gIC8vIFdlIG5lZWQgdG8gY2FsY3VsYXRlIHRoZSB0b3RhbCBhbW91bnQgb2YgYmluZGluZyBzbG90cyByZXF1aXJlZCBieVxuICAvLyBhbGwgdGhlIGluc3RydWN0aW9ucyB0b2dldGhlciBiZWZvcmUgYW55IHZhbHVlIGNvbnZlcnNpb25zIGhhcHBlbi5cbiAgLy8gVmFsdWUgY29udmVyc2lvbnMgbWF5IHJlcXVpcmUgYWRkaXRpb25hbCBzbG90cyBmb3IgaW50ZXJwb2xhdGlvbiBhbmRcbiAgLy8gYmluZGluZ3Mgd2l0aCBwaXBlcy4gVGhlc2UgY2FsY3VsYXRlcyBoYXBwZW4gYWZ0ZXIgdGhpcyBibG9jay5cbiAgbGV0IHRvdGFsSG9zdFZhcnNDb3VudCA9IDA7XG4gIGJpbmRpbmdzICYmIGJpbmRpbmdzLmZvckVhY2goKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID0gc3R5bGVCdWlsZGVyLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShcbiAgICAgICAgYmluZGluZy5uYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gICAgaWYgKHN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFsbE90aGVyQmluZGluZ3MucHVzaChiaW5kaW5nKTtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCsrO1xuICAgIH1cbiAgfSk7XG5cbiAgbGV0IHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgY29uc3QgZ2V0VmFsdWVDb252ZXJ0ZXIgPSAoKSA9PiB7XG4gICAgaWYgKCF2YWx1ZUNvbnZlcnRlcikge1xuICAgICAgY29uc3QgaG9zdFZhcnNDb3VudEZuID0gKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFZhcnNDb3VudCA9IHRvdGFsSG9zdFZhcnNDb3VudDtcbiAgICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IG51bVNsb3RzO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxWYXJzQ291bnQ7XG4gICAgICB9O1xuICAgICAgdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgICAgY29uc3RhbnRQb29sLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIG5vZGUnKSwgIC8vIG5ldyBub2RlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgICAgICAgaG9zdFZhcnNDb3VudEZuLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIHBpcGUnKSk7ICAvLyBwaXBlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZUNvbnZlcnRlcjtcbiAgfTtcblxuICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0hvc3RCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgYmluZGluZyBvZiBhbGxPdGhlckJpbmRpbmdzKSB7XG4gICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQoZ2V0VmFsdWVDb252ZXJ0ZXIoKSk7XG4gICAgY29uc3QgYmluZGluZ0V4cHIgPSBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlLCBnZXROZXh0QmluZGluZ0lkKTtcblxuICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZyk7XG5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgYmluZGluZ1BhcnNlci5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHNlbGVjdG9yLCBiaW5kaW5nTmFtZSwgaXNBdHRyaWJ1dGUpXG4gICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICBsZXQgc2FuaXRpemVyRm46IG8uRXh0ZXJuYWxFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCkge1xuICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTCkgPiAtMSAmJlxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwpID4gLTEpIHtcbiAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnRcbiAgICAgICAgLy8gb2YgZGlmZmVyZW50IHNlY3VyaXR5IGNvbnRleHRzLiBJbiB0aGlzIGNhc2Ugd2UgdXNlIHNwZWNpYWwgc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGFuZFxuICAgICAgICAvLyBzZWxlY3QgdGhlIGFjdHVhbCBzYW5pdGl6ZXIgYXQgcnVudGltZSBiYXNlZCBvbiBhIHRhZyBuYW1lIHRoYXQgaXMgcHJvdmlkZWQgd2hpbGVcbiAgICAgICAgLy8gaW52b2tpbmcgc2FuaXRpemF0aW9uIGZ1bmN0aW9uLlxuICAgICAgICBzYW5pdGl6ZXJGbiA9IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2FuaXRpemVyRm4gPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oc2VjdXJpdHlDb250ZXh0c1swXSwgaXNBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpbnN0cnVjdGlvblBhcmFtcyA9IFtvLmxpdGVyYWwoYmluZGluZ05hbWUpLCBiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl07XG4gICAgaWYgKHNhbml0aXplckZuKSB7XG4gICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKHNhbml0aXplckZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgdGhlcmUgd2FzIG5vIHNhbml0aXphdGlvbiBmdW5jdGlvbiBmb3VuZCBiYXNlZCBvbiB0aGUgc2VjdXJpdHkgY29udGV4dFxuICAgICAgLy8gb2YgYW4gYXR0cmlidXRlL3Byb3BlcnR5IGJpbmRpbmcgLSBjaGVjayB3aGV0aGVyIHRoaXMgYXR0cmlidXRlL3Byb3BlcnR5IGlzXG4gICAgICAvLyBvbmUgb2YgdGhlIHNlY3VyaXR5LXNlbnNpdGl2ZSA8aWZyYW1lPiBhdHRyaWJ1dGVzLlxuICAgICAgLy8gTm90ZTogZm9yIGhvc3QgYmluZGluZ3MgZGVmaW5lZCBvbiBhIGRpcmVjdGl2ZSwgd2UgZG8gbm90IHRyeSB0byBmaW5kIGFsbFxuICAgICAgLy8gcG9zc2libGUgcGxhY2VzIHdoZXJlIGl0IGNhbiBiZSBtYXRjaGVkLCBzbyB3ZSBjYW4gbm90IGRldGVybWluZSB3aGV0aGVyXG4gICAgICAvLyB0aGUgaG9zdCBlbGVtZW50IGlzIGFuIDxpZnJhbWU+LiBJbiB0aGlzIGNhc2UsIGlmIGFuIGF0dHJpYnV0ZS9iaW5kaW5nXG4gICAgICAvLyBuYW1lIGlzIGluIHRoZSBgSUZSQU1FX1NFQ1VSSVRZX1NFTlNJVElWRV9BVFRSU2Agc2V0IC0gYXBwZW5kIGEgdmFsaWRhdGlvblxuICAgICAgLy8gZnVuY3Rpb24sIHdoaWNoIHdvdWxkIGJlIGludm9rZWQgYXQgcnVudGltZSBhbmQgd291bGQgaGF2ZSBhY2Nlc3MgdG8gdGhlXG4gICAgICAvLyB1bmRlcmx5aW5nIERPTSBlbGVtZW50LCBjaGVjayBpZiBpdCdzIGFuIDxpZnJhbWU+IGFuZCBpZiBzbyAtIHJ1bnMgZXh0cmEgY2hlY2tzLlxuICAgICAgaWYgKGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKGJpbmRpbmdOYW1lKSkge1xuICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8uaW1wb3J0RXhwcihSMy52YWxpZGF0ZUlmcmFtZUF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVZhcmlhYmxlcy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcblxuICAgIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuaG9zdFByb3BlcnR5KSB7XG4gICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmF0dHJpYnV0ZSkge1xuICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuc3ludGhldGljSG9zdFByb3BlcnR5KSB7XG4gICAgICBzeW50aGV0aWNIb3N0QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IGluc3RydWN0aW9uLCBwYXJhbXNPckZuOiBpbnN0cnVjdGlvblBhcmFtcywgc3BhbjogbnVsbH0pO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBwcm9wZXJ0eUJpbmRpbmdzKSB7XG4gICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMuaG9zdFByb3BlcnR5LCBwYXJhbXNPckZuOiBiaW5kaW5nUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJpbmRpbmdQYXJhbXMgb2YgYXR0cmlidXRlQmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5hdHRyaWJ1dGUsIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBzeW50aGV0aWNIb3N0QmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaChcbiAgICAgICAge3JlZmVyZW5jZTogUjMuc3ludGhldGljSG9zdFByb3BlcnR5LCBwYXJhbXNPckZuOiBiaW5kaW5nUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICAvLyBzaW5jZSB3ZSdyZSBkZWFsaW5nIHdpdGggZGlyZWN0aXZlcy9jb21wb25lbnRzIGFuZCBib3RoIGhhdmUgaG9zdEJpbmRpbmdcbiAgLy8gZnVuY3Rpb25zLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGEgc3BlY2lhbCBob3N0QXR0cnMgaW5zdHJ1Y3Rpb24gdGhhdCBkZWFsc1xuICAvLyB3aXRoIGJvdGggdGhlIGFzc2lnbm1lbnQgb2Ygc3R5bGluZyBhcyB3ZWxsIGFzIHN0YXRpYyBhdHRyaWJ1dGVzIHRvIHRoZSBob3N0XG4gIC8vIGVsZW1lbnQuIFRoZSBpbnN0cnVjdGlvbiBiZWxvdyB3aWxsIGluc3RydWN0IGFsbCBpbml0aWFsIHN0eWxpbmcgKHN0eWxpbmdcbiAgLy8gdGhhdCBpcyBpbnNpZGUgb2YgYSBob3N0IGJpbmRpbmcgd2l0aGluIGEgZGlyZWN0aXZlL2NvbXBvbmVudCkgdG8gYmUgYXR0YWNoZWRcbiAgLy8gdG8gdGhlIGhvc3QgZWxlbWVudCBhbG9uZ3NpZGUgYW55IG9mIHRoZSBwcm92aWRlZCBob3N0IGF0dHJpYnV0ZXMgdGhhdCB3ZXJlXG4gIC8vIGNvbGxlY3RlZCBlYXJsaWVyLlxuICBjb25zdCBob3N0QXR0cnMgPSBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcyk7XG4gIHN0eWxlQnVpbGRlci5hc3NpZ25Ib3N0QXR0cnMoaG9zdEF0dHJzLCBkZWZpbml0aW9uTWFwKTtcblxuICBpZiAoc3R5bGVCdWlsZGVyLmhhc0JpbmRpbmdzKSB7XG4gICAgLy8gZmluYWxseSBlYWNoIGJpbmRpbmcgdGhhdCB3YXMgcmVnaXN0ZXJlZCBpbiB0aGUgc3RhdGVtZW50IGFib3ZlIHdpbGwgbmVlZCB0byBiZSBhZGRlZCB0b1xuICAgIC8vIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSBjb21wb25lbnQvZGlyZWN0aXZlIHRlbXBsYXRlRm4vaG9zdEJpbmRpbmdzRm4gc28gdGhhdCB0aGUgYmluZGluZ3NcbiAgICAvLyBhcmUgZXZhbHVhdGVkIGFuZCB1cGRhdGVkIGZvciB0aGUgZWxlbWVudC5cbiAgICBzdHlsZUJ1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyhnZXRWYWx1ZUNvbnZlcnRlcigpKS5mb3JFYWNoKGluc3RydWN0aW9uID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2FsbCBvZiBpbnN0cnVjdGlvbi5jYWxscykge1xuICAgICAgICAvLyB3ZSBzdWJ0cmFjdCBhIHZhbHVlIG9mIGAxYCBoZXJlIGJlY2F1c2UgdGhlIGJpbmRpbmcgc2xvdCB3YXMgYWxyZWFkeSBhbGxvY2F0ZWRcbiAgICAgICAgLy8gYXQgdGhlIHRvcCBvZiB0aGlzIG1ldGhvZCB3aGVuIGFsbCB0aGUgaW5wdXQgYmluZGluZ3Mgd2VyZSBjb3VudGVkLlxuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz1cbiAgICAgICAgICAgIE1hdGgubWF4KGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHMgLSBNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVELCAwKTtcblxuICAgICAgICBjb25zdCB7cGFyYW1zLCBzdG10c30gPVxuICAgICAgICAgICAgY29udmVydFN0eWxpbmdDYWxsKGNhbGwsIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4sIGdldE5leHRCaW5kaW5nSWQpO1xuICAgICAgICB1cGRhdGVWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICByZWZlcmVuY2U6IGluc3RydWN0aW9uLnJlZmVyZW5jZSxcbiAgICAgICAgICBwYXJhbXNPckZuOiBwYXJhbXMsXG4gICAgICAgICAgc3BhbjogbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAodG90YWxIb3N0VmFyc0NvdW50KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RWYXJzJywgby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwIHx8IHVwZGF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGdldEluc3RydWN0aW9uU3RhdGVtZW50cyhjcmVhdGVJbnN0cnVjdGlvbnMpKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSxcbiAgICAgICAgICB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KGdldEluc3RydWN0aW9uU3RhdGVtZW50cyh1cGRhdGVJbnN0cnVjdGlvbnMpKSkpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSwgc3RhdGVtZW50cyxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNULCBnZXROZXh0QmluZGluZ0lkRm46ICgpID0+IHN0cmluZykge1xuICByZXR1cm4gY29udmVydFByb3BlcnR5QmluZGluZyhudWxsLCBpbXBsaWNpdCwgdmFsdWUsIGdldE5leHRCaW5kaW5nSWRGbigpKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFN0eWxpbmdDYWxsKFxuICAgIGNhbGw6IFN0eWxpbmdJbnN0cnVjdGlvbkNhbGwsIGJpbmRpbmdDb250ZXh0OiBhbnksIGJpbmRpbmdGbjogRnVuY3Rpb24sXG4gICAgZ2V0TmV4dEJpbmRpbmdJZEZuOiAoKSA9PiBzdHJpbmcpIHtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gY2FsbC5wYXJhbXModmFsdWUgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUsIGdldE5leHRCaW5kaW5nSWRGbik7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0LnN0bXRzKSAmJiByZXN1bHQuc3RtdHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RtdHMucHVzaCguLi5yZXN1bHQuc3RtdHMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0LmN1cnJWYWxFeHByO1xuICB9KTtcbiAgcmV0dXJuIHtwYXJhbXMsIHN0bXRzfTtcbn1cblxuZnVuY3Rpb24gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSk6XG4gICAge2JpbmRpbmdOYW1lOiBzdHJpbmcsIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc0F0dHJpYnV0ZTogYm9vbGVhbn0ge1xuICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWU7XG4gIGxldCBpbnN0cnVjdGlvbiE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgYW4gYXR0ciBiaW5kaW5nIG9yIGEgcHJvcGVydHkgYmluZGluZ1xuICBjb25zdCBhdHRyTWF0Y2hlcyA9IGJpbmRpbmdOYW1lLm1hdGNoKEFUVFJfUkVHRVgpO1xuICBpZiAoYXR0ck1hdGNoZXMpIHtcbiAgICBiaW5kaW5nTmFtZSA9IGF0dHJNYXRjaGVzWzFdO1xuICAgIGluc3RydWN0aW9uID0gUjMuYXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5ob3N0UHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLCBuYW1lPzogc3RyaW5nKTogSW5zdHJ1Y3Rpb25bXSB7XG4gIGNvbnN0IGxpc3RlbmVyUGFyYW1zOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgYmluZGluZyBvZiBldmVudEJpbmRpbmdzKSB7XG4gICAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBiaW5kaW5nLnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoYmluZGluZ05hbWUsIGJpbmRpbmcudGFyZ2V0T3JQaGFzZSkgOlxuICAgICAgICBiaW5kaW5nTmFtZTtcbiAgICBjb25zdCBoYW5kbGVyTmFtZSA9IG5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHtuYW1lfV8ke2JpbmRpbmdGbk5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IHBhcmFtcyA9IHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhCb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChiaW5kaW5nKSwgaGFuZGxlck5hbWUpO1xuXG4gICAgaWYgKGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICBzeW50aGV0aWNMaXN0ZW5lclBhcmFtcy5wdXNoKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3RlbmVyUGFyYW1zLnB1c2gocGFyYW1zKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHBhcmFtcyBvZiBzeW50aGV0aWNMaXN0ZW5lclBhcmFtcykge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lciwgcGFyYW1zT3JGbjogcGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBhcmFtcyBvZiBsaXN0ZW5lclBhcmFtcykge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLmxpc3RlbmVyLCBwYXJhbXNPckZuOiBwYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIHJldHVybiBpbnN0cnVjdGlvbnM7XG59XG5cblxuY29uc3QgSE9TVF9SRUdfRVhQID0gL14oPzpcXFsoW15cXF1dKylcXF0pfCg/OlxcKChbXlxcKV0rKVxcKSkkLztcbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCIsIG9yIFwiYXR0ci5yb2xlXCIgZnJvbSBcIlthdHRyLnJvbGVdXCIsIG9yIEBhbmltIGZyb20gW0BhbmltXVxuICBCaW5kaW5nID0gMSxcblxuICAvLyBncm91cCAyOiBcImV2ZW50XCIgZnJvbSBcIihldmVudClcIlxuICBFdmVudCA9IDIsXG59XG5cbi8vIERlZmluZXMgSG9zdCBCaW5kaW5ncyBzdHJ1Y3R1cmUgdGhhdCBjb250YWlucyBhdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIGFuZCBwcm9wZXJ0aWVzLFxuLy8gcGFyc2VkIGZyb20gdGhlIGBob3N0YCBvYmplY3QgZGVmaW5lZCBmb3IgYSBUeXBlLlxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd8by5FeHByZXNzaW9ufSk6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gIGNvbnN0IGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3Qgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9ID0ge307XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoaG9zdCkpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG5cbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENsYXNzIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHlsZSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSBvLmxpdGVyYWwodmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ10gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmVudCBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgc3BlY2lhbEF0dHJpYnV0ZXN9O1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIGhvc3QgYmluZGluZ3MgYW5kIHJldHVybnMgdGhlIGxpc3Qgb2YgZXJyb3JzIChpZiBhbnkpLiBFbXB0eSBhcnJheSBpbmRpY2F0ZXMgdGhhdCBhXG4gKiBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncyBoYXMgbm8gZXJyb3JzLlxuICpcbiAqIEBwYXJhbSBiaW5kaW5ncyBzZXQgb2YgaG9zdCBiaW5kaW5ncyB0byB2ZXJpZnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBzb3VyY2Ugc3BhbiB3aGVyZSBob3N0IGJpbmRpbmdzIHdlcmUgZGVmaW5lZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIGVycm9ycyBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUhvc3RCaW5kaW5ncyhcbiAgICBiaW5kaW5nczogUGFyc2VkSG9zdEJpbmRpbmdzLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBQYXJzZUVycm9yW10ge1xuICAvLyBUT0RPOiBhYnN0cmFjdCBvdXQgaG9zdCBiaW5kaW5ncyB2ZXJpZmljYXRpb24gbG9naWMgYW5kIHVzZSBpdCBpbnN0ZWFkIG9mXG4gIC8vIGNyZWF0aW5nIGV2ZW50cyBhbmQgcHJvcGVydGllcyBBU1RzIHRvIGRldGVjdCBlcnJvcnMgKEZXLTk5NilcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhiaW5kaW5ncy5saXN0ZW5lcnMsIHNvdXJjZVNwYW4pO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoYmluZGluZ3MucHJvcGVydGllcywgc291cmNlU3Bhbik7XG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLmVycm9ycztcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7XG4gICAgcmV0dXJuIHNoYWRvd0NzcyEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgYSBDU1Mgc3R5bGVzaGVldCB3aXRoIGVtdWxhdGVkIHZpZXcgZW5jYXBzdWxhdGlvbi5cbiAqIFRoaXMgYWxsb3dzIGEgc3R5bGVzaGVldCB0byBiZSB1c2VkIHdpdGggYW4gQW5ndWxhciBjb21wb25lbnQgdGhhdFxuICogaXMgdXNpbmcgdGhlIGBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZGAgbW9kZS5cbiAqXG4gKiBAcGFyYW0gc3R5bGUgVGhlIGNvbnRlbnQgb2YgYSBDU1Mgc3R5bGVzaGVldC5cbiAqIEByZXR1cm5zIFRoZSBlbmNhcHN1bGF0ZWQgY29udGVudCBmb3IgdGhlIHN0eWxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jYXBzdWxhdGVTdHlsZShzdHlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc2hhZG93Q3NzLnNoaW1Dc3NUZXh0KHN0eWxlLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlIHtcbiAgaWYgKCFtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gby5OT05FX1RZUEU7XG4gIH1cblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIobWV0YS5ob3N0RGlyZWN0aXZlcy5tYXAoaG9zdE1ldGEgPT4gby5saXRlcmFsTWFwKFtcbiAgICB7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IG8udHlwZW9mRXhwcihob3N0TWV0YS5kaXJlY3RpdmUudHlwZSksIHF1b3RlZDogZmFsc2V9LFxuICAgIHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihob3N0TWV0YS5pbnB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgICB7a2V5OiAnb3V0cHV0cycsIHZhbHVlOiBzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKGhvc3RNZXRhLm91dHB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgXSkpKSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICBob3N0RGlyZWN0aXZlczogTm9uTnVsbGFibGU8UjNEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdERpcmVjdGl2ZXMnXT4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgbGV0IGhhc0ZvcndhcmRSZWYgPSBmYWxzZTtcblxuICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgaG9zdERpcmVjdGl2ZXMpIHtcbiAgICAvLyBVc2UgYSBzaG9ydGhhbmQgaWYgdGhlcmUgYXJlIG5vIGlucHV0cyBvciBvdXRwdXRzLlxuICAgIGlmICghY3VycmVudC5pbnB1dHMgJiYgIWN1cnJlbnQub3V0cHV0cykge1xuICAgICAgZXhwcmVzc2lvbnMucHVzaChjdXJyZW50LmRpcmVjdGl2ZS50eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qga2V5cyA9IFt7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUsIHF1b3RlZDogZmFsc2V9XTtcblxuICAgICAgaWYgKGN1cnJlbnQuaW5wdXRzKSB7XG4gICAgICAgIGNvbnN0IGlucHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50LmlucHV0cyk7XG4gICAgICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICAgICAga2V5cy5wdXNoKHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogaW5wdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjdXJyZW50Lm91dHB1dHMpIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpO1xuICAgICAgICBpZiAob3V0cHV0c0xpdGVyYWwpIHtcbiAgICAgICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBleHByZXNzaW9ucy5wdXNoKG8ubGl0ZXJhbE1hcChrZXlzKSk7XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnQuaXNGb3J3YXJkUmVmZXJlbmNlKSB7XG4gICAgICBoYXNGb3J3YXJkUmVmID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW0hvc3REaXJdIH1gLFxuICAvLyBvdGhlcndpc2Ugd2UgY2FuIHNhdmUgc29tZSBieXRlcyBieSB1c2luZyBhIHBsYWluIGFycmF5LCBlLmcuIGBbSG9zdERpcl1gLlxuICByZXR1cm4gaGFzRm9yd2FyZFJlZiA/XG4gICAgICBuZXcgby5GdW5jdGlvbkV4cHIoW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKSldKSA6XG4gICAgICBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuIGlucHV0L291dHB1dCBtYXBwaW5nIG9iamVjdCBsaXRlcmFsIGludG8gYW4gYXJyYXkgd2hlcmUgdGhlIGV2ZW4ga2V5cyBhcmUgdGhlXG4gKiBwdWJsaWMgbmFtZSBvZiB0aGUgYmluZGluZyBhbmQgdGhlIG9kZCBvbmVzIGFyZSB0aGUgbmFtZSBpdCB3YXMgYWxpYXNlZCB0by4gRS5nLlxuICogYHtpbnB1dE9uZTogJ2FsaWFzT25lJywgaW5wdXRUd286ICdhbGlhc1R3byd9YCB3aWxsIGJlY29tZVxuICogYFsnaW5wdXRPbmUnLCAnYWxpYXNPbmUnLCAnaW5wdXRUd28nLCAnYWxpYXNUd28nXWAuXG4gKlxuICogVGhpcyBjb252ZXJzaW9uIGlzIG5lY2Vzc2FyeSwgYmVjYXVzZSBob3N0cyBiaW5kIHRvIHRoZSBwdWJsaWMgbmFtZSBvZiB0aGUgaG9zdCBkaXJlY3RpdmUgYW5kXG4gKiBrZWVwaW5nIHRoZSBtYXBwaW5nIGluIGFuIG9iamVjdCBsaXRlcmFsIHdpbGwgYnJlYWsgZm9yIGFwcHMgdXNpbmcgcHJvcGVydHkgcmVuYW1pbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShtYXBwaW5nOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTpcbiAgICBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVsZW1lbnRzOiBvLkxpdGVyYWxFeHByW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHB1YmxpY05hbWUgaW4gbWFwcGluZykge1xuICAgIGlmIChtYXBwaW5nLmhhc093blByb3BlcnR5KHB1YmxpY05hbWUpKSB7XG4gICAgICBlbGVtZW50cy5wdXNoKG8ubGl0ZXJhbChwdWJsaWNOYW1lKSwgby5saXRlcmFsKG1hcHBpbmdbcHVibGljTmFtZV0pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudHMubGVuZ3RoID4gMCA/IG8ubGl0ZXJhbEFycihlbGVtZW50cykgOiBudWxsO1xufVxuIl19