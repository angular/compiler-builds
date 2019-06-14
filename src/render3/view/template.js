/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
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
        define("@angular/compiler/src/render3/view/template", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/template_parser/binding_parser", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_template_transform", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/i18n/context", "@angular/compiler/src/render3/view/i18n/meta", "@angular/compiler/src/render3/view/i18n/serializer", "@angular/compiler/src/render3/view/i18n/util", "@angular/compiler/src/render3/view/styling_builder", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var lexer_1 = require("@angular/compiler/src/expression_parser/lexer");
    var parser_1 = require("@angular/compiler/src/expression_parser/parser");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_parser_1 = require("@angular/compiler/src/ml_parser/html_parser");
    var html_whitespaces_1 = require("@angular/compiler/src/ml_parser/html_whitespaces");
    var interpolation_config_1 = require("@angular/compiler/src/ml_parser/interpolation_config");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var map_util_1 = require("@angular/compiler/src/output/map_util");
    var o = require("@angular/compiler/src/output/output_ast");
    var dom_element_schema_registry_1 = require("@angular/compiler/src/schema/dom_element_schema_registry");
    var selector_1 = require("@angular/compiler/src/selector");
    var binding_parser_1 = require("@angular/compiler/src/template_parser/binding_parser");
    var util_1 = require("@angular/compiler/src/util");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var r3_template_transform_1 = require("@angular/compiler/src/render3/r3_template_transform");
    var util_2 = require("@angular/compiler/src/render3/util");
    var context_1 = require("@angular/compiler/src/render3/view/i18n/context");
    var meta_1 = require("@angular/compiler/src/render3/view/i18n/meta");
    var serializer_1 = require("@angular/compiler/src/render3/view/i18n/serializer");
    var util_3 = require("@angular/compiler/src/render3/view/i18n/util");
    var styling_builder_1 = require("@angular/compiler/src/render3/view/styling_builder");
    var util_4 = require("@angular/compiler/src/render3/view/util");
    // Selector attribute name of `<ng-content>`
    var NG_CONTENT_SELECT_ATTR = 'select';
    // Attribute name of `ngProjectAs`.
    var NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
    // List of supported global targets for event listeners
    var GLOBAL_TARGET_RESOLVERS = new Map([['window', r3_identifiers_1.Identifiers.resolveWindow], ['document', r3_identifiers_1.Identifiers.resolveDocument], ['body', r3_identifiers_1.Identifiers.resolveBody]]);
    var LEADING_TRIVIA_CHARS = [' ', '\n', '\r', '\t'];
    //  if (rf & flags) { .. }
    function renderFlagCheckIfStmt(flags, statements) {
        return o.ifStmt(o.variable(util_4.RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
    }
    exports.renderFlagCheckIfStmt = renderFlagCheckIfStmt;
    function prepareEventListenerParameters(eventAst, handlerName, scope) {
        if (handlerName === void 0) { handlerName = null; }
        if (scope === void 0) { scope = null; }
        var type = eventAst.type, name = eventAst.name, target = eventAst.target, phase = eventAst.phase, handler = eventAst.handler;
        if (target && !GLOBAL_TARGET_RESOLVERS.has(target)) {
            throw new Error("Unexpected global target '" + target + "' defined for '" + name + "' event.\n        Supported list of global targets: " + Array.from(GLOBAL_TARGET_RESOLVERS.keys()) + ".");
        }
        var implicitReceiverExpr = (scope === null || scope.bindingLevel === 0) ?
            o.variable(util_4.CONTEXT_NAME) :
            scope.getOrCreateSharedContextVar(0);
        var bindingExpr = expression_converter_1.convertActionBinding(scope, implicitReceiverExpr, handler, 'b', function () { return util_1.error('Unexpected interpolation'); }, eventAst.handlerSpan);
        var statements = [];
        if (scope) {
            statements.push.apply(statements, tslib_1.__spread(scope.restoreViewStatement()));
            statements.push.apply(statements, tslib_1.__spread(scope.variableDeclarations()));
        }
        statements.push.apply(statements, tslib_1.__spread(bindingExpr.render3Stmts));
        var eventName = type === 1 /* Animation */ ? util_2.prepareSyntheticListenerName(name, phase) : name;
        var fnName = handlerName && compile_metadata_1.sanitizeIdentifier(handlerName);
        var fnArgs = [new o.FnParam('$event', o.DYNAMIC_TYPE)];
        var handlerFn = o.fn(fnArgs, statements, o.INFERRED_TYPE, null, fnName);
        var params = [o.literal(eventName), handlerFn];
        if (target) {
            params.push(o.literal(false), // `useCapture` flag, defaults to `false`
            o.importExpr(GLOBAL_TARGET_RESOLVERS.get(target)));
        }
        return params;
    }
    exports.prepareEventListenerParameters = prepareEventListenerParameters;
    var TemplateDefinitionBuilder = /** @class */ (function () {
        function TemplateDefinitionBuilder(constantPool, parentBindingScope, level, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds) {
            var _this = this;
            if (level === void 0) { level = 0; }
            this.constantPool = constantPool;
            this.level = level;
            this.contextName = contextName;
            this.i18nContext = i18nContext;
            this.templateIndex = templateIndex;
            this.templateName = templateName;
            this.directiveMatcher = directiveMatcher;
            this.directives = directives;
            this.pipeTypeByName = pipeTypeByName;
            this.pipes = pipes;
            this._namespace = _namespace;
            this.relativeContextFilePath = relativeContextFilePath;
            this.i18nUseExternalIds = i18nUseExternalIds;
            this._dataIndex = 0;
            this._bindingContext = 0;
            this._prefixCode = [];
            /**
             * List of callbacks to generate creation mode instructions. We store them here as we process
             * the template so bindings in listeners are resolved only once all nodes have been visited.
             * This ensures all local refs and context variables are available for matching.
             */
            this._creationCodeFns = [];
            /**
             * List of callbacks to generate update mode instructions. We store them here as we process
             * the template so bindings are resolved only once all nodes have been visited. This ensures
             * all local refs and context variables are available for matching.
             */
            this._updateCodeFns = [];
            /**
             * Memorizes the last node index for which a select instruction has been generated.
             * We're initializing this to -1 to ensure the `select(0)` instruction is generated before any
             * relevant update instructions.
             */
            this._lastNodeIndexWithFlush = -1;
            /** Temporary variable declarations generated from visiting pipes, literals, etc. */
            this._tempVariables = [];
            /**
             * List of callbacks to build nested templates. Nested templates must not be visited until
             * after the parent template has finished visiting all of its nodes. This ensures that all
             * local ref bindings in nested templates are able to find local ref values if the refs
             * are defined after the template declaration.
             */
            this._nestedTemplateFns = [];
            this._unsupported = util_4.unsupported;
            // i18n context local to this template
            this.i18n = null;
            // Number of slots to reserve for pureFunctions
            this._pureFunctionSlots = 0;
            // Number of binding slots
            this._bindingSlots = 0;
            // Projection slots found in the template. Projection slots can distribute projected
            // nodes based on a selector, or can just use the wildcard selector to match
            // all nodes which aren't matching any selector.
            this._ngContentReservedSlots = [];
            // Number of non-default selectors found in all parent templates of this template. We need to
            // track it to properly adjust projection slot index in the `projection` instruction.
            this._ngContentSelectorsOffset = 0;
            // Expression that should be used as implicit receiver when converting template
            // expressions to output AST.
            this._implicitReceiverExpr = null;
            // These should be handled in the template or element directly.
            this.visitReference = util_4.invalid;
            this.visitVariable = util_4.invalid;
            this.visitTextAttribute = util_4.invalid;
            this.visitBoundAttribute = util_4.invalid;
            this.visitBoundEvent = util_4.invalid;
            this._bindingScope = parentBindingScope.nestedScope(level);
            // Turn the relative context file path into an identifier by replacing non-alphanumeric
            // characters with underscores.
            this.fileBasedI18nSuffix = relativeContextFilePath.replace(/[^A-Za-z0-9]/g, '_') + '_';
            this._valueConverter = new ValueConverter(constantPool, function () { return _this.allocateDataSlot(); }, function (numSlots) { return _this.allocatePureFunctionSlots(numSlots); }, function (name, localName, slot, value) {
                var pipeType = pipeTypeByName.get(name);
                if (pipeType) {
                    _this.pipes.add(pipeType);
                }
                _this._bindingScope.set(_this.level, localName, value);
                _this.creationInstruction(null, r3_identifiers_1.Identifiers.pipe, [o.literal(slot), o.literal(name)]);
            });
        }
        TemplateDefinitionBuilder.prototype.registerContextVariables = function (variable) {
            var scopedName = this._bindingScope.freshReferenceName();
            var retrievalLevel = this.level;
            var lhs = o.variable(variable.name + scopedName);
            this._bindingScope.set(retrievalLevel, variable.name, lhs, 1 /* CONTEXT */, function (scope, relativeLevel) {
                var rhs;
                if (scope.bindingLevel === retrievalLevel) {
                    // e.g. ctx
                    rhs = o.variable(util_4.CONTEXT_NAME);
                }
                else {
                    var sharedCtxVar = scope.getSharedContextName(retrievalLevel);
                    // e.g. ctx_r0   OR  x(2);
                    rhs = sharedCtxVar ? sharedCtxVar : generateNextContextExpr(relativeLevel);
                }
                // e.g. const $item$ = x(2).$implicit;
                return [lhs.set(rhs.prop(variable.value || util_4.IMPLICIT_REFERENCE)).toConstDecl()];
            });
        };
        TemplateDefinitionBuilder.prototype.buildTemplateFunction = function (nodes, variables, ngContentSelectorsOffset, i18n) {
            var _this = this;
            if (ngContentSelectorsOffset === void 0) { ngContentSelectorsOffset = 0; }
            this._ngContentSelectorsOffset = ngContentSelectorsOffset;
            if (this._namespace !== r3_identifiers_1.Identifiers.namespaceHTML) {
                this.creationInstruction(null, this._namespace);
            }
            // Create variable bindings
            variables.forEach(function (v) { return _this.registerContextVariables(v); });
            // Initiate i18n context in case:
            // - this template has parent i18n context
            // - or the template has i18n meta associated with it,
            //   but it's not initiated by the Element (e.g. <ng-template i18n>)
            var initI18nContext = this.i18nContext || (util_3.isI18nRootNode(i18n) && !util_3.isSingleI18nIcu(i18n) &&
                !(isSingleElementTemplate(nodes) && nodes[0].i18n === i18n));
            var selfClosingI18nInstruction = hasTextChildrenOnly(nodes);
            if (initI18nContext) {
                this.i18nStart(null, i18n, selfClosingI18nInstruction);
            }
            // This is the initial pass through the nodes of this template. In this pass, we
            // queue all creation mode and update mode instructions for generation in the second
            // pass. It's necessary to separate the passes to ensure local refs are defined before
            // resolving bindings. We also count bindings in this pass as we walk bound expressions.
            t.visitAll(this, nodes);
            // Add total binding count to pure function count so pure function instructions are
            // generated with the correct slot offset when update instructions are processed.
            this._pureFunctionSlots += this._bindingSlots;
            // Pipes are walked in the first pass (to enqueue `pipe()` creation instructions and
            // `pipeBind` update instructions), so we have to update the slot offsets manually
            // to account for bindings.
            this._valueConverter.updatePipeSlotOffsets(this._bindingSlots);
            // Nested templates must be processed before creation instructions so template()
            // instructions can be generated with the correct internal const count.
            this._nestedTemplateFns.forEach(function (buildTemplateFn) { return buildTemplateFn(); });
            // Output the `projectionDef` instruction when some `<ng-content>` tags are present.
            // The `projectionDef` instruction is only emitted for the component template and
            // is skipped for nested templates (<ng-template> tags).
            if (this.level === 0 && this._ngContentReservedSlots.length) {
                var parameters = [];
                // By default the `projectionDef` instructions creates one slot for the wildcard
                // selector if no parameters are passed. Therefore we only want to allocate a new
                // array for the projection slots if the default projection slot is not sufficient.
                if (this._ngContentReservedSlots.length > 1 || this._ngContentReservedSlots[0] !== '*') {
                    var r3ReservedSlots = this._ngContentReservedSlots.map(function (s) { return s !== '*' ? core.parseSelectorToR3Selector(s) : s; });
                    parameters.push(this.constantPool.getConstLiteral(util_4.asLiteral(r3ReservedSlots), true));
                }
                // Since we accumulate ngContent selectors while processing template elements,
                // we *prepend* `projectionDef` to creation instructions block, to put it before
                // any `projection` instructions
                this.creationInstruction(null, r3_identifiers_1.Identifiers.projectionDef, parameters, /* prepend */ true);
            }
            if (initI18nContext) {
                this.i18nEnd(null, selfClosingI18nInstruction);
            }
            // Generate all the creation mode instructions (e.g. resolve bindings in listeners)
            var creationStatements = this._creationCodeFns.map(function (fn) { return fn(); });
            // Generate all the update mode instructions (e.g. resolve property or text bindings)
            var updateStatements = this._updateCodeFns.map(function (fn) { return fn(); });
            //  Variable declaration must occur after binding resolution so we can generate context
            //  instructions that build on each other.
            // e.g. const b = nextContext().$implicit(); const b = nextContext();
            var creationVariables = this._bindingScope.viewSnapshotStatements();
            var updateVariables = this._bindingScope.variableDeclarations().concat(this._tempVariables);
            var creationBlock = creationStatements.length > 0 ?
                [renderFlagCheckIfStmt(1 /* Create */, creationVariables.concat(creationStatements))] :
                [];
            var updateBlock = updateStatements.length > 0 ?
                [renderFlagCheckIfStmt(2 /* Update */, updateVariables.concat(updateStatements))] :
                [];
            return o.fn(
            // i.e. (rf: RenderFlags, ctx: any)
            [new o.FnParam(util_4.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_4.CONTEXT_NAME, null)], tslib_1.__spread(this._prefixCode, creationBlock, updateBlock), o.INFERRED_TYPE, null, this.templateName);
        };
        // LocalResolver
        TemplateDefinitionBuilder.prototype.getLocal = function (name) { return this._bindingScope.get(name); };
        // LocalResolver
        TemplateDefinitionBuilder.prototype.notifyImplicitReceiverUse = function () { this._bindingScope.notifyImplicitReceiverUse(); };
        TemplateDefinitionBuilder.prototype.i18nTranslate = function (message, params, ref, transformFn) {
            var _a;
            if (params === void 0) { params = {}; }
            var _ref = ref || o.variable(this.constantPool.uniqueName(util_3.TRANSLATION_PREFIX));
            // Closure Compiler requires const names to start with `MSG_` but disallows any other const to
            // start with `MSG_`. We define a variable starting with `MSG_` just for the `goog.getMsg` call
            var closureVar = this.i18nGenerateClosureVar(message.id);
            var _params = {};
            if (params && Object.keys(params).length) {
                Object.keys(params).forEach(function (key) { return _params[util_3.formatI18nPlaceholderName(key)] = params[key]; });
            }
            var meta = util_3.metaFromI18nMessage(message);
            var content = serializer_1.getSerializedI18nContent(message);
            var statements = util_3.getTranslationDeclStmts(_ref, closureVar, content, meta, _params, transformFn);
            (_a = this.constantPool.statements).push.apply(_a, tslib_1.__spread(statements));
            return _ref;
        };
        TemplateDefinitionBuilder.prototype.i18nAppendBindings = function (expressions) {
            var _this = this;
            if (expressions.length > 0) {
                expressions.forEach(function (expression) { return _this.i18n.appendBinding(expression); });
            }
        };
        TemplateDefinitionBuilder.prototype.i18nBindProps = function (props) {
            var _this = this;
            var bound = {};
            Object.keys(props).forEach(function (key) {
                var prop = props[key];
                if (prop instanceof t.Text) {
                    bound[key] = o.literal(prop.value);
                }
                else {
                    var value = prop.value.visit(_this._valueConverter);
                    _this.allocateBindingSlots(value);
                    if (value instanceof ast_1.Interpolation) {
                        var strings = value.strings, expressions = value.expressions;
                        var _a = _this.i18n, id = _a.id, bindings = _a.bindings;
                        var label = util_3.assembleI18nBoundString(strings, bindings.size, id);
                        _this.i18nAppendBindings(expressions);
                        bound[key] = o.literal(label);
                    }
                }
            });
            return bound;
        };
        TemplateDefinitionBuilder.prototype.i18nGenerateClosureVar = function (messageId) {
            var name;
            var suffix = this.fileBasedI18nSuffix.toUpperCase();
            if (this.i18nUseExternalIds) {
                var prefix = util_3.getTranslationConstPrefix("EXTERNAL_");
                var uniqueSuffix = this.constantPool.uniqueName(suffix);
                name = "" + prefix + compile_metadata_1.sanitizeIdentifier(messageId) + "$$" + uniqueSuffix;
            }
            else {
                var prefix = util_3.getTranslationConstPrefix(suffix);
                name = this.constantPool.uniqueName(prefix);
            }
            return o.variable(name);
        };
        TemplateDefinitionBuilder.prototype.i18nUpdateRef = function (context) {
            var icus = context.icus, meta = context.meta, isRoot = context.isRoot, isResolved = context.isResolved, isEmitted = context.isEmitted;
            if (isRoot && isResolved && !isEmitted && !util_3.isSingleI18nIcu(meta)) {
                context.isEmitted = true;
                var placeholders = context.getSerializedPlaceholders();
                var icuMapping_1 = {};
                var params_1 = placeholders.size ? util_3.placeholdersToParams(placeholders) : {};
                if (icus.size) {
                    icus.forEach(function (refs, key) {
                        if (refs.length === 1) {
                            // if we have one ICU defined for a given
                            // placeholder - just output its reference
                            params_1[key] = refs[0];
                        }
                        else {
                            // ... otherwise we need to activate post-processing
                            // to replace ICU placeholders with proper values
                            var placeholder = util_3.wrapI18nPlaceholder("" + util_3.I18N_ICU_MAPPING_PREFIX + key);
                            params_1[key] = o.literal(placeholder);
                            icuMapping_1[key] = o.literalArr(refs);
                        }
                    });
                }
                // translation requires post processing in 2 cases:
                // - if we have placeholders with multiple values (ex. `START_DIV`: [�#1�, �#2�, ...])
                // - if we have multiple ICUs that refer to the same placeholder name
                var needsPostprocessing = Array.from(placeholders.values()).some(function (value) { return value.length > 1; }) ||
                    Object.keys(icuMapping_1).length;
                var transformFn = void 0;
                if (needsPostprocessing) {
                    transformFn = function (raw) {
                        var args = [raw];
                        if (Object.keys(icuMapping_1).length) {
                            args.push(map_util_1.mapLiteral(icuMapping_1, true));
                        }
                        return instruction(null, r3_identifiers_1.Identifiers.i18nPostprocess, args);
                    };
                }
                this.i18nTranslate(meta, params_1, context.ref, transformFn);
            }
        };
        TemplateDefinitionBuilder.prototype.i18nStart = function (span, meta, selfClosing) {
            if (span === void 0) { span = null; }
            var index = this.allocateDataSlot();
            if (this.i18nContext) {
                this.i18n = this.i18nContext.forkChildContext(index, this.templateIndex, meta);
            }
            else {
                var ref_1 = o.variable(this.constantPool.uniqueName(util_3.TRANSLATION_PREFIX));
                this.i18n = new context_1.I18nContext(index, ref_1, 0, this.templateIndex, meta);
            }
            // generate i18nStart instruction
            var _a = this.i18n, id = _a.id, ref = _a.ref;
            var params = [o.literal(index), ref];
            if (id > 0) {
                // do not push 3rd argument (sub-block id)
                // into i18nStart call for top level i18n context
                params.push(o.literal(id));
            }
            this.creationInstruction(span, selfClosing ? r3_identifiers_1.Identifiers.i18n : r3_identifiers_1.Identifiers.i18nStart, params);
        };
        TemplateDefinitionBuilder.prototype.i18nEnd = function (span, selfClosing) {
            var _this = this;
            if (span === void 0) { span = null; }
            if (!this.i18n) {
                throw new Error('i18nEnd is executed with no i18n context present');
            }
            if (this.i18nContext) {
                this.i18nContext.reconcileChildContext(this.i18n);
                this.i18nUpdateRef(this.i18nContext);
            }
            else {
                this.i18nUpdateRef(this.i18n);
            }
            // setup accumulated bindings
            var _a = this.i18n, index = _a.index, bindings = _a.bindings;
            if (bindings.size) {
                bindings.forEach(function (binding) {
                    _this.updateInstruction(index, span, r3_identifiers_1.Identifiers.i18nExp, function () { return [_this.convertPropertyBinding(binding)]; });
                });
                this.updateInstruction(index, span, r3_identifiers_1.Identifiers.i18nApply, [o.literal(index)]);
            }
            if (!selfClosing) {
                this.creationInstruction(span, r3_identifiers_1.Identifiers.i18nEnd);
            }
            this.i18n = null; // reset local i18n context
        };
        TemplateDefinitionBuilder.prototype.visitContent = function (ngContent) {
            var slot = this.allocateDataSlot();
            var projectionSlotIdx = this._ngContentSelectorsOffset + this._ngContentReservedSlots.length;
            var parameters = [o.literal(slot)];
            var attributes = [];
            this._ngContentReservedSlots.push(ngContent.selector);
            ngContent.attributes.forEach(function (attribute) {
                var name = attribute.name, value = attribute.value;
                if (name === NG_PROJECT_AS_ATTR_NAME) {
                    attributes.push.apply(attributes, tslib_1.__spread(getNgProjectAsLiteral(attribute)));
                }
                else if (name.toLowerCase() !== NG_CONTENT_SELECT_ATTR) {
                    attributes.push(o.literal(name), o.literal(value));
                }
            });
            if (attributes.length > 0) {
                parameters.push(o.literal(projectionSlotIdx), o.literalArr(attributes));
            }
            else if (projectionSlotIdx !== 0) {
                parameters.push(o.literal(projectionSlotIdx));
            }
            this.creationInstruction(ngContent.sourceSpan, r3_identifiers_1.Identifiers.projection, parameters);
            if (this.i18n) {
                this.i18n.appendProjection(ngContent.i18n, slot);
            }
        };
        TemplateDefinitionBuilder.prototype.getNamespaceInstruction = function (namespaceKey) {
            switch (namespaceKey) {
                case 'math':
                    return r3_identifiers_1.Identifiers.namespaceMathML;
                case 'svg':
                    return r3_identifiers_1.Identifiers.namespaceSVG;
                default:
                    return r3_identifiers_1.Identifiers.namespaceHTML;
            }
        };
        TemplateDefinitionBuilder.prototype.addNamespaceInstruction = function (nsInstruction, element) {
            this._namespace = nsInstruction;
            this.creationInstruction(element.sourceSpan, nsInstruction);
        };
        TemplateDefinitionBuilder.prototype.visitElement = function (element) {
            var _this = this;
            var e_1, _a;
            var elementIndex = this.allocateDataSlot();
            var stylingBuilder = new styling_builder_1.StylingBuilder(o.literal(elementIndex), null);
            var isNonBindableMode = false;
            var isI18nRootElement = util_3.isI18nRootNode(element.i18n) && !util_3.isSingleI18nIcu(element.i18n);
            if (isI18nRootElement && this.i18n) {
                throw new Error("Could not mark an element as translatable inside of a translatable section");
            }
            var i18nAttrs = [];
            var outputAttrs = [];
            var _b = tslib_1.__read(tags_1.splitNsName(element.name), 2), namespaceKey = _b[0], elementName = _b[1];
            var isNgContainer = tags_1.isNgContainer(element.name);
            try {
                // Handle styling, i18n, ngNonBindable attributes
                for (var _c = tslib_1.__values(element.attributes), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var attr = _d.value;
                    var name_1 = attr.name, value = attr.value;
                    if (name_1 === util_4.NON_BINDABLE_ATTR) {
                        isNonBindableMode = true;
                    }
                    else if (name_1 === 'style') {
                        stylingBuilder.registerStyleAttr(value);
                    }
                    else if (name_1 === 'class') {
                        stylingBuilder.registerClassAttr(value);
                    }
                    else {
                        if (attr.i18n) {
                            // Place attributes into a separate array for i18n processing, but also keep such
                            // attributes in the main list to make them available for directive matching at runtime.
                            // TODO(FW-1248): prevent attributes duplication in `i18nAttributes` and `elementStart`
                            // arguments
                            i18nAttrs.push(attr);
                        }
                        else {
                            outputAttrs.push(attr);
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Match directives on non i18n attributes
            this.matchDirectives(element.name, element);
            // Regular element or ng-container creation mode
            var parameters = [o.literal(elementIndex)];
            if (!isNgContainer) {
                parameters.push(o.literal(elementName));
            }
            // Add the attributes
            var attributes = [];
            var allOtherInputs = [];
            element.inputs.forEach(function (input) {
                var stylingInputWasSet = stylingBuilder.registerBoundInput(input);
                if (!stylingInputWasSet) {
                    if (input.type === 0 /* Property */ && input.i18n) {
                        // Place attributes into a separate array for i18n processing, but also keep such
                        // attributes in the main list to make them available for directive matching at runtime.
                        // TODO(FW-1248): prevent attributes duplication in `i18nAttributes` and `elementStart`
                        // arguments
                        i18nAttrs.push(input);
                    }
                    else {
                        allOtherInputs.push(input);
                    }
                }
            });
            outputAttrs.forEach(function (attr) {
                if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                    attributes.push.apply(attributes, tslib_1.__spread(getNgProjectAsLiteral(attr)));
                }
                else {
                    attributes.push.apply(attributes, tslib_1.__spread(getAttributeNameLiterals(attr.name), [o.literal(attr.value)]));
                }
            });
            // add attributes for directive and projection matching purposes
            attributes.push.apply(attributes, tslib_1.__spread(this.prepareNonRenderAttrs(allOtherInputs, element.outputs, stylingBuilder, [], i18nAttrs)));
            parameters.push(this.toAttrsParam(attributes));
            // local refs (ex.: <div #foo #bar="baz">)
            parameters.push(this.prepareRefsParameter(element.references));
            var wasInNamespace = this._namespace;
            var currentNamespace = this.getNamespaceInstruction(namespaceKey);
            // If the namespace is changing now, include an instruction to change it
            // during element creation.
            if (currentNamespace !== wasInNamespace) {
                this.addNamespaceInstruction(currentNamespace, element);
            }
            if (this.i18n) {
                this.i18n.appendElement(element.i18n, elementIndex);
            }
            var hasChildren = function () {
                if (!isI18nRootElement && _this.i18n) {
                    // we do not append text node instructions and ICUs inside i18n section,
                    // so we exclude them while calculating whether current element has children
                    return !hasTextChildrenOnly(element.children);
                }
                return element.children.length > 0;
            };
            var createSelfClosingInstruction = !stylingBuilder.hasBindings && !isNgContainer &&
                element.outputs.length === 0 && i18nAttrs.length === 0 && !hasChildren();
            var createSelfClosingI18nInstruction = !createSelfClosingInstruction &&
                !stylingBuilder.hasBindings && hasTextChildrenOnly(element.children);
            if (createSelfClosingInstruction) {
                this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.element, util_4.trimTrailingNulls(parameters));
            }
            else {
                this.creationInstruction(element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerStart : r3_identifiers_1.Identifiers.elementStart, util_4.trimTrailingNulls(parameters));
                if (isNonBindableMode) {
                    this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.disableBindings);
                }
                // process i18n element attributes
                if (i18nAttrs.length) {
                    var hasBindings_1 = false;
                    var i18nAttrArgs_1 = [];
                    i18nAttrs.forEach(function (attr) {
                        var message = attr.i18n;
                        if (attr instanceof t.TextAttribute) {
                            i18nAttrArgs_1.push(o.literal(attr.name), _this.i18nTranslate(message));
                        }
                        else {
                            var converted = attr.value.visit(_this._valueConverter);
                            _this.allocateBindingSlots(converted);
                            if (converted instanceof ast_1.Interpolation) {
                                var placeholders = util_3.assembleBoundTextPlaceholders(message);
                                var params = util_3.placeholdersToParams(placeholders);
                                i18nAttrArgs_1.push(o.literal(attr.name), _this.i18nTranslate(message, params));
                                converted.expressions.forEach(function (expression) {
                                    hasBindings_1 = true;
                                    _this.updateInstruction(elementIndex, element.sourceSpan, r3_identifiers_1.Identifiers.i18nExp, function () { return [_this.convertExpressionBinding(expression)]; });
                                });
                            }
                        }
                    });
                    if (i18nAttrArgs_1.length) {
                        var index = o.literal(this.allocateDataSlot());
                        var args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs_1), true);
                        this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nAttributes, [index, args]);
                        if (hasBindings_1) {
                            this.updateInstruction(elementIndex, element.sourceSpan, r3_identifiers_1.Identifiers.i18nApply, [index]);
                        }
                    }
                }
                // The style bindings code is placed into two distinct blocks within the template function AOT
                // code: creation and update. The creation code contains the `styling` instructions
                // which will apply the collected binding values to the element. `styling` is
                // designed to run inside of `elementStart` and `elementEnd`. The update instructions
                // (things like `styleProp`, `classProp`, etc..) are applied later on in this
                // file
                this.processStylingInstruction(elementIndex, stylingBuilder.buildStylingInstruction(element.sourceSpan, this.constantPool), true);
                // Generate Listeners (outputs)
                element.outputs.forEach(function (outputAst) {
                    _this.creationInstruction(outputAst.sourceSpan, r3_identifiers_1.Identifiers.listener, _this.prepareListenerParameter(element.name, outputAst, elementIndex));
                });
                // Note: it's important to keep i18n/i18nStart instructions after i18nAttributes and
                // listeners, to make sure i18nAttributes instruction targets current element at runtime.
                if (isI18nRootElement) {
                    this.i18nStart(element.sourceSpan, element.i18n, createSelfClosingI18nInstruction);
                }
            }
            // the code here will collect all update-level styling instructions and add them to the
            // update block of the template function AOT code. Instructions like `styleProp`,
            // `styleMap`, `classMap`, `classProp` and `stylingApply`
            // are all generated and assigned in the code below.
            var stylingInstructions = stylingBuilder.buildUpdateLevelInstructions(this._valueConverter);
            var limit = stylingInstructions.length - 1;
            for (var i = 0; i <= limit; i++) {
                var instruction_1 = stylingInstructions[i];
                this._bindingSlots += instruction_1.allocateBindingSlots;
                this.processStylingInstruction(elementIndex, instruction_1, false);
            }
            // the reason why `undefined` is used is because the renderer understands this as a
            // special value to symbolize that there is no RHS to this binding
            // TODO (matsko): revisit this once FW-959 is approached
            var emptyValueBindInstruction = o.literal(undefined);
            // Generate element input bindings
            allOtherInputs.forEach(function (input) {
                var inputType = input.type;
                if (inputType === 4 /* Animation */) {
                    var value_1 = input.value.visit(_this._valueConverter);
                    // animation bindings can be presented in the following formats:
                    // 1. [@binding]="fooExp"
                    // 2. [@binding]="{value:fooExp, params:{...}}"
                    // 3. [@binding]
                    // 4. @binding
                    // All formats will be valid for when a synthetic binding is created.
                    // The reasoning for this is because the renderer should get each
                    // synthetic binding value in the order of the array that they are
                    // defined in...
                    var hasValue_1 = value_1 instanceof ast_1.LiteralPrimitive ? !!value_1.value : true;
                    _this.allocateBindingSlots(value_1);
                    var bindingName_1 = util_2.prepareSyntheticPropertyName(input.name);
                    _this.updateInstruction(elementIndex, input.sourceSpan, r3_identifiers_1.Identifiers.property, function () {
                        return [
                            o.literal(bindingName_1),
                            (hasValue_1 ? _this.convertPropertyBinding(value_1, /* skipBindFn */ true) :
                                emptyValueBindInstruction),
                        ];
                    });
                }
                else {
                    // we must skip attributes with associated i18n context, since these attributes are handled
                    // separately and corresponding `i18nExp` and `i18nApply` instructions will be generated
                    if (input.i18n)
                        return;
                    var value_2 = input.value.visit(_this._valueConverter);
                    if (value_2 !== undefined) {
                        var params_2 = [];
                        var _a = tslib_1.__read(tags_1.splitNsName(input.name), 2), attrNamespace = _a[0], attrName_1 = _a[1];
                        var isAttributeBinding = inputType === 1 /* Attribute */;
                        var sanitizationRef = resolveSanitizationFn(input.securityContext, isAttributeBinding);
                        if (sanitizationRef)
                            params_2.push(sanitizationRef);
                        if (attrNamespace) {
                            var namespaceLiteral = o.literal(attrNamespace);
                            if (sanitizationRef) {
                                params_2.push(namespaceLiteral);
                            }
                            else {
                                // If there wasn't a sanitization ref, we need to add
                                // an extra param so that we can pass in the namespace.
                                params_2.push(o.literal(null), namespaceLiteral);
                            }
                        }
                        _this.allocateBindingSlots(value_2);
                        if (inputType === 0 /* Property */) {
                            if (value_2 instanceof ast_1.Interpolation) {
                                // prop="{{value}}" and friends
                                _this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value_2), elementIndex, attrName_1, input, value_2, params_2);
                            }
                            else {
                                // [prop]="value"
                                _this.boundUpdateInstruction(r3_identifiers_1.Identifiers.property, elementIndex, attrName_1, input, value_2, params_2);
                            }
                        }
                        else if (inputType === 1 /* Attribute */) {
                            if (value_2 instanceof ast_1.Interpolation && getInterpolationArgsLength(value_2) > 1) {
                                // attr.name="text{{value}}" and friends
                                _this.interpolatedUpdateInstruction(getAttributeInterpolationExpression(value_2), elementIndex, attrName_1, input, value_2, params_2);
                            }
                            else {
                                var boundValue = value_2 instanceof ast_1.Interpolation ? value_2.expressions[0] : value_2;
                                // [attr.name]="value" or attr.name="{{value}}"
                                _this.boundUpdateInstruction(r3_identifiers_1.Identifiers.attribute, elementIndex, attrName_1, input, boundValue, params_2);
                            }
                        }
                        else {
                            // class prop
                            _this.updateInstruction(elementIndex, input.sourceSpan, r3_identifiers_1.Identifiers.classProp, function () {
                                return tslib_1.__spread([
                                    o.literal(elementIndex), o.literal(attrName_1), _this.convertPropertyBinding(value_2)
                                ], params_2);
                            });
                        }
                    }
                }
            });
            // Traverse element child nodes
            t.visitAll(this, element.children);
            if (!isI18nRootElement && this.i18n) {
                this.i18n.appendElement(element.i18n, elementIndex, true);
            }
            if (!createSelfClosingInstruction) {
                // Finish element construction mode.
                var span = element.endSourceSpan || element.sourceSpan;
                if (isI18nRootElement) {
                    this.i18nEnd(span, createSelfClosingI18nInstruction);
                }
                if (isNonBindableMode) {
                    this.creationInstruction(span, r3_identifiers_1.Identifiers.enableBindings);
                }
                this.creationInstruction(span, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerEnd : r3_identifiers_1.Identifiers.elementEnd);
            }
        };
        /**
         * Adds an update instruction for a bound property or attribute, such as `[prop]="value"` or
         * `[attr.title]="value"`
         */
        TemplateDefinitionBuilder.prototype.boundUpdateInstruction = function (instruction, elementIndex, attrName, input, value, params) {
            var _this = this;
            this.updateInstruction(elementIndex, input.sourceSpan, instruction, function () {
                return tslib_1.__spread([o.literal(attrName), _this.convertPropertyBinding(value, true)], params);
            });
        };
        /**
         * Adds an update instruction for an interpolated property or attribute, such as
         * `prop="{{value}}"` or `attr.title="{{value}}"`
         */
        TemplateDefinitionBuilder.prototype.interpolatedUpdateInstruction = function (instruction, elementIndex, attrName, input, value, params) {
            var _this = this;
            this.updateInstruction(elementIndex, input.sourceSpan, instruction, function () { return tslib_1.__spread([o.literal(attrName)], _this.getUpdateInstructionArguments(value), params); });
        };
        TemplateDefinitionBuilder.prototype.visitTemplate = function (template) {
            var _this = this;
            var NG_TEMPLATE_TAG_NAME = 'ng-template';
            var templateIndex = this.allocateDataSlot();
            if (this.i18n) {
                this.i18n.appendTemplate(template.i18n, templateIndex);
            }
            var tagName = compile_metadata_1.sanitizeIdentifier(template.tagName || '');
            var contextName = "" + this.contextName + (tagName ? '_' + tagName : '') + "_" + templateIndex;
            var templateName = contextName + "_Template";
            var parameters = [
                o.literal(templateIndex),
                o.variable(templateName),
                // We don't care about the tag's namespace here, because we infer
                // it based on the parent nodes inside the template instruction.
                o.literal(template.tagName ? tags_1.splitNsName(template.tagName)[1] : template.tagName),
            ];
            // find directives matching on a given <ng-template> node
            this.matchDirectives(NG_TEMPLATE_TAG_NAME, template);
            // prepare attributes parameter (including attributes used for directive matching)
            var attrsExprs = [];
            template.attributes.forEach(function (a) { attrsExprs.push(util_4.asLiteral(a.name), util_4.asLiteral(a.value)); });
            attrsExprs.push.apply(attrsExprs, tslib_1.__spread(this.prepareNonRenderAttrs(template.inputs, template.outputs, undefined, template.templateAttrs)));
            parameters.push(this.toAttrsParam(attrsExprs));
            // local refs (ex.: <ng-template #foo>)
            if (template.references && template.references.length) {
                parameters.push(this.prepareRefsParameter(template.references));
                parameters.push(o.importExpr(r3_identifiers_1.Identifiers.templateRefExtractor));
            }
            // Create the template function
            var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, templateIndex, templateName, this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds);
            // Nested templates must not be visited until after their parent templates have completed
            // processing, so they are queued here until after the initial pass. Otherwise, we wouldn't
            // be able to support bindings in nested templates to local refs that occur after the
            // template definition. e.g. <div *ngIf="showing">{{ foo }}</div>  <div #foo></div>
            this._nestedTemplateFns.push(function () {
                var _a;
                var templateFunctionExpr = templateVisitor.buildTemplateFunction(template.children, template.variables, _this._ngContentReservedSlots.length + _this._ngContentSelectorsOffset, template.i18n);
                _this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName, null));
                if (templateVisitor._ngContentReservedSlots.length) {
                    (_a = _this._ngContentReservedSlots).push.apply(_a, tslib_1.__spread(templateVisitor._ngContentReservedSlots));
                }
            });
            // e.g. template(1, MyComp_Template_1)
            this.creationInstruction(template.sourceSpan, r3_identifiers_1.Identifiers.templateCreate, function () {
                parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
                return util_4.trimTrailingNulls(parameters);
            });
            // handle property bindings e.g. ɵɵproperty('ngForOf', ctx.items), et al;
            this.templatePropertyBindings(template, templateIndex, template.templateAttrs);
            // Only add normal input/output binding instructions on explicit ng-template elements.
            if (template.tagName === NG_TEMPLATE_TAG_NAME) {
                // Add the input bindings
                this.templatePropertyBindings(template, templateIndex, template.inputs);
                // Generate listeners for directive output
                template.outputs.forEach(function (outputAst) {
                    _this.creationInstruction(outputAst.sourceSpan, r3_identifiers_1.Identifiers.listener, _this.prepareListenerParameter('ng_template', outputAst, templateIndex));
                });
            }
        };
        TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
            var _this = this;
            if (this.i18n) {
                var value_3 = text.value.visit(this._valueConverter);
                this.allocateBindingSlots(value_3);
                if (value_3 instanceof ast_1.Interpolation) {
                    this.i18n.appendBoundText(text.i18n);
                    this.i18nAppendBindings(value_3.expressions);
                }
                return;
            }
            var nodeIndex = this.allocateDataSlot();
            this.creationInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.text, [o.literal(nodeIndex)]);
            var value = text.value.visit(this._valueConverter);
            this.allocateBindingSlots(value);
            if (value instanceof ast_1.Interpolation) {
                this.updateInstruction(nodeIndex, text.sourceSpan, getTextInterpolationExpression(value), function () { return _this.getUpdateInstructionArguments(value); });
            }
            else {
                this.updateInstruction(nodeIndex, text.sourceSpan, r3_identifiers_1.Identifiers.textBinding, function () { return [_this.convertPropertyBinding(value)]; });
            }
        };
        TemplateDefinitionBuilder.prototype.visitText = function (text) {
            // when a text element is located within a translatable
            // block, we exclude this text element from instructions set,
            // since it will be captured in i18n content and processed at runtime
            if (!this.i18n) {
                this.creationInstruction(text.sourceSpan, r3_identifiers_1.Identifiers.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
            }
        };
        TemplateDefinitionBuilder.prototype.visitIcu = function (icu) {
            var initWasInvoked = false;
            // if an ICU was created outside of i18n block, we still treat
            // it as a translatable entity and invoke i18nStart and i18nEnd
            // to generate i18n context and the necessary instructions
            if (!this.i18n) {
                initWasInvoked = true;
                this.i18nStart(null, icu.i18n, true);
            }
            var i18n = this.i18n;
            var vars = this.i18nBindProps(icu.vars);
            var placeholders = this.i18nBindProps(icu.placeholders);
            // output ICU directly and keep ICU reference in context
            var message = icu.i18n;
            var transformFn = function (raw) {
                return instruction(null, r3_identifiers_1.Identifiers.i18nPostprocess, [raw, map_util_1.mapLiteral(vars, true)]);
            };
            // in case the whole i18n message is a single ICU - we do not need to
            // create a separate top-level translation, we can use the root ref instead
            // and make this ICU a top-level translation
            if (util_3.isSingleI18nIcu(i18n.meta)) {
                this.i18nTranslate(message, placeholders, i18n.ref, transformFn);
            }
            else {
                // output ICU directly and keep ICU reference in context
                var ref = this.i18nTranslate(message, placeholders, undefined, transformFn);
                i18n.appendIcu(util_3.icuFromI18nMessage(message).name, ref);
            }
            if (initWasInvoked) {
                this.i18nEnd(null, true);
            }
            return null;
        };
        TemplateDefinitionBuilder.prototype.allocateDataSlot = function () { return this._dataIndex++; };
        TemplateDefinitionBuilder.prototype.getConstCount = function () { return this._dataIndex; };
        TemplateDefinitionBuilder.prototype.getVarCount = function () { return this._pureFunctionSlots; };
        TemplateDefinitionBuilder.prototype.getNgContentSelectors = function () {
            return this._ngContentReservedSlots.length ?
                this.constantPool.getConstLiteral(util_4.asLiteral(this._ngContentReservedSlots), true) :
                null;
        };
        TemplateDefinitionBuilder.prototype.bindingContext = function () { return "" + this._bindingContext++; };
        TemplateDefinitionBuilder.prototype.templatePropertyBindings = function (template, templateIndex, attrs) {
            var _this = this;
            attrs.forEach(function (input) {
                if (input instanceof t.BoundAttribute) {
                    var value_4 = input.value.visit(_this._valueConverter);
                    if (value_4 !== undefined) {
                        _this.allocateBindingSlots(value_4);
                        _this.updateInstruction(templateIndex, template.sourceSpan, r3_identifiers_1.Identifiers.property, function () { return [o.literal(input.name), _this.convertPropertyBinding(value_4, true)]; });
                    }
                }
            });
        };
        // Bindings must only be resolved after all local refs have been visited, so all
        // instructions are queued in callbacks that execute once the initial pass has completed.
        // Otherwise, we wouldn't be able to support local refs that are defined after their
        // bindings. e.g. {{ foo }} <div #foo></div>
        TemplateDefinitionBuilder.prototype.instructionFn = function (fns, span, reference, paramsOrFn, prepend) {
            if (prepend === void 0) { prepend = false; }
            fns[prepend ? 'unshift' : 'push'](function () {
                var params = Array.isArray(paramsOrFn) ? paramsOrFn : paramsOrFn();
                return instruction(span, reference, params).toStmt();
            });
        };
        TemplateDefinitionBuilder.prototype.processStylingInstruction = function (elementIndex, instruction, createMode) {
            var _this = this;
            if (instruction) {
                var paramsFn = function () {
                    return instruction.buildParams(function (value) { return _this.convertPropertyBinding(value, true); });
                };
                if (createMode) {
                    this.creationInstruction(instruction.sourceSpan, instruction.reference, paramsFn);
                }
                else {
                    this.updateInstruction(elementIndex, instruction.sourceSpan, instruction.reference, paramsFn);
                }
            }
        };
        TemplateDefinitionBuilder.prototype.creationInstruction = function (span, reference, paramsOrFn, prepend) {
            this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
        };
        TemplateDefinitionBuilder.prototype.updateInstruction = function (nodeIndex, span, reference, paramsOrFn) {
            if (this._lastNodeIndexWithFlush < nodeIndex) {
                if (nodeIndex > 0) {
                    this.instructionFn(this._updateCodeFns, span, r3_identifiers_1.Identifiers.select, [o.literal(nodeIndex)]);
                }
                this._lastNodeIndexWithFlush = nodeIndex;
            }
            this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
        };
        TemplateDefinitionBuilder.prototype.allocatePureFunctionSlots = function (numSlots) {
            var originalSlots = this._pureFunctionSlots;
            this._pureFunctionSlots += numSlots;
            return originalSlots;
        };
        TemplateDefinitionBuilder.prototype.allocateBindingSlots = function (value) {
            this._bindingSlots += value instanceof ast_1.Interpolation ? value.expressions.length : 1;
        };
        /**
         * Gets an expression that refers to the implicit receiver. The implicit
         * receiver is always the root level context.
         */
        TemplateDefinitionBuilder.prototype.getImplicitReceiverExpr = function () {
            if (this._implicitReceiverExpr) {
                return this._implicitReceiverExpr;
            }
            return this._implicitReceiverExpr = this.level === 0 ?
                o.variable(util_4.CONTEXT_NAME) :
                this._bindingScope.getOrCreateSharedContextVar(0);
        };
        TemplateDefinitionBuilder.prototype.convertExpressionBinding = function (value) {
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), expression_converter_1.BindingForm.TrySimple);
            var valExpr = convertedPropertyBinding.currValExpr;
            return o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([valExpr]);
        };
        TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (value, skipBindFn) {
            var _a;
            var interpolationFn = value instanceof ast_1.Interpolation ? interpolate : function () { return util_1.error('Unexpected interpolation'); };
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), expression_converter_1.BindingForm.TrySimple, interpolationFn);
            var valExpr = convertedPropertyBinding.currValExpr;
            (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
            return value instanceof ast_1.Interpolation || skipBindFn ? valExpr :
                o.importExpr(r3_identifiers_1.Identifiers.bind).callFn([valExpr]);
        };
        /**
         * Gets a list of argument expressions to pass to an update instruction expression. Also updates
         * the temp variables state with temp variables that were identified as needing to be created
         * while visiting the arguments.
         * @param value The original expression we will be resolving an arguments list from.
         */
        TemplateDefinitionBuilder.prototype.getUpdateInstructionArguments = function (value) {
            var _a;
            var _b = expression_converter_1.convertUpdateArguments(this, this.getImplicitReceiverExpr(), value, this.bindingContext()), args = _b.args, stmts = _b.stmts;
            (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(stmts));
            return args;
        };
        TemplateDefinitionBuilder.prototype.matchDirectives = function (tagName, elOrTpl) {
            var _this = this;
            if (this.directiveMatcher) {
                var selector = createCssSelector(tagName, util_4.getAttrsForDirectiveMatching(elOrTpl));
                this.directiveMatcher.match(selector, function (cssSelector, staticType) { _this.directives.add(staticType); });
            }
        };
        /**
         * Prepares all attribute expression values for the `TAttributes` array.
         *
         * The purpose of this function is to properly construct an attributes array that
         * is passed into the `elementStart` (or just `element`) functions. Because there
         * are many different types of attributes, the array needs to be constructed in a
         * special way so that `elementStart` can properly evaluate them.
         *
         * The format looks like this:
         *
         * ```
         * attrs = [prop, value, prop2, value2,
         *   CLASSES, class1, class2,
         *   STYLES, style1, value1, style2, value2,
         *   BINDINGS, name1, name2, name3,
         *   TEMPLATE, name4, name5, name6,
         *   I18N, name7, name8, ...]
         * ```
         *
         * Note that this function will fully ignore all synthetic (@foo) attribute values
         * because those values are intended to always be generated as property instructions.
         */
        TemplateDefinitionBuilder.prototype.prepareNonRenderAttrs = function (inputs, outputs, styles, templateAttrs, i18nAttrs) {
            if (templateAttrs === void 0) { templateAttrs = []; }
            if (i18nAttrs === void 0) { i18nAttrs = []; }
            var alreadySeen = new Set();
            var attrExprs = [];
            function addAttrExpr(key, value) {
                if (typeof key === 'string') {
                    if (!alreadySeen.has(key)) {
                        attrExprs.push.apply(attrExprs, tslib_1.__spread(getAttributeNameLiterals(key)));
                        value !== undefined && attrExprs.push(value);
                        alreadySeen.add(key);
                    }
                }
                else {
                    attrExprs.push(o.literal(key));
                }
            }
            // it's important that this occurs before BINDINGS and TEMPLATE because once `elementStart`
            // comes across the BINDINGS or TEMPLATE markers then it will continue reading each value as
            // as single property value cell by cell.
            if (styles) {
                styles.populateInitialStylingAttrs(attrExprs);
            }
            if (inputs.length || outputs.length) {
                var attrsStartIndex = attrExprs.length;
                for (var i = 0; i < inputs.length; i++) {
                    var input = inputs[i];
                    if (input.type !== 4 /* Animation */) {
                        addAttrExpr(input.name);
                    }
                }
                for (var i = 0; i < outputs.length; i++) {
                    var output = outputs[i];
                    if (output.type !== 1 /* Animation */) {
                        addAttrExpr(output.name);
                    }
                }
                // this is a cheap way of adding the marker only after all the input/output
                // values have been filtered (by not including the animation ones) and added
                // to the expressions. The marker is important because it tells the runtime
                // code that this is where attributes without values start...
                if (attrExprs.length) {
                    attrExprs.splice(attrsStartIndex, 0, o.literal(3 /* Bindings */));
                }
            }
            if (templateAttrs.length) {
                attrExprs.push(o.literal(4 /* Template */));
                templateAttrs.forEach(function (attr) { return addAttrExpr(attr.name); });
            }
            if (i18nAttrs.length) {
                attrExprs.push(o.literal(6 /* I18n */));
                i18nAttrs.forEach(function (attr) { return addAttrExpr(attr.name); });
            }
            return attrExprs;
        };
        TemplateDefinitionBuilder.prototype.toAttrsParam = function (attrsExprs) {
            return attrsExprs.length > 0 ?
                this.constantPool.getConstLiteral(o.literalArr(attrsExprs), true) :
                o.TYPED_NULL_EXPR;
        };
        TemplateDefinitionBuilder.prototype.prepareRefsParameter = function (references) {
            var _this = this;
            if (!references || references.length === 0) {
                return o.TYPED_NULL_EXPR;
            }
            var refsParam = compile_metadata_1.flatten(references.map(function (reference) {
                var slot = _this.allocateDataSlot();
                // Generate the update temporary.
                var variableName = _this._bindingScope.freshReferenceName();
                var retrievalLevel = _this.level;
                var lhs = o.variable(variableName);
                _this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DEFAULT */, function (scope, relativeLevel) {
                    // e.g. nextContext(2);
                    var nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                    // e.g. const $foo$ = reference(1);
                    var refExpr = lhs.set(o.importExpr(r3_identifiers_1.Identifiers.reference).callFn([o.literal(slot)]));
                    return nextContextStmt.concat(refExpr.toConstDecl());
                }, true);
                return [reference.name, reference.value];
            }));
            return this.constantPool.getConstLiteral(util_4.asLiteral(refsParam), true);
        };
        TemplateDefinitionBuilder.prototype.prepareListenerParameter = function (tagName, outputAst, index) {
            var _this = this;
            return function () {
                var eventName = outputAst.name;
                var bindingFnName = outputAst.type === 1 /* Animation */ ?
                    // synthetic @listener.foo values are treated the exact same as are standard listeners
                    util_2.prepareSyntheticListenerFunctionName(eventName, outputAst.phase) :
                    compile_metadata_1.sanitizeIdentifier(eventName);
                var handlerName = _this.templateName + "_" + tagName + "_" + bindingFnName + "_" + index + "_listener";
                var scope = _this._bindingScope.nestedScope(_this._bindingScope.bindingLevel);
                return prepareEventListenerParameters(outputAst, handlerName, scope);
            };
        };
        return TemplateDefinitionBuilder;
    }());
    exports.TemplateDefinitionBuilder = TemplateDefinitionBuilder;
    var ValueConverter = /** @class */ (function (_super) {
        tslib_1.__extends(ValueConverter, _super);
        function ValueConverter(constantPool, allocateSlot, allocatePureFunctionSlots, definePipe) {
            var _this = _super.call(this) || this;
            _this.constantPool = constantPool;
            _this.allocateSlot = allocateSlot;
            _this.allocatePureFunctionSlots = allocatePureFunctionSlots;
            _this.definePipe = definePipe;
            _this._pipeBindExprs = [];
            return _this;
        }
        // AstMemoryEfficientTransformer
        ValueConverter.prototype.visitPipe = function (pipe, context) {
            // Allocate a slot to create the pipe
            var slot = this.allocateSlot();
            var slotPseudoLocal = "PIPE:" + slot;
            // Allocate one slot for the result plus one slot per pipe argument
            var pureFunctionSlot = this.allocatePureFunctionSlots(2 + pipe.args.length);
            var target = new ast_1.PropertyRead(pipe.span, new ast_1.ImplicitReceiver(pipe.span), slotPseudoLocal);
            var _a = pipeBindingCallInfo(pipe.args), identifier = _a.identifier, isVarLength = _a.isVarLength;
            this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
            var args = tslib_1.__spread([pipe.exp], pipe.args);
            var convertedArgs = isVarLength ? this.visitAll([new ast_1.LiteralArray(pipe.span, args)]) : this.visitAll(args);
            var pipeBindExpr = new ast_1.FunctionCall(pipe.span, target, tslib_1.__spread([
                new ast_1.LiteralPrimitive(pipe.span, slot),
                new ast_1.LiteralPrimitive(pipe.span, pureFunctionSlot)
            ], convertedArgs));
            this._pipeBindExprs.push(pipeBindExpr);
            return pipeBindExpr;
        };
        ValueConverter.prototype.updatePipeSlotOffsets = function (bindingSlots) {
            this._pipeBindExprs.forEach(function (pipe) {
                // update the slot offset arg (index 1) to account for binding slots
                var slotOffset = pipe.args[1];
                slotOffset.value += bindingSlots;
            });
        };
        ValueConverter.prototype.visitLiteralArray = function (array, context) {
            var _this = this;
            return new expression_converter_1.BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
                // If the literal has calculated (non-literal) elements transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values. Otherwise, just return an literal array that contains the values.
                var literal = o.literalArr(values);
                return values.every(function (a) { return a.isConstant(); }) ?
                    _this.constantPool.getConstLiteral(literal, true) :
                    getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
            });
        };
        ValueConverter.prototype.visitLiteralMap = function (map, context) {
            var _this = this;
            return new expression_converter_1.BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
                // If the literal has calculated (non-literal) elements  transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values. Otherwise, just return an literal array that contains the values.
                var literal = o.literalMap(values.map(function (value, index) { return ({ key: map.keys[index].key, value: value, quoted: map.keys[index].quoted }); }));
                return values.every(function (a) { return a.isConstant(); }) ?
                    _this.constantPool.getConstLiteral(literal, true) :
                    getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
            });
        };
        return ValueConverter;
    }(ast_1.AstMemoryEfficientTransformer));
    exports.ValueConverter = ValueConverter;
    // Pipes always have at least one parameter, the value they operate on
    var pipeBindingIdentifiers = [r3_identifiers_1.Identifiers.pipeBind1, r3_identifiers_1.Identifiers.pipeBind2, r3_identifiers_1.Identifiers.pipeBind3, r3_identifiers_1.Identifiers.pipeBind4];
    function pipeBindingCallInfo(args) {
        var identifier = pipeBindingIdentifiers[args.length];
        return {
            identifier: identifier || r3_identifiers_1.Identifiers.pipeBindV,
            isVarLength: !identifier,
        };
    }
    var pureFunctionIdentifiers = [
        r3_identifiers_1.Identifiers.pureFunction0, r3_identifiers_1.Identifiers.pureFunction1, r3_identifiers_1.Identifiers.pureFunction2, r3_identifiers_1.Identifiers.pureFunction3, r3_identifiers_1.Identifiers.pureFunction4,
        r3_identifiers_1.Identifiers.pureFunction5, r3_identifiers_1.Identifiers.pureFunction6, r3_identifiers_1.Identifiers.pureFunction7, r3_identifiers_1.Identifiers.pureFunction8
    ];
    function pureFunctionCallInfo(args) {
        var identifier = pureFunctionIdentifiers[args.length];
        return {
            identifier: identifier || r3_identifiers_1.Identifiers.pureFunctionV,
            isVarLength: !identifier,
        };
    }
    function instruction(span, reference, params) {
        return o.importExpr(reference, null, span).callFn(params, span);
    }
    // e.g. x(2);
    function generateNextContextExpr(relativeLevelDiff) {
        return o.importExpr(r3_identifiers_1.Identifiers.nextContext)
            .callFn(relativeLevelDiff > 1 ? [o.literal(relativeLevelDiff)] : []);
    }
    function getLiteralFactory(constantPool, literal, allocateSlots) {
        var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
        // Allocate 1 slot for the result plus 1 per argument
        var startSlot = allocateSlots(1 + literalFactoryArguments.length);
        literalFactoryArguments.length > 0 || util_1.error("Expected arguments to a literal factory function");
        var _b = pureFunctionCallInfo(literalFactoryArguments), identifier = _b.identifier, isVarLength = _b.isVarLength;
        // Literal factories are pure functions that only need to be re-invoked when the parameters
        // change.
        var args = [
            o.literal(startSlot),
            literalFactory,
        ];
        if (isVarLength) {
            args.push(o.literalArr(literalFactoryArguments));
        }
        else {
            args.push.apply(args, tslib_1.__spread(literalFactoryArguments));
        }
        return o.importExpr(identifier).callFn(args);
    }
    /**
     * Gets an array of literals that can be added to an expression
     * to represent the name and namespace of an attribute. E.g.
     * `:xlink:href` turns into `[AttributeMarker.NamespaceURI, 'xlink', 'href']`.
     *
     * @param name Name of the attribute, including the namespace.
     */
    function getAttributeNameLiterals(name) {
        var _a = tslib_1.__read(tags_1.splitNsName(name), 2), attributeNamespace = _a[0], attributeName = _a[1];
        var nameLiteral = o.literal(attributeName);
        if (attributeNamespace) {
            return [
                o.literal(0 /* NamespaceURI */), o.literal(attributeNamespace), nameLiteral
            ];
        }
        return [nameLiteral];
    }
    /** The prefix used to get a shared context in BindingScope's map. */
    var SHARED_CONTEXT_KEY = '$$shared_ctx$$';
    var BindingScope = /** @class */ (function () {
        function BindingScope(bindingLevel, parent) {
            if (bindingLevel === void 0) { bindingLevel = 0; }
            if (parent === void 0) { parent = null; }
            this.bindingLevel = bindingLevel;
            this.parent = parent;
            /** Keeps a map from local variables to their BindingData. */
            this.map = new Map();
            this.referenceNameIndex = 0;
            this.restoreViewVariable = null;
        }
        Object.defineProperty(BindingScope, "ROOT_SCOPE", {
            get: function () {
                if (!BindingScope._ROOT_SCOPE) {
                    BindingScope._ROOT_SCOPE = new BindingScope().set(0, '$event', o.variable('$event'));
                }
                return BindingScope._ROOT_SCOPE;
            },
            enumerable: true,
            configurable: true
        });
        BindingScope.prototype.get = function (name) {
            var current = this;
            while (current) {
                var value = current.map.get(name);
                if (value != null) {
                    if (current !== this) {
                        // make a local copy and reset the `declare` state
                        value = {
                            retrievalLevel: value.retrievalLevel,
                            lhs: value.lhs,
                            declareLocalCallback: value.declareLocalCallback,
                            declare: false,
                            priority: value.priority,
                            localRef: value.localRef
                        };
                        // Cache the value locally.
                        this.map.set(name, value);
                        // Possibly generate a shared context var
                        this.maybeGenerateSharedContextVar(value);
                        this.maybeRestoreView(value.retrievalLevel, value.localRef);
                    }
                    if (value.declareLocalCallback && !value.declare) {
                        value.declare = true;
                    }
                    return value.lhs;
                }
                current = current.parent;
            }
            // If we get to this point, we are looking for a property on the top level component
            // - If level === 0, we are on the top and don't need to re-declare `ctx`.
            // - If level > 0, we are in an embedded view. We need to retrieve the name of the
            // local var we used to store the component context, e.g. const $comp$ = x();
            return this.bindingLevel === 0 ? null : this.getComponentProperty(name);
        };
        /**
         * Create a local variable for later reference.
         *
         * @param retrievalLevel The level from which this value can be retrieved
         * @param name Name of the variable.
         * @param lhs AST representing the left hand side of the `let lhs = rhs;`.
         * @param priority The sorting priority of this var
         * @param declareLocalCallback The callback to invoke when declaring this local var
         * @param localRef Whether or not this is a local ref
         */
        BindingScope.prototype.set = function (retrievalLevel, name, lhs, priority, declareLocalCallback, localRef) {
            if (priority === void 0) { priority = 0 /* DEFAULT */; }
            if (this.map.has(name)) {
                if (localRef) {
                    // Do not throw an error if it's a local ref and do not update existing value,
                    // so the first defined ref is always returned.
                    return this;
                }
                util_1.error("The name " + name + " is already defined in scope to be " + this.map.get(name));
            }
            this.map.set(name, {
                retrievalLevel: retrievalLevel,
                lhs: lhs,
                declare: false,
                declareLocalCallback: declareLocalCallback,
                priority: priority,
                localRef: localRef || false
            });
            return this;
        };
        // Implemented as part of LocalResolver.
        BindingScope.prototype.getLocal = function (name) { return this.get(name); };
        // Implemented as part of LocalResolver.
        BindingScope.prototype.notifyImplicitReceiverUse = function () {
            if (this.bindingLevel !== 0) {
                // Since the implicit receiver is accessed in an embedded view, we need to
                // ensure that we declare a shared context variable for the current template
                // in the update variables.
                this.map.get(SHARED_CONTEXT_KEY + 0).declare = true;
            }
        };
        BindingScope.prototype.nestedScope = function (level) {
            var newScope = new BindingScope(level, this);
            if (level > 0)
                newScope.generateSharedContextVar(0);
            return newScope;
        };
        /**
         * Gets or creates a shared context variable and returns its expression. Note that
         * this does not mean that the shared variable will be declared. Variables in the
         * binding scope will be only declared if they are used.
         */
        BindingScope.prototype.getOrCreateSharedContextVar = function (retrievalLevel) {
            var bindingKey = SHARED_CONTEXT_KEY + retrievalLevel;
            if (!this.map.has(bindingKey)) {
                this.generateSharedContextVar(retrievalLevel);
            }
            return this.map.get(bindingKey).lhs;
        };
        BindingScope.prototype.getSharedContextName = function (retrievalLevel) {
            var sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + retrievalLevel);
            return sharedCtxObj && sharedCtxObj.declare ? sharedCtxObj.lhs : null;
        };
        BindingScope.prototype.maybeGenerateSharedContextVar = function (value) {
            if (value.priority === 1 /* CONTEXT */ &&
                value.retrievalLevel < this.bindingLevel) {
                var sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + value.retrievalLevel);
                if (sharedCtxObj) {
                    sharedCtxObj.declare = true;
                }
                else {
                    this.generateSharedContextVar(value.retrievalLevel);
                }
            }
        };
        BindingScope.prototype.generateSharedContextVar = function (retrievalLevel) {
            var lhs = o.variable(util_4.CONTEXT_NAME + this.freshReferenceName());
            this.map.set(SHARED_CONTEXT_KEY + retrievalLevel, {
                retrievalLevel: retrievalLevel,
                lhs: lhs,
                declareLocalCallback: function (scope, relativeLevel) {
                    // const ctx_r0 = nextContext(2);
                    return [lhs.set(generateNextContextExpr(relativeLevel)).toConstDecl()];
                },
                declare: false,
                priority: 2 /* SHARED_CONTEXT */,
                localRef: false
            });
        };
        BindingScope.prototype.getComponentProperty = function (name) {
            var componentValue = this.map.get(SHARED_CONTEXT_KEY + 0);
            componentValue.declare = true;
            this.maybeRestoreView(0, false);
            return componentValue.lhs.prop(name);
        };
        BindingScope.prototype.maybeRestoreView = function (retrievalLevel, localRefLookup) {
            // We want to restore the current view in listener fns if:
            // 1 - we are accessing a value in a parent view, which requires walking the view tree rather
            // than using the ctx arg. In this case, the retrieval and binding level will be different.
            // 2 - we are looking up a local ref, which requires restoring the view where the local
            // ref is stored
            if (this.isListenerScope() && (retrievalLevel < this.bindingLevel || localRefLookup)) {
                if (!this.parent.restoreViewVariable) {
                    // parent saves variable to generate a shared `const $s$ = getCurrentView();` instruction
                    this.parent.restoreViewVariable = o.variable(this.parent.freshReferenceName());
                }
                this.restoreViewVariable = this.parent.restoreViewVariable;
            }
        };
        BindingScope.prototype.restoreViewStatement = function () {
            // restoreView($state$);
            return this.restoreViewVariable ?
                [instruction(null, r3_identifiers_1.Identifiers.restoreView, [this.restoreViewVariable]).toStmt()] :
                [];
        };
        BindingScope.prototype.viewSnapshotStatements = function () {
            // const $state$ = getCurrentView();
            var getCurrentViewInstruction = instruction(null, r3_identifiers_1.Identifiers.getCurrentView, []);
            return this.restoreViewVariable ?
                [this.restoreViewVariable.set(getCurrentViewInstruction).toConstDecl()] :
                [];
        };
        BindingScope.prototype.isListenerScope = function () { return this.parent && this.parent.bindingLevel === this.bindingLevel; };
        BindingScope.prototype.variableDeclarations = function () {
            var _this = this;
            var currentContextLevel = 0;
            return Array.from(this.map.values())
                .filter(function (value) { return value.declare; })
                .sort(function (a, b) { return b.retrievalLevel - a.retrievalLevel || b.priority - a.priority; })
                .reduce(function (stmts, value) {
                var levelDiff = _this.bindingLevel - value.retrievalLevel;
                var currStmts = value.declareLocalCallback(_this, levelDiff - currentContextLevel);
                currentContextLevel = levelDiff;
                return stmts.concat(currStmts);
            }, []);
        };
        BindingScope.prototype.freshReferenceName = function () {
            var current = this;
            // Find the top scope as it maintains the global reference count
            while (current.parent)
                current = current.parent;
            var ref = "" + util_4.REFERENCE_PREFIX + current.referenceNameIndex++;
            return ref;
        };
        return BindingScope;
    }());
    exports.BindingScope = BindingScope;
    /**
     * Creates a `CssSelector` given a tag name and a map of attributes
     */
    function createCssSelector(tag, attributes) {
        var cssSelector = new selector_1.CssSelector();
        cssSelector.setElement(tag);
        Object.getOwnPropertyNames(attributes).forEach(function (name) {
            var value = attributes[name];
            cssSelector.addAttribute(name, value);
            if (name.toLowerCase() === 'class') {
                var classes = value.trim().split(/\s+/);
                classes.forEach(function (className) { return cssSelector.addClassName(className); });
            }
        });
        return cssSelector;
    }
    /**
     * Creates an array of expressions out of an `ngProjectAs` attributes
     * which can be added to the instruction parameters.
     */
    function getNgProjectAsLiteral(attribute) {
        // Parse the attribute value into a CssSelectorList. Note that we only take the
        // first selector, because we don't support multiple selectors in ngProjectAs.
        var parsedR3Selector = core.parseSelectorToR3Selector(attribute.value)[0];
        return [o.literal(5 /* ProjectAs */), util_4.asLiteral(parsedR3Selector)];
    }
    function interpolate(args) {
        args = args.slice(1); // Ignore the length prefix added for render2
        switch (args.length) {
            case 3:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation1).callFn(args);
            case 5:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation2).callFn(args);
            case 7:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation3).callFn(args);
            case 9:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation4).callFn(args);
            case 11:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation5).callFn(args);
            case 13:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation6).callFn(args);
            case 15:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation7).callFn(args);
            case 17:
                return o.importExpr(r3_identifiers_1.Identifiers.interpolation8).callFn(args);
        }
        (args.length >= 19 && args.length % 2 == 1) ||
            util_1.error("Invalid interpolation argument length " + args.length);
        return o.importExpr(r3_identifiers_1.Identifiers.interpolationV).callFn([o.literalArr(args)]);
    }
    /**
     * Gets the instruction to generate for an interpolated property
     * @param interpolation An Interpolation AST
     */
    function getPropertyInterpolationExpression(interpolation) {
        switch (getInterpolationArgsLength(interpolation)) {
            case 1:
                return r3_identifiers_1.Identifiers.propertyInterpolate;
            case 3:
                return r3_identifiers_1.Identifiers.propertyInterpolate1;
            case 5:
                return r3_identifiers_1.Identifiers.propertyInterpolate2;
            case 7:
                return r3_identifiers_1.Identifiers.propertyInterpolate3;
            case 9:
                return r3_identifiers_1.Identifiers.propertyInterpolate4;
            case 11:
                return r3_identifiers_1.Identifiers.propertyInterpolate5;
            case 13:
                return r3_identifiers_1.Identifiers.propertyInterpolate6;
            case 15:
                return r3_identifiers_1.Identifiers.propertyInterpolate7;
            case 17:
                return r3_identifiers_1.Identifiers.propertyInterpolate8;
            default:
                return r3_identifiers_1.Identifiers.propertyInterpolateV;
        }
    }
    /**
     * Gets the instruction to generate for an interpolated attribute
     * @param interpolation An Interpolation AST
     */
    function getAttributeInterpolationExpression(interpolation) {
        switch (getInterpolationArgsLength(interpolation)) {
            case 3:
                return r3_identifiers_1.Identifiers.attributeInterpolate1;
            case 5:
                return r3_identifiers_1.Identifiers.attributeInterpolate2;
            case 7:
                return r3_identifiers_1.Identifiers.attributeInterpolate3;
            case 9:
                return r3_identifiers_1.Identifiers.attributeInterpolate4;
            case 11:
                return r3_identifiers_1.Identifiers.attributeInterpolate5;
            case 13:
                return r3_identifiers_1.Identifiers.attributeInterpolate6;
            case 15:
                return r3_identifiers_1.Identifiers.attributeInterpolate7;
            case 17:
                return r3_identifiers_1.Identifiers.attributeInterpolate8;
            default:
                return r3_identifiers_1.Identifiers.attributeInterpolateV;
        }
    }
    /**
     * Gets the instruction to generate for interpolated text.
     * @param interpolation An Interpolation AST
     */
    function getTextInterpolationExpression(interpolation) {
        switch (getInterpolationArgsLength(interpolation)) {
            case 1:
                return r3_identifiers_1.Identifiers.textInterpolate;
            case 3:
                return r3_identifiers_1.Identifiers.textInterpolate1;
            case 5:
                return r3_identifiers_1.Identifiers.textInterpolate2;
            case 7:
                return r3_identifiers_1.Identifiers.textInterpolate3;
            case 9:
                return r3_identifiers_1.Identifiers.textInterpolate4;
            case 11:
                return r3_identifiers_1.Identifiers.textInterpolate5;
            case 13:
                return r3_identifiers_1.Identifiers.textInterpolate6;
            case 15:
                return r3_identifiers_1.Identifiers.textInterpolate7;
            case 17:
                return r3_identifiers_1.Identifiers.textInterpolate8;
            default:
                return r3_identifiers_1.Identifiers.textInterpolateV;
        }
    }
    /**
     * Gets the number of arguments expected to be passed to a generated instruction in the case of
     * interpolation instructions.
     * @param interpolation An interpolation ast
     */
    function getInterpolationArgsLength(interpolation) {
        var expressions = interpolation.expressions, strings = interpolation.strings;
        if (expressions.length === 1 && strings.length === 2 && strings[0] === '' && strings[1] === '') {
            // If the interpolation has one interpolated value, but the prefix and suffix are both empty
            // strings, we only pass one argument, to a special instruction like `propertyInterpolate` or
            // `textInterpolate`.
            return 1;
        }
        else {
            return expressions.length + strings.length;
        }
    }
    /**
     * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
     *
     * @param template text of the template to parse
     * @param templateUrl URL to use for source mapping of the parsed template
     * @param options options to modify how the template is parsed
     */
    function parseTemplate(template, templateUrl, options) {
        if (options === void 0) { options = {}; }
        var interpolationConfig = options.interpolationConfig, preserveWhitespaces = options.preserveWhitespaces;
        var bindingParser = makeBindingParser(interpolationConfig);
        var htmlParser = new html_parser_1.HtmlParser();
        var parseResult = htmlParser.parse(template, templateUrl, tslib_1.__assign({}, options, { tokenizeExpansionForms: true, leadingTriviaChars: LEADING_TRIVIA_CHARS }));
        if (parseResult.errors && parseResult.errors.length > 0) {
            return { errors: parseResult.errors, nodes: [], styleUrls: [], styles: [] };
        }
        var rootNodes = parseResult.rootNodes;
        // process i18n meta information (scan attributes, generate ids)
        // before we run whitespace removal process, because existing i18n
        // extraction process (ng xi18n) relies on a raw content to generate
        // message ids
        rootNodes =
            html.visitAll(new meta_1.I18nMetaVisitor(interpolationConfig, !preserveWhitespaces), rootNodes);
        if (!preserveWhitespaces) {
            rootNodes = html.visitAll(new html_whitespaces_1.WhitespaceVisitor(), rootNodes);
            // run i18n meta visitor again in case we remove whitespaces, because
            // that might affect generated i18n message content. During this pass
            // i18n IDs generated at the first pass will be preserved, so we can mimic
            // existing extraction process (ng xi18n)
            rootNodes = html.visitAll(new meta_1.I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
        }
        var _a = r3_template_transform_1.htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, errors = _a.errors, styleUrls = _a.styleUrls, styles = _a.styles;
        if (errors && errors.length > 0) {
            return { errors: errors, nodes: [], styleUrls: [], styles: [] };
        }
        return { nodes: nodes, styleUrls: styleUrls, styles: styles };
    }
    exports.parseTemplate = parseTemplate;
    /**
     * Construct a `BindingParser` with a default configuration.
     */
    function makeBindingParser(interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        return new binding_parser_1.BindingParser(new parser_1.Parser(new lexer_1.Lexer()), interpolationConfig, new dom_element_schema_registry_1.DomElementSchemaRegistry(), null, []);
    }
    exports.makeBindingParser = makeBindingParser;
    function resolveSanitizationFn(context, isAttribute) {
        switch (context) {
            case core.SecurityContext.HTML:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeHtml);
            case core.SecurityContext.SCRIPT:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeScript);
            case core.SecurityContext.STYLE:
                // the compiler does not fill in an instruction for [style.prop?] binding
                // values because the style algorithm knows internally what props are subject
                // to sanitization (only [attr.style] values are explicitly sanitized)
                return isAttribute ? o.importExpr(r3_identifiers_1.Identifiers.sanitizeStyle) : null;
            case core.SecurityContext.URL:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeUrl);
            case core.SecurityContext.RESOURCE_URL:
                return o.importExpr(r3_identifiers_1.Identifiers.sanitizeResourceUrl);
            default:
                return null;
        }
    }
    exports.resolveSanitizationFn = resolveSanitizationFn;
    function isSingleElementTemplate(children) {
        return children.length === 1 && children[0] instanceof t.Element;
    }
    function isTextNode(node) {
        return node instanceof t.Text || node instanceof t.BoundText || node instanceof t.Icu;
    }
    function hasTextChildrenOnly(children) {
        return children.every(isTextNode);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFtRTtJQUNuRSxpR0FBK0s7SUFFL0ssaURBQW1DO0lBQ25DLG1FQUFtTztJQUNuTyx1RUFBb0Q7SUFDcEQseUVBQXNEO0lBRXRELDBEQUE0QztJQUM1QywyRUFBdUQ7SUFDdkQscUZBQW1FO0lBQ25FLDZGQUF1RztJQUV2Ryw2REFBc0Y7SUFDdEYsa0VBQWlEO0lBQ2pELDJEQUE2QztJQUU3Qyx3R0FBa0Y7SUFDbEYsMkRBQTREO0lBQzVELHVGQUFtRTtJQUNuRSxtREFBaUM7SUFDakMsd0RBQStCO0lBQy9CLCtFQUFvRDtJQUNwRCw2RkFBNkQ7SUFDN0QsMkRBQXlIO0lBRXpILDJFQUEyQztJQUMzQyxxRUFBNEM7SUFDNUMsaUZBQTJEO0lBQzNELHFFQUFvVTtJQUNwVSxzRkFBOEQ7SUFDOUQsZ0VBQTZMO0lBRzdMLDRDQUE0QztJQUM1QyxJQUFNLHNCQUFzQixHQUFHLFFBQVEsQ0FBQztJQUV4QyxtQ0FBbUM7SUFDbkMsSUFBTSx1QkFBdUIsR0FBRyxhQUFhLENBQUM7SUFFOUMsdURBQXVEO0lBQ3ZELElBQU0sdUJBQXVCLEdBQUcsSUFBSSxHQUFHLENBQ25DLENBQUMsQ0FBQyxRQUFRLEVBQUUsNEJBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSw0QkFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLDRCQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRWhHLElBQU0sb0JBQW9CLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUVyRCwwQkFB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QUFlLENBQUMsWUFBWTtnQkFDcEMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUM5QztnQkFDRSxPQUFPLElBQUksQ0FBQztTQUNmO0lBQ0gsQ0FBQztJQWxCRCxzREFrQkM7SUFFRCxTQUFTLHVCQUF1QixDQUFDLFFBQWtCO1FBQ2pELE9BQU8sUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDbkUsQ0FBQztJQUVELFNBQVMsVUFBVSxDQUFDLElBQVk7UUFDOUIsT0FBTyxJQUFJLFlBQVksQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLFNBQVMsSUFBSSxJQUFJLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUN4RixDQUFDO0lBRUQsU0FBUyxtQkFBbUIsQ0FBQyxRQUFrQjtRQUM3QyxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDcEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRVcGRhdGVBcmd1bWVudHN9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtJMThuQ29udGV4dH0gZnJvbSAnLi9pMThuL2NvbnRleHQnO1xuaW1wb3J0IHtJMThuTWV0YVZpc2l0b3J9IGZyb20gJy4vaTE4bi9tZXRhJztcbmltcG9ydCB7Z2V0U2VyaWFsaXplZEkxOG5Db250ZW50fSBmcm9tICcuL2kxOG4vc2VyaWFsaXplcic7XG5pbXBvcnQge0kxOE5fSUNVX01BUFBJTkdfUFJFRklYLCBUUkFOU0xBVElPTl9QUkVGSVgsIGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzLCBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZywgZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZSwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeCwgZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgbWV0YUZyb21JMThuTWVzc2FnZSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7SW5zdHJ1Y3Rpb24sIFN0eWxpbmdCdWlsZGVyfSBmcm9tICcuL3N0eWxpbmdfYnVpbGRlcic7XG5pbXBvcnQge0NPTlRFWFRfTkFNRSwgSU1QTElDSVRfUkVGRVJFTkNFLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCBhc0xpdGVyYWwsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcsIGludmFsaWQsIHRyaW1UcmFpbGluZ051bGxzLCB1bnN1cHBvcnRlZH0gZnJvbSAnLi91dGlsJztcblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5jb25zdCBMRUFESU5HX1RSSVZJQV9DSEFSUyA9IFsnICcsICdcXG4nLCAnXFxyJywgJ1xcdCddO1xuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgaGFuZGxlck5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGUgfCBudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckV4cHIgPSAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuYmluZGluZ0xldmVsID09PSAwKSA/XG4gICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgc2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgc2NvcGUsIGltcGxpY2l0UmVjZWl2ZXJFeHByLCBoYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSxcbiAgICAgIGV2ZW50QXN0LmhhbmRsZXJTcGFuKTtcblxuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSk7XG4gIH1cbiAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10cyk7XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UgISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3MgPSBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXTtcbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcblxuICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChldmVudE5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAodGFyZ2V0KSB7XG4gICAgcGFyYW1zLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChmYWxzZSksICAvLyBgdXNlQ2FwdHVyZWAgZmxhZywgZGVmYXVsdHMgdG8gYGZhbHNlYFxuICAgICAgICBvLmltcG9ydEV4cHIoR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KHRhcmdldCkgISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTWVtb3JpemVzIHRoZSBsYXN0IG5vZGUgaW5kZXggZm9yIHdoaWNoIGEgc2VsZWN0IGluc3RydWN0aW9uIGhhcyBiZWVuIGdlbmVyYXRlZC5cbiAgICogV2UncmUgaW5pdGlhbGl6aW5nIHRoaXMgdG8gLTEgdG8gZW5zdXJlIHRoZSBgc2VsZWN0KDApYCBpbnN0cnVjdGlvbiBpcyBnZW5lcmF0ZWQgYmVmb3JlIGFueVxuICAgKiByZWxldmFudCB1cGRhdGUgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBfbGFzdE5vZGVJbmRleFdpdGhGbHVzaDogbnVtYmVyID0gLTE7XG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gaTE4biBjb250ZXh0IGxvY2FsIHRvIHRoaXMgdGVtcGxhdGVcbiAgcHJpdmF0ZSBpMThuOiBJMThuQ29udGV4dHxudWxsID0gbnVsbDtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgLy8gTnVtYmVyIG9mIGJpbmRpbmcgc2xvdHNcbiAgcHJpdmF0ZSBfYmluZGluZ1Nsb3RzID0gMDtcblxuICBwcml2YXRlIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZztcblxuICAvLyBQcm9qZWN0aW9uIHNsb3RzIGZvdW5kIGluIHRoZSB0ZW1wbGF0ZS4gUHJvamVjdGlvbiBzbG90cyBjYW4gZGlzdHJpYnV0ZSBwcm9qZWN0ZWRcbiAgLy8gbm9kZXMgYmFzZWQgb24gYSBzZWxlY3Rvciwgb3IgY2FuIGp1c3QgdXNlIHRoZSB3aWxkY2FyZCBzZWxlY3RvciB0byBtYXRjaFxuICAvLyBhbGwgbm9kZXMgd2hpY2ggYXJlbid0IG1hdGNoaW5nIGFueSBzZWxlY3Rvci5cbiAgcHJpdmF0ZSBfbmdDb250ZW50UmVzZXJ2ZWRTbG90czogKHN0cmluZ3wnKicpW10gPSBbXTtcblxuICAvLyBOdW1iZXIgb2Ygbm9uLWRlZmF1bHQgc2VsZWN0b3JzIGZvdW5kIGluIGFsbCBwYXJlbnQgdGVtcGxhdGVzIG9mIHRoaXMgdGVtcGxhdGUuIFdlIG5lZWQgdG9cbiAgLy8gdHJhY2sgaXQgdG8gcHJvcGVybHkgYWRqdXN0IHByb2plY3Rpb24gc2xvdCBpbmRleCBpbiB0aGUgYHByb2plY3Rpb25gIGluc3RydWN0aW9uLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSAwO1xuXG4gIC8vIEV4cHJlc3Npb24gdGhhdCBzaG91bGQgYmUgdXNlZCBhcyBpbXBsaWNpdCByZWNlaXZlciB3aGVuIGNvbnZlcnRpbmcgdGVtcGxhdGVcbiAgLy8gZXhwcmVzc2lvbnMgdG8gb3V0cHV0IEFTVC5cbiAgcHJpdmF0ZSBfaW1wbGljaXRSZWNlaXZlckV4cHI6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwYXJlbnRCaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBsZXZlbCA9IDAsXG4gICAgICBwcml2YXRlIGNvbnRleHROYW1lOiBzdHJpbmd8bnVsbCwgcHJpdmF0ZSBpMThuQ29udGV4dDogSTE4bkNvbnRleHR8bnVsbCxcbiAgICAgIHByaXZhdGUgdGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsIHByaXZhdGUgdGVtcGxhdGVOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwsIHByaXZhdGUgZGlyZWN0aXZlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LCBwcml2YXRlIHBpcGVzOiBTZXQ8by5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgX25hbWVzcGFjZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgcHJpdmF0ZSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aDogc3RyaW5nLFxuICAgICAgcHJpdmF0ZSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4pIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUgPSBwYXJlbnRCaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUobGV2ZWwpO1xuXG4gICAgLy8gVHVybiB0aGUgcmVsYXRpdmUgY29udGV4dCBmaWxlIHBhdGggaW50byBhbiBpZGVudGlmaWVyIGJ5IHJlcGxhY2luZyBub24tYWxwaGFudW1lcmljXG4gICAgLy8gY2hhcmFjdGVycyB3aXRoIHVuZGVyc2NvcmVzLlxuICAgIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCA9IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLnJlcGxhY2UoL1teQS1aYS16MC05XS9nLCAnXycpICsgJ18nO1xuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIgPSBuZXcgVmFsdWVDb252ZXJ0ZXIoXG4gICAgICAgIGNvbnN0YW50UG9vbCwgKCkgPT4gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCksXG4gICAgICAgIChudW1TbG90czogbnVtYmVyKSA9PiB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHMpLFxuICAgICAgICAobmFtZSwgbG9jYWxOYW1lLCBzbG90LCB2YWx1ZTogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgbm9kZXM6IHQuTm9kZVtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSwgbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0OiBudW1iZXIgPSAwLFxuICAgICAgaTE4bj86IGkxOG4uQVNUKTogby5GdW5jdGlvbkV4cHIge1xuICAgIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCA9IG5nQ29udGVudFNlbGVjdG9yc09mZnNldDtcblxuICAgIGlmICh0aGlzLl9uYW1lc3BhY2UgIT09IFIzLm5hbWVzcGFjZUhUTUwpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCB0aGlzLl9uYW1lc3BhY2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB2YXJpYWJsZSBiaW5kaW5nc1xuICAgIHZhcmlhYmxlcy5mb3JFYWNoKHYgPT4gdGhpcy5yZWdpc3RlckNvbnRleHRWYXJpYWJsZXModikpO1xuXG4gICAgLy8gSW5pdGlhdGUgaTE4biBjb250ZXh0IGluIGNhc2U6XG4gICAgLy8gLSB0aGlzIHRlbXBsYXRlIGhhcyBwYXJlbnQgaTE4biBjb250ZXh0XG4gICAgLy8gLSBvciB0aGUgdGVtcGxhdGUgaGFzIGkxOG4gbWV0YSBhc3NvY2lhdGVkIHdpdGggaXQsXG4gICAgLy8gICBidXQgaXQncyBub3QgaW5pdGlhdGVkIGJ5IHRoZSBFbGVtZW50IChlLmcuIDxuZy10ZW1wbGF0ZSBpMThuPilcbiAgICBjb25zdCBpbml0STE4bkNvbnRleHQgPVxuICAgICAgICB0aGlzLmkxOG5Db250ZXh0IHx8IChpc0kxOG5Sb290Tm9kZShpMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGkxOG4pICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICEoaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUobm9kZXMpICYmIG5vZGVzWzBdLmkxOG4gPT09IGkxOG4pKTtcbiAgICBjb25zdCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9IGhhc1RleHRDaGlsZHJlbk9ubHkobm9kZXMpO1xuICAgIGlmIChpbml0STE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGkxOG4gISwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIFRoaXMgaXMgdGhlIGluaXRpYWwgcGFzcyB0aHJvdWdoIHRoZSBub2RlcyBvZiB0aGlzIHRlbXBsYXRlLiBJbiB0aGlzIHBhc3MsIHdlXG4gICAgLy8gcXVldWUgYWxsIGNyZWF0aW9uIG1vZGUgYW5kIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyBmb3IgZ2VuZXJhdGlvbiBpbiB0aGUgc2Vjb25kXG4gICAgLy8gcGFzcy4gSXQncyBuZWNlc3NhcnkgdG8gc2VwYXJhdGUgdGhlIHBhc3NlcyB0byBlbnN1cmUgbG9jYWwgcmVmcyBhcmUgZGVmaW5lZCBiZWZvcmVcbiAgICAvLyByZXNvbHZpbmcgYmluZGluZ3MuIFdlIGFsc28gY291bnQgYmluZGluZ3MgaW4gdGhpcyBwYXNzIGFzIHdlIHdhbGsgYm91bmQgZXhwcmVzc2lvbnMuXG4gICAgdC52aXNpdEFsbCh0aGlzLCBub2Rlcyk7XG5cbiAgICAvLyBBZGQgdG90YWwgYmluZGluZyBjb3VudCB0byBwdXJlIGZ1bmN0aW9uIGNvdW50IHNvIHB1cmUgZnVuY3Rpb24gaW5zdHJ1Y3Rpb25zIGFyZVxuICAgIC8vIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IHNsb3Qgb2Zmc2V0IHdoZW4gdXBkYXRlIGluc3RydWN0aW9ucyBhcmUgcHJvY2Vzc2VkLlxuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IHRoaXMuX2JpbmRpbmdTbG90cztcblxuICAgIC8vIFBpcGVzIGFyZSB3YWxrZWQgaW4gdGhlIGZpcnN0IHBhc3MgKHRvIGVucXVldWUgYHBpcGUoKWAgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGFuZFxuICAgIC8vIGBwaXBlQmluZGAgdXBkYXRlIGluc3RydWN0aW9ucyksIHNvIHdlIGhhdmUgdG8gdXBkYXRlIHRoZSBzbG90IG9mZnNldHMgbWFudWFsbHlcbiAgICAvLyB0byBhY2NvdW50IGZvciBiaW5kaW5ncy5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlci51cGRhdGVQaXBlU2xvdE9mZnNldHModGhpcy5fYmluZGluZ1Nsb3RzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBiZSBwcm9jZXNzZWQgYmVmb3JlIGNyZWF0aW9uIGluc3RydWN0aW9ucyBzbyB0ZW1wbGF0ZSgpXG4gICAgLy8gaW5zdHJ1Y3Rpb25zIGNhbiBiZSBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBpbnRlcm5hbCBjb25zdCBjb3VudC5cbiAgICB0aGlzLl9uZXN0ZWRUZW1wbGF0ZUZucy5mb3JFYWNoKGJ1aWxkVGVtcGxhdGVGbiA9PiBidWlsZFRlbXBsYXRlRm4oKSk7XG5cbiAgICAvLyBPdXRwdXQgdGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiB3aGVuIHNvbWUgYDxuZy1jb250ZW50PmAgdGFncyBhcmUgcHJlc2VudC5cbiAgICAvLyBUaGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIGlzIG9ubHkgZW1pdHRlZCBmb3IgdGhlIGNvbXBvbmVudCB0ZW1wbGF0ZSBhbmRcbiAgICAvLyBpcyBza2lwcGVkIGZvciBuZXN0ZWQgdGVtcGxhdGVzICg8bmctdGVtcGxhdGU+IHRhZ3MpLlxuICAgIGlmICh0aGlzLmxldmVsID09PSAwICYmIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgICAvLyBCeSBkZWZhdWx0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb25zIGNyZWF0ZXMgb25lIHNsb3QgZm9yIHRoZSB3aWxkY2FyZFxuICAgICAgLy8gc2VsZWN0b3IgaWYgbm8gcGFyYW1ldGVycyBhcmUgcGFzc2VkLiBUaGVyZWZvcmUgd2Ugb25seSB3YW50IHRvIGFsbG9jYXRlIGEgbmV3XG4gICAgICAvLyBhcnJheSBmb3IgdGhlIHByb2plY3Rpb24gc2xvdHMgaWYgdGhlIGRlZmF1bHQgcHJvamVjdGlvbiBzbG90IGlzIG5vdCBzdWZmaWNpZW50LlxuICAgICAgaWYgKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID4gMSB8fCB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzWzBdICE9PSAnKicpIHtcbiAgICAgICAgY29uc3QgcjNSZXNlcnZlZFNsb3RzID0gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5tYXAoXG4gICAgICAgICAgICBzID0+IHMgIT09ICcqJyA/IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihzKSA6IHMpO1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyM1Jlc2VydmVkU2xvdHMpLCB0cnVlKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbmNlIHdlIGFjY3VtdWxhdGUgbmdDb250ZW50IHNlbGVjdG9ycyB3aGlsZSBwcm9jZXNzaW5nIHRlbXBsYXRlIGVsZW1lbnRzLFxuICAgICAgLy8gd2UgKnByZXBlbmQqIGBwcm9qZWN0aW9uRGVmYCB0byBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYmxvY2ssIHRvIHB1dCBpdCBiZWZvcmVcbiAgICAgIC8vIGFueSBgcHJvamVjdGlvbmAgaW5zdHJ1Y3Rpb25zXG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucHJvamVjdGlvbkRlZiwgcGFyYW1ldGVycywgLyogcHJlcGVuZCAqLyB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgY3JlYXRpb24gbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBiaW5kaW5ncyBpbiBsaXN0ZW5lcnMpXG4gICAgY29uc3QgY3JlYXRpb25TdGF0ZW1lbnRzID0gdGhpcy5fY3JlYXRpb25Db2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vIEdlbmVyYXRlIGFsbCB0aGUgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgcHJvcGVydHkgb3IgdGV4dCBiaW5kaW5ncylcbiAgICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzID0gdGhpcy5fdXBkYXRlQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyAgVmFyaWFibGUgZGVjbGFyYXRpb24gbXVzdCBvY2N1ciBhZnRlciBiaW5kaW5nIHJlc29sdXRpb24gc28gd2UgY2FuIGdlbmVyYXRlIGNvbnRleHRcbiAgICAvLyAgaW5zdHJ1Y3Rpb25zIHRoYXQgYnVpbGQgb24gZWFjaCBvdGhlci5cbiAgICAvLyBlLmcuIGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpLiRpbXBsaWNpdCgpOyBjb25zdCBiID0gbmV4dENvbnRleHQoKTtcbiAgICBjb25zdCBjcmVhdGlvblZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52aWV3U25hcHNob3RTdGF0ZW1lbnRzKCk7XG4gICAgY29uc3QgdXBkYXRlVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZhcmlhYmxlRGVjbGFyYXRpb25zKCkuY29uY2F0KHRoaXMuX3RlbXBWYXJpYWJsZXMpO1xuXG4gICAgY29uc3QgY3JlYXRpb25CbG9jayA9IGNyZWF0aW9uU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICAgICAgICAgIGNvcmUuUmVuZGVyRmxhZ3MuQ3JlYXRlLCBjcmVhdGlvblZhcmlhYmxlcy5jb25jYXQoY3JlYXRpb25TdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICBjb25zdCB1cGRhdGVCbG9jayA9IHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVZhcmlhYmxlcy5jb25jYXQodXBkYXRlU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgcmV0dXJuIG8uZm4oXG4gICAgICAgIC8vIGkuZS4gKHJmOiBSZW5kZXJGbGFncywgY3R4OiBhbnkpXG4gICAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICAgIFtcbiAgICAgICAgICAvLyBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGZvciBxdWVyeSByZWZyZXNoIChpLmUuIGxldCBfdDogYW55OylcbiAgICAgICAgICAuLi50aGlzLl9wcmVmaXhDb2RlLFxuICAgICAgICAgIC8vIENyZWF0aW5nIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuQ3JlYXRlKSB7IC4uLiB9KVxuICAgICAgICAgIC4uLmNyZWF0aW9uQmxvY2ssXG4gICAgICAgICAgLy8gQmluZGluZyBhbmQgcmVmcmVzaCBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLlVwZGF0ZSkgey4uLn0pXG4gICAgICAgICAgLi4udXBkYXRlQmxvY2ssXG4gICAgICAgIF0sXG4gICAgICAgIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgdGhpcy50ZW1wbGF0ZU5hbWUpO1xuICB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7IHJldHVybiB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0KG5hbWUpOyB9XG5cbiAgLy8gTG9jYWxSZXNvbHZlclxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQgeyB0aGlzLl9iaW5kaW5nU2NvcGUubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOyB9XG5cbiAgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBfcGFyYW1zOiB7W2tleTogc3RyaW5nXTogYW55fSA9IHt9O1xuICAgIGlmIChwYXJhbXMgJiYgT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGgpIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhcmFtcykuZm9yRWFjaChrZXkgPT4gX3BhcmFtc1tmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lKGtleSldID0gcGFyYW1zW2tleV0pO1xuICAgIH1cbiAgICBjb25zdCBtZXRhID0gbWV0YUZyb21JMThuTWVzc2FnZShtZXNzYWdlKTtcbiAgICBjb25zdCBjb250ZW50ID0gZ2V0U2VyaWFsaXplZEkxOG5Db250ZW50KG1lc3NhZ2UpO1xuICAgIGNvbnN0IHN0YXRlbWVudHMgPVxuICAgICAgICBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhfcmVmLCBjbG9zdXJlVmFyLCBjb250ZW50LCBtZXRhLCBfcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zOiBBU1RbXSkge1xuICAgIGlmIChleHByZXNzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICBleHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4gdGhpcy5pMThuICEuYXBwZW5kQmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgfVxuICB9XG5cbiAgaTE4bkJpbmRQcm9wcyhwcm9wczoge1trZXk6IHN0cmluZ106IHQuVGV4dCB8IHQuQm91bmRUZXh0fSk6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259IHtcbiAgICBjb25zdCBib3VuZDoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IHByb3BzW2tleV07XG4gICAgICBpZiAocHJvcCBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKHByb3AudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnN9ID0gdmFsdWU7XG4gICAgICAgICAgY29uc3Qge2lkLCBiaW5kaW5nc30gPSB0aGlzLmkxOG4gITtcbiAgICAgICAgICBjb25zdCBsYWJlbCA9IGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nKHN0cmluZ3MsIGJpbmRpbmdzLnNpemUsIGlkKTtcbiAgICAgICAgICB0aGlzLmkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9ucyk7XG4gICAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChsYWJlbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH1cblxuICBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKG1lc3NhZ2VJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMpIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgICAgY29uc3QgdW5pcXVlU3VmZml4ID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgICAgbmFtZSA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG4gIH1cblxuICBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIGkxOG5TdGFydChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIG1ldGE6IGkxOG4uQVNULCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG4gPSB0aGlzLmkxOG5Db250ZXh0LmZvcmtDaGlsZENvbnRleHQoaW5kZXgsIHRoaXMudGVtcGxhdGVJbmRleCAhLCBtZXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVmID0gby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1BSRUZJWCkpO1xuICAgICAgdGhpcy5pMThuID0gbmV3IEkxOG5Db250ZXh0KGluZGV4LCByZWYsIDAsIHRoaXMudGVtcGxhdGVJbmRleCwgbWV0YSk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgaTE4blN0YXJ0IGluc3RydWN0aW9uXG4gICAgY29uc3Qge2lkLCByZWZ9ID0gdGhpcy5pMThuO1xuICAgIGNvbnN0IHBhcmFtczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGluZGV4KSwgcmVmXTtcbiAgICBpZiAoaWQgPiAwKSB7XG4gICAgICAvLyBkbyBub3QgcHVzaCAzcmQgYXJndW1lbnQgKHN1Yi1ibG9jayBpZClcbiAgICAgIC8vIGludG8gaTE4blN0YXJ0IGNhbGwgZm9yIHRvcCBsZXZlbCBpMThuIGNvbnRleHRcbiAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChpZCkpO1xuICAgIH1cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3Bhbiwgc2VsZkNsb3NpbmcgPyBSMy5pMThuIDogUjMuaTE4blN0YXJ0LCBwYXJhbXMpO1xuICB9XG5cbiAgaTE4bkVuZChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2kxOG5FbmQgaXMgZXhlY3V0ZWQgd2l0aCBubyBpMThuIGNvbnRleHQgcHJlc2VudCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5Db250ZXh0LnJlY29uY2lsZUNoaWxkQ29udGV4dCh0aGlzLmkxOG4pO1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bkNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuKTtcbiAgICB9XG5cbiAgICAvLyBzZXR1cCBhY2N1bXVsYXRlZCBiaW5kaW5nc1xuICAgIGNvbnN0IHtpbmRleCwgYmluZGluZ3N9ID0gdGhpcy5pMThuO1xuICAgIGlmIChiaW5kaW5ncy5zaXplKSB7XG4gICAgICBiaW5kaW5ncy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgaW5kZXgsIHNwYW4sIFIzLmkxOG5FeHAsICgpID0+IFt0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYmluZGluZyldKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihpbmRleCwgc3BhbiwgUjMuaTE4bkFwcGx5LCBbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIH1cbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkVuZCk7XG4gICAgfVxuICAgIHRoaXMuaTE4biA9IG51bGw7ICAvLyByZXNldCBsb2NhbCBpMThuIGNvbnRleHRcbiAgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBwcm9qZWN0aW9uU2xvdElkeCA9IHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCArIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoO1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG4gICAgY29uc3QgYXR0cmlidXRlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaChuZ0NvbnRlbnQuc2VsZWN0b3IpO1xuXG4gICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cmlidXRlO1xuICAgICAgaWYgKG5hbWUgPT09IE5HX1BST0pFQ1RfQVNfQVRUUl9OQU1FKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCguLi5nZXROZ1Byb2plY3RBc0xpdGVyYWwoYXR0cmlidXRlKSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSAhPT0gTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUikge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goby5saXRlcmFsKG5hbWUpLCBvLmxpdGVyYWwodmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChhdHRyaWJ1dGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpLCBvLmxpdGVyYWxBcnIoYXR0cmlidXRlcykpO1xuICAgIH0gZWxzZSBpZiAocHJvamVjdGlvblNsb3RJZHggIT09IDApIHtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmxpdGVyYWwocHJvamVjdGlvblNsb3RJZHgpKTtcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obmdDb250ZW50LnNvdXJjZVNwYW4sIFIzLnByb2plY3Rpb24sIHBhcmFtZXRlcnMpO1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRQcm9qZWN0aW9uKG5nQ29udGVudC5pMThuICEsIHNsb3QpO1xuICAgIH1cbiAgfVxuXG5cbiAgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHN0eWxpbmdCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBudWxsKTtcblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50OiBib29sZWFuID1cbiAgICAgICAgaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGVsZW1lbnQuaTE4bik7XG5cbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4bkF0dHJzOiAodC5UZXh0QXR0cmlidXRlIHwgdC5Cb3VuZEF0dHJpYnV0ZSlbXSA9IFtdO1xuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBIYW5kbGUgc3R5bGluZywgaTE4biwgbmdOb25CaW5kYWJsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHI7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBpbnRvIGEgc2VwYXJhdGUgYXJyYXkgZm9yIGkxOG4gcHJvY2Vzc2luZywgYnV0IGFsc28ga2VlcCBzdWNoXG4gICAgICAgICAgLy8gYXR0cmlidXRlcyBpbiB0aGUgbWFpbiBsaXN0IHRvIG1ha2UgdGhlbSBhdmFpbGFibGUgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBhdCBydW50aW1lLlxuICAgICAgICAgIC8vIFRPRE8oRlctMTI0OCk6IHByZXZlbnQgYXR0cmlidXRlcyBkdXBsaWNhdGlvbiBpbiBgaTE4bkF0dHJpYnV0ZXNgIGFuZCBgZWxlbWVudFN0YXJ0YFxuICAgICAgICAgIC8vIGFyZ3VtZW50c1xuICAgICAgICAgIGkxOG5BdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dEF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG91dHB1dEF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBpZiAoYXR0ci5uYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgby5saXRlcmFsKGF0dHIudmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBhdHRyaWJ1dGVzLnB1c2goLi4udGhpcy5wcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICAgIGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMsIHN0eWxpbmdCdWlsZGVyLCBbXSwgaTE4bkF0dHJzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJpYnV0ZXMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPGRpdiAjZm9vICNiYXI9XCJiYXpcIj4pXG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIoZWxlbWVudC5yZWZlcmVuY2VzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IGhhc0NoaWxkcmVuID0gKCkgPT4ge1xuICAgICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgICAgLy8gd2UgZG8gbm90IGFwcGVuZCB0ZXh0IG5vZGUgaW5zdHJ1Y3Rpb25zIGFuZCBJQ1VzIGluc2lkZSBpMThuIHNlY3Rpb24sXG4gICAgICAgIC8vIHNvIHdlIGV4Y2x1ZGUgdGhlbSB3aGlsZSBjYWxjdWxhdGluZyB3aGV0aGVyIGN1cnJlbnQgZWxlbWVudCBoYXMgY2hpbGRyZW5cbiAgICAgICAgcmV0dXJuICFoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMDtcbiAgICB9O1xuXG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiA9ICFzdHlsaW5nQnVpbGRlci5oYXNCaW5kaW5ncyAmJiAhaXNOZ0NvbnRhaW5lciAmJlxuICAgICAgICBlbGVtZW50Lm91dHB1dHMubGVuZ3RoID09PSAwICYmIGkxOG5BdHRycy5sZW5ndGggPT09IDAgJiYgIWhhc0NoaWxkcmVuKCk7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9ICFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uICYmXG4gICAgICAgICFzdHlsaW5nQnVpbGRlci5oYXNCaW5kaW5ncyAmJiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmVsZW1lbnQsIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJTdGFydCA6IFIzLmVsZW1lbnRTdGFydCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG5cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCBSMy5kaXNhYmxlQmluZGluZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBwcm9jZXNzIGkxOG4gZWxlbWVudCBhdHRyaWJ1dGVzXG4gICAgICBpZiAoaTE4bkF0dHJzLmxlbmd0aCkge1xuICAgICAgICBsZXQgaGFzQmluZGluZ3M6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICAgICAgY29uc3QgaTE4bkF0dHJBcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgICAgICBpMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYXR0ci5pMThuICFhcyBpMThuLk1lc3NhZ2U7XG4gICAgICAgICAgaWYgKGF0dHIgaW5zdGFuY2VvZiB0LlRleHRBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0ZWQgPSBhdHRyLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHMoY29udmVydGVkKTtcbiAgICAgICAgICAgIGlmIChjb252ZXJ0ZWQgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnMpO1xuICAgICAgICAgICAgICBpMThuQXR0ckFyZ3MucHVzaChvLmxpdGVyYWwoYXR0ci5uYW1lKSwgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBhcmFtcykpO1xuICAgICAgICAgICAgICBjb252ZXJ0ZWQuZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHtcbiAgICAgICAgICAgICAgICBoYXNCaW5kaW5ncyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5FeHAsXG4gICAgICAgICAgICAgICAgICAgICgpID0+IFt0aGlzLmNvbnZlcnRFeHByZXNzaW9uQmluZGluZyhleHByZXNzaW9uKV0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaTE4bkF0dHJBcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IGluZGV4OiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpO1xuICAgICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGkxOG5BdHRyQXJncyksIHRydWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BdHRyaWJ1dGVzLCBbaW5kZXgsIGFyZ3NdKTtcbiAgICAgICAgICBpZiAoaGFzQmluZGluZ3MpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBzdHlsZSBiaW5kaW5ncyBjb2RlIGlzIHBsYWNlZCBpbnRvIHR3byBkaXN0aW5jdCBibG9ja3Mgd2l0aGluIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1RcbiAgICAgIC8vIGNvZGU6IGNyZWF0aW9uIGFuZCB1cGRhdGUuIFRoZSBjcmVhdGlvbiBjb2RlIGNvbnRhaW5zIHRoZSBgc3R5bGluZ2AgaW5zdHJ1Y3Rpb25zXG4gICAgICAvLyB3aGljaCB3aWxsIGFwcGx5IHRoZSBjb2xsZWN0ZWQgYmluZGluZyB2YWx1ZXMgdG8gdGhlIGVsZW1lbnQuIGBzdHlsaW5nYCBpc1xuICAgICAgLy8gZGVzaWduZWQgdG8gcnVuIGluc2lkZSBvZiBgZWxlbWVudFN0YXJ0YCBhbmQgYGVsZW1lbnRFbmRgLiBUaGUgdXBkYXRlIGluc3RydWN0aW9uc1xuICAgICAgLy8gKHRoaW5ncyBsaWtlIGBzdHlsZVByb3BgLCBgY2xhc3NQcm9wYCwgZXRjLi4pIGFyZSBhcHBsaWVkIGxhdGVyIG9uIGluIHRoaXNcbiAgICAgIC8vIGZpbGVcbiAgICAgIHRoaXMucHJvY2Vzc1N0eWxpbmdJbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50SW5kZXgsXG4gICAgICAgICAgc3R5bGluZ0J1aWxkZXIuYnVpbGRTdHlsaW5nSW5zdHJ1Y3Rpb24oZWxlbWVudC5zb3VyY2VTcGFuLCB0aGlzLmNvbnN0YW50UG9vbCksIHRydWUpO1xuXG4gICAgICAvLyBHZW5lcmF0ZSBMaXN0ZW5lcnMgKG91dHB1dHMpXG4gICAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+IHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgICAgb3V0cHV0QXN0LnNvdXJjZVNwYW4sIFIzLmxpc3RlbmVyLFxuICAgICAgICAgICAgdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoZWxlbWVudC5uYW1lLCBvdXRwdXRBc3QsIGVsZW1lbnRJbmRleCkpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIE5vdGU6IGl0J3MgaW1wb3J0YW50IHRvIGtlZXAgaTE4bi9pMThuU3RhcnQgaW5zdHJ1Y3Rpb25zIGFmdGVyIGkxOG5BdHRyaWJ1dGVzIGFuZFxuICAgICAgLy8gbGlzdGVuZXJzLCB0byBtYWtlIHN1cmUgaTE4bkF0dHJpYnV0ZXMgaW5zdHJ1Y3Rpb24gdGFyZ2V0cyBjdXJyZW50IGVsZW1lbnQgYXQgcnVudGltZS5cbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5TdGFydChlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4biAhLCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGNvZGUgaGVyZSB3aWxsIGNvbGxlY3QgYWxsIHVwZGF0ZS1sZXZlbCBzdHlsaW5nIGluc3RydWN0aW9ucyBhbmQgYWRkIHRoZW0gdG8gdGhlXG4gICAgLy8gdXBkYXRlIGJsb2NrIG9mIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1QgY29kZS4gSW5zdHJ1Y3Rpb25zIGxpa2UgYHN0eWxlUHJvcGAsXG4gICAgLy8gYHN0eWxlTWFwYCwgYGNsYXNzTWFwYCwgYGNsYXNzUHJvcGAgYW5kIGBzdHlsaW5nQXBwbHlgXG4gICAgLy8gYXJlIGFsbCBnZW5lcmF0ZWQgYW5kIGFzc2lnbmVkIGluIHRoZSBjb2RlIGJlbG93LlxuICAgIGNvbnN0IHN0eWxpbmdJbnN0cnVjdGlvbnMgPSBzdHlsaW5nQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICBjb25zdCBsaW1pdCA9IHN0eWxpbmdJbnN0cnVjdGlvbnMubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IHN0eWxpbmdJbnN0cnVjdGlvbnNbaV07XG4gICAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gaW5zdHJ1Y3Rpb24uYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICB0aGlzLnByb2Nlc3NTdHlsaW5nSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbiwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8vIHRoZSByZWFzb24gd2h5IGB1bmRlZmluZWRgIGlzIHVzZWQgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgdW5kZXJzdGFuZHMgdGhpcyBhcyBhXG4gICAgLy8gc3BlY2lhbCB2YWx1ZSB0byBzeW1ib2xpemUgdGhhdCB0aGVyZSBpcyBubyBSSFMgdG8gdGhpcyBiaW5kaW5nXG4gICAgLy8gVE9ETyAobWF0c2tvKTogcmV2aXNpdCB0aGlzIG9uY2UgRlctOTU5IGlzIGFwcHJvYWNoZWRcbiAgICBjb25zdCBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uID0gby5saXRlcmFsKHVuZGVmaW5lZCk7XG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgYWxsT3RoZXJJbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IGlucHV0VHlwZSA9IGlucHV0LnR5cGU7XG4gICAgICBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIC8vIGFuaW1hdGlvbiBiaW5kaW5ncyBjYW4gYmUgcHJlc2VudGVkIGluIHRoZSBmb2xsb3dpbmcgZm9ybWF0czpcbiAgICAgICAgLy8gMS4gW0BiaW5kaW5nXT1cImZvb0V4cFwiXG4gICAgICAgIC8vIDIuIFtAYmluZGluZ109XCJ7dmFsdWU6Zm9vRXhwLCBwYXJhbXM6ey4uLn19XCJcbiAgICAgICAgLy8gMy4gW0BiaW5kaW5nXVxuICAgICAgICAvLyA0LiBAYmluZGluZ1xuICAgICAgICAvLyBBbGwgZm9ybWF0cyB3aWxsIGJlIHZhbGlkIGZvciB3aGVuIGEgc3ludGhldGljIGJpbmRpbmcgaXMgY3JlYXRlZC5cbiAgICAgICAgLy8gVGhlIHJlYXNvbmluZyBmb3IgdGhpcyBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciBzaG91bGQgZ2V0IGVhY2hcbiAgICAgICAgLy8gc3ludGhldGljIGJpbmRpbmcgdmFsdWUgaW4gdGhlIG9yZGVyIG9mIHRoZSBhcnJheSB0aGF0IHRoZXkgYXJlXG4gICAgICAgIC8vIGRlZmluZWQgaW4uLi5cbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIExpdGVyYWxQcmltaXRpdmUgPyAhIXZhbHVlLnZhbHVlIDogdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGNvbnN0IGJpbmRpbmdOYW1lID0gcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShpbnB1dC5uYW1lKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMucHJvcGVydHksICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgby5saXRlcmFsKGJpbmRpbmdOYW1lKSxcbiAgICAgICAgICAgIChoYXNWYWx1ZSA/IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSwgLyogc2tpcEJpbmRGbiAqLyB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIG11c3Qgc2tpcCBhdHRyaWJ1dGVzIHdpdGggYXNzb2NpYXRlZCBpMThuIGNvbnRleHQsIHNpbmNlIHRoZXNlIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWRcbiAgICAgICAgLy8gc2VwYXJhdGVseSBhbmQgY29ycmVzcG9uZGluZyBgaTE4bkV4cGAgYW5kIGBpMThuQXBwbHlgIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAgICBpZiAoaW5wdXQuaTE4bikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBbYXR0ck5hbWVzcGFjZSwgYXR0ck5hbWVdID0gc3BsaXROc05hbWUoaW5wdXQubmFtZSk7XG4gICAgICAgICAgY29uc3QgaXNBdHRyaWJ1dGVCaW5kaW5nID0gaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LnNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGVCaW5kaW5nKTtcbiAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VMaXRlcmFsID0gby5saXRlcmFsKGF0dHJOYW1lc3BhY2UpO1xuXG4gICAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2Fzbid0IGEgc2FuaXRpemF0aW9uIHJlZiwgd2UgbmVlZCB0byBhZGRcbiAgICAgICAgICAgICAgLy8gYW4gZXh0cmEgcGFyYW0gc28gdGhhdCB3ZSBjYW4gcGFzcyBpbiB0aGUgbmFtZXNwYWNlLlxuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCksIG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBbcHJvcF09XCJ2YWx1ZVwiXG4gICAgICAgICAgICAgIHRoaXMuYm91bmRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIFIzLnByb3BlcnR5LCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsIHBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiAmJiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCh2YWx1ZSkgPiAxKSB7XG4gICAgICAgICAgICAgIC8vIGF0dHIubmFtZT1cInRleHR7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgICBwYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYm91bmRWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbiA/IHZhbHVlLmV4cHJlc3Npb25zWzBdIDogdmFsdWU7XG4gICAgICAgICAgICAgIC8vIFthdHRyLm5hbWVdPVwidmFsdWVcIiBvciBhdHRyLm5hbWU9XCJ7e3ZhbHVlfX1cIlxuICAgICAgICAgICAgICB0aGlzLmJvdW5kVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBSMy5hdHRyaWJ1dGUsIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCBib3VuZFZhbHVlLCBwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGFzcyBwcm9wXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgUjMuY2xhc3NQcm9wLCAoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgby5saXRlcmFsKGVsZW1lbnRJbmRleCksIG8ubGl0ZXJhbChhdHRyTmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICBjb25zdCBzcGFuID0gZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5FbmQoc3BhbiwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGEgYm91bmQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzIGBbcHJvcF09XCJ2YWx1ZVwiYCBvclxuICAgKiBgW2F0dHIudGl0bGVdPVwidmFsdWVcImBcbiAgICovXG4gIGJvdW5kVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgdmFsdWU6IGFueSwgcGFyYW1zOiBhbnlbXSkge1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbiwgKCkgPT4ge1xuICAgICAgcmV0dXJuIFtvLmxpdGVyYWwoYXR0ck5hbWUpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUsIHRydWUpLCAuLi5wYXJhbXNdO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYW4gdXBkYXRlIGluc3RydWN0aW9uIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzXG4gICAqIGBwcm9wPVwie3t2YWx1ZX19XCJgIG9yIGBhdHRyLnRpdGxlPVwie3t2YWx1ZX19XCJgXG4gICAqL1xuICBpbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50SW5kZXg6IG51bWJlciwgYXR0ck5hbWU6IHN0cmluZyxcbiAgICAgIGlucHV0OiB0LkJvdW5kQXR0cmlidXRlLCB2YWx1ZTogYW55LCBwYXJhbXM6IGFueVtdKSB7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbixcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChhdHRyTmFtZSksIC4uLnRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpLCAuLi5wYXJhbXNdKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IHQuVGVtcGxhdGUpIHtcbiAgICBjb25zdCBOR19URU1QTEFURV9UQUdfTkFNRSA9ICduZy10ZW1wbGF0ZSc7XG4gICAgY29uc3QgdGVtcGxhdGVJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFRlbXBsYXRlKHRlbXBsYXRlLmkxOG4gISwgdGVtcGxhdGVJbmRleCk7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcih0ZW1wbGF0ZS50YWdOYW1lIHx8ICcnKTtcbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9JHt0YWdOYW1lID8gJ18nICsgdGFnTmFtZSA6ICcnfV8ke3RlbXBsYXRlSW5kZXh9YDtcbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVgO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICBvLnZhcmlhYmxlKHRlbXBsYXRlTmFtZSksXG5cbiAgICAgIC8vIFdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHRhZydzIG5hbWVzcGFjZSBoZXJlLCBiZWNhdXNlIHdlIGluZmVyXG4gICAgICAvLyBpdCBiYXNlZCBvbiB0aGUgcGFyZW50IG5vZGVzIGluc2lkZSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGUudGFnTmFtZSA/IHNwbGl0TnNOYW1lKHRlbXBsYXRlLnRhZ05hbWUpWzFdIDogdGVtcGxhdGUudGFnTmFtZSksXG4gICAgXTtcblxuICAgIC8vIGZpbmQgZGlyZWN0aXZlcyBtYXRjaGluZyBvbiBhIGdpdmVuIDxuZy10ZW1wbGF0ZT4gbm9kZVxuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKE5HX1RFTVBMQVRFX1RBR19OQU1FLCB0ZW1wbGF0ZSk7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICB0ZW1wbGF0ZS5hdHRyaWJ1dGVzLmZvckVhY2goXG4gICAgICAgIChhOiB0LlRleHRBdHRyaWJ1dGUpID0+IHsgYXR0cnNFeHBycy5wdXNoKGFzTGl0ZXJhbChhLm5hbWUpLCBhc0xpdGVyYWwoYS52YWx1ZSkpOyB9KTtcbiAgICBhdHRyc0V4cHJzLnB1c2goLi4udGhpcy5wcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICAgIHRlbXBsYXRlLmlucHV0cywgdGVtcGxhdGUub3V0cHV0cywgdW5kZWZpbmVkLCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJzRXhwcnMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmICh0ZW1wbGF0ZS5yZWZlcmVuY2VzICYmIHRlbXBsYXRlLnJlZmVyZW5jZXMubGVuZ3RoKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5wcmVwYXJlUmVmc1BhcmFtZXRlcih0ZW1wbGF0ZS5yZWZlcmVuY2VzKSk7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5pbXBvcnRFeHByKFIzLnRlbXBsYXRlUmVmRXh0cmFjdG9yKSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvblxuICAgIGNvbnN0IHRlbXBsYXRlVmlzaXRvciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbCwgdGhpcy5fYmluZGluZ1Njb3BlLCB0aGlzLmxldmVsICsgMSwgY29udGV4dE5hbWUsIHRoaXMuaTE4bixcbiAgICAgICAgdGVtcGxhdGVJbmRleCwgdGVtcGxhdGVOYW1lLCB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIsIHRoaXMuZGlyZWN0aXZlcywgdGhpcy5waXBlVHlwZUJ5TmFtZSxcbiAgICAgICAgdGhpcy5waXBlcywgdGhpcy5fbmFtZXNwYWNlLCB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgsIHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+e3sgZm9vIH19PC9kaXY+ICA8ZGl2ICNmb28+PC9kaXY+XG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwciA9IHRlbXBsYXRlVmlzaXRvci5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICAgICAgdGVtcGxhdGUuY2hpbGRyZW4sIHRlbXBsYXRlLnZhcmlhYmxlcyxcbiAgICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCArIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCwgdGVtcGxhdGUuaTE4bik7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdCh0ZW1wbGF0ZU5hbWUsIG51bGwpKTtcbiAgICAgIGlmICh0ZW1wbGF0ZVZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaCguLi50ZW1wbGF0ZVZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gZS5nLiB0ZW1wbGF0ZSgxLCBNeUNvbXBfVGVtcGxhdGVfMSlcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGVtcGxhdGUuc291cmNlU3BhbiwgUjMudGVtcGxhdGVDcmVhdGUsICgpID0+IHtcbiAgICAgIHBhcmFtZXRlcnMuc3BsaWNlKFxuICAgICAgICAgIDIsIDAsIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0Q29uc3RDb3VudCgpKSxcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldFZhckNvdW50KCkpKTtcbiAgICAgIHJldHVybiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKTtcbiAgICB9KTtcblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIMm1ybVwcm9wZXJ0eSgnbmdGb3JPZicsIGN0eC5pdGVtcyksIGV0IGFsO1xuICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlLCB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgbmctdGVtcGxhdGUgZWxlbWVudHMuXG4gICAgaWYgKHRlbXBsYXRlLnRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZSwgdGVtcGxhdGVJbmRleCwgdGVtcGxhdGUuaW5wdXRzKTtcbiAgICAgIC8vIEdlbmVyYXRlIGxpc3RlbmVycyBmb3IgZGlyZWN0aXZlIG91dHB1dFxuICAgICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBvdXRwdXRBc3Quc291cmNlU3BhbiwgUjMubGlzdGVuZXIsXG4gICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4gISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksXG4gICAgICAgICAgKCkgPT4gdGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgIG5vZGVJbmRleCwgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0QmluZGluZywgKCkgPT4gW3RoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSldKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogdC5UZXh0KSB7XG4gICAgLy8gd2hlbiBhIHRleHQgZWxlbWVudCBpcyBsb2NhdGVkIHdpdGhpbiBhIHRyYW5zbGF0YWJsZVxuICAgIC8vIGJsb2NrLCB3ZSBleGNsdWRlIHRoaXMgdGV4dCBlbGVtZW50IGZyb20gaW5zdHJ1Y3Rpb25zIHNldCxcbiAgICAvLyBzaW5jZSBpdCB3aWxsIGJlIGNhcHR1cmVkIGluIGkxOG4gY29udGVudCBhbmQgcHJvY2Vzc2VkIGF0IHJ1bnRpbWVcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIHRleHQuc291cmNlU3BhbiwgUjMudGV4dCwgW28ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSksIG8ubGl0ZXJhbCh0ZXh0LnZhbHVlKV0pO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0SWN1KGljdTogdC5JY3UpIHtcbiAgICBsZXQgaW5pdFdhc0ludm9rZWQgPSBmYWxzZTtcblxuICAgIC8vIGlmIGFuIElDVSB3YXMgY3JlYXRlZCBvdXRzaWRlIG9mIGkxOG4gYmxvY2ssIHdlIHN0aWxsIHRyZWF0XG4gICAgLy8gaXQgYXMgYSB0cmFuc2xhdGFibGUgZW50aXR5IGFuZCBpbnZva2UgaTE4blN0YXJ0IGFuZCBpMThuRW5kXG4gICAgLy8gdG8gZ2VuZXJhdGUgaTE4biBjb250ZXh0IGFuZCB0aGUgbmVjZXNzYXJ5IGluc3RydWN0aW9uc1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICBpbml0V2FzSW52b2tlZCA9IHRydWU7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpY3UuaTE4biAhLCB0cnVlKTtcbiAgICB9XG5cbiAgICBjb25zdCBpMThuID0gdGhpcy5pMThuICE7XG4gICAgY29uc3QgdmFycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UudmFycyk7XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS5wbGFjZWhvbGRlcnMpO1xuXG4gICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICBjb25zdCBtZXNzYWdlID0gaWN1LmkxOG4gIWFzIGkxOG4uTWVzc2FnZTtcbiAgICBjb25zdCB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+XG4gICAgICAgIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgW3JhdywgbWFwTGl0ZXJhbCh2YXJzLCB0cnVlKV0pO1xuXG4gICAgLy8gaW4gY2FzZSB0aGUgd2hvbGUgaTE4biBtZXNzYWdlIGlzIGEgc2luZ2xlIElDVSAtIHdlIGRvIG5vdCBuZWVkIHRvXG4gICAgLy8gY3JlYXRlIGEgc2VwYXJhdGUgdG9wLWxldmVsIHRyYW5zbGF0aW9uLCB3ZSBjYW4gdXNlIHRoZSByb290IHJlZiBpbnN0ZWFkXG4gICAgLy8gYW5kIG1ha2UgdGhpcyBJQ1UgYSB0b3AtbGV2ZWwgdHJhbnNsYXRpb25cbiAgICBpZiAoaXNTaW5nbGVJMThuSWN1KGkxOG4ubWV0YSkpIHtcbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwbGFjZWhvbGRlcnMsIGkxOG4ucmVmLCB0cmFuc2Zvcm1Gbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgICBjb25zdCByZWYgPSB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGxhY2Vob2xkZXJzLCB1bmRlZmluZWQsIHRyYW5zZm9ybUZuKTtcbiAgICAgIGkxOG4uYXBwZW5kSWN1KGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKS5uYW1lLCByZWYpO1xuICAgIH1cblxuICAgIGlmIChpbml0V2FzSW52b2tlZCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHRydWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVEYXRhU2xvdCgpIHsgcmV0dXJuIHRoaXMuX2RhdGFJbmRleCsrOyB9XG5cbiAgZ2V0Q29uc3RDb3VudCgpIHsgcmV0dXJuIHRoaXMuX2RhdGFJbmRleDsgfVxuXG4gIGdldFZhckNvdW50KCkgeyByZXR1cm4gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7IH1cblxuICBnZXROZ0NvbnRlbnRTZWxlY3RvcnMoKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIHJldHVybiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwodGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cyksIHRydWUpIDpcbiAgICAgICAgbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYmluZGluZ0NvbnRleHQoKSB7IHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7IH1cblxuICBwcml2YXRlIHRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlOiB0LlRlbXBsYXRlLCB0ZW1wbGF0ZUluZGV4OiBudW1iZXIsIGF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10pIHtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5wcm9wZXJ0eSxcbiAgICAgICAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChpbnB1dC5uYW1lKSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlLCB0cnVlKV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBCaW5kaW5ncyBtdXN0IG9ubHkgYmUgcmVzb2x2ZWQgYWZ0ZXIgYWxsIGxvY2FsIHJlZnMgaGF2ZSBiZWVuIHZpc2l0ZWQsIHNvIGFsbFxuICAvLyBpbnN0cnVjdGlvbnMgYXJlIHF1ZXVlZCBpbiBjYWxsYmFja3MgdGhhdCBleGVjdXRlIG9uY2UgdGhlIGluaXRpYWwgcGFzcyBoYXMgY29tcGxldGVkLlxuICAvLyBPdGhlcndpc2UsIHdlIHdvdWxkbid0IGJlIGFibGUgdG8gc3VwcG9ydCBsb2NhbCByZWZzIHRoYXQgYXJlIGRlZmluZWQgYWZ0ZXIgdGhlaXJcbiAgLy8gYmluZGluZ3MuIGUuZy4ge3sgZm9vIH19IDxkaXYgI2Zvbz48L2Rpdj5cbiAgcHJpdmF0ZSBpbnN0cnVjdGlvbkZuKFxuICAgICAgZm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10sIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuOiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcbiAgICBmbnNbcHJlcGVuZCA/ICd1bnNoaWZ0JyA6ICdwdXNoJ10oKCkgPT4ge1xuICAgICAgY29uc3QgcGFyYW1zID0gQXJyYXkuaXNBcnJheShwYXJhbXNPckZuKSA/IHBhcmFtc09yRm4gOiBwYXJhbXNPckZuKCk7XG4gICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24oc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXMpLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcm9jZXNzU3R5bGluZ0luc3RydWN0aW9uKFxuICAgICAgZWxlbWVudEluZGV4OiBudW1iZXIsIGluc3RydWN0aW9uOiBJbnN0cnVjdGlvbnxudWxsLCBjcmVhdGVNb2RlOiBib29sZWFuKSB7XG4gICAgaWYgKGluc3RydWN0aW9uKSB7XG4gICAgICBjb25zdCBwYXJhbXNGbiA9ICgpID0+XG4gICAgICAgICAgaW5zdHJ1Y3Rpb24uYnVpbGRQYXJhbXModmFsdWUgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlLCB0cnVlKSk7XG4gICAgICBpZiAoY3JlYXRlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb24uc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBwYXJhbXNGbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIHBhcmFtc0ZuKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ/OiBib29sZWFuKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdLCBwcmVwZW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgaWYgKHRoaXMuX2xhc3ROb2RlSW5kZXhXaXRoRmx1c2ggPCBub2RlSW5kZXgpIHtcbiAgICAgIGlmIChub2RlSW5kZXggPiAwKSB7XG4gICAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5zZWxlY3QsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGFzdE5vZGVJbmRleFdpdGhGbHVzaCA9IG5vZGVJbmRleDtcbiAgICB9XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3Qgb3JpZ2luYWxTbG90cyA9IHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IG51bVNsb3RzO1xuICAgIHJldHVybiBvcmlnaW5hbFNsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZTogQVNUfG51bGwpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gdGhlIGltcGxpY2l0IHJlY2VpdmVyLiBUaGUgaW1wbGljaXRcbiAgICogcmVjZWl2ZXIgaXMgYWx3YXlzIHRoZSByb290IGxldmVsIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIGdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGlmICh0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwcikge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwciA9IHRoaXMubGV2ZWwgPT09IDAgP1xuICAgICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0RXhwcmVzc2lvbkJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUpO1xuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG5cbiAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbdmFsRXhwcl0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlOiBBU1QsIHNraXBCaW5kRm4/OiBib29sZWFuKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uRm4gPVxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyBpbnRlcnBvbGF0ZSA6ICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKTtcblxuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLFxuICAgICAgICBpbnRlcnBvbGF0aW9uRm4pO1xuICAgIGNvbnN0IHZhbEV4cHIgPSBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuY3VyclZhbEV4cHI7XG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLmNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5zdG10cyk7XG5cbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uIHx8IHNraXBCaW5kRm4gPyB2YWxFeHByIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFt2YWxFeHByXSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGxpc3Qgb2YgYXJndW1lbnQgZXhwcmVzc2lvbnMgdG8gcGFzcyB0byBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbi4gQWxzbyB1cGRhdGVzXG4gICAqIHRoZSB0ZW1wIHZhcmlhYmxlcyBzdGF0ZSB3aXRoIHRlbXAgdmFyaWFibGVzIHRoYXQgd2VyZSBpZGVudGlmaWVkIGFzIG5lZWRpbmcgdG8gYmUgY3JlYXRlZFxuICAgKiB3aGlsZSB2aXNpdGluZyB0aGUgYXJndW1lbnRzLlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIG9yaWdpbmFsIGV4cHJlc3Npb24gd2Ugd2lsbCBiZSByZXNvbHZpbmcgYW4gYXJndW1lbnRzIGxpc3QgZnJvbS5cbiAgICovXG4gIHByaXZhdGUgZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgICBjb25zdCB7YXJncywgc3RtdHN9ID1cbiAgICAgICAgY29udmVydFVwZGF0ZUFyZ3VtZW50cyh0aGlzLCB0aGlzLmdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCksIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCkpO1xuXG4gICAgdGhpcy5fdGVtcFZhcmlhYmxlcy5wdXNoKC4uLnN0bXRzKTtcbiAgICByZXR1cm4gYXJncztcbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hEaXJlY3RpdmVzKHRhZ05hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKHRhZ05hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbCkpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKFxuICAgICAgICAgIHNlbGVjdG9yLCAoY3NzU2VsZWN0b3IsIHN0YXRpY1R5cGUpID0+IHsgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTsgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmVzIGFsbCBhdHRyaWJ1dGUgZXhwcmVzc2lvbiB2YWx1ZXMgZm9yIHRoZSBgVEF0dHJpYnV0ZXNgIGFycmF5LlxuICAgKlxuICAgKiBUaGUgcHVycG9zZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHRvIHByb3Blcmx5IGNvbnN0cnVjdCBhbiBhdHRyaWJ1dGVzIGFycmF5IHRoYXRcbiAgICogaXMgcGFzc2VkIGludG8gdGhlIGBlbGVtZW50U3RhcnRgIChvciBqdXN0IGBlbGVtZW50YCkgZnVuY3Rpb25zLiBCZWNhdXNlIHRoZXJlXG4gICAqIGFyZSBtYW55IGRpZmZlcmVudCB0eXBlcyBvZiBhdHRyaWJ1dGVzLCB0aGUgYXJyYXkgbmVlZHMgdG8gYmUgY29uc3RydWN0ZWQgaW4gYVxuICAgKiBzcGVjaWFsIHdheSBzbyB0aGF0IGBlbGVtZW50U3RhcnRgIGNhbiBwcm9wZXJseSBldmFsdWF0ZSB0aGVtLlxuICAgKlxuICAgKiBUaGUgZm9ybWF0IGxvb2tzIGxpa2UgdGhpczpcbiAgICpcbiAgICogYGBgXG4gICAqIGF0dHJzID0gW3Byb3AsIHZhbHVlLCBwcm9wMiwgdmFsdWUyLFxuICAgKiAgIENMQVNTRVMsIGNsYXNzMSwgY2xhc3MyLFxuICAgKiAgIFNUWUxFUywgc3R5bGUxLCB2YWx1ZTEsIHN0eWxlMiwgdmFsdWUyLFxuICAgKiAgIEJJTkRJTkdTLCBuYW1lMSwgbmFtZTIsIG5hbWUzLFxuICAgKiAgIFRFTVBMQVRFLCBuYW1lNCwgbmFtZTUsIG5hbWU2LFxuICAgKiAgIEkxOE4sIG5hbWU3LCBuYW1lOCwgLi4uXVxuICAgKiBgYGBcbiAgICpcbiAgICogTm90ZSB0aGF0IHRoaXMgZnVuY3Rpb24gd2lsbCBmdWxseSBpZ25vcmUgYWxsIHN5bnRoZXRpYyAoQGZvbykgYXR0cmlidXRlIHZhbHVlc1xuICAgKiBiZWNhdXNlIHRob3NlIHZhbHVlcyBhcmUgaW50ZW5kZWQgdG8gYWx3YXlzIGJlIGdlbmVyYXRlZCBhcyBwcm9wZXJ0eSBpbnN0cnVjdGlvbnMuXG4gICAqL1xuICBwcml2YXRlIHByZXBhcmVOb25SZW5kZXJBdHRycyhcbiAgICAgIGlucHV0czogdC5Cb3VuZEF0dHJpYnV0ZVtdLCBvdXRwdXRzOiB0LkJvdW5kRXZlbnRbXSwgc3R5bGVzPzogU3R5bGluZ0J1aWxkZXIsXG4gICAgICB0ZW1wbGF0ZUF0dHJzOiAodC5Cb3VuZEF0dHJpYnV0ZXx0LlRleHRBdHRyaWJ1dGUpW10gPSBbXSxcbiAgICAgIGkxOG5BdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10pOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgYWxyZWFkeVNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBhdHRyRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICBmdW5jdGlvbiBhZGRBdHRyRXhwcihrZXk6IHN0cmluZyB8IG51bWJlciwgdmFsdWU/OiBvLkV4cHJlc3Npb24pOiB2b2lkIHtcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIWFscmVhZHlTZWVuLmhhcyhrZXkpKSB7XG4gICAgICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKGtleSkpO1xuICAgICAgICAgIHZhbHVlICE9PSB1bmRlZmluZWQgJiYgYXR0ckV4cHJzLnB1c2godmFsdWUpO1xuICAgICAgICAgIGFscmVhZHlTZWVuLmFkZChrZXkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChvLmxpdGVyYWwoa2V5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaXQncyBpbXBvcnRhbnQgdGhhdCB0aGlzIG9jY3VycyBiZWZvcmUgQklORElOR1MgYW5kIFRFTVBMQVRFIGJlY2F1c2Ugb25jZSBgZWxlbWVudFN0YXJ0YFxuICAgIC8vIGNvbWVzIGFjcm9zcyB0aGUgQklORElOR1Mgb3IgVEVNUExBVEUgbWFya2VycyB0aGVuIGl0IHdpbGwgY29udGludWUgcmVhZGluZyBlYWNoIHZhbHVlIGFzXG4gICAgLy8gYXMgc2luZ2xlIHByb3BlcnR5IHZhbHVlIGNlbGwgYnkgY2VsbC5cbiAgICBpZiAoc3R5bGVzKSB7XG4gICAgICBzdHlsZXMucG9wdWxhdGVJbml0aWFsU3R5bGluZ0F0dHJzKGF0dHJFeHBycyk7XG4gICAgfVxuXG4gICAgaWYgKGlucHV0cy5sZW5ndGggfHwgb3V0cHV0cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGF0dHJzU3RhcnRJbmRleCA9IGF0dHJFeHBycy5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gaW5wdXRzW2ldO1xuICAgICAgICBpZiAoaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgICAgYWRkQXR0ckV4cHIoaW5wdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvdXRwdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IG91dHB1dHNbaV07XG4gICAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKG91dHB1dC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0aGlzIGlzIGEgY2hlYXAgd2F5IG9mIGFkZGluZyB0aGUgbWFya2VyIG9ubHkgYWZ0ZXIgYWxsIHRoZSBpbnB1dC9vdXRwdXRcbiAgICAgIC8vIHZhbHVlcyBoYXZlIGJlZW4gZmlsdGVyZWQgKGJ5IG5vdCBpbmNsdWRpbmcgdGhlIGFuaW1hdGlvbiBvbmVzKSBhbmQgYWRkZWRcbiAgICAgIC8vIHRvIHRoZSBleHByZXNzaW9ucy4gVGhlIG1hcmtlciBpcyBpbXBvcnRhbnQgYmVjYXVzZSBpdCB0ZWxscyB0aGUgcnVudGltZVxuICAgICAgLy8gY29kZSB0aGF0IHRoaXMgaXMgd2hlcmUgYXR0cmlidXRlcyB3aXRob3V0IHZhbHVlcyBzdGFydC4uLlxuICAgICAgaWYgKGF0dHJFeHBycy5sZW5ndGgpIHtcbiAgICAgICAgYXR0ckV4cHJzLnNwbGljZShhdHRyc1N0YXJ0SW5kZXgsIDAsIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5CaW5kaW5ncykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0ZW1wbGF0ZUF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLlRlbXBsYXRlKSk7XG4gICAgICB0ZW1wbGF0ZUF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICBpZiAoaTE4bkF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pKTtcbiAgICAgIGkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJFeHBycztcbiAgfVxuXG4gIHByaXZhdGUgdG9BdHRyc1BhcmFtKGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdKTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gYXR0cnNFeHBycy5sZW5ndGggPiAwID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKG8ubGl0ZXJhbEFycihhdHRyc0V4cHJzKSwgdHJ1ZSkgOlxuICAgICAgICBvLlRZUEVEX05VTExfRVhQUjtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZVJlZnNQYXJhbWV0ZXIocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHJlZnNQYXJhbSksIHRydWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIodGFnTmFtZTogc3RyaW5nLCBvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCwgaW5kZXg6IG51bWJlcik6XG4gICAgICAoKSA9PiBvLkV4cHJlc3Npb25bXSB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50TmFtZTogc3RyaW5nID0gb3V0cHV0QXN0Lm5hbWU7XG4gICAgICBjb25zdCBiaW5kaW5nRm5OYW1lID0gb3V0cHV0QXN0LnR5cGUgPT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24gP1xuICAgICAgICAgIC8vIHN5bnRoZXRpYyBAbGlzdGVuZXIuZm9vIHZhbHVlcyBhcmUgdHJlYXRlZCB0aGUgZXhhY3Qgc2FtZSBhcyBhcmUgc3RhbmRhcmQgbGlzdGVuZXJzXG4gICAgICAgICAgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lKGV2ZW50TmFtZSwgb3V0cHV0QXN0LnBoYXNlICEpIDpcbiAgICAgICAgICBzYW5pdGl6ZUlkZW50aWZpZXIoZXZlbnROYW1lKTtcbiAgICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gYCR7dGhpcy50ZW1wbGF0ZU5hbWV9XyR7dGFnTmFtZX1fJHtiaW5kaW5nRm5OYW1lfV8ke2luZGV4fV9saXN0ZW5lcmA7XG4gICAgICBjb25zdCBzY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBGdW5jdGlvbkNhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQocGlwZS5zcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4pLCBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID1cbiAgICAgICAgaXNWYXJMZW5ndGggPyB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgYXJncyldKSA6IHRoaXMudmlzaXRBbGwoYXJncyk7XG5cbiAgICBjb25zdCBwaXBlQmluZEV4cHIgPSBuZXcgRnVuY3Rpb25DYWxsKHBpcGUuc3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwdXJlRnVuY3Rpb25TbG90KSxcbiAgICAgIC4uLmNvbnZlcnRlZEFyZ3MsXG4gICAgXSk7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5wdXNoKHBpcGVCaW5kRXhwcik7XG4gICAgcmV0dXJuIHBpcGVCaW5kRXhwcjtcbiAgfVxuXG4gIHVwZGF0ZVBpcGVTbG90T2Zmc2V0cyhiaW5kaW5nU2xvdHM6IG51bWJlcikge1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMuZm9yRWFjaCgocGlwZTogRnVuY3Rpb25DYWxsKSA9PiB7XG4gICAgICAvLyB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0IGFyZyAoaW5kZXggMSkgdG8gYWNjb3VudCBmb3IgYmluZGluZyBzbG90c1xuICAgICAgY29uc3Qgc2xvdE9mZnNldCA9IHBpcGUuYXJnc1sxXSBhcyBMaXRlcmFsUHJpbWl0aXZlO1xuICAgICAgKHNsb3RPZmZzZXQudmFsdWUgYXMgbnVtYmVyKSArPSBiaW5kaW5nU2xvdHM7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxBcnJheShhcnJheTogTGl0ZXJhbEFycmF5LCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChhcnJheS5zcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgIHJldHVybiB2YWx1ZXMuZXZlcnkoYSA9PiBhLmlzQ29uc3RhbnQoKSkgP1xuICAgICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChsaXRlcmFsLCB0cnVlKSA6XG4gICAgICAgICAgZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXAobWFwOiBMaXRlcmFsTWFwLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIHJldHVybiBuZXcgQnVpbHRpbkZ1bmN0aW9uQ2FsbChtYXAuc3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuIE90aGVyd2lzZSwganVzdCByZXR1cm4gYW4gbGl0ZXJhbCBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4vLyBQaXBlcyBhbHdheXMgaGF2ZSBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyLCB0aGUgdmFsdWUgdGhleSBvcGVyYXRlIG9uXG5jb25zdCBwaXBlQmluZGluZ0lkZW50aWZpZXJzID0gW1IzLnBpcGVCaW5kMSwgUjMucGlwZUJpbmQyLCBSMy5waXBlQmluZDMsIFIzLnBpcGVCaW5kNF07XG5cbmZ1bmN0aW9uIHBpcGVCaW5kaW5nQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHBpcGVCaW5kaW5nSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucGlwZUJpbmRWLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuY29uc3QgcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnMgPSBbXG4gIFIzLnB1cmVGdW5jdGlvbjAsIFIzLnB1cmVGdW5jdGlvbjEsIFIzLnB1cmVGdW5jdGlvbjIsIFIzLnB1cmVGdW5jdGlvbjMsIFIzLnB1cmVGdW5jdGlvbjQsXG4gIFIzLnB1cmVGdW5jdGlvbjUsIFIzLnB1cmVGdW5jdGlvbjYsIFIzLnB1cmVGdW5jdGlvbjcsIFIzLnB1cmVGdW5jdGlvbjhcbl07XG5cbmZ1bmN0aW9uIHB1cmVGdW5jdGlvbkNhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwdXJlRnVuY3Rpb25JZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5wdXJlRnVuY3Rpb25WLFxuICAgIGlzVmFyTGVuZ3RoOiAhaWRlbnRpZmllcixcbiAgfTtcbn1cblxuZnVuY3Rpb24gaW5zdHJ1Y3Rpb24oXG4gICAgc3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgIHBhcmFtczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKHJlZmVyZW5jZSwgbnVsbCwgc3BhbikuY2FsbEZuKHBhcmFtcywgc3Bhbik7XG59XG5cbi8vIGUuZy4geCgyKTtcbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWxEaWZmOiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICByZXR1cm4gby5pbXBvcnRFeHByKFIzLm5leHRDb250ZXh0KVxuICAgICAgLmNhbGxGbihyZWxhdGl2ZUxldmVsRGlmZiA+IDEgPyBbby5saXRlcmFsKHJlbGF0aXZlTGV2ZWxEaWZmKV0gOiBbXSk7XG59XG5cbmZ1bmN0aW9uIGdldExpdGVyYWxGYWN0b3J5KFxuICAgIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBsaXRlcmFsOiBvLkxpdGVyYWxBcnJheUV4cHIgfCBvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoID4gMCB8fCBlcnJvcihgRXhwZWN0ZWQgYXJndW1lbnRzIHRvIGEgbGl0ZXJhbCBmYWN0b3J5IGZ1bmN0aW9uYCk7XG4gIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwdXJlRnVuY3Rpb25DYWxsSW5mbyhsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG5cbiAgLy8gTGl0ZXJhbCBmYWN0b3JpZXMgYXJlIHB1cmUgZnVuY3Rpb25zIHRoYXQgb25seSBuZWVkIHRvIGJlIHJlLWludm9rZWQgd2hlbiB0aGUgcGFyYW1ldGVyc1xuICAvLyBjaGFuZ2UuXG4gIGNvbnN0IGFyZ3MgPSBbXG4gICAgby5saXRlcmFsKHN0YXJ0U2xvdCksXG4gICAgbGl0ZXJhbEZhY3RvcnksXG4gIF07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gbmV4dENvbnRleHQoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBsb2NhbFJlZmAgaXMgdHJ1ZSBpZiB3ZSBhcmUgc3RvcmluZyBhIGxvY2FsIHJlZmVyZW5jZVxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5SZWFkVmFyRXhwcjsgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaztcbiAgZGVjbGFyZTogYm9vbGVhbjtcbiAgcHJpb3JpdHk6IG51bWJlcjtcbiAgbG9jYWxSZWY6IGJvb2xlYW47XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7IERFRkFVTFQgPSAwLCBDT05URVhUID0gMSwgU0hBUkVEX0NPTlRFWFQgPSAyIH1cblxuZXhwb3J0IGNsYXNzIEJpbmRpbmdTY29wZSBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICAvKiogS2VlcHMgYSBtYXAgZnJvbSBsb2NhbCB2YXJpYWJsZXMgdG8gdGhlaXIgQmluZGluZ0RhdGEuICovXG4gIHByaXZhdGUgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEJpbmRpbmdEYXRhPigpO1xuICBwcml2YXRlIHJlZmVyZW5jZU5hbWVJbmRleCA9IDA7XG4gIHByaXZhdGUgcmVzdG9yZVZpZXdWYXJpYWJsZTogby5SZWFkVmFyRXhwcnxudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzdGF0aWMgX1JPT1RfU0NPUEU6IEJpbmRpbmdTY29wZTtcblxuICBzdGF0aWMgZ2V0IFJPT1RfU0NPUEUoKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAoIUJpbmRpbmdTY29wZS5fUk9PVF9TQ09QRSkge1xuICAgICAgQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFID0gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuICAgIH1cbiAgICByZXR1cm4gQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCBwcml2YXRlIHBhcmVudDogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKSB7fVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgbGV0IHZhbHVlID0gY3VycmVudC5tYXAuZ2V0KG5hbWUpO1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IHRoaXMpIHtcbiAgICAgICAgICAvLyBtYWtlIGEgbG9jYWwgY29weSBhbmQgcmVzZXQgdGhlIGBkZWNsYXJlYCBzdGF0ZVxuICAgICAgICAgIHZhbHVlID0ge1xuICAgICAgICAgICAgcmV0cmlldmFsTGV2ZWw6IHZhbHVlLnJldHJpZXZhbExldmVsLFxuICAgICAgICAgICAgbGhzOiB2YWx1ZS5saHMsXG4gICAgICAgICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICAgICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiB2YWx1ZS5wcmlvcml0eSxcbiAgICAgICAgICAgIGxvY2FsUmVmOiB2YWx1ZS5sb2NhbFJlZlxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBDYWNoZSB0aGUgdmFsdWUgbG9jYWxseS5cbiAgICAgICAgICB0aGlzLm1hcC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICAgIC8vIFBvc3NpYmx5IGdlbmVyYXRlIGEgc2hhcmVkIGNvbnRleHQgdmFyXG4gICAgICAgICAgdGhpcy5tYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KHZhbHVlLnJldHJpZXZhbExldmVsLCB2YWx1ZS5sb2NhbFJlZik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqIEBwYXJhbSBsb2NhbFJlZiBXaGV0aGVyIG9yIG5vdCB0aGlzIGlzIGEgbG9jYWwgcmVmXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uUmVhZFZhckV4cHIsXG4gICAgICBwcmlvcml0eTogbnVtYmVyID0gRGVjbGFyYXRpb25Qcmlvcml0eS5ERUZBVUxULFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjaywgbG9jYWxSZWY/OiB0cnVlKTogQmluZGluZ1Njb3BlIHtcbiAgICBpZiAodGhpcy5tYXAuaGFzKG5hbWUpKSB7XG4gICAgICBpZiAobG9jYWxSZWYpIHtcbiAgICAgICAgLy8gRG8gbm90IHRocm93IGFuIGVycm9yIGlmIGl0J3MgYSBsb2NhbCByZWYgYW5kIGRvIG5vdCB1cGRhdGUgZXhpc3RpbmcgdmFsdWUsXG4gICAgICAgIC8vIHNvIHRoZSBmaXJzdCBkZWZpbmVkIHJlZiBpcyBhbHdheXMgcmV0dXJuZWQuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgZXJyb3IoYFRoZSBuYW1lICR7bmFtZX0gaXMgYWxyZWFkeSBkZWZpbmVkIGluIHNjb3BlIHRvIGJlICR7dGhpcy5tYXAuZ2V0KG5hbWUpfWApO1xuICAgIH1cbiAgICB0aGlzLm1hcC5zZXQobmFtZSwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiBkZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICAgIGxvY2FsUmVmOiBsb2NhbFJlZiB8fCBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gSW1wbGVtZW50ZWQgYXMgcGFydCBvZiBMb2NhbFJlc29sdmVyLlxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgLy8gSW1wbGVtZW50ZWQgYXMgcGFydCBvZiBMb2NhbFJlc29sdmVyLlxuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmJpbmRpbmdMZXZlbCAhPT0gMCkge1xuICAgICAgLy8gU2luY2UgdGhlIGltcGxpY2l0IHJlY2VpdmVyIGlzIGFjY2Vzc2VkIGluIGFuIGVtYmVkZGVkIHZpZXcsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGRlY2xhcmUgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgIC8vIGluIHRoZSB1cGRhdGUgdmFyaWFibGVzLlxuICAgICAgdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICEuZGVjbGFyZSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlcik6IEJpbmRpbmdTY29wZSB7XG4gICAgY29uc3QgbmV3U2NvcGUgPSBuZXcgQmluZGluZ1Njb3BlKGxldmVsLCB0aGlzKTtcbiAgICBpZiAobGV2ZWwgPiAwKSBuZXdTY29wZS5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gICAgcmV0dXJuIG5ld1Njb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgb3IgY3JlYXRlcyBhIHNoYXJlZCBjb250ZXh0IHZhcmlhYmxlIGFuZCByZXR1cm5zIGl0cyBleHByZXNzaW9uLiBOb3RlIHRoYXRcbiAgICogdGhpcyBkb2VzIG5vdCBtZWFuIHRoYXQgdGhlIHNoYXJlZCB2YXJpYWJsZSB3aWxsIGJlIGRlY2xhcmVkLiBWYXJpYWJsZXMgaW4gdGhlXG4gICAqIGJpbmRpbmcgc2NvcGUgd2lsbCBiZSBvbmx5IGRlY2xhcmVkIGlmIHRoZXkgYXJlIHVzZWQuXG4gICAqL1xuICBnZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IGJpbmRpbmdLZXkgPSBTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbDtcbiAgICBpZiAoIXRoaXMubWFwLmhhcyhiaW5kaW5nS2V5KSkge1xuICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpICEubGhzO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHJ8bnVsbCB7XG4gICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgICAgbG9jYWxSZWY6IGZhbHNlXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDAsIGZhbHNlKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKSB7XG4gICAgLy8gV2Ugd2FudCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gbGlzdGVuZXIgZm5zIGlmOlxuICAgIC8vIDEgLSB3ZSBhcmUgYWNjZXNzaW5nIGEgdmFsdWUgaW4gYSBwYXJlbnQgdmlldywgd2hpY2ggcmVxdWlyZXMgd2Fsa2luZyB0aGUgdmlldyB0cmVlIHJhdGhlclxuICAgIC8vIHRoYW4gdXNpbmcgdGhlIGN0eCBhcmcuIEluIHRoaXMgY2FzZSwgdGhlIHJldHJpZXZhbCBhbmQgYmluZGluZyBsZXZlbCB3aWxsIGJlIGRpZmZlcmVudC5cbiAgICAvLyAyIC0gd2UgYXJlIGxvb2tpbmcgdXAgYSBsb2NhbCByZWYsIHdoaWNoIHJlcXVpcmVzIHJlc3RvcmluZyB0aGUgdmlldyB3aGVyZSB0aGUgbG9jYWxcbiAgICAvLyByZWYgaXMgc3RvcmVkXG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgKHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwgfHwgbG9jYWxSZWZMb29rdXApKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUgPSBvLnZhcmlhYmxlKHRoaXMucGFyZW50ICEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJlc3RvcmVWaWV3KCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7IHJldHVybiB0aGlzLnBhcmVudCAmJiB0aGlzLnBhcmVudC5iaW5kaW5nTGV2ZWwgPT09IHRoaXMuYmluZGluZ0xldmVsOyB9XG5cbiAgdmFyaWFibGVEZWNsYXJhdGlvbnMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgbGV0IGN1cnJlbnRDb250ZXh0TGV2ZWwgPSAwO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFwLnZhbHVlcygpKVxuICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgLnJlZHVjZSgoc3RtdHM6IG8uU3RhdGVtZW50W10sIHZhbHVlOiBCaW5kaW5nRGF0YSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgY29uc3QgY3VyclN0bXRzID0gdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICBjdXJyZW50Q29udGV4dExldmVsID0gbGV2ZWxEaWZmO1xuICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yKHRhZzogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgb3V0IG9mIGFuIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlc1xuICogd2hpY2ggY2FuIGJlIGFkZGVkIHRvIHRoZSBpbnN0cnVjdGlvbiBwYXJhbWV0ZXJzLlxuICovXG5mdW5jdGlvbiBnZXROZ1Byb2plY3RBc0xpdGVyYWwoYXR0cmlidXRlOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb25bXSB7XG4gIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IoYXR0cmlidXRlLnZhbHVlKVswXTtcbiAgcmV0dXJuIFtvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgYXNMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpXTtcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBhcmdzID0gYXJncy5zbGljZSgxKTsgIC8vIElnbm9yZSB0aGUgbGVuZ3RoIHByZWZpeCBhZGRlZCBmb3IgcmVuZGVyMlxuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjIpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24zKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNCkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb241KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjYpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb244KS5jYWxsRm4oYXJncyk7XG4gIH1cbiAgKGFyZ3MubGVuZ3RoID49IDE5ICYmIGFyZ3MubGVuZ3RoICUgMiA9PSAxKSB8fFxuICAgICAgZXJyb3IoYEludmFsaWQgaW50ZXJwb2xhdGlvbiBhcmd1bWVudCBsZW5ndGggJHthcmdzLmxlbmd0aH1gKTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uVikuY2FsbEZuKFtvLmxpdGVyYWxBcnIoYXJncyldKTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5XG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIGF0dHJpYnV0ZVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIGV4cGVjdGVkIHRvIGJlIHBhc3NlZCB0byBhIGdlbmVyYXRlZCBpbnN0cnVjdGlvbiBpbiB0aGUgY2FzZSBvZlxuICogaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbnMuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBpbnRlcnBvbGF0aW9uIGFzdFxuICovXG5mdW5jdGlvbiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIGNvbnN0IHtleHByZXNzaW9ucywgc3RyaW5nc30gPSBpbnRlcnBvbGF0aW9uO1xuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3MubGVuZ3RoID09PSAyICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgLy8gSWYgdGhlIGludGVycG9sYXRpb24gaGFzIG9uZSBpbnRlcnBvbGF0ZWQgdmFsdWUsIGJ1dCB0aGUgcHJlZml4IGFuZCBzdWZmaXggYXJlIGJvdGggZW1wdHlcbiAgICAvLyBzdHJpbmdzLCB3ZSBvbmx5IHBhc3Mgb25lIGFyZ3VtZW50LCB0byBhIHNwZWNpYWwgaW5zdHJ1Y3Rpb24gbGlrZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgb3JcbiAgICAvLyBgdGV4dEludGVycG9sYXRlYC5cbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbnMubGVuZ3RoICsgc3RyaW5ncy5sZW5ndGg7XG4gIH1cbn1cbi8qKlxuICogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIG1vZGlmeSBob3cgYSB0ZW1wbGF0ZSBpcyBwYXJzZWQgYnkgYHBhcnNlVGVtcGxhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VUZW1wbGF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqIEBwYXJhbSBvcHRpb25zIG9wdGlvbnMgdG8gbW9kaWZ5IGhvdyB0aGUgdGVtcGxhdGUgaXMgcGFyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IFBhcnNlVGVtcGxhdGVPcHRpb25zID0ge30pOlxuICAgIHtlcnJvcnM/OiBQYXJzZUVycm9yW10sIG5vZGVzOiB0Lk5vZGVbXSwgc3R5bGVVcmxzOiBzdHJpbmdbXSwgc3R5bGVzOiBzdHJpbmdbXX0ge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlc30gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UoXG4gICAgICB0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsXG4gICAgICB7Li4ub3B0aW9ucywgdG9rZW5pemVFeHBhbnNpb25Gb3JtczogdHJ1ZSwgbGVhZGluZ1RyaXZpYUNoYXJzOiBMRUFESU5HX1RSSVZJQV9DSEFSU30pO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgLy8gcHJvY2VzcyBpMThuIG1ldGEgaW5mb3JtYXRpb24gKHNjYW4gYXR0cmlidXRlcywgZ2VuZXJhdGUgaWRzKVxuICAvLyBiZWZvcmUgd2UgcnVuIHdoaXRlc3BhY2UgcmVtb3ZhbCBwcm9jZXNzLCBiZWNhdXNlIGV4aXN0aW5nIGkxOG5cbiAgLy8gZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgcm9vdE5vZGVzID1cbiAgICAgIGh0bWwudmlzaXRBbGwobmV3IEkxOG5NZXRhVmlzaXRvcihpbnRlcnBvbGF0aW9uQ29uZmlnLCAhcHJlc2VydmVXaGl0ZXNwYWNlcyksIHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdlIHJlbW92ZSB3aGl0ZXNwYWNlcywgYmVjYXVzZVxuICAgIC8vIHRoYXQgbWlnaHQgYWZmZWN0IGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudC4gRHVyaW5nIHRoaXMgcGFzc1xuICAgIC8vIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuIG1pbWljXG4gICAgLy8gZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bilcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICBuZXcgSTE4bk1ldGFWaXNpdG9yKGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gZmFsc2UpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzfSA9IGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgcmV0dXJuIHtub2Rlcywgc3R5bGVVcmxzLCBzdHlsZXN9O1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuIl19