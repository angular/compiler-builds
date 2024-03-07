/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { ParsedEventType } from '../../expression_parser/ast';
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
import { createContentQueriesFunction, createViewQueriesFunction } from './query_generation';
import { MIN_STYLING_BINDING_SLOTS_REQUIRED, StylingBuilder } from './styling_builder';
import { BindingScope, makeBindingParser, prepareEventListenerParameters, renderFlagCheckIfStmt, resolveSanitizationFn, TemplateDefinitionBuilder, ValueConverter } from './template';
import { asLiteral, conditionallyCreateDirectiveBindingLiteral, CONTEXT_NAME, DefinitionMap, getInstructionStatements, RENDER_FLAGS } from './util';
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
    for (const [symbolName, { importPath, isDefaultImport }] of deps) {
        // Callback function, e.g. `m () => m.MyCmp;`.
        const innerFn = o.arrowFn([new o.FnParam('m', o.DYNAMIC_TYPE)], o.variable('m').prop(isDefaultImport ? 'default' : symbolName));
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
    if (!USE_TEMPLATE_PIPELINE && !meta.useTemplatePipeline) {
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
function convertAttributesToExpressions(attributes) {
    const values = [];
    for (let key of Object.getOwnPropertyNames(attributes)) {
        const value = attributes[key];
        values.push(o.literal(key), value);
    }
    return values;
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
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
    const bindings = bindingParser.createBoundHostProperties(hostBindingsMetadata.properties, typeSourceSpan);
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(hostBindingsMetadata.listeners, typeSourceSpan);
    if (USE_TEMPLATE_PIPELINE || hostBindingsMetadata.useTemplatePipeline) {
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
        const bindingFnName = binding.type === ParsedEventType.Animation ?
            prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
            bindingName;
        const handlerName = name && bindingName ? `${name}_${bindingFnName}_HostBindingHandler` : null;
        const params = prepareEventListenerParameters(BoundEvent.fromParsedEvent(binding), handlerName);
        if (binding.type == ParsedEventType.Animation) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRWhGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBbUIsZUFBZSxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQzlGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pGLE9BQU8sRUFBQyw2QkFBNkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRyxPQUFPLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDdEYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUF3Qixr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QyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzdELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge2NvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iS2luZH0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7ZW1pdEhvc3RCaW5kaW5nRnVuY3Rpb24sIGVtaXRUZW1wbGF0ZUZuLCB0cmFuc2Zvcm19IGZyb20gJy4uLy4uL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9lbWl0JztcbmltcG9ydCB7aW5nZXN0Q29tcG9uZW50LCBpbmdlc3RIb3N0QmluZGluZ30gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luZ2VzdCc7XG5pbXBvcnQge1VTRV9URU1QTEFURV9QSVBFTElORX0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3dpdGNoJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIFIzQ29tcGlsZWRFeHByZXNzaW9uLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNUZW1wbGF0ZURlcGVuZGVuY3l9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbiwgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbn0gZnJvbSAnLi9xdWVyeV9nZW5lcmF0aW9uJztcbmltcG9ydCB7TUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRCwgU3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbkNhbGx9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBtYWtlQmluZGluZ1BhcnNlciwgcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXQsIHJlc29sdmVTYW5pdGl6YXRpb25GbiwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgVmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbCwgQ09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMsIEluc3RydWN0aW9uLCBSRU5ERVJfRkxBR1N9IGZyb20gJy4vdXRpbCc7XG5cblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cblxuY29uc3QgQ09NUE9ORU5UX1ZBUklBQkxFID0gJyVDT01QJSc7XG5jb25zdCBIT1NUX0FUVFIgPSBgX25naG9zdC0ke0NPTVBPTkVOVF9WQVJJQUJMRX1gO1xuY29uc3QgQ09OVEVOVF9BVFRSID0gYF9uZ2NvbnRlbnQtJHtDT01QT05FTlRfVkFSSUFCTEV9YDtcblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogRGVmaW5pdGlvbk1hcCB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBjb25zdCBzZWxlY3RvcnMgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IobWV0YS5zZWxlY3Rvcik7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlLnZhbHVlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGFzTGl0ZXJhbChzZWxlY3RvcnMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIGUuZy4gYGNvbnRlbnRRdWVyaWVzOiAocmYsIGN0eCwgZGlySW5kZXgpID0+IHsgLi4uIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLnF1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YS52aWV3UXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJyxcbiAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgIG1ldGEuaG9zdCwgbWV0YS50eXBlU291cmNlU3BhbiwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBtZXRhLnNlbGVjdG9yIHx8ICcnLFxuICAgICAgICAgIG1ldGEubmFtZSwgZGVmaW5pdGlvbk1hcCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuaXNTdGFuZGFsb25lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0YW5kYWxvbmUnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NpZ25hbHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCxcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhfFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YS5wcm92aWRlcnM7XG4gIGNvbnN0IHZpZXdQcm92aWRlcnMgPSAobWV0YSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pikudmlld1Byb3ZpZGVycztcbiAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMobWV0YS5pbnB1dHMpO1xuXG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG4gIGZvciAoY29uc3Qga2V5IG9mIGlucHV0S2V5cykge1xuICAgIGlmIChtZXRhLmlucHV0c1trZXldLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5JbnB1dFRyYW5zZm9ybXNGZWF0dXJlRmVhdHVyZSkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIE5vdGU6IGhvc3QgZGlyZWN0aXZlcyBmZWF0dXJlIG5lZWRzIHRvIGJlIGluc2VydGVkIGJlZm9yZSB0aGVcbiAgLy8gaW5oZXJpdGFuY2UgZmVhdHVyZSB0byBlbnN1cmUgdGhlIGNvcnJlY3QgZXhlY3V0aW9uIG9yZGVyLlxuICBpZiAobWV0YS5ob3N0RGlyZWN0aXZlcz8ubGVuZ3RoKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSG9zdERpcmVjdGl2ZXNGZWF0dXJlKS5jYWxsRm4oW2NyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICAgICAgbWV0YS5ob3N0RGlyZWN0aXZlcyldKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICAvLyBUT0RPOiBiZXR0ZXIgd2F5IG9mIGRpZmZlcmVudGlhdGluZyBjb21wb25lbnQgdnMgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICBpZiAobWV0YS5oYXNPd25Qcm9wZXJ0eSgndGVtcGxhdGUnKSAmJiBtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlN0YW5kYWxvbmVGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gQVNUIGZvciBhIGZ1bmN0aW9uIHRoYXQgY29udGFpbnMgZHluYW1pYyBpbXBvcnRzIHJlcHJlc2VudGluZ1xuICogZGVmZXJyYWJsZSBkZXBlbmRlbmNpZXMuXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZURlZmVycmVkRGVwc0Z1bmN0aW9uKFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lOiBzdHJpbmcsXG4gICAgZGVwczogTWFwPHN0cmluZywge2ltcG9ydFBhdGg6IHN0cmluZywgaXNEZWZhdWx0SW1wb3J0OiBib29sZWFufT4pIHtcbiAgLy8gVGhpcyBkZWZlciBibG9jayBoYXMgZGVwcyBmb3Igd2hpY2ggd2UgbmVlZCB0byBnZW5lcmF0ZSBkeW5hbWljIGltcG9ydHMuXG4gIGNvbnN0IGRlcGVuZGVuY3lFeHA6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgZm9yIChjb25zdCBbc3ltYm9sTmFtZSwge2ltcG9ydFBhdGgsIGlzRGVmYXVsdEltcG9ydH1dIG9mIGRlcHMpIHtcbiAgICAvLyBDYWxsYmFjayBmdW5jdGlvbiwgZS5nLiBgbSAoKSA9PiBtLk15Q21wO2AuXG4gICAgY29uc3QgaW5uZXJGbiA9IG8uYXJyb3dGbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oJ20nLCBvLkRZTkFNSUNfVFlQRSldLFxuICAgICAgICBvLnZhcmlhYmxlKCdtJykucHJvcChpc0RlZmF1bHRJbXBvcnQgPyAnZGVmYXVsdCcgOiBzeW1ib2xOYW1lKSk7XG5cbiAgICAvLyBEeW5hbWljIGltcG9ydCwgZS5nLiBgaW1wb3J0KCcuL2EnKS50aGVuKC4uLilgLlxuICAgIGNvbnN0IGltcG9ydEV4cHIgPSAobmV3IG8uRHluYW1pY0ltcG9ydEV4cHIoaW1wb3J0UGF0aCkpLnByb3AoJ3RoZW4nKS5jYWxsRm4oW2lubmVyRm5dKTtcbiAgICBkZXBlbmRlbmN5RXhwLnB1c2goaW1wb3J0RXhwcik7XG4gIH1cblxuICBjb25zdCBkZXBzRm5FeHByID0gby5hcnJvd0ZuKFtdLCBvLmxpdGVyYWxBcnIoZGVwZW5kZW5jeUV4cCkpO1xuXG4gIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2goZGVwc0ZuRXhwci50b0RlY2xTdG10KG5hbWUsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSk7XG5cbiAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+LCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwLCBtZXRhKTtcblxuICBjb25zdCBzZWxlY3RvciA9IG1ldGEuc2VsZWN0b3IgJiYgQ3NzU2VsZWN0b3IucGFyc2UobWV0YS5zZWxlY3Rvcik7XG4gIGNvbnN0IGZpcnN0U2VsZWN0b3IgPSBzZWxlY3RvciAmJiBzZWxlY3RvclswXTtcblxuICAvLyBlLmcuIGBhdHRyOiBbXCJjbGFzc1wiLCBcIi5teS5hcHBcIl1gXG4gIC8vIFRoaXMgaXMgb3B0aW9uYWwgYW4gb25seSBpbmNsdWRlZCBpZiB0aGUgZmlyc3Qgc2VsZWN0b3Igb2YgYSBjb21wb25lbnQgc3BlY2lmaWVzIGF0dHJpYnV0ZXMuXG4gIGlmIChmaXJzdFNlbGVjdG9yKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JBdHRyaWJ1dGVzID0gZmlyc3RTZWxlY3Rvci5nZXRBdHRycygpO1xuICAgIGlmIChzZWxlY3RvckF0dHJpYnV0ZXMubGVuZ3RoKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgICAnYXR0cnMnLFxuICAgICAgICAgIGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvckF0dHJpYnV0ZXMubWFwKFxuICAgICAgICAgICAgICAgICAgdmFsdWUgPT4gdmFsdWUgIT0gbnVsbCA/IG8ubGl0ZXJhbCh2YWx1ZSkgOiBvLmxpdGVyYWwodW5kZWZpbmVkKSkpLFxuICAgICAgICAgICAgICAvKiBmb3JjZVNoYXJlZCAqLyB0cnVlKSk7XG4gICAgfVxuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG5cbiAgbGV0IGFsbERlZmVycmFibGVEZXBzRm46IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIGlmIChtZXRhLmRlZmVyQmxvY2tzLnNpemUgPiAwICYmIG1ldGEuZGVmZXJyYWJsZVR5cGVzLnNpemUgPiAwICYmXG4gICAgICBtZXRhLmRlZmVyQmxvY2tEZXBzRW1pdE1vZGUgPT09IERlZmVyQmxvY2tEZXBzRW1pdE1vZGUuUGVyQ29tcG9uZW50KSB7XG4gICAgY29uc3QgZm5OYW1lID0gYCR7dGVtcGxhdGVUeXBlTmFtZX1fRGVmZXJGbmA7XG4gICAgYWxsRGVmZXJyYWJsZURlcHNGbiA9IGNyZWF0ZURlZmVycmVkRGVwc0Z1bmN0aW9uKGNvbnN0YW50UG9vbCwgZm5OYW1lLCBtZXRhLmRlZmVycmFibGVUeXBlcyk7XG4gIH1cblxuICAvLyBUZW1wbGF0ZSBjb21waWxhdGlvbiBpcyBjdXJyZW50bHkgY29uZGl0aW9uYWwgYXMgd2UncmUgaW4gdGhlIHByb2Nlc3Mgb2YgcmV3cml0aW5nIGl0LlxuICBpZiAoIVVTRV9URU1QTEFURV9QSVBFTElORSAmJiAhbWV0YS51c2VUZW1wbGF0ZVBpcGVsaW5lKSB7XG4gICAgLy8gVGhpcyBpcyB0aGUgbWFpbiBwYXRoIGN1cnJlbnRseSB1c2VkIGluIGNvbXBpbGF0aW9uLCB3aGljaCBjb21waWxlcyB0aGUgdGVtcGxhdGUgd2l0aCB0aGVcbiAgICAvLyBsZWdhY3kgYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgLlxuXG4gICAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICAgIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5jcmVhdGVSb290U2NvcGUoKSwgMCwgdGVtcGxhdGVUeXBlTmFtZSwgbnVsbCwgbnVsbCwgdGVtcGxhdGVOYW1lLFxuICAgICAgICBSMy5uYW1lc3BhY2VIVE1MLCBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcywgbWV0YS5kZWZlckJsb2NrcyxcbiAgICAgICAgbmV3IE1hcCgpLCBhbGxEZWZlcnJhYmxlRGVwc0ZuKTtcblxuICAgIGNvbnN0IHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uID0gdGVtcGxhdGVCdWlsZGVyLmJ1aWxkVGVtcGxhdGVGdW5jdGlvbih0ZW1wbGF0ZS5ub2RlcywgW10pO1xuXG4gICAgLy8gV2UgbmVlZCB0byBwcm92aWRlIHRoaXMgc28gdGhhdCBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY29tcG9uZW50cyBrbm93IHdoYXRcbiAgICAvLyBwcm9qZWN0ZWQgY29udGVudCBibG9ja3MgdG8gcGFzcyB0aHJvdWdoIHRvIHRoZSBjb21wb25lbnQgd2hlbiBpdCBpc1xuICAgIC8vICAgICBpbnN0YW50aWF0ZWQuXG4gICAgY29uc3QgbmdDb250ZW50U2VsZWN0b3JzID0gdGVtcGxhdGVCdWlsZGVyLmdldE5nQ29udGVudFNlbGVjdG9ycygpO1xuICAgIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCduZ0NvbnRlbnRTZWxlY3RvcnMnLCBuZ0NvbnRlbnRTZWxlY3RvcnMpO1xuICAgIH1cblxuICAgIC8vIGUuZy4gYGRlY2xzOiAyYFxuICAgIC8vIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0cGwucm9vdC5kZWNscyEpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gICAgLy8gZS5nLiBgdmFyczogMmBcbiAgICAvLyBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0cGwucm9vdC52YXJzISkpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBgY29uc3RzYCBzZWN0aW9uIG9mIENvbXBvbmVudERlZjpcbiAgICAvLyAtIGVpdGhlciBhcyBhbiBhcnJheTpcbiAgICAvLyAgIGBjb25zdHM6IFtbJ29uZScsICd0d28nXSwgWyd0aHJlZScsICdmb3VyJ11dYFxuICAgIC8vIC0gb3IgYXMgYSBmYWN0b3J5IGZ1bmN0aW9uIGluIGNhc2UgYWRkaXRpb25hbCBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50ICh0byBzdXBwb3J0IGkxOG4pOlxuICAgIC8vICAgYGNvbnN0czogKCkgPT4geyB2YXIgaTE4bl8wOyBpZiAobmdJMThuQ2xvc3VyZU1vZGUpIHsuLi59IGVsc2Ugey4uLn0gcmV0dXJuIFtpMThuXzBdO1xuICAgIC8vICAgfWBcbiAgICBjb25zdCB7Y29uc3RFeHByZXNzaW9ucywgcHJlcGFyZVN0YXRlbWVudHN9ID0gdGVtcGxhdGVCdWlsZGVyLmdldENvbnN0cygpO1xuICAgIGlmIChjb25zdEV4cHJlc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGxldCBjb25zdHNFeHByOiBvLkxpdGVyYWxBcnJheUV4cHJ8by5BcnJvd0Z1bmN0aW9uRXhwciA9IG8ubGl0ZXJhbEFycihjb25zdEV4cHJlc3Npb25zKTtcbiAgICAgIC8vIFByZXBhcmUgc3RhdGVtZW50cyBhcmUgcHJlc2VudCAtIHR1cm4gYGNvbnN0c2AgaW50byBhIGZ1bmN0aW9uLlxuICAgICAgaWYgKHByZXBhcmVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3RzRXhwciA9IG8uYXJyb3dGbihbXSwgWy4uLnByZXBhcmVTdGF0ZW1lbnRzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoY29uc3RzRXhwcildKTtcbiAgICAgIH1cbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBjb25zdHNFeHByKTtcbiAgICB9XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG4gIH0gZWxzZSB7XG4gICAgLy8gVGhpcyBwYXRoIGNvbXBpbGVzIHRoZSB0ZW1wbGF0ZSB1c2luZyB0aGUgcHJvdG90eXBlIHRlbXBsYXRlIHBpcGVsaW5lLiBGaXJzdCB0aGUgdGVtcGxhdGUgaXNcbiAgICAvLyBpbmdlc3RlZCBpbnRvIElSOlxuICAgIGNvbnN0IHRwbCA9IGluZ2VzdENvbXBvbmVudChcbiAgICAgICAgbWV0YS5uYW1lLCBtZXRhLnRlbXBsYXRlLm5vZGVzLCBjb25zdGFudFBvb2wsIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsXG4gICAgICAgIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzLCBtZXRhLmRlZmVyQmxvY2tzLCBhbGxEZWZlcnJhYmxlRGVwc0ZuKTtcblxuICAgIC8vIFRoZW4gdGhlIElSIGlzIHRyYW5zZm9ybWVkIHRvIHByZXBhcmUgaXQgZm9yIGNvZCBlZ2VuZXJhdGlvbi5cbiAgICB0cmFuc2Zvcm0odHBsLCBDb21waWxhdGlvbkpvYktpbmQuVG1wbCk7XG5cbiAgICAvLyBGaW5hbGx5IHdlIGVtaXQgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uOlxuICAgIGNvbnN0IHRlbXBsYXRlRm4gPSBlbWl0VGVtcGxhdGVGbih0cGwsIGNvbnN0YW50UG9vbCk7XG5cbiAgICBpZiAodHBsLmNvbnRlbnRTZWxlY3RvcnMgIT09IG51bGwpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCduZ0NvbnRlbnRTZWxlY3RvcnMnLCB0cGwuY29udGVudFNlbGVjdG9ycyk7XG4gICAgfVxuXG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xzJywgby5saXRlcmFsKHRwbC5yb290LmRlY2xzIGFzIG51bWJlcikpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRwbC5yb290LnZhcnMgYXMgbnVtYmVyKSk7XG4gICAgaWYgKHRwbC5jb25zdHMubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKHRwbC5jb25zdHNJbml0aWFsaXplcnMubGVuZ3RoID4gMCkge1xuICAgICAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5hcnJvd0ZuKFtdLCBbXG4gICAgICAgICAgLi4udHBsLmNvbnN0c0luaXRpYWxpemVycywgbmV3IG8uUmV0dXJuU3RhdGVtZW50KG8ubGl0ZXJhbEFycih0cGwuY29uc3RzKSlcbiAgICAgICAgXSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIG8ubGl0ZXJhbEFycih0cGwuY29uc3RzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRm4pO1xuICB9XG5cbiAgaWYgKG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgIT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLlJ1bnRpbWVSZXNvbHZlZCAmJlxuICAgICAgbWV0YS5kZWNsYXJhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgY29tcGlsZURlY2xhcmF0aW9uTGlzdChcbiAgICAgICAgICAgIG8ubGl0ZXJhbEFycihtZXRhLmRlY2xhcmF0aW9ucy5tYXAoZGVjbCA9PiBkZWNsLnR5cGUpKSwgbWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSkpO1xuICB9IGVsc2UgaWYgKG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUgPT09IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLlJ1bnRpbWVSZXNvbHZlZCkge1xuICAgIGNvbnN0IGFyZ3MgPSBbbWV0YS50eXBlLnZhbHVlXTtcbiAgICBpZiAobWV0YS5yYXdJbXBvcnRzKSB7XG4gICAgICBhcmdzLnB1c2gobWV0YS5yYXdJbXBvcnRzKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlcGVuZGVuY2llcycsIG8uaW1wb3J0RXhwcihSMy5nZXRDb21wb25lbnREZXBzRmFjdG9yeSkuY2FsbEZuKGFyZ3MpKTtcbiAgfVxuXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IG51bGwpIHtcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgLy8gZS5nLiBgc3R5bGVzOiBbc3RyMSwgc3RyMl1gXG4gIGlmIChtZXRhLnN0eWxlcyAmJiBtZXRhLnN0eWxlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdHlsZVZhbHVlcyA9IG1ldGEuZW5jYXBzdWxhdGlvbiA9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkID9cbiAgICAgICAgY29tcGlsZVN0eWxlcyhtZXRhLnN0eWxlcywgQ09OVEVOVF9BVFRSLCBIT1NUX0FUVFIpIDpcbiAgICAgICAgbWV0YS5zdHlsZXM7XG4gICAgY29uc3Qgc3R5bGVOb2RlcyA9IHN0eWxlVmFsdWVzLnJlZHVjZSgocmVzdWx0LCBzdHlsZSkgPT4ge1xuICAgICAgaWYgKHN0eWxlLnRyaW0oKS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsKHN0eWxlKSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LCBbXSBhcyBvLkV4cHJlc3Npb25bXSk7XG5cbiAgICBpZiAoc3R5bGVOb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgby5saXRlcmFsQXJyKHN0eWxlTm9kZXMpKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gc3R5bGUsIGRvbid0IGdlbmVyYXRlIGNzcyBzZWxlY3RvcnMgb24gZWxlbWVudHNcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLk5vbmU7XG4gIH1cblxuICAvLyBPbmx5IHNldCB2aWV3IGVuY2Fwc3VsYXRpb24gaWYgaXQncyBub3QgdGhlIGRlZmF1bHQgdmFsdWVcbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKG1ldGEuZW5jYXBzdWxhdGlvbikpO1xuICB9XG5cbiAgLy8gZS5nLiBgYW5pbWF0aW9uOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbicsIHZhbHVlOiBtZXRhLmFuaW1hdGlvbnMsIHF1b3RlZDogZmFsc2V9XSkpO1xuICB9XG5cbiAgLy8gU2V0dGluZyBjaGFuZ2UgZGV0ZWN0aW9uIGZsYWdcbiAgaWYgKG1ldGEuY2hhbmdlRGV0ZWN0aW9uICE9PSBudWxsKSB7XG4gICAgaWYgKHR5cGVvZiBtZXRhLmNoYW5nZURldGVjdGlvbiA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgbWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCkge1xuICAgICAgLy8gY2hhbmdlRGV0ZWN0aW9uIGlzIHJlc29sdmVkIGR1cmluZyBhbmFseXNpcy4gT25seSBzZXQgaXQgaWYgbm90IHRoZSBkZWZhdWx0LlxuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NoYW5nZURldGVjdGlvbicsIG8ubGl0ZXJhbChtZXRhLmNoYW5nZURldGVjdGlvbikpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1ldGEuY2hhbmdlRGV0ZWN0aW9uID09PSAnb2JqZWN0Jykge1xuICAgICAgLy8gY2hhbmdlRGV0ZWN0aW9uIGlzIG5vdCByZXNvbHZlZCBkdXJpbmcgYW5hbHlzaXMgKGUuZy4sIHdlIGFyZSBpbiBsb2NhbCBjb21waWxhdGlvbiBtb2RlKS5cbiAgICAgIC8vIFNvIHBsYWNlIGl0IGFzIGlzLlxuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NoYW5nZURldGVjdGlvbicsIG1ldGEuY2hhbmdlRGV0ZWN0aW9uKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDb21wb25lbnRUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIHR5cGUgc3BlY2lmaWNhdGlvbiBmcm9tIHRoZSBjb21wb25lbnQgbWV0YS4gVGhpcyB0eXBlIGlzIGluc2VydGVkIGludG8gLmQudHMgZmlsZXNcbiAqIHRvIGJlIGNvbnN1bWVkIGJ5IHVwc3RyZWFtIGNvbXBpbGF0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeT4pOiBvLlR5cGUge1xuICBjb25zdCB0eXBlUGFyYW1zID0gY3JlYXRlQmFzZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YSk7XG4gIHR5cGVQYXJhbXMucHVzaChzdHJpbmdBcnJheUFzVHlwZShtZXRhLnRlbXBsYXRlLm5nQ29udGVudFNlbGVjdG9ycykpO1xuICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1N0YW5kYWxvbmUpKSk7XG4gIHR5cGVQYXJhbXMucHVzaChjcmVhdGVIb3N0RGlyZWN0aXZlc1R5cGUobWV0YSkpO1xuICAvLyBUT0RPKHNpZ25hbHMpOiBBbHdheXMgaW5jbHVkZSB0aGlzIG1ldGFkYXRhIHN0YXJ0aW5nIHdpdGggdjE3LiBSaWdodFxuICAvLyBub3cgQW5ndWxhciB2MTYuMC54IGRvZXMgbm90IHN1cHBvcnQgdGhpcyBmaWVsZCBhbmQgbGlicmFyeSBkaXN0cmlidXRpb25zXG4gIC8vIHdvdWxkIHRoZW4gYmUgaW5jb21wYXRpYmxlIHdpdGggdjE2LjAueCBmcmFtZXdvcmsgdXNlcnMuXG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgdHlwZVBhcmFtcy5wdXNoKG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKG1ldGEuaXNTaWduYWwpKSk7XG4gIH1cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkNvbXBvbmVudERlY2xhcmF0aW9uLCB0eXBlUGFyYW1zKSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGFycmF5IGxpdGVyYWwgb2YgZGVjbGFyYXRpb25zIGludG8gYW4gZXhwcmVzc2lvbiBhY2NvcmRpbmcgdG8gdGhlIHByb3ZpZGVkIGVtaXRcbiAqIG1vZGUuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJhdGlvbkxpc3QoXG4gICAgbGlzdDogby5MaXRlcmFsQXJyYXlFeHByLCBtb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSk6IG8uRXhwcmVzc2lvbiB7XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0OlxuICAgICAgLy8gZGlyZWN0aXZlczogW015RGlyXSxcbiAgICAgIHJldHVybiBsaXN0O1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZTpcbiAgICAgIC8vIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtNeURpcl07IH1cbiAgICAgIHJldHVybiBvLmFycm93Rm4oW10sIGxpc3QpO1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZVJlc29sdmVkOlxuICAgICAgLy8gZGlyZWN0aXZlczogZnVuY3Rpb24gKCkgeyByZXR1cm4gW015RGlyXS5tYXAobmcucmVzb2x2ZUZvcndhcmRSZWYpOyB9XG4gICAgICBjb25zdCByZXNvbHZlZExpc3QgPSBsaXN0LnByb3AoJ21hcCcpLmNhbGxGbihbby5pbXBvcnRFeHByKFIzLnJlc29sdmVGb3J3YXJkUmVmKV0pO1xuICAgICAgcmV0dXJuIG8uYXJyb3dGbihbXSwgcmVzb2x2ZWRMaXN0KTtcbiAgICBjYXNlIERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLlJ1bnRpbWVSZXNvbHZlZDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgd2l0aCBhbiBhcnJheSBvZiBwcmUtcmVzb2x2ZWQgZGVwZW5kZW5jaWVzYCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29udmVydEF0dHJpYnV0ZXNUb0V4cHJlc3Npb25zKGF0dHJpYnV0ZXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSk6XG4gICAgby5FeHByZXNzaW9uW10ge1xuICBjb25zdCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGZvciAobGV0IGtleSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRyaWJ1dGVzKSkge1xuICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1trZXldO1xuICAgIHZhbHVlcy5wdXNoKG8ubGl0ZXJhbChrZXkpLCB2YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlcztcbn1cblxuZnVuY3Rpb24gc3RyaW5nQXNUeXBlKHN0cjogc3RyaW5nKTogby5UeXBlIHtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKHN0cikpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ3xzdHJpbmdbXX0pOiBvLkxpdGVyYWxNYXBFeHByIHtcbiAgY29uc3QgbWFwVmFsdWVzID0gT2JqZWN0LmtleXMobWFwKS5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IEFycmF5LmlzQXJyYXkobWFwW2tleV0pID8gbWFwW2tleV1bMF0gOiBtYXBba2V5XTtcbiAgICByZXR1cm4ge1xuICAgICAga2V5LFxuICAgICAgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZSksXG4gICAgICBxdW90ZWQ6IHRydWUsXG4gICAgfTtcbiAgfSk7XG5cbiAgcmV0dXJuIG8ubGl0ZXJhbE1hcChtYXBWYWx1ZXMpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IFJlYWRvbmx5QXJyYXk8c3RyaW5nfG51bGw+KTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJhc2VEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlR5cGVbXSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSBtZXRhLnNlbGVjdG9yICE9PSBudWxsID8gbWV0YS5zZWxlY3Rvci5yZXBsYWNlKC9cXG4vZywgJycpIDogbnVsbDtcblxuICByZXR1cm4gW1xuICAgIHR5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc2VsZWN0b3JGb3JUeXBlICE9PSBudWxsID8gc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSkgOiBvLk5PTkVfVFlQRSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5leHBvcnRBcykgOiBvLk5PTkVfVFlQRSxcbiAgICBvLmV4cHJlc3Npb25UeXBlKGdldElucHV0c1R5cGVFeHByZXNzaW9uKG1ldGEpKSxcbiAgICBvLmV4cHJlc3Npb25UeXBlKHN0cmluZ01hcEFzTGl0ZXJhbEV4cHJlc3Npb24obWV0YS5vdXRwdXRzKSksXG4gICAgc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5xdWVyaWVzLm1hcChxID0+IHEucHJvcGVydHlOYW1lKSksXG4gIF07XG59XG5cbmZ1bmN0aW9uIGdldElucHV0c1R5cGVFeHByZXNzaW9uKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5saXRlcmFsTWFwKE9iamVjdC5rZXlzKG1ldGEuaW5wdXRzKS5tYXAoa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IG1ldGEuaW5wdXRzW2tleV07XG4gICAgY29uc3QgdmFsdWVzID0gW1xuICAgICAge2tleTogJ2FsaWFzJywgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZS5iaW5kaW5nUHJvcGVydHlOYW1lKSwgcXVvdGVkOiB0cnVlfSxcbiAgICAgIHtrZXk6ICdyZXF1aXJlZCcsIHZhbHVlOiBvLmxpdGVyYWwodmFsdWUucmVxdWlyZWQpLCBxdW90ZWQ6IHRydWV9LFxuICAgIF07XG5cbiAgICAvLyBUT0RPKGxlZ2FjeS1wYXJ0aWFsLW91dHB1dC1pbnB1dHMpOiBDb25zaWRlciBhbHdheXMgZW1pdHRpbmcgdGhpcyBpbmZvcm1hdGlvbixcbiAgICAvLyBvciBsZWF2aW5nIGl0IGFzIGlzLlxuICAgIGlmICh2YWx1ZS5pc1NpZ25hbCkge1xuICAgICAgdmFsdWVzLnB1c2goe2tleTogJ2lzU2lnbmFsJywgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZS5pc1NpZ25hbCksIHF1b3RlZDogdHJ1ZX0pO1xuICAgIH1cblxuICAgIHJldHVybiB7a2V5LCB2YWx1ZTogby5saXRlcmFsTWFwKHZhbHVlcyksIHF1b3RlZDogdHJ1ZX07XG4gIH0pKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIHRoZSB0eXBlIHNwZWNpZmljYXRpb24gZnJvbSB0aGUgZGlyZWN0aXZlIG1ldGEuIFRoaXMgdHlwZSBpcyBpbnNlcnRlZCBpbnRvIC5kLnRzIGZpbGVzXG4gKiB0byBiZSBjb25zdW1lZCBieSB1cHN0cmVhbSBjb21waWxhdGlvbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlR5cGUge1xuICBjb25zdCB0eXBlUGFyYW1zID0gY3JlYXRlQmFzZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YSk7XG4gIC8vIERpcmVjdGl2ZXMgaGF2ZSBubyBOZ0NvbnRlbnRTZWxlY3RvcnMgc2xvdCwgYnV0IGluc3RlYWQgZXhwcmVzcyBhIGBuZXZlcmAgdHlwZVxuICAvLyBzbyB0aGF0IGZ1dHVyZSBmaWVsZHMgYWxpZ24uXG4gIHR5cGVQYXJhbXMucHVzaChvLk5PTkVfVFlQRSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuRGlyZWN0aXZlRGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBob3N0QmluZGluZ3NNZXRhZGF0YTogUjNIb3N0TWV0YWRhdGEsIHR5cGVTb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHNlbGVjdG9yOiBzdHJpbmcsIG5hbWU6IHN0cmluZyxcbiAgICBkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBiaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoaG9zdEJpbmRpbmdzTWV0YWRhdGEucHJvcGVydGllcywgdHlwZVNvdXJjZVNwYW4pO1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGhvc3RCaW5kaW5nc01ldGFkYXRhLmxpc3RlbmVycywgdHlwZVNvdXJjZVNwYW4pO1xuXG4gIGlmIChVU0VfVEVNUExBVEVfUElQRUxJTkUgfHwgaG9zdEJpbmRpbmdzTWV0YWRhdGEudXNlVGVtcGxhdGVQaXBlbGluZSkge1xuICAgIC8vIFRoZSBwYXJzZXIgZm9yIGhvc3QgYmluZGluZ3MgdHJlYXRzIGNsYXNzIGFuZCBzdHlsZSBhdHRyaWJ1dGVzIHNwZWNpYWxseSAtLSB0aGV5IGFyZVxuICAgIC8vIGV4dHJhY3RlZCBpbnRvIHRoZXNlIHNlcGFyYXRlIGZpZWxkcy4gVGhpcyBpcyBub3QgdGhlIGNhc2UgZm9yIHRlbXBsYXRlcywgc28gdGhlIGNvbXBpbGVyIGNhblxuICAgIC8vIGFjdHVhbGx5IGFscmVhZHkgaGFuZGxlIHRoZXNlIHNwZWNpYWwgYXR0cmlidXRlcyBpbnRlcm5hbGx5LiBUaGVyZWZvcmUsIHdlIGp1c3QgZHJvcCB0aGVtXG4gICAgLy8gaW50byB0aGUgYXR0cmlidXRlcyBtYXAuXG4gICAgaWYgKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cikge1xuICAgICAgaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlc1snc3R5bGUnXSA9XG4gICAgICAgICAgby5saXRlcmFsKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0cik7XG4gICAgfVxuICAgIGlmIChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpIHtcbiAgICAgIGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXNbJ2NsYXNzJ10gPVxuICAgICAgICAgIG8ubGl0ZXJhbChob3N0QmluZGluZ3NNZXRhZGF0YS5zcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIpO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3RKb2IgPSBpbmdlc3RIb3N0QmluZGluZyhcbiAgICAgICAge1xuICAgICAgICAgIGNvbXBvbmVudE5hbWU6IG5hbWUsXG4gICAgICAgICAgY29tcG9uZW50U2VsZWN0b3I6IHNlbGVjdG9yLFxuICAgICAgICAgIHByb3BlcnRpZXM6IGJpbmRpbmdzLFxuICAgICAgICAgIGV2ZW50czogZXZlbnRCaW5kaW5ncyxcbiAgICAgICAgICBhdHRyaWJ1dGVzOiBob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzLFxuICAgICAgICB9LFxuICAgICAgICBiaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2wpO1xuICAgIHRyYW5zZm9ybShob3N0Sm9iLCBDb21waWxhdGlvbkpvYktpbmQuSG9zdCk7XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdEF0dHJzJywgaG9zdEpvYi5yb290LmF0dHJpYnV0ZXMpO1xuXG4gICAgY29uc3QgdmFyQ291bnQgPSBob3N0Sm9iLnJvb3QudmFycztcbiAgICBpZiAodmFyQ291bnQgIT09IG51bGwgJiYgdmFyQ291bnQgPiAwKSB7XG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdFZhcnMnLCBvLmxpdGVyYWwodmFyQ291bnQpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW1pdEhvc3RCaW5kaW5nRnVuY3Rpb24oaG9zdEpvYik7XG4gIH1cblxuICBsZXQgYmluZGluZ0lkID0gMDtcbiAgY29uc3QgZ2V0TmV4dEJpbmRpbmdJZCA9ICgpID0+IGAke2JpbmRpbmdJZCsrfWA7XG5cbiAgY29uc3QgYmluZGluZ0NvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihiaW5kaW5nQ29udGV4dCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzO1xuICBpZiAoc3R5bGVBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIoc3R5bGVBdHRyKTtcbiAgfVxuICBpZiAoY2xhc3NBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIoY2xhc3NBdHRyKTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZUluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICBjb25zdCB1cGRhdGVJbnN0cnVjdGlvbnM6IEluc3RydWN0aW9uW10gPSBbXTtcbiAgY29uc3QgdXBkYXRlVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gdHlwZVNvdXJjZVNwYW47XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY3JlYXRlSW5zdHJ1Y3Rpb25zLnB1c2goLi4uY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzLCBuYW1lKSk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYWxsT3RoZXJCaW5kaW5nczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuXG4gIC8vIFdlIG5lZWQgdG8gY2FsY3VsYXRlIHRoZSB0b3RhbCBhbW91bnQgb2YgYmluZGluZyBzbG90cyByZXF1aXJlZCBieVxuICAvLyBhbGwgdGhlIGluc3RydWN0aW9ucyB0b2dldGhlciBiZWZvcmUgYW55IHZhbHVlIGNvbnZlcnNpb25zIGhhcHBlbi5cbiAgLy8gVmFsdWUgY29udmVyc2lvbnMgbWF5IHJlcXVpcmUgYWRkaXRpb25hbCBzbG90cyBmb3IgaW50ZXJwb2xhdGlvbiBhbmRcbiAgLy8gYmluZGluZ3Mgd2l0aCBwaXBlcy4gVGhlc2UgY2FsY3VsYXRlcyBoYXBwZW4gYWZ0ZXIgdGhpcyBibG9jay5cbiAgbGV0IHRvdGFsSG9zdFZhcnNDb3VudCA9IDA7XG4gIGJpbmRpbmdzICYmIGJpbmRpbmdzLmZvckVhY2goKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KSA9PiB7XG4gICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID0gc3R5bGVCdWlsZGVyLnJlZ2lzdGVySW5wdXRCYXNlZE9uTmFtZShcbiAgICAgICAgYmluZGluZy5uYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gICAgaWYgKHN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFsbE90aGVyQmluZGluZ3MucHVzaChiaW5kaW5nKTtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCsrO1xuICAgIH1cbiAgfSk7XG5cbiAgbGV0IHZhbHVlQ29udmVydGVyOiBWYWx1ZUNvbnZlcnRlcjtcbiAgY29uc3QgZ2V0VmFsdWVDb252ZXJ0ZXIgPSAoKSA9PiB7XG4gICAgaWYgKCF2YWx1ZUNvbnZlcnRlcikge1xuICAgICAgY29uc3QgaG9zdFZhcnNDb3VudEZuID0gKG51bVNsb3RzOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFZhcnNDb3VudCA9IHRvdGFsSG9zdFZhcnNDb3VudDtcbiAgICAgICAgdG90YWxIb3N0VmFyc0NvdW50ICs9IG51bVNsb3RzO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxWYXJzQ291bnQ7XG4gICAgICB9O1xuICAgICAgdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgICAgY29uc3RhbnRQb29sLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIG5vZGUnKSwgIC8vIG5ldyBub2RlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgICAgICAgaG9zdFZhcnNDb3VudEZuLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIHBpcGUnKSk7ICAvLyBwaXBlcyBhcmUgaWxsZWdhbCBoZXJlXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZUNvbnZlcnRlcjtcbiAgfTtcblxuICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0hvc3RCaW5kaW5nczogby5FeHByZXNzaW9uW11bXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgYmluZGluZyBvZiBhbGxPdGhlckJpbmRpbmdzKSB7XG4gICAgLy8gcmVzb2x2ZSBsaXRlcmFsIGFycmF5cyBhbmQgbGl0ZXJhbCBvYmplY3RzXG4gICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQoZ2V0VmFsdWVDb252ZXJ0ZXIoKSk7XG4gICAgY29uc3QgYmluZGluZ0V4cHIgPSBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlLCBnZXROZXh0QmluZGluZ0lkKTtcblxuICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZyk7XG5cbiAgICBjb25zdCBzZWN1cml0eUNvbnRleHRzID1cbiAgICAgICAgYmluZGluZ1BhcnNlci5jYWxjUG9zc2libGVTZWN1cml0eUNvbnRleHRzKHNlbGVjdG9yLCBiaW5kaW5nTmFtZSwgaXNBdHRyaWJ1dGUpXG4gICAgICAgICAgICAuZmlsdGVyKGNvbnRleHQgPT4gY29udGV4dCAhPT0gY29yZS5TZWN1cml0eUNvbnRleHQuTk9ORSk7XG5cbiAgICBsZXQgc2FuaXRpemVyRm46IG8uRXh0ZXJuYWxFeHByfG51bGwgPSBudWxsO1xuICAgIGlmIChzZWN1cml0eUNvbnRleHRzLmxlbmd0aCkge1xuICAgICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoID09PSAyICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlVSTCkgPiAtMSAmJlxuICAgICAgICAgIHNlY3VyaXR5Q29udGV4dHMuaW5kZXhPZihjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkwpID4gLTEpIHtcbiAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBzb21lIFVSTCBhdHRyaWJ1dGVzIChzdWNoIGFzIFwic3JjXCIgYW5kIFwiaHJlZlwiKSB0aGF0IG1heSBiZSBhIHBhcnRcbiAgICAgICAgLy8gb2YgZGlmZmVyZW50IHNlY3VyaXR5IGNvbnRleHRzLiBJbiB0aGlzIGNhc2Ugd2UgdXNlIHNwZWNpYWwgc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGFuZFxuICAgICAgICAvLyBzZWxlY3QgdGhlIGFjdHVhbCBzYW5pdGl6ZXIgYXQgcnVudGltZSBiYXNlZCBvbiBhIHRhZyBuYW1lIHRoYXQgaXMgcHJvdmlkZWQgd2hpbGVcbiAgICAgICAgLy8gaW52b2tpbmcgc2FuaXRpemF0aW9uIGZ1bmN0aW9uLlxuICAgICAgICBzYW5pdGl6ZXJGbiA9IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2FuaXRpemVyRm4gPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oc2VjdXJpdHlDb250ZXh0c1swXSwgaXNBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpbnN0cnVjdGlvblBhcmFtcyA9IFtvLmxpdGVyYWwoYmluZGluZ05hbWUpLCBiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl07XG4gICAgaWYgKHNhbml0aXplckZuKSB7XG4gICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKHNhbml0aXplckZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgdGhlcmUgd2FzIG5vIHNhbml0aXphdGlvbiBmdW5jdGlvbiBmb3VuZCBiYXNlZCBvbiB0aGUgc2VjdXJpdHkgY29udGV4dFxuICAgICAgLy8gb2YgYW4gYXR0cmlidXRlL3Byb3BlcnR5IGJpbmRpbmcgLSBjaGVjayB3aGV0aGVyIHRoaXMgYXR0cmlidXRlL3Byb3BlcnR5IGlzXG4gICAgICAvLyBvbmUgb2YgdGhlIHNlY3VyaXR5LXNlbnNpdGl2ZSA8aWZyYW1lPiBhdHRyaWJ1dGVzLlxuICAgICAgLy8gTm90ZTogZm9yIGhvc3QgYmluZGluZ3MgZGVmaW5lZCBvbiBhIGRpcmVjdGl2ZSwgd2UgZG8gbm90IHRyeSB0byBmaW5kIGFsbFxuICAgICAgLy8gcG9zc2libGUgcGxhY2VzIHdoZXJlIGl0IGNhbiBiZSBtYXRjaGVkLCBzbyB3ZSBjYW4gbm90IGRldGVybWluZSB3aGV0aGVyXG4gICAgICAvLyB0aGUgaG9zdCBlbGVtZW50IGlzIGFuIDxpZnJhbWU+LiBJbiB0aGlzIGNhc2UsIGlmIGFuIGF0dHJpYnV0ZS9iaW5kaW5nXG4gICAgICAvLyBuYW1lIGlzIGluIHRoZSBgSUZSQU1FX1NFQ1VSSVRZX1NFTlNJVElWRV9BVFRSU2Agc2V0IC0gYXBwZW5kIGEgdmFsaWRhdGlvblxuICAgICAgLy8gZnVuY3Rpb24sIHdoaWNoIHdvdWxkIGJlIGludm9rZWQgYXQgcnVudGltZSBhbmQgd291bGQgaGF2ZSBhY2Nlc3MgdG8gdGhlXG4gICAgICAvLyB1bmRlcmx5aW5nIERPTSBlbGVtZW50LCBjaGVjayBpZiBpdCdzIGFuIDxpZnJhbWU+IGFuZCBpZiBzbyAtIHJ1bnMgZXh0cmEgY2hlY2tzLlxuICAgICAgaWYgKGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKGJpbmRpbmdOYW1lKSkge1xuICAgICAgICBpbnN0cnVjdGlvblBhcmFtcy5wdXNoKG8uaW1wb3J0RXhwcihSMy52YWxpZGF0ZUlmcmFtZUF0dHJpYnV0ZSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVZhcmlhYmxlcy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcblxuICAgIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuaG9zdFByb3BlcnR5KSB7XG4gICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmF0dHJpYnV0ZSkge1xuICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuc3ludGhldGljSG9zdFByb3BlcnR5KSB7XG4gICAgICBzeW50aGV0aWNIb3N0QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IGluc3RydWN0aW9uLCBwYXJhbXNPckZuOiBpbnN0cnVjdGlvblBhcmFtcywgc3BhbjogbnVsbH0pO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBwcm9wZXJ0eUJpbmRpbmdzKSB7XG4gICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMuaG9zdFByb3BlcnR5LCBwYXJhbXNPckZuOiBiaW5kaW5nUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGJpbmRpbmdQYXJhbXMgb2YgYXR0cmlidXRlQmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5hdHRyaWJ1dGUsIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBzeW50aGV0aWNIb3N0QmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaChcbiAgICAgICAge3JlZmVyZW5jZTogUjMuc3ludGhldGljSG9zdFByb3BlcnR5LCBwYXJhbXNPckZuOiBiaW5kaW5nUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICAvLyBzaW5jZSB3ZSdyZSBkZWFsaW5nIHdpdGggZGlyZWN0aXZlcy9jb21wb25lbnRzIGFuZCBib3RoIGhhdmUgaG9zdEJpbmRpbmdcbiAgLy8gZnVuY3Rpb25zLCB3ZSBuZWVkIHRvIGdlbmVyYXRlIGEgc3BlY2lhbCBob3N0QXR0cnMgaW5zdHJ1Y3Rpb24gdGhhdCBkZWFsc1xuICAvLyB3aXRoIGJvdGggdGhlIGFzc2lnbm1lbnQgb2Ygc3R5bGluZyBhcyB3ZWxsIGFzIHN0YXRpYyBhdHRyaWJ1dGVzIHRvIHRoZSBob3N0XG4gIC8vIGVsZW1lbnQuIFRoZSBpbnN0cnVjdGlvbiBiZWxvdyB3aWxsIGluc3RydWN0IGFsbCBpbml0aWFsIHN0eWxpbmcgKHN0eWxpbmdcbiAgLy8gdGhhdCBpcyBpbnNpZGUgb2YgYSBob3N0IGJpbmRpbmcgd2l0aGluIGEgZGlyZWN0aXZlL2NvbXBvbmVudCkgdG8gYmUgYXR0YWNoZWRcbiAgLy8gdG8gdGhlIGhvc3QgZWxlbWVudCBhbG9uZ3NpZGUgYW55IG9mIHRoZSBwcm92aWRlZCBob3N0IGF0dHJpYnV0ZXMgdGhhdCB3ZXJlXG4gIC8vIGNvbGxlY3RlZCBlYXJsaWVyLlxuICBjb25zdCBob3N0QXR0cnMgPSBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlcyk7XG4gIHN0eWxlQnVpbGRlci5hc3NpZ25Ib3N0QXR0cnMoaG9zdEF0dHJzLCBkZWZpbml0aW9uTWFwKTtcblxuICBpZiAoc3R5bGVCdWlsZGVyLmhhc0JpbmRpbmdzKSB7XG4gICAgLy8gZmluYWxseSBlYWNoIGJpbmRpbmcgdGhhdCB3YXMgcmVnaXN0ZXJlZCBpbiB0aGUgc3RhdGVtZW50IGFib3ZlIHdpbGwgbmVlZCB0byBiZSBhZGRlZCB0b1xuICAgIC8vIHRoZSB1cGRhdGUgYmxvY2sgb2YgYSBjb21wb25lbnQvZGlyZWN0aXZlIHRlbXBsYXRlRm4vaG9zdEJpbmRpbmdzRm4gc28gdGhhdCB0aGUgYmluZGluZ3NcbiAgICAvLyBhcmUgZXZhbHVhdGVkIGFuZCB1cGRhdGVkIGZvciB0aGUgZWxlbWVudC5cbiAgICBzdHlsZUJ1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyhnZXRWYWx1ZUNvbnZlcnRlcigpKS5mb3JFYWNoKGluc3RydWN0aW9uID0+IHtcbiAgICAgIGZvciAoY29uc3QgY2FsbCBvZiBpbnN0cnVjdGlvbi5jYWxscykge1xuICAgICAgICAvLyB3ZSBzdWJ0cmFjdCBhIHZhbHVlIG9mIGAxYCBoZXJlIGJlY2F1c2UgdGhlIGJpbmRpbmcgc2xvdCB3YXMgYWxyZWFkeSBhbGxvY2F0ZWRcbiAgICAgICAgLy8gYXQgdGhlIHRvcCBvZiB0aGlzIG1ldGhvZCB3aGVuIGFsbCB0aGUgaW5wdXQgYmluZGluZ3Mgd2VyZSBjb3VudGVkLlxuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz1cbiAgICAgICAgICAgIE1hdGgubWF4KGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHMgLSBNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVELCAwKTtcblxuICAgICAgICBjb25zdCB7cGFyYW1zLCBzdG10c30gPVxuICAgICAgICAgICAgY29udmVydFN0eWxpbmdDYWxsKGNhbGwsIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4sIGdldE5leHRCaW5kaW5nSWQpO1xuICAgICAgICB1cGRhdGVWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICByZWZlcmVuY2U6IGluc3RydWN0aW9uLnJlZmVyZW5jZSxcbiAgICAgICAgICBwYXJhbXNPckZuOiBwYXJhbXMsXG4gICAgICAgICAgc3BhbjogbnVsbCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAodG90YWxIb3N0VmFyc0NvdW50KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RWYXJzJywgby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwIHx8IHVwZGF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzRm5OYW1lID0gbmFtZSA/IGAke25hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsO1xuICAgIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBpZiAoY3JlYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGdldEluc3RydWN0aW9uU3RhdGVtZW50cyhjcmVhdGVJbnN0cnVjdGlvbnMpKSk7XG4gICAgfVxuICAgIGlmICh1cGRhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSxcbiAgICAgICAgICB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KGdldEluc3RydWN0aW9uU3RhdGVtZW50cyh1cGRhdGVJbnN0cnVjdGlvbnMpKSkpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSwgc3RhdGVtZW50cyxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNULCBnZXROZXh0QmluZGluZ0lkRm46ICgpID0+IHN0cmluZykge1xuICByZXR1cm4gY29udmVydFByb3BlcnR5QmluZGluZyhudWxsLCBpbXBsaWNpdCwgdmFsdWUsIGdldE5leHRCaW5kaW5nSWRGbigpKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFN0eWxpbmdDYWxsKFxuICAgIGNhbGw6IFN0eWxpbmdJbnN0cnVjdGlvbkNhbGwsIGJpbmRpbmdDb250ZXh0OiBhbnksIGJpbmRpbmdGbjogRnVuY3Rpb24sXG4gICAgZ2V0TmV4dEJpbmRpbmdJZEZuOiAoKSA9PiBzdHJpbmcpIHtcbiAgY29uc3Qgc3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgcGFyYW1zID0gY2FsbC5wYXJhbXModmFsdWUgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUsIGdldE5leHRCaW5kaW5nSWRGbik7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0LnN0bXRzKSAmJiByZXN1bHQuc3RtdHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RtdHMucHVzaCguLi5yZXN1bHQuc3RtdHMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0LmN1cnJWYWxFeHByO1xuICB9KTtcbiAgcmV0dXJuIHtwYXJhbXMsIHN0bXRzfTtcbn1cblxuZnVuY3Rpb24gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nOiBQYXJzZWRQcm9wZXJ0eSk6XG4gICAge2JpbmRpbmdOYW1lOiBzdHJpbmcsIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBpc0F0dHJpYnV0ZTogYm9vbGVhbn0ge1xuICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWU7XG4gIGxldCBpbnN0cnVjdGlvbiE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgYW4gYXR0ciBiaW5kaW5nIG9yIGEgcHJvcGVydHkgYmluZGluZ1xuICBjb25zdCBhdHRyTWF0Y2hlcyA9IGJpbmRpbmdOYW1lLm1hdGNoKEFUVFJfUkVHRVgpO1xuICBpZiAoYXR0ck1hdGNoZXMpIHtcbiAgICBiaW5kaW5nTmFtZSA9IGF0dHJNYXRjaGVzWzFdO1xuICAgIGluc3RydWN0aW9uID0gUjMuYXR0cmlidXRlO1xuICB9IGVsc2Uge1xuICAgIGlmIChiaW5kaW5nLmlzQW5pbWF0aW9uKSB7XG4gICAgICBiaW5kaW5nTmFtZSA9IHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUoYmluZGluZ05hbWUpO1xuICAgICAgLy8gaG9zdCBiaW5kaW5ncyB0aGF0IGhhdmUgYSBzeW50aGV0aWMgcHJvcGVydHkgKGUuZy4gQGZvbykgc2hvdWxkIGFsd2F5cyBiZSByZW5kZXJlZFxuICAgICAgLy8gaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBvbmVudCBhbmQgbm90IHRoZSBwYXJlbnQuIFRoZXJlZm9yZSB0aGVyZSBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNvbXBhdGliaWxpdHkgaW5zdHJ1Y3Rpb24gYXZhaWxhYmxlIGZvciB0aGlzIHB1cnBvc2UuXG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLnN5bnRoZXRpY0hvc3RQcm9wZXJ0eTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5ob3N0UHJvcGVydHk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGlzQXR0cmlidXRlOiAhIWF0dHJNYXRjaGVzfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzOiBQYXJzZWRFdmVudFtdLCBuYW1lPzogc3RyaW5nKTogSW5zdHJ1Y3Rpb25bXSB7XG4gIGNvbnN0IGxpc3RlbmVyUGFyYW1zOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgYmluZGluZyBvZiBldmVudEJpbmRpbmdzKSB7XG4gICAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IGJpbmRpbmdGbk5hbWUgPSBiaW5kaW5nLnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUoYmluZGluZ05hbWUsIGJpbmRpbmcudGFyZ2V0T3JQaGFzZSkgOlxuICAgICAgICBiaW5kaW5nTmFtZTtcbiAgICBjb25zdCBoYW5kbGVyTmFtZSA9IG5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHtuYW1lfV8ke2JpbmRpbmdGbk5hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IHBhcmFtcyA9IHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhCb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChiaW5kaW5nKSwgaGFuZGxlck5hbWUpO1xuXG4gICAgaWYgKGJpbmRpbmcudHlwZSA9PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uKSB7XG4gICAgICBzeW50aGV0aWNMaXN0ZW5lclBhcmFtcy5wdXNoKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3RlbmVyUGFyYW1zLnB1c2gocGFyYW1zKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGNvbnN0IHBhcmFtcyBvZiBzeW50aGV0aWNMaXN0ZW5lclBhcmFtcykge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLnN5bnRoZXRpY0hvc3RMaXN0ZW5lciwgcGFyYW1zT3JGbjogcGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gIH1cblxuICBmb3IgKGNvbnN0IHBhcmFtcyBvZiBsaXN0ZW5lclBhcmFtcykge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLmxpc3RlbmVyLCBwYXJhbXNPckZuOiBwYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIHJldHVybiBpbnN0cnVjdGlvbnM7XG59XG5cblxuY29uc3QgSE9TVF9SRUdfRVhQID0gL14oPzpcXFsoW15cXF1dKylcXF0pfCg/OlxcKChbXlxcKV0rKVxcKSkkLztcbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCIsIG9yIFwiYXR0ci5yb2xlXCIgZnJvbSBcIlthdHRyLnJvbGVdXCIsIG9yIEBhbmltIGZyb20gW0BhbmltXVxuICBCaW5kaW5nID0gMSxcblxuICAvLyBncm91cCAyOiBcImV2ZW50XCIgZnJvbSBcIihldmVudClcIlxuICBFdmVudCA9IDIsXG59XG5cbi8vIERlZmluZXMgSG9zdCBCaW5kaW5ncyBzdHJ1Y3R1cmUgdGhhdCBjb250YWlucyBhdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIGFuZCBwcm9wZXJ0aWVzLFxuLy8gcGFyc2VkIGZyb20gdGhlIGBob3N0YCBvYmplY3QgZGVmaW5lZCBmb3IgYSBUeXBlLlxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufTtcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd8by5FeHByZXNzaW9ufSk6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gIGNvbnN0IGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3Qgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9ID0ge307XG5cbiAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoaG9zdCkpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG5cbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENsYXNzIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuY2xhc3NBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N0eWxlJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHlsZSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLnN0eWxlQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSBvLmxpdGVyYWwodmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ10gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIC8vIHN5bnRoZXRpYyBwcm9wZXJ0aWVzICh0aGUgb25lcyB0aGF0IGhhdmUgYSBgQGAgYXMgYSBwcmVmaXgpXG4gICAgICAvLyBhcmUgc3RpbGwgdHJlYXRlZCB0aGUgc2FtZSBhcyByZWd1bGFyIHByb3BlcnRpZXMuIFRoZXJlZm9yZVxuICAgICAgLy8gdGhlcmUgaXMgbm8gcG9pbnQgaW4gc3RvcmluZyB0aGVtIGluIGEgc2VwYXJhdGUgbWFwLlxuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQmluZGluZ11dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmVudCBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgc3BlY2lhbEF0dHJpYnV0ZXN9O1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIGhvc3QgYmluZGluZ3MgYW5kIHJldHVybnMgdGhlIGxpc3Qgb2YgZXJyb3JzIChpZiBhbnkpLiBFbXB0eSBhcnJheSBpbmRpY2F0ZXMgdGhhdCBhXG4gKiBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncyBoYXMgbm8gZXJyb3JzLlxuICpcbiAqIEBwYXJhbSBiaW5kaW5ncyBzZXQgb2YgaG9zdCBiaW5kaW5ncyB0byB2ZXJpZnkuXG4gKiBAcGFyYW0gc291cmNlU3BhbiBzb3VyY2Ugc3BhbiB3aGVyZSBob3N0IGJpbmRpbmdzIHdlcmUgZGVmaW5lZC5cbiAqIEByZXR1cm5zIGFycmF5IG9mIGVycm9ycyBhc3NvY2lhdGVkIHdpdGggYSBnaXZlbiBzZXQgb2YgaG9zdCBiaW5kaW5ncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZlcmlmeUhvc3RCaW5kaW5ncyhcbiAgICBiaW5kaW5nczogUGFyc2VkSG9zdEJpbmRpbmdzLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4pOiBQYXJzZUVycm9yW10ge1xuICAvLyBUT0RPOiBhYnN0cmFjdCBvdXQgaG9zdCBiaW5kaW5ncyB2ZXJpZmljYXRpb24gbG9naWMgYW5kIHVzZSBpdCBpbnN0ZWFkIG9mXG4gIC8vIGNyZWF0aW5nIGV2ZW50cyBhbmQgcHJvcGVydGllcyBBU1RzIHRvIGRldGVjdCBlcnJvcnMgKEZXLTk5NilcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKCk7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhiaW5kaW5ncy5saXN0ZW5lcnMsIHNvdXJjZVNwYW4pO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoYmluZGluZ3MucHJvcGVydGllcywgc291cmNlU3Bhbik7XG4gIHJldHVybiBiaW5kaW5nUGFyc2VyLmVycm9ycztcbn1cblxuZnVuY3Rpb24gY29tcGlsZVN0eWxlcyhzdHlsZXM6IHN0cmluZ1tdLCBzZWxlY3Rvcjogc3RyaW5nLCBob3N0U2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc3R5bGVzLm1hcChzdHlsZSA9PiB7XG4gICAgcmV0dXJuIHNoYWRvd0NzcyEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgYSBDU1Mgc3R5bGVzaGVldCB3aXRoIGVtdWxhdGVkIHZpZXcgZW5jYXBzdWxhdGlvbi5cbiAqIFRoaXMgYWxsb3dzIGEgc3R5bGVzaGVldCB0byBiZSB1c2VkIHdpdGggYW4gQW5ndWxhciBjb21wb25lbnQgdGhhdFxuICogaXMgdXNpbmcgdGhlIGBWaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZGAgbW9kZS5cbiAqXG4gKiBAcGFyYW0gc3R5bGUgVGhlIGNvbnRlbnQgb2YgYSBDU1Mgc3R5bGVzaGVldC5cbiAqIEByZXR1cm5zIFRoZSBlbmNhcHN1bGF0ZWQgY29udGVudCBmb3IgdGhlIHN0eWxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jYXBzdWxhdGVTdHlsZShzdHlsZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc2hhZG93Q3NzID0gbmV3IFNoYWRvd0NzcygpO1xuICByZXR1cm4gc2hhZG93Q3NzLnNoaW1Dc3NUZXh0KHN0eWxlLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5UeXBlIHtcbiAgaWYgKCFtZXRhLmhvc3REaXJlY3RpdmVzPy5sZW5ndGgpIHtcbiAgICByZXR1cm4gby5OT05FX1RZUEU7XG4gIH1cblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIobWV0YS5ob3N0RGlyZWN0aXZlcy5tYXAoaG9zdE1ldGEgPT4gby5saXRlcmFsTWFwKFtcbiAgICB7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IG8udHlwZW9mRXhwcihob3N0TWV0YS5kaXJlY3RpdmUudHlwZSksIHF1b3RlZDogZmFsc2V9LFxuICAgIHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihob3N0TWV0YS5pbnB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgICB7a2V5OiAnb3V0cHV0cycsIHZhbHVlOiBzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKGhvc3RNZXRhLm91dHB1dHMgfHwge30pLCBxdW90ZWQ6IGZhbHNlfSxcbiAgXSkpKSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICBob3N0RGlyZWN0aXZlczogTm9uTnVsbGFibGU8UjNEaXJlY3RpdmVNZXRhZGF0YVsnaG9zdERpcmVjdGl2ZXMnXT4pOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBleHByZXNzaW9uczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgbGV0IGhhc0ZvcndhcmRSZWYgPSBmYWxzZTtcblxuICBmb3IgKGNvbnN0IGN1cnJlbnQgb2YgaG9zdERpcmVjdGl2ZXMpIHtcbiAgICAvLyBVc2UgYSBzaG9ydGhhbmQgaWYgdGhlcmUgYXJlIG5vIGlucHV0cyBvciBvdXRwdXRzLlxuICAgIGlmICghY3VycmVudC5pbnB1dHMgJiYgIWN1cnJlbnQub3V0cHV0cykge1xuICAgICAgZXhwcmVzc2lvbnMucHVzaChjdXJyZW50LmRpcmVjdGl2ZS50eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qga2V5cyA9IFt7a2V5OiAnZGlyZWN0aXZlJywgdmFsdWU6IGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUsIHF1b3RlZDogZmFsc2V9XTtcblxuICAgICAgaWYgKGN1cnJlbnQuaW5wdXRzKSB7XG4gICAgICAgIGNvbnN0IGlucHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50LmlucHV0cyk7XG4gICAgICAgIGlmIChpbnB1dHNMaXRlcmFsKSB7XG4gICAgICAgICAga2V5cy5wdXNoKHtrZXk6ICdpbnB1dHMnLCB2YWx1ZTogaW5wdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjdXJyZW50Lm91dHB1dHMpIHtcbiAgICAgICAgY29uc3Qgb3V0cHV0c0xpdGVyYWwgPSBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShjdXJyZW50Lm91dHB1dHMpO1xuICAgICAgICBpZiAob3V0cHV0c0xpdGVyYWwpIHtcbiAgICAgICAgICBrZXlzLnB1c2goe2tleTogJ291dHB1dHMnLCB2YWx1ZTogb3V0cHV0c0xpdGVyYWwsIHF1b3RlZDogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBleHByZXNzaW9ucy5wdXNoKG8ubGl0ZXJhbE1hcChrZXlzKSk7XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbnQuaXNGb3J3YXJkUmVmZXJlbmNlKSB7XG4gICAgICBoYXNGb3J3YXJkUmVmID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBJZiB0aGVyZSdzIGEgZm9yd2FyZCByZWZlcmVuY2UsIHdlIGdlbmVyYXRlIGEgYGZ1bmN0aW9uKCkgeyByZXR1cm4gW0hvc3REaXJdIH1gLFxuICAvLyBvdGhlcndpc2Ugd2UgY2FuIHNhdmUgc29tZSBieXRlcyBieSB1c2luZyBhIHBsYWluIGFycmF5LCBlLmcuIGBbSG9zdERpcl1gLlxuICByZXR1cm4gaGFzRm9yd2FyZFJlZiA/XG4gICAgICBuZXcgby5GdW5jdGlvbkV4cHIoW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKGV4cHJlc3Npb25zKSldKSA6XG4gICAgICBvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuIGlucHV0L291dHB1dCBtYXBwaW5nIG9iamVjdCBsaXRlcmFsIGludG8gYW4gYXJyYXkgd2hlcmUgdGhlIGV2ZW4ga2V5cyBhcmUgdGhlXG4gKiBwdWJsaWMgbmFtZSBvZiB0aGUgYmluZGluZyBhbmQgdGhlIG9kZCBvbmVzIGFyZSB0aGUgbmFtZSBpdCB3YXMgYWxpYXNlZCB0by4gRS5nLlxuICogYHtpbnB1dE9uZTogJ2FsaWFzT25lJywgaW5wdXRUd286ICdhbGlhc1R3byd9YCB3aWxsIGJlY29tZVxuICogYFsnaW5wdXRPbmUnLCAnYWxpYXNPbmUnLCAnaW5wdXRUd28nLCAnYWxpYXNUd28nXWAuXG4gKlxuICogVGhpcyBjb252ZXJzaW9uIGlzIG5lY2Vzc2FyeSwgYmVjYXVzZSBob3N0cyBiaW5kIHRvIHRoZSBwdWJsaWMgbmFtZSBvZiB0aGUgaG9zdCBkaXJlY3RpdmUgYW5kXG4gKiBrZWVwaW5nIHRoZSBtYXBwaW5nIGluIGFuIG9iamVjdCBsaXRlcmFsIHdpbGwgYnJlYWsgZm9yIGFwcHMgdXNpbmcgcHJvcGVydHkgcmVuYW1pbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIb3N0RGlyZWN0aXZlc01hcHBpbmdBcnJheShtYXBwaW5nOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTpcbiAgICBvLkxpdGVyYWxBcnJheUV4cHJ8bnVsbCB7XG4gIGNvbnN0IGVsZW1lbnRzOiBvLkxpdGVyYWxFeHByW10gPSBbXTtcblxuICBmb3IgKGNvbnN0IHB1YmxpY05hbWUgaW4gbWFwcGluZykge1xuICAgIGlmIChtYXBwaW5nLmhhc093blByb3BlcnR5KHB1YmxpY05hbWUpKSB7XG4gICAgICBlbGVtZW50cy5wdXNoKG8ubGl0ZXJhbChwdWJsaWNOYW1lKSwgby5saXRlcmFsKG1hcHBpbmdbcHVibGljTmFtZV0pKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudHMubGVuZ3RoID4gMCA/IG8ubGl0ZXJhbEFycihlbGVtZW50cykgOiBudWxsO1xufVxuIl19