/**
 * @fileoverview added by tsickle
 * @suppress {checkTypes} checked by tsc
 */
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { rendererTypeName, tokenReference, viewClassName } from '../compile_metadata';
import { BindingForm, EventHandlerVars, convertActionBinding, convertPropertyBinding, convertPropertyBindingBuiltins } from '../compiler_util/expression_converter';
import { ChangeDetectionStrategy } from '../core';
import { Identifiers } from '../identifiers';
import { LifecycleHooks } from '../lifecycle_reflector';
import { isNgContainer } from '../ml_parser/tags';
import * as o from '../output/output_ast';
import { convertValueToOutputAst } from '../output/value_util';
import { ElementAst, EmbeddedTemplateAst, NgContentAst, PropertyBindingType, templateVisitAll } from '../template_parser/template_ast';
import { componentFactoryResolverProviderDef, depDef, lifecycleHookToNodeFlag, providerDef } from './provider_compiler';
var /** @type {?} */ CLASS_ATTR = 'class';
var /** @type {?} */ STYLE_ATTR = 'style';
var /** @type {?} */ IMPLICIT_TEMPLATE_VAR = '\$implicit';
var ViewCompileResult = /** @class */ (function () {
    function ViewCompileResult(viewClassVar, rendererTypeVar) {
        this.viewClassVar = viewClassVar;
        this.rendererTypeVar = rendererTypeVar;
    }
    return ViewCompileResult;
}());
export { ViewCompileResult };
function ViewCompileResult_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewCompileResult.prototype.viewClassVar;
    /** @type {?} */
    ViewCompileResult.prototype.rendererTypeVar;
}
var ViewCompiler = /** @class */ (function () {
    function ViewCompiler(_reflector) {
        this._reflector = _reflector;
    }
    /**
     * @param {?} outputCtx
     * @param {?} component
     * @param {?} template
     * @param {?} styles
     * @param {?} usedPipes
     * @return {?}
     */
    ViewCompiler.prototype.compileComponent = /**
     * @param {?} outputCtx
     * @param {?} component
     * @param {?} template
     * @param {?} styles
     * @param {?} usedPipes
     * @return {?}
     */
    function (outputCtx, component, template, styles, usedPipes) {
        var _this = this;
        var /** @type {?} */ embeddedViewCount = 0;
        var /** @type {?} */ staticQueryIds = findStaticQueryIds(template);
        var /** @type {?} */ renderComponentVarName = /** @type {?} */ ((undefined));
        if (!component.isHost) {
            var /** @type {?} */ template_1 = /** @type {?} */ ((component.template));
            var /** @type {?} */ customRenderData = [];
            if (template_1.animations && template_1.animations.length) {
                customRenderData.push(new o.LiteralMapEntry('animation', convertValueToOutputAst(outputCtx, template_1.animations), true));
            }
            var /** @type {?} */ renderComponentVar = o.variable(rendererTypeName(component.type.reference));
            renderComponentVarName = /** @type {?} */ ((renderComponentVar.name));
            outputCtx.statements.push(renderComponentVar
                .set(o.importExpr(Identifiers.createRendererType2).callFn([new o.LiteralMapExpr([
                    new o.LiteralMapEntry('encapsulation', o.literal(template_1.encapsulation), false),
                    new o.LiteralMapEntry('styles', styles, false),
                    new o.LiteralMapEntry('data', new o.LiteralMapExpr(customRenderData), false)
                ])]))
                .toDeclStmt(o.importType(Identifiers.RendererType2), [o.StmtModifier.Final, o.StmtModifier.Exported]));
        }
        var /** @type {?} */ viewBuilderFactory = function (parent) {
            var /** @type {?} */ embeddedViewIndex = embeddedViewCount++;
            return new ViewBuilder(_this._reflector, outputCtx, parent, component, embeddedViewIndex, usedPipes, staticQueryIds, viewBuilderFactory);
        };
        var /** @type {?} */ visitor = viewBuilderFactory(null);
        visitor.visitAll([], template);
        (_a = outputCtx.statements).push.apply(_a, visitor.build());
        return new ViewCompileResult(visitor.viewName, renderComponentVarName);
        var _a;
    };
    return ViewCompiler;
}());
export { ViewCompiler };
function ViewCompiler_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewCompiler.prototype._reflector;
}
/**
 * @record
 */
function ViewBuilderFactory() { }
function ViewBuilderFactory_tsickle_Closure_declarations() {
    /* TODO: handle strange member:
    (parent: ViewBuilder): ViewBuilder;
    */
}
/**
 * @record
 */
function UpdateExpression() { }
function UpdateExpression_tsickle_Closure_declarations() {
    /** @type {?} */
    UpdateExpression.prototype.context;
    /** @type {?} */
    UpdateExpression.prototype.nodeIndex;
    /** @type {?} */
    UpdateExpression.prototype.bindingIndex;
    /** @type {?} */
    UpdateExpression.prototype.sourceSpan;
    /** @type {?} */
    UpdateExpression.prototype.value;
}
var /** @type {?} */ LOG_VAR = o.variable('_l');
var /** @type {?} */ VIEW_VAR = o.variable('_v');
var /** @type {?} */ CHECK_VAR = o.variable('_ck');
var /** @type {?} */ COMP_VAR = o.variable('_co');
var /** @type {?} */ EVENT_NAME_VAR = o.variable('en');
var /** @type {?} */ ALLOW_DEFAULT_VAR = o.variable("ad");
var ViewBuilder = /** @class */ (function () {
    function ViewBuilder(reflector, outputCtx, parent, component, embeddedViewIndex, usedPipes, staticQueryIds, viewBuilderFactory) {
        this.reflector = reflector;
        this.outputCtx = outputCtx;
        this.parent = parent;
        this.component = component;
        this.embeddedViewIndex = embeddedViewIndex;
        this.usedPipes = usedPipes;
        this.staticQueryIds = staticQueryIds;
        this.viewBuilderFactory = viewBuilderFactory;
        this.nodes = [];
        this.purePipeNodeIndices = Object.create(null);
        this.refNodeIndices = Object.create(null);
        this.variables = [];
        this.children = [];
        // TODO(tbosch): The old view compiler used to use an `any` type
        // for the context in any embedded view. We keep this behaivor for now
        // to be able to introduce the new view compiler without too many errors.
        this.compType = this.embeddedViewIndex > 0 ?
            o.DYNAMIC_TYPE : /** @type {?} */
            ((o.expressionType(outputCtx.importExpr(this.component.type.reference))));
        this.viewName = viewClassName(this.component.type.reference, this.embeddedViewIndex);
    }
    /**
     * @param {?} variables
     * @param {?} astNodes
     * @return {?}
     */
    ViewBuilder.prototype.visitAll = /**
     * @param {?} variables
     * @param {?} astNodes
     * @return {?}
     */
    function (variables, astNodes) {
        var _this = this;
        this.variables = variables;
        // create the pipes for the pure pipes immediately, so that we know their indices.
        if (!this.parent) {
            this.usedPipes.forEach(function (pipe) {
                if (pipe.pure) {
                    _this.purePipeNodeIndices[pipe.name] = _this._createPipe(null, pipe);
                }
            });
        }
        if (!this.parent) {
            var /** @type {?} */ queryIds_1 = staticViewQueryIds(this.staticQueryIds);
            this.component.viewQueries.forEach(function (query, queryIndex) {
                // Note: queries start with id 1 so we can use the number in a Bloom filter!
                var /** @type {?} */ queryId = queryIndex + 1;
                var /** @type {?} */ bindingType = query.first ? 0 /* First */ : 1 /* All */;
                var /** @type {?} */ flags = 134217728 /* TypeViewQuery */ | calcStaticDynamicQueryFlags(queryIds_1, queryId, query.first);
                _this.nodes.push(function () {
                    return ({
                        sourceSpan: null,
                        nodeFlags: flags,
                        nodeDef: o.importExpr(Identifiers.queryDef).callFn([
                            o.literal(flags), o.literal(queryId),
                            new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType), false)])
                        ])
                    });
                });
            });
        }
        templateVisitAll(this, astNodes);
        if (this.parent && (astNodes.length === 0 || needsAdditionalRootNode(astNodes))) {
            // if the view is an embedded view, then we need to add an additional root node in some cases
            this.nodes.push(function () {
                return ({
                    sourceSpan: null,
                    nodeFlags: 1 /* TypeElement */,
                    nodeDef: o.importExpr(Identifiers.anchorDef).callFn([
                        o.literal(0 /* None */), o.NULL_EXPR, o.NULL_EXPR, o.literal(0)
                    ])
                });
            });
        }
    };
    /**
     * @param {?=} targetStatements
     * @return {?}
     */
    ViewBuilder.prototype.build = /**
     * @param {?=} targetStatements
     * @return {?}
     */
    function (targetStatements) {
        if (targetStatements === void 0) { targetStatements = []; }
        this.children.forEach(function (child) { return child.build(targetStatements); });
        var _a = this._createNodeExpressions(), updateRendererStmts = _a.updateRendererStmts, updateDirectivesStmts = _a.updateDirectivesStmts, nodeDefExprs = _a.nodeDefExprs;
        var /** @type {?} */ updateRendererFn = this._createUpdateFn(updateRendererStmts);
        var /** @type {?} */ updateDirectivesFn = this._createUpdateFn(updateDirectivesStmts);
        var /** @type {?} */ viewFlags = 0 /* None */;
        if (!this.parent && this.component.changeDetection === ChangeDetectionStrategy.OnPush) {
            viewFlags |= 2 /* OnPush */;
        }
        var /** @type {?} */ viewFactory = new o.DeclareFunctionStmt(this.viewName, [new o.FnParam(/** @type {?} */ ((LOG_VAR.name)))], [new o.ReturnStatement(o.importExpr(Identifiers.viewDef).callFn([
                o.literal(viewFlags),
                o.literalArr(nodeDefExprs),
                updateDirectivesFn,
                updateRendererFn,
            ]))], o.importType(Identifiers.ViewDefinition), this.embeddedViewIndex === 0 ? [o.StmtModifier.Exported] : []);
        targetStatements.push(viewFactory);
        return targetStatements;
    };
    /**
     * @param {?} updateStmts
     * @return {?}
     */
    ViewBuilder.prototype._createUpdateFn = /**
     * @param {?} updateStmts
     * @return {?}
     */
    function (updateStmts) {
        var /** @type {?} */ updateFn;
        if (updateStmts.length > 0) {
            var /** @type {?} */ preStmts = [];
            if (!this.component.isHost && o.findReadVarNames(updateStmts).has(/** @type {?} */ ((COMP_VAR.name)))) {
                preStmts.push(COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(this.compType));
            }
            updateFn = o.fn([
                new o.FnParam(/** @type {?} */ ((CHECK_VAR.name)), o.INFERRED_TYPE),
                new o.FnParam(/** @type {?} */ ((VIEW_VAR.name)), o.INFERRED_TYPE)
            ], preStmts.concat(updateStmts), o.INFERRED_TYPE);
        }
        else {
            updateFn = o.NULL_EXPR;
        }
        return updateFn;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitNgContent = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        // ngContentDef(ngContentIndex: number, index: number): NodeDef;
        this.nodes.push(function () {
            return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 8 /* TypeNgContent */,
                nodeDef: o.importExpr(Identifiers.ngContentDef).callFn([
                    o.literal(ast.ngContentIndex), o.literal(ast.index)
                ])
            });
        });
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitText = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        // Static text nodes have no check function
        var /** @type {?} */ checkIndex = -1;
        this.nodes.push(function () {
            return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 2 /* TypeText */,
                nodeDef: o.importExpr(Identifiers.textDef).callFn([
                    o.literal(checkIndex),
                    o.literal(ast.ngContentIndex),
                    o.literalArr([o.literal(ast.value)]),
                ])
            });
        });
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitBoundText = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodes.length;
        // reserve the space in the nodeDefs array
        this.nodes.push(/** @type {?} */ ((null)));
        var /** @type {?} */ astWithSource = /** @type {?} */ (ast.value);
        var /** @type {?} */ inter = /** @type {?} */ (astWithSource.ast);
        var /** @type {?} */ updateRendererExpressions = inter.expressions.map(function (expr, bindingIndex) {
            return _this._preprocessUpdateExpression({ nodeIndex: nodeIndex, bindingIndex: bindingIndex, sourceSpan: ast.sourceSpan, context: COMP_VAR, value: expr });
        });
        // Check index is the same as the node index during compilation
        // They might only differ at runtime
        var /** @type {?} */ checkIndex = nodeIndex;
        this.nodes[nodeIndex] = function () {
            return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 2 /* TypeText */,
                nodeDef: o.importExpr(Identifiers.textDef).callFn([
                    o.literal(checkIndex),
                    o.literal(ast.ngContentIndex),
                    o.literalArr(inter.strings.map(function (s) { return o.literal(s); })),
                ]),
                updateRenderer: updateRendererExpressions
            });
        };
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitEmbeddedTemplate = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodes.length;
        // reserve the space in the nodeDefs array
        this.nodes.push(/** @type {?} */ ((null)));
        var _a = this._visitElementOrTemplate(nodeIndex, ast), flags = _a.flags, queryMatchesExpr = _a.queryMatchesExpr, hostEvents = _a.hostEvents;
        var /** @type {?} */ childVisitor = this.viewBuilderFactory(this);
        this.children.push(childVisitor);
        childVisitor.visitAll(ast.variables, ast.children);
        var /** @type {?} */ childCount = this.nodes.length - nodeIndex - 1;
        // anchorDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
        //   childCount: number, handleEventFn?: ElementHandleEventFn, templateFactory?:
        //   ViewDefinitionFactory): NodeDef;
        this.nodes[nodeIndex] = function () {
            return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 1 /* TypeElement */ | flags,
                nodeDef: o.importExpr(Identifiers.anchorDef).callFn([
                    o.literal(flags),
                    queryMatchesExpr,
                    o.literal(ast.ngContentIndex),
                    o.literal(childCount),
                    _this._createElementHandleEventFn(nodeIndex, hostEvents),
                    o.variable(childVisitor.viewName),
                ])
            });
        };
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitElement = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodes.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodes.push(/** @type {?} */ ((null)));
        // Using a null element name creates an anchor.
        var /** @type {?} */ elName = isNgContainer(ast.name) ? null : ast.name;
        var _a = this._visitElementOrTemplate(nodeIndex, ast), flags = _a.flags, usedEvents = _a.usedEvents, queryMatchesExpr = _a.queryMatchesExpr, dirHostBindings = _a.hostBindings, hostEvents = _a.hostEvents;
        var /** @type {?} */ inputDefs = [];
        var /** @type {?} */ updateRendererExpressions = [];
        var /** @type {?} */ outputDefs = [];
        if (elName) {
            var /** @type {?} */ hostBindings = ast.inputs
                .map(function (inputAst) {
                return ({
                    context: /** @type {?} */ (COMP_VAR),
                    inputAst: inputAst,
                    dirAst: /** @type {?} */ (null),
                });
            })
                .concat(dirHostBindings);
            if (hostBindings.length) {
                updateRendererExpressions =
                    hostBindings.map(function (hostBinding, bindingIndex) {
                        return _this._preprocessUpdateExpression({
                            context: hostBinding.context,
                            nodeIndex: nodeIndex,
                            bindingIndex: bindingIndex,
                            sourceSpan: hostBinding.inputAst.sourceSpan,
                            value: hostBinding.inputAst.value
                        });
                    });
                inputDefs = hostBindings.map(function (hostBinding) { return elementBindingDef(hostBinding.inputAst, hostBinding.dirAst); });
            }
            outputDefs = usedEvents.map(function (_a) {
                var target = _a[0], eventName = _a[1];
                return o.literalArr([o.literal(target), o.literal(eventName)]);
            });
        }
        templateVisitAll(this, ast.children);
        var /** @type {?} */ childCount = this.nodes.length - nodeIndex - 1;
        var /** @type {?} */ compAst = ast.directives.find(function (dirAst) { return dirAst.directive.isComponent; });
        var /** @type {?} */ compRendererType = /** @type {?} */ (o.NULL_EXPR);
        var /** @type {?} */ compView = /** @type {?} */ (o.NULL_EXPR);
        if (compAst) {
            compView = this.outputCtx.importExpr(compAst.directive.componentViewType);
            compRendererType = this.outputCtx.importExpr(compAst.directive.rendererType);
        }
        // Check index is the same as the node index during compilation
        // They might only differ at runtime
        var /** @type {?} */ checkIndex = nodeIndex;
        this.nodes[nodeIndex] = function () {
            return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 1 /* TypeElement */ | flags,
                nodeDef: o.importExpr(Identifiers.elementDef).callFn([
                    o.literal(checkIndex),
                    o.literal(flags),
                    queryMatchesExpr,
                    o.literal(ast.ngContentIndex),
                    o.literal(childCount),
                    o.literal(elName),
                    elName ? fixedAttrsDef(ast) : o.NULL_EXPR,
                    inputDefs.length ? o.literalArr(inputDefs) : o.NULL_EXPR,
                    outputDefs.length ? o.literalArr(outputDefs) : o.NULL_EXPR,
                    _this._createElementHandleEventFn(nodeIndex, hostEvents),
                    compView,
                    compRendererType,
                ]),
                updateRenderer: updateRendererExpressions
            });
        };
    };
    /**
     * @param {?} nodeIndex
     * @param {?} ast
     * @return {?}
     */
    ViewBuilder.prototype._visitElementOrTemplate = /**
     * @param {?} nodeIndex
     * @param {?} ast
     * @return {?}
     */
    function (nodeIndex, ast) {
        var _this = this;
        var /** @type {?} */ flags = 0 /* None */;
        if (ast.hasViewContainer) {
            flags |= 16777216 /* EmbeddedViews */;
        }
        var /** @type {?} */ usedEvents = new Map();
        ast.outputs.forEach(function (event) {
            var _a = elementEventNameAndTarget(event, null), name = _a.name, target = _a.target;
            usedEvents.set(elementEventFullName(target, name), [target, name]);
        });
        ast.directives.forEach(function (dirAst) {
            dirAst.hostEvents.forEach(function (event) {
                var _a = elementEventNameAndTarget(event, dirAst), name = _a.name, target = _a.target;
                usedEvents.set(elementEventFullName(target, name), [target, name]);
            });
        });
        var /** @type {?} */ hostBindings = [];
        var /** @type {?} */ hostEvents = [];
        this._visitComponentFactoryResolverProvider(ast.directives);
        ast.providers.forEach(function (providerAst, providerIndex) {
            var /** @type {?} */ dirAst = /** @type {?} */ ((undefined));
            var /** @type {?} */ dirIndex = /** @type {?} */ ((undefined));
            ast.directives.forEach(function (localDirAst, i) {
                if (localDirAst.directive.type.reference === tokenReference(providerAst.token)) {
                    dirAst = localDirAst;
                    dirIndex = i;
                }
            });
            if (dirAst) {
                var _a = _this._visitDirective(providerAst, dirAst, dirIndex, nodeIndex, ast.references, ast.queryMatches, usedEvents, /** @type {?} */ ((_this.staticQueryIds.get(/** @type {?} */ (ast))))), dirHostBindings = _a.hostBindings, dirHostEvents = _a.hostEvents;
                hostBindings.push.apply(hostBindings, dirHostBindings);
                hostEvents.push.apply(hostEvents, dirHostEvents);
            }
            else {
                _this._visitProvider(providerAst, ast.queryMatches);
            }
        });
        var /** @type {?} */ queryMatchExprs = [];
        ast.queryMatches.forEach(function (match) {
            var /** @type {?} */ valueType = /** @type {?} */ ((undefined));
            if (tokenReference(match.value) ===
                _this.reflector.resolveExternalReference(Identifiers.ElementRef)) {
                valueType = 0 /* ElementRef */;
            }
            else if (tokenReference(match.value) ===
                _this.reflector.resolveExternalReference(Identifiers.ViewContainerRef)) {
                valueType = 3 /* ViewContainerRef */;
            }
            else if (tokenReference(match.value) ===
                _this.reflector.resolveExternalReference(Identifiers.TemplateRef)) {
                valueType = 2 /* TemplateRef */;
            }
            if (valueType != null) {
                queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(valueType)]));
            }
        });
        ast.references.forEach(function (ref) {
            var /** @type {?} */ valueType = /** @type {?} */ ((undefined));
            if (!ref.value) {
                valueType = 1 /* RenderElement */;
            }
            else if (tokenReference(ref.value) ===
                _this.reflector.resolveExternalReference(Identifiers.TemplateRef)) {
                valueType = 2 /* TemplateRef */;
            }
            if (valueType != null) {
                _this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(valueType)]));
            }
        });
        ast.outputs.forEach(function (outputAst) {
            hostEvents.push({ context: COMP_VAR, eventAst: outputAst, dirAst: /** @type {?} */ ((null)) });
        });
        return {
            flags: flags,
            usedEvents: Array.from(usedEvents.values()),
            queryMatchesExpr: queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
            hostBindings: hostBindings,
            hostEvents: hostEvents
        };
    };
    /**
     * @param {?} providerAst
     * @param {?} dirAst
     * @param {?} directiveIndex
     * @param {?} elementNodeIndex
     * @param {?} refs
     * @param {?} queryMatches
     * @param {?} usedEvents
     * @param {?} queryIds
     * @return {?}
     */
    ViewBuilder.prototype._visitDirective = /**
     * @param {?} providerAst
     * @param {?} dirAst
     * @param {?} directiveIndex
     * @param {?} elementNodeIndex
     * @param {?} refs
     * @param {?} queryMatches
     * @param {?} usedEvents
     * @param {?} queryIds
     * @return {?}
     */
    function (providerAst, dirAst, directiveIndex, elementNodeIndex, refs, queryMatches, usedEvents, queryIds) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodes.length;
        // reserve the space in the nodeDefs array so we can add children
        this.nodes.push(/** @type {?} */ ((null)));
        dirAst.directive.queries.forEach(function (query, queryIndex) {
            var /** @type {?} */ queryId = dirAst.contentQueryStartId + queryIndex;
            var /** @type {?} */ flags = 67108864 /* TypeContentQuery */ | calcStaticDynamicQueryFlags(queryIds, queryId, query.first);
            var /** @type {?} */ bindingType = query.first ? 0 /* First */ : 1 /* All */;
            _this.nodes.push(function () {
                return ({
                    sourceSpan: dirAst.sourceSpan,
                    nodeFlags: flags,
                    nodeDef: o.importExpr(Identifiers.queryDef).callFn([
                        o.literal(flags), o.literal(queryId),
                        new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType), false)])
                    ]),
                });
            });
        });
        // Note: the operation below might also create new nodeDefs,
        // but we don't want them to be a child of a directive,
        // as they might be a provider/pipe on their own.
        // I.e. we only allow queries as children of directives nodes.
        var /** @type {?} */ childCount = this.nodes.length - nodeIndex - 1;
        var _a = this._visitProviderOrDirective(providerAst, queryMatches), flags = _a.flags, queryMatchExprs = _a.queryMatchExprs, providerExpr = _a.providerExpr, depsExpr = _a.depsExpr;
        refs.forEach(function (ref) {
            if (ref.value && tokenReference(ref.value) === tokenReference(providerAst.token)) {
                _this.refNodeIndices[ref.name] = nodeIndex;
                queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(4 /* Provider */)]));
            }
        });
        if (dirAst.directive.isComponent) {
            flags |= 32768 /* Component */;
        }
        var /** @type {?} */ inputDefs = dirAst.inputs.map(function (inputAst, inputIndex) {
            var /** @type {?} */ mapValue = o.literalArr([o.literal(inputIndex), o.literal(inputAst.directiveName)]);
            // Note: it's important to not quote the key so that we can capture renames by minifiers!
            return new o.LiteralMapEntry(inputAst.directiveName, mapValue, false);
        });
        var /** @type {?} */ outputDefs = [];
        var /** @type {?} */ dirMeta = dirAst.directive;
        Object.keys(dirMeta.outputs).forEach(function (propName) {
            var /** @type {?} */ eventName = dirMeta.outputs[propName];
            if (usedEvents.has(eventName)) {
                // Note: it's important to not quote the key so that we can capture renames by minifiers!
                outputDefs.push(new o.LiteralMapEntry(propName, o.literal(eventName), false));
            }
        });
        var /** @type {?} */ updateDirectiveExpressions = [];
        if (dirAst.inputs.length || (flags & (262144 /* DoCheck */ | 65536 /* OnInit */)) > 0) {
            updateDirectiveExpressions =
                dirAst.inputs.map(function (input, bindingIndex) {
                    return _this._preprocessUpdateExpression({
                        nodeIndex: nodeIndex,
                        bindingIndex: bindingIndex,
                        sourceSpan: input.sourceSpan,
                        context: COMP_VAR,
                        value: input.value
                    });
                });
        }
        var /** @type {?} */ dirContextExpr = o.importExpr(Identifiers.nodeValue).callFn([VIEW_VAR, o.literal(nodeIndex)]);
        var /** @type {?} */ hostBindings = dirAst.hostProperties.map(function (inputAst) {
            return ({
                context: dirContextExpr,
                dirAst: dirAst,
                inputAst: inputAst,
            });
        });
        var /** @type {?} */ hostEvents = dirAst.hostEvents.map(function (hostEventAst) {
            return ({
                context: dirContextExpr,
                eventAst: hostEventAst, dirAst: dirAst,
            });
        });
        // Check index is the same as the node index during compilation
        // They might only differ at runtime
        var /** @type {?} */ checkIndex = nodeIndex;
        this.nodes[nodeIndex] = function () {
            return ({
                sourceSpan: dirAst.sourceSpan,
                nodeFlags: 16384 /* TypeDirective */ | flags,
                nodeDef: o.importExpr(Identifiers.directiveDef).callFn([
                    o.literal(checkIndex),
                    o.literal(flags),
                    queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
                    o.literal(childCount),
                    providerExpr,
                    depsExpr,
                    inputDefs.length ? new o.LiteralMapExpr(inputDefs) : o.NULL_EXPR,
                    outputDefs.length ? new o.LiteralMapExpr(outputDefs) : o.NULL_EXPR,
                ]),
                updateDirectives: updateDirectiveExpressions,
                directive: dirAst.directive.type,
            });
        };
        return { hostBindings: hostBindings, hostEvents: hostEvents };
    };
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    ViewBuilder.prototype._visitProvider = /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    function (providerAst, queryMatches) {
        this._addProviderNode(this._visitProviderOrDirective(providerAst, queryMatches));
    };
    /**
     * @param {?} directives
     * @return {?}
     */
    ViewBuilder.prototype._visitComponentFactoryResolverProvider = /**
     * @param {?} directives
     * @return {?}
     */
    function (directives) {
        var /** @type {?} */ componentDirMeta = directives.find(function (dirAst) { return dirAst.directive.isComponent; });
        if (componentDirMeta && componentDirMeta.directive.entryComponents.length) {
            var _a = componentFactoryResolverProviderDef(this.reflector, this.outputCtx, 8192 /* PrivateProvider */, componentDirMeta.directive.entryComponents), providerExpr = _a.providerExpr, depsExpr = _a.depsExpr, flags = _a.flags, tokenExpr = _a.tokenExpr;
            this._addProviderNode({
                providerExpr: providerExpr,
                depsExpr: depsExpr,
                flags: flags,
                tokenExpr: tokenExpr,
                queryMatchExprs: [],
                sourceSpan: componentDirMeta.sourceSpan
            });
        }
    };
    /**
     * @param {?} data
     * @return {?}
     */
    ViewBuilder.prototype._addProviderNode = /**
     * @param {?} data
     * @return {?}
     */
    function (data) {
        var /** @type {?} */ nodeIndex = this.nodes.length;
        // providerDef(
        //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], token:any,
        //   value: any, deps: ([DepFlags, any] | any)[]): NodeDef;
        this.nodes.push(function () {
            return ({
                sourceSpan: data.sourceSpan,
                nodeFlags: data.flags,
                nodeDef: o.importExpr(Identifiers.providerDef).callFn([
                    o.literal(data.flags),
                    data.queryMatchExprs.length ? o.literalArr(data.queryMatchExprs) : o.NULL_EXPR,
                    data.tokenExpr, data.providerExpr, data.depsExpr
                ])
            });
        });
    };
    /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    ViewBuilder.prototype._visitProviderOrDirective = /**
     * @param {?} providerAst
     * @param {?} queryMatches
     * @return {?}
     */
    function (providerAst, queryMatches) {
        var /** @type {?} */ flags = 0 /* None */;
        var /** @type {?} */ queryMatchExprs = [];
        queryMatches.forEach(function (match) {
            if (tokenReference(match.value) === tokenReference(providerAst.token)) {
                queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(4 /* Provider */)]));
            }
        });
        var _a = providerDef(this.outputCtx, providerAst), providerExpr = _a.providerExpr, depsExpr = _a.depsExpr, providerFlags = _a.flags, tokenExpr = _a.tokenExpr;
        return {
            flags: flags | providerFlags,
            queryMatchExprs: queryMatchExprs,
            providerExpr: providerExpr,
            depsExpr: depsExpr,
            tokenExpr: tokenExpr,
            sourceSpan: providerAst.sourceSpan
        };
    };
    /**
     * @param {?} name
     * @return {?}
     */
    ViewBuilder.prototype.getLocal = /**
     * @param {?} name
     * @return {?}
     */
    function (name) {
        if (name == EventHandlerVars.event.name) {
            return EventHandlerVars.event;
        }
        var /** @type {?} */ currViewExpr = VIEW_VAR;
        for (var /** @type {?} */ currBuilder = this; currBuilder; currBuilder = currBuilder.parent,
            currViewExpr = currViewExpr.prop('parent').cast(o.DYNAMIC_TYPE)) {
            // check references
            var /** @type {?} */ refNodeIndex = currBuilder.refNodeIndices[name];
            if (refNodeIndex != null) {
                return o.importExpr(Identifiers.nodeValue).callFn([currViewExpr, o.literal(refNodeIndex)]);
            }
            // check variables
            var /** @type {?} */ varAst = currBuilder.variables.find(function (varAst) { return varAst.name === name; });
            if (varAst) {
                var /** @type {?} */ varValue = varAst.value || IMPLICIT_TEMPLATE_VAR;
                return currViewExpr.prop('context').prop(varValue);
            }
        }
        return null;
    };
    /**
     * @param {?} sourceSpan
     * @param {?} argCount
     * @return {?}
     */
    ViewBuilder.prototype._createLiteralArrayConverter = /**
     * @param {?} sourceSpan
     * @param {?} argCount
     * @return {?}
     */
    function (sourceSpan, argCount) {
        if (argCount === 0) {
            var /** @type {?} */ valueExpr_1 = o.importExpr(Identifiers.EMPTY_ARRAY);
            return function () { return valueExpr_1; };
        }
        var /** @type {?} */ checkIndex = this.nodes.length;
        this.nodes.push(function () {
            return ({
                sourceSpan: sourceSpan,
                nodeFlags: 32 /* TypePureArray */,
                nodeDef: o.importExpr(Identifiers.pureArrayDef).callFn([
                    o.literal(checkIndex),
                    o.literal(argCount),
                ])
            });
        });
        return function (args) { return callCheckStmt(checkIndex, args); };
    };
    /**
     * @param {?} sourceSpan
     * @param {?} keys
     * @return {?}
     */
    ViewBuilder.prototype._createLiteralMapConverter = /**
     * @param {?} sourceSpan
     * @param {?} keys
     * @return {?}
     */
    function (sourceSpan, keys) {
        if (keys.length === 0) {
            var /** @type {?} */ valueExpr_2 = o.importExpr(Identifiers.EMPTY_MAP);
            return function () { return valueExpr_2; };
        }
        var /** @type {?} */ map = o.literalMap(keys.map(function (e, i) { return (tslib_1.__assign({}, e, { value: o.literal(i) })); }));
        var /** @type {?} */ checkIndex = this.nodes.length;
        this.nodes.push(function () {
            return ({
                sourceSpan: sourceSpan,
                nodeFlags: 64 /* TypePureObject */,
                nodeDef: o.importExpr(Identifiers.pureObjectDef).callFn([
                    o.literal(checkIndex),
                    map,
                ])
            });
        });
        return function (args) { return callCheckStmt(checkIndex, args); };
    };
    /**
     * @param {?} expression
     * @param {?} name
     * @param {?} argCount
     * @return {?}
     */
    ViewBuilder.prototype._createPipeConverter = /**
     * @param {?} expression
     * @param {?} name
     * @param {?} argCount
     * @return {?}
     */
    function (expression, name, argCount) {
        var /** @type {?} */ pipe = /** @type {?} */ ((this.usedPipes.find(function (pipeSummary) { return pipeSummary.name === name; })));
        if (pipe.pure) {
            var /** @type {?} */ checkIndex_1 = this.nodes.length;
            this.nodes.push(function () {
                return ({
                    sourceSpan: expression.sourceSpan,
                    nodeFlags: 128 /* TypePurePipe */,
                    nodeDef: o.importExpr(Identifiers.purePipeDef).callFn([
                        o.literal(checkIndex_1),
                        o.literal(argCount),
                    ])
                });
            });
            // find underlying pipe in the component view
            var /** @type {?} */ compViewExpr = VIEW_VAR;
            var /** @type {?} */ compBuilder = this;
            while (compBuilder.parent) {
                compBuilder = compBuilder.parent;
                compViewExpr = compViewExpr.prop('parent').cast(o.DYNAMIC_TYPE);
            }
            var /** @type {?} */ pipeNodeIndex = compBuilder.purePipeNodeIndices[name];
            var /** @type {?} */ pipeValueExpr_1 = o.importExpr(Identifiers.nodeValue).callFn([compViewExpr, o.literal(pipeNodeIndex)]);
            return function (args) {
                return callUnwrapValue(expression.nodeIndex, expression.bindingIndex, callCheckStmt(checkIndex_1, [pipeValueExpr_1].concat(args)));
            };
        }
        else {
            var /** @type {?} */ nodeIndex = this._createPipe(expression.sourceSpan, pipe);
            var /** @type {?} */ nodeValueExpr_1 = o.importExpr(Identifiers.nodeValue).callFn([VIEW_VAR, o.literal(nodeIndex)]);
            return function (args) {
                return callUnwrapValue(expression.nodeIndex, expression.bindingIndex, nodeValueExpr_1.callMethod('transform', args));
            };
        }
    };
    /**
     * @param {?} sourceSpan
     * @param {?} pipe
     * @return {?}
     */
    ViewBuilder.prototype._createPipe = /**
     * @param {?} sourceSpan
     * @param {?} pipe
     * @return {?}
     */
    function (sourceSpan, pipe) {
        var _this = this;
        var /** @type {?} */ nodeIndex = this.nodes.length;
        var /** @type {?} */ flags = 0 /* None */;
        pipe.type.lifecycleHooks.forEach(function (lifecycleHook) {
            // for pipes, we only support ngOnDestroy
            if (lifecycleHook === LifecycleHooks.OnDestroy) {
                flags |= lifecycleHookToNodeFlag(lifecycleHook);
            }
        });
        var /** @type {?} */ depExprs = pipe.type.diDeps.map(function (diDep) { return depDef(_this.outputCtx, diDep); });
        // function pipeDef(
        //   flags: NodeFlags, ctor: any, deps: ([DepFlags, any] | any)[]): NodeDef
        this.nodes.push(function () {
            return ({
                sourceSpan: sourceSpan,
                nodeFlags: 16 /* TypePipe */,
                nodeDef: o.importExpr(Identifiers.pipeDef).callFn([
                    o.literal(flags), _this.outputCtx.importExpr(pipe.type.reference), o.literalArr(depExprs)
                ])
            });
        });
        return nodeIndex;
    };
    /**
     * For the AST in `UpdateExpression.value`:
     * - create nodes for pipes, literal arrays and, literal maps,
     * - update the AST to replace pipes, literal arrays and, literal maps with calls to check fn.
     *
     * WARNING: This might create new nodeDefs (for pipes and literal arrays and literal maps)!
     * @param {?} expression
     * @return {?}
     */
    ViewBuilder.prototype._preprocessUpdateExpression = /**
     * For the AST in `UpdateExpression.value`:
     * - create nodes for pipes, literal arrays and, literal maps,
     * - update the AST to replace pipes, literal arrays and, literal maps with calls to check fn.
     *
     * WARNING: This might create new nodeDefs (for pipes and literal arrays and literal maps)!
     * @param {?} expression
     * @return {?}
     */
    function (expression) {
        var _this = this;
        return {
            nodeIndex: expression.nodeIndex,
            bindingIndex: expression.bindingIndex,
            sourceSpan: expression.sourceSpan,
            context: expression.context,
            value: convertPropertyBindingBuiltins({
                createLiteralArrayConverter: function (argCount) {
                    return _this._createLiteralArrayConverter(expression.sourceSpan, argCount);
                },
                createLiteralMapConverter: function (keys) {
                    return _this._createLiteralMapConverter(expression.sourceSpan, keys);
                },
                createPipeConverter: function (name, argCount) {
                    return _this._createPipeConverter(expression, name, argCount);
                }
            }, expression.value)
        };
    };
    /**
     * @return {?}
     */
    ViewBuilder.prototype._createNodeExpressions = /**
     * @return {?}
     */
    function () {
        var /** @type {?} */ self = this;
        var /** @type {?} */ updateBindingCount = 0;
        var /** @type {?} */ updateRendererStmts = [];
        var /** @type {?} */ updateDirectivesStmts = [];
        var /** @type {?} */ nodeDefExprs = this.nodes.map(function (factory, nodeIndex) {
            var _a = factory(), nodeDef = _a.nodeDef, nodeFlags = _a.nodeFlags, updateDirectives = _a.updateDirectives, updateRenderer = _a.updateRenderer, sourceSpan = _a.sourceSpan;
            if (updateRenderer) {
                updateRendererStmts.push.apply(updateRendererStmts, createUpdateStatements(nodeIndex, sourceSpan, updateRenderer, false));
            }
            if (updateDirectives) {
                updateDirectivesStmts.push.apply(updateDirectivesStmts, createUpdateStatements(nodeIndex, sourceSpan, updateDirectives, (nodeFlags & (262144 /* DoCheck */ | 65536 /* OnInit */)) > 0));
            }
            // We use a comma expression to call the log function before
            // the nodeDef function, but still use the result of the nodeDef function
            // as the value.
            // Note: We only add the logger to elements / text nodes,
            // so we don't generate too much code.
            var /** @type {?} */ logWithNodeDef = nodeFlags & 3 /* CatRenderNode */ ?
                new o.CommaExpr([LOG_VAR.callFn([]).callFn([]), nodeDef]) :
                nodeDef;
            return o.applySourceSpanToExpressionIfNeeded(logWithNodeDef, sourceSpan);
        });
        return { updateRendererStmts: updateRendererStmts, updateDirectivesStmts: updateDirectivesStmts, nodeDefExprs: nodeDefExprs };
        /**
         * @param {?} nodeIndex
         * @param {?} sourceSpan
         * @param {?} expressions
         * @param {?} allowEmptyExprs
         * @return {?}
         */
        function createUpdateStatements(nodeIndex, sourceSpan, expressions, allowEmptyExprs) {
            var /** @type {?} */ updateStmts = [];
            var /** @type {?} */ exprs = expressions.map(function (_a) {
                var sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
                var /** @type {?} */ bindingId = "" + updateBindingCount++;
                var /** @type {?} */ nameResolver = context === COMP_VAR ? self : null;
                var _b = convertPropertyBinding(nameResolver, context, value, bindingId, BindingForm.General), stmts = _b.stmts, currValExpr = _b.currValExpr;
                updateStmts.push.apply(updateStmts, stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); }));
                return o.applySourceSpanToExpressionIfNeeded(currValExpr, sourceSpan);
            });
            if (expressions.length || allowEmptyExprs) {
                updateStmts.push(o.applySourceSpanToStatementIfNeeded(callCheckStmt(nodeIndex, exprs).toStmt(), sourceSpan));
            }
            return updateStmts;
        }
    };
    /**
     * @param {?} nodeIndex
     * @param {?} handlers
     * @return {?}
     */
    ViewBuilder.prototype._createElementHandleEventFn = /**
     * @param {?} nodeIndex
     * @param {?} handlers
     * @return {?}
     */
    function (nodeIndex, handlers) {
        var _this = this;
        var /** @type {?} */ handleEventStmts = [];
        var /** @type {?} */ handleEventBindingCount = 0;
        handlers.forEach(function (_a) {
            var context = _a.context, eventAst = _a.eventAst, dirAst = _a.dirAst;
            var /** @type {?} */ bindingId = "" + handleEventBindingCount++;
            var /** @type {?} */ nameResolver = context === COMP_VAR ? _this : null;
            var _b = convertActionBinding(nameResolver, context, eventAst.handler, bindingId), stmts = _b.stmts, allowDefault = _b.allowDefault;
            var /** @type {?} */ trueStmts = stmts;
            if (allowDefault) {
                trueStmts.push(ALLOW_DEFAULT_VAR.set(allowDefault.and(ALLOW_DEFAULT_VAR)).toStmt());
            }
            var _c = elementEventNameAndTarget(eventAst, dirAst), eventTarget = _c.target, eventName = _c.name;
            var /** @type {?} */ fullEventName = elementEventFullName(eventTarget, eventName);
            handleEventStmts.push(o.applySourceSpanToStatementIfNeeded(new o.IfStmt(o.literal(fullEventName).identical(EVENT_NAME_VAR), trueStmts), eventAst.sourceSpan));
        });
        var /** @type {?} */ handleEventFn;
        if (handleEventStmts.length > 0) {
            var /** @type {?} */ preStmts = [ALLOW_DEFAULT_VAR.set(o.literal(true)).toDeclStmt(o.BOOL_TYPE)];
            if (!this.component.isHost && o.findReadVarNames(handleEventStmts).has(/** @type {?} */ ((COMP_VAR.name)))) {
                preStmts.push(COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(this.compType));
            }
            handleEventFn = o.fn([
                new o.FnParam(/** @type {?} */ ((VIEW_VAR.name)), o.INFERRED_TYPE),
                new o.FnParam(/** @type {?} */ ((EVENT_NAME_VAR.name)), o.INFERRED_TYPE),
                new o.FnParam(/** @type {?} */ ((EventHandlerVars.event.name)), o.INFERRED_TYPE)
            ], preStmts.concat(handleEventStmts, [new o.ReturnStatement(ALLOW_DEFAULT_VAR)]), o.INFERRED_TYPE);
        }
        else {
            handleEventFn = o.NULL_EXPR;
        }
        return handleEventFn;
    };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitDirective = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitDirectiveProperty = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitReference = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitVariable = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitEvent = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitElementProperty = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    ViewBuilder.prototype.visitAttr = /**
     * @param {?} ast
     * @param {?} context
     * @return {?}
     */
    function (ast, context) { };
    return ViewBuilder;
}());
function ViewBuilder_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewBuilder.prototype.compType;
    /** @type {?} */
    ViewBuilder.prototype.nodes;
    /** @type {?} */
    ViewBuilder.prototype.purePipeNodeIndices;
    /** @type {?} */
    ViewBuilder.prototype.refNodeIndices;
    /** @type {?} */
    ViewBuilder.prototype.variables;
    /** @type {?} */
    ViewBuilder.prototype.children;
    /** @type {?} */
    ViewBuilder.prototype.viewName;
    /** @type {?} */
    ViewBuilder.prototype.reflector;
    /** @type {?} */
    ViewBuilder.prototype.outputCtx;
    /** @type {?} */
    ViewBuilder.prototype.parent;
    /** @type {?} */
    ViewBuilder.prototype.component;
    /** @type {?} */
    ViewBuilder.prototype.embeddedViewIndex;
    /** @type {?} */
    ViewBuilder.prototype.usedPipes;
    /** @type {?} */
    ViewBuilder.prototype.staticQueryIds;
    /** @type {?} */
    ViewBuilder.prototype.viewBuilderFactory;
}
/**
 * @param {?} astNodes
 * @return {?}
 */
function needsAdditionalRootNode(astNodes) {
    var /** @type {?} */ lastAstNode = astNodes[astNodes.length - 1];
    if (lastAstNode instanceof EmbeddedTemplateAst) {
        return lastAstNode.hasViewContainer;
    }
    if (lastAstNode instanceof ElementAst) {
        if (isNgContainer(lastAstNode.name) && lastAstNode.children.length) {
            return needsAdditionalRootNode(lastAstNode.children);
        }
        return lastAstNode.hasViewContainer;
    }
    return lastAstNode instanceof NgContentAst;
}
/**
 * @param {?} inputAst
 * @param {?} dirAst
 * @return {?}
 */
function elementBindingDef(inputAst, dirAst) {
    switch (inputAst.type) {
        case PropertyBindingType.Attribute:
            return o.literalArr([
                o.literal(1 /* TypeElementAttribute */), o.literal(inputAst.name),
                o.literal(inputAst.securityContext)
            ]);
        case PropertyBindingType.Property:
            return o.literalArr([
                o.literal(8 /* TypeProperty */), o.literal(inputAst.name),
                o.literal(inputAst.securityContext)
            ]);
        case PropertyBindingType.Animation:
            var /** @type {?} */ bindingType = 8 /* TypeProperty */ |
                (dirAst && dirAst.directive.isComponent ? 32 /* SyntheticHostProperty */ :
                    16 /* SyntheticProperty */);
            return o.literalArr([
                o.literal(bindingType), o.literal('@' + inputAst.name), o.literal(inputAst.securityContext)
            ]);
        case PropertyBindingType.Class:
            return o.literalArr([o.literal(2 /* TypeElementClass */), o.literal(inputAst.name), o.NULL_EXPR]);
        case PropertyBindingType.Style:
            return o.literalArr([
                o.literal(4 /* TypeElementStyle */), o.literal(inputAst.name), o.literal(inputAst.unit)
            ]);
    }
}
/**
 * @param {?} elementAst
 * @return {?}
 */
function fixedAttrsDef(elementAst) {
    var /** @type {?} */ mapResult = Object.create(null);
    elementAst.attrs.forEach(function (attrAst) { mapResult[attrAst.name] = attrAst.value; });
    elementAst.directives.forEach(function (dirAst) {
        Object.keys(dirAst.directive.hostAttributes).forEach(function (name) {
            var /** @type {?} */ value = dirAst.directive.hostAttributes[name];
            var /** @type {?} */ prevValue = mapResult[name];
            mapResult[name] = prevValue != null ? mergeAttributeValue(name, prevValue, value) : value;
        });
    });
    // Note: We need to sort to get a defined output order
    // for tests and for caching generated artifacts...
    return o.literalArr(Object.keys(mapResult).sort().map(function (attrName) { return o.literalArr([o.literal(attrName), o.literal(mapResult[attrName])]); }));
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
/**
 * @param {?} nodeIndex
 * @param {?} exprs
 * @return {?}
 */
function callCheckStmt(nodeIndex, exprs) {
    if (exprs.length > 10) {
        return CHECK_VAR.callFn([VIEW_VAR, o.literal(nodeIndex), o.literal(1 /* Dynamic */), o.literalArr(exprs)]);
    }
    else {
        return CHECK_VAR.callFn([VIEW_VAR, o.literal(nodeIndex), o.literal(0 /* Inline */)].concat(exprs));
    }
}
/**
 * @param {?} nodeIndex
 * @param {?} bindingIdx
 * @param {?} expr
 * @return {?}
 */
function callUnwrapValue(nodeIndex, bindingIdx, expr) {
    return o.importExpr(Identifiers.unwrapValue).callFn([
        VIEW_VAR, o.literal(nodeIndex), o.literal(bindingIdx), expr
    ]);
}
/**
 * @record
 */
function StaticAndDynamicQueryIds() { }
function StaticAndDynamicQueryIds_tsickle_Closure_declarations() {
    /** @type {?} */
    StaticAndDynamicQueryIds.prototype.staticQueryIds;
    /** @type {?} */
    StaticAndDynamicQueryIds.prototype.dynamicQueryIds;
}
/**
 * @param {?} nodes
 * @param {?=} result
 * @return {?}
 */
function findStaticQueryIds(nodes, result) {
    if (result === void 0) { result = new Map(); }
    nodes.forEach(function (node) {
        var /** @type {?} */ staticQueryIds = new Set();
        var /** @type {?} */ dynamicQueryIds = new Set();
        var /** @type {?} */ queryMatches = /** @type {?} */ ((undefined));
        if (node instanceof ElementAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach(function (child) {
                var /** @type {?} */ childData = /** @type {?} */ ((result.get(child)));
                childData.staticQueryIds.forEach(function (queryId) { return staticQueryIds.add(queryId); });
                childData.dynamicQueryIds.forEach(function (queryId) { return dynamicQueryIds.add(queryId); });
            });
            queryMatches = node.queryMatches;
        }
        else if (node instanceof EmbeddedTemplateAst) {
            findStaticQueryIds(node.children, result);
            node.children.forEach(function (child) {
                var /** @type {?} */ childData = /** @type {?} */ ((result.get(child)));
                childData.staticQueryIds.forEach(function (queryId) { return dynamicQueryIds.add(queryId); });
                childData.dynamicQueryIds.forEach(function (queryId) { return dynamicQueryIds.add(queryId); });
            });
            queryMatches = node.queryMatches;
        }
        if (queryMatches) {
            queryMatches.forEach(function (match) { return staticQueryIds.add(match.queryId); });
        }
        dynamicQueryIds.forEach(function (queryId) { return staticQueryIds.delete(queryId); });
        result.set(node, { staticQueryIds: staticQueryIds, dynamicQueryIds: dynamicQueryIds });
    });
    return result;
}
/**
 * @param {?} nodeStaticQueryIds
 * @return {?}
 */
function staticViewQueryIds(nodeStaticQueryIds) {
    var /** @type {?} */ staticQueryIds = new Set();
    var /** @type {?} */ dynamicQueryIds = new Set();
    Array.from(nodeStaticQueryIds.values()).forEach(function (entry) {
        entry.staticQueryIds.forEach(function (queryId) { return staticQueryIds.add(queryId); });
        entry.dynamicQueryIds.forEach(function (queryId) { return dynamicQueryIds.add(queryId); });
    });
    dynamicQueryIds.forEach(function (queryId) { return staticQueryIds.delete(queryId); });
    return { staticQueryIds: staticQueryIds, dynamicQueryIds: dynamicQueryIds };
}
/**
 * @param {?} eventAst
 * @param {?} dirAst
 * @return {?}
 */
function elementEventNameAndTarget(eventAst, dirAst) {
    if (eventAst.isAnimation) {
        return {
            name: "@" + eventAst.name + "." + eventAst.phase,
            target: dirAst && dirAst.directive.isComponent ? 'component' : null
        };
    }
    else {
        return eventAst;
    }
}
/**
 * @param {?} queryIds
 * @param {?} queryId
 * @param {?} isFirst
 * @return {?}
 */
function calcStaticDynamicQueryFlags(queryIds, queryId, isFirst) {
    var /** @type {?} */ flags = 0 /* None */;
    // Note: We only make queries static that query for a single item.
    // This is because of backwards compatibility with the old view compiler...
    if (isFirst && (queryIds.staticQueryIds.has(queryId) || !queryIds.dynamicQueryIds.has(queryId))) {
        flags |= 268435456 /* StaticQuery */;
    }
    else {
        flags |= 536870912 /* DynamicQuery */;
    }
    return flags;
}
/**
 * @param {?} target
 * @param {?} name
 * @return {?}
 */
export function elementEventFullName(target, name) {
    return target ? target + ":" + name : name;
}
//# sourceMappingURL=view_compiler.js.map