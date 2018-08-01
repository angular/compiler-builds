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
import { error } from '../../util';
import { compileFactoryFunction, dependenciesFromGlobalMetadata } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { typeWithParameters } from '../util';
import { BindingScope, TemplateDefinitionBuilder, renderFlagCheckIfStmt } from './template';
import { CONTEXT_NAME, DefinitionMap, RENDER_FLAGS, TEMPORARY_NAME, asLiteral, conditionallyCreateMapObjectLiteral, getQueryPredicate, temporaryAllocator } from './util';
function baseDirectiveFields(meta, constantPool, bindingParser) {
    const definitionMap = new DefinitionMap();
    // e.g. `type: MyDirective`
    definitionMap.set('type', meta.type);
    // e.g. `selectors: [['', 'someDir', '']]`
    definitionMap.set('selectors', createDirectiveSelector(meta.selector));
    // e.g. `factory: () => new MyApp(injectElementRef())`
    definitionMap.set('factory', compileFactoryFunction({
        name: meta.name,
        fnOrClass: meta.type,
        deps: meta.deps,
        useNew: true,
        injectFn: R3.directiveInject,
    }));
    definitionMap.set('contentQueries', createContentQueriesFunction(meta, constantPool));
    definitionMap.set('contentQueriesRefresh', createContentQueriesRefreshFunction(meta));
    // e.g. `hostBindings: (dirIndex, elIndex) => { ... }
    definitionMap.set('hostBindings', createHostBindingsFunction(meta, bindingParser));
    // e.g. `attributes: ['role', 'listbox']`
    definitionMap.set('attributes', createHostAttributesArray(meta));
    // e.g 'inputs: {a: 'a'}`
    definitionMap.set('inputs', conditionallyCreateMapObjectLiteral(meta.inputs));
    // e.g 'outputs: {a: 'a'}`
    definitionMap.set('outputs', conditionallyCreateMapObjectLiteral(meta.outputs));
    // e.g. `features: [NgOnChangesFeature]`
    const features = [];
    if (meta.usesInheritance) {
        features.push(o.importExpr(R3.InheritDefinitionFeature));
    }
    if (meta.lifecycle.usesOnChanges) {
        features.push(o.importExpr(R3.NgOnChangesFeature));
    }
    if (features.length) {
        definitionMap.set('features', o.literalArr(features));
    }
    return definitionMap;
}
/**
 * Compile a directive for the render3 runtime as defined by the `R3DirectiveMetadata`.
 */
export function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
    const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
    const expression = o.importExpr(R3.defineDirective).callFn([definitionMap.toLiteralMap()]);
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    const selectorForType = (meta.selector || '').replace(/\n/g, '');
    const type = new o.ExpressionType(o.importExpr(R3.DirectiveDef, [
        typeWithParameters(meta.type, meta.typeArgumentCount),
        new o.ExpressionType(o.literal(selectorForType))
    ]));
    return { expression, type };
}
/**
 * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
 */
export function compileComponentFromMetadata(meta, constantPool, bindingParser) {
    const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
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
    const templateFunctionExpression = new TemplateDefinitionBuilder(constantPool, BindingScope.ROOT_SCOPE, 0, templateTypeName, templateName, meta.viewQueries, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, R3.namespaceHTML)
        .buildTemplateFunction(template.nodes, [], template.hasNgContent, template.ngContentSelectors);
    definitionMap.set('template', templateFunctionExpression);
    // e.g. `directives: [MyDirective]`
    if (directivesUsed.size) {
        definitionMap.set('directives', o.literalArr(Array.from(directivesUsed)));
    }
    // e.g. `pipes: [MyPipe]`
    if (pipesUsed.size) {
        definitionMap.set('pipes', o.literalArr(Array.from(pipesUsed)));
    }
    // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
    // string literal, which must be on one line.
    const selectorForType = (meta.selector || '').replace(/\n/g, '');
    const expression = o.importExpr(R3.defineComponent).callFn([definitionMap.toLiteralMap()]);
    const type = new o.ExpressionType(o.importExpr(R3.ComponentDef, [
        typeWithParameters(meta.type, meta.typeArgumentCount),
        new o.ExpressionType(o.literal(selectorForType))
    ]));
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
        }, directives: typeMapToExpressionMap(directiveTypeBySel, outputCtx), pipes: typeMapToExpressionMap(pipeTypeByName, outputCtx), viewQueries: queriesFromGlobalMetadata(component.viewQueries, outputCtx) });
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
        // const $instance$ = $r3$.ɵd(dirIndex);
        statements.push(directiveInstanceVar.set(o.importExpr(R3.loadDirective).callFn([o.variable('dirIndex')]))
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
        // update, e.g. (r3.qR(tmp = r3.ɵld(0)) && (ctx.someDir = tmp));
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
function createHostBindingsFunction(meta, bindingParser) {
    const statements = [];
    const hostBindingSourceSpan = meta.typeSourceSpan;
    const directiveSummary = metadataAsSummary(meta);
    // Calculate the host property bindings
    const bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
    const bindingContext = o.importExpr(R3.loadDirective).callFn([o.variable('dirIndex')]);
    if (bindings) {
        for (const binding of bindings) {
            const bindingExpr = convertPropertyBinding(null, bindingContext, binding.expression, 'b', BindingForm.TrySimple, () => error('Unexpected interpolation'));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBZ0csY0FBYyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFekssT0FBTyxFQUFDLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLDBDQUEwQyxDQUFDO0FBRW5ILE9BQU8sS0FBSyxJQUFJLE1BQU0sWUFBWSxDQUFDO0FBQ25DLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxjQUFjLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRCxPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRTVELE9BQU8sRUFBZ0IsS0FBSyxFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQ2hELE9BQU8sRUFBQyxzQkFBc0IsRUFBRSw4QkFBOEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNyRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXBELE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLFNBQVMsQ0FBQztBQUczQyxPQUFPLEVBQUMsWUFBWSxFQUFFLHlCQUF5QixFQUFFLHFCQUFxQixFQUFDLE1BQU0sWUFBWSxDQUFDO0FBQzFGLE9BQU8sRUFBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLG1DQUFtQyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXhLLDZCQUNJLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7SUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztJQUUxQywyQkFBMkI7SUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRXJDLDBDQUEwQztJQUMxQyxhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsUUFBVSxDQUFDLENBQUMsQ0FBQztJQUd6RSxzREFBc0Q7SUFDdEQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsc0JBQXNCLENBQUM7UUFDaEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ3BCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtRQUNmLE1BQU0sRUFBRSxJQUFJO1FBQ1osUUFBUSxFQUFFLEVBQUUsQ0FBQyxlQUFlO0tBQzdCLENBQUMsQ0FBQyxDQUFDO0lBRXRCLGFBQWEsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFFdEYsYUFBYSxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsRUFBRSxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRXRGLHFEQUFxRDtJQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSwwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztJQUVuRix5Q0FBeUM7SUFDekMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUVqRSx5QkFBeUI7SUFDekIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsbUNBQW1DLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFOUUsMEJBQTBCO0lBQzFCLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRWhGLHdDQUF3QztJQUN4QyxNQUFNLFFBQVEsR0FBbUIsRUFBRSxDQUFDO0lBRXBDLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtRQUN4QixRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztLQUMxRDtJQUNELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUU7UUFDaEMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7S0FDcEQ7SUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7UUFDbkIsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0tBQ3ZEO0lBRUQsT0FBTyxhQUFhLENBQUM7QUFDdkIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSx1Q0FDRixJQUF5QixFQUFFLFlBQTBCLEVBQ3JELGFBQTRCO0lBQzlCLE1BQU0sYUFBYSxHQUFHLG1CQUFtQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDN0UsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUUzRiwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRWpFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUU7UUFDOUQsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDckQsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7S0FDakQsQ0FBQyxDQUFDLENBQUM7SUFDSixPQUFPLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO0FBQzVCLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sdUNBQ0YsSUFBeUIsRUFBRSxZQUEwQixFQUNyRCxhQUE0QjtJQUM5QixNQUFNLGFBQWEsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBRTdFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkUsTUFBTSxhQUFhLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU5QyxvQ0FBb0M7SUFDcEMsK0ZBQStGO0lBQy9GLElBQUksYUFBYSxFQUFFO1FBQ2pCLE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3BELElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFO1lBQzdCLGFBQWEsQ0FBQyxHQUFHLENBQ2IsT0FBTyxFQUFFLFlBQVksQ0FBQyxlQUFlLENBQ3hCLENBQUMsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUMvQixLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN0RSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzNDO0tBQ0Y7SUFFRCxvREFBb0Q7SUFDcEQsSUFBSSxnQkFBZ0IsR0FBeUIsSUFBSSxDQUFDO0lBRWxELElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUU7UUFDeEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsRUFBRSxRQUFnQixFQUFFLEVBQUU7WUFDdkQsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2xFLENBQUMsQ0FBQyxDQUFDO1FBQ0gsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO0tBQzVCO0lBRUQsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtRQUMzQixhQUFhLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQztLQUMvRTtJQUVELGtFQUFrRTtJQUNsRSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkMsTUFBTSxZQUFZLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEdBQUcsZ0JBQWdCLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBRTlFLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO0lBQy9DLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFnQixDQUFDO0lBRTFDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDL0IsTUFBTSwwQkFBMEIsR0FDNUIsSUFBSSx5QkFBeUIsQ0FDekIsWUFBWSxFQUFFLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFDeEUsSUFBSSxDQUFDLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQ3pFLEVBQUUsQ0FBQyxhQUFhLENBQUM7U0FDaEIscUJBQXFCLENBQ2xCLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFFcEYsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztJQUUxRCxtQ0FBbUM7SUFDbkMsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFO1FBQ3ZCLGFBQWEsQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDM0U7SUFFRCx5QkFBeUI7SUFDekIsSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFO1FBQ2xCLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakU7SUFFRCwrRkFBK0Y7SUFDL0YsNkNBQTZDO0lBQzdDLE1BQU0sZUFBZSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRWpFLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0YsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRTtRQUM5RCxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUNyRCxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztLQUNqRCxDQUFDLENBQUMsQ0FBQztJQUVKLE9BQU8sRUFBQyxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7QUFDNUIsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sc0NBQ0YsU0FBd0IsRUFBRSxTQUFtQyxFQUFFLFNBQTJCLEVBQzFGLGFBQTRCO0lBQzlCLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7SUFDOUMsSUFBSSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFFL0QsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQyxjQUFjLG1CQUEwQixDQUFDO0lBRXhGLE1BQU0sSUFBSSxHQUFHLG1DQUFtQyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDbEYsTUFBTSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFdEYsK0RBQStEO0lBQy9ELFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FDckMsSUFBSSxFQUFFLElBQUksRUFDVixDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzdGLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLHNDQUNGLFNBQXdCLEVBQUUsU0FBbUMsRUFBRSxVQUE4QixFQUM3RixTQUEyQixFQUFFLGFBQTRCLEVBQUUsa0JBQW9DLEVBQy9GLGNBQWdDO0lBQ2xDLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7SUFDOUMsSUFBSSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFFL0QsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQyxjQUFjLG1CQUEwQixDQUFDO0lBRXhGLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUV0QyxvRUFBb0U7SUFDcEUsTUFBTSxJQUFJLHFCQUNMLG1DQUFtQyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLElBQ3ZFLFFBQVEsRUFBRSxTQUFTLENBQUMsUUFBUSxFQUM1QixRQUFRLEVBQUU7WUFDUixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUs7WUFDdkIsWUFBWSxFQUFFLFVBQVUsQ0FBQyxZQUFZO1lBQ3JDLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0I7U0FDbEQsRUFDRCxVQUFVLEVBQUUsc0JBQXNCLENBQUMsa0JBQWtCLEVBQUUsU0FBUyxDQUFDLEVBQ2pFLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxjQUFjLEVBQUUsU0FBUyxDQUFDLEVBQ3hELFdBQVcsRUFBRSx5QkFBeUIsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxHQUN6RSxDQUFDO0lBQ0YsTUFBTSxHQUFHLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFdEYsK0RBQStEO0lBQy9ELFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FDckMsSUFBSSxFQUFFLElBQUksRUFDVixDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQzdGLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUM7QUFFRDs7R0FFRztBQUNILDZDQUNJLFNBQW1DLEVBQUUsU0FBd0IsRUFDN0QsU0FBMkI7SUFDN0IsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ3RDLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFHLENBQUM7SUFDOUMsSUFBSSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFFL0QsT0FBTztRQUNMLElBQUk7UUFDSixJQUFJLEVBQUUsU0FBUyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNwRCxpQkFBaUIsRUFBRSxDQUFDO1FBQ3BCLGNBQWMsRUFDVixjQUFjLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQztRQUNyRixRQUFRLEVBQUUsU0FBUyxDQUFDLFFBQVE7UUFDNUIsSUFBSSxFQUFFLDhCQUE4QixDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztRQUMxRSxPQUFPLEVBQUUseUJBQXlCLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFDaEUsU0FBUyxFQUFFO1lBQ1QsYUFBYSxFQUNULFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsSUFBSSxjQUFjLENBQUMsU0FBUyxDQUFDO1NBQzNGO1FBQ0QsSUFBSSxFQUFFO1lBQ0osVUFBVSxFQUFFLFNBQVMsQ0FBQyxjQUFjO1lBQ3BDLFNBQVMsRUFBRSxPQUFPLENBQUMsYUFBYTtZQUNoQyxVQUFVLEVBQUUsT0FBTyxDQUFDLGNBQWM7U0FDbkM7UUFDRCxNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU07UUFDeEIsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPO1FBQzFCLGVBQWUsRUFBRSxLQUFLO0tBQ3ZCLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxtQ0FDSSxPQUErQixFQUFFLFNBQXdCO0lBQzNELE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUN6QixJQUFJLElBQUksR0FBc0IsSUFBSSxDQUFDO1FBQ25DLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUN2QyxJQUFJLEdBQUcsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM5RDtRQUNELE9BQU87WUFDTCxZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFDaEMsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO1lBQ2xCLFNBQVMsRUFBRSwyQkFBMkIsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQztZQUNsRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJO1NBQ3JDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxxQ0FDSSxTQUFpQyxFQUFFLFNBQXdCO0lBQzdELElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUU7UUFDekUsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFlLENBQUMsQ0FBQztRQUN0RSxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFDakMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7UUFDOUQsT0FBTyxTQUFTLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FDekMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuRTtJQUVELElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7UUFDekIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRTtZQUNwQixPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUN6RDtLQUNGO0lBRUQsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDL0IsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3JCLENBQUM7QUFFRCwrQkFDSSxLQUFzQixFQUFFLFlBQTBCLEVBQUUsR0FBa0I7SUFDeEUsTUFBTSxTQUFTLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBRXpELG1FQUFtRTtJQUNuRSxNQUFNLFVBQVUsR0FBRztRQUNqQixDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDO1FBQy9CLFNBQVM7UUFDVCxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7S0FDN0IsQ0FBQztJQUVGLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtRQUNkLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzdCO0lBRUQsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELDZFQUE2RTtBQUM3RSxpQ0FBaUMsUUFBZ0I7SUFDL0MsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDN0QsQ0FBQztBQUVELG1DQUFtQyxJQUF5QjtJQUMxRCxNQUFNLE1BQU0sR0FBbUIsRUFBRSxDQUFDO0lBQ2xDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hDLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQ3RELE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQy9DO0lBQ0QsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNyQixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDN0I7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxvRUFBb0U7QUFDcEUsc0NBQ0ksSUFBeUIsRUFBRSxZQUEwQjtJQUN2RCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ3ZCLE1BQU0sVUFBVSxHQUFrQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQXNCLEVBQUUsRUFBRTtZQUM1RSxNQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pFLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2xGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUMzQixPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDNUY7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCwyRUFBMkU7QUFDM0UsNkNBQTZDLElBQXlCO0lBQ3BFLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzNCLE1BQU0sVUFBVSxHQUFrQixFQUFFLENBQUM7UUFDckMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUMzQixNQUFNLFVBQVUsR0FBRztZQUNqQixJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUM7WUFDeEMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUM7U0FDaEQsQ0FBQztRQUNGLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNwRCxrQkFBa0I7UUFDbEIsTUFBTSxTQUFTLEdBQUcsa0JBQWtCLENBQUMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRWpFLHdDQUF3QztRQUN4QyxVQUFVLENBQUMsSUFBSSxDQUNYLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNwRixVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBc0IsRUFBRSxHQUFXLEVBQUUsRUFBRTtZQUMzRCxNQUFNLFNBQVMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDaEQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUN6RCxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUzthQUNyRCxDQUFDLENBQUM7WUFDSCxNQUFNLGlCQUFpQixHQUFHLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4RCxNQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUVuRixNQUFNLGVBQWUsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztpQkFDeEMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUN4RixNQUFNLDhCQUE4QixHQUFHLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUU3RSxVQUFVLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDM0QsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsVUFBVSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFDN0MsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQzVEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQscUNBQXFDO0FBQ3JDLG1DQUNJLElBQXlCLEVBQUUsWUFBMEI7SUFDdkQsTUFBTSxnQkFBZ0IsR0FBa0IsRUFBRSxDQUFDO0lBQzNDLE1BQU0sZ0JBQWdCLEdBQWtCLEVBQUUsQ0FBQztJQUMzQyxNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUUzRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDaEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVsQywrQ0FBK0M7UUFDL0MsTUFBTSxlQUFlLEdBQUcscUJBQXFCLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0RSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFaEQsZ0VBQWdFO1FBQ2hFLE1BQU0sU0FBUyxHQUFHLGFBQWEsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BGLE1BQU0sZUFBZSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO2FBQ25CLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO2FBQ3hCLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0tBQzlEO0lBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNoRSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQ1AsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQy9FO1FBQ0UscUJBQXFCLGlCQUEwQixnQkFBZ0IsQ0FBQztRQUNoRSxxQkFBcUIsaUJBQTBCLGdCQUFnQixDQUFDO0tBQ2pFLEVBQ0QsQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVELGtFQUFrRTtBQUNsRSxvQ0FDSSxJQUF5QixFQUFFLGFBQTRCO0lBQ3pELE1BQU0sVUFBVSxHQUFrQixFQUFFLENBQUM7SUFFckMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBRWxELE1BQU0sZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFakQsdUNBQXVDO0lBQ3ZDLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2xHLE1BQU0sY0FBYyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLElBQUksUUFBUSxFQUFFO1FBQ1osS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUU7WUFDOUIsTUFBTSxXQUFXLEdBQUcsc0JBQXNCLENBQ3RDLElBQUksRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsV0FBVyxDQUFDLFNBQVMsRUFDcEUsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztZQUM3QyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDO2lCQUMzQixNQUFNLENBQUM7Z0JBQ04sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQ3JCLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFDdkIsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBQ3hELENBQUM7aUJBQ0QsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNoQztLQUNGO0lBRUQsZ0NBQWdDO0lBQ2hDLE1BQU0sYUFBYSxHQUNmLGFBQWEsQ0FBQyw0QkFBNEIsQ0FBQyxnQkFBZ0IsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3hGLElBQUksYUFBYSxFQUFFO1FBQ2pCLEtBQUssTUFBTSxPQUFPLElBQUksYUFBYSxFQUFFO1lBQ25DLE1BQU0sV0FBVyxHQUFHLG9CQUFvQixDQUNwQyxJQUFJLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7WUFDekYsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztZQUMzQixNQUFNLFlBQVksR0FDZCxRQUFRLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsSUFBSSxXQUFXLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDckYsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FDaEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUN6QyxDQUFDLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsRUFDeEYsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3hCLFVBQVUsQ0FBQyxJQUFJLENBQ1gsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3BGO0tBQ0Y7SUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUNQO1lBQ0UsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDO1lBQ3hDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQztTQUN4QyxFQUNELFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3RGO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsMkJBQTJCLElBQXlCO0lBQ2xELG1CQUFtQjtJQUNuQixPQUFPO1FBQ0wsY0FBYyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVTtRQUNwQyxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1FBQ2xDLGNBQWMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVU7S0FDVixDQUFDO0lBQzdCLGtCQUFrQjtBQUNwQixDQUFDO0FBR0QsZ0NBQ0ksR0FBOEIsRUFBRSxTQUF3QjtJQUMxRCxpR0FBaUc7SUFDakcsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQy9CLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQTBCLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRixPQUFPLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFCLENBQUM7QUFFRCxNQUFNLFlBQVksR0FBRyxvREFBb0QsQ0FBQztBQWMxRSxNQUFNLDRCQUE0QixJQUE2QjtJQU03RCxNQUFNLFVBQVUsR0FBNEIsRUFBRSxDQUFDO0lBQy9DLE1BQU0sU0FBUyxHQUE0QixFQUFFLENBQUM7SUFDOUMsTUFBTSxVQUFVLEdBQTRCLEVBQUUsQ0FBQztJQUMvQyxNQUFNLFVBQVUsR0FBNEIsRUFBRSxDQUFDO0lBRS9DLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzlCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4QixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3hDLElBQUksT0FBTyxLQUFLLElBQUksRUFBRTtZQUNwQixVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3pCO2FBQU0sSUFBSSxPQUFPLGtCQUEyQixJQUFJLElBQUksRUFBRTtZQUNyRCxVQUFVLENBQUMsT0FBTyxrQkFBMkIsQ0FBQyxHQUFHLEtBQUssQ0FBQztTQUN4RDthQUFNLElBQUksT0FBTyxlQUF3QixJQUFJLElBQUksRUFBRTtZQUNsRCxTQUFTLENBQUMsT0FBTyxlQUF3QixDQUFDLEdBQUcsS0FBSyxDQUFDO1NBQ3BEO2FBQU0sSUFBSSxPQUFPLG1CQUE0QixJQUFJLElBQUksRUFBRTtZQUN0RCxVQUFVLENBQUMsT0FBTyxtQkFBNEIsQ0FBQyxHQUFHLEtBQUssQ0FBQztTQUN6RDtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxFQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBQyxDQUFDO0FBQ3pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuLi8uLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnksIENvbXBpbGVRdWVyeU1ldGFkYXRhLCBDb21waWxlVG9rZW5NZXRhZGF0YSwgaWRlbnRpZmllck5hbWUsIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uLy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ0Zvcm0sIGNvbnZlcnRBY3Rpb25CaW5kaW5nLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sLCBEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7dHlwZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Y29tcGlsZUZhY3RvcnlGdW5jdGlvbiwgZGVwZW5kZW5jaWVzRnJvbUdsb2JhbE1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UmVuZGVyM1BhcnNlUmVzdWx0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHt0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzQ29tcG9uZW50RGVmLCBSM0NvbXBvbmVudE1ldGFkYXRhLCBSM0RpcmVjdGl2ZURlZiwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNRdWVyeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge0JpbmRpbmdTY29wZSwgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlciwgcmVuZGVyRmxhZ0NoZWNrSWZTdG10fSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBSRU5ERVJfRkxBR1MsIFRFTVBPUkFSWV9OQU1FLCBhc0xpdGVyYWwsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsLCBnZXRRdWVyeVByZWRpY2F0ZSwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlEaXJlY3RpdmVgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS50eXBlKTtcblxuICAvLyBlLmcuIGBzZWxlY3RvcnM6IFtbJycsICdzb21lRGlyJywgJyddXWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3NlbGVjdG9ycycsIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKG1ldGEuc2VsZWN0b3IgISkpO1xuXG5cbiAgLy8gZS5nLiBgZmFjdG9yeTogKCkgPT4gbmV3IE15QXBwKGluamVjdEVsZW1lbnRSZWYoKSlgXG4gIGRlZmluaXRpb25NYXAuc2V0KCdmYWN0b3J5JywgY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgIGZuT3JDbGFzczogbWV0YS50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICAgICAgICAgICAgICAgICAgICB1c2VOZXc6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgaW5qZWN0Rm46IFIzLmRpcmVjdGl2ZUluamVjdCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2NvbnRlbnRRdWVyaWVzUmVmcmVzaCcsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzUmVmcmVzaEZ1bmN0aW9uKG1ldGEpKTtcblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChkaXJJbmRleCwgZWxJbmRleCkgPT4geyAuLi4gfVxuICBkZWZpbml0aW9uTWFwLnNldCgnaG9zdEJpbmRpbmdzJywgY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24obWV0YSwgYmluZGluZ1BhcnNlcikpO1xuXG4gIC8vIGUuZy4gYGF0dHJpYnV0ZXM6IFsncm9sZScsICdsaXN0Ym94J11gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdhdHRyaWJ1dGVzJywgY3JlYXRlSG9zdEF0dHJpYnV0ZXNBcnJheShtZXRhKSk7XG5cbiAgLy8gZS5nICdpbnB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnaW5wdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5pbnB1dHMpKTtcblxuICAvLyBlLmcgJ291dHB1dHM6IHthOiAnYSd9YFxuICBkZWZpbml0aW9uTWFwLnNldCgnb3V0cHV0cycsIGNvbmRpdGlvbmFsbHlDcmVhdGVNYXBPYmplY3RMaXRlcmFsKG1ldGEub3V0cHV0cykpO1xuXG4gIC8vIGUuZy4gYGZlYXR1cmVzOiBbTmdPbkNoYW5nZXNGZWF0dXJlXWBcbiAgY29uc3QgZmVhdHVyZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICBpZiAoZmVhdHVyZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZlYXR1cmVzJywgby5saXRlcmFsQXJyKGZlYXR1cmVzKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzRGlyZWN0aXZlRGVmIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgY29uc3QgZXhwcmVzc2lvbiA9IG8uaW1wb3J0RXhwcihSMy5kZWZpbmVEaXJlY3RpdmUpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkRpcmVjdGl2ZURlZiwgW1xuICAgIHR5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUsIG1ldGEudHlwZUFyZ3VtZW50Q291bnQpLFxuICAgIG5ldyBvLkV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzZWxlY3RvckZvclR5cGUpKVxuICBdKSk7XG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBvbmVudERlZiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG5cbiAgY29uc3Qgc2VsZWN0b3IgPSBtZXRhLnNlbGVjdG9yICYmIENzc1NlbGVjdG9yLnBhcnNlKG1ldGEuc2VsZWN0b3IpO1xuICBjb25zdCBmaXJzdFNlbGVjdG9yID0gc2VsZWN0b3IgJiYgc2VsZWN0b3JbMF07XG5cbiAgLy8gZS5nLiBgYXR0cjogW1wiY2xhc3NcIiwgXCIubXkuYXBwXCJdYFxuICAvLyBUaGlzIGlzIG9wdGlvbmFsIGFuIG9ubHkgaW5jbHVkZWQgaWYgdGhlIGZpcnN0IHNlbGVjdG9yIG9mIGEgY29tcG9uZW50IHNwZWNpZmllcyBhdHRyaWJ1dGVzLlxuICBpZiAoZmlyc3RTZWxlY3Rvcikge1xuICAgIGNvbnN0IHNlbGVjdG9yQXR0cmlidXRlcyA9IGZpcnN0U2VsZWN0b3IuZ2V0QXR0cnMoKTtcbiAgICBpZiAoc2VsZWN0b3JBdHRyaWJ1dGVzLmxlbmd0aCkge1xuICAgICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICAgJ2F0dHJzJywgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5zaXplKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBtZXRhLmRpcmVjdGl2ZXMuZm9yRWFjaCgoZXhwcmVzc2lvbiwgc2VsZWN0b3I6IHN0cmluZykgPT4ge1xuICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShzZWxlY3RvciksIGV4cHJlc3Npb24pO1xuICAgIH0pO1xuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdRdWVyeScsIGNyZWF0ZVZpZXdRdWVyaWVzRnVuY3Rpb24obWV0YSwgY29uc3RhbnRQb29sKSk7XG4gIH1cblxuICAvLyBlLmcuIGB0ZW1wbGF0ZTogZnVuY3Rpb24gTXlDb21wb25lbnRfVGVtcGxhdGUoX2N0eCwgX2NtKSB7Li4ufWBcbiAgY29uc3QgdGVtcGxhdGVUeXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgY29uc3QgdGVtcGxhdGVOYW1lID0gdGVtcGxhdGVUeXBlTmFtZSA/IGAke3RlbXBsYXRlVHlwZU5hbWV9X1RlbXBsYXRlYCA6IG51bGw7XG5cbiAgY29uc3QgZGlyZWN0aXZlc1VzZWQgPSBuZXcgU2V0PG8uRXhwcmVzc2lvbj4oKTtcbiAgY29uc3QgcGlwZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG5cbiAgY29uc3QgdGVtcGxhdGUgPSBtZXRhLnRlbXBsYXRlO1xuICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbiA9XG4gICAgICBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsIEJpbmRpbmdTY29wZS5ST09UX1NDT1BFLCAwLCB0ZW1wbGF0ZVR5cGVOYW1lLCB0ZW1wbGF0ZU5hbWUsXG4gICAgICAgICAgbWV0YS52aWV3UXVlcmllcywgZGlyZWN0aXZlTWF0Y2hlciwgZGlyZWN0aXZlc1VzZWQsIG1ldGEucGlwZXMsIHBpcGVzVXNlZCxcbiAgICAgICAgICBSMy5uYW1lc3BhY2VIVE1MKVxuICAgICAgICAgIC5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICAgICAgICAgIHRlbXBsYXRlLm5vZGVzLCBbXSwgdGVtcGxhdGUuaGFzTmdDb250ZW50LCB0ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMpO1xuXG4gIGRlZmluaXRpb25NYXAuc2V0KCd0ZW1wbGF0ZScsIHRlbXBsYXRlRnVuY3Rpb25FeHByZXNzaW9uKTtcblxuICAvLyBlLmcuIGBkaXJlY3RpdmVzOiBbTXlEaXJlY3RpdmVdYFxuICBpZiAoZGlyZWN0aXZlc1VzZWQuc2l6ZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdkaXJlY3RpdmVzJywgby5saXRlcmFsQXJyKEFycmF5LmZyb20oZGlyZWN0aXZlc1VzZWQpKSk7XG4gIH1cblxuICAvLyBlLmcuIGBwaXBlczogW015UGlwZV1gXG4gIGlmIChwaXBlc1VzZWQuc2l6ZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKHBpcGVzVXNlZCkpKTtcbiAgfVxuXG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSAobWV0YS5zZWxlY3RvciB8fCAnJykucmVwbGFjZSgvXFxuL2csICcnKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZUNvbXBvbmVudCkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuQ29tcG9uZW50RGVmLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGEudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgbmV3IG8uRXhwcmVzc2lvblR5cGUoby5saXRlcmFsKHNlbGVjdG9yRm9yVHlwZSkpXG4gIF0pKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGV9O1xufVxuXG4vKipcbiAqIEEgd3JhcHBlciBhcm91bmQgYGNvbXBpbGVEaXJlY3RpdmVgIHdoaWNoIGRlcGVuZHMgb24gcmVuZGVyMiBnbG9iYWwgYW5hbHlzaXMgZGF0YSBhcyBpdHMgaW5wdXRcbiAqIGluc3RlYWQgb2YgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqXG4gKiBgUjNEaXJlY3RpdmVNZXRhZGF0YWAgaXMgY29tcHV0ZWQgZnJvbSBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgb3RoZXIgc3RhdGljYWxseSByZWZsZWN0ZWRcbiAqIGluZm9ybWF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURpcmVjdGl2ZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgZGlyZWN0aXZlOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcixcbiAgICBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5EaXJlY3RpdmUpO1xuXG4gIGNvbnN0IG1ldGEgPSBkaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBvdXRwdXRDdHguY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcblxuICAvLyBDcmVhdGUgdGhlIHBhcnRpYWwgY2xhc3MgdG8gYmUgbWVyZ2VkIHdpdGggdGhlIGFjdHVhbCBjbGFzcy5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICBuYW1lLCBudWxsLFxuICAgICAgW25ldyBvLkNsYXNzRmllbGQoZGVmaW5pdGlvbkZpZWxkLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLCByZXMuZXhwcmVzc2lvbildLFxuICAgICAgW10sIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksIFtdKSk7XG59XG5cbi8qKlxuICogQSB3cmFwcGVyIGFyb3VuZCBgY29tcGlsZUNvbXBvbmVudGAgd2hpY2ggZGVwZW5kcyBvbiByZW5kZXIyIGdsb2JhbCBhbmFseXNpcyBkYXRhIGFzIGl0cyBpbnB1dFxuICogaW5zdGVhZCBvZiB0aGUgYFIzRGlyZWN0aXZlTWV0YWRhdGFgLlxuICpcbiAqIGBSM0NvbXBvbmVudE1ldGFkYXRhYCBpcyBjb21wdXRlZCBmcm9tIGBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFgIGFuZCBvdGhlciBzdGF0aWNhbGx5IHJlZmxlY3RlZFxuICogaW5mb3JtYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbVJlbmRlcjIoXG4gICAgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0LCBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgcmVuZGVyM0FzdDogUmVuZGVyM1BhcnNlUmVzdWx0LFxuICAgIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlciwgZGlyZWN0aXZlVHlwZUJ5U2VsOiBNYXA8c3RyaW5nLCBhbnk+LFxuICAgIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBhbnk+KSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShjb21wb25lbnQudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7Y29tcG9uZW50LnR5cGV9YCk7XG5cbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5Db21wb25lbnQpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSBjb21wb25lbnQudG9TdW1tYXJ5KCk7XG5cbiAgLy8gQ29tcHV0ZSB0aGUgUjNDb21wb25lbnRNZXRhZGF0YSBmcm9tIHRoZSBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGFcbiAgY29uc3QgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSA9IHtcbiAgICAuLi5kaXJlY3RpdmVNZXRhZGF0YUZyb21HbG9iYWxNZXRhZGF0YShjb21wb25lbnQsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBzZWxlY3RvcjogY29tcG9uZW50LnNlbGVjdG9yLFxuICAgIHRlbXBsYXRlOiB7XG4gICAgICBub2RlczogcmVuZGVyM0FzdC5ub2RlcyxcbiAgICAgIGhhc05nQ29udGVudDogcmVuZGVyM0FzdC5oYXNOZ0NvbnRlbnQsXG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHJlbmRlcjNBc3QubmdDb250ZW50U2VsZWN0b3JzLFxuICAgIH0sXG4gICAgZGlyZWN0aXZlczogdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChkaXJlY3RpdmVUeXBlQnlTZWwsIG91dHB1dEN0eCksXG4gICAgcGlwZXM6IHR5cGVNYXBUb0V4cHJlc3Npb25NYXAocGlwZVR5cGVCeU5hbWUsIG91dHB1dEN0eCksXG4gICAgdmlld1F1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoY29tcG9uZW50LnZpZXdRdWVyaWVzLCBvdXRwdXRDdHgpLFxuICB9O1xuICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKG1ldGEsIG91dHB1dEN0eC5jb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuXG4gIC8vIENyZWF0ZSB0aGUgcGFydGlhbCBjbGFzcyB0byBiZSBtZXJnZWQgd2l0aCB0aGUgYWN0dWFsIGNsYXNzLlxuICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKG5ldyBvLkNsYXNzU3RtdChcbiAgICAgIG5hbWUsIG51bGwsXG4gICAgICBbbmV3IG8uQ2xhc3NGaWVsZChkZWZpbml0aW9uRmllbGQsIG8uSU5GRVJSRURfVFlQRSwgW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sIHJlcy5leHByZXNzaW9uKV0sXG4gICAgICBbXSwgbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSwgW10pKTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYCBnaXZlbiBgQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhYCBhbmQgYSBgQ29tcGlsZVJlZmxlY3RvcmAuXG4gKi9cbmZ1bmN0aW9uIGRpcmVjdGl2ZU1ldGFkYXRhRnJvbUdsb2JhbE1ldGFkYXRhKFxuICAgIGRpcmVjdGl2ZTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IHN1bW1hcnkgPSBkaXJlY3RpdmUudG9TdW1tYXJ5KCk7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShkaXJlY3RpdmUudHlwZSkgITtcbiAgbmFtZSB8fCBlcnJvcihgQ2Fubm90IHJlc29sdmVyIHRoZSBuYW1lIG9mICR7ZGlyZWN0aXZlLnR5cGV9YCk7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIHR5cGU6IG91dHB1dEN0eC5pbXBvcnRFeHByKGRpcmVjdGl2ZS50eXBlLnJlZmVyZW5jZSksXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IDAsXG4gICAgdHlwZVNvdXJjZVNwYW46XG4gICAgICAgIHR5cGVTb3VyY2VTcGFuKGRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/ICdDb21wb25lbnQnIDogJ0RpcmVjdGl2ZScsIGRpcmVjdGl2ZS50eXBlKSxcbiAgICBzZWxlY3RvcjogZGlyZWN0aXZlLnNlbGVjdG9yLFxuICAgIGRlcHM6IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShkaXJlY3RpdmUudHlwZSwgb3V0cHV0Q3R4LCByZWZsZWN0b3IpLFxuICAgIHF1ZXJpZXM6IHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoZGlyZWN0aXZlLnF1ZXJpZXMsIG91dHB1dEN0eCksXG4gICAgbGlmZWN5Y2xlOiB7XG4gICAgICB1c2VzT25DaGFuZ2VzOlxuICAgICAgICAgIGRpcmVjdGl2ZS50eXBlLmxpZmVjeWNsZUhvb2tzLnNvbWUobGlmZWN5Y2xlID0+IGxpZmVjeWNsZSA9PSBMaWZlY3ljbGVIb29rcy5PbkNoYW5nZXMpLFxuICAgIH0sXG4gICAgaG9zdDoge1xuICAgICAgYXR0cmlidXRlczogZGlyZWN0aXZlLmhvc3RBdHRyaWJ1dGVzLFxuICAgICAgbGlzdGVuZXJzOiBzdW1tYXJ5Lmhvc3RMaXN0ZW5lcnMsXG4gICAgICBwcm9wZXJ0aWVzOiBzdW1tYXJ5Lmhvc3RQcm9wZXJ0aWVzLFxuICAgIH0sXG4gICAgaW5wdXRzOiBkaXJlY3RpdmUuaW5wdXRzLFxuICAgIG91dHB1dHM6IGRpcmVjdGl2ZS5vdXRwdXRzLFxuICAgIHVzZXNJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBgQ29tcGlsZVF1ZXJ5TWV0YWRhdGFgIGludG8gYFIzUXVlcnlNZXRhZGF0YWAuXG4gKi9cbmZ1bmN0aW9uIHF1ZXJpZXNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXSwgb3V0cHV0Q3R4OiBPdXRwdXRDb250ZXh0KTogUjNRdWVyeU1ldGFkYXRhW10ge1xuICByZXR1cm4gcXVlcmllcy5tYXAocXVlcnkgPT4ge1xuICAgIGxldCByZWFkOiBvLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKHF1ZXJ5LnJlYWQgJiYgcXVlcnkucmVhZC5pZGVudGlmaWVyKSB7XG4gICAgICByZWFkID0gb3V0cHV0Q3R4LmltcG9ydEV4cHIocXVlcnkucmVhZC5pZGVudGlmaWVyLnJlZmVyZW5jZSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBwcm9wZXJ0eU5hbWU6IHF1ZXJ5LnByb3BlcnR5TmFtZSxcbiAgICAgIGZpcnN0OiBxdWVyeS5maXJzdCxcbiAgICAgIHByZWRpY2F0ZTogc2VsZWN0b3JzRnJvbUdsb2JhbE1ldGFkYXRhKHF1ZXJ5LnNlbGVjdG9ycywgb3V0cHV0Q3R4KSxcbiAgICAgIGRlc2NlbmRhbnRzOiBxdWVyeS5kZXNjZW5kYW50cywgcmVhZCxcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGBDb21waWxlVG9rZW5NZXRhZGF0YWAgZm9yIHF1ZXJ5IHNlbGVjdG9ycyBpbnRvIGVpdGhlciBhbiBleHByZXNzaW9uIGZvciBhIHByZWRpY2F0ZVxuICogdHlwZSwgb3IgYSBsaXN0IG9mIHN0cmluZyBwcmVkaWNhdGVzLlxuICovXG5mdW5jdGlvbiBzZWxlY3RvcnNGcm9tR2xvYmFsTWV0YWRhdGEoXG4gICAgc2VsZWN0b3JzOiBDb21waWxlVG9rZW5NZXRhZGF0YVtdLCBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb258c3RyaW5nW10ge1xuICBpZiAoc2VsZWN0b3JzLmxlbmd0aCA+IDEgfHwgKHNlbGVjdG9ycy5sZW5ndGggPT0gMSAmJiBzZWxlY3RvcnNbMF0udmFsdWUpKSB7XG4gICAgY29uc3Qgc2VsZWN0b3JTdHJpbmdzID0gc2VsZWN0b3JzLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZSBhcyBzdHJpbmcpO1xuICAgIHNlbGVjdG9yU3RyaW5ncy5zb21lKHZhbHVlID0+ICF2YWx1ZSkgJiZcbiAgICAgICAgZXJyb3IoJ0ZvdW5kIGEgdHlwZSBhbW9uZyB0aGUgc3RyaW5nIHNlbGVjdG9ycyBleHBlY3RlZCcpO1xuICAgIHJldHVybiBvdXRwdXRDdHguY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yU3RyaW5ncy5tYXAodmFsdWUgPT4gby5saXRlcmFsKHZhbHVlKSkpKTtcbiAgfVxuXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID09IDEpIHtcbiAgICBjb25zdCBmaXJzdCA9IHNlbGVjdG9yc1swXTtcbiAgICBpZiAoZmlyc3QuaWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIG91dHB1dEN0eC5pbXBvcnRFeHByKGZpcnN0LmlkZW50aWZpZXIucmVmZXJlbmNlKTtcbiAgICB9XG4gIH1cblxuICBlcnJvcignVW5leHBlY3RlZCBxdWVyeSBmb3JtJyk7XG4gIHJldHVybiBvLk5VTExfRVhQUjtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUXVlcnlEZWZpbml0aW9uKFxuICAgIHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBpZHg6IG51bWJlciB8IG51bGwpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCBwcmVkaWNhdGUgPSBnZXRRdWVyeVByZWRpY2F0ZShxdWVyeSwgY29uc3RhbnRQb29sKTtcblxuICAvLyBlLmcuIHIzLlEobnVsbCwgc29tZVByZWRpY2F0ZSwgZmFsc2UpIG9yIHIzLlEoMCwgWydkaXYnXSwgZmFsc2UpXG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbXG4gICAgby5saXRlcmFsKGlkeCwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICBwcmVkaWNhdGUsXG4gICAgby5saXRlcmFsKHF1ZXJ5LmRlc2NlbmRhbnRzKSxcbiAgXTtcblxuICBpZiAocXVlcnkucmVhZCkge1xuICAgIHBhcmFtZXRlcnMucHVzaChxdWVyeS5yZWFkKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMucXVlcnkpLmNhbGxGbihwYXJhbWV0ZXJzKTtcbn1cblxuLy8gVHVybiBhIGRpcmVjdGl2ZSBzZWxlY3RvciBpbnRvIGFuIFIzLWNvbXBhdGlibGUgc2VsZWN0b3IgZm9yIGRpcmVjdGl2ZSBkZWZcbmZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVNlbGVjdG9yKHNlbGVjdG9yOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gYXNMaXRlcmFsKGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzZWxlY3RvcikpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QXR0cmlidXRlc0FycmF5KG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gIGNvbnN0IHZhbHVlczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlcyA9IG1ldGEuaG9zdC5hdHRyaWJ1dGVzO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgby5saXRlcmFsKHZhbHVlKSk7XG4gIH1cbiAgaWYgKHZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBSZXR1cm4gYSBjb250ZW50UXVlcmllcyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlQ29udGVudFF1ZXJpZXNGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgaWYgKG1ldGEucXVlcmllcy5sZW5ndGgpIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gbWV0YS5xdWVyaWVzLm1hcCgocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIG51bGwpO1xuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5yZWdpc3RlckNvbnRlbnRRdWVyeSkuY2FsbEZuKFtxdWVyeURlZmluaXRpb25dKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgICBjb25zdCB0eXBlTmFtZSA9IG1ldGEubmFtZTtcbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW10sIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdHlwZU5hbWUgPyBgJHt0eXBlTmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbCk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLy8gUmV0dXJuIGEgY29udGVudFF1ZXJpZXNSZWZyZXNoIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVDb250ZW50UXVlcmllc1JlZnJlc2hGdW5jdGlvbihtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhKTogby5FeHByZXNzaW9ufG51bGwge1xuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICAgIG5ldyBvLkZuUGFyYW0oJ2RpckluZGV4Jywgby5OVU1CRVJfVFlQRSksXG4gICAgICBuZXcgby5GblBhcmFtKCdxdWVyeVN0YXJ0SW5kZXgnLCBvLk5VTUJFUl9UWVBFKSxcbiAgICBdO1xuICAgIGNvbnN0IGRpcmVjdGl2ZUluc3RhbmNlVmFyID0gby52YXJpYWJsZSgnaW5zdGFuY2UnKTtcbiAgICAvLyB2YXIgJHRtcCQ6IGFueTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wb3JhcnlBbGxvY2F0b3Ioc3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gICAgLy8gY29uc3QgJGluc3RhbmNlJCA9ICRyMyQuybVkKGRpckluZGV4KTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goXG4gICAgICAgIGRpcmVjdGl2ZUluc3RhbmNlVmFyLnNldChvLmltcG9ydEV4cHIoUjMubG9hZERpcmVjdGl2ZSkuY2FsbEZuKFtvLnZhcmlhYmxlKCdkaXJJbmRleCcpXSkpXG4gICAgICAgICAgICAudG9EZWNsU3RtdChvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5GaW5hbF0pKTtcblxuICAgIG1ldGEucXVlcmllcy5mb3JFYWNoKChxdWVyeTogUjNRdWVyeU1ldGFkYXRhLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3QgbG9hZFFMQXJnID0gby52YXJpYWJsZSgncXVlcnlTdGFydEluZGV4Jyk7XG4gICAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5TGlzdCkuY2FsbEZuKFtcbiAgICAgICAgaWR4ID4gMCA/IGxvYWRRTEFyZy5wbHVzKG8ubGl0ZXJhbChpZHgpKSA6IGxvYWRRTEFyZ1xuICAgICAgXSk7XG4gICAgICBjb25zdCBhc3NpZ25Ub1RlbXBvcmFyeSA9IHRlbXBvcmFyeSgpLnNldChnZXRRdWVyeUxpc3QpO1xuICAgICAgY29uc3QgY2FsbFF1ZXJ5UmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbYXNzaWduVG9UZW1wb3JhcnldKTtcblxuICAgICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gZGlyZWN0aXZlSW5zdGFuY2VWYXIucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeSgpLnByb3AoJ2ZpcnN0JykgOiB0ZW1wb3JhcnkoKSk7XG4gICAgICBjb25zdCByZWZyZXNoUXVlcnlBbmRVcGRhdGVEaXJlY3RpdmUgPSBjYWxsUXVlcnlSZWZyZXNoLmFuZCh1cGRhdGVEaXJlY3RpdmUpO1xuXG4gICAgICBzdGF0ZW1lbnRzLnB1c2gocmVmcmVzaFF1ZXJ5QW5kVXBkYXRlRGlyZWN0aXZlLnRvU3RtdCgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBwYXJhbWV0ZXJzLCBzdGF0ZW1lbnRzLCBvLklORkVSUkVEX1RZUEUsIG51bGwsXG4gICAgICAgIHR5cGVOYW1lID8gYCR7dHlwZU5hbWV9X0NvbnRlbnRRdWVyaWVzUmVmcmVzaGAgOiBudWxsKTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG4vLyBEZWZpbmUgYW5kIHVwZGF0ZSBhbnkgdmlldyBxdWVyaWVzXG5mdW5jdGlvbiBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbWV0YS52aWV3UXVlcmllcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHF1ZXJ5ID0gbWV0YS52aWV3UXVlcmllc1tpXTtcblxuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLlEoMCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID0gY3JlYXRlUXVlcnlEZWZpbml0aW9uKHF1ZXJ5LCBjb25zdGFudFBvb2wsIGkpO1xuICAgIGNyZWF0ZVN0YXRlbWVudHMucHVzaChxdWVyeURlZmluaXRpb24udG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xUih0bXAgPSByMy7JtWxkKDApKSAmJiAoY3R4LnNvbWVEaXIgPSB0bXApKTtcbiAgICBjb25zdCB0ZW1wb3JhcnkgPSB0ZW1wQWxsb2NhdG9yKCk7XG4gICAgY29uc3QgZ2V0UXVlcnlMaXN0ID0gby5pbXBvcnRFeHByKFIzLmxvYWQpLmNhbGxGbihbby5saXRlcmFsKGkpXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH1cblxuICBjb25zdCB2aWV3UXVlcnlGbk5hbWUgPSBtZXRhLm5hbWUgPyBgJHttZXRhLm5hbWV9X1F1ZXJ5YCA6IG51bGw7XG4gIHJldHVybiBvLmZuKFxuICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgIFtcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGVTdGF0ZW1lbnRzKSxcbiAgICAgICAgcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVTdGF0ZW1lbnRzKVxuICAgICAgXSxcbiAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdmlld1F1ZXJ5Rm5OYW1lKTtcbn1cblxuLy8gUmV0dXJuIGEgaG9zdCBiaW5kaW5nIGZ1bmN0aW9uIG9yIG51bGwgaWYgb25lIGlzIG5vdCBuZWNlc3NhcnkuXG5mdW5jdGlvbiBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLCBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKTogby5FeHByZXNzaW9ufG51bGwge1xuICBjb25zdCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG5cbiAgY29uc3QgaG9zdEJpbmRpbmdTb3VyY2VTcGFuID0gbWV0YS50eXBlU291cmNlU3BhbjtcblxuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkobWV0YSk7XG5cbiAgLy8gQ2FsY3VsYXRlIHRoZSBob3N0IHByb3BlcnR5IGJpbmRpbmdzXG4gIGNvbnN0IGJpbmRpbmdzID0gYmluZGluZ1BhcnNlci5jcmVhdGVCb3VuZEhvc3RQcm9wZXJ0aWVzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGNvbnN0IGJpbmRpbmdDb250ZXh0ID0gby5pbXBvcnRFeHByKFIzLmxvYWREaXJlY3RpdmUpLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKV0pO1xuICBpZiAoYmluZGluZ3MpIHtcbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgYmluZGluZ3MpIHtcbiAgICAgIGNvbnN0IGJpbmRpbmdFeHByID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICBudWxsLCBiaW5kaW5nQ29udGV4dCwgYmluZGluZy5leHByZXNzaW9uLCAnYicsIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSxcbiAgICAgICAgICAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJykpO1xuICAgICAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcbiAgICAgIHN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoUjMuZWxlbWVudFByb3BlcnR5KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLnZhcmlhYmxlKCdlbEluZGV4JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKGJpbmRpbmcubmFtZSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbYmluZGluZ0V4cHIuY3VyclZhbEV4cHJdKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RtdCgpKTtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxjdWxhdGUgaG9zdCBldmVudCBiaW5kaW5nc1xuICBjb25zdCBldmVudEJpbmRpbmdzID1cbiAgICAgIGJpbmRpbmdQYXJzZXIuY3JlYXRlRGlyZWN0aXZlSG9zdEV2ZW50QXN0cyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICBpZiAoZXZlbnRCaW5kaW5ncykge1xuICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBldmVudEJpbmRpbmdzKSB7XG4gICAgICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIG51bGwsIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nLmhhbmRsZXIsICdiJywgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbiAgICAgIGNvbnN0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihiaW5kaW5nLm5hbWUpO1xuICAgICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgICBjb25zdCBmdW5jdGlvbk5hbWUgPVxuICAgICAgICAgIHR5cGVOYW1lICYmIGJpbmRpbmdOYW1lID8gYCR7dHlwZU5hbWV9XyR7YmluZGluZ05hbWV9X0hvc3RCaW5kaW5nSGFuZGxlcmAgOiBudWxsO1xuICAgICAgY29uc3QgaGFuZGxlciA9IG8uZm4oXG4gICAgICAgICAgW25ldyBvLkZuUGFyYW0oJyRldmVudCcsIG8uRFlOQU1JQ19UWVBFKV0sXG4gICAgICAgICAgWy4uLmJpbmRpbmdFeHByLnN0bXRzLCBuZXcgby5SZXR1cm5TdGF0ZW1lbnQoYmluZGluZ0V4cHIuYWxsb3dEZWZhdWx0KV0sIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgICBudWxsLCBmdW5jdGlvbk5hbWUpO1xuICAgICAgc3RhdGVtZW50cy5wdXNoKFxuICAgICAgICAgIG8uaW1wb3J0RXhwcihSMy5saXN0ZW5lcikuY2FsbEZuKFtvLmxpdGVyYWwoYmluZGluZy5uYW1lKSwgaGFuZGxlcl0pLnRvU3RtdCgpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoc3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgdHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIFtcbiAgICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG8uTlVNQkVSX1RZUEUpLFxuICAgICAgICAgIG5ldyBvLkZuUGFyYW0oJ2VsSW5kZXgnLCBvLk5VTUJFUl9UWVBFKSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVtZW50cywgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0eXBlTmFtZSA/IGAke3R5cGVOYW1lfV9Ib3N0QmluZGluZ3NgIDogbnVsbCk7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gbWV0YWRhdGFBc1N1bW1hcnkobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5IHtcbiAgLy8gY2xhbmctZm9ybWF0IG9mZlxuICByZXR1cm4ge1xuICAgIGhvc3RBdHRyaWJ1dGVzOiBtZXRhLmhvc3QuYXR0cmlidXRlcyxcbiAgICBob3N0TGlzdGVuZXJzOiBtZXRhLmhvc3QubGlzdGVuZXJzLFxuICAgIGhvc3RQcm9wZXJ0aWVzOiBtZXRhLmhvc3QucHJvcGVydGllcyxcbiAgfSBhcyBDb21waWxlRGlyZWN0aXZlU3VtbWFyeTtcbiAgLy8gY2xhbmctZm9ybWF0IG9uXG59XG5cblxuZnVuY3Rpb24gdHlwZU1hcFRvRXhwcmVzc2lvbk1hcChcbiAgICBtYXA6IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4sIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCk6IE1hcDxzdHJpbmcsIG8uRXhwcmVzc2lvbj4ge1xuICAvLyBDb252ZXJ0IGVhY2ggbWFwIGVudHJ5IGludG8gYW5vdGhlciBlbnRyeSB3aGVyZSB0aGUgdmFsdWUgaXMgYW4gZXhwcmVzc2lvbiBpbXBvcnRpbmcgdGhlIHR5cGUuXG4gIGNvbnN0IGVudHJpZXMgPSBBcnJheS5mcm9tKG1hcCkubWFwKFxuICAgICAgKFtrZXksIHR5cGVdKTogW3N0cmluZywgby5FeHByZXNzaW9uXSA9PiBba2V5LCBvdXRwdXRDdHguaW1wb3J0RXhwcih0eXBlKV0pO1xuICByZXR1cm4gbmV3IE1hcChlbnRyaWVzKTtcbn1cblxuY29uc3QgSE9TVF9SRUdfRVhQID0gL14oPzooPzpcXFsoW15cXF1dKylcXF0pfCg/OlxcKChbXlxcKV0rKVxcKSkpfChcXEBbLVxcd10rKSQvO1xuXG4vLyBSZXByZXNlbnRzIHRoZSBncm91cHMgaW4gdGhlIGFib3ZlIHJlZ2V4LlxuY29uc3QgZW51bSBIb3N0QmluZGluZ0dyb3VwIHtcbiAgLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiXG4gIFByb3BlcnR5ID0gMSxcblxuICAvLyBncm91cCAyOiBcImV2ZW50XCIgZnJvbSBcIihldmVudClcIlxuICBFdmVudCA9IDIsXG5cbiAgLy8gZ3JvdXAgMzogXCJAdHJpZ2dlclwiIGZyb20gXCJAdHJpZ2dlclwiXG4gIEFuaW1hdGlvbiA9IDMsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhvc3RCaW5kaW5ncyhob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSk6IHtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gIGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICBhbmltYXRpb25zOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbn0ge1xuICBjb25zdCBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBjb25zdCBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IGFuaW1hdGlvbnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5cbiAgT2JqZWN0LmtleXMoaG9zdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gaG9zdFtrZXldO1xuICAgIGNvbnN0IG1hdGNoZXMgPSBrZXkubWF0Y2goSE9TVF9SRUdfRVhQKTtcbiAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgYXR0cmlidXRlc1trZXldID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuUHJvcGVydHldICE9IG51bGwpIHtcbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLlByb3BlcnR5XV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKG1hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF0gIT0gbnVsbCkge1xuICAgICAgbGlzdGVuZXJzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF1dID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW0hvc3RCaW5kaW5nR3JvdXAuQW5pbWF0aW9uXSAhPSBudWxsKSB7XG4gICAgICBhbmltYXRpb25zW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5BbmltYXRpb25dXSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXMsIGFuaW1hdGlvbnN9O1xufVxuIl19