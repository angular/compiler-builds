/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ChangeDetectionStrategy } from '@angular/core/index';
import { identifierName, tokenReference } from '../compile_metadata';
import { EventHandlerVars, convertActionBinding, convertPropertyBinding, convertPropertyBindingBuiltins } from '../compiler_util/expression_converter';
import { CompilerConfig } from '../config';
import { ASTWithSource } from '../expression_parser/ast';
import { Identifiers, createIdentifier, resolveIdentifier } from '../identifiers';
import { CompilerInjectable } from '../injectable';
import * as o from '../output/output_ast';
import { convertValueToOutputAst } from '../output/value_util';
import { LifecycleHooks, viewEngine } from '../private_import_core';
import { ElementSchemaRegistry } from '../schema/element_schema_registry';
import { ElementAst, EmbeddedTemplateAst, NgContentAst, PropertyBindingType, ProviderAstType, templateVisitAll } from '../template_parser/template_ast';
import { ViewCompileResult, ViewCompiler } from '../view_compiler/view_compiler';
const /** @type {?} */ CLASS_ATTR = 'class';
const /** @type {?} */ STYLE_ATTR = 'style';
const /** @type {?} */ IMPLICIT_TEMPLATE_VAR = '\$implicit';
let ViewCompilerNext = class ViewCompilerNext extends ViewCompiler {
    /**
     * @param {?} _genConfigNext
     * @param {?} _schemaRegistryNext
     */
    constructor(_genConfigNext, _schemaRegistryNext) {
        super(_genConfigNext, _schemaRegistryNext);
        this._genConfigNext = _genConfigNext;
        this._schemaRegistryNext = _schemaRegistryNext;
    }
    /**
     * @param {?} component
     * @param {?} template
     * @param {?} styles
     * @param {?} usedPipes
     * @param {?} compiledAnimations
     * @return {?}
     */
    compileComponent(component, template, styles, usedPipes, compiledAnimations) {
        const /** @type {?} */ compName = identifierName(component.type) + (component.isHost ? `_Host` : '');
        let /** @type {?} */ embeddedViewCount = 0;
        const /** @type {?} */ viewBuilderFactory = (parent) => {
            const /** @type {?} */ embeddedViewIndex = embeddedViewCount++;
            const /** @type {?} */ viewName = `view_${compName}_${embeddedViewIndex}`;
            return new ViewBuilder(parent, viewName, usedPipes, viewBuilderFactory);
        };
        const /** @type {?} */ visitor = viewBuilderFactory(null);
        visitor.visitAll([], template, 0);
        const /** @type {?} */ statements = [];
        statements.push(...visitor.build(component));
        return new ViewCompileResult(statements, visitor.viewName, []);
    }
};
ViewCompilerNext = __decorate([
    CompilerInjectable(),
    __metadata("design:paramtypes", [CompilerConfig,
        ElementSchemaRegistry])
], ViewCompilerNext);
export { ViewCompilerNext };
function ViewCompilerNext_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewCompilerNext.prototype._genConfigNext;
    /** @type {?} */
    ViewCompilerNext.prototype._schemaRegistryNext;
}
const /** @type {?} */ VIEW_VAR = o.variable('view');
const /** @type {?} */ CHECK_VAR = o.variable('check');
const /** @type {?} */ COMP_VAR = o.variable('comp');
const /** @type {?} */ NODE_INDEX_VAR = o.variable('nodeIndex');
const /** @type {?} */ EVENT_NAME_VAR = o.variable('eventName');
const /** @type {?} */ ALLOW_DEFAULT_VAR = o.variable(`allowDefault`);
class ViewBuilder {
    /**
     * @param {?} parent
     * @param {?} viewName
     * @param {?} usedPipes
     * @param {?} viewBuilderFactory
     */
    constructor(parent, viewName, usedPipes, viewBuilderFactory) {
        this.parent = parent;
        this.viewName = viewName;
        this.usedPipes = usedPipes;
        this.viewBuilderFactory = viewBuilderFactory;
        this.nodeDefs = [];
        this.purePipeNodeIndices = {};
        this.refNodeIndices = {};
        this.variables = [];
        this.children = [];
        this.updateDirectivesExpressions = [];
        this.updateRendererExpressions = [];
        this.handleEventExpressions = [];
    }
    /**
     * @param {?} variables
     * @param {?} astNodes
     * @param {?} elementDepth
     * @return {?}
     */
    visitAll(variables, astNodes, elementDepth) {
        this.variables = variables;
        // create the pipes for the pure pipes immediately, so that we know their indices.
        if (!this.parent) {
            this.usedPipes.forEach((pipe) => {
                if (pipe.pure) {
                    this.purePipeNodeIndices[pipe.name] = this._createPipe(pipe);
                }
            });
        }
        templateVisitAll(this, astNodes, { elementDepth });
        if (astNodes.length === 0 ||
            (this.parent && needsAdditionalRootNode(astNodes[astNodes.length - 1]))) {
            // if the view is empty, or an embedded view has a view container as last root nde,
            // create an additional root node.
            this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.anchorDef)).callFn([
                o.literal(viewEngine.NodeFlags.None), o.NULL_EXPR, o.NULL_EXPR, o.literal(0)
            ]));
        }
    }
    /**
     * @param {?} component
     * @param {?=} targetStatements
     * @return {?}
     */
    build(component, targetStatements = []) {
        const /** @type {?} */ compType = o.importType(component.type);
        this.children.forEach((child) => { child.build(component, targetStatements); });
        const /** @type {?} */ updateDirectivesFn = this._createUpdateFn(this.updateDirectivesExpressions, compType);
        const /** @type {?} */ updateRendererFn = this._createUpdateFn(this.updateRendererExpressions, compType);
        const /** @type {?} */ handleEventStmts = [];
        let /** @type {?} */ handleEventBindingCount = 0;
        this.handleEventExpressions.forEach(({ expression, context, nodeIndex, eventName }) => {
            const /** @type {?} */ bindingId = `${handleEventBindingCount++}`;
            const /** @type {?} */ nameResolver = context === COMP_VAR ? this : null;
            const { stmts, allowDefault } = convertActionBinding(nameResolver, context, expression, bindingId);
            const /** @type {?} */ trueStmts = stmts;
            if (allowDefault) {
                trueStmts.push(ALLOW_DEFAULT_VAR.set(allowDefault.and(ALLOW_DEFAULT_VAR)).toStmt());
            }
            handleEventStmts.push(new o.IfStmt(o.literal(nodeIndex)
                .identical(NODE_INDEX_VAR)
                .and(o.literal(eventName).identical(EVENT_NAME_VAR)), trueStmts));
        });
        let /** @type {?} */ handleEventFn;
        if (handleEventStmts.length > 0) {
            handleEventFn = o.fn([
                new o.FnParam(VIEW_VAR.name), new o.FnParam(NODE_INDEX_VAR.name),
                new o.FnParam(EVENT_NAME_VAR.name), new o.FnParam(EventHandlerVars.event.name)
            ], [
                ALLOW_DEFAULT_VAR.set(o.literal(true)).toDeclStmt(o.BOOL_TYPE),
                COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(compType), ...handleEventStmts,
                new o.ReturnStatement(ALLOW_DEFAULT_VAR)
            ]);
        }
        else {
            handleEventFn = o.NULL_EXPR;
        }
        let /** @type {?} */ viewFlags = viewEngine.ViewFlags.None;
        if (!this.parent && component.changeDetection === ChangeDetectionStrategy.OnPush) {
            viewFlags |= viewEngine.ViewFlags.OnPush;
        }
        const /** @type {?} */ viewFactory = new o.DeclareFunctionStmt(this.viewName, [], [new o.ReturnStatement(o.importExpr(createIdentifier(Identifiers.viewDef)).callFn([
                o.literal(viewFlags), o.literalArr(this.nodeDefs), updateDirectivesFn, updateRendererFn,
                handleEventFn
            ]))]);
        targetStatements.push(viewFactory);
        return targetStatements;
    }
    /**
     * @param {?} expressions
     * @param {?} compType
     * @return {?}
     */
    _createUpdateFn(expressions, compType) {
        const /** @type {?} */ updateStmts = [];
        let /** @type {?} */ updateBindingCount = 0;
        expressions.forEach(({ expressions, nodeIndex }) => {
            const /** @type {?} */ exprs = expressions.map(({ context, value }) => {
                const /** @type {?} */ bindingId = `${updateBindingCount++}`;
                const /** @type {?} */ nameResolver = context === COMP_VAR ? this : null;
                const { stmts, currValExpr } = convertPropertyBinding(nameResolver, context, value, bindingId);
                updateStmts.push(...stmts);
                return currValExpr;
            });
            updateStmts.push(callCheckStmt(nodeIndex, exprs).toStmt());
        });
        let /** @type {?} */ updateFn;
        if (updateStmts.length > 0) {
            updateFn = o.fn([new o.FnParam(CHECK_VAR.name), new o.FnParam(VIEW_VAR.name)], [COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(compType), ...updateStmts]);
        }
        else {
            updateFn = o.NULL_EXPR;
        }
        return updateFn;
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitNgContent(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitText(ast, context) {
        // textDef(ngContentIndex: number, constants: string[]): NodeDef;
        this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.textDef)).callFn([
            o.NULL_EXPR, o.literalArr([o.literal(ast.value)])
        ]));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitBoundText(ast, context) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array
        this.nodeDefs.push(null);
        const /** @type {?} */ astWithSource = (ast.value);
        const /** @type {?} */ inter = (astWithSource.ast);
        this._addUpdateExpressions(nodeIndex, inter.expressions.map((expr) => { return { context: COMP_VAR, value: expr }; }), this.updateRendererExpressions);
        // textDef(ngContentIndex: number, constants: string[]): NodeDef;
        this.nodeDefs[nodeIndex] = o.importExpr(createIdentifier(Identifiers.textDef)).callFn([
            o.NULL_EXPR, o.literalArr(inter.strings.map(s => o.literal(s)))
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitEmbeddedTemplate(ast, context) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array
        this.nodeDefs.push(null);
        const { flags, queryMatchesExpr } = this._visitElementOrTemplate(nodeIndex, ast, context);
        const /** @type {?} */ childVisitor = this.viewBuilderFactory(this);
        this.children.push(childVisitor);
        childVisitor.visitAll(ast.variables, ast.children, context.elementDepth + 1);
        const /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        // anchorDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
        //   childCount: number, templateFactory?: ViewDefinitionFactory): NodeDef;
        this.nodeDefs[nodeIndex] = o.importExpr(createIdentifier(Identifiers.anchorDef)).callFn([
            o.literal(flags), queryMatchesExpr, o.NULL_EXPR, o.literal(childCount),
            o.variable(childVisitor.viewName)
        ]);
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElement(ast, context) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        const { flags, usedEvents, queryMatchesExpr, hostBindings } = this._visitElementOrTemplate(nodeIndex, ast, context);
        templateVisitAll(this, ast.children, { elementDepth: context.elementDepth + 1 });
        ast.inputs.forEach((inputAst) => { hostBindings.push({ context: COMP_VAR, value: inputAst.value }); });
        this._addUpdateExpressions(nodeIndex, hostBindings, this.updateRendererExpressions);
        const /** @type {?} */ inputDefs = elementBindingDefs(ast.inputs);
        ast.directives.forEach((dirAst, dirIndex) => { inputDefs.push(...elementBindingDefs(dirAst.hostProperties)); });
        const /** @type {?} */ outputDefs = usedEvents.map(([target, eventName]) => {
            return target ? o.literalArr([o.literal(target), o.literal(eventName)]) :
                o.literal(eventName);
        });
        const /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        // elementDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
        //   childCount: number, name: string, fixedAttrs: {[name: string]: string} = {},
        //   bindings?:
        //       ([BindingType.ElementClass, string] | [BindingType.ElementStyle, string, string] |
        //         [BindingType.ElementAttribute | BindingType.ElementProperty, string,
        //         SecurityContext])[],
        //   outputs?: (string | [string, string])[]): NodeDef;
        this.nodeDefs[nodeIndex] = o.importExpr(createIdentifier(Identifiers.elementDef)).callFn([
            o.literal(flags), queryMatchesExpr, o.NULL_EXPR, o.literal(childCount), o.literal(ast.name),
            fixedAttrsDef(ast), inputDefs.length ? o.literalArr(inputDefs) : o.NULL_EXPR,
            outputDefs.length ? o.literalArr(outputDefs) : o.NULL_EXPR
        ]);
    }
    /**
     * @param {?} nodeIndex
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    _visitElementOrTemplate(nodeIndex, ast, context) {
        let /** @type {?} */ flags = viewEngine.NodeFlags.None;
        if (ast.hasViewContainer) {
            flags |= viewEngine.NodeFlags.HasEmbeddedViews;
        }
        const /** @type {?} */ usedEvents = new Map();
        ast.outputs.forEach((event) => {
            usedEvents.set(viewEngine.elementEventFullName(event.target, event.name), [event.target, event.name]);
        });
        ast.directives.forEach((dirAst) => {
            dirAst.hostEvents.forEach((event) => {
                usedEvents.set(viewEngine.elementEventFullName(event.target, event.name), [event.target, event.name]);
            });
        });
        const /** @type {?} */ hostBindings = [];
        const /** @type {?} */ hostEvents = [];
        ast.providers.forEach((providerAst, providerIndex) => {
            let /** @type {?} */ dirAst;
            let /** @type {?} */ dirIndex;
            ast.directives.forEach((localDirAst, i) => {
                if (localDirAst.directive.type.reference === providerAst.token.identifier.reference) {
                    dirAst = localDirAst;
                    dirIndex = i;
                }
            });
            if (dirAst) {
                const { hostBindings: dirHostBindings, hostEvents: dirHostEvents } = this._visitDirective(providerAst, dirAst, dirIndex, nodeIndex, context.elementDepth, ast.references, ast.queryMatches, usedEvents);
                hostBindings.push(...dirHostBindings);
                hostEvents.push(...dirHostEvents);
            }
            else {
                this._visitProvider(providerAst, ast.queryMatches);
            }
        });
        let /** @type {?} */ queryMatchExprs = [];
        ast.queryMatches.forEach((match) => {
            let /** @type {?} */ valueType;
            if (tokenReference(match.value) === resolveIdentifier(Identifiers.ElementRef)) {
                valueType = viewEngine.QueryValueType.ElementRef;
            }
            else if (tokenReference(match.value) === resolveIdentifier(Identifiers.ViewContainerRef)) {
                valueType = viewEngine.QueryValueType.ViewContainerRef;
            }
            else if (tokenReference(match.value) === resolveIdentifier(Identifiers.TemplateRef)) {
                valueType = viewEngine.QueryValueType.TemplateRef;
            }
            if (valueType != null) {
                queryMatchExprs.push(o.literalArr([o.literal(calcQueryId(match.query)), o.literal(valueType)]));
            }
        });
        ast.references.forEach((ref) => {
            let /** @type {?} */ valueType;
            if (!ref.value) {
                valueType = viewEngine.QueryValueType.RenderElement;
            }
            else if (tokenReference(ref.value) === resolveIdentifier(Identifiers.TemplateRef)) {
                valueType = viewEngine.QueryValueType.TemplateRef;
            }
            if (valueType != null) {
                this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal(`#${ref.name}`), o.literal(valueType)]));
            }
        });
        ast.outputs.forEach((outputAst) => { hostEvents.push({ context: COMP_VAR, eventAst: outputAst }); });
        hostEvents.forEach((hostEvent) => {
            this._addHandleEventExpression(nodeIndex, hostEvent.context, viewEngine.elementEventFullName(hostEvent.eventAst.target, hostEvent.eventAst.name), hostEvent.eventAst.handler);
        });
        return {
            flags,
            usedEvents: Array.from(usedEvents.values()),
            queryMatchesExpr: queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            hostBindings,
        };
    }
    /**
     * @param {?} providerAst
     * @param {?} directiveAst
     * @param {?} directiveIndex
     * @param {?} elementNodeIndex
     * @param {?} elementDepth
     * @param {?} refs
     * @param {?} queryMatches
     * @param {?} usedEvents
     * @return {?}
     */
    _visitDirective(providerAst, directiveAst, directiveIndex, elementNodeIndex, elementDepth, refs, queryMatches, usedEvents) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        directiveAst.directive.queries.forEach((query, queryIndex) => {
            const /** @type {?} */ queryId = { elementDepth, directiveIndex, queryIndex };
            const /** @type {?} */ bindingType = query.first ? viewEngine.QueryBindingType.First : viewEngine.QueryBindingType.All;
            this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.queryDef)).callFn([
                o.literal(viewEngine.NodeFlags.HasContentQuery), o.literal(calcQueryId(queryId)),
                new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType))])
            ]));
        });
        // Note: the operation below might also create new nodeDefs,
        // but we don't want them to be a child of a directive,
        // as they might be a provider/pipe on their own.
        // I.e. we only allow queries as children of directives nodes.
        const /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        const { flags, queryMatchExprs, providerExpr, providerType, depsExpr } = this._visitProviderOrDirective(providerAst, queryMatches);
        refs.forEach((ref) => {
            if (ref.value && tokenReference(ref.value) === tokenReference(providerAst.token)) {
                this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal(`#${ref.name}`), o.literal(viewEngine.QueryValueType.Provider)]));
            }
        });
        let /** @type {?} */ compView = o.NULL_EXPR;
        if (directiveAst.directive.isComponent) {
            compView = o.importExpr({ reference: directiveAst.directive.componentViewType });
        }
        const /** @type {?} */ inputDefs = directiveAst.inputs.map((inputAst, inputIndex) => {
            const /** @type {?} */ mapValue = o.literalArr([o.literal(inputIndex), o.literal(inputAst.directiveName)]);
            // Note: it's important to not quote the key so that we can capture renames by minifiers!
            return new o.LiteralMapEntry(inputAst.directiveName, mapValue, false);
        });
        const /** @type {?} */ outputDefs = [];
        const /** @type {?} */ dirMeta = directiveAst.directive;
        Object.keys(dirMeta.outputs).forEach((propName) => {
            const /** @type {?} */ eventName = dirMeta.outputs[propName];
            if (usedEvents.has(eventName)) {
                // Note: it's important to not quote the key so that we can capture renames by minifiers!
                outputDefs.push(new o.LiteralMapEntry(propName, o.literal(eventName), false));
            }
        });
        if (directiveAst.inputs.length) {
            this._addUpdateExpressions(nodeIndex, directiveAst.inputs.map((input) => { return { context: COMP_VAR, value: input.value }; }), this.updateDirectivesExpressions);
        }
        const /** @type {?} */ dirContextExpr = o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
            VIEW_VAR, o.literal(nodeIndex)
        ]);
        const /** @type {?} */ hostBindings = directiveAst.hostProperties.map((hostBindingAst) => {
            return {
                value: ((hostBindingAst.value)).ast,
                context: dirContextExpr,
            };
        });
        const /** @type {?} */ hostEvents = directiveAst.hostEvents.map((hostEventAst) => { return { context: dirContextExpr, eventAst: hostEventAst }; });
        // directiveDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], childCount: number, ctor:
        //   any,
        //   deps: ([DepFlags, any] | any)[], props?: {[name: string]: [number, string]},
        //   outputs?: {[name: string]: string}, component?: () => ViewDefinition): NodeDef;
        const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.directiveDef)).callFn([
            o.literal(flags), queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            o.literal(childCount), providerExpr, depsExpr,
            inputDefs.length ? new o.LiteralMapExpr(inputDefs) : o.NULL_EXPR,
            outputDefs.length ? new o.LiteralMapExpr(outputDefs) : o.NULL_EXPR, compView
        ]);
        this.nodeDefs[nodeIndex] = nodeDef;
        return { hostBindings, hostEvents };
    }
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    _visitProvider(providerAst, queryMatches) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        const { flags, queryMatchExprs, providerExpr, providerType, depsExpr } = this._visitProviderOrDirective(providerAst, queryMatches);
        // providerDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], type: ProviderType, token:
        //   any,
        //   value: any, deps: ([DepFlags, any] | any)[]): NodeDef;
        const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.providerDef)).callFn([
            o.literal(flags), queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            o.literal(providerType), tokenExpr(providerAst.token), providerExpr, depsExpr
        ]);
        this.nodeDefs[nodeIndex] = nodeDef;
    }
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    _visitProviderOrDirective(providerAst, queryMatches) {
        let /** @type {?} */ flags = viewEngine.NodeFlags.None;
        if (!providerAst.eager) {
            flags |= viewEngine.NodeFlags.LazyProvider;
        }
        providerAst.lifecycleHooks.forEach((lifecycleHook) => {
            // for regular providers, we only support ngOnDestroy
            if (lifecycleHook === LifecycleHooks.OnDestroy ||
                providerAst.providerType === ProviderAstType.Directive ||
                providerAst.providerType === ProviderAstType.Component) {
                flags |= lifecycleHookToNodeFlag(lifecycleHook);
            }
        });
        let /** @type {?} */ queryMatchExprs = [];
        queryMatches.forEach((match) => {
            if (tokenReference(match.value) === tokenReference(providerAst.token)) {
                queryMatchExprs.push(o.literalArr([o.literal(calcQueryId(match.query)), o.literal(viewEngine.QueryValueType.Provider)]));
            }
        });
        const { providerExpr, providerType, depsExpr } = providerDef(providerAst);
        return { flags, queryMatchExprs, providerExpr, providerType, depsExpr };
    }
    /**
     * @param {?} name
     * @return {?}
     */
    getLocal(name) {
        if (name == EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        let /** @type {?} */ currViewExpr = VIEW_VAR;
        for (let /** @type {?} */ currBuilder = this; currBuilder; currBuilder = currBuilder.parent, currViewExpr = currViewExpr.prop('parent')) {
            // check references
            const /** @type {?} */ refNodeIndex = currBuilder.refNodeIndices[name];
            if (refNodeIndex != null) {
                return o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
                    currViewExpr, o.literal(refNodeIndex)
                ]);
            }
            // check variables
            const /** @type {?} */ varAst = currBuilder.variables.find((varAst) => varAst.name === name);
            if (varAst) {
                const /** @type {?} */ varValue = varAst.value || IMPLICIT_TEMPLATE_VAR;
                return currViewExpr.prop('context').prop(varValue);
            }
        }
        return null;
    }
    /**
     * @param {?} argCount
     * @return {?}
     */
    createLiteralArrayConverter(argCount) {
        if (argCount === 0) {
            const /** @type {?} */ valueExpr = o.importExpr(createIdentifier(Identifiers.EMPTY_ARRAY));
            return () => valueExpr;
        }
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // pureArrayDef(argCount: number): NodeDef;
        const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.pureArrayDef)).callFn([o.literal(argCount)]);
        this.nodeDefs.push(nodeDef);
        return (args) => callCheckStmt(nodeIndex, args);
    }
    /**
     * @param {?} keys
     * @return {?}
     */
    createLiteralMapConverter(keys) {
        if (keys.length === 0) {
            const /** @type {?} */ valueExpr = o.importExpr(createIdentifier(Identifiers.EMPTY_MAP));
            return () => valueExpr;
        }
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // function pureObjectDef(propertyNames: string[]): NodeDef
        const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.pureObjectDef)).callFn([o.literalArr(keys.map(key => o.literal(key)))]);
        this.nodeDefs.push(nodeDef);
        return (args) => callCheckStmt(nodeIndex, args);
    }
    /**
     * @param {?} name
     * @param {?} argCount
     * @return {?}
     */
    createPipeConverter(name, argCount) {
        const /** @type {?} */ pipe = this._findPipe(name);
        if (pipe.pure) {
            const /** @type {?} */ nodeIndex = this.nodeDefs.length;
            // function purePipeDef(argCount: number): NodeDef;
            const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.purePipeDef)).callFn([o.literal(argCount)]);
            this.nodeDefs.push(nodeDef);
            // find underlying pipe in the component view
            let /** @type {?} */ compViewExpr = VIEW_VAR;
            let /** @type {?} */ compBuilder = this;
            while (compBuilder.parent) {
                compBuilder = compBuilder.parent;
                compViewExpr = compViewExpr.prop('parent');
            }
            const /** @type {?} */ pipeNodeIndex = compBuilder.purePipeNodeIndices[name];
            const /** @type {?} */ pipeValueExpr = o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
                compViewExpr, o.literal(pipeNodeIndex)
            ]);
            return (args) => callUnwrapValue(callCheckStmt(nodeIndex, [pipeValueExpr].concat(args)));
        }
        else {
            const /** @type {?} */ nodeIndex = this._createPipe(pipe);
            const /** @type {?} */ nodeValueExpr = o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
                VIEW_VAR, o.literal(nodeIndex)
            ]);
            return (args) => callUnwrapValue(nodeValueExpr.callMethod('transform', args));
        }
    }
    /**
     * @param {?} name
     * @return {?}
     */
    _findPipe(name) {
        return this.usedPipes.find((pipeSummary) => pipeSummary.name === name);
    }
    /**
     * @param {?} pipe
     * @return {?}
     */
    _createPipe(pipe) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        let /** @type {?} */ flags = viewEngine.NodeFlags.None;
        pipe.type.lifecycleHooks.forEach((lifecycleHook) => {
            // for pipes, we only support ngOnDestroy
            if (lifecycleHook === LifecycleHooks.OnDestroy) {
                flags |= lifecycleHookToNodeFlag(lifecycleHook);
            }
        });
        const /** @type {?} */ depExprs = pipe.type.diDeps.map(depDef);
        // function pipeDef(
        //   flags: NodeFlags, ctor: any, deps: ([DepFlags, any] | any)[]): NodeDef
        const /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.pipeDef)).callFn([
            o.literal(flags), o.importExpr(pipe.type), o.literalArr(depExprs)
        ]);
        this.nodeDefs.push(nodeDef);
        return nodeIndex;
    }
    /**
     * @param {?} nodeIndex
     * @param {?} expressions
     * @param {?} target
     * @return {?}
     */
    _addUpdateExpressions(nodeIndex, expressions, target) {
        if (expressions.length === 0) {
            return;
        }
        const /** @type {?} */ transformedExpressions = expressions.map(({ context, value }) => {
            if (value instanceof ASTWithSource) {
                value = value.ast;
            }
            return { context, value: convertPropertyBindingBuiltins(this, value) };
        });
        target.push({ nodeIndex, expressions: transformedExpressions });
    }
    /**
     * @param {?} nodeIndex
     * @param {?} context
     * @param {?} eventName
     * @param {?} expression
     * @return {?}
     */
    _addHandleEventExpression(nodeIndex, context, eventName, expression) {
        if (expression instanceof ASTWithSource) {
            expression = expression.ast;
        }
        this.handleEventExpressions.push({ nodeIndex, context, eventName, expression });
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirective(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitDirectiveProperty(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitReference(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitVariable(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitEvent(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitElementProperty(ast, context) { }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitAttr(ast, context) { }
}
function ViewBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewBuilder.prototype.nodeDefs;
    /** @type {?} */
    ViewBuilder.prototype.purePipeNodeIndices;
    /** @type {?} */
    ViewBuilder.prototype.refNodeIndices;
    /** @type {?} */
    ViewBuilder.prototype.variables;
    /** @type {?} */
    ViewBuilder.prototype.children;
    /** @type {?} */
    ViewBuilder.prototype.updateDirectivesExpressions;
    /** @type {?} */
    ViewBuilder.prototype.updateRendererExpressions;
    /** @type {?} */
    ViewBuilder.prototype.handleEventExpressions;
    /** @type {?} */
    ViewBuilder.prototype.parent;
    /** @type {?} */
    ViewBuilder.prototype.viewName;
    /** @type {?} */
    ViewBuilder.prototype.usedPipes;
    /** @type {?} */
    ViewBuilder.prototype.viewBuilderFactory;
}
/**
 * @param {?} providerAst
 * @return {?}
 */
function providerDef(providerAst) {
    return providerAst.multiProvider ? multiProviderDef(providerAst.providers) :
        singleProviderDef(providerAst.providers[0]);
}
/**
 * @param {?} providers
 * @return {?}
 */
function multiProviderDef(providers) {
    const /** @type {?} */ allDepDefs = [];
    const /** @type {?} */ allParams = [];
    const /** @type {?} */ exprs = providers.map((provider, providerIndex) => {
        const /** @type {?} */ depExprs = provider.deps.map((dep, depIndex) => {
            const /** @type {?} */ paramName = `p${providerIndex}_${depIndex}`;
            allParams.push(new o.FnParam(paramName, o.DYNAMIC_TYPE));
            allDepDefs.push(depDef(dep));
            return o.variable(paramName);
        });
        let /** @type {?} */ expr;
        if (provider.useClass) {
            expr = o.importExpr(provider.useClass).instantiate(depExprs);
        }
        else if (provider.useFactory) {
            expr = o.importExpr(provider.useFactory).callFn(depExprs);
        }
        else if (provider.useExisting) {
            expr = depExprs[0];
        }
        else {
            expr = convertValueToOutputAst(provider.useValue);
        }
        return expr;
    });
    const /** @type {?} */ providerExpr = o.fn(allParams, [new o.ReturnStatement(o.literalArr(exprs))]);
    return {
        providerExpr,
        providerType: viewEngine.ProviderType.Factory,
        depsExpr: o.literalArr(allDepDefs)
    };
}
/**
 * @param {?} providerMeta
 * @return {?}
 */
function singleProviderDef(providerMeta) {
    let /** @type {?} */ providerExpr;
    let /** @type {?} */ providerType;
    let /** @type {?} */ deps;
    if (providerMeta.useClass) {
        providerExpr = o.importExpr(providerMeta.useClass);
        providerType = viewEngine.ProviderType.Class;
        deps = providerMeta.deps || providerMeta.useClass.diDeps;
    }
    else if (providerMeta.useFactory) {
        providerExpr = o.importExpr(providerMeta.useFactory);
        providerType = viewEngine.ProviderType.Factory;
        deps = providerMeta.deps || providerMeta.useFactory.diDeps;
    }
    else if (providerMeta.useExisting) {
        providerExpr = o.NULL_EXPR;
        providerType = viewEngine.ProviderType.UseExisting;
        deps = [{ token: providerMeta.useExisting }];
    }
    else {
        providerExpr = convertValueToOutputAst(providerMeta.useValue);
        providerType = viewEngine.ProviderType.Value;
        deps = [];
    }
    const /** @type {?} */ depsExpr = o.literalArr(deps.map(dep => depDef(dep)));
    return { providerExpr, providerType, depsExpr };
}
/**
 * @param {?} tokenMeta
 * @return {?}
 */
function tokenExpr(tokenMeta) {
    return tokenMeta.identifier ? o.importExpr(tokenMeta.identifier) : o.literal(tokenMeta.value);
}
/**
 * @param {?} dep
 * @return {?}
 */
function depDef(dep) {
    // Note: the following fields have already been normalized out by provider_analyzer:
    // - isAttribute, isSelf, isHost
    const /** @type {?} */ expr = dep.isValue ? convertValueToOutputAst(dep.value) : tokenExpr(dep.token);
    let /** @type {?} */ flags = viewEngine.DepFlags.None;
    if (dep.isSkipSelf) {
        flags |= viewEngine.DepFlags.SkipSelf;
    }
    if (dep.isOptional) {
        flags |= viewEngine.DepFlags.Optional;
    }
    if (dep.isValue) {
        flags |= viewEngine.DepFlags.Value;
    }
    return flags === viewEngine.DepFlags.None ? expr : o.literalArr([o.literal(flags), expr]);
}
/**
 * @param {?} ast
 * @return {?}
 */
function needsAdditionalRootNode(ast) {
    if (ast instanceof EmbeddedTemplateAst) {
        return ast.hasViewContainer;
    }
    if (ast instanceof ElementAst) {
        return ast.hasViewContainer;
    }
    return ast instanceof NgContentAst;
}
/**
 * @param {?} queryId
 * @return {?}
 */
function calcQueryId(queryId) {
    if (queryId.directiveIndex == null) {
        // view query
        return `v${queryId.queryIndex}`;
    }
    else {
        return `c${queryId.elementDepth}_${queryId.directiveIndex}_${queryId.queryIndex}`;
    }
}
/**
 * @param {?} lifecycleHook
 * @return {?}
 */
function lifecycleHookToNodeFlag(lifecycleHook) {
    let /** @type {?} */ nodeFlag = viewEngine.NodeFlags.None;
    switch (lifecycleHook) {
        case LifecycleHooks.AfterContentChecked:
            nodeFlag = viewEngine.NodeFlags.AfterContentChecked;
            break;
        case LifecycleHooks.AfterContentInit:
            nodeFlag = viewEngine.NodeFlags.AfterContentInit;
            break;
        case LifecycleHooks.AfterViewChecked:
            nodeFlag = viewEngine.NodeFlags.AfterViewChecked;
            break;
        case LifecycleHooks.AfterViewInit:
            nodeFlag = viewEngine.NodeFlags.AfterViewInit;
            break;
        case LifecycleHooks.DoCheck:
            nodeFlag = viewEngine.NodeFlags.DoCheck;
            break;
        case LifecycleHooks.OnChanges:
            nodeFlag = viewEngine.NodeFlags.OnChanges;
            break;
        case LifecycleHooks.OnDestroy:
            nodeFlag = viewEngine.NodeFlags.OnDestroy;
            break;
        case LifecycleHooks.OnInit:
            nodeFlag = viewEngine.NodeFlags.OnInit;
            break;
    }
    return nodeFlag;
}
/**
 * @param {?} inputAsts
 * @return {?}
 */
function elementBindingDefs(inputAsts) {
    return inputAsts.map((inputAst) => {
        switch (inputAst.type) {
            case PropertyBindingType.Attribute:
                return o.literalArr([
                    o.literal(viewEngine.BindingType.ElementAttribute), o.literal(inputAst.name),
                    o.literal(inputAst.securityContext)
                ]);
            case PropertyBindingType.Property:
                return o.literalArr([
                    o.literal(viewEngine.BindingType.ElementProperty), o.literal(inputAst.name),
                    o.literal(inputAst.securityContext)
                ]);
            case PropertyBindingType.Class:
                return o.literalArr([o.literal(viewEngine.BindingType.ElementClass), o.literal(inputAst.name)]);
            case PropertyBindingType.Style:
                return o.literalArr([
                    o.literal(viewEngine.BindingType.ElementStyle), o.literal(inputAst.name),
                    o.literal(inputAst.unit)
                ]);
        }
    });
}
/**
 * @param {?} elementAst
 * @return {?}
 */
function fixedAttrsDef(elementAst) {
    const /** @type {?} */ mapResult = {};
    elementAst.attrs.forEach(attrAst => { mapResult[attrAst.name] = attrAst.value; });
    elementAst.directives.forEach(dirAst => {
        Object.keys(dirAst.directive.hostAttributes).forEach(name => {
            const /** @type {?} */ value = dirAst.directive.hostAttributes[name];
            const /** @type {?} */ prevValue = mapResult[name];
            mapResult[name] = prevValue != null ? mergeAttributeValue(name, prevValue, value) : value;
        });
    });
    const /** @type {?} */ mapEntries = [];
    // Note: We need to sort to get a defined output order
    // for tests and for caching generated artifacts...
    Object.keys(mapResult).sort().forEach((attrName) => {
        mapEntries.push(new o.LiteralMapEntry(attrName, o.literal(mapResult[attrName]), true));
    });
    return new o.LiteralMapExpr(mapEntries);
}
/**
 * @param {?} attrName
 * @param {?} attrValue1
 * @param {?} attrValue2
 * @return {?}
 */
function mergeAttributeValue(attrName, attrValue1, attrValue2) {
    if (attrName == CLASS_ATTR || attrName == STYLE_ATTR) {
        return `${attrValue1} ${attrValue2}`;
    }
    else {
        return attrValue2;
    }
}
/**
 * @param {?} nodeIndex
 * @param {?} exprs
 * @return {?}
 */
function callCheckStmt(nodeIndex, exprs) {
    if (exprs.length > 10) {
        return CHECK_VAR.callFn([
            VIEW_VAR, o.literal(nodeIndex), o.literal(viewEngine.ArgumentType.Dynamic),
            o.literalArr(exprs)
        ]);
    }
    else {
        return CHECK_VAR.callFn([VIEW_VAR, o.literal(nodeIndex), o.literal(viewEngine.ArgumentType.Inline), ...exprs]);
    }
}
/**
 * @param {?} expr
 * @return {?}
 */
function callUnwrapValue(expr) {
    return o.importExpr(createIdentifier(Identifiers.unwrapValue)).callFn([expr]);
}
//# sourceMappingURL=view_compiler.js.map