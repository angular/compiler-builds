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
    if (meta.defer.mode === 1 /* DeferBlockDepsEmitMode.PerComponent */ &&
        meta.defer.dependenciesFn !== null) {
        const fnName = `${templateTypeName}_DeferFn`;
        constantPool.statements.push(meta.defer.dependenciesFn.toDeclStmt(fnName, o.StmtModifier.Final));
        allDeferrableDepsFn = o.variable(fnName);
    }
    // Template compilation is currently conditional as we're in the process of rewriting it.
    if (!USE_TEMPLATE_PIPELINE && !meta.useTemplatePipeline) {
        // This is the main path currently used in compilation, which compiles the template with the
        // legacy `TemplateDefinitionBuilder`.
        const template = meta.template;
        const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.createRootScope(), 0, templateTypeName, null, null, templateName, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds, new Map());
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
        const tpl = ingestComponent(meta.name, meta.template.nodes, constantPool, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.defer, allDeferrableDepsFn);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRWhGLE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBbUIsZUFBZSxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQzlGLE9BQU8sS0FBSyxDQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDN0MsT0FBTyxFQUE4QixrQkFBa0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2pGLE9BQU8sRUFBQyw2QkFBNkIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxFQUFDLGtCQUFrQixFQUFDLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRyxPQUFPLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFDdEYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLFlBQVksQ0FBQztBQUNqQyxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3JDLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFDLG9DQUFvQyxFQUFFLDRCQUE0QixFQUF3Qixr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LENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQzdELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge2NvbnZlcnRQcm9wZXJ0eUJpbmRpbmd9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudCwgUGFyc2VkRXZlbnRUeXBlLCBQYXJzZWRQcm9wZXJ0eX0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge2lzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyfSBmcm9tICcuLi8uLi9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NvbXBpbGF0aW9uSm9iS2luZH0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2NvbXBpbGF0aW9uJztcbmltcG9ydCB7ZW1pdEhvc3RCaW5kaW5nRnVuY3Rpb24sIGVtaXRUZW1wbGF0ZUZuLCB0cmFuc2Zvcm19IGZyb20gJy4uLy4uL3RlbXBsYXRlL3BpcGVsaW5lL3NyYy9lbWl0JztcbmltcG9ydCB7aW5nZXN0Q29tcG9uZW50LCBpbmdlc3RIb3N0QmluZGluZ30gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3JjL2luZ2VzdCc7XG5pbXBvcnQge1VTRV9URU1QTEFURV9QSVBFTElORX0gZnJvbSAnLi4vLi4vdGVtcGxhdGUvcGlwZWxpbmUvc3dpdGNoJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0IHtCb3VuZEV2ZW50fSBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWUsIFIzQ29tcGlsZWRFeHByZXNzaW9uLCB0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0RlY2xhcmF0aW9uTGlzdEVtaXRNb2RlLCBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBSM0hvc3RNZXRhZGF0YSwgUjNUZW1wbGF0ZURlcGVuZGVuY3l9IGZyb20gJy4vYXBpJztcbmltcG9ydCB7Y3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbiwgY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbn0gZnJvbSAnLi9xdWVyeV9nZW5lcmF0aW9uJztcbmltcG9ydCB7TUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRCwgU3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbkNhbGx9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7QmluZGluZ1Njb3BlLCBtYWtlQmluZGluZ1BhcnNlciwgcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXQsIHJlc29sdmVTYW5pdGl6YXRpb25GbiwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgVmFsdWVDb252ZXJ0ZXJ9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbCwgQ09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBnZXRJbnN0cnVjdGlvblN0YXRlbWVudHMsIEluc3RydWN0aW9uLCBSRU5ERVJfRkxBR1N9IGZyb20gJy4vdXRpbCc7XG5cblxuLy8gVGhpcyByZWdleCBtYXRjaGVzIGFueSBiaW5kaW5nIG5hbWVzIHRoYXQgY29udGFpbiB0aGUgXCJhdHRyLlwiIHByZWZpeCwgZS5nLiBcImF0dHIucmVxdWlyZWRcIlxuLy8gSWYgdGhlcmUgaXMgYSBtYXRjaCwgdGhlIGZpcnN0IG1hdGNoaW5nIGdyb3VwIHdpbGwgY29udGFpbiB0aGUgYXR0cmlidXRlIG5hbWUgdG8gYmluZC5cbmNvbnN0IEFUVFJfUkVHRVggPSAvYXR0clxcLihbXlxcXV0rKS87XG5cblxuY29uc3QgQ09NUE9ORU5UX1ZBUklBQkxFID0gJyVDT01QJSc7XG5jb25zdCBIT1NUX0FUVFIgPSBgX25naG9zdC0ke0NPTVBPTkVOVF9WQVJJQUJMRX1gO1xuY29uc3QgQ09OVEVOVF9BVFRSID0gYF9uZ2NvbnRlbnQtJHtDT01QT05FTlRfVkFSSUFCTEV9YDtcblxuZnVuY3Rpb24gYmFzZURpcmVjdGl2ZUZpZWxkcyhcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogRGVmaW5pdGlvbk1hcCB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBjb25zdCBzZWxlY3RvcnMgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IobWV0YS5zZWxlY3Rvcik7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlLnZhbHVlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGFzTGl0ZXJhbChzZWxlY3RvcnMpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoID4gMCkge1xuICAgIC8vIGUuZy4gYGNvbnRlbnRRdWVyaWVzOiAocmYsIGN0eCwgZGlySW5kZXgpID0+IHsgLi4uIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLnF1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICBpZiAobWV0YS52aWV3UXVlcmllcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YS52aWV3UXVlcmllcywgY29uc3RhbnRQb29sLCBtZXRhLm5hbWUpKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGhvc3RCaW5kaW5nczogKHJmLCBjdHgpID0+IHsgLi4uIH1cbiAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAnaG9zdEJpbmRpbmdzJyxcbiAgICAgIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgICAgICAgIG1ldGEuaG9zdCwgbWV0YS50eXBlU291cmNlU3BhbiwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBtZXRhLnNlbGVjdG9yIHx8ICcnLFxuICAgICAgICAgIG1ldGEubmFtZSwgZGVmaW5pdGlvbk1hcCkpO1xuXG4gIC8vIGUuZyAnaW5wdXRzOiB7YTogJ2EnfWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVEaXJlY3RpdmVCaW5kaW5nTGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZURpcmVjdGl2ZUJpbmRpbmdMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsQXJyKG1ldGEuZXhwb3J0QXMubWFwKGUgPT4gby5saXRlcmFsKGUpKSkpO1xuICB9XG5cbiAgaWYgKG1ldGEuaXNTdGFuZGFsb25lKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0YW5kYWxvbmUnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChtZXRhLmlzU2lnbmFsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NpZ25hbHMnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG5cbiAgcmV0dXJuIGRlZmluaXRpb25NYXA7XG59XG5cbi8qKlxuICogQWRkIGZlYXR1cmVzIHRvIHRoZSBkZWZpbml0aW9uIG1hcC5cbiAqL1xuZnVuY3Rpb24gYWRkRmVhdHVyZXMoXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCxcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhfFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3k+KSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YS5wcm92aWRlcnM7XG4gIGNvbnN0IHZpZXdQcm92aWRlcnMgPSAobWV0YSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pikudmlld1Byb3ZpZGVycztcbiAgY29uc3QgaW5wdXRLZXlzID0gT2JqZWN0LmtleXMobWV0YS5pbnB1dHMpO1xuXG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG4gIGZvciAoY29uc3Qga2V5IG9mIGlucHV0S2V5cykge1xuICAgIGlmIChtZXRhLmlucHV0c1trZXldLnRyYW5zZm9ybUZ1bmN0aW9uICE9PSBudWxsKSB7XG4gICAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5JbnB1dFRyYW5zZm9ybXNGZWF0dXJlRmVhdHVyZSkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIC8vIE5vdGU6IGhvc3QgZGlyZWN0aXZlcyBmZWF0dXJlIG5lZWRzIHRvIGJlIGluc2VydGVkIGJlZm9yZSB0aGVcbiAgLy8gaW5oZXJpdGFuY2UgZmVhdHVyZSB0byBlbnN1cmUgdGhlIGNvcnJlY3QgZXhlY3V0aW9uIG9yZGVyLlxuICBpZiAobWV0YS5ob3N0RGlyZWN0aXZlcz8ubGVuZ3RoKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSG9zdERpcmVjdGl2ZXNGZWF0dXJlKS5jYWxsRm4oW2NyZWF0ZUhvc3REaXJlY3RpdmVzRmVhdHVyZUFyZyhcbiAgICAgICAgbWV0YS5ob3N0RGlyZWN0aXZlcyldKSk7XG4gIH1cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICAvLyBUT0RPOiBiZXR0ZXIgd2F5IG9mIGRpZmZlcmVudGlhdGluZyBjb21wb25lbnQgdnMgZGlyZWN0aXZlIG1ldGFkYXRhLlxuICBpZiAobWV0YS5oYXNPd25Qcm9wZXJ0eSgndGVtcGxhdGUnKSAmJiBtZXRhLmlzU3RhbmRhbG9uZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlN0YW5kYWxvbmVGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVEaXJlY3RpdmVUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5PiwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJyxcbiAgICAgICAgICBjb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKFxuICAgICAgICAgICAgICBvLmxpdGVyYWxBcnIoc2VsZWN0b3JBdHRyaWJ1dGVzLm1hcChcbiAgICAgICAgICAgICAgICAgIHZhbHVlID0+IHZhbHVlICE9IG51bGwgPyBvLmxpdGVyYWwodmFsdWUpIDogby5saXRlcmFsKHVuZGVmaW5lZCkpKSxcbiAgICAgICAgICAgICAgLyogZm9yY2VTaGFyZWQgKi8gdHJ1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGUuZy4gYHRlbXBsYXRlOiBmdW5jdGlvbiBNeUNvbXBvbmVudF9UZW1wbGF0ZShfY3R4LCBfY20pIHsuLi59YFxuICBjb25zdCB0ZW1wbGF0ZVR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSB0ZW1wbGF0ZVR5cGVOYW1lID8gYCR7dGVtcGxhdGVUeXBlTmFtZX1fVGVtcGxhdGVgIDogbnVsbDtcblxuXG4gIGxldCBhbGxEZWZlcnJhYmxlRGVwc0ZuOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBpZiAobWV0YS5kZWZlci5tb2RlID09PSBEZWZlckJsb2NrRGVwc0VtaXRNb2RlLlBlckNvbXBvbmVudCAmJlxuICAgICAgbWV0YS5kZWZlci5kZXBlbmRlbmNpZXNGbiAhPT0gbnVsbCkge1xuICAgIGNvbnN0IGZuTmFtZSA9IGAke3RlbXBsYXRlVHlwZU5hbWV9X0RlZmVyRm5gO1xuICAgIGNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIG1ldGEuZGVmZXIuZGVwZW5kZW5jaWVzRm4udG9EZWNsU3RtdChmbk5hbWUsIG8uU3RtdE1vZGlmaWVyLkZpbmFsKSk7XG4gICAgYWxsRGVmZXJyYWJsZURlcHNGbiA9IG8udmFyaWFibGUoZm5OYW1lKTtcbiAgfVxuXG4gIC8vIFRlbXBsYXRlIGNvbXBpbGF0aW9uIGlzIGN1cnJlbnRseSBjb25kaXRpb25hbCBhcyB3ZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiByZXdyaXRpbmcgaXQuXG4gIGlmICghVVNFX1RFTVBMQVRFX1BJUEVMSU5FICYmICFtZXRhLnVzZVRlbXBsYXRlUGlwZWxpbmUpIHtcbiAgICAvLyBUaGlzIGlzIHRoZSBtYWluIHBhdGggY3VycmVudGx5IHVzZWQgaW4gY29tcGlsYXRpb24sIHdoaWNoIGNvbXBpbGVzIHRoZSB0ZW1wbGF0ZSB3aXRoIHRoZVxuICAgIC8vIGxlZ2FjeSBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAuXG5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gICAgY29uc3QgdGVtcGxhdGVCdWlsZGVyID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLmNyZWF0ZVJvb3RTY29wZSgpLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCBudWxsLCBudWxsLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICAgIFIzLm5hbWVzcGFjZUhUTUwsIG1ldGEucmVsYXRpdmVDb250ZXh0RmlsZVBhdGgsIG1ldGEuaTE4blVzZUV4dGVybmFsSWRzLCBuZXcgTWFwKCkpO1xuXG4gICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHByb3ZpZGUgdGhpcyBzbyB0aGF0IGR5bmFtaWNhbGx5IGdlbmVyYXRlZCBjb21wb25lbnRzIGtub3cgd2hhdFxuICAgIC8vIHByb2plY3RlZCBjb250ZW50IGJsb2NrcyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIGNvbXBvbmVudCB3aGVuIGl0IGlzXG4gICAgLy8gICAgIGluc3RhbnRpYXRlZC5cbiAgICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gICAgaWYgKG5nQ29udGVudFNlbGVjdG9ycykge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIG5nQ29udGVudFNlbGVjdG9ycyk7XG4gICAgfVxuXG4gICAgLy8gZS5nLiBgZGVjbHM6IDJgXG4gICAgLy8gZGVmaW5pdGlvbk1hcC5zZXQoJ2RlY2xzJywgby5saXRlcmFsKHRwbC5yb290LmRlY2xzISkpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkZWNscycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RDb3VudCgpKSk7XG5cbiAgICAvLyBlLmcuIGB2YXJzOiAyYFxuICAgIC8vIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRwbC5yb290LnZhcnMhKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldFZhckNvdW50KCkpKTtcblxuICAgIC8vIEdlbmVyYXRlIGBjb25zdHNgIHNlY3Rpb24gb2YgQ29tcG9uZW50RGVmOlxuICAgIC8vIC0gZWl0aGVyIGFzIGFuIGFycmF5OlxuICAgIC8vICAgYGNvbnN0czogW1snb25lJywgJ3R3byddLCBbJ3RocmVlJywgJ2ZvdXInXV1gXG4gICAgLy8gLSBvciBhcyBhIGZhY3RvcnkgZnVuY3Rpb24gaW4gY2FzZSBhZGRpdGlvbmFsIHN0YXRlbWVudHMgYXJlIHByZXNlbnQgKHRvIHN1cHBvcnQgaTE4bik6XG4gICAgLy8gICBgY29uc3RzOiAoKSA9PiB7IHZhciBpMThuXzA7IGlmIChuZ0kxOG5DbG9zdXJlTW9kZSkgey4uLn0gZWxzZSB7Li4ufSByZXR1cm4gW2kxOG5fMF07XG4gICAgLy8gICB9YFxuICAgIGNvbnN0IHtjb25zdEV4cHJlc3Npb25zLCBwcmVwYXJlU3RhdGVtZW50c30gPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0Q29uc3RzKCk7XG4gICAgaWYgKGNvbnN0RXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IGNvbnN0c0V4cHI6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkFycm93RnVuY3Rpb25FeHByID0gby5saXRlcmFsQXJyKGNvbnN0RXhwcmVzc2lvbnMpO1xuICAgICAgLy8gUHJlcGFyZSBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50IC0gdHVybiBgY29uc3RzYCBpbnRvIGEgZnVuY3Rpb24uXG4gICAgICBpZiAocHJlcGFyZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdHNFeHByID0gby5hcnJvd0ZuKFtdLCBbLi4ucHJlcGFyZVN0YXRlbWVudHMsIG5ldyBvLlJldHVyblN0YXRlbWVudChjb25zdHNFeHByKV0pO1xuICAgICAgfVxuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnN0cycsIGNvbnN0c0V4cHIpO1xuICAgIH1cblxuICAgIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBUaGlzIHBhdGggY29tcGlsZXMgdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBwcm90b3R5cGUgdGVtcGxhdGUgcGlwZWxpbmUuIEZpcnN0IHRoZSB0ZW1wbGF0ZSBpc1xuICAgIC8vIGluZ2VzdGVkIGludG8gSVI6XG4gICAgY29uc3QgdHBsID0gaW5nZXN0Q29tcG9uZW50KFxuICAgICAgICBtZXRhLm5hbWUsIG1ldGEudGVtcGxhdGUubm9kZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5yZWxhdGl2ZUNvbnRleHRGaWxlUGF0aCxcbiAgICAgICAgbWV0YS5pMThuVXNlRXh0ZXJuYWxJZHMsIG1ldGEuZGVmZXIsIGFsbERlZmVycmFibGVEZXBzRm4pO1xuXG4gICAgLy8gVGhlbiB0aGUgSVIgaXMgdHJhbnNmb3JtZWQgdG8gcHJlcGFyZSBpdCBmb3IgY29kIGVnZW5lcmF0aW9uLlxuICAgIHRyYW5zZm9ybSh0cGwsIENvbXBpbGF0aW9uSm9iS2luZC5UbXBsKTtcblxuICAgIC8vIEZpbmFsbHkgd2UgZW1pdCB0aGUgdGVtcGxhdGUgZnVuY3Rpb246XG4gICAgY29uc3QgdGVtcGxhdGVGbiA9IGVtaXRUZW1wbGF0ZUZuKHRwbCwgY29uc3RhbnRQb29sKTtcblxuICAgIGlmICh0cGwuY29udGVudFNlbGVjdG9ycyAhPT0gbnVsbCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoJ25nQ29udGVudFNlbGVjdG9ycycsIHRwbC5jb250ZW50U2VsZWN0b3JzKTtcbiAgICB9XG5cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodHBsLnJvb3QuZGVjbHMgYXMgbnVtYmVyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZhcnMnLCBvLmxpdGVyYWwodHBsLnJvb3QudmFycyBhcyBudW1iZXIpKTtcbiAgICBpZiAodHBsLmNvbnN0cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAodHBsLmNvbnN0c0luaXRpYWxpemVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmFycm93Rm4oW10sIFtcbiAgICAgICAgICAuLi50cGwuY29uc3RzSW5pdGlhbGl6ZXJzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKVxuICAgICAgICBdKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsQXJyKHRwbC5jb25zdHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGbik7XG4gIH1cblxuICBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSAhPT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkICYmXG4gICAgICBtZXRhLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkZXBlbmRlbmNpZXMnLFxuICAgICAgICBjb21waWxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgICAgICAgby5saXRlcmFsQXJyKG1ldGEuZGVjbGFyYXRpb25zLm1hcChkZWNsID0+IGRlY2wudHlwZSkpLCBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKSk7XG4gIH0gZWxzZSBpZiAobWV0YS5kZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSA9PT0gRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkKSB7XG4gICAgY29uc3QgYXJncyA9IFttZXRhLnR5cGUudmFsdWVdO1xuICAgIGlmIChtZXRhLnJhd0ltcG9ydHMpIHtcbiAgICAgIGFyZ3MucHVzaChtZXRhLnJhd0ltcG9ydHMpO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGVwZW5kZW5jaWVzJywgby5pbXBvcnRFeHByKFIzLmdldENvbXBvbmVudERlcHNGYWN0b3J5KS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gbnVsbCkge1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQ7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHlsZU5vZGVzID0gc3R5bGVWYWx1ZXMucmVkdWNlKChyZXN1bHQsIHN0eWxlKSA9PiB7XG4gICAgICBpZiAoc3R5bGUudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmVzdWx0LnB1c2goY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWwoc3R5bGUpKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sIFtdIGFzIG8uRXhwcmVzc2lvbltdKTtcblxuICAgIGlmIChzdHlsZU5vZGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3R5bGVOb2RlcykpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBTZXR0aW5nIGNoYW5nZSBkZXRlY3Rpb24gZmxhZ1xuICBpZiAobWV0YS5jaGFuZ2VEZXRlY3Rpb24gIT09IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIG1ldGEuY2hhbmdlRGV0ZWN0aW9uID09PSAnbnVtYmVyJyAmJlxuICAgICAgICBtZXRhLmNoYW5nZURldGVjdGlvbiAhPT0gY29yZS5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5EZWZhdWx0KSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgcmVzb2x2ZWQgZHVyaW5nIGFuYWx5c2lzLiBPbmx5IHNldCBpdCBpZiBub3QgdGhlIGRlZmF1bHQuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgby5saXRlcmFsKG1ldGEuY2hhbmdlRGV0ZWN0aW9uKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWV0YS5jaGFuZ2VEZXRlY3Rpb24gPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBjaGFuZ2VEZXRlY3Rpb24gaXMgbm90IHJlc29sdmVkIGR1cmluZyBhbmFseXNpcyAoZS5nLiwgd2UgYXJlIGluIGxvY2FsIGNvbXBpbGF0aW9uIG1vZGUpLlxuICAgICAgLy8gU28gcGxhY2UgaXQgYXMgaXMuXG4gICAgICBkZWZpbml0aW9uTWFwLnNldCgnY2hhbmdlRGV0ZWN0aW9uJywgbWV0YS5jaGFuZ2VEZXRlY3Rpb24pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgdHlwZSBzcGVjaWZpY2F0aW9uIGZyb20gdGhlIGNvbXBvbmVudCBtZXRhLiBUaGlzIHR5cGUgaXMgaW5zZXJ0ZWQgaW50byAuZC50cyBmaWxlc1xuICogdG8gYmUgY29uc3VtZWQgYnkgdXBzdHJlYW0gY29tcGlsYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhPFIzVGVtcGxhdGVEZXBlbmRlbmN5Pik6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgdHlwZVBhcmFtcy5wdXNoKHN0cmluZ0FycmF5QXNUeXBlKG1ldGEudGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzKSk7XG4gIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU3RhbmRhbG9uZSkpKTtcbiAgdHlwZVBhcmFtcy5wdXNoKGNyZWF0ZUhvc3REaXJlY3RpdmVzVHlwZShtZXRhKSk7XG4gIC8vIFRPRE8oc2lnbmFscyk6IEFsd2F5cyBpbmNsdWRlIHRoaXMgbWV0YWRhdGEgc3RhcnRpbmcgd2l0aCB2MTcuIFJpZ2h0XG4gIC8vIG5vdyBBbmd1bGFyIHYxNi4wLnggZG9lcyBub3Qgc3VwcG9ydCB0aGlzIGZpZWxkIGFuZCBsaWJyYXJ5IGRpc3RyaWJ1dGlvbnNcbiAgLy8gd291bGQgdGhlbiBiZSBpbmNvbXBhdGlibGUgd2l0aCB2MTYuMC54IGZyYW1ld29yayB1c2Vycy5cbiAgaWYgKG1ldGEuaXNTaWduYWwpIHtcbiAgICB0eXBlUGFyYW1zLnB1c2goby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwobWV0YS5pc1NpZ25hbCkpKTtcbiAgfVxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQ29tcG9uZW50RGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLyoqXG4gKiBDb21waWxlcyB0aGUgYXJyYXkgbGl0ZXJhbCBvZiBkZWNsYXJhdGlvbnMgaW50byBhbiBleHByZXNzaW9uIGFjY29yZGluZyB0byB0aGUgcHJvdmlkZWQgZW1pdFxuICogbW9kZS5cbiAqL1xuZnVuY3Rpb24gY29tcGlsZURlY2xhcmF0aW9uTGlzdChcbiAgICBsaXN0OiBvLkxpdGVyYWxBcnJheUV4cHIsIG1vZGU6IERlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKTogby5FeHByZXNzaW9uIHtcbiAgc3dpdGNoIChtb2RlKSB7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3Q6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBbTXlEaXJdLFxuICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlOlxuICAgICAgLy8gZGlyZWN0aXZlczogZnVuY3Rpb24gKCkgeyByZXR1cm4gW015RGlyXTsgfVxuICAgICAgcmV0dXJuIG8uYXJyb3dGbihbXSwgbGlzdCk7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQ6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbTXlEaXJdLm1hcChuZy5yZXNvbHZlRm9yd2FyZFJlZik7IH1cbiAgICAgIGNvbnN0IHJlc29sdmVkTGlzdCA9IGxpc3QucHJvcCgnbWFwJykuY2FsbEZuKFtvLmltcG9ydEV4cHIoUjMucmVzb2x2ZUZvcndhcmRSZWYpXSk7XG4gICAgICByZXR1cm4gby5hcnJvd0ZuKFtdLCByZXNvbHZlZExpc3QpO1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuUnVudGltZVJlc29sdmVkOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCB3aXRoIGFuIGFycmF5IG9mIHByZS1yZXNvbHZlZCBkZXBlbmRlbmNpZXNgKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0QXR0cmlidXRlc1RvRXhwcmVzc2lvbnMoYXR0cmlidXRlczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259KTpcbiAgICBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWVzO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzTGl0ZXJhbEV4cHJlc3Npb24obWFwOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfHN0cmluZ1tdfSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcblxuICByZXR1cm4gby5saXRlcmFsTWFwKG1hcFZhbHVlcyk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogUmVhZG9ubHlBcnJheTxzdHJpbmd8bnVsbD4pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQmFzZURpcmVjdGl2ZVR5cGVQYXJhbXMobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZVtdIHtcbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IG1ldGEuc2VsZWN0b3IgIT09IG51bGwgPyBtZXRhLnNlbGVjdG9yLnJlcGxhY2UoL1xcbi9nLCAnJykgOiBudWxsO1xuXG4gIHJldHVybiBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzZWxlY3RvckZvclR5cGUgIT09IG51bGwgPyBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSA6IG8uTk9ORV9UWVBFLFxuICAgIG1ldGEuZXhwb3J0QXMgIT09IG51bGwgPyBzdHJpbmdBcnJheUFzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIG8uZXhwcmVzc2lvblR5cGUoZ2V0SW5wdXRzVHlwZUV4cHJlc3Npb24obWV0YSkpLFxuICAgIG8uZXhwcmVzc2lvblR5cGUoc3RyaW5nTWFwQXNMaXRlcmFsRXhwcmVzc2lvbihtZXRhLm91dHB1dHMpKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5wdXRzVHlwZUV4cHJlc3Npb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmxpdGVyYWxNYXAoT2JqZWN0LmtleXMobWV0YS5pbnB1dHMpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gbWV0YS5pbnB1dHNba2V5XTtcbiAgICBjb25zdCB2YWx1ZXMgPSBbXG4gICAgICB7a2V5OiAnYWxpYXMnLCB2YWx1ZTogby5saXRlcmFsKHZhbHVlLmJpbmRpbmdQcm9wZXJ0eU5hbWUpLCBxdW90ZWQ6IHRydWV9LFxuICAgICAge2tleTogJ3JlcXVpcmVkJywgdmFsdWU6IG8ubGl0ZXJhbCh2YWx1ZS5yZXF1aXJlZCksIHF1b3RlZDogdHJ1ZX0sXG4gICAgXTtcblxuICAgIC8vIFRPRE8obGVnYWN5LXBhcnRpYWwtb3V0cHV0LWlucHV0cyk6IENvbnNpZGVyIGFsd2F5cyBlbWl0dGluZyB0aGlzIGluZm9ybWF0aW9uLFxuICAgIC8vIG9yIGxlYXZpbmcgaXQgYXMgaXMuXG4gICAgaWYgKHZhbHVlLmlzU2lnbmFsKSB7XG4gICAgICB2YWx1ZXMucHVzaCh7a2V5OiAnaXNTaWduYWwnLCB2YWx1ZTogby5saXRlcmFsKHZhbHVlLmlzU2lnbmFsKSwgcXVvdGVkOiB0cnVlfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtrZXksIHZhbHVlOiBvLmxpdGVyYWxNYXAodmFsdWVzKSwgcXVvdGVkOiB0cnVlfTtcbiAgfSkpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIHR5cGUgc3BlY2lmaWNhdGlvbiBmcm9tIHRoZSBkaXJlY3RpdmUgbWV0YS4gVGhpcyB0eXBlIGlzIGluc2VydGVkIGludG8gLmQudHMgZmlsZXNcbiAqIHRvIGJlIGNvbnN1bWVkIGJ5IHVwc3RyZWFtIGNvbXBpbGF0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVCYXNlRGlyZWN0aXZlVHlwZVBhcmFtcyhtZXRhKTtcbiAgLy8gRGlyZWN0aXZlcyBoYXZlIG5vIE5nQ29udGVudFNlbGVjdG9ycyBzbG90LCBidXQgaW5zdGVhZCBleHByZXNzIGEgYG5ldmVyYCB0eXBlXG4gIC8vIHNvIHRoYXQgZnV0dXJlIGZpZWxkcyBhbGlnbi5cbiAgdHlwZVBhcmFtcy5wdXNoKG8uTk9ORV9UWVBFKTtcbiAgdHlwZVBhcmFtcy5wdXNoKG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsKG1ldGEuaXNTdGFuZGFsb25lKSkpO1xuICB0eXBlUGFyYW1zLnB1c2goY3JlYXRlSG9zdERpcmVjdGl2ZXNUeXBlKG1ldGEpKTtcbiAgLy8gVE9ETyhzaWduYWxzKTogQWx3YXlzIGluY2x1ZGUgdGhpcyBtZXRhZGF0YSBzdGFydGluZyB3aXRoIHYxNy4gUmlnaHRcbiAgLy8gbm93IEFuZ3VsYXIgdjE2LjAueCBkb2VzIG5vdCBzdXBwb3J0IHRoaXMgZmllbGQgYW5kIGxpYnJhcnkgZGlzdHJpYnV0aW9uc1xuICAvLyB3b3VsZCB0aGVuIGJlIGluY29tcGF0aWJsZSB3aXRoIHYxNi4wLnggZnJhbWV3b3JrIHVzZXJzLlxuICBpZiAobWV0YS5pc1NpZ25hbCkge1xuICAgIHR5cGVQYXJhbXMucHVzaChvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChtZXRhLmlzU2lnbmFsKSkpO1xuICB9XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8uaW1wb3J0RXhwcihSMy5EaXJlY3RpdmVEZWNsYXJhdGlvbiwgdHlwZVBhcmFtcykpO1xufVxuXG4vLyBSZXR1cm4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgIGhvc3RCaW5kaW5nc01ldGFkYXRhOiBSM0hvc3RNZXRhZGF0YSwgdHlwZVNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgc2VsZWN0b3I6IHN0cmluZywgbmFtZTogc3RyaW5nLFxuICAgIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXApOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IGJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhob3N0QmluZGluZ3NNZXRhZGF0YS5wcm9wZXJ0aWVzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgLy8gQ2FsY3VsYXRlIGhvc3QgZXZlbnQgYmluZGluZ3NcbiAgY29uc3QgZXZlbnRCaW5kaW5ncyA9XG4gICAgICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoaG9zdEJpbmRpbmdzTWV0YWRhdGEubGlzdGVuZXJzLCB0eXBlU291cmNlU3Bhbik7XG5cbiAgaWYgKFVTRV9URU1QTEFURV9QSVBFTElORSB8fCBob3N0QmluZGluZ3NNZXRhZGF0YS51c2VUZW1wbGF0ZVBpcGVsaW5lKSB7XG4gICAgLy8gVGhlIHBhcnNlciBmb3IgaG9zdCBiaW5kaW5ncyB0cmVhdHMgY2xhc3MgYW5kIHN0eWxlIGF0dHJpYnV0ZXMgc3BlY2lhbGx5IC0tIHRoZXkgYXJlXG4gICAgLy8gZXh0cmFjdGVkIGludG8gdGhlc2Ugc2VwYXJhdGUgZmllbGRzLiBUaGlzIGlzIG5vdCB0aGUgY2FzZSBmb3IgdGVtcGxhdGVzLCBzbyB0aGUgY29tcGlsZXIgY2FuXG4gICAgLy8gYWN0dWFsbHkgYWxyZWFkeSBoYW5kbGUgdGhlc2Ugc3BlY2lhbCBhdHRyaWJ1dGVzIGludGVybmFsbHkuIFRoZXJlZm9yZSwgd2UganVzdCBkcm9wIHRoZW1cbiAgICAvLyBpbnRvIHRoZSBhdHRyaWJ1dGVzIG1hcC5cbiAgICBpZiAoaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKSB7XG4gICAgICBob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzWydzdHlsZSddID1cbiAgICAgICAgICBvLmxpdGVyYWwoaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyKTtcbiAgICB9XG4gICAgaWYgKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cikge1xuICAgICAgaG9zdEJpbmRpbmdzTWV0YWRhdGEuYXR0cmlidXRlc1snY2xhc3MnXSA9XG4gICAgICAgICAgby5saXRlcmFsKGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0cik7XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdEpvYiA9IGluZ2VzdEhvc3RCaW5kaW5nKFxuICAgICAgICB7XG4gICAgICAgICAgY29tcG9uZW50TmFtZTogbmFtZSxcbiAgICAgICAgICBjb21wb25lbnRTZWxlY3Rvcjogc2VsZWN0b3IsXG4gICAgICAgICAgcHJvcGVydGllczogYmluZGluZ3MsXG4gICAgICAgICAgZXZlbnRzOiBldmVudEJpbmRpbmdzLFxuICAgICAgICAgIGF0dHJpYnV0ZXM6IGhvc3RCaW5kaW5nc01ldGFkYXRhLmF0dHJpYnV0ZXMsXG4gICAgICAgIH0sXG4gICAgICAgIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCk7XG4gICAgdHJhbnNmb3JtKGhvc3RKb2IsIENvbXBpbGF0aW9uSm9iS2luZC5Ib3N0KTtcblxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0QXR0cnMnLCBob3N0Sm9iLnJvb3QuYXR0cmlidXRlcyk7XG5cbiAgICBjb25zdCB2YXJDb3VudCA9IGhvc3RKb2Iucm9vdC52YXJzO1xuICAgIGlmICh2YXJDb3VudCAhPT0gbnVsbCAmJiB2YXJDb3VudCA+IDApIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbCh2YXJDb3VudCkpO1xuICAgIH1cblxuICAgIHJldHVybiBlbWl0SG9zdEJpbmRpbmdGdW5jdGlvbihob3N0Sm9iKTtcbiAgfVxuXG4gIGxldCBiaW5kaW5nSWQgPSAwO1xuICBjb25zdCBnZXROZXh0QmluZGluZ0lkID0gKCkgPT4gYCR7YmluZGluZ0lkKyt9YDtcblxuICBjb25zdCBiaW5kaW5nQ29udGV4dCA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgY29uc3Qgc3R5bGVCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKGJpbmRpbmdDb250ZXh0KTtcblxuICBjb25zdCB7c3R5bGVBdHRyLCBjbGFzc0F0dHJ9ID0gaG9zdEJpbmRpbmdzTWV0YWRhdGEuc3BlY2lhbEF0dHJpYnV0ZXM7XG4gIGlmIChzdHlsZUF0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlQXR0cihzdHlsZUF0dHIpO1xuICB9XG4gIGlmIChjbGFzc0F0dHIgIT09IHVuZGVmaW5lZCkge1xuICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cihjbGFzc0F0dHIpO1xuICB9XG5cbiAgY29uc3QgY3JlYXRlSW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG4gIGNvbnN0IHVwZGF0ZUluc3RydWN0aW9uczogSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICBjb25zdCB1cGRhdGVWYXJpYWJsZXM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBjb25zdCBob3N0QmluZGluZ1NvdXJjZVNwYW4gPSB0eXBlU291cmNlU3BhbjtcbiAgaWYgKGV2ZW50QmluZGluZ3MgJiYgZXZlbnRCaW5kaW5ncy5sZW5ndGgpIHtcbiAgICBjcmVhdGVJbnN0cnVjdGlvbnMucHVzaCguLi5jcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3MsIG5hbWUpKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBhbGxPdGhlckJpbmRpbmdzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG5cbiAgLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIHRvdGFsIGFtb3VudCBvZiBiaW5kaW5nIHNsb3RzIHJlcXVpcmVkIGJ5XG4gIC8vIGFsbCB0aGUgaW5zdHJ1Y3Rpb25zIHRvZ2V0aGVyIGJlZm9yZSBhbnkgdmFsdWUgY29udmVyc2lvbnMgaGFwcGVuLlxuICAvLyBWYWx1ZSBjb252ZXJzaW9ucyBtYXkgcmVxdWlyZSBhZGRpdGlvbmFsIHNsb3RzIGZvciBpbnRlcnBvbGF0aW9uIGFuZFxuICAvLyBiaW5kaW5ncyB3aXRoIHBpcGVzLiBUaGVzZSBjYWxjdWxhdGVzIGhhcHBlbiBhZnRlciB0aGlzIGJsb2NrLlxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gMDtcbiAgYmluZGluZ3MgJiYgYmluZGluZ3MuZm9yRWFjaCgoYmluZGluZzogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKFxuICAgICAgICBiaW5kaW5nLm5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgICBpZiAoc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gTUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWxsT3RoZXJCaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50Kys7XG4gICAgfVxuICB9KTtcblxuICBsZXQgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBjb25zdCBnZXRWYWx1ZUNvbnZlcnRlciA9ICgpID0+IHtcbiAgICBpZiAoIXZhbHVlQ29udmVydGVyKSB7XG4gICAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICAgIH07XG4gICAgICB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCAgLy8gbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICAgICAgICBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTsgIC8vIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlQ29udmVydGVyO1xuICB9O1xuXG4gIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljSG9zdEJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGFsbE90aGVyQmluZGluZ3MpIHtcbiAgICAvLyByZXNvbHZlIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG9iamVjdHNcbiAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdChnZXRWYWx1ZUNvbnZlcnRlcigpKTtcbiAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUsIGdldE5leHRCaW5kaW5nSWQpO1xuXG4gICAgY29uc3Qge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGV9ID0gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nKTtcblxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3IsIGJpbmRpbmdOYW1lLCBpc0F0dHJpYnV0ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBjb3JlLlNlY3VyaXR5Q29udGV4dC5OT05FKTtcblxuICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoKSB7XG4gICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCkgPiAtMSkge1xuICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHNvbWUgVVJMIGF0dHJpYnV0ZXMgKHN1Y2ggYXMgXCJzcmNcIiBhbmQgXCJocmVmXCIpIHRoYXQgbWF5IGJlIGEgcGFydFxuICAgICAgICAvLyBvZiBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW5pdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zID0gW28ubGl0ZXJhbChiaW5kaW5nTmFtZSksIGJpbmRpbmdFeHByLmN1cnJWYWxFeHByXTtcbiAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0XG4gICAgICAvLyBvZiBhbiBhdHRyaWJ1dGUvcHJvcGVydHkgYmluZGluZyAtIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXNcbiAgICAgIC8vIG9uZSBvZiB0aGUgc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMuXG4gICAgICAvLyBOb3RlOiBmb3IgaG9zdCBiaW5kaW5ncyBkZWZpbmVkIG9uIGEgZGlyZWN0aXZlLCB3ZSBkbyBub3QgdHJ5IHRvIGZpbmQgYWxsXG4gICAgICAvLyBwb3NzaWJsZSBwbGFjZXMgd2hlcmUgaXQgY2FuIGJlIG1hdGNoZWQsIHNvIHdlIGNhbiBub3QgZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgIC8vIHRoZSBob3N0IGVsZW1lbnQgaXMgYW4gPGlmcmFtZT4uIEluIHRoaXMgY2FzZSwgaWYgYW4gYXR0cmlidXRlL2JpbmRpbmdcbiAgICAgIC8vIG5hbWUgaXMgaW4gdGhlIGBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTYCBzZXQgLSBhcHBlbmQgYSB2YWxpZGF0aW9uXG4gICAgICAvLyBmdW5jdGlvbiwgd2hpY2ggd291bGQgYmUgaW52b2tlZCBhdCBydW50aW1lIGFuZCB3b3VsZCBoYXZlIGFjY2VzcyB0byB0aGVcbiAgICAgIC8vIHVuZGVybHlpbmcgRE9NIGVsZW1lbnQsIGNoZWNrIGlmIGl0J3MgYW4gPGlmcmFtZT4gYW5kIGlmIHNvIC0gcnVucyBleHRyYSBjaGVja3MuXG4gICAgICBpZiAoaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIoYmluZGluZ05hbWUpKSB7XG4gICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5pbXBvcnRFeHByKFIzLnZhbGlkYXRlSWZyYW1lQXR0cmlidXRlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlVmFyaWFibGVzLnB1c2goLi4uYmluZGluZ0V4cHIuc3RtdHMpO1xuXG4gICAgaWYgKGluc3RydWN0aW9uID09PSBSMy5ob3N0UHJvcGVydHkpIHtcbiAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuYXR0cmlidXRlKSB7XG4gICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKGluc3RydWN0aW9uID09PSBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHkpIHtcbiAgICAgIHN5bnRoZXRpY0hvc3RCaW5kaW5ncy5wdXNoKGluc3RydWN0aW9uUGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogaW5zdHJ1Y3Rpb24sIHBhcmFtc09yRm46IGluc3RydWN0aW9uUGFyYW1zLCBzcGFuOiBudWxsfSk7XG4gICAgfVxuICB9XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nUGFyYW1zIG9mIHByb3BlcnR5QmluZGluZ3MpIHtcbiAgICB1cGRhdGVJbnN0cnVjdGlvbnMucHVzaCh7cmVmZXJlbmNlOiBSMy5ob3N0UHJvcGVydHksIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgYmluZGluZ1BhcmFtcyBvZiBhdHRyaWJ1dGVCaW5kaW5ncykge1xuICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKHtyZWZlcmVuY2U6IFIzLmF0dHJpYnV0ZSwgcGFyYW1zT3JGbjogYmluZGluZ1BhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nUGFyYW1zIG9mIHN5bnRoZXRpY0hvc3RCaW5kaW5ncykge1xuICAgIHVwZGF0ZUluc3RydWN0aW9ucy5wdXNoKFxuICAgICAgICB7cmVmZXJlbmNlOiBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHksIHBhcmFtc09yRm46IGJpbmRpbmdQYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzKTtcbiAgc3R5bGVCdWlsZGVyLmFzc2lnbkhvc3RBdHRycyhob3N0QXR0cnMsIGRlZmluaXRpb25NYXApO1xuXG4gIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3MpIHtcbiAgICAvLyBmaW5hbGx5IGVhY2ggYmluZGluZyB0aGF0IHdhcyByZWdpc3RlcmVkIGluIHRoZSBzdGF0ZW1lbnQgYWJvdmUgd2lsbCBuZWVkIHRvIGJlIGFkZGVkIHRvXG4gICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgIC8vIGFyZSBldmFsdWF0ZWQgYW5kIHVwZGF0ZWQgZm9yIHRoZSBlbGVtZW50LlxuICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKGdldFZhbHVlQ29udmVydGVyKCkpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgZm9yIChjb25zdCBjYWxsIG9mIGluc3RydWN0aW9uLmNhbGxzKSB7XG4gICAgICAgIC8vIHdlIHN1YnRyYWN0IGEgdmFsdWUgb2YgYDFgIGhlcmUgYmVjYXVzZSB0aGUgYmluZGluZyBzbG90IHdhcyBhbHJlYWR5IGFsbG9jYXRlZFxuICAgICAgICAvLyBhdCB0aGUgdG9wIG9mIHRoaXMgbWV0aG9kIHdoZW4gYWxsIHRoZSBpbnB1dCBiaW5kaW5ncyB3ZXJlIGNvdW50ZWQuXG4gICAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPVxuICAgICAgICAgICAgTWF0aC5tYXgoY2FsbC5hbGxvY2F0ZUJpbmRpbmdTbG90cyAtIE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIDApO1xuXG4gICAgICAgIGNvbnN0IHtwYXJhbXMsIHN0bXRzfSA9XG4gICAgICAgICAgICBjb252ZXJ0U3R5bGluZ0NhbGwoY2FsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbiwgZ2V0TmV4dEJpbmRpbmdJZCk7XG4gICAgICAgIHVwZGF0ZVZhcmlhYmxlcy5wdXNoKC4uLnN0bXRzKTtcbiAgICAgICAgdXBkYXRlSW5zdHJ1Y3Rpb25zLnB1c2goe1xuICAgICAgICAgIHJlZmVyZW5jZTogaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLFxuICAgICAgICAgIHBhcmFtc09yRm46IHBhcmFtcyxcbiAgICAgICAgICBzcGFuOiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b3RhbEhvc3RWYXJzQ291bnQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdFZhcnMnLCBvLmxpdGVyYWwodG90YWxIb3N0VmFyc0NvdW50KSk7XG4gIH1cblxuICBpZiAoY3JlYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDAgfHwgdXBkYXRlSW5zdHJ1Y3Rpb25zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVJbnN0cnVjdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKGNyZWF0ZUluc3RydWN0aW9ucykpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZUluc3RydWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLFxuICAgICAgICAgIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQoZ2V0SW5zdHJ1Y3Rpb25TdGF0ZW1lbnRzKHVwZGF0ZUluc3RydWN0aW9ucykpKSk7XG4gICAgfVxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLCBzdGF0ZW1lbnRzLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIGhvc3RCaW5kaW5nc0ZuTmFtZSk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gYmluZGluZ0ZuKGltcGxpY2l0OiBhbnksIHZhbHVlOiBBU1QsIGdldE5leHRCaW5kaW5nSWRGbjogKCkgPT4gc3RyaW5nKSB7XG4gIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKG51bGwsIGltcGxpY2l0LCB2YWx1ZSwgZ2V0TmV4dEJpbmRpbmdJZEZuKCkpO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0U3R5bGluZ0NhbGwoXG4gICAgY2FsbDogU3R5bGluZ0luc3RydWN0aW9uQ2FsbCwgYmluZGluZ0NvbnRleHQ6IGFueSwgYmluZGluZ0ZuOiBGdW5jdGlvbixcbiAgICBnZXROZXh0QmluZGluZ0lkRm46ICgpID0+IHN0cmluZykge1xuICBjb25zdCBzdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCBwYXJhbXMgPSBjYWxsLnBhcmFtcyh2YWx1ZSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYmluZGluZ0ZuKGJpbmRpbmdDb250ZXh0LCB2YWx1ZSwgZ2V0TmV4dEJpbmRpbmdJZEZuKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQuc3RtdHMpICYmIHJlc3VsdC5zdG10cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdG10cy5wdXNoKC4uLnJlc3VsdC5zdG10cyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQuY3VyclZhbEV4cHI7XG4gIH0pO1xuICByZXR1cm4ge3BhcmFtcywgc3RtdHN9O1xufVxuXG5mdW5jdGlvbiBnZXRCaW5kaW5nTmFtZUFuZEluc3RydWN0aW9uKGJpbmRpbmc6IFBhcnNlZFByb3BlcnR5KTpcbiAgICB7YmluZGluZ05hbWU6IHN0cmluZywgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGlzQXR0cmlidXRlOiBib29sZWFufSB7XG4gIGxldCBiaW5kaW5nTmFtZSA9IGJpbmRpbmcubmFtZTtcbiAgbGV0IGluc3RydWN0aW9uITogby5FeHRlcm5hbFJlZmVyZW5jZTtcblxuICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBpcyBhbiBhdHRyIGJpbmRpbmcgb3IgYSBwcm9wZXJ0eSBiaW5kaW5nXG4gIGNvbnN0IGF0dHJNYXRjaGVzID0gYmluZGluZ05hbWUubWF0Y2goQVRUUl9SRUdFWCk7XG4gIGlmIChhdHRyTWF0Y2hlcykge1xuICAgIGJpbmRpbmdOYW1lID0gYXR0ck1hdGNoZXNbMV07XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5hdHRyaWJ1dGU7XG4gIH0gZWxzZSB7XG4gICAgaWYgKGJpbmRpbmcuaXNBbmltYXRpb24pIHtcbiAgICAgIGJpbmRpbmdOYW1lID0gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShiaW5kaW5nTmFtZSk7XG4gICAgICAvLyBob3N0IGJpbmRpbmdzIHRoYXQgaGF2ZSBhIHN5bnRoZXRpYyBwcm9wZXJ0eSAoZS5nLiBAZm9vKSBzaG91bGQgYWx3YXlzIGJlIHJlbmRlcmVkXG4gICAgICAvLyBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcG9uZW50IGFuZCBub3QgdGhlIHBhcmVudC4gVGhlcmVmb3JlIHRoZXJlIGlzIGEgc3BlY2lhbFxuICAgICAgLy8gY29tcGF0aWJpbGl0eSBpbnN0cnVjdGlvbiBhdmFpbGFibGUgZm9yIHRoaXMgcHVycG9zZS5cbiAgICAgIGluc3RydWN0aW9uID0gUjMuc3ludGhldGljSG9zdFByb3BlcnR5O1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnN0cnVjdGlvbiA9IFIzLmhvc3RQcm9wZXJ0eTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGU6ICEhYXR0ck1hdGNoZXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sIG5hbWU/OiBzdHJpbmcpOiBJbnN0cnVjdGlvbltdIHtcbiAgY29uc3QgbGlzdGVuZXJQYXJhbXM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljTGlzdGVuZXJQYXJhbXM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgaW5zdHJ1Y3Rpb25zOiBJbnN0cnVjdGlvbltdID0gW107XG5cbiAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGV2ZW50QmluZGluZ3MpIHtcbiAgICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IGJpbmRpbmcudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShiaW5kaW5nTmFtZSwgYmluZGluZy50YXJnZXRPclBoYXNlKSA6XG4gICAgICAgIGJpbmRpbmdOYW1lO1xuICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gbmFtZSAmJiBiaW5kaW5nTmFtZSA/IGAke25hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKEJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGJpbmRpbmcpLCBoYW5kbGVyTmFtZSk7XG5cbiAgICBpZiAoYmluZGluZy50eXBlID09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zLnB1c2gocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdGVuZXJQYXJhbXMucHVzaChwYXJhbXMpO1xuICAgIH1cbiAgfVxuXG4gIGZvciAoY29uc3QgcGFyYW1zIG9mIHN5bnRoZXRpY0xpc3RlbmVyUGFyYW1zKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMuc3ludGhldGljSG9zdExpc3RlbmVyLCBwYXJhbXNPckZuOiBwYXJhbXMsIHNwYW46IG51bGx9KTtcbiAgfVxuXG4gIGZvciAoY29uc3QgcGFyYW1zIG9mIGxpc3RlbmVyUGFyYW1zKSB7XG4gICAgaW5zdHJ1Y3Rpb25zLnB1c2goe3JlZmVyZW5jZTogUjMubGlzdGVuZXIsIHBhcmFtc09yRm46IHBhcmFtcywgc3BhbjogbnVsbH0pO1xuICB9XG5cbiAgcmV0dXJuIGluc3RydWN0aW9ucztcbn1cblxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSQvO1xuLy8gUmVwcmVzZW50cyB0aGUgZ3JvdXBzIGluIHRoZSBhYm92ZSByZWdleC5cbmNvbnN0IGVudW0gSG9zdEJpbmRpbmdHcm91cCB7XG4gIC8vIGdyb3VwIDE6IFwicHJvcFwiIGZyb20gXCJbcHJvcF1cIiwgb3IgXCJhdHRyLnJvbGVcIiBmcm9tIFwiW2F0dHIucm9sZV1cIiwgb3IgQGFuaW0gZnJvbSBbQGFuaW1dXG4gIEJpbmRpbmcgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcbn1cblxuLy8gRGVmaW5lcyBIb3N0IEJpbmRpbmdzIHN0cnVjdHVyZSB0aGF0IGNvbnRhaW5zIGF0dHJpYnV0ZXMsIGxpc3RlbmVycywgYW5kIHByb3BlcnRpZXMsXG4vLyBwYXJzZWQgZnJvbSB0aGUgYGhvc3RgIG9iamVjdCBkZWZpbmVkIGZvciBhIFR5cGUuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259O1xuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgc3BlY2lhbEF0dHJpYnV0ZXM6IHtzdHlsZUF0dHI/OiBzdHJpbmc7IGNsYXNzQXR0cj86IHN0cmluZzt9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ3xvLkV4cHJlc3Npb259KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO30gPSB7fTtcblxuICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhob3N0KSkge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcblxuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKGtleSkge1xuICAgICAgICBjYXNlICdjbGFzcyc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2xhc3MgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5jbGFzc0F0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3BlY2lhbEF0dHJpYnV0ZXMuc3R5bGVBdHRyID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IG8ubGl0ZXJhbCh2YWx1ZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgLy8gc3ludGhldGljIHByb3BlcnRpZXMgKHRoZSBvbmVzIHRoYXQgaGF2ZSBhIGBAYCBhcyBhIHByZWZpeClcbiAgICAgIC8vIGFyZSBzdGlsbCB0cmVhdGVkIHRoZSBzYW1lIGFzIHJlZ3VsYXIgcHJvcGVydGllcy4gVGhlcmVmb3JlXG4gICAgICAvLyB0aGVyZSBpcyBubyBwb2ludCBpbiBzdG9yaW5nIHRoZW0gaW4gYSBzZXBhcmF0ZSBtYXAuXG4gICAgICBwcm9wZXJ0aWVzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5CaW5kaW5nXV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IGJpbmRpbmcgbXVzdCBiZSBzdHJpbmdgKTtcbiAgICAgIH1cbiAgICAgIGxpc3RlbmVyc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuRXZlbnRdXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YXR0cmlidXRlcywgbGlzdGVuZXJzLCBwcm9wZXJ0aWVzLCBzcGVjaWFsQXR0cmlidXRlc307XG59XG5cbi8qKlxuICogVmVyaWZpZXMgaG9zdCBiaW5kaW5ncyBhbmQgcmV0dXJucyB0aGUgbGlzdCBvZiBlcnJvcnMgKGlmIGFueSkuIEVtcHR5IGFycmF5IGluZGljYXRlcyB0aGF0IGFcbiAqIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzIGhhcyBubyBlcnJvcnMuXG4gKlxuICogQHBhcmFtIGJpbmRpbmdzIHNldCBvZiBob3N0IGJpbmRpbmdzIHRvIHZlcmlmeS5cbiAqIEBwYXJhbSBzb3VyY2VTcGFuIHNvdXJjZSBzcGFuIHdoZXJlIGhvc3QgYmluZGluZ3Mgd2VyZSBkZWZpbmVkLlxuICogQHJldHVybnMgYXJyYXkgb2YgZXJyb3JzIGFzc29jaWF0ZWQgd2l0aCBhIGdpdmVuIHNldCBvZiBob3N0IGJpbmRpbmdzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmVyaWZ5SG9zdEJpbmRpbmdzKFxuICAgIGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3MsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IFBhcnNlRXJyb3JbXSB7XG4gIC8vIFRPRE86IGFic3RyYWN0IG91dCBob3N0IGJpbmRpbmdzIHZlcmlmaWNhdGlvbiBsb2dpYyBhbmQgdXNlIGl0IGluc3RlYWQgb2ZcbiAgLy8gY3JlYXRpbmcgZXZlbnRzIGFuZCBwcm9wZXJ0aWVzIEFTVHMgdG8gZGV0ZWN0IGVycm9ycyAoRlctOTk2KVxuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcbiAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGJpbmRpbmdzLmxpc3RlbmVycywgc291cmNlU3Bhbik7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhiaW5kaW5ncy5wcm9wZXJ0aWVzLCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGJpbmRpbmdQYXJzZXIuZXJyb3JzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHtcbiAgICByZXR1cm4gc2hhZG93Q3NzIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gIH0pO1xufVxuXG4vKipcbiAqIEVuY2Fwc3VsYXRlcyBhIENTUyBzdHlsZXNoZWV0IHdpdGggZW11bGF0ZWQgdmlldyBlbmNhcHN1bGF0aW9uLlxuICogVGhpcyBhbGxvd3MgYSBzdHlsZXNoZWV0IHRvIGJlIHVzZWQgd2l0aCBhbiBBbmd1bGFyIGNvbXBvbmVudCB0aGF0XG4gKiBpcyB1c2luZyB0aGUgYFZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkYCBtb2RlLlxuICpcbiAqIEBwYXJhbSBzdHlsZSBUaGUgY29udGVudCBvZiBhIENTUyBzdHlsZXNoZWV0LlxuICogQHJldHVybnMgVGhlIGVuY2Fwc3VsYXRlZCBjb250ZW50IGZvciB0aGUgc3R5bGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNhcHN1bGF0ZVN0eWxlKHN0eWxlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzaGFkb3dDc3Muc2hpbUNzc1RleHQoc3R5bGUsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdERpcmVjdGl2ZXNUeXBlKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlR5cGUge1xuICBpZiAoIW1ldGEuaG9zdERpcmVjdGl2ZXM/Lmxlbmd0aCkge1xuICAgIHJldHVybiBvLk5PTkVfVFlQRTtcbiAgfVxuXG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihtZXRhLmhvc3REaXJlY3RpdmVzLm1hcChob3N0TWV0YSA9PiBvLmxpdGVyYWxNYXAoW1xuICAgIHtrZXk6ICdkaXJlY3RpdmUnLCB2YWx1ZTogby50eXBlb2ZFeHByKGhvc3RNZXRhLmRpcmVjdGl2ZS50eXBlKSwgcXVvdGVkOiBmYWxzZX0sXG4gICAge2tleTogJ2lucHV0cycsIHZhbHVlOiBzdHJpbmdNYXBBc0xpdGVyYWxFeHByZXNzaW9uKGhvc3RNZXRhLmlucHV0cyB8fCB7fSksIHF1b3RlZDogZmFsc2V9LFxuICAgIHtrZXk6ICdvdXRwdXRzJywgdmFsdWU6IHN0cmluZ01hcEFzTGl0ZXJhbEV4cHJlc3Npb24oaG9zdE1ldGEub3V0cHV0cyB8fCB7fSksIHF1b3RlZDogZmFsc2V9LFxuICBdKSkpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdERpcmVjdGl2ZXNGZWF0dXJlQXJnKFxuICAgIGhvc3REaXJlY3RpdmVzOiBOb25OdWxsYWJsZTxSM0RpcmVjdGl2ZU1ldGFkYXRhWydob3N0RGlyZWN0aXZlcyddPik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGV4cHJlc3Npb25zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBsZXQgaGFzRm9yd2FyZFJlZiA9IGZhbHNlO1xuXG4gIGZvciAoY29uc3QgY3VycmVudCBvZiBob3N0RGlyZWN0aXZlcykge1xuICAgIC8vIFVzZSBhIHNob3J0aGFuZCBpZiB0aGVyZSBhcmUgbm8gaW5wdXRzIG9yIG91dHB1dHMuXG4gICAgaWYgKCFjdXJyZW50LmlucHV0cyAmJiAhY3VycmVudC5vdXRwdXRzKSB7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGN1cnJlbnQuZGlyZWN0aXZlLnR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBrZXlzID0gW3trZXk6ICdkaXJlY3RpdmUnLCB2YWx1ZTogY3VycmVudC5kaXJlY3RpdmUudHlwZSwgcXVvdGVkOiBmYWxzZX1dO1xuXG4gICAgICBpZiAoY3VycmVudC5pbnB1dHMpIHtcbiAgICAgICAgY29uc3QgaW5wdXRzTGl0ZXJhbCA9IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQuaW5wdXRzKTtcbiAgICAgICAgaWYgKGlucHV0c0xpdGVyYWwpIHtcbiAgICAgICAgICBrZXlzLnB1c2goe2tleTogJ2lucHV0cycsIHZhbHVlOiBpbnB1dHNMaXRlcmFsLCBxdW90ZWQ6IGZhbHNlfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGN1cnJlbnQub3V0cHV0cykge1xuICAgICAgICBjb25zdCBvdXRwdXRzTGl0ZXJhbCA9IGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KGN1cnJlbnQub3V0cHV0cyk7XG4gICAgICAgIGlmIChvdXRwdXRzTGl0ZXJhbCkge1xuICAgICAgICAgIGtleXMucHVzaCh7a2V5OiAnb3V0cHV0cycsIHZhbHVlOiBvdXRwdXRzTGl0ZXJhbCwgcXVvdGVkOiBmYWxzZX0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGV4cHJlc3Npb25zLnB1c2goby5saXRlcmFsTWFwKGtleXMpKTtcbiAgICB9XG5cbiAgICBpZiAoY3VycmVudC5pc0ZvcndhcmRSZWZlcmVuY2UpIHtcbiAgICAgIGhhc0ZvcndhcmRSZWYgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIC8vIElmIHRoZXJlJ3MgYSBmb3J3YXJkIHJlZmVyZW5jZSwgd2UgZ2VuZXJhdGUgYSBgZnVuY3Rpb24oKSB7IHJldHVybiBbSG9zdERpcl0gfWAsXG4gIC8vIG90aGVyd2lzZSB3ZSBjYW4gc2F2ZSBzb21lIGJ5dGVzIGJ5IHVzaW5nIGEgcGxhaW4gYXJyYXksIGUuZy4gYFtIb3N0RGlyXWAuXG4gIHJldHVybiBoYXNGb3J3YXJkUmVmID9cbiAgICAgIG5ldyBvLkZ1bmN0aW9uRXhwcihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChvLmxpdGVyYWxBcnIoZXhwcmVzc2lvbnMpKV0pIDpcbiAgICAgIG8ubGl0ZXJhbEFycihleHByZXNzaW9ucyk7XG59XG5cbi8qKlxuICogQ29udmVydHMgYW4gaW5wdXQvb3V0cHV0IG1hcHBpbmcgb2JqZWN0IGxpdGVyYWwgaW50byBhbiBhcnJheSB3aGVyZSB0aGUgZXZlbiBrZXlzIGFyZSB0aGVcbiAqIHB1YmxpYyBuYW1lIG9mIHRoZSBiaW5kaW5nIGFuZCB0aGUgb2RkIG9uZXMgYXJlIHRoZSBuYW1lIGl0IHdhcyBhbGlhc2VkIHRvLiBFLmcuXG4gKiBge2lucHV0T25lOiAnYWxpYXNPbmUnLCBpbnB1dFR3bzogJ2FsaWFzVHdvJ31gIHdpbGwgYmVjb21lXG4gKiBgWydpbnB1dE9uZScsICdhbGlhc09uZScsICdpbnB1dFR3bycsICdhbGlhc1R3byddYC5cbiAqXG4gKiBUaGlzIGNvbnZlcnNpb24gaXMgbmVjZXNzYXJ5LCBiZWNhdXNlIGhvc3RzIGJpbmQgdG8gdGhlIHB1YmxpYyBuYW1lIG9mIHRoZSBob3N0IGRpcmVjdGl2ZSBhbmRcbiAqIGtlZXBpbmcgdGhlIG1hcHBpbmcgaW4gYW4gb2JqZWN0IGxpdGVyYWwgd2lsbCBicmVhayBmb3IgYXBwcyB1c2luZyBwcm9wZXJ0eSByZW5hbWluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhvc3REaXJlY3RpdmVzTWFwcGluZ0FycmF5KG1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOlxuICAgIG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgY29uc3QgZWxlbWVudHM6IG8uTGl0ZXJhbEV4cHJbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgcHVibGljTmFtZSBpbiBtYXBwaW5nKSB7XG4gICAgaWYgKG1hcHBpbmcuaGFzT3duUHJvcGVydHkocHVibGljTmFtZSkpIHtcbiAgICAgIGVsZW1lbnRzLnB1c2goby5saXRlcmFsKHB1YmxpY05hbWUpLCBvLmxpdGVyYWwobWFwcGluZ1twdWJsaWNOYW1lXSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBlbGVtZW50cy5sZW5ndGggPiAwID8gby5saXRlcmFsQXJyKGVsZW1lbnRzKSA6IG51bGw7XG59XG4iXX0=