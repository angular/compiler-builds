/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/view_compiler/view_compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/identifiers", "@angular/compiler/src/lifecycle_reflector", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/value_util", "@angular/compiler/src/template_parser/template_ast", "@angular/compiler/src/view_compiler/provider_compiler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.elementEventFullName = exports.ViewCompiler = exports.ViewCompileResult = void 0;
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core_1 = require("@angular/compiler/src/core");
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var lifecycle_reflector_1 = require("@angular/compiler/src/lifecycle_reflector");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var o = require("@angular/compiler/src/output/output_ast");
    var value_util_1 = require("@angular/compiler/src/output/value_util");
    var template_ast_1 = require("@angular/compiler/src/template_parser/template_ast");
    var provider_compiler_1 = require("@angular/compiler/src/view_compiler/provider_compiler");
    var CLASS_ATTR = 'class';
    var STYLE_ATTR = 'style';
    var IMPLICIT_TEMPLATE_VAR = '$implicit';
    var ViewCompileResult = /** @class */ (function () {
        function ViewCompileResult(viewClassVar, rendererTypeVar) {
            this.viewClassVar = viewClassVar;
            this.rendererTypeVar = rendererTypeVar;
        }
        return ViewCompileResult;
    }());
    exports.ViewCompileResult = ViewCompileResult;
    var ViewCompiler = /** @class */ (function () {
        function ViewCompiler(_reflector) {
            this._reflector = _reflector;
        }
        ViewCompiler.prototype.compileComponent = function (outputCtx, component, template, styles, usedPipes) {
            var _a;
            var _this = this;
            var embeddedViewCount = 0;
            var renderComponentVarName = undefined;
            if (!component.isHost) {
                var template_1 = component.template;
                var customRenderData = [];
                if (template_1.animations && template_1.animations.length) {
                    customRenderData.push(new o.LiteralMapEntry('animation', (0, value_util_1.convertValueToOutputAst)(outputCtx, template_1.animations), true));
                }
                var renderComponentVar = o.variable((0, compile_metadata_1.rendererTypeName)(component.type.reference));
                renderComponentVarName = renderComponentVar.name;
                outputCtx.statements.push(renderComponentVar
                    .set(o.importExpr(identifiers_1.Identifiers.createRendererType2).callFn([new o.LiteralMapExpr([
                        new o.LiteralMapEntry('encapsulation', o.literal(template_1.encapsulation), false),
                        new o.LiteralMapEntry('styles', styles, false),
                        new o.LiteralMapEntry('data', new o.LiteralMapExpr(customRenderData), false)
                    ])]))
                    .toDeclStmt(o.importType(identifiers_1.Identifiers.RendererType2), [o.StmtModifier.Final, o.StmtModifier.Exported]));
            }
            var viewBuilderFactory = function (parent) {
                var embeddedViewIndex = embeddedViewCount++;
                return new ViewBuilder(_this._reflector, outputCtx, parent, component, embeddedViewIndex, usedPipes, viewBuilderFactory);
            };
            var visitor = viewBuilderFactory(null);
            visitor.visitAll([], template);
            (_a = outputCtx.statements).push.apply(_a, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(visitor.build()), false));
            return new ViewCompileResult(visitor.viewName, renderComponentVarName);
        };
        return ViewCompiler;
    }());
    exports.ViewCompiler = ViewCompiler;
    var LOG_VAR = o.variable('_l');
    var VIEW_VAR = o.variable('_v');
    var CHECK_VAR = o.variable('_ck');
    var COMP_VAR = o.variable('_co');
    var EVENT_NAME_VAR = o.variable('en');
    var ALLOW_DEFAULT_VAR = o.variable("ad");
    var ViewBuilder = /** @class */ (function () {
        function ViewBuilder(reflector, outputCtx, parent, component, embeddedViewIndex, usedPipes, viewBuilderFactory) {
            this.reflector = reflector;
            this.outputCtx = outputCtx;
            this.parent = parent;
            this.component = component;
            this.embeddedViewIndex = embeddedViewIndex;
            this.usedPipes = usedPipes;
            this.viewBuilderFactory = viewBuilderFactory;
            this.nodes = [];
            this.purePipeNodeIndices = Object.create(null);
            // Need Object.create so that we don't have builtin values...
            this.refNodeIndices = Object.create(null);
            this.variables = [];
            this.children = [];
            // TODO(tbosch): The old view compiler used to use an `any` type
            // for the context in any embedded view. We keep this behaivor for now
            // to be able to introduce the new view compiler without too many errors.
            this.compType = this.embeddedViewIndex > 0 ?
                o.DYNAMIC_TYPE :
                o.expressionType(outputCtx.importExpr(this.component.type.reference));
            this.viewName = (0, compile_metadata_1.viewClassName)(this.component.type.reference, this.embeddedViewIndex);
        }
        ViewBuilder.prototype.visitAll = function (variables, astNodes) {
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
                this.component.viewQueries.forEach(function (query, queryIndex) {
                    // Note: queries start with id 1 so we can use the number in a Bloom filter!
                    var queryId = queryIndex + 1;
                    var bindingType = query.first ? 0 /* First */ : 1 /* All */;
                    var flags = 134217728 /* TypeViewQuery */ | calcQueryFlags(query);
                    _this.nodes.push(function () { return ({
                        sourceSpan: null,
                        nodeFlags: flags,
                        nodeDef: o.importExpr(identifiers_1.Identifiers.queryDef).callFn([
                            o.literal(flags), o.literal(queryId),
                            new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType), false)])
                        ])
                    }); });
                });
            }
            (0, template_ast_1.templateVisitAll)(this, astNodes);
            if (this.parent && (astNodes.length === 0 || needsAdditionalRootNode(astNodes))) {
                // if the view is an embedded view, then we need to add an additional root node in some cases
                this.nodes.push(function () { return ({
                    sourceSpan: null,
                    nodeFlags: 1 /* TypeElement */,
                    nodeDef: o.importExpr(identifiers_1.Identifiers.anchorDef).callFn([
                        o.literal(0 /* None */), o.NULL_EXPR, o.NULL_EXPR, o.literal(0)
                    ])
                }); });
            }
        };
        ViewBuilder.prototype.build = function (targetStatements) {
            if (targetStatements === void 0) { targetStatements = []; }
            this.children.forEach(function (child) { return child.build(targetStatements); });
            var _a = this._createNodeExpressions(), updateRendererStmts = _a.updateRendererStmts, updateDirectivesStmts = _a.updateDirectivesStmts, nodeDefExprs = _a.nodeDefExprs;
            var updateRendererFn = this._createUpdateFn(updateRendererStmts);
            var updateDirectivesFn = this._createUpdateFn(updateDirectivesStmts);
            var viewFlags = 0 /* None */;
            if (!this.parent && this.component.changeDetection === core_1.ChangeDetectionStrategy.OnPush) {
                viewFlags |= 2 /* OnPush */;
            }
            var viewFactory = new o.DeclareFunctionStmt(this.viewName, [new o.FnParam(LOG_VAR.name)], [new o.ReturnStatement(o.importExpr(identifiers_1.Identifiers.viewDef).callFn([
                    o.literal(viewFlags),
                    o.literalArr(nodeDefExprs),
                    updateDirectivesFn,
                    updateRendererFn,
                ]))], o.importType(identifiers_1.Identifiers.ViewDefinition), this.embeddedViewIndex === 0 ? [o.StmtModifier.Exported] : []);
            targetStatements.push(viewFactory);
            return targetStatements;
        };
        ViewBuilder.prototype._createUpdateFn = function (updateStmts) {
            var updateFn;
            if (updateStmts.length > 0) {
                var preStmts = [];
                if (!this.component.isHost && o.findReadVarNames(updateStmts).has(COMP_VAR.name)) {
                    preStmts.push(COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(this.compType));
                }
                updateFn = o.fn([
                    new o.FnParam(CHECK_VAR.name, o.INFERRED_TYPE),
                    new o.FnParam(VIEW_VAR.name, o.INFERRED_TYPE)
                ], (0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(preStmts), false), (0, tslib_1.__read)(updateStmts), false), o.INFERRED_TYPE);
            }
            else {
                updateFn = o.NULL_EXPR;
            }
            return updateFn;
        };
        ViewBuilder.prototype.visitNgContent = function (ast, context) {
            // ngContentDef(ngContentIndex: number, index: number): NodeDef;
            this.nodes.push(function () { return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 8 /* TypeNgContent */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.ngContentDef)
                    .callFn([o.literal(ast.ngContentIndex), o.literal(ast.index)])
            }); });
        };
        ViewBuilder.prototype.visitText = function (ast, context) {
            // Static text nodes have no check function
            var checkIndex = -1;
            this.nodes.push(function () { return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 2 /* TypeText */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.textDef).callFn([
                    o.literal(checkIndex),
                    o.literal(ast.ngContentIndex),
                    o.literalArr([o.literal(ast.value)]),
                ])
            }); });
        };
        ViewBuilder.prototype.visitBoundText = function (ast, context) {
            var _this = this;
            var nodeIndex = this.nodes.length;
            // reserve the space in the nodeDefs array
            this.nodes.push(null);
            var astWithSource = ast.value;
            var inter = astWithSource.ast;
            var updateRendererExpressions = inter.expressions.map(function (expr, bindingIndex) { return _this._preprocessUpdateExpression({ nodeIndex: nodeIndex, bindingIndex: bindingIndex, sourceSpan: ast.sourceSpan, context: COMP_VAR, value: expr }); });
            // Check index is the same as the node index during compilation
            // They might only differ at runtime
            var checkIndex = nodeIndex;
            this.nodes[nodeIndex] = function () { return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 2 /* TypeText */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.textDef).callFn([
                    o.literal(checkIndex),
                    o.literal(ast.ngContentIndex),
                    o.literalArr(inter.strings.map(function (s) { return o.literal(s); })),
                ]),
                updateRenderer: updateRendererExpressions
            }); };
        };
        ViewBuilder.prototype.visitEmbeddedTemplate = function (ast, context) {
            var _this = this;
            var nodeIndex = this.nodes.length;
            // reserve the space in the nodeDefs array
            this.nodes.push(null);
            var _a = this._visitElementOrTemplate(nodeIndex, ast), flags = _a.flags, queryMatchesExpr = _a.queryMatchesExpr, hostEvents = _a.hostEvents;
            var childVisitor = this.viewBuilderFactory(this);
            this.children.push(childVisitor);
            childVisitor.visitAll(ast.variables, ast.children);
            var childCount = this.nodes.length - nodeIndex - 1;
            // anchorDef(
            //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], ngContentIndex: number,
            //   childCount: number, handleEventFn?: ElementHandleEventFn, templateFactory?:
            //   ViewDefinitionFactory): NodeDef;
            this.nodes[nodeIndex] = function () { return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 1 /* TypeElement */ | flags,
                nodeDef: o.importExpr(identifiers_1.Identifiers.anchorDef).callFn([
                    o.literal(flags),
                    queryMatchesExpr,
                    o.literal(ast.ngContentIndex),
                    o.literal(childCount),
                    _this._createElementHandleEventFn(nodeIndex, hostEvents),
                    o.variable(childVisitor.viewName),
                ])
            }); };
        };
        ViewBuilder.prototype.visitElement = function (ast, context) {
            var _this = this;
            var nodeIndex = this.nodes.length;
            // reserve the space in the nodeDefs array so we can add children
            this.nodes.push(null);
            // Using a null element name creates an anchor.
            var elName = (0, tags_1.isNgContainer)(ast.name) ? null : ast.name;
            var _a = this._visitElementOrTemplate(nodeIndex, ast), flags = _a.flags, usedEvents = _a.usedEvents, queryMatchesExpr = _a.queryMatchesExpr, dirHostBindings = _a.hostBindings, hostEvents = _a.hostEvents;
            var inputDefs = [];
            var updateRendererExpressions = [];
            var outputDefs = [];
            if (elName) {
                var hostBindings = ast.inputs
                    .map(function (inputAst) { return ({
                    context: COMP_VAR,
                    inputAst: inputAst,
                    dirAst: null,
                }); })
                    .concat(dirHostBindings);
                if (hostBindings.length) {
                    updateRendererExpressions =
                        hostBindings.map(function (hostBinding, bindingIndex) { return _this._preprocessUpdateExpression({
                            context: hostBinding.context,
                            nodeIndex: nodeIndex,
                            bindingIndex: bindingIndex,
                            sourceSpan: hostBinding.inputAst.sourceSpan,
                            value: hostBinding.inputAst.value
                        }); });
                    inputDefs = hostBindings.map(function (hostBinding) { return elementBindingDef(hostBinding.inputAst, hostBinding.dirAst); });
                }
                outputDefs = usedEvents.map(function (_a) {
                    var _b = (0, tslib_1.__read)(_a, 2), target = _b[0], eventName = _b[1];
                    return o.literalArr([o.literal(target), o.literal(eventName)]);
                });
            }
            (0, template_ast_1.templateVisitAll)(this, ast.children);
            var childCount = this.nodes.length - nodeIndex - 1;
            var compAst = ast.directives.find(function (dirAst) { return dirAst.directive.isComponent; });
            var compRendererType = o.NULL_EXPR;
            var compView = o.NULL_EXPR;
            if (compAst) {
                compView = this.outputCtx.importExpr(compAst.directive.componentViewType);
                compRendererType = this.outputCtx.importExpr(compAst.directive.rendererType);
            }
            // Check index is the same as the node index during compilation
            // They might only differ at runtime
            var checkIndex = nodeIndex;
            this.nodes[nodeIndex] = function () { return ({
                sourceSpan: ast.sourceSpan,
                nodeFlags: 1 /* TypeElement */ | flags,
                nodeDef: o.importExpr(identifiers_1.Identifiers.elementDef).callFn([
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
            }); };
        };
        ViewBuilder.prototype._visitElementOrTemplate = function (nodeIndex, ast) {
            var _this = this;
            var flags = 0 /* None */;
            if (ast.hasViewContainer) {
                flags |= 16777216 /* EmbeddedViews */;
            }
            var usedEvents = new Map();
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
            var hostBindings = [];
            var hostEvents = [];
            this._visitComponentFactoryResolverProvider(ast.directives);
            ast.providers.forEach(function (providerAst) {
                var dirAst = undefined;
                ast.directives.forEach(function (localDirAst) {
                    if (localDirAst.directive.type.reference === (0, compile_metadata_1.tokenReference)(providerAst.token)) {
                        dirAst = localDirAst;
                    }
                });
                if (dirAst) {
                    var _a = _this._visitDirective(providerAst, dirAst, ast.references, ast.queryMatches, usedEvents), dirHostBindings = _a.hostBindings, dirHostEvents = _a.hostEvents;
                    hostBindings.push.apply(hostBindings, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(dirHostBindings), false));
                    hostEvents.push.apply(hostEvents, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(dirHostEvents), false));
                }
                else {
                    _this._visitProvider(providerAst, ast.queryMatches);
                }
            });
            var queryMatchExprs = [];
            ast.queryMatches.forEach(function (match) {
                var valueType = undefined;
                if ((0, compile_metadata_1.tokenReference)(match.value) ===
                    _this.reflector.resolveExternalReference(identifiers_1.Identifiers.ElementRef)) {
                    valueType = 0 /* ElementRef */;
                }
                else if ((0, compile_metadata_1.tokenReference)(match.value) ===
                    _this.reflector.resolveExternalReference(identifiers_1.Identifiers.ViewContainerRef)) {
                    valueType = 3 /* ViewContainerRef */;
                }
                else if ((0, compile_metadata_1.tokenReference)(match.value) ===
                    _this.reflector.resolveExternalReference(identifiers_1.Identifiers.TemplateRef)) {
                    valueType = 2 /* TemplateRef */;
                }
                if (valueType != null) {
                    queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(valueType)]));
                }
            });
            ast.references.forEach(function (ref) {
                var valueType = undefined;
                if (!ref.value) {
                    valueType = 1 /* RenderElement */;
                }
                else if ((0, compile_metadata_1.tokenReference)(ref.value) ===
                    _this.reflector.resolveExternalReference(identifiers_1.Identifiers.TemplateRef)) {
                    valueType = 2 /* TemplateRef */;
                }
                if (valueType != null) {
                    _this.refNodeIndices[ref.name] = nodeIndex;
                    queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(valueType)]));
                }
            });
            ast.outputs.forEach(function (outputAst) {
                hostEvents.push({ context: COMP_VAR, eventAst: outputAst, dirAst: null });
            });
            return {
                flags: flags,
                usedEvents: Array.from(usedEvents.values()),
                queryMatchesExpr: queryMatchExprs.length ? o.literalArr(queryMatchExprs) : o.NULL_EXPR,
                hostBindings: hostBindings,
                hostEvents: hostEvents
            };
        };
        ViewBuilder.prototype._visitDirective = function (providerAst, dirAst, refs, queryMatches, usedEvents) {
            var _this = this;
            var nodeIndex = this.nodes.length;
            // reserve the space in the nodeDefs array so we can add children
            this.nodes.push(null);
            dirAst.directive.queries.forEach(function (query, queryIndex) {
                var queryId = dirAst.contentQueryStartId + queryIndex;
                var flags = 67108864 /* TypeContentQuery */ | calcQueryFlags(query);
                var bindingType = query.first ? 0 /* First */ : 1 /* All */;
                _this.nodes.push(function () { return ({
                    sourceSpan: dirAst.sourceSpan,
                    nodeFlags: flags,
                    nodeDef: o.importExpr(identifiers_1.Identifiers.queryDef).callFn([
                        o.literal(flags), o.literal(queryId),
                        new o.LiteralMapExpr([new o.LiteralMapEntry(query.propertyName, o.literal(bindingType), false)])
                    ]),
                }); });
            });
            // Note: the operation below might also create new nodeDefs,
            // but we don't want them to be a child of a directive,
            // as they might be a provider/pipe on their own.
            // I.e. we only allow queries as children of directives nodes.
            var childCount = this.nodes.length - nodeIndex - 1;
            var _a = this._visitProviderOrDirective(providerAst, queryMatches), flags = _a.flags, queryMatchExprs = _a.queryMatchExprs, providerExpr = _a.providerExpr, depsExpr = _a.depsExpr;
            refs.forEach(function (ref) {
                if (ref.value && (0, compile_metadata_1.tokenReference)(ref.value) === (0, compile_metadata_1.tokenReference)(providerAst.token)) {
                    _this.refNodeIndices[ref.name] = nodeIndex;
                    queryMatchExprs.push(o.literalArr([o.literal(ref.name), o.literal(4 /* Provider */)]));
                }
            });
            if (dirAst.directive.isComponent) {
                flags |= 32768 /* Component */;
            }
            var inputDefs = dirAst.inputs.map(function (inputAst, inputIndex) {
                var mapValue = o.literalArr([o.literal(inputIndex), o.literal(inputAst.directiveName)]);
                // Note: it's important to not quote the key so that we can capture renames by minifiers!
                return new o.LiteralMapEntry(inputAst.directiveName, mapValue, false);
            });
            var outputDefs = [];
            var dirMeta = dirAst.directive;
            Object.keys(dirMeta.outputs).forEach(function (propName) {
                var eventName = dirMeta.outputs[propName];
                if (usedEvents.has(eventName)) {
                    // Note: it's important to not quote the key so that we can capture renames by minifiers!
                    outputDefs.push(new o.LiteralMapEntry(propName, o.literal(eventName), false));
                }
            });
            var updateDirectiveExpressions = [];
            if (dirAst.inputs.length || (flags & (262144 /* DoCheck */ | 65536 /* OnInit */)) > 0) {
                updateDirectiveExpressions =
                    dirAst.inputs.map(function (input, bindingIndex) { return _this._preprocessUpdateExpression({
                        nodeIndex: nodeIndex,
                        bindingIndex: bindingIndex,
                        sourceSpan: input.sourceSpan,
                        context: COMP_VAR,
                        value: input.value
                    }); });
            }
            var dirContextExpr = o.importExpr(identifiers_1.Identifiers.nodeValue).callFn([VIEW_VAR, o.literal(nodeIndex)]);
            var hostBindings = dirAst.hostProperties.map(function (inputAst) { return ({
                context: dirContextExpr,
                dirAst: dirAst,
                inputAst: inputAst,
            }); });
            var hostEvents = dirAst.hostEvents.map(function (hostEventAst) { return ({
                context: dirContextExpr,
                eventAst: hostEventAst,
                dirAst: dirAst,
            }); });
            // Check index is the same as the node index during compilation
            // They might only differ at runtime
            var checkIndex = nodeIndex;
            this.nodes[nodeIndex] = function () { return ({
                sourceSpan: dirAst.sourceSpan,
                nodeFlags: 16384 /* TypeDirective */ | flags,
                nodeDef: o.importExpr(identifiers_1.Identifiers.directiveDef).callFn([
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
            }); };
            return { hostBindings: hostBindings, hostEvents: hostEvents };
        };
        ViewBuilder.prototype._visitProvider = function (providerAst, queryMatches) {
            this._addProviderNode(this._visitProviderOrDirective(providerAst, queryMatches));
        };
        ViewBuilder.prototype._visitComponentFactoryResolverProvider = function (directives) {
            var componentDirMeta = directives.find(function (dirAst) { return dirAst.directive.isComponent; });
            if (componentDirMeta && componentDirMeta.directive.entryComponents.length) {
                var _a = (0, provider_compiler_1.componentFactoryResolverProviderDef)(this.reflector, this.outputCtx, 8192 /* PrivateProvider */, componentDirMeta.directive.entryComponents), providerExpr = _a.providerExpr, depsExpr = _a.depsExpr, flags = _a.flags, tokenExpr = _a.tokenExpr;
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
        ViewBuilder.prototype._addProviderNode = function (data) {
            // providerDef(
            //   flags: NodeFlags, matchedQueries: [string, QueryValueType][], token:any,
            //   value: any, deps: ([DepFlags, any] | any)[]): NodeDef;
            this.nodes.push(function () { return ({
                sourceSpan: data.sourceSpan,
                nodeFlags: data.flags,
                nodeDef: o.importExpr(identifiers_1.Identifiers.providerDef).callFn([
                    o.literal(data.flags),
                    data.queryMatchExprs.length ? o.literalArr(data.queryMatchExprs) : o.NULL_EXPR,
                    data.tokenExpr, data.providerExpr, data.depsExpr
                ])
            }); });
        };
        ViewBuilder.prototype._visitProviderOrDirective = function (providerAst, queryMatches) {
            var flags = 0 /* None */;
            var queryMatchExprs = [];
            queryMatches.forEach(function (match) {
                if ((0, compile_metadata_1.tokenReference)(match.value) === (0, compile_metadata_1.tokenReference)(providerAst.token)) {
                    queryMatchExprs.push(o.literalArr([o.literal(match.queryId), o.literal(4 /* Provider */)]));
                }
            });
            var _a = (0, provider_compiler_1.providerDef)(this.outputCtx, providerAst), providerExpr = _a.providerExpr, depsExpr = _a.depsExpr, providerFlags = _a.flags, tokenExpr = _a.tokenExpr;
            return {
                flags: flags | providerFlags,
                queryMatchExprs: queryMatchExprs,
                providerExpr: providerExpr,
                depsExpr: depsExpr,
                tokenExpr: tokenExpr,
                sourceSpan: providerAst.sourceSpan
            };
        };
        ViewBuilder.prototype.getLocal = function (name) {
            if (name == expression_converter_1.EventHandlerVars.event.name) {
                return expression_converter_1.EventHandlerVars.event;
            }
            var currViewExpr = VIEW_VAR;
            for (var currBuilder = this; currBuilder; currBuilder = currBuilder.parent,
                currViewExpr = currViewExpr.prop('parent').cast(o.DYNAMIC_TYPE)) {
                // check references
                var refNodeIndex = currBuilder.refNodeIndices[name];
                if (refNodeIndex != null) {
                    return o.importExpr(identifiers_1.Identifiers.nodeValue).callFn([currViewExpr, o.literal(refNodeIndex)]);
                }
                // check variables
                var varAst = currBuilder.variables.find(function (varAst) { return varAst.name === name; });
                if (varAst) {
                    var varValue = varAst.value || IMPLICIT_TEMPLATE_VAR;
                    return currViewExpr.prop('context').prop(varValue);
                }
            }
            return null;
        };
        ViewBuilder.prototype.notifyImplicitReceiverUse = function () {
            // Not needed in ViewEngine as ViewEngine walks through the generated
            // expressions to figure out if the implicit receiver is used and needs
            // to be generated as part of the pre-update statements.
        };
        ViewBuilder.prototype.maybeRestoreView = function () {
            // Not necessary in ViewEngine, because view restoration is an Ivy concept.
        };
        ViewBuilder.prototype._createLiteralArrayConverter = function (sourceSpan, argCount) {
            if (argCount === 0) {
                var valueExpr_1 = o.importExpr(identifiers_1.Identifiers.EMPTY_ARRAY);
                return function () { return valueExpr_1; };
            }
            var checkIndex = this.nodes.length;
            this.nodes.push(function () { return ({
                sourceSpan: sourceSpan,
                nodeFlags: 32 /* TypePureArray */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.pureArrayDef).callFn([
                    o.literal(checkIndex),
                    o.literal(argCount),
                ])
            }); });
            return function (args) { return callCheckStmt(checkIndex, args); };
        };
        ViewBuilder.prototype._createLiteralMapConverter = function (sourceSpan, keys) {
            if (keys.length === 0) {
                var valueExpr_2 = o.importExpr(identifiers_1.Identifiers.EMPTY_MAP);
                return function () { return valueExpr_2; };
            }
            var map = o.literalMap(keys.map(function (e, i) { return ((0, tslib_1.__assign)((0, tslib_1.__assign)({}, e), { value: o.literal(i) })); }));
            var checkIndex = this.nodes.length;
            this.nodes.push(function () { return ({
                sourceSpan: sourceSpan,
                nodeFlags: 64 /* TypePureObject */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.pureObjectDef).callFn([
                    o.literal(checkIndex),
                    map,
                ])
            }); });
            return function (args) { return callCheckStmt(checkIndex, args); };
        };
        ViewBuilder.prototype._createPipeConverter = function (expression, name, argCount) {
            var pipe = this.usedPipes.find(function (pipeSummary) { return pipeSummary.name === name; });
            if (pipe.pure) {
                var checkIndex_1 = this.nodes.length;
                this.nodes.push(function () { return ({
                    sourceSpan: expression.sourceSpan,
                    nodeFlags: 128 /* TypePurePipe */,
                    nodeDef: o.importExpr(identifiers_1.Identifiers.purePipeDef).callFn([
                        o.literal(checkIndex_1),
                        o.literal(argCount),
                    ])
                }); });
                // find underlying pipe in the component view
                var compViewExpr = VIEW_VAR;
                var compBuilder = this;
                while (compBuilder.parent) {
                    compBuilder = compBuilder.parent;
                    compViewExpr = compViewExpr.prop('parent').cast(o.DYNAMIC_TYPE);
                }
                var pipeNodeIndex = compBuilder.purePipeNodeIndices[name];
                var pipeValueExpr_1 = o.importExpr(identifiers_1.Identifiers.nodeValue).callFn([compViewExpr, o.literal(pipeNodeIndex)]);
                return function (args) { return callCheckStmt(checkIndex_1, [pipeValueExpr_1].concat(args)); };
            }
            else {
                var nodeIndex = this._createPipe(expression.sourceSpan, pipe);
                var nodeValueExpr_1 = o.importExpr(identifiers_1.Identifiers.nodeValue).callFn([VIEW_VAR, o.literal(nodeIndex)]);
                return function (args) { return nodeValueExpr_1.prop('transform').callFn(args); };
            }
        };
        ViewBuilder.prototype._createPipe = function (sourceSpan, pipe) {
            var _this = this;
            var nodeIndex = this.nodes.length;
            var flags = 0 /* None */;
            pipe.type.lifecycleHooks.forEach(function (lifecycleHook) {
                // for pipes, we only support ngOnDestroy
                if (lifecycleHook === lifecycle_reflector_1.LifecycleHooks.OnDestroy) {
                    flags |= (0, provider_compiler_1.lifecycleHookToNodeFlag)(lifecycleHook);
                }
            });
            var depExprs = pipe.type.diDeps.map(function (diDep) { return (0, provider_compiler_1.depDef)(_this.outputCtx, diDep); });
            // function pipeDef(
            //   flags: NodeFlags, ctor: any, deps: ([DepFlags, any] | any)[]): NodeDef
            this.nodes.push(function () { return ({
                sourceSpan: sourceSpan,
                nodeFlags: 16 /* TypePipe */,
                nodeDef: o.importExpr(identifiers_1.Identifiers.pipeDef).callFn([
                    o.literal(flags), _this.outputCtx.importExpr(pipe.type.reference), o.literalArr(depExprs)
                ])
            }); });
            return nodeIndex;
        };
        /**
         * For the AST in `UpdateExpression.value`:
         * - create nodes for pipes, literal arrays and, literal maps,
         * - update the AST to replace pipes, literal arrays and, literal maps with calls to check fn.
         *
         * WARNING: This might create new nodeDefs (for pipes and literal arrays and literal maps)!
         */
        ViewBuilder.prototype._preprocessUpdateExpression = function (expression) {
            var _this = this;
            return {
                nodeIndex: expression.nodeIndex,
                bindingIndex: expression.bindingIndex,
                sourceSpan: expression.sourceSpan,
                context: expression.context,
                value: (0, expression_converter_1.convertPropertyBindingBuiltins)({
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
        ViewBuilder.prototype._createNodeExpressions = function () {
            var self = this;
            var updateBindingCount = 0;
            var updateRendererStmts = [];
            var updateDirectivesStmts = [];
            var nodeDefExprs = this.nodes.map(function (factory, nodeIndex) {
                var _a = factory(), nodeDef = _a.nodeDef, nodeFlags = _a.nodeFlags, updateDirectives = _a.updateDirectives, updateRenderer = _a.updateRenderer, sourceSpan = _a.sourceSpan;
                if (updateRenderer) {
                    updateRendererStmts.push.apply(updateRendererStmts, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(createUpdateStatements(nodeIndex, sourceSpan, updateRenderer, false)), false));
                }
                if (updateDirectives) {
                    updateDirectivesStmts.push.apply(updateDirectivesStmts, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(createUpdateStatements(nodeIndex, sourceSpan, updateDirectives, (nodeFlags & (262144 /* DoCheck */ | 65536 /* OnInit */)) > 0)), false));
                }
                // We use a comma expression to call the log function before
                // the nodeDef function, but still use the result of the nodeDef function
                // as the value.
                // Note: We only add the logger to elements / text nodes,
                // so we don't generate too much code.
                var logWithNodeDef = nodeFlags & 3 /* CatRenderNode */ ?
                    new o.CommaExpr([LOG_VAR.callFn([]).callFn([]), nodeDef]) :
                    nodeDef;
                return o.applySourceSpanToExpressionIfNeeded(logWithNodeDef, sourceSpan);
            });
            return { updateRendererStmts: updateRendererStmts, updateDirectivesStmts: updateDirectivesStmts, nodeDefExprs: nodeDefExprs };
            function createUpdateStatements(nodeIndex, sourceSpan, expressions, allowEmptyExprs) {
                var updateStmts = [];
                var exprs = expressions.map(function (_a) {
                    var sourceSpan = _a.sourceSpan, context = _a.context, value = _a.value;
                    var bindingId = "" + updateBindingCount++;
                    var nameResolver = context === COMP_VAR ? self : null;
                    var _b = (0, expression_converter_1.convertPropertyBinding)(nameResolver, context, value, bindingId, expression_converter_1.BindingForm.General), stmts = _b.stmts, currValExpr = _b.currValExpr;
                    updateStmts.push.apply(updateStmts, (0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(stmts.map(function (stmt) { return o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan); })), false));
                    return o.applySourceSpanToExpressionIfNeeded(currValExpr, sourceSpan);
                });
                if (expressions.length || allowEmptyExprs) {
                    updateStmts.push(o.applySourceSpanToStatementIfNeeded(callCheckStmt(nodeIndex, exprs).toStmt(), sourceSpan));
                }
                return updateStmts;
            }
        };
        ViewBuilder.prototype._createElementHandleEventFn = function (nodeIndex, handlers) {
            var _this = this;
            var handleEventStmts = [];
            var handleEventBindingCount = 0;
            handlers.forEach(function (_a) {
                var context = _a.context, eventAst = _a.eventAst, dirAst = _a.dirAst;
                var bindingId = "" + handleEventBindingCount++;
                var nameResolver = context === COMP_VAR ? _this : null;
                var _b = (0, expression_converter_1.convertActionBinding)(nameResolver, context, eventAst.handler, bindingId), stmts = _b.stmts, allowDefault = _b.allowDefault;
                var trueStmts = stmts;
                if (allowDefault) {
                    trueStmts.push(ALLOW_DEFAULT_VAR.set(allowDefault.and(ALLOW_DEFAULT_VAR)).toStmt());
                }
                var _c = elementEventNameAndTarget(eventAst, dirAst), eventTarget = _c.target, eventName = _c.name;
                var fullEventName = elementEventFullName(eventTarget, eventName);
                handleEventStmts.push(o.applySourceSpanToStatementIfNeeded(new o.IfStmt(o.literal(fullEventName).identical(EVENT_NAME_VAR), trueStmts), eventAst.sourceSpan));
            });
            var handleEventFn;
            if (handleEventStmts.length > 0) {
                var preStmts = [ALLOW_DEFAULT_VAR.set(o.literal(true)).toDeclStmt(o.BOOL_TYPE)];
                if (!this.component.isHost && o.findReadVarNames(handleEventStmts).has(COMP_VAR.name)) {
                    preStmts.push(COMP_VAR.set(VIEW_VAR.prop('component')).toDeclStmt(this.compType));
                }
                handleEventFn = o.fn([
                    new o.FnParam(VIEW_VAR.name, o.INFERRED_TYPE),
                    new o.FnParam(EVENT_NAME_VAR.name, o.INFERRED_TYPE),
                    new o.FnParam(expression_converter_1.EventHandlerVars.event.name, o.INFERRED_TYPE)
                ], (0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)((0, tslib_1.__spreadArray)([], (0, tslib_1.__read)(preStmts), false), (0, tslib_1.__read)(handleEventStmts), false), [new o.ReturnStatement(ALLOW_DEFAULT_VAR)], false), o.INFERRED_TYPE);
            }
            else {
                handleEventFn = o.NULL_EXPR;
            }
            return handleEventFn;
        };
        ViewBuilder.prototype.visitDirective = function (ast, context) { };
        ViewBuilder.prototype.visitDirectiveProperty = function (ast, context) { };
        ViewBuilder.prototype.visitReference = function (ast, context) { };
        ViewBuilder.prototype.visitVariable = function (ast, context) { };
        ViewBuilder.prototype.visitEvent = function (ast, context) { };
        ViewBuilder.prototype.visitElementProperty = function (ast, context) { };
        ViewBuilder.prototype.visitAttr = function (ast, context) { };
        return ViewBuilder;
    }());
    function needsAdditionalRootNode(astNodes) {
        var lastAstNode = astNodes[astNodes.length - 1];
        if (lastAstNode instanceof template_ast_1.EmbeddedTemplateAst) {
            return lastAstNode.hasViewContainer;
        }
        if (lastAstNode instanceof template_ast_1.ElementAst) {
            if ((0, tags_1.isNgContainer)(lastAstNode.name) && lastAstNode.children.length) {
                return needsAdditionalRootNode(lastAstNode.children);
            }
            return lastAstNode.hasViewContainer;
        }
        return lastAstNode instanceof template_ast_1.NgContentAst;
    }
    function elementBindingDef(inputAst, dirAst) {
        var inputType = inputAst.type;
        switch (inputType) {
            case 1 /* Attribute */:
                return o.literalArr([
                    o.literal(1 /* TypeElementAttribute */), o.literal(inputAst.name),
                    o.literal(inputAst.securityContext)
                ]);
            case 0 /* Property */:
                return o.literalArr([
                    o.literal(8 /* TypeProperty */), o.literal(inputAst.name),
                    o.literal(inputAst.securityContext)
                ]);
            case 4 /* Animation */:
                var bindingType = 8 /* TypeProperty */ |
                    (dirAst && dirAst.directive.isComponent ? 32 /* SyntheticHostProperty */ :
                        16 /* SyntheticProperty */);
                return o.literalArr([
                    o.literal(bindingType), o.literal('@' + inputAst.name), o.literal(inputAst.securityContext)
                ]);
            case 2 /* Class */:
                return o.literalArr([o.literal(2 /* TypeElementClass */), o.literal(inputAst.name), o.NULL_EXPR]);
            case 3 /* Style */:
                return o.literalArr([
                    o.literal(4 /* TypeElementStyle */), o.literal(inputAst.name), o.literal(inputAst.unit)
                ]);
            default:
                // This default case is not needed by TypeScript compiler, as the switch is exhaustive.
                // However Closure Compiler does not understand that and reports an error in typed mode.
                // The `throw new Error` below works around the problem, and the unexpected: never variable
                // makes sure tsc still checks this code is unreachable.
                var unexpected = inputType;
                throw new Error("unexpected " + unexpected);
        }
    }
    function fixedAttrsDef(elementAst) {
        var mapResult = Object.create(null);
        elementAst.attrs.forEach(function (attrAst) {
            mapResult[attrAst.name] = attrAst.value;
        });
        elementAst.directives.forEach(function (dirAst) {
            Object.keys(dirAst.directive.hostAttributes).forEach(function (name) {
                var value = dirAst.directive.hostAttributes[name];
                var prevValue = mapResult[name];
                mapResult[name] = prevValue != null ? mergeAttributeValue(name, prevValue, value) : value;
            });
        });
        // Note: We need to sort to get a defined output order
        // for tests and for caching generated artifacts...
        return o.literalArr(Object.keys(mapResult).sort().map(function (attrName) { return o.literalArr([o.literal(attrName), o.literal(mapResult[attrName])]); }));
    }
    function mergeAttributeValue(attrName, attrValue1, attrValue2) {
        if (attrName == CLASS_ATTR || attrName == STYLE_ATTR) {
            return attrValue1 + " " + attrValue2;
        }
        else {
            return attrValue2;
        }
    }
    function callCheckStmt(nodeIndex, exprs) {
        if (exprs.length > 10) {
            return CHECK_VAR.callFn([VIEW_VAR, o.literal(nodeIndex), o.literal(1 /* Dynamic */), o.literalArr(exprs)]);
        }
        else {
            return CHECK_VAR.callFn((0, tslib_1.__spreadArray)([VIEW_VAR, o.literal(nodeIndex), o.literal(0 /* Inline */)], (0, tslib_1.__read)(exprs), false));
        }
    }
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
    function calcQueryFlags(query) {
        var flags = 0 /* None */;
        // Note: We only make queries static that query for a single item and the user specifically
        // set the to be static. This is because of backwards compatibility with the old view compiler...
        if (query.first && query.static) {
            flags |= 268435456 /* StaticQuery */;
        }
        else {
            flags |= 536870912 /* DynamicQuery */;
        }
        if (query.emitDistinctChangesOnly) {
            flags |= -2147483648 /* EmitDistinctChangesOnly */;
        }
        return flags;
    }
    function elementEventFullName(target, name) {
        return target ? target + ":" + name : name;
    }
    exports.elementEventFullName = elementEventFullName;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy92aWV3X2NvbXBpbGVyL3ZpZXdfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUF3SjtJQUV4SixpR0FBbU07SUFFbk0sbURBQW9JO0lBRXBJLGlFQUEyQztJQUMzQyxpRkFBc0Q7SUFDdEQsNkRBQWdEO0lBQ2hELDJEQUEwQztJQUMxQyxzRUFBNkQ7SUFFN0QsbUZBQTJVO0lBRTNVLDJGQUFzSDtJQUV0SCxJQUFNLFVBQVUsR0FBRyxPQUFPLENBQUM7SUFDM0IsSUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDO0lBQzNCLElBQU0scUJBQXFCLEdBQUcsV0FBVyxDQUFDO0lBRTFDO1FBQ0UsMkJBQW1CLFlBQW9CLEVBQVMsZUFBdUI7WUFBcEQsaUJBQVksR0FBWixZQUFZLENBQVE7WUFBUyxvQkFBZSxHQUFmLGVBQWUsQ0FBUTtRQUFHLENBQUM7UUFDN0Usd0JBQUM7SUFBRCxDQUFDLEFBRkQsSUFFQztJQUZZLDhDQUFpQjtJQUk5QjtRQUNFLHNCQUFvQixVQUE0QjtZQUE1QixlQUFVLEdBQVYsVUFBVSxDQUFrQjtRQUFHLENBQUM7UUFFcEQsdUNBQWdCLEdBQWhCLFVBQ0ksU0FBd0IsRUFBRSxTQUFtQyxFQUFFLFFBQXVCLEVBQ3RGLE1BQW9CLEVBQUUsU0FBK0I7O1lBRnpELGlCQXlDQztZQXRDQyxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztZQUUxQixJQUFJLHNCQUFzQixHQUFXLFNBQVUsQ0FBQztZQUNoRCxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRTtnQkFDckIsSUFBTSxVQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVUsQ0FBQztnQkFDdEMsSUFBTSxnQkFBZ0IsR0FBd0IsRUFBRSxDQUFDO2dCQUNqRCxJQUFJ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QUMsTUFBTSw2QkFDbEIsUUFBUSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sZ0JBQXFCLHVCQUFLLEtBQUssVUFBRSxDQUFDO1NBQ2pGO0lBQ0gsQ0FBQztJQUVELFNBQVMseUJBQXlCLENBQzlCLFFBQXVCLEVBQUUsTUFBeUI7UUFDcEQsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFO1lBQ3hCLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLE1BQUksUUFBUSxDQUFDLElBQUksU0FBSSxRQUFRLENBQUMsS0FBTztnQkFDM0MsTUFBTSxFQUFFLE1BQU0sSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJO2FBQ3BFLENBQUM7U0FDSDthQUFNO1lBQ0wsT0FBTyxRQUFRLENBQUM7U0FDakI7SUFDSCxDQUFDO0lBRUQsU0FBUyxjQUFjLENBQUMsS0FBMkI7UUFDakQsSUFBSSxLQUFLLGVBQWlCLENBQUM7UUFDM0IsMkZBQTJGO1FBQzNGLGlHQUFpRztRQUNqRyxJQUFJLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUMvQixLQUFLLCtCQUF5QixDQUFDO1NBQ2hDO2FBQU07WUFDTCxLQUFLLGdDQUEwQixDQUFDO1NBQ2pDO1FBQ0QsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUU7WUFDakMsS0FBSyw2Q0FBcUMsQ0FBQztTQUM1QztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELFNBQWdCLG9CQUFvQixDQUFDLE1BQW1CLEVBQUUsSUFBWTtRQUNwRSxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUksTUFBTSxTQUFJLElBQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzdDLENBQUM7SUFGRCxvREFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSwgQ29tcGlsZVBpcGVTdW1tYXJ5LCBDb21waWxlUXVlcnlNZXRhZGF0YSwgcmVuZGVyZXJUeXBlTmFtZSwgdG9rZW5SZWZlcmVuY2UsIHZpZXdDbGFzc05hbWV9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluQ29udmVydGVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zLCBFdmVudEhhbmRsZXJWYXJzLCBMb2NhbFJlc29sdmVyfSBmcm9tICcuLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7T3V0cHV0Q29udGV4dH0gZnJvbSAnLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0FyZ3VtZW50VHlwZSwgQmluZGluZ0ZsYWdzLCBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgTm9kZUZsYWdzLCBRdWVyeUJpbmRpbmdUeXBlLCBRdWVyeVZhbHVlVHlwZSwgVmlld0ZsYWdzfSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi4vaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtMaWZlY3ljbGVIb29rc30gZnJvbSAnLi4vbGlmZWN5Y2xlX3JlZmxlY3Rvcic7XG5pbXBvcnQge2lzTmdDb250YWluZXJ9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjb252ZXJ0VmFsdWVUb091dHB1dEFzdH0gZnJvbSAnLi4vb3V0cHV0L3ZhbHVlX3V0aWwnO1xuaW1wb3J0IHtQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtBdHRyQXN0LCBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgQm91bmRFdmVudEFzdCwgQm91bmRUZXh0QXN0LCBEaXJlY3RpdmVBc3QsIEVsZW1lbnRBc3QsIEVtYmVkZGVkVGVtcGxhdGVBc3QsIE5nQ29udGVudEFzdCwgUHJvcGVydHlCaW5kaW5nVHlwZSwgUHJvdmlkZXJBc3QsIFF1ZXJ5TWF0Y2gsIFJlZmVyZW5jZUFzdCwgVGVtcGxhdGVBc3QsIFRlbXBsYXRlQXN0VmlzaXRvciwgdGVtcGxhdGVWaXNpdEFsbCwgVGV4dEFzdCwgVmFyaWFibGVBc3R9IGZyb20gJy4uL3RlbXBsYXRlX3BhcnNlci90ZW1wbGF0ZV9hc3QnO1xuXG5pbXBvcnQge2NvbXBvbmVudEZhY3RvcnlSZXNvbHZlclByb3ZpZGVyRGVmLCBkZXBEZWYsIGxpZmVjeWNsZUhvb2tUb05vZGVGbGFnLCBwcm92aWRlckRlZn0gZnJvbSAnLi9wcm92aWRlcl9jb21waWxlcic7XG5cbmNvbnN0IENMQVNTX0FUVFIgPSAnY2xhc3MnO1xuY29uc3QgU1RZTEVfQVRUUiA9ICdzdHlsZSc7XG5jb25zdCBJTVBMSUNJVF9URU1QTEFURV9WQVIgPSAnJGltcGxpY2l0JztcblxuZXhwb3J0IGNsYXNzIFZpZXdDb21waWxlUmVzdWx0IHtcbiAgY29uc3RydWN0b3IocHVibGljIHZpZXdDbGFzc1Zhcjogc3RyaW5nLCBwdWJsaWMgcmVuZGVyZXJUeXBlVmFyOiBzdHJpbmcpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3Q29tcGlsZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHt9XG5cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgY29tcG9uZW50OiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIHRlbXBsYXRlOiBUZW1wbGF0ZUFzdFtdLFxuICAgICAgc3R5bGVzOiBvLkV4cHJlc3Npb24sIHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10pOiBWaWV3Q29tcGlsZVJlc3VsdCB7XG4gICAgbGV0IGVtYmVkZGVkVmlld0NvdW50ID0gMDtcblxuICAgIGxldCByZW5kZXJDb21wb25lbnRWYXJOYW1lOiBzdHJpbmcgPSB1bmRlZmluZWQhO1xuICAgIGlmICghY29tcG9uZW50LmlzSG9zdCkge1xuICAgICAgY29uc3QgdGVtcGxhdGUgPSBjb21wb25lbnQudGVtcGxhdGUgITtcbiAgICAgIGNvbnN0IGN1c3RvbVJlbmRlckRhdGE6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgICAgIGlmICh0ZW1wbGF0ZS5hbmltYXRpb25zICYmIHRlbXBsYXRlLmFuaW1hdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIGN1c3RvbVJlbmRlckRhdGEucHVzaChuZXcgby5MaXRlcmFsTWFwRW50cnkoXG4gICAgICAgICAgICAnYW5pbWF0aW9uJywgY29udmVydFZhbHVlVG9PdXRwdXRBc3Qob3V0cHV0Q3R4LCB0ZW1wbGF0ZS5hbmltYXRpb25zKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZW5kZXJDb21wb25lbnRWYXIgPSBvLnZhcmlhYmxlKHJlbmRlcmVyVHlwZU5hbWUoY29tcG9uZW50LnR5cGUucmVmZXJlbmNlKSk7XG4gICAgICByZW5kZXJDb21wb25lbnRWYXJOYW1lID0gcmVuZGVyQ29tcG9uZW50VmFyLm5hbWUhO1xuICAgICAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChcbiAgICAgICAgICByZW5kZXJDb21wb25lbnRWYXJcbiAgICAgICAgICAgICAgLnNldChvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuY3JlYXRlUmVuZGVyZXJUeXBlMikuY2FsbEZuKFtuZXcgby5MaXRlcmFsTWFwRXhwcihbXG4gICAgICAgICAgICAgICAgbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KCdlbmNhcHN1bGF0aW9uJywgby5saXRlcmFsKHRlbXBsYXRlLmVuY2Fwc3VsYXRpb24pLCBmYWxzZSksXG4gICAgICAgICAgICAgICAgbmV3IG8uTGl0ZXJhbE1hcEVudHJ5KCdzdHlsZXMnLCBzdHlsZXMsIGZhbHNlKSxcbiAgICAgICAgICAgICAgICBuZXcgby5MaXRlcmFsTWFwRW50cnkoJ2RhdGEnLCBuZXcgby5MaXRlcmFsTWFwRXhwcihjdXN0b21SZW5kZXJEYXRhKSwgZmFsc2UpXG4gICAgICAgICAgICAgIF0pXSkpXG4gICAgICAgICAgICAgIC50b0RlY2xTdG10KFxuICAgICAgICAgICAgICAgICAgby5pbXBvcnRUeXBlKElkZW50aWZpZXJzLlJlbmRlcmVyVHlwZTIpLFxuICAgICAgICAgICAgICAgICAgW28uU3RtdE1vZGlmaWVyLkZpbmFsLCBvLlN0bXRNb2RpZmllci5FeHBvcnRlZF0pKTtcbiAgICB9XG5cbiAgICBjb25zdCB2aWV3QnVpbGRlckZhY3RvcnkgPSAocGFyZW50OiBWaWV3QnVpbGRlcnxudWxsKTogVmlld0J1aWxkZXIgPT4ge1xuICAgICAgY29uc3QgZW1iZWRkZWRWaWV3SW5kZXggPSBlbWJlZGRlZFZpZXdDb3VudCsrO1xuICAgICAgcmV0dXJuIG5ldyBWaWV3QnVpbGRlcihcbiAgICAgICAgICB0aGlzLl9yZWZsZWN0b3IsIG91dHB1dEN0eCwgcGFyZW50LCBjb21wb25lbnQsIGVtYmVkZGVkVmlld0luZGV4LCB1c2VkUGlwZXMsXG4gICAgICAgICAgdmlld0J1aWxkZXJGYWN0b3J5KTtcbiAgICB9O1xuXG4gICAgY29uc3QgdmlzaXRvciA9IHZpZXdCdWlsZGVyRmFjdG9yeShudWxsKTtcbiAgICB2aXNpdG9yLnZpc2l0QWxsKFtdLCB0ZW1wbGF0ZSk7XG5cbiAgICBvdXRwdXRDdHguc3RhdGVtZW50cy5wdXNoKC4uLnZpc2l0b3IuYnVpbGQoKSk7XG5cbiAgICByZXR1cm4gbmV3IFZpZXdDb21waWxlUmVzdWx0KHZpc2l0b3Iudmlld05hbWUsIHJlbmRlckNvbXBvbmVudFZhck5hbWUpO1xuICB9XG59XG5cbmludGVyZmFjZSBWaWV3QnVpbGRlckZhY3Rvcnkge1xuICAocGFyZW50OiBWaWV3QnVpbGRlcik6IFZpZXdCdWlsZGVyO1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlRXhwcmVzc2lvbiB7XG4gIGNvbnRleHQ6IG8uRXhwcmVzc2lvbjtcbiAgbm9kZUluZGV4OiBudW1iZXI7XG4gIGJpbmRpbmdJbmRleDogbnVtYmVyO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW47XG4gIHZhbHVlOiBBU1Q7XG59XG5cbmNvbnN0IExPR19WQVIgPSBvLnZhcmlhYmxlKCdfbCcpO1xuY29uc3QgVklFV19WQVIgPSBvLnZhcmlhYmxlKCdfdicpO1xuY29uc3QgQ0hFQ0tfVkFSID0gby52YXJpYWJsZSgnX2NrJyk7XG5jb25zdCBDT01QX1ZBUiA9IG8udmFyaWFibGUoJ19jbycpO1xuY29uc3QgRVZFTlRfTkFNRV9WQVIgPSBvLnZhcmlhYmxlKCdlbicpO1xuY29uc3QgQUxMT1dfREVGQVVMVF9WQVIgPSBvLnZhcmlhYmxlKGBhZGApO1xuXG5jbGFzcyBWaWV3QnVpbGRlciBpbXBsZW1lbnRzIFRlbXBsYXRlQXN0VmlzaXRvciwgTG9jYWxSZXNvbHZlciB7XG4gIHByaXZhdGUgY29tcFR5cGU6IG8uVHlwZTtcbiAgcHJpdmF0ZSBub2RlczogKCgpID0+IHtcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLFxuICAgIG5vZGVEZWY6IG8uRXhwcmVzc2lvbixcbiAgICBub2RlRmxhZ3M6IE5vZGVGbGFncyxcbiAgICB1cGRhdGVEaXJlY3RpdmVzPzogVXBkYXRlRXhwcmVzc2lvbltdLFxuICAgIHVwZGF0ZVJlbmRlcmVyPzogVXBkYXRlRXhwcmVzc2lvbltdXG4gIH0pW10gPSBbXTtcbiAgcHJpdmF0ZSBwdXJlUGlwZU5vZGVJbmRpY2VzOiB7W3BpcGVOYW1lOiBzdHJpbmddOiBudW1iZXJ9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgLy8gTmVlZCBPYmplY3QuY3JlYXRlIHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSBidWlsdGluIHZhbHVlcy4uLlxuICBwcml2YXRlIHJlZk5vZGVJbmRpY2VzOiB7W3JlZk5hbWU6IHN0cmluZ106IG51bWJlcn0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBwcml2YXRlIHZhcmlhYmxlczogVmFyaWFibGVBc3RbXSA9IFtdO1xuICBwcml2YXRlIGNoaWxkcmVuOiBWaWV3QnVpbGRlcltdID0gW107XG5cbiAgcHVibGljIHJlYWRvbmx5IHZpZXdOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvciwgcHJpdmF0ZSBvdXRwdXRDdHg6IE91dHB1dENvbnRleHQsXG4gICAgICBwcml2YXRlIHBhcmVudDogVmlld0J1aWxkZXJ8bnVsbCwgcHJpdmF0ZSBjb21wb25lbnQ6IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSxcbiAgICAgIHByaXZhdGUgZW1iZWRkZWRWaWV3SW5kZXg6IG51bWJlciwgcHJpdmF0ZSB1c2VkUGlwZXM6IENvbXBpbGVQaXBlU3VtbWFyeVtdLFxuICAgICAgcHJpdmF0ZSB2aWV3QnVpbGRlckZhY3Rvcnk6IFZpZXdCdWlsZGVyRmFjdG9yeSkge1xuICAgIC8vIFRPRE8odGJvc2NoKTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAvLyBmb3IgdGhlIGNvbnRleHQgaW4gYW55IGVtYmVkZGVkIHZpZXcuIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBmb3Igbm93XG4gICAgLy8gdG8gYmUgYWJsZSB0byBpbnRyb2R1Y2UgdGhlIG5ldyB2aWV3IGNvbXBpbGVyIHdpdGhvdXQgdG9vIG1hbnkgZXJyb3JzLlxuICAgIHRoaXMuY29tcFR5cGUgPSB0aGlzLmVtYmVkZGVkVmlld0luZGV4ID4gMCA/XG4gICAgICAgIG8uRFlOQU1JQ19UWVBFIDpcbiAgICAgICAgby5leHByZXNzaW9uVHlwZShvdXRwdXRDdHguaW1wb3J0RXhwcih0aGlzLmNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSkpITtcbiAgICB0aGlzLnZpZXdOYW1lID0gdmlld0NsYXNzTmFtZSh0aGlzLmNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSwgdGhpcy5lbWJlZGRlZFZpZXdJbmRleCk7XG4gIH1cblxuICB2aXNpdEFsbCh2YXJpYWJsZXM6IFZhcmlhYmxlQXN0W10sIGFzdE5vZGVzOiBUZW1wbGF0ZUFzdFtdKSB7XG4gICAgdGhpcy52YXJpYWJsZXMgPSB2YXJpYWJsZXM7XG4gICAgLy8gY3JlYXRlIHRoZSBwaXBlcyBmb3IgdGhlIHB1cmUgcGlwZXMgaW1tZWRpYXRlbHksIHNvIHRoYXQgd2Uga25vdyB0aGVpciBpbmRpY2VzLlxuICAgIGlmICghdGhpcy5wYXJlbnQpIHtcbiAgICAgIHRoaXMudXNlZFBpcGVzLmZvckVhY2goKHBpcGUpID0+IHtcbiAgICAgICAgaWYgKHBpcGUucHVyZSkge1xuICAgICAgICAgIHRoaXMucHVyZVBpcGVOb2RlSW5kaWNlc1twaXBlLm5hbWVdID0gdGhpcy5fY3JlYXRlUGlwZShudWxsLCBwaXBlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhcmVudCkge1xuICAgICAgdGhpcy5jb21wb25lbnQudmlld1F1ZXJpZXMuZm9yRWFjaCgocXVlcnksIHF1ZXJ5SW5kZXgpID0+IHtcbiAgICAgICAgLy8gTm90ZTogcXVlcmllcyBzdGFydCB3aXRoIGlkIDEgc28gd2UgY2FuIHVzZSB0aGUgbnVtYmVyIGluIGEgQmxvb20gZmlsdGVyIVxuICAgICAgICBjb25zdCBxdWVyeUlkID0gcXVlcnlJbmRleCArIDE7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdUeXBlID0gcXVlcnkuZmlyc3QgPyBRdWVyeUJpbmRpbmdUeXBlLkZpcnN0IDogUXVlcnlCaW5kaW5nVHlwZS5BbGw7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gTm9kZUZsYWdzLlR5cGVWaWV3UXVlcnkgfCBjYWxjUXVlcnlGbGFncyhxdWVyeSk7XG4gICAgICAgIHRoaXMubm9kZXMucHVzaCgoKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IGZsYWdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucXVlcnlEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKGZsYWdzKSwgby5saXRlcmFsKHF1ZXJ5SWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBvLkxpdGVyYWxNYXBFeHByKFtuZXcgby5MaXRlcmFsTWFwRW50cnkoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5LnByb3BlcnR5TmFtZSwgby5saXRlcmFsKGJpbmRpbmdUeXBlKSwgZmFsc2UpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0ZW1wbGF0ZVZpc2l0QWxsKHRoaXMsIGFzdE5vZGVzKTtcbiAgICBpZiAodGhpcy5wYXJlbnQgJiYgKGFzdE5vZGVzLmxlbmd0aCA9PT0gMCB8fCBuZWVkc0FkZGl0aW9uYWxSb290Tm9kZShhc3ROb2RlcykpKSB7XG4gICAgICAvLyBpZiB0aGUgdmlldyBpcyBhbiBlbWJlZGRlZCB2aWV3LCB0aGVuIHdlIG5lZWQgdG8gYWRkIGFuIGFkZGl0aW9uYWwgcm9vdCBub2RlIGluIHNvbWUgY2FzZXNcbiAgICAgIHRoaXMubm9kZXMucHVzaCgoKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlU3BhbjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVGbGFnczogTm9kZUZsYWdzLlR5cGVFbGVtZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZURlZjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmFuY2hvckRlZikuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKE5vZGVGbGFncy5Ob25lKSwgby5OVUxMX0VYUFIsIG8uTlVMTF9FWFBSLCBvLmxpdGVyYWwoMClcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgIH1cbiAgfVxuXG4gIGJ1aWxkKHRhcmdldFN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXSk6IG8uU3RhdGVtZW50W10ge1xuICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IGNoaWxkLmJ1aWxkKHRhcmdldFN0YXRlbWVudHMpKTtcblxuICAgIGNvbnN0IHt1cGRhdGVSZW5kZXJlclN0bXRzLCB1cGRhdGVEaXJlY3RpdmVzU3RtdHMsIG5vZGVEZWZFeHByc30gPVxuICAgICAgICB0aGlzLl9jcmVhdGVOb2RlRXhwcmVzc2lvbnMoKTtcblxuICAgIGNvbnN0IHVwZGF0ZVJlbmRlcmVyRm4gPSB0aGlzLl9jcmVhdGVVcGRhdGVGbih1cGRhdGVSZW5kZXJlclN0bXRzKTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmVzRm4gPSB0aGlzLl9jcmVhdGVVcGRhdGVGbih1cGRhdGVEaXJlY3RpdmVzU3RtdHMpO1xuXG5cbiAgICBsZXQgdmlld0ZsYWdzID0gVmlld0ZsYWdzLk5vbmU7XG4gICAgaWYgKCF0aGlzLnBhcmVudCAmJiB0aGlzLmNvbXBvbmVudC5jaGFuZ2VEZXRlY3Rpb24gPT09IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaCkge1xuICAgICAgdmlld0ZsYWdzIHw9IFZpZXdGbGFncy5PblB1c2g7XG4gICAgfVxuICAgIGNvbnN0IHZpZXdGYWN0b3J5ID0gbmV3IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdChcbiAgICAgICAgdGhpcy52aWV3TmFtZSwgW25ldyBvLkZuUGFyYW0oTE9HX1ZBUi5uYW1lISldLFxuICAgICAgICBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy52aWV3RGVmKS5jYWxsRm4oW1xuICAgICAgICAgIG8ubGl0ZXJhbCh2aWV3RmxhZ3MpLFxuICAgICAgICAgIG8ubGl0ZXJhbEFycihub2RlRGVmRXhwcnMpLFxuICAgICAgICAgIHVwZGF0ZURpcmVjdGl2ZXNGbixcbiAgICAgICAgICB1cGRhdGVSZW5kZXJlckZuLFxuICAgICAgICBdKSldLFxuICAgICAgICBvLmltcG9ydFR5cGUoSWRlbnRpZmllcnMuVmlld0RlZmluaXRpb24pLFxuICAgICAgICB0aGlzLmVtYmVkZGVkVmlld0luZGV4ID09PSAwID8gW28uU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSA6IFtdKTtcblxuICAgIHRhcmdldFN0YXRlbWVudHMucHVzaCh2aWV3RmFjdG9yeSk7XG4gICAgcmV0dXJuIHRhcmdldFN0YXRlbWVudHM7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVVcGRhdGVGbih1cGRhdGVTdG10czogby5TdGF0ZW1lbnRbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgbGV0IHVwZGF0ZUZuOiBvLkV4cHJlc3Npb247XG4gICAgaWYgKHVwZGF0ZVN0bXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHByZVN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgICBpZiAoIXRoaXMuY29tcG9uZW50LmlzSG9zdCAmJiBvLmZpbmRSZWFkVmFyTmFtZXModXBkYXRlU3RtdHMpLmhhcyhDT01QX1ZBUi5uYW1lISkpIHtcbiAgICAgICAgcHJlU3RtdHMucHVzaChDT01QX1ZBUi5zZXQoVklFV19WQVIucHJvcCgnY29tcG9uZW50JykpLnRvRGVjbFN0bXQodGhpcy5jb21wVHlwZSkpO1xuICAgICAgfVxuICAgICAgdXBkYXRlRm4gPSBvLmZuKFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIG5ldyBvLkZuUGFyYW0oQ0hFQ0tfVkFSLm5hbWUhLCBvLklORkVSUkVEX1RZUEUpLFxuICAgICAgICAgICAgbmV3IG8uRm5QYXJhbShWSUVXX1ZBUi5uYW1lISwgby5JTkZFUlJFRF9UWVBFKVxuICAgICAgICAgIF0sXG4gICAgICAgICAgWy4uLnByZVN0bXRzLCAuLi51cGRhdGVTdG10c10sIG8uSU5GRVJSRURfVFlQRSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZUZuID0gby5OVUxMX0VYUFI7XG4gICAgfVxuICAgIHJldHVybiB1cGRhdGVGbjtcbiAgfVxuXG4gIHZpc2l0TmdDb250ZW50KGFzdDogTmdDb250ZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIC8vIG5nQ29udGVudERlZihuZ0NvbnRlbnRJbmRleDogbnVtYmVyLCBpbmRleDogbnVtYmVyKTogTm9kZURlZjtcbiAgICB0aGlzLm5vZGVzLnB1c2goKCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBhc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlTmdDb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgIG5vZGVEZWY6IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5uZ0NvbnRlbnREZWYpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW28ubGl0ZXJhbChhc3QubmdDb250ZW50SW5kZXgpLCBvLmxpdGVyYWwoYXN0LmluZGV4KV0pXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgfVxuXG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgLy8gU3RhdGljIHRleHQgbm9kZXMgaGF2ZSBubyBjaGVjayBmdW5jdGlvblxuICAgIGNvbnN0IGNoZWNrSW5kZXggPSAtMTtcbiAgICB0aGlzLm5vZGVzLnB1c2goKCkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBhc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlVGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMudGV4dERlZikuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChjaGVja0luZGV4KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChhc3QubmdDb250ZW50SW5kZXgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwoYXN0LnZhbHVlKV0pLFxuICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMubm9kZXMubGVuZ3RoO1xuICAgIC8vIHJlc2VydmUgdGhlIHNwYWNlIGluIHRoZSBub2RlRGVmcyBhcnJheVxuICAgIHRoaXMubm9kZXMucHVzaChudWxsISk7XG5cbiAgICBjb25zdCBhc3RXaXRoU291cmNlID0gPEFTVFdpdGhTb3VyY2U+YXN0LnZhbHVlO1xuICAgIGNvbnN0IGludGVyID0gPEludGVycG9sYXRpb24+YXN0V2l0aFNvdXJjZS5hc3Q7XG5cbiAgICBjb25zdCB1cGRhdGVSZW5kZXJlckV4cHJlc3Npb25zID0gaW50ZXIuZXhwcmVzc2lvbnMubWFwKFxuICAgICAgICAoZXhwciwgYmluZGluZ0luZGV4KSA9PiB0aGlzLl9wcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihcbiAgICAgICAgICAgIHtub2RlSW5kZXgsIGJpbmRpbmdJbmRleCwgc291cmNlU3BhbjogYXN0LnNvdXJjZVNwYW4sIGNvbnRleHQ6IENPTVBfVkFSLCB2YWx1ZTogZXhwcn0pKTtcblxuICAgIC8vIENoZWNrIGluZGV4IGlzIHRoZSBzYW1lIGFzIHRoZSBub2RlIGluZGV4IGR1cmluZyBjb21waWxhdGlvblxuICAgIC8vIFRoZXkgbWlnaHQgb25seSBkaWZmZXIgYXQgcnVudGltZVxuICAgIGNvbnN0IGNoZWNrSW5kZXggPSBub2RlSW5kZXg7XG5cbiAgICB0aGlzLm5vZGVzW25vZGVJbmRleF0gPSAoKSA9PiAoe1xuICAgICAgc291cmNlU3BhbjogYXN0LnNvdXJjZVNwYW4sXG4gICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlVGV4dCxcbiAgICAgIG5vZGVEZWY6IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy50ZXh0RGVmKS5jYWxsRm4oW1xuICAgICAgICBvLmxpdGVyYWwoY2hlY2tJbmRleCksXG4gICAgICAgIG8ubGl0ZXJhbChhc3QubmdDb250ZW50SW5kZXgpLFxuICAgICAgICBvLmxpdGVyYWxBcnIoaW50ZXIuc3RyaW5ncy5tYXAocyA9PiBvLmxpdGVyYWwocykpKSxcbiAgICAgIF0pLFxuICAgICAgdXBkYXRlUmVuZGVyZXI6IHVwZGF0ZVJlbmRlcmVyRXhwcmVzc2lvbnNcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RW1iZWRkZWRUZW1wbGF0ZShhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG4gICAgLy8gcmVzZXJ2ZSB0aGUgc3BhY2UgaW4gdGhlIG5vZGVEZWZzIGFycmF5XG4gICAgdGhpcy5ub2Rlcy5wdXNoKG51bGwhKTtcblxuICAgIGNvbnN0IHtmbGFncywgcXVlcnlNYXRjaGVzRXhwciwgaG9zdEV2ZW50c30gPSB0aGlzLl92aXNpdEVsZW1lbnRPclRlbXBsYXRlKG5vZGVJbmRleCwgYXN0KTtcblxuICAgIGNvbnN0IGNoaWxkVmlzaXRvciA9IHRoaXMudmlld0J1aWxkZXJGYWN0b3J5KHRoaXMpO1xuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZFZpc2l0b3IpO1xuICAgIGNoaWxkVmlzaXRvci52aXNpdEFsbChhc3QudmFyaWFibGVzLCBhc3QuY2hpbGRyZW4pO1xuXG4gICAgY29uc3QgY2hpbGRDb3VudCA9IHRoaXMubm9kZXMubGVuZ3RoIC0gbm9kZUluZGV4IC0gMTtcblxuICAgIC8vIGFuY2hvckRlZihcbiAgICAvLyAgIGZsYWdzOiBOb2RlRmxhZ3MsIG1hdGNoZWRRdWVyaWVzOiBbc3RyaW5nLCBRdWVyeVZhbHVlVHlwZV1bXSwgbmdDb250ZW50SW5kZXg6IG51bWJlcixcbiAgICAvLyAgIGNoaWxkQ291bnQ6IG51bWJlciwgaGFuZGxlRXZlbnRGbj86IEVsZW1lbnRIYW5kbGVFdmVudEZuLCB0ZW1wbGF0ZUZhY3Rvcnk/OlxuICAgIC8vICAgVmlld0RlZmluaXRpb25GYWN0b3J5KTogTm9kZURlZjtcbiAgICB0aGlzLm5vZGVzW25vZGVJbmRleF0gPSAoKSA9PiAoe1xuICAgICAgc291cmNlU3BhbjogYXN0LnNvdXJjZVNwYW4sXG4gICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlRWxlbWVudCB8IGZsYWdzLFxuICAgICAgbm9kZURlZjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmFuY2hvckRlZikuY2FsbEZuKFtcbiAgICAgICAgby5saXRlcmFsKGZsYWdzKSxcbiAgICAgICAgcXVlcnlNYXRjaGVzRXhwcixcbiAgICAgICAgby5saXRlcmFsKGFzdC5uZ0NvbnRlbnRJbmRleCksXG4gICAgICAgIG8ubGl0ZXJhbChjaGlsZENvdW50KSxcbiAgICAgICAgdGhpcy5fY3JlYXRlRWxlbWVudEhhbmRsZUV2ZW50Rm4obm9kZUluZGV4LCBob3N0RXZlbnRzKSxcbiAgICAgICAgby52YXJpYWJsZShjaGlsZFZpc2l0b3Iudmlld05hbWUpLFxuICAgICAgXSlcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChhc3Q6IEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgY29uc3Qgbm9kZUluZGV4ID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG4gICAgLy8gcmVzZXJ2ZSB0aGUgc3BhY2UgaW4gdGhlIG5vZGVEZWZzIGFycmF5IHNvIHdlIGNhbiBhZGQgY2hpbGRyZW5cbiAgICB0aGlzLm5vZGVzLnB1c2gobnVsbCEpO1xuXG4gICAgLy8gVXNpbmcgYSBudWxsIGVsZW1lbnQgbmFtZSBjcmVhdGVzIGFuIGFuY2hvci5cbiAgICBjb25zdCBlbE5hbWU6IHN0cmluZ3xudWxsID0gaXNOZ0NvbnRhaW5lcihhc3QubmFtZSkgPyBudWxsIDogYXN0Lm5hbWU7XG5cbiAgICBjb25zdCB7ZmxhZ3MsIHVzZWRFdmVudHMsIHF1ZXJ5TWF0Y2hlc0V4cHIsIGhvc3RCaW5kaW5nczogZGlySG9zdEJpbmRpbmdzLCBob3N0RXZlbnRzfSA9XG4gICAgICAgIHRoaXMuX3Zpc2l0RWxlbWVudE9yVGVtcGxhdGUobm9kZUluZGV4LCBhc3QpO1xuXG4gICAgbGV0IGlucHV0RGVmczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgdXBkYXRlUmVuZGVyZXJFeHByZXNzaW9uczogVXBkYXRlRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IG91dHB1dERlZnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgaWYgKGVsTmFtZSkge1xuICAgICAgY29uc3QgaG9zdEJpbmRpbmdzOiBhbnlbXSA9IGFzdC5pbnB1dHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoaW5wdXRBc3QpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBDT01QX1ZBUiBhcyBvLkV4cHJlc3Npb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpckFzdDogbnVsbCBhcyBhbnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jb25jYXQoZGlySG9zdEJpbmRpbmdzKTtcbiAgICAgIGlmIChob3N0QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgICAgIHVwZGF0ZVJlbmRlcmVyRXhwcmVzc2lvbnMgPVxuICAgICAgICAgICAgaG9zdEJpbmRpbmdzLm1hcCgoaG9zdEJpbmRpbmcsIGJpbmRpbmdJbmRleCkgPT4gdGhpcy5fcHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oe1xuICAgICAgICAgICAgICBjb250ZXh0OiBob3N0QmluZGluZy5jb250ZXh0LFxuICAgICAgICAgICAgICBub2RlSW5kZXgsXG4gICAgICAgICAgICAgIGJpbmRpbmdJbmRleCxcbiAgICAgICAgICAgICAgc291cmNlU3BhbjogaG9zdEJpbmRpbmcuaW5wdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgdmFsdWU6IGhvc3RCaW5kaW5nLmlucHV0QXN0LnZhbHVlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIGlucHV0RGVmcyA9IGhvc3RCaW5kaW5ncy5tYXAoXG4gICAgICAgICAgICBob3N0QmluZGluZyA9PiBlbGVtZW50QmluZGluZ0RlZihob3N0QmluZGluZy5pbnB1dEFzdCwgaG9zdEJpbmRpbmcuZGlyQXN0KSk7XG4gICAgICB9XG4gICAgICBvdXRwdXREZWZzID0gdXNlZEV2ZW50cy5tYXAoXG4gICAgICAgICAgKFt0YXJnZXQsIGV2ZW50TmFtZV0pID0+IG8ubGl0ZXJhbEFycihbby5saXRlcmFsKHRhcmdldCksIG8ubGl0ZXJhbChldmVudE5hbWUpXSkpO1xuICAgIH1cblxuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuKTtcblxuICAgIGNvbnN0IGNoaWxkQ291bnQgPSB0aGlzLm5vZGVzLmxlbmd0aCAtIG5vZGVJbmRleCAtIDE7XG5cbiAgICBjb25zdCBjb21wQXN0ID0gYXN0LmRpcmVjdGl2ZXMuZmluZChkaXJBc3QgPT4gZGlyQXN0LmRpcmVjdGl2ZS5pc0NvbXBvbmVudCk7XG4gICAgbGV0IGNvbXBSZW5kZXJlclR5cGUgPSBvLk5VTExfRVhQUiBhcyBvLkV4cHJlc3Npb247XG4gICAgbGV0IGNvbXBWaWV3ID0gby5OVUxMX0VYUFIgYXMgby5FeHByZXNzaW9uO1xuICAgIGlmIChjb21wQXN0KSB7XG4gICAgICBjb21wVmlldyA9IHRoaXMub3V0cHV0Q3R4LmltcG9ydEV4cHIoY29tcEFzdC5kaXJlY3RpdmUuY29tcG9uZW50Vmlld1R5cGUpO1xuICAgICAgY29tcFJlbmRlcmVyVHlwZSA9IHRoaXMub3V0cHV0Q3R4LmltcG9ydEV4cHIoY29tcEFzdC5kaXJlY3RpdmUucmVuZGVyZXJUeXBlKTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpbmRleCBpcyB0aGUgc2FtZSBhcyB0aGUgbm9kZSBpbmRleCBkdXJpbmcgY29tcGlsYXRpb25cbiAgICAvLyBUaGV5IG1pZ2h0IG9ubHkgZGlmZmVyIGF0IHJ1bnRpbWVcbiAgICBjb25zdCBjaGVja0luZGV4ID0gbm9kZUluZGV4O1xuXG4gICAgdGhpcy5ub2Rlc1tub2RlSW5kZXhdID0gKCkgPT4gKHtcbiAgICAgIHNvdXJjZVNwYW46IGFzdC5zb3VyY2VTcGFuLFxuICAgICAgbm9kZUZsYWdzOiBOb2RlRmxhZ3MuVHlwZUVsZW1lbnQgfCBmbGFncyxcbiAgICAgIG5vZGVEZWY6IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5lbGVtZW50RGVmKS5jYWxsRm4oW1xuICAgICAgICBvLmxpdGVyYWwoY2hlY2tJbmRleCksXG4gICAgICAgIG8ubGl0ZXJhbChmbGFncyksXG4gICAgICAgIHF1ZXJ5TWF0Y2hlc0V4cHIsXG4gICAgICAgIG8ubGl0ZXJhbChhc3QubmdDb250ZW50SW5kZXgpLFxuICAgICAgICBvLmxpdGVyYWwoY2hpbGRDb3VudCksXG4gICAgICAgIG8ubGl0ZXJhbChlbE5hbWUpLFxuICAgICAgICBlbE5hbWUgPyBmaXhlZEF0dHJzRGVmKGFzdCkgOiBvLk5VTExfRVhQUixcbiAgICAgICAgaW5wdXREZWZzLmxlbmd0aCA/IG8ubGl0ZXJhbEFycihpbnB1dERlZnMpIDogby5OVUxMX0VYUFIsXG4gICAgICAgIG91dHB1dERlZnMubGVuZ3RoID8gby5saXRlcmFsQXJyKG91dHB1dERlZnMpIDogby5OVUxMX0VYUFIsXG4gICAgICAgIHRoaXMuX2NyZWF0ZUVsZW1lbnRIYW5kbGVFdmVudEZuKG5vZGVJbmRleCwgaG9zdEV2ZW50cyksXG4gICAgICAgIGNvbXBWaWV3LFxuICAgICAgICBjb21wUmVuZGVyZXJUeXBlLFxuICAgICAgXSksXG4gICAgICB1cGRhdGVSZW5kZXJlcjogdXBkYXRlUmVuZGVyZXJFeHByZXNzaW9uc1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRFbGVtZW50T3JUZW1wbGF0ZShub2RlSW5kZXg6IG51bWJlciwgYXN0OiB7XG4gICAgaGFzVmlld0NvbnRhaW5lcjogYm9vbGVhbixcbiAgICBvdXRwdXRzOiBCb3VuZEV2ZW50QXN0W10sXG4gICAgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgcHJvdmlkZXJzOiBQcm92aWRlckFzdFtdLFxuICAgIHJlZmVyZW5jZXM6IFJlZmVyZW5jZUFzdFtdLFxuICAgIHF1ZXJ5TWF0Y2hlczogUXVlcnlNYXRjaFtdXG4gIH0pOiB7XG4gICAgZmxhZ3M6IE5vZGVGbGFncyxcbiAgICB1c2VkRXZlbnRzOiBbc3RyaW5nfG51bGwsIHN0cmluZ11bXSxcbiAgICBxdWVyeU1hdGNoZXNFeHByOiBvLkV4cHJlc3Npb24sXG4gICAgaG9zdEJpbmRpbmdzOlxuICAgICAgICB7Y29udGV4dDogby5FeHByZXNzaW9uLCBpbnB1dEFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGRpckFzdDogRGlyZWN0aXZlQXN0fVtdLFxuICAgIGhvc3RFdmVudHM6IHtjb250ZXh0OiBvLkV4cHJlc3Npb24sIGV2ZW50QXN0OiBCb3VuZEV2ZW50QXN0LCBkaXJBc3Q6IERpcmVjdGl2ZUFzdH1bXSxcbiAgfSB7XG4gICAgbGV0IGZsYWdzID0gTm9kZUZsYWdzLk5vbmU7XG4gICAgaWYgKGFzdC5oYXNWaWV3Q29udGFpbmVyKSB7XG4gICAgICBmbGFncyB8PSBOb2RlRmxhZ3MuRW1iZWRkZWRWaWV3cztcbiAgICB9XG4gICAgY29uc3QgdXNlZEV2ZW50cyA9IG5ldyBNYXA8c3RyaW5nLCBbc3RyaW5nIHwgbnVsbCwgc3RyaW5nXT4oKTtcbiAgICBhc3Qub3V0cHV0cy5mb3JFYWNoKChldmVudCkgPT4ge1xuICAgICAgY29uc3Qge25hbWUsIHRhcmdldH0gPSBlbGVtZW50RXZlbnROYW1lQW5kVGFyZ2V0KGV2ZW50LCBudWxsKTtcbiAgICAgIHVzZWRFdmVudHMuc2V0KGVsZW1lbnRFdmVudEZ1bGxOYW1lKHRhcmdldCwgbmFtZSksIFt0YXJnZXQsIG5hbWVdKTtcbiAgICB9KTtcbiAgICBhc3QuZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJBc3QpID0+IHtcbiAgICAgIGRpckFzdC5ob3N0RXZlbnRzLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IHtuYW1lLCB0YXJnZXR9ID0gZWxlbWVudEV2ZW50TmFtZUFuZFRhcmdldChldmVudCwgZGlyQXN0KTtcbiAgICAgICAgdXNlZEV2ZW50cy5zZXQoZWxlbWVudEV2ZW50RnVsbE5hbWUodGFyZ2V0LCBuYW1lKSwgW3RhcmdldCwgbmFtZV0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgY29uc3QgaG9zdEJpbmRpbmdzOlxuICAgICAgICB7Y29udGV4dDogby5FeHByZXNzaW9uLCBpbnB1dEFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGRpckFzdDogRGlyZWN0aXZlQXN0fVtdID0gW107XG4gICAgY29uc3QgaG9zdEV2ZW50czoge2NvbnRleHQ6IG8uRXhwcmVzc2lvbiwgZXZlbnRBc3Q6IEJvdW5kRXZlbnRBc3QsIGRpckFzdDogRGlyZWN0aXZlQXN0fVtdID0gW107XG4gICAgdGhpcy5fdmlzaXRDb21wb25lbnRGYWN0b3J5UmVzb2x2ZXJQcm92aWRlcihhc3QuZGlyZWN0aXZlcyk7XG5cbiAgICBhc3QucHJvdmlkZXJzLmZvckVhY2gocHJvdmlkZXJBc3QgPT4ge1xuICAgICAgbGV0IGRpckFzdDogRGlyZWN0aXZlQXN0ID0gdW5kZWZpbmVkITtcbiAgICAgIGFzdC5kaXJlY3RpdmVzLmZvckVhY2gobG9jYWxEaXJBc3QgPT4ge1xuICAgICAgICBpZiAobG9jYWxEaXJBc3QuZGlyZWN0aXZlLnR5cGUucmVmZXJlbmNlID09PSB0b2tlblJlZmVyZW5jZShwcm92aWRlckFzdC50b2tlbikpIHtcbiAgICAgICAgICBkaXJBc3QgPSBsb2NhbERpckFzdDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoZGlyQXN0KSB7XG4gICAgICAgIGNvbnN0IHtob3N0QmluZGluZ3M6IGRpckhvc3RCaW5kaW5ncywgaG9zdEV2ZW50czogZGlySG9zdEV2ZW50c30gPVxuICAgICAgICAgICAgdGhpcy5fdmlzaXREaXJlY3RpdmUocHJvdmlkZXJBc3QsIGRpckFzdCwgYXN0LnJlZmVyZW5jZXMsIGFzdC5xdWVyeU1hdGNoZXMsIHVzZWRFdmVudHMpO1xuICAgICAgICBob3N0QmluZGluZ3MucHVzaCguLi5kaXJIb3N0QmluZGluZ3MpO1xuICAgICAgICBob3N0RXZlbnRzLnB1c2goLi4uZGlySG9zdEV2ZW50cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl92aXNpdFByb3ZpZGVyKHByb3ZpZGVyQXN0LCBhc3QucXVlcnlNYXRjaGVzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGxldCBxdWVyeU1hdGNoRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgYXN0LnF1ZXJ5TWF0Y2hlcy5mb3JFYWNoKChtYXRjaCkgPT4ge1xuICAgICAgbGV0IHZhbHVlVHlwZTogUXVlcnlWYWx1ZVR5cGUgPSB1bmRlZmluZWQhO1xuICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKG1hdGNoLnZhbHVlKSA9PT1cbiAgICAgICAgICB0aGlzLnJlZmxlY3Rvci5yZXNvbHZlRXh0ZXJuYWxSZWZlcmVuY2UoSWRlbnRpZmllcnMuRWxlbWVudFJlZikpIHtcbiAgICAgICAgdmFsdWVUeXBlID0gUXVlcnlWYWx1ZVR5cGUuRWxlbWVudFJlZjtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgdG9rZW5SZWZlcmVuY2UobWF0Y2gudmFsdWUpID09PVxuICAgICAgICAgIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5WaWV3Q29udGFpbmVyUmVmKSkge1xuICAgICAgICB2YWx1ZVR5cGUgPSBRdWVyeVZhbHVlVHlwZS5WaWV3Q29udGFpbmVyUmVmO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0b2tlblJlZmVyZW5jZShtYXRjaC52YWx1ZSkgPT09XG4gICAgICAgICAgdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKElkZW50aWZpZXJzLlRlbXBsYXRlUmVmKSkge1xuICAgICAgICB2YWx1ZVR5cGUgPSBRdWVyeVZhbHVlVHlwZS5UZW1wbGF0ZVJlZjtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZVR5cGUgIT0gbnVsbCkge1xuICAgICAgICBxdWVyeU1hdGNoRXhwcnMucHVzaChvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChtYXRjaC5xdWVyeUlkKSwgby5saXRlcmFsKHZhbHVlVHlwZSldKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgYXN0LnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICBsZXQgdmFsdWVUeXBlOiBRdWVyeVZhbHVlVHlwZSA9IHVuZGVmaW5lZCE7XG4gICAgICBpZiAoIXJlZi52YWx1ZSkge1xuICAgICAgICB2YWx1ZVR5cGUgPSBRdWVyeVZhbHVlVHlwZS5SZW5kZXJFbGVtZW50O1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICB0b2tlblJlZmVyZW5jZShyZWYudmFsdWUpID09PVxuICAgICAgICAgIHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5UZW1wbGF0ZVJlZikpIHtcbiAgICAgICAgdmFsdWVUeXBlID0gUXVlcnlWYWx1ZVR5cGUuVGVtcGxhdGVSZWY7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWVUeXBlICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5yZWZOb2RlSW5kaWNlc1tyZWYubmFtZV0gPSBub2RlSW5kZXg7XG4gICAgICAgIHF1ZXJ5TWF0Y2hFeHBycy5wdXNoKG8ubGl0ZXJhbEFycihbby5saXRlcmFsKHJlZi5uYW1lKSwgby5saXRlcmFsKHZhbHVlVHlwZSldKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgYXN0Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0KSA9PiB7XG4gICAgICBob3N0RXZlbnRzLnB1c2goe2NvbnRleHQ6IENPTVBfVkFSLCBldmVudEFzdDogb3V0cHV0QXN0LCBkaXJBc3Q6IG51bGwhfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgZmxhZ3MsXG4gICAgICB1c2VkRXZlbnRzOiBBcnJheS5mcm9tKHVzZWRFdmVudHMudmFsdWVzKCkpLFxuICAgICAgcXVlcnlNYXRjaGVzRXhwcjogcXVlcnlNYXRjaEV4cHJzLmxlbmd0aCA/IG8ubGl0ZXJhbEFycihxdWVyeU1hdGNoRXhwcnMpIDogby5OVUxMX0VYUFIsXG4gICAgICBob3N0QmluZGluZ3MsXG4gICAgICBob3N0RXZlbnRzOiBob3N0RXZlbnRzXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0RGlyZWN0aXZlKFxuICAgICAgcHJvdmlkZXJBc3Q6IFByb3ZpZGVyQXN0LCBkaXJBc3Q6IERpcmVjdGl2ZUFzdCwgcmVmczogUmVmZXJlbmNlQXN0W10sXG4gICAgICBxdWVyeU1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSwgdXNlZEV2ZW50czogTWFwPHN0cmluZywgYW55Pik6IHtcbiAgICBob3N0QmluZGluZ3M6XG4gICAgICAgIHtjb250ZXh0OiBvLkV4cHJlc3Npb24sIGlucHV0QXN0OiBCb3VuZEVsZW1lbnRQcm9wZXJ0eUFzdCwgZGlyQXN0OiBEaXJlY3RpdmVBc3R9W10sXG4gICAgaG9zdEV2ZW50czoge2NvbnRleHQ6IG8uRXhwcmVzc2lvbiwgZXZlbnRBc3Q6IEJvdW5kRXZlbnRBc3QsIGRpckFzdDogRGlyZWN0aXZlQXN0fVtdXG4gIH0ge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMubm9kZXMubGVuZ3RoO1xuICAgIC8vIHJlc2VydmUgdGhlIHNwYWNlIGluIHRoZSBub2RlRGVmcyBhcnJheSBzbyB3ZSBjYW4gYWRkIGNoaWxkcmVuXG4gICAgdGhpcy5ub2Rlcy5wdXNoKG51bGwhKTtcblxuICAgIGRpckFzdC5kaXJlY3RpdmUucXVlcmllcy5mb3JFYWNoKChxdWVyeSwgcXVlcnlJbmRleCkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlJZCA9IGRpckFzdC5jb250ZW50UXVlcnlTdGFydElkICsgcXVlcnlJbmRleDtcbiAgICAgIGNvbnN0IGZsYWdzID0gTm9kZUZsYWdzLlR5cGVDb250ZW50UXVlcnkgfCBjYWxjUXVlcnlGbGFncyhxdWVyeSk7XG4gICAgICBjb25zdCBiaW5kaW5nVHlwZSA9IHF1ZXJ5LmZpcnN0ID8gUXVlcnlCaW5kaW5nVHlwZS5GaXJzdCA6IFF1ZXJ5QmluZGluZ1R5cGUuQWxsO1xuICAgICAgdGhpcy5ub2Rlcy5wdXNoKCgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBkaXJBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVGbGFnczogZmxhZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucXVlcnlEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChmbGFncyksIG8ubGl0ZXJhbChxdWVyeUlkKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IG8uTGl0ZXJhbE1hcEV4cHIoW25ldyBvLkxpdGVyYWxNYXBFbnRyeShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5LnByb3BlcnR5TmFtZSwgby5saXRlcmFsKGJpbmRpbmdUeXBlKSwgZmFsc2UpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICB9KTtcblxuICAgIC8vIE5vdGU6IHRoZSBvcGVyYXRpb24gYmVsb3cgbWlnaHQgYWxzbyBjcmVhdGUgbmV3IG5vZGVEZWZzLFxuICAgIC8vIGJ1dCB3ZSBkb24ndCB3YW50IHRoZW0gdG8gYmUgYSBjaGlsZCBvZiBhIGRpcmVjdGl2ZSxcbiAgICAvLyBhcyB0aGV5IG1pZ2h0IGJlIGEgcHJvdmlkZXIvcGlwZSBvbiB0aGVpciBvd24uXG4gICAgLy8gSS5lLiB3ZSBvbmx5IGFsbG93IHF1ZXJpZXMgYXMgY2hpbGRyZW4gb2YgZGlyZWN0aXZlcyBub2Rlcy5cbiAgICBjb25zdCBjaGlsZENvdW50ID0gdGhpcy5ub2Rlcy5sZW5ndGggLSBub2RlSW5kZXggLSAxO1xuXG4gICAgbGV0IHtmbGFncywgcXVlcnlNYXRjaEV4cHJzLCBwcm92aWRlckV4cHIsIGRlcHNFeHByfSA9XG4gICAgICAgIHRoaXMuX3Zpc2l0UHJvdmlkZXJPckRpcmVjdGl2ZShwcm92aWRlckFzdCwgcXVlcnlNYXRjaGVzKTtcblxuICAgIHJlZnMuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICBpZiAocmVmLnZhbHVlICYmIHRva2VuUmVmZXJlbmNlKHJlZi52YWx1ZSkgPT09IHRva2VuUmVmZXJlbmNlKHByb3ZpZGVyQXN0LnRva2VuKSkge1xuICAgICAgICB0aGlzLnJlZk5vZGVJbmRpY2VzW3JlZi5uYW1lXSA9IG5vZGVJbmRleDtcbiAgICAgICAgcXVlcnlNYXRjaEV4cHJzLnB1c2goXG4gICAgICAgICAgICBvLmxpdGVyYWxBcnIoW28ubGl0ZXJhbChyZWYubmFtZSksIG8ubGl0ZXJhbChRdWVyeVZhbHVlVHlwZS5Qcm92aWRlcildKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoZGlyQXN0LmRpcmVjdGl2ZS5pc0NvbXBvbmVudCkge1xuICAgICAgZmxhZ3MgfD0gTm9kZUZsYWdzLkNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBjb25zdCBpbnB1dERlZnMgPSBkaXJBc3QuaW5wdXRzLm1hcCgoaW5wdXRBc3QsIGlucHV0SW5kZXgpID0+IHtcbiAgICAgIGNvbnN0IG1hcFZhbHVlID0gby5saXRlcmFsQXJyKFtvLmxpdGVyYWwoaW5wdXRJbmRleCksIG8ubGl0ZXJhbChpbnB1dEFzdC5kaXJlY3RpdmVOYW1lKV0pO1xuICAgICAgLy8gTm90ZTogaXQncyBpbXBvcnRhbnQgdG8gbm90IHF1b3RlIHRoZSBrZXkgc28gdGhhdCB3ZSBjYW4gY2FwdHVyZSByZW5hbWVzIGJ5IG1pbmlmaWVycyFcbiAgICAgIHJldHVybiBuZXcgby5MaXRlcmFsTWFwRW50cnkoaW5wdXRBc3QuZGlyZWN0aXZlTmFtZSwgbWFwVmFsdWUsIGZhbHNlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG91dHB1dERlZnM6IG8uTGl0ZXJhbE1hcEVudHJ5W10gPSBbXTtcbiAgICBjb25zdCBkaXJNZXRhID0gZGlyQXN0LmRpcmVjdGl2ZTtcbiAgICBPYmplY3Qua2V5cyhkaXJNZXRhLm91dHB1dHMpLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWUgPSBkaXJNZXRhLm91dHB1dHNbcHJvcE5hbWVdO1xuICAgICAgaWYgKHVzZWRFdmVudHMuaGFzKGV2ZW50TmFtZSkpIHtcbiAgICAgICAgLy8gTm90ZTogaXQncyBpbXBvcnRhbnQgdG8gbm90IHF1b3RlIHRoZSBrZXkgc28gdGhhdCB3ZSBjYW4gY2FwdHVyZSByZW5hbWVzIGJ5IG1pbmlmaWVycyFcbiAgICAgICAgb3V0cHV0RGVmcy5wdXNoKG5ldyBvLkxpdGVyYWxNYXBFbnRyeShwcm9wTmFtZSwgby5saXRlcmFsKGV2ZW50TmFtZSksIGZhbHNlKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgbGV0IHVwZGF0ZURpcmVjdGl2ZUV4cHJlc3Npb25zOiBVcGRhdGVFeHByZXNzaW9uW10gPSBbXTtcbiAgICBpZiAoZGlyQXN0LmlucHV0cy5sZW5ndGggfHwgKGZsYWdzICYgKE5vZGVGbGFncy5Eb0NoZWNrIHwgTm9kZUZsYWdzLk9uSW5pdCkpID4gMCkge1xuICAgICAgdXBkYXRlRGlyZWN0aXZlRXhwcmVzc2lvbnMgPVxuICAgICAgICAgIGRpckFzdC5pbnB1dHMubWFwKChpbnB1dCwgYmluZGluZ0luZGV4KSA9PiB0aGlzLl9wcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbih7XG4gICAgICAgICAgICBub2RlSW5kZXgsXG4gICAgICAgICAgICBiaW5kaW5nSW5kZXgsXG4gICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgY29udGV4dDogQ09NUF9WQVIsXG4gICAgICAgICAgICB2YWx1ZTogaW5wdXQudmFsdWVcbiAgICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGlyQ29udGV4dEV4cHIgPVxuICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubm9kZVZhbHVlKS5jYWxsRm4oW1ZJRVdfVkFSLCBvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuICAgIGNvbnN0IGhvc3RCaW5kaW5ncyA9IGRpckFzdC5ob3N0UHJvcGVydGllcy5tYXAoKGlucHV0QXN0KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBkaXJDb250ZXh0RXhwcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlyQXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dEFzdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICBjb25zdCBob3N0RXZlbnRzID0gZGlyQXN0Lmhvc3RFdmVudHMubWFwKChob3N0RXZlbnRBc3QpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGRpckNvbnRleHRFeHByLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudEFzdDogaG9zdEV2ZW50QXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXJBc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAvLyBDaGVjayBpbmRleCBpcyB0aGUgc2FtZSBhcyB0aGUgbm9kZSBpbmRleCBkdXJpbmcgY29tcGlsYXRpb25cbiAgICAvLyBUaGV5IG1pZ2h0IG9ubHkgZGlmZmVyIGF0IHJ1bnRpbWVcbiAgICBjb25zdCBjaGVja0luZGV4ID0gbm9kZUluZGV4O1xuXG4gICAgdGhpcy5ub2Rlc1tub2RlSW5kZXhdID0gKCkgPT4gKHtcbiAgICAgIHNvdXJjZVNwYW46IGRpckFzdC5zb3VyY2VTcGFuLFxuICAgICAgbm9kZUZsYWdzOiBOb2RlRmxhZ3MuVHlwZURpcmVjdGl2ZSB8IGZsYWdzLFxuICAgICAgbm9kZURlZjogby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmRpcmVjdGl2ZURlZikuY2FsbEZuKFtcbiAgICAgICAgby5saXRlcmFsKGNoZWNrSW5kZXgpLFxuICAgICAgICBvLmxpdGVyYWwoZmxhZ3MpLFxuICAgICAgICBxdWVyeU1hdGNoRXhwcnMubGVuZ3RoID8gby5saXRlcmFsQXJyKHF1ZXJ5TWF0Y2hFeHBycykgOiBvLk5VTExfRVhQUixcbiAgICAgICAgby5saXRlcmFsKGNoaWxkQ291bnQpLFxuICAgICAgICBwcm92aWRlckV4cHIsXG4gICAgICAgIGRlcHNFeHByLFxuICAgICAgICBpbnB1dERlZnMubGVuZ3RoID8gbmV3IG8uTGl0ZXJhbE1hcEV4cHIoaW5wdXREZWZzKSA6IG8uTlVMTF9FWFBSLFxuICAgICAgICBvdXRwdXREZWZzLmxlbmd0aCA/IG5ldyBvLkxpdGVyYWxNYXBFeHByKG91dHB1dERlZnMpIDogby5OVUxMX0VYUFIsXG4gICAgICBdKSxcbiAgICAgIHVwZGF0ZURpcmVjdGl2ZXM6IHVwZGF0ZURpcmVjdGl2ZUV4cHJlc3Npb25zLFxuICAgICAgZGlyZWN0aXZlOiBkaXJBc3QuZGlyZWN0aXZlLnR5cGUsXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge2hvc3RCaW5kaW5ncywgaG9zdEV2ZW50c307XG4gIH1cblxuICBwcml2YXRlIF92aXNpdFByb3ZpZGVyKHByb3ZpZGVyQXN0OiBQcm92aWRlckFzdCwgcXVlcnlNYXRjaGVzOiBRdWVyeU1hdGNoW10pOiB2b2lkIHtcbiAgICB0aGlzLl9hZGRQcm92aWRlck5vZGUodGhpcy5fdmlzaXRQcm92aWRlck9yRGlyZWN0aXZlKHByb3ZpZGVyQXN0LCBxdWVyeU1hdGNoZXMpKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Zpc2l0Q29tcG9uZW50RmFjdG9yeVJlc29sdmVyUHJvdmlkZXIoZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10pIHtcbiAgICBjb25zdCBjb21wb25lbnREaXJNZXRhID0gZGlyZWN0aXZlcy5maW5kKGRpckFzdCA9PiBkaXJBc3QuZGlyZWN0aXZlLmlzQ29tcG9uZW50KTtcbiAgICBpZiAoY29tcG9uZW50RGlyTWV0YSAmJiBjb21wb25lbnREaXJNZXRhLmRpcmVjdGl2ZS5lbnRyeUNvbXBvbmVudHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7cHJvdmlkZXJFeHByLCBkZXBzRXhwciwgZmxhZ3MsIHRva2VuRXhwcn0gPSBjb21wb25lbnRGYWN0b3J5UmVzb2x2ZXJQcm92aWRlckRlZihcbiAgICAgICAgICB0aGlzLnJlZmxlY3RvciwgdGhpcy5vdXRwdXRDdHgsIE5vZGVGbGFncy5Qcml2YXRlUHJvdmlkZXIsXG4gICAgICAgICAgY29tcG9uZW50RGlyTWV0YS5kaXJlY3RpdmUuZW50cnlDb21wb25lbnRzKTtcbiAgICAgIHRoaXMuX2FkZFByb3ZpZGVyTm9kZSh7XG4gICAgICAgIHByb3ZpZGVyRXhwcixcbiAgICAgICAgZGVwc0V4cHIsXG4gICAgICAgIGZsYWdzLFxuICAgICAgICB0b2tlbkV4cHIsXG4gICAgICAgIHF1ZXJ5TWF0Y2hFeHByczogW10sXG4gICAgICAgIHNvdXJjZVNwYW46IGNvbXBvbmVudERpck1ldGEuc291cmNlU3BhblxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkUHJvdmlkZXJOb2RlKGRhdGE6IHtcbiAgICBmbGFnczogTm9kZUZsYWdzLFxuICAgIHF1ZXJ5TWF0Y2hFeHByczogby5FeHByZXNzaW9uW10sXG4gICAgcHJvdmlkZXJFeHByOiBvLkV4cHJlc3Npb24sXG4gICAgZGVwc0V4cHI6IG8uRXhwcmVzc2lvbixcbiAgICB0b2tlbkV4cHI6IG8uRXhwcmVzc2lvbixcbiAgICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW5cbiAgfSkge1xuICAgIC8vIHByb3ZpZGVyRGVmKFxuICAgIC8vICAgZmxhZ3M6IE5vZGVGbGFncywgbWF0Y2hlZFF1ZXJpZXM6IFtzdHJpbmcsIFF1ZXJ5VmFsdWVUeXBlXVtdLCB0b2tlbjphbnksXG4gICAgLy8gICB2YWx1ZTogYW55LCBkZXBzOiAoW0RlcEZsYWdzLCBhbnldIHwgYW55KVtdKTogTm9kZURlZjtcbiAgICB0aGlzLm5vZGVzLnB1c2goXG4gICAgICAgICgpID0+ICh7XG4gICAgICAgICAgc291cmNlU3BhbjogZGF0YS5zb3VyY2VTcGFuLFxuICAgICAgICAgIG5vZGVGbGFnczogZGF0YS5mbGFncyxcbiAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucHJvdmlkZXJEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICBvLmxpdGVyYWwoZGF0YS5mbGFncyksXG4gICAgICAgICAgICBkYXRhLnF1ZXJ5TWF0Y2hFeHBycy5sZW5ndGggPyBvLmxpdGVyYWxBcnIoZGF0YS5xdWVyeU1hdGNoRXhwcnMpIDogby5OVUxMX0VYUFIsXG4gICAgICAgICAgICBkYXRhLnRva2VuRXhwciwgZGF0YS5wcm92aWRlckV4cHIsIGRhdGEuZGVwc0V4cHJcbiAgICAgICAgICBdKVxuICAgICAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIF92aXNpdFByb3ZpZGVyT3JEaXJlY3RpdmUocHJvdmlkZXJBc3Q6IFByb3ZpZGVyQXN0LCBxdWVyeU1hdGNoZXM6IFF1ZXJ5TWF0Y2hbXSk6IHtcbiAgICBmbGFnczogTm9kZUZsYWdzLFxuICAgIHRva2VuRXhwcjogby5FeHByZXNzaW9uLFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBxdWVyeU1hdGNoRXhwcnM6IG8uRXhwcmVzc2lvbltdLFxuICAgIHByb3ZpZGVyRXhwcjogby5FeHByZXNzaW9uLFxuICAgIGRlcHNFeHByOiBvLkV4cHJlc3Npb25cbiAgfSB7XG4gICAgbGV0IGZsYWdzID0gTm9kZUZsYWdzLk5vbmU7XG4gICAgbGV0IHF1ZXJ5TWF0Y2hFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIHF1ZXJ5TWF0Y2hlcy5mb3JFYWNoKChtYXRjaCkgPT4ge1xuICAgICAgaWYgKHRva2VuUmVmZXJlbmNlKG1hdGNoLnZhbHVlKSA9PT0gdG9rZW5SZWZlcmVuY2UocHJvdmlkZXJBc3QudG9rZW4pKSB7XG4gICAgICAgIHF1ZXJ5TWF0Y2hFeHBycy5wdXNoKFxuICAgICAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwobWF0Y2gucXVlcnlJZCksIG8ubGl0ZXJhbChRdWVyeVZhbHVlVHlwZS5Qcm92aWRlcildKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3Qge3Byb3ZpZGVyRXhwciwgZGVwc0V4cHIsIGZsYWdzOiBwcm92aWRlckZsYWdzLCB0b2tlbkV4cHJ9ID1cbiAgICAgICAgcHJvdmlkZXJEZWYodGhpcy5vdXRwdXRDdHgsIHByb3ZpZGVyQXN0KTtcbiAgICByZXR1cm4ge1xuICAgICAgZmxhZ3M6IGZsYWdzIHwgcHJvdmlkZXJGbGFncyxcbiAgICAgIHF1ZXJ5TWF0Y2hFeHBycyxcbiAgICAgIHByb3ZpZGVyRXhwcixcbiAgICAgIGRlcHNFeHByLFxuICAgICAgdG9rZW5FeHByLFxuICAgICAgc291cmNlU3BhbjogcHJvdmlkZXJBc3Quc291cmNlU3BhblxuICAgIH07XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICByZXR1cm4gRXZlbnRIYW5kbGVyVmFycy5ldmVudDtcbiAgICB9XG4gICAgbGV0IGN1cnJWaWV3RXhwcjogby5FeHByZXNzaW9uID0gVklFV19WQVI7XG4gICAgZm9yIChsZXQgY3VyckJ1aWxkZXI6IFZpZXdCdWlsZGVyfG51bGwgPSB0aGlzOyBjdXJyQnVpbGRlcjsgY3VyckJ1aWxkZXIgPSBjdXJyQnVpbGRlci5wYXJlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJWaWV3RXhwciA9IGN1cnJWaWV3RXhwci5wcm9wKCdwYXJlbnQnKS5jYXN0KG8uRFlOQU1JQ19UWVBFKSkge1xuICAgICAgLy8gY2hlY2sgcmVmZXJlbmNlc1xuICAgICAgY29uc3QgcmVmTm9kZUluZGV4ID0gY3VyckJ1aWxkZXIucmVmTm9kZUluZGljZXNbbmFtZV07XG4gICAgICBpZiAocmVmTm9kZUluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5ub2RlVmFsdWUpLmNhbGxGbihbY3VyclZpZXdFeHByLCBvLmxpdGVyYWwocmVmTm9kZUluZGV4KV0pO1xuICAgICAgfVxuXG4gICAgICAvLyBjaGVjayB2YXJpYWJsZXNcbiAgICAgIGNvbnN0IHZhckFzdCA9IGN1cnJCdWlsZGVyLnZhcmlhYmxlcy5maW5kKCh2YXJBc3QpID0+IHZhckFzdC5uYW1lID09PSBuYW1lKTtcbiAgICAgIGlmICh2YXJBc3QpIHtcbiAgICAgICAgY29uc3QgdmFyVmFsdWUgPSB2YXJBc3QudmFsdWUgfHwgSU1QTElDSVRfVEVNUExBVEVfVkFSO1xuICAgICAgICByZXR1cm4gY3VyclZpZXdFeHByLnByb3AoJ2NvbnRleHQnKS5wcm9wKHZhclZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIC8vIE5vdCBuZWVkZWQgaW4gVmlld0VuZ2luZSBhcyBWaWV3RW5naW5lIHdhbGtzIHRocm91Z2ggdGhlIGdlbmVyYXRlZFxuICAgIC8vIGV4cHJlc3Npb25zIHRvIGZpZ3VyZSBvdXQgaWYgdGhlIGltcGxpY2l0IHJlY2VpdmVyIGlzIHVzZWQgYW5kIG5lZWRzXG4gICAgLy8gdG8gYmUgZ2VuZXJhdGVkIGFzIHBhcnQgb2YgdGhlIHByZS11cGRhdGUgc3RhdGVtZW50cy5cbiAgfVxuXG4gIG1heWJlUmVzdG9yZVZpZXcoKTogdm9pZCB7XG4gICAgLy8gTm90IG5lY2Vzc2FyeSBpbiBWaWV3RW5naW5lLCBiZWNhdXNlIHZpZXcgcmVzdG9yYXRpb24gaXMgYW4gSXZ5IGNvbmNlcHQuXG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBhcmdDb3VudDogbnVtYmVyKTpcbiAgICAgIEJ1aWx0aW5Db252ZXJ0ZXIge1xuICAgIGlmIChhcmdDb3VudCA9PT0gMCkge1xuICAgICAgY29uc3QgdmFsdWVFeHByID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLkVNUFRZX0FSUkFZKTtcbiAgICAgIHJldHVybiAoKSA9PiB2YWx1ZUV4cHI7XG4gICAgfVxuXG4gICAgY29uc3QgY2hlY2tJbmRleCA9IHRoaXMubm9kZXMubGVuZ3RoO1xuXG4gICAgdGhpcy5ub2Rlcy5wdXNoKCgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlUHVyZUFycmF5LFxuICAgICAgICAgICAgICAgICAgICAgIG5vZGVEZWY6IG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5wdXJlQXJyYXlEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWwoY2hlY2tJbmRleCksXG4gICAgICAgICAgICAgICAgICAgICAgICBvLmxpdGVyYWwoYXJnQ291bnQpLFxuICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcblxuICAgIHJldHVybiAoYXJnczogby5FeHByZXNzaW9uW10pID0+IGNhbGxDaGVja1N0bXQoY2hlY2tJbmRleCwgYXJncyk7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyKFxuICAgICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLCBrZXlzOiB7a2V5OiBzdHJpbmcsIHF1b3RlZDogYm9vbGVhbn1bXSk6IEJ1aWx0aW5Db252ZXJ0ZXIge1xuICAgIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgdmFsdWVFeHByID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLkVNUFRZX01BUCk7XG4gICAgICByZXR1cm4gKCkgPT4gdmFsdWVFeHByO1xuICAgIH1cblxuICAgIGNvbnN0IG1hcCA9IG8ubGl0ZXJhbE1hcChrZXlzLm1hcCgoZSwgaSkgPT4gKHsuLi5lLCB2YWx1ZTogby5saXRlcmFsKGkpfSkpKTtcbiAgICBjb25zdCBjaGVja0luZGV4ID0gdGhpcy5ub2Rlcy5sZW5ndGg7XG4gICAgdGhpcy5ub2Rlcy5wdXNoKCgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlUHVyZU9iamVjdCxcbiAgICAgICAgICAgICAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucHVyZU9iamVjdERlZikuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChjaGVja0luZGV4KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hcCxcbiAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICByZXR1cm4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBjYWxsQ2hlY2tTdG10KGNoZWNrSW5kZXgsIGFyZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlUGlwZUNvbnZlcnRlcihleHByZXNzaW9uOiBVcGRhdGVFeHByZXNzaW9uLCBuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpOlxuICAgICAgQnVpbHRpbkNvbnZlcnRlciB7XG4gICAgY29uc3QgcGlwZSA9IHRoaXMudXNlZFBpcGVzLmZpbmQoKHBpcGVTdW1tYXJ5KSA9PiBwaXBlU3VtbWFyeS5uYW1lID09PSBuYW1lKSE7XG4gICAgaWYgKHBpcGUucHVyZSkge1xuICAgICAgY29uc3QgY2hlY2tJbmRleCA9IHRoaXMubm9kZXMubGVuZ3RoO1xuICAgICAgdGhpcy5ub2Rlcy5wdXNoKCgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBleHByZXNzaW9uLnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlUHVyZVBpcGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucHVyZVBpcGVEZWYpLmNhbGxGbihbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChjaGVja0luZGV4KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5saXRlcmFsKGFyZ0NvdW50KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAvLyBmaW5kIHVuZGVybHlpbmcgcGlwZSBpbiB0aGUgY29tcG9uZW50IHZpZXdcbiAgICAgIGxldCBjb21wVmlld0V4cHI6IG8uRXhwcmVzc2lvbiA9IFZJRVdfVkFSO1xuICAgICAgbGV0IGNvbXBCdWlsZGVyOiBWaWV3QnVpbGRlciA9IHRoaXM7XG4gICAgICB3aGlsZSAoY29tcEJ1aWxkZXIucGFyZW50KSB7XG4gICAgICAgIGNvbXBCdWlsZGVyID0gY29tcEJ1aWxkZXIucGFyZW50O1xuICAgICAgICBjb21wVmlld0V4cHIgPSBjb21wVmlld0V4cHIucHJvcCgncGFyZW50JykuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgICB9XG4gICAgICBjb25zdCBwaXBlTm9kZUluZGV4ID0gY29tcEJ1aWxkZXIucHVyZVBpcGVOb2RlSW5kaWNlc1tuYW1lXTtcbiAgICAgIGNvbnN0IHBpcGVWYWx1ZUV4cHI6IG8uRXhwcmVzc2lvbiA9XG4gICAgICAgICAgby5pbXBvcnRFeHByKElkZW50aWZpZXJzLm5vZGVWYWx1ZSkuY2FsbEZuKFtjb21wVmlld0V4cHIsIG8ubGl0ZXJhbChwaXBlTm9kZUluZGV4KV0pO1xuXG4gICAgICByZXR1cm4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBjYWxsQ2hlY2tTdG10KGNoZWNrSW5kZXgsIFtwaXBlVmFsdWVFeHByXS5jb25jYXQoYXJncykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLl9jcmVhdGVQaXBlKGV4cHJlc3Npb24uc291cmNlU3BhbiwgcGlwZSk7XG4gICAgICBjb25zdCBub2RlVmFsdWVFeHByID1cbiAgICAgICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMubm9kZVZhbHVlKS5jYWxsRm4oW1ZJRVdfVkFSLCBvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgICByZXR1cm4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiBub2RlVmFsdWVFeHByLnByb3AoJ3RyYW5zZm9ybScpLmNhbGxGbihhcmdzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVQaXBlKHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCBwaXBlOiBDb21waWxlUGlwZVN1bW1hcnkpOiBudW1iZXIge1xuICAgIGNvbnN0IG5vZGVJbmRleCA9IHRoaXMubm9kZXMubGVuZ3RoO1xuICAgIGxldCBmbGFncyA9IE5vZGVGbGFncy5Ob25lO1xuICAgIHBpcGUudHlwZS5saWZlY3ljbGVIb29rcy5mb3JFYWNoKChsaWZlY3ljbGVIb29rKSA9PiB7XG4gICAgICAvLyBmb3IgcGlwZXMsIHdlIG9ubHkgc3VwcG9ydCBuZ09uRGVzdHJveVxuICAgICAgaWYgKGxpZmVjeWNsZUhvb2sgPT09IExpZmVjeWNsZUhvb2tzLk9uRGVzdHJveSkge1xuICAgICAgICBmbGFncyB8PSBsaWZlY3ljbGVIb29rVG9Ob2RlRmxhZyhsaWZlY3ljbGVIb29rKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGRlcEV4cHJzID0gcGlwZS50eXBlLmRpRGVwcy5tYXAoKGRpRGVwKSA9PiBkZXBEZWYodGhpcy5vdXRwdXRDdHgsIGRpRGVwKSk7XG4gICAgLy8gZnVuY3Rpb24gcGlwZURlZihcbiAgICAvLyAgIGZsYWdzOiBOb2RlRmxhZ3MsIGN0b3I6IGFueSwgZGVwczogKFtEZXBGbGFncywgYW55XSB8IGFueSlbXSk6IE5vZGVEZWZcbiAgICB0aGlzLm5vZGVzLnB1c2goXG4gICAgICAgICgpID0+ICh7XG4gICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICBub2RlRmxhZ3M6IE5vZGVGbGFncy5UeXBlUGlwZSxcbiAgICAgICAgICBub2RlRGVmOiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMucGlwZURlZikuY2FsbEZuKFtcbiAgICAgICAgICAgIG8ubGl0ZXJhbChmbGFncyksIHRoaXMub3V0cHV0Q3R4LmltcG9ydEV4cHIocGlwZS50eXBlLnJlZmVyZW5jZSksIG8ubGl0ZXJhbEFycihkZXBFeHBycylcbiAgICAgICAgICBdKVxuICAgICAgICB9KSk7XG4gICAgcmV0dXJuIG5vZGVJbmRleDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgdGhlIEFTVCBpbiBgVXBkYXRlRXhwcmVzc2lvbi52YWx1ZWA6XG4gICAqIC0gY3JlYXRlIG5vZGVzIGZvciBwaXBlcywgbGl0ZXJhbCBhcnJheXMgYW5kLCBsaXRlcmFsIG1hcHMsXG4gICAqIC0gdXBkYXRlIHRoZSBBU1QgdG8gcmVwbGFjZSBwaXBlcywgbGl0ZXJhbCBhcnJheXMgYW5kLCBsaXRlcmFsIG1hcHMgd2l0aCBjYWxscyB0byBjaGVjayBmbi5cbiAgICpcbiAgICogV0FSTklORzogVGhpcyBtaWdodCBjcmVhdGUgbmV3IG5vZGVEZWZzIChmb3IgcGlwZXMgYW5kIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG1hcHMpIVxuICAgKi9cbiAgcHJpdmF0ZSBfcHJlcHJvY2Vzc1VwZGF0ZUV4cHJlc3Npb24oZXhwcmVzc2lvbjogVXBkYXRlRXhwcmVzc2lvbik6IFVwZGF0ZUV4cHJlc3Npb24ge1xuICAgIHJldHVybiB7XG4gICAgICBub2RlSW5kZXg6IGV4cHJlc3Npb24ubm9kZUluZGV4LFxuICAgICAgYmluZGluZ0luZGV4OiBleHByZXNzaW9uLmJpbmRpbmdJbmRleCxcbiAgICAgIHNvdXJjZVNwYW46IGV4cHJlc3Npb24uc291cmNlU3BhbixcbiAgICAgIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dCxcbiAgICAgIHZhbHVlOiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICAgICAge1xuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT5cbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVMaXRlcmFsQXJyYXlDb252ZXJ0ZXIoZXhwcmVzc2lvbi5zb3VyY2VTcGFuLCBhcmdDb3VudCksXG4gICAgICAgICAgICBjcmVhdGVMaXRlcmFsTWFwQ29udmVydGVyOiAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+XG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcihleHByZXNzaW9uLnNvdXJjZVNwYW4sIGtleXMpLFxuICAgICAgICAgICAgY3JlYXRlUGlwZUNvbnZlcnRlcjogKG5hbWU6IHN0cmluZywgYXJnQ291bnQ6IG51bWJlcikgPT5cbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVQaXBlQ29udmVydGVyKGV4cHJlc3Npb24sIG5hbWUsIGFyZ0NvdW50KVxuICAgICAgICAgIH0sXG4gICAgICAgICAgZXhwcmVzc2lvbi52YWx1ZSlcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlTm9kZUV4cHJlc3Npb25zKCk6IHtcbiAgICB1cGRhdGVSZW5kZXJlclN0bXRzOiBvLlN0YXRlbWVudFtdLFxuICAgIHVwZGF0ZURpcmVjdGl2ZXNTdG10czogby5TdGF0ZW1lbnRbXSxcbiAgICBub2RlRGVmRXhwcnM6IG8uRXhwcmVzc2lvbltdXG4gIH0ge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGxldCB1cGRhdGVCaW5kaW5nQ291bnQgPSAwO1xuICAgIGNvbnN0IHVwZGF0ZVJlbmRlcmVyU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBjb25zdCB1cGRhdGVEaXJlY3RpdmVzU3RtdHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgICBjb25zdCBub2RlRGVmRXhwcnMgPSB0aGlzLm5vZGVzLm1hcCgoZmFjdG9yeSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICBjb25zdCB7bm9kZURlZiwgbm9kZUZsYWdzLCB1cGRhdGVEaXJlY3RpdmVzLCB1cGRhdGVSZW5kZXJlciwgc291cmNlU3Bhbn0gPSBmYWN0b3J5KCk7XG4gICAgICBpZiAodXBkYXRlUmVuZGVyZXIpIHtcbiAgICAgICAgdXBkYXRlUmVuZGVyZXJTdG10cy5wdXNoKFxuICAgICAgICAgICAgLi4uY3JlYXRlVXBkYXRlU3RhdGVtZW50cyhub2RlSW5kZXgsIHNvdXJjZVNwYW4sIHVwZGF0ZVJlbmRlcmVyLCBmYWxzZSkpO1xuICAgICAgfVxuICAgICAgaWYgKHVwZGF0ZURpcmVjdGl2ZXMpIHtcbiAgICAgICAgdXBkYXRlRGlyZWN0aXZlc1N0bXRzLnB1c2goLi4uY3JlYXRlVXBkYXRlU3RhdGVtZW50cyhcbiAgICAgICAgICAgIG5vZGVJbmRleCwgc291cmNlU3BhbiwgdXBkYXRlRGlyZWN0aXZlcyxcbiAgICAgICAgICAgIChub2RlRmxhZ3MgJiAoTm9kZUZsYWdzLkRvQ2hlY2sgfCBOb2RlRmxhZ3MuT25Jbml0KSkgPiAwKSk7XG4gICAgICB9XG4gICAgICAvLyBXZSB1c2UgYSBjb21tYSBleHByZXNzaW9uIHRvIGNhbGwgdGhlIGxvZyBmdW5jdGlvbiBiZWZvcmVcbiAgICAgIC8vIHRoZSBub2RlRGVmIGZ1bmN0aW9uLCBidXQgc3RpbGwgdXNlIHRoZSByZXN1bHQgb2YgdGhlIG5vZGVEZWYgZnVuY3Rpb25cbiAgICAgIC8vIGFzIHRoZSB2YWx1ZS5cbiAgICAgIC8vIE5vdGU6IFdlIG9ubHkgYWRkIHRoZSBsb2dnZXIgdG8gZWxlbWVudHMgLyB0ZXh0IG5vZGVzLFxuICAgICAgLy8gc28gd2UgZG9uJ3QgZ2VuZXJhdGUgdG9vIG11Y2ggY29kZS5cbiAgICAgIGNvbnN0IGxvZ1dpdGhOb2RlRGVmID0gbm9kZUZsYWdzICYgTm9kZUZsYWdzLkNhdFJlbmRlck5vZGUgP1xuICAgICAgICAgIG5ldyBvLkNvbW1hRXhwcihbTE9HX1ZBUi5jYWxsRm4oW10pLmNhbGxGbihbXSksIG5vZGVEZWZdKSA6XG4gICAgICAgICAgbm9kZURlZjtcbiAgICAgIHJldHVybiBvLmFwcGx5U291cmNlU3BhblRvRXhwcmVzc2lvbklmTmVlZGVkKGxvZ1dpdGhOb2RlRGVmLCBzb3VyY2VTcGFuKTtcbiAgICB9KTtcbiAgICByZXR1cm4ge3VwZGF0ZVJlbmRlcmVyU3RtdHMsIHVwZGF0ZURpcmVjdGl2ZXNTdG10cywgbm9kZURlZkV4cHJzfTtcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVVwZGF0ZVN0YXRlbWVudHMoXG4gICAgICAgIG5vZGVJbmRleDogbnVtYmVyLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgZXhwcmVzc2lvbnM6IFVwZGF0ZUV4cHJlc3Npb25bXSxcbiAgICAgICAgYWxsb3dFbXB0eUV4cHJzOiBib29sZWFuKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgICBjb25zdCB1cGRhdGVTdG10czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgICAgY29uc3QgZXhwcnMgPSBleHByZXNzaW9ucy5tYXAoKHtzb3VyY2VTcGFuLCBjb250ZXh0LCB2YWx1ZX0pID0+IHtcbiAgICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7dXBkYXRlQmluZGluZ0NvdW50Kyt9YDtcbiAgICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gQ09NUF9WQVIgPyBzZWxmIDogbnVsbDtcbiAgICAgICAgY29uc3Qge3N0bXRzLCBjdXJyVmFsRXhwcn0gPVxuICAgICAgICAgICAgY29udmVydFByb3BlcnR5QmluZGluZyhuYW1lUmVzb2x2ZXIsIGNvbnRleHQsIHZhbHVlLCBiaW5kaW5nSWQsIEJpbmRpbmdGb3JtLkdlbmVyYWwpO1xuICAgICAgICB1cGRhdGVTdG10cy5wdXNoKC4uLnN0bXRzLm1hcChcbiAgICAgICAgICAgIChzdG10OiBvLlN0YXRlbWVudCkgPT4gby5hcHBseVNvdXJjZVNwYW5Ub1N0YXRlbWVudElmTmVlZGVkKHN0bXQsIHNvdXJjZVNwYW4pKSk7XG4gICAgICAgIHJldHVybiBvLmFwcGx5U291cmNlU3BhblRvRXhwcmVzc2lvbklmTmVlZGVkKGN1cnJWYWxFeHByLCBzb3VyY2VTcGFuKTtcbiAgICAgIH0pO1xuICAgICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCB8fCBhbGxvd0VtcHR5RXhwcnMpIHtcbiAgICAgICAgdXBkYXRlU3RtdHMucHVzaChvLmFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgICAgICBjYWxsQ2hlY2tTdG10KG5vZGVJbmRleCwgZXhwcnMpLnRvU3RtdCgpLCBzb3VyY2VTcGFuKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdXBkYXRlU3RtdHM7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRWxlbWVudEhhbmRsZUV2ZW50Rm4oXG4gICAgICBub2RlSW5kZXg6IG51bWJlcixcbiAgICAgIGhhbmRsZXJzOiB7Y29udGV4dDogby5FeHByZXNzaW9uLCBldmVudEFzdDogQm91bmRFdmVudEFzdCwgZGlyQXN0OiBEaXJlY3RpdmVBc3R9W10pIHtcbiAgICBjb25zdCBoYW5kbGVFdmVudFN0bXRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gICAgbGV0IGhhbmRsZUV2ZW50QmluZGluZ0NvdW50ID0gMDtcbiAgICBoYW5kbGVycy5mb3JFYWNoKCh7Y29udGV4dCwgZXZlbnRBc3QsIGRpckFzdH0pID0+IHtcbiAgICAgIGNvbnN0IGJpbmRpbmdJZCA9IGAke2hhbmRsZUV2ZW50QmluZGluZ0NvdW50Kyt9YDtcbiAgICAgIGNvbnN0IG5hbWVSZXNvbHZlciA9IGNvbnRleHQgPT09IENPTVBfVkFSID8gdGhpcyA6IG51bGw7XG4gICAgICBjb25zdCB7c3RtdHMsIGFsbG93RGVmYXVsdH0gPVxuICAgICAgICAgIGNvbnZlcnRBY3Rpb25CaW5kaW5nKG5hbWVSZXNvbHZlciwgY29udGV4dCwgZXZlbnRBc3QuaGFuZGxlciwgYmluZGluZ0lkKTtcbiAgICAgIGNvbnN0IHRydWVTdG10cyA9IHN0bXRzO1xuICAgICAgaWYgKGFsbG93RGVmYXVsdCkge1xuICAgICAgICB0cnVlU3RtdHMucHVzaChBTExPV19ERUZBVUxUX1ZBUi5zZXQoYWxsb3dEZWZhdWx0LmFuZChBTExPV19ERUZBVUxUX1ZBUikpLnRvU3RtdCgpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHt0YXJnZXQ6IGV2ZW50VGFyZ2V0LCBuYW1lOiBldmVudE5hbWV9ID0gZWxlbWVudEV2ZW50TmFtZUFuZFRhcmdldChldmVudEFzdCwgZGlyQXN0KTtcbiAgICAgIGNvbnN0IGZ1bGxFdmVudE5hbWUgPSBlbGVtZW50RXZlbnRGdWxsTmFtZShldmVudFRhcmdldCwgZXZlbnROYW1lKTtcbiAgICAgIGhhbmRsZUV2ZW50U3RtdHMucHVzaChvLmFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoXG4gICAgICAgICAgbmV3IG8uSWZTdG10KG8ubGl0ZXJhbChmdWxsRXZlbnROYW1lKS5pZGVudGljYWwoRVZFTlRfTkFNRV9WQVIpLCB0cnVlU3RtdHMpLFxuICAgICAgICAgIGV2ZW50QXN0LnNvdXJjZVNwYW4pKTtcbiAgICB9KTtcbiAgICBsZXQgaGFuZGxlRXZlbnRGbjogby5FeHByZXNzaW9uO1xuICAgIGlmIChoYW5kbGVFdmVudFN0bXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHByZVN0bXRzOiBvLlN0YXRlbWVudFtdID1cbiAgICAgICAgICBbQUxMT1dfREVGQVVMVF9WQVIuc2V0KG8ubGl0ZXJhbCh0cnVlKSkudG9EZWNsU3RtdChvLkJPT0xfVFlQRSldO1xuICAgICAgaWYgKCF0aGlzLmNvbXBvbmVudC5pc0hvc3QgJiYgby5maW5kUmVhZFZhck5hbWVzKGhhbmRsZUV2ZW50U3RtdHMpLmhhcyhDT01QX1ZBUi5uYW1lISkpIHtcbiAgICAgICAgcHJlU3RtdHMucHVzaChDT01QX1ZBUi5zZXQoVklFV19WQVIucHJvcCgnY29tcG9uZW50JykpLnRvRGVjbFN0bXQodGhpcy5jb21wVHlwZSkpO1xuICAgICAgfVxuICAgICAgaGFuZGxlRXZlbnRGbiA9IG8uZm4oXG4gICAgICAgICAgW1xuICAgICAgICAgICAgbmV3IG8uRm5QYXJhbShWSUVXX1ZBUi5uYW1lISwgby5JTkZFUlJFRF9UWVBFKSxcbiAgICAgICAgICAgIG5ldyBvLkZuUGFyYW0oRVZFTlRfTkFNRV9WQVIubmFtZSEsIG8uSU5GRVJSRURfVFlQRSksXG4gICAgICAgICAgICBuZXcgby5GblBhcmFtKEV2ZW50SGFuZGxlclZhcnMuZXZlbnQubmFtZSEsIG8uSU5GRVJSRURfVFlQRSlcbiAgICAgICAgICBdLFxuICAgICAgICAgIFsuLi5wcmVTdG10cywgLi4uaGFuZGxlRXZlbnRTdG10cywgbmV3IG8uUmV0dXJuU3RhdGVtZW50KEFMTE9XX0RFRkFVTFRfVkFSKV0sXG4gICAgICAgICAgby5JTkZFUlJFRF9UWVBFKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlRXZlbnRGbiA9IG8uTlVMTF9FWFBSO1xuICAgIH1cbiAgICByZXR1cm4gaGFuZGxlRXZlbnRGbjtcbiAgfVxuXG4gIHZpc2l0RGlyZWN0aXZlKGFzdDogRGlyZWN0aXZlQXN0LCBjb250ZXh0OiB7dXNlZEV2ZW50czogU2V0PHN0cmluZz59KTogYW55IHt9XG4gIHZpc2l0RGlyZWN0aXZlUHJvcGVydHkoYXN0OiBCb3VuZERpcmVjdGl2ZVByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRSZWZlcmVuY2UoYXN0OiBSZWZlcmVuY2VBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdFZhcmlhYmxlKGFzdDogVmFyaWFibGVBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEV2ZW50KGFzdDogQm91bmRFdmVudEFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0RWxlbWVudFByb3BlcnR5KGFzdDogQm91bmRFbGVtZW50UHJvcGVydHlBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEF0dHIoYXN0OiBBdHRyQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbn1cblxuZnVuY3Rpb24gbmVlZHNBZGRpdGlvbmFsUm9vdE5vZGUoYXN0Tm9kZXM6IFRlbXBsYXRlQXN0W10pOiBib29sZWFuIHtcbiAgY29uc3QgbGFzdEFzdE5vZGUgPSBhc3ROb2Rlc1thc3ROb2Rlcy5sZW5ndGggLSAxXTtcbiAgaWYgKGxhc3RBc3ROb2RlIGluc3RhbmNlb2YgRW1iZWRkZWRUZW1wbGF0ZUFzdCkge1xuICAgIHJldHVybiBsYXN0QXN0Tm9kZS5oYXNWaWV3Q29udGFpbmVyO1xuICB9XG5cbiAgaWYgKGxhc3RBc3ROb2RlIGluc3RhbmNlb2YgRWxlbWVudEFzdCkge1xuICAgIGlmIChpc05nQ29udGFpbmVyKGxhc3RBc3ROb2RlLm5hbWUpICYmIGxhc3RBc3ROb2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIG5lZWRzQWRkaXRpb25hbFJvb3ROb2RlKGxhc3RBc3ROb2RlLmNoaWxkcmVuKTtcbiAgICB9XG4gICAgcmV0dXJuIGxhc3RBc3ROb2RlLmhhc1ZpZXdDb250YWluZXI7XG4gIH1cblxuICByZXR1cm4gbGFzdEFzdE5vZGUgaW5zdGFuY2VvZiBOZ0NvbnRlbnRBc3Q7XG59XG5cblxuZnVuY3Rpb24gZWxlbWVudEJpbmRpbmdEZWYoaW5wdXRBc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBkaXJBc3Q6IERpcmVjdGl2ZUFzdCk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGlucHV0VHlwZSA9IGlucHV0QXN0LnR5cGU7XG4gIHN3aXRjaCAoaW5wdXRUeXBlKSB7XG4gICAgY2FzZSBQcm9wZXJ0eUJpbmRpbmdUeXBlLkF0dHJpYnV0ZTpcbiAgICAgIHJldHVybiBvLmxpdGVyYWxBcnIoW1xuICAgICAgICBvLmxpdGVyYWwoQmluZGluZ0ZsYWdzLlR5cGVFbGVtZW50QXR0cmlidXRlKSwgby5saXRlcmFsKGlucHV0QXN0Lm5hbWUpLFxuICAgICAgICBvLmxpdGVyYWwoaW5wdXRBc3Quc2VjdXJpdHlDb250ZXh0KVxuICAgICAgXSk7XG4gICAgY2FzZSBQcm9wZXJ0eUJpbmRpbmdUeXBlLlByb3BlcnR5OlxuICAgICAgcmV0dXJuIG8ubGl0ZXJhbEFycihbXG4gICAgICAgIG8ubGl0ZXJhbChCaW5kaW5nRmxhZ3MuVHlwZVByb3BlcnR5KSwgby5saXRlcmFsKGlucHV0QXN0Lm5hbWUpLFxuICAgICAgICBvLmxpdGVyYWwoaW5wdXRBc3Quc2VjdXJpdHlDb250ZXh0KVxuICAgICAgXSk7XG4gICAgY2FzZSBQcm9wZXJ0eUJpbmRpbmdUeXBlLkFuaW1hdGlvbjpcbiAgICAgIGNvbnN0IGJpbmRpbmdUeXBlID0gQmluZGluZ0ZsYWdzLlR5cGVQcm9wZXJ0eSB8XG4gICAgICAgICAgKGRpckFzdCAmJiBkaXJBc3QuZGlyZWN0aXZlLmlzQ29tcG9uZW50ID8gQmluZGluZ0ZsYWdzLlN5bnRoZXRpY0hvc3RQcm9wZXJ0eSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQmluZGluZ0ZsYWdzLlN5bnRoZXRpY1Byb3BlcnR5KTtcbiAgICAgIHJldHVybiBvLmxpdGVyYWxBcnIoW1xuICAgICAgICBvLmxpdGVyYWwoYmluZGluZ1R5cGUpLCBvLmxpdGVyYWwoJ0AnICsgaW5wdXRBc3QubmFtZSksIG8ubGl0ZXJhbChpbnB1dEFzdC5zZWN1cml0eUNvbnRleHQpXG4gICAgICBdKTtcbiAgICBjYXNlIFByb3BlcnR5QmluZGluZ1R5cGUuQ2xhc3M6XG4gICAgICByZXR1cm4gby5saXRlcmFsQXJyKFxuICAgICAgICAgIFtvLmxpdGVyYWwoQmluZGluZ0ZsYWdzLlR5cGVFbGVtZW50Q2xhc3MpLCBvLmxpdGVyYWwoaW5wdXRBc3QubmFtZSksIG8uTlVMTF9FWFBSXSk7XG4gICAgY2FzZSBQcm9wZXJ0eUJpbmRpbmdUeXBlLlN0eWxlOlxuICAgICAgcmV0dXJuIG8ubGl0ZXJhbEFycihbXG4gICAgICAgIG8ubGl0ZXJhbChCaW5kaW5nRmxhZ3MuVHlwZUVsZW1lbnRTdHlsZSksIG8ubGl0ZXJhbChpbnB1dEFzdC5uYW1lKSwgby5saXRlcmFsKGlucHV0QXN0LnVuaXQpXG4gICAgICBdKTtcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gVGhpcyBkZWZhdWx0IGNhc2UgaXMgbm90IG5lZWRlZCBieSBUeXBlU2NyaXB0IGNvbXBpbGVyLCBhcyB0aGUgc3dpdGNoIGlzIGV4aGF1c3RpdmUuXG4gICAgICAvLyBIb3dldmVyIENsb3N1cmUgQ29tcGlsZXIgZG9lcyBub3QgdW5kZXJzdGFuZCB0aGF0IGFuZCByZXBvcnRzIGFuIGVycm9yIGluIHR5cGVkIG1vZGUuXG4gICAgICAvLyBUaGUgYHRocm93IG5ldyBFcnJvcmAgYmVsb3cgd29ya3MgYXJvdW5kIHRoZSBwcm9ibGVtLCBhbmQgdGhlIHVuZXhwZWN0ZWQ6IG5ldmVyIHZhcmlhYmxlXG4gICAgICAvLyBtYWtlcyBzdXJlIHRzYyBzdGlsbCBjaGVja3MgdGhpcyBjb2RlIGlzIHVucmVhY2hhYmxlLlxuICAgICAgY29uc3QgdW5leHBlY3RlZDogbmV2ZXIgPSBpbnB1dFR5cGU7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHVuZXhwZWN0ZWQgJHt1bmV4cGVjdGVkfWApO1xuICB9XG59XG5cblxuZnVuY3Rpb24gZml4ZWRBdHRyc0RlZihlbGVtZW50QXN0OiBFbGVtZW50QXN0KTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgbWFwUmVzdWx0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGVsZW1lbnRBc3QuYXR0cnMuZm9yRWFjaChhdHRyQXN0ID0+IHtcbiAgICBtYXBSZXN1bHRbYXR0ckFzdC5uYW1lXSA9IGF0dHJBc3QudmFsdWU7XG4gIH0pO1xuICBlbGVtZW50QXN0LmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJBc3QgPT4ge1xuICAgIE9iamVjdC5rZXlzKGRpckFzdC5kaXJlY3RpdmUuaG9zdEF0dHJpYnV0ZXMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGRpckFzdC5kaXJlY3RpdmUuaG9zdEF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICBjb25zdCBwcmV2VmFsdWUgPSBtYXBSZXN1bHRbbmFtZV07XG4gICAgICBtYXBSZXN1bHRbbmFtZV0gPSBwcmV2VmFsdWUgIT0gbnVsbCA/IG1lcmdlQXR0cmlidXRlVmFsdWUobmFtZSwgcHJldlZhbHVlLCB2YWx1ZSkgOiB2YWx1ZTtcbiAgICB9KTtcbiAgfSk7XG4gIC8vIE5vdGU6IFdlIG5lZWQgdG8gc29ydCB0byBnZXQgYSBkZWZpbmVkIG91dHB1dCBvcmRlclxuICAvLyBmb3IgdGVzdHMgYW5kIGZvciBjYWNoaW5nIGdlbmVyYXRlZCBhcnRpZmFjdHMuLi5cbiAgcmV0dXJuIG8ubGl0ZXJhbEFycihPYmplY3Qua2V5cyhtYXBSZXN1bHQpLnNvcnQoKS5tYXAoXG4gICAgICAoYXR0ck5hbWUpID0+IG8ubGl0ZXJhbEFycihbby5saXRlcmFsKGF0dHJOYW1lKSwgby5saXRlcmFsKG1hcFJlc3VsdFthdHRyTmFtZV0pXSkpKTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VBdHRyaWJ1dGVWYWx1ZShhdHRyTmFtZTogc3RyaW5nLCBhdHRyVmFsdWUxOiBzdHJpbmcsIGF0dHJWYWx1ZTI6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChhdHRyTmFtZSA9PSBDTEFTU19BVFRSIHx8IGF0dHJOYW1lID09IFNUWUxFX0FUVFIpIHtcbiAgICByZXR1cm4gYCR7YXR0clZhbHVlMX0gJHthdHRyVmFsdWUyfWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGF0dHJWYWx1ZTI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsbENoZWNrU3RtdChub2RlSW5kZXg6IG51bWJlciwgZXhwcnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgaWYgKGV4cHJzLmxlbmd0aCA+IDEwKSB7XG4gICAgcmV0dXJuIENIRUNLX1ZBUi5jYWxsRm4oXG4gICAgICAgIFtWSUVXX1ZBUiwgby5saXRlcmFsKG5vZGVJbmRleCksIG8ubGl0ZXJhbChBcmd1bWVudFR5cGUuRHluYW1pYyksIG8ubGl0ZXJhbEFycihleHBycyldKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gQ0hFQ0tfVkFSLmNhbGxGbihcbiAgICAgICAgW1ZJRVdfVkFSLCBvLmxpdGVyYWwobm9kZUluZGV4KSwgby5saXRlcmFsKEFyZ3VtZW50VHlwZS5JbmxpbmUpLCAuLi5leHByc10pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVsZW1lbnRFdmVudE5hbWVBbmRUYXJnZXQoXG4gICAgZXZlbnRBc3Q6IEJvdW5kRXZlbnRBc3QsIGRpckFzdDogRGlyZWN0aXZlQXN0fG51bGwpOiB7bmFtZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZ3xudWxsfSB7XG4gIGlmIChldmVudEFzdC5pc0FuaW1hdGlvbikge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiBgQCR7ZXZlbnRBc3QubmFtZX0uJHtldmVudEFzdC5waGFzZX1gLFxuICAgICAgdGFyZ2V0OiBkaXJBc3QgJiYgZGlyQXN0LmRpcmVjdGl2ZS5pc0NvbXBvbmVudCA/ICdjb21wb25lbnQnIDogbnVsbFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGV2ZW50QXN0O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGNRdWVyeUZsYWdzKHF1ZXJ5OiBDb21waWxlUXVlcnlNZXRhZGF0YSkge1xuICBsZXQgZmxhZ3MgPSBOb2RlRmxhZ3MuTm9uZTtcbiAgLy8gTm90ZTogV2Ugb25seSBtYWtlIHF1ZXJpZXMgc3RhdGljIHRoYXQgcXVlcnkgZm9yIGEgc2luZ2xlIGl0ZW0gYW5kIHRoZSB1c2VyIHNwZWNpZmljYWxseVxuICAvLyBzZXQgdGhlIHRvIGJlIHN0YXRpYy4gVGhpcyBpcyBiZWNhdXNlIG9mIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggdGhlIG9sZCB2aWV3IGNvbXBpbGVyLi4uXG4gIGlmIChxdWVyeS5maXJzdCAmJiBxdWVyeS5zdGF0aWMpIHtcbiAgICBmbGFncyB8PSBOb2RlRmxhZ3MuU3RhdGljUXVlcnk7XG4gIH0gZWxzZSB7XG4gICAgZmxhZ3MgfD0gTm9kZUZsYWdzLkR5bmFtaWNRdWVyeTtcbiAgfVxuICBpZiAocXVlcnkuZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkpIHtcbiAgICBmbGFncyB8PSBOb2RlRmxhZ3MuRW1pdERpc3RpbmN0Q2hhbmdlc09ubHk7XG4gIH1cbiAgcmV0dXJuIGZsYWdzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudEV2ZW50RnVsbE5hbWUodGFyZ2V0OiBzdHJpbmd8bnVsbCwgbmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRhcmdldCA/IGAke3RhcmdldH06JHtuYW1lfWAgOiBuYW1lO1xufVxuIl19