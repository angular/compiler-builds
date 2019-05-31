/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { flatten, sanitizeIdentifier } from '../../compile_metadata';
import { BindingForm, BuiltinFunctionCall, convertActionBinding, convertPropertyBinding, convertUpdateArguments } from '../../compiler_util/expression_converter';
import * as core from '../../core';
import { AstMemoryEfficientTransformer, FunctionCall, ImplicitReceiver, Interpolation, LiteralArray, LiteralPrimitive, PropertyRead } from '../../expression_parser/ast';
import { Lexer } from '../../expression_parser/lexer';
import { Parser } from '../../expression_parser/parser';
import * as html from '../../ml_parser/ast';
import { HtmlParser } from '../../ml_parser/html_parser';
import { WhitespaceVisitor } from '../../ml_parser/html_whitespaces';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import { isNgContainer as checkIsNgContainer, splitNsName } from '../../ml_parser/tags';
import { mapLiteral } from '../../output/map_util';
import * as o from '../../output/output_ast';
import { DomElementSchemaRegistry } from '../../schema/dom_element_schema_registry';
import { CssSelector } from '../../selector';
import { BindingParser } from '../../template_parser/binding_parser';
import { error } from '../../util';
import * as t from '../r3_ast';
import { Identifiers as R3 } from '../r3_identifiers';
import { htmlAstToRender3Ast } from '../r3_template_transform';
import { prepareSyntheticListenerFunctionName, prepareSyntheticListenerName, prepareSyntheticPropertyName } from '../util';
import { I18nContext } from './i18n/context';
import { I18nMetaVisitor } from './i18n/meta';
import { getSerializedI18nContent } from './i18n/serializer';
import { I18N_ICU_MAPPING_PREFIX, TRANSLATION_PREFIX, assembleBoundTextPlaceholders, assembleI18nBoundString, formatI18nPlaceholderName, getTranslationConstPrefix, getTranslationDeclStmts, icuFromI18nMessage, isI18nRootNode, isSingleI18nIcu, metaFromI18nMessage, placeholdersToParams, wrapI18nPlaceholder } from './i18n/util';
import { StylingBuilder } from './styling_builder';
import { CONTEXT_NAME, IMPLICIT_REFERENCE, NON_BINDABLE_ATTR, REFERENCE_PREFIX, RENDER_FLAGS, asLiteral, getAttrsForDirectiveMatching, invalid, trimTrailingNulls, unsupported } from './util';
// Selector attribute name of `<ng-content>`
var NG_CONTENT_SELECT_ATTR = 'select';
// Attribute name of `ngProjectAs`.
var NG_PROJECT_AS_ATTR_NAME = 'ngProjectAs';
// List of supported global targets for event listeners
var GLOBAL_TARGET_RESOLVERS = new Map([['window', R3.resolveWindow], ['document', R3.resolveDocument], ['body', R3.resolveBody]]);
var LEADING_TRIVIA_CHARS = [' ', '\n', '\r', '\t'];
//  if (rf & flags) { .. }
export function renderFlagCheckIfStmt(flags, statements) {
    return o.ifStmt(o.variable(RENDER_FLAGS).bitwiseAnd(o.literal(flags), null, false), statements);
}
export function prepareEventListenerParameters(eventAst, bindingContext, handlerName, scope) {
    if (handlerName === void 0) { handlerName = null; }
    if (scope === void 0) { scope = null; }
    var type = eventAst.type, name = eventAst.name, target = eventAst.target, phase = eventAst.phase, handler = eventAst.handler;
    if (target && !GLOBAL_TARGET_RESOLVERS.has(target)) {
        throw new Error("Unexpected global target '" + target + "' defined for '" + name + "' event.\n        Supported list of global targets: " + Array.from(GLOBAL_TARGET_RESOLVERS.keys()) + ".");
    }
    var bindingExpr = convertActionBinding(scope, bindingContext, handler, 'b', function () { return error('Unexpected interpolation'); }, eventAst.handlerSpan);
    var statements = [];
    if (scope) {
        statements.push.apply(statements, tslib_1.__spread(scope.restoreViewStatement()));
        statements.push.apply(statements, tslib_1.__spread(scope.variableDeclarations()));
    }
    statements.push.apply(statements, tslib_1.__spread(bindingExpr.render3Stmts));
    var eventName = type === 1 /* Animation */ ? prepareSyntheticListenerName(name, phase) : name;
    var fnName = handlerName && sanitizeIdentifier(handlerName);
    var fnArgs = [new o.FnParam('$event', o.DYNAMIC_TYPE)];
    var handlerFn = o.fn(fnArgs, statements, o.INFERRED_TYPE, null, fnName);
    var params = [o.literal(eventName), handlerFn];
    if (target) {
        params.push(o.literal(false), // `useCapture` flag, defaults to `false`
        o.importExpr(GLOBAL_TARGET_RESOLVERS.get(target)));
    }
    return params;
}
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
        this._unsupported = unsupported;
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
        // These should be handled in the template or element directly.
        this.visitReference = invalid;
        this.visitVariable = invalid;
        this.visitTextAttribute = invalid;
        this.visitBoundAttribute = invalid;
        this.visitBoundEvent = invalid;
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
            _this.creationInstruction(null, R3.pipe, [o.literal(slot), o.literal(name)]);
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
                rhs = o.variable(CONTEXT_NAME);
            }
            else {
                var sharedCtxVar = scope.getSharedContextName(retrievalLevel);
                // e.g. ctx_r0   OR  x(2);
                rhs = sharedCtxVar ? sharedCtxVar : generateNextContextExpr(relativeLevel);
            }
            // e.g. const $item$ = x(2).$implicit;
            return [lhs.set(rhs.prop(variable.value || IMPLICIT_REFERENCE)).toConstDecl()];
        });
    };
    TemplateDefinitionBuilder.prototype.buildTemplateFunction = function (nodes, variables, ngContentSelectorsOffset, i18n) {
        var _this = this;
        if (ngContentSelectorsOffset === void 0) { ngContentSelectorsOffset = 0; }
        this._ngContentSelectorsOffset = ngContentSelectorsOffset;
        if (this._namespace !== R3.namespaceHTML) {
            this.creationInstruction(null, this._namespace);
        }
        // Create variable bindings
        variables.forEach(function (v) { return _this.registerContextVariables(v); });
        // Initiate i18n context in case:
        // - this template has parent i18n context
        // - or the template has i18n meta associated with it,
        //   but it's not initiated by the Element (e.g. <ng-template i18n>)
        var initI18nContext = this.i18nContext || (isI18nRootNode(i18n) && !isSingleI18nIcu(i18n) &&
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
                parameters.push(this.constantPool.getConstLiteral(asLiteral(r3ReservedSlots), true));
            }
            // Since we accumulate ngContent selectors while processing template elements,
            // we *prepend* `projectionDef` to creation instructions block, to put it before
            // any `projection` instructions
            this.creationInstruction(null, R3.projectionDef, parameters, /* prepend */ true);
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
        [new o.FnParam(RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(CONTEXT_NAME, null)], tslib_1.__spread(this._prefixCode, creationBlock, updateBlock), o.INFERRED_TYPE, null, this.templateName);
    };
    // LocalResolver
    TemplateDefinitionBuilder.prototype.getLocal = function (name) { return this._bindingScope.get(name); };
    TemplateDefinitionBuilder.prototype.i18nTranslate = function (message, params, ref, transformFn) {
        var _a;
        if (params === void 0) { params = {}; }
        var _ref = ref || o.variable(this.constantPool.uniqueName(TRANSLATION_PREFIX));
        // Closure Compiler requires const names to start with `MSG_` but disallows any other const to
        // start with `MSG_`. We define a variable starting with `MSG_` just for the `goog.getMsg` call
        var closureVar = this.i18nGenerateClosureVar(message.id);
        var _params = {};
        if (params && Object.keys(params).length) {
            Object.keys(params).forEach(function (key) { return _params[formatI18nPlaceholderName(key)] = params[key]; });
        }
        var meta = metaFromI18nMessage(message);
        var content = getSerializedI18nContent(message);
        var statements = getTranslationDeclStmts(_ref, closureVar, content, meta, _params, transformFn);
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
                if (value instanceof Interpolation) {
                    var strings = value.strings, expressions = value.expressions;
                    var _a = _this.i18n, id = _a.id, bindings = _a.bindings;
                    var label = assembleI18nBoundString(strings, bindings.size, id);
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
            var prefix = getTranslationConstPrefix("EXTERNAL_");
            var uniqueSuffix = this.constantPool.uniqueName(suffix);
            name = "" + prefix + sanitizeIdentifier(messageId) + "$$" + uniqueSuffix;
        }
        else {
            var prefix = getTranslationConstPrefix(suffix);
            name = this.constantPool.uniqueName(prefix);
        }
        return o.variable(name);
    };
    TemplateDefinitionBuilder.prototype.i18nUpdateRef = function (context) {
        var icus = context.icus, meta = context.meta, isRoot = context.isRoot, isResolved = context.isResolved, isEmitted = context.isEmitted;
        if (isRoot && isResolved && !isEmitted && !isSingleI18nIcu(meta)) {
            context.isEmitted = true;
            var placeholders = context.getSerializedPlaceholders();
            var icuMapping_1 = {};
            var params_1 = placeholders.size ? placeholdersToParams(placeholders) : {};
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
                        var placeholder = wrapI18nPlaceholder("" + I18N_ICU_MAPPING_PREFIX + key);
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
                        args.push(mapLiteral(icuMapping_1, true));
                    }
                    return instruction(null, R3.i18nPostprocess, args);
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
            var ref_1 = o.variable(this.constantPool.uniqueName(TRANSLATION_PREFIX));
            this.i18n = new I18nContext(index, ref_1, 0, this.templateIndex, meta);
        }
        // generate i18nStart instruction
        var _a = this.i18n, id = _a.id, ref = _a.ref;
        var params = [o.literal(index), ref];
        if (id > 0) {
            // do not push 3rd argument (sub-block id)
            // into i18nStart call for top level i18n context
            params.push(o.literal(id));
        }
        this.creationInstruction(span, selfClosing ? R3.i18n : R3.i18nStart, params);
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
                _this.updateInstruction(index, span, R3.i18nExp, function () { return [_this.convertPropertyBinding(o.variable(CONTEXT_NAME), binding)]; });
            });
            this.updateInstruction(index, span, R3.i18nApply, [o.literal(index)]);
        }
        if (!selfClosing) {
            this.creationInstruction(span, R3.i18nEnd);
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
        this.creationInstruction(ngContent.sourceSpan, R3.projection, parameters);
    };
    TemplateDefinitionBuilder.prototype.getNamespaceInstruction = function (namespaceKey) {
        switch (namespaceKey) {
            case 'math':
                return R3.namespaceMathML;
            case 'svg':
                return R3.namespaceSVG;
            default:
                return R3.namespaceHTML;
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
        var stylingBuilder = new StylingBuilder(o.literal(elementIndex), null);
        var isNonBindableMode = false;
        var isI18nRootElement = isI18nRootNode(element.i18n) && !isSingleI18nIcu(element.i18n);
        if (isI18nRootElement && this.i18n) {
            throw new Error("Could not mark an element as translatable inside of a translatable section");
        }
        var i18nAttrs = [];
        var outputAttrs = [];
        var _b = tslib_1.__read(splitNsName(element.name), 2), namespaceKey = _b[0], elementName = _b[1];
        var isNgContainer = checkIsNgContainer(element.name);
        try {
            // Handle styling, i18n, ngNonBindable attributes
            for (var _c = tslib_1.__values(element.attributes), _d = _c.next(); !_d.done; _d = _c.next()) {
                var attr = _d.value;
                var name_1 = attr.name, value = attr.value;
                if (name_1 === NON_BINDABLE_ATTR) {
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
        var implicit = o.variable(CONTEXT_NAME);
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
            this.creationInstruction(element.sourceSpan, R3.element, trimTrailingNulls(parameters));
        }
        else {
            this.creationInstruction(element.sourceSpan, isNgContainer ? R3.elementContainerStart : R3.elementStart, trimTrailingNulls(parameters));
            if (isNonBindableMode) {
                this.creationInstruction(element.sourceSpan, R3.disableBindings);
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
                        if (converted instanceof Interpolation) {
                            var placeholders = assembleBoundTextPlaceholders(message);
                            var params = placeholdersToParams(placeholders);
                            i18nAttrArgs_1.push(o.literal(attr.name), _this.i18nTranslate(message, params));
                            converted.expressions.forEach(function (expression) {
                                hasBindings_1 = true;
                                _this.updateInstruction(elementIndex, element.sourceSpan, R3.i18nExp, function () { return [_this.convertExpressionBinding(implicit, expression)]; });
                            });
                        }
                    }
                });
                if (i18nAttrArgs_1.length) {
                    var index = o.literal(this.allocateDataSlot());
                    var args = this.constantPool.getConstLiteral(o.literalArr(i18nAttrArgs_1), true);
                    this.creationInstruction(element.sourceSpan, R3.i18nAttributes, [index, args]);
                    if (hasBindings_1) {
                        this.updateInstruction(elementIndex, element.sourceSpan, R3.i18nApply, [index]);
                    }
                }
            }
            // The style bindings code is placed into two distinct blocks within the template function AOT
            // code: creation and update. The creation code contains the `styling` instructions
            // which will apply the collected binding values to the element. `styling` is
            // designed to run inside of `elementStart` and `elementEnd`. The update instructions
            // (things like `styleProp`, `classProp`, etc..) are applied later on in this
            // file
            this.processStylingInstruction(elementIndex, implicit, stylingBuilder.buildStylingInstruction(element.sourceSpan, this.constantPool), true);
            // Generate Listeners (outputs)
            element.outputs.forEach(function (outputAst) {
                _this.creationInstruction(outputAst.sourceSpan, R3.listener, _this.prepareListenerParameter(element.name, outputAst, elementIndex));
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
            this.processStylingInstruction(elementIndex, implicit, instruction_1, false);
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
                var hasValue_1 = value_1 instanceof LiteralPrimitive ? !!value_1.value : true;
                _this.allocateBindingSlots(value_1);
                var bindingName_1 = prepareSyntheticPropertyName(input.name);
                _this.updateInstruction(elementIndex, input.sourceSpan, R3.property, function () {
                    return [
                        o.literal(bindingName_1),
                        (hasValue_1 ? _this.convertPropertyBinding(implicit, value_1, /* skipBindFn */ true) :
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
                    var _a = tslib_1.__read(splitNsName(input.name), 2), attrNamespace = _a[0], attrName_1 = _a[1];
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
                        if (value_2 instanceof Interpolation) {
                            // prop="{{value}}" and friends
                            _this.interpolatedUpdateInstruction(getPropertyInterpolationExpression(value_2), elementIndex, attrName_1, input, value_2, params_2);
                        }
                        else {
                            // [prop]="value"
                            _this.boundUpdateInstruction(R3.property, elementIndex, attrName_1, input, implicit, value_2, params_2);
                        }
                    }
                    else if (inputType === 1 /* Attribute */) {
                        if (value_2 instanceof Interpolation && getInterpolationArgsLength(value_2) > 1) {
                            // attr.name="text{{value}}" and friends
                            _this.interpolatedUpdateInstruction(getAttributeInterpolationExpression(value_2), elementIndex, attrName_1, input, value_2, params_2);
                        }
                        else {
                            var boundValue = value_2 instanceof Interpolation ? value_2.expressions[0] : value_2;
                            // [attr.name]="value" or attr.name="{{value}}"
                            _this.boundUpdateInstruction(R3.attribute, elementIndex, attrName_1, input, implicit, boundValue, params_2);
                        }
                    }
                    else {
                        // class prop
                        _this.updateInstruction(elementIndex, input.sourceSpan, R3.classProp, function () {
                            return tslib_1.__spread([
                                o.literal(elementIndex), o.literal(attrName_1),
                                _this.convertPropertyBinding(implicit, value_2)
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
                this.creationInstruction(span, R3.enableBindings);
            }
            this.creationInstruction(span, isNgContainer ? R3.elementContainerEnd : R3.elementEnd);
        }
    };
    /**
     * Adds an update instruction for a bound property or attribute, such as `[prop]="value"` or
     * `[attr.title]="value"`
     */
    TemplateDefinitionBuilder.prototype.boundUpdateInstruction = function (instruction, elementIndex, attrName, input, implicit, value, params) {
        var _this = this;
        this.updateInstruction(elementIndex, input.sourceSpan, instruction, function () {
            return tslib_1.__spread([o.literal(attrName), _this.convertPropertyBinding(implicit, value, true)], params);
        });
    };
    /**
     * Adds an update instruction for an interpolated property or attribute, such as
     * `prop="{{value}}"` or `attr.title="{{value}}"`
     */
    TemplateDefinitionBuilder.prototype.interpolatedUpdateInstruction = function (instruction, elementIndex, attrName, input, value, params) {
        var _this = this;
        this.updateInstruction(elementIndex, input.sourceSpan, instruction, function () {
            return tslib_1.__spread([o.literal(attrName)], _this.getUpdateInstructionArguments(o.variable(CONTEXT_NAME), value), params);
        });
    };
    TemplateDefinitionBuilder.prototype.visitTemplate = function (template) {
        var _this = this;
        var NG_TEMPLATE_TAG_NAME = 'ng-template';
        var templateIndex = this.allocateDataSlot();
        if (this.i18n) {
            this.i18n.appendTemplate(template.i18n, templateIndex);
        }
        var tagName = sanitizeIdentifier(template.tagName || '');
        var contextName = "" + this.contextName + (tagName ? '_' + tagName : '') + "_" + templateIndex;
        var templateName = contextName + "_Template";
        var parameters = [
            o.literal(templateIndex),
            o.variable(templateName),
            // We don't care about the tag's namespace here, because we infer
            // it based on the parent nodes inside the template instruction.
            o.literal(template.tagName ? splitNsName(template.tagName)[1] : template.tagName),
        ];
        // find directives matching on a given <ng-template> node
        this.matchDirectives(NG_TEMPLATE_TAG_NAME, template);
        // prepare attributes parameter (including attributes used for directive matching)
        var attrsExprs = [];
        template.attributes.forEach(function (a) { attrsExprs.push(asLiteral(a.name), asLiteral(a.value)); });
        attrsExprs.push.apply(attrsExprs, tslib_1.__spread(this.prepareNonRenderAttrs(template.inputs, template.outputs, undefined, template.templateAttrs)));
        parameters.push(this.toAttrsParam(attrsExprs));
        // local refs (ex.: <ng-template #foo>)
        if (template.references && template.references.length) {
            parameters.push(this.prepareRefsParameter(template.references));
            parameters.push(o.importExpr(R3.templateRefExtractor));
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
        this.creationInstruction(template.sourceSpan, R3.templateCreate, function () {
            parameters.splice(2, 0, o.literal(templateVisitor.getConstCount()), o.literal(templateVisitor.getVarCount()));
            return trimTrailingNulls(parameters);
        });
        // handle property bindings e.g. ɵɵproperty('ngForOf', ctx.items), et al;
        var context = o.variable(CONTEXT_NAME);
        this.templatePropertyBindings(template, templateIndex, context, template.templateAttrs);
        // Only add normal input/output binding instructions on explicit ng-template elements.
        if (template.tagName === NG_TEMPLATE_TAG_NAME) {
            // Add the input bindings
            this.templatePropertyBindings(template, templateIndex, context, template.inputs);
            // Generate listeners for directive output
            template.outputs.forEach(function (outputAst) {
                _this.creationInstruction(outputAst.sourceSpan, R3.listener, _this.prepareListenerParameter('ng_template', outputAst, templateIndex));
            });
        }
    };
    TemplateDefinitionBuilder.prototype.visitBoundText = function (text) {
        var _this = this;
        if (this.i18n) {
            var value_3 = text.value.visit(this._valueConverter);
            this.allocateBindingSlots(value_3);
            if (value_3 instanceof Interpolation) {
                this.i18n.appendBoundText(text.i18n);
                this.i18nAppendBindings(value_3.expressions);
            }
            return;
        }
        var nodeIndex = this.allocateDataSlot();
        this.creationInstruction(text.sourceSpan, R3.text, [o.literal(nodeIndex)]);
        var value = text.value.visit(this._valueConverter);
        this.allocateBindingSlots(value);
        if (value instanceof Interpolation) {
            this.updateInstruction(nodeIndex, text.sourceSpan, getTextInterpolationExpression(value), function () { return _this.getUpdateInstructionArguments(o.variable(CONTEXT_NAME), value); });
        }
        else {
            this.updateInstruction(nodeIndex, text.sourceSpan, R3.textBinding, function () {
                return [o.literal(nodeIndex), _this.convertPropertyBinding(o.variable(CONTEXT_NAME), value)];
            });
        }
    };
    TemplateDefinitionBuilder.prototype.visitText = function (text) {
        // when a text element is located within a translatable
        // block, we exclude this text element from instructions set,
        // since it will be captured in i18n content and processed at runtime
        if (!this.i18n) {
            this.creationInstruction(text.sourceSpan, R3.text, [o.literal(this.allocateDataSlot()), o.literal(text.value)]);
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
            return instruction(null, R3.i18nPostprocess, [raw, mapLiteral(vars, true)]);
        };
        // in case the whole i18n message is a single ICU - we do not need to
        // create a separate top-level translation, we can use the root ref instead
        // and make this ICU a top-level translation
        if (isSingleI18nIcu(i18n.meta)) {
            this.i18nTranslate(message, placeholders, i18n.ref, transformFn);
        }
        else {
            // output ICU directly and keep ICU reference in context
            var ref = this.i18nTranslate(message, placeholders, undefined, transformFn);
            i18n.appendIcu(icuFromI18nMessage(message).name, ref);
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
            this.constantPool.getConstLiteral(asLiteral(this._ngContentReservedSlots), true) :
            null;
    };
    TemplateDefinitionBuilder.prototype.bindingContext = function () { return "" + this._bindingContext++; };
    TemplateDefinitionBuilder.prototype.templatePropertyBindings = function (template, templateIndex, context, attrs) {
        var _this = this;
        attrs.forEach(function (input) {
            if (input instanceof t.BoundAttribute) {
                var value_4 = input.value.visit(_this._valueConverter);
                _this.allocateBindingSlots(value_4);
                _this.updateInstruction(templateIndex, template.sourceSpan, R3.property, function () { return [o.literal(input.name), _this.convertPropertyBinding(context, value_4, true)]; });
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
    TemplateDefinitionBuilder.prototype.processStylingInstruction = function (elementIndex, implicit, instruction, createMode) {
        var _this = this;
        if (instruction) {
            var paramsFn = function () {
                return instruction.buildParams(function (value) { return _this.convertPropertyBinding(implicit, value, true); });
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
            this.instructionFn(this._updateCodeFns, span, R3.select, [o.literal(nodeIndex)]);
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
        this._bindingSlots += value instanceof Interpolation ? value.expressions.length : 1;
    };
    TemplateDefinitionBuilder.prototype.convertExpressionBinding = function (implicit, value) {
        var convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple);
        var valExpr = convertedPropertyBinding.currValExpr;
        return o.importExpr(R3.bind).callFn([valExpr]);
    };
    TemplateDefinitionBuilder.prototype.convertPropertyBinding = function (implicit, value, skipBindFn) {
        var _a;
        var interpolationFn = value instanceof Interpolation ? interpolate : function () { return error('Unexpected interpolation'); };
        var convertedPropertyBinding = convertPropertyBinding(this, implicit, value, this.bindingContext(), BindingForm.TrySimple, interpolationFn);
        (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(convertedPropertyBinding.stmts));
        var valExpr = convertedPropertyBinding.currValExpr;
        return value instanceof Interpolation || skipBindFn ? valExpr :
            o.importExpr(R3.bind).callFn([valExpr]);
    };
    /**
     * Gets a list of argument expressions to pass to an update instruction expression. Also updates
     * the temp variables state with temp variables that were identified as needing to be created
     * while visiting the arguments.
     * @param contextExpression The expression for the context variable used to create arguments
     * @param value The original expression we will be resolving an arguments list from.
     */
    TemplateDefinitionBuilder.prototype.getUpdateInstructionArguments = function (contextExpression, value) {
        var _a;
        var _b = convertUpdateArguments(this, contextExpression, value, this.bindingContext()), args = _b.args, stmts = _b.stmts;
        (_a = this._tempVariables).push.apply(_a, tslib_1.__spread(stmts));
        return args;
    };
    TemplateDefinitionBuilder.prototype.matchDirectives = function (tagName, elOrTpl) {
        var _this = this;
        if (this.directiveMatcher) {
            var selector = createCssSelector(tagName, getAttrsForDirectiveMatching(elOrTpl));
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
        var refsParam = flatten(references.map(function (reference) {
            var slot = _this.allocateDataSlot();
            // Generate the update temporary.
            var variableName = _this._bindingScope.freshReferenceName();
            var retrievalLevel = _this.level;
            var lhs = o.variable(variableName);
            _this._bindingScope.set(retrievalLevel, reference.name, lhs, 0 /* DEFAULT */, function (scope, relativeLevel) {
                // e.g. nextContext(2);
                var nextContextStmt = relativeLevel > 0 ? [generateNextContextExpr(relativeLevel).toStmt()] : [];
                // e.g. const $foo$ = reference(1);
                var refExpr = lhs.set(o.importExpr(R3.reference).callFn([o.literal(slot)]));
                return nextContextStmt.concat(refExpr.toConstDecl());
            }, true);
            return [reference.name, reference.value];
        }));
        return this.constantPool.getConstLiteral(asLiteral(refsParam), true);
    };
    TemplateDefinitionBuilder.prototype.prepareListenerParameter = function (tagName, outputAst, index) {
        var _this = this;
        return function () {
            var eventName = outputAst.name;
            var bindingFnName = outputAst.type === 1 /* Animation */ ?
                // synthetic @listener.foo values are treated the exact same as are standard listeners
                prepareSyntheticListenerFunctionName(eventName, outputAst.phase) :
                sanitizeIdentifier(eventName);
            var handlerName = _this.templateName + "_" + tagName + "_" + bindingFnName + "_" + index + "_listener";
            var scope = _this._bindingScope.nestedScope(_this._bindingScope.bindingLevel);
            var context = o.variable(CONTEXT_NAME);
            return prepareEventListenerParameters(outputAst, context, handlerName, scope);
        };
    };
    return TemplateDefinitionBuilder;
}());
export { TemplateDefinitionBuilder };
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
        var target = new PropertyRead(pipe.span, new ImplicitReceiver(pipe.span), slotPseudoLocal);
        var _a = pipeBindingCallInfo(pipe.args), identifier = _a.identifier, isVarLength = _a.isVarLength;
        this.definePipe(pipe.name, slotPseudoLocal, slot, o.importExpr(identifier));
        var args = tslib_1.__spread([pipe.exp], pipe.args);
        var convertedArgs = isVarLength ? this.visitAll([new LiteralArray(pipe.span, args)]) : this.visitAll(args);
        var pipeBindExpr = new FunctionCall(pipe.span, target, tslib_1.__spread([
            new LiteralPrimitive(pipe.span, slot),
            new LiteralPrimitive(pipe.span, pureFunctionSlot)
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
        return new BuiltinFunctionCall(array.span, this.visitAll(array.expressions), function (values) {
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
        return new BuiltinFunctionCall(map.span, this.visitAll(map.values), function (values) {
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
}(AstMemoryEfficientTransformer));
export { ValueConverter };
// Pipes always have at least one parameter, the value they operate on
var pipeBindingIdentifiers = [R3.pipeBind1, R3.pipeBind2, R3.pipeBind3, R3.pipeBind4];
function pipeBindingCallInfo(args) {
    var identifier = pipeBindingIdentifiers[args.length];
    return {
        identifier: identifier || R3.pipeBindV,
        isVarLength: !identifier,
    };
}
var pureFunctionIdentifiers = [
    R3.pureFunction0, R3.pureFunction1, R3.pureFunction2, R3.pureFunction3, R3.pureFunction4,
    R3.pureFunction5, R3.pureFunction6, R3.pureFunction7, R3.pureFunction8
];
function pureFunctionCallInfo(args) {
    var identifier = pureFunctionIdentifiers[args.length];
    return {
        identifier: identifier || R3.pureFunctionV,
        isVarLength: !identifier,
    };
}
function instruction(span, reference, params) {
    return o.importExpr(reference, null, span).callFn(params, span);
}
// e.g. x(2);
function generateNextContextExpr(relativeLevelDiff) {
    return o.importExpr(R3.nextContext)
        .callFn(relativeLevelDiff > 1 ? [o.literal(relativeLevelDiff)] : []);
}
function getLiteralFactory(constantPool, literal, allocateSlots) {
    var _a = constantPool.getLiteralFactory(literal), literalFactory = _a.literalFactory, literalFactoryArguments = _a.literalFactoryArguments;
    // Allocate 1 slot for the result plus 1 per argument
    var startSlot = allocateSlots(1 + literalFactoryArguments.length);
    literalFactoryArguments.length > 0 || error("Expected arguments to a literal factory function");
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
    var _a = tslib_1.__read(splitNsName(name), 2), attributeNamespace = _a[0], attributeName = _a[1];
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
            error("The name " + name + " is already defined in scope to be " + this.map.get(name));
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
    BindingScope.prototype.getLocal = function (name) { return this.get(name); };
    BindingScope.prototype.nestedScope = function (level) {
        var newScope = new BindingScope(level, this);
        if (level > 0)
            newScope.generateSharedContextVar(0);
        return newScope;
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
        var lhs = o.variable(CONTEXT_NAME + this.freshReferenceName());
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
            [instruction(null, R3.restoreView, [this.restoreViewVariable]).toStmt()] :
            [];
    };
    BindingScope.prototype.viewSnapshotStatements = function () {
        // const $state$ = getCurrentView();
        var getCurrentViewInstruction = instruction(null, R3.getCurrentView, []);
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
        var ref = "" + REFERENCE_PREFIX + current.referenceNameIndex++;
        return ref;
    };
    return BindingScope;
}());
export { BindingScope };
/**
 * Creates a `CssSelector` given a tag name and a map of attributes
 */
function createCssSelector(tag, attributes) {
    var cssSelector = new CssSelector();
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
    return [o.literal(5 /* ProjectAs */), asLiteral(parsedR3Selector)];
}
function interpolate(args) {
    args = args.slice(1); // Ignore the length prefix added for render2
    switch (args.length) {
        case 3:
            return o.importExpr(R3.interpolation1).callFn(args);
        case 5:
            return o.importExpr(R3.interpolation2).callFn(args);
        case 7:
            return o.importExpr(R3.interpolation3).callFn(args);
        case 9:
            return o.importExpr(R3.interpolation4).callFn(args);
        case 11:
            return o.importExpr(R3.interpolation5).callFn(args);
        case 13:
            return o.importExpr(R3.interpolation6).callFn(args);
        case 15:
            return o.importExpr(R3.interpolation7).callFn(args);
        case 17:
            return o.importExpr(R3.interpolation8).callFn(args);
    }
    (args.length >= 19 && args.length % 2 == 1) ||
        error("Invalid interpolation argument length " + args.length);
    return o.importExpr(R3.interpolationV).callFn([o.literalArr(args)]);
}
/**
 * Gets the instruction to generate for an interpolated property
 * @param interpolation An Interpolation AST
 */
function getPropertyInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.propertyInterpolate;
        case 3:
            return R3.propertyInterpolate1;
        case 5:
            return R3.propertyInterpolate2;
        case 7:
            return R3.propertyInterpolate3;
        case 9:
            return R3.propertyInterpolate4;
        case 11:
            return R3.propertyInterpolate5;
        case 13:
            return R3.propertyInterpolate6;
        case 15:
            return R3.propertyInterpolate7;
        case 17:
            return R3.propertyInterpolate8;
        default:
            return R3.propertyInterpolateV;
    }
}
/**
 * Gets the instruction to generate for an interpolated attribute
 * @param interpolation An Interpolation AST
 */
function getAttributeInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 3:
            return R3.attributeInterpolate1;
        case 5:
            return R3.attributeInterpolate2;
        case 7:
            return R3.attributeInterpolate3;
        case 9:
            return R3.attributeInterpolate4;
        case 11:
            return R3.attributeInterpolate5;
        case 13:
            return R3.attributeInterpolate6;
        case 15:
            return R3.attributeInterpolate7;
        case 17:
            return R3.attributeInterpolate8;
        default:
            return R3.attributeInterpolateV;
    }
}
/**
 * Gets the instruction to generate for interpolated text.
 * @param interpolation An Interpolation AST
 */
function getTextInterpolationExpression(interpolation) {
    switch (getInterpolationArgsLength(interpolation)) {
        case 1:
            return R3.textInterpolate;
        case 3:
            return R3.textInterpolate1;
        case 5:
            return R3.textInterpolate2;
        case 7:
            return R3.textInterpolate3;
        case 9:
            return R3.textInterpolate4;
        case 11:
            return R3.textInterpolate5;
        case 13:
            return R3.textInterpolate6;
        case 15:
            return R3.textInterpolate7;
        case 17:
            return R3.textInterpolate8;
        default:
            return R3.textInterpolateV;
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
export function parseTemplate(template, templateUrl, options) {
    if (options === void 0) { options = {}; }
    var interpolationConfig = options.interpolationConfig, preserveWhitespaces = options.preserveWhitespaces;
    var bindingParser = makeBindingParser(interpolationConfig);
    var htmlParser = new HtmlParser();
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
        html.visitAll(new I18nMetaVisitor(interpolationConfig, !preserveWhitespaces), rootNodes);
    if (!preserveWhitespaces) {
        rootNodes = html.visitAll(new WhitespaceVisitor(), rootNodes);
        // run i18n meta visitor again in case we remove whitespaces, because
        // that might affect generated i18n message content. During this pass
        // i18n IDs generated at the first pass will be preserved, so we can mimic
        // existing extraction process (ng xi18n)
        rootNodes = html.visitAll(new I18nMetaVisitor(interpolationConfig, /* keepI18nAttrs */ false), rootNodes);
    }
    var _a = htmlAstToRender3Ast(rootNodes, bindingParser), nodes = _a.nodes, errors = _a.errors, styleUrls = _a.styleUrls, styles = _a.styles;
    if (errors && errors.length > 0) {
        return { errors: errors, nodes: [], styleUrls: [], styles: [] };
    }
    return { nodes: nodes, styleUrls: styleUrls, styles: styles };
}
/**
 * Construct a `BindingParser` with a default configuration.
 */
export function makeBindingParser(interpolationConfig) {
    if (interpolationConfig === void 0) { interpolationConfig = DEFAULT_INTERPOLATION_CONFIG; }
    return new BindingParser(new Parser(new Lexer()), interpolationConfig, new DomElementSchemaRegistry(), null, []);
}
export function resolveSanitizationFn(context, isAttribute) {
    switch (context) {
        case core.SecurityContext.HTML:
            return o.importExpr(R3.sanitizeHtml);
        case core.SecurityContext.SCRIPT:
            return o.importExpr(R3.sanitizeScript);
        case core.SecurityContext.STYLE:
            // the compiler does not fill in an instruction for [style.prop?] binding
            // values because the style algorithm knows internally what props are subject
            // to sanitization (only [attr.style] values are explicitly sanitized)
            return isAttribute ? o.importExpr(R3.sanitizeStyle) : null;
        case core.SecurityContext.URL:
            return o.importExpr(R3.sanitizeUrl);
        case core.SecurityContext.RESOURCE_URL:
            return o.importExpr(R3.sanitizeResourceUrl);
        default:
            return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L3RlbXBsYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbkUsT0FBTyxFQUFDLFdBQVcsRUFBRSxtQkFBbUIsRUFBaUIsb0JBQW9CLEVBQUUsc0JBQXNCLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSwwQ0FBMEMsQ0FBQztBQUUvSyxPQUFPLEtBQUssSUFBSSxNQUFNLFlBQVksQ0FBQztBQUNuQyxPQUFPLEVBQU0sNkJBQTZCLEVBQTRCLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFjLGdCQUFnQixFQUFtQixZQUFZLEVBQUMsTUFBTSw2QkFBNkIsQ0FBQztBQUNuTyxPQUFPLEVBQUMsS0FBSyxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDcEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBRXRELE9BQU8sS0FBSyxJQUFJLE1BQU0scUJBQXFCLENBQUM7QUFDNUMsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ25FLE9BQU8sRUFBQyw0QkFBNEIsRUFBc0IsTUFBTSxzQ0FBc0MsQ0FBQztBQUV2RyxPQUFPLEVBQUMsYUFBYSxJQUFJLGtCQUFrQixFQUFFLFdBQVcsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ3RGLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTdDLE9BQU8sRUFBQyx3QkFB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Q0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLG1CQUFnQyxFQUFFLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7QUFDbEYsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLElBQW9CO0lBQ3ZDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUUsNkNBQTZDO0lBQ3BFLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNuQixLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxLQUFLLEVBQUU7WUFDTCxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLE1B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O0FBQ0gsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsUUFBa0I7SUFDakQsT0FBTyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUNuRSxDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsSUFBWTtJQUM5QixPQUFPLElBQUksWUFBWSxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsU0FBUyxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDO0FBQ3hGLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLFFBQWtCO0lBQzdDLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2ZsYXR0ZW4sIHNhbml0aXplSWRlbnRpZmllcn0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBCdWlsdGluRnVuY3Rpb25DYWxsLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZywgY29udmVydFVwZGF0ZUFyZ3VtZW50c30gZnJvbSAnLi4vLi4vY29tcGlsZXJfdXRpbC9leHByZXNzaW9uX2NvbnZlcnRlcic7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi4vLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBjb3JlIGZyb20gJy4uLy4uL2NvcmUnO1xuaW1wb3J0IHtBU1QsIEFzdE1lbW9yeUVmZmljaWVudFRyYW5zZm9ybWVyLCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgTGl0ZXJhbEFycmF5LCBMaXRlcmFsTWFwLCBMaXRlcmFsUHJpbWl0aXZlLCBQYXJzZWRFdmVudFR5cGUsIFByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7TGV4ZXJ9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2xleGVyJztcbmltcG9ydCB7UGFyc2VyfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9wYXJzZXInO1xuaW1wb3J0ICogYXMgaTE4biBmcm9tICcuLi8uLi9pMThuL2kxOG5fYXN0JztcbmltcG9ydCAqIGFzIGh0bWwgZnJvbSAnLi4vLi4vbWxfcGFyc2VyL2FzdCc7XG5pbXBvcnQge0h0bWxQYXJzZXJ9IGZyb20gJy4uLy4uL21sX3BhcnNlci9odG1sX3BhcnNlcic7XG5pbXBvcnQge1doaXRlc3BhY2VWaXNpdG9yfSBmcm9tICcuLi8uLi9tbF9wYXJzZXIvaHRtbF93aGl0ZXNwYWNlcyc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIEludGVycG9sYXRpb25Db25maWd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0xleGVyUmFuZ2V9IGZyb20gJy4uLy4uL21sX3BhcnNlci9sZXhlcic7XG5pbXBvcnQge2lzTmdDb250YWluZXIgYXMgY2hlY2tJc05nQ29udGFpbmVyLCBzcGxpdE5zTmFtZX0gZnJvbSAnLi4vLi4vbWxfcGFyc2VyL3RhZ3MnO1xuaW1wb3J0IHttYXBMaXRlcmFsfSBmcm9tICcuLi8uLi9vdXRwdXQvbWFwX3V0aWwnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7ZXJyb3J9IGZyb20gJy4uLy4uL3V0aWwnO1xuaW1wb3J0ICogYXMgdCBmcm9tICcuLi9yM19hc3QnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtodG1sQXN0VG9SZW5kZXIzQXN0fSBmcm9tICcuLi9yM190ZW1wbGF0ZV90cmFuc2Zvcm0nO1xuaW1wb3J0IHtwcmVwYXJlU3ludGhldGljTGlzdGVuZXJGdW5jdGlvbk5hbWUsIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUsIHByZXBhcmVTeW50aGV0aWNQcm9wZXJ0eU5hbWV9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge0kxOG5Db250ZXh0fSBmcm9tICcuL2kxOG4vY29udGV4dCc7XG5pbXBvcnQge0kxOG5NZXRhVmlzaXRvcn0gZnJvbSAnLi9pMThuL21ldGEnO1xuaW1wb3J0IHtnZXRTZXJpYWxpemVkSTE4bkNvbnRlbnR9IGZyb20gJy4vaTE4bi9zZXJpYWxpemVyJztcbmltcG9ydCB7STE4Tl9JQ1VfTUFQUElOR19QUkVGSVgsIFRSQU5TTEFUSU9OX1BSRUZJWCwgYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMsIGFzc2VtYmxlSTE4bkJvdW5kU3RyaW5nLCBmb3JtYXRJMThuUGxhY2Vob2xkZXJOYW1lLCBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4LCBnZXRUcmFuc2xhdGlvbkRlY2xTdG10cywgaWN1RnJvbUkxOG5NZXNzYWdlLCBpc0kxOG5Sb290Tm9kZSwgaXNTaW5nbGVJMThuSWN1LCBtZXRhRnJvbUkxOG5NZXNzYWdlLCBwbGFjZWhvbGRlcnNUb1BhcmFtcywgd3JhcEkxOG5QbGFjZWhvbGRlcn0gZnJvbSAnLi9pMThuL3V0aWwnO1xuaW1wb3J0IHtJbnN0cnVjdGlvbiwgU3R5bGluZ0J1aWxkZXJ9IGZyb20gJy4vc3R5bGluZ19idWlsZGVyJztcbmltcG9ydCB7Q09OVEVYVF9OQU1FLCBJTVBMSUNJVF9SRUZFUkVOQ0UsIE5PTl9CSU5EQUJMRV9BVFRSLCBSRUZFUkVOQ0VfUFJFRklYLCBSRU5ERVJfRkxBR1MsIGFzTGl0ZXJhbCwgZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZywgaW52YWxpZCwgdHJpbVRyYWlsaW5nTnVsbHMsIHVuc3VwcG9ydGVkfSBmcm9tICcuL3V0aWwnO1xuXG5cbi8vIFNlbGVjdG9yIGF0dHJpYnV0ZSBuYW1lIG9mIGA8bmctY29udGVudD5gXG5jb25zdCBOR19DT05URU5UX1NFTEVDVF9BVFRSID0gJ3NlbGVjdCc7XG5cbi8vIEF0dHJpYnV0ZSBuYW1lIG9mIGBuZ1Byb2plY3RBc2AuXG5jb25zdCBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSA9ICduZ1Byb2plY3RBcyc7XG5cbi8vIExpc3Qgb2Ygc3VwcG9ydGVkIGdsb2JhbCB0YXJnZXRzIGZvciBldmVudCBsaXN0ZW5lcnNcbmNvbnN0IEdMT0JBTF9UQVJHRVRfUkVTT0xWRVJTID0gbmV3IE1hcDxzdHJpbmcsIG8uRXh0ZXJuYWxSZWZlcmVuY2U+KFxuICAgIFtbJ3dpbmRvdycsIFIzLnJlc29sdmVXaW5kb3ddLCBbJ2RvY3VtZW50JywgUjMucmVzb2x2ZURvY3VtZW50XSwgWydib2R5JywgUjMucmVzb2x2ZUJvZHldXSk7XG5cbmNvbnN0IExFQURJTkdfVFJJVklBX0NIQVJTID0gWycgJywgJ1xcbicsICdcXHInLCAnXFx0J107XG5cbi8vICBpZiAocmYgJiBmbGFncykgeyAuLiB9XG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyRmxhZ0NoZWNrSWZTdG10KFxuICAgIGZsYWdzOiBjb3JlLlJlbmRlckZsYWdzLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdKTogby5JZlN0bXQge1xuICByZXR1cm4gby5pZlN0bXQoby52YXJpYWJsZShSRU5ERVJfRkxBR1MpLmJpdHdpc2VBbmQoby5saXRlcmFsKGZsYWdzKSwgbnVsbCwgZmFsc2UpLCBzdGF0ZW1lbnRzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhcbiAgICBldmVudEFzdDogdC5Cb3VuZEV2ZW50LCBiaW5kaW5nQ29udGV4dDogby5FeHByZXNzaW9uLCBoYW5kbGVyTmFtZTogc3RyaW5nIHwgbnVsbCA9IG51bGwsXG4gICAgc2NvcGU6IEJpbmRpbmdTY29wZSB8IG51bGwgPSBudWxsKTogby5FeHByZXNzaW9uW10ge1xuICBjb25zdCB7dHlwZSwgbmFtZSwgdGFyZ2V0LCBwaGFzZSwgaGFuZGxlcn0gPSBldmVudEFzdDtcbiAgaWYgKHRhcmdldCAmJiAhR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuaGFzKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZ2xvYmFsIHRhcmdldCAnJHt0YXJnZXR9JyBkZWZpbmVkIGZvciAnJHtuYW1lfScgZXZlbnQuXG4gICAgICAgIFN1cHBvcnRlZCBsaXN0IG9mIGdsb2JhbCB0YXJnZXRzOiAke0FycmF5LmZyb20oR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMua2V5cygpKX0uYCk7XG4gIH1cblxuICBjb25zdCBiaW5kaW5nRXhwciA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgc2NvcGUsIGJpbmRpbmdDb250ZXh0LCBoYW5kbGVyLCAnYicsICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSxcbiAgICAgIGV2ZW50QXN0LmhhbmRsZXJTcGFuKTtcblxuICBjb25zdCBzdGF0ZW1lbnRzID0gW107XG4gIGlmIChzY29wZSkge1xuICAgIHN0YXRlbWVudHMucHVzaCguLi5zY29wZS5yZXN0b3JlVmlld1N0YXRlbWVudCgpKTtcbiAgICBzdGF0ZW1lbnRzLnB1c2goLi4uc2NvcGUudmFyaWFibGVEZWNsYXJhdGlvbnMoKSk7XG4gIH1cbiAgc3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnJlbmRlcjNTdG10cyk7XG5cbiAgY29uc3QgZXZlbnROYW1lOiBzdHJpbmcgPVxuICAgICAgdHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/IHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lck5hbWUobmFtZSwgcGhhc2UgISkgOiBuYW1lO1xuICBjb25zdCBmbk5hbWUgPSBoYW5kbGVyTmFtZSAmJiBzYW5pdGl6ZUlkZW50aWZpZXIoaGFuZGxlck5hbWUpO1xuICBjb25zdCBmbkFyZ3MgPSBbbmV3IG8uRm5QYXJhbSgnJGV2ZW50Jywgby5EWU5BTUlDX1RZUEUpXTtcbiAgY29uc3QgaGFuZGxlckZuID0gby5mbihmbkFyZ3MsIHN0YXRlbWVudHMsIG8uSU5GRVJSRURfVFlQRSwgbnVsbCwgZm5OYW1lKTtcblxuICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChldmVudE5hbWUpLCBoYW5kbGVyRm5dO1xuICBpZiAodGFyZ2V0KSB7XG4gICAgcGFyYW1zLnB1c2goXG4gICAgICAgIG8ubGl0ZXJhbChmYWxzZSksICAvLyBgdXNlQ2FwdHVyZWAgZmxhZywgZGVmYXVsdHMgdG8gYGZhbHNlYFxuICAgICAgICBvLmltcG9ydEV4cHIoR0xPQkFMX1RBUkdFVF9SRVNPTFZFUlMuZ2V0KHRhcmdldCkgISkpO1xuICB9XG4gIHJldHVybiBwYXJhbXM7XG59XG5cbmV4cG9ydCBjbGFzcyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyIGltcGxlbWVudHMgdC5WaXNpdG9yPHZvaWQ+LCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSBfZGF0YUluZGV4ID0gMDtcbiAgcHJpdmF0ZSBfYmluZGluZ0NvbnRleHQgPSAwO1xuICBwcml2YXRlIF9wcmVmaXhDb2RlOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSBjcmVhdGlvbiBtb2RlIGluc3RydWN0aW9ucy4gV2Ugc3RvcmUgdGhlbSBoZXJlIGFzIHdlIHByb2Nlc3NcbiAgICogdGhlIHRlbXBsYXRlIHNvIGJpbmRpbmdzIGluIGxpc3RlbmVycyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC5cbiAgICogVGhpcyBlbnN1cmVzIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX2NyZWF0aW9uQ29kZUZuczogKCgpID0+IG8uU3RhdGVtZW50KVtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBnZW5lcmF0ZSB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMuIFdlIHN0b3JlIHRoZW0gaGVyZSBhcyB3ZSBwcm9jZXNzXG4gICAqIHRoZSB0ZW1wbGF0ZSBzbyBiaW5kaW5ncyBhcmUgcmVzb2x2ZWQgb25seSBvbmNlIGFsbCBub2RlcyBoYXZlIGJlZW4gdmlzaXRlZC4gVGhpcyBlbnN1cmVzXG4gICAqIGFsbCBsb2NhbCByZWZzIGFuZCBjb250ZXh0IHZhcmlhYmxlcyBhcmUgYXZhaWxhYmxlIGZvciBtYXRjaGluZy5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZUNvZGVGbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSA9IFtdO1xuICAvKipcbiAgICogTWVtb3JpemVzIHRoZSBsYXN0IG5vZGUgaW5kZXggZm9yIHdoaWNoIGEgc2VsZWN0IGluc3RydWN0aW9uIGhhcyBiZWVuIGdlbmVyYXRlZC5cbiAgICogV2UncmUgaW5pdGlhbGl6aW5nIHRoaXMgdG8gLTEgdG8gZW5zdXJlIHRoZSBgc2VsZWN0KDApYCBpbnN0cnVjdGlvbiBpcyBnZW5lcmF0ZWQgYmVmb3JlIGFueVxuICAgKiByZWxldmFudCB1cGRhdGUgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBfbGFzdE5vZGVJbmRleFdpdGhGbHVzaDogbnVtYmVyID0gLTE7XG4gIC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgZGVjbGFyYXRpb25zIGdlbmVyYXRlZCBmcm9tIHZpc2l0aW5nIHBpcGVzLCBsaXRlcmFscywgZXRjLiAqL1xuICBwcml2YXRlIF90ZW1wVmFyaWFibGVzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNhbGxiYWNrcyB0byBidWlsZCBuZXN0ZWQgdGVtcGxhdGVzLiBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWxcbiAgICogYWZ0ZXIgdGhlIHBhcmVudCB0ZW1wbGF0ZSBoYXMgZmluaXNoZWQgdmlzaXRpbmcgYWxsIG9mIGl0cyBub2Rlcy4gVGhpcyBlbnN1cmVzIHRoYXQgYWxsXG4gICAqIGxvY2FsIHJlZiBiaW5kaW5ncyBpbiBuZXN0ZWQgdGVtcGxhdGVzIGFyZSBhYmxlIHRvIGZpbmQgbG9jYWwgcmVmIHZhbHVlcyBpZiB0aGUgcmVmc1xuICAgKiBhcmUgZGVmaW5lZCBhZnRlciB0aGUgdGVtcGxhdGUgZGVjbGFyYXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9uZXN0ZWRUZW1wbGF0ZUZuczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgLyoqXG4gICAqIFRoaXMgc2NvcGUgY29udGFpbnMgbG9jYWwgdmFyaWFibGVzIGRlY2xhcmVkIGluIHRoZSB1cGRhdGUgbW9kZSBibG9jayBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIChlLmcuIHJlZnMgYW5kIGNvbnRleHQgdmFycyBpbiBiaW5kaW5ncylcbiAgICovXG4gIHByaXZhdGUgX2JpbmRpbmdTY29wZTogQmluZGluZ1Njb3BlO1xuICBwcml2YXRlIF92YWx1ZUNvbnZlcnRlcjogVmFsdWVDb252ZXJ0ZXI7XG4gIHByaXZhdGUgX3Vuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5cbiAgLy8gaTE4biBjb250ZXh0IGxvY2FsIHRvIHRoaXMgdGVtcGxhdGVcbiAgcHJpdmF0ZSBpMThuOiBJMThuQ29udGV4dHxudWxsID0gbnVsbDtcblxuICAvLyBOdW1iZXIgb2Ygc2xvdHMgdG8gcmVzZXJ2ZSBmb3IgcHVyZUZ1bmN0aW9uc1xuICBwcml2YXRlIF9wdXJlRnVuY3Rpb25TbG90cyA9IDA7XG5cbiAgLy8gTnVtYmVyIG9mIGJpbmRpbmcgc2xvdHNcbiAgcHJpdmF0ZSBfYmluZGluZ1Nsb3RzID0gMDtcblxuICBwcml2YXRlIGZpbGVCYXNlZEkxOG5TdWZmaXg6IHN0cmluZztcblxuICAvLyBQcm9qZWN0aW9uIHNsb3RzIGZvdW5kIGluIHRoZSB0ZW1wbGF0ZS4gUHJvamVjdGlvbiBzbG90cyBjYW4gZGlzdHJpYnV0ZSBwcm9qZWN0ZWRcbiAgLy8gbm9kZXMgYmFzZWQgb24gYSBzZWxlY3Rvciwgb3IgY2FuIGp1c3QgdXNlIHRoZSB3aWxkY2FyZCBzZWxlY3RvciB0byBtYXRjaFxuICAvLyBhbGwgbm9kZXMgd2hpY2ggYXJlbid0IG1hdGNoaW5nIGFueSBzZWxlY3Rvci5cbiAgcHJpdmF0ZSBfbmdDb250ZW50UmVzZXJ2ZWRTbG90czogKHN0cmluZ3wnKicpW10gPSBbXTtcblxuICAvLyBOdW1iZXIgb2Ygbm9uLWRlZmF1bHQgc2VsZWN0b3JzIGZvdW5kIGluIGFsbCBwYXJlbnQgdGVtcGxhdGVzIG9mIHRoaXMgdGVtcGxhdGUuIFdlIG5lZWQgdG9cbiAgLy8gdHJhY2sgaXQgdG8gcHJvcGVybHkgYWRqdXN0IHByb2plY3Rpb24gc2xvdCBpbmRleCBpbiB0aGUgYHByb2plY3Rpb25gIGluc3RydWN0aW9uLlxuICBwcml2YXRlIF9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBjb25zdGFudFBvb2w6IENvbnN0YW50UG9vbCwgcGFyZW50QmluZGluZ1Njb3BlOiBCaW5kaW5nU2NvcGUsIHByaXZhdGUgbGV2ZWwgPSAwLFxuICAgICAgcHJpdmF0ZSBjb250ZXh0TmFtZTogc3RyaW5nfG51bGwsIHByaXZhdGUgaTE4bkNvbnRleHQ6IEkxOG5Db250ZXh0fG51bGwsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlSW5kZXg6IG51bWJlcnxudWxsLCBwcml2YXRlIHRlbXBsYXRlTmFtZTogc3RyaW5nfG51bGwsXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcnxudWxsLCBwcml2YXRlIGRpcmVjdGl2ZXM6IFNldDxvLkV4cHJlc3Npb24+LFxuICAgICAgcHJpdmF0ZSBwaXBlVHlwZUJ5TmFtZTogTWFwPHN0cmluZywgby5FeHByZXNzaW9uPiwgcHJpdmF0ZSBwaXBlczogU2V0PG8uRXhwcmVzc2lvbj4sXG4gICAgICBwcml2YXRlIF9uYW1lc3BhY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIHByaXZhdGUgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6IHN0cmluZyxcbiAgICAgIHByaXZhdGUgaTE4blVzZUV4dGVybmFsSWRzOiBib29sZWFuKSB7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlID0gcGFyZW50QmluZGluZ1Njb3BlLm5lc3RlZFNjb3BlKGxldmVsKTtcblxuICAgIC8vIFR1cm4gdGhlIHJlbGF0aXZlIGNvbnRleHQgZmlsZSBwYXRoIGludG8gYW4gaWRlbnRpZmllciBieSByZXBsYWNpbmcgbm9uLWFscGhhbnVtZXJpY1xuICAgIC8vIGNoYXJhY3RlcnMgd2l0aCB1bmRlcnNjb3Jlcy5cbiAgICB0aGlzLmZpbGVCYXNlZEkxOG5TdWZmaXggPSByZWxhdGl2ZUNvbnRleHRGaWxlUGF0aC5yZXBsYWNlKC9bXkEtWmEtejAtOV0vZywgJ18nKSArICdfJztcblxuICAgIHRoaXMuX3ZhbHVlQ29udmVydGVyID0gbmV3IFZhbHVlQ29udmVydGVyKFxuICAgICAgICBjb25zdGFudFBvb2wsICgpID0+IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpLFxuICAgICAgICAobnVtU2xvdHM6IG51bWJlcikgPT4gdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKG51bVNsb3RzKSxcbiAgICAgICAgKG5hbWUsIGxvY2FsTmFtZSwgc2xvdCwgdmFsdWU6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBwaXBlVHlwZSA9IHBpcGVUeXBlQnlOYW1lLmdldChuYW1lKTtcbiAgICAgICAgICBpZiAocGlwZVR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMucGlwZXMuYWRkKHBpcGVUeXBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldCh0aGlzLmxldmVsLCBsb2NhbE5hbWUsIHZhbHVlKTtcbiAgICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgUjMucGlwZSwgW28ubGl0ZXJhbChzbG90KSwgby5saXRlcmFsKG5hbWUpXSk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHZhcmlhYmxlOiB0LlZhcmlhYmxlKSB7XG4gICAgY29uc3Qgc2NvcGVkTmFtZSA9IHRoaXMuX2JpbmRpbmdTY29wZS5mcmVzaFJlZmVyZW5jZU5hbWUoKTtcbiAgICBjb25zdCByZXRyaWV2YWxMZXZlbCA9IHRoaXMubGV2ZWw7XG4gICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZS5uYW1lICsgc2NvcGVkTmFtZSk7XG4gICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgcmV0cmlldmFsTGV2ZWwsIHZhcmlhYmxlLm5hbWUsIGxocywgRGVjbGFyYXRpb25Qcmlvcml0eS5DT05URVhULFxuICAgICAgICAoc2NvcGU6IEJpbmRpbmdTY29wZSwgcmVsYXRpdmVMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgbGV0IHJoczogby5FeHByZXNzaW9uO1xuICAgICAgICAgIGlmIChzY29wZS5iaW5kaW5nTGV2ZWwgPT09IHJldHJpZXZhbExldmVsKSB7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eFxuICAgICAgICAgICAgcmhzID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFyZWRDdHhWYXIgPSBzY29wZS5nZXRTaGFyZWRDb250ZXh0TmFtZShyZXRyaWV2YWxMZXZlbCk7XG4gICAgICAgICAgICAvLyBlLmcuIGN0eF9yMCAgIE9SICB4KDIpO1xuICAgICAgICAgICAgcmhzID0gc2hhcmVkQ3R4VmFyID8gc2hhcmVkQ3R4VmFyIDogZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGUuZy4gY29uc3QgJGl0ZW0kID0geCgyKS4kaW1wbGljaXQ7XG4gICAgICAgICAgcmV0dXJuIFtsaHMuc2V0KHJocy5wcm9wKHZhcmlhYmxlLnZhbHVlIHx8IElNUExJQ0lUX1JFRkVSRU5DRSkpLnRvQ29uc3REZWNsKCldO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIGJ1aWxkVGVtcGxhdGVGdW5jdGlvbihcbiAgICAgIG5vZGVzOiB0Lk5vZGVbXSwgdmFyaWFibGVzOiB0LlZhcmlhYmxlW10sIG5nQ29udGVudFNlbGVjdG9yc09mZnNldDogbnVtYmVyID0gMCxcbiAgICAgIGkxOG4/OiBpMThuLkFTVCk6IG8uRnVuY3Rpb25FeHByIHtcbiAgICB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgPSBuZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQ7XG5cbiAgICBpZiAodGhpcy5fbmFtZXNwYWNlICE9PSBSMy5uYW1lc3BhY2VIVE1MKSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24obnVsbCwgdGhpcy5fbmFtZXNwYWNlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdmFyaWFibGUgYmluZGluZ3NcbiAgICB2YXJpYWJsZXMuZm9yRWFjaCh2ID0+IHRoaXMucmVnaXN0ZXJDb250ZXh0VmFyaWFibGVzKHYpKTtcblxuICAgIC8vIEluaXRpYXRlIGkxOG4gY29udGV4dCBpbiBjYXNlOlxuICAgIC8vIC0gdGhpcyB0ZW1wbGF0ZSBoYXMgcGFyZW50IGkxOG4gY29udGV4dFxuICAgIC8vIC0gb3IgdGhlIHRlbXBsYXRlIGhhcyBpMThuIG1ldGEgYXNzb2NpYXRlZCB3aXRoIGl0LFxuICAgIC8vICAgYnV0IGl0J3Mgbm90IGluaXRpYXRlZCBieSB0aGUgRWxlbWVudCAoZS5nLiA8bmctdGVtcGxhdGUgaTE4bj4pXG4gICAgY29uc3QgaW5pdEkxOG5Db250ZXh0ID1cbiAgICAgICAgdGhpcy5pMThuQ29udGV4dCB8fCAoaXNJMThuUm9vdE5vZGUoaTE4bikgJiYgIWlzU2luZ2xlSTE4bkljdShpMThuKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhKGlzU2luZ2xlRWxlbWVudFRlbXBsYXRlKG5vZGVzKSAmJiBub2Rlc1swXS5pMThuID09PSBpMThuKSk7XG4gICAgY29uc3Qgc2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24gPSBoYXNUZXh0Q2hpbGRyZW5Pbmx5KG5vZGVzKTtcbiAgICBpZiAoaW5pdEkxOG5Db250ZXh0KSB7XG4gICAgICB0aGlzLmkxOG5TdGFydChudWxsLCBpMThuICEsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBUaGlzIGlzIHRoZSBpbml0aWFsIHBhc3MgdGhyb3VnaCB0aGUgbm9kZXMgb2YgdGhpcyB0ZW1wbGF0ZS4gSW4gdGhpcyBwYXNzLCB3ZVxuICAgIC8vIHF1ZXVlIGFsbCBjcmVhdGlvbiBtb2RlIGFuZCB1cGRhdGUgbW9kZSBpbnN0cnVjdGlvbnMgZm9yIGdlbmVyYXRpb24gaW4gdGhlIHNlY29uZFxuICAgIC8vIHBhc3MuIEl0J3MgbmVjZXNzYXJ5IHRvIHNlcGFyYXRlIHRoZSBwYXNzZXMgdG8gZW5zdXJlIGxvY2FsIHJlZnMgYXJlIGRlZmluZWQgYmVmb3JlXG4gICAgLy8gcmVzb2x2aW5nIGJpbmRpbmdzLiBXZSBhbHNvIGNvdW50IGJpbmRpbmdzIGluIHRoaXMgcGFzcyBhcyB3ZSB3YWxrIGJvdW5kIGV4cHJlc3Npb25zLlxuICAgIHQudmlzaXRBbGwodGhpcywgbm9kZXMpO1xuXG4gICAgLy8gQWRkIHRvdGFsIGJpbmRpbmcgY291bnQgdG8gcHVyZSBmdW5jdGlvbiBjb3VudCBzbyBwdXJlIGZ1bmN0aW9uIGluc3RydWN0aW9ucyBhcmVcbiAgICAvLyBnZW5lcmF0ZWQgd2l0aCB0aGUgY29ycmVjdCBzbG90IG9mZnNldCB3aGVuIHVwZGF0ZSBpbnN0cnVjdGlvbnMgYXJlIHByb2Nlc3NlZC5cbiAgICB0aGlzLl9wdXJlRnVuY3Rpb25TbG90cyArPSB0aGlzLl9iaW5kaW5nU2xvdHM7XG5cbiAgICAvLyBQaXBlcyBhcmUgd2Fsa2VkIGluIHRoZSBmaXJzdCBwYXNzICh0byBlbnF1ZXVlIGBwaXBlKClgIGNyZWF0aW9uIGluc3RydWN0aW9ucyBhbmRcbiAgICAvLyBgcGlwZUJpbmRgIHVwZGF0ZSBpbnN0cnVjdGlvbnMpLCBzbyB3ZSBoYXZlIHRvIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXRzIG1hbnVhbGx5XG4gICAgLy8gdG8gYWNjb3VudCBmb3IgYmluZGluZ3MuXG4gICAgdGhpcy5fdmFsdWVDb252ZXJ0ZXIudXBkYXRlUGlwZVNsb3RPZmZzZXRzKHRoaXMuX2JpbmRpbmdTbG90cyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3QgYmUgcHJvY2Vzc2VkIGJlZm9yZSBjcmVhdGlvbiBpbnN0cnVjdGlvbnMgc28gdGVtcGxhdGUoKVxuICAgIC8vIGluc3RydWN0aW9ucyBjYW4gYmUgZ2VuZXJhdGVkIHdpdGggdGhlIGNvcnJlY3QgaW50ZXJuYWwgY29uc3QgY291bnQuXG4gICAgdGhpcy5fbmVzdGVkVGVtcGxhdGVGbnMuZm9yRWFjaChidWlsZFRlbXBsYXRlRm4gPT4gYnVpbGRUZW1wbGF0ZUZuKCkpO1xuXG4gICAgLy8gT3V0cHV0IHRoZSBgcHJvamVjdGlvbkRlZmAgaW5zdHJ1Y3Rpb24gd2hlbiBzb21lIGA8bmctY29udGVudD5gIHRhZ3MgYXJlIHByZXNlbnQuXG4gICAgLy8gVGhlIGBwcm9qZWN0aW9uRGVmYCBpbnN0cnVjdGlvbiBpcyBvbmx5IGVtaXR0ZWQgZm9yIHRoZSBjb21wb25lbnQgdGVtcGxhdGUgYW5kXG4gICAgLy8gaXMgc2tpcHBlZCBmb3IgbmVzdGVkIHRlbXBsYXRlcyAoPG5nLXRlbXBsYXRlPiB0YWdzKS5cbiAgICBpZiAodGhpcy5sZXZlbCA9PT0gMCAmJiB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgICAgLy8gQnkgZGVmYXVsdCB0aGUgYHByb2plY3Rpb25EZWZgIGluc3RydWN0aW9ucyBjcmVhdGVzIG9uZSBzbG90IGZvciB0aGUgd2lsZGNhcmRcbiAgICAgIC8vIHNlbGVjdG9yIGlmIG5vIHBhcmFtZXRlcnMgYXJlIHBhc3NlZC4gVGhlcmVmb3JlIHdlIG9ubHkgd2FudCB0byBhbGxvY2F0ZSBhIG5ld1xuICAgICAgLy8gYXJyYXkgZm9yIHRoZSBwcm9qZWN0aW9uIHNsb3RzIGlmIHRoZSBkZWZhdWx0IHByb2plY3Rpb24gc2xvdCBpcyBub3Qgc3VmZmljaWVudC5cbiAgICAgIGlmICh0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCA+IDEgfHwgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90c1swXSAhPT0gJyonKSB7XG4gICAgICAgIGNvbnN0IHIzUmVzZXJ2ZWRTbG90cyA9IHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMubWFwKFxuICAgICAgICAgICAgcyA9PiBzICE9PSAnKicgPyBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IocykgOiBzKTtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChhc0xpdGVyYWwocjNSZXNlcnZlZFNsb3RzKSwgdHJ1ZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBTaW5jZSB3ZSBhY2N1bXVsYXRlIG5nQ29udGVudCBzZWxlY3RvcnMgd2hpbGUgcHJvY2Vzc2luZyB0ZW1wbGF0ZSBlbGVtZW50cyxcbiAgICAgIC8vIHdlICpwcmVwZW5kKiBgcHJvamVjdGlvbkRlZmAgdG8gY3JlYXRpb24gaW5zdHJ1Y3Rpb25zIGJsb2NrLCB0byBwdXQgaXQgYmVmb3JlXG4gICAgICAvLyBhbnkgYHByb2plY3Rpb25gIGluc3RydWN0aW9uc1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG51bGwsIFIzLnByb2plY3Rpb25EZWYsIHBhcmFtZXRlcnMsIC8qIHByZXBlbmQgKi8gdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKGluaXRJMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuRW5kKG51bGwsIHNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIGNyZWF0aW9uIG1vZGUgaW5zdHJ1Y3Rpb25zIChlLmcuIHJlc29sdmUgYmluZGluZ3MgaW4gbGlzdGVuZXJzKVxuICAgIGNvbnN0IGNyZWF0aW9uU3RhdGVtZW50cyA9IHRoaXMuX2NyZWF0aW9uQ29kZUZucy5tYXAoKGZuOiAoKSA9PiBvLlN0YXRlbWVudCkgPT4gZm4oKSk7XG5cbiAgICAvLyBHZW5lcmF0ZSBhbGwgdGhlIHVwZGF0ZSBtb2RlIGluc3RydWN0aW9ucyAoZS5nLiByZXNvbHZlIHByb3BlcnR5IG9yIHRleHQgYmluZGluZ3MpXG4gICAgY29uc3QgdXBkYXRlU3RhdGVtZW50cyA9IHRoaXMuX3VwZGF0ZUNvZGVGbnMubWFwKChmbjogKCkgPT4gby5TdGF0ZW1lbnQpID0+IGZuKCkpO1xuXG4gICAgLy8gIFZhcmlhYmxlIGRlY2xhcmF0aW9uIG11c3Qgb2NjdXIgYWZ0ZXIgYmluZGluZyByZXNvbHV0aW9uIHNvIHdlIGNhbiBnZW5lcmF0ZSBjb250ZXh0XG4gICAgLy8gIGluc3RydWN0aW9ucyB0aGF0IGJ1aWxkIG9uIGVhY2ggb3RoZXIuXG4gICAgLy8gZS5nLiBjb25zdCBiID0gbmV4dENvbnRleHQoKS4kaW1wbGljaXQoKTsgY29uc3QgYiA9IG5leHRDb250ZXh0KCk7XG4gICAgY29uc3QgY3JlYXRpb25WYXJpYWJsZXMgPSB0aGlzLl9iaW5kaW5nU2NvcGUudmlld1NuYXBzaG90U3RhdGVtZW50cygpO1xuICAgIGNvbnN0IHVwZGF0ZVZhcmlhYmxlcyA9IHRoaXMuX2JpbmRpbmdTY29wZS52YXJpYWJsZURlY2xhcmF0aW9ucygpLmNvbmNhdCh0aGlzLl90ZW1wVmFyaWFibGVzKTtcblxuICAgIGNvbnN0IGNyZWF0aW9uQmxvY2sgPSBjcmVhdGlvblN0YXRlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgIFtyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoXG4gICAgICAgICAgICBjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRpb25WYXJpYWJsZXMuY29uY2F0KGNyZWF0aW9uU3RhdGVtZW50cykpXSA6XG4gICAgICAgIFtdO1xuXG4gICAgY29uc3QgdXBkYXRlQmxvY2sgPSB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDAgP1xuICAgICAgICBbcmVuZGVyRmxhZ0NoZWNrSWZTdG10KGNvcmUuUmVuZGVyRmxhZ3MuVXBkYXRlLCB1cGRhdGVWYXJpYWJsZXMuY29uY2F0KHVwZGF0ZVN0YXRlbWVudHMpKV0gOlxuICAgICAgICBbXTtcblxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICAvLyBpLmUuIChyZjogUmVuZGVyRmxhZ3MsIGN0eDogYW55KVxuICAgICAgICBbbmV3IG8uRm5QYXJhbShSRU5ERVJfRkxBR1MsIG8uTlVNQkVSX1RZUEUpLCBuZXcgby5GblBhcmFtKENPTlRFWFRfTkFNRSwgbnVsbCldLFxuICAgICAgICBbXG4gICAgICAgICAgLy8gVGVtcG9yYXJ5IHZhcmlhYmxlIGRlY2xhcmF0aW9ucyBmb3IgcXVlcnkgcmVmcmVzaCAoaS5lLiBsZXQgX3Q6IGFueTspXG4gICAgICAgICAgLi4udGhpcy5fcHJlZml4Q29kZSxcbiAgICAgICAgICAvLyBDcmVhdGluZyBtb2RlIChpLmUuIGlmIChyZiAmIFJlbmRlckZsYWdzLkNyZWF0ZSkgeyAuLi4gfSlcbiAgICAgICAgICAuLi5jcmVhdGlvbkJsb2NrLFxuICAgICAgICAgIC8vIEJpbmRpbmcgYW5kIHJlZnJlc2ggbW9kZSAoaS5lLiBpZiAocmYgJiBSZW5kZXJGbGFncy5VcGRhdGUpIHsuLi59KVxuICAgICAgICAgIC4uLnVwZGF0ZUJsb2NrLFxuICAgICAgICBdLFxuICAgICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHRoaXMudGVtcGxhdGVOYW1lKTtcbiAgfVxuXG4gIC8vIExvY2FsUmVzb2x2ZXJcbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwgeyByZXR1cm4gdGhpcy5fYmluZGluZ1Njb3BlLmdldChuYW1lKTsgfVxuXG4gIGkxOG5UcmFuc2xhdGUoXG4gICAgICBtZXNzYWdlOiBpMThuLk1lc3NhZ2UsIHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge30sIHJlZj86IG8uUmVhZFZhckV4cHIsXG4gICAgICB0cmFuc2Zvcm1Gbj86IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IG8uRXhwcmVzc2lvbik6IG8uUmVhZFZhckV4cHIge1xuICAgIGNvbnN0IF9yZWYgPSByZWYgfHwgby52YXJpYWJsZSh0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKFRSQU5TTEFUSU9OX1BSRUZJWCkpO1xuICAgIC8vIENsb3N1cmUgQ29tcGlsZXIgcmVxdWlyZXMgY29uc3QgbmFtZXMgdG8gc3RhcnQgd2l0aCBgTVNHX2AgYnV0IGRpc2FsbG93cyBhbnkgb3RoZXIgY29uc3QgdG9cbiAgICAvLyBzdGFydCB3aXRoIGBNU0dfYC4gV2UgZGVmaW5lIGEgdmFyaWFibGUgc3RhcnRpbmcgd2l0aCBgTVNHX2AganVzdCBmb3IgdGhlIGBnb29nLmdldE1zZ2AgY2FsbFxuICAgIGNvbnN0IGNsb3N1cmVWYXIgPSB0aGlzLmkxOG5HZW5lcmF0ZUNsb3N1cmVWYXIobWVzc2FnZS5pZCk7XG4gICAgY29uc3QgX3BhcmFtczoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBpZiAocGFyYW1zICYmIE9iamVjdC5rZXlzKHBhcmFtcykubGVuZ3RoKSB7XG4gICAgICBPYmplY3Qua2V5cyhwYXJhbXMpLmZvckVhY2goa2V5ID0+IF9wYXJhbXNbZm9ybWF0STE4blBsYWNlaG9sZGVyTmFtZShrZXkpXSA9IHBhcmFtc1trZXldKTtcbiAgICB9XG4gICAgY29uc3QgbWV0YSA9IG1ldGFGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSk7XG4gICAgY29uc3QgY29udGVudCA9IGdldFNlcmlhbGl6ZWRJMThuQ29udGVudChtZXNzYWdlKTtcbiAgICBjb25zdCBzdGF0ZW1lbnRzID1cbiAgICAgICAgZ2V0VHJhbnNsYXRpb25EZWNsU3RtdHMoX3JlZiwgY2xvc3VyZVZhciwgY29udGVudCwgbWV0YSwgX3BhcmFtcywgdHJhbnNmb3JtRm4pO1xuICAgIHRoaXMuY29uc3RhbnRQb29sLnN0YXRlbWVudHMucHVzaCguLi5zdGF0ZW1lbnRzKTtcbiAgICByZXR1cm4gX3JlZjtcbiAgfVxuXG4gIGkxOG5BcHBlbmRCaW5kaW5ncyhleHByZXNzaW9uczogQVNUW10pIHtcbiAgICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgICAgZXhwcmVzc2lvbnMuZm9yRWFjaChleHByZXNzaW9uID0+IHRoaXMuaTE4biAhLmFwcGVuZEJpbmRpbmcoZXhwcmVzc2lvbikpO1xuICAgIH1cbiAgfVxuXG4gIGkxOG5CaW5kUHJvcHMocHJvcHM6IHtba2V5OiBzdHJpbmddOiB0LlRleHQgfCB0LkJvdW5kVGV4dH0pOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSB7XG4gICAgY29uc3QgYm91bmQ6IHtba2V5OiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID0ge307XG4gICAgT2JqZWN0LmtleXMocHJvcHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSBwcm9wc1trZXldO1xuICAgICAgaWYgKHByb3AgaW5zdGFuY2VvZiB0LlRleHQpIHtcbiAgICAgICAgYm91bmRba2V5XSA9IG8ubGl0ZXJhbChwcm9wLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICAgIHRoaXMuYWxsb2NhdGVCaW5kaW5nU2xvdHModmFsdWUpO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgY29uc3Qge3N0cmluZ3MsIGV4cHJlc3Npb25zfSA9IHZhbHVlO1xuICAgICAgICAgIGNvbnN0IHtpZCwgYmluZGluZ3N9ID0gdGhpcy5pMThuICE7XG4gICAgICAgICAgY29uc3QgbGFiZWwgPSBhc3NlbWJsZUkxOG5Cb3VuZFN0cmluZyhzdHJpbmdzLCBiaW5kaW5ncy5zaXplLCBpZCk7XG4gICAgICAgICAgdGhpcy5pMThuQXBwZW5kQmluZGluZ3MoZXhwcmVzc2lvbnMpO1xuICAgICAgICAgIGJvdW5kW2tleV0gPSBvLmxpdGVyYWwobGFiZWwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9XG5cbiAgaTE4bkdlbmVyYXRlQ2xvc3VyZVZhcihtZXNzYWdlSWQ6IHN0cmluZyk6IG8uUmVhZFZhckV4cHIge1xuICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgY29uc3Qgc3VmZml4ID0gdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LnRvVXBwZXJDYXNlKCk7XG4gICAgaWYgKHRoaXMuaTE4blVzZUV4dGVybmFsSWRzKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBnZXRUcmFuc2xhdGlvbkNvbnN0UHJlZml4KGBFWFRFUk5BTF9gKTtcbiAgICAgIGNvbnN0IHVuaXF1ZVN1ZmZpeCA9IHRoaXMuY29uc3RhbnRQb29sLnVuaXF1ZU5hbWUoc3VmZml4KTtcbiAgICAgIG5hbWUgPSBgJHtwcmVmaXh9JHtzYW5pdGl6ZUlkZW50aWZpZXIobWVzc2FnZUlkKX0kJCR7dW5pcXVlU3VmZml4fWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGdldFRyYW5zbGF0aW9uQ29uc3RQcmVmaXgoc3VmZml4KTtcbiAgICAgIG5hbWUgPSB0aGlzLmNvbnN0YW50UG9vbC51bmlxdWVOYW1lKHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiBvLnZhcmlhYmxlKG5hbWUpO1xuICB9XG5cbiAgaTE4blVwZGF0ZVJlZihjb250ZXh0OiBJMThuQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IHtpY3VzLCBtZXRhLCBpc1Jvb3QsIGlzUmVzb2x2ZWQsIGlzRW1pdHRlZH0gPSBjb250ZXh0O1xuICAgIGlmIChpc1Jvb3QgJiYgaXNSZXNvbHZlZCAmJiAhaXNFbWl0dGVkICYmICFpc1NpbmdsZUkxOG5JY3UobWV0YSkpIHtcbiAgICAgIGNvbnRleHQuaXNFbWl0dGVkID0gdHJ1ZTtcbiAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGNvbnRleHQuZ2V0U2VyaWFsaXplZFBsYWNlaG9sZGVycygpO1xuICAgICAgbGV0IGljdU1hcHBpbmc6IHtbbmFtZTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICAgICAgbGV0IHBhcmFtczoge1tuYW1lOiBzdHJpbmddOiBvLkV4cHJlc3Npb259ID1cbiAgICAgICAgICBwbGFjZWhvbGRlcnMuc2l6ZSA/IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycykgOiB7fTtcbiAgICAgIGlmIChpY3VzLnNpemUpIHtcbiAgICAgICAgaWN1cy5mb3JFYWNoKChyZWZzOiBvLkV4cHJlc3Npb25bXSwga2V5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAocmVmcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgb25lIElDVSBkZWZpbmVkIGZvciBhIGdpdmVuXG4gICAgICAgICAgICAvLyBwbGFjZWhvbGRlciAtIGp1c3Qgb3V0cHV0IGl0cyByZWZlcmVuY2VcbiAgICAgICAgICAgIHBhcmFtc1trZXldID0gcmVmc1swXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gLi4uIG90aGVyd2lzZSB3ZSBuZWVkIHRvIGFjdGl2YXRlIHBvc3QtcHJvY2Vzc2luZ1xuICAgICAgICAgICAgLy8gdG8gcmVwbGFjZSBJQ1UgcGxhY2Vob2xkZXJzIHdpdGggcHJvcGVyIHZhbHVlc1xuICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXI6IHN0cmluZyA9IHdyYXBJMThuUGxhY2Vob2xkZXIoYCR7STE4Tl9JQ1VfTUFQUElOR19QUkVGSVh9JHtrZXl9YCk7XG4gICAgICAgICAgICBwYXJhbXNba2V5XSA9IG8ubGl0ZXJhbChwbGFjZWhvbGRlcik7XG4gICAgICAgICAgICBpY3VNYXBwaW5nW2tleV0gPSBvLmxpdGVyYWxBcnIocmVmcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJhbnNsYXRpb24gcmVxdWlyZXMgcG9zdCBwcm9jZXNzaW5nIGluIDIgY2FzZXM6XG4gICAgICAvLyAtIGlmIHdlIGhhdmUgcGxhY2Vob2xkZXJzIHdpdGggbXVsdGlwbGUgdmFsdWVzIChleC4gYFNUQVJUX0RJVmA6IFvvv70jMe+/vSwg77+9IzLvv70sIC4uLl0pXG4gICAgICAvLyAtIGlmIHdlIGhhdmUgbXVsdGlwbGUgSUNVcyB0aGF0IHJlZmVyIHRvIHRoZSBzYW1lIHBsYWNlaG9sZGVyIG5hbWVcbiAgICAgIGNvbnN0IG5lZWRzUG9zdHByb2Nlc3NpbmcgPVxuICAgICAgICAgIEFycmF5LmZyb20ocGxhY2Vob2xkZXJzLnZhbHVlcygpKS5zb21lKCh2YWx1ZTogc3RyaW5nW10pID0+IHZhbHVlLmxlbmd0aCA+IDEpIHx8XG4gICAgICAgICAgT2JqZWN0LmtleXMoaWN1TWFwcGluZykubGVuZ3RoO1xuXG4gICAgICBsZXQgdHJhbnNmb3JtRm47XG4gICAgICBpZiAobmVlZHNQb3N0cHJvY2Vzc2luZykge1xuICAgICAgICB0cmFuc2Zvcm1GbiA9IChyYXc6IG8uUmVhZFZhckV4cHIpID0+IHtcbiAgICAgICAgICBjb25zdCBhcmdzOiBvLkV4cHJlc3Npb25bXSA9IFtyYXddO1xuICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhpY3VNYXBwaW5nKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFyZ3MucHVzaChtYXBMaXRlcmFsKGljdU1hcHBpbmcsIHRydWUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc3RydWN0aW9uKG51bGwsIFIzLmkxOG5Qb3N0cHJvY2VzcywgYXJncyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWV0YSBhcyBpMThuLk1lc3NhZ2UsIHBhcmFtcywgY29udGV4dC5yZWYsIHRyYW5zZm9ybUZuKTtcbiAgICB9XG4gIH1cblxuICBpMThuU3RhcnQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBtZXRhOiBpMThuLkFTVCwgc2VsZkNsb3Npbmc/OiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuID0gdGhpcy5pMThuQ29udGV4dC5mb3JrQ2hpbGRDb250ZXh0KGluZGV4LCB0aGlzLnRlbXBsYXRlSW5kZXggISwgbWV0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlZiA9IG8udmFyaWFibGUodGhpcy5jb25zdGFudFBvb2wudW5pcXVlTmFtZShUUkFOU0xBVElPTl9QUkVGSVgpKTtcbiAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuQ29udGV4dChpbmRleCwgcmVmLCAwLCB0aGlzLnRlbXBsYXRlSW5kZXgsIG1ldGEpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlIGkxOG5TdGFydCBpbnN0cnVjdGlvblxuICAgIGNvbnN0IHtpZCwgcmVmfSA9IHRoaXMuaTE4bjtcbiAgICBjb25zdCBwYXJhbXM6IG8uRXhwcmVzc2lvbltdID0gW28ubGl0ZXJhbChpbmRleCksIHJlZl07XG4gICAgaWYgKGlkID4gMCkge1xuICAgICAgLy8gZG8gbm90IHB1c2ggM3JkIGFyZ3VtZW50IChzdWItYmxvY2sgaWQpXG4gICAgICAvLyBpbnRvIGkxOG5TdGFydCBjYWxsIGZvciB0b3AgbGV2ZWwgaTE4biBjb250ZXh0XG4gICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwoaWQpKTtcbiAgICB9XG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIHNlbGZDbG9zaW5nID8gUjMuaTE4biA6IFIzLmkxOG5TdGFydCwgcGFyYW1zKTtcbiAgfVxuXG4gIGkxOG5FbmQoc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwgPSBudWxsLCBzZWxmQ2xvc2luZz86IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpMThuRW5kIGlzIGV4ZWN1dGVkIHdpdGggbm8gaTE4biBjb250ZXh0IHByZXNlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pMThuQ29udGV4dCkge1xuICAgICAgdGhpcy5pMThuQ29udGV4dC5yZWNvbmNpbGVDaGlsZENvbnRleHQodGhpcy5pMThuKTtcbiAgICAgIHRoaXMuaTE4blVwZGF0ZVJlZih0aGlzLmkxOG5Db250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pMThuVXBkYXRlUmVmKHRoaXMuaTE4bik7XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgYWNjdW11bGF0ZWQgYmluZGluZ3NcbiAgICBjb25zdCB7aW5kZXgsIGJpbmRpbmdzfSA9IHRoaXMuaTE4bjtcbiAgICBpZiAoYmluZGluZ3Muc2l6ZSkge1xuICAgICAgYmluZGluZ3MuZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICAgICAgdGhpcy51cGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgIGluZGV4LCBzcGFuLCBSMy5pMThuRXhwLFxuICAgICAgICAgICAgKCkgPT4gW3RoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIGJpbmRpbmcpXSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oaW5kZXgsIHNwYW4sIFIzLmkxOG5BcHBseSwgW28ubGl0ZXJhbChpbmRleCldKTtcbiAgICB9XG4gICAgaWYgKCFzZWxmQ2xvc2luZykge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHNwYW4sIFIzLmkxOG5FbmQpO1xuICAgIH1cbiAgICB0aGlzLmkxOG4gPSBudWxsOyAgLy8gcmVzZXQgbG9jYWwgaTE4biBjb250ZXh0XG4gIH1cblxuICB2aXNpdENvbnRlbnQobmdDb250ZW50OiB0LkNvbnRlbnQpIHtcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZURhdGFTbG90KCk7XG4gICAgY29uc3QgcHJvamVjdGlvblNsb3RJZHggPSB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQgKyB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aDtcbiAgICBjb25zdCBwYXJhbWV0ZXJzOiBvLkV4cHJlc3Npb25bXSA9IFtvLmxpdGVyYWwoc2xvdCldO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG5cbiAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2gobmdDb250ZW50LnNlbGVjdG9yKTtcblxuICAgIG5nQ29udGVudC5hdHRyaWJ1dGVzLmZvckVhY2goKGF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHJpYnV0ZTtcbiAgICAgIGlmIChuYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHJpYnV0ZSkpO1xuICAgICAgfSBlbHNlIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgIT09IE5HX0NPTlRFTlRfU0VMRUNUX0FUVFIpIHtcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKG8ubGl0ZXJhbChuYW1lKSwgby5saXRlcmFsKHZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYXR0cmlidXRlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSwgby5saXRlcmFsQXJyKGF0dHJpYnV0ZXMpKTtcbiAgICB9IGVsc2UgaWYgKHByb2plY3Rpb25TbG90SWR4ICE9PSAwKSB7XG4gICAgICBwYXJhbWV0ZXJzLnB1c2goby5saXRlcmFsKHByb2plY3Rpb25TbG90SWR4KSk7XG4gICAgfVxuXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKG5nQ29udGVudC5zb3VyY2VTcGFuLCBSMy5wcm9qZWN0aW9uLCBwYXJhbWV0ZXJzKTtcbiAgfVxuXG5cbiAgZ2V0TmFtZXNwYWNlSW5zdHJ1Y3Rpb24obmFtZXNwYWNlS2V5OiBzdHJpbmd8bnVsbCkge1xuICAgIHN3aXRjaCAobmFtZXNwYWNlS2V5KSB7XG4gICAgICBjYXNlICdtYXRoJzpcbiAgICAgICAgcmV0dXJuIFIzLm5hbWVzcGFjZU1hdGhNTDtcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICAgIHJldHVybiBSMy5uYW1lc3BhY2VTVkc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gUjMubmFtZXNwYWNlSFRNTDtcbiAgICB9XG4gIH1cblxuICBhZGROYW1lc3BhY2VJbnN0cnVjdGlvbihuc0luc3RydWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlLCBlbGVtZW50OiB0LkVsZW1lbnQpIHtcbiAgICB0aGlzLl9uYW1lc3BhY2UgPSBuc0luc3RydWN0aW9uO1xuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIG5zSW5zdHJ1Y3Rpb24pO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IHQuRWxlbWVudCkge1xuICAgIGNvbnN0IGVsZW1lbnRJbmRleCA9IHRoaXMuYWxsb2NhdGVEYXRhU2xvdCgpO1xuICAgIGNvbnN0IHN0eWxpbmdCdWlsZGVyID0gbmV3IFN0eWxpbmdCdWlsZGVyKG8ubGl0ZXJhbChlbGVtZW50SW5kZXgpLCBudWxsKTtcblxuICAgIGxldCBpc05vbkJpbmRhYmxlTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50OiBib29sZWFuID1cbiAgICAgICAgaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKSAmJiAhaXNTaW5nbGVJMThuSWN1KGVsZW1lbnQuaTE4bik7XG5cbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQgJiYgdGhpcy5pMThuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBtYXJrIGFuIGVsZW1lbnQgYXMgdHJhbnNsYXRhYmxlIGluc2lkZSBvZiBhIHRyYW5zbGF0YWJsZSBzZWN0aW9uYCk7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4bkF0dHJzOiAodC5UZXh0QXR0cmlidXRlIHwgdC5Cb3VuZEF0dHJpYnV0ZSlbXSA9IFtdO1xuICAgIGNvbnN0IG91dHB1dEF0dHJzOiB0LlRleHRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgY29uc3QgW25hbWVzcGFjZUtleSwgZWxlbWVudE5hbWVdID0gc3BsaXROc05hbWUoZWxlbWVudC5uYW1lKTtcbiAgICBjb25zdCBpc05nQ29udGFpbmVyID0gY2hlY2tJc05nQ29udGFpbmVyKGVsZW1lbnQubmFtZSk7XG5cbiAgICAvLyBIYW5kbGUgc3R5bGluZywgaTE4biwgbmdOb25CaW5kYWJsZSBhdHRyaWJ1dGVzXG4gICAgZm9yIChjb25zdCBhdHRyIG9mIGVsZW1lbnQuYXR0cmlidXRlcykge1xuICAgICAgY29uc3Qge25hbWUsIHZhbHVlfSA9IGF0dHI7XG4gICAgICBpZiAobmFtZSA9PT0gTk9OX0JJTkRBQkxFX0FUVFIpIHtcbiAgICAgICAgaXNOb25CaW5kYWJsZU1vZGUgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSAnc3R5bGUnKSB7XG4gICAgICAgIHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyU3R5bGVBdHRyKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBzdHlsaW5nQnVpbGRlci5yZWdpc3RlckNsYXNzQXR0cih2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXR0ci5pMThuKSB7XG4gICAgICAgICAgLy8gUGxhY2UgYXR0cmlidXRlcyBpbnRvIGEgc2VwYXJhdGUgYXJyYXkgZm9yIGkxOG4gcHJvY2Vzc2luZywgYnV0IGFsc28ga2VlcCBzdWNoXG4gICAgICAgICAgLy8gYXR0cmlidXRlcyBpbiB0aGUgbWFpbiBsaXN0IHRvIG1ha2UgdGhlbSBhdmFpbGFibGUgZm9yIGRpcmVjdGl2ZSBtYXRjaGluZyBhdCBydW50aW1lLlxuICAgICAgICAgIC8vIFRPRE8oRlctMTI0OCk6IHByZXZlbnQgYXR0cmlidXRlcyBkdXBsaWNhdGlvbiBpbiBgaTE4bkF0dHJpYnV0ZXNgIGFuZCBgZWxlbWVudFN0YXJ0YFxuICAgICAgICAgIC8vIGFyZ3VtZW50c1xuICAgICAgICAgIGkxOG5BdHRycy5wdXNoKGF0dHIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG91dHB1dEF0dHJzLnB1c2goYXR0cik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNYXRjaCBkaXJlY3RpdmVzIG9uIG5vbiBpMThuIGF0dHJpYnV0ZXNcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuXG4gICAgLy8gUmVndWxhciBlbGVtZW50IG9yIG5nLWNvbnRhaW5lciBjcmVhdGlvbiBtb2RlXG4gICAgY29uc3QgcGFyYW1ldGVyczogby5FeHByZXNzaW9uW10gPSBbby5saXRlcmFsKGVsZW1lbnRJbmRleCldO1xuICAgIGlmICghaXNOZ0NvbnRhaW5lcikge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8ubGl0ZXJhbChlbGVtZW50TmFtZSkpO1xuICAgIH1cblxuICAgIC8vIEFkZCB0aGUgYXR0cmlidXRlc1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgY29uc3QgYWxsT3RoZXJJbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCgoaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUpID0+IHtcbiAgICAgIGNvbnN0IHN0eWxpbmdJbnB1dFdhc1NldCA9IHN0eWxpbmdCdWlsZGVyLnJlZ2lzdGVyQm91bmRJbnB1dChpbnB1dCk7XG4gICAgICBpZiAoIXN0eWxpbmdJbnB1dFdhc1NldCkge1xuICAgICAgICBpZiAoaW5wdXQudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgaW5wdXQuaTE4bikge1xuICAgICAgICAgIC8vIFBsYWNlIGF0dHJpYnV0ZXMgaW50byBhIHNlcGFyYXRlIGFycmF5IGZvciBpMThuIHByb2Nlc3NpbmcsIGJ1dCBhbHNvIGtlZXAgc3VjaFxuICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaW4gdGhlIG1haW4gbGlzdCB0byBtYWtlIHRoZW0gYXZhaWxhYmxlIGZvciBkaXJlY3RpdmUgbWF0Y2hpbmcgYXQgcnVudGltZS5cbiAgICAgICAgICAvLyBUT0RPKEZXLTEyNDgpOiBwcmV2ZW50IGF0dHJpYnV0ZXMgZHVwbGljYXRpb24gaW4gYGkxOG5BdHRyaWJ1dGVzYCBhbmQgYGVsZW1lbnRTdGFydGBcbiAgICAgICAgICAvLyBhcmd1bWVudHNcbiAgICAgICAgICBpMThuQXR0cnMucHVzaChpbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWxsT3RoZXJJbnB1dHMucHVzaChpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIG91dHB1dEF0dHJzLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICBpZiAoYXR0ci5uYW1lID09PSBOR19QUk9KRUNUX0FTX0FUVFJfTkFNRSkge1xuICAgICAgICBhdHRyaWJ1dGVzLnB1c2goLi4uZ2V0TmdQcm9qZWN0QXNMaXRlcmFsKGF0dHIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJpYnV0ZXMucHVzaCguLi5nZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMoYXR0ci5uYW1lKSwgby5saXRlcmFsKGF0dHIudmFsdWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGFkZCBhdHRyaWJ1dGVzIGZvciBkaXJlY3RpdmUgYW5kIHByb2plY3Rpb24gbWF0Y2hpbmcgcHVycG9zZXNcbiAgICBhdHRyaWJ1dGVzLnB1c2goLi4udGhpcy5wcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICAgIGFsbE90aGVySW5wdXRzLCBlbGVtZW50Lm91dHB1dHMsIHN0eWxpbmdCdWlsZGVyLCBbXSwgaTE4bkF0dHJzKSk7XG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMudG9BdHRyc1BhcmFtKGF0dHJpYnV0ZXMpKTtcblxuICAgIC8vIGxvY2FsIHJlZnMgKGV4LjogPGRpdiAjZm9vICNiYXI9XCJiYXpcIj4pXG4gICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIoZWxlbWVudC5yZWZlcmVuY2VzKSk7XG5cbiAgICBjb25zdCB3YXNJbk5hbWVzcGFjZSA9IHRoaXMuX25hbWVzcGFjZTtcbiAgICBjb25zdCBjdXJyZW50TmFtZXNwYWNlID0gdGhpcy5nZXROYW1lc3BhY2VJbnN0cnVjdGlvbihuYW1lc3BhY2VLZXkpO1xuXG4gICAgLy8gSWYgdGhlIG5hbWVzcGFjZSBpcyBjaGFuZ2luZyBub3csIGluY2x1ZGUgYW4gaW5zdHJ1Y3Rpb24gdG8gY2hhbmdlIGl0XG4gICAgLy8gZHVyaW5nIGVsZW1lbnQgY3JlYXRpb24uXG4gICAgaWYgKGN1cnJlbnROYW1lc3BhY2UgIT09IHdhc0luTmFtZXNwYWNlKSB7XG4gICAgICB0aGlzLmFkZE5hbWVzcGFjZUluc3RydWN0aW9uKGN1cnJlbnROYW1lc3BhY2UsIGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGltcGxpY2l0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuXG4gICAgaWYgKHRoaXMuaTE4bikge1xuICAgICAgdGhpcy5pMThuLmFwcGVuZEVsZW1lbnQoZWxlbWVudC5pMThuICEsIGVsZW1lbnRJbmRleCk7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzQ2hpbGRyZW4gPSAoKSA9PiB7XG4gICAgICBpZiAoIWlzSTE4blJvb3RFbGVtZW50ICYmIHRoaXMuaTE4bikge1xuICAgICAgICAvLyB3ZSBkbyBub3QgYXBwZW5kIHRleHQgbm9kZSBpbnN0cnVjdGlvbnMgYW5kIElDVXMgaW5zaWRlIGkxOG4gc2VjdGlvbixcbiAgICAgICAgLy8gc28gd2UgZXhjbHVkZSB0aGVtIHdoaWxlIGNhbGN1bGF0aW5nIHdoZXRoZXIgY3VycmVudCBlbGVtZW50IGhhcyBjaGlsZHJlblxuICAgICAgICByZXR1cm4gIWhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWxlbWVudC5jaGlsZHJlbi5sZW5ndGggPiAwO1xuICAgIH07XG5cbiAgICBjb25zdCBjcmVhdGVTZWxmQ2xvc2luZ0luc3RydWN0aW9uID0gIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzICYmICFpc05nQ29udGFpbmVyICYmXG4gICAgICAgIGVsZW1lbnQub3V0cHV0cy5sZW5ndGggPT09IDAgJiYgaTE4bkF0dHJzLmxlbmd0aCA9PT0gMCAmJiAhaGFzQ2hpbGRyZW4oKTtcblxuICAgIGNvbnN0IGNyZWF0ZVNlbGZDbG9zaW5nSTE4bkluc3RydWN0aW9uID0gIWNyZWF0ZVNlbGZDbG9zaW5nSW5zdHJ1Y3Rpb24gJiZcbiAgICAgICAgIXN0eWxpbmdCdWlsZGVyLmhhc0JpbmRpbmdzICYmIGhhc1RleHRDaGlsZHJlbk9ubHkoZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBpZiAoY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgUjMuZWxlbWVudCwgdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycykpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBpc05nQ29udGFpbmVyID8gUjMuZWxlbWVudENvbnRhaW5lclN0YXJ0IDogUjMuZWxlbWVudFN0YXJ0LFxuICAgICAgICAgIHRyaW1UcmFpbGluZ051bGxzKHBhcmFtZXRlcnMpKTtcblxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmRpc2FibGVCaW5kaW5ncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHByb2Nlc3MgaTE4biBlbGVtZW50IGF0dHJpYnV0ZXNcbiAgICAgIGlmIChpMThuQXR0cnMubGVuZ3RoKSB7XG4gICAgICAgIGxldCBoYXNCaW5kaW5nczogYm9vbGVhbiA9IGZhbHNlO1xuICAgICAgICBjb25zdCBpMThuQXR0ckFyZ3M6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgICAgIGkxOG5BdHRycy5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhdHRyLmkxOG4gIWFzIGkxOG4uTWVzc2FnZTtcbiAgICAgICAgICBpZiAoYXR0ciBpbnN0YW5jZW9mIHQuVGV4dEF0dHJpYnV0ZSkge1xuICAgICAgICAgICAgaTE4bkF0dHJBcmdzLnB1c2goby5saXRlcmFsKGF0dHIubmFtZSksIHRoaXMuaTE4blRyYW5zbGF0ZShtZXNzYWdlKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRlZCA9IGF0dHIudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyhjb252ZXJ0ZWQpO1xuICAgICAgICAgICAgaWYgKGNvbnZlcnRlZCBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gYXNzZW1ibGVCb3VuZFRleHRQbGFjZWhvbGRlcnMobWVzc2FnZSk7XG4gICAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IHBsYWNlaG9sZGVyc1RvUGFyYW1zKHBsYWNlaG9sZGVycyk7XG4gICAgICAgICAgICAgIGkxOG5BdHRyQXJncy5wdXNoKG8ubGl0ZXJhbChhdHRyLm5hbWUpLCB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGFyYW1zKSk7XG4gICAgICAgICAgICAgIGNvbnZlcnRlZC5leHByZXNzaW9ucy5mb3JFYWNoKGV4cHJlc3Npb24gPT4ge1xuICAgICAgICAgICAgICAgIGhhc0JpbmRpbmdzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50SW5kZXgsIGVsZW1lbnQuc291cmNlU3BhbiwgUjMuaTE4bkV4cCxcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gW3RoaXMuY29udmVydEV4cHJlc3Npb25CaW5kaW5nKGltcGxpY2l0LCBleHByZXNzaW9uKV0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaTE4bkF0dHJBcmdzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IGluZGV4OiBvLkV4cHJlc3Npb24gPSBvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpO1xuICAgICAgICAgIGNvbnN0IGFyZ3MgPSB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsQXJyKGkxOG5BdHRyQXJncyksIHRydWUpO1xuICAgICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BdHRyaWJ1dGVzLCBbaW5kZXgsIGFyZ3NdKTtcbiAgICAgICAgICBpZiAoaGFzQmluZGluZ3MpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBlbGVtZW50LnNvdXJjZVNwYW4sIFIzLmkxOG5BcHBseSwgW2luZGV4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBzdHlsZSBiaW5kaW5ncyBjb2RlIGlzIHBsYWNlZCBpbnRvIHR3byBkaXN0aW5jdCBibG9ja3Mgd2l0aGluIHRoZSB0ZW1wbGF0ZSBmdW5jdGlvbiBBT1RcbiAgICAgIC8vIGNvZGU6IGNyZWF0aW9uIGFuZCB1cGRhdGUuIFRoZSBjcmVhdGlvbiBjb2RlIGNvbnRhaW5zIHRoZSBgc3R5bGluZ2AgaW5zdHJ1Y3Rpb25zXG4gICAgICAvLyB3aGljaCB3aWxsIGFwcGx5IHRoZSBjb2xsZWN0ZWQgYmluZGluZyB2YWx1ZXMgdG8gdGhlIGVsZW1lbnQuIGBzdHlsaW5nYCBpc1xuICAgICAgLy8gZGVzaWduZWQgdG8gcnVuIGluc2lkZSBvZiBgZWxlbWVudFN0YXJ0YCBhbmQgYGVsZW1lbnRFbmRgLiBUaGUgdXBkYXRlIGluc3RydWN0aW9uc1xuICAgICAgLy8gKHRoaW5ncyBsaWtlIGBzdHlsZVByb3BgLCBgY2xhc3NQcm9wYCwgZXRjLi4pIGFyZSBhcHBsaWVkIGxhdGVyIG9uIGluIHRoaXNcbiAgICAgIC8vIGZpbGVcbiAgICAgIHRoaXMucHJvY2Vzc1N0eWxpbmdJbnN0cnVjdGlvbihcbiAgICAgICAgICBlbGVtZW50SW5kZXgsIGltcGxpY2l0LFxuICAgICAgICAgIHN0eWxpbmdCdWlsZGVyLmJ1aWxkU3R5bGluZ0luc3RydWN0aW9uKGVsZW1lbnQuc291cmNlU3BhbiwgdGhpcy5jb25zdGFudFBvb2wpLCB0cnVlKTtcblxuICAgICAgLy8gR2VuZXJhdGUgTGlzdGVuZXJzIChvdXRwdXRzKVxuICAgICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2goKG91dHB1dEFzdDogdC5Cb3VuZEV2ZW50KSA9PiB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICAgIG91dHB1dEFzdC5zb3VyY2VTcGFuLCBSMy5saXN0ZW5lcixcbiAgICAgICAgICAgIHRoaXMucHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKGVsZW1lbnQubmFtZSwgb3V0cHV0QXN0LCBlbGVtZW50SW5kZXgpKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3RlOiBpdCdzIGltcG9ydGFudCB0byBrZWVwIGkxOG4vaTE4blN0YXJ0IGluc3RydWN0aW9ucyBhZnRlciBpMThuQXR0cmlidXRlcyBhbmRcbiAgICAgIC8vIGxpc3RlbmVycywgdG8gbWFrZSBzdXJlIGkxOG5BdHRyaWJ1dGVzIGluc3RydWN0aW9uIHRhcmdldHMgY3VycmVudCBlbGVtZW50IGF0IHJ1bnRpbWUuXG4gICAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5pMThuU3RhcnQoZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4gISwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBjb2RlIGhlcmUgd2lsbCBjb2xsZWN0IGFsbCB1cGRhdGUtbGV2ZWwgc3R5bGluZyBpbnN0cnVjdGlvbnMgYW5kIGFkZCB0aGVtIHRvIHRoZVxuICAgIC8vIHVwZGF0ZSBibG9jayBvZiB0aGUgdGVtcGxhdGUgZnVuY3Rpb24gQU9UIGNvZGUuIEluc3RydWN0aW9ucyBsaWtlIGBzdHlsZVByb3BgLFxuICAgIC8vIGBzdHlsZU1hcGAsIGBjbGFzc01hcGAsIGBjbGFzc1Byb3BgIGFuZCBgc3R5bGluZ0FwcGx5YFxuICAgIC8vIGFyZSBhbGwgZ2VuZXJhdGVkIGFuZCBhc3NpZ25lZCBpbiB0aGUgY29kZSBiZWxvdy5cbiAgICBjb25zdCBzdHlsaW5nSW5zdHJ1Y3Rpb25zID0gc3R5bGluZ0J1aWxkZXIuYnVpbGRVcGRhdGVMZXZlbEluc3RydWN0aW9ucyh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgY29uc3QgbGltaXQgPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zLmxlbmd0aCAtIDE7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBzdHlsaW5nSW5zdHJ1Y3Rpb25zW2ldO1xuICAgICAgdGhpcy5fYmluZGluZ1Nsb3RzICs9IGluc3RydWN0aW9uLmFsbG9jYXRlQmluZGluZ1Nsb3RzO1xuICAgICAgdGhpcy5wcm9jZXNzU3R5bGluZ0luc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW1wbGljaXQsIGluc3RydWN0aW9uLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gdGhlIHJlYXNvbiB3aHkgYHVuZGVmaW5lZGAgaXMgdXNlZCBpcyBiZWNhdXNlIHRoZSByZW5kZXJlciB1bmRlcnN0YW5kcyB0aGlzIGFzIGFcbiAgICAvLyBzcGVjaWFsIHZhbHVlIHRvIHN5bWJvbGl6ZSB0aGF0IHRoZXJlIGlzIG5vIFJIUyB0byB0aGlzIGJpbmRpbmdcbiAgICAvLyBUT0RPIChtYXRza28pOiByZXZpc2l0IHRoaXMgb25jZSBGVy05NTkgaXMgYXBwcm9hY2hlZFxuICAgIGNvbnN0IGVtcHR5VmFsdWVCaW5kSW5zdHJ1Y3Rpb24gPSBvLmxpdGVyYWwodW5kZWZpbmVkKTtcblxuICAgIC8vIEdlbmVyYXRlIGVsZW1lbnQgaW5wdXQgYmluZGluZ3NcbiAgICBhbGxPdGhlcklucHV0cy5mb3JFYWNoKChpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSkgPT4ge1xuICAgICAgY29uc3QgaW5wdXRUeXBlID0gaW5wdXQudHlwZTtcbiAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgLy8gYW5pbWF0aW9uIGJpbmRpbmdzIGNhbiBiZSBwcmVzZW50ZWQgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXRzOlxuICAgICAgICAvLyAxLiBbQGJpbmRpbmddPVwiZm9vRXhwXCJcbiAgICAgICAgLy8gMi4gW0BiaW5kaW5nXT1cInt2YWx1ZTpmb29FeHAsIHBhcmFtczp7Li4ufX1cIlxuICAgICAgICAvLyAzLiBbQGJpbmRpbmddXG4gICAgICAgIC8vIDQuIEBiaW5kaW5nXG4gICAgICAgIC8vIEFsbCBmb3JtYXRzIHdpbGwgYmUgdmFsaWQgZm9yIHdoZW4gYSBzeW50aGV0aWMgYmluZGluZyBpcyBjcmVhdGVkLlxuICAgICAgICAvLyBUaGUgcmVhc29uaW5nIGZvciB0aGlzIGlzIGJlY2F1c2UgdGhlIHJlbmRlcmVyIHNob3VsZCBnZXQgZWFjaFxuICAgICAgICAvLyBzeW50aGV0aWMgYmluZGluZyB2YWx1ZSBpbiB0aGUgb3JkZXIgb2YgdGhlIGFycmF5IHRoYXQgdGhleSBhcmVcbiAgICAgICAgLy8gZGVmaW5lZCBpbi4uLlxuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IHZhbHVlIGluc3RhbmNlb2YgTGl0ZXJhbFByaW1pdGl2ZSA/ICEhdmFsdWUudmFsdWUgOiB0cnVlO1xuICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgICAgY29uc3QgYmluZGluZ05hbWUgPSBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGlucHV0Lm5hbWUpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBSMy5wcm9wZXJ0eSwgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICBvLmxpdGVyYWwoYmluZGluZ05hbWUpLFxuICAgICAgICAgICAgKGhhc1ZhbHVlID8gdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgLyogc2tpcEJpbmRGbiAqLyB0cnVlKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICBlbXB0eVZhbHVlQmluZEluc3RydWN0aW9uKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIG11c3Qgc2tpcCBhdHRyaWJ1dGVzIHdpdGggYXNzb2NpYXRlZCBpMThuIGNvbnRleHQsIHNpbmNlIHRoZXNlIGF0dHJpYnV0ZXMgYXJlIGhhbmRsZWRcbiAgICAgICAgLy8gc2VwYXJhdGVseSBhbmQgY29ycmVzcG9uZGluZyBgaTE4bkV4cGAgYW5kIGBpMThuQXBwbHlgIGluc3RydWN0aW9ucyB3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAgICBpZiAoaW5wdXQuaTE4bikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudmlzaXQodGhpcy5fdmFsdWVDb252ZXJ0ZXIpO1xuICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgICBjb25zdCBbYXR0ck5hbWVzcGFjZSwgYXR0ck5hbWVdID0gc3BsaXROc05hbWUoaW5wdXQubmFtZSk7XG4gICAgICAgICAgY29uc3QgaXNBdHRyaWJ1dGVCaW5kaW5nID0gaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGU7XG4gICAgICAgICAgY29uc3Qgc2FuaXRpemF0aW9uUmVmID0gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGlucHV0LnNlY3VyaXR5Q29udGV4dCwgaXNBdHRyaWJ1dGVCaW5kaW5nKTtcbiAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSBwYXJhbXMucHVzaChzYW5pdGl6YXRpb25SZWYpO1xuICAgICAgICAgIGlmIChhdHRyTmFtZXNwYWNlKSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VMaXRlcmFsID0gby5saXRlcmFsKGF0dHJOYW1lc3BhY2UpO1xuXG4gICAgICAgICAgICBpZiAoc2FuaXRpemF0aW9uUmVmKSB7XG4gICAgICAgICAgICAgIHBhcmFtcy5wdXNoKG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlcmUgd2Fzbid0IGEgc2FuaXRpemF0aW9uIHJlZiwgd2UgbmVlZCB0byBhZGRcbiAgICAgICAgICAgICAgLy8gYW4gZXh0cmEgcGFyYW0gc28gdGhhdCB3ZSBjYW4gcGFzcyBpbiB0aGUgbmFtZXNwYWNlLlxuICAgICAgICAgICAgICBwYXJhbXMucHVzaChvLmxpdGVyYWwobnVsbCksIG5hbWVzcGFjZUxpdGVyYWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgICAgICAgIGlmIChpbnB1dFR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgICAgICAgIC8vIHByb3A9XCJ7e3ZhbHVlfX1cIiBhbmQgZnJpZW5kc1xuICAgICAgICAgICAgICB0aGlzLmludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgZ2V0UHJvcGVydHlJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksIGVsZW1lbnRJbmRleCwgYXR0ck5hbWUsIGlucHV0LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIHBhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBbcHJvcF09XCJ2YWx1ZVwiXG4gICAgICAgICAgICAgIHRoaXMuYm91bmRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIFIzLnByb3BlcnR5LCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgaW1wbGljaXQsIHZhbHVlLCBwYXJhbXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaW5wdXRUeXBlID09PSBCaW5kaW5nVHlwZS5BdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gJiYgZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgodmFsdWUpID4gMSkge1xuICAgICAgICAgICAgICAvLyBhdHRyLm5hbWU9XCJ0ZXh0e3t2YWx1ZX19XCIgYW5kIGZyaWVuZHNcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0ZWRVcGRhdGVJbnN0cnVjdGlvbihcbiAgICAgICAgICAgICAgICAgIGdldEF0dHJpYnV0ZUludGVycG9sYXRpb25FeHByZXNzaW9uKHZhbHVlKSwgZWxlbWVudEluZGV4LCBhdHRyTmFtZSwgaW5wdXQsIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgcGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IGJvdW5kVmFsdWUgPSB2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24gPyB2YWx1ZS5leHByZXNzaW9uc1swXSA6IHZhbHVlO1xuICAgICAgICAgICAgICAvLyBbYXR0ci5uYW1lXT1cInZhbHVlXCIgb3IgYXR0ci5uYW1lPVwie3t2YWx1ZX19XCJcbiAgICAgICAgICAgICAgdGhpcy5ib3VuZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgICAgICAgUjMuYXR0cmlidXRlLCBlbGVtZW50SW5kZXgsIGF0dHJOYW1lLCBpbnB1dCwgaW1wbGljaXQsIGJvdW5kVmFsdWUsIHBhcmFtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsYXNzIHByb3BcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oZWxlbWVudEluZGV4LCBpbnB1dC5zb3VyY2VTcGFuLCBSMy5jbGFzc1Byb3AsICgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICBvLmxpdGVyYWwoZWxlbWVudEluZGV4KSwgby5saXRlcmFsKGF0dHJOYW1lKSxcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlKSwgLi4ucGFyYW1zXG4gICAgICAgICAgICAgIF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYXZlcnNlIGVsZW1lbnQgY2hpbGQgbm9kZXNcbiAgICB0LnZpc2l0QWxsKHRoaXMsIGVsZW1lbnQuY2hpbGRyZW4pO1xuXG4gICAgaWYgKCFpc0kxOG5Sb290RWxlbWVudCAmJiB0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRFbGVtZW50KGVsZW1lbnQuaTE4biAhLCBlbGVtZW50SW5kZXgsIHRydWUpO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlU2VsZkNsb3NpbmdJbnN0cnVjdGlvbikge1xuICAgICAgLy8gRmluaXNoIGVsZW1lbnQgY29uc3RydWN0aW9uIG1vZGUuXG4gICAgICBjb25zdCBzcGFuID0gZWxlbWVudC5lbmRTb3VyY2VTcGFuIHx8IGVsZW1lbnQuc291cmNlU3BhbjtcbiAgICAgIGlmIChpc0kxOG5Sb290RWxlbWVudCkge1xuICAgICAgICB0aGlzLmkxOG5FbmQoc3BhbiwgY3JlYXRlU2VsZkNsb3NpbmdJMThuSW5zdHJ1Y3Rpb24pO1xuICAgICAgfVxuICAgICAgaWYgKGlzTm9uQmluZGFibGVNb2RlKSB7XG4gICAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihzcGFuLCBSMy5lbmFibGVCaW5kaW5ncyk7XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oc3BhbiwgaXNOZ0NvbnRhaW5lciA/IFIzLmVsZW1lbnRDb250YWluZXJFbmQgOiBSMy5lbGVtZW50RW5kKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGEgYm91bmQgcHJvcGVydHkgb3IgYXR0cmlidXRlLCBzdWNoIGFzIGBbcHJvcF09XCJ2YWx1ZVwiYCBvclxuICAgKiBgW2F0dHIudGl0bGVdPVwidmFsdWVcImBcbiAgICovXG4gIGJvdW5kVXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgZWxlbWVudEluZGV4OiBudW1iZXIsIGF0dHJOYW1lOiBzdHJpbmcsXG4gICAgICBpbnB1dDogdC5Cb3VuZEF0dHJpYnV0ZSwgaW1wbGljaXQ6IG8uUmVhZFZhckV4cHIsIHZhbHVlOiBhbnksIHBhcmFtczogYW55W10pIHtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKGVsZW1lbnRJbmRleCwgaW5wdXQuc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24sICgpID0+IHtcbiAgICAgIHJldHVybiBbby5saXRlcmFsKGF0dHJOYW1lKSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0LCB2YWx1ZSwgdHJ1ZSksIC4uLnBhcmFtc107XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZm9yIGFuIGludGVycG9sYXRlZCBwcm9wZXJ0eSBvciBhdHRyaWJ1dGUsIHN1Y2ggYXNcbiAgICogYHByb3A9XCJ7e3ZhbHVlfX1cImAgb3IgYGF0dHIudGl0bGU9XCJ7e3ZhbHVlfX1cImBcbiAgICovXG4gIGludGVycG9sYXRlZFVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgaW5zdHJ1Y3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UsIGVsZW1lbnRJbmRleDogbnVtYmVyLCBhdHRyTmFtZTogc3RyaW5nLFxuICAgICAgaW5wdXQ6IHQuQm91bmRBdHRyaWJ1dGUsIHZhbHVlOiBhbnksIHBhcmFtczogYW55W10pIHtcbiAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICBlbGVtZW50SW5kZXgsIGlucHV0LnNvdXJjZVNwYW4sIGluc3RydWN0aW9uLFxuICAgICAgICAoKSA9PlxuICAgICAgICAgICAgW28ubGl0ZXJhbChhdHRyTmFtZSksXG4gICAgICAgICAgICAgLi4udGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyhvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIHZhbHVlKSwgLi4ucGFyYW1zXSk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiB0LlRlbXBsYXRlKSB7XG4gICAgY29uc3QgTkdfVEVNUExBVEVfVEFHX05BTUUgPSAnbmctdGVtcGxhdGUnO1xuICAgIGNvbnN0IHRlbXBsYXRlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuaTE4bi5hcHBlbmRUZW1wbGF0ZSh0ZW1wbGF0ZS5pMThuICEsIHRlbXBsYXRlSW5kZXgpO1xuICAgIH1cblxuICAgIGNvbnN0IHRhZ05hbWUgPSBzYW5pdGl6ZUlkZW50aWZpZXIodGVtcGxhdGUudGFnTmFtZSB8fCAnJyk7XG4gICAgY29uc3QgY29udGV4dE5hbWUgPSBgJHt0aGlzLmNvbnRleHROYW1lfSR7dGFnTmFtZSA/ICdfJyArIHRhZ05hbWUgOiAnJ31fJHt0ZW1wbGF0ZUluZGV4fWA7XG4gICAgY29uc3QgdGVtcGxhdGVOYW1lID0gYCR7Y29udGV4dE5hbWV9X1RlbXBsYXRlYDtcblxuICAgIGNvbnN0IHBhcmFtZXRlcnM6IG8uRXhwcmVzc2lvbltdID0gW1xuICAgICAgby5saXRlcmFsKHRlbXBsYXRlSW5kZXgpLFxuICAgICAgby52YXJpYWJsZSh0ZW1wbGF0ZU5hbWUpLFxuXG4gICAgICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRoZSB0YWcncyBuYW1lc3BhY2UgaGVyZSwgYmVjYXVzZSB3ZSBpbmZlclxuICAgICAgLy8gaXQgYmFzZWQgb24gdGhlIHBhcmVudCBub2RlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGluc3RydWN0aW9uLlxuICAgICAgby5saXRlcmFsKHRlbXBsYXRlLnRhZ05hbWUgPyBzcGxpdE5zTmFtZSh0ZW1wbGF0ZS50YWdOYW1lKVsxXSA6IHRlbXBsYXRlLnRhZ05hbWUpLFxuICAgIF07XG5cbiAgICAvLyBmaW5kIGRpcmVjdGl2ZXMgbWF0Y2hpbmcgb24gYSBnaXZlbiA8bmctdGVtcGxhdGU+IG5vZGVcbiAgICB0aGlzLm1hdGNoRGlyZWN0aXZlcyhOR19URU1QTEFURV9UQUdfTkFNRSwgdGVtcGxhdGUpO1xuXG4gICAgLy8gcHJlcGFyZSBhdHRyaWJ1dGVzIHBhcmFtZXRlciAoaW5jbHVkaW5nIGF0dHJpYnV0ZXMgdXNlZCBmb3IgZGlyZWN0aXZlIG1hdGNoaW5nKVxuICAgIGNvbnN0IGF0dHJzRXhwcnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgdGVtcGxhdGUuYXR0cmlidXRlcy5mb3JFYWNoKFxuICAgICAgICAoYTogdC5UZXh0QXR0cmlidXRlKSA9PiB7IGF0dHJzRXhwcnMucHVzaChhc0xpdGVyYWwoYS5uYW1lKSwgYXNMaXRlcmFsKGEudmFsdWUpKTsgfSk7XG4gICAgYXR0cnNFeHBycy5wdXNoKC4uLnRoaXMucHJlcGFyZU5vblJlbmRlckF0dHJzKFxuICAgICAgICB0ZW1wbGF0ZS5pbnB1dHMsIHRlbXBsYXRlLm91dHB1dHMsIHVuZGVmaW5lZCwgdGVtcGxhdGUudGVtcGxhdGVBdHRycykpO1xuICAgIHBhcmFtZXRlcnMucHVzaCh0aGlzLnRvQXR0cnNQYXJhbShhdHRyc0V4cHJzKSk7XG5cbiAgICAvLyBsb2NhbCByZWZzIChleC46IDxuZy10ZW1wbGF0ZSAjZm9vPilcbiAgICBpZiAodGVtcGxhdGUucmVmZXJlbmNlcyAmJiB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmxlbmd0aCkge1xuICAgICAgcGFyYW1ldGVycy5wdXNoKHRoaXMucHJlcGFyZVJlZnNQYXJhbWV0ZXIodGVtcGxhdGUucmVmZXJlbmNlcykpO1xuICAgICAgcGFyYW1ldGVycy5wdXNoKG8uaW1wb3J0RXhwcihSMy50ZW1wbGF0ZVJlZkV4dHJhY3RvcikpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgdGVtcGxhdGUgZnVuY3Rpb25cbiAgICBjb25zdCB0ZW1wbGF0ZVZpc2l0b3IgPSBuZXcgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcihcbiAgICAgICAgdGhpcy5jb25zdGFudFBvb2wsIHRoaXMuX2JpbmRpbmdTY29wZSwgdGhpcy5sZXZlbCArIDEsIGNvbnRleHROYW1lLCB0aGlzLmkxOG4sXG4gICAgICAgIHRlbXBsYXRlSW5kZXgsIHRlbXBsYXRlTmFtZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLCB0aGlzLmRpcmVjdGl2ZXMsIHRoaXMucGlwZVR5cGVCeU5hbWUsXG4gICAgICAgIHRoaXMucGlwZXMsIHRoaXMuX25hbWVzcGFjZSwgdGhpcy5maWxlQmFzZWRJMThuU3VmZml4LCB0aGlzLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgICAvLyBOZXN0ZWQgdGVtcGxhdGVzIG11c3Qgbm90IGJlIHZpc2l0ZWQgdW50aWwgYWZ0ZXIgdGhlaXIgcGFyZW50IHRlbXBsYXRlcyBoYXZlIGNvbXBsZXRlZFxuICAgIC8vIHByb2Nlc3NpbmcsIHNvIHRoZXkgYXJlIHF1ZXVlZCBoZXJlIHVudGlsIGFmdGVyIHRoZSBpbml0aWFsIHBhc3MuIE90aGVyd2lzZSwgd2Ugd291bGRuJ3RcbiAgICAvLyBiZSBhYmxlIHRvIHN1cHBvcnQgYmluZGluZ3MgaW4gbmVzdGVkIHRlbXBsYXRlcyB0byBsb2NhbCByZWZzIHRoYXQgb2NjdXIgYWZ0ZXIgdGhlXG4gICAgLy8gdGVtcGxhdGUgZGVmaW5pdGlvbi4gZS5nLiA8ZGl2ICpuZ0lmPVwic2hvd2luZ1wiPnt7IGZvbyB9fTwvZGl2PiAgPGRpdiAjZm9vPjwvZGl2PlxuICAgIHRoaXMuX25lc3RlZFRlbXBsYXRlRm5zLnB1c2goKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHIgPSB0ZW1wbGF0ZVZpc2l0b3IuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKFxuICAgICAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLCB0ZW1wbGF0ZS52YXJpYWJsZXMsXG4gICAgICAgICAgdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggKyB0aGlzLl9uZ0NvbnRlbnRTZWxlY3RvcnNPZmZzZXQsIHRlbXBsYXRlLmkxOG4pO1xuICAgICAgdGhpcy5jb25zdGFudFBvb2wuc3RhdGVtZW50cy5wdXNoKHRlbXBsYXRlRnVuY3Rpb25FeHByLnRvRGVjbFN0bXQodGVtcGxhdGVOYW1lLCBudWxsKSk7XG4gICAgICBpZiAodGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzLnB1c2goLi4udGVtcGxhdGVWaXNpdG9yLl9uZ0NvbnRlbnRSZXNlcnZlZFNsb3RzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGUuZy4gdGVtcGxhdGUoMSwgTXlDb21wX1RlbXBsYXRlXzEpXG4gICAgdGhpcy5jcmVhdGlvbkluc3RydWN0aW9uKHRlbXBsYXRlLnNvdXJjZVNwYW4sIFIzLnRlbXBsYXRlQ3JlYXRlLCAoKSA9PiB7XG4gICAgICBwYXJhbWV0ZXJzLnNwbGljZShcbiAgICAgICAgICAyLCAwLCBvLmxpdGVyYWwodGVtcGxhdGVWaXNpdG9yLmdldENvbnN0Q291bnQoKSksXG4gICAgICAgICAgby5saXRlcmFsKHRlbXBsYXRlVmlzaXRvci5nZXRWYXJDb3VudCgpKSk7XG4gICAgICByZXR1cm4gdHJpbVRyYWlsaW5nTnVsbHMocGFyYW1ldGVycyk7XG4gICAgfSk7XG5cbiAgICAvLyBoYW5kbGUgcHJvcGVydHkgYmluZGluZ3MgZS5nLiDJtcm1cHJvcGVydHkoJ25nRm9yT2YnLCBjdHguaXRlbXMpLCBldCBhbDtcbiAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgIHRoaXMudGVtcGxhdGVQcm9wZXJ0eUJpbmRpbmdzKHRlbXBsYXRlLCB0ZW1wbGF0ZUluZGV4LCBjb250ZXh0LCB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzKTtcblxuICAgIC8vIE9ubHkgYWRkIG5vcm1hbCBpbnB1dC9vdXRwdXQgYmluZGluZyBpbnN0cnVjdGlvbnMgb24gZXhwbGljaXQgbmctdGVtcGxhdGUgZWxlbWVudHMuXG4gICAgaWYgKHRlbXBsYXRlLnRhZ05hbWUgPT09IE5HX1RFTVBMQVRFX1RBR19OQU1FKSB7XG4gICAgICAvLyBBZGQgdGhlIGlucHV0IGJpbmRpbmdzXG4gICAgICB0aGlzLnRlbXBsYXRlUHJvcGVydHlCaW5kaW5ncyh0ZW1wbGF0ZSwgdGVtcGxhdGVJbmRleCwgY29udGV4dCwgdGVtcGxhdGUuaW5wdXRzKTtcbiAgICAgIC8vIEdlbmVyYXRlIGxpc3RlbmVycyBmb3IgZGlyZWN0aXZlIG91dHB1dFxuICAgICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKChvdXRwdXRBc3Q6IHQuQm91bmRFdmVudCkgPT4ge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICBvdXRwdXRBc3Quc291cmNlU3BhbiwgUjMubGlzdGVuZXIsXG4gICAgICAgICAgICB0aGlzLnByZXBhcmVMaXN0ZW5lclBhcmFtZXRlcignbmdfdGVtcGxhdGUnLCBvdXRwdXRBc3QsIHRlbXBsYXRlSW5kZXgpKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZXNlIHNob3VsZCBiZSBoYW5kbGVkIGluIHRoZSB0ZW1wbGF0ZSBvciBlbGVtZW50IGRpcmVjdGx5LlxuICByZWFkb25seSB2aXNpdFJlZmVyZW5jZSA9IGludmFsaWQ7XG4gIHJlYWRvbmx5IHZpc2l0VmFyaWFibGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdFRleHRBdHRyaWJ1dGUgPSBpbnZhbGlkO1xuICByZWFkb25seSB2aXNpdEJvdW5kQXR0cmlidXRlID0gaW52YWxpZDtcbiAgcmVhZG9ubHkgdmlzaXRCb3VuZEV2ZW50ID0gaW52YWxpZDtcblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiB0LkJvdW5kVGV4dCkge1xuICAgIGlmICh0aGlzLmkxOG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGV4dC52YWx1ZS52aXNpdCh0aGlzLl92YWx1ZUNvbnZlcnRlcik7XG4gICAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgICAgdGhpcy5pMThuLmFwcGVuZEJvdW5kVGV4dCh0ZXh0LmkxOG4gISk7XG4gICAgICAgIHRoaXMuaTE4bkFwcGVuZEJpbmRpbmdzKHZhbHVlLmV4cHJlc3Npb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlSW5kZXggPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcblxuICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbih0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuXG4gICAgY29uc3QgdmFsdWUgPSB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICB0aGlzLmFsbG9jYXRlQmluZGluZ1Nsb3RzKHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludGVycG9sYXRpb24pIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbih2YWx1ZSksXG4gICAgICAgICAgKCkgPT4gdGhpcy5nZXRVcGRhdGVJbnN0cnVjdGlvbkFyZ3VtZW50cyhvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSksIHZhbHVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgbm9kZUluZGV4LCB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHRCaW5kaW5nLFxuICAgICAgICAgICgpID0+XG4gICAgICAgICAgICAgIFtvLmxpdGVyYWwobm9kZUluZGV4KSwgdGhpcy5jb252ZXJ0UHJvcGVydHlCaW5kaW5nKG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKSwgdmFsdWUpXSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IHQuVGV4dCkge1xuICAgIC8vIHdoZW4gYSB0ZXh0IGVsZW1lbnQgaXMgbG9jYXRlZCB3aXRoaW4gYSB0cmFuc2xhdGFibGVcbiAgICAvLyBibG9jaywgd2UgZXhjbHVkZSB0aGlzIHRleHQgZWxlbWVudCBmcm9tIGluc3RydWN0aW9ucyBzZXQsXG4gICAgLy8gc2luY2UgaXQgd2lsbCBiZSBjYXB0dXJlZCBpbiBpMThuIGNvbnRlbnQgYW5kIHByb2Nlc3NlZCBhdCBydW50aW1lXG4gICAgaWYgKCF0aGlzLmkxOG4pIHtcbiAgICAgIHRoaXMuY3JlYXRpb25JbnN0cnVjdGlvbihcbiAgICAgICAgICB0ZXh0LnNvdXJjZVNwYW4sIFIzLnRleHQsIFtvLmxpdGVyYWwodGhpcy5hbGxvY2F0ZURhdGFTbG90KCkpLCBvLmxpdGVyYWwodGV4dC52YWx1ZSldKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEljdShpY3U6IHQuSWN1KSB7XG4gICAgbGV0IGluaXRXYXNJbnZva2VkID0gZmFsc2U7XG5cbiAgICAvLyBpZiBhbiBJQ1Ugd2FzIGNyZWF0ZWQgb3V0c2lkZSBvZiBpMThuIGJsb2NrLCB3ZSBzdGlsbCB0cmVhdFxuICAgIC8vIGl0IGFzIGEgdHJhbnNsYXRhYmxlIGVudGl0eSBhbmQgaW52b2tlIGkxOG5TdGFydCBhbmQgaTE4bkVuZFxuICAgIC8vIHRvIGdlbmVyYXRlIGkxOG4gY29udGV4dCBhbmQgdGhlIG5lY2Vzc2FyeSBpbnN0cnVjdGlvbnNcbiAgICBpZiAoIXRoaXMuaTE4bikge1xuICAgICAgaW5pdFdhc0ludm9rZWQgPSB0cnVlO1xuICAgICAgdGhpcy5pMThuU3RhcnQobnVsbCwgaWN1LmkxOG4gISwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4biA9IHRoaXMuaTE4biAhO1xuICAgIGNvbnN0IHZhcnMgPSB0aGlzLmkxOG5CaW5kUHJvcHMoaWN1LnZhcnMpO1xuICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHRoaXMuaTE4bkJpbmRQcm9wcyhpY3UucGxhY2Vob2xkZXJzKTtcblxuICAgIC8vIG91dHB1dCBJQ1UgZGlyZWN0bHkgYW5kIGtlZXAgSUNVIHJlZmVyZW5jZSBpbiBjb250ZXh0XG4gICAgY29uc3QgbWVzc2FnZSA9IGljdS5pMThuICFhcyBpMThuLk1lc3NhZ2U7XG4gICAgY29uc3QgdHJhbnNmb3JtRm4gPSAocmF3OiBvLlJlYWRWYXJFeHByKSA9PlxuICAgICAgICBpbnN0cnVjdGlvbihudWxsLCBSMy5pMThuUG9zdHByb2Nlc3MsIFtyYXcsIG1hcExpdGVyYWwodmFycywgdHJ1ZSldKTtcblxuICAgIC8vIGluIGNhc2UgdGhlIHdob2xlIGkxOG4gbWVzc2FnZSBpcyBhIHNpbmdsZSBJQ1UgLSB3ZSBkbyBub3QgbmVlZCB0b1xuICAgIC8vIGNyZWF0ZSBhIHNlcGFyYXRlIHRvcC1sZXZlbCB0cmFuc2xhdGlvbiwgd2UgY2FuIHVzZSB0aGUgcm9vdCByZWYgaW5zdGVhZFxuICAgIC8vIGFuZCBtYWtlIHRoaXMgSUNVIGEgdG9wLWxldmVsIHRyYW5zbGF0aW9uXG4gICAgaWYgKGlzU2luZ2xlSTE4bkljdShpMThuLm1ldGEpKSB7XG4gICAgICB0aGlzLmkxOG5UcmFuc2xhdGUobWVzc2FnZSwgcGxhY2Vob2xkZXJzLCBpMThuLnJlZiwgdHJhbnNmb3JtRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBvdXRwdXQgSUNVIGRpcmVjdGx5IGFuZCBrZWVwIElDVSByZWZlcmVuY2UgaW4gY29udGV4dFxuICAgICAgY29uc3QgcmVmID0gdGhpcy5pMThuVHJhbnNsYXRlKG1lc3NhZ2UsIHBsYWNlaG9sZGVycywgdW5kZWZpbmVkLCB0cmFuc2Zvcm1Gbik7XG4gICAgICBpMThuLmFwcGVuZEljdShpY3VGcm9tSTE4bk1lc3NhZ2UobWVzc2FnZSkubmFtZSwgcmVmKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdFdhc0ludm9rZWQpIHtcbiAgICAgIHRoaXMuaTE4bkVuZChudWxsLCB0cnVlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlRGF0YVNsb3QoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXgrKzsgfVxuXG4gIGdldENvbnN0Q291bnQoKSB7IHJldHVybiB0aGlzLl9kYXRhSW5kZXg7IH1cblxuICBnZXRWYXJDb3VudCgpIHsgcmV0dXJuIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzOyB9XG5cbiAgZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fbmdDb250ZW50UmVzZXJ2ZWRTbG90cy5sZW5ndGggP1xuICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoYXNMaXRlcmFsKHRoaXMuX25nQ29udGVudFJlc2VydmVkU2xvdHMpLCB0cnVlKSA6XG4gICAgICAgIG51bGw7XG4gIH1cblxuICBwcml2YXRlIGJpbmRpbmdDb250ZXh0KCkgeyByZXR1cm4gYCR7dGhpcy5fYmluZGluZ0NvbnRleHQrK31gOyB9XG5cbiAgcHJpdmF0ZSB0ZW1wbGF0ZVByb3BlcnR5QmluZGluZ3MoXG4gICAgICB0ZW1wbGF0ZTogdC5UZW1wbGF0ZSwgdGVtcGxhdGVJbmRleDogbnVtYmVyLCBjb250ZXh0OiBvLlJlYWRWYXJFeHByLFxuICAgICAgYXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSkge1xuICAgIGF0dHJzLmZvckVhY2goaW5wdXQgPT4ge1xuICAgICAgaWYgKGlucHV0IGluc3RhbmNlb2YgdC5Cb3VuZEF0dHJpYnV0ZSkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlLnZpc2l0KHRoaXMuX3ZhbHVlQ29udmVydGVyKTtcbiAgICAgICAgdGhpcy5hbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZSk7XG4gICAgICAgIHRoaXMudXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICAgICAgICB0ZW1wbGF0ZUluZGV4LCB0ZW1wbGF0ZS5zb3VyY2VTcGFuLCBSMy5wcm9wZXJ0eSxcbiAgICAgICAgICAgICgpID0+IFtvLmxpdGVyYWwoaW5wdXQubmFtZSksIHRoaXMuY29udmVydFByb3BlcnR5QmluZGluZyhjb250ZXh0LCB2YWx1ZSwgdHJ1ZSldKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIEJpbmRpbmdzIG11c3Qgb25seSBiZSByZXNvbHZlZCBhZnRlciBhbGwgbG9jYWwgcmVmcyBoYXZlIGJlZW4gdmlzaXRlZCwgc28gYWxsXG4gIC8vIGluc3RydWN0aW9ucyBhcmUgcXVldWVkIGluIGNhbGxiYWNrcyB0aGF0IGV4ZWN1dGUgb25jZSB0aGUgaW5pdGlhbCBwYXNzIGhhcyBjb21wbGV0ZWQuXG4gIC8vIE90aGVyd2lzZSwgd2Ugd291bGRuJ3QgYmUgYWJsZSB0byBzdXBwb3J0IGxvY2FsIHJlZnMgdGhhdCBhcmUgZGVmaW5lZCBhZnRlciB0aGVpclxuICAvLyBiaW5kaW5ncy4gZS5nLiB7eyBmb28gfX0gPGRpdiAjZm9vPjwvZGl2PlxuICBwcml2YXRlIGluc3RydWN0aW9uRm4oXG4gICAgICBmbnM6ICgoKSA9PiBvLlN0YXRlbWVudClbXSwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm46IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuICAgIGZuc1twcmVwZW5kID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSgoKSA9PiB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBBcnJheS5pc0FycmF5KHBhcmFtc09yRm4pID8gcGFyYW1zT3JGbiA6IHBhcmFtc09yRm4oKTtcbiAgICAgIHJldHVybiBpbnN0cnVjdGlvbihzcGFuLCByZWZlcmVuY2UsIHBhcmFtcykudG9TdG10KCk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByb2Nlc3NTdHlsaW5nSW5zdHJ1Y3Rpb24oXG4gICAgICBlbGVtZW50SW5kZXg6IG51bWJlciwgaW1wbGljaXQ6IGFueSwgaW5zdHJ1Y3Rpb246IEluc3RydWN0aW9ufG51bGwsIGNyZWF0ZU1vZGU6IGJvb2xlYW4pIHtcbiAgICBpZiAoaW5zdHJ1Y3Rpb24pIHtcbiAgICAgIGNvbnN0IHBhcmFtc0ZuID0gKCkgPT5cbiAgICAgICAgICBpbnN0cnVjdGlvbi5idWlsZFBhcmFtcyh2YWx1ZSA9PiB0aGlzLmNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoaW1wbGljaXQsIHZhbHVlLCB0cnVlKSk7XG4gICAgICBpZiAoY3JlYXRlTW9kZSkge1xuICAgICAgICB0aGlzLmNyZWF0aW9uSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb24uc291cmNlU3BhbiwgaW5zdHJ1Y3Rpb24ucmVmZXJlbmNlLCBwYXJhbXNGbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZUluc3RydWN0aW9uKFxuICAgICAgICAgICAgZWxlbWVudEluZGV4LCBpbnN0cnVjdGlvbi5zb3VyY2VTcGFuLCBpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIHBhcmFtc0ZuKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0aW9uSW5zdHJ1Y3Rpb24oXG4gICAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW58bnVsbCwgcmVmZXJlbmNlOiBvLkV4dGVybmFsUmVmZXJlbmNlLFxuICAgICAgcGFyYW1zT3JGbj86IG8uRXhwcmVzc2lvbltdfCgoKSA9PiBvLkV4cHJlc3Npb25bXSksIHByZXBlbmQ/OiBib29sZWFuKSB7XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX2NyZWF0aW9uQ29kZUZucywgc3BhbiwgcmVmZXJlbmNlLCBwYXJhbXNPckZuIHx8IFtdLCBwcmVwZW5kKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlSW5zdHJ1Y3Rpb24oXG4gICAgICBub2RlSW5kZXg6IG51bWJlciwgc3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwsIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSxcbiAgICAgIHBhcmFtc09yRm4/OiBvLkV4cHJlc3Npb25bXXwoKCkgPT4gby5FeHByZXNzaW9uW10pKSB7XG4gICAgaWYgKHRoaXMuX2xhc3ROb2RlSW5kZXhXaXRoRmx1c2ggPCBub2RlSW5kZXgpIHtcbiAgICAgIHRoaXMuaW5zdHJ1Y3Rpb25Gbih0aGlzLl91cGRhdGVDb2RlRm5zLCBzcGFuLCBSMy5zZWxlY3QsIFtvLmxpdGVyYWwobm9kZUluZGV4KV0pO1xuICAgICAgdGhpcy5fbGFzdE5vZGVJbmRleFdpdGhGbHVzaCA9IG5vZGVJbmRleDtcbiAgICB9XG4gICAgdGhpcy5pbnN0cnVjdGlvbkZuKHRoaXMuX3VwZGF0ZUNvZGVGbnMsIHNwYW4sIHJlZmVyZW5jZSwgcGFyYW1zT3JGbiB8fCBbXSk7XG4gIH1cblxuICBwcml2YXRlIGFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3Qgb3JpZ2luYWxTbG90cyA9IHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzO1xuICAgIHRoaXMuX3B1cmVGdW5jdGlvblNsb3RzICs9IG51bVNsb3RzO1xuICAgIHJldHVybiBvcmlnaW5hbFNsb3RzO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxvY2F0ZUJpbmRpbmdTbG90cyh2YWx1ZTogQVNUfG51bGwpIHtcbiAgICB0aGlzLl9iaW5kaW5nU2xvdHMgKz0gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gdmFsdWUuZXhwcmVzc2lvbnMubGVuZ3RoIDogMTtcbiAgfVxuXG4gIHByaXZhdGUgY29udmVydEV4cHJlc3Npb25CaW5kaW5nKGltcGxpY2l0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBBU1QpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZyA9XG4gICAgICAgIGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcodGhpcywgaW1wbGljaXQsIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCksIEJpbmRpbmdGb3JtLlRyeVNpbXBsZSk7XG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmJpbmQpLmNhbGxGbihbdmFsRXhwcl0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKGltcGxpY2l0OiBvLkV4cHJlc3Npb24sIHZhbHVlOiBBU1QsIHNraXBCaW5kRm4/OiBib29sZWFuKTpcbiAgICAgIG8uRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgaW50ZXJwb2xhdGlvbkZuID1cbiAgICAgICAgdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uID8gaW50ZXJwb2xhdGUgOiAoKSA9PiBlcnJvcignVW5leHBlY3RlZCBpbnRlcnBvbGF0aW9uJyk7XG5cbiAgICBjb25zdCBjb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcgPSBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgICB0aGlzLCBpbXBsaWNpdCwgdmFsdWUsIHRoaXMuYmluZGluZ0NvbnRleHQoKSwgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlLCBpbnRlcnBvbGF0aW9uRm4pO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5jb252ZXJ0ZWRQcm9wZXJ0eUJpbmRpbmcuc3RtdHMpO1xuXG4gICAgY29uc3QgdmFsRXhwciA9IGNvbnZlcnRlZFByb3BlcnR5QmluZGluZy5jdXJyVmFsRXhwcjtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBJbnRlcnBvbGF0aW9uIHx8IHNraXBCaW5kRm4gPyB2YWxFeHByIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvLmltcG9ydEV4cHIoUjMuYmluZCkuY2FsbEZuKFt2YWxFeHByXSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGxpc3Qgb2YgYXJndW1lbnQgZXhwcmVzc2lvbnMgdG8gcGFzcyB0byBhbiB1cGRhdGUgaW5zdHJ1Y3Rpb24gZXhwcmVzc2lvbi4gQWxzbyB1cGRhdGVzXG4gICAqIHRoZSB0ZW1wIHZhcmlhYmxlcyBzdGF0ZSB3aXRoIHRlbXAgdmFyaWFibGVzIHRoYXQgd2VyZSBpZGVudGlmaWVkIGFzIG5lZWRpbmcgdG8gYmUgY3JlYXRlZFxuICAgKiB3aGlsZSB2aXNpdGluZyB0aGUgYXJndW1lbnRzLlxuICAgKiBAcGFyYW0gY29udGV4dEV4cHJlc3Npb24gVGhlIGV4cHJlc3Npb24gZm9yIHRoZSBjb250ZXh0IHZhcmlhYmxlIHVzZWQgdG8gY3JlYXRlIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0gdmFsdWUgVGhlIG9yaWdpbmFsIGV4cHJlc3Npb24gd2Ugd2lsbCBiZSByZXNvbHZpbmcgYW4gYXJndW1lbnRzIGxpc3QgZnJvbS5cbiAgICovXG4gIHByaXZhdGUgZ2V0VXBkYXRlSW5zdHJ1Y3Rpb25Bcmd1bWVudHMoY29udGV4dEV4cHJlc3Npb246IG8uRXhwcmVzc2lvbiwgdmFsdWU6IEFTVCk6XG4gICAgICBvLkV4cHJlc3Npb25bXSB7XG4gICAgY29uc3Qge2FyZ3MsIHN0bXRzfSA9XG4gICAgICAgIGNvbnZlcnRVcGRhdGVBcmd1bWVudHModGhpcywgY29udGV4dEV4cHJlc3Npb24sIHZhbHVlLCB0aGlzLmJpbmRpbmdDb250ZXh0KCkpO1xuICAgIHRoaXMuX3RlbXBWYXJpYWJsZXMucHVzaCguLi5zdG10cyk7XG4gICAgcmV0dXJuIGFyZ3M7XG4gIH1cblxuICBwcml2YXRlIG1hdGNoRGlyZWN0aXZlcyh0YWdOYW1lOiBzdHJpbmcsIGVsT3JUcGw6IHQuRWxlbWVudHx0LlRlbXBsYXRlKSB7XG4gICAgaWYgKHRoaXMuZGlyZWN0aXZlTWF0Y2hlcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSBjcmVhdGVDc3NTZWxlY3Rvcih0YWdOYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKGVsT3JUcGwpKTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlTWF0Y2hlci5tYXRjaChcbiAgICAgICAgICBzZWxlY3RvciwgKGNzc1NlbGVjdG9yLCBzdGF0aWNUeXBlKSA9PiB7IHRoaXMuZGlyZWN0aXZlcy5hZGQoc3RhdGljVHlwZSk7IH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhbGwgYXR0cmlidXRlIGV4cHJlc3Npb24gdmFsdWVzIGZvciB0aGUgYFRBdHRyaWJ1dGVzYCBhcnJheS5cbiAgICpcbiAgICogVGhlIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBwcm9wZXJseSBjb25zdHJ1Y3QgYW4gYXR0cmlidXRlcyBhcnJheSB0aGF0XG4gICAqIGlzIHBhc3NlZCBpbnRvIHRoZSBgZWxlbWVudFN0YXJ0YCAob3IganVzdCBgZWxlbWVudGApIGZ1bmN0aW9ucy4gQmVjYXVzZSB0aGVyZVxuICAgKiBhcmUgbWFueSBkaWZmZXJlbnQgdHlwZXMgb2YgYXR0cmlidXRlcywgdGhlIGFycmF5IG5lZWRzIHRvIGJlIGNvbnN0cnVjdGVkIGluIGFcbiAgICogc3BlY2lhbCB3YXkgc28gdGhhdCBgZWxlbWVudFN0YXJ0YCBjYW4gcHJvcGVybHkgZXZhbHVhdGUgdGhlbS5cbiAgICpcbiAgICogVGhlIGZvcm1hdCBsb29rcyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYFxuICAgKiBhdHRycyA9IFtwcm9wLCB2YWx1ZSwgcHJvcDIsIHZhbHVlMixcbiAgICogICBDTEFTU0VTLCBjbGFzczEsIGNsYXNzMixcbiAgICogICBTVFlMRVMsIHN0eWxlMSwgdmFsdWUxLCBzdHlsZTIsIHZhbHVlMixcbiAgICogICBCSU5ESU5HUywgbmFtZTEsIG5hbWUyLCBuYW1lMyxcbiAgICogICBURU1QTEFURSwgbmFtZTQsIG5hbWU1LCBuYW1lNixcbiAgICogICBJMThOLCBuYW1lNywgbmFtZTgsIC4uLl1cbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCB0aGlzIGZ1bmN0aW9uIHdpbGwgZnVsbHkgaWdub3JlIGFsbCBzeW50aGV0aWMgKEBmb28pIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICogYmVjYXVzZSB0aG9zZSB2YWx1ZXMgYXJlIGludGVuZGVkIHRvIGFsd2F5cyBiZSBnZW5lcmF0ZWQgYXMgcHJvcGVydHkgaW5zdHJ1Y3Rpb25zLlxuICAgKi9cbiAgcHJpdmF0ZSBwcmVwYXJlTm9uUmVuZGVyQXR0cnMoXG4gICAgICBpbnB1dHM6IHQuQm91bmRBdHRyaWJ1dGVbXSwgb3V0cHV0czogdC5Cb3VuZEV2ZW50W10sIHN0eWxlcz86IFN0eWxpbmdCdWlsZGVyLFxuICAgICAgdGVtcGxhdGVBdHRyczogKHQuQm91bmRBdHRyaWJ1dGV8dC5UZXh0QXR0cmlidXRlKVtdID0gW10sXG4gICAgICBpMThuQXR0cnM6ICh0LkJvdW5kQXR0cmlidXRlfHQuVGV4dEF0dHJpYnV0ZSlbXSA9IFtdKTogby5FeHByZXNzaW9uW10ge1xuICAgIGNvbnN0IGFscmVhZHlTZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgYXR0ckV4cHJzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuXG4gICAgZnVuY3Rpb24gYWRkQXR0ckV4cHIoa2V5OiBzdHJpbmcgfCBudW1iZXIsIHZhbHVlPzogby5FeHByZXNzaW9uKTogdm9pZCB7XG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCFhbHJlYWR5U2Vlbi5oYXMoa2V5KSkge1xuICAgICAgICAgIGF0dHJFeHBycy5wdXNoKC4uLmdldEF0dHJpYnV0ZU5hbWVMaXRlcmFscyhrZXkpKTtcbiAgICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIGF0dHJFeHBycy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICBhbHJlYWR5U2Vlbi5hZGQoa2V5KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXR0ckV4cHJzLnB1c2goby5saXRlcmFsKGtleSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGl0J3MgaW1wb3J0YW50IHRoYXQgdGhpcyBvY2N1cnMgYmVmb3JlIEJJTkRJTkdTIGFuZCBURU1QTEFURSBiZWNhdXNlIG9uY2UgYGVsZW1lbnRTdGFydGBcbiAgICAvLyBjb21lcyBhY3Jvc3MgdGhlIEJJTkRJTkdTIG9yIFRFTVBMQVRFIG1hcmtlcnMgdGhlbiBpdCB3aWxsIGNvbnRpbnVlIHJlYWRpbmcgZWFjaCB2YWx1ZSBhc1xuICAgIC8vIGFzIHNpbmdsZSBwcm9wZXJ0eSB2YWx1ZSBjZWxsIGJ5IGNlbGwuXG4gICAgaWYgKHN0eWxlcykge1xuICAgICAgc3R5bGVzLnBvcHVsYXRlSW5pdGlhbFN0eWxpbmdBdHRycyhhdHRyRXhwcnMpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dHMubGVuZ3RoIHx8IG91dHB1dHMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBhdHRyc1N0YXJ0SW5kZXggPSBhdHRyRXhwcnMubGVuZ3RoO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbnB1dCA9IGlucHV0c1tpXTtcbiAgICAgICAgaWYgKGlucHV0LnR5cGUgIT09IEJpbmRpbmdUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAgIGFkZEF0dHJFeHByKGlucHV0Lm5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBvdXRwdXRzW2ldO1xuICAgICAgICBpZiAob3V0cHV0LnR5cGUgIT09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgICAgICBhZGRBdHRyRXhwcihvdXRwdXQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gdGhpcyBpcyBhIGNoZWFwIHdheSBvZiBhZGRpbmcgdGhlIG1hcmtlciBvbmx5IGFmdGVyIGFsbCB0aGUgaW5wdXQvb3V0cHV0XG4gICAgICAvLyB2YWx1ZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIChieSBub3QgaW5jbHVkaW5nIHRoZSBhbmltYXRpb24gb25lcykgYW5kIGFkZGVkXG4gICAgICAvLyB0byB0aGUgZXhwcmVzc2lvbnMuIFRoZSBtYXJrZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaXQgdGVsbHMgdGhlIHJ1bnRpbWVcbiAgICAgIC8vIGNvZGUgdGhhdCB0aGlzIGlzIHdoZXJlIGF0dHJpYnV0ZXMgd2l0aG91dCB2YWx1ZXMgc3RhcnQuLi5cbiAgICAgIGlmIChhdHRyRXhwcnMubGVuZ3RoKSB7XG4gICAgICAgIGF0dHJFeHBycy5zcGxpY2UoYXR0cnNTdGFydEluZGV4LCAwLCBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuQmluZGluZ3MpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGVtcGxhdGVBdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5UZW1wbGF0ZSkpO1xuICAgICAgdGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gYWRkQXR0ckV4cHIoYXR0ci5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKGkxOG5BdHRycy5sZW5ndGgpIHtcbiAgICAgIGF0dHJFeHBycy5wdXNoKG8ubGl0ZXJhbChjb3JlLkF0dHJpYnV0ZU1hcmtlci5JMThuKSk7XG4gICAgICBpMThuQXR0cnMuZm9yRWFjaChhdHRyID0+IGFkZEF0dHJFeHByKGF0dHIubmFtZSkpO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyRXhwcnM7XG4gIH1cblxuICBwcml2YXRlIHRvQXR0cnNQYXJhbShhdHRyc0V4cHJzOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIGF0dHJzRXhwcnMubGVuZ3RoID4gMCA/XG4gICAgICAgIHRoaXMuY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChvLmxpdGVyYWxBcnIoYXR0cnNFeHBycyksIHRydWUpIDpcbiAgICAgICAgby5UWVBFRF9OVUxMX0VYUFI7XG4gIH1cblxuICBwcml2YXRlIHByZXBhcmVSZWZzUGFyYW1ldGVyKHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pOiBvLkV4cHJlc3Npb24ge1xuICAgIGlmICghcmVmZXJlbmNlcyB8fCByZWZlcmVuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG8uVFlQRURfTlVMTF9FWFBSO1xuICAgIH1cblxuICAgIGNvbnN0IHJlZnNQYXJhbSA9IGZsYXR0ZW4ocmVmZXJlbmNlcy5tYXAocmVmZXJlbmNlID0+IHtcbiAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLmFsbG9jYXRlRGF0YVNsb3QoKTtcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSB1cGRhdGUgdGVtcG9yYXJ5LlxuICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gdGhpcy5fYmluZGluZ1Njb3BlLmZyZXNoUmVmZXJlbmNlTmFtZSgpO1xuICAgICAgY29uc3QgcmV0cmlldmFsTGV2ZWwgPSB0aGlzLmxldmVsO1xuICAgICAgY29uc3QgbGhzID0gby52YXJpYWJsZSh2YXJpYWJsZU5hbWUpO1xuICAgICAgdGhpcy5fYmluZGluZ1Njb3BlLnNldChcbiAgICAgICAgICByZXRyaWV2YWxMZXZlbCwgcmVmZXJlbmNlLm5hbWUsIGxocyxcbiAgICAgICAgICBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsIChzY29wZTogQmluZGluZ1Njb3BlLCByZWxhdGl2ZUxldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIC8vIGUuZy4gbmV4dENvbnRleHQoMik7XG4gICAgICAgICAgICBjb25zdCBuZXh0Q29udGV4dFN0bXQgPVxuICAgICAgICAgICAgICAgIHJlbGF0aXZlTGV2ZWwgPiAwID8gW2dlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpLnRvU3RtdCgpXSA6IFtdO1xuXG4gICAgICAgICAgICAvLyBlLmcuIGNvbnN0ICRmb28kID0gcmVmZXJlbmNlKDEpO1xuICAgICAgICAgICAgY29uc3QgcmVmRXhwciA9IGxocy5zZXQoby5pbXBvcnRFeHByKFIzLnJlZmVyZW5jZSkuY2FsbEZuKFtvLmxpdGVyYWwoc2xvdCldKSk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dENvbnRleHRTdG10LmNvbmNhdChyZWZFeHByLnRvQ29uc3REZWNsKCkpO1xuICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgcmV0dXJuIFtyZWZlcmVuY2UubmFtZSwgcmVmZXJlbmNlLnZhbHVlXTtcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGFzTGl0ZXJhbChyZWZzUGFyYW0pLCB0cnVlKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlcGFyZUxpc3RlbmVyUGFyYW1ldGVyKHRhZ05hbWU6IHN0cmluZywgb3V0cHV0QXN0OiB0LkJvdW5kRXZlbnQsIGluZGV4OiBudW1iZXIpOlxuICAgICAgKCkgPT4gby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBldmVudE5hbWU6IHN0cmluZyA9IG91dHB1dEFzdC5uYW1lO1xuICAgICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IG91dHB1dEFzdC50eXBlID09PSBQYXJzZWRFdmVudFR5cGUuQW5pbWF0aW9uID9cbiAgICAgICAgICAvLyBzeW50aGV0aWMgQGxpc3RlbmVyLmZvbyB2YWx1ZXMgYXJlIHRyZWF0ZWQgdGhlIGV4YWN0IHNhbWUgYXMgYXJlIHN0YW5kYXJkIGxpc3RlbmVyc1xuICAgICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShldmVudE5hbWUsIG91dHB1dEFzdC5waGFzZSAhKSA6XG4gICAgICAgICAgc2FuaXRpemVJZGVudGlmaWVyKGV2ZW50TmFtZSk7XG4gICAgICBjb25zdCBoYW5kbGVyTmFtZSA9IGAke3RoaXMudGVtcGxhdGVOYW1lfV8ke3RhZ05hbWV9XyR7YmluZGluZ0ZuTmFtZX1fJHtpbmRleH1fbGlzdGVuZXJgO1xuICAgICAgY29uc3Qgc2NvcGUgPSB0aGlzLl9iaW5kaW5nU2NvcGUubmVzdGVkU2NvcGUodGhpcy5fYmluZGluZ1Njb3BlLmJpbmRpbmdMZXZlbCk7XG4gICAgICBjb25zdCBjb250ZXh0ID0gby52YXJpYWJsZShDT05URVhUX05BTUUpO1xuICAgICAgcmV0dXJuIHByZXBhcmVFdmVudExpc3RlbmVyUGFyYW1ldGVycyhvdXRwdXRBc3QsIGNvbnRleHQsIGhhbmRsZXJOYW1lLCBzY29wZSk7XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmFsdWVDb252ZXJ0ZXIgZXh0ZW5kcyBBc3RNZW1vcnlFZmZpY2llbnRUcmFuc2Zvcm1lciB7XG4gIHByaXZhdGUgX3BpcGVCaW5kRXhwcnM6IEZ1bmN0aW9uQ2FsbFtdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBwcml2YXRlIGFsbG9jYXRlU2xvdDogKCkgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBhbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzOiAobnVtU2xvdHM6IG51bWJlcikgPT4gbnVtYmVyLFxuICAgICAgcHJpdmF0ZSBkZWZpbmVQaXBlOlxuICAgICAgICAgIChuYW1lOiBzdHJpbmcsIGxvY2FsTmFtZTogc3RyaW5nLCBzbG90OiBudW1iZXIsIHZhbHVlOiBvLkV4cHJlc3Npb24pID0+IHZvaWQpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgLy8gQXN0TWVtb3J5RWZmaWNpZW50VHJhbnNmb3JtZXJcbiAgdmlzaXRQaXBlKHBpcGU6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBBU1Qge1xuICAgIC8vIEFsbG9jYXRlIGEgc2xvdCB0byBjcmVhdGUgdGhlIHBpcGVcbiAgICBjb25zdCBzbG90ID0gdGhpcy5hbGxvY2F0ZVNsb3QoKTtcbiAgICBjb25zdCBzbG90UHNldWRvTG9jYWwgPSBgUElQRToke3Nsb3R9YDtcbiAgICAvLyBBbGxvY2F0ZSBvbmUgc2xvdCBmb3IgdGhlIHJlc3VsdCBwbHVzIG9uZSBzbG90IHBlciBwaXBlIGFyZ3VtZW50XG4gICAgY29uc3QgcHVyZUZ1bmN0aW9uU2xvdCA9IHRoaXMuYWxsb2NhdGVQdXJlRnVuY3Rpb25TbG90cygyICsgcGlwZS5hcmdzLmxlbmd0aCk7XG4gICAgY29uc3QgdGFyZ2V0ID0gbmV3IFByb3BlcnR5UmVhZChwaXBlLnNwYW4sIG5ldyBJbXBsaWNpdFJlY2VpdmVyKHBpcGUuc3BhbiksIHNsb3RQc2V1ZG9Mb2NhbCk7XG4gICAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHBpcGVCaW5kaW5nQ2FsbEluZm8ocGlwZS5hcmdzKTtcbiAgICB0aGlzLmRlZmluZVBpcGUocGlwZS5uYW1lLCBzbG90UHNldWRvTG9jYWwsIHNsb3QsIG8uaW1wb3J0RXhwcihpZGVudGlmaWVyKSk7XG4gICAgY29uc3QgYXJnczogQVNUW10gPSBbcGlwZS5leHAsIC4uLnBpcGUuYXJnc107XG4gICAgY29uc3QgY29udmVydGVkQXJnczogQVNUW10gPVxuICAgICAgICBpc1Zhckxlbmd0aCA/IHRoaXMudmlzaXRBbGwoW25ldyBMaXRlcmFsQXJyYXkocGlwZS5zcGFuLCBhcmdzKV0pIDogdGhpcy52aXNpdEFsbChhcmdzKTtcblxuICAgIGNvbnN0IHBpcGVCaW5kRXhwciA9IG5ldyBGdW5jdGlvbkNhbGwocGlwZS5zcGFuLCB0YXJnZXQsIFtcbiAgICAgIG5ldyBMaXRlcmFsUHJpbWl0aXZlKHBpcGUuc3Bhbiwgc2xvdCksXG4gICAgICBuZXcgTGl0ZXJhbFByaW1pdGl2ZShwaXBlLnNwYW4sIHB1cmVGdW5jdGlvblNsb3QpLFxuICAgICAgLi4uY29udmVydGVkQXJncyxcbiAgICBdKTtcbiAgICB0aGlzLl9waXBlQmluZEV4cHJzLnB1c2gocGlwZUJpbmRFeHByKTtcbiAgICByZXR1cm4gcGlwZUJpbmRFeHByO1xuICB9XG5cbiAgdXBkYXRlUGlwZVNsb3RPZmZzZXRzKGJpbmRpbmdTbG90czogbnVtYmVyKSB7XG4gICAgdGhpcy5fcGlwZUJpbmRFeHBycy5mb3JFYWNoKChwaXBlOiBGdW5jdGlvbkNhbGwpID0+IHtcbiAgICAgIC8vIHVwZGF0ZSB0aGUgc2xvdCBvZmZzZXQgYXJnIChpbmRleCAxKSB0byBhY2NvdW50IGZvciBiaW5kaW5nIHNsb3RzXG4gICAgICBjb25zdCBzbG90T2Zmc2V0ID0gcGlwZS5hcmdzWzFdIGFzIExpdGVyYWxQcmltaXRpdmU7XG4gICAgICAoc2xvdE9mZnNldC52YWx1ZSBhcyBudW1iZXIpICs9IGJpbmRpbmdTbG90cztcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5KGFycmF5OiBMaXRlcmFsQXJyYXksIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKGFycmF5LnNwYW4sIHRoaXMudmlzaXRBbGwoYXJyYXkuZXhwcmVzc2lvbnMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyB0cmFuc2Zvcm0gaXQgaW50b1xuICAgICAgLy8gY2FsbHMgdG8gbGl0ZXJhbCBmYWN0b3JpZXMgdGhhdCBjb21wb3NlIHRoZSBsaXRlcmFsIGFuZCB3aWxsIGNhY2hlIGludGVybWVkaWF0ZVxuICAgICAgLy8gdmFsdWVzLiBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIGFuIGxpdGVyYWwgYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdmFsdWVzLlxuICAgICAgY29uc3QgbGl0ZXJhbCA9IG8ubGl0ZXJhbEFycih2YWx1ZXMpO1xuICAgICAgcmV0dXJuIHZhbHVlcy5ldmVyeShhID0+IGEuaXNDb25zdGFudCgpKSA/XG4gICAgICAgICAgdGhpcy5jb25zdGFudFBvb2wuZ2V0Q29uc3RMaXRlcmFsKGxpdGVyYWwsIHRydWUpIDpcbiAgICAgICAgICBnZXRMaXRlcmFsRmFjdG9yeSh0aGlzLmNvbnN0YW50UG9vbCwgbGl0ZXJhbCwgdGhpcy5hbGxvY2F0ZVB1cmVGdW5jdGlvblNsb3RzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcChtYXA6IExpdGVyYWxNYXAsIGNvbnRleHQ6IGFueSk6IEFTVCB7XG4gICAgcmV0dXJuIG5ldyBCdWlsdGluRnVuY3Rpb25DYWxsKG1hcC5zcGFuLCB0aGlzLnZpc2l0QWxsKG1hcC52YWx1ZXMpLCB2YWx1ZXMgPT4ge1xuICAgICAgLy8gSWYgdGhlIGxpdGVyYWwgaGFzIGNhbGN1bGF0ZWQgKG5vbi1saXRlcmFsKSBlbGVtZW50cyAgdHJhbnNmb3JtIGl0IGludG9cbiAgICAgIC8vIGNhbGxzIHRvIGxpdGVyYWwgZmFjdG9yaWVzIHRoYXQgY29tcG9zZSB0aGUgbGl0ZXJhbCBhbmQgd2lsbCBjYWNoZSBpbnRlcm1lZGlhdGVcbiAgICAgIC8vIHZhbHVlcy4gT3RoZXJ3aXNlLCBqdXN0IHJldHVybiBhbiBsaXRlcmFsIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHZhbHVlcy5cbiAgICAgIGNvbnN0IGxpdGVyYWwgPSBvLmxpdGVyYWxNYXAodmFsdWVzLm1hcChcbiAgICAgICAgICAodmFsdWUsIGluZGV4KSA9PiAoe2tleTogbWFwLmtleXNbaW5kZXhdLmtleSwgdmFsdWUsIHF1b3RlZDogbWFwLmtleXNbaW5kZXhdLnF1b3RlZH0pKSk7XG4gICAgICByZXR1cm4gdmFsdWVzLmV2ZXJ5KGEgPT4gYS5pc0NvbnN0YW50KCkpID9cbiAgICAgICAgICB0aGlzLmNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwobGl0ZXJhbCwgdHJ1ZSkgOlxuICAgICAgICAgIGdldExpdGVyYWxGYWN0b3J5KHRoaXMuY29uc3RhbnRQb29sLCBsaXRlcmFsLCB0aGlzLmFsbG9jYXRlUHVyZUZ1bmN0aW9uU2xvdHMpO1xuICAgIH0pO1xuICB9XG59XG5cbi8vIFBpcGVzIGFsd2F5cyBoYXZlIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIsIHRoZSB2YWx1ZSB0aGV5IG9wZXJhdGUgb25cbmNvbnN0IHBpcGVCaW5kaW5nSWRlbnRpZmllcnMgPSBbUjMucGlwZUJpbmQxLCBSMy5waXBlQmluZDIsIFIzLnBpcGVCaW5kMywgUjMucGlwZUJpbmQ0XTtcblxuZnVuY3Rpb24gcGlwZUJpbmRpbmdDYWxsSW5mbyhhcmdzOiBvLkV4cHJlc3Npb25bXSkge1xuICBjb25zdCBpZGVudGlmaWVyID0gcGlwZUJpbmRpbmdJZGVudGlmaWVyc1thcmdzLmxlbmd0aF07XG4gIHJldHVybiB7XG4gICAgaWRlbnRpZmllcjogaWRlbnRpZmllciB8fCBSMy5waXBlQmluZFYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5jb25zdCBwdXJlRnVuY3Rpb25JZGVudGlmaWVycyA9IFtcbiAgUjMucHVyZUZ1bmN0aW9uMCwgUjMucHVyZUZ1bmN0aW9uMSwgUjMucHVyZUZ1bmN0aW9uMiwgUjMucHVyZUZ1bmN0aW9uMywgUjMucHVyZUZ1bmN0aW9uNCxcbiAgUjMucHVyZUZ1bmN0aW9uNSwgUjMucHVyZUZ1bmN0aW9uNiwgUjMucHVyZUZ1bmN0aW9uNywgUjMucHVyZUZ1bmN0aW9uOFxuXTtcblxuZnVuY3Rpb24gcHVyZUZ1bmN0aW9uQ2FsbEluZm8oYXJnczogby5FeHByZXNzaW9uW10pIHtcbiAgY29uc3QgaWRlbnRpZmllciA9IHB1cmVGdW5jdGlvbklkZW50aWZpZXJzW2FyZ3MubGVuZ3RoXTtcbiAgcmV0dXJuIHtcbiAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyIHx8IFIzLnB1cmVGdW5jdGlvblYsXG4gICAgaXNWYXJMZW5ndGg6ICFpZGVudGlmaWVyLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnN0cnVjdGlvbihcbiAgICBzcGFuOiBQYXJzZVNvdXJjZVNwYW4gfCBudWxsLCByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UsXG4gICAgcGFyYW1zOiBvLkV4cHJlc3Npb25bXSk6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIocmVmZXJlbmNlLCBudWxsLCBzcGFuKS5jYWxsRm4ocGFyYW1zLCBzcGFuKTtcbn1cblxuLy8gZS5nLiB4KDIpO1xuZnVuY3Rpb24gZ2VuZXJhdGVOZXh0Q29udGV4dEV4cHIocmVsYXRpdmVMZXZlbERpZmY6IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIHJldHVybiBvLmltcG9ydEV4cHIoUjMubmV4dENvbnRleHQpXG4gICAgICAuY2FsbEZuKHJlbGF0aXZlTGV2ZWxEaWZmID4gMSA/IFtvLmxpdGVyYWwocmVsYXRpdmVMZXZlbERpZmYpXSA6IFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGl0ZXJhbEZhY3RvcnkoXG4gICAgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsIGxpdGVyYWw6IG8uTGl0ZXJhbEFycmF5RXhwciB8IG8uTGl0ZXJhbE1hcEV4cHIsXG4gICAgYWxsb2NhdGVTbG90czogKG51bVNsb3RzOiBudW1iZXIpID0+IG51bWJlcik6IG8uRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHtsaXRlcmFsRmFjdG9yeSwgbGl0ZXJhbEZhY3RvcnlBcmd1bWVudHN9ID0gY29uc3RhbnRQb29sLmdldExpdGVyYWxGYWN0b3J5KGxpdGVyYWwpO1xuICAvLyBBbGxvY2F0ZSAxIHNsb3QgZm9yIHRoZSByZXN1bHQgcGx1cyAxIHBlciBhcmd1bWVudFxuICBjb25zdCBzdGFydFNsb3QgPSBhbGxvY2F0ZVNsb3RzKDEgKyBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGgpO1xuICBsaXRlcmFsRmFjdG9yeUFyZ3VtZW50cy5sZW5ndGggPiAwIHx8IGVycm9yKGBFeHBlY3RlZCBhcmd1bWVudHMgdG8gYSBsaXRlcmFsIGZhY3RvcnkgZnVuY3Rpb25gKTtcbiAgY29uc3Qge2lkZW50aWZpZXIsIGlzVmFyTGVuZ3RofSA9IHB1cmVGdW5jdGlvbkNhbGxJbmZvKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcblxuICAvLyBMaXRlcmFsIGZhY3RvcmllcyBhcmUgcHVyZSBmdW5jdGlvbnMgdGhhdCBvbmx5IG5lZWQgdG8gYmUgcmUtaW52b2tlZCB3aGVuIHRoZSBwYXJhbWV0ZXJzXG4gIC8vIGNoYW5nZS5cbiAgY29uc3QgYXJncyA9IFtcbiAgICBvLmxpdGVyYWwoc3RhcnRTbG90KSxcbiAgICBsaXRlcmFsRmFjdG9yeSxcbiAgXTtcblxuICBpZiAoaXNWYXJMZW5ndGgpIHtcbiAgICBhcmdzLnB1c2goby5saXRlcmFsQXJyKGxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXJncy5wdXNoKC4uLmxpdGVyYWxGYWN0b3J5QXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBvLmltcG9ydEV4cHIoaWRlbnRpZmllcikuY2FsbEZuKGFyZ3MpO1xufVxuXG4vKipcbiAqIEdldHMgYW4gYXJyYXkgb2YgbGl0ZXJhbHMgdGhhdCBjYW4gYmUgYWRkZWQgdG8gYW4gZXhwcmVzc2lvblxuICogdG8gcmVwcmVzZW50IHRoZSBuYW1lIGFuZCBuYW1lc3BhY2Ugb2YgYW4gYXR0cmlidXRlLiBFLmcuXG4gKiBgOnhsaW5rOmhyZWZgIHR1cm5zIGludG8gYFtBdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJLCAneGxpbmsnLCAnaHJlZiddYC5cbiAqXG4gKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBhdHRyaWJ1dGUsIGluY2x1ZGluZyB0aGUgbmFtZXNwYWNlLlxuICovXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVOYW1lTGl0ZXJhbHMobmFtZTogc3RyaW5nKTogby5MaXRlcmFsRXhwcltdIHtcbiAgY29uc3QgW2F0dHJpYnV0ZU5hbWVzcGFjZSwgYXR0cmlidXRlTmFtZV0gPSBzcGxpdE5zTmFtZShuYW1lKTtcbiAgY29uc3QgbmFtZUxpdGVyYWwgPSBvLmxpdGVyYWwoYXR0cmlidXRlTmFtZSk7XG5cbiAgaWYgKGF0dHJpYnV0ZU5hbWVzcGFjZSkge1xuICAgIHJldHVybiBbXG4gICAgICBvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuTmFtZXNwYWNlVVJJKSwgby5saXRlcmFsKGF0dHJpYnV0ZU5hbWVzcGFjZSksIG5hbWVMaXRlcmFsXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBbbmFtZUxpdGVyYWxdO1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHdoaWNoIGlzIGV4ZWN1dGVkIHdoZW5ldmVyIGEgdmFyaWFibGUgaXMgcmVmZXJlbmNlZCBmb3IgdGhlIGZpcnN0IHRpbWUgaW4gYSBnaXZlblxuICogc2NvcGUuXG4gKlxuICogSXQgaXMgZXhwZWN0ZWQgdGhhdCB0aGUgZnVuY3Rpb24gY3JlYXRlcyB0aGUgYGNvbnN0IGxvY2FsTmFtZSA9IGV4cHJlc3Npb25gOyBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCB0eXBlIERlY2xhcmVMb2NhbFZhckNhbGxiYWNrID0gKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4gby5TdGF0ZW1lbnRbXTtcblxuLyoqIFRoZSBwcmVmaXggdXNlZCB0byBnZXQgYSBzaGFyZWQgY29udGV4dCBpbiBCaW5kaW5nU2NvcGUncyBtYXAuICovXG5jb25zdCBTSEFSRURfQ09OVEVYVF9LRVkgPSAnJCRzaGFyZWRfY3R4JCQnO1xuXG4vKipcbiAqIFRoaXMgaXMgdXNlZCB3aGVuIG9uZSByZWZlcnMgdG8gdmFyaWFibGUgc3VjaCBhczogJ2xldCBhYmMgPSBuZXh0Q29udGV4dCgyKS4kaW1wbGljaXRgLlxuICogLSBrZXkgdG8gdGhlIG1hcCBpcyB0aGUgc3RyaW5nIGxpdGVyYWwgYFwiYWJjXCJgLlxuICogLSB2YWx1ZSBgcmV0cmlldmFsTGV2ZWxgIGlzIHRoZSBsZXZlbCBmcm9tIHdoaWNoIHRoaXMgdmFsdWUgY2FuIGJlIHJldHJpZXZlZCwgd2hpY2ggaXMgMiBsZXZlbHNcbiAqIHVwIGluIGV4YW1wbGUuXG4gKiAtIHZhbHVlIGBsaHNgIGlzIHRoZSBsZWZ0IGhhbmQgc2lkZSB3aGljaCBpcyBhbiBBU1QgcmVwcmVzZW50aW5nIGBhYmNgLlxuICogLSB2YWx1ZSBgZGVjbGFyZUxvY2FsQ2FsbGJhY2tgIGlzIGEgY2FsbGJhY2sgdGhhdCBpcyBpbnZva2VkIHdoZW4gZGVjbGFyaW5nIHRoZSBsb2NhbC5cbiAqIC0gdmFsdWUgYGRlY2xhcmVgIGlzIHRydWUgaWYgdGhpcyB2YWx1ZSBuZWVkcyB0byBiZSBkZWNsYXJlZC5cbiAqIC0gdmFsdWUgYGxvY2FsUmVmYCBpcyB0cnVlIGlmIHdlIGFyZSBzdG9yaW5nIGEgbG9jYWwgcmVmZXJlbmNlXG4gKiAtIHZhbHVlIGBwcmlvcml0eWAgZGljdGF0ZXMgdGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXIgZGVjbGFyYXRpb24gY29tcGFyZWRcbiAqIHRvIG90aGVyIHZhciBkZWNsYXJhdGlvbnMgb24gdGhlIHNhbWUgcmV0cmlldmFsIGxldmVsLiBGb3IgZXhhbXBsZSwgaWYgdGhlcmUgaXMgYVxuICogY29udGV4dCB2YXJpYWJsZSBhbmQgYSBsb2NhbCByZWYgYWNjZXNzaW5nIHRoZSBzYW1lIHBhcmVudCB2aWV3LCB0aGUgY29udGV4dCB2YXJcbiAqIGRlY2xhcmF0aW9uIHNob3VsZCBhbHdheXMgY29tZSBiZWZvcmUgdGhlIGxvY2FsIHJlZiBkZWNsYXJhdGlvbi5cbiAqL1xudHlwZSBCaW5kaW5nRGF0YSA9IHtcbiAgcmV0cmlldmFsTGV2ZWw6IG51bWJlcjsgbGhzOiBvLlJlYWRWYXJFeHByOyBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrO1xuICBkZWNsYXJlOiBib29sZWFuO1xuICBwcmlvcml0eTogbnVtYmVyO1xuICBsb2NhbFJlZjogYm9vbGVhbjtcbn07XG5cbi8qKlxuICogVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgYSBsb2NhbCB2YXJpYWJsZSBkZWNsYXJhdGlvbi4gSGlnaGVyIG51bWJlcnNcbiAqIG1lYW4gdGhlIGRlY2xhcmF0aW9uIHdpbGwgYXBwZWFyIGZpcnN0IGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuY29uc3QgZW51bSBEZWNsYXJhdGlvblByaW9yaXR5IHsgREVGQVVMVCA9IDAsIENPTlRFWFQgPSAxLCBTSEFSRURfQ09OVEVYVCA9IDIgfVxuXG5leHBvcnQgY2xhc3MgQmluZGluZ1Njb3BlIGltcGxlbWVudHMgTG9jYWxSZXNvbHZlciB7XG4gIC8qKiBLZWVwcyBhIG1hcCBmcm9tIGxvY2FsIHZhcmlhYmxlcyB0byB0aGVpciBCaW5kaW5nRGF0YS4gKi9cbiAgcHJpdmF0ZSBtYXAgPSBuZXcgTWFwPHN0cmluZywgQmluZGluZ0RhdGE+KCk7XG4gIHByaXZhdGUgcmVmZXJlbmNlTmFtZUluZGV4ID0gMDtcbiAgcHJpdmF0ZSByZXN0b3JlVmlld1ZhcmlhYmxlOiBvLlJlYWRWYXJFeHByfG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0YXRpYyBfUk9PVF9TQ09QRTogQmluZGluZ1Njb3BlO1xuXG4gIHN0YXRpYyBnZXQgUk9PVF9TQ09QRSgpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICghQmluZGluZ1Njb3BlLl9ST09UX1NDT1BFKSB7XG4gICAgICBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEUgPSBuZXcgQmluZGluZ1Njb3BlKCkuc2V0KDAsICckZXZlbnQnLCBvLnZhcmlhYmxlKCckZXZlbnQnKSk7XG4gICAgfVxuICAgIHJldHVybiBCaW5kaW5nU2NvcGUuX1JPT1RfU0NPUEU7XG4gIH1cblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHB1YmxpYyBiaW5kaW5nTGV2ZWw6IG51bWJlciA9IDAsIHByaXZhdGUgcGFyZW50OiBCaW5kaW5nU2NvcGV8bnVsbCA9IG51bGwpIHt9XG5cbiAgZ2V0KG5hbWU6IHN0cmluZyk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgICBsZXQgY3VycmVudDogQmluZGluZ1Njb3BlfG51bGwgPSB0aGlzO1xuICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICBsZXQgdmFsdWUgPSBjdXJyZW50Lm1hcC5nZXQobmFtZSk7XG4gICAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBpZiAoY3VycmVudCAhPT0gdGhpcykge1xuICAgICAgICAgIC8vIG1ha2UgYSBsb2NhbCBjb3B5IGFuZCByZXNldCB0aGUgYGRlY2xhcmVgIHN0YXRlXG4gICAgICAgICAgdmFsdWUgPSB7XG4gICAgICAgICAgICByZXRyaWV2YWxMZXZlbDogdmFsdWUucmV0cmlldmFsTGV2ZWwsXG4gICAgICAgICAgICBsaHM6IHZhbHVlLmxocyxcbiAgICAgICAgICAgIGRlY2xhcmVMb2NhbENhbGxiYWNrOiB2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayxcbiAgICAgICAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgICAgICAgcHJpb3JpdHk6IHZhbHVlLnByaW9yaXR5LFxuICAgICAgICAgICAgbG9jYWxSZWY6IHZhbHVlLmxvY2FsUmVmXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIENhY2hlIHRoZSB2YWx1ZSBsb2NhbGx5LlxuICAgICAgICAgIHRoaXMubWFwLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgICAgICAgLy8gUG9zc2libHkgZ2VuZXJhdGUgYSBzaGFyZWQgY29udGV4dCB2YXJcbiAgICAgICAgICB0aGlzLm1heWJlR2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHZhbHVlKTtcbiAgICAgICAgICB0aGlzLm1heWJlUmVzdG9yZVZpZXcodmFsdWUucmV0cmlldmFsTGV2ZWwsIHZhbHVlLmxvY2FsUmVmKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS5kZWNsYXJlTG9jYWxDYWxsYmFjayAmJiAhdmFsdWUuZGVjbGFyZSkge1xuICAgICAgICAgIHZhbHVlLmRlY2xhcmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZS5saHM7XG4gICAgICB9XG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgZ2V0IHRvIHRoaXMgcG9pbnQsIHdlIGFyZSBsb29raW5nIGZvciBhIHByb3BlcnR5IG9uIHRoZSB0b3AgbGV2ZWwgY29tcG9uZW50XG4gICAgLy8gLSBJZiBsZXZlbCA9PT0gMCwgd2UgYXJlIG9uIHRoZSB0b3AgYW5kIGRvbid0IG5lZWQgdG8gcmUtZGVjbGFyZSBgY3R4YC5cbiAgICAvLyAtIElmIGxldmVsID4gMCwgd2UgYXJlIGluIGFuIGVtYmVkZGVkIHZpZXcuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgLy8gbG9jYWwgdmFyIHdlIHVzZWQgdG8gc3RvcmUgdGhlIGNvbXBvbmVudCBjb250ZXh0LCBlLmcuIGNvbnN0ICRjb21wJCA9IHgoKTtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5nTGV2ZWwgPT09IDAgPyBudWxsIDogdGhpcy5nZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBsb2NhbCB2YXJpYWJsZSBmb3IgbGF0ZXIgcmVmZXJlbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcmV0cmlldmFsTGV2ZWwgVGhlIGxldmVsIGZyb20gd2hpY2ggdGhpcyB2YWx1ZSBjYW4gYmUgcmV0cmlldmVkXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIHZhcmlhYmxlLlxuICAgKiBAcGFyYW0gbGhzIEFTVCByZXByZXNlbnRpbmcgdGhlIGxlZnQgaGFuZCBzaWRlIG9mIHRoZSBgbGV0IGxocyA9IHJocztgLlxuICAgKiBAcGFyYW0gcHJpb3JpdHkgVGhlIHNvcnRpbmcgcHJpb3JpdHkgb2YgdGhpcyB2YXJcbiAgICogQHBhcmFtIGRlY2xhcmVMb2NhbENhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBpbnZva2Ugd2hlbiBkZWNsYXJpbmcgdGhpcyBsb2NhbCB2YXJcbiAgICogQHBhcmFtIGxvY2FsUmVmIFdoZXRoZXIgb3Igbm90IHRoaXMgaXMgYSBsb2NhbCByZWZcbiAgICovXG4gIHNldChyZXRyaWV2YWxMZXZlbDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGxoczogby5SZWFkVmFyRXhwcixcbiAgICAgIHByaW9yaXR5OiBudW1iZXIgPSBEZWNsYXJhdGlvblByaW9yaXR5LkRFRkFVTFQsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjaz86IERlY2xhcmVMb2NhbFZhckNhbGxiYWNrLCBsb2NhbFJlZj86IHRydWUpOiBCaW5kaW5nU2NvcGUge1xuICAgIGlmICh0aGlzLm1hcC5oYXMobmFtZSkpIHtcbiAgICAgIGlmIChsb2NhbFJlZikge1xuICAgICAgICAvLyBEbyBub3QgdGhyb3cgYW4gZXJyb3IgaWYgaXQncyBhIGxvY2FsIHJlZiBhbmQgZG8gbm90IHVwZGF0ZSBleGlzdGluZyB2YWx1ZSxcbiAgICAgICAgLy8gc28gdGhlIGZpcnN0IGRlZmluZWQgcmVmIGlzIGFsd2F5cyByZXR1cm5lZC5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICBlcnJvcihgVGhlIG5hbWUgJHtuYW1lfSBpcyBhbHJlYWR5IGRlZmluZWQgaW4gc2NvcGUgdG8gYmUgJHt0aGlzLm1hcC5nZXQobmFtZSl9YCk7XG4gICAgfVxuICAgIHRoaXMubWFwLnNldChuYW1lLCB7XG4gICAgICByZXRyaWV2YWxMZXZlbDogcmV0cmlldmFsTGV2ZWwsXG4gICAgICBsaHM6IGxocyxcbiAgICAgIGRlY2xhcmU6IGZhbHNlLFxuICAgICAgZGVjbGFyZUxvY2FsQ2FsbGJhY2s6IGRlY2xhcmVMb2NhbENhbGxiYWNrLFxuICAgICAgcHJpb3JpdHk6IHByaW9yaXR5LFxuICAgICAgbG9jYWxSZWY6IGxvY2FsUmVmIHx8IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiAoby5FeHByZXNzaW9ufG51bGwpIHsgcmV0dXJuIHRoaXMuZ2V0KG5hbWUpOyB9XG5cbiAgbmVzdGVkU2NvcGUobGV2ZWw6IG51bWJlcik6IEJpbmRpbmdTY29wZSB7XG4gICAgY29uc3QgbmV3U2NvcGUgPSBuZXcgQmluZGluZ1Njb3BlKGxldmVsLCB0aGlzKTtcbiAgICBpZiAobGV2ZWwgPiAwKSBuZXdTY29wZS5nZW5lcmF0ZVNoYXJlZENvbnRleHRWYXIoMCk7XG4gICAgcmV0dXJuIG5ld1Njb3BlO1xuICB9XG5cbiAgZ2V0U2hhcmVkQ29udGV4dE5hbWUocmV0cmlldmFsTGV2ZWw6IG51bWJlcik6IG8uUmVhZFZhckV4cHJ8bnVsbCB7XG4gICAgY29uc3Qgc2hhcmVkQ3R4T2JqID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIHJldHJpZXZhbExldmVsKTtcbiAgICByZXR1cm4gc2hhcmVkQ3R4T2JqICYmIHNoYXJlZEN0eE9iai5kZWNsYXJlID8gc2hhcmVkQ3R4T2JqLmxocyA6IG51bGw7XG4gIH1cblxuICBtYXliZUdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZTogQmluZGluZ0RhdGEpIHtcbiAgICBpZiAodmFsdWUucHJpb3JpdHkgPT09IERlY2xhcmF0aW9uUHJpb3JpdHkuQ09OVEVYVCAmJlxuICAgICAgICB2YWx1ZS5yZXRyaWV2YWxMZXZlbCA8IHRoaXMuYmluZGluZ0xldmVsKSB7XG4gICAgICBjb25zdCBzaGFyZWRDdHhPYmogPSB0aGlzLm1hcC5nZXQoU0hBUkVEX0NPTlRFWFRfS0VZICsgdmFsdWUucmV0cmlldmFsTGV2ZWwpO1xuICAgICAgaWYgKHNoYXJlZEN0eE9iaikge1xuICAgICAgICBzaGFyZWRDdHhPYmouZGVjbGFyZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdlbmVyYXRlU2hhcmVkQ29udGV4dFZhcih2YWx1ZS5yZXRyaWV2YWxMZXZlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVTaGFyZWRDb250ZXh0VmFyKHJldHJpZXZhbExldmVsOiBudW1iZXIpIHtcbiAgICBjb25zdCBsaHMgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSArIHRoaXMuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgIHRoaXMubWFwLnNldChTSEFSRURfQ09OVEVYVF9LRVkgKyByZXRyaWV2YWxMZXZlbCwge1xuICAgICAgcmV0cmlldmFsTGV2ZWw6IHJldHJpZXZhbExldmVsLFxuICAgICAgbGhzOiBsaHMsXG4gICAgICBkZWNsYXJlTG9jYWxDYWxsYmFjazogKHNjb3BlOiBCaW5kaW5nU2NvcGUsIHJlbGF0aXZlTGV2ZWw6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBjb25zdCBjdHhfcjAgPSBuZXh0Q29udGV4dCgyKTtcbiAgICAgICAgcmV0dXJuIFtsaHMuc2V0KGdlbmVyYXRlTmV4dENvbnRleHRFeHByKHJlbGF0aXZlTGV2ZWwpKS50b0NvbnN0RGVjbCgpXTtcbiAgICAgIH0sXG4gICAgICBkZWNsYXJlOiBmYWxzZSxcbiAgICAgIHByaW9yaXR5OiBEZWNsYXJhdGlvblByaW9yaXR5LlNIQVJFRF9DT05URVhULFxuICAgICAgbG9jYWxSZWY6IGZhbHNlXG4gICAgfSk7XG4gIH1cblxuICBnZXRDb21wb25lbnRQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbXBvbmVudFZhbHVlID0gdGhpcy5tYXAuZ2V0KFNIQVJFRF9DT05URVhUX0tFWSArIDApICE7XG4gICAgY29tcG9uZW50VmFsdWUuZGVjbGFyZSA9IHRydWU7XG4gICAgdGhpcy5tYXliZVJlc3RvcmVWaWV3KDAsIGZhbHNlKTtcbiAgICByZXR1cm4gY29tcG9uZW50VmFsdWUubGhzLnByb3AobmFtZSk7XG4gIH1cblxuICBtYXliZVJlc3RvcmVWaWV3KHJldHJpZXZhbExldmVsOiBudW1iZXIsIGxvY2FsUmVmTG9va3VwOiBib29sZWFuKSB7XG4gICAgLy8gV2Ugd2FudCB0byByZXN0b3JlIHRoZSBjdXJyZW50IHZpZXcgaW4gbGlzdGVuZXIgZm5zIGlmOlxuICAgIC8vIDEgLSB3ZSBhcmUgYWNjZXNzaW5nIGEgdmFsdWUgaW4gYSBwYXJlbnQgdmlldywgd2hpY2ggcmVxdWlyZXMgd2Fsa2luZyB0aGUgdmlldyB0cmVlIHJhdGhlclxuICAgIC8vIHRoYW4gdXNpbmcgdGhlIGN0eCBhcmcuIEluIHRoaXMgY2FzZSwgdGhlIHJldHJpZXZhbCBhbmQgYmluZGluZyBsZXZlbCB3aWxsIGJlIGRpZmZlcmVudC5cbiAgICAvLyAyIC0gd2UgYXJlIGxvb2tpbmcgdXAgYSBsb2NhbCByZWYsIHdoaWNoIHJlcXVpcmVzIHJlc3RvcmluZyB0aGUgdmlldyB3aGVyZSB0aGUgbG9jYWxcbiAgICAvLyByZWYgaXMgc3RvcmVkXG4gICAgaWYgKHRoaXMuaXNMaXN0ZW5lclNjb3BlKCkgJiYgKHJldHJpZXZhbExldmVsIDwgdGhpcy5iaW5kaW5nTGV2ZWwgfHwgbG9jYWxSZWZMb29rdXApKSB7XG4gICAgICBpZiAoIXRoaXMucGFyZW50ICEucmVzdG9yZVZpZXdWYXJpYWJsZSkge1xuICAgICAgICAvLyBwYXJlbnQgc2F2ZXMgdmFyaWFibGUgdG8gZ2VuZXJhdGUgYSBzaGFyZWQgYGNvbnN0ICRzJCA9IGdldEN1cnJlbnRWaWV3KCk7YCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnBhcmVudCAhLnJlc3RvcmVWaWV3VmFyaWFibGUgPSBvLnZhcmlhYmxlKHRoaXMucGFyZW50ICEuZnJlc2hSZWZlcmVuY2VOYW1lKCkpO1xuICAgICAgfVxuICAgICAgdGhpcy5yZXN0b3JlVmlld1ZhcmlhYmxlID0gdGhpcy5wYXJlbnQgIS5yZXN0b3JlVmlld1ZhcmlhYmxlO1xuICAgIH1cbiAgfVxuXG4gIHJlc3RvcmVWaWV3U3RhdGVtZW50KCk6IG8uU3RhdGVtZW50W10ge1xuICAgIC8vIHJlc3RvcmVWaWV3KCRzdGF0ZSQpO1xuICAgIHJldHVybiB0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUgP1xuICAgICAgICBbaW5zdHJ1Y3Rpb24obnVsbCwgUjMucmVzdG9yZVZpZXcsIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGVdKS50b1N0bXQoKV0gOlxuICAgICAgICBbXTtcbiAgfVxuXG4gIHZpZXdTbmFwc2hvdFN0YXRlbWVudHMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgLy8gY29uc3QgJHN0YXRlJCA9IGdldEN1cnJlbnRWaWV3KCk7XG4gICAgY29uc3QgZ2V0Q3VycmVudFZpZXdJbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uKG51bGwsIFIzLmdldEN1cnJlbnRWaWV3LCBbXSk7XG4gICAgcmV0dXJuIHRoaXMucmVzdG9yZVZpZXdWYXJpYWJsZSA/XG4gICAgICAgIFt0aGlzLnJlc3RvcmVWaWV3VmFyaWFibGUuc2V0KGdldEN1cnJlbnRWaWV3SW5zdHJ1Y3Rpb24pLnRvQ29uc3REZWNsKCldIDpcbiAgICAgICAgW107XG4gIH1cblxuICBpc0xpc3RlbmVyU2NvcGUoKSB7IHJldHVybiB0aGlzLnBhcmVudCAmJiB0aGlzLnBhcmVudC5iaW5kaW5nTGV2ZWwgPT09IHRoaXMuYmluZGluZ0xldmVsOyB9XG5cbiAgdmFyaWFibGVEZWNsYXJhdGlvbnMoKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgbGV0IGN1cnJlbnRDb250ZXh0TGV2ZWwgPSAwO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMubWFwLnZhbHVlcygpKVxuICAgICAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLmRlY2xhcmUpXG4gICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnJldHJpZXZhbExldmVsIC0gYS5yZXRyaWV2YWxMZXZlbCB8fCBiLnByaW9yaXR5IC0gYS5wcmlvcml0eSlcbiAgICAgICAgLnJlZHVjZSgoc3RtdHM6IG8uU3RhdGVtZW50W10sIHZhbHVlOiBCaW5kaW5nRGF0YSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGxldmVsRGlmZiA9IHRoaXMuYmluZGluZ0xldmVsIC0gdmFsdWUucmV0cmlldmFsTGV2ZWw7XG4gICAgICAgICAgY29uc3QgY3VyclN0bXRzID0gdmFsdWUuZGVjbGFyZUxvY2FsQ2FsbGJhY2sgISh0aGlzLCBsZXZlbERpZmYgLSBjdXJyZW50Q29udGV4dExldmVsKTtcbiAgICAgICAgICBjdXJyZW50Q29udGV4dExldmVsID0gbGV2ZWxEaWZmO1xuICAgICAgICAgIHJldHVybiBzdG10cy5jb25jYXQoY3VyclN0bXRzKTtcbiAgICAgICAgfSwgW10pIGFzIG8uU3RhdGVtZW50W107XG4gIH1cblxuXG4gIGZyZXNoUmVmZXJlbmNlTmFtZSgpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50OiBCaW5kaW5nU2NvcGUgPSB0aGlzO1xuICAgIC8vIEZpbmQgdGhlIHRvcCBzY29wZSBhcyBpdCBtYWludGFpbnMgdGhlIGdsb2JhbCByZWZlcmVuY2UgY291bnRcbiAgICB3aGlsZSAoY3VycmVudC5wYXJlbnQpIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICBjb25zdCByZWYgPSBgJHtSRUZFUkVOQ0VfUFJFRklYfSR7Y3VycmVudC5yZWZlcmVuY2VOYW1lSW5kZXgrK31gO1xuICAgIHJldHVybiByZWY7XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgYENzc1NlbGVjdG9yYCBnaXZlbiBhIHRhZyBuYW1lIGFuZCBhIG1hcCBvZiBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUNzc1NlbGVjdG9yKHRhZzogc3RyaW5nLCBhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30pOiBDc3NTZWxlY3RvciB7XG4gIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG5cbiAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJpYnV0ZXMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNbbmFtZV07XG5cbiAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNzc1NlbGVjdG9yO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZXhwcmVzc2lvbnMgb3V0IG9mIGFuIGBuZ1Byb2plY3RBc2AgYXR0cmlidXRlc1xuICogd2hpY2ggY2FuIGJlIGFkZGVkIHRvIHRoZSBpbnN0cnVjdGlvbiBwYXJhbWV0ZXJzLlxuICovXG5mdW5jdGlvbiBnZXROZ1Byb2plY3RBc0xpdGVyYWwoYXR0cmlidXRlOiB0LlRleHRBdHRyaWJ1dGUpOiBvLkV4cHJlc3Npb25bXSB7XG4gIC8vIFBhcnNlIHRoZSBhdHRyaWJ1dGUgdmFsdWUgaW50byBhIENzc1NlbGVjdG9yTGlzdC4gTm90ZSB0aGF0IHdlIG9ubHkgdGFrZSB0aGVcbiAgLy8gZmlyc3Qgc2VsZWN0b3IsIGJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBtdWx0aXBsZSBzZWxlY3RvcnMgaW4gbmdQcm9qZWN0QXMuXG4gIGNvbnN0IHBhcnNlZFIzU2VsZWN0b3IgPSBjb3JlLnBhcnNlU2VsZWN0b3JUb1IzU2VsZWN0b3IoYXR0cmlidXRlLnZhbHVlKVswXTtcbiAgcmV0dXJuIFtvLmxpdGVyYWwoY29yZS5BdHRyaWJ1dGVNYXJrZXIuUHJvamVjdEFzKSwgYXNMaXRlcmFsKHBhcnNlZFIzU2VsZWN0b3IpXTtcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUoYXJnczogby5FeHByZXNzaW9uW10pOiBvLkV4cHJlc3Npb24ge1xuICBhcmdzID0gYXJncy5zbGljZSgxKTsgIC8vIElnbm9yZSB0aGUgbGVuZ3RoIHByZWZpeCBhZGRlZCBmb3IgcmVuZGVyMlxuICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uMSkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjIpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb24zKS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNCkuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb241KS5jYWxsRm4oYXJncyk7XG4gICAgY2FzZSAxMzpcbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoUjMuaW50ZXJwb2xhdGlvbjYpLmNhbGxGbihhcmdzKTtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uNykuY2FsbEZuKGFyZ3MpO1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLmludGVycG9sYXRpb244KS5jYWxsRm4oYXJncyk7XG4gIH1cbiAgKGFyZ3MubGVuZ3RoID49IDE5ICYmIGFyZ3MubGVuZ3RoICUgMiA9PSAxKSB8fFxuICAgICAgZXJyb3IoYEludmFsaWQgaW50ZXJwb2xhdGlvbiBhcmd1bWVudCBsZW5ndGggJHthcmdzLmxlbmd0aH1gKTtcbiAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5pbnRlcnBvbGF0aW9uVikuY2FsbEZuKFtvLmxpdGVyYWxBcnIoYXJncyldKTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIHByb3BlcnR5XG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBJbnRlcnBvbGF0aW9uIEFTVFxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eUludGVycG9sYXRpb25FeHByZXNzaW9uKGludGVycG9sYXRpb246IEludGVycG9sYXRpb24pIHtcbiAgc3dpdGNoIChnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uKSkge1xuICAgIGNhc2UgMTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTI7XG4gICAgY2FzZSA3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU1O1xuICAgIGNhc2UgMTM6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy5wcm9wZXJ0eUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLnByb3BlcnR5SW50ZXJwb2xhdGU4O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gUjMucHJvcGVydHlJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBpbnN0cnVjdGlvbiB0byBnZW5lcmF0ZSBmb3IgYW4gaW50ZXJwb2xhdGVkIGF0dHJpYnV0ZVxuICogQHBhcmFtIGludGVycG9sYXRpb24gQW4gSW50ZXJwb2xhdGlvbiBBU1RcbiAqL1xuZnVuY3Rpb24gZ2V0QXR0cmlidXRlSW50ZXJwb2xhdGlvbkV4cHJlc3Npb24oaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbikge1xuICBzd2l0Y2ggKGdldEludGVycG9sYXRpb25BcmdzTGVuZ3RoKGludGVycG9sYXRpb24pKSB7XG4gICAgY2FzZSAzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlMTtcbiAgICBjYXNlIDU6XG4gICAgICByZXR1cm4gUjMuYXR0cmlidXRlSW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy5hdHRyaWJ1dGVJbnRlcnBvbGF0ZTM7XG4gICAgY2FzZSA5OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNDtcbiAgICBjYXNlIDExOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNjtcbiAgICBjYXNlIDE1OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlNztcbiAgICBjYXNlIDE3OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLmF0dHJpYnV0ZUludGVycG9sYXRlVjtcbiAgfVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGluc3RydWN0aW9uIHRvIGdlbmVyYXRlIGZvciBpbnRlcnBvbGF0ZWQgdGV4dC5cbiAqIEBwYXJhbSBpbnRlcnBvbGF0aW9uIEFuIEludGVycG9sYXRpb24gQVNUXG4gKi9cbmZ1bmN0aW9uIGdldFRleHRJbnRlcnBvbGF0aW9uRXhwcmVzc2lvbihpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKTogby5FeHRlcm5hbFJlZmVyZW5jZSB7XG4gIHN3aXRjaCAoZ2V0SW50ZXJwb2xhdGlvbkFyZ3NMZW5ndGgoaW50ZXJwb2xhdGlvbikpIHtcbiAgICBjYXNlIDE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlO1xuICAgIGNhc2UgMzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUxO1xuICAgIGNhc2UgNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUyO1xuICAgIGNhc2UgNzpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGUzO1xuICAgIGNhc2UgOTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU0O1xuICAgIGNhc2UgMTE6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlNTtcbiAgICBjYXNlIDEzOlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZTY7XG4gICAgY2FzZSAxNTpcbiAgICAgIHJldHVybiBSMy50ZXh0SW50ZXJwb2xhdGU3O1xuICAgIGNhc2UgMTc6XG4gICAgICByZXR1cm4gUjMudGV4dEludGVycG9sYXRlODtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFIzLnRleHRJbnRlcnBvbGF0ZVY7XG4gIH1cbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzIGV4cGVjdGVkIHRvIGJlIHBhc3NlZCB0byBhIGdlbmVyYXRlZCBpbnN0cnVjdGlvbiBpbiB0aGUgY2FzZSBvZlxuICogaW50ZXJwb2xhdGlvbiBpbnN0cnVjdGlvbnMuXG4gKiBAcGFyYW0gaW50ZXJwb2xhdGlvbiBBbiBpbnRlcnBvbGF0aW9uIGFzdFxuICovXG5mdW5jdGlvbiBnZXRJbnRlcnBvbGF0aW9uQXJnc0xlbmd0aChpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uKSB7XG4gIGNvbnN0IHtleHByZXNzaW9ucywgc3RyaW5nc30gPSBpbnRlcnBvbGF0aW9uO1xuICBpZiAoZXhwcmVzc2lvbnMubGVuZ3RoID09PSAxICYmIHN0cmluZ3MubGVuZ3RoID09PSAyICYmIHN0cmluZ3NbMF0gPT09ICcnICYmIHN0cmluZ3NbMV0gPT09ICcnKSB7XG4gICAgLy8gSWYgdGhlIGludGVycG9sYXRpb24gaGFzIG9uZSBpbnRlcnBvbGF0ZWQgdmFsdWUsIGJ1dCB0aGUgcHJlZml4IGFuZCBzdWZmaXggYXJlIGJvdGggZW1wdHlcbiAgICAvLyBzdHJpbmdzLCB3ZSBvbmx5IHBhc3Mgb25lIGFyZ3VtZW50LCB0byBhIHNwZWNpYWwgaW5zdHJ1Y3Rpb24gbGlrZSBgcHJvcGVydHlJbnRlcnBvbGF0ZWAgb3JcbiAgICAvLyBgdGV4dEludGVycG9sYXRlYC5cbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZXhwcmVzc2lvbnMubGVuZ3RoICsgc3RyaW5ncy5sZW5ndGg7XG4gIH1cbn1cbi8qKlxuICogT3B0aW9ucyB0aGF0IGNhbiBiZSB1c2VkIHRvIG1vZGlmeSBob3cgYSB0ZW1wbGF0ZSBpcyBwYXJzZWQgYnkgYHBhcnNlVGVtcGxhdGUoKWAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VUZW1wbGF0ZU9wdGlvbnMge1xuICAvKipcbiAgICogSW5jbHVkZSB3aGl0ZXNwYWNlIG5vZGVzIGluIHRoZSBwYXJzZWQgb3V0cHV0LlxuICAgKi9cbiAgcHJlc2VydmVXaGl0ZXNwYWNlcz86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBIb3cgdG8gcGFyc2UgaW50ZXJwb2xhdGlvbiBtYXJrZXJzLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbkNvbmZpZz86IEludGVycG9sYXRpb25Db25maWc7XG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgYW5kIGVuZCBwb2ludCBvZiB0aGUgdGV4dCB0byBwYXJzZSB3aXRoaW4gdGhlIGBzb3VyY2VgIHN0cmluZy5cbiAgICogVGhlIGVudGlyZSBgc291cmNlYCBzdHJpbmcgaXMgcGFyc2VkIGlmIHRoaXMgaXMgbm90IHByb3ZpZGVkLlxuICAgKiAqL1xuICByYW5nZT86IExleGVyUmFuZ2U7XG4gIC8qKlxuICAgKiBJZiB0aGlzIHRleHQgaXMgc3RvcmVkIGluIGEgSmF2YVNjcmlwdCBzdHJpbmcsIHRoZW4gd2UgaGF2ZSB0byBkZWFsIHdpdGggZXNjYXBlIHNlcXVlbmNlcy5cbiAgICpcbiAgICogKipFeGFtcGxlIDE6KipcbiAgICpcbiAgICogYGBgXG4gICAqIFwiYWJjXFxcImRlZlxcbmdoaVwiXG4gICAqIGBgYFxuICAgKlxuICAgKiAtIFRoZSBgXFxcImAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYFwiYC5cbiAgICogLSBUaGUgYFxcbmAgbXVzdCBiZSBjb252ZXJ0ZWQgdG8gYSBuZXcgbGluZSBjaGFyYWN0ZXIgaW4gYSB0b2tlbixcbiAgICogICBidXQgaXQgc2hvdWxkIG5vdCBpbmNyZW1lbnQgdGhlIGN1cnJlbnQgbGluZSBmb3Igc291cmNlIG1hcHBpbmcuXG4gICAqXG4gICAqICoqRXhhbXBsZSAyOioqXG4gICAqXG4gICAqIGBgYFxuICAgKiBcImFiY1xcXG4gICAqICBkZWZcIlxuICAgKiBgYGBcbiAgICpcbiAgICogVGhlIGxpbmUgY29udGludWF0aW9uIChgXFxgIGZvbGxvd2VkIGJ5IGEgbmV3bGluZSkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBhIHRva2VuXG4gICAqIGJ1dCB0aGUgbmV3IGxpbmUgc2hvdWxkIGluY3JlbWVudCB0aGUgY3VycmVudCBsaW5lIGZvciBzb3VyY2UgbWFwcGluZy5cbiAgICovXG4gIGVzY2FwZWRTdHJpbmc/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgdGVtcGxhdGUgaW50byByZW5kZXIzIGBOb2RlYHMgYW5kIGFkZGl0aW9uYWwgbWV0YWRhdGEsIHdpdGggbm8gb3RoZXIgZGVwZW5kZW5jaWVzLlxuICpcbiAqIEBwYXJhbSB0ZW1wbGF0ZSB0ZXh0IG9mIHRoZSB0ZW1wbGF0ZSB0byBwYXJzZVxuICogQHBhcmFtIHRlbXBsYXRlVXJsIFVSTCB0byB1c2UgZm9yIHNvdXJjZSBtYXBwaW5nIG9mIHRoZSBwYXJzZWQgdGVtcGxhdGVcbiAqIEBwYXJhbSBvcHRpb25zIG9wdGlvbnMgdG8gbW9kaWZ5IGhvdyB0aGUgdGVtcGxhdGUgaXMgcGFyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVRlbXBsYXRlKFxuICAgIHRlbXBsYXRlOiBzdHJpbmcsIHRlbXBsYXRlVXJsOiBzdHJpbmcsIG9wdGlvbnM6IFBhcnNlVGVtcGxhdGVPcHRpb25zID0ge30pOlxuICAgIHtlcnJvcnM/OiBQYXJzZUVycm9yW10sIG5vZGVzOiB0Lk5vZGVbXSwgc3R5bGVVcmxzOiBzdHJpbmdbXSwgc3R5bGVzOiBzdHJpbmdbXX0ge1xuICBjb25zdCB7aW50ZXJwb2xhdGlvbkNvbmZpZywgcHJlc2VydmVXaGl0ZXNwYWNlc30gPSBvcHRpb25zO1xuICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZyk7XG4gIGNvbnN0IGh0bWxQYXJzZXIgPSBuZXcgSHRtbFBhcnNlcigpO1xuICBjb25zdCBwYXJzZVJlc3VsdCA9IGh0bWxQYXJzZXIucGFyc2UoXG4gICAgICB0ZW1wbGF0ZSwgdGVtcGxhdGVVcmwsXG4gICAgICB7Li4ub3B0aW9ucywgdG9rZW5pemVFeHBhbnNpb25Gb3JtczogdHJ1ZSwgbGVhZGluZ1RyaXZpYUNoYXJzOiBMRUFESU5HX1RSSVZJQV9DSEFSU30pO1xuXG4gIGlmIChwYXJzZVJlc3VsdC5lcnJvcnMgJiYgcGFyc2VSZXN1bHQuZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge2Vycm9yczogcGFyc2VSZXN1bHQuZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgbGV0IHJvb3ROb2RlczogaHRtbC5Ob2RlW10gPSBwYXJzZVJlc3VsdC5yb290Tm9kZXM7XG5cbiAgLy8gcHJvY2VzcyBpMThuIG1ldGEgaW5mb3JtYXRpb24gKHNjYW4gYXR0cmlidXRlcywgZ2VuZXJhdGUgaWRzKVxuICAvLyBiZWZvcmUgd2UgcnVuIHdoaXRlc3BhY2UgcmVtb3ZhbCBwcm9jZXNzLCBiZWNhdXNlIGV4aXN0aW5nIGkxOG5cbiAgLy8gZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bikgcmVsaWVzIG9uIGEgcmF3IGNvbnRlbnQgdG8gZ2VuZXJhdGVcbiAgLy8gbWVzc2FnZSBpZHNcbiAgcm9vdE5vZGVzID1cbiAgICAgIGh0bWwudmlzaXRBbGwobmV3IEkxOG5NZXRhVmlzaXRvcihpbnRlcnBvbGF0aW9uQ29uZmlnLCAhcHJlc2VydmVXaGl0ZXNwYWNlcyksIHJvb3ROb2Rlcyk7XG5cbiAgaWYgKCFwcmVzZXJ2ZVdoaXRlc3BhY2VzKSB7XG4gICAgcm9vdE5vZGVzID0gaHRtbC52aXNpdEFsbChuZXcgV2hpdGVzcGFjZVZpc2l0b3IoKSwgcm9vdE5vZGVzKTtcblxuICAgIC8vIHJ1biBpMThuIG1ldGEgdmlzaXRvciBhZ2FpbiBpbiBjYXNlIHdlIHJlbW92ZSB3aGl0ZXNwYWNlcywgYmVjYXVzZVxuICAgIC8vIHRoYXQgbWlnaHQgYWZmZWN0IGdlbmVyYXRlZCBpMThuIG1lc3NhZ2UgY29udGVudC4gRHVyaW5nIHRoaXMgcGFzc1xuICAgIC8vIGkxOG4gSURzIGdlbmVyYXRlZCBhdCB0aGUgZmlyc3QgcGFzcyB3aWxsIGJlIHByZXNlcnZlZCwgc28gd2UgY2FuIG1pbWljXG4gICAgLy8gZXhpc3RpbmcgZXh0cmFjdGlvbiBwcm9jZXNzIChuZyB4aTE4bilcbiAgICByb290Tm9kZXMgPSBodG1sLnZpc2l0QWxsKFxuICAgICAgICBuZXcgSTE4bk1ldGFWaXNpdG9yKGludGVycG9sYXRpb25Db25maWcsIC8qIGtlZXBJMThuQXR0cnMgKi8gZmFsc2UpLCByb290Tm9kZXMpO1xuICB9XG5cbiAgY29uc3Qge25vZGVzLCBlcnJvcnMsIHN0eWxlVXJscywgc3R5bGVzfSA9IGh0bWxBc3RUb1JlbmRlcjNBc3Qocm9vdE5vZGVzLCBiaW5kaW5nUGFyc2VyKTtcbiAgaWYgKGVycm9ycyAmJiBlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiB7ZXJyb3JzLCBub2RlczogW10sIHN0eWxlVXJsczogW10sIHN0eWxlczogW119O1xuICB9XG5cbiAgcmV0dXJuIHtub2Rlcywgc3R5bGVVcmxzLCBzdHlsZXN9O1xufVxuXG4vKipcbiAqIENvbnN0cnVjdCBhIGBCaW5kaW5nUGFyc2VyYCB3aXRoIGEgZGVmYXVsdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZUJpbmRpbmdQYXJzZXIoXG4gICAgaW50ZXJwb2xhdGlvbkNvbmZpZzogSW50ZXJwb2xhdGlvbkNvbmZpZyA9IERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcpOiBCaW5kaW5nUGFyc2VyIHtcbiAgcmV0dXJuIG5ldyBCaW5kaW5nUGFyc2VyKFxuICAgICAgbmV3IFBhcnNlcihuZXcgTGV4ZXIoKSksIGludGVycG9sYXRpb25Db25maWcsIG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKSwgbnVsbCwgW10pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNhbml0aXphdGlvbkZuKGNvbnRleHQ6IGNvcmUuU2VjdXJpdHlDb250ZXh0LCBpc0F0dHJpYnV0ZT86IGJvb2xlYW4pIHtcbiAgc3dpdGNoIChjb250ZXh0KSB7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5IVE1MOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZUh0bWwpO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuU0NSSVBUOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVNjcmlwdCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5TVFlMRTpcbiAgICAgIC8vIHRoZSBjb21waWxlciBkb2VzIG5vdCBmaWxsIGluIGFuIGluc3RydWN0aW9uIGZvciBbc3R5bGUucHJvcD9dIGJpbmRpbmdcbiAgICAgIC8vIHZhbHVlcyBiZWNhdXNlIHRoZSBzdHlsZSBhbGdvcml0aG0ga25vd3MgaW50ZXJuYWxseSB3aGF0IHByb3BzIGFyZSBzdWJqZWN0XG4gICAgICAvLyB0byBzYW5pdGl6YXRpb24gKG9ubHkgW2F0dHIuc3R5bGVdIHZhbHVlcyBhcmUgZXhwbGljaXRseSBzYW5pdGl6ZWQpXG4gICAgICByZXR1cm4gaXNBdHRyaWJ1dGUgPyBvLmltcG9ydEV4cHIoUjMuc2FuaXRpemVTdHlsZSkgOiBudWxsO1xuICAgIGNhc2UgY29yZS5TZWN1cml0eUNvbnRleHQuVVJMOlxuICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy5zYW5pdGl6ZVVybCk7XG4gICAgY2FzZSBjb3JlLlNlY3VyaXR5Q29udGV4dC5SRVNPVVJDRV9VUkw6XG4gICAgICByZXR1cm4gby5pbXBvcnRFeHByKFIzLnNhbml0aXplUmVzb3VyY2VVcmwpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NpbmdsZUVsZW1lbnRUZW1wbGF0ZShjaGlsZHJlbjogdC5Ob2RlW10pOiBjaGlsZHJlbiBpc1t0LkVsZW1lbnRdIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBjaGlsZHJlblswXSBpbnN0YW5jZW9mIHQuRWxlbWVudDtcbn1cblxuZnVuY3Rpb24gaXNUZXh0Tm9kZShub2RlOiB0Lk5vZGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIG5vZGUgaW5zdGFuY2VvZiB0LlRleHQgfHwgbm9kZSBpbnN0YW5jZW9mIHQuQm91bmRUZXh0IHx8IG5vZGUgaW5zdGFuY2VvZiB0LkljdTtcbn1cblxuZnVuY3Rpb24gaGFzVGV4dENoaWxkcmVuT25seShjaGlsZHJlbjogdC5Ob2RlW10pOiBib29sZWFuIHtcbiAgcmV0dXJuIGNoaWxkcmVuLmV2ZXJ5KGlzVGV4dE5vZGUpO1xufVxuIl19