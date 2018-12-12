/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, convertActionBinding, convertPropertyBinding } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { LifecycleHooks } from '../../lifecycle_reflector';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import * as o from '../../output/output_ast';
import { typeSourceSpan } from '../../parse_util';
import { CssSelector, SelectorMatcher } from '../../selector';
import { ShadowCss } from '../../shadow_css';
import { CONTENT_ATTR, HOST_ATTR } from '../../style_compiler';
import { error } from '../../util';
import { compileFactoryFunction, dependenciesFromGlobalMetadata } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { typeWithParameters } from '../util';
import { StylingBuilder } from './styling';
import { BindingScope, TemplateDefinitionBuilder, ValueConverter, renderFlagCheckIfStmt } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
const EMPTY_ARRAY = [];
// This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
// If there is a match, the first matching group will contain the attribute name to bind.
const ATTR_REGEX = /attr\.([^\]]+)/;
function getStylingPrefix(propName) {
    return propName.substring(0, 5).toLowerCase();
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
    definitionMap.set('contentQueries', createContentQueriesFunction(meta, constantPool));
    definitionMap.set('contentQueriesRefresh', createContentQueriesRefreshFunction(meta));
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
    const allOtherAttributes = {};
    const attrNames = Object.getOwnPropertyNames(meta.host.attributes);
    for (let i = 0; i < attrNames.length; i++) {
        const attr = attrNames[i];
        const value = meta.host.attributes[attr];
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
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', o.literal(meta.exportAs));
    }
    return { definitionMap, statements: result.statements };
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
    const { definitionMap, statements } = baseDirectiveFields(meta, constantPool, bindingParser);
    addFeatures(definitionMap, meta);
    const expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    const selectorForType = (meta.selector || '').replace(/\n/g, '');
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
    if (meta.viewQueries.length) {
        definitionMap.set('viewQuery', createViewQueriesFunction(meta, constantPool));
    }
    // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
    const templateTypeName = meta.name;
    const templateName = templateTypeName ? `${templateTypeName}_Template` : null;
    const directivesUsed = new Set();
    const pipesUsed = new Set();
    const template = meta.template;
    const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, null, null, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
    const templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
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
    const summary = directive.toSummary();
    const name = identifierName(directive.type);
    name || error(`Cannot resolver the name of ${directive.type}`);
    return {
        name,
        type: outputCtx.importExpr(directive.type.reference),
        typeArgumentCount: 0,
        typeSourceSpan: typeSourceSpan(directive.isComponent ? 'Component' : 'Directive', directive.type),
        selector: directive.selector,
        deps: dependenciesFromGlobalMetadata(directive.type, outputCtx, reflector),
        queries: queriesFromGlobalMetadata(directive.queries, outputCtx),
        lifecycle: {
            usesOnChanges: directive.type.lifecycleHooks.some(lifecycle => lifecycle == LifecycleHooks.OnChanges),
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
function createQueryDefinition(query, constantPool, idx) {
    const predicate = getQueryPredicate(query, constantPool);
    // e.g. r3.query(null, somePredicate, false) or r3.query(0, ['div'], false)
    const parameters = [
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
    const values = [];
    for (let key of Object.getOwnPropertyNames(attributes)) {
        const value = attributes[key];
        values.push(o.literal(key), o.literal(value));
    }
    if (values.length > 0) {
        return o.literalArr(values);
    }
    return null;
}
// Return a contentQueries function or null if one is not necessary.
function createContentQueriesFunction(meta, constantPool) {
    if (meta.queries.length) {
        const statements = meta.queries.map((query) => {
            const queryDefinition = createQueryDefinition(query, constantPool, null);
            return o.importExpr(R3.registerContentQuery)
                .callFn([queryDefinition, o.variable('dirIndex')])
                .toStmt();
        });
        const typeName = meta.name;
        const parameters = [new o.FnParam('dirIndex', o.NUMBER_TYPE)];
        return o.fn(parameters, statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_ContentQueries` : null);
    }
    return null;
}
// Return a contentQueriesRefresh function or null if one is not necessary.
function createContentQueriesRefreshFunction(meta) {
    if (meta.queries.length > 0) {
        const statements = [];
        const typeName = meta.name;
        const parameters = [
            new o.FnParam('dirIndex', o.NUMBER_TYPE),
            new o.FnParam('queryStartIndex', o.NUMBER_TYPE),
        ];
        const directiveInstanceVar = o.variable('instance');
        // var $tmp$: any;
        const temporary = temporaryAllocator(statements, TEMPORARY_NAME);
        // const $instance$ = $r3$.ɵload(dirIndex);
        statements.push(directiveInstanceVar.set(o.importExpr(R3.load).callFn([o.variable('dirIndex')]))
            .toDeclStmt(o.INFERRED_TYPE, [o.StmtModifier.Final]));
        meta.queries.forEach((query, idx) => {
            const loadQLArg = o.variable('queryStartIndex');
            const getQueryList = o.importExpr(R3.loadQueryList).callFn([
                idx > 0 ? loadQLArg.plus(o.literal(idx)) : loadQLArg
            ]);
            const assignToTemporary = temporary().set(getQueryList);
            const callQueryRefresh = o.importExpr(R3.queryRefresh).callFn([assignToTemporary]);
            const updateDirective = directiveInstanceVar.prop(query.propertyName)
                .set(query.first ? temporary().prop('first') : temporary());
            const refreshQueryAndUpdateDirective = callQueryRefresh.and(updateDirective);
            statements.push(refreshQueryAndUpdateDirective.toStmt());
        });
        return o.fn(parameters, statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_ContentQueriesRefresh` : null);
    }
    return null;
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
        meta.exportAs !== null ? stringAsType(meta.exportAs) : o.NONE_TYPE,
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
    for (let i = 0; i < meta.viewQueries.length; i++) {
        const query = meta.viewQueries[i];
        // creation, e.g. r3.Q(0, somePredicate, true);
        const queryDefinition = createQueryDefinition(query, constantPool, i);
        createStatements.push(queryDefinition.toStmt());
        // update, e.g. (r3.qR(tmp = r3.ɵload(0)) && (ctx.someDir = tmp));
        const temporary = tempAllocator();
        const getQueryList = o.importExpr(R3.load).callFn([o.literal(i)]);
        const refresh = o.importExpr(R3.queryRefresh).callFn([temporary.set(getQueryList)]);
        const updateDirective = o.variable(CONTEXT_NAME)
            .prop(query.propertyName)
            .set(query.first ? temporary.prop('first') : temporary);
        updateStatements.push(refresh.and(updateDirective).toStmt());
    }
    const viewQueryFnName = meta.name ? `${meta.name}_Query` : null;
    return o.fn([new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], [
        renderFlagCheckIfStmt(1 /* Create */, createStatements),
        renderFlagCheckIfStmt(2 /* Update */, updateStatements)
    ], o.INFERRED_TYPE, null, viewQueryFnName);
}
// Return a host binding function or null if one is not necessary.
function createHostBindingsFunction(meta, elVarExp, bindingContext, styleBuilder, bindingParser, constantPool, hostVarsCount) {
    const createStatements = [];
    const updateStatements = [];
    let totalHostVarsCount = hostVarsCount;
    const hostBindingSourceSpan = meta.typeSourceSpan;
    const directiveSummary = metadataAsSummary(meta);
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings && eventBindings.length) {
        const listeners = createHostListeners(bindingContext, eventBindings, meta);
        createStatements.push(...listeners);
    }
    // Calculate the host property bindings
    const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    const bindingFn = (implicit, value) => {
        return convertPropertyBinding(null, implicit, value, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
    };
    if (bindings) {
        const hostVarsCountFn = (numSlots) => {
            const originalVarsCount = totalHostVarsCount;
            totalHostVarsCount += numSlots;
            return originalVarsCount;
        };
        const valueConverter = new ValueConverter(constantPool, 
        /* new nodes are illegal here */ () => error('Unexpected node'), hostVarsCountFn, 
        /* pipes are illegal here */ () => error('Unexpected pipe'));
        for (const binding of bindings) {
            const name = binding.name;
            const stylePrefix = getStylingPrefix(name);
            if (stylePrefix === 'style') {
                const { propertyName, unit } = parseNamedProperty(name);
                styleBuilder.registerStyleInput(propertyName, binding.expression, unit, binding.sourceSpan);
            }
            else if (stylePrefix === 'class') {
                styleBuilder.registerClassInput(parseNamedProperty(name).propertyName, binding.expression, binding.sourceSpan);
            }
            else {
                // resolve literal arrays and literal objects
                const value = binding.expression.visit(valueConverter);
                const bindingExpr = bindingFn(bindingContext, value);
                const { bindingName, instruction, extraParams } = getBindingNameAndInstruction(name);
                const instructionParams = [
                    elVarExp, o.literal(bindingName), o.importExpr(R3.bind).callFn([bindingExpr.currValExpr])
                ];
                updateStatements.push(...bindingExpr.stmts);
                updateStatements.push(o.importExpr(instruction).callFn(instructionParams.concat(extraParams)).toStmt());
            }
        }
        if (styleBuilder.hasBindingsOrInitialValues) {
            const createInstruction = styleBuilder.buildCreateLevelInstruction(null, constantPool);
            if (createInstruction) {
                const createStmt = createStylingStmt(createInstruction, bindingContext, bindingFn);
                createStatements.push(createStmt);
            }
            styleBuilder.buildUpdateLevelInstructions(valueConverter).forEach(instruction => {
                const updateStmt = createStylingStmt(instruction, bindingContext, bindingFn);
                updateStatements.push(updateStmt);
            });
        }
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
function createStylingStmt(instruction, bindingContext, bindingFn) {
    const params = instruction.buildParams(value => bindingFn(bindingContext, value).currValExpr);
    return o.importExpr(instruction.reference, null, instruction.sourceSpan)
        .callFn(params, instruction.sourceSpan)
        .toStmt();
}
function getBindingNameAndInstruction(bindingName) {
    let instruction;
    const extraParams = [];
    // Check to see if this is an attr binding or a property binding
    const attrMatches = bindingName.match(ATTR_REGEX);
    if (attrMatches) {
        bindingName = attrMatches[1];
        instruction = R3.elementAttribute;
    }
    else {
        instruction = R3.elementProperty;
        extraParams.push(o.literal(null), // TODO: This should be a sanitizer fn (FW-785)
        o.literal(true) // host bindings must have nativeOnly prop set to true
        );
    }
    return { bindingName, instruction, extraParams };
}
function createHostListeners(bindingContext, eventBindings, meta) {
    return eventBindings.map(binding => {
        const bindingExpr = convertActionBinding(null, bindingContext, binding.handler, 'b', () => error('Unexpected interpolation'));
        const bindingName = binding.name && sanitizeIdentifier(binding.name);
        const typeName = meta.name;
        const functionName = typeName && bindingName ? `${typeName}_${bindingName}_HostBindingHandler` : null;
        const handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], [...bindingExpr.render3Stmts], o.INFERRED_TYPE, null, functionName);
        return o.importExpr(R3.listener).callFn([o.literal(binding.name), handler]).toStmt();
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
    const entries = Array.from(map).map(([key, type]) => [key, outputCtx.importExpr(type)]);
    return new Map(entries);
}
const HOST_REG_EXP = /^(?:(?:\[([^\]]+)\])|(?:\(([^\)]+)\)))|(\@[-\w]+)$/;
export function parseHostBindings(host) {
    const attributes = {};
    const listeners = {};
    const properties = {};
    const animations = {};
    Object.keys(host).forEach(key => {
        const value = host[key];
        const matches = key.match(HOST_REG_EXP);
        if (matches === null) {
            attributes[key] = value;
        }
        else if (matches[1 /* Binding */] != null) {
            properties[matches[1 /* Binding */]] = value;
        }
        else if (matches[2 /* Event */] != null) {
            listeners[matches[2 /* Event */]] = value;
        }
        else if (matches[3 /* Animation */] != null) {
            animations[matches[3 /* Animation */]] = value;
        }
    });
    return { attributes, listeners, properties, animations };
}
function compileStyles(styles, selector, hostSelector) {
    const shadowCss = new ShadowCss();
    return styles.map(style => { return shadowCss.shimCssText(style, selector, hostSelector); });
}
function parseNamedProperty(name) {
    let unit = '';
    let propertyName = '';
    const index = name.indexOf('.');
    if (index > 0) {
        const unitIndex = name.lastIndexOf('.');
        if (unitIndex !== index) {
            unit = name.substring(unitIndex + 1, name.length);
            propertyName = name.substring(index + 1, unitIndex);
        }
        else {
            propertyName = name.substring(index + 1, name.length);
        }
    }
    return { propertyName, unit };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBZ0csY0FBYyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFDLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRW5ILE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRixPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzVELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBRTdELE9BQU8sRUFBZ0IsS0FBSyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNyRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUczQyxPQUFPLEVBQUMsY0FBYyxFQUFxQixNQUFNLFdBQVcsQ0FBQztBQUM3RCxPQUFPLEVBQUMsWUFBWSxFQUFFLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxxQkFBcUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUMxRyxPQUFPLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxtQ0FBbUMsRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUV4SyxNQUFNLFdBQVcsR0FBVSxFQUFFLENBQUM7QUFFOUIsNkZBQTZGO0FBQzdGLHlGQUF5RjtBQUN6RixNQUFNLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQztBQUVwQyxTQUFTLGdCQUFnQixDQUFDLFFBQWdCO0lBQ3hDLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDaEQsQ0FBQztBQUVELFNBQVMsbUJBQW1CLENBQ3hCLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztJQUUxQywyQkFBMkI7SUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXJDLDBDQUEwQztJQUMxQyxhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUd2RSwrREFBK0Q7SUFDL0QsTUFBTSxNQUFNLEdBQUcsc0JBQXNCLENBQUM7UUFDcEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsUUFBUSxFQUFFLEVBQUUsQ0FBQyxlQUFlO0tBQzdCLENBQUMsQ0FBQztJQUNILGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUU3QyxhQUFhLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLDRCQUE0QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBRXRGLGFBQWEsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLEVBQUUsbUNBQW1DLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUV0Rix3RkFBd0Y7SUFDeEYseUZBQXlGO0lBQ3pGLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7U0FDNUIsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2IsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEMsT0FBTyxNQUFNLEtBQUssT0FBTyxJQUFJLE1BQU0sS0FBSyxPQUFPLENBQUM7SUFDbEQsQ0FBQyxDQUFDO1NBQ0QsTUFBTSxDQUFDO0lBRWxDLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDdkMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMvQyxNQUFNLFlBQVksR0FBRyxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFakUsTUFBTSxrQkFBa0IsR0FBUSxFQUFFLENBQUM7SUFDbkMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDekMsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pDLFFBQVEsSUFBSSxFQUFFO1lBQ1osc0RBQXNEO1lBQ3RELEtBQUssT0FBTztnQkFDVixZQUFZLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RDLE1BQU07WUFDUixzREFBc0Q7WUFDdEQsS0FBSyxPQUFPO2dCQUNWLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsTUFBTTtZQUNSO2dCQUNFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFDakMsTUFBTTtTQUNUO0tBQ0Y7SUFFRCx5Q0FBeUM7SUFDekMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUseUJBQXlCLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBRS9FLG9EQUFvRDtJQUNwRCxhQUFhLENBQUMsR0FBRyxDQUNiLGNBQWMsRUFDZCwwQkFBMEIsQ0FDdEIsSUFBSSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUVsRyx5QkFBeUI7SUFDekIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsbUNBQW1DLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFOUUsMEJBQTBCO0lBQzFCLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRWhGLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7UUFDMUIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUN6RDtJQUVELE9BQU8sRUFBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVcsQ0FDaEIsYUFBNEIsRUFBRSxJQUErQztJQUMvRSx3Q0FBd0M7SUFDeEMsTUFBTSxRQUFRLEdBQW1CLEVBQUUsQ0FBQztJQUVwQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ2pDLE1BQU0sYUFBYSxHQUFJLElBQTRCLENBQUMsYUFBYSxDQUFDO0lBQ2xFLElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRTtRQUM5QixNQUFNLElBQUksR0FBRyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksYUFBYSxFQUFFO1lBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDMUI7UUFDRCxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDL0Q7SUFFRCxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDeEIsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7S0FDMUQ7SUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO1FBQ2hDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0tBQ3BEO0lBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO1FBQ25CLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztLQUN2RDtBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FDeEMsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtJQUM5QixNQUFNLEVBQUMsYUFBYSxFQUFFLFVBQVUsRUFBQyxHQUFHLG1CQUFtQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDM0YsV0FBVyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRTNGLCtGQUErRjtJQUMvRiw2Q0FBNkM7SUFDN0MsTUFBTSxlQUFlLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFakUsTUFBTSxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQzdELE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQyxDQUFDO0FBQ3hDLENBQUM7QUFPRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsSUFBdUI7SUFDaEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztJQUMxQyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDZixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzNCLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzlDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RixPQUFPLEVBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7S0FDdEQ7SUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7UUFDaEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUM3QixNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNoRCxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLE9BQU8sRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztLQUN4RDtJQUVELE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFdEYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFNUQsT0FBTyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztBQUM1QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsNEJBQTRCLENBQ3hDLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7SUFDOUIsTUFBTSxFQUFDLGFBQWEsRUFBRSxVQUFVLEVBQUMsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzNGLFdBQVcsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFakMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNuRSxNQUFNLGFBQWEsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTlDLG9DQUFvQztJQUNwQywrRkFBK0Y7SUFDL0YsSUFBSSxhQUFhLEVBQUU7UUFDakIsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEQsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUU7WUFDN0IsYUFBYSxDQUFDLEdBQUcsQ0FDYixPQUFPLEVBQUUsWUFBWSxDQUFDLGVBQWUsQ0FDeEIsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQy9CLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDM0M7S0FDRjtJQUVELG9EQUFvRDtJQUNwRCxJQUFJLGdCQUFnQixHQUF5QixJQUFJLENBQUM7SUFFbEQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDOUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUN0QyxLQUFLLE1BQU0sRUFBQyxRQUFRLEVBQUUsVUFBVSxFQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNwRCxPQUFPLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7U0FDakU7UUFDRCxnQkFBZ0IsR0FBRyxPQUFPLENBQUM7S0FDNUI7SUFFRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO1FBQzNCLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLHlCQUF5QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0tBQy9FO0lBRUQsa0VBQWtFO0lBQ2xFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQyxNQUFNLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxnQkFBZ0IsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFOUUsTUFBTSxjQUFjLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7SUFDL0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLEVBQWdCLENBQUM7SUFFMUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUMvQixNQUFNLGVBQWUsR0FBRyxJQUFJLHlCQUF5QixDQUNqRCxZQUFZLEVBQUUsWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQ3BGLElBQUksQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEVBQUUsQ0FBQyxhQUFhLEVBQzNGLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUUzRCxNQUFNLDBCQUEwQixHQUFHLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRTdGLG1CQUFtQjtJQUNuQixhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFeEUsaUJBQWlCO0lBQ2pCLGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUVwRSxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO0lBRTFELG1DQUFtQztJQUNuQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUU7UUFDdkIsSUFBSSxjQUFjLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDcEU7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztLQUNqRDtJQUVELHlCQUF5QjtJQUN6QixJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUU7UUFDbEIsSUFBSSxTQUFTLEdBQWlCLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFO1lBQ3hDLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDMUQ7UUFDRCxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztLQUN2QztJQUVELElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxJQUFJLEVBQUU7UUFDL0IsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDO0tBQ3REO0lBRUQsOEJBQThCO0lBQzlCLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNyQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2RSxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2hCLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQ3BEO1NBQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7UUFDakUsaUVBQWlFO1FBQ2pFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztLQUNsRDtJQUVELDREQUE0RDtJQUM1RCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtRQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO0tBQ25FO0lBRUQseUNBQXlDO0lBQ3pDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDNUIsYUFBYSxDQUFDLEdBQUcsQ0FDYixNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDeEY7SUFFRCwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRWpFLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0YsTUFBTSxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBRTdELE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQyxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLFVBQVUsMkJBQTJCLENBQ3ZDLFNBQXdCLEVBQUUsU0FBbUMsRUFBRSxTQUEyQixFQUMxRixhQUE0QjtJQUM5QixNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBRyxDQUFDO0lBQzlDLElBQUksSUFBSSxLQUFLLENBQUMsK0JBQStCLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRS9ELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsY0FBYyxtQkFBMEIsQ0FBQztJQUV4RixNQUFNLElBQUksR0FBRyxtQ0FBbUMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xGLE1BQU0sR0FBRyxHQUFHLDRCQUE0QixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRXRGLCtEQUErRDtJQUMvRCxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3JDLElBQUksRUFBRSxJQUFJLEVBQ1YsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUM3RixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNoRCxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUN2QyxTQUF3QixFQUFFLFNBQW1DLEVBQUUsVUFBOEIsRUFDN0YsU0FBMkIsRUFBRSxhQUE0QixFQUFFLGtCQUFvQyxFQUMvRixjQUFnQztJQUNsQyxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBRyxDQUFDO0lBQzlDLElBQUksSUFBSSxLQUFLLENBQUMsK0JBQStCLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBRS9ELE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsY0FBYyxtQkFBMEIsQ0FBQztJQUV4RixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7SUFFdEMsb0VBQW9FO0lBQ3BFLE1BQU0sSUFBSSxxQkFDTCxtQ0FBbUMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxJQUN2RSxRQUFRLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFDNUIsUUFBUSxFQUFFLEVBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUMsRUFDbkMsVUFBVSxFQUFFLEVBQUUsRUFDZCxLQUFLLEVBQUUsc0JBQXNCLENBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQyxFQUN4RCxXQUFXLEVBQUUseUJBQXlCLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsRUFDeEUsK0JBQStCLEVBQUUsS0FBSyxFQUN0QyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksV0FBVyxFQUNwRSxhQUFhLEVBQ1QsQ0FBQyxPQUFPLENBQUMsUUFBUSxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsRUFDM0YsYUFBYSxFQUFFLDRCQUE0QixFQUMzQyxVQUFVLEVBQUUsSUFBSSxFQUNoQixhQUFhLEVBQ1QsU0FBUyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQzlGLHVCQUF1QixFQUFFLEVBQUUsRUFDM0Isa0JBQWtCLEVBQUUsSUFBSSxHQUN6QixDQUFDO0lBQ0YsTUFBTSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFdEYsK0RBQStEO0lBQy9ELFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FDckMsSUFBSSxFQUFFLElBQUksRUFDVixDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzdGLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsbUNBQW1DLENBQ3hDLFNBQW1DLEVBQUUsU0FBd0IsRUFDN0QsU0FBMkI7SUFDN0IsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7SUFDOUMsSUFBSSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFFL0QsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNwRCxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFDVixjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQztRQUNyRixRQUFRLEVBQUUsU0FBUyxDQUFDLFFBQVE7UUFDNUIsSUFBSSxFQUFFLDhCQUE4QixDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztRQUMxRSxPQUFPLEVBQUUseUJBQXlCLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFDaEUsU0FBUyxFQUFFO1lBQ1QsYUFBYSxFQUNULFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDO1NBQzNGO1FBQ0QsSUFBSSxFQUFFO1lBQ0osVUFBVSxFQUFFLFNBQVMsQ0FBQyxjQUFjO1lBQ3BDLFNBQVMsRUFBRSxPQUFPLENBQUMsYUFBYTtZQUNoQyxVQUFVLEVBQUUsT0FBTyxDQUFDLGNBQWM7U0FDbkM7UUFDRCxNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU07UUFDeEIsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPO1FBQzFCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLFFBQVEsRUFBRSxJQUFJO1FBQ2QsU0FBUyxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtLQUM5RixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyx5QkFBeUIsQ0FDOUIsT0FBK0IsRUFBRSxTQUF3QjtJQUMzRCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDekIsSUFBSSxJQUFJLEdBQXNCLElBQUksQ0FBQztRQUNuQyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDdkMsSUFBSSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDOUQ7UUFDRCxPQUFPO1lBQ0wsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO1lBQ2hDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztZQUNsQixTQUFTLEVBQUUsMkJBQTJCLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUM7WUFDbEUsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsSUFBSTtTQUNyQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUywyQkFBMkIsQ0FDaEMsU0FBaUMsRUFBRSxTQUF3QjtJQUM3RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pFLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBZSxDQUFDLENBQUM7UUFDdEUsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ2pDLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1FBQzlELE9BQU8sU0FBUyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQ3pDLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDbkU7SUFFRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUU7WUFDcEIsT0FBTyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDekQ7S0FDRjtJQUVELEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0lBQy9CLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FDMUIsS0FBc0IsRUFBRSxZQUEwQixFQUFFLEdBQWtCO0lBQ3hFLE1BQU0sU0FBUyxHQUFHLGlCQUFpQixDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztJQUV6RCwyRUFBMkU7SUFDM0UsTUFBTSxVQUFVLEdBQUc7UUFDakIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUMvQixTQUFTO1FBQ1QsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO0tBQzdCLENBQUM7SUFFRixJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDZCxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUM3QjtJQUVELE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsU0FBUyx1QkFBdUIsQ0FBQyxRQUF1QjtJQUN0RCxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUM3RCxDQUFDO0FBRUQsU0FBUyx5QkFBeUIsQ0FBQyxVQUFlO0lBQ2hELE1BQU0sTUFBTSxHQUFtQixFQUFFLENBQUM7SUFDbEMsS0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDdEQsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7S0FDL0M7SUFDRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUM3QjtJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELG9FQUFvRTtBQUNwRSxTQUFTLDRCQUE0QixDQUNqQyxJQUF5QixFQUFFLFlBQTBCO0lBQ3ZELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUU7UUFDdkIsTUFBTSxVQUFVLEdBQWtCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBc0IsRUFBRSxFQUFFO1lBQzVFLE1BQU0sZUFBZSxHQUFHLHFCQUFxQixDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekUsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztpQkFDdkMsTUFBTSxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztpQkFDakQsTUFBTSxFQUFFLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUM5RCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFDN0MsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3JEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsMkVBQTJFO0FBQzNFLFNBQVMsbUNBQW1DLENBQUMsSUFBeUI7SUFDcEUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDM0IsTUFBTSxVQUFVLEdBQWtCLEVBQUUsQ0FBQztRQUNyQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzNCLE1BQU0sVUFBVSxHQUFHO1lBQ2pCLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQztZQUN4QyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQztTQUNoRCxDQUFDO1FBQ0YsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELGtCQUFrQjtRQUNsQixNQUFNLFNBQVMsR0FBRyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFakUsMkNBQTJDO1FBQzNDLFVBQVUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzNFLFVBQVUsQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFMUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFzQixFQUFFLEdBQVcsRUFBRSxFQUFFO1lBQzNELE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNoRCxNQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUM7Z0JBQ3pELEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3JELENBQUMsQ0FBQztZQUNILE1BQU0saUJBQWlCLEdBQUcsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBRW5GLE1BQU0sZUFBZSxHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO2lCQUN4QyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3hGLE1BQU0sOEJBQThCLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBRTdFLFVBQVUsQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMzRCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUCxVQUFVLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUM3QyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDNUQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxHQUFXO0lBQy9CLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDMUMsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEdBQXVDO0lBQzlELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzNDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQy9ELE9BQU87WUFDTCxHQUFHO1lBQ0gsS0FBSyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ3ZCLE1BQU0sRUFBRSxJQUFJO1NBQ2IsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxHQUFhO0lBQ3RDLE9BQU8sR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDdEMsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsSUFBeUIsRUFBRSxRQUE2QjtJQUNoRiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRWpFLE9BQU8sQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRTtRQUM3QyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUNyRCxZQUFZLENBQUMsZUFBZSxDQUFDO1FBQzdCLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztRQUNsRSxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUM1QixlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUM3QixpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztLQUN6RCxDQUFDLENBQUMsQ0FBQztBQUNOLENBQUM7QUFFRCxxQ0FBcUM7QUFDckMsU0FBUyx5QkFBeUIsQ0FDOUIsSUFBeUIsRUFBRSxZQUEwQjtJQUN2RCxNQUFNLGdCQUFnQixHQUFrQixFQUFFLENBQUM7SUFDM0MsTUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO0lBQzNDLE1BQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBRTNFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWxDLCtDQUErQztRQUMvQyxNQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUVoRCxrRUFBa0U7UUFDbEUsTUFBTSxTQUFTLEdBQUcsYUFBYSxFQUFFLENBQUM7UUFDbEMsTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEYsTUFBTSxlQUFlLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUM7YUFDbkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUM7YUFDeEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BGLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7S0FDOUQ7SUFFRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ2hFLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FDUCxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFDL0U7UUFDRSxxQkFBcUIsaUJBQTBCLGdCQUFnQixDQUFDO1FBQ2hFLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUM7S0FDakUsRUFDRCxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBRUQsa0VBQWtFO0FBQ2xFLFNBQVMsMEJBQTBCLENBQy9CLElBQXlCLEVBQUUsUUFBdUIsRUFBRSxjQUE2QixFQUNqRixZQUE0QixFQUFFLGFBQTRCLEVBQUUsWUFBMEIsRUFDdEYsYUFBcUI7SUFDdkIsTUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO0lBQzNDLE1BQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUUzQyxJQUFJLGtCQUFrQixHQUFHLGFBQWEsQ0FBQztJQUN2QyxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDbEQsTUFBTSxnQkFBZ0IsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUVqRCxnQ0FBZ0M7SUFDaEMsTUFBTSxhQUFhLEdBQ2YsYUFBYSxDQUFDLDRCQUE0QixDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDLENBQUM7SUFDeEYsSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRTtRQUN6QyxNQUFNLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxjQUFjLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0tBQ3JDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBRWxHLE1BQU0sU0FBUyxHQUFHLENBQUMsUUFBYSxFQUFFLEtBQVUsRUFBRSxFQUFFO1FBQzlDLE9BQU8sc0JBQXNCLENBQ3pCLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxXQUFXLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7SUFDbEcsQ0FBQyxDQUFDO0lBQ0YsSUFBSSxRQUFRLEVBQUU7UUFDWixNQUFNLGVBQWUsR0FBRyxDQUFDLFFBQWdCLEVBQVUsRUFBRTtZQUNuRCxNQUFNLGlCQUFpQixHQUFHLGtCQUFrQixDQUFDO1lBQzdDLGtCQUFrQixJQUFJLFFBQVEsQ0FBQztZQUMvQixPQUFPLGlCQUFpQixDQUFDO1FBQzNCLENBQUMsQ0FBQztRQUNGLE1BQU0sY0FBYyxHQUFHLElBQUksY0FBYyxDQUNyQyxZQUFZO1FBQ1osZ0NBQWdDLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsZUFBZTtRQUNoRiw0QkFBNEIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBRWpFLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFO1lBQzlCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDMUIsTUFBTSxXQUFXLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0MsSUFBSSxXQUFXLEtBQUssT0FBTyxFQUFFO2dCQUMzQixNQUFNLEVBQUMsWUFBWSxFQUFFLElBQUksRUFBQyxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN0RCxZQUFZLENBQUMsa0JBQWtCLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUM3RjtpQkFBTSxJQUFJLFdBQVcsS0FBSyxPQUFPLEVBQUU7Z0JBQ2xDLFlBQVksQ0FBQyxrQkFBa0IsQ0FDM0Isa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ3BGO2lCQUFNO2dCQUNMLDZDQUE2QztnQkFDN0MsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ3ZELE1BQU0sV0FBVyxHQUFHLFNBQVMsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBRXJELE1BQU0sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBQyxHQUFHLDRCQUE0QixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUVuRixNQUFNLGlCQUFpQixHQUFtQjtvQkFDeEMsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2lCQUMxRixDQUFDO2dCQUVGLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDNUMsZ0JBQWdCLENBQUMsSUFBSSxDQUNqQixDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2FBQ3ZGO1NBQ0Y7UUFFRCxJQUFJLFlBQVksQ0FBQywwQkFBMEIsRUFBRTtZQUMzQyxNQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDdkYsSUFBSSxpQkFBaUIsRUFBRTtnQkFDckIsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNuRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDbkM7WUFFRCxZQUFZLENBQUMsNEJBQTRCLENBQUMsY0FBYyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM5RSxNQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsY0FBYyxFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUM3RSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDcEMsQ0FBQyxDQUFDLENBQUM7U0FDSjtLQUNGO0lBRUQsSUFBSSxrQkFBa0IsRUFBRTtRQUN0QixnQkFBZ0IsQ0FBQyxPQUFPLENBQ3BCLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztLQUN0RjtJQUVELElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzlELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUMxRSxNQUFNLFVBQVUsR0FBa0IsRUFBRSxDQUFDO1FBQ3JDLElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMvQixVQUFVLENBQUMsSUFBSSxDQUFDLHFCQUFxQixpQkFBMEIsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1NBQ25GO1FBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQy9CLFVBQVUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7U0FDbkY7UUFDRCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1A7WUFDRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQztZQUM3RSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQU0sRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDO1NBQzlDLEVBQ0QsVUFBVSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUN0QixXQUErQixFQUFFLGNBQW1CLEVBQUUsU0FBbUI7SUFDM0UsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDOUYsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUM7U0FDbkUsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDO1NBQ3RDLE1BQU0sRUFBRSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxTQUFTLDRCQUE0QixDQUFDLFdBQW1CO0lBRXZELElBQUksV0FBa0MsQ0FBQztJQUN2QyxNQUFNLFdBQVcsR0FBbUIsRUFBRSxDQUFDO0lBRXZDLGdFQUFnRTtJQUNoRSxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2xELElBQUksV0FBVyxFQUFFO1FBQ2YsV0FBVyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QixXQUFXLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDO0tBQ25DO1NBQU07UUFDTCxXQUFXLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQztRQUNqQyxXQUFXLENBQUMsSUFBSSxDQUNaLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUcsK0NBQStDO1FBQ2pFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUcsc0RBQXNEO1NBQ3ZFLENBQUM7S0FDUDtJQUVELE9BQU8sRUFBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBQyxDQUFDO0FBQ2pELENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUN4QixjQUE0QixFQUFFLGFBQTRCLEVBQzFELElBQXlCO0lBQzNCLE9BQU8sYUFBYSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNqQyxNQUFNLFdBQVcsR0FBRyxvQkFBb0IsQ0FDcEMsSUFBSSxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksa0JBQWtCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IsTUFBTSxZQUFZLEdBQ2QsUUFBUSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLElBQUksV0FBVyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3JGLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQ2hCLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQ3pGLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN4QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDdkYsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUF5QjtJQUNsRCxtQkFBbUI7SUFDbkIsT0FBTztRQUNMLGNBQWMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7UUFDcEMsYUFBYSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUztRQUNsQyxjQUFjLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVO0tBQ1YsQ0FBQztJQUM3QixrQkFBa0I7QUFDcEIsQ0FBQztBQUdELFNBQVMsc0JBQXNCLENBQzNCLEdBQThCLEVBQUUsU0FBd0I7SUFDMUQsaUdBQWlHO0lBQ2pHLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUMvQixDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUEwQixFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEYsT0FBTyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMxQixDQUFDO0FBRUQsTUFBTSxZQUFZLEdBQUcsb0RBQW9ELENBQUM7QUFjMUUsTUFBTSxVQUFVLGlCQUFpQixDQUFDLElBQTZCO0lBTTdELE1BQU0sVUFBVSxHQUE0QixFQUFFLENBQUM7SUFDL0MsTUFBTSxTQUFTLEdBQTRCLEVBQUUsQ0FBQztJQUM5QyxNQUFNLFVBQVUsR0FBNEIsRUFBRSxDQUFDO0lBQy9DLE1BQU0sVUFBVSxHQUE0QixFQUFFLENBQUM7SUFFL0MsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDOUIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEMsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQ3BCLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDekI7YUFBTSxJQUFJLE9BQU8saUJBQTBCLElBQUksSUFBSSxFQUFFO1lBQ3BELFVBQVUsQ0FBQyxPQUFPLGlCQUEwQixDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3ZEO2FBQU0sSUFBSSxPQUFPLGVBQXdCLElBQUksSUFBSSxFQUFFO1lBQ2xELFNBQVMsQ0FBQyxPQUFPLGVBQXdCLENBQUMsR0FBRyxLQUFLLENBQUM7U0FDcEQ7YUFBTSxJQUFJLE9BQU8sbUJBQTRCLElBQUksSUFBSSxFQUFFO1lBQ3RELFVBQVUsQ0FBQyxPQUFPLG1CQUE0QixDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3pEO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLEVBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFDLENBQUM7QUFDekQsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLE1BQWdCLEVBQUUsUUFBZ0IsRUFBRSxZQUFvQjtJQUM3RSxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO0lBQ2xDLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLE9BQU8sU0FBVyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakcsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBWTtJQUN0QyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7SUFDZCxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUU7UUFDYixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRTtZQUN2QixJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNsRCxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1NBQ3JEO2FBQU07WUFDTCxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN2RDtLQUNGO0lBQ0QsT0FBTyxFQUFDLFlBQVksRUFBRSxJQUFJLEVBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbCwgRGVmaW5pdGlvbktpbmR9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBQYXJzZWRFdmVudH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGlmZWN5Y2xlSG9va3N9IGZyb20gJy4uLy4uL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3R5cGVTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtTaGFkb3dDc3N9IGZyb20gJy4uLy4uL3NoYWRvd19jc3MnO1xuaW1wb3J0IHtDT05URU5UX0FUVFIsIEhPU1RfQVRUUn0gZnJvbSAnLi4vLi4vc3R5bGVfY29tcGlsZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1JlbmRlcjNQYXJzZVJlc3VsdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7dHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtTdHlsaW5nQnVpbGRlciwgU3R5bGluZ0luc3RydWN0aW9ufSBmcm9tICcuL3N0eWxpbmcnO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXR9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIGdldFF1ZXJ5UHJlZGljYXRlLCB0ZW1wb3JhcnlBbGxvY2F0b3J9IGZyb20gJy4vdXRpbCc7XG5cbmNvbnN0IEVNUFRZX0FSUkFZOiBhbnlbXSA9IFtdO1xuXG4vLyBUaGlzIHJlZ2V4IG1hdGNoZXMgYW55IGJpbmRpbmcgbmFtZXMgdGhhdCBjb250YWluIHRoZSBcImF0dHIuXCIgcHJlZml4LCBlLmcuIFwiYXR0ci5yZXF1aXJlZFwiXG4vLyBJZiB0aGVyZSBpcyBhIG1hdGNoLCB0aGUgZmlyc3QgbWF0Y2hpbmcgZ3JvdXAgd2lsbCBjb250YWluIHRoZSBhdHRyaWJ1dGUgbmFtZSB0byBiaW5kLlxuY29uc3QgQVRUUl9SRUdFWCA9IC9hdHRyXFwuKFteXFxdXSspLztcblxuZnVuY3Rpb24gZ2V0U3R5bGluZ1ByZWZpeChwcm9wTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHByb3BOYW1lLnN1YnN0cmluZygwLCA1KS50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiB7ZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXX0ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLnR5cGUpO1xuXG4gIC8vIGUuZy4gYHNlbGVjdG9yczogW1snJywgJ3NvbWVEaXInLCAnJ11dYFxuICBkZWZpbml0aW9uTWFwLnNldCgnc2VsZWN0b3JzJywgY3JlYXRlRGlyZWN0aXZlU2VsZWN0b3IobWV0YS5zZWxlY3RvcikpO1xuXG5cbiAgLy8gZS5nLiBgZmFjdG9yeTogKCkgPT4gbmV3IE15QXBwKGRpcmVjdGl2ZUluamVjdChFbGVtZW50UmVmKSlgXG4gIGNvbnN0IHJlc3VsdCA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICB0eXBlOiBtZXRhLnR5cGUsXG4gICAgZGVwczogbWV0YS5kZXBzLFxuICAgIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsXG4gIH0pO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZmFjdG9yeScsIHJlc3VsdC5mYWN0b3J5KTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnY29udGVudFF1ZXJpZXMnLCBjcmVhdGVDb250ZW50UXVlcmllc0Z1bmN0aW9uKG1ldGEsIGNvbnN0YW50UG9vbCkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb250ZW50UXVlcmllc1JlZnJlc2gnLCBjcmVhdGVDb250ZW50UXVlcmllc1JlZnJlc2hGdW5jdGlvbihtZXRhKSk7XG5cbiAgLy8gSW5pdGlhbGl6ZSBob3N0VmFyc0NvdW50IHRvIG51bWJlciBvZiBib3VuZCBob3N0IHByb3BlcnRpZXMgKGludGVycG9sYXRpb25zIGlsbGVnYWwpLFxuICAvLyBleGNlcHQgJ3N0eWxlJyBhbmQgJ2NsYXNzJyBwcm9wZXJ0aWVzLCBzaW5jZSB0aGV5IHNob3VsZCAqbm90KiBhbGxvY2F0ZSBob3N0IHZhciBzbG90c1xuICBjb25zdCBob3N0VmFyc0NvdW50ID0gT2JqZWN0LmtleXMobWV0YS5ob3N0LnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihuYW1lID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGdldFN0eWxpbmdQcmVmaXgobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJlZml4ICE9PSAnc3R5bGUnICYmIHByZWZpeCAhPT0gJ2NsYXNzJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5sZW5ndGg7XG5cbiAgY29uc3QgZWxWYXJFeHAgPSBvLnZhcmlhYmxlKCdlbEluZGV4Jyk7XG4gIGNvbnN0IGNvbnRleHRWYXJFeHAgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihlbFZhckV4cCwgY29udGV4dFZhckV4cCk7XG5cbiAgY29uc3QgYWxsT3RoZXJBdHRyaWJ1dGVzOiBhbnkgPSB7fTtcbiAgY29uc3QgYXR0ck5hbWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMobWV0YS5ob3N0LmF0dHJpYnV0ZXMpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dHJOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGF0dHIgPSBhdHRyTmFtZXNbaV07XG4gICAgY29uc3QgdmFsdWUgPSBtZXRhLmhvc3QuYXR0cmlidXRlc1thdHRyXTtcbiAgICBzd2l0Y2ggKGF0dHIpIHtcbiAgICAgIC8vIHN0eWxlIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWQgaW4gdGhlIHN0eWxpbmcgY29udGV4dFxuICAgICAgY2FzZSAnc3R5bGUnOlxuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIodmFsdWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIGNsYXNzIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWQgaW4gdGhlIHN0eWxpbmcgY29udGV4dFxuICAgICAgY2FzZSAnY2xhc3MnOlxuICAgICAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIodmFsdWUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFsbE90aGVyQXR0cmlidXRlc1thdHRyXSA9IHZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBlLmcuIGBhdHRyaWJ1dGVzOiBbJ3JvbGUnLCAnbGlzdGJveCddYFxuICBkZWZpbml0aW9uTWFwLnNldCgnYXR0cmlidXRlcycsIGNyZWF0ZUhvc3RBdHRyaWJ1dGVzQXJyYXkoYWxsT3RoZXJBdHRyaWJ1dGVzKSk7XG5cbiAgLy8gZS5nLiBgaG9zdEJpbmRpbmdzOiAocmYsIGN0eCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgICAgICAgbWV0YSwgZWxWYXJFeHAsIGNvbnRleHRWYXJFeHAsIHN0eWxlQnVpbGRlciwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCBob3N0VmFyc0NvdW50KSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIGlmIChtZXRhLmV4cG9ydEFzICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2V4cG9ydEFzJywgby5saXRlcmFsKG1ldGEuZXhwb3J0QXMpKTtcbiAgfVxuXG4gIHJldHVybiB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50czogcmVzdWx0LnN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEFkZCBmZWF0dXJlcyB0byB0aGUgZGVmaW5pdGlvbiBtYXAuXG4gKi9cbmZ1bmN0aW9uIGFkZEZlYXR1cmVzKFxuICAgIGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXAsIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgfCBSM0NvbXBvbmVudE1ldGFkYXRhKSB7XG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgY29uc3QgcHJvdmlkZXJzID0gbWV0YS5wcm92aWRlcnM7XG4gIGNvbnN0IHZpZXdQcm92aWRlcnMgPSAobWV0YSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhKS52aWV3UHJvdmlkZXJzO1xuICBpZiAocHJvdmlkZXJzIHx8IHZpZXdQcm92aWRlcnMpIHtcbiAgICBjb25zdCBhcmdzID0gW3Byb3ZpZGVycyB8fCBuZXcgby5MaXRlcmFsQXJyYXlFeHByKFtdKV07XG4gICAgaWYgKHZpZXdQcm92aWRlcnMpIHtcbiAgICAgIGFyZ3MucHVzaCh2aWV3UHJvdmlkZXJzKTtcbiAgICB9XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuUHJvdmlkZXJzRmVhdHVyZSkuY2FsbEZuKGFyZ3MpKTtcbiAgfVxuXG4gIGlmIChtZXRhLnVzZXNJbmhlcml0YW5jZSkge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLkluaGVyaXREZWZpbml0aW9uRmVhdHVyZSkpO1xuICB9XG4gIGlmIChtZXRhLmxpZmVjeWNsZS51c2VzT25DaGFuZ2VzKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuTmdPbkNoYW5nZXNGZWF0dXJlKSk7XG4gIH1cbiAgaWYgKGZlYXR1cmVzLmxlbmd0aCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdmZWF0dXJlcycsIG8ubGl0ZXJhbEFycihmZWF0dXJlcykpO1xuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGRpcmVjdGl2ZSBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0RpcmVjdGl2ZURlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoUjMuZGVmaW5lRGlyZWN0aXZlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgY29uc3QgdHlwZSA9IGNyZWF0ZVR5cGVGb3JEZWYobWV0YSwgUjMuRGlyZWN0aXZlRGVmV2l0aE1ldGEpO1xuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzQmFzZVJlZk1ldGFEYXRhIHtcbiAgaW5wdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ119O1xuICBvdXRwdXRzPzoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGJhc2UgZGVmaW5pdGlvbiBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHtAbGluayBSM0Jhc2VSZWZNZXRhZGF0YX1cbiAqIEBwYXJhbSBtZXRhIHRoZSBtZXRhZGF0YSB1c2VkIGZvciBjb21waWxhdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVCYXNlRGVmRnJvbU1ldGFkYXRhKG1ldGE6IFIzQmFzZVJlZk1ldGFEYXRhKSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuICBpZiAobWV0YS5pbnB1dHMpIHtcbiAgICBjb25zdCBpbnB1dHMgPSBtZXRhLmlucHV0cztcbiAgICBjb25zdCBpbnB1dHNNYXAgPSBPYmplY3Qua2V5cyhpbnB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdiA9IGlucHV0c1trZXldO1xuICAgICAgY29uc3QgdmFsdWUgPSBBcnJheS5pc0FycmF5KHYpID8gby5saXRlcmFsQXJyKHYubWFwKHZ4ID0+IG8ubGl0ZXJhbCh2eCkpKSA6IG8ubGl0ZXJhbCh2KTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2lucHV0cycsIG8ubGl0ZXJhbE1hcChpbnB1dHNNYXApKTtcbiAgfVxuICBpZiAobWV0YS5vdXRwdXRzKSB7XG4gICAgY29uc3Qgb3V0cHV0cyA9IG1ldGEub3V0cHV0cztcbiAgICBjb25zdCBvdXRwdXRzTWFwID0gT2JqZWN0LmtleXMob3V0cHV0cykubWFwKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG8ubGl0ZXJhbChvdXRwdXRzW2tleV0pO1xuICAgICAgcmV0dXJuIHtrZXksIHZhbHVlLCBxdW90ZWQ6IGZhbHNlfTtcbiAgICB9KTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIG8ubGl0ZXJhbE1hcChvdXRwdXRzTWFwKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUJhc2UpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuXG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQmFzZURlZikpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IHtkZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzfSA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJywgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBmb3IgKGNvbnN0IHtzZWxlY3RvciwgZXhwcmVzc2lvbn0gb2YgbWV0YS5kaXJlY3RpdmVzKSB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgZXhwcmVzc2lvbik7XG4gICAgfVxuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG5cbiAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICBjb25zdCB0ZW1wbGF0ZUJ1aWxkZXIgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLlJPT1RfU0NPUEUsIDAsIHRlbXBsYXRlVHlwZU5hbWUsIG51bGwsIG51bGwsIHRlbXBsYXRlTmFtZSxcbiAgICAgIG1ldGEudmlld1F1ZXJpZXMsIGRpcmVjdGl2ZU1hdGNoZXIsIGRpcmVjdGl2ZXNVc2VkLCBtZXRhLnBpcGVzLCBwaXBlc1VzZWQsIFIzLm5hbWVzcGFjZUhUTUwsXG4gICAgICBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgLy8gZS5nLiBgY29uc3RzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRDb25zdENvdW50KCkpKTtcblxuICAvLyBlLmcuIGB2YXJzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgndmFycycsIG8ubGl0ZXJhbCh0ZW1wbGF0ZUJ1aWxkZXIuZ2V0VmFyQ291bnQoKSkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcblxuICAvLyBlLmcuIGBkaXJlY3RpdmVzOiBbTXlEaXJlY3RpdmVdYFxuICBpZiAoZGlyZWN0aXZlc1VzZWQuc2l6ZSkge1xuICAgIGxldCBkaXJlY3RpdmVzRXhwcjogby5FeHByZXNzaW9uID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20oZGlyZWN0aXZlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBkaXJlY3RpdmVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZGlyZWN0aXZlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgZGlyZWN0aXZlc0V4cHIpO1xuICB9XG5cbiAgLy8gZS5nLiBgcGlwZXM6IFtNeVBpcGVdYFxuICBpZiAocGlwZXNVc2VkLnNpemUpIHtcbiAgICBsZXQgcGlwZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShwaXBlc1VzZWQpKTtcbiAgICBpZiAobWV0YS53cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlKSB7XG4gICAgICBwaXBlc0V4cHIgPSBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHBpcGVzRXhwcildKTtcbiAgICB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3BpcGVzJywgcGlwZXNFeHByKTtcbiAgfVxuXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IG51bGwpIHtcbiAgICBtZXRhLmVuY2Fwc3VsYXRpb24gPSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkO1xuICB9XG5cbiAgLy8gZS5nLiBgc3R5bGVzOiBbc3RyMSwgc3RyMl1gXG4gIGlmIChtZXRhLnN0eWxlcyAmJiBtZXRhLnN0eWxlcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdHlsZVZhbHVlcyA9IG1ldGEuZW5jYXBzdWxhdGlvbiA9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkID9cbiAgICAgICAgY29tcGlsZVN0eWxlcyhtZXRhLnN0eWxlcywgQ09OVEVOVF9BVFRSLCBIT1NUX0FUVFIpIDpcbiAgICAgICAgbWV0YS5zdHlsZXM7XG4gICAgY29uc3Qgc3RyaW5ncyA9IHN0eWxlVmFsdWVzLm1hcChzdHIgPT4gby5saXRlcmFsKHN0cikpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzdHlsZXMnLCBvLmxpdGVyYWxBcnIoc3RyaW5ncykpO1xuICB9IGVsc2UgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiA9PT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIHN0eWxlLCBkb24ndCBnZW5lcmF0ZSBjc3Mgc2VsZWN0b3JzIG9uIGVsZW1lbnRzXG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5Ob25lO1xuICB9XG5cbiAgLy8gT25seSBzZXQgdmlldyBlbmNhcHN1bGF0aW9uIGlmIGl0J3Mgbm90IHRoZSBkZWZhdWx0IHZhbHVlXG4gIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gIT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZW5jYXBzdWxhdGlvbicsIG8ubGl0ZXJhbChtZXRhLmVuY2Fwc3VsYXRpb24pKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGFuaW1hdGlvbjogW3RyaWdnZXIoJzEyMycsIFtdKV1gXG4gIGlmIChtZXRhLmFuaW1hdGlvbnMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2RhdGEnLCBvLmxpdGVyYWxNYXAoW3trZXk6ICdhbmltYXRpb24nLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7bm9kZXM6IHJlbmRlcjNBc3Qubm9kZXN9LFxuICAgIGRpcmVjdGl2ZXM6IFtdLFxuICAgIHBpcGVzOiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKHBpcGVUeXBlQnlOYW1lLCBvdXRwdXRDdHgpLFxuICAgIHZpZXdRdWVyaWVzOiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGNvbXBvbmVudC52aWV3UXVlcmllcywgb3V0cHV0Q3R4KSxcbiAgICB3cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlOiBmYWxzZSxcbiAgICBzdHlsZXM6IChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuc3R5bGVzKSB8fCBFTVBUWV9BUlJBWSxcbiAgICBlbmNhcHN1bGF0aW9uOlxuICAgICAgICAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pIHx8IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgaW50ZXJwb2xhdGlvbjogREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyxcbiAgICBhbmltYXRpb25zOiBudWxsLFxuICAgIHZpZXdQcm92aWRlcnM6XG4gICAgICAgIGNvbXBvbmVudC52aWV3UHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LnZpZXdQcm92aWRlcnMpIDogbnVsbCxcbiAgICByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogJycsXG4gICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBkaXJlY3RpdmUudG9TdW1tYXJ5KCk7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIHR5cGU6IG91dHB1dEN0eC5pbXBvcnRFeHByKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46XG4gICAgICAgIHR5cGVTb3VyY2VTcGFuKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/ICdDb21wb25lbnQnIDogJ0RpcmVjdGl2ZScsIGRpcmVjdGl2ZS50eXBlKSxcbiAgICBzZWxlY3RvcjogZGlyZWN0aXZlLnNlbGVjdG9yLFxuICAgIGRlcHM6IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUudHlwZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHF1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLnF1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgbGlmZWN5Y2xlOiB7XG4gICAgICB1c2VzT25DaGFuZ2VzOlxuICAgICAgICAgIGRpcmVjdGl2ZS50eXBlLmxpZmVjeWNsZUhvb2tzLnNvbWUobGlmZWN5Y2xlID0+IGxpZmVjeWNsZSA9PSBMaWZlY3ljbGVIb29rcy5PbkNoYW5nZXMpLFxuICAgIH0sXG4gICAgaG9zdDoge1xuICAgICAgYXR0cmlidXRlczogZGlyZWN0aXZlLmhvc3RBdHRyaWJ1dGVzLFxuICAgICAgbGlzdGVuZXJzOiBzdW1tYXJ5Lmhvc3RMaXN0ZW5lcnMsXG4gICAgICBwcm9wZXJ0aWVzOiBzdW1tYXJ5Lmhvc3RQcm9wZXJ0aWVzLFxuICAgIH0sXG4gICAgaW5wdXRzOiBkaXJlY3RpdmUuaW5wdXRzLFxuICAgIG91dHB1dHM6IGRpcmVjdGl2ZS5vdXRwdXRzLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZmFsc2UsXG4gICAgZXhwb3J0QXM6IG51bGwsXG4gICAgcHJvdmlkZXJzOiBkaXJlY3RpdmUucHJvdmlkZXJzLmxlbmd0aCA+IDAgPyBuZXcgby5XcmFwcGVkTm9kZUV4cHIoZGlyZWN0aXZlLnByb3ZpZGVycykgOiBudWxsXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUXVlcnlEZWZpbml0aW9uKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBpZHg6IG51bWJlciB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBwcmVkaWNhdGUgPSBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKTtcblxuICAvLyBlLmcuIHIzLnF1ZXJ5KG51bGwsIHNvbWVQcmVkaWNhdGUsIGZhbHNlKSBvciByMy5xdWVyeSgwLCBbJ2RpdiddLCBmYWxzZSlcbiAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICBvLmxpdGVyYWwoaWR4LCBvLklORkVSUkVEX1RZUEUpLFxuICAgIHByZWRpY2F0ZSxcbiAgICBvLmxpdGVyYWwocXVlcnkuZGVzY2VuZGFudHMpLFxuICBdO1xuXG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5xdWVyeSkuY2FsbEZuKHBhcmFtZXRlcnMpO1xufVxuXG4vLyBUdXJuIGEgZGlyZWN0aXZlIHNlbGVjdG9yIGludG8gYW4gUjMtY29tcGF0aWJsZSBzZWxlY3RvciBmb3IgZGlyZWN0aXZlIGRlZlxuZnVuY3Rpb24gY3JlYXRlRGlyZWN0aXZlU2VsZWN0b3Ioc2VsZWN0b3I6IHN0cmluZyB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gYXNMaXRlcmFsKGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzZWxlY3RvcikpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KGF0dHJpYnV0ZXM6IGFueSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgby5saXRlcmFsKHZhbHVlKSk7XG4gIH1cbiAgaWYgKHZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBSZXR1cm4gYSBjb250ZW50UXVlcmllcyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gbWV0YS5xdWVyaWVzLm1hcCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIG51bGwpO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5yZWdpc3RlckNvbnRlbnRRdWVyeSlcbiAgICAgICAgICAuY2FsbEZuKFtxdWVyeURlZmluaXRpb24sIG8udmFyaWFibGUoJ2RpckluZGV4JyldKVxuICAgICAgICAgIC50b1N0bXQoKTtcbiAgICB9KTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICBjb25zdCBwYXJhbWV0ZXJzID0gW25ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSldO1xuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzUmVmcmVzaCBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgbmV3IG8uRm5QYXJhbSgncXVlcnlTdGFydEluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgXTtcbiAgICBjb25zdCBkaXJlY3RpdmVJbnN0YW5jZVZhciA9IG8udmFyaWFibGUoJ2luc3RhbmNlJyk7XG4gICAgLy8gdmFyICR0bXAkOiBhbnk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICAgIC8vIGNvbnN0ICRpbnN0YW5jZSQgPSAkcjMkLsm1bG9hZChkaXJJbmRleCk7XG4gICAgc3RhdGVtZW50cy5wdXNoKGRpcmVjdGl2ZUluc3RhbmNlVmFyLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcblxuICAgIG1ldGEucXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbG9hZFFMQXJnID0gby52YXJpYWJsZSgncXVlcnlTdGFydEluZGV4Jyk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5TGlzdCkuY2FsbEZuKFtcbiAgICAgICAgaWR4ID4gMCA/IGxvYWRRTEFyZy5wbHVzKG8ubGl0ZXJhbChpZHgpKSA6IGxvYWRRTEFyZ1xuICAgICAgXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IHN0cmluZ1tdKTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVR5cGVGb3JEZWYobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgdHlwZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UpOiBvLlR5cGUge1xuICAvLyBPbiB0aGUgdHlwZSBzaWRlLCByZW1vdmUgbmV3bGluZXMgZnJvbSB0aGUgc2VsZWN0b3IgYXMgaXQgd2lsbCBuZWVkIHRvIGZpdCBpbnRvIGEgVHlwZVNjcmlwdFxuICAvLyBzdHJpbmcgbGl0ZXJhbCwgd2hpY2ggbXVzdCBiZSBvbiBvbmUgbGluZS5cbiAgY29uc3Qgc2VsZWN0b3JGb3JUeXBlID0gKG1ldGEuc2VsZWN0b3IgfHwgJycpLnJlcGxhY2UoL1xcbi9nLCAnJyk7XG5cbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKHR5cGVCYXNlLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSksXG4gICAgbWV0YS5leHBvcnRBcyAhPT0gbnVsbCA/IHN0cmluZ0FzVHlwZShtZXRhLmV4cG9ydEFzKSA6IG8uTk9ORV9UWVBFLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLmlucHV0cyksXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEub3V0cHV0cyksXG4gICAgc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5xdWVyaWVzLm1hcChxID0+IHEucHJvcGVydHlOYW1lKSksXG4gIF0pKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB0ZW1wQWxsb2NhdG9yID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHVwZGF0ZVN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBxdWVyeSA9IG1ldGEudmlld1F1ZXJpZXNbaV07XG5cbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy5RKDAsIHNvbWVQcmVkaWNhdGUsIHRydWUpO1xuICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9IGNyZWF0ZVF1ZXJ5RGVmaW5pdGlvbihxdWVyeSwgY29uc3RhbnRQb29sLCBpKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2gocXVlcnlEZWZpbml0aW9uLnRvU3RtdCgpKTtcblxuICAgIC8vIHVwZGF0ZSwgZS5nLiAocjMucVIodG1wID0gcjMuybVsb2FkKDApKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby5saXRlcmFsKGkpXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBlbFZhckV4cDogby5SZWFkVmFyRXhwciwgYmluZGluZ0NvbnRleHQ6IG8uUmVhZFZhckV4cHIsXG4gICAgc3R5bGVCdWlsZGVyOiBTdHlsaW5nQnVpbGRlciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgaG9zdFZhcnNDb3VudDogbnVtYmVyKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBjcmVhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gaG9zdFZhcnNDb3VudDtcbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gbWV0YS50eXBlU291cmNlU3BhbjtcbiAgY29uc3QgZGlyZWN0aXZlU3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KG1ldGEpO1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhiaW5kaW5nQ29udGV4dCwgZXZlbnRCaW5kaW5ncywgbWV0YSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKC4uLmxpc3RlbmVycyk7XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYmluZGluZ3MgPSBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcblxuICBjb25zdCBiaW5kaW5nRm4gPSAoaW1wbGljaXQ6IGFueSwgdmFsdWU6IEFTVCkgPT4ge1xuICAgIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICBudWxsLCBpbXBsaWNpdCwgdmFsdWUsICdiJywgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICB9O1xuICBpZiAoYmluZGluZ3MpIHtcbiAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICBjb25zdCBvcmlnaW5hbFZhcnNDb3VudCA9IHRvdGFsSG9zdFZhcnNDb3VudDtcbiAgICAgIHRvdGFsSG9zdFZhcnNDb3VudCArPSBudW1TbG90cztcbiAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICB9O1xuICAgIGNvbnN0IHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgIC8qIG5ldyBub2RlcyBhcmUgaWxsZWdhbCBoZXJlICovICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIG5vZGUnKSwgaG9zdFZhcnNDb3VudEZuLFxuICAgICAgICAvKiBwaXBlcyBhcmUgaWxsZWdhbCBoZXJlICovICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIHBpcGUnKSk7XG5cbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYmluZGluZ3MpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBiaW5kaW5nLm5hbWU7XG4gICAgICBjb25zdCBzdHlsZVByZWZpeCA9IGdldFN0eWxpbmdQcmVmaXgobmFtZSk7XG4gICAgICBpZiAoc3R5bGVQcmVmaXggPT09ICdzdHlsZScpIHtcbiAgICAgICAgY29uc3Qge3Byb3BlcnR5TmFtZSwgdW5pdH0gPSBwYXJzZU5hbWVkUHJvcGVydHkobmFtZSk7XG4gICAgICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlclN0eWxlSW5wdXQocHJvcGVydHlOYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIHVuaXQsIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2UgaWYgKHN0eWxlUHJlZml4ID09PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0eWxlQnVpbGRlci5yZWdpc3RlckNsYXNzSW5wdXQoXG4gICAgICAgICAgICBwYXJzZU5hbWVkUHJvcGVydHkobmFtZSkucHJvcGVydHlOYW1lLCBiaW5kaW5nLmV4cHJlc3Npb24sIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyByZXNvbHZlIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG9iamVjdHNcbiAgICAgICAgY29uc3QgdmFsdWUgPSBiaW5kaW5nLmV4cHJlc3Npb24udmlzaXQodmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUpO1xuXG4gICAgICAgIGNvbnN0IHtiaW5kaW5nTmFtZSwgaW5zdHJ1Y3Rpb24sIGV4dHJhUGFyYW1zfSA9IGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24obmFtZSk7XG5cbiAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25QYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgICAgIGVsVmFyRXhwLCBvLmxpdGVyYWwoYmluZGluZ05hbWUpLCBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl0pXG4gICAgICAgIF07XG5cbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgICAgby5pbXBvcnRFeHByKGluc3RydWN0aW9uKS5jYWxsRm4oaW5zdHJ1Y3Rpb25QYXJhbXMuY29uY2F0KGV4dHJhUGFyYW1zKSkudG9TdG10KCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3NPckluaXRpYWxWYWx1ZXMpIHtcbiAgICAgIGNvbnN0IGNyZWF0ZUluc3RydWN0aW9uID0gc3R5bGVCdWlsZGVyLmJ1aWxkQ3JlYXRlTGV2ZWxJbnN0cnVjdGlvbihudWxsLCBjb25zdGFudFBvb2wpO1xuICAgICAgaWYgKGNyZWF0ZUluc3RydWN0aW9uKSB7XG4gICAgICAgIGNvbnN0IGNyZWF0ZVN0bXQgPSBjcmVhdGVTdHlsaW5nU3RtdChjcmVhdGVJbnN0cnVjdGlvbiwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmdGbik7XG4gICAgICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChjcmVhdGVTdG10KTtcbiAgICAgIH1cblxuICAgICAgc3R5bGVCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModmFsdWVDb252ZXJ0ZXIpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgICBjb25zdCB1cGRhdGVTdG10ID0gY3JlYXRlU3R5bGluZ1N0bXQoaW5zdHJ1Y3Rpb24sIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pO1xuICAgICAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2godXBkYXRlU3RtdCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBpZiAodG90YWxIb3N0VmFyc0NvdW50KSB7XG4gICAgY3JlYXRlU3RhdGVtZW50cy51bnNoaWZ0KFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuYWxsb2NIb3N0VmFycykuY2FsbEZuKFtvLmxpdGVyYWwodG90YWxIb3N0VmFyc0NvdW50KV0pLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgfHwgdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzRm5OYW1lID0gbWV0YS5uYW1lID8gYCR7bWV0YS5uYW1lfV9Ib3N0QmluZGluZ3NgIDogbnVsbDtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICBpZiAodXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKSk7XG4gICAgfVxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbXG4gICAgICAgICAgbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCksXG4gICAgICAgICAgbmV3IG8uRm5QYXJhbShlbFZhckV4cC5uYW1lICEsIG8uTlVNQkVSX1RZUEUpXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgaG9zdEJpbmRpbmdzRm5OYW1lKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTdHlsaW5nU3RtdChcbiAgICBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9uLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKTogby5TdGF0ZW1lbnQge1xuICBjb25zdCBwYXJhbXMgPSBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBudWxsLCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuKVxuICAgICAgLmNhbGxGbihwYXJhbXMsIGluc3RydWN0aW9uLnNvdXJjZVNwYW4pXG4gICAgICAudG9TdG10KCk7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZ05hbWU6IHN0cmluZyk6XG4gICAge2JpbmRpbmdOYW1lOiBzdHJpbmcsIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBleHRyYVBhcmFtczogby5FeHByZXNzaW9uW119IHtcbiAgbGV0IGluc3RydWN0aW9uICE6IG8uRXh0ZXJuYWxSZWZlcmVuY2U7XG4gIGNvbnN0IGV4dHJhUGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGlzIGlzIGFuIGF0dHIgYmluZGluZyBvciBhIHByb3BlcnR5IGJpbmRpbmdcbiAgY29uc3QgYXR0ck1hdGNoZXMgPSBiaW5kaW5nTmFtZS5tYXRjaChBVFRSX1JFR0VYKTtcbiAgaWYgKGF0dHJNYXRjaGVzKSB7XG4gICAgYmluZGluZ05hbWUgPSBhdHRyTWF0Y2hlc1sxXTtcbiAgICBpbnN0cnVjdGlvbiA9IFIzLmVsZW1lbnRBdHRyaWJ1dGU7XG4gIH0gZWxzZSB7XG4gICAgaW5zdHJ1Y3Rpb24gPSBSMy5lbGVtZW50UHJvcGVydHk7XG4gICAgZXh0cmFQYXJhbXMucHVzaChcbiAgICAgICAgby5saXRlcmFsKG51bGwpLCAgLy8gVE9ETzogVGhpcyBzaG91bGQgYmUgYSBzYW5pdGl6ZXIgZm4gKEZXLTc4NSlcbiAgICAgICAgby5saXRlcmFsKHRydWUpICAgLy8gaG9zdCBiaW5kaW5ncyBtdXN0IGhhdmUgbmF0aXZlT25seSBwcm9wIHNldCB0byB0cnVlXG4gICAgICAgICk7XG4gIH1cblxuICByZXR1cm4ge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgZXh0cmFQYXJhbXN9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0TGlzdGVuZXJzKFxuICAgIGJpbmRpbmdDb250ZXh0OiBvLkV4cHJlc3Npb24sIGV2ZW50QmluZGluZ3M6IFBhcnNlZEV2ZW50W10sXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uU3RhdGVtZW50W10ge1xuICByZXR1cm4gZXZlbnRCaW5kaW5ncy5tYXAoYmluZGluZyA9PiB7XG4gICAgY29uc3QgYmluZGluZ0V4cHIgPSBjb252ZXJ0QWN0aW9uQmluZGluZyhcbiAgICAgICAgbnVsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmcuaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgIGNvbnN0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9XG4gICAgICAgIHR5cGVOYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7dHlwZU5hbWV9XyR7YmluZGluZ05hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgIGNvbnN0IGhhbmRsZXIgPSBvLmZuKFxuICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSwgWy4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10c10sIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgbnVsbCwgZnVuY3Rpb25OYW1lKTtcbiAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmxpc3RlbmVyKS5jYWxsRm4oW28ubGl0ZXJhbChiaW5kaW5nLm5hbWUpLCBoYW5kbGVyXSkudG9TdG10KCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgaG9zdEF0dHJpYnV0ZXM6IG1ldGEuaG9zdC5hdHRyaWJ1dGVzLFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/Oig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSl8KFxcQFstXFx3XSspJC87XG5cbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCIsIG9yIFwiYXR0ci5yb2xlXCIgZnJvbSBcIlthdHRyLnJvbGVdXCJcbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxuXG4gIC8vIGdyb3VwIDM6IFwiQHRyaWdnZXJcIiBmcm9tIFwiQHRyaWdnZXJcIlxuICBBbmltYXRpb24gPSAzLFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIb3N0QmluZGluZ3MoaG9zdDoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiB7XG4gIGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgYW5pbWF0aW9uczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG59IHtcbiAgY29uc3QgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBwcm9wZXJ0aWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBhbmltYXRpb25zOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKGhvc3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICBjb25zdCBtYXRjaGVzID0ga2V5Lm1hdGNoKEhPU1RfUkVHX0VYUCk7XG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIGF0dHJpYnV0ZXNba2V5XSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5BbmltYXRpb25dICE9IG51bGwpIHtcbiAgICAgIGFuaW1hdGlvbnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkFuaW1hdGlvbl1dID0gdmFsdWU7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgYW5pbWF0aW9uc307XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVTdHlsZXMoc3R5bGVzOiBzdHJpbmdbXSwgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcbiAgcmV0dXJuIHN0eWxlcy5tYXAoc3R5bGUgPT4geyByZXR1cm4gc2hhZG93Q3NzICEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpOyB9KTtcbn1cblxuZnVuY3Rpb24gcGFyc2VOYW1lZFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IHtwcm9wZXJ0eU5hbWU6IHN0cmluZywgdW5pdDogc3RyaW5nfSB7XG4gIGxldCB1bml0ID0gJyc7XG4gIGxldCBwcm9wZXJ0eU5hbWUgPSAnJztcbiAgY29uc3QgaW5kZXggPSBuYW1lLmluZGV4T2YoJy4nKTtcbiAgaWYgKGluZGV4ID4gMCkge1xuICAgIGNvbnN0IHVuaXRJbmRleCA9IG5hbWUubGFzdEluZGV4T2YoJy4nKTtcbiAgICBpZiAodW5pdEluZGV4ICE9PSBpbmRleCkge1xuICAgICAgdW5pdCA9IG5hbWUuc3Vic3RyaW5nKHVuaXRJbmRleCArIDEsIG5hbWUubGVuZ3RoKTtcbiAgICAgIHByb3BlcnR5TmFtZSA9IG5hbWUuc3Vic3RyaW5nKGluZGV4ICsgMSwgdW5pdEluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvcGVydHlOYW1lID0gbmFtZS5zdWJzdHJpbmcoaW5kZXggKyAxLCBuYW1lLmxlbmd0aCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB7cHJvcGVydHlOYW1lLCB1bml0fTtcbn1cbiJdfQ==