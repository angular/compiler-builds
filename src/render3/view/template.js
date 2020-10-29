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
        define("@angular/compiler/src/render3/view/template", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/expression_parser/lexer", "@angular/compiler/src/expression_parser/parser", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_parser", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/interpolation_config", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/output/map_util", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/schema/dom_element_schema_registry", "@angular/compiler/src/selector", "@angular/compiler/src/template_parser/binding_parser", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/r3_template_transform", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/i18n/context", "@angular/compiler/src/render3/view/i18n/get_msg_utils", "@angular/compiler/src/render3/view/i18n/localize_utils", "@angular/compiler/src/render3/view/i18n/meta", "@angular/compiler/src/render3/view/i18n/util", "@angular/compiler/src/render3/view/styling_builder", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTranslationDeclStmts = exports.resolveSanitizationFn = exports.makeBindingParser = exports.parseTemplate = exports.createCssSelector = exports.BindingScope = exports.ValueConverter = exports.TemplateDefinitionBuilder = exports.prepareEventListenerParameters = exports.renderFlagCheckIfStmt = void 0;
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
        var eventArgumentName = '$event';
        var implicitReceiverAccesses = new Set();
        var implicitReceiverExpr = (scope === null || scope.bindingLevel === 0) ?
            o.variable(util_4.CONTEXT_NAME) :
            scope.getOrCreateSharedContextVar(0);
        var bindingExpr = expression_converter_1.convertActionBinding(scope, implicitReceiverExpr, handler, 'b', function () { return util_1.error('Unexpected interpolation'); }, eventAst.handlerSpan, implicitReceiverAccesses);
        var statements = [];
        if (scope) {
            statements.push.apply(statements, tslib_1.__spread(scope.restoreViewStatement()));
            statements.push.apply(statements, tslib_1.__spread(scope.variableDeclarations()));
        }
        statements.push.apply(statements, tslib_1.__spread(bindingExpr.render3Stmts));
        var eventName = type === 1 /* Animation */ ? util_2.prepareSyntheticListenerName(name, phase) : name;
        var fnName = handlerName && compile_metadata_1.sanitizeIdentifier(handlerName);
        var fnArgs = [];
        if (implicitReceiverAccesses.has(eventArgumentName)) {
            fnArgs.push(new o.FnParam(eventArgumentName, o.DYNAMIC_TYPE));
        }
        var handlerFn = o.fn(fnArgs, statements, o.INFERRED_TYPE, null, fnName);
        var params = [o.literal(eventName), handlerFn];
        if (target) {
            params.push(o.literal(false), // `useCapture` flag, defaults to `false`
            o.importExpr(GLOBAL_TARGET_RESOLVERS.get(target)));
        }
        return params;
    }
    exports.prepareEventListenerParameters = prepareEventListenerParameters;
    function createComponentDefConsts() {
        return { prepareStatements: [], constExpressions: [] };
    }
    var TemplateDefinitionBuilder = /** @class */ (function () {
        function TemplateDefinitionBuilder(constantPool, parentBindingScope, level, contextName, i18nContext, templateIndex, templateName, directiveMatcher, directives, pipeTypeByName, pipes, _namespace, relativeContextFilePath, i18nUseExternalIds, _constants) {
            var _this = this;
            if (level === void 0) { level = 0; }
            if (_constants === void 0) { _constants = createComponentDefConsts(); }
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
            var initI18nContext = this.i18nContext ||
                (util_3.isI18nRootNode(i18n) && !util_3.isSingleI18nIcu(i18n) &&
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
        TemplateDefinitionBuilder.prototype.getLocal = function (name) {
            return this._bindingScope.get(name);
        };
        // LocalResolver
        TemplateDefinitionBuilder.prototype.notifyImplicitReceiverUse = function () {
            this._bindingScope.notifyImplicitReceiverUse();
        };
        TemplateDefinitionBuilder.prototype.i18nTranslate = function (message, params, ref, transformFn) {
            var _a;
            if (params === void 0) { params = {}; }
            var _ref = ref || this.i18nGenerateMainBlockVar();
            // Closure Compiler requires const names to start with `MSG_` but disallows any other const to
            // start with `MSG_`. We define a variable starting with `MSG_` just for the `goog.getMsg` call
            var closureVar = this.i18nGenerateClosureVar(message.id);
            var statements = getTranslationDeclStmts(message, _ref, closureVar, params, transformFn);
            (_a = this._constants.prepareStatements).push.apply(_a, tslib_1.__spread(statements));
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
        // Generates top level vars for i18n blocks (i.e. `i18n_N`).
        TemplateDefinitionBuilder.prototype.i18nGenerateMainBlockVar = function () {
            return o.variable(this.constantPool.uniqueName(util_3.TRANSLATION_VAR_PREFIX));
        };
        // Generates vars with Closure-specific names for i18n blocks (i.e. `MSG_XXX`).
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
            this.i18n = this.i18nContext ?
                this.i18nContext.forkChildContext(index, this.templateIndex, meta) :
                new context_1.I18nContext(index, this.i18nGenerateMainBlockVar(), 0, this.templateIndex, meta);
            // generate i18nStart instruction
            var _a = this.i18n, id = _a.id, ref = _a.ref;
            var params = [o.literal(index), this.addToConsts(ref)];
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
        TemplateDefinitionBuilder.prototype.i18nAttributesInstruction = function (nodeIndex, attrs, sourceSpan) {
            var _this = this;
            var hasBindings = false;
            var i18nAttrArgs = [];
            var bindings = [];
            attrs.forEach(function (attr) {
                var message = attr.i18n;
                var converted = attr.value.visit(_this._valueConverter);
                _this.allocateBindingSlots(converted);
                if (converted instanceof ast_1.Interpolation) {
                    var placeholders = util_3.assembleBoundTextPlaceholders(message);
                    var params = util_3.placeholdersToParams(placeholders);
                    i18nAttrArgs.push(o.literal(attr.name), _this.i18nTranslate(message, params));
                    converted.expressions.forEach(function (expression) {
                        hasBindings = true;
                        bindings.push({
                            sourceSpan: sourceSpan,
                            value: function () { return _this.convertPropertyBinding(expression); },
                        });
                    });
                }
            });
            if (bindings.length > 0) {
                this.updateInstructionChainWithAdvance(nodeIndex, r3_identifiers_1.Identifiers.i18nExp, bindings);
            }
            if (i18nAttrArgs.length > 0) {
                var index = o.literal(this.allocateDataSlot());
                var constIndex = this.addToConsts(o.literalArr(i18nAttrArgs));
                this.creationInstruction(sourceSpan, r3_identifiers_1.Identifiers.i18nAttributes, [index, constIndex]);
                if (hasBindings) {
                    this.updateInstruction(sourceSpan, r3_identifiers_1.Identifiers.i18nApply, [index]);
                }
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
            this.creationInstruction(element.startSourceSpan, nsInstruction);
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
            var attributes = this.getAttributeExpressions(ngContent.name, nonContentSelectAttributes, [], []);
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
            var _b, _c;
            var elementIndex = this.allocateDataSlot();
            var stylingBuilder = new styling_builder_1.StylingBuilder(null);
            var isNonBindableMode = false;
            var isI18nRootElement = util_3.isI18nRootNode(element.i18n) && !util_3.isSingleI18nIcu(element.i18n);
            var outputAttrs = [];
            var _d = tslib_1.__read(tags_1.splitNsName(element.name), 2), namespaceKey = _d[0], elementName = _d[1];
            var isNgContainer = tags_1.isNgContainer(element.name);
            try {
                // Handle styling, i18n, ngNonBindable attributes
                for (var _e = tslib_1.__values(element.attributes), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var attr = _f.value;
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
                        outputAttrs.push(attr);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
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
            var boundI18nAttrs = [];
            element.inputs.forEach(function (input) {
                var stylingInputWasSet = stylingBuilder.registerBoundInput(input);
                if (!stylingInputWasSet) {
                    if (input.type === 0 /* Property */ && input.i18n) {
                        boundI18nAttrs.push(input);
                    }
                    else {
                        allOtherInputs.push(input);
                    }
                }
            });
            // add attributes for directive and projection matching purposes
            var attributes = this.getAttributeExpressions(element.name, outputAttrs, allOtherInputs, element.outputs, stylingBuilder, [], boundI18nAttrs);
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
                element.outputs.length === 0 && boundI18nAttrs.length === 0 && !hasChildren;
            var createSelfClosingI18nInstruction = !createSelfClosingInstruction && hasTextChildrenOnly(element.children);
            if (createSelfClosingInstruction) {
                this.creationInstruction(element.sourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainer : r3_identifiers_1.Identifiers.element, util_4.trimTrailingNulls(parameters));
            }
            else {
                this.creationInstruction(element.startSourceSpan, isNgContainer ? r3_identifiers_1.Identifiers.elementContainerStart : r3_identifiers_1.Identifiers.elementStart, util_4.trimTrailingNulls(parameters));
                if (isNonBindableMode) {
                    this.creationInstruction(element.startSourceSpan, r3_identifiers_1.Identifiers.disableBindings);
                }
                if (boundI18nAttrs.length > 0) {
                    this.i18nAttributesInstruction(elementIndex, boundI18nAttrs, (_b = element.startSourceSpan) !== null && _b !== void 0 ? _b : element.sourceSpan);
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
                    this.i18nStart(element.startSourceSpan, element.i18n, createSelfClosingI18nInstruction);
                }
            }
            // the code here will collect all update-level styling instructions and add them to the
            // update block of the template function AOT code. Instructions like `styleProp`,
            // `styleMap`, `classMap`, `classProp`
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
                                    value: function () { return _this.convertPropertyBinding(value_2); },
                                    params: params_2
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
                                    value: function () { return _this.convertPropertyBinding(boundValue_1); },
                                    params: params_2
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
                var span = (_c = element.endSourceSpan) !== null && _c !== void 0 ? _c : element.sourceSpan;
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
            var _a;
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
            var attrsExprs = this.getAttributeExpressions(NG_TEMPLATE_TAG_NAME, template.attributes, template.inputs, template.outputs, undefined /* styles */, template.templateAttrs);
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
                _this.constantPool.statements.push(templateFunctionExpr.toDeclStmt(templateName));
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
            // Only add normal input/output binding instructions on explicit <ng-template> elements.
            if (template.tagName === NG_TEMPLATE_TAG_NAME) {
                var _b = tslib_1.__read(util_1.partitionArray(template.inputs, util_3.hasI18nMeta), 2), i18nInputs = _b[0], inputs = _b[1];
                // Add i18n attributes that may act as inputs to directives. If such attributes are present,
                // generate `i18nAttributes` instruction. Note: we generate it only for explicit <ng-template>
                // elements, in case of inline templates, corresponding instructions will be generated in the
                // nested template function.
                if (i18nInputs.length > 0) {
                    this.i18nAttributesInstruction(templateIndex, i18nInputs, (_a = template.startSourceSpan) !== null && _a !== void 0 ? _a : template.sourceSpan);
                }
                // Add the input bindings
                if (inputs.length > 0) {
                    this.templatePropertyBindings(templateIndex, inputs);
                }
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
        TemplateDefinitionBuilder.prototype.allocateDataSlot = function () {
            return this._dataIndex++;
        };
        TemplateDefinitionBuilder.prototype.getConstCount = function () {
            return this._dataIndex;
        };
        TemplateDefinitionBuilder.prototype.getVarCount = function () {
            return this._pureFunctionSlots;
        };
        TemplateDefinitionBuilder.prototype.getConsts = function () {
            return this._constants;
        };
        TemplateDefinitionBuilder.prototype.getNgContentSelectors = function () {
            return this._ngContentReservedSlots.length ?
                this.constantPool.getConstLiteral(util_4.asLiteral(this._ngContentReservedSlots), true) :
                null;
        };
        TemplateDefinitionBuilder.prototype.bindingContext = function () {
            return "" + this._bindingContext++;
        };
        TemplateDefinitionBuilder.prototype.templatePropertyBindings = function (templateIndex, attrs) {
            var _this = this;
            var propertyBindings = [];
            attrs.forEach(function (input) {
                if (input instanceof t.BoundAttribute) {
                    var value_4 = input.value.visit(_this._valueConverter);
                    if (value_4 !== undefined) {
                        _this.allocateBindingSlots(value_4);
                        if (value_4 instanceof ast_1.Interpolation) {
                            // Params typically contain attribute namespace and value sanitizer, which is applicable
                            // for regular HTML elements, but not applicable for <ng-template> (since props act as
                            // inputs to directives), so keep params array empty.
                            var params = [];
                            // prop="{{value}}" case
                            _this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value_4), templateIndex, input.name, input, value_4, params);
                        }
                        else {
                            // [prop]="value" case
                            propertyBindings.push({
                                name: input.name,
                                sourceSpan: input.sourceSpan,
                                value: function () { return _this.convertPropertyBinding(value_4); }
                            });
                        }
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
                            return call.params(function (value) { return (call.supportsInterpolation && value instanceof ast_1.Interpolation) ?
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
            var convertedPropertyBinding = expression_converter_1.convertPropertyBinding(this, this.getImplicitReceiverExpr(), value, this.bindingContext(), expression_converter_1.BindingForm.Expression, function () { return util_1.error('Unexpected interpolation'); });
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
                this.directiveMatcher.match(selector, function (cssSelector, staticType) {
                    _this.directives.add(staticType);
                });
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
        TemplateDefinitionBuilder.prototype.getAttributeExpressions = function (elementName, renderAttributes, inputs, outputs, styles, templateAttrs, boundI18nAttrs) {
            var e_2, _a;
            if (templateAttrs === void 0) { templateAttrs = []; }
            if (boundI18nAttrs === void 0) { boundI18nAttrs = []; }
            var alreadySeen = new Set();
            var attrExprs = [];
            var ngProjectAsAttr;
            try {
                for (var renderAttributes_1 = tslib_1.__values(renderAttributes), renderAttributes_1_1 = renderAttributes_1.next(); !renderAttributes_1_1.done; renderAttributes_1_1 = renderAttributes_1.next()) {
                    var attr = renderAttributes_1_1.value;
                    if (attr.name === NG_PROJECT_AS_ATTR_NAME) {
                        ngProjectAsAttr = attr;
                    }
                    // Note that static i18n attributes aren't in the i18n array,
                    // because they're treated in the same way as regular attributes.
                    if (attr.i18n) {
                        attrExprs.push(o.literal(attr.name), this.i18nTranslate(attr.i18n));
                    }
                    else {
                        attrExprs.push.apply(attrExprs, tslib_1.__spread(getAttributeNameLiterals(attr.name), [trustedConstAttribute(elementName, attr)]));
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (renderAttributes_1_1 && !renderAttributes_1_1.done && (_a = renderAttributes_1.return)) _a.call(renderAttributes_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
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
            if (boundI18nAttrs.length) {
                attrExprs.push(o.literal(6 /* I18n */));
                boundI18nAttrs.forEach(function (attr) { return addAttrExpr(attr.name); });
            }
            return attrExprs;
        };
        TemplateDefinitionBuilder.prototype.addToConsts = function (expression) {
            if (o.isNull(expression)) {
                return o.TYPED_NULL_EXPR;
            }
            var consts = this._constants.constExpressions;
            // Try to reuse a literal that's already in the array, if possible.
            for (var i = 0; i < consts.length; i++) {
                if (consts[i].isEquivalent(expression)) {
                    return o.literal(i);
                }
            }
            return o.literal(consts.push(expression) - 1);
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
            var target = new ast_1.PropertyRead(pipe.span, pipe.sourceSpan, pipe.nameSpan, new ast_1.ImplicitReceiver(pipe.span, pipe.sourceSpan), slotPseudoLocal);
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
        BindingScope.createRootScope = function () {
            return new BindingScope().set(0, '$event', o.variable('$event'));
        };
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
        BindingScope.prototype.getLocal = function (name) {
            return this.get(name);
        };
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
        BindingScope.prototype.isListenerScope = function () {
            return this.parent && this.parent.bindingLevel === this.bindingLevel;
        };
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
            // TODO(ayazhafiz): we may not always want to bail out at this point (e.g. in
            // the context of a language service).
            return {
                interpolationConfig: interpolationConfig,
                preserveWhitespaces: preserveWhitespaces,
                template: template,
                errors: parseResult.errors,
                nodes: [],
                styleUrls: [],
                styles: [],
                ngContentSelectors: []
            };
        }
        var rootNodes = parseResult.rootNodes;
        // process i18n meta information (scan attributes, generate ids)
        // before we run whitespace removal process, because existing i18n
        // extraction process (ng extract-i18n) relies on a raw content to generate
        // message ids
        var i18nMetaVisitor = new meta_1.I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ !preserveWhitespaces, enableI18nLegacyMessageIdFormat);
        rootNodes = html.visitAll(i18nMetaVisitor, rootNodes);
        if (!preserveWhitespaces) {
            rootNodes = html.visitAll(new html_whitespaces_1.WhitespaceVisitor(), rootNodes);
            // run i18n meta visitor again in case whitespaces are removed (because that might affect
            // generated i18n message content) and first pass indicated that i18n content is present in a
            // template. During this pass i18n IDs generated at the first pass will be preserved, so we can
            // mimic existing extraction process (ng extract-i18n)
            if (i18nMetaVisitor.hasI18nMeta) {
                rootNodes = html.visitAll(new meta_1.I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
            }
        }
        var _a = r3_template_transform_1.htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, errors = _a.errors, styleUrls = _a.styleUrls, styles = _a.styles, ngContentSelectors = _a.ngContentSelectors;
        return {
            interpolationConfig: interpolationConfig,
            preserveWhitespaces: preserveWhitespaces,
            errors: errors.length > 0 ? errors : null,
            template: template,
            nodes: nodes,
            styleUrls: styleUrls,
            styles: styles,
            ngContentSelectors: ngContentSelectors
        };
    }
    exports.parseTemplate = parseTemplate;
    var elementRegistry = new dom_element_schema_registry_1.DomElementSchemaRegistry();
    /**
     * Construct a `BindingParser` with a default configuration.
     */
    function makeBindingParser(interpolationConfig) {
        if (interpolationConfig === void 0) { interpolationConfig = interpolation_config_1.DEFAULT_INTERPOLATION_CONFIG; }
        return new binding_parser_1.BindingParser(new parser_1.IvyParser(new lexer_1.Lexer()), interpolationConfig, elementRegistry, null, []);
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
    function trustedConstAttribute(tagName, attr) {
        var value = util_4.asLiteral(attr.value);
        switch (elementRegistry.securityContext(tagName, attr.name, /* isAttribute */ true)) {
            case core.SecurityContext.HTML:
                return o.importExpr(r3_identifiers_1.Identifiers.trustConstantHtml).callFn([value], attr.valueSpan);
            case core.SecurityContext.SCRIPT:
                return o.importExpr(r3_identifiers_1.Identifiers.trustConstantScript).callFn([value], attr.valueSpan);
            case core.SecurityContext.RESOURCE_URL:
                return o.importExpr(r3_identifiers_1.Identifiers.trustConstantResourceUrl).callFn([value], attr.valueSpan);
            default:
                return value;
        }
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCwyRUFBbUU7SUFDbkUsaUdBQStLO0lBRS9LLGlEQUFtQztJQUNuQyxtRUFBbU87SUFDbk8sdUVBQW9EO0lBQ3BELHlFQUF5RDtJQUV6RCwwREFBNEM7SUFDNUMsMkVBQXVEO0lBQ3ZELHFGQUFtRTtJQUNuRSw2RkFBdUc7SUFFdkcsNkRBQXNGO0lBQ3RGLGtFQUFpRDtJQUNqRCwyREFBNkM7SUFFN0Msd0dBQWtGO0lBQ2xGLDJEQUE0RDtJQUM1RCx1RkFBbUU7SUFDbkUsbURBQWlEO0lBQ2pELHdEQUErQjtJQUMvQiwrRUFBb0Q7SUFDcEQsNkZBQTZEO0lBQzdELDJEQUF5SDtJQUV6SCwyRUFBMkM7SUFDM0MsdUZBQWtFO0lBQ2xFLHlGQUErRDtJQUMvRCxxRUFBNEM7SUFDNUMscUVBQTZUO0lBQzdULHNGQUFxRTtJQUNyRSxnRUFBNk87SUFJN08sNENBQTRDO0lBQzVDLElBQU0sc0JBQXNCLEdBQUcsUUFBUSxDQUFDO0lBRXhDLG1DQUFtQztJQUNuQyxJQUFNLHVCQUF1QixHQUFHLGFBQWEsQ0FBQztJQUU5Qyx1REFBdUQ7SUFDdkQsSUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsQ0FDbkMsQ0FBQyxDQUFDLFFBQVEsRUFBRSw0QkFBRSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLDRCQUFFLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsNEJBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFaEcsSUFBTSxvQkFBb0IsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxD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QUFFLEVBQ3hCLDRDQUE0QixDQUN4QixRQUFRLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFDN0IsaUNBQTBCLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ2hFLHlDQUF3QixDQUNwQixRQUFRLEVBQUUsT0FBTyxFQUFFLGlDQUEwQixDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1NBQzFGLENBQUM7UUFFRixJQUFJLFdBQVcsRUFBRTtZQUNmLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDakY7UUFFRCxPQUFPLFVBQVUsQ0FBQztJQUNwQixDQUFDO0lBcEJELDBEQW9CQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxTQUFTLHNCQUFzQjtRQUM3QixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO2FBQ2hELFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7YUFDbkQsR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtmbGF0dGVuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtCaW5kaW5nRm9ybSwgQnVpbHRpbkZ1bmN0aW9uQ2FsbCwgY29udmVydEFjdGlvbkJpbmRpbmcsIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcsIGNvbnZlcnRVcGRhdGVBcmd1bWVudHMsIExvY2FsUmVzb2x2ZXJ9IGZyb20gJy4uLy4uL2NvbXBpbGVyX3V0aWwvZXhwcmVzc2lvbl9jb252ZXJ0ZXInO1xuaW1wb3J0IHtDb25zdGFudFBvb2x9IGZyb20gJy4uLy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgY29yZSBmcm9tICcuLi8uLi9jb3JlJztcbmltcG9ydCB7QVNULCBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciwgQmluZGluZ1BpcGUsIEJpbmRpbmdUeXBlLCBGdW5jdGlvbkNhbGwsIEltcGxpY2l0UmVjZWl2ZXIsIEludGVycG9sYXRpb24sIExpdGVyYWxBcnJheSwgTGl0ZXJhbE1hcCwgTGl0ZXJhbFByaW1pdGl2ZSwgUGFyc2VkRXZlbnRUeXBlLCBQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0xleGVyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge0l2eVBhcnNlcn0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uLy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtXaGl0ZXNwYWNlVmlzaXRvcn0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaW50ZXJwb2xhdGlvbl9jb25maWcnO1xuaW1wb3J0IHtMZXhlclJhbmdlfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvbGV4ZXInO1xuaW1wb3J0IHtpc05nQ29udGFpbmVyIGFzIGNoZWNrSXNOZ0NvbnRhaW5lciwgc3BsaXROc05hbWV9IGZyb20gJy4uLy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7bWFwTGl0ZXJhbH0gZnJvbSAnLi4vLi4vb3V0cHV0L21hcF91dGlsJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtQYXJzZUVycm9yLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4uLy4uL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yLCBwYXJ0aXRpb25BcnJheX0gZnJvbSAnLi4vLi4vdXRpbCc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJy4uL3IzX2FzdCc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuLi9yM19pZGVudGlmaWVycyc7XG5pbXBvcnQge2h0bWxBc3RUb1JlbmRlcjNBc3R9IGZyb20gJy4uL3IzX3RlbXBsYXRlX3RyYW5zZm9ybSc7XG5pbXBvcnQge3ByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZSwgcHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyTmFtZSwgcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7STE4bkNvbnRleHR9IGZyb20gJy4vaTE4bi9jb250ZXh0JztcbmltcG9ydCB7Y3JlYXRlR29vZ2xlR2V0TXNnU3RhdGVtZW50c30gZnJvbSAnLi9pMThuL2dldF9tc2dfdXRpbHMnO1xuaW1wb3J0IHtjcmVhdGVMb2NhbGl6ZVN0YXRlbWVudHN9IGZyb20gJy4vaTE4bi9sb2NhbGl6ZV91dGlscyc7XG5pbXBvcnQge0kxOG5NZXRhVmlzaXRvcn0gZnJvbSAnLi9pMThuL21ldGEnO1xuaW1wb3J0IHthc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycywgYXNzZW1ibGVJMThuQm91bmRTdHJpbmcsIGRlY2xhcmVJMThuVmFyaWFibGUsIGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgsIGhhc0kxOG5NZXRhLCBJMThOX0lDVV9NQVBQSU5HX1BSRUZJWCwgaTE4bkZvcm1hdFBsYWNlaG9sZGVyTmFtZXMsIGljdUZyb21JMThuTWVzc2FnZSwgaXNJMThuUm9vdE5vZGUsIGlzU2luZ2xlSTE4bkljdSwgcGxhY2Vob2xkZXJzVG9QYXJhbXMsIFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgsIHdyYXBJMThuUGxhY2Vob2xkZXJ9IGZyb20gJy4vaTE4bi91dGlsJztcbmltcG9ydCB7U3R5bGluZ0J1aWxkZXIsIFN0eWxpbmdJbnN0cnVjdGlvbn0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHthc0xpdGVyYWwsIGNoYWluZWRJbnN0cnVjdGlvbiwgQ09OVEVYVF9OQU1FLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nLCBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aCwgSU1QTElDSVRfUkVGRVJFTkNFLCBpbnZhbGlkLCBOT05fQklOREFCTEVfQVRUUiwgUkVGRVJFTkNFX1BSRUZJWCwgUkVOREVSX0ZMQUdTLCB0cmltVHJhaWxpbmdOdWxscywgdW5zdXBwb3J0ZWR9IGZyb20gJy4vdXRpbCc7XG5cblxuXG4vLyBTZWxlY3RvciBhdHRyaWJ1dGUgbmFtZSBvZiBgPG5nLWNvbnRlbnQ+YFxuY29uc3QgTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUiA9ICdzZWxlY3QnO1xuXG4vLyBBdHRyaWJ1dGUgbmFtZSBvZiBgbmdQcm9qZWN0QXNgLlxuY29uc3QgTkdfUFJPSkVDVF9BU19BVFRSX05BTUUgPSAnbmdQcm9qZWN0QXMnO1xuXG4vLyBMaXN0IG9mIHN1cHBvcnRlZCBnbG9iYWwgdGFyZ2V0cyBmb3IgZXZlbnQgbGlzdGVuZXJzXG5jb25zdCBHTE9CQUxfVEFSR0VUX1JFU09MVkVSUyA9IG5ldyBNYXA8c3RyaW5nLCBvLkV4dGVybmFsUmVmZXJlbmNlPihcbiAgICBbWyd3aW5kb3cnLCBSMy5yZXNvbHZlV2luZG93XSwgWydkb2N1bWVudCcsIFIzLnJlc29sdmVEb2N1bWVudF0sIFsnYm9keScsIFIzLnJlc29sdmVCb2R5XV0pO1xuXG5jb25zdCBMRUFESU5HX1RSSVZJQV9DSEFSUyA9IFsnICcsICdcXG4nLCAnXFxyJywgJ1xcdCddO1xuXG4vLyAgaWYgKHJmICYgZmxhZ3MpIHsgLi4gfVxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckZsYWdDaGVja0lmU3RtdChcbiAgICBmbGFnczogY29yZS5SZW5kZXJGbGFncywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSk6IG8uSWZTdG10IHtcbiAgcmV0dXJuIG8uaWZTdG10KG8udmFyaWFibGUoUkVOREVSX0ZMQUdTKS5iaXR3aXNlQW5kKG8ubGl0ZXJhbChmbGFncyksIG51bGwsIGZhbHNlKSwgc3RhdGVtZW50cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMoXG4gICAgZXZlbnRBc3Q6IHQuQm91bmRFdmVudCwgaGFuZGxlck5hbWU6IHN0cmluZ3xudWxsID0gbnVsbCxcbiAgICBzY29wZTogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCB7dHlwZSwgbmFtZSwgdGFyZ2V0LCBwaGFzZSwgaGFuZGxlcn0gPSBldmVudEFzdDtcbiAgaWYgKHRhcmdldCAmJiAhR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuaGFzKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZ2xvYmFsIHRhcmdldCAnJHt0YXJnZXR9JyBkZWZpbmVkIGZvciAnJHtuYW1lfScgZXZlbnQuXG4gICAgICAgIFN1cHBvcnRlZCBsaXN0IG9mIGdsb2JhbCB0YXJnZXRzOiAke0FycmF5LmZyb20oR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMua2V5cygpKX0uYCk7XG4gIH1cblxuICBjb25zdCBldmVudEFyZ3VtZW50TmFtZSA9ICckZXZlbnQnO1xuICBjb25zdCBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgaW1wbGljaXRSZWNlaXZlckV4cHIgPSAoc2NvcGUgPT09IG51bGwgfHwgc2NvcGUuYmluZGluZ0xldmVsID09PSAwKSA/XG4gICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgc2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgc2NvcGUsIGltcGxpY2l0UmVjZWl2ZXJFeHByLCBoYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSxcbiAgICAgIGV2ZW50QXN0LmhhbmRsZXJTcGFuLCBpbXBsaWNpdFJlY2VpdmVyQWNjZXNzZXMpO1xuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSk7XG4gIH1cbiAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10cyk7XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UhKSA6IG5hbWU7XG4gIGNvbnN0IGZuTmFtZSA9IGhhbmRsZXJOYW1lICYmIHNhbml0aXplSWRlbnRpZmllcihoYW5kbGVyTmFtZSk7XG4gIGNvbnN0IGZuQXJnczogby5GblBhcmFtW10gPSBbXTtcblxuICBpZiAoaW1wbGljaXRSZWNlaXZlckFjY2Vzc2VzLmhhcyhldmVudEFyZ3VtZW50TmFtZSkpIHtcbiAgICBmbkFyZ3MucHVzaChuZXcgby5GblBhcmFtKGV2ZW50QXJndW1lbnROYW1lLCBvLkRZTkFNSUNfVFlQRSkpO1xuICB9XG5cbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcbiAgY29uc3QgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZXZlbnROYW1lKSwgaGFuZGxlckZuXTtcbiAgaWYgKHRhcmdldCkge1xuICAgIHBhcmFtcy5wdXNoKFxuICAgICAgICBvLmxpdGVyYWwoZmFsc2UpLCAgLy8gYHVzZUNhcHR1cmVgIGZsYWcsIGRlZmF1bHRzIHRvIGBmYWxzZWBcbiAgICAgICAgby5pbXBvcnRFeHByKEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTLmdldCh0YXJnZXQpISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbi8vIENvbGxlY3RzIGluZm9ybWF0aW9uIG5lZWRlZCB0byBnZW5lcmF0ZSBgY29uc3RzYCBmaWVsZCBvZiB0aGUgQ29tcG9uZW50RGVmLlxuLy8gV2hlbiBhIGNvbnN0YW50IHJlcXVpcmVzIHNvbWUgcHJlLXByb2Nlc3NpbmcsIHRoZSBgcHJlcGFyZVN0YXRlbWVudHNgIHNlY3Rpb25cbi8vIGNvbnRhaW5zIGNvcnJlc3BvbmRpbmcgc3RhdGVtZW50cy5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgcHJlcGFyZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W107XG4gIGNvbnN0RXhwcmVzc2lvbnM6IG8uRXhwcmVzc2lvbltdO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZDb25zdHMoKTogQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgcmV0dXJuIHtwcmVwYXJlU3RhdGVtZW50czogW10sIGNvbnN0RXhwcmVzc2lvbnM6IFtdfTtcbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaW1wbGVtZW50cyB0LlZpc2l0b3I8dm9pZD4sIExvY2FsUmVzb2x2ZXIge1xuICBwcml2YXRlIF9kYXRhSW5kZXggPSAwO1xuICBwcml2YXRlIF9iaW5kaW5nQ29udGV4dCA9IDA7XG4gIHByaXZhdGUgX3ByZWZpeENvZGU6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zLiBXZSBzdG9yZSB0aGVtIGhlcmUgYXMgd2UgcHJvY2Vzc1xuICAgKiB0aGUgdGVtcGxhdGUgc28gYmluZGluZ3MgaW4gbGlzdGVuZXJzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLlxuICAgKiBUaGlzIGVuc3VyZXMgYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRpb25Db2RlRm5zOiAoKCkgPT4gby5TdGF0ZW1lbnQpW10gPSBbXTtcbiAgLyoqXG4gICAqIExpc3Qgb2YgY2FsbGJhY2tzIHRvIGdlbmVyYXRlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGFyZSByZXNvbHZlZCBvbmx5IG9uY2UgYWxsIG5vZGVzIGhhdmUgYmVlbiB2aXNpdGVkLiBUaGlzIGVuc3VyZXNcbiAgICogYWxsIGxvY2FsIHJlZnMgYW5kIGNvbnRleHQgdmFyaWFibGVzIGFyZSBhdmFpbGFibGUgZm9yIG1hdGNoaW5nLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG5cbiAgLyoqIEluZGV4IG9mIHRoZSBjdXJyZW50bHktc2VsZWN0ZWQgbm9kZS4gKi9cbiAgcHJpdmF0ZSBfY3VycmVudEluZGV4OiBudW1iZXIgPSAwO1xuXG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gaTE4biBjb250ZXh0IGxvY2FsIHRvIHRoaXMgdGVtcGxhdGVcbiAgcHJpdmF0ZSBpMThuOiBJMThuQ29udGV4dHxudWxsID0gbnVsbDtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgLy8gTnVtYmVyIG9mIGJpbmRpbmcgc2xvdHNcbiAgcHJpdmF0ZSBfYmluZGluZ1Nsb3RzID0gMDtcblxuICBwcml2YXRlIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZztcblxuICAvLyBQcm9qZWN0aW9uIHNsb3RzIGZvdW5kIGluIHRoZSB0ZW1wbGF0ZS4gUHJvamVjdGlvbiBzbG90cyBjYW4gZGlzdHJpYnV0ZSBwcm9qZWN0ZWRcbiAgLy8gbm9kZXMgYmFzZWQgb24gYSBzZWxlY3Rvciwgb3IgY2FuIGp1c3QgdXNlIHRoZSB3aWxkY2FyZCBzZWxlY3RvciB0byBtYXRjaFxuICAvLyBhbGwgbm9kZXMgd2hpY2ggYXJlbid0IG1hdGNoaW5nIGFueSBzZWxlY3Rvci5cbiAgcHJpdmF0ZSBfbmdDb250ZW50UmVzZXJ2ZWRTbG90czogKHN0cmluZ3wnKicpW10gPSBbXTtcblxuICAvLyBOdW1iZXIgb2Ygbm9uLWRlZmF1bHQgc2VsZWN0b3JzIGZvdW5kIGluIGFsbCBwYXJlbnQgdGVtcGxhdGVzIG9mIHRoaXMgdGVtcGxhdGUuIFdlIG5lZWQgdG9cbiAgLy8gdHJhY2sgaXQgdG8gcHJvcGVybHkgYWRqdXN0IHByb2plY3Rpb24gc2xvdCBpbmRleCBpbiB0aGUgYHByb2plY3Rpb25gIGluc3RydWN0aW9uLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSAwO1xuXG4gIC8vIEV4cHJlc3Npb24gdGhhdCBzaG91bGQgYmUgdXNlZCBhcyBpbXBsaWNpdCByZWNlaXZlciB3aGVuIGNvbnZlcnRpbmcgdGVtcGxhdGVcbiAgLy8gZXhwcmVzc2lvbnMgdG8gb3V0cHV0IEFTVC5cbiAgcHJpdmF0ZSBfaW1wbGljaXRSZWNlaXZlckV4cHI6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwYXJlbnRCaW5kaW5nU2NvcGU6IEJpbmRpbmdTY29wZSwgcHJpdmF0ZSBsZXZlbCA9IDAsXG4gICAgICBwcml2YXRlIGNvbnRleHROYW1lOiBzdHJpbmd8bnVsbCwgcHJpdmF0ZSBpMThuQ29udGV4dDogSTE4bkNvbnRleHR8bnVsbCxcbiAgICAgIHByaXZhdGUgdGVtcGxhdGVJbmRleDogbnVtYmVyfG51bGwsIHByaXZhdGUgdGVtcGxhdGVOYW1lOiBzdHJpbmd8bnVsbCxcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyfG51bGwsIHByaXZhdGUgZGlyZWN0aXZlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIHBpcGVUeXBlQnlOYW1lOiBNYXA8c3RyaW5nLCBvLkV4cHJlc3Npb24+LCBwcml2YXRlIHBpcGVzOiBTZXQ8by5FeHByZXNzaW9uPixcbiAgICAgIHByaXZhdGUgX25hbWVzcGFjZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyxcbiAgICAgIHByaXZhdGUgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBfY29uc3RhbnRzOiBDb21wb25lbnREZWZDb25zdHMgPSBjcmVhdGVDb21wb25lbnREZWZDb25zdHMoKSkge1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZSA9IHBhcmVudEJpbmRpbmdTY29wZS5uZXN0ZWRTY29wZShsZXZlbCk7XG5cbiAgICAvLyBUdXJuIHRoZSByZWxhdGl2ZSBjb250ZXh0IGZpbGUgcGF0aCBpbnRvIGFuIGlkZW50aWZpZXIgYnkgcmVwbGFjaW5nIG5vbi1hbHBoYW51bWVyaWNcbiAgICAvLyBjaGFyYWN0ZXJzIHdpdGggdW5kZXJzY29yZXMuXG4gICAgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4ID0gcmVsYXRpdmVDb250ZXh0RmlsZVBhdGgucmVwbGFjZSgvW15BLVphLXowLTldL2csICdfJykgKyAnXyc7XG5cbiAgICB0aGlzLl92YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgY29uc3RhbnRQb29sLCAoKSA9PiB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKSxcbiAgICAgICAgKG51bVNsb3RzOiBudW1iZXIpID0+IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyhudW1TbG90cyksXG4gICAgICAgIChuYW1lLCBsb2NhbE5hbWUsIHNsb3QsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgbm9kZXM6IHQuTm9kZVtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSwgbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0OiBudW1iZXIgPSAwLFxuICAgICAgaTE4bj86IGkxOG4uSTE4bk1ldGEpOiBvLkZ1bmN0aW9uRXhwciB7XG4gICAgdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ID0gbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0O1xuXG4gICAgaWYgKHRoaXMuX25hbWVzcGFjZSAhPT0gUjMubmFtZXNwYWNlSFRNTCkge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIHRoaXMuX25hbWVzcGFjZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHZhcmlhYmxlIGJpbmRpbmdzXG4gICAgdmFyaWFibGVzLmZvckVhY2godiA9PiB0aGlzLnJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2KSk7XG5cbiAgICAvLyBJbml0aWF0ZSBpMThuIGNvbnRleHQgaW4gY2FzZTpcbiAgICAvLyAtIHRoaXMgdGVtcGxhdGUgaGFzIHBhcmVudCBpMThuIGNvbnRleHRcbiAgICAvLyAtIG9yIHRoZSB0ZW1wbGF0ZSBoYXMgaTE4biBtZXRhIGFzc29jaWF0ZWQgd2l0aCBpdCxcbiAgICAvLyAgIGJ1dCBpdCdzIG5vdCBpbml0aWF0ZWQgYnkgdGhlIEVsZW1lbnQgKGUuZy4gPG5nLXRlbXBsYXRlIGkxOG4+KVxuICAgIGNvbnN0IGluaXRJMThuQ29udGV4dCA9IHRoaXMuaTE4bkNvbnRleHQgfHxcbiAgICAgICAgKGlzSTE4blJvb3ROb2RlKGkxOG4pICYmICFpc1NpbmdsZUkxOG5JY3UoaTE4bikgJiZcbiAgICAgICAgICEoaXNTaW5nbGVFbGVtZW50VGVtcGxhdGUobm9kZXMpICYmIG5vZGVzWzBdLmkxOG4gPT09IGkxOG4pKTtcbiAgICBjb25zdCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9IGhhc1RleHRDaGlsZHJlbk9ubHkobm9kZXMpO1xuICAgIGlmIChpbml0STE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGkxOG4hLCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBpcyB0aGUgaW5pdGlhbCBwYXNzIHRocm91Z2ggdGhlIG5vZGVzIG9mIHRoaXMgdGVtcGxhdGUuIEluIHRoaXMgcGFzcywgd2VcbiAgICAvLyBxdWV1ZSBhbGwgY3JlYXRpb24gbW9kZSBhbmQgdXBkYXRlIG1vZGUgaW5zdHJ1Y3Rpb25zIGZvciBnZW5lcmF0aW9uIGluIHRoZSBzZWNvbmRcbiAgICAvLyBwYXNzLiBJdCdzIG5lY2Vzc2FyeSB0byBzZXBhcmF0ZSB0aGUgcGFzc2VzIHRvIGVuc3VyZSBsb2NhbCByZWZzIGFyZSBkZWZpbmVkIGJlZm9yZVxuICAgIC8vIHJlc29sdmluZyBiaW5kaW5ncy4gV2UgYWxzbyBjb3VudCBiaW5kaW5ncyBpbiB0aGlzIHBhc3MgYXMgd2Ugd2FsayBib3VuZCBleHByZXNzaW9ucy5cbiAgICB0LnZpc2l0QWxsKHRoaXMsIG5vZGVzKTtcblxuICAgIC8vIEFkZCB0b3RhbCBiaW5kaW5nIGNvdW50IHRvIHB1cmUgZnVuY3Rpb24gY291bnQgc28gcHVyZSBmdW5jdGlvbiBpbnN0cnVjdGlvbnMgYXJlXG4gICAgLy8gZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3Qgc2xvdCBvZmZzZXQgd2hlbiB1cGRhdGUgaW5zdHJ1Y3Rpb25zIGFyZSBwcm9jZXNzZWQuXG4gICAgdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHMgKz0gdGhpcy5fYmluZGluZ1Nsb3RzO1xuXG4gICAgLy8gUGlwZXMgYXJlIHdhbGtlZCBpbiB0aGUgZmlyc3QgcGFzcyAodG8gZW5xdWV1ZSBgcGlwZSgpYCBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgYW5kXG4gICAgLy8gYHBpcGVCaW5kYCB1cGRhdGUgaW5zdHJ1Y3Rpb25zKSwgc28gd2UgaGF2ZSB0byB1cGRhdGUgdGhlIHNsb3Qgb2Zmc2V0cyBtYW51YWxseVxuICAgIC8vIHRvIGFjY291bnQgZm9yIGJpbmRpbmdzLlxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyLnVwZGF0ZVBpcGVTbG90T2Zmc2V0cyh0aGlzLl9iaW5kaW5nU2xvdHMpO1xuXG4gICAgLy8gTmVzdGVkIHRlbXBsYXRlcyBtdXN0IGJlIHByb2Nlc3NlZCBiZWZvcmUgY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIHNvIHRlbXBsYXRlKClcbiAgICAvLyBpbnN0cnVjdGlvbnMgY2FuIGJlIGdlbmVyYXRlZCB3aXRoIHRoZSBjb3JyZWN0IGludGVybmFsIGNvbnN0IGNvdW50LlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLmZvckVhY2goYnVpbGRUZW1wbGF0ZUZuID0+IGJ1aWxkVGVtcGxhdGVGbigpKTtcblxuICAgIC8vIE91dHB1dCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9uIHdoZW4gc29tZSBgPG5nLWNvbnRlbnQ+YCB0YWdzIGFyZSBwcmVzZW50LlxuICAgIC8vIFRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gaXMgb25seSBlbWl0dGVkIGZvciB0aGUgY29tcG9uZW50IHRlbXBsYXRlIGFuZFxuICAgIC8vIGlzIHNraXBwZWQgZm9yIG5lc3RlZCB0ZW1wbGF0ZXMgKDxuZy10ZW1wbGF0ZT4gdGFncykuXG4gICAgaWYgKHRoaXMubGV2ZWwgPT09IDAgJiYgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICAgIC8vIEJ5IGRlZmF1bHQgdGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbnMgY3JlYXRlcyBvbmUgc2xvdCBmb3IgdGhlIHdpbGRjYXJkXG4gICAgICAvLyBzZWxlY3RvciBpZiBubyBwYXJhbWV0ZXJzIGFyZSBwYXNzZWQuIFRoZXJlZm9yZSB3ZSBvbmx5IHdhbnQgdG8gYWxsb2NhdGUgYSBuZXdcbiAgICAgIC8vIGFycmF5IGZvciB0aGUgcHJvamVjdGlvbiBzbG90cyBpZiB0aGUgZGVmYXVsdCBwcm9qZWN0aW9uIHNsb3QgaXMgbm90IHN1ZmZpY2llbnQuXG4gICAgICBpZiAodGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggPiAxIHx8IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHNbMF0gIT09ICcqJykge1xuICAgICAgICBjb25zdCByM1Jlc2VydmVkU2xvdHMgPSB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLm1hcChcbiAgICAgICAgICAgIHMgPT4gcyAhPT0gJyonID8gY29yZS5wYXJzZVNlbGVjdG9yVG9SM1NlbGVjdG9yKHMpIDogcyk7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHIzUmVzZXJ2ZWRTbG90cyksIHRydWUpKTtcbiAgICAgIH1cblxuICAgICAgLy8gU2luY2Ugd2UgYWNjdW11bGF0ZSBuZ0NvbnRlbnQgc2VsZWN0b3JzIHdoaWxlIHByb2Nlc3NpbmcgdGVtcGxhdGUgZWxlbWVudHMsXG4gICAgICAvLyB3ZSAqcHJlcGVuZCogYHByb2plY3Rpb25EZWZgIHRvIGNyZWF0aW9uIGluc3RydWN0aW9ucyBibG9jaywgdG8gcHV0IGl0IGJlZm9yZVxuICAgICAgLy8gYW55IGBwcm9qZWN0aW9uYCBpbnN0cnVjdGlvbnNcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihudWxsLCBSMy5wcm9qZWN0aW9uRGVmLCBwYXJhbWV0ZXJzLCAvKiBwcmVwZW5kICovIHRydWUpO1xuICAgIH1cblxuICAgIGlmIChpbml0STE4bkNvbnRleHQpIHtcbiAgICAgIHRoaXMuaTE4bkVuZChudWxsLCBzZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbik7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIGJpbmRpbmdzIGluIGxpc3RlbmVycylcbiAgICBjb25zdCBjcmVhdGlvblN0YXRlbWVudHMgPSB0aGlzLl9jcmVhdGlvbkNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgYWxsIHRoZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgKGUuZy4gcmVzb2x2ZSBwcm9wZXJ0eSBvciB0ZXh0IGJpbmRpbmdzKVxuICAgIGNvbnN0IHVwZGF0ZVN0YXRlbWVudHMgPSB0aGlzLl91cGRhdGVDb2RlRm5zLm1hcCgoZm46ICgpID0+IG8uU3RhdGVtZW50KSA9PiBmbigpKTtcblxuICAgIC8vICBWYXJpYWJsZSBkZWNsYXJhdGlvbiBtdXN0IG9jY3VyIGFmdGVyIGJpbmRpbmcgcmVzb2x1dGlvbiBzbyB3ZSBjYW4gZ2VuZXJhdGUgY29udGV4dFxuICAgIC8vICBpbnN0cnVjdGlvbnMgdGhhdCBidWlsZCBvbiBlYWNoIG90aGVyLlxuICAgIC8vIGUuZy4gY29uc3QgYiA9IG5leHRDb250ZXh0KCkuJGltcGxpY2l0KCk7IGNvbnN0IGIgPSBuZXh0Q29udGV4dCgpO1xuICAgIGNvbnN0IGNyZWF0aW9uVmFyaWFibGVzID0gdGhpcy5fYmluZGluZ1Njb3BlLnZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTtcbiAgICBjb25zdCB1cGRhdGVWYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKS5jb25jYXQodGhpcy5fdGVtcFZhcmlhYmxlcyk7XG5cbiAgICBjb25zdCBjcmVhdGlvbkJsb2NrID0gY3JlYXRpb25TdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgICAgICAgICAgY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0aW9uVmFyaWFibGVzLmNvbmNhdChjcmVhdGlvblN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIGNvbnN0IHVwZGF0ZUJsb2NrID0gdXBkYXRlU3RhdGVtZW50cy5sZW5ndGggPiAwID9cbiAgICAgICAgW3JlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlVmFyaWFibGVzLmNvbmNhdCh1cGRhdGVTdGF0ZW1lbnRzKSldIDpcbiAgICAgICAgW107XG5cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgLy8gaS5lLiAocmY6IFJlbmRlckZsYWdzLCBjdHg6IGFueSlcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSxcbiAgICAgICAgW1xuICAgICAgICAgIC8vIFRlbXBvcmFyeSB2YXJpYWJsZSBkZWNsYXJhdGlvbnMgZm9yIHF1ZXJ5IHJlZnJlc2ggKGkuZS4gbGV0IF90OiBhbnk7KVxuICAgICAgICAgIC4uLnRoaXMuX3ByZWZpeENvZGUsXG4gICAgICAgICAgLy8gQ3JlYXRpbmcgbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5DcmVhdGUpIHsgLi4uIH0pXG4gICAgICAgICAgLi4uY3JlYXRpb25CbG9jayxcbiAgICAgICAgICAvLyBCaW5kaW5nIGFuZCByZWZyZXNoIG1vZGUgKGkuZS4gaWYgKHJmICYgUmVuZGVyRmxhZ3MuVXBkYXRlKSB7Li4ufSlcbiAgICAgICAgICAuLi51cGRhdGVCbG9jayxcbiAgICAgICAgXSxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCB0aGlzLnRlbXBsYXRlTmFtZSk7XG4gIH1cblxuICAvLyBMb2NhbFJlc29sdmVyXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kaW5nU2NvcGUubm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBpMThuVHJhbnNsYXRlKFxuICAgICAgbWVzc2FnZTogaTE4bi5NZXNzYWdlLCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9LCByZWY/OiBvLlJlYWRWYXJFeHByLFxuICAgICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlJlYWRWYXJFeHByIHtcbiAgICBjb25zdCBfcmVmID0gcmVmIHx8IHRoaXMuaTE4bkdlbmVyYXRlTWFpbkJsb2NrVmFyKCk7XG4gICAgLy8gQ2xvc3VyZSBDb21waWxlciByZXF1aXJlcyBjb25zdCBuYW1lcyB0byBzdGFydCB3aXRoIGBNU0dfYCBidXQgZGlzYWxsb3dzIGFueSBvdGhlciBjb25zdCB0b1xuICAgIC8vIHN0YXJ0IHdpdGggYE1TR19gLiBXZSBkZWZpbmUgYSB2YXJpYWJsZSBzdGFydGluZyB3aXRoIGBNU0dfYCBqdXN0IGZvciB0aGUgYGdvb2cuZ2V0TXNnYCBjYWxsXG4gICAgY29uc3QgY2xvc3VyZVZhciA9IHRoaXMuaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlLmlkKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID0gZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMobWVzc2FnZSwgX3JlZiwgY2xvc3VyZVZhciwgcGFyYW1zLCB0cmFuc2Zvcm1Gbik7XG4gICAgdGhpcy5fY29uc3RhbnRzLnByZXBhcmVTdGF0ZW1lbnRzLnB1c2goLi4uc3RhdGVtZW50cyk7XG4gICAgcmV0dXJuIF9yZWY7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyQ29udGV4dFZhcmlhYmxlcyh2YXJpYWJsZTogdC5WYXJpYWJsZSkge1xuICAgIGNvbnN0IHNjb3BlZE5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgIGNvbnN0IGxocyA9IG8udmFyaWFibGUodmFyaWFibGUubmFtZSArIHNjb3BlZE5hbWUpO1xuICAgIHRoaXMuX2JpbmRpbmdTY29wZS5zZXQoXG4gICAgICAgIHJldHJpZXZhbExldmVsLCB2YXJpYWJsZS5uYW1lLCBsaHMsIERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCxcbiAgICAgICAgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGxldCByaHM6IG8uRXhwcmVzc2lvbjtcbiAgICAgICAgICBpZiAoc2NvcGUuYmluZGluZ0xldmVsID09PSByZXRyaWV2YWxMZXZlbCkge1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhcbiAgICAgICAgICAgIHJocyA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhcmVkQ3R4VmFyID0gc2NvcGUuZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWwpO1xuICAgICAgICAgICAgLy8gZS5nLiBjdHhfcjAgICBPUiAgeCgyKTtcbiAgICAgICAgICAgIHJocyA9IHNoYXJlZEN0eFZhciA/IHNoYXJlZEN0eFZhciA6IGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRpdGVtJCA9IHgoMikuJGltcGxpY2l0O1xuICAgICAgICAgIHJldHVybiBbbGhzLnNldChyaHMucHJvcCh2YXJpYWJsZS52YWx1ZSB8fCBJTVBMSUNJVF9SRUZFUkVOQ0UpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9uczogQVNUW10pIHtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHRoaXMuaTE4biEuYXBwZW5kQmluZGluZyhleHByZXNzaW9uKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpMThuQmluZFByb3BzKHByb3BzOiB7W2tleTogc3RyaW5nXTogdC5UZXh0fHQuQm91bmRUZXh0fSk6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259IHtcbiAgICBjb25zdCBib3VuZDoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICBPYmplY3Qua2V5cyhwcm9wcykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IHByb3BzW2tleV07XG4gICAgICBpZiAocHJvcCBpbnN0YW5jZW9mIHQuVGV4dCkge1xuICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKHByb3AudmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wLnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICBjb25zdCB7c3RyaW5ncywgZXhwcmVzc2lvbnN9ID0gdmFsdWU7XG4gICAgICAgICAgY29uc3Qge2lkLCBiaW5kaW5nc30gPSB0aGlzLmkxOG4hO1xuICAgICAgICAgIGNvbnN0IGxhYmVsID0gYXNzZW1ibGVJMThuQm91bmRTdHJpbmcoc3RyaW5ncywgYmluZGluZ3Muc2l6ZSwgaWQpO1xuICAgICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKGV4cHJlc3Npb25zKTtcbiAgICAgICAgICBib3VuZFtrZXldID0gby5saXRlcmFsKGxhYmVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBib3VuZDtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlcyB0b3AgbGV2ZWwgdmFycyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYGkxOG5fTmApLlxuICBwcml2YXRlIGkxOG5HZW5lcmF0ZU1haW5CbG9ja1ZhcigpOiBvLlJlYWRWYXJFeHByIHtcbiAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1ZBUl9QUkVGSVgpKTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlcyB2YXJzIHdpdGggQ2xvc3VyZS1zcGVjaWZpYyBuYW1lcyBmb3IgaTE4biBibG9ja3MgKGkuZS4gYE1TR19YWFhgKS5cbiAgcHJpdmF0ZSBpMThuR2VuZXJhdGVDbG9zdXJlVmFyKG1lc3NhZ2VJZDogc3RyaW5nKTogby5SZWFkVmFyRXhwciB7XG4gICAgbGV0IG5hbWU6IHN0cmluZztcbiAgICBjb25zdCBzdWZmaXggPSB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXgudG9VcHBlckNhc2UoKTtcbiAgICBpZiAodGhpcy5pMThuVXNlRXh0ZXJuYWxJZHMpIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoYEVYVEVSTkFMX2ApO1xuICAgICAgY29uc3QgdW5pcXVlU3VmZml4ID0gdGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShzdWZmaXgpO1xuICAgICAgbmFtZSA9IGAke3ByZWZpeH0ke3Nhbml0aXplSWRlbnRpZmllcihtZXNzYWdlSWQpfSQkJHt1bmlxdWVTdWZmaXh9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJlZml4ID0gZ2V0VHJhbnNsYXRpb25Db25zdFByZWZpeChzdWZmaXgpO1xuICAgICAgbmFtZSA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUocHJlZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIG8udmFyaWFibGUobmFtZSk7XG4gIH1cblxuICBwcml2YXRlIGkxOG5VcGRhdGVSZWYoY29udGV4dDogSTE4bkNvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCB7aWN1cywgbWV0YSwgaXNSb290LCBpc1Jlc29sdmVkLCBpc0VtaXR0ZWR9ID0gY29udGV4dDtcbiAgICBpZiAoaXNSb290ICYmIGlzUmVzb2x2ZWQgJiYgIWlzRW1pdHRlZCAmJiAhaXNTaW5nbGVJMThuSWN1KG1ldGEpKSB7XG4gICAgICBjb250ZXh0LmlzRW1pdHRlZCA9IHRydWU7XG4gICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBjb250ZXh0LmdldFNlcmlhbGl6ZWRQbGFjZWhvbGRlcnMoKTtcbiAgICAgIGxldCBpY3VNYXBwaW5nOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0gPSB7fTtcbiAgICAgIGxldCBwYXJhbXM6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9XG4gICAgICAgICAgcGxhY2Vob2xkZXJzLnNpemUgPyBwbGFjZWhvbGRlcnNUb1BhcmFtcyhwbGFjZWhvbGRlcnMpIDoge307XG4gICAgICBpZiAoaWN1cy5zaXplKSB7XG4gICAgICAgIGljdXMuZm9yRWFjaCgocmVmczogby5FeHByZXNzaW9uW10sIGtleTogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgaWYgKHJlZnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIG9uZSBJQ1UgZGVmaW5lZCBmb3IgYSBnaXZlblxuICAgICAgICAgICAgLy8gcGxhY2Vob2xkZXIgLSBqdXN0IG91dHB1dCBpdHMgcmVmZXJlbmNlXG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IHJlZnNbMF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIC4uLiBvdGhlcndpc2Ugd2UgbmVlZCB0byBhY3RpdmF0ZSBwb3N0LXByb2Nlc3NpbmdcbiAgICAgICAgICAgIC8vIHRvIHJlcGxhY2UgSUNVIHBsYWNlaG9sZGVycyB3aXRoIHByb3BlciB2YWx1ZXNcbiAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVyOiBzdHJpbmcgPSB3cmFwSTE4blBsYWNlaG9sZGVyKGAke0kxOE5fSUNVX01BUFBJTkdfUFJFRklYfSR7a2V5fWApO1xuICAgICAgICAgICAgcGFyYW1zW2tleV0gPSBvLmxpdGVyYWwocGxhY2Vob2xkZXIpO1xuICAgICAgICAgICAgaWN1TWFwcGluZ1trZXldID0gby5saXRlcmFsQXJyKHJlZnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIHRyYW5zbGF0aW9uIHJlcXVpcmVzIHBvc3QgcHJvY2Vzc2luZyBpbiAyIGNhc2VzOlxuICAgICAgLy8gLSBpZiB3ZSBoYXZlIHBsYWNlaG9sZGVycyB3aXRoIG11bHRpcGxlIHZhbHVlcyAoZXguIGBTVEFSVF9ESVZgOiBb77+9IzHvv70sIO+/vSMy77+9LCAuLi5dKVxuICAgICAgLy8gLSBpZiB3ZSBoYXZlIG11bHRpcGxlIElDVXMgdGhhdCByZWZlciB0byB0aGUgc2FtZSBwbGFjZWhvbGRlciBuYW1lXG4gICAgICBjb25zdCBuZWVkc1Bvc3Rwcm9jZXNzaW5nID1cbiAgICAgICAgICBBcnJheS5mcm9tKHBsYWNlaG9sZGVycy52YWx1ZXMoKSkuc29tZSgodmFsdWU6IHN0cmluZ1tdKSA9PiB2YWx1ZS5sZW5ndGggPiAxKSB8fFxuICAgICAgICAgIE9iamVjdC5rZXlzKGljdU1hcHBpbmcpLmxlbmd0aDtcblxuICAgICAgbGV0IHRyYW5zZm9ybUZuO1xuICAgICAgaWYgKG5lZWRzUG9zdHByb2Nlc3NpbmcpIHtcbiAgICAgICAgdHJhbnNmb3JtRm4gPSAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICAgICAgY29uc3QgYXJnczogby5FeHByZXNzaW9uW10gPSBbcmF3XTtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoKSB7XG4gICAgICAgICAgICBhcmdzLnB1c2gobWFwTGl0ZXJhbChpY3VNYXBwaW5nLCB0cnVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBpbnN0cnVjdGlvbihudWxsLCBSMy5pMThuUG9zdHByb2Nlc3MsIGFyZ3MpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5pMThuVHJhbnNsYXRlKG1ldGEgYXMgaTE4bi5NZXNzYWdlLCBwYXJhbXMsIGNvbnRleHQucmVmLCB0cmFuc2Zvcm1Gbik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpMThuU3RhcnQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBtZXRhOiBpMThuLkkxOG5NZXRhLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOlxuICAgICAgdm9pZCB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICB0aGlzLmkxOG4gPSB0aGlzLmkxOG5Db250ZXh0ID9cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dC5mb3JrQ2hpbGRDb250ZXh0KGluZGV4LCB0aGlzLnRlbXBsYXRlSW5kZXghLCBtZXRhKSA6XG4gICAgICAgIG5ldyBJMThuQ29udGV4dChpbmRleCwgdGhpcy5pMThuR2VuZXJhdGVNYWluQmxvY2tWYXIoKSwgMCwgdGhpcy50ZW1wbGF0ZUluZGV4LCBtZXRhKTtcblxuICAgIC8vIGdlbmVyYXRlIGkxOG5TdGFydCBpbnN0cnVjdGlvblxuICAgIGNvbnN0IHtpZCwgcmVmfSA9IHRoaXMuaTE4bjtcbiAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChpbmRleCksIHRoaXMuYWRkVG9Db25zdHMocmVmKV07XG4gICAgaWYgKGlkID4gMCkge1xuICAgICAgLy8gZG8gbm90IHB1c2ggM3JkIGFyZ3VtZW50IChzdWItYmxvY2sgaWQpXG4gICAgICAvLyBpbnRvIGkxOG5TdGFydCBjYWxsIGZvciB0b3AgbGV2ZWwgaTE4biBjb250ZXh0XG4gICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaWQpKTtcbiAgICB9XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIHNlbGZDbG9zaW5nID8gUjMuaTE4biA6IFIzLmkxOG5TdGFydCwgcGFyYW1zKTtcbiAgfVxuXG4gIHByaXZhdGUgaTE4bkVuZChzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCA9IG51bGwsIHNlbGZDbG9zaW5nPzogYm9vbGVhbik6IHZvaWQge1xuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2kxOG5FbmQgaXMgZXhlY3V0ZWQgd2l0aCBubyBpMThuIGNvbnRleHQgcHJlc2VudCcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5Db250ZXh0LnJlY29uY2lsZUNoaWxkQ29udGV4dCh0aGlzLmkxOG4pO1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bkNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmkxOG5VcGRhdGVSZWYodGhpcy5pMThuKTtcbiAgICB9XG5cbiAgICAvLyBzZXR1cCBhY2N1bXVsYXRlZCBiaW5kaW5nc1xuICAgIGNvbnN0IHtpbmRleCwgYmluZGluZ3N9ID0gdGhpcy5pMThuO1xuICAgIGlmIChiaW5kaW5ncy5zaXplKSB7XG4gICAgICBjb25zdCBjaGFpbkJpbmRpbmdzOiBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb25bXSA9IFtdO1xuICAgICAgYmluZGluZ3MuZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICAgICAgY2hhaW5CaW5kaW5ncy5wdXNoKHtzb3VyY2VTcGFuOiBzcGFuLCB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGJpbmRpbmcpfSk7XG4gICAgICB9KTtcbiAgICAgIC8vIGZvciBpMThuIGJsb2NrLCBhZHZhbmNlIHRvIHRoZSBtb3N0IHJlY2VudCBlbGVtZW50IGluZGV4IChieSB0YWtpbmcgdGhlIGN1cnJlbnQgbnVtYmVyIG9mXG4gICAgICAvLyBlbGVtZW50cyBhbmQgc3VidHJhY3Rpbmcgb25lKSBiZWZvcmUgaW52b2tpbmcgYGkxOG5FeHBgIGluc3RydWN0aW9ucywgdG8gbWFrZSBzdXJlIHRoZVxuICAgICAgLy8gbmVjZXNzYXJ5IGxpZmVjeWNsZSBob29rcyBvZiBjb21wb25lbnRzL2RpcmVjdGl2ZXMgYXJlIHByb3Blcmx5IGZsdXNoZWQuXG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZSh0aGlzLmdldENvbnN0Q291bnQoKSAtIDEsIFIzLmkxOG5FeHAsIGNoYWluQmluZGluZ3MpO1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzcGFuLCBSMy5pMThuQXBwbHksIFtvLmxpdGVyYWwoaW5kZXgpXSk7XG4gICAgfVxuICAgIGlmICghc2VsZkNsb3NpbmcpIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5pMThuRW5kKTtcbiAgICB9XG4gICAgdGhpcy5pMThuID0gbnVsbDsgIC8vIHJlc2V0IGxvY2FsIGkxOG4gY29udGV4dFxuICB9XG5cbiAgcHJpdmF0ZSBpMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIGF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHZvaWQge1xuICAgIGxldCBoYXNCaW5kaW5nczogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGkxOG5BdHRyQXJnczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBjb25zdCBiaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10gPSBbXTtcbiAgICBhdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGF0dHIuaTE4biEgYXMgaTE4bi5NZXNzYWdlO1xuICAgICAgY29uc3QgY29udmVydGVkID0gYXR0ci52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKGNvbnZlcnRlZCk7XG4gICAgICBpZiAoY29udmVydGVkIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBhc3NlbWJsZUJvdW5kVGV4dFBsYWNlaG9sZGVycyhtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgcGFyYW1zID0gcGxhY2Vob2xkZXJzVG9QYXJhbXMocGxhY2Vob2xkZXJzKTtcbiAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCBwYXJhbXMpKTtcbiAgICAgICAgY29udmVydGVkLmV4cHJlc3Npb25zLmZvckVhY2goZXhwcmVzc2lvbiA9PiB7XG4gICAgICAgICAgaGFzQmluZGluZ3MgPSB0cnVlO1xuICAgICAgICAgIGJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgc291cmNlU3BhbixcbiAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoZXhwcmVzc2lvbiksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChiaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZShub2RlSW5kZXgsIFIzLmkxOG5FeHAsIGJpbmRpbmdzKTtcbiAgICB9XG4gICAgaWYgKGkxOG5BdHRyQXJncy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBpbmRleDogby5FeHByZXNzaW9uID0gby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKTtcbiAgICAgIGNvbnN0IGNvbnN0SW5kZXggPSB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihpMThuQXR0ckFyZ3MpKTtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzb3VyY2VTcGFuLCBSMy5pMThuQXR0cmlidXRlcywgW2luZGV4LCBjb25zdEluZGV4XSk7XG4gICAgICBpZiAoaGFzQmluZGluZ3MpIHtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzb3VyY2VTcGFuLCBSMy5pMThuQXBwbHksIFtpbmRleF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFkZE5hbWVzcGFjZUluc3RydWN0aW9uKG5zSW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIHRoaXMuX25hbWVzcGFjZSA9IG5zSW5zdHJ1Y3Rpb247XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBuc0luc3RydWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIHVwZGF0ZSBpbnN0cnVjdGlvbiBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5IG9yIGF0dHJpYnV0ZSwgc3VjaCBhc1xuICAgKiBgcHJvcD1cInt7dmFsdWV9fVwiYCBvciBgYXR0ci50aXRsZT1cInt7dmFsdWV9fVwiYFxuICAgKi9cbiAgcHJpdmF0ZSBpbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGluc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50SW5kZXg6IG51bWJlciwgYXR0ck5hbWU6IHN0cmluZyxcbiAgICAgIGlucHV0OiB0LkJvdW5kQXR0cmlidXRlLCB2YWx1ZTogYW55LCBwYXJhbXM6IGFueVtdKSB7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbldpdGhBZHZhbmNlKFxuICAgICAgICBlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLFxuICAgICAgICAoKSA9PiBbby5saXRlcmFsKGF0dHJOYW1lKSwgLi4udGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyh2YWx1ZSksIC4uLnBhcmFtc10pO1xuICB9XG5cbiAgdmlzaXRDb250ZW50KG5nQ29udGVudDogdC5Db250ZW50KSB7XG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHByb2plY3Rpb25TbG90SWR4ID0gdGhpcy5fbmdDb250ZW50U2VsZWN0b3JzT2Zmc2V0ICsgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGg7XG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKHNsb3QpXTtcblxuICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaChuZ0NvbnRlbnQuc2VsZWN0b3IpO1xuXG4gICAgY29uc3Qgbm9uQ29udGVudFNlbGVjdEF0dHJpYnV0ZXMgPVxuICAgICAgICBuZ0NvbnRlbnQuYXR0cmlidXRlcy5maWx0ZXIoYXR0ciA9PiBhdHRyLm5hbWUudG9Mb3dlckNhc2UoKSAhPT0gTkdfQ09OVEVOVF9TRUxFQ1RfQVRUUik7XG4gICAgY29uc3QgYXR0cmlidXRlcyA9XG4gICAgICAgIHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMobmdDb250ZW50Lm5hbWUsIG5vbkNvbnRlbnRTZWxlY3RBdHRyaWJ1dGVzLCBbXSwgW10pO1xuXG4gICAgaWYgKGF0dHJpYnV0ZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCksIG8ubGl0ZXJhbEFycihhdHRyaWJ1dGVzKSk7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0aW9uU2xvdElkeCAhPT0gMCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChwcm9qZWN0aW9uU2xvdElkeCkpO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihuZ0NvbnRlbnQuc291cmNlU3BhbiwgUjMucHJvamVjdGlvbiwgcGFyYW1ldGVycyk7XG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZFByb2plY3Rpb24obmdDb250ZW50LmkxOG4hLCBzbG90KTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogdC5FbGVtZW50KSB7XG4gICAgY29uc3QgZWxlbWVudEluZGV4ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3Qgc3R5bGluZ0J1aWxkZXIgPSBuZXcgU3R5bGluZ0J1aWxkZXIobnVsbCk7XG5cbiAgICBsZXQgaXNOb25CaW5kYWJsZU1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBpc0kxOG5Sb290RWxlbWVudDogYm9vbGVhbiA9XG4gICAgICAgIGlzSTE4blJvb3ROb2RlKGVsZW1lbnQuaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShlbGVtZW50LmkxOG4pO1xuXG4gICAgY29uc3Qgb3V0cHV0QXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBIYW5kbGUgc3R5bGluZywgaTE4biwgbmdOb25CaW5kYWJsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHI7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXRBdHRycy5wdXNoKGF0dHIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1hdGNoIGRpcmVjdGl2ZXMgb24gbm9uIGkxOG4gYXR0cmlidXRlc1xuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG5cbiAgICAvLyBSZWd1bGFyIGVsZW1lbnQgb3IgbmctY29udGFpbmVyIGNyZWF0aW9uIG1vZGVcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoZWxlbWVudEluZGV4KV07XG4gICAgaWYgKCFpc05nQ29udGFpbmVyKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKGVsZW1lbnROYW1lKSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBhdHRyaWJ1dGVzXG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kSTE4bkF0dHJzOiB0LkJvdW5kQXR0cmlidXRlW10gPSBbXTtcblxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgY29uc3Qgc3R5bGluZ0lucHV0V2FzU2V0ID0gc3R5bGluZ0J1aWxkZXIucmVnaXN0ZXJCb3VuZElucHV0KGlucHV0KTtcbiAgICAgIGlmICghc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICAgIGlmIChpbnB1dC50eXBlID09PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSAmJiBpbnB1dC5pMThuKSB7XG4gICAgICAgICAgYm91bmRJMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBjb25zdCBhdHRyaWJ1dGVzOiBvLkV4cHJlc3Npb25bXSA9IHRoaXMuZ2V0QXR0cmlidXRlRXhwcmVzc2lvbnMoXG4gICAgICAgIGVsZW1lbnQubmFtZSwgb3V0cHV0QXR0cnMsIGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMsIHN0eWxpbmdCdWlsZGVyLCBbXSxcbiAgICAgICAgYm91bmRJMThuQXR0cnMpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLmFkZEF0dHJzVG9Db25zdHMoYXR0cmlidXRlcykpO1xuXG4gICAgLy8gbG9jYWwgcmVmcyAoZXguOiA8ZGl2ICNmb28gI2Jhcj1cImJhelwiPilcbiAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KGVsZW1lbnQucmVmZXJlbmNlcyk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuXG4gICAgY29uc3Qgd2FzSW5OYW1lc3BhY2UgPSB0aGlzLl9uYW1lc3BhY2U7XG4gICAgY29uc3QgY3VycmVudE5hbWVzcGFjZSA9IHRoaXMuZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5KTtcblxuICAgIC8vIElmIHRoZSBuYW1lc3BhY2UgaXMgY2hhbmdpbmcgbm93LCBpbmNsdWRlIGFuIGluc3RydWN0aW9uIHRvIGNoYW5nZSBpdFxuICAgIC8vIGR1cmluZyBlbGVtZW50IGNyZWF0aW9uLlxuICAgIGlmIChjdXJyZW50TmFtZXNwYWNlICE9PSB3YXNJbk5hbWVzcGFjZSkge1xuICAgICAgdGhpcy5hZGROYW1lc3BhY2VJbnN0cnVjdGlvbihjdXJyZW50TmFtZXNwYWNlLCBlbGVtZW50KTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmkxOG4uYXBwZW5kRWxlbWVudChlbGVtZW50LmkxOG4hLCBlbGVtZW50SW5kZXgpO1xuICAgIH1cblxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAvLyBzbyB3ZSBleGNsdWRlIHRoZW0gd2hpbGUgY2FsY3VsYXRpbmcgd2hldGhlciBjdXJyZW50IGVsZW1lbnQgaGFzIGNoaWxkcmVuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikgPyAhaGFzVGV4dENoaWxkcmVuT25seShlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzV2l0aFBpcGVzICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgYm91bmRJMThuQXR0cnMubGVuZ3RoID09PSAwICYmICFoYXNDaGlsZHJlbjtcbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0kxOG5JbnN0cnVjdGlvbiA9XG4gICAgICAgICFjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uICYmIGhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc291cmNlU3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXIgOiBSMy5lbGVtZW50LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgICAgIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0IDogUjMuZWxlbWVudFN0YXJ0LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcblxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgUjMuZGlzYWJsZUJpbmRpbmdzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJvdW5kSTE4bkF0dHJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5pMThuQXR0cmlidXRlc0luc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBib3VuZEkxOG5BdHRycywgZWxlbWVudC5zdGFydFNvdXJjZVNwYW4gPz8gZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgaWYgKGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGVsZW1lbnQub3V0cHV0cy5tYXAoXG4gICAgICAgICAgICAob3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQpID0+ICh7XG4gICAgICAgICAgICAgIHNvdXJjZVNwYW46IG91dHB1dEFzdC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICBwYXJhbXM6IHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKGVsZW1lbnQubmFtZSwgb3V0cHV0QXN0LCBlbGVtZW50SW5kZXgpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbkNoYWluKFIzLmxpc3RlbmVyLCBsaXN0ZW5lcnMpO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlOiBpdCdzIGltcG9ydGFudCB0byBrZWVwIGkxOG4vaTE4blN0YXJ0IGluc3RydWN0aW9ucyBhZnRlciBpMThuQXR0cmlidXRlcyBhbmRcbiAgICAgIC8vIGxpc3RlbmVycywgdG8gbWFrZSBzdXJlIGkxOG5BdHRyaWJ1dGVzIGluc3RydWN0aW9uIHRhcmdldHMgY3VycmVudCBlbGVtZW50IGF0IHJ1bnRpbWUuXG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuU3RhcnQoZWxlbWVudC5zdGFydFNvdXJjZVNwYW4sIGVsZW1lbnQuaTE4biEsIGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0aGUgY29kZSBoZXJlIHdpbGwgY29sbGVjdCBhbGwgdXBkYXRlLWxldmVsIHN0eWxpbmcgaW5zdHJ1Y3Rpb25zIGFuZCBhZGQgdGhlbSB0byB0aGVcbiAgICAvLyB1cGRhdGUgYmxvY2sgb2YgdGhlIHRlbXBsYXRlIGZ1bmN0aW9uIEFPVCBjb2RlLiBJbnN0cnVjdGlvbnMgbGlrZSBgc3R5bGVQcm9wYCxcbiAgICAvLyBgc3R5bGVNYXBgLCBgY2xhc3NNYXBgLCBgY2xhc3NQcm9wYFxuICAgIC8vIGFyZSBhbGwgZ2VuZXJhdGVkIGFuZCBhc3NpZ25lZCBpbiB0aGUgY29kZSBiZWxvdy5cbiAgICBjb25zdCBzdHlsaW5nSW5zdHJ1Y3Rpb25zID0gc3R5bGluZ0J1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgY29uc3QgbGltaXQgPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zLmxlbmd0aCAtIDE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zW2ldO1xuICAgICAgdGhpcy5fYmluZGluZ1Nsb3RzICs9IHRoaXMucHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihlbGVtZW50SW5kZXgsIGluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyB0aGUgcmVhc29uIHdoeSBgdW5kZWZpbmVkYCBpcyB1c2VkIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHVuZGVyc3RhbmRzIHRoaXMgYXMgYVxuICAgIC8vIHNwZWNpYWwgdmFsdWUgdG8gc3ltYm9saXplIHRoYXQgdGhlcmUgaXMgbm8gUkhTIHRvIHRoaXMgYmluZGluZ1xuICAgIC8vIFRPRE8gKG1hdHNrbyk6IHJldmlzaXQgdGhpcyBvbmNlIEZXLTk1OSBpcyBhcHByb2FjaGVkXG4gICAgY29uc3QgZW1wdHlWYWx1ZUJpbmRJbnN0cnVjdGlvbiA9IG8ubGl0ZXJhbCh1bmRlZmluZWQpO1xuICAgIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICAvLyBHZW5lcmF0ZSBlbGVtZW50IGlucHV0IGJpbmRpbmdzXG4gICAgYWxsT3RoZXJJbnB1dHMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBjb25zdCBpbnB1dFR5cGUgPSBpbnB1dC50eXBlO1xuICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAvLyBhbmltYXRpb24gYmluZGluZ3MgY2FuIGJlIHByZXNlbnRlZCBpbiB0aGUgZm9sbG93aW5nIGZvcm1hdHM6XG4gICAgICAgIC8vIDEuIFtAYmluZGluZ109XCJmb29FeHBcIlxuICAgICAgICAvLyAyLiBbQGJpbmRpbmddPVwie3ZhbHVlOmZvb0V4cCwgcGFyYW1zOnsuLi59fVwiXG4gICAgICAgIC8vIDMuIFtAYmluZGluZ11cbiAgICAgICAgLy8gNC4gQGJpbmRpbmdcbiAgICAgICAgLy8gQWxsIGZvcm1hdHMgd2lsbCBiZSB2YWxpZCBmb3Igd2hlbiBhIHN5bnRoZXRpYyBiaW5kaW5nIGlzIGNyZWF0ZWQuXG4gICAgICAgIC8vIFRoZSByZWFzb25pbmcgZm9yIHRoaXMgaXMgYmVjYXVzZSB0aGUgcmVuZGVyZXIgc2hvdWxkIGdldCBlYWNoXG4gICAgICAgIC8vIHN5bnRoZXRpYyBiaW5kaW5nIHZhbHVlIGluIHRoZSBvcmRlciBvZiB0aGUgYXJyYXkgdGhhdCB0aGV5IGFyZVxuICAgICAgICAvLyBkZWZpbmVkIGluLi4uXG4gICAgICAgIGNvbnN0IGhhc1ZhbHVlID0gdmFsdWUgaW5zdGFuY2VvZiBMaXRlcmFsUHJpbWl0aXZlID8gISF2YWx1ZS52YWx1ZSA6IHRydWU7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgIHByb3BlcnR5QmluZGluZ3MucHVzaCh7XG4gICAgICAgICAgbmFtZTogcHJlcGFyZVN5bnRoZXRpY1Byb3BlcnR5TmFtZShpbnB1dC5uYW1lKSxcbiAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgIHZhbHVlOiAoKSA9PiBoYXNWYWx1ZSA/IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSkgOiBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgbXVzdCBza2lwIGF0dHJpYnV0ZXMgd2l0aCBhc3NvY2lhdGVkIGkxOG4gY29udGV4dCwgc2luY2UgdGhlc2UgYXR0cmlidXRlcyBhcmUgaGFuZGxlZFxuICAgICAgICAvLyBzZXBhcmF0ZWx5IGFuZCBjb3JyZXNwb25kaW5nIGBpMThuRXhwYCBhbmQgYGkxOG5BcHBseWAgaW5zdHJ1Y3Rpb25zIHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICAgIGlmIChpbnB1dC5pMThuKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuICAgICAgICAgIGNvbnN0IFthdHRyTmFtZXNwYWNlLCBhdHRyTmFtZV0gPSBzcGxpdE5zTmFtZShpbnB1dC5uYW1lKTtcbiAgICAgICAgICBjb25zdCBpc0F0dHJpYnV0ZUJpbmRpbmcgPSBpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZTtcbiAgICAgICAgICBjb25zdCBzYW5pdGl6YXRpb25SZWYgPSByZXNvbHZlU2FuaXRpemF0aW9uRm4oaW5wdXQuc2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZUJpbmRpbmcpO1xuICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHBhcmFtcy5wdXNoKHNhbml0aXphdGlvblJlZik7XG4gICAgICAgICAgaWYgKGF0dHJOYW1lc3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWVzcGFjZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0ck5hbWVzcGFjZSk7XG5cbiAgICAgICAgICAgIGlmIChzYW5pdGl6YXRpb25SZWYpIHtcbiAgICAgICAgICAgICAgcGFyYW1zLnB1c2gobmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiB0aGVyZSB3YXNuJ3QgYSBzYW5pdGl6YXRpb24gcmVmLCB3ZSBuZWVkIHRvIGFkZFxuICAgICAgICAgICAgICAvLyBhbiBleHRyYSBwYXJhbSBzbyB0aGF0IHdlIGNhbiBwYXNzIGluIHRoZSBuYW1lc3BhY2UuXG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG8ubGl0ZXJhbChudWxsKSwgbmFtZXNwYWNlTGl0ZXJhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGlucHV0VHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgLy8gcHJvcD1cInt7dmFsdWV9fVwiIGFuZCBmcmllbmRzXG4gICAgICAgICAgICAgIHRoaXMuaW50ZXJwb2xhdGVkVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICAgICAgICBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFtwcm9wXT1cInZhbHVlXCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgdGhlIHByb3BlcnRpZXMgc28gdGhhdCB3ZSBjYW4gY2hhaW4gaW50byBhIHNpbmdsZSBmdW5jdGlvbiBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IGF0dHJOYW1lLFxuICAgICAgICAgICAgICAgIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgICAgdmFsdWU6ICgpID0+IHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyh2YWx1ZSksXG4gICAgICAgICAgICAgICAgcGFyYW1zXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgodmFsdWUpID4gMSkge1xuICAgICAgICAgICAgICAvLyBhdHRyLm5hbWU9XCJ0ZXh0e3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJvdW5kVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9uc1swXSA6IHZhbHVlO1xuICAgICAgICAgICAgICAvLyBbYXR0ci5uYW1lXT1cInZhbHVlXCIgb3IgYXR0ci5uYW1lPVwie3t2YWx1ZX19XCJcbiAgICAgICAgICAgICAgLy8gQ29sbGVjdCB0aGUgYXR0cmlidXRlIGJpbmRpbmdzIHNvIHRoYXQgdGhleSBjYW4gYmUgY2hhaW5lZCBhdCB0aGUgZW5kLlxuICAgICAgICAgICAgICBhdHRyaWJ1dGVCaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhdHRyTmFtZSxcbiAgICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICAgIHZhbHVlOiAoKSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoYm91bmRWYWx1ZSksXG4gICAgICAgICAgICAgICAgcGFyYW1zXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGFzcyBwcm9wXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uV2l0aEFkdmFuY2UoZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBSMy5jbGFzc1Byb3AsICgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGF0dHJOYW1lKSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKSxcbiAgICAgICAgICAgICAgICAuLi5wYXJhbXNcbiAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKHByb3BlcnR5QmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluV2l0aEFkdmFuY2UoZWxlbWVudEluZGV4LCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5ncyk7XG4gICAgfVxuXG4gICAgaWYgKGF0dHJpYnV0ZUJpbmRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgUjMuYXR0cmlidXRlLCBhdHRyaWJ1dGVCaW5kaW5ncyk7XG4gICAgfVxuXG4gICAgLy8gVHJhdmVyc2UgZWxlbWVudCBjaGlsZCBub2Rlc1xuICAgIHQudmlzaXRBbGwodGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuISwgZWxlbWVudEluZGV4LCB0cnVlKTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24pIHtcbiAgICAgIC8vIEZpbmlzaCBlbGVtZW50IGNvbnN0cnVjdGlvbiBtb2RlLlxuICAgICAgY29uc3Qgc3BhbiA9IGVsZW1lbnQuZW5kU291cmNlU3BhbiA/PyBlbGVtZW50LnNvdXJjZVNwYW47XG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuRW5kKHNwYW4sIGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc05vbkJpbmRhYmxlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgUjMuZW5hYmxlQmluZGluZ3MpO1xuICAgICAgfVxuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIGlzTmdDb250YWluZXIgPyBSMy5lbGVtZW50Q29udGFpbmVyRW5kIDogUjMuZWxlbWVudEVuZCk7XG4gICAgfVxuICB9XG5cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZSh0ZW1wbGF0ZS5pMThuISwgdGVtcGxhdGVJbmRleCk7XG4gICAgfVxuXG4gICAgY29uc3QgdGFnTmFtZSA9IHNhbml0aXplSWRlbnRpZmllcih0ZW1wbGF0ZS50YWdOYW1lIHx8ICcnKTtcbiAgICBjb25zdCBjb250ZXh0TmFtZSA9IGAke3RoaXMuY29udGV4dE5hbWV9JHt0YWdOYW1lID8gJ18nICsgdGFnTmFtZSA6ICcnfV8ke3RlbXBsYXRlSW5kZXh9YDtcbiAgICBjb25zdCB0ZW1wbGF0ZU5hbWUgPSBgJHtjb250ZXh0TmFtZX1fVGVtcGxhdGVgO1xuXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGVJbmRleCksXG4gICAgICBvLnZhcmlhYmxlKHRlbXBsYXRlTmFtZSksXG5cbiAgICAgIC8vIFdlIGRvbid0IGNhcmUgYWJvdXQgdGhlIHRhZydzIG5hbWVzcGFjZSBoZXJlLCBiZWNhdXNlIHdlIGluZmVyXG4gICAgICAvLyBpdCBiYXNlZCBvbiB0aGUgcGFyZW50IG5vZGVzIGluc2lkZSB0aGUgdGVtcGxhdGUgaW5zdHJ1Y3Rpb24uXG4gICAgICBvLmxpdGVyYWwodGVtcGxhdGUudGFnTmFtZSA/IHNwbGl0TnNOYW1lKHRlbXBsYXRlLnRhZ05hbWUpWzFdIDogdGVtcGxhdGUudGFnTmFtZSksXG4gICAgXTtcblxuICAgIC8vIGZpbmQgZGlyZWN0aXZlcyBtYXRjaGluZyBvbiBhIGdpdmVuIDxuZy10ZW1wbGF0ZT4gbm9kZVxuICAgIHRoaXMubWF0Y2hEaXJlY3RpdmVzKE5HX1RFTVBMQVRFX1RBR19OQU1FLCB0ZW1wbGF0ZSk7XG5cbiAgICAvLyBwcmVwYXJlIGF0dHJpYnV0ZXMgcGFyYW1ldGVyIChpbmNsdWRpbmcgYXR0cmlidXRlcyB1c2VkIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcpXG4gICAgY29uc3QgYXR0cnNFeHByczogby5FeHByZXNzaW9uW10gPSB0aGlzLmdldEF0dHJpYnV0ZUV4cHJlc3Npb25zKFxuICAgICAgICBOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUuYXR0cmlidXRlcywgdGVtcGxhdGUuaW5wdXRzLCB0ZW1wbGF0ZS5vdXRwdXRzLFxuICAgICAgICB1bmRlZmluZWQgLyogc3R5bGVzICovLCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcbiAgICBwYXJhbWV0ZXJzLnB1c2godGhpcy5hZGRBdHRyc1RvQ29uc3RzKGF0dHJzRXhwcnMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPG5nLXRlbXBsYXRlICNmb28+KVxuICAgIGlmICh0ZW1wbGF0ZS5yZWZlcmVuY2VzICYmIHRlbXBsYXRlLnJlZmVyZW5jZXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCByZWZzID0gdGhpcy5wcmVwYXJlUmVmc0FycmF5KHRlbXBsYXRlLnJlZmVyZW5jZXMpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuYWRkVG9Db25zdHMocmVmcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sXG4gICAgICAgIHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlTmFtZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsXG4gICAgICAgIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LCB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcyxcbiAgICAgICAgdGhpcy5fY29uc3RhbnRzKTtcblxuICAgIC8vIE5lc3RlZCB0ZW1wbGF0ZXMgbXVzdCBub3QgYmUgdmlzaXRlZCB1bnRpbCBhZnRlciB0aGVpciBwYXJlbnQgdGVtcGxhdGVzIGhhdmUgY29tcGxldGVkXG4gICAgLy8gcHJvY2Vzc2luZywgc28gdGhleSBhcmUgcXVldWVkIGhlcmUgdW50aWwgYWZ0ZXIgdGhlIGluaXRpYWwgcGFzcy4gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndFxuICAgIC8vIGJlIGFibGUgdG8gc3VwcG9ydCBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIHRvIGxvY2FsIHJlZnMgdGhhdCBvY2N1ciBhZnRlciB0aGVcbiAgICAvLyB0ZW1wbGF0ZSBkZWZpbml0aW9uLiBlLmcuIDxkaXYgKm5nSWY9XCJzaG93aW5nXCI+e3sgZm9vIH19PC9kaXY+ICA8ZGl2ICNmb28+PC9kaXY+XG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMucHVzaCgoKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwciA9IHRlbXBsYXRlVmlzaXRvci5idWlsZFRlbXBsYXRlRnVuY3Rpb24oXG4gICAgICAgICAgdGVtcGxhdGUuY2hpbGRyZW4sIHRlbXBsYXRlLnZhcmlhYmxlcyxcbiAgICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCArIHRoaXMuX25nQ29udGVudFNlbGVjdG9yc09mZnNldCwgdGVtcGxhdGUuaTE4bik7XG4gICAgICB0aGlzLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLnB1c2godGVtcGxhdGVGdW5jdGlvbkV4cHIudG9EZWNsU3RtdCh0ZW1wbGF0ZU5hbWUpKTtcbiAgICAgIGlmICh0ZW1wbGF0ZVZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMucHVzaCguLi50ZW1wbGF0ZVZpc2l0b3IuX25nQ29udGVudFJlc2VydmVkU2xvdHMpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gZS5nLiB0ZW1wbGF0ZSgxLCBNeUNvbXBfVGVtcGxhdGVfMSlcbiAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24odGVtcGxhdGUuc291cmNlU3BhbiwgUjMudGVtcGxhdGVDcmVhdGUsICgpID0+IHtcbiAgICAgIHBhcmFtZXRlcnMuc3BsaWNlKFxuICAgICAgICAgIDIsIDAsIG8ubGl0ZXJhbCh0ZW1wbGF0ZVZpc2l0b3IuZ2V0Q29uc3RDb3VudCgpKSxcbiAgICAgICAgICBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldFZhckNvdW50KCkpKTtcbiAgICAgIHJldHVybiB0cmltVHJhaWxpbmdOdWxscyhwYXJhbWV0ZXJzKTtcbiAgICB9KTtcblxuICAgIC8vIGhhbmRsZSBwcm9wZXJ0eSBiaW5kaW5ncyBlLmcuIMm1ybVwcm9wZXJ0eSgnbmdGb3JPZicsIGN0eC5pdGVtcyksIGV0IGFsO1xuICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMpO1xuXG4gICAgLy8gT25seSBhZGQgbm9ybWFsIGlucHV0L291dHB1dCBiaW5kaW5nIGluc3RydWN0aW9ucyBvbiBleHBsaWNpdCA8bmctdGVtcGxhdGU+IGVsZW1lbnRzLlxuICAgIGlmICh0ZW1wbGF0ZS50YWdOYW1lID09PSBOR19URU1QTEFURV9UQUdfTkFNRSkge1xuICAgICAgY29uc3QgW2kxOG5JbnB1dHMsIGlucHV0c10gPVxuICAgICAgICAgIHBhcnRpdGlvbkFycmF5PHQuQm91bmRBdHRyaWJ1dGUsIHQuQm91bmRBdHRyaWJ1dGU+KHRlbXBsYXRlLmlucHV0cywgaGFzSTE4bk1ldGEpO1xuXG4gICAgICAvLyBBZGQgaTE4biBhdHRyaWJ1dGVzIHRoYXQgbWF5IGFjdCBhcyBpbnB1dHMgdG8gZGlyZWN0aXZlcy4gSWYgc3VjaCBhdHRyaWJ1dGVzIGFyZSBwcmVzZW50LFxuICAgICAgLy8gZ2VuZXJhdGUgYGkxOG5BdHRyaWJ1dGVzYCBpbnN0cnVjdGlvbi4gTm90ZTogd2UgZ2VuZXJhdGUgaXQgb25seSBmb3IgZXhwbGljaXQgPG5nLXRlbXBsYXRlPlxuICAgICAgLy8gZWxlbWVudHMsIGluIGNhc2Ugb2YgaW5saW5lIHRlbXBsYXRlcywgY29ycmVzcG9uZGluZyBpbnN0cnVjdGlvbnMgd2lsbCBiZSBnZW5lcmF0ZWQgaW4gdGhlXG4gICAgICAvLyBuZXN0ZWQgdGVtcGxhdGUgZnVuY3Rpb24uXG4gICAgICBpZiAoaTE4bklucHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMuaTE4bkF0dHJpYnV0ZXNJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIHRlbXBsYXRlSW5kZXgsIGkxOG5JbnB1dHMsIHRlbXBsYXRlLnN0YXJ0U291cmNlU3BhbiA/PyB0ZW1wbGF0ZS5zb3VyY2VTcGFuKTtcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRoZSBpbnB1dCBiaW5kaW5nc1xuICAgICAgaWYgKGlucHV0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlSW5kZXgsIGlucHV0cyk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdlbmVyYXRlIGxpc3RlbmVycyBmb3IgZGlyZWN0aXZlIG91dHB1dFxuICAgICAgaWYgKHRlbXBsYXRlLm91dHB1dHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0ZW1wbGF0ZS5vdXRwdXRzLm1hcChcbiAgICAgICAgICAgIChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4gKHtcbiAgICAgICAgICAgICAgc291cmNlU3Bhbjogb3V0cHV0QXN0LnNvdXJjZVNwYW4sXG4gICAgICAgICAgICAgIHBhcmFtczogdGhpcy5wcmVwYXJlTGlzdGVuZXJQYXJhbWV0ZXIoJ25nX3RlbXBsYXRlJywgb3V0cHV0QXN0LCB0ZW1wbGF0ZUluZGV4KVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihSMy5saXN0ZW5lciwgbGlzdGVuZXJzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBUaGVzZSBzaG91bGQgYmUgaGFuZGxlZCBpbiB0aGUgdGVtcGxhdGUgb3IgZWxlbWVudCBkaXJlY3RseS5cbiAgcmVhZG9ubHkgdmlzaXRSZWZlcmVuY2UgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFZhcmlhYmxlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRUZXh0QXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEF0dHJpYnV0ZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0Qm91bmRFdmVudCA9IGludmFsaWQ7XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogdC5Cb3VuZFRleHQpIHtcbiAgICBpZiAodGhpcy5pMThuKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRleHQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRoaXMuaTE4bi5hcHBlbmRCb3VuZFRleHQodGV4dC5pMThuISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgICAgICBub2RlSW5kZXgsIHRleHQuc291cmNlU3BhbiwgZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSxcbiAgICAgICAgICAoKSA9PiB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVycm9yKCdUZXh0IG5vZGVzIHNob3VsZCBiZSBpbnRlcnBvbGF0ZWQgYW5kIG5ldmVyIGJvdW5kIGRpcmVjdGx5LicpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB0LlRleHQpIHtcbiAgICAvLyB3aGVuIGEgdGV4dCBlbGVtZW50IGlzIGxvY2F0ZWQgd2l0aGluIGEgdHJhbnNsYXRhYmxlXG4gICAgLy8gYmxvY2ssIHdlIGV4Y2x1ZGUgdGhpcyB0ZXh0IGVsZW1lbnQgZnJvbSBpbnN0cnVjdGlvbnMgc2V0LFxuICAgIC8vIHNpbmNlIGl0IHdpbGwgYmUgY2FwdHVyZWQgaW4gaTE4biBjb250ZW50IGFuZCBwcm9jZXNzZWQgYXQgcnVudGltZVxuICAgIGlmICghdGhpcy5pMThuKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgdGV4dC5zb3VyY2VTcGFuLCBSMy50ZXh0LCBbby5saXRlcmFsKHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpKSwgby5saXRlcmFsKHRleHQudmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiB0LkljdSkge1xuICAgIGxldCBpbml0V2FzSW52b2tlZCA9IGZhbHNlO1xuXG4gICAgLy8gaWYgYW4gSUNVIHdhcyBjcmVhdGVkIG91dHNpZGUgb2YgaTE4biBibG9jaywgd2Ugc3RpbGwgdHJlYXRcbiAgICAvLyBpdCBhcyBhIHRyYW5zbGF0YWJsZSBlbnRpdHkgYW5kIGludm9rZSBpMThuU3RhcnQgYW5kIGkxOG5FbmRcbiAgICAvLyB0byBnZW5lcmF0ZSBpMThuIGNvbnRleHQgYW5kIHRoZSBuZWNlc3NhcnkgaW5zdHJ1Y3Rpb25zXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIGluaXRXYXNJbnZva2VkID0gdHJ1ZTtcbiAgICAgIHRoaXMuaTE4blN0YXJ0KG51bGwsIGljdS5pMThuISwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4biA9IHRoaXMuaTE4biE7XG4gICAgY29uc3QgdmFycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UudmFycyk7XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdGhpcy5pMThuQmluZFByb3BzKGljdS5wbGFjZWhvbGRlcnMpO1xuXG4gICAgLy8gb3V0cHV0IElDVSBkaXJlY3RseSBhbmQga2VlcCBJQ1UgcmVmZXJlbmNlIGluIGNvbnRleHRcbiAgICBjb25zdCBtZXNzYWdlID0gaWN1LmkxOG4hIGFzIGkxOG4uTWVzc2FnZTtcblxuICAgIC8vIHdlIGFsd2F5cyBuZWVkIHBvc3QtcHJvY2Vzc2luZyBmdW5jdGlvbiBmb3IgSUNVcywgdG8gbWFrZSBzdXJlIHRoYXQ6XG4gICAgLy8gLSBhbGwgcGxhY2Vob2xkZXJzIGluIGEgZm9ybSBvZiB7UExBQ0VIT0xERVJ9IGFyZSByZXBsYWNlZCB3aXRoIGFjdHVhbCB2YWx1ZXMgKG5vdGU6XG4gICAgLy8gYGdvb2cuZ2V0TXNnYCBkb2VzIG5vdCBwcm9jZXNzIElDVXMgYW5kIHVzZXMgdGhlIGB7UExBQ0VIT0xERVJ9YCBmb3JtYXQgZm9yIHBsYWNlaG9sZGVyc1xuICAgIC8vIGluc2lkZSBJQ1VzKVxuICAgIC8vIC0gYWxsIElDVSB2YXJzIChzdWNoIGFzIGBWQVJfU0VMRUNUYCBvciBgVkFSX1BMVVJBTGApIGFyZSByZXBsYWNlZCB3aXRoIGNvcnJlY3QgdmFsdWVzXG4gICAgY29uc3QgdHJhbnNmb3JtRm4gPSAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7Li4udmFycywgLi4ucGxhY2Vob2xkZXJzfTtcbiAgICAgIGNvbnN0IGZvcm1hdHRlZCA9IGkxOG5Gb3JtYXRQbGFjZWhvbGRlck5hbWVzKHBhcmFtcywgLyogdXNlQ2FtZWxDYXNlICovIGZhbHNlKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihudWxsLCBSMy5pMThuUG9zdHByb2Nlc3MsIFtyYXcsIG1hcExpdGVyYWwoZm9ybWF0dGVkLCB0cnVlKV0pO1xuICAgIH07XG5cbiAgICAvLyBpbiBjYXNlIHRoZSB3aG9sZSBpMThuIG1lc3NhZ2UgaXMgYSBzaW5nbGUgSUNVIC0gd2UgZG8gbm90IG5lZWQgdG9cbiAgICAvLyBjcmVhdGUgYSBzZXBhcmF0ZSB0b3AtbGV2ZWwgdHJhbnNsYXRpb24sIHdlIGNhbiB1c2UgdGhlIHJvb3QgcmVmIGluc3RlYWRcbiAgICAvLyBhbmQgbWFrZSB0aGlzIElDVSBhIHRvcC1sZXZlbCB0cmFuc2xhdGlvblxuICAgIC8vIG5vdGU6IElDVSBwbGFjZWhvbGRlcnMgYXJlIHJlcGxhY2VkIHdpdGggYWN0dWFsIHZhbHVlcyBpbiBgaTE4blBvc3Rwcm9jZXNzYCBmdW5jdGlvblxuICAgIC8vIHNlcGFyYXRlbHksIHNvIHdlIGRvIG5vdCBwYXNzIHBsYWNlaG9sZGVycyBpbnRvIGBpMThuVHJhbnNsYXRlYCBmdW5jdGlvbi5cbiAgICBpZiAoaXNTaW5nbGVJMThuSWN1KGkxOG4ubWV0YSkpIHtcbiAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCAvKiBwbGFjZWhvbGRlcnMgKi8ge30sIGkxOG4ucmVmLCB0cmFuc2Zvcm1Gbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgICBjb25zdCByZWYgPVxuICAgICAgICAgIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlLCAvKiBwbGFjZWhvbGRlcnMgKi8ge30sIC8qIHJlZiAqLyB1bmRlZmluZWQsIHRyYW5zZm9ybUZuKTtcbiAgICAgIGkxOG4uYXBwZW5kSWN1KGljdUZyb21JMThuTWVzc2FnZShtZXNzYWdlKS5uYW1lLCByZWYpO1xuICAgIH1cblxuICAgIGlmIChpbml0V2FzSW52b2tlZCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHRydWUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYWxsb2NhdGVEYXRhU2xvdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGF0YUluZGV4Kys7XG4gIH1cblxuICBnZXRDb25zdENvdW50KCkge1xuICAgIHJldHVybiB0aGlzLl9kYXRhSW5kZXg7XG4gIH1cblxuICBnZXRWYXJDb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcHVyZUZ1bmN0aW9uU2xvdHM7XG4gIH1cblxuICBnZXRDb25zdHMoKTogQ29tcG9uZW50RGVmQ29uc3RzIHtcbiAgICByZXR1cm4gdGhpcy5fY29uc3RhbnRzO1xuICB9XG5cbiAgZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMpLCB0cnVlKSA6XG4gICAgICAgIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGJpbmRpbmdDb250ZXh0KCkge1xuICAgIHJldHVybiBgJHt0aGlzLl9iaW5kaW5nQ29udGV4dCsrfWA7XG4gIH1cblxuICBwcml2YXRlIHRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyhcbiAgICAgIHRlbXBsYXRlSW5kZXg6IG51bWJlciwgYXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSkge1xuICAgIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG4gICAgYXR0cnMuZm9yRWFjaChpbnB1dCA9PiB7XG4gICAgICBpZiAoaW5wdXQgaW5zdGFuY2VvZiB0LkJvdW5kQXR0cmlidXRlKSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuXG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJwb2xhdGlvbikge1xuICAgICAgICAgICAgLy8gUGFyYW1zIHR5cGljYWxseSBjb250YWluIGF0dHJpYnV0ZSBuYW1lc3BhY2UgYW5kIHZhbHVlIHNhbml0aXplciwgd2hpY2ggaXMgYXBwbGljYWJsZVxuICAgICAgICAgICAgLy8gZm9yIHJlZ3VsYXIgSFRNTCBlbGVtZW50cywgYnV0IG5vdCBhcHBsaWNhYmxlIGZvciA8bmctdGVtcGxhdGU+IChzaW5jZSBwcm9wcyBhY3QgYXNcbiAgICAgICAgICAgIC8vIGlucHV0cyB0byBkaXJlY3RpdmVzKSwgc28ga2VlcCBwYXJhbXMgYXJyYXkgZW1wdHkuXG4gICAgICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBjYXNlXG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24odmFsdWUpLCB0ZW1wbGF0ZUluZGV4LCBpbnB1dC5uYW1lLCBpbnB1dCwgdmFsdWUsXG4gICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gW3Byb3BdPVwidmFsdWVcIiBjYXNlXG4gICAgICAgICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lOiBpbnB1dC5uYW1lLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgICB2YWx1ZTogKCkgPT4gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvcGVydHlCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uQ2hhaW5XaXRoQWR2YW5jZSh0ZW1wbGF0ZUluZGV4LCBSMy5wcm9wZXJ0eSwgcHJvcGVydHlCaW5kaW5ncyk7XG4gICAgfVxuICB9XG5cbiAgLy8gQmluZGluZ3MgbXVzdCBvbmx5IGJlIHJlc29sdmVkIGFmdGVyIGFsbCBsb2NhbCByZWZzIGhhdmUgYmVlbiB2aXNpdGVkLCBzbyBhbGxcbiAgLy8gaW5zdHJ1Y3Rpb25zIGFyZSBxdWV1ZWQgaW4gY2FsbGJhY2tzIHRoYXQgZXhlY3V0ZSBvbmNlIHRoZSBpbml0aWFsIHBhc3MgaGFzIGNvbXBsZXRlZC5cbiAgLy8gT3RoZXJ3aXNlLCB3ZSB3b3VsZG4ndCBiZSBhYmxlIHRvIHN1cHBvcnQgbG9jYWwgcmVmcyB0aGF0IGFyZSBkZWZpbmVkIGFmdGVyIHRoZWlyXG4gIC8vIGJpbmRpbmdzLiBlLmcuIHt7IGZvbyB9fSA8ZGl2ICNmb28+PC9kaXY+XG4gIHByaXZhdGUgaW5zdHJ1Y3Rpb25GbihcbiAgICAgIGZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbjogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSwgcHJlcGVuZDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG4gICAgZm5zW3ByZXBlbmQgPyAndW5zaGlmdCcgOiAncHVzaCddKCgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IEFycmF5LmlzQXJyYXkocGFyYW1zT3JGbikgPyBwYXJhbXNPckZuIDogcGFyYW1zT3JGbigpO1xuICAgICAgcmV0dXJuIGluc3RydWN0aW9uKHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJvY2Vzc1N0eWxpbmdVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIGVsZW1lbnRJbmRleDogbnVtYmVyLCBpbnN0cnVjdGlvbjogU3R5bGluZ0luc3RydWN0aW9ufG51bGwpIHtcbiAgICBsZXQgYWxsb2NhdGVCaW5kaW5nU2xvdHMgPSAwO1xuICAgIGlmIChpbnN0cnVjdGlvbikge1xuICAgICAgY29uc3QgY2FsbHM6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdID0gW107XG5cbiAgICAgIGluc3RydWN0aW9uLmNhbGxzLmZvckVhY2goY2FsbCA9PiB7XG4gICAgICAgIGFsbG9jYXRlQmluZGluZ1Nsb3RzICs9IGNhbGwuYWxsb2NhdGVCaW5kaW5nU2xvdHM7XG4gICAgICAgIGNhbGxzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZVNwYW46IGNhbGwuc291cmNlU3BhbixcbiAgICAgICAgICB2YWx1ZTogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGwucGFyYW1zKFxuICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9PiAoY2FsbC5zdXBwb3J0c0ludGVycG9sYXRpb24gJiYgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodmFsdWUpKSBhcyBvLkV4cHJlc3Npb25bXTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKGVsZW1lbnRJbmRleCwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBjYWxscyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGlvbkluc3RydWN0aW9uKFxuICAgICAgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pLCBwcmVwZW5kPzogYm9vbGVhbikge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl9jcmVhdGlvbkNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSwgcHJlcGVuZCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb25DaGFpbihyZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGNhbGxzOiB7XG4gICAgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsXG4gICAgcGFyYW1zOiAoKSA9PiBvLkV4cHJlc3Npb25bXVxuICB9W10pIHtcbiAgICBjb25zdCBzcGFuID0gY2FsbHMubGVuZ3RoID8gY2FsbHNbMF0uc291cmNlU3BhbiA6IG51bGw7XG4gICAgdGhpcy5fY3JlYXRpb25Db2RlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgcmV0dXJuIGNoYWluZWRJbnN0cnVjdGlvbihyZWZlcmVuY2UsIGNhbGxzLm1hcChjYWxsID0+IGNhbGwucGFyYW1zKCkpLCBzcGFuKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb25XaXRoQWR2YW5jZShcbiAgICAgIG5vZGVJbmRleDogbnVtYmVyLCBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSkpIHtcbiAgICB0aGlzLmFkZEFkdmFuY2VJbnN0cnVjdGlvbklmTmVjZXNzYXJ5KG5vZGVJbmRleCwgc3Bhbik7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgICBwYXJhbXNPckZuPzogby5FeHByZXNzaW9uW118KCgpID0+IG8uRXhwcmVzc2lvbltdKSkge1xuICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCByZWZlcmVuY2UsIHBhcmFtc09yRm4gfHwgW10pO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVJbnN0cnVjdGlvbkNoYWluKFxuICAgICAgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBiaW5kaW5nczogQ2hhaW5hYmxlQmluZGluZ0luc3RydWN0aW9uW10pIHtcbiAgICBjb25zdCBzcGFuID0gYmluZGluZ3MubGVuZ3RoID8gYmluZGluZ3NbMF0uc291cmNlU3BhbiA6IG51bGw7XG5cbiAgICB0aGlzLl91cGRhdGVDb2RlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgY2FsbHMgPSBiaW5kaW5ncy5tYXAocHJvcGVydHkgPT4ge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3BlcnR5LnZhbHVlKCk7XG4gICAgICAgIGNvbnN0IGZuUGFyYW1zID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFt2YWx1ZV07XG4gICAgICAgIGlmIChwcm9wZXJ0eS5wYXJhbXMpIHtcbiAgICAgICAgICBmblBhcmFtcy5wdXNoKC4uLnByb3BlcnR5LnBhcmFtcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BlcnR5Lm5hbWUpIHtcbiAgICAgICAgICAvLyBXZSB3YW50IHRoZSBwcm9wZXJ0eSBuYW1lIHRvIGFsd2F5cyBiZSB0aGUgZmlyc3QgZnVuY3Rpb24gcGFyYW1ldGVyLlxuICAgICAgICAgIGZuUGFyYW1zLnVuc2hpZnQoby5saXRlcmFsKHByb3BlcnR5Lm5hbWUpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZm5QYXJhbXM7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGNoYWluZWRJbnN0cnVjdGlvbihyZWZlcmVuY2UsIGNhbGxzLCBzcGFuKS50b1N0bXQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb25DaGFpbldpdGhBZHZhbmNlKFxuICAgICAgbm9kZUluZGV4OiBudW1iZXIsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSwgYmluZGluZ3M6IENoYWluYWJsZUJpbmRpbmdJbnN0cnVjdGlvbltdKSB7XG4gICAgdGhpcy5hZGRBZHZhbmNlSW5zdHJ1Y3Rpb25JZk5lY2Vzc2FyeShcbiAgICAgICAgbm9kZUluZGV4LCBiaW5kaW5ncy5sZW5ndGggPyBiaW5kaW5nc1swXS5zb3VyY2VTcGFuIDogbnVsbCk7XG4gICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbkNoYWluKHJlZmVyZW5jZSwgYmluZGluZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRBZHZhbmNlSW5zdHJ1Y3Rpb25JZk5lY2Vzc2FyeShub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBpZiAobm9kZUluZGV4ICE9PSB0aGlzLl9jdXJyZW50SW5kZXgpIHtcbiAgICAgIGNvbnN0IGRlbHRhID0gbm9kZUluZGV4IC0gdGhpcy5fY3VycmVudEluZGV4O1xuXG4gICAgICBpZiAoZGVsdGEgPCAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYWR2YW5jZSBpbnN0cnVjdGlvbiBjYW4gb25seSBnbyBmb3J3YXJkcycpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmluc3RydWN0aW9uRm4odGhpcy5fdXBkYXRlQ29kZUZucywgc3BhbiwgUjMuYWR2YW5jZSwgW28ubGl0ZXJhbChkZWx0YSldKTtcbiAgICAgIHRoaXMuX2N1cnJlbnRJbmRleCA9IG5vZGVJbmRleDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3Qgb3JpZ2luYWxTbG90cyA9IHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IG51bVNsb3RzO1xuICAgIHJldHVybiBvcmlnaW5hbFNsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZTogQVNUfG51bGwpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIGFuIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gdGhlIGltcGxpY2l0IHJlY2VpdmVyLiBUaGUgaW1wbGljaXRcbiAgICogcmVjZWl2ZXIgaXMgYWx3YXlzIHRoZSByb290IGxldmVsIGNvbnRleHQuXG4gICAqL1xuICBwcml2YXRlIGdldEltcGxpY2l0UmVjZWl2ZXJFeHByKCk6IG8uUmVhZFZhckV4cHIge1xuICAgIGlmICh0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwcikge1xuICAgICAgcmV0dXJuIHRoaXMuX2ltcGxpY2l0UmVjZWl2ZXJFeHByO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pbXBsaWNpdFJlY2VpdmVyRXhwciA9IHRoaXMubGV2ZWwgPT09IDAgP1xuICAgICAgICBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSkgOlxuICAgICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuZ2V0T3JDcmVhdGVTaGFyZWRDb250ZXh0VmFyKDApO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgIHRoaXMsIHRoaXMuZ2V0SW1wbGljaXRSZWNlaXZlckV4cHIoKSwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uRXhwcmVzc2lvbixcbiAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgaW50ZXJwb2xhdGlvbicpKTtcbiAgICBjb25zdCB2YWxFeHByID0gY29udmVydGVkUHJvcGVydHlCaW5kaW5nLmN1cnJWYWxFeHByO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuICAgIHJldHVybiB2YWxFeHByO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYSBsaXN0IG9mIGFyZ3VtZW50IGV4cHJlc3Npb25zIHRvIHBhc3MgdG8gYW4gdXBkYXRlIGluc3RydWN0aW9uIGV4cHJlc3Npb24uIEFsc28gdXBkYXRlc1xuICAgKiB0aGUgdGVtcCB2YXJpYWJsZXMgc3RhdGUgd2l0aCB0ZW1wIHZhcmlhYmxlcyB0aGF0IHdlcmUgaWRlbnRpZmllZCBhcyBuZWVkaW5nIHRvIGJlIGNyZWF0ZWRcbiAgICogd2hpbGUgdmlzaXRpbmcgdGhlIGFyZ3VtZW50cy5cbiAgICogQHBhcmFtIHZhbHVlIFRoZSBvcmlnaW5hbCBleHByZXNzaW9uIHdlIHdpbGwgYmUgcmVzb2x2aW5nIGFuIGFyZ3VtZW50cyBsaXN0IGZyb20uXG4gICAqL1xuICBwcml2YXRlIGdldFVwZGF0ZUluc3RydWN0aW9uQXJndW1lbnRzKHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3Qge2FyZ3MsIHN0bXRzfSA9XG4gICAgICAgIGNvbnZlcnRVcGRhdGVBcmd1bWVudHModGhpcywgdGhpcy5nZXRJbXBsaWNpdFJlY2VpdmVyRXhwcigpLCB2YWx1ZSwgdGhpcy5iaW5kaW5nQ29udGV4dCgpKTtcblxuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBwcml2YXRlIG1hdGNoRGlyZWN0aXZlcyhlbGVtZW50TmFtZTogc3RyaW5nLCBlbE9yVHBsOiB0LkVsZW1lbnR8dC5UZW1wbGF0ZSkge1xuICAgIGlmICh0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpIHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoZWxlbWVudE5hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcoZWxPclRwbCkpO1xuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLm1hdGNoKHNlbGVjdG9yLCAoY3NzU2VsZWN0b3IsIHN0YXRpY1R5cGUpID0+IHtcbiAgICAgICAgdGhpcy5kaXJlY3RpdmVzLmFkZChzdGF0aWNUeXBlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBQUk9KRUNUX0FTLCBzZWxlY3RvcixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBdHRyaWJ1dGVFeHByZXNzaW9ucyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHJlbmRlckF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdLCBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSxcbiAgICAgIG91dHB1dHM6IHQuQm91bmRFdmVudFtdLCBzdHlsZXM/OiBTdHlsaW5nQnVpbGRlcixcbiAgICAgIHRlbXBsYXRlQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdLFxuICAgICAgYm91bmRJMThuQXR0cnM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICAgIGxldCBuZ1Byb2plY3RBc0F0dHI6IHQuVGV4dEF0dHJpYnV0ZXx1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHIgb2YgcmVuZGVyQXR0cmlidXRlcykge1xuICAgICAgaWYgKGF0dHIubmFtZSA9PT0gTkdfUFJPSkVDVF9BU19BVFRSX05BTUUpIHtcbiAgICAgICAgbmdQcm9qZWN0QXNBdHRyID0gYXR0cjtcbiAgICAgIH1cblxuICAgICAgLy8gTm90ZSB0aGF0IHN0YXRpYyBpMThuIGF0dHJpYnV0ZXMgYXJlbid0IGluIHRoZSBpMThuIGFycmF5LFxuICAgICAgLy8gYmVjYXVzZSB0aGV5J3JlIHRyZWF0ZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHJlZ3VsYXIgYXR0cmlidXRlcy5cbiAgICAgIGlmIChhdHRyLmkxOG4pIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShhdHRyLmkxOG4gYXMgaTE4bi5NZXNzYWdlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdHRyRXhwcnMucHVzaChcbiAgICAgICAgICAgIC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhhdHRyLm5hbWUpLCB0cnVzdGVkQ29uc3RBdHRyaWJ1dGUoZWxlbWVudE5hbWUsIGF0dHIpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBLZWVwIG5nUHJvamVjdEFzIG5leHQgdG8gdGhlIG90aGVyIG5hbWUsIHZhbHVlIHBhaXJzIHNvIHdlIGNhbiB2ZXJpZnkgdGhhdCB3ZSBtYXRjaFxuICAgIC8vIG5nUHJvamVjdEFzIG1hcmtlciBpbiB0aGUgYXR0cmlidXRlIG5hbWUgc2xvdC5cbiAgICBpZiAobmdQcm9qZWN0QXNBdHRyKSB7XG4gICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXROZ1Byb2plY3RBc0xpdGVyYWwobmdQcm9qZWN0QXNBdHRyKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkQXR0ckV4cHIoa2V5OiBzdHJpbmd8bnVtYmVyLCB2YWx1ZT86IG8uRXhwcmVzc2lvbik6IHZvaWQge1xuICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghYWxyZWFkeVNlZW4uaGFzKGtleSkpIHtcbiAgICAgICAgICBhdHRyRXhwcnMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoa2V5KSk7XG4gICAgICAgICAgdmFsdWUgIT09IHVuZGVmaW5lZCAmJiBhdHRyRXhwcnMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgYWxyZWFkeVNlZW4uYWRkKGtleSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChrZXkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpdCdzIGltcG9ydGFudCB0aGF0IHRoaXMgb2NjdXJzIGJlZm9yZSBCSU5ESU5HUyBhbmQgVEVNUExBVEUgYmVjYXVzZSBvbmNlIGBlbGVtZW50U3RhcnRgXG4gICAgLy8gY29tZXMgYWNyb3NzIHRoZSBCSU5ESU5HUyBvciBURU1QTEFURSBtYXJrZXJzIHRoZW4gaXQgd2lsbCBjb250aW51ZSByZWFkaW5nIGVhY2ggdmFsdWUgYXNcbiAgICAvLyBhcyBzaW5nbGUgcHJvcGVydHkgdmFsdWUgY2VsbCBieSBjZWxsLlxuICAgIGlmIChzdHlsZXMpIHtcbiAgICAgIHN0eWxlcy5wb3B1bGF0ZUluaXRpYWxTdHlsaW5nQXR0cnMoYXR0ckV4cHJzKTtcbiAgICB9XG5cbiAgICBpZiAoaW5wdXRzLmxlbmd0aCB8fCBvdXRwdXRzLmxlbmd0aCkge1xuICAgICAgY29uc3QgYXR0cnNMZW5ndGhCZWZvcmVJbnB1dHMgPSBhdHRyRXhwcnMubGVuZ3RoO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1tpXTtcbiAgICAgICAgLy8gV2UgZG9uJ3Qgd2FudCB0aGUgYW5pbWF0aW9uIGFuZCBhdHRyaWJ1dGUgYmluZGluZ3MgaW4gdGhlXG4gICAgICAgIC8vIGF0dHJpYnV0ZXMgYXJyYXkgc2luY2UgdGhleSBhcmVuJ3QgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgICAgICBpZiAoaW5wdXQudHlwZSAhPT0gQmluZGluZ1R5cGUuQW5pbWF0aW9uICYmIGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkF0dHJpYnV0ZSkge1xuICAgICAgICAgIGFkZEF0dHJFeHByKGlucHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2ldO1xuICAgICAgICBpZiAob3V0cHV0LnR5cGUgIT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihvdXRwdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhIGNoZWFwIHdheSBvZiBhZGRpbmcgdGhlIG1hcmtlciBvbmx5IGFmdGVyIGFsbCB0aGUgaW5wdXQvb3V0cHV0XG4gICAgICAvLyB2YWx1ZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIChieSBub3QgaW5jbHVkaW5nIHRoZSBhbmltYXRpb24gb25lcykgYW5kIGFkZGVkXG4gICAgICAvLyB0byB0aGUgZXhwcmVzc2lvbnMuIFRoZSBtYXJrZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaXQgdGVsbHMgdGhlIHJ1bnRpbWVcbiAgICAgIC8vIGNvZGUgdGhhdCB0aGlzIGlzIHdoZXJlIGF0dHJpYnV0ZXMgd2l0aG91dCB2YWx1ZXMgc3RhcnQuLi5cbiAgICAgIGlmIChhdHRyRXhwcnMubGVuZ3RoICE9PSBhdHRyc0xlbmd0aEJlZm9yZUlucHV0cykge1xuICAgICAgICBhdHRyRXhwcnMuc3BsaWNlKGF0dHJzTGVuZ3RoQmVmb3JlSW5wdXRzLCAwLCBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVtcGxhdGVBdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSkpO1xuICAgICAgdGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKGJvdW5kSTE4bkF0dHJzLmxlbmd0aCkge1xuICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGNvcmUuQXR0cmlidXRlTWFya2VyLkkxOG4pKTtcbiAgICAgIGJvdW5kSTE4bkF0dHJzLmZvckVhY2goYXR0ciA9PiBhZGRBdHRyRXhwcihhdHRyLm5hbWUpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ckV4cHJzO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRUb0NvbnN0cyhleHByZXNzaW9uOiBvLkV4cHJlc3Npb24pOiBvLkxpdGVyYWxFeHByIHtcbiAgICBpZiAoby5pc051bGwoZXhwcmVzc2lvbikpIHtcbiAgICAgIHJldHVybiBvLlRZUEVEX05VTExfRVhQUjtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHMgPSB0aGlzLl9jb25zdGFudHMuY29uc3RFeHByZXNzaW9ucztcblxuICAgIC8vIFRyeSB0byByZXVzZSBhIGxpdGVyYWwgdGhhdCdzIGFscmVhZHkgaW4gdGhlIGFycmF5LCBpZiBwb3NzaWJsZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGNvbnN0c1tpXS5pc0VxdWl2YWxlbnQoZXhwcmVzc2lvbikpIHtcbiAgICAgICAgcmV0dXJuIG8ubGl0ZXJhbChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gby5saXRlcmFsKGNvbnN0cy5wdXNoKGV4cHJlc3Npb24pIC0gMSk7XG4gIH1cblxuICBwcml2YXRlIGFkZEF0dHJzVG9Db25zdHMoYXR0cnM6IG8uRXhwcmVzc2lvbltdKTogby5MaXRlcmFsRXhwciB7XG4gICAgcmV0dXJuIGF0dHJzLmxlbmd0aCA+IDAgPyB0aGlzLmFkZFRvQ29uc3RzKG8ubGl0ZXJhbEFycihhdHRycykpIDogby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzQXJyYXkocmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFyZWZlcmVuY2VzIHx8IHJlZmVyZW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gby5UWVBFRF9OVUxMX0VYUFI7XG4gICAgfVxuXG4gICAgY29uc3QgcmVmc1BhcmFtID0gZmxhdHRlbihyZWZlcmVuY2VzLm1hcChyZWZlcmVuY2UgPT4ge1xuICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgICAgLy8gR2VuZXJhdGUgdGhlIHVwZGF0ZSB0ZW1wb3JhcnkuXG4gICAgICBjb25zdCB2YXJpYWJsZU5hbWUgPSB0aGlzLl9iaW5kaW5nU2NvcGUuZnJlc2hSZWZlcmVuY2VOYW1lKCk7XG4gICAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XG4gICAgICB0aGlzLl9iaW5kaW5nU2NvcGUuc2V0KFxuICAgICAgICAgIHJldHJpZXZhbExldmVsLCByZWZlcmVuY2UubmFtZSwgbGhzLFxuICAgICAgICAgIERlY2xhcmF0aW9uUHJpb3JpdHkuREVGQVVMVCwgKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgLy8gZS5nLiBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgICAgIGNvbnN0IG5leHRDb250ZXh0U3RtdCA9XG4gICAgICAgICAgICAgICAgcmVsYXRpdmVMZXZlbCA+IDAgPyBbZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCkudG9TdG10KCldIDogW107XG5cbiAgICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGZvbyQgPSByZWZlcmVuY2UoMSk7XG4gICAgICAgICAgICBjb25zdCByZWZFeHByID0gbGhzLnNldChvLmltcG9ydEV4cHIoUjMucmVmZXJlbmNlKS5jYWxsRm4oW28ubGl0ZXJhbChzbG90KV0pKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0Q29udGV4dFN0bXQuY29uY2F0KHJlZkV4cHIudG9Db25zdERlY2woKSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICByZXR1cm4gW3JlZmVyZW5jZS5uYW1lLCByZWZlcmVuY2UudmFsdWVdO1xuICAgIH0pKTtcblxuICAgIHJldHVybiBhc0xpdGVyYWwocmVmc1BhcmFtKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSEpIDpcbiAgICAgICAgICBzYW5pdGl6ZUlkZW50aWZpZXIoZXZlbnROYW1lKTtcbiAgICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gYCR7dGhpcy50ZW1wbGF0ZU5hbWV9XyR7dGFnTmFtZX1fJHtiaW5kaW5nRm5OYW1lfV8ke2luZGV4fV9saXN0ZW5lcmA7XG4gICAgICBjb25zdCBzY29wZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5uZXN0ZWRTY29wZSh0aGlzLl9iaW5kaW5nU2NvcGUuYmluZGluZ0xldmVsKTtcbiAgICAgIHJldHVybiBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMob3V0cHV0QXN0LCBoYW5kbGVyTmFtZSwgc2NvcGUpO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZhbHVlQ29udmVydGVyIGV4dGVuZHMgQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXIge1xuICBwcml2YXRlIF9waXBlQmluZEV4cHJzOiBGdW5jdGlvbkNhbGxbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcHJpdmF0ZSBhbGxvY2F0ZVNsb3Q6ICgpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcixcbiAgICAgIHByaXZhdGUgZGVmaW5lUGlwZTpcbiAgICAgICAgICAobmFtZTogc3RyaW5nLCBsb2NhbE5hbWU6IHN0cmluZywgc2xvdDogbnVtYmVyLCB2YWx1ZTogby5FeHByZXNzaW9uKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIC8vIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyXG4gIHZpc2l0UGlwZShwaXBlOiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICAvLyBBbGxvY2F0ZSBhIHNsb3QgdG8gY3JlYXRlIHRoZSBwaXBlXG4gICAgY29uc3Qgc2xvdCA9IHRoaXMuYWxsb2NhdGVTbG90KCk7XG4gICAgY29uc3Qgc2xvdFBzZXVkb0xvY2FsID0gYFBJUEU6JHtzbG90fWA7XG4gICAgLy8gQWxsb2NhdGUgb25lIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyBvbmUgc2xvdCBwZXIgcGlwZSBhcmd1bWVudFxuICAgIGNvbnN0IHB1cmVGdW5jdGlvblNsb3QgPSB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMoMiArIHBpcGUuYXJncy5sZW5ndGgpO1xuICAgIGNvbnN0IHRhcmdldCA9IG5ldyBQcm9wZXJ0eVJlYWQoXG4gICAgICAgIHBpcGUuc3BhbiwgcGlwZS5zb3VyY2VTcGFuLCBwaXBlLm5hbWVTcGFuLCBuZXcgSW1wbGljaXRSZWNlaXZlcihwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiksXG4gICAgICAgIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPSBpc1Zhckxlbmd0aCA/XG4gICAgICAgIHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBwaXBlLnNvdXJjZVNwYW4sIGFyZ3MpXSkgOlxuICAgICAgICB0aGlzLnZpc2l0QWxsKGFyZ3MpO1xuXG4gICAgY29uc3QgcGlwZUJpbmRFeHByID0gbmV3IEZ1bmN0aW9uQ2FsbChwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgdGFyZ2V0LCBbXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHBpcGUuc291cmNlU3BhbiwgcHVyZUZ1bmN0aW9uU2xvdCksXG4gICAgICAuLi5jb252ZXJ0ZWRBcmdzLFxuICAgIF0pO1xuICAgIHRoaXMuX3BpcGVCaW5kRXhwcnMucHVzaChwaXBlQmluZEV4cHIpO1xuICAgIHJldHVybiBwaXBlQmluZEV4cHI7XG4gIH1cblxuICB1cGRhdGVQaXBlU2xvdE9mZnNldHMoYmluZGluZ1Nsb3RzOiBudW1iZXIpIHtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLmZvckVhY2goKHBpcGU6IEZ1bmN0aW9uQ2FsbCkgPT4ge1xuICAgICAgLy8gdXBkYXRlIHRoZSBzbG90IG9mZnNldCBhcmcgKGluZGV4IDEpIHRvIGFjY291bnQgZm9yIGJpbmRpbmcgc2xvdHNcbiAgICAgIGNvbnN0IHNsb3RPZmZzZXQgPSBwaXBlLmFyZ3NbMV0gYXMgTGl0ZXJhbFByaW1pdGl2ZTtcbiAgICAgIChzbG90T2Zmc2V0LnZhbHVlIGFzIG51bWJlcikgKz0gYmluZGluZ1Nsb3RzO1xuICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXJyYXk6IExpdGVyYWxBcnJheSwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwoXG4gICAgICAgIGFycmF5LnNwYW4sIGFycmF5LnNvdXJjZVNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgICAgIC8vIElmIHRoZSBsaXRlcmFsIGhhcyBjYWxjdWxhdGVkIChub24tbGl0ZXJhbCkgZWxlbWVudHMgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgICAgICAvLyBjYWxscyB0byBsaXRlcmFsIGZhY3RvcmllcyB0aGF0IGNvbXBvc2UgdGhlIGxpdGVyYWwgYW5kIHdpbGwgY2FjaGUgaW50ZXJtZWRpYXRlXG4gICAgICAgICAgLy8gdmFsdWVzLlxuICAgICAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxBcnIodmFsdWVzKTtcbiAgICAgICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKG1hcDogTGl0ZXJhbE1hcCwgY29udGV4dDogYW55KTogQVNUIHtcbiAgICByZXR1cm4gbmV3IEJ1aWx0aW5GdW5jdGlvbkNhbGwobWFwLnNwYW4sIG1hcC5zb3VyY2VTcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gZ2V0TGl0ZXJhbEZhY3RvcnkodGhpcy5jb25zdGFudFBvb2wsIGxpdGVyYWwsIHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cyk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUGlwZXMgYWx3YXlzIGhhdmUgYXQgbGVhc3Qgb25lIHBhcmFtZXRlciwgdGhlIHZhbHVlIHRoZXkgb3BlcmF0ZSBvblxuY29uc3QgcGlwZUJpbmRpbmdJZGVudGlmaWVycyA9IFtSMy5waXBlQmluZDEsIFIzLnBpcGVCaW5kMiwgUjMucGlwZUJpbmQzLCBSMy5waXBlQmluZDRdO1xuXG5mdW5jdGlvbiBwaXBlQmluZGluZ0NhbGxJbmZvKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSB7XG4gIGNvbnN0IGlkZW50aWZpZXIgPSBwaXBlQmluZGluZ0lkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnBpcGVCaW5kVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmNvbnN0IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzID0gW1xuICBSMy5wdXJlRnVuY3Rpb24wLCBSMy5wdXJlRnVuY3Rpb24xLCBSMy5wdXJlRnVuY3Rpb24yLCBSMy5wdXJlRnVuY3Rpb24zLCBSMy5wdXJlRnVuY3Rpb240LFxuICBSMy5wdXJlRnVuY3Rpb241LCBSMy5wdXJlRnVuY3Rpb242LCBSMy5wdXJlRnVuY3Rpb243LCBSMy5wdXJlRnVuY3Rpb244XG5dO1xuXG5mdW5jdGlvbiBwdXJlRnVuY3Rpb25DYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcHVyZUZ1bmN0aW9uSWRlbnRpZmllcnNbYXJncy5sZW5ndGhdO1xuICByZXR1cm4ge1xuICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXIgfHwgUjMucHVyZUZ1bmN0aW9uVixcbiAgICBpc1Zhckxlbmd0aDogIWlkZW50aWZpZXIsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGluc3RydWN0aW9uKFxuICAgIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwcnxvLkxpdGVyYWxNYXBFeHByLFxuICAgIGFsbG9jYXRlU2xvdHM6IChudW1TbG90czogbnVtYmVyKSA9PiBudW1iZXIpOiBvLkV4cHJlc3Npb24ge1xuICBjb25zdCB7bGl0ZXJhbEZhY3RvcnksIGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzfSA9IGNvbnN0YW50UG9vbC5nZXRMaXRlcmFsRmFjdG9yeShsaXRlcmFsKTtcbiAgLy8gQWxsb2NhdGUgMSBzbG90IGZvciB0aGUgcmVzdWx0IHBsdXMgMSBwZXIgYXJndW1lbnRcbiAgY29uc3Qgc3RhcnRTbG90ID0gYWxsb2NhdGVTbG90cygxICsgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMubGVuZ3RoKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtvLmxpdGVyYWwoc3RhcnRTbG90KSwgbGl0ZXJhbEZhY3RvcnldO1xuXG4gIGlmIChpc1Zhckxlbmd0aCkge1xuICAgIGFyZ3MucHVzaChvLmxpdGVyYWxBcnIobGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpKTtcbiAgfSBlbHNlIHtcbiAgICBhcmdzLnB1c2goLi4ubGl0ZXJhbEZhY3RvcnlBcmd1bWVudHMpO1xuICB9XG5cbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKS5jYWxsRm4oYXJncyk7XG59XG5cbi8qKlxuICogR2V0cyBhbiBhcnJheSBvZiBsaXRlcmFscyB0aGF0IGNhbiBiZSBhZGRlZCB0byBhbiBleHByZXNzaW9uXG4gKiB0byByZXByZXNlbnQgdGhlIG5hbWUgYW5kIG5hbWVzcGFjZSBvZiBhbiBhdHRyaWJ1dGUuIEUuZy5cbiAqIGA6eGxpbms6aHJlZmAgdHVybnMgaW50byBgW0F0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkksICd4bGluaycsICdocmVmJ11gLlxuICpcbiAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGF0dHJpYnV0ZSwgaW5jbHVkaW5nIHRoZSBuYW1lc3BhY2UuXG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhuYW1lOiBzdHJpbmcpOiBvLkxpdGVyYWxFeHByW10ge1xuICBjb25zdCBbYXR0cmlidXRlTmFtZXNwYWNlLCBhdHRyaWJ1dGVOYW1lXSA9IHNwbGl0TnNOYW1lKG5hbWUpO1xuICBjb25zdCBuYW1lTGl0ZXJhbCA9IG8ubGl0ZXJhbChhdHRyaWJ1dGVOYW1lKTtcblxuICBpZiAoYXR0cmlidXRlTmFtZXNwYWNlKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5OYW1lc3BhY2VVUkkpLCBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZXNwYWNlKSwgbmFtZUxpdGVyYWxcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIFtuYW1lTGl0ZXJhbF07XG59XG5cbi8qKlxuICogRnVuY3Rpb24gd2hpY2ggaXMgZXhlY3V0ZWQgd2hlbmV2ZXIgYSB2YXJpYWJsZSBpcyByZWZlcmVuY2VkIGZvciB0aGUgZmlyc3QgdGltZSBpbiBhIGdpdmVuXG4gKiBzY29wZS5cbiAqXG4gKiBJdCBpcyBleHBlY3RlZCB0aGF0IHRoZSBmdW5jdGlvbiBjcmVhdGVzIHRoZSBgY29uc3QgbG9jYWxOYW1lID0gZXhwcmVzc2lvbmA7IHN0YXRlbWVudC5cbiAqL1xuZXhwb3J0IHR5cGUgRGVjbGFyZUxvY2FsVmFyQ2FsbGJhY2sgPSAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiBvLlN0YXRlbWVudFtdO1xuXG4vKiogVGhlIHByZWZpeCB1c2VkIHRvIGdldCBhIHNoYXJlZCBjb250ZXh0IGluIEJpbmRpbmdTY29wZSdzIG1hcC4gKi9cbmNvbnN0IFNIQVJFRF9DT05URVhUX0tFWSA9ICckJHNoYXJlZF9jdHgkJCc7XG5cbi8qKlxuICogVGhpcyBpcyB1c2VkIHdoZW4gb25lIHJlZmVycyB0byB2YXJpYWJsZSBzdWNoIGFzOiAnbGV0IGFiYyA9IG5leHRDb250ZXh0KDIpLiRpbXBsaWNpdGAuXG4gKiAtIGtleSB0byB0aGUgbWFwIGlzIHRoZSBzdHJpbmcgbGl0ZXJhbCBgXCJhYmNcImAuXG4gKiAtIHZhbHVlIGByZXRyaWV2YWxMZXZlbGAgaXMgdGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkLCB3aGljaCBpcyAyIGxldmVsc1xuICogdXAgaW4gZXhhbXBsZS5cbiAqIC0gdmFsdWUgYGxoc2AgaXMgdGhlIGxlZnQgaGFuZCBzaWRlIHdoaWNoIGlzIGFuIEFTVCByZXByZXNlbnRpbmcgYGFiY2AuXG4gKiAtIHZhbHVlIGBkZWNsYXJlTG9jYWxDYWxsYmFja2AgaXMgYSBjYWxsYmFjayB0aGF0IGlzIGludm9rZWQgd2hlbiBkZWNsYXJpbmcgdGhlIGxvY2FsLlxuICogLSB2YWx1ZSBgZGVjbGFyZWAgaXMgdHJ1ZSBpZiB0aGlzIHZhbHVlIG5lZWRzIHRvIGJlIGRlY2xhcmVkLlxuICogLSB2YWx1ZSBgbG9jYWxSZWZgIGlzIHRydWUgaWYgd2UgYXJlIHN0b3JpbmcgYSBsb2NhbCByZWZlcmVuY2VcbiAqIC0gdmFsdWUgYHByaW9yaXR5YCBkaWN0YXRlcyB0aGUgc29ydGluZyBwcmlvcml0eSBvZiB0aGlzIHZhciBkZWNsYXJhdGlvbiBjb21wYXJlZFxuICogdG8gb3RoZXIgdmFyIGRlY2xhcmF0aW9ucyBvbiB0aGUgc2FtZSByZXRyaWV2YWwgbGV2ZWwuIEZvciBleGFtcGxlLCBpZiB0aGVyZSBpcyBhXG4gKiBjb250ZXh0IHZhcmlhYmxlIGFuZCBhIGxvY2FsIHJlZiBhY2Nlc3NpbmcgdGhlIHNhbWUgcGFyZW50IHZpZXcsIHRoZSBjb250ZXh0IHZhclxuICogZGVjbGFyYXRpb24gc2hvdWxkIGFsd2F5cyBjb21lIGJlZm9yZSB0aGUgbG9jYWwgcmVmIGRlY2xhcmF0aW9uLlxuICovXG50eXBlIEJpbmRpbmdEYXRhID0ge1xuICByZXRyaWV2YWxMZXZlbDogbnVtYmVyOyBsaHM6IG8uRXhwcmVzc2lvbjtcbiAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s/OiBEZWNsYXJlTG9jYWxWYXJDYWxsYmFjazsgZGVjbGFyZTogYm9vbGVhbjsgcHJpb3JpdHk6IG51bWJlcjtcbiAgbG9jYWxSZWY6IGJvb2xlYW47XG59O1xuXG4vKipcbiAqIFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIGEgbG9jYWwgdmFyaWFibGUgZGVjbGFyYXRpb24uIEhpZ2hlciBudW1iZXJzXG4gKiBtZWFuIHRoZSBkZWNsYXJhdGlvbiB3aWxsIGFwcGVhciBmaXJzdCBpbiB0aGUgZ2VuZXJhdGVkIGNvZGUuXG4gKi9cbmNvbnN0IGVudW0gRGVjbGFyYXRpb25Qcmlvcml0eSB7XG4gIERFRkFVTFQgPSAwLFxuICBDT05URVhUID0gMSxcbiAgU0hBUkVEX0NPTlRFWFQgPSAyXG59XG5cbmV4cG9ydCBjbGFzcyBCaW5kaW5nU2NvcGUgaW1wbGVtZW50cyBMb2NhbFJlc29sdmVyIHtcbiAgLyoqIEtlZXBzIGEgbWFwIGZyb20gbG9jYWwgdmFyaWFibGVzIHRvIHRoZWlyIEJpbmRpbmdEYXRhLiAqL1xuICBwcml2YXRlIG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBCaW5kaW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSByZWZlcmVuY2VOYW1lSW5kZXggPSAwO1xuICBwcml2YXRlIHJlc3RvcmVWaWV3VmFyaWFibGU6IG8uUmVhZFZhckV4cHJ8bnVsbCA9IG51bGw7XG4gIHN0YXRpYyBjcmVhdGVSb290U2NvcGUoKTogQmluZGluZ1Njb3BlIHtcbiAgICByZXR1cm4gbmV3IEJpbmRpbmdTY29wZSgpLnNldCgwLCAnJGV2ZW50Jywgby52YXJpYWJsZSgnJGV2ZW50JykpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgYmluZGluZ0xldmVsOiBudW1iZXIgPSAwLCBwcml2YXRlIHBhcmVudDogQmluZGluZ1Njb3BlfG51bGwgPSBudWxsKSB7fVxuXG4gIGdldChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IGN1cnJlbnQ6IEJpbmRpbmdTY29wZXxudWxsID0gdGhpcztcbiAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgbGV0IHZhbHVlID0gY3VycmVudC5tYXAuZ2V0KG5hbWUpO1xuICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IHRoaXMpIHtcbiAgICAgICAgICAvLyBtYWtlIGEgbG9jYWwgY29weSBhbmQgcmVzZXQgdGhlIGBkZWNsYXJlYCBzdGF0ZVxuICAgICAgICAgIHZhbHVlID0ge1xuICAgICAgICAgICAgcmV0cmlldmFsTGV2ZWw6IHZhbHVlLnJldHJpZXZhbExldmVsLFxuICAgICAgICAgICAgbGhzOiB2YWx1ZS5saHMsXG4gICAgICAgICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2ssXG4gICAgICAgICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiB2YWx1ZS5wcmlvcml0eSxcbiAgICAgICAgICAgIGxvY2FsUmVmOiB2YWx1ZS5sb2NhbFJlZlxuICAgICAgICAgIH07XG5cbiAgICAgICAgICAvLyBDYWNoZSB0aGUgdmFsdWUgbG9jYWxseS5cbiAgICAgICAgICB0aGlzLm1hcC5zZXQobmFtZSwgdmFsdWUpO1xuICAgICAgICAgIC8vIFBvc3NpYmx5IGdlbmVyYXRlIGEgc2hhcmVkIGNvbnRleHQgdmFyXG4gICAgICAgICAgdGhpcy5tYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZSk7XG4gICAgICAgICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KHZhbHVlLnJldHJpZXZhbExldmVsLCB2YWx1ZS5sb2NhbFJlZik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgJiYgIXZhbHVlLmRlY2xhcmUpIHtcbiAgICAgICAgICB2YWx1ZS5kZWNsYXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWUubGhzO1xuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgIH1cblxuICAgIC8vIElmIHdlIGdldCB0byB0aGlzIHBvaW50LCB3ZSBhcmUgbG9va2luZyBmb3IgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wIGxldmVsIGNvbXBvbmVudFxuICAgIC8vIC0gSWYgbGV2ZWwgPT09IDAsIHdlIGFyZSBvbiB0aGUgdG9wIGFuZCBkb24ndCBuZWVkIHRvIHJlLWRlY2xhcmUgYGN0eGAuXG4gICAgLy8gLSBJZiBsZXZlbCA+IDAsIHdlIGFyZSBpbiBhbiBlbWJlZGRlZCB2aWV3LiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGxvY2FsIHZhciB3ZSB1c2VkIHRvIHN0b3JlIHRoZSBjb21wb25lbnQgY29udGV4dCwgZS5nLiBjb25zdCAkY29tcCQgPSB4KCk7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ0xldmVsID09PSAwID8gbnVsbCA6IHRoaXMuZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbG9jYWwgdmFyaWFibGUgZm9yIGxhdGVyIHJlZmVyZW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHJldHJpZXZhbExldmVsIFRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZFxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSB2YXJpYWJsZS5cbiAgICogQHBhcmFtIGxocyBBU1QgcmVwcmVzZW50aW5nIHRoZSBsZWZ0IGhhbmQgc2lkZSBvZiB0aGUgYGxldCBsaHMgPSByaHM7YC5cbiAgICogQHBhcmFtIHByaW9yaXR5IFRoZSBzb3J0aW5nIHByaW9yaXR5IG9mIHRoaXMgdmFyXG4gICAqIEBwYXJhbSBkZWNsYXJlTG9jYWxDYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIHdoZW4gZGVjbGFyaW5nIHRoaXMgbG9jYWwgdmFyXG4gICAqIEBwYXJhbSBsb2NhbFJlZiBXaGV0aGVyIG9yIG5vdCB0aGlzIGlzIGEgbG9jYWwgcmVmXG4gICAqL1xuICBzZXQocmV0cmlldmFsTGV2ZWw6IG51bWJlciwgbmFtZTogc3RyaW5nLCBsaHM6IG8uRXhwcmVzc2lvbixcbiAgICAgIHByaW9yaXR5OiBudW1iZXIgPSBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrLCBsb2NhbFJlZj86IHRydWUpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICh0aGlzLm1hcC5oYXMobmFtZSkpIHtcbiAgICAgIGlmIChsb2NhbFJlZikge1xuICAgICAgICAvLyBEbyBub3QgdGhyb3cgYW4gZXJyb3IgaWYgaXQncyBhIGxvY2FsIHJlZiBhbmQgZG8gbm90IHVwZGF0ZSBleGlzdGluZyB2YWx1ZSxcbiAgICAgICAgLy8gc28gdGhlIGZpcnN0IGRlZmluZWQgcmVmIGlzIGFsd2F5cyByZXR1cm5lZC5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgfVxuICAgIHRoaXMubWFwLnNldChuYW1lLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IGRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgcHJpb3JpdHk6IHByaW9yaXR5LFxuICAgICAgbG9jYWxSZWY6IGxvY2FsUmVmIHx8IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBJbXBsZW1lbnRlZCBhcyBwYXJ0IG9mIExvY2FsUmVzb2x2ZXIuXG4gIGdldExvY2FsKG5hbWU6IHN0cmluZyk6IChvLkV4cHJlc3Npb258bnVsbCkge1xuICAgIHJldHVybiB0aGlzLmdldChuYW1lKTtcbiAgfVxuXG4gIC8vIEltcGxlbWVudGVkIGFzIHBhcnQgb2YgTG9jYWxSZXNvbHZlci5cbiAgbm90aWZ5SW1wbGljaXRSZWNlaXZlclVzZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5iaW5kaW5nTGV2ZWwgIT09IDApIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBpbXBsaWNpdCByZWNlaXZlciBpcyBhY2Nlc3NlZCBpbiBhbiBlbWJlZGRlZCB2aWV3LCB3ZSBuZWVkIHRvXG4gICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBkZWNsYXJlIGEgc2hhcmVkIGNvbnRleHQgdmFyaWFibGUgZm9yIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gICAgICAvLyBpbiB0aGUgdXBkYXRlIHZhcmlhYmxlcy5cbiAgICAgIHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSEuZGVjbGFyZSA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlcik6IEJpbmRpbmdTY29wZSB7XG4gICAgY29uc3QgbmV3U2NvcGUgPSBuZXcgQmluZGluZ1Njb3BlKGxldmVsLCB0aGlzKTtcbiAgICBpZiAobGV2ZWwgPiAwKSBuZXdTY29wZS5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gICAgcmV0dXJuIG5ld1Njb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgb3IgY3JlYXRlcyBhIHNoYXJlZCBjb250ZXh0IHZhcmlhYmxlIGFuZCByZXR1cm5zIGl0cyBleHByZXNzaW9uLiBOb3RlIHRoYXRcbiAgICogdGhpcyBkb2VzIG5vdCBtZWFuIHRoYXQgdGhlIHNoYXJlZCB2YXJpYWJsZSB3aWxsIGJlIGRlY2xhcmVkLiBWYXJpYWJsZXMgaW4gdGhlXG4gICAqIGJpbmRpbmcgc2NvcGUgd2lsbCBiZSBvbmx5IGRlY2xhcmVkIGlmIHRoZXkgYXJlIHVzZWQuXG4gICAqL1xuICBnZXRPckNyZWF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IGJpbmRpbmdLZXkgPSBTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbDtcbiAgICBpZiAoIXRoaXMubWFwLmhhcyhiaW5kaW5nS2V5KSkge1xuICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIocmV0cmlldmFsTGV2ZWwpO1xuICAgIH1cbiAgICAvLyBTaGFyZWQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgYXMgXCJSZWFkVmFyRXhwclwiLlxuICAgIHJldHVybiB0aGlzLm1hcC5nZXQoYmluZGluZ0tleSkhLmxocyBhcyBvLlJlYWRWYXJFeHByO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHJ8bnVsbCB7XG4gICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsKTtcbiAgICAvLyBTaGFyZWQgY29udGV4dCB2YXJpYWJsZXMgYXJlIGFsd2F5cyBnZW5lcmF0ZWQgYXMgXCJSZWFkVmFyRXhwclwiLlxuICAgIHJldHVybiBzaGFyZWRDdHhPYmogJiYgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPyBzaGFyZWRDdHhPYmoubGhzIGFzIG8uUmVhZFZhckV4cHIgOiBudWxsO1xuICB9XG5cbiAgbWF5YmVHZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWU6IEJpbmRpbmdEYXRhKSB7XG4gICAgaWYgKHZhbHVlLnByaW9yaXR5ID09PSBEZWNsYXJhdGlvblByaW9yaXR5LkNPTlRFWFQgJiZcbiAgICAgICAgdmFsdWUucmV0cmlldmFsTGV2ZWwgPCB0aGlzLmJpbmRpbmdMZXZlbCkge1xuICAgICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHZhbHVlLnJldHJpZXZhbExldmVsKTtcbiAgICAgIGlmIChzaGFyZWRDdHhPYmopIHtcbiAgICAgICAgc2hhcmVkQ3R4T2JqLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIodmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcihyZXRyaWV2YWxMZXZlbDogbnVtYmVyKSB7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUgKyB0aGlzLmZyZXNoUmVmZXJlbmNlTmFtZSgpKTtcbiAgICB0aGlzLm1hcC5zZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgcmV0cmlldmFsTGV2ZWwsIHtcbiAgICAgIHJldHJpZXZhbExldmVsOiByZXRyaWV2YWxMZXZlbCxcbiAgICAgIGxoczogbGhzLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgLy8gY29uc3QgY3R4X3IwID0gbmV4dENvbnRleHQoMik7XG4gICAgICAgIHJldHVybiBbbGhzLnNldChnZW5lcmF0ZU5leHRDb250ZXh0RXhwcihyZWxhdGl2ZUxldmVsKSkudG9Db25zdERlY2woKV07XG4gICAgICB9LFxuICAgICAgZGVjbGFyZTogZmFsc2UsXG4gICAgICBwcmlvcml0eTogRGVjbGFyYXRpb25Qcmlvcml0eS5TSEFSRURfQ09OVEVYVCxcbiAgICAgIGxvY2FsUmVmOiBmYWxzZVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0Q29tcG9uZW50UHJvcGVydHkobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBjb21wb25lbnRWYWx1ZSA9IHRoaXMubWFwLmdldChTSEFSRURfQ09OVEVYVF9LRVkgKyAwKSE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDAsIGZhbHNlKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKSB7XG4gICAgLy8gV2Ugd2FudCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gbGlzdGVuZXIgZm5zIGlmOlxuICAgIC8vIDEgLSB3ZSBhcmUgYWNjZXNzaW5nIGEgdmFsdWUgaW4gYSBwYXJlbnQgdmlldywgd2hpY2ggcmVxdWlyZXMgd2Fsa2luZyB0aGUgdmlldyB0cmVlIHJhdGhlclxuICAgIC8vIHRoYW4gdXNpbmcgdGhlIGN0eCBhcmcuIEluIHRoaXMgY2FzZSwgdGhlIHJldHJpZXZhbCBhbmQgYmluZGluZyBsZXZlbCB3aWxsIGJlIGRpZmZlcmVudC5cbiAgICAvLyAyIC0gd2UgYXJlIGxvb2tpbmcgdXAgYSBsb2NhbCByZWYsIHdoaWNoIHJlcXVpcmVzIHJlc3RvcmluZyB0aGUgdmlldyB3aGVyZSB0aGUgbG9jYWxcbiAgICAvLyByZWYgaXMgc3RvcmVkXG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgKHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwgfHwgbG9jYWxSZWZMb29rdXApKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlKSB7XG4gICAgICAgIC8vIHBhcmVudCBzYXZlcyB2YXJpYWJsZSB0byBnZW5lcmF0ZSBhIHNoYXJlZCBgY29uc3QgJHMkID0gZ2V0Q3VycmVudFZpZXcoKTtgIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMucGFyZW50IS5yZXN0b3JlVmlld1ZhcmlhYmxlID0gby52YXJpYWJsZSh0aGlzLnBhcmVudCEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQhLnJlc3RvcmVWaWV3VmFyaWFibGU7XG4gICAgfVxuICB9XG5cbiAgcmVzdG9yZVZpZXdTdGF0ZW1lbnQoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gcmVzdG9yZVZpZXcoJHN0YXRlJCk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFtpbnN0cnVjdGlvbihudWxsLCBSMy5yZXN0b3JlVmlldywgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZV0pLnRvU3RtdCgpXSA6XG4gICAgICAgIFtdO1xuICB9XG5cbiAgdmlld1NuYXBzaG90U3RhdGVtZW50cygpOiBvLlN0YXRlbWVudFtdIHtcbiAgICAvLyBjb25zdCAkc3RhdGUkID0gZ2V0Q3VycmVudFZpZXcoKTtcbiAgICBjb25zdCBnZXRDdXJyZW50Vmlld0luc3RydWN0aW9uID0gaW5zdHJ1Y3Rpb24obnVsbCwgUjMuZ2V0Q3VycmVudFZpZXcsIFtdKTtcbiAgICByZXR1cm4gdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID9cbiAgICAgICAgW3RoaXMucmVzdG9yZVZpZXdWYXJpYWJsZS5zZXQoZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbikudG9Db25zdERlY2woKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIGlzTGlzdGVuZXJTY29wZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnQgJiYgdGhpcy5wYXJlbnQuYmluZGluZ0xldmVsID09PSB0aGlzLmJpbmRpbmdMZXZlbDtcbiAgfVxuXG4gIHZhcmlhYmxlRGVjbGFyYXRpb25zKCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGxldCBjdXJyZW50Q29udGV4dExldmVsID0gMDtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLm1hcC52YWx1ZXMoKSlcbiAgICAgICAgICAgICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUuZGVjbGFyZSlcbiAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgICAgICAgIC5yZWR1Y2UoKHN0bXRzOiBvLlN0YXRlbWVudFtdLCB2YWx1ZTogQmluZGluZ0RhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgY29uc3QgbGV2ZWxEaWZmID0gdGhpcy5iaW5kaW5nTGV2ZWwgLSB2YWx1ZS5yZXRyaWV2YWxMZXZlbDtcbiAgICAgICAgICAgICAgICAgY29uc3QgY3VyclN0bXRzID1cbiAgICAgICAgICAgICAgICAgICAgIHZhbHVlLmRlY2xhcmVMb2NhbENhbGxiYWNrISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICAgICAgICAgY3VycmVudENvbnRleHRMZXZlbCA9IGxldmVsRGlmZjtcbiAgICAgICAgICAgICAgICAgcmV0dXJuIHN0bXRzLmNvbmNhdChjdXJyU3RtdHMpO1xuICAgICAgICAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDc3NTZWxlY3RvcihcbiAgICBlbGVtZW50TmFtZTogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gIGNvbnN0IGVsZW1lbnROYW1lTm9OcyA9IHNwbGl0TnNOYW1lKGVsZW1lbnROYW1lKVsxXTtcblxuICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KGVsZW1lbnROYW1lTm9Ocyk7XG5cbiAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgIGNvbnN0IG5hbWVOb05zID0gc3BsaXROc05hbWUobmFtZSlbMV07XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGVzW25hbWVdO1xuXG4gICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWVOb05zLCB2YWx1ZSk7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY3NzU2VsZWN0b3I7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBleHByZXNzaW9ucyBvdXQgb2YgYW4gYG5nUHJvamVjdEFzYCBhdHRyaWJ1dGVzXG4gKiB3aGljaCBjYW4gYmUgYWRkZWQgdG8gdGhlIGluc3RydWN0aW9uIHBhcmFtZXRlcnMuXG4gKi9cbmZ1bmN0aW9uIGdldE5nUHJvamVjdEFzTGl0ZXJhbChhdHRyaWJ1dGU6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbltdIHtcbiAgLy8gUGFyc2UgdGhlIGF0dHJpYnV0ZSB2YWx1ZSBpbnRvIGEgQ3NzU2VsZWN0b3JMaXN0LiBOb3RlIHRoYXQgd2Ugb25seSB0YWtlIHRoZVxuICAvLyBmaXJzdCBzZWxlY3RvciwgYmVjYXVzZSB3ZSBkb24ndCBzdXBwb3J0IG11bHRpcGxlIHNlbGVjdG9ycyBpbiBuZ1Byb2plY3RBcy5cbiAgY29uc3QgcGFyc2VkUjNTZWxlY3RvciA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihhdHRyaWJ1dGUudmFsdWUpWzBdO1xuICByZXR1cm4gW28ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5Qcm9qZWN0QXMpLCBhc0xpdGVyYWwocGFyc2VkUjNTZWxlY3RvcildO1xufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgcHJvcGVydHlcbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFByb3BlcnR5SW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAxOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMjtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTU7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTg7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBhbiBpbnRlcnBvbGF0ZWQgYXR0cmlidXRlXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMztcbiAgICBjYXNlIDk6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU2O1xuICAgIGNhc2UgMTU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGVWO1xuICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgaW5zdHJ1Y3Rpb24gdG8gZ2VuZXJhdGUgZm9yIGludGVycG9sYXRlZCB0ZXh0LlxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0VGV4dEludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pOiBvLkV4dGVybmFsUmVmZXJlbmNlIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTE7XG4gICAgY2FzZSA1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTQ7XG4gICAgY2FzZSAxMTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTc7XG4gICAgY2FzZSAxNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnMgdGhhdCBjYW4gYmUgdXNlZCB0byBtb2RpZnkgaG93IGEgdGVtcGxhdGUgaXMgcGFyc2VkIGJ5IGBwYXJzZVRlbXBsYXRlKClgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlVGVtcGxhdGVPcHRpb25zIHtcbiAgLyoqXG4gICAqIEluY2x1ZGUgd2hpdGVzcGFjZSBub2RlcyBpbiB0aGUgcGFyc2VkIG91dHB1dC5cbiAgICovXG4gIHByZXNlcnZlV2hpdGVzcGFjZXM/OiBib29sZWFuO1xuICAvKipcbiAgICogSG93IHRvIHBhcnNlIGludGVycG9sYXRpb24gbWFya2Vycy5cbiAgICovXG4gIGludGVycG9sYXRpb25Db25maWc/OiBJbnRlcnBvbGF0aW9uQ29uZmlnO1xuICAvKipcbiAgICogVGhlIHN0YXJ0IGFuZCBlbmQgcG9pbnQgb2YgdGhlIHRleHQgdG8gcGFyc2Ugd2l0aGluIHRoZSBgc291cmNlYCBzdHJpbmcuXG4gICAqIFRoZSBlbnRpcmUgYHNvdXJjZWAgc3RyaW5nIGlzIHBhcnNlZCBpZiB0aGlzIGlzIG5vdCBwcm92aWRlZC5cbiAgICogKi9cbiAgcmFuZ2U/OiBMZXhlclJhbmdlO1xuICAvKipcbiAgICogSWYgdGhpcyB0ZXh0IGlzIHN0b3JlZCBpbiBhIEphdmFTY3JpcHQgc3RyaW5nLCB0aGVuIHdlIGhhdmUgdG8gZGVhbCB3aXRoIGVzY2FwZSBzZXF1ZW5jZXMuXG4gICAqXG4gICAqICoqRXhhbXBsZSAxOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXCJkZWZcXG5naGlcIlxuICAgKiBgYGBcbiAgICpcbiAgICogLSBUaGUgYFxcXCJgIG11c3QgYmUgY29udmVydGVkIHRvIGBcImAuXG4gICAqIC0gVGhlIGBcXG5gIG11c3QgYmUgY29udmVydGVkIHRvIGEgbmV3IGxpbmUgY2hhcmFjdGVyIGluIGEgdG9rZW4sXG4gICAqICAgYnV0IGl0IHNob3VsZCBub3QgaW5jcmVtZW50IHRoZSBjdXJyZW50IGxpbmUgZm9yIHNvdXJjZSBtYXBwaW5nLlxuICAgKlxuICAgKiAqKkV4YW1wbGUgMjoqKlxuICAgKlxuICAgKiBgYGBcbiAgICogXCJhYmNcXFxuICAgKiAgZGVmXCJcbiAgICogYGBgXG4gICAqXG4gICAqIFRoZSBsaW5lIGNvbnRpbnVhdGlvbiAoYFxcYCBmb2xsb3dlZCBieSBhIG5ld2xpbmUpIHNob3VsZCBiZSByZW1vdmVkIGZyb20gYSB0b2tlblxuICAgKiBidXQgdGhlIG5ldyBsaW5lIHNob3VsZCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqL1xuICBlc2NhcGVkU3RyaW5nPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIEFuIGFycmF5IG9mIGNoYXJhY3RlcnMgdGhhdCBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBsZWFkaW5nIHRyaXZpYS5cbiAgICogTGVhZGluZyB0cml2aWEgYXJlIGNoYXJhY3RlcnMgdGhhdCBhcmUgbm90IGltcG9ydGFudCB0byB0aGUgZGV2ZWxvcGVyLCBhbmQgc28gc2hvdWxkIG5vdCBiZVxuICAgKiBpbmNsdWRlZCBpbiBzb3VyY2UtbWFwIHNlZ21lbnRzLiAgQSBjb21tb24gZXhhbXBsZSBpcyB3aGl0ZXNwYWNlLlxuICAgKi9cbiAgbGVhZGluZ1RyaXZpYUNoYXJzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFJlbmRlciBgJGxvY2FsaXplYCBtZXNzYWdlIGlkcyB3aXRoIGFkZGl0aW9uYWwgbGVnYWN5IG1lc3NhZ2UgaWRzLlxuICAgKlxuICAgKiBUaGlzIG9wdGlvbiBkZWZhdWx0cyB0byBgdHJ1ZWAgYnV0IGluIHRoZSBmdXR1cmUgdGhlIGRlZmF1bCB3aWxsIGJlIGZsaXBwZWQuXG4gICAqXG4gICAqIEZvciBub3cgc2V0IHRoaXMgb3B0aW9uIHRvIGZhbHNlIGlmIHlvdSBoYXZlIG1pZ3JhdGVkIHRoZSB0cmFuc2xhdGlvbiBmaWxlcyB0byB1c2UgdGhlIG5ld1xuICAgKiBgJGxvY2FsaXplYCBtZXNzYWdlIGlkIGZvcm1hdCBhbmQgeW91IGFyZSBub3QgdXNpbmcgY29tcGlsZSB0aW1lIHRyYW5zbGF0aW9uIG1lcmdpbmcuXG4gICAqL1xuICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0PzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIElmIHRoaXMgdGV4dCBpcyBzdG9yZWQgaW4gYW4gZXh0ZXJuYWwgdGVtcGxhdGUgKGUuZy4gdmlhIGB0ZW1wbGF0ZVVybGApIHRoZW4gd2UgbmVlZCB0byBkZWNpZGVcbiAgICogd2hldGhlciBvciBub3QgdG8gbm9ybWFsaXplIHRoZSBsaW5lLWVuZGluZ3MgKGZyb20gYFxcclxcbmAgdG8gYFxcbmApIHdoZW4gcHJvY2Vzc2luZyBJQ1VcbiAgICogZXhwcmVzc2lvbnMuXG4gICAqXG4gICAqIElmIGB0cnVlYCB0aGVuIHdlIHdpbGwgbm9ybWFsaXplIElDVSBleHByZXNzaW9uIGxpbmUgZW5kaW5ncy5cbiAgICogVGhlIGRlZmF1bHQgaXMgYGZhbHNlYCwgYnV0IHRoaXMgd2lsbCBiZSBzd2l0Y2hlZCBpbiBhIGZ1dHVyZSBtYWpvciByZWxlYXNlLlxuICAgKi9cbiAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIGludG8gcmVuZGVyMyBgTm9kZWBzIGFuZCBhZGRpdGlvbmFsIG1ldGFkYXRhLCB3aXRoIG5vIG90aGVyIGRlcGVuZGVuY2llcy5cbiAqXG4gKiBAcGFyYW0gdGVtcGxhdGUgdGV4dCBvZiB0aGUgdGVtcGxhdGUgdG8gcGFyc2VcbiAqIEBwYXJhbSB0ZW1wbGF0ZVVybCBVUkwgdG8gdXNlIGZvciBzb3VyY2UgbWFwcGluZyBvZiB0aGUgcGFyc2VkIHRlbXBsYXRlXG4gKiBAcGFyYW0gb3B0aW9ucyBvcHRpb25zIHRvIG1vZGlmeSBob3cgdGhlIHRlbXBsYXRlIGlzIHBhcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUZW1wbGF0ZShcbiAgICB0ZW1wbGF0ZTogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLCBvcHRpb25zOiBQYXJzZVRlbXBsYXRlT3B0aW9ucyA9IHt9KTogUGFyc2VkVGVtcGxhdGUge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlcywgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdH0gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UoXG4gICAgICB0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsXG4gICAgICB7bGVhZGluZ1RyaXZpYUNoYXJzOiBMRUFESU5HX1RSSVZJQV9DSEFSUywgLi4ub3B0aW9ucywgdG9rZW5pemVFeHBhbnNpb25Gb3JtczogdHJ1ZX0pO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBUT0RPKGF5YXpoYWZpeik6IHdlIG1heSBub3QgYWx3YXlzIHdhbnQgdG8gYmFpbCBvdXQgYXQgdGhpcyBwb2ludCAoZS5nLiBpblxuICAgIC8vIHRoZSBjb250ZXh0IG9mIGEgbGFuZ3VhZ2Ugc2VydmljZSkuXG4gICAgcmV0dXJuIHtcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICBlcnJvcnM6IHBhcnNlUmVzdWx0LmVycm9ycyxcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIHN0eWxlVXJsczogW10sXG4gICAgICBzdHlsZXM6IFtdLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiBbXVxuICAgIH07XG4gIH1cblxuICBsZXQgcm9vdE5vZGVzOiBodG1sLk5vZGVbXSA9IHBhcnNlUmVzdWx0LnJvb3ROb2RlcztcblxuICAvLyBwcm9jZXNzIGkxOG4gbWV0YSBpbmZvcm1hdGlvbiAoc2NhbiBhdHRyaWJ1dGVzLCBnZW5lcmF0ZSBpZHMpXG4gIC8vIGJlZm9yZSB3ZSBydW4gd2hpdGVzcGFjZSByZW1vdmFsIHByb2Nlc3MsIGJlY2F1c2UgZXhpc3RpbmcgaTE4blxuICAvLyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgY29uc3QgaTE4bk1ldGFWaXNpdG9yID0gbmV3IEkxOG5NZXRhVmlzaXRvcihcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gIXByZXNlcnZlV2hpdGVzcGFjZXMsXG4gICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0KTtcbiAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChpMThuTWV0YVZpc2l0b3IsIHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdoaXRlc3BhY2VzIGFyZSByZW1vdmVkIChiZWNhdXNlIHRoYXQgbWlnaHQgYWZmZWN0XG4gICAgLy8gZ2VuZXJhdGVkIGkxOG4gbWVzc2FnZSBjb250ZW50KSBhbmQgZmlyc3QgcGFzcyBpbmRpY2F0ZWQgdGhhdCBpMThuIGNvbnRlbnQgaXMgcHJlc2VudCBpbiBhXG4gICAgLy8gdGVtcGxhdGUuIER1cmluZyB0aGlzIHBhc3MgaTE4biBJRHMgZ2VuZXJhdGVkIGF0IHRoZSBmaXJzdCBwYXNzIHdpbGwgYmUgcHJlc2VydmVkLCBzbyB3ZSBjYW5cbiAgICAvLyBtaW1pYyBleGlzdGluZyBleHRyYWN0aW9uIHByb2Nlc3MgKG5nIGV4dHJhY3QtaTE4bilcbiAgICBpZiAoaTE4bk1ldGFWaXNpdG9yLmhhc0kxOG5NZXRhKSB7XG4gICAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICAgIG5ldyBJMThuTWV0YVZpc2l0b3IoaW50ZXJwb2xhdGlvbkNvbmZpZywgLyoga2VlcEkxOG5BdHRycyAqLyBmYWxzZSksIHJvb3ROb2Rlcyk7XG4gICAgfVxuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnN9ID1cbiAgICAgIGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcblxuICByZXR1cm4ge1xuICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgcHJlc2VydmVXaGl0ZXNwYWNlcyxcbiAgICBlcnJvcnM6IGVycm9ycy5sZW5ndGggPiAwID8gZXJyb3JzIDogbnVsbCxcbiAgICB0ZW1wbGF0ZSxcbiAgICBub2RlcyxcbiAgICBzdHlsZVVybHMsXG4gICAgc3R5bGVzLFxuICAgIG5nQ29udGVudFNlbGVjdG9yc1xuICB9O1xufVxuXG5jb25zdCBlbGVtZW50UmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbi8qKlxuICogQ29uc3RydWN0IGEgYEJpbmRpbmdQYXJzZXJgIHdpdGggYSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQmluZGluZ1BhcnNlcihcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRyk6IEJpbmRpbmdQYXJzZXIge1xuICByZXR1cm4gbmV3IEJpbmRpbmdQYXJzZXIoXG4gICAgICBuZXcgSXZ5UGFyc2VyKG5ldyBMZXhlcigpKSwgaW50ZXJwb2xhdGlvbkNvbmZpZywgZWxlbWVudFJlZ2lzdHJ5LCBudWxsLCBbXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlU2FuaXRpemF0aW9uRm4oY29udGV4dDogY29yZS5TZWN1cml0eUNvbnRleHQsIGlzQXR0cmlidXRlPzogYm9vbGVhbikge1xuICBzd2l0Y2ggKGNvbnRleHQpIHtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LkhUTUw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplSHRtbCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TQ1JJUFQ6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplU2NyaXB0KTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlNUWUxFOlxuICAgICAgLy8gdGhlIGNvbXBpbGVyIGRvZXMgbm90IGZpbGwgaW4gYW4gaW5zdHJ1Y3Rpb24gZm9yIFtzdHlsZS5wcm9wP10gYmluZGluZ1xuICAgICAgLy8gdmFsdWVzIGJlY2F1c2UgdGhlIHN0eWxlIGFsZ29yaXRobSBrbm93cyBpbnRlcm5hbGx5IHdoYXQgcHJvcHMgYXJlIHN1YmplY3RcbiAgICAgIC8vIHRvIHNhbml0aXphdGlvbiAob25seSBbYXR0ci5zdHlsZV0gdmFsdWVzIGFyZSBleHBsaWNpdGx5IHNhbml0aXplZClcbiAgICAgIHJldHVybiBpc0F0dHJpYnV0ZSA/IG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVN0eWxlKSA6IG51bGw7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsKTtcbiAgICBjYXNlIGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVSZXNvdXJjZVVybCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRydXN0ZWRDb25zdEF0dHJpYnV0ZSh0YWdOYW1lOiBzdHJpbmcsIGF0dHI6IHQuVGV4dEF0dHJpYnV0ZSk6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHZhbHVlID0gYXNMaXRlcmFsKGF0dHIudmFsdWUpO1xuICBzd2l0Y2ggKGVsZW1lbnRSZWdpc3RyeS5zZWN1cml0eUNvbnRleHQodGFnTmFtZSwgYXR0ci5uYW1lLCAvKiBpc0F0dHJpYnV0ZSAqLyB0cnVlKSkge1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuSFRNTDpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMudHJ1c3RDb25zdGFudEh0bWwpLmNhbGxGbihbdmFsdWVdLCBhdHRyLnZhbHVlU3Bhbik7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TQ1JJUFQ6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRTY3JpcHQpLmNhbGxGbihbdmFsdWVdLCBhdHRyLnZhbHVlU3Bhbik7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnRydXN0Q29uc3RhbnRSZXNvdXJjZVVybCkuY2FsbEZuKFt2YWx1ZV0sIGF0dHIudmFsdWVTcGFuKTtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGNoaWxkcmVuIGlzW3QuRWxlbWVudF0ge1xuICByZXR1cm4gY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIGNoaWxkcmVuWzBdIGluc3RhbmNlb2YgdC5FbGVtZW50O1xufVxuXG5mdW5jdGlvbiBpc1RleHROb2RlKG5vZGU6IHQuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIHQuVGV4dCB8fCBub2RlIGluc3RhbmNlb2YgdC5Cb3VuZFRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuSWN1O1xufVxuXG5mdW5jdGlvbiBoYXNUZXh0Q2hpbGRyZW5Pbmx5KGNoaWxkcmVuOiB0Lk5vZGVbXSk6IGJvb2xlYW4ge1xuICByZXR1cm4gY2hpbGRyZW4uZXZlcnkoaXNUZXh0Tm9kZSk7XG59XG5cbmludGVyZmFjZSBDaGFpbmFibGVCaW5kaW5nSW5zdHJ1Y3Rpb24ge1xuICBuYW1lPzogc3RyaW5nO1xuICBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbDtcbiAgdmFsdWU6ICgpID0+IG8uRXhwcmVzc2lvbiB8IG8uRXhwcmVzc2lvbltdO1xuICBwYXJhbXM/OiBhbnlbXTtcbn1cblxuLyoqIE5hbWUgb2YgdGhlIGdsb2JhbCB2YXJpYWJsZSB0aGF0IGlzIHVzZWQgdG8gZGV0ZXJtaW5lIGlmIHdlIHVzZSBDbG9zdXJlIHRyYW5zbGF0aW9ucyBvciBub3QgKi9cbmNvbnN0IE5HX0kxOE5fQ0xPU1VSRV9NT0RFID0gJ25nSTE4bkNsb3N1cmVNb2RlJztcblxuLyoqXG4gKiBHZW5lcmF0ZSBzdGF0ZW1lbnRzIHRoYXQgZGVmaW5lIGEgZ2l2ZW4gdHJhbnNsYXRpb24gbWVzc2FnZS5cbiAqXG4gKiBgYGBcbiAqIHZhciBJMThOXzE7XG4gKiBpZiAodHlwZW9mIG5nSTE4bkNsb3N1cmVNb2RlICE9PSB1bmRlZmluZWQgJiYgbmdJMThuQ2xvc3VyZU1vZGUpIHtcbiAqICAgICB2YXIgTVNHX0VYVEVSTkFMX1hYWCA9IGdvb2cuZ2V0TXNnKFxuICogICAgICAgICAgXCJTb21lIG1lc3NhZ2Ugd2l0aCB7JGludGVycG9sYXRpb259IVwiLFxuICogICAgICAgICAgeyBcImludGVycG9sYXRpb25cIjogXCJcXHVGRkZEMFxcdUZGRkRcIiB9XG4gKiAgICAgKTtcbiAqICAgICBJMThOXzEgPSBNU0dfRVhURVJOQUxfWFhYO1xuICogfVxuICogZWxzZSB7XG4gKiAgICAgSTE4Tl8xID0gJGxvY2FsaXplYFNvbWUgbWVzc2FnZSB3aXRoICR7J1xcdUZGRkQwXFx1RkZGRCd9IWA7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSBUaGUgb3JpZ2luYWwgaTE4biBBU1QgbWVzc2FnZSBub2RlXG4gKiBAcGFyYW0gdmFyaWFibGUgVGhlIHZhcmlhYmxlIHRoYXQgd2lsbCBiZSBhc3NpZ25lZCB0aGUgdHJhbnNsYXRpb24sIGUuZy4gYEkxOE5fMWAuXG4gKiBAcGFyYW0gY2xvc3VyZVZhciBUaGUgdmFyaWFibGUgZm9yIENsb3N1cmUgYGdvb2cuZ2V0TXNnYCBjYWxscywgZS5nLiBgTVNHX0VYVEVSTkFMX1hYWGAuXG4gKiBAcGFyYW0gcGFyYW1zIE9iamVjdCBtYXBwaW5nIHBsYWNlaG9sZGVyIG5hbWVzIHRvIHRoZWlyIHZhbHVlcyAoZS5nLlxuICogYHsgXCJpbnRlcnBvbGF0aW9uXCI6IFwiXFx1RkZGRDBcXHVGRkZEXCIgfWApLlxuICogQHBhcmFtIHRyYW5zZm9ybUZuIE9wdGlvbmFsIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSB0cmFuc2xhdGlvbiAoZS5nLlxuICogcG9zdC1wcm9jZXNzaW5nKS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN0YXRlbWVudHMgdGhhdCBkZWZpbmVkIGEgZ2l2ZW4gdHJhbnNsYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cyhcbiAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHZhcmlhYmxlOiBvLlJlYWRWYXJFeHByLCBjbG9zdXJlVmFyOiBvLlJlYWRWYXJFeHByLFxuICAgIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sXG4gICAgdHJhbnNmb3JtRm4/OiAocmF3OiBvLlJlYWRWYXJFeHByKSA9PiBvLkV4cHJlc3Npb24pOiBvLlN0YXRlbWVudFtdIHtcbiAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtcbiAgICBkZWNsYXJlSTE4blZhcmlhYmxlKHZhcmlhYmxlKSxcbiAgICBvLmlmU3RtdChcbiAgICAgICAgY3JlYXRlQ2xvc3VyZU1vZGVHdWFyZCgpLFxuICAgICAgICBjcmVhdGVHb29nbGVHZXRNc2dTdGF0ZW1lbnRzKFxuICAgICAgICAgICAgdmFyaWFibGUsIG1lc3NhZ2UsIGNsb3N1cmVWYXIsXG4gICAgICAgICAgICBpMThuRm9ybWF0UGxhY2Vob2xkZXJOYW1lcyhwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyB0cnVlKSksXG4gICAgICAgIGNyZWF0ZUxvY2FsaXplU3RhdGVtZW50cyhcbiAgICAgICAgICAgIHZhcmlhYmxlLCBtZXNzYWdlLCBpMThuRm9ybWF0UGxhY2Vob2xkZXJOYW1lcyhwYXJhbXMsIC8qIHVzZUNhbWVsQ2FzZSAqLyBmYWxzZSkpKSxcbiAgXTtcblxuICBpZiAodHJhbnNmb3JtRm4pIHtcbiAgICBzdGF0ZW1lbnRzLnB1c2gobmV3IG8uRXhwcmVzc2lvblN0YXRlbWVudCh2YXJpYWJsZS5zZXQodHJhbnNmb3JtRm4odmFyaWFibGUpKSkpO1xuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudHM7XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGd1YXJkIHRoZSBjbG9zdXJlIG1vZGUgYmxvY2tcbiAqIEl0IGlzIGVxdWl2YWxlbnQgdG86XG4gKlxuICogYGBgXG4gKiB0eXBlb2YgbmdJMThuQ2xvc3VyZU1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZ0kxOG5DbG9zdXJlTW9kZVxuICogYGBgXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNsb3N1cmVNb2RlR3VhcmQoKTogby5CaW5hcnlPcGVyYXRvckV4cHIge1xuICByZXR1cm4gby50eXBlb2ZFeHByKG8udmFyaWFibGUoTkdfSTE4Tl9DTE9TVVJFX01PREUpKVxuICAgICAgLm5vdElkZW50aWNhbChvLmxpdGVyYWwoJ3VuZGVmaW5lZCcsIG8uU1RSSU5HX1RZUEUpKVxuICAgICAgLmFuZChvLnZhcmlhYmxlKE5HX0kxOE5fQ0xPU1VSRV9NT0RFKSk7XG59XG5cbi8qKlxuICogSW5mb3JtYXRpb24gYWJvdXQgdGhlIHRlbXBsYXRlIHdoaWNoIHdhcyBleHRyYWN0ZWQgZHVyaW5nIHBhcnNpbmcuXG4gKlxuICogVGhpcyBjb250YWlucyB0aGUgYWN0dWFsIHBhcnNlZCB0ZW1wbGF0ZSBhcyB3ZWxsIGFzIGFueSBtZXRhZGF0YSBjb2xsZWN0ZWQgZHVyaW5nIGl0cyBwYXJzaW5nLFxuICogc29tZSBvZiB3aGljaCBtaWdodCBiZSB1c2VmdWwgZm9yIHJlLXBhcnNpbmcgdGhlIHRlbXBsYXRlIHdpdGggZGlmZmVyZW50IG9wdGlvbnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVGVtcGxhdGUge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIEhvdyB0byBwYXJzZSBpbnRlcnBvbGF0aW9uIG1hcmtlcnMuXG4gICAqL1xuICBpbnRlcnBvbGF0aW9uQ29uZmlnPzogSW50ZXJwb2xhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICogVGhlIHN0cmluZyBjb250ZW50cyBvZiB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgaXMgdGhlIFwibG9naWNhbFwiIHRlbXBsYXRlIHN0cmluZywgYWZ0ZXIgZXhwYW5zaW9uIG9mIGFueSBlc2NhcGVkIGNoYXJhY3RlcnMgKGZvciBpbmxpbmVcbiAgICogdGVtcGxhdGVzKS4gVGhpcyBtYXkgZGlmZmVyIGZyb20gdGhlIGFjdHVhbCB0ZW1wbGF0ZSBieXRlcyBhcyB0aGV5IGFwcGVhciBpbiB0aGUgLnRzIGZpbGUuXG4gICAqL1xuICB0ZW1wbGF0ZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBbnkgZXJyb3JzIGZyb20gcGFyc2luZyB0aGUgdGVtcGxhdGUgdGhlIGZpcnN0IHRpbWUuXG4gICAqXG4gICAqIGBudWxsYCBpZiB0aGVyZSBhcmUgbm8gZXJyb3JzLiBPdGhlcndpc2UsIHRoZSBhcnJheSBvZiBlcnJvcnMgaXMgZ3VhcmFudGVlZCB0byBiZSBub24tZW1wdHkuXG4gICAqL1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXXxudWxsO1xuXG4gIC8qKlxuICAgKiBUaGUgdGVtcGxhdGUgQVNULCBwYXJzZWQgZnJvbSB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBub2RlczogdC5Ob2RlW107XG5cbiAgLyoqXG4gICAqIEFueSBzdHlsZVVybHMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IGlubGluZSBzdHlsZXMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG59XG4iXX0=