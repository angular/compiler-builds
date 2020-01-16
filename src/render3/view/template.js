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
        define("@angular/compiler/src/render3/view/template", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/template_parser/binding_parser", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_template_transform", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/i18n/context", "@angular/compiler/src/render3/view/i18n/get_msg_utils", "@angular/compiler/src/render3/view/i18n/localize_utils", "@angular/compiler/src/render3/view/i18n/meta", "@angular/compiler/src/render3/view/i18n/util", "@angular/compiler/src/render3/view/styling_builder", "@angular/compiler/src/render3/view/util"], factory);
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
    var get_msg_utils_1 = require("@angular/compiler/src/render3/view/i18n/get_msg_utils");
    var localize_utils_1 = require("@angular/compiler/src/render3/view/i18n/localize_utils");
    var meta_1 = require("@angular/compiler/src/render3/view/i18n/meta");
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
        function TemplateDefinitionBuilder(constantPool, parentBindingScope, level, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds, _constants) {
            var _this = this;
            if (level === void 0) { level = 0; }
            if (_constants === void 0) { _constants = []; }
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
            this.i18nUseExternalIds = i18nUseExternalIds;
            this._constants = _constants;
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
            /** Index of the currently-selected node. */
            this._currentIndex = 0;
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
            var statements = getTranslationDeclStmts(message, _ref, closureVar, params, transformFn);
            (_a = this.constantPool.statements).push.apply(_a, tslib_1.__spread(statements));
            return _ref;
        };
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
                var chainBindings_1 = [];
                bindings.forEach(function (binding) {
                    chainBindings_1.push({ sourceSpan: span, value: function () { return _this.convertPropertyBinding(binding); } });
                });
                // for i18n block, advance to the most recent element index (by taking the current number of
                // elements and subtracting one) before invoking `i18nExp` instructions, to make sure the
                // necessary lifecycle hooks of components/directives are properly flushed.
                this.updateInstructionChainWithAdvance(this.getConstCount() - 1, r3_identifiers_1.Identifiers.i18nExp, chainBindings_1);
                this.updateInstruction(span, r3_identifiers_1.Identifiers.i18nApply, [o.literal(index)]);
            }
            if (!selfClosing) {
                this.creationInstruction(span, r3_identifiers_1.Identifiers.i18nEnd);
            }
            this.i18n = null; // reset local i18n context
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
        /**
         * Adds an update instruction for an interpolated property or attribute, such as
         * `prop="{{value}}"` or `attr.title="{{value}}"`
         */
        TemplateDefinitionBuilder.prototype.interpolatedUpdateInstruction = function (instruction, elementIndex, attrName, input, value, params) {
            var _this = this;
            this.updateInstructionWithAdvance(elementIndex, input.sourceSpan, instruction, function () { return tslib_1.__spread([o.literal(attrName)], _this.getUpdateInstructionArguments(value), params); });
        };
        TemplateDefinitionBuilder.prototype.visitContent = function (ngContent) {
            var slot = this.allocateDataSlot();
            var projectionSlotIdx = this._ngContentSelectorsOffset + this._ngContentReservedSlots.length;
            var parameters = [o.literal(slot)];
            this._ngContentReservedSlots.push(ngContent.selector);
            var nonContentSelectAttributes = ngContent.attributes.filter(function (attr) { return attr.name.toLowerCase() !== NG_CONTENT_SELECT_ATTR; });
            var attributes = this.getAttributeExpressions(nonContentSelectAttributes, [], []);
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
        TemplateDefinitionBuilder.prototype.visitElement = function (element) {
            var e_1, _a;
            var _this = this;
            var elementIndex = this.allocateDataSlot();
            var stylingBuilder = new styling_builder_1.StylingBuilder(o.literal(elementIndex), null);
            var isNonBindableMode = false;
            var isI18nRootElement = util_3.isI18nRootNode(element.i18n) && !util_3.isSingleI18nIcu(element.i18n);
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
            // add attributes for directive and projection matching purposes
            var attributes = this.getAttributeExpressions(outputAttrs, allOtherInputs, element.outputs, stylingBuilder, [], i18nAttrs);
            parameters.push(this.addAttrsToConsts(attributes));
            // local refs (ex.: <div #foo #bar="baz">)
            var refs = this.prepareRefsArray(element.references);
            parameters.push(this.addToConsts(refs));
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
            // Note that we do not append text node instructions and ICUs inside i18n section,
            // so we exclude them while calculating whether current element has children
            var hasChildren = (!isI18nRootElement && this.i18n) ? !hasTextChildrenOnly(element.children) :
                element.children.length > 0;
            var createSelfClosingInstruction = !stylingBuilder.hasBindingsWithPipes &&
                element.outputs.length === 0 && i18nAttrs.length === 0 && !hasChildren;
            var createSelfClosingI18nInstruction = !createSelfClosingInstruction && hasTextChildrenOnly(element.children);
            if (createSelfClosingInstruction) {
                this.creationInstruction(element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainer : r3_identifiers_1.Identifiers.element, util_4.trimTrailingNulls(parameters));
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
                    var bindings_1 = [];
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
                                    bindings_1.push({
                                        sourceSpan: element.sourceSpan,
                                        value: function () { return _this.convertPropertyBinding(expression); }
                                    });
                                });
                            }
                        }
                    });
                    if (bindings_1.length) {
                        this.updateInstructionChainWithAdvance(elementIndex, r3_identifiers_1.Identifiers.i18nExp, bindings_1);
                    }
                    if (i18nAttrArgs_1.length) {
                        var index = o.literal(this.allocateDataSlot());
                        var args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs_1), true);
                        this.creationInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nAttributes, [index, args]);
                        if (hasBindings_1) {
                            this.updateInstruction(element.sourceSpan, r3_identifiers_1.Identifiers.i18nApply, [index]);
                        }
                    }
                }
                // Generate Listeners (outputs)
                if (element.outputs.length > 0) {
                    var listeners = element.outputs.map(function (outputAst) { return ({
                        sourceSpan: outputAst.sourceSpan,
                        params: _this.prepareListenerParameter(element.name, outputAst, elementIndex)
                    }); });
                    this.creationInstructionChain(r3_identifiers_1.Identifiers.listener, listeners);
                }
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
                this._bindingSlots += this.processStylingUpdateInstruction(elementIndex, instruction_1);
            }
            // the reason why `undefined` is used is because the renderer understands this as a
            // special value to symbolize that there is no RHS to this binding
            // TODO (matsko): revisit this once FW-959 is approached
            var emptyValueBindInstruction = o.literal(undefined);
            var propertyBindings = [];
            var attributeBindings = [];
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
                    propertyBindings.push({
                        name: util_2.prepareSyntheticPropertyName(input.name),
                        sourceSpan: input.sourceSpan,
                        value: function () { return hasValue_1 ? _this.convertPropertyBinding(value_1) : emptyValueBindInstruction; }
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
                                // Collect all the properties so that we can chain into a single function at the end.
                                propertyBindings.push({
                                    name: attrName_1,
                                    sourceSpan: input.sourceSpan,
                                    value: function () { return _this.convertPropertyBinding(value_2); }, params: params_2
                                });
                            }
                        }
                        else if (inputType === 1 /* Attribute */) {
                            if (value_2 instanceof ast_1.Interpolation && util_4.getInterpolationArgsLength(value_2) > 1) {
                                // attr.name="text{{value}}" and friends
                                _this.interpolatedUpdateInstruction(getAttributeInterpolationExpression(value_2), elementIndex, attrName_1, input, value_2, params_2);
                            }
                            else {
                                var boundValue_1 = value_2 instanceof ast_1.Interpolation ? value_2.expressions[0] : value_2;
                                // [attr.name]="value" or attr.name="{{value}}"
                                // Collect the attribute bindings so that they can be chained at the end.
                                attributeBindings.push({
                                    name: attrName_1,
                                    sourceSpan: input.sourceSpan,
                                    value: function () { return _this.convertPropertyBinding(boundValue_1); }, params: params_2
                                });
                            }
                        }
                        else {
                            // class prop
                            _this.updateInstructionWithAdvance(elementIndex, input.sourceSpan, r3_identifiers_1.Identifiers.classProp, function () {
                                return tslib_1.__spread([
                                    o.literal(elementIndex), o.literal(attrName_1), _this.convertPropertyBinding(value_2)
                                ], params_2);
                            });
                        }
                    }
                }
            });
            if (propertyBindings.length > 0) {
                this.updateInstructionChainWithAdvance(elementIndex, r3_identifiers_1.Identifiers.property, propertyBindings);
            }
            if (attributeBindings.length > 0) {
                this.updateInstructionChainWithAdvance(elementIndex, r3_identifiers_1.Identifiers.attribute, attributeBindings);
            }
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
            var attrsExprs = this.getAttributeExpressions(template.attributes, template.inputs, template.outputs, undefined, template.templateAttrs, undefined);
            parameters.push(this.addAttrsToConsts(attrsExprs));
            // local refs (ex.: <ng-template #foo>)
            if (template.references && template.references.length) {
                var refs = this.prepareRefsArray(template.references);
                parameters.push(this.addToConsts(refs));
                parameters.push(o.importExpr(r3_identifiers_1.Identifiers.templateRefExtractor));
            }
            // Create the template function
            var templateVisitor = new TemplateDefinitionBuilder(this.constantPool, this._bindingScope, this.level + 1, contextName, this.i18n, templateIndex, templateName, this.directiveMatcher, this.directives, this.pipeTypeByName, this.pipes, this._namespace, this.fileBasedI18nSuffix, this.i18nUseExternalIds, this._constants);
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
            this.templatePropertyBindings(templateIndex, template.templateAttrs);
            // Only add normal input/output binding instructions on explicit ng-template elements.
            if (template.tagName === NG_TEMPLATE_TAG_NAME) {
                // Add the input bindings
                this.templatePropertyBindings(templateIndex, template.inputs);
                // Generate listeners for directive output
                if (template.outputs.length > 0) {
                    var listeners = template.outputs.map(function (outputAst) { return ({
                        sourceSpan: outputAst.sourceSpan,
                        params: _this.prepareListenerParameter('ng_template', outputAst, templateIndex)
                    }); });
                    this.creationInstructionChain(r3_identifiers_1.Identifiers.listener, listeners);
                }
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
                this.updateInstructionWithAdvance(nodeIndex, text.sourceSpan, getTextInterpolationExpression(value), function () { return _this.getUpdateInstructionArguments(value); });
            }
            else {
                util_1.error('Text nodes should be interpolated and never bound directly.');
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
            // we always need post-processing function for ICUs, to make sure that:
            // - all placeholders in a form of {PLACEHOLDER} are replaced with actual values (note:
            // `goog.getMsg` does not process ICUs and uses the `{PLACEHOLDER}` format for placeholders
            // inside ICUs)
            // - all ICU vars (such as `VAR_SELECT` or `VAR_PLURAL`) are replaced with correct values
            var transformFn = function (raw) {
                var params = tslib_1.__assign(tslib_1.__assign({}, vars), placeholders);
                var formatted = util_3.i18nFormatPlaceholderNames(params, /* useCamelCase */ false);
                return instruction(null, r3_identifiers_1.Identifiers.i18nPostprocess, [raw, map_util_1.mapLiteral(formatted, true)]);
            };
            // in case the whole i18n message is a single ICU - we do not need to
            // create a separate top-level translation, we can use the root ref instead
            // and make this ICU a top-level translation
            // note: ICU placeholders are replaced with actual values in `i18nPostprocess` function
            // separately, so we do not pass placeholders into `i18nTranslate` function.
            if (util_3.isSingleI18nIcu(i18n.meta)) {
                this.i18nTranslate(message, /* placeholders */ {}, i18n.ref, transformFn);
            }
            else {
                // output ICU directly and keep ICU reference in context
                var ref = this.i18nTranslate(message, /* placeholders */ {}, /* ref */ undefined, transformFn);
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
        TemplateDefinitionBuilder.prototype.getConsts = function () { return this._constants; };
        TemplateDefinitionBuilder.prototype.getNgContentSelectors = function () {
            return this._ngContentReservedSlots.length ?
                this.constantPool.getConstLiteral(util_4.asLiteral(this._ngContentReservedSlots), true) :
                null;
        };
        TemplateDefinitionBuilder.prototype.bindingContext = function () { return "" + this._bindingContext++; };
        TemplateDefinitionBuilder.prototype.templatePropertyBindings = function (templateIndex, attrs) {
            var _this = this;
            var propertyBindings = [];
            attrs.forEach(function (input) {
                if (input instanceof t.BoundAttribute) {
                    var value_4 = input.value.visit(_this._valueConverter);
                    if (value_4 !== undefined) {
                        _this.allocateBindingSlots(value_4);
                        propertyBindings.push({
                            name: input.name,
                            sourceSpan: input.sourceSpan,
                            value: function () { return _this.convertPropertyBinding(value_4); }
                        });
                    }
                }
            });
            if (propertyBindings.length > 0) {
                this.updateInstructionChainWithAdvance(templateIndex, r3_identifiers_1.Identifiers.property, propertyBindings);
            }
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
        TemplateDefinitionBuilder.prototype.processStylingUpdateInstruction = function (elementIndex, instruction) {
            var _this = this;
            var allocateBindingSlots = 0;
            if (instruction) {
                var calls_1 = [];
                instruction.calls.forEach(function (call) {
                    allocateBindingSlots += call.allocateBindingSlots;
                    calls_1.push({
                        sourceSpan: call.sourceSpan,
                        value: function () {
                            return call
                                .params(function (value) { return (call.supportsInterpolation && value instanceof ast_1.Interpolation) ?
                                _this.getUpdateInstructionArguments(value) :
                                _this.convertPropertyBinding(value); });
                        }
                    });
                });
                this.updateInstructionChainWithAdvance(elementIndex, instruction.reference, calls_1);
            }
            return allocateBindingSlots;
        };
        TemplateDefinitionBuilder.prototype.creationInstruction = function (span, reference, paramsOrFn, prepend) {
            this.instructionFn(this._creationCodeFns, span, reference, paramsOrFn || [], prepend);
        };
        TemplateDefinitionBuilder.prototype.creationInstructionChain = function (reference, calls) {
            var span = calls.length ? calls[0].sourceSpan : null;
            this._creationCodeFns.push(function () {
                return util_4.chainedInstruction(reference, calls.map(function (call) { return call.params(); }), span).toStmt();
            });
        };
        TemplateDefinitionBuilder.prototype.updateInstructionWithAdvance = function (nodeIndex, span, reference, paramsOrFn) {
            this.addAdvanceInstructionIfNecessary(nodeIndex, span);
            this.updateInstruction(span, reference, paramsOrFn);
        };
        TemplateDefinitionBuilder.prototype.updateInstruction = function (span, reference, paramsOrFn) {
            this.instructionFn(this._updateCodeFns, span, reference, paramsOrFn || []);
        };
        TemplateDefinitionBuilder.prototype.updateInstructionChain = function (reference, bindings) {
            var span = bindings.length ? bindings[0].sourceSpan : null;
            this._updateCodeFns.push(function () {
                var calls = bindings.map(function (property) {
                    var value = property.value();
                    var fnParams = Array.isArray(value) ? value : [value];
                    if (property.params) {
                        fnParams.push.apply(fnParams, tslib_1.__spread(property.params));
                    }
                    if (property.name) {
                        // We want the property name to always be the first function parameter.
                        fnParams.unshift(o.literal(property.name));
                    }
                    return fnParams;
                });
                return util_4.chainedInstruction(reference, calls, span).toStmt();
            });
        };
        TemplateDefinitionBuilder.prototype.updateInstructionChainWithAdvance = function (nodeIndex, reference, bindings) {
            this.addAdvanceInstructionIfNecessary(nodeIndex, bindings.length ? bindings[0].sourceSpan : null);
            this.updateInstructionChain(reference, bindings);
        };
        TemplateDefinitionBuilder.prototype.addAdvanceInstructionIfNecessary = function (nodeIndex, span) {
            if (nodeIndex !== this._currentIndex) {
                var delta = nodeIndex - this._currentIndex;
                if (delta < 1) {
                    throw new Error('advance instruction can only go forwards');
                }
                this.instructionFn(this._updateCodeFns, span, r3_identifiers_1.Identifiers.advance, [o.literal(delta)]);
                this._currentIndex = nodeIndex;
            }
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
        TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (value) {
            var _a;
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), expression_converter_1.BindingForm.TrySimple, function () { return util_1.error('Unexpected interpolation'); });
            var valExpr = convertedPropertyBinding.currValExpr;
            (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
            return valExpr;
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
        TemplateDefinitionBuilder.prototype.matchDirectives = function (elementName, elOrTpl) {
            var _this = this;
            if (this.directiveMatcher) {
                var selector = createCssSelector(elementName, util_4.getAttrsForDirectiveMatching(elOrTpl));
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
         *   PROJECT_AS, selector,
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
        TemplateDefinitionBuilder.prototype.getAttributeExpressions = function (renderAttributes, inputs, outputs, styles, templateAttrs, i18nAttrs) {
            if (templateAttrs === void 0) { templateAttrs = []; }
            if (i18nAttrs === void 0) { i18nAttrs = []; }
            var alreadySeen = new Set();
            var attrExprs = [];
            var ngProjectAsAttr;
            renderAttributes.forEach(function (attr) {
                if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                    ngProjectAsAttr = attr;
                }
                attrExprs.push.apply(attrExprs, tslib_1.__spread(getAttributeNameLiterals(attr.name), [util_4.asLiteral(attr.value)]));
            });
            // Keep ngProjectAs next to the other name, value pairs so we can verify that we match
            // ngProjectAs marker in the attribute name slot.
            if (ngProjectAsAttr) {
                attrExprs.push.apply(attrExprs, tslib_1.__spread(getNgProjectAsLiteral(ngProjectAsAttr)));
            }
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
                var attrsLengthBeforeInputs = attrExprs.length;
                for (var i = 0; i < inputs.length; i++) {
                    var input = inputs[i];
                    // We don't want the animation and attribute bindings in the
                    // attributes array since they aren't used for directive matching.
                    if (input.type !== 4 /* Animation */ && input.type !== 1 /* Attribute */) {
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
                if (attrExprs.length !== attrsLengthBeforeInputs) {
                    attrExprs.splice(attrsLengthBeforeInputs, 0, o.literal(3 /* Bindings */));
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
        TemplateDefinitionBuilder.prototype.addToConsts = function (expression) {
            if (o.isNull(expression)) {
                return o.TYPED_NULL_EXPR;
            }
            // Try to reuse a literal that's already in the array, if possible.
            for (var i = 0; i < this._constants.length; i++) {
                if (this._constants[i].isEquivalent(expression)) {
                    return o.literal(i);
                }
            }
            return o.literal(this._constants.push(expression) - 1);
        };
        TemplateDefinitionBuilder.prototype.addAttrsToConsts = function (attrs) {
            return attrs.length > 0 ? this.addToConsts(o.literalArr(attrs)) : o.TYPED_NULL_EXPR;
        };
        TemplateDefinitionBuilder.prototype.prepareRefsArray = function (references) {
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
            return util_4.asLiteral(refsParam);
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
            var target = new ast_1.PropertyRead(pipe.span, pipe.sourceSpan, new ast_1.ImplicitReceiver(pipe.span, pipe.sourceSpan), slotPseudoLocal);
            var _a = pipeBindingCallInfo(pipe.args), identifier = _a.identifier, isVarLength = _a.isVarLength;
            this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
            var args = tslib_1.__spread([pipe.exp], pipe.args);
            var convertedArgs = isVarLength ?
                this.visitAll([new ast_1.LiteralArray(pipe.span, pipe.sourceSpan, args)]) :
                this.visitAll(args);
            var pipeBindExpr = new ast_1.FunctionCall(pipe.span, pipe.sourceSpan, target, tslib_1.__spread([
                new ast_1.LiteralPrimitive(pipe.span, pipe.sourceSpan, slot),
                new ast_1.LiteralPrimitive(pipe.span, pipe.sourceSpan, pureFunctionSlot)
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
            return new expression_converter_1.BuiltinFunctionCall(array.span, array.sourceSpan, this.visitAll(array.expressions), function (values) {
                // If the literal has calculated (non-literal) elements transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values.
                var literal = o.literalArr(values);
                return getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
            });
        };
        ValueConverter.prototype.visitLiteralMap = function (map, context) {
            var _this = this;
            return new expression_converter_1.BuiltinFunctionCall(map.span, map.sourceSpan, this.visitAll(map.values), function (values) {
                // If the literal has calculated (non-literal) elements  transform it into
                // calls to literal factories that compose the literal and will cache intermediate
                // values.
                var literal = o.literalMap(values.map(function (value, index) { return ({ key: map.keys[index].key, value: value, quoted: map.keys[index].quoted }); }));
                return getLiteralFactory(_this.constantPool, literal, _this.allocatePureFunctionSlots);
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
        var _b = pureFunctionCallInfo(literalFactoryArguments), identifier = _b.identifier, isVarLength = _b.isVarLength;
        // Literal factories are pure functions that only need to be re-invoked when the parameters
        // change.
        var args = [o.literal(startSlot), literalFactory];
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
            // Shared context variables are always generated as "ReadVarExpr".
            return this.map.get(bindingKey).lhs;
        };
        BindingScope.prototype.getSharedContextName = function (retrievalLevel) {
            var sharedCtxObj = this.map.get(SHARED_CONTEXT_KEY + retrievalLevel);
            // Shared context variables are always generated as "ReadVarExpr".
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
    function createCssSelector(elementName, attributes) {
        var cssSelector = new selector_1.CssSelector();
        var elementNameNoNs = tags_1.splitNsName(elementName)[1];
        cssSelector.setElement(elementNameNoNs);
        Object.getOwnPropertyNames(attributes).forEach(function (name) {
            var nameNoNs = tags_1.splitNsName(name)[1];
            var value = attributes[name];
            cssSelector.addAttribute(nameNoNs, value);
            if (name.toLowerCase() === 'class') {
                var classes = value.trim().split(/\s+/);
                classes.forEach(function (className) { return cssSelector.addClassName(className); });
            }
        });
        return cssSelector;
    }
    exports.createCssSelector = createCssSelector;
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
    /**
     * Gets the instruction to generate for an interpolated property
     * @param interpolation An Interpolation AST
     */
    function getPropertyInterpolationExpression(interpolation) {
        switch (util_4.getInterpolationArgsLength(interpolation)) {
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
        switch (util_4.getInterpolationArgsLength(interpolation)) {
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
        switch (util_4.getInterpolationArgsLength(interpolation)) {
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
     * Parse a template into render3 `Node`s and additional metadata, with no other dependencies.
     *
     * @param template text of the template to parse
     * @param templateUrl URL to use for source mapping of the parsed template
     * @param options options to modify how the template is parsed
     */
    function parseTemplate(template, templateUrl, options) {
        if (options === void 0) { options = {}; }
        var interpolationConfig = options.interpolationConfig, preserveWhitespaces = options.preserveWhitespaces, enableI18nLegacyMessageIdFormat = options.enableI18nLegacyMessageIdFormat;
        var bindingParser = makeBindingParser(interpolationConfig);
        var htmlParser = new html_parser_1.HtmlParser();
        var parseResult = htmlParser.parse(template, templateUrl, tslib_1.__assign(tslib_1.__assign({ leadingTriviaChars: LEADING_TRIVIA_CHARS }, options), { tokenizeExpansionForms: true }));
        if (parseResult.errors && parseResult.errors.length > 0) {
            return { errors: parseResult.errors, nodes: [], styleUrls: [], styles: [] };
        }
        var rootNodes = parseResult.rootNodes;
        // process i18n meta information (scan attributes, generate ids)
        // before we run whitespace removal process, because existing i18n
        // extraction process (ng xi18n) relies on a raw content to generate
        // message ids
        var i18nMetaVisitor = new meta_1.I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ !preserveWhitespaces, enableI18nLegacyMessageIdFormat);
        rootNodes = html.visitAll(i18nMetaVisitor, rootNodes);
        if (!preserveWhitespaces) {
            rootNodes = html.visitAll(new html_whitespaces_1.WhitespaceVisitor(), rootNodes);
            // run i18n meta visitor again in case whitespaces are removed (because that might affect
            // generated i18n message content) and first pass indicated that i18n content is present in a
            // template. During this pass i18n IDs generated at the first pass will be preserved, so we can
            // mimic existing extraction process (ng xi18n)
            if (i18nMetaVisitor.hasI18nMeta) {
                rootNodes = html.visitAll(new meta_1.I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
            }
        }
        var _a = r3_template_transform_1.htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, errors = _a.errors, styleUrls = _a.styleUrls, styles = _a.styles;
        if (errors && errors.length > 0) {
            return { errors: errors, nodes: [], styleUrls: [], styles: [] };
        }
        return { nodes: nodes, styleUrls: styleUrls, styles: styles };
    }
    exports.parseTemplate = parseTemplate;
    var elementRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
    /**
     * Construct a `BindingParser` with a default configuration.
     */
    function makeBindingParser(interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        return new binding_parser_1.BindingParser(new parser_1.Parser(new lexer_1.Lexer()), interpolationConfig, elementRegistry, null, []);
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
    /** Name of the global variable that is used to determine if we use Closure translations or not */
    var NG_I18N_CLOSURE_MODE = 'ngI18nClosureMode';
    /**
     * Generate statements that define a given translation message.
     *
     * ```
     * var I18N_1;
     * if (typeof ngI18nClosureMode !== undefined && ngI18nClosureMode) {
     *     var MSG_EXTERNAL_XXX = goog.getMsg(
     *          "Some message with {$interpolation}!",
     *          { "interpolation": "\uFFFD0\uFFFD" }
     *     );
     *     I18N_1 = MSG_EXTERNAL_XXX;
     * }
     * else {
     *     I18N_1 = $localize`Some message with ${'\uFFFD0\uFFFD'}!`;
     * }
     * ```
     *
     * @param message The original i18n AST message node
     * @param variable The variable that will be assigned the translation, e.g. `I18N_1`.
     * @param closureVar The variable for Closure `goog.getMsg` calls, e.g. `MSG_EXTERNAL_XXX`.
     * @param params Object mapping placeholder names to their values (e.g.
     * `{ "interpolation": "\uFFFD0\uFFFD" }`).
     * @param transformFn Optional transformation function that will be applied to the translation (e.g.
     * post-processing).
     * @returns An array of statements that defined a given translation.
     */
    function getTranslationDeclStmts(message, variable, closureVar, params, transformFn) {
        if (params === void 0) { params = {}; }
        var statements = [
            util_3.declareI18nVariable(variable),
            o.ifStmt(createClosureModeGuard(), get_msg_utils_1.createGoogleGetMsgStatements(variable, message, closureVar, util_3.i18nFormatPlaceholderNames(params, /* useCamelCase */ true)), localize_utils_1.createLocalizeStatements(variable, message, util_3.i18nFormatPlaceholderNames(params, /* useCamelCase */ false))),
        ];
        if (transformFn) {
            statements.push(new o.ExpressionStatement(variable.set(transformFn(variable))));
        }
        return statements;
    }
    exports.getTranslationDeclStmts = getTranslationDeclStmts;
    /**
     * Create the expression that will be used to guard the closure mode block
     * It is equivalent to:
     *
     * ```
     * typeof ngI18nClosureMode !== undefined && ngI18nClosureMode
     * ```
     */
    function createClosureModeGuard() {
        return o.typeofExpr(o.variable(NG_I18N_CLOSURE_MODE))
            .notIdentical(o.literal('undefined', o.STRING_TYPE))
            .and(o.variable(NG_I18N_CLOSURE_MODE));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDJFQUFtRTtJQUNuRSxpR0FBK0s7SUFFL0ssaURBQW1DO0lBQ25DLG1FQUFtTztJQUNuTyx1RUFBb0Q7SUFDcEQseUVBQXNEO0lBRXRELDBEQUE0QztJQUM1QywyRUFBdUQ7SUFDdkQscUZBQW1FO0lBQ25FLDZGQUF1RztJQUV2Ryw2REFBc0Y7SUFDdEYsa0VBQWlEO0lBQ2pELDJEQUE2QztJQUU3Qyx3R0FBa0Y7SUFDbEYsMkRBQTREO0lBQzVELHVGQUFtRTtJQUNuRSxtREFBaUM7SUFDakMsd0RBQStCO0lBQy9CLCtFQUFvRDtJQUNwRCw2RkFBNkQ7SUFDN0QsMkRBQXlIO0lBRXpILDJFQUEyQztJQUMzQyx1RkFBa0U7SUFDbEUseUZBQStEO0lBQy9ELHFFQUE0QztJQUM1QyxxRUFBNFM7SUFDNVMsc0ZBQXFFO0lBQ3JFLGdFQUE2TztJQUk3Tyw0Q0FBNEM7SUFDNUMsSUFBTSxzQkFBc0IsR0FBRyxRQUFRLENBQUM7SUFFeEMsbUNBQW1DO0lBQ25DLElBQU0sdUJBQXVCLEdBQUcsYUFBYSxDQUFDO0lBRTlDLHVEQUF1RDtJQUN2RCxJQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxDQUNuQyxDQUFDLENBQUMsUUFBUSxFQUFFLDRCQUFFLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsNEJBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSw0QkFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVoRyxJQUFNLG9CQUFvQixHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENB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Q0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7SUFDN0MsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgTG9jYWxSZXNvbHZlciwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRVcGRhdGVBcmd1bWVudHN9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge1BhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7aHRtbEFzdFRvUmVuZGVyM0FzdH0gZnJvbSAnLi4vcjNfdGVtcGxhdGVfdHJhbnNmb3JtJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljTGlzdGVuZXJOYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtJMThuQ29udGV4dH0gZnJvbSAnLi9pMThuL2NvbnRleHQnO1xuaW1wb3J0IHtjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzfSBmcm9tICcuL2kxOG4vZ2V0X21zZ191dGlscyc7XG5pbXBvcnQge2NyZWF0ZUxvY2FsaXplU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2xvY2FsaXplX3V0aWxzJztcbmltcG9ydCB7STE4bk1ldGFWaXNpdG9yfSBmcm9tICcuL2kxOG4vbWV0YSc7XG5pbXBvcnQge0kxOE5fSUNVX01BUFBJTkdfUFJFRklYLCBUUkFOU0xBVElPTl9QUkVGSVgsIGFzc2VtYmxlQm91bmRUZXh0UGxhY2Vob2xkZXJzLCBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZywgZGVjbGFyZUkxOG5WYXJpYWJsZSwgZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeCwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtDT05URVhUX05BTUUsIElNUExJQ0lUX1JFRkVSRU5DRSwgTk9OX0JJTkRBQkxFX0FUVFIsIFJFRkVSRU5DRV9QUkVGSVgsIFJFTkRFUl9GTEFHUywgYXNMaXRlcmFsLCBjaGFpbmVkSW5zdHJ1Y3Rpb24sIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcsIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoLCBpbnZhbGlkLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5jb25zdCBMRUFESU5HX1RSSVZJQV9DSEFSUyA9IFsnICcsICdcXG4nLCAnXFxyJywgJ1xcdCddO1xuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgaGFuZGxlck5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsLFxuICAgIHNjb3BlOiBCaW5kaW5nU2NvcGUgfCBudWxsID0gbnVsbCk6IG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3Qge3R5cGUsIG5hbWUsIHRhcmdldCwgcGhhc2UsIGhhbmRsZXJ9ID0gZXZlbnRBc3Q7XG4gIGlmICh0YXJnZXQgJiYgIUdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmhhcyh0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGdsb2JhbCB0YXJnZXQgJyR7dGFyZ2V0fScgZGVmaW5lZCBmb3IgJyR7bmFtZX0nIGV2ZW50LlxuICAgICAgICBTdXBwb3J0ZWQgbGlzdCBvZiBnbG9iYWwgdGFyZ2V0czogJHtBcnJheS5mcm9tKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmtleXMoKSl9LmApO1xuICB9XG5cbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckV4cHIgPSAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuYmluZGluZ0xldmVsID09PSAwKSA/XG4gICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgc2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgc2NvcGUsIGltcGxpY2l0UmVjZWl2ZXJFeHByLCBoYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSxcbiAgICAgIGV2ZW50QXN0LmhhbmRsZXJTcGFuKTtcblxuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSk7XG4gIH1cbiAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10cyk7XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UgISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3MgPSBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXTtcbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcblxuICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChldmVudE5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAodGFyZ2V0KSB7XG4gICAgcGFyYW1zLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChmYWxzZSksICAvLyBgdXNlQ2FwdHVyZWAgZmxhZywgZGVmYXVsdHMgdG8gYGZhbHNlYFxuICAgICAgICBvLmltcG9ydEV4cHIoR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KHRhcmdldCkgISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuXG4gIC8qKiBJbmRleCBvZiB0aGUgY3VycmVudGx5LXNlbGVjdGVkIG5vZGUuICovXG4gIHByaXZhdGUgX2N1cnJlbnRJbmRleDogbnVtYmVyID0gMDtcblxuICAvKiogVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBnZW5lcmF0ZWQgZnJvbSB2aXNpdGluZyBwaXBlcywgbGl0ZXJhbHMsIGV0Yy4gKi9cbiAgcHJpdmF0ZSBfdGVtcFZhcmlhYmxlczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAvKipcbiAgICogTGlzdCBvZiBjYWxsYmFja3MgdG8gYnVpbGQgbmVzdGVkIHRlbXBsYXRlcy4gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IG5vdCBiZSB2aXNpdGVkIHVudGlsXG4gICAqIGFmdGVyIHRoZSBwYXJlbnQgdGVtcGxhdGUgaGFzIGZpbmlzaGVkIHZpc2l0aW5nIGFsbCBvZiBpdHMgbm9kZXMuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbFxuICAgKiBsb2NhbCByZWYgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyBhcmUgYWJsZSB0byBmaW5kIGxvY2FsIHJlZiB2YWx1ZXMgaWYgdGhlIHJlZnNcbiAgICogYXJlIGRlZmluZWQgYWZ0ZXIgdGhlIHRlbXBsYXRlIGRlY2xhcmF0aW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBfbmVzdGVkVGVtcGxhdGVGbnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIC8qKlxuICAgKiBUaGlzIHNjb3BlIGNvbnRhaW5zIGxvY2FsIHZhcmlhYmxlcyBkZWNsYXJlZCBpbiB0aGUgdXBkYXRlIG1vZGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlLlxuICAgKiAoZS5nLiByZWZzIGFuZCBjb250ZXh0IHZhcnMgaW4gYmluZGluZ3MpXG4gICAqL1xuICBwcml2YXRlIF9iaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZTtcbiAgcHJpdmF0ZSBfdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBwcml2YXRlIF91bnN1cHBvcnRlZCA9IHVuc3VwcG9ydGVkO1xuXG4gIC8vIGkxOG4gY29udGV4dCBsb2NhbCB0byB0aGlzIHRlbXBsYXRlXG4gIHByaXZhdGUgaTE4bjogSTE4bkNvbnRleHR8bnVsbCA9IG51bGw7XG5cbiAgLy8gTnVtYmVyIG9mIHNsb3RzIHRvIHJlc2VydmUgZm9yIHB1cmVGdW5jdGlvbnNcbiAgcHJpdmF0ZSBfcHVyZUZ1bmN0aW9uU2xvdHMgPSAwO1xuXG4gIC8vIE51bWJlciBvZiBiaW5kaW5nIHNsb3RzXG4gIHByaXZhdGUgX2JpbmRpbmdTbG90cyA9IDA7XG5cbiAgcHJpdmF0ZSBmaWxlQmFzZWRJMThuU3VmZml4OiBzdHJpbmc7XG5cbiAgLy8gUHJvamVjdGlvbiBzbG90cyBmb3VuZCBpbiB0aGUgdGVtcGxhdGUuIFByb2plY3Rpb24gc2xvdHMgY2FuIGRpc3RyaWJ1dGUgcHJvamVjdGVkXG4gIC8vIG5vZGVzIGJhc2VkIG9uIGEgc2VsZWN0b3IsIG9yIGNhbiBqdXN0IHVzZSB0aGUgd2lsZGNhcmQgc2VsZWN0b3IgdG8gbWF0Y2hcbiAgLy8gYWxsIG5vZGVzIHdoaWNoIGFyZW4ndCBtYXRjaGluZyBhbnkgc2VsZWN0b3IuXG4gIHByaXZhdGUgX25nQ29udGVudFJlc2VydmVkU2xvdHM6IChzdHJpbmd8JyonKVtdID0gW107XG5cbiAgLy8gTnVtYmVyIG9mIG5vbi1kZWZhdWx0IHNlbGVjdG9ycyBmb3VuZCBpbiBhbGwgcGFyZW50IHRlbXBsYXRlcyBvZiB0aGlzIHRlbXBsYXRlLiBXZSBuZWVkIHRvXG4gIC8vIHRyYWNrIGl0IHRvIHByb3Blcmx5IGFkanVzdCBwcm9qZWN0aW9uIHNsb3QgaW5kZXggaW4gdGhlIGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbi5cbiAgcHJpdmF0ZSBfbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gMDtcblxuICAvLyBFeHByZXNzaW9uIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgaW1wbGljaXQgcmVjZWl2ZXIgd2hlbiBjb252ZXJ0aW5nIHRlbXBsYXRlXG4gIC8vIGV4cHJlc3Npb25zIHRvIG91dHB1dCBBU1QuXG4gIHByaXZhdGUgX2ltcGxpY2l0UmVjZWl2ZXJFeHByOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiBzdHJpbmcsXG4gICAgICBwcml2YXRlIGkxOG5Vc2VFeHRlcm5hbElkczogYm9vbGVhbiwgcHJpdmF0ZSBfY29uc3RhbnRzOiBvLkV4cHJlc3Npb25bXSA9IFtdKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4ge1xuICAgICAgICAgIGNvbnN0IHBpcGVUeXBlID0gcGlwZVR5cGVCeU5hbWUuZ2V0KG5hbWUpO1xuICAgICAgICAgIGlmIChwaXBlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5waXBlcy5hZGQocGlwZVR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KHRoaXMubGV2ZWwsIGxvY2FsTmFtZSwgdmFsdWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5waXBlLCBbby5saXRlcmFsKHNsb3QpLCBvLmxpdGVyYWwobmFtZSldKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBidWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICBub2RlczogdC5Ob2RlW10sIHZhcmlhYmxlczogdC5WYXJpYWJsZVtdLCBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ6IG51bWJlciA9IDAsXG4gICAgICBpMThuPzogaTE4bi5JMThuTWV0YSk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID1cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dCB8fCAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuICEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHsgdGhpcy5fYmluZGluZ1Njb3BlLm5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTsgfVxuXG4gIHByaXZhdGUgaTE4blRyYW5zbGF0ZShcbiAgICAgIG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSwgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fSwgcmVmPzogby5SZWFkVmFyRXhwcixcbiAgICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5SZWFkVmFyRXhwciB7XG4gICAgY29uc3QgX3JlZiA9IHJlZiB8fCBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMobWVzc2FnZSwgX3JlZiwgY2xvc3VyZVZhciwgcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKC4uLnN0YXRlbWVudHMpO1xuICAgIHJldHVybiBfcmVmO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlckNvbnRleHRWYXJpYWJsZXModmFyaWFibGU6IHQuVmFyaWFibGUpIHtcbiAgICBjb25zdCBzY29wZWROYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgIGNvbnN0IHJldHJpZXZhbExldmVsID0gdGhpcy5sZXZlbDtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlLm5hbWUgKyBzY29wZWROYW1lKTtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICByZXRyaWV2YWxMZXZlbCwgdmFyaWFibGUubmFtZSwgbGhzLCBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQsXG4gICAgICAgIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICBsZXQgcmhzOiBvLkV4cHJlc3Npb247XG4gICAgICAgICAgaWYgKHNjb3BlLmJpbmRpbmdMZXZlbCA9PT0gcmV0cmlldmFsTGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4XG4gICAgICAgICAgICByaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYXJlZEN0eFZhciA9IHNjb3BlLmdldFNoYXJlZENvbnRleHROYW1lKHJldHJpZXZhbExldmVsKTtcbiAgICAgICAgICAgIC8vIGUuZy4gY3R4X3IwICAgT1IgIHgoMik7XG4gICAgICAgICAgICByaHMgPSBzaGFyZWRDdHhWYXIgPyBzaGFyZWRDdHhWYXIgOiBnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZS5nLiBjb25zdCAkaXRlbSQgPSB4KDIpLiRpbXBsaWNpdDtcbiAgICAgICAgICByZXR1cm4gW2xocy5zZXQocmhzLnByb3AodmFyaWFibGUudmFsdWUgfHwgSU1QTElDSVRfUkVGRVJFTkNFKSkudG9Db25zdERlY2woKV07XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnM6IEFTVFtdKSB7XG4gICAgaWYgKGV4cHJlc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB0aGlzLmkxOG4gIS5hcHBlbmRCaW5kaW5nKGV4cHJlc3Npb24pKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHQgfCB0LkJvdW5kVGV4dH0pOlxuICAgICAge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0ge1xuICAgIGNvbnN0IGJvdW5kOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHByb3BzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gcHJvcHNba2V5XTtcbiAgICAgIGlmIChwcm9wIGluc3RhbmNlb2YgdC5UZXh0KSB7XG4gICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwocHJvcC52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3AudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgIGNvbnN0IHtzdHJpbmdzLCBleHByZXNzaW9uc30gPSB2YWx1ZTtcbiAgICAgICAgICBjb25zdCB7aWQsIGJpbmRpbmdzfSA9IHRoaXMuaTE4biAhO1xuICAgICAgICAgIGNvbnN0IGxhYmVsID0gYXNzZW1ibGVJMThuQm91bmRTdHJpbmcoc3RyaW5ncywgYmluZGluZ3Muc2l6ZSwgaWQpO1xuICAgICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zKTtcbiAgICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVXBkYXRlUmVmKGNvbnRleHQ6IEkxOG5Db250ZXh0KTogdm9pZCB7XG4gICAgY29uc3Qge2ljdXMsIG1ldGEsIGlzUm9vdCwgaXNSZXNvbHZlZCwgaXNFbWl0dGVkfSA9IGNvbnRleHQ7XG4gICAgaWYgKGlzUm9vdCAmJiBpc1Jlc29sdmVkICYmICFpc0VtaXR0ZWQgJiYgIWlzU2luZ2xlSTE4bkljdShtZXRhKSkge1xuICAgICAgY29udGV4dC5pc0VtaXR0ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gY29udGV4dC5nZXRTZXJpYWxpemVkUGxhY2Vob2xkZXJzKCk7XG4gICAgICBsZXQgaWN1TWFwcGluZzoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgICBsZXQgcGFyYW1zOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPVxuICAgICAgICAgIHBsYWNlaG9sZGVycy5zaXplID8gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKSA6IHt9O1xuICAgICAgaWYgKGljdXMuc2l6ZSkge1xuICAgICAgICBpY3VzLmZvckVhY2goKHJlZnM6IG8uRXhwcmVzc2lvbltdLCBrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChyZWZzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBvbmUgSUNVIGRlZmluZWQgZm9yIGEgZ2l2ZW5cbiAgICAgICAgICAgIC8vIHBsYWNlaG9sZGVyIC0ganVzdCBvdXRwdXQgaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSByZWZzWzBdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAuLi4gb3RoZXJ3aXNlIHdlIG5lZWQgdG8gYWN0aXZhdGUgcG9zdC1wcm9jZXNzaW5nXG4gICAgICAgICAgICAvLyB0byByZXBsYWNlIElDVSBwbGFjZWhvbGRlcnMgd2l0aCBwcm9wZXIgdmFsdWVzXG4gICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcjogc3RyaW5nID0gd3JhcEkxOG5QbGFjZWhvbGRlcihgJHtJMThOX0lDVV9NQVBQSU5HX1BSRUZJWH0ke2tleX1gKTtcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gby5saXRlcmFsKHBsYWNlaG9sZGVyKTtcbiAgICAgICAgICAgIGljdU1hcHBpbmdba2V5XSA9IG8ubGl0ZXJhbEFycihyZWZzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyB0cmFuc2xhdGlvbiByZXF1aXJlcyBwb3N0IHByb2Nlc3NpbmcgaW4gMiBjYXNlczpcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBwbGFjZWhvbGRlcnMgd2l0aCBtdWx0aXBsZSB2YWx1ZXMgKGV4LiBgU1RBUlRfRElWYDogW++/vSMx77+9LCDvv70jMu+/vSwgLi4uXSlcbiAgICAgIC8vIC0gaWYgd2UgaGF2ZSBtdWx0aXBsZSBJQ1VzIHRoYXQgcmVmZXIgdG8gdGhlIHNhbWUgcGxhY2Vob2xkZXIgbmFtZVxuICAgICAgY29uc3QgbmVlZHNQb3N0cHJvY2Vzc2luZyA9XG4gICAgICAgICAgQXJyYXkuZnJvbShwbGFjZWhvbGRlcnMudmFsdWVzKCkpLnNvbWUoKHZhbHVlOiBzdHJpbmdbXSkgPT4gdmFsdWUubGVuZ3RoID4gMSkgfHxcbiAgICAgICAgICBPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGg7XG5cbiAgICAgIGxldCB0cmFuc2Zvcm1GbjtcbiAgICAgIGlmIChuZWVkc1Bvc3Rwcm9jZXNzaW5nKSB7XG4gICAgICAgIHRyYW5zZm9ybUZuID0gKHJhdzogby5SZWFkVmFyRXhwcikgPT4ge1xuICAgICAgICAgIGNvbnN0IGFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW3Jhd107XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKG1hcExpdGVyYWwoaWN1TWFwcGluZywgdHJ1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuaTE4blBvc3Rwcm9jZXNzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXRhIGFzIGkxOG4uTWVzc2FnZSwgcGFyYW1zLCBjb250ZXh0LnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaTE4blN0YXJ0KHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsID0gbnVsbCwgbWV0YTogaTE4bi5JMThuTWV0YSwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTpcbiAgICAgIHZvaWQge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgaWYgKHRoaXMuaTE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4biA9IHRoaXMuaTE4bkNvbnRleHQuZm9ya0NoaWxkQ29udGV4dChpbmRleCwgdGhpcy50ZW1wbGF0ZUluZGV4ICEsIG1ldGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCByZWYgPSBvLnZhcmlhYmxlKHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoVFJBTlNMQVRJT05fUFJFRklYKSk7XG4gICAgICB0aGlzLmkxOG4gPSBuZXcgSTE4bkNvbnRleHQoaW5kZXgsIHJlZiwgMCwgdGhpcy50ZW1wbGF0ZUluZGV4LCBtZXRhKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBpMThuU3RhcnQgaW5zdHJ1Y3Rpb25cbiAgICBjb25zdCB7aWQsIHJlZn0gPSB0aGlzLmkxOG47XG4gICAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoaW5kZXgpLCByZWZdO1xuICAgIGlmIChpZCA+IDApIHtcbiAgICAgIC8vIGRvIG5vdCBwdXNoIDNyZCBhcmd1bWVudCAoc3ViLWJsb2NrIGlkKVxuICAgICAgLy8gaW50byBpMThuU3RhcnQgY2FsbCBmb3IgdG9wIGxldmVsIGkxOG4gY29udGV4dFxuICAgICAgcGFyYW1zLnB1c2goby5saXRlcmFsKGlkKSk7XG4gICAgfVxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBzZWxmQ2xvc2luZyA/IFIzLmkxOG4gOiBSMy5pMThuU3RhcnQsIHBhcmFtcyk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgY29uc3QgY2hhaW5CaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICAgIGJpbmRpbmdzLmZvckVhY2goYmluZGluZyA9PiB7XG4gICAgICAgIGNoYWluQmluZGluZ3MucHVzaCh7c291cmNlU3Bhbjogc3BhbiwgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhiaW5kaW5nKX0pO1xuICAgICAgfSk7XG4gICAgICAvLyBmb3IgaTE4biBibG9jaywgYWR2YW5jZSB0byB0aGUgbW9zdCByZWNlbnQgZWxlbWVudCBpbmRleCAoYnkgdGFraW5nIHRoZSBjdXJyZW50IG51bWJlciBvZlxuICAgICAgLy8gZWxlbWVudHMgYW5kIHN1YnRyYWN0aW5nIG9uZSkgYmVmb3JlIGludm9raW5nIGBpMThuRXhwYCBpbnN0cnVjdGlvbnMsIHRvIG1ha2Ugc3VyZSB0aGVcbiAgICAgIC8vIG5lY2Vzc2FyeSBsaWZlY3ljbGUgaG9va3Mgb2YgY29tcG9uZW50cy9kaXJlY3RpdmVzIGFyZSBwcm9wZXJseSBmbHVzaGVkLlxuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UodGhpcy5nZXRDb25zdENvdW50KCkgLSAxLCBSMy5pMThuRXhwLCBjaGFpbkJpbmRpbmdzKTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkFwcGx5LCBbby5saXRlcmFsKGluZGV4KV0pO1xuICAgIH1cbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuaTE4bkVuZCk7XG4gICAgfVxuICAgIHRoaXMuaTE4biA9IG51bGw7ICAvLyByZXNldCBsb2NhbCBpMThuIGNvbnRleHRcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFkZE5hbWVzcGFjZUluc3RydWN0aW9uKG5zSW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIHRoaXMuX25hbWVzcGFjZSA9IG5zSW5zdHJ1Y3Rpb247XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgbnNJbnN0cnVjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eSBvciBhdHRyaWJ1dGUsIHN1Y2ggYXNcbiAgICogYHByb3A9XCJ7e3ZhbHVlfX1cImAgb3IgYGF0dHIudGl0bGU9XCJ7e3ZhbHVlfX1cImBcbiAgICovXG4gIHByaXZhdGUgaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgdmFsdWU6IGFueSwgcGFyYW1zOiBhbnlbXSkge1xuICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbixcbiAgICAgICAgKCkgPT4gW28ubGl0ZXJhbChhdHRyTmFtZSksIC4uLnRoaXMuZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHModmFsdWUpLCAuLi5wYXJhbXNdKTtcbiAgfVxuXG4gIHZpc2l0Q29udGVudChuZ0NvbnRlbnQ6IHQuQ29udGVudCkge1xuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBjb25zdCBwcm9qZWN0aW9uU2xvdElkeCA9IHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCArIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoO1xuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChzbG90KV07XG5cbiAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKTtcblxuICAgIGNvbnN0IG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzID1cbiAgICAgICAgbmdDb250ZW50LmF0dHJpYnV0ZXMuZmlsdGVyKGF0dHIgPT4gYXR0ci5uYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzLCBbXSwgW10pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCksIG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSk7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0aW9uU2xvdElkeCAhPT0gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFByb2plY3Rpb24obmdDb250ZW50LmkxOG4gISwgc2xvdCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHN0eWxpbmdCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBudWxsKTtcblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50OiBib29sZWFuID1cbiAgICAgICAgaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGVsZW1lbnQuaTE4bik7XG5cbiAgICBjb25zdCBpMThuQXR0cnM6ICh0LlRleHRBdHRyaWJ1dGUgfCB0LkJvdW5kQXR0cmlidXRlKVtdID0gW107XG4gICAgY29uc3Qgb3V0cHV0QXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBjb25zdCBbbmFtZXNwYWNlS2V5LCBlbGVtZW50TmFtZV0gPSBzcGxpdE5zTmFtZShlbGVtZW50Lm5hbWUpO1xuICAgIGNvbnN0IGlzTmdDb250YWluZXIgPSBjaGVja0lzTmdDb250YWluZXIoZWxlbWVudC5uYW1lKTtcblxuICAgIC8vIEhhbmRsZSBzdHlsaW5nLCBpMThuLCBuZ05vbkJpbmRhYmxlIGF0dHJpYnV0ZXNcbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZWxlbWVudC5hdHRyaWJ1dGVzKSB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXR0cjtcbiAgICAgIGlmIChuYW1lID09PSBOT05fQklOREFCTEVfQVRUUikge1xuICAgICAgICBpc05vbkJpbmRhYmxlTW9kZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIodmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQ2xhc3NBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChhdHRyLmkxOG4pIHtcbiAgICAgICAgICAvLyBQbGFjZSBhdHRyaWJ1dGVzIGludG8gYSBzZXBhcmF0ZSBhcnJheSBmb3IgaTE4biBwcm9jZXNzaW5nLCBidXQgYWxzbyBrZWVwIHN1Y2hcbiAgICAgICAgICAvLyBhdHRyaWJ1dGVzIGluIHRoZSBtYWluIGxpc3QgdG8gbWFrZSB0aGVtIGF2YWlsYWJsZSBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nIGF0IHJ1bnRpbWUuXG4gICAgICAgICAgLy8gVE9ETyhGVy0xMjQ4KTogcHJldmVudCBhdHRyaWJ1dGVzIGR1cGxpY2F0aW9uIGluIGBpMThuQXR0cmlidXRlc2AgYW5kIGBlbGVtZW50U3RhcnRgXG4gICAgICAgICAgLy8gYXJndW1lbnRzXG4gICAgICAgICAgaTE4bkF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3V0cHV0QXR0cnMucHVzaChhdHRyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICAgIG91dHB1dEF0dHJzLCBhbGxPdGhlcklucHV0cywgZWxlbWVudC5vdXRwdXRzLCBzdHlsaW5nQnVpbGRlciwgW10sIGkxOG5BdHRycyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyaWJ1dGVzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxkaXYgI2ZvbyAjYmFyPVwiYmF6XCI+KVxuICAgIGNvbnN0IHJlZnMgPSB0aGlzLnByZXBhcmVSZWZzQXJyYXkoZWxlbWVudC5yZWZlcmVuY2VzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRUb0NvbnN0cyhyZWZzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikgPyAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzV2l0aFBpcGVzICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgaTE4bkF0dHJzLmxlbmd0aCA9PT0gMCAmJiAhaGFzQ2hpbGRyZW47XG4gICAgY29uc3QgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPVxuICAgICAgICAhY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbiAmJiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKGNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyIDogUjMuZWxlbWVudCxcbiAgICAgICAgICB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50LnNvdXJjZVNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyU3RhcnQgOiBSMy5lbGVtZW50U3RhcnQsXG4gICAgICAgICAgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuXG4gICAgICBpZiAoaXNOb25CaW5kYWJsZU1vZGUpIHtcbiAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcHJvY2VzcyBpMThuIGVsZW1lbnQgYXR0cmlidXRlc1xuICAgICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGhhc0JpbmRpbmdzOiBib29sZWFuID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICAgICAgY29uc3QgYmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgICAgIGkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhdHRyLmkxOG4gIWFzIGkxOG4uTWVzc2FnZTtcbiAgICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IGF0dHIudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhjb252ZXJ0ZWQpO1xuICAgICAgICAgICAgaWYgKGNvbnZlcnRlZCBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMobWVzc2FnZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycyk7XG4gICAgICAgICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGFyYW1zKSk7XG4gICAgICAgICAgICAgIGNvbnZlcnRlZC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgICAgICAgICAgIGhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBiaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHNvdXJjZVNwYW46IGVsZW1lbnQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbilcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCkge1xuICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgUjMuaTE4bkV4cCwgYmluZGluZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpMThuQXR0ckFyZ3MubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc3QgaW5kZXg6IG8uRXhwcmVzc2lvbiA9IG8ubGl0ZXJhbCh0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSk7XG4gICAgICAgICAgY29uc3QgYXJncyA9IHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoaTE4bkF0dHJBcmdzKSwgdHJ1ZSk7XG4gICAgICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkF0dHJpYnV0ZXMsIFtpbmRleCwgYXJnc10pO1xuICAgICAgICAgIGlmIChoYXNCaW5kaW5ncykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIExpc3RlbmVycyAob3V0cHV0cylcbiAgICAgIGlmIChlbGVtZW50Lm91dHB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSBlbGVtZW50Lm91dHB1dHMubWFwKFxuICAgICAgICAgICAgKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiAoe1xuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBvdXRwdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgcGFyYW1zOiB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcihlbGVtZW50Lm5hbWUsIG91dHB1dEFzdCwgZWxlbWVudEluZGV4KVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihSMy5saXN0ZW5lciwgbGlzdGVuZXJzKTtcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZTogaXQncyBpbXBvcnRhbnQgdG8ga2VlcCBpMThuL2kxOG5TdGFydCBpbnN0cnVjdGlvbnMgYWZ0ZXIgaTE4bkF0dHJpYnV0ZXMgYW5kXG4gICAgICAvLyBsaXN0ZW5lcnMsIHRvIG1ha2Ugc3VyZSBpMThuQXR0cmlidXRlcyBpbnN0cnVjdGlvbiB0YXJnZXRzIGN1cnJlbnQgZWxlbWVudCBhdCBydW50aW1lLlxuICAgICAgaWYgKGlzSTE4blJvb3RFbGVtZW50KSB7XG4gICAgICAgIHRoaXMuaTE4blN0YXJ0KGVsZW1lbnQuc291cmNlU3BhbiwgZWxlbWVudC5pMThuICEsIGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0aGUgY29kZSBoZXJlIHdpbGwgY29sbGVjdCBhbGwgdXBkYXRlLWxldmVsIHN0eWxpbmcgaW5zdHJ1Y3Rpb25zIGFuZCBhZGQgdGhlbSB0byB0aGVcbiAgICAvLyB1cGRhdGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIEFPVCBjb2RlLiBJbnN0cnVjdGlvbnMgbGlrZSBgc3R5bGVQcm9wYCxcbiAgICAvLyBgc3R5bGVNYXBgLCBgY2xhc3NNYXBgLCBgY2xhc3NQcm9wYCBhbmQgYHN0eWxpbmdBcHBseWBcbiAgICAvLyBhcmUgYWxsIGdlbmVyYXRlZCBhbmQgYXNzaWduZWQgaW4gdGhlIGNvZGUgYmVsb3cuXG4gICAgY29uc3Qgc3R5bGluZ0luc3RydWN0aW9ucyA9IHN0eWxpbmdCdWlsZGVyLmJ1aWxkVXBkYXRlTGV2ZWxJbnN0cnVjdGlvbnModGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgIGNvbnN0IGxpbWl0ID0gc3R5bGluZ0luc3RydWN0aW9ucy5sZW5ndGggLSAxO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gc3R5bGluZ0luc3RydWN0aW9uc1tpXTtcbiAgICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB0aGlzLnByb2Nlc3NTdHlsaW5nVXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gdGhlIHJlYXNvbiB3aHkgYHVuZGVmaW5lZGAgaXMgdXNlZCBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciB1bmRlcnN0YW5kcyB0aGlzIGFzIGFcbiAgICAvLyBzcGVjaWFsIHZhbHVlIHRvIHN5bWJvbGl6ZSB0aGF0IHRoZXJlIGlzIG5vIFJIUyB0byB0aGlzIGJpbmRpbmdcbiAgICAvLyBUT0RPIChtYXRza28pOiByZXZpc2l0IHRoaXMgb25jZSBGVy05NTkgaXMgYXBwcm9hY2hlZFxuICAgIGNvbnN0IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb24gPSBvLmxpdGVyYWwodW5kZWZpbmVkKTtcbiAgICBjb25zdCBwcm9wZXJ0eUJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZUJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuXG4gICAgLy8gR2VuZXJhdGUgZWxlbWVudCBpbnB1dCBiaW5kaW5nc1xuICAgIGFsbE90aGVySW5wdXRzLmZvckVhY2goKGlucHV0OiB0LkJvdW5kQXR0cmlidXRlKSA9PiB7XG4gICAgICBjb25zdCBpbnB1dFR5cGUgPSBpbnB1dC50eXBlO1xuICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAvLyBhbmltYXRpb24gYmluZGluZ3MgY2FuIGJlIHByZXNlbnRlZCBpbiB0aGUgZm9sbG93aW5nIGZvcm1hdHM6XG4gICAgICAgIC8vIDEuIFtAYmluZGluZ109XCJmb29FeHBcIlxuICAgICAgICAvLyAyLiBbQGJpbmRpbmddPVwie3ZhbHVlOmZvb0V4cCwgcGFyYW1zOnsuLi59fVwiXG4gICAgICAgIC8vIDMuIFtAYmluZGluZ11cbiAgICAgICAgLy8gNC4gQGJpbmRpbmdcbiAgICAgICAgLy8gQWxsIGZvcm1hdHMgd2lsbCBiZSB2YWxpZCBmb3Igd2hlbiBhIHN5bnRoZXRpYyBiaW5kaW5nIGlzIGNyZWF0ZWQuXG4gICAgICAgIC8vIFRoZSByZWFzb25pbmcgZm9yIHRoaXMgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgc2hvdWxkIGdldCBlYWNoXG4gICAgICAgIC8vIHN5bnRoZXRpYyBiaW5kaW5nIHZhbHVlIGluIHRoZSBvcmRlciBvZiB0aGUgYXJyYXkgdGhhdCB0aGV5IGFyZVxuICAgICAgICAvLyBkZWZpbmVkIGluLi4uXG4gICAgICAgIGNvbnN0IGhhc1ZhbHVlID0gdmFsdWUgaW5zdGFuY2VvZiBMaXRlcmFsUHJpbWl0aXZlID8gISF2YWx1ZS52YWx1ZSA6IHRydWU7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgbmFtZTogcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShpbnB1dC5uYW1lKSxcbiAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgIHZhbHVlOiAoKSA9PiBoYXNWYWx1ZSA/IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkgOiBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgbXVzdCBza2lwIGF0dHJpYnV0ZXMgd2l0aCBhc3NvY2lhdGVkIGkxOG4gY29udGV4dCwgc2luY2UgdGhlc2UgYXR0cmlidXRlcyBhcmUgaGFuZGxlZFxuICAgICAgICAvLyBzZXBhcmF0ZWx5IGFuZCBjb3JyZXNwb25kaW5nIGBpMThuRXhwYCBhbmQgYGkxOG5BcHBseWAgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICAgIGlmIChpbnB1dC5pMThuKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IFthdHRyTmFtZXNwYWNlLCBhdHRyTmFtZV0gPSBzcGxpdE5zTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBpc0F0dHJpYnV0ZUJpbmRpbmcgPSBpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQuc2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZUJpbmRpbmcpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG4gICAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0ck5hbWVzcGFjZSk7XG5cbiAgICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiB0aGVyZSB3YXNuJ3QgYSBzYW5pdGl6YXRpb24gcmVmLCB3ZSBuZWVkIHRvIGFkZFxuICAgICAgICAgICAgICAvLyBhbiBleHRyYSBwYXJhbSBzbyB0aGF0IHdlIGNhbiBwYXNzIGluIHRoZSBuYW1lc3BhY2UuXG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSwgbmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgdGhlIHByb3BlcnRpZXMgc28gdGhhdCB3ZSBjYW4gY2hhaW4gaW50byBhIHNpbmdsZSBmdW5jdGlvbiBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IGF0dHJOYW1lLFxuICAgICAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksIHBhcmFtc1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQXR0cmlidXRlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uICYmIGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKHZhbHVlKSA+IDEpIHtcbiAgICAgICAgICAgICAgLy8gYXR0ci5uYW1lPVwidGV4dHt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBib3VuZFZhbHVlID0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnNbMF0gOiB2YWx1ZTtcbiAgICAgICAgICAgICAgLy8gW2F0dHIubmFtZV09XCJ2YWx1ZVwiIG9yIGF0dHIubmFtZT1cInt7dmFsdWV9fVwiXG4gICAgICAgICAgICAgIC8vIENvbGxlY3QgdGhlIGF0dHJpYnV0ZSBiaW5kaW5ncyBzbyB0aGF0IHRoZXkgY2FuIGJlIGNoYWluZWQgYXQgdGhlIGVuZC5cbiAgICAgICAgICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXR0ck5hbWUsXG4gICAgICAgICAgICAgICAgc291cmNlU3BhbjogaW5wdXQuc291cmNlU3BhbixcbiAgICAgICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJvdW5kVmFsdWUpLCBwYXJhbXNcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsYXNzIHByb3BcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIFIzLmNsYXNzUHJvcCwgKCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBvLmxpdGVyYWwoYXR0ck5hbWUpLCB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpLFxuICAgICAgICAgICAgICAgIC4uLnBhcmFtc1xuICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShlbGVtZW50SW5kZXgsIFIzLnByb3BlcnR5LCBwcm9wZXJ0eUJpbmRpbmdzKTtcbiAgICB9XG5cbiAgICBpZiAoYXR0cmlidXRlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoZWxlbWVudEluZGV4LCBSMy5hdHRyaWJ1dGUsIGF0dHJpYnV0ZUJpbmRpbmdzKTtcbiAgICB9XG5cbiAgICAvLyBUcmF2ZXJzZSBlbGVtZW50IGNoaWxkIG5vZGVzXG4gICAgdC52aXNpdEFsbCh0aGlzLCBlbGVtZW50LmNoaWxkcmVuKTtcblxuICAgIGlmICghaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4gISwgZWxlbWVudEluZGV4LCB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgICAgY29uc3Qgc3BhbiA9IGVsZW1lbnQuZW5kU291cmNlU3BhbiB8fCBlbGVtZW50LnNvdXJjZVNwYW47XG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuRW5kKHNwYW4sIGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuZW5hYmxlQmluZGluZ3MpO1xuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyRW5kIDogUjMuZWxlbWVudEVuZCk7XG4gICAgfVxuICB9XG5cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZSh0ZW1wbGF0ZS5pMThuICEsIHRlbXBsYXRlSW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSB8fCAnJyk7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfSR7dGFnTmFtZSA/ICdfJyArIHRhZ05hbWUgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuXG4gICAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgICAgLy8gaXQgYmFzZWQgb24gdGhlIHBhcmVudCBub2RlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLlxuICAgICAgby5saXRlcmFsKHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWUpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gdGhpcy5nZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgICAgdGVtcGxhdGUuYXR0cmlidXRlcywgdGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzLCB1bmRlZmluZWQsIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMsXG4gICAgICAgIHVuZGVmaW5lZCk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkQXR0cnNUb0NvbnN0cyhhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcmVmcyA9IHRoaXMucHJlcGFyZVJlZnNBcnJheSh0ZW1wbGF0ZS5yZWZlcmVuY2VzKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZFRvQ29uc3RzKHJlZnMpKTtcbiAgICAgIHBhcmFtZXRlcnMucHVzaChvLmltcG9ydEV4cHIoUjMudGVtcGxhdGVSZWZFeHRyYWN0b3IpKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uXG4gICAgY29uc3QgdGVtcGxhdGVWaXNpdG9yID0gbmV3IFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIoXG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLCB0aGlzLl9iaW5kaW5nU2NvcGUsIHRoaXMubGV2ZWwgKyAxLCBjb250ZXh0TmFtZSwgdGhpcy5pMThuLFxuICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZU5hbWUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlciwgdGhpcy5kaXJlY3RpdmVzLCB0aGlzLnBpcGVUeXBlQnlOYW1lLFxuICAgICAgICB0aGlzLnBpcGVzLCB0aGlzLl9uYW1lc3BhY2UsIHRoaXMuZmlsZUJhc2VkSTE4blN1ZmZpeCwgdGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMsXG4gICAgICAgIHRoaXMuX2NvbnN0YW50cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgbmctdGVtcGxhdGUgZWxlbWVudHMuXG4gICAgaWYgKHRlbXBsYXRlLnRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS5pbnB1dHMpO1xuICAgICAgLy8gR2VuZXJhdGUgbGlzdGVuZXJzIGZvciBkaXJlY3RpdmUgb3V0cHV0XG4gICAgICBpZiAodGVtcGxhdGUub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRlbXBsYXRlLm91dHB1dHMubWFwKFxuICAgICAgICAgICAgKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiAoe1xuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBvdXRwdXRBc3Quc291cmNlU3BhbixcbiAgICAgICAgICAgICAgcGFyYW1zOiB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4gISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBub2RlSW5kZXgsIHRleHQuc291cmNlU3BhbiwgZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSxcbiAgICAgICAgICAoKSA9PiB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdUZXh0IG5vZGVzIHNob3VsZCBiZSBpbnRlcnBvbGF0ZWQgYW5kIG5ldmVyIGJvdW5kIGRpcmVjdGx5LicpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuICEsIHRydWUpO1xuICAgIH1cblxuICAgIGNvbnN0IGkxOG4gPSB0aGlzLmkxOG4gITtcbiAgICBjb25zdCB2YXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS52YXJzKTtcbiAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnBsYWNlaG9sZGVycyk7XG5cbiAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgIGNvbnN0IG1lc3NhZ2UgPSBpY3UuaTE4biAhYXMgaTE4bi5NZXNzYWdlO1xuXG4gICAgLy8gd2UgYWx3YXlzIG5lZWQgcG9zdC1wcm9jZXNzaW5nIGZ1bmN0aW9uIGZvciBJQ1VzLCB0byBtYWtlIHN1cmUgdGhhdDpcbiAgICAvLyAtIGFsbCBwbGFjZWhvbGRlcnMgaW4gYSBmb3JtIG9mIHtQTEFDRUhPTERFUn0gYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyAobm90ZTpcbiAgICAvLyBgZ29vZy5nZXRNc2dgIGRvZXMgbm90IHByb2Nlc3MgSUNVcyBhbmQgdXNlcyB0aGUgYHtQTEFDRUhPTERFUn1gIGZvcm1hdCBmb3IgcGxhY2Vob2xkZXJzXG4gICAgLy8gaW5zaWRlIElDVXMpXG4gICAgLy8gLSBhbGwgSUNVIHZhcnMgKHN1Y2ggYXMgYFZBUl9TRUxFQ1RgIG9yIGBWQVJfUExVUkFMYCkgYXJlIHJlcGxhY2VkIHdpdGggY29ycmVjdCB2YWx1ZXNcbiAgICBjb25zdCB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IHsuLi52YXJzLCAuLi5wbGFjZWhvbGRlcnN9O1xuICAgICAgY29uc3QgZm9ybWF0dGVkID0gaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMocGFyYW1zLCAvKiB1c2VDYW1lbENhc2UgKi8gZmFsc2UpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgW3JhdywgbWFwTGl0ZXJhbChmb3JtYXR0ZWQsIHRydWUpXSk7XG4gICAgfTtcblxuICAgIC8vIGluIGNhc2UgdGhlIHdob2xlIGkxOG4gbWVzc2FnZSBpcyBhIHNpbmdsZSBJQ1UgLSB3ZSBkbyBub3QgbmVlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHNlcGFyYXRlIHRvcC1sZXZlbCB0cmFuc2xhdGlvbiwgd2UgY2FuIHVzZSB0aGUgcm9vdCByZWYgaW5zdGVhZFxuICAgIC8vIGFuZCBtYWtlIHRoaXMgSUNVIGEgdG9wLWxldmVsIHRyYW5zbGF0aW9uXG4gICAgLy8gbm90ZTogSUNVIHBsYWNlaG9sZGVycyBhcmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgdmFsdWVzIGluIGBpMThuUG9zdHByb2Nlc3NgIGZ1bmN0aW9uXG4gICAgLy8gc2VwYXJhdGVseSwgc28gd2UgZG8gbm90IHBhc3MgcGxhY2Vob2xkZXJzIGludG8gYGkxOG5UcmFuc2xhdGVgIGZ1bmN0aW9uLlxuICAgIGlmIChpc1NpbmdsZUkxOG5JY3UoaTE4bi5tZXRhKSkge1xuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgaTE4bi5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICAgIGNvbnN0IHJlZiA9XG4gICAgICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIC8qIHBsYWNlaG9sZGVycyAqLyB7fSwgLyogcmVmICovIHVuZGVmaW5lZCwgdHJhbnNmb3JtRm4pO1xuICAgICAgaTE4bi5hcHBlbmRJY3UoaWN1RnJvbUkxOG5NZXNzYWdlKG1lc3NhZ2UpLm5hbWUsIHJlZik7XG4gICAgfVxuXG4gICAgaWYgKGluaXRXYXNJbnZva2VkKSB7XG4gICAgICB0aGlzLmkxOG5FbmQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZURhdGFTbG90KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7IH1cblxuICBnZXRDb25zdENvdW50KCkgeyByZXR1cm4gdGhpcy5fZGF0YUluZGV4OyB9XG5cbiAgZ2V0VmFyQ291bnQoKSB7IHJldHVybiB0aGlzLl9wdXJlRnVuY3Rpb25TbG90czsgfVxuXG4gIGdldENvbnN0cygpIHsgcmV0dXJuIHRoaXMuX2NvbnN0YW50czsgfVxuXG4gIGdldE5nQ29udGVudFNlbGVjdG9ycygpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoID9cbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbCh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkgOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBiaW5kaW5nQ29udGV4dCgpIHsgcmV0dXJuIGAke3RoaXMuX2JpbmRpbmdDb250ZXh0Kyt9YDsgfVxuXG4gIHByaXZhdGUgdGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKFxuICAgICAgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBhdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdKSB7XG4gICAgY29uc3QgcHJvcGVydHlCaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGlucHV0ID0+IHtcbiAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIHQuQm91bmRBdHRyaWJ1dGUpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG5cbiAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgbmFtZTogaW5wdXQubmFtZSxcbiAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZSh0ZW1wbGF0ZUluZGV4LCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5ncyk7XG4gICAgfVxuICB9XG5cbiAgLy8gQmluZGluZ3MgbXVzdCBvbmx5IGJlIHJlc29sdmVkIGFmdGVyIGFsbCBsb2NhbCByZWZzIGhhdmUgYmVlbiB2aXNpdGVkLCBzbyBhbGxcbiAgLy8gaW5zdHJ1Y3Rpb25zIGFyZSBxdWV1ZWQgaW4gY2FsbGJhY2tzIHRoYXQgZXhlY3V0ZSBvbmNlIHRoZSBpbml0aWFsIHBhc3MgaGFzIGNvbXBsZXRlZC5cbiAgLy8gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndCBiZSBhYmxlIHRvIHN1cHBvcnQgbG9jYWwgcmVmcyB0aGF0IGFyZSBkZWZpbmVkIGFmdGVyIHRoZWlyXG4gIC8vIGJpbmRpbmdzLiBlLmcuIHt7IGZvbyB9fSA8ZGl2ICNmb28+PC9kaXY+XG4gIHByaXZhdGUgaW5zdHJ1Y3Rpb25GbihcbiAgICAgIGZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSwgcHJlcGVuZDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgZm5zW3ByZXBlbmQgPyAndW5zaGlmdCcgOiAncHVzaCddKCgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IEFycmF5LmlzQXJyYXkocGFyYW1zT3JGbikgPyBwYXJhbXNPckZuIDogcGFyYW1zT3JGbigpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGVsZW1lbnRJbmRleDogbnVtYmVyLCBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9ufG51bGwpIHtcbiAgICBsZXQgYWxsb2NhdGVCaW5kaW5nU2xvdHMgPSAwO1xuICAgIGlmIChpbnN0cnVjdGlvbikge1xuICAgICAgY29uc3QgY2FsbHM6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICAgIGluc3RydWN0aW9uLmNhbGxzLmZvckVhY2goY2FsbCA9PiB7XG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzICs9IGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICAgIGNhbGxzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZVNwYW46IGNhbGwuc291cmNlU3BhbixcbiAgICAgICAgICB2YWx1ZTogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxcbiAgICAgICAgICAgICAgICAucGFyYW1zKFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiAoY2FsbC5zdXBwb3J0c0ludGVycG9sYXRpb24gJiYgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpKSBhcyBvLkV4cHJlc3Npb25bXTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBjYWxscyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kPzogYm9vbGVhbikge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl9jcmVhdGlvbkNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSwgcHJlcGVuZCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihyZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGNhbGxzOiB7XG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuIHwgbnVsbCxcbiAgICBwYXJhbXM6ICgpID0+IG8uRXhwcmVzc2lvbltdXG4gIH1bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBjYWxscy5sZW5ndGggPyBjYWxsc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcbiAgICB0aGlzLl9jcmVhdGlvbkNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMubWFwKGNhbGwgPT4gY2FsbC5wYXJhbXMoKSksIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuYWRkQWR2YW5jZUluc3RydWN0aW9uSWZOZWNlc3Nhcnkobm9kZUluZGV4LCBzcGFuKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbik7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIHVwZGF0ZUluc3RydWN0aW9uQ2hhaW4oXG4gICAgICByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSkge1xuICAgIGNvbnN0IHNwYW4gPSBiaW5kaW5ncy5sZW5ndGggPyBiaW5kaW5nc1swXS5zb3VyY2VTcGFuIDogbnVsbDtcblxuICAgIHRoaXMuX3VwZGF0ZUNvZGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCBjYWxscyA9IGJpbmRpbmdzLm1hcChwcm9wZXJ0eSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcGVydHkudmFsdWUoKTtcbiAgICAgICAgY29uc3QgZm5QYXJhbXMgPSBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlIDogW3ZhbHVlXTtcbiAgICAgICAgaWYgKHByb3BlcnR5LnBhcmFtcykge1xuICAgICAgICAgIGZuUGFyYW1zLnB1c2goLi4ucHJvcGVydHkucGFyYW1zKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydHkubmFtZSkge1xuICAgICAgICAgIC8vIFdlIHdhbnQgdGhlIHByb3BlcnR5IG5hbWUgdG8gYWx3YXlzIGJlIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXJhbWV0ZXIuXG4gICAgICAgICAgZm5QYXJhbXMudW5zaGlmdChvLmxpdGVyYWwocHJvcGVydHkubmFtZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmblBhcmFtcztcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gY2hhaW5lZEluc3RydWN0aW9uKHJlZmVyZW5jZSwgY2FsbHMsIHNwYW4pLnRvU3RtdCgpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBiaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10pIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KFxuICAgICAgICBub2RlSW5kZXgsIGJpbmRpbmdzLmxlbmd0aCA/IGJpbmRpbmdzWzBdLnNvdXJjZVNwYW4gOiBudWxsKTtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW4ocmVmZXJlbmNlLCBiaW5kaW5ncyk7XG4gIH1cblxuICBwcml2YXRlIGFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCkge1xuICAgIGlmIChub2RlSW5kZXggIT09IHRoaXMuX2N1cnJlbnRJbmRleCkge1xuICAgICAgY29uc3QgZGVsdGEgPSBub2RlSW5kZXggLSB0aGlzLl9jdXJyZW50SW5kZXg7XG5cbiAgICAgIGlmIChkZWx0YSA8IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhZHZhbmNlIGluc3RydWN0aW9uIGNhbiBvbmx5IGdvIGZvcndhcmRzJyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5hZHZhbmNlLCBbby5saXRlcmFsKGRlbHRhKV0pO1xuICAgICAgdGhpcy5fY3VycmVudEluZGV4ID0gbm9kZUluZGV4O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90czogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvcmlnaW5hbFNsb3RzID0gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gbnVtU2xvdHM7XG4gICAgcmV0dXJuIG9yaWdpbmFsU2xvdHM7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlOiBBU1R8bnVsbCkge1xuICAgIHRoaXMuX2JpbmRpbmdTbG90cyArPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9ucy5sZW5ndGggOiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYW4gZXhwcmVzc2lvbiB0aGF0IHJlZmVycyB0byB0aGUgaW1wbGljaXQgcmVjZWl2ZXIuIFRoZSBpbXBsaWNpdFxuICAgKiByZWNlaXZlciBpcyBhbHdheXMgdGhlIHJvb3QgbGV2ZWwgY29udGV4dC5cbiAgICovXG4gIHByaXZhdGUgZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKTogby5SZWFkVmFyRXhwciB7XG4gICAgaWYgKHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByKSB7XG4gICAgICByZXR1cm4gdGhpcy5faW1wbGljaXRSZWNlaXZlckV4cHI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByID0gdGhpcy5sZXZlbCA9PT0gMCA/XG4gICAgICAgIG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSA6XG4gICAgICAgIHRoaXMuX2JpbmRpbmdTY29wZS5nZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gIH1cblxuICBwcml2YXRlIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWU6IEFTVCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgY29udmVydGVkUHJvcGVydHlCaW5kaW5nID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgdGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpLCBCaW5kaW5nRm9ybS5UcnlTaW1wbGUsXG4gICAgICAgICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uY29udmVydGVkUHJvcGVydHlCaW5kaW5nLnN0bXRzKTtcbiAgICByZXR1cm4gdmFsRXhwcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGEgbGlzdCBvZiBhcmd1bWVudCBleHByZXNzaW9ucyB0byBwYXNzIHRvIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBleHByZXNzaW9uLiBBbHNvIHVwZGF0ZXNcbiAgICogdGhlIHRlbXAgdmFyaWFibGVzIHN0YXRlIHdpdGggdGVtcCB2YXJpYWJsZXMgdGhhdCB3ZXJlIGlkZW50aWZpZWQgYXMgbmVlZGluZyB0byBiZSBjcmVhdGVkXG4gICAqIHdoaWxlIHZpc2l0aW5nIHRoZSBhcmd1bWVudHMuXG4gICAqIEBwYXJhbSB2YWx1ZSBUaGUgb3JpZ2luYWwgZXhwcmVzc2lvbiB3ZSB3aWxsIGJlIHJlc29sdmluZyBhbiBhcmd1bWVudHMgbGlzdCBmcm9tLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZTogQVNUKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IHthcmdzLCBzdG10c30gPVxuICAgICAgICBjb252ZXJ0VXBkYXRlQXJndW1lbnRzKHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSk7XG5cbiAgICB0aGlzLl90ZW1wVmFyaWFibGVzLnB1c2goLi4uc3RtdHMpO1xuICAgIHJldHVybiBhcmdzO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaERpcmVjdGl2ZXMoZWxlbWVudE5hbWU6IHN0cmluZywgZWxPclRwbDogdC5FbGVtZW50fHQuVGVtcGxhdGUpIHtcbiAgICBpZiAodGhpcy5kaXJlY3RpdmVNYXRjaGVyKSB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKGVsZW1lbnROYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBQUk9KRUNUX0FTLCBzZWxlY3RvcixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgIHJlbmRlckF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdLCBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sXG4gICAgICBzdHlsZXM/OiBTdHlsaW5nQnVpbGRlciwgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10sXG4gICAgICBpMThuQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCBuZ1Byb2plY3RBc0F0dHI6IHQuVGV4dEF0dHJpYnV0ZXx1bmRlZmluZWQ7XG5cbiAgICByZW5kZXJBdHRyaWJ1dGVzLmZvckVhY2goKGF0dHI6IHQuVGV4dEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgbmdQcm9qZWN0QXNBdHRyID0gYXR0cjtcbiAgICAgIH1cbiAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhhdHRyLm5hbWUpLCBhc0xpdGVyYWwoYXR0ci52YWx1ZSkpO1xuICAgIH0pO1xuXG4gICAgLy8gS2VlcCBuZ1Byb2plY3RBcyBuZXh0IHRvIHRoZSBvdGhlciBuYW1lLCB2YWx1ZSBwYWlycyBzbyB3ZSBjYW4gdmVyaWZ5IHRoYXQgd2UgbWF0Y2hcbiAgICAvLyBuZ1Byb2plY3RBcyBtYXJrZXIgaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHNsb3QuXG4gICAgaWYgKG5nUHJvamVjdEFzQXR0cikge1xuICAgICAgYXR0ckV4cHJzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKG5nUHJvamVjdEFzQXR0cikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZEF0dHJFeHByKGtleTogc3RyaW5nIHwgbnVtYmVyLCB2YWx1ZT86IG8uRXhwcmVzc2lvbik6IHZvaWQge1xuICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghYWxyZWFkeVNlZW4uaGFzKGtleSkpIHtcbiAgICAgICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoa2V5KSk7XG4gICAgICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJiBhdHRyRXhwcnMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgYWxyZWFkeVNlZW4uYWRkKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChrZXkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpdCdzIGltcG9ydGFudCB0aGF0IHRoaXMgb2NjdXJzIGJlZm9yZSBCSU5ESU5HUyBhbmQgVEVNUExBVEUgYmVjYXVzZSBvbmNlIGBlbGVtZW50U3RhcnRgXG4gICAgLy8gY29tZXMgYWNyb3NzIHRoZSBCSU5ESU5HUyBvciBURU1QTEFURSBtYXJrZXJzIHRoZW4gaXQgd2lsbCBjb250aW51ZSByZWFkaW5nIGVhY2ggdmFsdWUgYXNcbiAgICAvLyBhcyBzaW5nbGUgcHJvcGVydHkgdmFsdWUgY2VsbCBieSBjZWxsLlxuICAgIGlmIChzdHlsZXMpIHtcbiAgICAgIHN0eWxlcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0ckV4cHJzKTtcbiAgICB9XG5cbiAgICBpZiAoaW5wdXRzLmxlbmd0aCB8fCBvdXRwdXRzLmxlbmd0aCkge1xuICAgICAgY29uc3QgYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMgPSBhdHRyRXhwcnMubGVuZ3RoO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1tpXTtcbiAgICAgICAgLy8gV2UgZG9uJ3Qgd2FudCB0aGUgYW5pbWF0aW9uIGFuZCBhdHRyaWJ1dGUgYmluZGluZ3MgaW4gdGhlXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMgYXJyYXkgc2luY2UgdGhleSBhcmVuJ3QgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgICAgICBpZiAoaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uICYmIGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgIGFkZEF0dHJFeHByKGlucHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2ldO1xuICAgICAgICBpZiAob3V0cHV0LnR5cGUgIT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihvdXRwdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhIGNoZWFwIHdheSBvZiBhZGRpbmcgdGhlIG1hcmtlciBvbmx5IGFmdGVyIGFsbCB0aGUgaW5wdXQvb3V0cHV0XG4gICAgICAvLyB2YWx1ZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIChieSBub3QgaW5jbHVkaW5nIHRoZSBhbmltYXRpb24gb25lcykgYW5kIGFkZGVkXG4gICAgICAvLyB0byB0aGUgZXhwcmVzc2lvbnMuIFRoZSBtYXJrZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaXQgdGVsbHMgdGhlIHJ1bnRpbWVcbiAgICAgIC8vIGNvZGUgdGhhdCB0aGlzIGlzIHdoZXJlIGF0dHJpYnV0ZXMgd2l0aG91dCB2YWx1ZXMgc3RhcnQuLi5cbiAgICAgIGlmIChhdHRyRXhwcnMubGVuZ3RoICE9PSBhdHRyc0xlbmd0aEJlZm9yZUlucHV0cykge1xuICAgICAgICBhdHRyRXhwcnMuc3BsaWNlKGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzLCAwLCBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVtcGxhdGVBdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSkpO1xuICAgICAgdGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBpMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIGFkZFRvQ29uc3RzKGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbik6IG8uTGl0ZXJhbEV4cHIge1xuICAgIGlmIChvLmlzTnVsbChleHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIC8vIFRyeSB0byByZXVzZSBhIGxpdGVyYWwgdGhhdCdzIGFscmVhZHkgaW4gdGhlIGFycmF5LCBpZiBwb3NzaWJsZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NvbnN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuX2NvbnN0YW50c1tpXS5pc0VxdWl2YWxlbnQoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsKHRoaXMuX2NvbnN0YW50cy5wdXNoKGV4cHJlc3Npb24pIC0gMSk7XG4gIH1cblxuICBwcml2YXRlIGFkZEF0dHJzVG9Db25zdHMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDogby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzQXJyYXkocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiBhc0xpdGVyYWwocmVmc1BhcmFtKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSAhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG4gICAgICByZXR1cm4gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKG91dHB1dEFzdCwgaGFuZGxlck5hbWUsIHNjb3BlKTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWYWx1ZUNvbnZlcnRlciBleHRlbmRzIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyIHtcbiAgcHJpdmF0ZSBfcGlwZUJpbmRFeHByczogRnVuY3Rpb25DYWxsW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIHByaXZhdGUgYWxsb2NhdGVTbG90OiAoKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIsXG4gICAgICBwcml2YXRlIGRlZmluZVBpcGU6XG4gICAgICAgICAgKG5hbWU6IHN0cmluZywgbG9jYWxOYW1lOiBzdHJpbmcsIHNsb3Q6IG51bWJlciwgdmFsdWU6IG8uRXhwcmVzc2lvbikgPT4gdm9pZCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICAvLyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lclxuICB2aXNpdFBpcGUocGlwZTogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgLy8gQWxsb2NhdGUgYSBzbG90IHRvIGNyZWF0ZSB0aGUgcGlwZVxuICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlU2xvdCgpO1xuICAgIGNvbnN0IHNsb3RQc2V1ZG9Mb2NhbCA9IGBQSVBFOiR7c2xvdH1gO1xuICAgIC8vIEFsbG9jYXRlIG9uZSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgb25lIHNsb3QgcGVyIHBpcGUgYXJndW1lbnRcbiAgICBjb25zdCBwdXJlRnVuY3Rpb25TbG90ID0gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKDIgKyBwaXBlLmFyZ3MubGVuZ3RoKTtcbiAgICBjb25zdCB0YXJnZXQgPSBuZXcgUHJvcGVydHlSZWFkKFxuICAgICAgICBwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgbmV3IEltcGxpY2l0UmVjZWl2ZXIocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4pLFxuICAgICAgICBzbG90UHNldWRvTG9jYWwpO1xuICAgIGNvbnN0IHtpZGVudGlmaWVyLCBpc1Zhckxlbmd0aH0gPSBwaXBlQmluZGluZ0NhbGxJbmZvKHBpcGUuYXJncyk7XG4gICAgdGhpcy5kZWZpbmVQaXBlKHBpcGUubmFtZSwgc2xvdFBzZXVkb0xvY2FsLCBzbG90LCBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikpO1xuICAgIGNvbnN0IGFyZ3M6IEFTVFtdID0gW3BpcGUuZXhwLCAuLi5waXBlLmFyZ3NdO1xuICAgIGNvbnN0IGNvbnZlcnRlZEFyZ3M6IEFTVFtdID0gaXNWYXJMZW5ndGggP1xuICAgICAgICB0aGlzLnZpc2l0QWxsKFtuZXcgTGl0ZXJhbEFycmF5KHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBhcmdzKV0pIDpcbiAgICAgICAgdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHRhcmdldCwgW1xuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHNsb3QpLFxuICAgICAgbmV3IExpdGVyYWxQcmltaXRpdmUocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBGdW5jdGlvbkNhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKFxuICAgICAgICBhcnJheS5zcGFuLCBhcnJheS5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKGFycmF5LmV4cHJlc3Npb25zKSwgdmFsdWVzID0+IHtcbiAgICAgICAgICAvLyBJZiB0aGUgbGl0ZXJhbCBoYXMgY2FsY3VsYXRlZCAobm9uLWxpdGVyYWwpIGVsZW1lbnRzIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgICAgIC8vIHZhbHVlcy5cbiAgICAgICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsQXJyKHZhbHVlcyk7XG4gICAgICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCBtYXAuc291cmNlU3BhbiwgdGhpcy52aXNpdEFsbChtYXAudmFsdWVzKSwgdmFsdWVzID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgIHRyYW5zZm9ybSBpdCBpbnRvXG4gICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAvLyB2YWx1ZXMuXG4gICAgICBjb25zdCBsaXRlcmFsID0gby5saXRlcmFsTWFwKHZhbHVlcy5tYXAoXG4gICAgICAgICAgKHZhbHVlLCBpbmRleCkgPT4gKHtrZXk6IG1hcC5rZXlzW2luZGV4XS5rZXksIHZhbHVlLCBxdW90ZWQ6IG1hcC5rZXlzW2luZGV4XS5xdW90ZWR9KSkpO1xuICAgICAgcmV0dXJuIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBjb25zdCB7aWRlbnRpZmllciwgaXNWYXJMZW5ndGh9ID0gcHVyZUZ1bmN0aW9uQ2FsbEluZm8obGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuXG4gIC8vIExpdGVyYWwgZmFjdG9yaWVzIGFyZSBwdXJlIGZ1bmN0aW9ucyB0aGF0IG9ubHkgbmVlZCB0byBiZSByZS1pbnZva2VkIHdoZW4gdGhlIHBhcmFtZXRlcnNcbiAgLy8gY2hhbmdlLlxuICBjb25zdCBhcmdzID0gW28ubGl0ZXJhbChzdGFydFNsb3QpLCBsaXRlcmFsRmFjdG9yeV07XG5cbiAgaWYgKGlzVmFyTGVuZ3RoKSB7XG4gICAgYXJncy5wdXNoKG8ubGl0ZXJhbEFycihsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cykpO1xuICB9IGVsc2Uge1xuICAgIGFyZ3MucHVzaCguLi5saXRlcmFsRmFjdG9yeUFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gby5pbXBvcnRFeHByKGlkZW50aWZpZXIpLmNhbGxGbihhcmdzKTtcbn1cblxuLyoqXG4gKiBHZXRzIGFuIGFycmF5IG9mIGxpdGVyYWxzIHRoYXQgY2FuIGJlIGFkZGVkIHRvIGFuIGV4cHJlc3Npb25cbiAqIHRvIHJlcHJlc2VudCB0aGUgbmFtZSBhbmQgbmFtZXNwYWNlIG9mIGFuIGF0dHJpYnV0ZS4gRS5nLlxuICogYDp4bGluazpocmVmYCB0dXJucyBpbnRvIGBbQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSwgJ3hsaW5rJywgJ2hyZWYnXWAuXG4gKlxuICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYXR0cmlidXRlLCBpbmNsdWRpbmcgdGhlIG5hbWVzcGFjZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlTmFtZUxpdGVyYWxzKG5hbWU6IHN0cmluZyk6IG8uTGl0ZXJhbEV4cHJbXSB7XG4gIGNvbnN0IFthdHRyaWJ1dGVOYW1lc3BhY2UsIGF0dHJpYnV0ZU5hbWVdID0gc3BsaXROc05hbWUobmFtZSk7XG4gIGNvbnN0IG5hbWVMaXRlcmFsID0gby5saXRlcmFsKGF0dHJpYnV0ZU5hbWUpO1xuXG4gIGlmIChhdHRyaWJ1dGVOYW1lc3BhY2UpIHtcbiAgICByZXR1cm4gW1xuICAgICAgby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLk5hbWVzcGFjZVVSSSksIG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lc3BhY2UpLCBuYW1lTGl0ZXJhbFxuICAgIF07XG4gIH1cblxuICByZXR1cm4gW25hbWVMaXRlcmFsXTtcbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB3aGljaCBpcyBleGVjdXRlZCB3aGVuZXZlciBhIHZhcmlhYmxlIGlzIHJlZmVyZW5jZWQgZm9yIHRoZSBmaXJzdCB0aW1lIGluIGEgZ2l2ZW5cbiAqIHNjb3BlLlxuICpcbiAqIEl0IGlzIGV4cGVjdGVkIHRoYXQgdGhlIGZ1bmN0aW9uIGNyZWF0ZXMgdGhlIGBjb25zdCBsb2NhbE5hbWUgPSBleHByZXNzaW9uYDsgc3RhdGVtZW50LlxuICovXG5leHBvcnQgdHlwZSBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjayA9IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IG8uU3RhdGVtZW50W107XG5cbi8qKiBUaGUgcHJlZml4IHVzZWQgdG8gZ2V0IGEgc2hhcmVkIGNvbnRleHQgaW4gQmluZGluZ1Njb3BlJ3MgbWFwLiAqL1xuY29uc3QgU0hBUkVEX0NPTlRFWFRfS0VZID0gJyQkc2hhcmVkX2N0eCQkJztcblxuLyoqXG4gKiBUaGlzIGlzIHVzZWQgd2hlbiBvbmUgcmVmZXJzIHRvIHZhcmlhYmxlIHN1Y2ggYXM6ICdsZXQgYWJjID0gbmV4dENvbnRleHQoMikuJGltcGxpY2l0YC5cbiAqIC0ga2V5IHRvIHRoZSBtYXAgaXMgdGhlIHN0cmluZyBsaXRlcmFsIGBcImFiY1wiYC5cbiAqIC0gdmFsdWUgYHJldHJpZXZhbExldmVsYCBpcyB0aGUgbGV2ZWwgZnJvbSB3aGljaCB0aGlzIHZhbHVlIGNhbiBiZSByZXRyaWV2ZWQsIHdoaWNoIGlzIDIgbGV2ZWxzXG4gKiB1cCBpbiBleGFtcGxlLlxuICogLSB2YWx1ZSBgbGhzYCBpcyB0aGUgbGVmdCBoYW5kIHNpZGUgd2hpY2ggaXMgYW4gQVNUIHJlcHJlc2VudGluZyBgYWJjYC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVMb2NhbENhbGxiYWNrYCBpcyBhIGNhbGxiYWNrIHRoYXQgaXMgaW52b2tlZCB3aGVuIGRlY2xhcmluZyB0aGUgbG9jYWwuXG4gKiAtIHZhbHVlIGBkZWNsYXJlYCBpcyB0cnVlIGlmIHRoaXMgdmFsdWUgbmVlZHMgdG8gYmUgZGVjbGFyZWQuXG4gKiAtIHZhbHVlIGBsb2NhbFJlZmAgaXMgdHJ1ZSBpZiB3ZSBhcmUgc3RvcmluZyBhIGxvY2FsIHJlZmVyZW5jZVxuICogLSB2YWx1ZSBgcHJpb3JpdHlgIGRpY3RhdGVzIHRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyIGRlY2xhcmF0aW9uIGNvbXBhcmVkXG4gKiB0byBvdGhlciB2YXIgZGVjbGFyYXRpb25zIG9uIHRoZSBzYW1lIHJldHJpZXZhbCBsZXZlbC4gRm9yIGV4YW1wbGUsIGlmIHRoZXJlIGlzIGFcbiAqIGNvbnRleHQgdmFyaWFibGUgYW5kIGEgbG9jYWwgcmVmIGFjY2Vzc2luZyB0aGUgc2FtZSBwYXJlbnQgdmlldywgdGhlIGNvbnRleHQgdmFyXG4gKiBkZWNsYXJhdGlvbiBzaG91bGQgYWx3YXlzIGNvbWUgYmVmb3JlIHRoZSBsb2NhbCByZWYgZGVjbGFyYXRpb24uXG4gKi9cbnR5cGUgQmluZGluZ0RhdGEgPSB7XG4gIHJldHJpZXZhbExldmVsOiBudW1iZXI7IGxoczogby5FeHByZXNzaW9uOyBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrO1xuICBkZWNsYXJlOiBib29sZWFuO1xuICBwcmlvcml0eTogbnVtYmVyO1xuICBsb2NhbFJlZjogYm9vbGVhbjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyBfUk9PVF9TQ09QRTogQmluZGluZ1Njb3BlO1xuXG4gIHN0YXRpYyBnZXQgUk9PVF9TQ09QRSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICghQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFKSB7XG4gICAgICBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KDAsICckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG4gICAgfVxuICAgIHJldHVybiBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEU7XG4gIH1cblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5LFxuICAgICAgICAgICAgbG9jYWxSZWY6IHZhbHVlLmxvY2FsUmVmXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwsIHZhbHVlLmxvY2FsUmVmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5FeHByZXNzaW9uLFxuICAgICAgcHJpb3JpdHk6IG51bWJlciA9IERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCxcbiAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrPzogRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2ssIGxvY2FsUmVmPzogdHJ1ZSk6IEJpbmRpbmdTY29wZSB7XG4gICAgaWYgKHRoaXMubWFwLmhhcyhuYW1lKSkge1xuICAgICAgaWYgKGxvY2FsUmVmKSB7XG4gICAgICAgIC8vIERvIG5vdCB0aHJvdyBhbiBlcnJvciBpZiBpdCdzIGEgbG9jYWwgcmVmIGFuZCBkbyBub3QgdXBkYXRlIGV4aXN0aW5nIHZhbHVlLFxuICAgICAgICAvLyBzbyB0aGUgZmlyc3QgZGVmaW5lZCByZWYgaXMgYWx3YXlzIHJldHVybmVkLlxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVycm9yKGBUaGUgbmFtZSAke25hbWV9IGlzIGFscmVhZHkgZGVmaW5lZCBpbiBzY29wZSB0byBiZSAke3RoaXMubWFwLmdldChuYW1lKX1gKTtcbiAgICB9XG4gICAgdGhpcy5tYXAuc2V0KG5hbWUsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICBwcmlvcml0eTogcHJpb3JpdHksXG4gICAgICBsb2NhbFJlZjogbG9jYWxSZWYgfHwgZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogKG8uRXhwcmVzc2lvbnxudWxsKSB7IHJldHVybiB0aGlzLmdldChuYW1lKTsgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSAhLmRlY2xhcmUgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIG5lc3RlZFNjb3BlKGxldmVsOiBudW1iZXIpOiBCaW5kaW5nU2NvcGUge1xuICAgIGNvbnN0IG5ld1Njb3BlID0gbmV3IEJpbmRpbmdTY29wZShsZXZlbCwgdGhpcyk7XG4gICAgaWYgKGxldmVsID4gMCkgbmV3U2NvcGUuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICAgIHJldHVybiBuZXdTY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIG9yIGNyZWF0ZXMgYSBzaGFyZWQgY29udGV4dCB2YXJpYWJsZSBhbmQgcmV0dXJucyBpdHMgZXhwcmVzc2lvbi4gTm90ZSB0aGF0XG4gICAqIHRoaXMgZG9lcyBub3QgbWVhbiB0aGF0IHRoZSBzaGFyZWQgdmFyaWFibGUgd2lsbCBiZSBkZWNsYXJlZC4gVmFyaWFibGVzIGluIHRoZVxuICAgKiBiaW5kaW5nIHNjb3BlIHdpbGwgYmUgb25seSBkZWNsYXJlZCBpZiB0aGV5IGFyZSB1c2VkLlxuICAgKi9cbiAgZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBiaW5kaW5nS2V5ID0gU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWw7XG4gICAgaWYgKCF0aGlzLm1hcC5oYXMoYmluZGluZ0tleSkpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsKTtcbiAgICB9XG4gICAgLy8gU2hhcmVkIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhbHdheXMgZ2VuZXJhdGVkIGFzIFwiUmVhZFZhckV4cHJcIi5cbiAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGJpbmRpbmdLZXkpICEubGhzIGFzIG8uUmVhZFZhckV4cHI7XG4gIH1cblxuICBnZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbDogbnVtYmVyKTogby5SZWFkVmFyRXhwcnxudWxsIHtcbiAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwpO1xuICAgIC8vIFNoYXJlZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYWx3YXlzIGdlbmVyYXRlZCBhcyBcIlJlYWRWYXJFeHByXCIuXG4gICAgcmV0dXJuIHNoYXJlZEN0eE9iaiAmJiBzaGFyZWRDdHhPYmouZGVjbGFyZSA/IHNoYXJlZEN0eE9iai5saHMgYXMgby5SZWFkVmFyRXhwciA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgICAgbG9jYWxSZWY6IGZhbHNlXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDAsIGZhbHNlKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKSB7XG4gICAgLy8gV2Ugd2FudCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gbGlzdGVuZXIgZm5zIGlmOlxuICAgIC8vIDEgLSB3ZSBhcmUgYWNjZXNzaW5nIGEgdmFsdWUgaW4gYSBwYXJlbnQgdmlldywgd2hpY2ggcmVxdWlyZXMgd2Fsa2luZyB0aGUgdmlldyB0cmVlIHJhdGhlclxuICAgIC8vIHRoYW4gdXNpbmcgdGhlIGN0eCBhcmcuIEluIHRoaXMgY2FzZSwgdGhlIHJldHJpZXZhbCBhbmQgYmluZGluZyBsZXZlbCB3aWxsIGJlIGRpZmZlcmVudC5cbiAgICAvLyAyIC0gd2UgYXJlIGxvb2tpbmcgdXAgYSBsb2NhbCByZWYsIHdoaWNoIHJlcXVpcmVzIHJlc3RvcmluZyB0aGUgdmlldyB3aGVyZSB0aGUgbG9jYWxcbiAgICAvLyByZWYgaXMgc3RvcmVkXG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgKHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwgfHwgbG9jYWxSZWZMb29rdXApKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUgPSBvLnZhcmlhYmxlKHRoaXMucGFyZW50ICEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJlc3RvcmVWaWV3KCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7IHJldHVybiB0aGlzLnBhcmVudCAmJiB0aGlzLnBhcmVudC5iaW5kaW5nTGV2ZWwgPT09IHRoaXMuYmluZGluZ0xldmVsOyB9XG5cbiAgdmFyaWFibGVEZWNsYXJhdGlvbnMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgbGV0IGN1cnJlbnRDb250ZXh0TGV2ZWwgPSAwO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFwLnZhbHVlcygpKVxuICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgLnJlZHVjZSgoc3RtdHM6IG8uU3RhdGVtZW50W10sIHZhbHVlOiBCaW5kaW5nRGF0YSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgY29uc3QgY3VyclN0bXRzID0gdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICBjdXJyZW50Q29udGV4dExldmVsID0gbGV2ZWxEaWZmO1xuICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsZW1lbnROYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsZW1lbnROYW1lTm9Ocyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IG5hbWVOb05zID0gc3BsaXROc05hbWUobmFtZSlbMV07XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWVOb05zLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBleHByZXNzaW9ucyBvdXQgb2YgYW4gYG5nUHJvamVjdEFzYCBhdHRyaWJ1dGVzXG4gKiB3aGljaCBjYW4gYmUgYWRkZWQgdG8gdGhlIGluc3RydWN0aW9uIHBhcmFtZXRlcnMuXG4gKi9cbmZ1bmN0aW9uIGdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyaWJ1dGU6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihhdHRyaWJ1dGUudmFsdWUpWzBdO1xuICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBhc0xpdGVyYWwocGFyc2VkUjNTZWxlY3RvcildO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHlcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgYXR0cmlidXRlXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGludGVycG9sYXRlZCB0ZXh0LlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBtb2RpZnkgaG93IGEgdGVtcGxhdGUgaXMgcGFyc2VkIGJ5IGBwYXJzZVRlbXBsYXRlKClgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlVGVtcGxhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGNoYXJhY3RlcnMgdGhhdCBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBsZWFkaW5nIHRyaXZpYS5cbiAgICogTGVhZGluZyB0cml2aWEgYXJlIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGltcG9ydGFudCB0byB0aGUgZGV2ZWxvcGVyLCBhbmQgc28gc2hvdWxkIG5vdCBiZVxuICAgKiBpbmNsdWRlZCBpbiBzb3VyY2UtbWFwIHNlZ21lbnRzLiAgQSBjb21tb24gZXhhbXBsZSBpcyB3aGl0ZXNwYWNlLlxuICAgKi9cbiAgbGVhZGluZ1RyaXZpYUNoYXJzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFJlbmRlciBgJGxvY2FsaXplYCBtZXNzYWdlIGlkcyB3aXRoIGFkZGl0aW9uYWwgbGVnYWN5IG1lc3NhZ2UgaWRzLlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBkZWZhdWx0cyB0byBgdHJ1ZWAgYnV0IGluIHRoZSBmdXR1cmUgdGhlIGRlZmF1bCB3aWxsIGJlIGZsaXBwZWQuXG4gICAqXG4gICAqIEZvciBub3cgc2V0IHRoaXMgb3B0aW9uIHRvIGZhbHNlIGlmIHlvdSBoYXZlIG1pZ3JhdGVkIHRoZSB0cmFuc2xhdGlvbiBmaWxlcyB0byB1c2UgdGhlIG5ld1xuICAgKiBgJGxvY2FsaXplYCBtZXNzYWdlIGlkIGZvcm1hdCBhbmQgeW91IGFyZSBub3QgdXNpbmcgY29tcGlsZSB0aW1lIHRyYW5zbGF0aW9uIG1lcmdpbmcuXG4gICAqL1xuICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTpcbiAgICB7ZXJyb3JzPzogUGFyc2VFcnJvcltdLCBub2RlczogdC5Ob2RlW10sIHN0eWxlVXJsczogc3RyaW5nW10sIHN0eWxlczogc3RyaW5nW119IHtcbiAgY29uc3Qge2ludGVycG9sYXRpb25Db25maWcsIHByZXNlcnZlV2hpdGVzcGFjZXMsIGVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXR9ID0gb3B0aW9ucztcbiAgY29uc3QgYmluZGluZ1BhcnNlciA9IG1ha2VCaW5kaW5nUGFyc2VyKGludGVycG9sYXRpb25Db25maWcpO1xuICBjb25zdCBodG1sUGFyc2VyID0gbmV3IEh0bWxQYXJzZXIoKTtcbiAgY29uc3QgcGFyc2VSZXN1bHQgPSBodG1sUGFyc2VyLnBhcnNlKFxuICAgICAgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLFxuICAgICAge2xlYWRpbmdUcml2aWFDaGFyczogTEVBRElOR19UUklWSUFfQ0hBUlMsIC4uLm9wdGlvbnMsIHRva2VuaXplRXhwYW5zaW9uRm9ybXM6IHRydWV9KTtcblxuICBpZiAocGFyc2VSZXN1bHQuZXJyb3JzICYmIHBhcnNlUmVzdWx0LmVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHtlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycywgbm9kZXM6IFtdLCBzdHlsZVVybHM6IFtdLCBzdHlsZXM6IFtdfTtcbiAgfVxuXG4gIGxldCByb290Tm9kZXM6IGh0bWwuTm9kZVtdID0gcGFyc2VSZXN1bHQucm9vdE5vZGVzO1xuXG4gIC8vIHByb2Nlc3MgaTE4biBtZXRhIGluZm9ybWF0aW9uIChzY2FuIGF0dHJpYnV0ZXMsIGdlbmVyYXRlIGlkcylcbiAgLy8gYmVmb3JlIHdlIHJ1biB3aGl0ZXNwYWNlIHJlbW92YWwgcHJvY2VzcywgYmVjYXVzZSBleGlzdGluZyBpMThuXG4gIC8vIGV4dHJhY3Rpb24gcHJvY2VzcyAobmcgeGkxOG4pIHJlbGllcyBvbiBhIHJhdyBjb250ZW50IHRvIGdlbmVyYXRlXG4gIC8vIG1lc3NhZ2UgaWRzXG4gIGNvbnN0IGkxOG5NZXRhVmlzaXRvciA9IG5ldyBJMThuTWV0YVZpc2l0b3IoXG4gICAgICBpbnRlcnBvbGF0aW9uQ29uZmlnLCAvKiBrZWVwSTE4bkF0dHJzICovICFwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdCk7XG4gIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwoaTE4bk1ldGFWaXNpdG9yLCByb290Tm9kZXMpO1xuXG4gIGlmICghcHJlc2VydmVXaGl0ZXNwYWNlcykge1xuICAgIHJvb3ROb2RlcyA9IGh0bWwudmlzaXRBbGwobmV3IFdoaXRlc3BhY2VWaXNpdG9yKCksIHJvb3ROb2Rlcyk7XG5cbiAgICAvLyBydW4gaTE4biBtZXRhIHZpc2l0b3IgYWdhaW4gaW4gY2FzZSB3aGl0ZXNwYWNlcyBhcmUgcmVtb3ZlZCAoYmVjYXVzZSB0aGF0IG1pZ2h0IGFmZmVjdFxuICAgIC8vIGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudCkgYW5kIGZpcnN0IHBhc3MgaW5kaWNhdGVkIHRoYXQgaTE4biBjb250ZW50IGlzIHByZXNlbnQgaW4gYVxuICAgIC8vIHRlbXBsYXRlLiBEdXJpbmcgdGhpcyBwYXNzIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuXG4gICAgLy8gbWltaWMgZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzfSA9IGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgcmV0dXJuIHtub2Rlcywgc3R5bGVVcmxzLCBzdHlsZXN9O1xufVxuXG5jb25zdCBlbGVtZW50UmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbi8qKlxuICogQ29uc3RydWN0IGEgYEJpbmRpbmdQYXJzZXJgIHdpdGggYSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQmluZGluZ1BhcnNlcihcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIobmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIGVsZW1lbnRSZWdpc3RyeSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuXG5pbnRlcmZhY2UgQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uIHtcbiAgbmFtZT86IHN0cmluZztcbiAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGw7XG4gIHZhbHVlOiAoKSA9PiBvLkV4cHJlc3Npb24gfCBvLkV4cHJlc3Npb25bXTtcbiAgcGFyYW1zPzogYW55W107XG59XG5cbi8qKiBOYW1lIG9mIHRoZSBnbG9iYWwgdmFyaWFibGUgdGhhdCBpcyB1c2VkIHRvIGRldGVybWluZSBpZiB3ZSB1c2UgQ2xvc3VyZSB0cmFuc2xhdGlvbnMgb3Igbm90ICovXG5jb25zdCBOR19JMThOX0NMT1NVUkVfTU9ERSA9ICduZ0kxOG5DbG9zdXJlTW9kZSc7XG5cbi8qKlxuICogR2VuZXJhdGUgc3RhdGVtZW50cyB0aGF0IGRlZmluZSBhIGdpdmVuIHRyYW5zbGF0aW9uIG1lc3NhZ2UuXG4gKlxuICogYGBgXG4gKiB2YXIgSTE4Tl8xO1xuICogaWYgKHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlKSB7XG4gKiAgICAgdmFyIE1TR19FWFRFUk5BTF9YWFggPSBnb29nLmdldE1zZyhcbiAqICAgICAgICAgIFwiU29tZSBtZXNzYWdlIHdpdGggeyRpbnRlcnBvbGF0aW9ufSFcIixcbiAqICAgICAgICAgIHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfVxuICogICAgICk7XG4gKiAgICAgSTE4Tl8xID0gTVNHX0VYVEVSTkFMX1hYWDtcbiAqIH1cbiAqIGVsc2Uge1xuICogICAgIEkxOE5fMSA9ICRsb2NhbGl6ZWBTb21lIG1lc3NhZ2Ugd2l0aCAkeydcXHVGRkZEMFxcdUZGRkQnfSFgO1xuICogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIG1lc3NhZ2UgVGhlIG9yaWdpbmFsIGkxOG4gQVNUIG1lc3NhZ2Ugbm9kZVxuICogQHBhcmFtIHZhcmlhYmxlIFRoZSB2YXJpYWJsZSB0aGF0IHdpbGwgYmUgYXNzaWduZWQgdGhlIHRyYW5zbGF0aW9uLCBlLmcuIGBJMThOXzFgLlxuICogQHBhcmFtIGNsb3N1cmVWYXIgVGhlIHZhcmlhYmxlIGZvciBDbG9zdXJlIGBnb29nLmdldE1zZ2AgY2FsbHMsIGUuZy4gYE1TR19FWFRFUk5BTF9YWFhgLlxuICogQHBhcmFtIHBhcmFtcyBPYmplY3QgbWFwcGluZyBwbGFjZWhvbGRlciBuYW1lcyB0byB0aGVpciB2YWx1ZXMgKGUuZy5cbiAqIGB7IFwiaW50ZXJwb2xhdGlvblwiOiBcIlxcdUZGRkQwXFx1RkZGRFwiIH1gKS5cbiAqIEBwYXJhbSB0cmFuc2Zvcm1GbiBPcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgdHJhbnNsYXRpb24gKGUuZy5cbiAqIHBvc3QtcHJvY2Vzc2luZykuXG4gKiBAcmV0dXJucyBBbiBhcnJheSBvZiBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lZCBhIGdpdmVuIHRyYW5zbGF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoXG4gICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCB2YXJpYWJsZTogby5SZWFkVmFyRXhwciwgY2xvc3VyZVZhcjogby5SZWFkVmFyRXhwcixcbiAgICBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LFxuICAgIHRyYW5zZm9ybUZuPzogKHJhdzogby5SZWFkVmFyRXhwcikgPT4gby5FeHByZXNzaW9uKTogby5TdGF0ZW1lbnRbXSB7XG4gIGNvbnN0IHN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXG4gICAgZGVjbGFyZUkxOG5WYXJpYWJsZSh2YXJpYWJsZSksXG4gICAgby5pZlN0bXQoXG4gICAgICAgIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKSwgY3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50cyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGNsb3N1cmVWYXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkxOG5Gb3JtYXRQbGFjZWhvbGRlck5hbWVzKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIHRydWUpKSxcbiAgICAgICAgY3JlYXRlTG9jYWxpemVTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGkxOG5Gb3JtYXRQbGFjZWhvbGRlck5hbWVzKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKSkpLFxuICBdO1xuXG4gIGlmICh0cmFuc2Zvcm1Gbikge1xuICAgIHN0YXRlbWVudHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KHZhcmlhYmxlLnNldCh0cmFuc2Zvcm1Gbih2YXJpYWJsZSkpKSk7XG4gIH1cblxuICByZXR1cm4gc3RhdGVtZW50cztcbn1cblxuLyoqXG4gKiBDcmVhdGUgdGhlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHVzZWQgdG8gZ3VhcmQgdGhlIGNsb3N1cmUgbW9kZSBibG9ja1xuICogSXQgaXMgZXF1aXZhbGVudCB0bzpcbiAqXG4gKiBgYGBcbiAqIHR5cGVvZiBuZ0kxOG5DbG9zdXJlTW9kZSAhPT0gdW5kZWZpbmVkICYmIG5nSTE4bkNsb3N1cmVNb2RlXG4gKiBgYGBcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpOiBvLkJpbmFyeU9wZXJhdG9yRXhwciB7XG4gIHJldHVybiBvLnR5cGVvZkV4cHIoby52YXJpYWJsZShOR19JMThOX0NMT1NVUkVfTU9ERSkpXG4gICAgICAubm90SWRlbnRpY2FsKG8ubGl0ZXJhbCgndW5kZWZpbmVkJywgby5TVFJJTkdfVFlQRSkpXG4gICAgICAuYW5kKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKTtcbn1cbiJdfQ==