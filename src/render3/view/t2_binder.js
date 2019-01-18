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
        define("@angular/compiler/src/render3/view/t2_binder", ["require", "exports", "tslib", "@angular/compiler/src/expression_parser/ast", "@angular/compiler/src/selector", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var ast_1 = require("@angular/compiler/src/expression_parser/ast");
    var selector_1 = require("@angular/compiler/src/selector");
    var r3_ast_1 = require("@angular/compiler/src/render3/r3_ast");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    /**
     * Processes `Target`s with a given set of directives and performs a binding operation, which
     * returns an object similar to TypeScript's `ts.TypeChecker` that contains knowledge about the
     * target.
     */
    var R3TargetBinder = /** @class */ (function () {
        function R3TargetBinder(directiveMatcher) {
            this.directiveMatcher = directiveMatcher;
        }
        /**
         * Perform a binding operation on the given `Target` and return a `BoundTarget` which contains
         * metadata about the types referenced in the template.
         */
        R3TargetBinder.prototype.bind = function (target) {
            if (!target.template) {
                // TODO(alxhub): handle targets which contain things like HostBindings, etc.
                throw new Error('Binding without a template not yet supported');
            }
            // First, parse the template into a `Scope` structure. This operation captures the syntactic
            // scopes in the template and makes them available for later use.
            var scope = Scope.apply(target.template);
            // Next, perform directive matching on the template using the `DirectiveBinder`. This returns:
            //   - directives: Map of nodes (elements & ng-templates) to the directives on them.
            //   - bindings: Map of inputs, outputs, and attributes to the directive/element that claims
            //     them. TODO(alxhub): handle multiple directives claiming an input/output/etc.
            //   - references: Map of #references to their targets.
            var _a = DirectiveBinder.apply(target.template, this.directiveMatcher), directives = _a.directives, bindings = _a.bindings, references = _a.references;
            // Finally, run the TemplateBinder to bind references, variables, and other entities within the
            // template. This extracts all the metadata that doesn't depend on directive matching.
            var _b = TemplateBinder.apply(target.template, scope), expressions = _b.expressions, symbols = _b.symbols, nestingLevel = _b.nestingLevel;
            return new R3BoundTarget(target, directives, bindings, references, expressions, symbols, nestingLevel);
        };
        return R3TargetBinder;
    }());
    exports.R3TargetBinder = R3TargetBinder;
    /**
     * Represents a binding scope within a template.
     *
     * Any variables, references, or other named entities declared within the template will
     * be captured and available by name in `namedEntities`. Additionally, child templates will
     * be analyzed and have their child `Scope`s available in `childScopes`.
     */
    var Scope = /** @class */ (function () {
        function Scope(parentScope) {
            this.parentScope = parentScope;
            /**
             * Named members of the `Scope`, such as `Reference`s or `Variable`s.
             */
            this.namedEntities = new Map();
            /**
             * Child `Scope`s for immediately nested `Template`s.
             */
            this.childScopes = new Map();
        }
        /**
         * Process a template (either as a `Template` sub-template with variables, or a plain array of
         * template `Node`s) and construct its `Scope`.
         */
        Scope.apply = function (template) {
            var scope = new Scope();
            scope.ingest(template);
            return scope;
        };
        /**
         * Internal method to process the template and populate the `Scope`.
         */
        Scope.prototype.ingest = function (template) {
            var _this = this;
            if (template instanceof r3_ast_1.Template) {
                // Variables on an <ng-template> are defined in the inner scope.
                template.variables.forEach(function (node) { return _this.visitVariable(node); });
                // Process the nodes of the template.
                template.children.forEach(function (node) { return node.visit(_this); });
            }
            else {
                // No overarching `Template` instance, so process the nodes directly.
                template.forEach(function (node) { return node.visit(_this); });
            }
        };
        Scope.prototype.visitElement = function (element) {
            var _this = this;
            // `Element`s in the template may have `Reference`s which are captured in the scope.
            element.references.forEach(function (node) { return _this.visitReference(node); });
            // Recurse into the `Element`'s children.
            element.children.forEach(function (node) { return node.visit(_this); });
        };
        Scope.prototype.visitTemplate = function (template) {
            var _this = this;
            // References on a <ng-template> are defined in the outer scope, so capture them before
            // processing the template's child scope.
            template.references.forEach(function (node) { return _this.visitReference(node); });
            // Next, create an inner scope and process the template within it.
            var scope = new Scope(this);
            scope.ingest(template);
            this.childScopes.set(template, scope);
        };
        Scope.prototype.visitVariable = function (variable) {
            // Declare the variable if it's not already.
            this.maybeDeclare(variable);
        };
        Scope.prototype.visitReference = function (reference) {
            // Declare the variable if it's not already.
            this.maybeDeclare(reference);
        };
        // Unused visitors.
        Scope.prototype.visitContent = function (content) { };
        Scope.prototype.visitBoundAttribute = function (attr) { };
        Scope.prototype.visitBoundEvent = function (event) { };
        Scope.prototype.visitBoundText = function (text) { };
        Scope.prototype.visitText = function (text) { };
        Scope.prototype.visitTextAttribute = function (attr) { };
        Scope.prototype.visitIcu = function (icu) { };
        Scope.prototype.maybeDeclare = function (thing) {
            // Declare something with a name, as long as that name isn't taken.
            if (!this.namedEntities.has(thing.name)) {
                this.namedEntities.set(thing.name, thing);
            }
        };
        /**
         * Look up a variable within this `Scope`.
         *
         * This can recurse into a parent `Scope` if it's available.
         */
        Scope.prototype.lookup = function (name) {
            if (this.namedEntities.has(name)) {
                // Found in the local scope.
                return this.namedEntities.get(name);
            }
            else if (this.parentScope !== undefined) {
                // Not in the local scope, but there's a parent scope so check there.
                return this.parentScope.lookup(name);
            }
            else {
                // At the top level and it wasn't found.
                return null;
            }
        };
        /**
         * Get the child scope for a `Template`.
         *
         * This should always be defined.
         */
        Scope.prototype.getChildScope = function (template) {
            var res = this.childScopes.get(template);
            if (res === undefined) {
                throw new Error("Assertion error: child scope for " + template + " not found");
            }
            return res;
        };
        return Scope;
    }());
    /**
     * Processes a template and matches directives on nodes (elements and templates).
     *
     * Usually used via the static `apply()` method.
     */
    var DirectiveBinder = /** @class */ (function () {
        function DirectiveBinder(matcher, directives, bindings, references) {
            this.matcher = matcher;
            this.directives = directives;
            this.bindings = bindings;
            this.references = references;
        }
        /**
         * Process a template (list of `Node`s) and perform directive matching against each node.
         *
         * @param template the list of template `Node`s to match (recursively).
         * @param selectorMatcher a `SelectorMatcher` containing the directives that are in scope for
         * this template.
         * @returns three maps which contain information about directives in the template: the
         * `directives` map which lists directives matched on each node, the `bindings` map which
         * indicates which directives claimed which bindings (inputs, outputs, etc), and the `references`
         * map which resolves #references (`Reference`s) within the template to the named directive or
         * template node.
         */
        DirectiveBinder.apply = function (template, selectorMatcher) {
            var directives = new Map();
            var bindings = new Map();
            var references = new Map();
            var matcher = new DirectiveBinder(selectorMatcher, directives, bindings, references);
            matcher.ingest(template);
            return { directives: directives, bindings: bindings, references: references };
        };
        DirectiveBinder.prototype.ingest = function (template) {
            var _this = this;
            template.forEach(function (node) { return node.visit(_this); });
        };
        DirectiveBinder.prototype.visitElement = function (element) { this.visitElementOrTemplate(element.name, element); };
        DirectiveBinder.prototype.visitTemplate = function (template) { this.visitElementOrTemplate('ng-template', template); };
        DirectiveBinder.prototype.visitElementOrTemplate = function (tag, node) {
            var _this = this;
            // First, determine the HTML shape of the node for the purpose of directive matching.
            // Do this by building up a `CssSelector` for the node.
            var cssSelector = new selector_1.CssSelector();
            cssSelector.setElement(tag);
            // Add attributes to the CSS selector.
            var attrs = util_1.getAttrsForDirectiveMatching(node);
            Object.getOwnPropertyNames(attrs).forEach(function (name) {
                var value = attrs[name];
                cssSelector.addAttribute(name, value);
                // Treat the 'class' attribute specially.
                if (name.toLowerCase() === 'class') {
                    var classes = value.trim().split(/\s+/g);
                    classes.forEach(function (className) { return cssSelector.addClassName(className); });
                }
            });
            // Next, use the `SelectorMatcher` to get the list of directives on the node.
            var directives = [];
            this.matcher.match(cssSelector, function (_, directive) { return directives.push(directive); });
            if (directives.length > 0) {
                this.directives.set(node, directives);
            }
            // Resolve any references that are created on this node.
            node.references.forEach(function (ref) {
                var dirTarget = null;
                // If the reference expression is empty, then it matches the "primary" directive on the node
                // (if there is one). Otherwise it matches the host node itself (either an element or
                // <ng-template> node).
                if (ref.value.trim() === '') {
                    // This could be a reference to a component if there is one.
                    dirTarget = directives.find(function (dir) { return dir.isComponent; }) || null;
                }
                else {
                    // This is a reference to a directive exported via exportAs. One should exist.
                    dirTarget =
                        directives.find(function (dir) { return dir.exportAs !== null && dir.exportAs.some(function (value) { return value === ref.value; }); }) ||
                            null;
                    // Check if a matching directive was found, and error if it wasn't.
                    if (dirTarget === null) {
                        // TODO(alxhub): Return an error value here that can be used for template validation.
                        throw new Error("Assertion error: failed to find directive with exportAs: " + ref.value);
                    }
                }
                if (dirTarget !== null) {
                    // This reference points to a directive.
                    _this.references.set(ref, { directive: dirTarget, node: node });
                }
                else {
                    // This reference points to the node itself.
                    _this.references.set(ref, node);
                }
            });
            // Associate bindings on the node with directives or with the node itself.
            // Inputs:
            tslib_1.__spread(node.attributes, node.inputs).forEach(function (binding) {
                var dir = directives.find(function (dir) { return dir.inputs.hasOwnProperty(binding.name); });
                if (dir !== undefined) {
                    _this.bindings.set(binding, dir);
                }
                else {
                    _this.bindings.set(binding, node);
                }
            });
            // Outputs:
            node.outputs.forEach(function (binding) {
                var dir = directives.find(function (dir) { return dir.outputs.hasOwnProperty(binding.name); });
                if (dir !== undefined) {
                    _this.bindings.set(binding, dir);
                }
                else {
                    _this.bindings.set(binding, node);
                }
            });
            // Recurse into the node's children.
            node.children.forEach(function (child) { return child.visit(_this); });
        };
        // Unused visitors.
        DirectiveBinder.prototype.visitContent = function (content) { };
        DirectiveBinder.prototype.visitVariable = function (variable) { };
        DirectiveBinder.prototype.visitReference = function (reference) { };
        DirectiveBinder.prototype.visitTextAttribute = function (attribute) { };
        DirectiveBinder.prototype.visitBoundAttribute = function (attribute) { };
        DirectiveBinder.prototype.visitBoundEvent = function (attribute) { };
        DirectiveBinder.prototype.visitBoundAttributeOrEvent = function (node) { };
        DirectiveBinder.prototype.visitText = function (text) { };
        DirectiveBinder.prototype.visitBoundText = function (text) { };
        DirectiveBinder.prototype.visitIcu = function (icu) { };
        return DirectiveBinder;
    }());
    /**
     * Processes a template and extract metadata about expressions and symbols within.
     *
     * This is a companion to the `DirectiveBinder` that doesn't require knowledge of directives matched
     * within the template in order to operate.
     *
     * Expressions are visited by the superclass `RecursiveAstVisitor`, with custom logic provided
     * by overridden methods from that visitor.
     */
    var TemplateBinder = /** @class */ (function (_super) {
        tslib_1.__extends(TemplateBinder, _super);
        function TemplateBinder(bindings, symbols, nestingLevel, scope, template, level) {
            var _this = _super.call(this) || this;
            _this.bindings = bindings;
            _this.symbols = symbols;
            _this.nestingLevel = nestingLevel;
            _this.scope = scope;
            _this.template = template;
            _this.level = level;
            // Save a bit of processing time by constructing this closure in advance.
            _this.visitNode = function (node) { return node.visit(_this); };
            return _this;
        }
        /**
         * Process a template and extract metadata about expressions and symbols within.
         *
         * @param template the nodes of the template to process
         * @param scope the `Scope` of the template being processed.
         * @returns three maps which contain metadata about the template: `expressions` which interprets
         * special `AST` nodes in expressions as pointing to references or variables declared within the
         * template, `symbols` which maps those variables and references to the nested `Template` which
         * declares them, if any, and `nestingLevel` which associates each `Template` with a integer
         * nesting level (how many levels deep within the template structure the `Template` is), starting
         * at 1.
         */
        TemplateBinder.apply = function (template, scope) {
            var expressions = new Map();
            var symbols = new Map();
            var nestingLevel = new Map();
            // The top-level template has nesting level 0.
            var binder = new TemplateBinder(expressions, symbols, nestingLevel, scope, template instanceof r3_ast_1.Template ? template : null, 0);
            binder.ingest(template);
            return { expressions: expressions, symbols: symbols, nestingLevel: nestingLevel };
        };
        TemplateBinder.prototype.ingest = function (template) {
            if (template instanceof r3_ast_1.Template) {
                // For <ng-template>s, process inputs, outputs, variables, and child nodes. References were
                // processed in the scope of the containing template.
                template.inputs.forEach(this.visitNode);
                template.outputs.forEach(this.visitNode);
                template.variables.forEach(this.visitNode);
                template.children.forEach(this.visitNode);
                // Set the nesting level.
                this.nestingLevel.set(template, this.level);
            }
            else {
                // Visit each node from the top-level template.
                template.forEach(this.visitNode);
            }
        };
        TemplateBinder.prototype.visitElement = function (element) {
            // Vist the inputs, outputs, and children of the element.
            element.inputs.forEach(this.visitNode);
            element.outputs.forEach(this.visitNode);
            element.children.forEach(this.visitNode);
        };
        TemplateBinder.prototype.visitTemplate = function (template) {
            // First, visit the inputs, outputs of the template node.
            template.inputs.forEach(this.visitNode);
            template.outputs.forEach(this.visitNode);
            // References are also evaluated in the outer context.
            template.references.forEach(this.visitNode);
            // Next, recurse into the template using its scope, and bumping the nesting level up by one.
            var childScope = this.scope.getChildScope(template);
            var binder = new TemplateBinder(this.bindings, this.symbols, this.nestingLevel, childScope, template, this.level + 1);
            binder.ingest(template);
        };
        TemplateBinder.prototype.visitVariable = function (variable) {
            // Register the `Variable` as a symbol in the current `Template`.
            if (this.template !== null) {
                this.symbols.set(variable, this.template);
            }
        };
        TemplateBinder.prototype.visitReference = function (reference) {
            // Register the `Reference` as a symbol in the current `Template`.
            if (this.template !== null) {
                this.symbols.set(reference, this.template);
            }
        };
        // Unused template visitors
        TemplateBinder.prototype.visitText = function (text) { };
        TemplateBinder.prototype.visitContent = function (content) { };
        TemplateBinder.prototype.visitTextAttribute = function (attribute) { };
        TemplateBinder.prototype.visitIcu = function (icu) { };
        // The remaining visitors are concerned with processing AST expressions within template bindings
        TemplateBinder.prototype.visitBoundAttribute = function (attribute) { attribute.value.visit(this); };
        TemplateBinder.prototype.visitBoundEvent = function (event) { event.handler.visit(this); };
        TemplateBinder.prototype.visitBoundText = function (text) { text.value.visit(this); };
        // These five types of AST expressions can refer to expression roots, which could be variables
        // or references in the current scope.
        TemplateBinder.prototype.visitPropertyRead = function (ast, context) {
            this.maybeMap(context, ast, ast.name);
            return _super.prototype.visitPropertyRead.call(this, ast, context);
        };
        TemplateBinder.prototype.visitSafePropertyRead = function (ast, context) {
            this.maybeMap(context, ast, ast.name);
            return _super.prototype.visitSafePropertyRead.call(this, ast, context);
        };
        TemplateBinder.prototype.visitPropertyWrite = function (ast, context) {
            this.maybeMap(context, ast, ast.name);
            return _super.prototype.visitPropertyWrite.call(this, ast, context);
        };
        TemplateBinder.prototype.visitMethodCall = function (ast, context) {
            this.maybeMap(context, ast, ast.name);
            return _super.prototype.visitMethodCall.call(this, ast, context);
        };
        TemplateBinder.prototype.visitSafeMethodCall = function (ast, context) {
            this.maybeMap(context, ast, ast.name);
            return _super.prototype.visitSafeMethodCall.call(this, ast, context);
        };
        TemplateBinder.prototype.maybeMap = function (scope, ast, name) {
            // If the receiver of the expression isn't the `ImplicitReceiver`, this isn't the root of an
            // `AST` expression that maps to a `Variable` or `Reference`.
            if (!(ast.receiver instanceof ast_1.ImplicitReceiver)) {
                return;
            }
            // Check whether the name exists in the current scope. If so, map it. Otherwise, the name is
            // probably a property on the top-level component context.
            var target = this.scope.lookup(name);
            if (target !== null) {
                this.bindings.set(ast, target);
            }
        };
        return TemplateBinder;
    }(ast_1.RecursiveAstVisitor));
    /**
     * Metadata container for a `Target` that allows queries for specific bits of metadata.
     *
     * See `BoundTarget` for documentation on the individual methods.
     */
    var R3BoundTarget = /** @class */ (function () {
        function R3BoundTarget(target, directives, bindings, references, exprTargets, symbols, nestingLevel) {
            this.target = target;
            this.directives = directives;
            this.bindings = bindings;
            this.references = references;
            this.exprTargets = exprTargets;
            this.symbols = symbols;
            this.nestingLevel = nestingLevel;
        }
        R3BoundTarget.prototype.getDirectivesOfNode = function (node) {
            return this.directives.get(node) || null;
        };
        R3BoundTarget.prototype.getReferenceTarget = function (ref) {
            return this.references.get(ref) || null;
        };
        R3BoundTarget.prototype.getConsumerOfBinding = function (binding) {
            return this.bindings.get(binding) || null;
        };
        R3BoundTarget.prototype.getExpressionTarget = function (expr) {
            return this.exprTargets.get(expr) || null;
        };
        R3BoundTarget.prototype.getTemplateOfSymbol = function (symbol) {
            return this.symbols.get(symbol) || null;
        };
        R3BoundTarget.prototype.getNestingLevel = function (template) { return this.nestingLevel.get(template) || 0; };
        R3BoundTarget.prototype.getUsedDirectives = function () {
            var set = new Set();
            this.directives.forEach(function (dirs) { return dirs.forEach(function (dir) { return set.add(dir); }); });
            return Array.from(set.values());
        };
        return R3BoundTarget;
    }());
    exports.R3BoundTarget = R3BoundTarget;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQWtLO0lBQ2xLLDJEQUE0RDtJQUM1RCwrREFBMEo7SUFHMUosZ0VBQW9EO0lBRXBEOzs7O09BSUc7SUFDSDtRQUNFLHdCQUFvQixnQkFBNkM7WUFBN0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE2QjtRQUFHLENBQUM7UUFFckU7OztXQUdHO1FBQ0gsNkJBQUksR0FBSixVQUFLLE1BQWM7WUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ3BCLDRFQUE0RTtnQkFDNUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO2FBQ2pFO1lBRUQsNEZBQTRGO1lBQzVGLGlFQUFpRTtZQUNqRSxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUUzQyw4RkFBOEY7WUFDOUYsb0ZBQW9GO1lBQ3BGLDRGQUE0RjtZQUM1RixtRkFBbUY7WUFDbkYsdURBQXVEO1lBQ2pELElBQUEsa0VBQzJELEVBRDFELDBCQUFVLEVBQUUsc0JBQVEsRUFBRSwwQkFDb0MsQ0FBQztZQUNsRSwrRkFBK0Y7WUFDL0Ysc0ZBQXNGO1lBQ2hGLElBQUEsaURBQW1GLEVBQWxGLDRCQUFXLEVBQUUsb0JBQU8sRUFBRSw4QkFBNEQsQ0FBQztZQUMxRixPQUFPLElBQUksYUFBYSxDQUNwQixNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQ0gscUJBQUM7SUFBRCxDQUFDLEFBOUJELElBOEJD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LENBQUM7UUFFRCwyQ0FBbUIsR0FBbkIsVUFBb0IsSUFBUztZQUMzQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztRQUM1QyxDQUFDO1FBRUQsMkNBQW1CLEdBQW5CLFVBQW9CLE1BQTBCO1lBQzVDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzFDLENBQUM7UUFFRCx1Q0FBZSxHQUFmLFVBQWdCLFFBQWtCLElBQVksT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVGLHlDQUFpQixHQUFqQjtZQUNFLElBQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFjLENBQUM7WUFDbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBWixDQUFZLENBQUMsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDO1lBQ25FLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBQ0gsb0JBQUM7SUFBRCxDQUFDLEFBeENELElBd0NDO0lBeENZLHNDQUFhIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVCwgSW1wbGljaXRSZWNlaXZlciwgTWV0aG9kQ2FsbCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlTWV0aG9kQ2FsbCwgU2FmZVByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCb3VuZEF0dHJpYnV0ZSwgQm91bmRFdmVudCwgQm91bmRUZXh0LCBDb250ZW50LCBFbGVtZW50LCBJY3UsIE5vZGUsIFJlZmVyZW5jZSwgVGVtcGxhdGUsIFRleHQsIFRleHRBdHRyaWJ1dGUsIFZhcmlhYmxlLCBWaXNpdG9yfSBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge0JvdW5kVGFyZ2V0LCBEaXJlY3RpdmVNZXRhLCBUYXJnZXQsIFRhcmdldEJpbmRlcn0gZnJvbSAnLi90Ml9hcGknO1xuaW1wb3J0IHtnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIFByb2Nlc3NlcyBgVGFyZ2V0YHMgd2l0aCBhIGdpdmVuIHNldCBvZiBkaXJlY3RpdmVzIGFuZCBwZXJmb3JtcyBhIGJpbmRpbmcgb3BlcmF0aW9uLCB3aGljaFxuICogcmV0dXJucyBhbiBvYmplY3Qgc2ltaWxhciB0byBUeXBlU2NyaXB0J3MgYHRzLlR5cGVDaGVja2VyYCB0aGF0IGNvbnRhaW5zIGtub3dsZWRnZSBhYm91dCB0aGVcbiAqIHRhcmdldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFRhcmdldEJpbmRlcjxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVQ+KSB7fVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGEgYmluZGluZyBvcGVyYXRpb24gb24gdGhlIGdpdmVuIGBUYXJnZXRgIGFuZCByZXR1cm4gYSBgQm91bmRUYXJnZXRgIHdoaWNoIGNvbnRhaW5zXG4gICAqIG1ldGFkYXRhIGFib3V0IHRoZSB0eXBlcyByZWZlcmVuY2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGJpbmQodGFyZ2V0OiBUYXJnZXQpOiBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gICAgaWYgKCF0YXJnZXQudGVtcGxhdGUpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogaGFuZGxlIHRhcmdldHMgd2hpY2ggY29udGFpbiB0aGluZ3MgbGlrZSBIb3N0QmluZGluZ3MsIGV0Yy5cbiAgICAgIHRocm93IG5ldyBFcnJvcignQmluZGluZyB3aXRob3V0IGEgdGVtcGxhdGUgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCwgcGFyc2UgdGhlIHRlbXBsYXRlIGludG8gYSBgU2NvcGVgIHN0cnVjdHVyZS4gVGhpcyBvcGVyYXRpb24gY2FwdHVyZXMgdGhlIHN5bnRhY3RpY1xuICAgIC8vIHNjb3BlcyBpbiB0aGUgdGVtcGxhdGUgYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciBsYXRlciB1c2UuXG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5hcHBseSh0YXJnZXQudGVtcGxhdGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfSA9XG4gICAgICAgIERpcmVjdGl2ZUJpbmRlci5hcHBseSh0YXJnZXQudGVtcGxhdGUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlcik7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsfSA9IFRlbXBsYXRlQmluZGVyLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSwgc2NvcGUpO1xuICAgIHJldHVybiBuZXcgUjNCb3VuZFRhcmdldChcbiAgICAgICAgdGFyZ2V0LCBkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcywgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgYmluZGluZyBzY29wZSB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBBbnkgdmFyaWFibGVzLCByZWZlcmVuY2VzLCBvciBvdGhlciBuYW1lZCBlbnRpdGllcyBkZWNsYXJlZCB3aXRoaW4gdGhlIHRlbXBsYXRlIHdpbGxcbiAqIGJlIGNhcHR1cmVkIGFuZCBhdmFpbGFibGUgYnkgbmFtZSBpbiBgbmFtZWRFbnRpdGllc2AuIEFkZGl0aW9uYWxseSwgY2hpbGQgdGVtcGxhdGVzIHdpbGxcbiAqIGJlIGFuYWx5emVkIGFuZCBoYXZlIHRoZWlyIGNoaWxkIGBTY29wZWBzIGF2YWlsYWJsZSBpbiBgY2hpbGRTY29wZXNgLlxuICovXG5jbGFzcyBTY29wZSBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvKipcbiAgICogTmFtZWQgbWVtYmVycyBvZiB0aGUgYFNjb3BlYCwgc3VjaCBhcyBgUmVmZXJlbmNlYHMgb3IgYFZhcmlhYmxlYHMuXG4gICAqL1xuICByZWFkb25seSBuYW1lZEVudGl0aWVzID0gbmV3IE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4oKTtcblxuICAvKipcbiAgICogQ2hpbGQgYFNjb3BlYHMgZm9yIGltbWVkaWF0ZWx5IG5lc3RlZCBgVGVtcGxhdGVgcy5cbiAgICovXG4gIHJlYWRvbmx5IGNoaWxkU2NvcGVzID0gbmV3IE1hcDxUZW1wbGF0ZSwgU2NvcGU+KCk7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihyZWFkb25seSBwYXJlbnRTY29wZT86IFNjb3BlKSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGVpdGhlciBhcyBhIGBUZW1wbGF0ZWAgc3ViLXRlbXBsYXRlIHdpdGggdmFyaWFibGVzLCBvciBhIHBsYWluIGFycmF5IG9mXG4gICAqIHRlbXBsYXRlIGBOb2RlYHMpIGFuZCBjb25zdHJ1Y3QgaXRzIGBTY29wZWAuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IFNjb3BlIHtcbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSgpO1xuICAgIHNjb3BlLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHNjb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSBhbmQgcG9wdWxhdGUgdGhlIGBTY29wZWAuXG4gICAqL1xuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogVGVtcGxhdGV8Tm9kZVtdKTogdm9pZCB7XG4gICAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIC8vIFZhcmlhYmxlcyBvbiBhbiA8bmctdGVtcGxhdGU+IGFyZSBkZWZpbmVkIGluIHRoZSBpbm5lciBzY29wZS5cbiAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFZhcmlhYmxlKG5vZGUpKTtcblxuICAgICAgLy8gUHJvY2VzcyB0aGUgbm9kZXMgb2YgdGhlIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBvdmVyYXJjaGluZyBgVGVtcGxhdGVgIGluc3RhbmNlLCBzbyBwcm9jZXNzIHRoZSBub2RlcyBkaXJlY3RseS5cbiAgICAgIHRlbXBsYXRlLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIGBFbGVtZW50YHMgaW4gdGhlIHRlbXBsYXRlIG1heSBoYXZlIGBSZWZlcmVuY2VgcyB3aGljaCBhcmUgY2FwdHVyZWQgaW4gdGhlIHNjb3BlLlxuICAgIGVsZW1lbnQucmVmZXJlbmNlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFJlZmVyZW5jZShub2RlKSk7XG5cbiAgICAvLyBSZWN1cnNlIGludG8gdGhlIGBFbGVtZW50YCdzIGNoaWxkcmVuLlxuICAgIGVsZW1lbnQuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICAvLyBSZWZlcmVuY2VzIG9uIGEgPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgb3V0ZXIgc2NvcGUsIHNvIGNhcHR1cmUgdGhlbSBiZWZvcmVcbiAgICAvLyBwcm9jZXNzaW5nIHRoZSB0ZW1wbGF0ZSdzIGNoaWxkIHNjb3BlLlxuICAgIHRlbXBsYXRlLnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgY3JlYXRlIGFuIGlubmVyIHNjb3BlIGFuZCBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSB3aXRoaW4gaXQuXG4gICAgY29uc3Qgc2NvcGUgPSBuZXcgU2NvcGUodGhpcyk7XG4gICAgc2NvcGUuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICB0aGlzLmNoaWxkU2NvcGVzLnNldCh0ZW1wbGF0ZSwgc2NvcGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHZhcmlhYmxlKTtcbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZShyZWZlcmVuY2UpO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyOiBCb3VuZEF0dHJpYnV0ZSkge31cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cjogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpIHt9XG5cbiAgcHJpdmF0ZSBtYXliZURlY2xhcmUodGhpbmc6IFJlZmVyZW5jZXxWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgc29tZXRoaW5nIHdpdGggYSBuYW1lLCBhcyBsb25nIGFzIHRoYXQgbmFtZSBpc24ndCB0YWtlbi5cbiAgICBpZiAoIXRoaXMubmFtZWRFbnRpdGllcy5oYXModGhpbmcubmFtZSkpIHtcbiAgICAgIHRoaXMubmFtZWRFbnRpdGllcy5zZXQodGhpbmcubmFtZSwgdGhpbmcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb29rIHVwIGEgdmFyaWFibGUgd2l0aGluIHRoaXMgYFNjb3BlYC5cbiAgICpcbiAgICogVGhpcyBjYW4gcmVjdXJzZSBpbnRvIGEgcGFyZW50IGBTY29wZWAgaWYgaXQncyBhdmFpbGFibGUuXG4gICAqL1xuICBsb29rdXAobmFtZTogc3RyaW5nKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIGlmICh0aGlzLm5hbWVkRW50aXRpZXMuaGFzKG5hbWUpKSB7XG4gICAgICAvLyBGb3VuZCBpbiB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICByZXR1cm4gdGhpcy5uYW1lZEVudGl0aWVzLmdldChuYW1lKSAhO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRTY29wZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBOb3QgaW4gdGhlIGxvY2FsIHNjb3BlLCBidXQgdGhlcmUncyBhIHBhcmVudCBzY29wZSBzbyBjaGVjayB0aGVyZS5cbiAgICAgIHJldHVybiB0aGlzLnBhcmVudFNjb3BlLmxvb2t1cChuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQXQgdGhlIHRvcCBsZXZlbCBhbmQgaXQgd2Fzbid0IGZvdW5kLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2hpbGQgc2NvcGUgZm9yIGEgYFRlbXBsYXRlYC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYWx3YXlzIGJlIGRlZmluZWQuXG4gICAqL1xuICBnZXRDaGlsZFNjb3BlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IFNjb3BlIHtcbiAgICBjb25zdCByZXMgPSB0aGlzLmNoaWxkU2NvcGVzLmdldCh0ZW1wbGF0ZSk7XG4gICAgaWYgKHJlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBlcnJvcjogY2hpbGQgc2NvcGUgZm9yICR7dGVtcGxhdGV9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIG1hdGNoZXMgZGlyZWN0aXZlcyBvbiBub2RlcyAoZWxlbWVudHMgYW5kIHRlbXBsYXRlcykuXG4gKlxuICogVXN1YWxseSB1c2VkIHZpYSB0aGUgc3RhdGljIGBhcHBseSgpYCBtZXRob2QuXG4gKi9cbmNsYXNzIERpcmVjdGl2ZUJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUPixcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSByZWZlcmVuY2VzOlxuICAgICAgICAgIE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGxpc3Qgb2YgYE5vZGVgcykgYW5kIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIGFnYWluc3QgZWFjaCBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGUgdGhlIGxpc3Qgb2YgdGVtcGxhdGUgYE5vZGVgcyB0byBtYXRjaCAocmVjdXJzaXZlbHkpLlxuICAgKiBAcGFyYW0gc2VsZWN0b3JNYXRjaGVyIGEgYFNlbGVjdG9yTWF0Y2hlcmAgY29udGFpbmluZyB0aGUgZGlyZWN0aXZlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3JcbiAgICogdGhpcyB0ZW1wbGF0ZS5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIGluZm9ybWF0aW9uIGFib3V0IGRpcmVjdGl2ZXMgaW4gdGhlIHRlbXBsYXRlOiB0aGVcbiAgICogYGRpcmVjdGl2ZXNgIG1hcCB3aGljaCBsaXN0cyBkaXJlY3RpdmVzIG1hdGNoZWQgb24gZWFjaCBub2RlLCB0aGUgYGJpbmRpbmdzYCBtYXAgd2hpY2hcbiAgICogaW5kaWNhdGVzIHdoaWNoIGRpcmVjdGl2ZXMgY2xhaW1lZCB3aGljaCBiaW5kaW5ncyAoaW5wdXRzLCBvdXRwdXRzLCBldGMpLCBhbmQgdGhlIGByZWZlcmVuY2VzYFxuICAgKiBtYXAgd2hpY2ggcmVzb2x2ZXMgI3JlZmVyZW5jZXMgKGBSZWZlcmVuY2Vgcykgd2l0aGluIHRoZSB0ZW1wbGF0ZSB0byB0aGUgbmFtZWQgZGlyZWN0aXZlIG9yXG4gICAqIHRlbXBsYXRlIG5vZGUuXG4gICAqL1xuICBzdGF0aWMgYXBwbHk8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+KFxuICAgICAgdGVtcGxhdGU6IE5vZGVbXSwgc2VsZWN0b3JNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVD4pOiB7XG4gICAgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgcmVmZXJlbmNlczogTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gIH0ge1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4oKTtcbiAgICBjb25zdCBiaW5kaW5ncyA9XG4gICAgICAgIG5ldyBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlcyA9XG4gICAgICAgIG5ldyBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBEaXJlY3RpdmVCaW5kZXIoc2VsZWN0b3JNYXRjaGVyLCBkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcyk7XG4gICAgbWF0Y2hlci5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiB7ZGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IE5vZGVbXSk6IHZvaWQgeyB0ZW1wbGF0ZS5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7IH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IHZvaWQgeyB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoZWxlbWVudC5uYW1lLCBlbGVtZW50KTsgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogdm9pZCB7IHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZSgnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7IH1cblxuICB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKHRhZzogc3RyaW5nLCBub2RlOiBFbGVtZW50fFRlbXBsYXRlKTogdm9pZCB7XG4gICAgLy8gRmlyc3QsIGRldGVybWluZSB0aGUgSFRNTCBzaGFwZSBvZiB0aGUgbm9kZSBmb3IgdGhlIHB1cnBvc2Ugb2YgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIC8vIERvIHRoaXMgYnkgYnVpbGRpbmcgdXAgYSBgQ3NzU2VsZWN0b3JgIGZvciB0aGUgbm9kZS5cbiAgICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICAgIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICAgIC8vIEFkZCBhdHRyaWJ1dGVzIHRvIHRoZSBDU1Mgc2VsZWN0b3IuXG4gICAgY29uc3QgYXR0cnMgPSBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpO1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHJzW25hbWVdO1xuXG4gICAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuXG4gICAgICAvLyBUcmVhdCB0aGUgJ2NsYXNzJyBhdHRyaWJ1dGUgc3BlY2lhbGx5LlxuICAgICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE5leHQsIHVzZSB0aGUgYFNlbGVjdG9yTWF0Y2hlcmAgdG8gZ2V0IHRoZSBsaXN0IG9mIGRpcmVjdGl2ZXMgb24gdGhlIG5vZGUuXG4gICAgY29uc3QgZGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgdGhpcy5tYXRjaGVyLm1hdGNoKGNzc1NlbGVjdG9yLCAoXywgZGlyZWN0aXZlKSA9PiBkaXJlY3RpdmVzLnB1c2goZGlyZWN0aXZlKSk7XG4gICAgaWYgKGRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5kaXJlY3RpdmVzLnNldChub2RlLCBkaXJlY3RpdmVzKTtcbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFueSByZWZlcmVuY2VzIHRoYXQgYXJlIGNyZWF0ZWQgb24gdGhpcyBub2RlLlxuICAgIG5vZGUucmVmZXJlbmNlcy5mb3JFYWNoKHJlZiA9PiB7XG4gICAgICBsZXQgZGlyVGFyZ2V0OiBEaXJlY3RpdmVUfG51bGwgPSBudWxsO1xuXG4gICAgICAvLyBJZiB0aGUgcmVmZXJlbmNlIGV4cHJlc3Npb24gaXMgZW1wdHksIHRoZW4gaXQgbWF0Y2hlcyB0aGUgXCJwcmltYXJ5XCIgZGlyZWN0aXZlIG9uIHRoZSBub2RlXG4gICAgICAvLyAoaWYgdGhlcmUgaXMgb25lKS4gT3RoZXJ3aXNlIGl0IG1hdGNoZXMgdGhlIGhvc3Qgbm9kZSBpdHNlbGYgKGVpdGhlciBhbiBlbGVtZW50IG9yXG4gICAgICAvLyA8bmctdGVtcGxhdGU+IG5vZGUpLlxuICAgICAgaWYgKHJlZi52YWx1ZS50cmltKCkgPT09ICcnKSB7XG4gICAgICAgIC8vIFRoaXMgY291bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBjb21wb25lbnQgaWYgdGhlcmUgaXMgb25lLlxuICAgICAgICBkaXJUYXJnZXQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5pc0NvbXBvbmVudCkgfHwgbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSByZWZlcmVuY2UgdG8gYSBkaXJlY3RpdmUgZXhwb3J0ZWQgdmlhIGV4cG9ydEFzLiBPbmUgc2hvdWxkIGV4aXN0LlxuICAgICAgICBkaXJUYXJnZXQgPVxuICAgICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgICAgIGRpciA9PiBkaXIuZXhwb3J0QXMgIT09IG51bGwgJiYgZGlyLmV4cG9ydEFzLnNvbWUodmFsdWUgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSkpIHx8XG4gICAgICAgICAgICBudWxsO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIGEgbWF0Y2hpbmcgZGlyZWN0aXZlIHdhcyBmb3VuZCwgYW5kIGVycm9yIGlmIGl0IHdhc24ndC5cbiAgICAgICAgaWYgKGRpclRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogUmV0dXJuIGFuIGVycm9yIHZhbHVlIGhlcmUgdGhhdCBjYW4gYmUgdXNlZCBmb3IgdGVtcGxhdGUgdmFsaWRhdGlvbi5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBlcnJvcjogZmFpbGVkIHRvIGZpbmQgZGlyZWN0aXZlIHdpdGggZXhwb3J0QXM6ICR7cmVmLnZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChkaXJUYXJnZXQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGEgZGlyZWN0aXZlLlxuICAgICAgICB0aGlzLnJlZmVyZW5jZXMuc2V0KHJlZiwge2RpcmVjdGl2ZTogZGlyVGFyZ2V0LCBub2RlfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIHJlZmVyZW5jZSBwb2ludHMgdG8gdGhlIG5vZGUgaXRzZWxmLlxuICAgICAgICB0aGlzLnJlZmVyZW5jZXMuc2V0KHJlZiwgbm9kZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBc3NvY2lhdGUgYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuXG4gICAgLy8gSW5wdXRzOlxuICAgIFsuLi5ub2RlLmF0dHJpYnV0ZXMsIC4uLm5vZGUuaW5wdXRzXS5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgbGV0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLmlucHV0cy5oYXNPd25Qcm9wZXJ0eShiaW5kaW5nLm5hbWUpKTtcbiAgICAgIGlmIChkaXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmJpbmRpbmdzLnNldChiaW5kaW5nLCBkaXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYmluZGluZywgbm9kZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzOlxuICAgIG5vZGUub3V0cHV0cy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgbGV0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLm91dHB1dHMuaGFzT3duUHJvcGVydHkoYmluZGluZy5uYW1lKSk7XG4gICAgICBpZiAoZGlyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYmluZGluZywgZGlyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGJpbmRpbmcsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBub2RlJ3MgY2hpbGRyZW4uXG4gICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlT3JFdmVudChub2RlOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gKlxuICogVGhpcyBpcyBhIGNvbXBhbmlvbiB0byB0aGUgYERpcmVjdGl2ZUJpbmRlcmAgdGhhdCBkb2Vzbid0IHJlcXVpcmUga25vd2xlZGdlIG9mIGRpcmVjdGl2ZXMgbWF0Y2hlZFxuICogd2l0aGluIHRoZSB0ZW1wbGF0ZSBpbiBvcmRlciB0byBvcGVyYXRlLlxuICpcbiAqIEV4cHJlc3Npb25zIGFyZSB2aXNpdGVkIGJ5IHRoZSBzdXBlcmNsYXNzIGBSZWN1cnNpdmVBc3RWaXNpdG9yYCwgd2l0aCBjdXN0b20gbG9naWMgcHJvdmlkZWRcbiAqIGJ5IG92ZXJyaWRkZW4gbWV0aG9kcyBmcm9tIHRoYXQgdmlzaXRvci5cbiAqL1xuY2xhc3MgVGVtcGxhdGVCaW5kZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIHByaXZhdGUgdmlzaXROb2RlOiAobm9kZTogTm9kZSkgPT4gdm9pZDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIGFuZCBleHRyYWN0IG1ldGFkYXRhIGFib3V0IGV4cHJlc3Npb25zIGFuZCBzeW1ib2xzIHdpdGhpbi5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBub2RlcyBvZiB0aGUgdGVtcGxhdGUgdG8gcHJvY2Vzc1xuICAgKiBAcGFyYW0gc2NvcGUgdGhlIGBTY29wZWAgb2YgdGhlIHRlbXBsYXRlIGJlaW5nIHByb2Nlc3NlZC5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIG1ldGFkYXRhIGFib3V0IHRoZSB0ZW1wbGF0ZTogYGV4cHJlc3Npb25zYCB3aGljaCBpbnRlcnByZXRzXG4gICAqIHNwZWNpYWwgYEFTVGAgbm9kZXMgaW4gZXhwcmVzc2lvbnMgYXMgcG9pbnRpbmcgdG8gcmVmZXJlbmNlcyBvciB2YXJpYWJsZXMgZGVjbGFyZWQgd2l0aGluIHRoZVxuICAgKiB0ZW1wbGF0ZSwgYHN5bWJvbHNgIHdoaWNoIG1hcHMgdGhvc2UgdmFyaWFibGVzIGFuZCByZWZlcmVuY2VzIHRvIHRoZSBuZXN0ZWQgYFRlbXBsYXRlYCB3aGljaFxuICAgKiBkZWNsYXJlcyB0aGVtLCBpZiBhbnksIGFuZCBgbmVzdGluZ0xldmVsYCB3aGljaCBhc3NvY2lhdGVzIGVhY2ggYFRlbXBsYXRlYCB3aXRoIGEgaW50ZWdlclxuICAgKiBuZXN0aW5nIGxldmVsIChob3cgbWFueSBsZXZlbHMgZGVlcCB3aXRoaW4gdGhlIHRlbXBsYXRlIHN0cnVjdHVyZSB0aGUgYFRlbXBsYXRlYCBpcyksIHN0YXJ0aW5nXG4gICAqIGF0IDEuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IE5vZGVbXSwgc2NvcGU6IFNjb3BlKToge1xuICAgIGV4cHJlc3Npb25zOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgIHN5bWJvbHM6IE1hcDxWYXJpYWJsZXxSZWZlcmVuY2UsIFRlbXBsYXRlPixcbiAgICBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPixcbiAgfSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBuZXcgTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPigpO1xuICAgIGNvbnN0IHN5bWJvbHMgPSBuZXcgTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+KCk7XG4gICAgY29uc3QgbmVzdGluZ0xldmVsID0gbmV3IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPigpO1xuICAgIC8vIFRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUgaGFzIG5lc3RpbmcgbGV2ZWwgMC5cbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIGV4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHNjb3BlLCB0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlID8gdGVtcGxhdGUgOiBudWxsLFxuICAgICAgICAwKTtcbiAgICBiaW5kZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3MgaW5wdXRzLCBvdXRwdXRzLCB2YXJpYWJsZXMsIGFuZCBjaGlsZCBub2Rlcy4gUmVmZXJlbmNlcyB3ZXJlXG4gICAgICAvLyBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgICAvLyBTZXQgdGhlIG5lc3RpbmcgbGV2ZWwuXG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQodGVtcGxhdGUsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBWaXNpdCBlYWNoIG5vZGUgZnJvbSB0aGUgdG9wLWxldmVsIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBWaXN0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gRmlyc3QsIHZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMgb2YgdGhlIHRlbXBsYXRlIG5vZGUuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAvLyBSZWZlcmVuY2VzIGFyZSBhbHNvIGV2YWx1YXRlZCBpbiB0aGUgb3V0ZXIgY29udGV4dC5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZSB1c2luZyBpdHMgc2NvcGUsIGFuZCBidW1waW5nIHRoZSBuZXN0aW5nIGxldmVsIHVwIGJ5IG9uZS5cbiAgICBjb25zdCBjaGlsZFNjb3BlID0gdGhpcy5zY29wZS5nZXRDaGlsZFNjb3BlKHRlbXBsYXRlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy5uZXN0aW5nTGV2ZWwsIGNoaWxkU2NvcGUsIHRlbXBsYXRlLCB0aGlzLmxldmVsICsgMSk7XG4gICAgYmluZGVyLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgVmFyaWFibGVgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMudGVtcGxhdGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQodmFyaWFibGUsIHRoaXMudGVtcGxhdGUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gUmVnaXN0ZXIgdGhlIGBSZWZlcmVuY2VgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMudGVtcGxhdGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQocmVmZXJlbmNlLCB0aGlzLnRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICAvLyBVbnVzZWQgdGVtcGxhdGUgdmlzaXRvcnNcblxuICB2aXNpdFRleHQodGV4dDogVGV4dCkge31cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuXG4gIC8vIFRoZSByZW1haW5pbmcgdmlzaXRvcnMgYXJlIGNvbmNlcm5lZCB3aXRoIHByb2Nlc3NpbmcgQVNUIGV4cHJlc3Npb25zIHdpdGhpbiB0ZW1wbGF0ZSBiaW5kaW5nc1xuXG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSkgeyBhdHRyaWJ1dGUudmFsdWUudmlzaXQodGhpcyk7IH1cblxuICB2aXNpdEJvdW5kRXZlbnQoZXZlbnQ6IEJvdW5kRXZlbnQpIHsgZXZlbnQuaGFuZGxlci52aXNpdCh0aGlzKTsgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCkgeyB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMpOyB9XG5cblxuXG4gIC8vIFRoZXNlIGZpdmUgdHlwZXMgb2YgQVNUIGV4cHJlc3Npb25zIGNhbiByZWZlciB0byBleHByZXNzaW9uIHJvb3RzLCB3aGljaCBjb3VsZCBiZSB2YXJpYWJsZXNcbiAgLy8gb3IgcmVmZXJlbmNlcyBpbiB0aGUgY3VycmVudCBzY29wZS5cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5tYXliZU1hcChjb250ZXh0LCBhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0TWV0aG9kQ2FsbChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZU1ldGhvZENhbGwoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoXG4gICAgICBzY29wZTogU2NvcGUsIGFzdDogUHJvcGVydHlSZWFkfFNhZmVQcm9wZXJ0eVJlYWR8UHJvcGVydHlXcml0ZXxNZXRob2RDYWxsfFNhZmVNZXRob2RDYWxsLFxuICAgICAgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIHJlY2VpdmVyIG9mIHRoZSBleHByZXNzaW9uIGlzbid0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAsIHRoaXMgaXNuJ3QgdGhlIHJvb3Qgb2YgYW5cbiAgICAvLyBgQVNUYCBleHByZXNzaW9uIHRoYXQgbWFwcyB0byBhIGBWYXJpYWJsZWAgb3IgYFJlZmVyZW5jZWAuXG4gICAgaWYgKCEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBuYW1lIGV4aXN0cyBpbiB0aGUgY3VycmVudCBzY29wZS4gSWYgc28sIG1hcCBpdC4gT3RoZXJ3aXNlLCB0aGUgbmFtZSBpc1xuICAgIC8vIHByb2JhYmx5IGEgcHJvcGVydHkgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAgICBsZXQgdGFyZ2V0ID0gdGhpcy5zY29wZS5sb29rdXAobmFtZSk7XG4gICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXN0LCB0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ldGFkYXRhIGNvbnRhaW5lciBmb3IgYSBgVGFyZ2V0YCB0aGF0IGFsbG93cyBxdWVyaWVzIGZvciBzcGVjaWZpYyBiaXRzIG9mIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBgQm91bmRUYXJnZXRgIGZvciBkb2N1bWVudGF0aW9uIG9uIHRoZSBpbmRpdmlkdWFsIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0JvdW5kVGFyZ2V0PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFRhcmdldCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8UmVmZXJlbmNlfFRleHRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPikge31cblxuICBnZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiBEaXJlY3RpdmVUW118bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZGlyZWN0aXZlcy5nZXQobm9kZSkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldFJlZmVyZW5jZVRhcmdldChyZWY6IFJlZmVyZW5jZSk6IHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnRcbiAgICAgIHxUZW1wbGF0ZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5yZWZlcmVuY2VzLmdldChyZWYpIHx8IG51bGw7XG4gIH1cblxuICBnZXRDb25zdW1lck9mQmluZGluZyhiaW5kaW5nOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUpOiBEaXJlY3RpdmVUfEVsZW1lbnRcbiAgICAgIHxUZW1wbGF0ZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5ncy5nZXQoYmluZGluZykgfHwgbnVsbDtcbiAgfVxuXG4gIGdldEV4cHJlc3Npb25UYXJnZXQoZXhwcjogQVNUKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmV4cHJUYXJnZXRzLmdldChleHByKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0VGVtcGxhdGVPZlN5bWJvbChzeW1ib2w6IFJlZmVyZW5jZXxWYXJpYWJsZSk6IFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbHMuZ2V0KHN5bWJvbCkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldE5lc3RpbmdMZXZlbCh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5uZXN0aW5nTGV2ZWwuZ2V0KHRlbXBsYXRlKSB8fCAwOyB9XG5cbiAgZ2V0VXNlZERpcmVjdGl2ZXMoKTogRGlyZWN0aXZlVFtdIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PERpcmVjdGl2ZVQ+KCk7XG4gICAgdGhpcy5kaXJlY3RpdmVzLmZvckVhY2goZGlycyA9PiBkaXJzLmZvckVhY2goZGlyID0+IHNldC5hZGQoZGlyKSkpO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNldC52YWx1ZXMoKSk7XG4gIH1cbn1cbiJdfQ==