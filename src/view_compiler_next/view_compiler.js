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
import { identifierName, rendererTypeName, tokenReference, viewClassName } from '../compile_metadata';
import { EventHandlerVars, convertActionBinding, convertPropertyBinding, convertPropertyBindingBuiltins } from '../compiler_util/expression_converter';
import { CompilerConfig } from '../config';
import { ASTWithSource } from '../expression_parser/ast';
import { Identifiers, createIdentifier, createIdentifierToken, resolveIdentifier } from '../identifiers';
import { CompilerInjectable } from '../injectable';
import * as o from '../output/output_ast';
import { convertValueToOutputAst } from '../output/value_util';
import { LifecycleHooks, viewEngine } from '../private_import_core';
import { ElementSchemaRegistry } from '../schema/element_schema_registry';
import { ElementAst, EmbeddedTemplateAst, NgContentAst, PropertyBindingType, ProviderAst, ProviderAstType, templateVisitAll } from '../template_parser/template_ast';
import { ViewCompileResult, ViewCompiler } from '../view_compiler/view_compiler';
const /** @type {?} */ CLASS_ATTR = 'class';
const /** @type {?} */ STYLE_ATTR = 'style';
const /** @type {?} */ IMPLICIT_TEMPLATE_VAR = '\$implicit';
const /** @type {?} */ NG_CONTAINER_TAG = 'ng-container';
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
        const /** @type {?} */ staticQueryIds = findStaticQueryIds(template);
        const /** @type {?} */ statements = [];
        const /** @type {?} */ renderComponentVar = o.variable(rendererTypeName(component.type.reference));
        statements.push(renderComponentVar
            .set(o.importExpr(createIdentifier(Identifiers.createRendererTypeV2)).callFn([
            new o.LiteralMapExpr([
                new o.LiteralMapEntry('encapsulation', o.literal(component.template.encapsulation)),
                new o.LiteralMapEntry('styles', styles),
                // TODO: copy this from the @Component directive...
                new o.LiteralMapEntry('data', o.literalMap([])),
            ])
        ]))
            .toDeclStmt());
        const /** @type {?} */ viewBuilderFactory = (parent) => {
            const /** @type {?} */ embeddedViewIndex = embeddedViewCount++;
            const /** @type {?} */ viewName = viewClassName(component.type.reference, embeddedViewIndex);
            return new ViewBuilder(parent, component, viewName, usedPipes, staticQueryIds, viewBuilderFactory);
        };
        const /** @type {?} */ visitor = viewBuilderFactory(null);
        visitor.visitAll([], template);
        statements.push(...visitor.build());
        return new ViewCompileResult(statements, visitor.viewName, renderComponentVar.name, []);
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
     * @param {?} component
     * @param {?} viewName
     * @param {?} usedPipes
     * @param {?} staticQueryIds
     * @param {?} viewBuilderFactory
     */
    constructor(parent, component, viewName, usedPipes, staticQueryIds, viewBuilderFactory) {
        this.parent = parent;
        this.component = component;
        this.viewName = viewName;
        this.usedPipes = usedPipes;
        this.staticQueryIds = staticQueryIds;
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
     * @return {?}
     */
    visitAll(variables, astNodes) {
        this.variables = variables;
        // create the pipes for the pure pipes immediately, so that we know their indices.
        if (!this.parent) {
            this.usedPipes.forEach((pipe) => {
                if (pipe.pure) {
                    this.purePipeNodeIndices[pipe.name] = this._createPipe(pipe);
                }
            });
        }
        if (!this.parent) {
            const /** @type {?} */ queryIds = staticViewQueryIds(this.staticQueryIds);
            this.component.viewQueries.forEach((query, queryIndex) => {
                // Note: queries start with id 1 so we can use the number in a Bloom filter!
                const /** @type {?} */ queryId = queryIndex + 1;
                const /** @type {?} */ bindingType = query.first ? viewEngine.QueryBindingType.First : viewEngine.QueryBindingType.All;
                let /** @type {?} */ flags = viewEngine.NodeFlags.HasViewQuery;
                if (queryIds.staticQueryIds.has(queryId)) {
                    flags |= viewEngine.NodeFlags.HasStaticQuery;
                }
                else {
                    flags |= viewEngine.NodeFlags.HasDynamicQuery;
                }
                this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.queryDef)).callFn([
                    o.literal(flags), o.literal(queryId),
                    new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType))])
                ]));
            });
        }
        templateVisitAll(this, astNodes);
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
     * @param {?=} targetStatements
     * @return {?}
     */
    build(targetStatements = []) {
        const /** @type {?} */ compType = o.importType(this.component.type);
        this.children.forEach((child) => child.build(targetStatements));
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
        if (!this.parent && this.component.changeDetection === ChangeDetectionStrategy.OnPush) {
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
    visitNgContent(ast, context) {
        // ngContentDef(ngContentIndex: number, index: number): NodeDef;
        this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.ngContentDef)).callFn([
            o.literal(ast.ngContentIndex), o.literal(ast.index)
        ]));
    }
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    visitText(ast, context) {
        // textDef(ngContentIndex: number, constants: string[]): NodeDef;
        this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.textDef)).callFn([
            o.literal(ast.ngContentIndex), o.literalArr([o.literal(ast.value)])
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
            o.literal(ast.ngContentIndex), o.literalArr(inter.strings.map(s => o.literal(s)))
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
        const { flags, queryMatchesExpr } = this._visitElementOrTemplate(nodeIndex, ast);
        const /** @type {?} */ childVisitor = this.viewBuilderFactory(this);
        this.children.push(childVisitor);
        childVisitor.visitAll(ast.variables, ast.children);
        const /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        // anchorDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
        //   childCount: number, templateFactory?: ViewDefinitionFactory): NodeDef;
        this.nodeDefs[nodeIndex] = o.importExpr(createIdentifier(Identifiers.anchorDef)).callFn([
            o.literal(flags), queryMatchesExpr, o.literal(ast.ngContentIndex), o.literal(childCount),
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
        let /** @type {?} */ elName = ast.name;
        if (ast.name === NG_CONTAINER_TAG) {
            // Using a null element name creates an anchor.
            elName = null;
        }
        let { flags, usedEvents, queryMatchesExpr, hostBindings } = this._visitElementOrTemplate(nodeIndex, ast);
        let /** @type {?} */ inputDefs = [];
        let /** @type {?} */ outputDefs = [];
        if (elName) {
            ast.inputs.forEach((inputAst) => { hostBindings.push({ context: COMP_VAR, value: inputAst.value }); });
            if (hostBindings.length) {
                this._addUpdateExpressions(nodeIndex, hostBindings, this.updateRendererExpressions);
            }
            inputDefs = elementBindingDefs(ast.inputs);
            ast.directives.forEach((dirAst, dirIndex) => inputDefs.push(...elementBindingDefs(dirAst.hostProperties)));
            outputDefs = usedEvents.map(([target, eventName]) => {
                return target ? o.literalArr([o.literal(target), o.literal(eventName)]) :
                    o.literal(eventName);
            });
        }
        templateVisitAll(this, ast.children);
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
            o.literal(flags), queryMatchesExpr, o.literal(ast.ngContentIndex), o.literal(childCount),
            o.literal(elName), elName ? fixedAttrsDef(ast) : o.NULL_EXPR,
            inputDefs.length ? o.literalArr(inputDefs) : o.NULL_EXPR,
            outputDefs.length ? o.literalArr(outputDefs) : o.NULL_EXPR
        ]);
    }
    /**
     * @param {?} nodeIndex
     * @param {?} ast
     * @return {?}
     */
    _visitElementOrTemplate(nodeIndex, ast) {
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
        const /** @type {?} */ componentFactoryResolverProvider = createComponentFactoryResolver(ast.directives);
        if (componentFactoryResolverProvider) {
            this._visitProvider(componentFactoryResolverProvider, ast.queryMatches);
        }
        ast.providers.forEach((providerAst, providerIndex) => {
            let /** @type {?} */ dirAst;
            let /** @type {?} */ dirIndex;
            ast.directives.forEach((localDirAst, i) => {
                if (localDirAst.directive.type.reference === tokenReference(providerAst.token)) {
                    dirAst = localDirAst;
                    dirIndex = i;
                }
            });
            if (dirAst) {
                const { hostBindings: dirHostBindings, hostEvents: dirHostEvents } = this._visitDirective(providerAst, dirAst, dirIndex, nodeIndex, ast.references, ast.queryMatches, usedEvents, this.staticQueryIds.get(/** @type {?} */ (ast)));
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
                queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(valueType)]));
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
                queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(valueType)]));
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
     * @param {?} refs
     * @param {?} queryMatches
     * @param {?} usedEvents
     * @param {?} queryIds
     * @return {?}
     */
    _visitDirective(providerAst, directiveAst, directiveIndex, elementNodeIndex, refs, queryMatches, usedEvents, queryIds) {
        const /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        directiveAst.directive.queries.forEach((query, queryIndex) => {
            let /** @type {?} */ flags = viewEngine.NodeFlags.HasContentQuery;
            const /** @type {?} */ queryId = directiveAst.contentQueryStartId + queryIndex;
            if (queryIds.staticQueryIds.has(queryId)) {
                flags |= viewEngine.NodeFlags.HasStaticQuery;
            }
            else {
                flags |= viewEngine.NodeFlags.HasDynamicQuery;
            }
            const /** @type {?} */ bindingType = query.first ? viewEngine.QueryBindingType.First : viewEngine.QueryBindingType.All;
            this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.queryDef)).callFn([
                o.literal(flags), o.literal(queryId),
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
                queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(viewEngine.QueryValueType.Provider)]));
            }
        });
        let /** @type {?} */ rendererType = o.NULL_EXPR;
        let /** @type {?} */ compView = o.NULL_EXPR;
        if (directiveAst.directive.isComponent) {
            compView = o.importExpr({ reference: directiveAst.directive.componentViewType });
            rendererType = o.importExpr({ reference: directiveAst.directive.rendererType });
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
        if (directiveAst.inputs.length ||
            (flags & (viewEngine.NodeFlags.DoCheck | viewEngine.NodeFlags.OnInit)) > 0) {
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
            outputDefs.length ? new o.LiteralMapExpr(outputDefs) : o.NULL_EXPR, compView, rendererType
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
        if (providerAst.providerType === ProviderAstType.PrivateService) {
            flags |= viewEngine.NodeFlags.PrivateProvider;
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
                queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(viewEngine.QueryValueType.Provider)]));
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
    ViewBuilder.prototype.component;
    /** @type {?} */
    ViewBuilder.prototype.viewName;
    /** @type {?} */
    ViewBuilder.prototype.usedPipes;
    /** @type {?} */
    ViewBuilder.prototype.staticQueryIds;
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
        let /** @type {?} */ expr;
        if (provider.useClass) {
            const /** @type {?} */ depExprs = convertDeps(providerIndex, provider.deps || provider.useClass.diDeps);
            expr = o.importExpr(provider.useClass).instantiate(depExprs);
        }
        else if (provider.useFactory) {
            const /** @type {?} */ depExprs = convertDeps(providerIndex, provider.deps || provider.useFactory.diDeps);
            expr = o.importExpr(provider.useFactory).callFn(depExprs);
        }
        else if (provider.useExisting) {
            const /** @type {?} */ depExprs = convertDeps(providerIndex, [{ token: provider.useExisting }]);
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
    /**
     * @param {?} providerIndex
     * @param {?} deps
     * @return {?}
     */
    function convertDeps(providerIndex, deps) {
        return deps.map((dep, depIndex) => {
            const /** @type {?} */ paramName = `p${providerIndex}_${depIndex}`;
            allParams.push(new o.FnParam(paramName, o.DYNAMIC_TYPE));
            allDepDefs.push(depDef(dep));
            return o.variable(paramName);
        });
    }
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
    return o.literalArr(Object.keys(mapResult).sort().map((attrName) => o.literalArr([o.literal(attrName), o.literal(mapResult[attrName])])));
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
/**
 * @param {?} nodes
 * @param {?=} result
 * @return {?}
 */
function findStaticQueryIds(nodes, result = new Map()) {
    nodes.forEach((node) => {
        const /** @type {?} */ staticQueryIds = new Set();
        const /** @type {?} */ dynamicQueryIds = new Set();
        let /** @type {?} */ queryMatches;
        if (node instanceof ElementAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach((child) => {
                const /** @type {?} */ childData = result.get(child);
                childData.staticQueryIds.forEach(queryId => staticQueryIds.add(queryId));
                childData.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
            });
            queryMatches = node.queryMatches;
        }
        else if (node instanceof EmbeddedTemplateAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach((child) => {
                const /** @type {?} */ childData = result.get(child);
                childData.staticQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
                childData.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
            });
            queryMatches = node.queryMatches;
        }
        if (queryMatches) {
            queryMatches.forEach((match) => staticQueryIds.add(match.queryId));
        }
        dynamicQueryIds.forEach(queryId => staticQueryIds.delete(queryId));
        result.set(node, { staticQueryIds, dynamicQueryIds });
    });
    return result;
}
/**
 * @param {?} nodeStaticQueryIds
 * @return {?}
 */
function staticViewQueryIds(nodeStaticQueryIds) {
    const /** @type {?} */ staticQueryIds = new Set();
    const /** @type {?} */ dynamicQueryIds = new Set();
    Array.from(nodeStaticQueryIds.values()).forEach((entry) => {
        entry.staticQueryIds.forEach(queryId => staticQueryIds.add(queryId));
        entry.dynamicQueryIds.forEach(queryId => dynamicQueryIds.add(queryId));
    });
    dynamicQueryIds.forEach(queryId => staticQueryIds.delete(queryId));
    return { staticQueryIds, dynamicQueryIds };
}
/**
 * @param {?} directives
 * @return {?}
 */
function createComponentFactoryResolver(directives) {
    const /** @type {?} */ componentDirMeta = directives.find(dirAst => dirAst.directive.isComponent);
    if (componentDirMeta && componentDirMeta.directive.entryComponents.length) {
        const /** @type {?} */ entryComponentFactories = componentDirMeta.directive.entryComponents.map((entryComponent) => o.importExpr({ reference: entryComponent.componentFactory }));
        const /** @type {?} */ cfrExpr = o.importExpr(createIdentifier(Identifiers.CodegenComponentFactoryResolver))
            .instantiate([o.literalArr(entryComponentFactories)]);
        const /** @type {?} */ token = createIdentifierToken(Identifiers.ComponentFactoryResolver);
        const /** @type {?} */ classMeta = {
            diDeps: [
                { isValue: true, value: o.literalArr(entryComponentFactories) },
                { token: token, isSkipSelf: true, isOptional: true }
            ],
            lifecycleHooks: [],
            reference: resolveIdentifier(Identifiers.CodegenComponentFactoryResolver)
        };
        return new ProviderAst(token, false, true, [{ token, multi: false, useClass: classMeta }], ProviderAstType.PrivateService, [], componentDirMeta.sourceSpan);
    }
    return null;
}
//# sourceMappingURL=view_compiler.js.map