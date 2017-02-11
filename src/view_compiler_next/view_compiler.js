/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ChangeDetectionStrategy } from '@angular/core';
import { identifierName, tokenReference } from '../compile_metadata';
import { EventHandlerVars, convertActionBinding, convertPropertyBinding } from '../compiler_util/expression_converter';
import { CompilerConfig } from '../config';
import { Identifiers, createIdentifier, resolveIdentifier } from '../identifiers';
import { CompilerInjectable } from '../injectable';
import * as o from '../output/output_ast';
import { convertValueToOutputAst } from '../output/value_util';
import { LifecycleHooks, viewEngine } from '../private_import_core';
import { ElementSchemaRegistry } from '../schema/element_schema_registry';
import { ElementAst, EmbeddedTemplateAst, PropertyBindingType, ProviderAstType, templateVisitAll } from '../template_parser/template_ast';
import { ViewCompileResult, ViewCompiler } from '../view_compiler/view_compiler';
var /** @type {?} */ CLASS_ATTR = 'class';
var /** @type {?} */ STYLE_ATTR = 'style';
var ViewCompilerNext = (function (_super) {
    __extends(ViewCompilerNext, _super);
    /**
     * @param {?} _genConfigNext
     * @param {?} _schemaRegistryNext
     */
    function ViewCompilerNext(_genConfigNext, _schemaRegistryNext) {
        var _this = _super.call(this, _genConfigNext, _schemaRegistryNext) || this;
        _this._genConfigNext = _genConfigNext;
        _this._schemaRegistryNext = _schemaRegistryNext;
        return _this;
    }
    /**
     * @param {?} component
     * @param {?} template
     * @param {?} styles
     * @param {?} pipes
     * @param {?} compiledAnimations
     * @return {?}
     */
    ViewCompilerNext.prototype.compileComponent = function (component, template, styles, pipes, compiledAnimations) {
        var /** @type {?} */ compName = identifierName(component.type) + (component.isHost ? "_Host" : '');
        var /** @type {?} */ embeddedViewCount = 0;
        var /** @type {?} */ viewBuilderFactory = function (parent) {
            var /** @type {?} */ embeddedViewIndex = embeddedViewCount++;
            var /** @type {?} */ viewName = "view_" + compName + "_" + embeddedViewIndex;
            return new ViewBuilder(parent, viewName, viewBuilderFactory);
        };
        var /** @type {?} */ visitor = viewBuilderFactory(null);
        visitor.visitAll([], template, 0);
        var /** @type {?} */ statements = [];
        statements.push.apply(statements, visitor.build(component));
        return new ViewCompileResult(statements, visitor.viewName, []);
    };
    return ViewCompilerNext;
}(ViewCompiler));
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
var /** @type {?} */ VIEW_VAR = o.variable('view');
var /** @type {?} */ CHECK_VAR = o.variable('check');
var /** @type {?} */ COMP_VAR = o.variable('comp');
var /** @type {?} */ NODE_INDEX_VAR = o.variable('nodeIndex');
var /** @type {?} */ EVENT_NAME_VAR = o.variable('eventName');
var /** @type {?} */ ALLOW_DEFAULT_VAR = o.variable("allowDefault");
var ViewBuilder = (function () {
    /**
     * @param {?} parent
     * @param {?} viewName
     * @param {?} viewBuilderFactory
     */
    function ViewBuilder(parent, viewName, viewBuilderFactory) {
        this.parent = parent;
        this.viewName = viewName;
        this.viewBuilderFactory = viewBuilderFactory;
        this.nodeDefs = [];
        this.refNodeIndices = {};
        this.variables = [];
        this.children = [];
        this.updateExpressions = [];
        this.handleEventExpressions = [];
    }
    /**
     * @param {?} variables
     * @param {?} astNodes
     * @param {?} elementDepth
     * @return {?}
     */
    ViewBuilder.prototype.visitAll = function (variables, astNodes, elementDepth) {
        this.variables = variables;
        templateVisitAll(this, astNodes, { elementDepth: elementDepth });
        if (astNodes.length === 0 || (this.parent && hasViewContainer(astNodes[astNodes.length - 1]))) {
            // if the view is empty, or an embedded view has a view container as last root nde,
            // create an additional root node.
            this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.anchorDef)).callFn([
                o.literal(viewEngine.NodeFlags.None), o.NULL_EXPR, o.NULL_EXPR, o.literal(0)
            ]));
        }
    };
    /**
     * @param {?} component
     * @param {?=} targetStatements
     * @return {?}
     */
    ViewBuilder.prototype.build = function (component, targetStatements) {
        var _this = this;
        if (targetStatements === void 0) { targetStatements = []; }
        var /** @type {?} */ compType = o.importType(component.type);
        this.children.forEach(function (child) { child.build(component, targetStatements); });
        var /** @type {?} */ updateStmts = [];
        var /** @type {?} */ updateBindingCount = 0;
        this.updateExpressions
            .forEach(function (_a) {
            var expressions = _a.expressions, nodeIndex = _a.nodeIndex;
            var /** @type {?} */ exprs = expressions.map(function (_a) {
                var context = _a.context, value = _a.value;
                var /** @type {?} */ bindingId = "" + updateBindingCount++;
                var _b = convertPropertyBinding(null, _this, context, value, bindingId), stmts = _b.stmts, currValExpr = _b.currValExpr;
                updateStmts.push.apply(updateStmts, stmts);
                return currValExpr;
            });
            if (exprs.length > 10) {
                updateStmts.push(CHECK_VAR
                    .callFn([
                    VIEW_VAR, o.literal(nodeIndex),
                    o.literal(viewEngine.ArgumentType.Dynamic), o.literalArr(exprs)
                ])
                    .toStmt());
            }
            else {
                updateStmts.push(CHECK_VAR.callFn((([VIEW_VAR, o.literal(nodeIndex), o.literal(viewEngine.ArgumentType.Inline)])).concat(exprs)).toStmt());
            }
        });
        var /** @type {?} */ updateFn;
        if (updateStmts.length > 0) {
            updateFn = o.fn([new o.FnParam(CHECK_VAR.name), new o.FnParam(VIEW_VAR.name)], [COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(compType)].concat(updateStmts));
        }
        else {
            updateFn = o.NULL_EXPR;
        }
        var /** @type {?} */ handleEventStmts = [];
        var /** @type {?} */ handleEventBindingCount = 0;
        this.handleEventExpressions.forEach(function (_a) {
            var expression = _a.expression, context = _a.context, nodeIndex = _a.nodeIndex, eventName = _a.eventName;
            var /** @type {?} */ bindingId = "" + handleEventBindingCount++;
            var _b = convertActionBinding(null, _this, context, expression, bindingId), stmts = _b.stmts, allowDefault = _b.allowDefault;
            var /** @type {?} */ trueStmts = stmts;
            if (allowDefault) {
                trueStmts.push(ALLOW_DEFAULT_VAR.set(allowDefault.and(ALLOW_DEFAULT_VAR)).toStmt());
            }
            handleEventStmts.push(new o.IfStmt(o.literal(nodeIndex)
                .identical(NODE_INDEX_VAR)
                .and(o.literal(eventName).identical(EVENT_NAME_VAR)), trueStmts));
        });
        var /** @type {?} */ handleEventFn;
        if (handleEventStmts.length > 0) {
            handleEventFn = o.fn([
                new o.FnParam(VIEW_VAR.name), new o.FnParam(NODE_INDEX_VAR.name),
                new o.FnParam(EVENT_NAME_VAR.name), new o.FnParam(EventHandlerVars.event.name)
            ], [
                ALLOW_DEFAULT_VAR.set(o.literal(true)).toDeclStmt(o.BOOL_TYPE),
                COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(compType)
            ].concat(handleEventStmts, [
                new o.ReturnStatement(ALLOW_DEFAULT_VAR)
            ]));
        }
        else {
            handleEventFn = o.NULL_EXPR;
        }
        var /** @type {?} */ viewFlags = viewEngine.ViewFlags.None;
        if (!this.parent && component.changeDetection === ChangeDetectionStrategy.OnPush) {
            viewFlags |= viewEngine.ViewFlags.OnPush;
        }
        var /** @type {?} */ viewFactory = new o.DeclareFunctionStmt(this.viewName, [], [new o.ReturnStatement(o.importExpr(createIdentifier(Identifiers.viewDef)).callFn([
                o.literal(viewFlags), o.literalArr(this.nodeDefs), updateFn, handleEventFn
            ]))]);
        targetStatements.push(viewFactory);
        return targetStatements;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitNgContent = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitText = function (ast, context) {
        // textDef(ngContentIndex: number, constants: string[]): NodeDef;
        this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.textDef)).callFn([
            o.NULL_EXPR, o.literalArr([o.literal(ast.value)])
        ]));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitBoundText = function (ast, context) {
        var /** @type {?} */ nodeIndex = this.nodeDefs.length;
        var /** @type {?} */ astWithSource = (ast.value);
        var /** @type {?} */ inter = (astWithSource.ast);
        this.updateExpressions.push({
            nodeIndex: nodeIndex,
            expressions: inter.expressions.map(function (expr) { return { context: COMP_VAR, value: expr }; })
        });
        // textDef(ngContentIndex: number, constants: string[]): NodeDef;
        this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.textDef)).callFn([
            o.NULL_EXPR, o.literalArr(inter.strings.map(function (s) { return o.literal(s); }))
        ]));
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitEmbeddedTemplate = function (ast, context) {
        var /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array
        this.nodeDefs.push(null);
        var _a = this._visitElementOrTemplate(nodeIndex, ast, context), flags = _a.flags, queryMatchesExpr = _a.queryMatchesExpr;
        var /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        var /** @type {?} */ childVisitor = this.viewBuilderFactory(this);
        this.children.push(childVisitor);
        childVisitor.visitAll(ast.variables, ast.children, context.elementDepth + 1);
        // anchorDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
        //   childCount: number, templateFactory?: ViewDefinitionFactory): NodeDef;
        this.nodeDefs[nodeIndex] = o.importExpr(createIdentifier(Identifiers.anchorDef)).callFn([
            o.literal(flags), queryMatchesExpr, o.NULL_EXPR, o.literal(childCount),
            o.variable(childVisitor.viewName)
        ]);
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitElement = function (ast, context) {
        var /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        var _a = this._visitElementOrTemplate(nodeIndex, ast, context), flags = _a.flags, usedEvents = _a.usedEvents, queryMatchesExpr = _a.queryMatchesExpr, hostBindings = _a.hostBindings;
        templateVisitAll(this, ast.children, { elementDepth: context.elementDepth + 1 });
        var /** @type {?} */ childCount = this.nodeDefs.length - nodeIndex - 1;
        ast.inputs.forEach(function (inputAst) {
            hostBindings.push({ context: COMP_VAR, value: ((inputAst.value)).ast });
        });
        this.updateExpressions.push({ nodeIndex: nodeIndex, expressions: hostBindings });
        var /** @type {?} */ inputDefs = elementBindingDefs(ast.inputs);
        ast.directives.forEach(function (dirAst, dirIndex) { inputDefs.push.apply(inputDefs, elementBindingDefs(dirAst.hostProperties)); });
        var /** @type {?} */ outputDefs = usedEvents.map(function (_a) {
            var target = _a[0], eventName = _a[1];
            return target ? o.literalArr([o.literal(target), o.literal(eventName)]) :
                o.literal(eventName);
        });
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
    };
    /**
     * @param {?} nodeIndex
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype._visitElementOrTemplate = function (nodeIndex, ast, context) {
        var _this = this;
        var /** @type {?} */ flags = viewEngine.NodeFlags.None;
        if (ast.hasViewContainer) {
            flags |= viewEngine.NodeFlags.HasEmbeddedViews;
        }
        var /** @type {?} */ usedEvents = new Map();
        ast.outputs.forEach(function (event) {
            usedEvents.set(viewEngine.elementEventFullName(event.target, event.name), [event.target, event.name]);
        });
        ast.directives.forEach(function (dirAst) {
            dirAst.hostEvents.forEach(function (event) {
                usedEvents.set(viewEngine.elementEventFullName(event.target, event.name), [event.target, event.name]);
            });
        });
        var /** @type {?} */ hostBindings = [];
        var /** @type {?} */ hostEvents = [];
        ast.providers.forEach(function (providerAst, providerIndex) {
            var /** @type {?} */ dirAst;
            var /** @type {?} */ dirIndex;
            ast.directives.forEach(function (localDirAst, i) {
                if (localDirAst.directive.type.reference === providerAst.token.identifier.reference) {
                    dirAst = localDirAst;
                    dirIndex = i;
                }
            });
            if (dirAst) {
                var _a = _this._visitDirective(providerAst, dirAst, dirIndex, nodeIndex, context.elementDepth, ast.references, ast.queryMatches, usedEvents), dirHostBindings = _a.hostBindings, dirHostEvents = _a.hostEvents;
                hostBindings.push.apply(hostBindings, dirHostBindings);
                hostEvents.push.apply(hostEvents, dirHostEvents);
            }
            else {
                _this._visitProvider(providerAst, ast.queryMatches);
            }
        });
        var /** @type {?} */ queryMatchExprs = [];
        ast.queryMatches.forEach(function (match) {
            var /** @type {?} */ valueType;
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
        ast.references.forEach(function (ref) {
            var /** @type {?} */ valueType;
            if (!ref.value) {
                valueType = viewEngine.QueryValueType.RenderElement;
            }
            else if (tokenReference(ref.value) === resolveIdentifier(Identifiers.TemplateRef)) {
                valueType = viewEngine.QueryValueType.TemplateRef;
            }
            if (valueType != null) {
                _this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal("#" + ref.name), o.literal(valueType)]));
            }
        });
        ast.outputs.forEach(function (outputAst) { hostEvents.push({ context: COMP_VAR, eventAst: outputAst }); });
        hostEvents.forEach(function (hostEvent) {
            _this.handleEventExpressions.push({
                nodeIndex: nodeIndex,
                context: hostEvent.context,
                eventName: viewEngine.elementEventFullName(hostEvent.eventAst.target, hostEvent.eventAst.name),
                expression: ((hostEvent.eventAst.handler)).ast
            });
        });
        return {
            flags: flags,
            usedEvents: Array.from(usedEvents.values()),
            queryMatchesExpr: queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            hostBindings: hostBindings,
        };
    };
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
    ViewBuilder.prototype._visitDirective = function (providerAst, directiveAst, directiveIndex, elementNodeIndex, elementDepth, refs, queryMatches, usedEvents) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        var _a = this._visitProviderOrDirective(providerAst, queryMatches), flags = _a.flags, queryMatchExprs = _a.queryMatchExprs, providerExpr = _a.providerExpr, providerType = _a.providerType, depsExpr = _a.depsExpr;
        refs.forEach(function (ref) {
            if (ref.value && tokenReference(ref.value) === tokenReference(providerAst.token)) {
                _this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal("#" + ref.name), o.literal(viewEngine.QueryValueType.Provider)]));
            }
        });
        var /** @type {?} */ compView = o.NULL_EXPR;
        if (directiveAst.directive.isComponent) {
            compView = o.importExpr({ reference: directiveAst.directive.componentViewType });
        }
        var /** @type {?} */ inputDefs = directiveAst.inputs.map(function (inputAst, inputIndex) {
            var /** @type {?} */ mapValue = o.literalArr([o.literal(inputIndex), o.literal(inputAst.directiveName)]);
            // Note: it's important to not quote the key so that we can capture renames by minifiers!
            return new o.LiteralMapEntry(inputAst.directiveName, mapValue, false);
        });
        var /** @type {?} */ outputDefs = [];
        var /** @type {?} */ dirMeta = directiveAst.directive;
        Object.keys(dirMeta.outputs).forEach(function (propName) {
            var /** @type {?} */ eventName = dirMeta.outputs[propName];
            if (usedEvents.has(eventName)) {
                // Note: it's important to not quote the key so that we can capture renames by minifiers!
                outputDefs.push(new o.LiteralMapEntry(propName, o.literal(eventName), false));
            }
        });
        if (directiveAst.inputs.length) {
            this.updateExpressions.push({
                nodeIndex: nodeIndex,
                expressions: directiveAst.inputs.map(function (input) { return { context: COMP_VAR, value: ((input.value)).ast }; })
            });
        }
        var /** @type {?} */ dirContextExpr = o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
            VIEW_VAR, o.literal(nodeIndex)
        ]);
        var /** @type {?} */ hostBindings = directiveAst.hostProperties.map(function (hostBindingAst) {
            return {
                value: ((hostBindingAst.value)).ast,
                context: dirContextExpr,
            };
        });
        var /** @type {?} */ hostEvents = directiveAst.hostEvents.map(function (hostEventAst) { return { context: dirContextExpr, eventAst: hostEventAst }; });
        var /** @type {?} */ childCount = directiveAst.directive.queries.length;
        directiveAst.directive.queries.forEach(function (query, queryIndex) {
            var /** @type {?} */ queryId = { elementDepth: elementDepth, directiveIndex: directiveIndex, queryIndex: queryIndex };
            var /** @type {?} */ bindingType = query.first ? viewEngine.QueryBindingType.First : viewEngine.QueryBindingType.All;
            // queryDef(
            //   flags: NodeFlags, id: string, bindings: {[propName: string]: QueryBindingType}): NodeDef
            //   {
            _this.nodeDefs.push(o.importExpr(createIdentifier(Identifiers.queryDef)).callFn([
                o.literal(viewEngine.NodeFlags.HasContentQuery), o.literal(calcQueryId(queryId)),
                new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType))])
            ]));
        });
        // directiveDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], childCount: number, ctor:
        //   any,
        //   deps: ([DepFlags, any] | any)[], props?: {[name: string]: [number, string]},
        //   outputs?: {[name: string]: string}, component?: () => ViewDefinition): NodeDef;
        var /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.directiveDef)).callFn([
            o.literal(flags), queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            o.literal(childCount), providerExpr, depsExpr,
            inputDefs.length ? new o.LiteralMapExpr(inputDefs) : o.NULL_EXPR,
            outputDefs.length ? new o.LiteralMapExpr(outputDefs) : o.NULL_EXPR, compView
        ]);
        this.nodeDefs[nodeIndex] = nodeDef;
        return { hostBindings: hostBindings, hostEvents: hostEvents };
    };
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    ViewBuilder.prototype._visitProvider = function (providerAst, queryMatches) {
        var /** @type {?} */ nodeIndex = this.nodeDefs.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodeDefs.push(null);
        var _a = this._visitProviderOrDirective(providerAst, queryMatches), flags = _a.flags, queryMatchExprs = _a.queryMatchExprs, providerExpr = _a.providerExpr, providerType = _a.providerType, depsExpr = _a.depsExpr;
        // providerDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], type: ProviderType, token:
        //   any,
        //   value: any, deps: ([DepFlags, any] | any)[]): NodeDef;
        var /** @type {?} */ nodeDef = o.importExpr(createIdentifier(Identifiers.providerDef)).callFn([
            o.literal(flags), queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            o.literal(providerType), tokenExpr(providerAst.token), providerExpr, depsExpr
        ]);
        this.nodeDefs[nodeIndex] = nodeDef;
    };
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    ViewBuilder.prototype._visitProviderOrDirective = function (providerAst, queryMatches) {
        var /** @type {?} */ flags = viewEngine.NodeFlags.None;
        if (!providerAst.eager) {
            flags |= viewEngine.NodeFlags.LazyProvider;
        }
        providerAst.lifecycleHooks.forEach(function (lifecycleHook) {
            // for regular providers, we only support ngOnDestroy
            if (lifecycleHook === LifecycleHooks.OnDestroy ||
                providerAst.providerType === ProviderAstType.Directive ||
                providerAst.providerType === ProviderAstType.Component) {
                flags |= lifecycleHookToNodeFlag(lifecycleHook);
            }
        });
        var /** @type {?} */ queryMatchExprs = [];
        queryMatches.forEach(function (match) {
            if (tokenReference(match.value) === tokenReference(providerAst.token)) {
                queryMatchExprs.push(o.literalArr([o.literal(calcQueryId(match.query)), o.literal(viewEngine.QueryValueType.Provider)]));
            }
        });
        var _a = providerDef(providerAst), providerExpr = _a.providerExpr, providerType = _a.providerType, depsExpr = _a.depsExpr;
        return { flags: flags, queryMatchExprs: queryMatchExprs, providerExpr: providerExpr, providerType: providerType, depsExpr: depsExpr };
    };
    /**
     * @param {?} name
     * @param {?} input
     * @param {?} args
     * @return {?}
     */
    ViewBuilder.prototype.callPipe = function (name, input, args) {
        throw new Error('Pipes are not yet supported!');
    };
    /**
     * @param {?} name
     * @return {?}
     */
    ViewBuilder.prototype.getLocal = function (name) {
        if (name == EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        var /** @type {?} */ currViewExpr = VIEW_VAR;
        for (var /** @type {?} */ currBuilder = this; currBuilder; currBuilder = currBuilder.parent, currViewExpr = currViewExpr.prop('parent')) {
            // check references
            var /** @type {?} */ refNodeIndex = currBuilder.refNodeIndices[name];
            if (refNodeIndex != null) {
                return o.importExpr(createIdentifier(Identifiers.nodeValue)).callFn([
                    currViewExpr, o.literal(refNodeIndex)
                ]);
            }
            // check variables
            var /** @type {?} */ varAst = currBuilder.variables.find(function (varAst) { return varAst.name === name; });
            if (varAst) {
                return currViewExpr.prop('context').prop(varAst.value);
            }
        }
        return null;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitDirective = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitDirectiveProperty = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitReference = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitVariable = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitEvent = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitElementProperty = function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitAttr = function (ast, context) { };
    return ViewBuilder;
}());
function ViewBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewBuilder.prototype.nodeDefs;
    /** @type {?} */
    ViewBuilder.prototype.refNodeIndices;
    /** @type {?} */
    ViewBuilder.prototype.variables;
    /** @type {?} */
    ViewBuilder.prototype.children;
    /** @type {?} */
    ViewBuilder.prototype.updateExpressions;
    /** @type {?} */
    ViewBuilder.prototype.handleEventExpressions;
    /** @type {?} */
    ViewBuilder.prototype.parent;
    /** @type {?} */
    ViewBuilder.prototype.viewName;
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
    var /** @type {?} */ allDepDefs = [];
    var /** @type {?} */ allParams = [];
    var /** @type {?} */ exprs = providers.map(function (provider, providerIndex) {
        var /** @type {?} */ depExprs = provider.deps.map(function (dep, depIndex) {
            var /** @type {?} */ paramName = "p" + providerIndex + "_" + depIndex;
            allParams.push(new o.FnParam(paramName, o.DYNAMIC_TYPE));
            allDepDefs.push(depDef(dep));
            return o.variable(paramName);
        });
        var /** @type {?} */ expr;
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
    var /** @type {?} */ providerExpr = o.fn(allParams, [new o.ReturnStatement(o.literalArr(exprs))]);
    return {
        providerExpr: providerExpr,
        providerType: viewEngine.ProviderType.Factory,
        depsExpr: o.literalArr(allDepDefs)
    };
}
/**
 * @param {?} providerMeta
 * @return {?}
 */
function singleProviderDef(providerMeta) {
    var /** @type {?} */ providerExpr;
    var /** @type {?} */ providerType;
    var /** @type {?} */ deps;
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
    var /** @type {?} */ depsExpr = o.literalArr(deps.map(function (dep) { return depDef(dep); }));
    return { providerExpr: providerExpr, providerType: providerType, depsExpr: depsExpr };
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
    var /** @type {?} */ expr = dep.isValue ? convertValueToOutputAst(dep.value) : tokenExpr(dep.token);
    var /** @type {?} */ flags = viewEngine.DepFlags.None;
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
function hasViewContainer(ast) {
    if (ast instanceof EmbeddedTemplateAst) {
        return ast.hasViewContainer;
    }
    else if (ast instanceof ElementAst) {
        return ast.hasViewContainer;
    }
    return false;
}
/**
 * @param {?} queryId
 * @return {?}
 */
function calcQueryId(queryId) {
    if (queryId.directiveIndex == null) {
        // view query
        return "v" + queryId.queryIndex;
    }
    else {
        return "c" + queryId.elementDepth + "_" + queryId.directiveIndex + "_" + queryId.queryIndex;
    }
}
/**
 * @param {?} lifecycleHook
 * @return {?}
 */
function lifecycleHookToNodeFlag(lifecycleHook) {
    var /** @type {?} */ nodeFlag = viewEngine.NodeFlags.None;
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
    return inputAsts.map(function (inputAst) {
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
    var /** @type {?} */ mapResult = {};
    elementAst.attrs.forEach(function (attrAst) { mapResult[attrAst.name] = attrAst.value; });
    elementAst.directives.forEach(function (dirAst) {
        Object.keys(dirAst.directive.hostAttributes).forEach(function (name) {
            var /** @type {?} */ value = dirAst.directive.hostAttributes[name];
            var /** @type {?} */ prevValue = mapResult[name];
            mapResult[name] = prevValue != null ? mergeAttributeValue(name, prevValue, value) : value;
        });
    });
    var /** @type {?} */ mapEntries = [];
    // Note: We need to sort to get a defined output order
    // for tests and for caching generated artifacts...
    Object.keys(mapResult).sort().forEach(function (attrName) {
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
        return attrValue1 + " " + attrValue2;
    }
    else {
        return attrValue2;
    }
}
//# sourceMappingURL=view_compiler.js.map