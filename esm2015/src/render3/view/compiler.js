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
import * as o from '../../output/output_ast';
import { typeSourceSpan } from '../../parse_util';
import { CssSelector, SelectorMatcher } from '../../selector';
import { ShadowCss } from '../../shadow_css';
import { CONTENT_ATTR, HOST_ATTR } from '../../style_compiler';
import { error } from '../../util';
import { compileFactoryFunction, dependenciesFromGlobalMetadata } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { typeWithParameters } from '../util';
import { BindingScope, TemplateDefinitionBuilder, ValueConverter, renderFlagCheckIfStmt } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
const EMPTY_ARRAY = [];
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
    // Initialize hostVars to number of bound host properties (interpolations illegal)
    let hostVars = Object.keys(meta.host.properties).length;
    // e.g. `hostBindings: (dirIndex, elIndex) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta, bindingParser, constantPool, (slots) => {
        const originalSlots = hostVars;
        hostVars += slots;
        return originalSlots;
    }));
    if (hostVars) {
        // e.g. `hostVars: 2
        definitionMap.set('hostVars', o.literal(hostVars));
    }
    // e.g. `attributes: ['role', 'listbox']`
    definitionMap.set('attributes', createHostAttributesArray(meta));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    // e.g. `features: [NgOnChangesFeature]`
    const features = [];
    // TODO: add `PublicFeature` so that directives get registered to the DI - make this configurable
    features.push(o.importExpr(R3.PublicFeature));
    if (meta.usesInheritance) {
        features.push(o.importExpr(R3.InheritDefinitionFeature));
    }
    if (meta.lifecycle.usesOnChanges) {
        features.push(o.importExpr(R3.NgOnChangesFeature));
    }
    if (features.length) {
        definitionMap.set('features', o.literalArr(features));
    }
    if (meta.exportAs !== null) {
        definitionMap.set('exportAs', o.literal(meta.exportAs));
    }
    return { definitionMap, statements: result.statements };
}
/**
 * Compile a directive for the render3 runtime as defined by the `R3DirectiveMetadata`.
 */
export function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
    const { definitionMap, statements } = baseDirectiveFields(meta, constantPool, bindingParser);
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
    if (meta.directives.size) {
        const matcher = new SelectorMatcher();
        meta.directives.forEach((expression, selector) => {
            matcher.addSelectables(CssSelector.parse(selector), expression);
        });
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
    const templateBuilder = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML, meta.template.relativeContextFilePath);
    const templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, [], template.hasNgContent, template.ngContentSelectors);
    // e.g. `consts: 2`
    definitionMap.set('consts', o.literal(templateBuilder.getConstCount()));
    // e.g. `vars: 2`
    definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
    definitionMap.set('template', templateFunctionExpression);
    // e.g. `directives: [MyDirective]`
    if (directivesUsed.size) {
        let directivesExpr = o.literalArr(Array.from(directivesUsed));
        if (meta.wrapDirectivesInClosure) {
            directivesExpr = o.fn([], [new o.ReturnStatement(directivesExpr)]);
        }
        definitionMap.set('directives', directivesExpr);
    }
    // e.g. `pipes: [MyPipe]`
    if (pipesUsed.size) {
        definitionMap.set('pipes', o.literalArr(Array.from(pipesUsed)));
    }
    // e.g. `styles: [str1, str2]`
    if (meta.styles && meta.styles.length) {
        const styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
            compileStyles(meta.styles, CONTENT_ATTR, HOST_ATTR) :
            meta.styles;
        const strings = styleValues.map(str => o.literal(str));
        definitionMap.set('styles', o.literalArr(strings));
    }
    // e.g. `animations: [trigger('123', [])]`
    if (meta.animations !== null) {
        definitionMap.set('data', o.literalMap([{ key: 'animations', value: meta.animations, quoted: false }]));
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
    const meta = Object.assign({}, directiveMetadataFromGlobalMetadata(component, outputCtx, reflector), { selector: component.selector, template: {
            nodes: render3Ast.nodes,
            hasNgContent: render3Ast.hasNgContent,
            ngContentSelectors: render3Ast.ngContentSelectors,
            relativeContextFilePath: '',
        }, directives: typeMapToExpressionMap(directiveTypeBySel, outputCtx), pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx), wrapDirectivesInClosure: false, styles: (summary.template && summary.template.styles) || EMPTY_ARRAY, encapsulation: (summary.template && summary.template.encapsulation) || core.ViewEncapsulation.Emulated, animations: null });
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
    // e.g. r3.Q(null, somePredicate, false) or r3.Q(0, ['div'], false)
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
function createHostAttributesArray(meta) {
    const values = [];
    const attributes = meta.host.attributes;
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
            return o.importExpr(R3.registerContentQuery).callFn([queryDefinition]).toStmt();
        });
        const typeName = meta.name;
        return o.fn([], statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_ContentQueries` : null);
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
    const mapValues = Object.keys(map).map(key => ({
        key,
        value: o.literal(map[key]),
        quoted: true,
    }));
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
function createHostBindingsFunction(meta, bindingParser, constantPool, allocatePureFunctionSlots) {
    const statements = [];
    const hostBindingSourceSpan = meta.typeSourceSpan;
    const directiveSummary = metadataAsSummary(meta);
    // Calculate the host property bindings
    const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    const bindingContext = o.importExpr(R3.load).callFn([o.variable('dirIndex')]);
    if (bindings) {
        const valueConverter = new ValueConverter(constantPool, 
        /* new nodes are illegal here */ () => error('Unexpected node'), allocatePureFunctionSlots, 
        /* pipes are illegal here */ () => error('Unexpected pipe'));
        for (const binding of bindings) {
            // resolve literal arrays and literal objects
            const value = binding.expression.visit(valueConverter);
            const bindingExpr = convertPropertyBinding(null, bindingContext, value, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
            statements.push(...bindingExpr.stmts);
            statements.push(o.importExpr(R3.elementProperty)
                .callFn([
                o.variable('elIndex'),
                o.literal(binding.name),
                o.importExpr(R3.bind).callFn([bindingExpr.currValExpr]),
            ])
                .toStmt());
        }
    }
    // Calculate host event bindings
    const eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
    if (eventBindings) {
        for (const binding of eventBindings) {
            const bindingExpr = convertActionBinding(null, bindingContext, binding.handler, 'b', () => error('Unexpected interpolation'));
            const bindingName = binding.name && sanitizeIdentifier(binding.name);
            const typeName = meta.name;
            const functionName = typeName && bindingName ? `${typeName}_${bindingName}_HostBindingHandler` : null;
            const handler = o.fn([new o.FnParam('$event', o.DYNAMIC_TYPE)], [...bindingExpr.stmts, new o.ReturnStatement(bindingExpr.allowDefault)], o.INFERRED_TYPE, null, functionName);
            statements.push(o.importExpr(R3.listener).callFn([o.literal(binding.name), handler]).toStmt());
        }
    }
    if (statements.length > 0) {
        const typeName = meta.name;
        return o.fn([
            new o.FnParam('dirIndex', o.NUMBER_TYPE),
            new o.FnParam('elIndex', o.NUMBER_TYPE),
        ], statements, o.INFERRED_TYPE, null, typeName ? `${typeName}_HostBindings` : null);
    }
    return null;
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
        else if (matches[1 /* Property */] != null) {
            properties[matches[1 /* Property */]] = value;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBZ0csY0FBYyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFDLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRW5ILE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQzVELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBRTdELE9BQU8sRUFBZ0IsS0FBSyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNyRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUczQyxPQUFPLEVBQUMsWUFBWSxFQUFFLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxxQkFBcUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUMxRyxPQUFPLEVBQUMsWUFBWSxFQUFFLGFB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QUMsQ0FBQztJQUVILE9BQU8sRUFBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUMsQ0FBQztBQUN6RCxDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsTUFBZ0IsRUFBRSxRQUFnQixFQUFFLFlBQW9CO0lBQzdFLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7SUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsT0FBTyxTQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgQ29tcGlsZVRva2VuTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi8uLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbCwgRGVmaW5pdGlvbktpbmR9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7TGlmZWN5Y2xlSG9va3N9IGZyb20gJy4uLy4uL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3R5cGVTb3VyY2VTcGFufSBmcm9tICcuLi8uLi9wYXJzZV91dGlsJztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtTaGFkb3dDc3N9IGZyb20gJy4uLy4uL3NoYWRvd19jc3MnO1xuaW1wb3J0IHtDT05URU5UX0FUVFIsIEhPU1RfQVRUUn0gZnJvbSAnLi4vLi4vc3R5bGVfY29tcGlsZXInO1xuaW1wb3J0IHtCaW5kaW5nUGFyc2VyfSBmcm9tICcuLi8uLi90ZW1wbGF0ZV9wYXJzZXIvYmluZGluZ19wYXJzZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0LCBlcnJvcn0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQge2NvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YX0gZnJvbSAnLi4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge1JlbmRlcjNQYXJzZVJlc3VsdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7dHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtSM0NvbXBvbmVudERlZiwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVEZWYsIFIzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsIFZhbHVlQ29udmVydGVyLCByZW5kZXJGbGFnQ2hlY2tJZlN0bXR9IGZyb20gJy4vdGVtcGxhdGUnO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIERlZmluaXRpb25NYXAsIFJFTkRFUl9GTEFHUywgVEVNUE9SQVJZX05BTUUsIGFzTGl0ZXJhbCwgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwsIGdldFF1ZXJ5UHJlZGljYXRlLCBtYXBUb0V4cHJlc3Npb24sIHRlbXBvcmFyeUFsbG9jYXRvcn0gZnJvbSAnLi91dGlsJztcblxuY29uc3QgRU1QVFlfQVJSQVk6IGFueVtdID0gW107XG5cbmZ1bmN0aW9uIGJhc2VEaXJlY3RpdmVGaWVsZHMoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IHtkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdfSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBuZXcgRGVmaW5pdGlvbk1hcCgpO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15RGlyZWN0aXZlYFxuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEudHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihtZXRhLnNlbGVjdG9yICEpKTtcblxuXG4gIC8vIGUuZy4gYGZhY3Rvcnk6ICgpID0+IG5ldyBNeUFwcChkaXJlY3RpdmVJbmplY3QoRWxlbWVudFJlZikpYFxuICBjb25zdCByZXN1bHQgPSBjb21waWxlRmFjdG9yeUZ1bmN0aW9uKHtcbiAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgdHlwZTogbWV0YS50eXBlLFxuICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICBpbmplY3RGbjogUjMuZGlyZWN0aXZlSW5qZWN0LFxuICB9KTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZhY3RvcnknLCByZXN1bHQuZmFjdG9yeSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzJywgY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihtZXRhLCBjb25zdGFudFBvb2wpKTtcblxuICBkZWZpbml0aW9uTWFwLnNldCgnY29udGVudFF1ZXJpZXNSZWZyZXNoJywgY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YSkpO1xuXG4gIC8vIEluaXRpYWxpemUgaG9zdFZhcnMgdG8gbnVtYmVyIG9mIGJvdW5kIGhvc3QgcHJvcGVydGllcyAoaW50ZXJwb2xhdGlvbnMgaWxsZWdhbClcbiAgbGV0IGhvc3RWYXJzID0gT2JqZWN0LmtleXMobWV0YS5ob3N0LnByb3BlcnRpZXMpLmxlbmd0aDtcblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChkaXJJbmRleCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICdob3N0QmluZGluZ3MnLFxuICAgICAgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24obWV0YSwgYmluZGluZ1BhcnNlciwgY29uc3RhbnRQb29sLCAoc2xvdHM6IG51bWJlcikgPT4ge1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gaG9zdFZhcnM7XG4gICAgICAgIGhvc3RWYXJzICs9IHNsb3RzO1xuICAgICAgICByZXR1cm4gb3JpZ2luYWxTbG90cztcbiAgICAgIH0pKTtcblxuICBpZiAoaG9zdFZhcnMpIHtcbiAgICAvLyBlLmcuIGBob3N0VmFyczogMlxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdob3N0VmFycycsIG8ubGl0ZXJhbChob3N0VmFycykpO1xuICB9XG5cbiAgLy8gZS5nLiBgYXR0cmlidXRlczogWydyb2xlJywgJ2xpc3Rib3gnXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2F0dHJpYnV0ZXMnLCBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KG1ldGEpKTtcblxuICAvLyBlLmcgJ2lucHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLmlucHV0cykpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAvLyBUT0RPOiBhZGQgYFB1YmxpY0ZlYXR1cmVgIHNvIHRoYXQgZGlyZWN0aXZlcyBnZXQgcmVnaXN0ZXJlZCB0byB0aGUgREkgLSBtYWtlIHRoaXMgY29uZmlndXJhYmxlXG4gIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLlB1YmxpY0ZlYXR1cmUpKTtcblxuICBpZiAobWV0YS51c2VzSW5oZXJpdGFuY2UpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Jbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUpKTtcbiAgfVxuICBpZiAobWV0YS5saWZlY3ljbGUudXNlc09uQ2hhbmdlcykge1xuICAgIGZlYXR1cmVzLnB1c2goby5pbXBvcnRFeHByKFIzLk5nT25DaGFuZ2VzRmVhdHVyZSkpO1xuICB9XG4gIGlmIChmZWF0dXJlcy5sZW5ndGgpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZmVhdHVyZXMnLCBvLmxpdGVyYWxBcnIoZmVhdHVyZXMpKTtcbiAgfVxuICBpZiAobWV0YS5leHBvcnRBcyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdleHBvcnRBcycsIG8ubGl0ZXJhbChtZXRhLmV4cG9ydEFzKSk7XG4gIH1cblxuICByZXR1cm4ge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHM6IHJlc3VsdC5zdGF0ZW1lbnRzfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzRGlyZWN0aXZlRGVmIHtcbiAgY29uc3Qge2RlZmluaXRpb25NYXAsIHN0YXRlbWVudHN9ID0gYmFzZURpcmVjdGl2ZUZpZWxkcyhtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG5cbiAgLy8gT24gdGhlIHR5cGUgc2lkZSwgcmVtb3ZlIG5ld2xpbmVzIGZyb20gdGhlIHNlbGVjdG9yIGFzIGl0IHdpbGwgbmVlZCB0byBmaXQgaW50byBhIFR5cGVTY3JpcHRcbiAgLy8gc3RyaW5nIGxpdGVyYWwsIHdoaWNoIG11c3QgYmUgb24gb25lIGxpbmUuXG4gIGNvbnN0IHNlbGVjdG9yRm9yVHlwZSA9IChtZXRhLnNlbGVjdG9yIHx8ICcnKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkRpcmVjdGl2ZURlZldpdGhNZXRhKTtcbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSM0Jhc2VSZWZNZXRhRGF0YSB7XG4gIGlucHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmcgfCBbc3RyaW5nLCBzdHJpbmddfTtcbiAgb3V0cHV0cz86IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBiYXNlIGRlZmluaXRpb24gZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB7QGxpbmsgUjNCYXNlUmVmTWV0YWRhdGF9XG4gKiBAcGFyYW0gbWV0YSB0aGUgbWV0YWRhdGEgdXNlZCBmb3IgY29tcGlsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQmFzZURlZkZyb21NZXRhZGF0YShtZXRhOiBSM0Jhc2VSZWZNZXRhRGF0YSkge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXAoKTtcbiAgaWYgKG1ldGEuaW5wdXRzKSB7XG4gICAgY29uc3QgaW5wdXRzID0gbWV0YS5pbnB1dHM7XG4gICAgY29uc3QgaW5wdXRzTWFwID0gT2JqZWN0LmtleXMoaW5wdXRzKS5tYXAoa2V5ID0+IHtcbiAgICAgIGNvbnN0IHYgPSBpbnB1dHNba2V5XTtcbiAgICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheSh2KSA/IG8ubGl0ZXJhbEFycih2Lm1hcCh2eCA9PiBvLmxpdGVyYWwodngpKSkgOiBvLmxpdGVyYWwodik7XG4gICAgICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xuICAgIH0pO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBvLmxpdGVyYWxNYXAoaW5wdXRzTWFwKSk7XG4gIH1cbiAgaWYgKG1ldGEub3V0cHV0cykge1xuICAgIGNvbnN0IG91dHB1dHMgPSBtZXRhLm91dHB1dHM7XG4gICAgY29uc3Qgb3V0cHV0c01hcCA9IE9iamVjdC5rZXlzKG91dHB1dHMpLm1hcChrZXkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBvLmxpdGVyYWwob3V0cHV0c1trZXldKTtcbiAgICAgIHJldHVybiB7a2V5LCB2YWx1ZSwgcXVvdGVkOiBmYWxzZX07XG4gICAgfSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ291dHB1dHMnLCBvLmxpdGVyYWxNYXAob3V0cHV0c01hcCkpO1xuICB9XG5cbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVCYXNlKS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkJhc2VEZWYpKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZm9yIHRoZSByZW5kZXIzIHJ1bnRpbWUgYXMgZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICBtZXRhOiBSM0NvbXBvbmVudE1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCxcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogUjNDb21wb25lbnREZWYge1xuICBjb25zdCB7ZGVmaW5pdGlvbk1hcCwgc3RhdGVtZW50c30gPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJywgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5zaXplKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBtZXRhLmRpcmVjdGl2ZXMuZm9yRWFjaCgoZXhwcmVzc2lvbiwgc2VsZWN0b3I6IHN0cmluZykgPT4ge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH0pO1xuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG5cbiAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICBjb25zdCB0ZW1wbGF0ZUJ1aWxkZXIgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgIGNvbnN0YW50UG9vbCwgQmluZGluZ1Njb3BlLlJPT1RfU0NPUEUsIDAsIHRlbXBsYXRlVHlwZU5hbWUsIHRlbXBsYXRlTmFtZSwgbWV0YS52aWV3UXVlcmllcyxcbiAgICAgIGRpcmVjdGl2ZU1hdGNoZXIsIGRpcmVjdGl2ZXNVc2VkLCBtZXRhLnBpcGVzLCBwaXBlc1VzZWQsIFIzLm5hbWVzcGFjZUhUTUwsXG4gICAgICBtZXRhLnRlbXBsYXRlLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoKTtcblxuICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbiA9IHRlbXBsYXRlQnVpbGRlci5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICB0ZW1wbGF0ZS5ub2RlcywgW10sIHRlbXBsYXRlLmhhc05nQ29udGVudCwgdGVtcGxhdGUubmdDb250ZW50U2VsZWN0b3JzKTtcblxuICAvLyBlLmcuIGBjb25zdHM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb25zdHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24pO1xuXG4gIC8vIGUuZy4gYGRpcmVjdGl2ZXM6IFtNeURpcmVjdGl2ZV1gXG4gIGlmIChkaXJlY3RpdmVzVXNlZC5zaXplKSB7XG4gICAgbGV0IGRpcmVjdGl2ZXNFeHByOiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShkaXJlY3RpdmVzVXNlZCkpO1xuICAgIGlmIChtZXRhLndyYXBEaXJlY3RpdmVzSW5DbG9zdXJlKSB7XG4gICAgICBkaXJlY3RpdmVzRXhwciA9IG8uZm4oW10sIFtuZXcgby5SZXR1cm5TdGF0ZW1lbnQoZGlyZWN0aXZlc0V4cHIpXSk7XG4gICAgfVxuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgZGlyZWN0aXZlc0V4cHIpO1xuICB9XG5cbiAgLy8gZS5nLiBgcGlwZXM6IFtNeVBpcGVdYFxuICBpZiAocGlwZXNVc2VkLnNpemUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncGlwZXMnLCBvLmxpdGVyYWxBcnIoQXJyYXkuZnJvbShwaXBlc1VzZWQpKSk7XG4gIH1cblxuICAvLyBlLmcuIGBzdHlsZXM6IFtzdHIxLCBzdHIyXWBcbiAgaWYgKG1ldGEuc3R5bGVzICYmIG1ldGEuc3R5bGVzLmxlbmd0aCkge1xuICAgIGNvbnN0IHN0eWxlVmFsdWVzID0gbWV0YS5lbmNhcHN1bGF0aW9uID09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQgP1xuICAgICAgICBjb21waWxlU3R5bGVzKG1ldGEuc3R5bGVzLCBDT05URU5UX0FUVFIsIEhPU1RfQVRUUikgOlxuICAgICAgICBtZXRhLnN0eWxlcztcbiAgICBjb25zdCBzdHJpbmdzID0gc3R5bGVWYWx1ZXMubWFwKHN0ciA9PiBvLmxpdGVyYWwoc3RyKSk7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3N0eWxlcycsIG8ubGl0ZXJhbEFycihzdHJpbmdzKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb25zOiBbdHJpZ2dlcignMTIzJywgW10pXWBcbiAgaWYgKG1ldGEuYW5pbWF0aW9ucyAhPT0gbnVsbCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZGF0YScsIG8ubGl0ZXJhbE1hcChbe2tleTogJ2FuaW1hdGlvbnMnLCB2YWx1ZTogbWV0YS5hbmltYXRpb25zLCBxdW90ZWQ6IGZhbHNlfV0pKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVUeXBlRm9yRGVmKG1ldGEsIFIzLkNvbXBvbmVudERlZldpdGhNZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHN9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBub2RlczogcmVuZGVyM0FzdC5ub2RlcyxcbiAgICAgIGhhc05nQ29udGVudDogcmVuZGVyM0FzdC5oYXNOZ0NvbnRlbnQsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHJlbmRlcjNBc3QubmdDb250ZW50U2VsZWN0b3JzLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgIH0sXG4gICAgZGlyZWN0aXZlczogdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChkaXJlY3RpdmVUeXBlQnlTZWwsIG91dHB1dEN0eCksXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIHdyYXBEaXJlY3RpdmVzSW5DbG9zdXJlOiBmYWxzZSxcbiAgICBzdHlsZXM6IChzdW1tYXJ5LnRlbXBsYXRlICYmIHN1bW1hcnkudGVtcGxhdGUuc3R5bGVzKSB8fCBFTVBUWV9BUlJBWSxcbiAgICBlbmNhcHN1bGF0aW9uOlxuICAgICAgICAoc3VtbWFyeS50ZW1wbGF0ZSAmJiBzdW1tYXJ5LnRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pIHx8IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQsXG4gICAgYW5pbWF0aW9uczogbnVsbCxcbiAgfTtcbiAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgZ2l2ZW4gYENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YWAgYW5kIGEgYENvbXBpbGVSZWZsZWN0b3JgLlxuICovXG5mdW5jdGlvbiBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShcbiAgICBkaXJlY3RpdmU6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3Rvcik6IFIzRGlyZWN0aXZlTWV0YWRhdGEge1xuICBjb25zdCBzdW1tYXJ5ID0gZGlyZWN0aXZlLnRvU3VtbWFyeSgpO1xuICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoZGlyZWN0aXZlLnR5cGUpICE7XG4gIG5hbWUgfHwgZXJyb3IoYENhbm5vdCByZXNvbHZlciB0aGUgbmFtZSBvZiAke2RpcmVjdGl2ZS50eXBlfWApO1xuXG4gIHJldHVybiB7XG4gICAgbmFtZSxcbiAgICB0eXBlOiBvdXRwdXRDdHguaW1wb3J0RXhwcihkaXJlY3RpdmUudHlwZS5yZWZlcmVuY2UpLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIHR5cGVTb3VyY2VTcGFuOlxuICAgICAgICB0eXBlU291cmNlU3BhbihkaXJlY3RpdmUuaXNDb21wb25lbnQgPyAnQ29tcG9uZW50JyA6ICdEaXJlY3RpdmUnLCBkaXJlY3RpdmUudHlwZSksXG4gICAgc2VsZWN0b3I6IGRpcmVjdGl2ZS5zZWxlY3RvcixcbiAgICBkZXBzOiBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLnR5cGUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBxdWVyaWVzOiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKGRpcmVjdGl2ZS5xdWVyaWVzLCBvdXRwdXRDdHgpLFxuICAgIGxpZmVjeWNsZToge1xuICAgICAgdXNlc09uQ2hhbmdlczpcbiAgICAgICAgICBkaXJlY3RpdmUudHlwZS5saWZlY3ljbGVIb29rcy5zb21lKGxpZmVjeWNsZSA9PiBsaWZlY3ljbGUgPT0gTGlmZWN5Y2xlSG9va3MuT25DaGFuZ2VzKSxcbiAgICB9LFxuICAgIGhvc3Q6IHtcbiAgICAgIGF0dHJpYnV0ZXM6IGRpcmVjdGl2ZS5ob3N0QXR0cmlidXRlcyxcbiAgICAgIGxpc3RlbmVyczogc3VtbWFyeS5ob3N0TGlzdGVuZXJzLFxuICAgICAgcHJvcGVydGllczogc3VtbWFyeS5ob3N0UHJvcGVydGllcyxcbiAgICB9LFxuICAgIGlucHV0czogZGlyZWN0aXZlLmlucHV0cyxcbiAgICBvdXRwdXRzOiBkaXJlY3RpdmUub3V0cHV0cyxcbiAgICB1c2VzSW5oZXJpdGFuY2U6IGZhbHNlLFxuICAgIGV4cG9ydEFzOiBudWxsLFxuICB9O1xufVxuXG4vKipcbiAqIENvbnZlcnQgYENvbXBpbGVRdWVyeU1ldGFkYXRhYCBpbnRvIGBSM1F1ZXJ5TWV0YWRhdGFgLlxuICovXG5mdW5jdGlvbiBxdWVyaWVzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHF1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW10sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IFIzUXVlcnlNZXRhZGF0YVtdIHtcbiAgcmV0dXJuIHF1ZXJpZXMubWFwKHF1ZXJ5ID0+IHtcbiAgICBsZXQgcmVhZDogby5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGlmIChxdWVyeS5yZWFkICYmIHF1ZXJ5LnJlYWQuaWRlbnRpZmllcikge1xuICAgICAgcmVhZCA9IG91dHB1dEN0eC5pbXBvcnRFeHByKHF1ZXJ5LnJlYWQuaWRlbnRpZmllci5yZWZlcmVuY2UpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgcHJvcGVydHlOYW1lOiBxdWVyeS5wcm9wZXJ0eU5hbWUsXG4gICAgICBmaXJzdDogcXVlcnkuZmlyc3QsXG4gICAgICBwcmVkaWNhdGU6IHNlbGVjdG9yc0Zyb21HbG9iYWxNZXRhZGF0YShxdWVyeS5zZWxlY3RvcnMsIG91dHB1dEN0eCksXG4gICAgICBkZXNjZW5kYW50czogcXVlcnkuZGVzY2VuZGFudHMsIHJlYWQsXG4gICAgfTtcbiAgfSk7XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVRva2VuTWV0YWRhdGFgIGZvciBxdWVyeSBzZWxlY3RvcnMgaW50byBlaXRoZXIgYW4gZXhwcmVzc2lvbiBmb3IgYSBwcmVkaWNhdGVcbiAqIHR5cGUsIG9yIGEgbGlzdCBvZiBzdHJpbmcgcHJlZGljYXRlcy5cbiAqL1xuZnVuY3Rpb24gc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIHNlbGVjdG9yczogQ29tcGlsZVRva2VuTWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogby5FeHByZXNzaW9ufHN0cmluZ1tdIHtcbiAgaWYgKHNlbGVjdG9ycy5sZW5ndGggPiAxIHx8IChzZWxlY3RvcnMubGVuZ3RoID09IDEgJiYgc2VsZWN0b3JzWzBdLnZhbHVlKSkge1xuICAgIGNvbnN0IHNlbGVjdG9yU3RyaW5ncyA9IHNlbGVjdG9ycy5tYXAodmFsdWUgPT4gdmFsdWUudmFsdWUgYXMgc3RyaW5nKTtcbiAgICBzZWxlY3RvclN0cmluZ3Muc29tZSh2YWx1ZSA9PiAhdmFsdWUpICYmXG4gICAgICAgIGVycm9yKCdGb3VuZCBhIHR5cGUgYW1vbmcgdGhlIHN0cmluZyBzZWxlY3RvcnMgZXhwZWN0ZWQnKTtcbiAgICByZXR1cm4gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoXG4gICAgICAgIG8ubGl0ZXJhbEFycihzZWxlY3RvclN0cmluZ3MubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSk7XG4gIH1cblxuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA9PSAxKSB7XG4gICAgY29uc3QgZmlyc3QgPSBzZWxlY3RvcnNbMF07XG4gICAgaWYgKGZpcnN0LmlkZW50aWZpZXIpIHtcbiAgICAgIHJldHVybiBvdXRwdXRDdHguaW1wb3J0RXhwcihmaXJzdC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICB9XG5cbiAgZXJyb3IoJ1VuZXhwZWN0ZWQgcXVlcnkgZm9ybScpO1xuICByZXR1cm4gby5OVUxMX0VYUFI7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVF1ZXJ5RGVmaW5pdGlvbihcbiAgICBxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgaWR4OiBudW1iZXIgfCBudWxsKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgcHJlZGljYXRlID0gZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCk7XG5cbiAgLy8gZS5nLiByMy5RKG51bGwsIHNvbWVQcmVkaWNhdGUsIGZhbHNlKSBvciByMy5RKDAsIFsnZGl2J10sIGZhbHNlKVxuICBjb25zdCBwYXJhbWV0ZXJzID0gW1xuICAgIG8ubGl0ZXJhbChpZHgsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgcHJlZGljYXRlLFxuICAgIG8ubGl0ZXJhbChxdWVyeS5kZXNjZW5kYW50cyksXG4gIF07XG5cbiAgaWYgKHF1ZXJ5LnJlYWQpIHtcbiAgICBwYXJhbWV0ZXJzLnB1c2gocXVlcnkucmVhZCk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnF1ZXJ5KS5jYWxsRm4ocGFyYW1ldGVycyk7XG59XG5cbi8vIFR1cm4gYSBkaXJlY3RpdmUgc2VsZWN0b3IgaW50byBhbiBSMy1jb21wYXRpYmxlIHNlbGVjdG9yIGZvciBkaXJlY3RpdmUgZGVmXG5mdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgcmV0dXJuIGFzTGl0ZXJhbChjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3Ioc2VsZWN0b3IpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSG9zdEF0dHJpYnV0ZXNBcnJheShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCB2YWx1ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gIGNvbnN0IGF0dHJpYnV0ZXMgPSBtZXRhLmhvc3QuYXR0cmlidXRlcztcbiAgZm9yIChsZXQga2V5IG9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgdmFsdWVzLnB1c2goby5saXRlcmFsKGtleSksIG8ubGl0ZXJhbCh2YWx1ZSkpO1xuICB9XG4gIGlmICh2YWx1ZXMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gUmV0dXJuIGEgY29udGVudFF1ZXJpZXMgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGlmIChtZXRhLnF1ZXJpZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IG1ldGEucXVlcmllcy5tYXAoKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5RGVmaW5pdGlvbiA9IGNyZWF0ZVF1ZXJ5RGVmaW5pdGlvbihxdWVyeSwgY29uc3RhbnRQb29sLCBudWxsKTtcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMucmVnaXN0ZXJDb250ZW50UXVlcnkpLmNhbGxGbihbcXVlcnlEZWZpbml0aW9uXSkudG9TdG10KCk7XG4gICAgfSk7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtdLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzYCA6IG51bGwpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIFJldHVybiBhIGNvbnRlbnRRdWVyaWVzUmVmcmVzaCBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNSZWZyZXNoRnVuY3Rpb24obWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHR5cGVOYW1lID0gbWV0YS5uYW1lO1xuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgbmV3IG8uRm5QYXJhbSgncXVlcnlTdGFydEluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgXTtcbiAgICBjb25zdCBkaXJlY3RpdmVJbnN0YW5jZVZhciA9IG8udmFyaWFibGUoJ2luc3RhbmNlJyk7XG4gICAgLy8gdmFyICR0bXAkOiBhbnk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcG9yYXJ5QWxsb2NhdG9yKHN0YXRlbWVudHMsIFRFTVBPUkFSWV9OQU1FKTtcblxuICAgIC8vIGNvbnN0ICRpbnN0YW5jZSQgPSAkcjMkLsm1bG9hZChkaXJJbmRleCk7XG4gICAgc3RhdGVtZW50cy5wdXNoKGRpcmVjdGl2ZUluc3RhbmNlVmFyLnNldChvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcblxuICAgIG1ldGEucXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbG9hZFFMQXJnID0gby52YXJpYWJsZSgncXVlcnlTdGFydEluZGV4Jyk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5TGlzdCkuY2FsbEZuKFtcbiAgICAgICAgaWR4ID4gMCA/IGxvYWRRTEFyZy5wbHVzKG8ubGl0ZXJhbChpZHgpKSA6IGxvYWRRTEFyZ1xuICAgICAgXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBc1R5cGUoc3RyOiBzdHJpbmcpOiBvLlR5cGUge1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWwoc3RyKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ01hcEFzVHlwZShtYXA6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KTogby5UeXBlIHtcbiAgY29uc3QgbWFwVmFsdWVzID0gT2JqZWN0LmtleXMobWFwKS5tYXAoa2V5ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiBvLmxpdGVyYWwobWFwW2tleV0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxNYXAobWFwVmFsdWVzKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FycmF5QXNUeXBlKGFycjogc3RyaW5nW10pOiBvLlR5cGUge1xuICByZXR1cm4gYXJyLmxlbmd0aCA+IDAgPyBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbEFycihhcnIubWFwKHZhbHVlID0+IG8ubGl0ZXJhbCh2YWx1ZSkpKSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICBvLk5PTkVfVFlQRTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVHlwZUZvckRlZihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCB0eXBlQmFzZTogby5FeHRlcm5hbFJlZmVyZW5jZSk6IG8uVHlwZSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIodHlwZUJhc2UsIFtcbiAgICB0eXBlV2l0aFBhcmFtZXRlcnMobWV0YS50eXBlLCBtZXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBzdHJpbmdBc1R5cGUoc2VsZWN0b3JGb3JUeXBlKSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXNUeXBlKG1ldGEuZXhwb3J0QXMpIDogby5OT05FX1RZUEUsXG4gICAgc3RyaW5nTWFwQXNUeXBlKG1ldGEuaW5wdXRzKSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5vdXRwdXRzKSxcbiAgICBzdHJpbmdBcnJheUFzVHlwZShtZXRhLnF1ZXJpZXMubWFwKHEgPT4gcS5wcm9wZXJ0eU5hbWUpKSxcbiAgXSkpO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWV0YS52aWV3UXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHF1ZXJ5ID0gbWV0YS52aWV3UXVlcmllc1tpXTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIGkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xUih0bXAgPSByMy7JtWxvYWQoMCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLmxpdGVyYWwoaSldKTtcbiAgICBjb25zdCByZWZyZXNoID0gby5pbXBvcnRFeHByKFIzLnF1ZXJ5UmVmcmVzaCkuY2FsbEZuKFt0ZW1wb3Jhcnkuc2V0KGdldFF1ZXJ5TGlzdCldKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmUgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnByb3AocXVlcnkucHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0KHF1ZXJ5LmZpcnN0ID8gdGVtcG9yYXJ5LnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkpO1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChyZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG1ldGEubmFtZSA/IGAke21ldGEubmFtZX1fUXVlcnlgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB2aWV3UXVlcnlGbk5hbWUpO1xufVxuXG4vLyBSZXR1cm4gYSBob3N0IGJpbmRpbmcgZnVuY3Rpb24gb3IgbnVsbCBpZiBvbmUgaXMgbm90IG5lY2Vzc2FyeS5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RCaW5kaW5nc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChzbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcblxuICBjb25zdCBob3N0QmluZGluZ1NvdXJjZVNwYW4gPSBtZXRhLnR5cGVTb3VyY2VTcGFuO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZVN1bW1hcnkgPSBtZXRhZGF0YUFzU3VtbWFyeShtZXRhKTtcblxuICAvLyBDYWxjdWxhdGUgdGhlIGhvc3QgcHJvcGVydHkgYmluZGluZ3NcbiAgY29uc3QgYmluZGluZ3MgPSBiaW5kaW5nUGFyc2VyLmNyZWF0ZUJvdW5kSG9zdFByb3BlcnRpZXMoZGlyZWN0aXZlU3VtbWFyeSwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgY29uc3QgYmluZGluZ0NvbnRleHQgPSBvLmltcG9ydEV4cHIoUjMubG9hZCkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSk7XG4gIGlmIChiaW5kaW5ncykge1xuICAgIGNvbnN0IHZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgIC8qIG5ldyBub2RlcyBhcmUgaWxsZWdhbCBoZXJlICovICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIG5vZGUnKSwgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyxcbiAgICAgICAgLyogcGlwZXMgYXJlIGlsbGVnYWwgaGVyZSAqLyAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBwaXBlJykpO1xuXG4gICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAvLyByZXNvbHZlIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG9iamVjdHNcbiAgICAgIGNvbnN0IHZhbHVlID0gYmluZGluZy5leHByZXNzaW9uLnZpc2l0KHZhbHVlQ29udmVydGVyKTtcbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICBudWxsLCBiaW5kaW5nQ29udGV4dCwgdmFsdWUsICdiJywgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLFxuICAgICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2goLi4uYmluZGluZ0V4cHIuc3RtdHMpO1xuICAgICAgc3RhdGVtZW50cy5wdXNoKG8uaW1wb3J0RXhwcihSMy5lbGVtZW50UHJvcGVydHkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG8udmFyaWFibGUoJ2VsSW5kZXgnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWwoYmluZGluZy5uYW1lKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFtiaW5kaW5nRXhwci5jdXJyVmFsRXhwcl0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAudG9TdG10KCkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzKSB7XG4gICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGV2ZW50QmluZGluZ3MpIHtcbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydEFjdGlvbkJpbmRpbmcoXG4gICAgICAgICAgbnVsbCwgYmluZGluZ0NvbnRleHQsIGJpbmRpbmcuaGFuZGxlciwgJ2InLCAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgICAgY29uc3QgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9XG4gICAgICAgICAgdHlwZU5hbWUgJiYgYmluZGluZ05hbWUgPyBgJHt0eXBlTmFtZX1fJHtiaW5kaW5nTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgICBjb25zdCBoYW5kbGVyID0gby5mbihcbiAgICAgICAgICBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXSxcbiAgICAgICAgICBbLi4uYmluZGluZ0V4cHIuc3RtdHMsIG5ldyBvLlJldHVyblN0YXRlbWVudChiaW5kaW5nRXhwci5hbGxvd0RlZmF1bHQpXSwgby5JTkZFUlJFRF9UWVBFLFxuICAgICAgICAgIG51bGwsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICBzdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgICAgby5pbXBvcnRFeHByKFIzLmxpc3RlbmVyKS5jYWxsRm4oW28ubGl0ZXJhbChiaW5kaW5nLm5hbWUpLCBoYW5kbGVyXSkudG9TdG10KCkpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChzdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW1xuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgICAgICAgbmV3IG8uRm5QYXJhbSgnZWxJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0hvc3RCaW5kaW5nc2AgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkge1xuICAvLyBjbGFuZy1mb3JtYXQgb2ZmXG4gIHJldHVybiB7XG4gICAgaG9zdEF0dHJpYnV0ZXM6IG1ldGEuaG9zdC5hdHRyaWJ1dGVzLFxuICAgIGhvc3RMaXN0ZW5lcnM6IG1ldGEuaG9zdC5saXN0ZW5lcnMsXG4gICAgaG9zdFByb3BlcnRpZXM6IG1ldGEuaG9zdC5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5mdW5jdGlvbiB0eXBlTWFwVG9FeHByZXNzaW9uTWFwKFxuICAgIG1hcDogTWFwPHN0cmluZywgU3RhdGljU3ltYm9sPiwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiB7XG4gIC8vIENvbnZlcnQgZWFjaCBtYXAgZW50cnkgaW50byBhbm90aGVyIGVudHJ5IHdoZXJlIHRoZSB2YWx1ZSBpcyBhbiBleHByZXNzaW9uIGltcG9ydGluZyB0aGUgdHlwZS5cbiAgY29uc3QgZW50cmllcyA9IEFycmF5LmZyb20obWFwKS5tYXAoXG4gICAgICAoW2tleSwgdHlwZV0pOiBbc3RyaW5nLCBvLkV4cHJlc3Npb25dID0+IFtrZXksIG91dHB1dEN0eC5pbXBvcnRFeHByKHR5cGUpXSk7XG4gIHJldHVybiBuZXcgTWFwKGVudHJpZXMpO1xufVxuXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/Oig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSl8KFxcQFstXFx3XSspJC87XG5cbi8vIFJlcHJlc2VudHMgdGhlIGdyb3VwcyBpbiB0aGUgYWJvdmUgcmVnZXguXG5jb25zdCBlbnVtIEhvc3RCaW5kaW5nR3JvdXAge1xuICAvLyBncm91cCAxOiBcInByb3BcIiBmcm9tIFwiW3Byb3BdXCJcbiAgUHJvcGVydHkgPSAxLFxuXG4gIC8vIGdyb3VwIDI6IFwiZXZlbnRcIiBmcm9tIFwiKGV2ZW50KVwiXG4gIEV2ZW50ID0gMixcblxuICAvLyBncm91cCAzOiBcIkB0cmlnZ2VyXCIgZnJvbSBcIkB0cmlnZ2VyXCJcbiAgQW5pbWF0aW9uID0gMyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSG9zdEJpbmRpbmdzKGhvc3Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9KToge1xuICBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgbGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gIGFuaW1hdGlvbnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxufSB7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgY29uc3QgYW5pbWF0aW9uczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICBPYmplY3Qua2V5cyhob3N0KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSBob3N0W2tleV07XG4gICAgY29uc3QgbWF0Y2hlcyA9IGtleS5tYXRjaChIT1NUX1JFR19FWFApO1xuICAgIGlmIChtYXRjaGVzID09PSBudWxsKSB7XG4gICAgICBhdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5Qcm9wZXJ0eV0gIT0gbnVsbCkge1xuICAgICAgcHJvcGVydGllc1ttYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuUHJvcGVydHldXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBsaXN0ZW5lcnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5BbmltYXRpb25dICE9IG51bGwpIHtcbiAgICAgIGFuaW1hdGlvbnNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkFuaW1hdGlvbl1dID0gdmFsdWU7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge2F0dHJpYnV0ZXMsIGxpc3RlbmVycywgcHJvcGVydGllcywgYW5pbWF0aW9uc307XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVTdHlsZXMoc3R5bGVzOiBzdHJpbmdbXSwgc2VsZWN0b3I6IHN0cmluZywgaG9zdFNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHNoYWRvd0NzcyA9IG5ldyBTaGFkb3dDc3MoKTtcbiAgcmV0dXJuIHN0eWxlcy5tYXAoc3R5bGUgPT4geyByZXR1cm4gc2hhZG93Q3NzICEuc2hpbUNzc1RleHQoc3R5bGUsIHNlbGVjdG9yLCBob3N0U2VsZWN0b3IpOyB9KTtcbn1cbiJdfQ==