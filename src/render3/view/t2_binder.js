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
            var _b = TemplateBinder.apply(target.template, scope), expressions = _b.expressions, symbols = _b.symbols, nestingLevel = _b.nestingLevel, usedPipes = _b.usedPipes;
            return new R3BoundTarget(target, directives, bindings, references, expressions, symbols, nestingLevel, usedPipes);
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
        function TemplateBinder(bindings, symbols, usedPipes, nestingLevel, scope, template, level) {
            var _this = _super.call(this) || this;
            _this.bindings = bindings;
            _this.symbols = symbols;
            _this.usedPipes = usedPipes;
            _this.nestingLevel = nestingLevel;
            _this.scope = scope;
            _this.template = template;
            _this.level = level;
            _this.pipesUsed = [];
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
            var usedPipes = new Set();
            // The top-level template has nesting level 0.
            var binder = new TemplateBinder(expressions, symbols, usedPipes, nestingLevel, scope, template instanceof r3_ast_1.Template ? template : null, 0);
            binder.ingest(template);
            return { expressions: expressions, symbols: symbols, nestingLevel: nestingLevel, usedPipes: usedPipes };
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
            var binder = new TemplateBinder(this.bindings, this.symbols, this.usedPipes, this.nestingLevel, childScope, template, this.level + 1);
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
        TemplateBinder.prototype.visitPipe = function (ast, context) {
            this.usedPipes.add(ast.name);
            return _super.prototype.visitPipe.call(this, ast, context);
        };
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
        function R3BoundTarget(target, directives, bindings, references, exprTargets, symbols, nestingLevel, usedPipes) {
            this.target = target;
            this.directives = directives;
            this.bindings = bindings;
            this.references = references;
            this.exprTargets = exprTargets;
            this.symbols = symbols;
            this.nestingLevel = nestingLevel;
            this.usedPipes = usedPipes;
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
        R3BoundTarget.prototype.getUsedPipes = function () { return Array.from(this.usedPipes); };
        return R3BoundTarget;
    }());
    exports.R3BoundTarget = R3BoundTarget;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQStLO0lBQy9LLDJEQUE0RDtJQUM1RCwrREFBMEo7SUFHMUosZ0VBQW9EO0lBR3BEOzs7O09BSUc7SUFDSDtRQUNFLHdCQUFvQixnQkFBNkM7WUFBN0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE2QjtRQUFHLENBQUM7UUFFckU7OztXQUdHO1FBQ0gsNkJBQUksR0FBSixVQUFLLE1BQWM7WUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ3BCLDRFQUE0RTtnQkFDNUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO2FBQ2pFO1lBRUQsNEZBQTRGO1lBQzVGLGlFQUFpRTtZQUNqRSxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUUzQyw4RkFBOEY7WUFDOUYsb0ZBQW9GO1lBQ3BGLDRGQUE0RjtZQUM1RixtRkFBbUY7WUFDbkYsdURBQXVEO1lBQ2pELElBQUEsa0VBQzJELEVBRDFELDBCQUFVLEVBQUUsc0JBQVEsRUFBRSwwQkFDb0MsQ0FBQztZQUNsRSwrRkFBK0Y7WUFDL0Ysc0ZBQXNGO1lBQ2hGLElBQUEsaURBQzBDLEVBRHpDLDRCQUFXLEVBQUUsb0JBQU8sRUFBRSw4QkFBWSxFQUFFLHdCQUNLLENBQUM7WUFDakQsT0FBTyxJQUFJLGFBQWEsQ0FDcEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9GLENBQUM7UUFDSCxxQkFBQztJ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LENBQUMsQ0FBQztZQUNuRSxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELG9DQUFZLEdBQVosY0FBMkIsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakUsb0JBQUM7SUFBRCxDQUFDLEFBMUNELElBMENDO0lBMUNZLHNDQUFhIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVCwgQmluZGluZ1BpcGUsIEltcGxpY2l0UmVjZWl2ZXIsIE1ldGhvZENhbGwsIFByb3BlcnR5UmVhZCwgUHJvcGVydHlXcml0ZSwgUmVjdXJzaXZlQXN0VmlzaXRvciwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7Qm91bmRBdHRyaWJ1dGUsIEJvdW5kRXZlbnQsIEJvdW5kVGV4dCwgQ29udGVudCwgRWxlbWVudCwgSWN1LCBOb2RlLCBSZWZlcmVuY2UsIFRlbXBsYXRlLCBUZXh0LCBUZXh0QXR0cmlidXRlLCBWYXJpYWJsZSwgVmlzaXRvcn0gZnJvbSAnLi4vcjNfYXN0JztcblxuaW1wb3J0IHtCb3VuZFRhcmdldCwgRGlyZWN0aXZlTWV0YSwgVGFyZ2V0LCBUYXJnZXRCaW5kZXJ9IGZyb20gJy4vdDJfYXBpJztcbmltcG9ydCB7Z2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZ30gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIFByb2Nlc3NlcyBgVGFyZ2V0YHMgd2l0aCBhIGdpdmVuIHNldCBvZiBkaXJlY3RpdmVzIGFuZCBwZXJmb3JtcyBhIGJpbmRpbmcgb3BlcmF0aW9uLCB3aGljaFxuICogcmV0dXJucyBhbiBvYmplY3Qgc2ltaWxhciB0byBUeXBlU2NyaXB0J3MgYHRzLlR5cGVDaGVja2VyYCB0aGF0IGNvbnRhaW5zIGtub3dsZWRnZSBhYm91dCB0aGVcbiAqIHRhcmdldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFRhcmdldEJpbmRlcjxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVQ+KSB7fVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGEgYmluZGluZyBvcGVyYXRpb24gb24gdGhlIGdpdmVuIGBUYXJnZXRgIGFuZCByZXR1cm4gYSBgQm91bmRUYXJnZXRgIHdoaWNoIGNvbnRhaW5zXG4gICAqIG1ldGFkYXRhIGFib3V0IHRoZSB0eXBlcyByZWZlcmVuY2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGJpbmQodGFyZ2V0OiBUYXJnZXQpOiBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gICAgaWYgKCF0YXJnZXQudGVtcGxhdGUpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogaGFuZGxlIHRhcmdldHMgd2hpY2ggY29udGFpbiB0aGluZ3MgbGlrZSBIb3N0QmluZGluZ3MsIGV0Yy5cbiAgICAgIHRocm93IG5ldyBFcnJvcignQmluZGluZyB3aXRob3V0IGEgdGVtcGxhdGUgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCwgcGFyc2UgdGhlIHRlbXBsYXRlIGludG8gYSBgU2NvcGVgIHN0cnVjdHVyZS4gVGhpcyBvcGVyYXRpb24gY2FwdHVyZXMgdGhlIHN5bnRhY3RpY1xuICAgIC8vIHNjb3BlcyBpbiB0aGUgdGVtcGxhdGUgYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciBsYXRlciB1c2UuXG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5hcHBseSh0YXJnZXQudGVtcGxhdGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfSA9XG4gICAgICAgIERpcmVjdGl2ZUJpbmRlci5hcHBseSh0YXJnZXQudGVtcGxhdGUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlcik7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXN9ID1cbiAgICAgICAgVGVtcGxhdGVCaW5kZXIuYXBwbHkodGFyZ2V0LnRlbXBsYXRlLCBzY29wZSk7XG4gICAgcmV0dXJuIG5ldyBSM0JvdW5kVGFyZ2V0KFxuICAgICAgICB0YXJnZXQsIGRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzLCBleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXMpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGJpbmRpbmcgc2NvcGUgd2l0aGluIGEgdGVtcGxhdGUuXG4gKlxuICogQW55IHZhcmlhYmxlcywgcmVmZXJlbmNlcywgb3Igb3RoZXIgbmFtZWQgZW50aXRpZXMgZGVjbGFyZWQgd2l0aGluIHRoZSB0ZW1wbGF0ZSB3aWxsXG4gKiBiZSBjYXB0dXJlZCBhbmQgYXZhaWxhYmxlIGJ5IG5hbWUgaW4gYG5hbWVkRW50aXRpZXNgLiBBZGRpdGlvbmFsbHksIGNoaWxkIHRlbXBsYXRlcyB3aWxsXG4gKiBiZSBhbmFseXplZCBhbmQgaGF2ZSB0aGVpciBjaGlsZCBgU2NvcGVgcyBhdmFpbGFibGUgaW4gYGNoaWxkU2NvcGVzYC5cbiAqL1xuY2xhc3MgU2NvcGUgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLyoqXG4gICAqIE5hbWVkIG1lbWJlcnMgb2YgdGhlIGBTY29wZWAsIHN1Y2ggYXMgYFJlZmVyZW5jZWBzIG9yIGBWYXJpYWJsZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgbmFtZWRFbnRpdGllcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIENoaWxkIGBTY29wZWBzIGZvciBpbW1lZGlhdGVseSBuZXN0ZWQgYFRlbXBsYXRlYHMuXG4gICAqL1xuICByZWFkb25seSBjaGlsZFNjb3BlcyA9IG5ldyBNYXA8VGVtcGxhdGUsIFNjb3BlPigpO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocmVhZG9ubHkgcGFyZW50U2NvcGU/OiBTY29wZSkge31cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChlaXRoZXIgYXMgYSBgVGVtcGxhdGVgIHN1Yi10ZW1wbGF0ZSB3aXRoIHZhcmlhYmxlcywgb3IgYSBwbGFpbiBhcnJheSBvZlxuICAgKiB0ZW1wbGF0ZSBgTm9kZWBzKSBhbmQgY29uc3RydWN0IGl0cyBgU2NvcGVgLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5KHRlbXBsYXRlOiBUZW1wbGF0ZXxOb2RlW10pOiBTY29wZSB7XG4gICAgY29uc3Qgc2NvcGUgPSBuZXcgU2NvcGUoKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiBzY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcHJvY2VzcyB0aGUgdGVtcGxhdGUgYW5kIHBvcHVsYXRlIHRoZSBgU2NvcGVgLlxuICAgKi9cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBWYXJpYWJsZXMgb24gYW4gPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgaW5uZXIgc2NvcGUuXG4gICAgICB0ZW1wbGF0ZS52YXJpYWJsZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRWYXJpYWJsZShub2RlKSk7XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gb3ZlcmFyY2hpbmcgYFRlbXBsYXRlYCBpbnN0YW5jZSwgc28gcHJvY2VzcyB0aGUgbm9kZXMgZGlyZWN0bHkuXG4gICAgICB0ZW1wbGF0ZS5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBgRWxlbWVudGBzIGluIHRoZSB0ZW1wbGF0ZSBtYXkgaGF2ZSBgUmVmZXJlbmNlYHMgd2hpY2ggYXJlIGNhcHR1cmVkIGluIHRoZSBzY29wZS5cbiAgICBlbGVtZW50LnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBgRWxlbWVudGAncyBjaGlsZHJlbi5cbiAgICBlbGVtZW50LmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gUmVmZXJlbmNlcyBvbiBhIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIG91dGVyIHNjb3BlLCBzbyBjYXB0dXJlIHRoZW0gYmVmb3JlXG4gICAgLy8gcHJvY2Vzc2luZyB0aGUgdGVtcGxhdGUncyBjaGlsZCBzY29wZS5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIE5leHQsIGNyZWF0ZSBhbiBpbm5lciBzY29wZSBhbmQgcHJvY2VzcyB0aGUgdGVtcGxhdGUgd2l0aGluIGl0LlxuICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlKHRoaXMpO1xuICAgIHNjb3BlLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgdGhpcy5jaGlsZFNjb3Blcy5zZXQodGVtcGxhdGUsIHNjb3BlKTtcbiAgfVxuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZSh2YXJpYWJsZSk7XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUocmVmZXJlbmNlKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cjogQm91bmRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0Qm91bmRFdmVudChldmVudDogQm91bmRFdmVudCkge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCkge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHI6IFRleHRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KSB7fVxuXG4gIHByaXZhdGUgbWF5YmVEZWNsYXJlKHRoaW5nOiBSZWZlcmVuY2V8VmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHNvbWV0aGluZyB3aXRoIGEgbmFtZSwgYXMgbG9uZyBhcyB0aGF0IG5hbWUgaXNuJ3QgdGFrZW4uXG4gICAgaWYgKCF0aGlzLm5hbWVkRW50aXRpZXMuaGFzKHRoaW5nLm5hbWUpKSB7XG4gICAgICB0aGlzLm5hbWVkRW50aXRpZXMuc2V0KHRoaW5nLm5hbWUsIHRoaW5nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIHZhcmlhYmxlIHdpdGhpbiB0aGlzIGBTY29wZWAuXG4gICAqXG4gICAqIFRoaXMgY2FuIHJlY3Vyc2UgaW50byBhIHBhcmVudCBgU2NvcGVgIGlmIGl0J3MgYXZhaWxhYmxlLlxuICAgKi9cbiAgbG9va3VwKG5hbWU6IHN0cmluZyk6IFJlZmVyZW5jZXxWYXJpYWJsZXxudWxsIHtcbiAgICBpZiAodGhpcy5uYW1lZEVudGl0aWVzLmhhcyhuYW1lKSkge1xuICAgICAgLy8gRm91bmQgaW4gdGhlIGxvY2FsIHNjb3BlLlxuICAgICAgcmV0dXJuIHRoaXMubmFtZWRFbnRpdGllcy5nZXQobmFtZSkgITtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50U2NvcGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gTm90IGluIHRoZSBsb2NhbCBzY29wZSwgYnV0IHRoZXJlJ3MgYSBwYXJlbnQgc2NvcGUgc28gY2hlY2sgdGhlcmUuXG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnRTY29wZS5sb29rdXAobmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEF0IHRoZSB0b3AgbGV2ZWwgYW5kIGl0IHdhc24ndCBmb3VuZC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGNoaWxkIHNjb3BlIGZvciBhIGBUZW1wbGF0ZWAuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGFsd2F5cyBiZSBkZWZpbmVkLlxuICAgKi9cbiAgZ2V0Q2hpbGRTY29wZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBTY29wZSB7XG4gICAgY29uc3QgcmVzID0gdGhpcy5jaGlsZFNjb3Blcy5nZXQodGVtcGxhdGUpO1xuICAgIGlmIChyZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb24gZXJyb3I6IGNoaWxkIHNjb3BlIGZvciAke3RlbXBsYXRlfSBub3QgZm91bmRgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3NlcyBhIHRlbXBsYXRlIGFuZCBtYXRjaGVzIGRpcmVjdGl2ZXMgb24gbm9kZXMgKGVsZW1lbnRzIGFuZCB0ZW1wbGF0ZXMpLlxuICpcbiAqIFVzdWFsbHkgdXNlZCB2aWEgdGhlIHN0YXRpYyBgYXBwbHkoKWAgbWV0aG9kLlxuICovXG5jbGFzcyBEaXJlY3RpdmVCaW5kZXI8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgVmlzaXRvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBtYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVD4sXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+LFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50fFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPikge31cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChsaXN0IG9mIGBOb2RlYHMpIGFuZCBwZXJmb3JtIGRpcmVjdGl2ZSBtYXRjaGluZyBhZ2FpbnN0IGVhY2ggbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBsaXN0IG9mIHRlbXBsYXRlIGBOb2RlYHMgdG8gbWF0Y2ggKHJlY3Vyc2l2ZWx5KS5cbiAgICogQHBhcmFtIHNlbGVjdG9yTWF0Y2hlciBhIGBTZWxlY3Rvck1hdGNoZXJgIGNvbnRhaW5pbmcgdGhlIGRpcmVjdGl2ZXMgdGhhdCBhcmUgaW4gc2NvcGUgZm9yXG4gICAqIHRoaXMgdGVtcGxhdGUuXG4gICAqIEByZXR1cm5zIHRocmVlIG1hcHMgd2hpY2ggY29udGFpbiBpbmZvcm1hdGlvbiBhYm91dCBkaXJlY3RpdmVzIGluIHRoZSB0ZW1wbGF0ZTogdGhlXG4gICAqIGBkaXJlY3RpdmVzYCBtYXAgd2hpY2ggbGlzdHMgZGlyZWN0aXZlcyBtYXRjaGVkIG9uIGVhY2ggbm9kZSwgdGhlIGBiaW5kaW5nc2AgbWFwIHdoaWNoXG4gICAqIGluZGljYXRlcyB3aGljaCBkaXJlY3RpdmVzIGNsYWltZWQgd2hpY2ggYmluZGluZ3MgKGlucHV0cywgb3V0cHV0cywgZXRjKSwgYW5kIHRoZSBgcmVmZXJlbmNlc2BcbiAgICogbWFwIHdoaWNoIHJlc29sdmVzICNyZWZlcmVuY2VzIChgUmVmZXJlbmNlYHMpIHdpdGhpbiB0aGUgdGVtcGxhdGUgdG8gdGhlIG5hbWVkIGRpcmVjdGl2ZSBvclxuICAgKiB0ZW1wbGF0ZSBub2RlLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPihcbiAgICAgIHRlbXBsYXRlOiBOb2RlW10sIHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVQ+KToge1xuICAgIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+LFxuICAgIGJpbmRpbmdzOiBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgIHJlZmVyZW5jZXM6IE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICB9IHtcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gbmV3IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+KCk7XG4gICAgY29uc3QgYmluZGluZ3MgPVxuICAgICAgICBuZXcgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IHJlZmVyZW5jZXMgPVxuICAgICAgICBuZXcgTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudCB8IFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgRGlyZWN0aXZlQmluZGVyKHNlbGVjdG9yTWF0Y2hlciwgZGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXMpO1xuICAgIG1hdGNoZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2RpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0KHRlbXBsYXRlOiBOb2RlW10pOiB2b2lkIHsgdGVtcGxhdGUuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpOyB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHsgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7IH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQgeyB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoJ25nLXRlbXBsYXRlJywgdGVtcGxhdGUpOyB9XG5cbiAgdmlzaXRFbGVtZW50T3JUZW1wbGF0ZSh0YWc6IHN0cmluZywgbm9kZTogRWxlbWVudHxUZW1wbGF0ZSk6IHZvaWQge1xuICAgIC8vIEZpcnN0LCBkZXRlcm1pbmUgdGhlIEhUTUwgc2hhcGUgb2YgdGhlIG5vZGUgZm9yIHRoZSBwdXJwb3NlIG9mIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICAvLyBEbyB0aGlzIGJ5IGJ1aWxkaW5nIHVwIGEgYENzc1NlbGVjdG9yYCBmb3IgdGhlIG5vZGUuXG4gICAgY29uc3QgY3NzU2VsZWN0b3IgPSBuZXcgQ3NzU2VsZWN0b3IoKTtcbiAgICBjc3NTZWxlY3Rvci5zZXRFbGVtZW50KHRhZyk7XG5cbiAgICAvLyBBZGQgYXR0cmlidXRlcyB0byB0aGUgQ1NTIHNlbGVjdG9yLlxuICAgIGNvbnN0IGF0dHJzID0gZ2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZyhub2RlKTtcbiAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhhdHRycykuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBhdHRyc1tuYW1lXTtcblxuICAgICAgY3NzU2VsZWN0b3IuYWRkQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcblxuICAgICAgLy8gVHJlYXQgdGhlICdjbGFzcycgYXR0cmlidXRlIHNwZWNpYWxseS5cbiAgICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdjbGFzcycpIHtcbiAgICAgICAgY29uc3QgY2xhc3NlcyA9IHZhbHVlLnRyaW0oKS5zcGxpdCgvXFxzKy9nKTtcbiAgICAgICAgY2xhc3Nlcy5mb3JFYWNoKGNsYXNzTmFtZSA9PiBjc3NTZWxlY3Rvci5hZGRDbGFzc05hbWUoY2xhc3NOYW1lKSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOZXh0LCB1c2UgdGhlIGBTZWxlY3Rvck1hdGNoZXJgIHRvIGdldCB0aGUgbGlzdCBvZiBkaXJlY3RpdmVzIG9uIHRoZSBub2RlLlxuICAgIGNvbnN0IGRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSA9IFtdO1xuICAgIHRoaXMubWF0Y2hlci5tYXRjaChjc3NTZWxlY3RvciwgKF8sIGRpcmVjdGl2ZSkgPT4gZGlyZWN0aXZlcy5wdXNoKGRpcmVjdGl2ZSkpO1xuICAgIGlmIChkaXJlY3RpdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZGlyZWN0aXZlcy5zZXQobm9kZSwgZGlyZWN0aXZlcyk7XG4gICAgfVxuXG4gICAgLy8gUmVzb2x2ZSBhbnkgcmVmZXJlbmNlcyB0aGF0IGFyZSBjcmVhdGVkIG9uIHRoaXMgbm9kZS5cbiAgICBub2RlLnJlZmVyZW5jZXMuZm9yRWFjaChyZWYgPT4ge1xuICAgICAgbGV0IGRpclRhcmdldDogRGlyZWN0aXZlVHxudWxsID0gbnVsbDtcblxuICAgICAgLy8gSWYgdGhlIHJlZmVyZW5jZSBleHByZXNzaW9uIGlzIGVtcHR5LCB0aGVuIGl0IG1hdGNoZXMgdGhlIFwicHJpbWFyeVwiIGRpcmVjdGl2ZSBvbiB0aGUgbm9kZVxuICAgICAgLy8gKGlmIHRoZXJlIGlzIG9uZSkuIE90aGVyd2lzZSBpdCBtYXRjaGVzIHRoZSBob3N0IG5vZGUgaXRzZWxmIChlaXRoZXIgYW4gZWxlbWVudCBvclxuICAgICAgLy8gPG5nLXRlbXBsYXRlPiBub2RlKS5cbiAgICAgIGlmIChyZWYudmFsdWUudHJpbSgpID09PSAnJykge1xuICAgICAgICAvLyBUaGlzIGNvdWxkIGJlIGEgcmVmZXJlbmNlIHRvIGEgY29tcG9uZW50IGlmIHRoZXJlIGlzIG9uZS5cbiAgICAgICAgZGlyVGFyZ2V0ID0gZGlyZWN0aXZlcy5maW5kKGRpciA9PiBkaXIuaXNDb21wb25lbnQpIHx8IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIGlzIGEgcmVmZXJlbmNlIHRvIGEgZGlyZWN0aXZlIGV4cG9ydGVkIHZpYSBleHBvcnRBcy4gT25lIHNob3VsZCBleGlzdC5cbiAgICAgICAgZGlyVGFyZ2V0ID1cbiAgICAgICAgICAgIGRpcmVjdGl2ZXMuZmluZChcbiAgICAgICAgICAgICAgICBkaXIgPT4gZGlyLmV4cG9ydEFzICE9PSBudWxsICYmIGRpci5leHBvcnRBcy5zb21lKHZhbHVlID0+IHZhbHVlID09PSByZWYudmFsdWUpKSB8fFxuICAgICAgICAgICAgbnVsbDtcblxuICAgICAgICAvLyBDaGVjayBpZiBhIG1hdGNoaW5nIGRpcmVjdGl2ZSB3YXMgZm91bmQsIGFuZCBlcnJvciBpZiBpdCB3YXNuJ3QuXG4gICAgICAgIGlmIChkaXJUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBUT0RPKGFseGh1Yik6IFJldHVybiBhbiBlcnJvciB2YWx1ZSBoZXJlIHRoYXQgY2FuIGJlIHVzZWQgZm9yIHRlbXBsYXRlIHZhbGlkYXRpb24uXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb24gZXJyb3I6IGZhaWxlZCB0byBmaW5kIGRpcmVjdGl2ZSB3aXRoIGV4cG9ydEFzOiAke3JlZi52YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGlyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhIGRpcmVjdGl2ZS5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIHtkaXJlY3RpdmU6IGRpclRhcmdldCwgbm9kZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIHRoZSBub2RlIGl0c2VsZi5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIGJpbmRpbmdzIG9uIHRoZSBub2RlIHdpdGggZGlyZWN0aXZlcyBvciB3aXRoIHRoZSBub2RlIGl0c2VsZi5cblxuICAgIC8vIElucHV0czpcbiAgICBbLi4ubm9kZS5hdHRyaWJ1dGVzLCAuLi5ub2RlLmlucHV0c10uZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICAgIGxldCBkaXIgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5pbnB1dHMuaGFzT3duUHJvcGVydHkoYmluZGluZy5uYW1lKSk7XG4gICAgICBpZiAoZGlyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYmluZGluZywgZGlyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGJpbmRpbmcsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0czpcbiAgICBub2RlLm91dHB1dHMuZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICAgIGxldCBkaXIgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5vdXRwdXRzLmhhc093blByb3BlcnR5KGJpbmRpbmcubmFtZSkpO1xuICAgICAgaWYgKGRpciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGJpbmRpbmcsIGRpcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmJpbmRpbmdzLnNldChiaW5kaW5nLCBub2RlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgbm9kZSdzIGNoaWxkcmVuLlxuICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICAvLyBVbnVzZWQgdmlzaXRvcnMuXG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZU9yRXZlbnQobm9kZTogQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudCkge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHt9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICpcbiAqIFRoaXMgaXMgYSBjb21wYW5pb24gdG8gdGhlIGBEaXJlY3RpdmVCaW5kZXJgIHRoYXQgZG9lc24ndCByZXF1aXJlIGtub3dsZWRnZSBvZiBkaXJlY3RpdmVzIG1hdGNoZWRcbiAqIHdpdGhpbiB0aGUgdGVtcGxhdGUgaW4gb3JkZXIgdG8gb3BlcmF0ZS5cbiAqXG4gKiBFeHByZXNzaW9ucyBhcmUgdmlzaXRlZCBieSB0aGUgc3VwZXJjbGFzcyBgUmVjdXJzaXZlQXN0VmlzaXRvcmAsIHdpdGggY3VzdG9tIGxvZ2ljIHByb3ZpZGVkXG4gKiBieSBvdmVycmlkZGVuIG1ldGhvZHMgZnJvbSB0aGF0IHZpc2l0b3IuXG4gKi9cbmNsYXNzIFRlbXBsYXRlQmluZGVyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICBwcml2YXRlIHZpc2l0Tm9kZTogKG5vZGU6IE5vZGUpID0+IHZvaWQ7XG5cbiAgcHJpdmF0ZSBwaXBlc1VzZWQ6IHN0cmluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgICBwcml2YXRlIHN5bWJvbHM6IE1hcDxSZWZlcmVuY2V8VmFyaWFibGUsIFRlbXBsYXRlPiwgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIGFuZCBleHRyYWN0IG1ldGFkYXRhIGFib3V0IGV4cHJlc3Npb25zIGFuZCBzeW1ib2xzIHdpdGhpbi5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBub2RlcyBvZiB0aGUgdGVtcGxhdGUgdG8gcHJvY2Vzc1xuICAgKiBAcGFyYW0gc2NvcGUgdGhlIGBTY29wZWAgb2YgdGhlIHRlbXBsYXRlIGJlaW5nIHByb2Nlc3NlZC5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIG1ldGFkYXRhIGFib3V0IHRoZSB0ZW1wbGF0ZTogYGV4cHJlc3Npb25zYCB3aGljaCBpbnRlcnByZXRzXG4gICAqIHNwZWNpYWwgYEFTVGAgbm9kZXMgaW4gZXhwcmVzc2lvbnMgYXMgcG9pbnRpbmcgdG8gcmVmZXJlbmNlcyBvciB2YXJpYWJsZXMgZGVjbGFyZWQgd2l0aGluIHRoZVxuICAgKiB0ZW1wbGF0ZSwgYHN5bWJvbHNgIHdoaWNoIG1hcHMgdGhvc2UgdmFyaWFibGVzIGFuZCByZWZlcmVuY2VzIHRvIHRoZSBuZXN0ZWQgYFRlbXBsYXRlYCB3aGljaFxuICAgKiBkZWNsYXJlcyB0aGVtLCBpZiBhbnksIGFuZCBgbmVzdGluZ0xldmVsYCB3aGljaCBhc3NvY2lhdGVzIGVhY2ggYFRlbXBsYXRlYCB3aXRoIGEgaW50ZWdlclxuICAgKiBuZXN0aW5nIGxldmVsIChob3cgbWFueSBsZXZlbHMgZGVlcCB3aXRoaW4gdGhlIHRlbXBsYXRlIHN0cnVjdHVyZSB0aGUgYFRlbXBsYXRlYCBpcyksIHN0YXJ0aW5nXG4gICAqIGF0IDEuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IE5vZGVbXSwgc2NvcGU6IFNjb3BlKToge1xuICAgIGV4cHJlc3Npb25zOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgIHN5bWJvbHM6IE1hcDxWYXJpYWJsZXxSZWZlcmVuY2UsIFRlbXBsYXRlPixcbiAgICBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPixcbiAgICB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LFxuICB9IHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IG5ldyBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IG5ldyBNYXA8VmFyaWFibGV8UmVmZXJlbmNlLCBUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCBuZXN0aW5nTGV2ZWwgPSBuZXcgTWFwPFRlbXBsYXRlLCBudW1iZXI+KCk7XG4gICAgY29uc3QgdXNlZFBpcGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgLy8gVGhlIHRvcC1sZXZlbCB0ZW1wbGF0ZSBoYXMgbmVzdGluZyBsZXZlbCAwLlxuICAgIGNvbnN0IGJpbmRlciA9IG5ldyBUZW1wbGF0ZUJpbmRlcihcbiAgICAgICAgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIHVzZWRQaXBlcywgbmVzdGluZ0xldmVsLCBzY29wZSxcbiAgICAgICAgdGVtcGxhdGUgaW5zdGFuY2VvZiBUZW1wbGF0ZSA/IHRlbXBsYXRlIDogbnVsbCwgMCk7XG4gICAgYmluZGVyLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3MgaW5wdXRzLCBvdXRwdXRzLCB2YXJpYWJsZXMsIGFuZCBjaGlsZCBub2Rlcy4gUmVmZXJlbmNlcyB3ZXJlXG4gICAgICAvLyBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgICAvLyBTZXQgdGhlIG5lc3RpbmcgbGV2ZWwuXG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQodGVtcGxhdGUsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBWaXNpdCBlYWNoIG5vZGUgZnJvbSB0aGUgdG9wLWxldmVsIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBWaXN0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gRmlyc3QsIHZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMgb2YgdGhlIHRlbXBsYXRlIG5vZGUuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAvLyBSZWZlcmVuY2VzIGFyZSBhbHNvIGV2YWx1YXRlZCBpbiB0aGUgb3V0ZXIgY29udGV4dC5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZSB1c2luZyBpdHMgc2NvcGUsIGFuZCBidW1waW5nIHRoZSBuZXN0aW5nIGxldmVsIHVwIGJ5IG9uZS5cbiAgICBjb25zdCBjaGlsZFNjb3BlID0gdGhpcy5zY29wZS5nZXRDaGlsZFNjb3BlKHRlbXBsYXRlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy51c2VkUGlwZXMsIHRoaXMubmVzdGluZ0xldmVsLCBjaGlsZFNjb3BlLCB0ZW1wbGF0ZSxcbiAgICAgICAgdGhpcy5sZXZlbCArIDEpO1xuICAgIGJpbmRlci5pbmdlc3QodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFZhcmlhYmxlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHZhcmlhYmxlLCB0aGlzLnRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgUmVmZXJlbmNlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHJlZmVyZW5jZSwgdGhpcy50ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW51c2VkIHRlbXBsYXRlIHZpc2l0b3JzXG5cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cblxuICAvLyBUaGUgcmVtYWluaW5nIHZpc2l0b3JzIGFyZSBjb25jZXJuZWQgd2l0aCBwcm9jZXNzaW5nIEFTVCBleHByZXNzaW9ucyB3aXRoaW4gdGVtcGxhdGUgYmluZGluZ3NcblxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpIHsgYXR0cmlidXRlLnZhbHVlLnZpc2l0KHRoaXMpOyB9XG5cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7IGV2ZW50LmhhbmRsZXIudmlzaXQodGhpcyk7IH1cblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHsgdGV4dC52YWx1ZS52aXNpdCh0aGlzKTsgfVxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnVzZWRQaXBlcy5hZGQoYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFBpcGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIC8vIFRoZXNlIGZpdmUgdHlwZXMgb2YgQVNUIGV4cHJlc3Npb25zIGNhbiByZWZlciB0byBleHByZXNzaW9uIHJvb3RzLCB3aGljaCBjb3VsZCBiZSB2YXJpYWJsZXNcbiAgLy8gb3IgcmVmZXJlbmNlcyBpbiB0aGUgY3VycmVudCBzY29wZS5cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5tYXliZU1hcChjb250ZXh0LCBhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0TWV0aG9kQ2FsbChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZU1ldGhvZENhbGwoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoXG4gICAgICBzY29wZTogU2NvcGUsIGFzdDogUHJvcGVydHlSZWFkfFNhZmVQcm9wZXJ0eVJlYWR8UHJvcGVydHlXcml0ZXxNZXRob2RDYWxsfFNhZmVNZXRob2RDYWxsLFxuICAgICAgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIHJlY2VpdmVyIG9mIHRoZSBleHByZXNzaW9uIGlzbid0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAsIHRoaXMgaXNuJ3QgdGhlIHJvb3Qgb2YgYW5cbiAgICAvLyBgQVNUYCBleHByZXNzaW9uIHRoYXQgbWFwcyB0byBhIGBWYXJpYWJsZWAgb3IgYFJlZmVyZW5jZWAuXG4gICAgaWYgKCEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBuYW1lIGV4aXN0cyBpbiB0aGUgY3VycmVudCBzY29wZS4gSWYgc28sIG1hcCBpdC4gT3RoZXJ3aXNlLCB0aGUgbmFtZSBpc1xuICAgIC8vIHByb2JhYmx5IGEgcHJvcGVydHkgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAgICBsZXQgdGFyZ2V0ID0gdGhpcy5zY29wZS5sb29rdXAobmFtZSk7XG4gICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXN0LCB0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ldGFkYXRhIGNvbnRhaW5lciBmb3IgYSBgVGFyZ2V0YCB0aGF0IGFsbG93cyBxdWVyaWVzIGZvciBzcGVjaWZpYyBiaXRzIG9mIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBgQm91bmRUYXJnZXRgIGZvciBkb2N1bWVudGF0aW9uIG9uIHRoZSBpbmRpdmlkdWFsIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0JvdW5kVGFyZ2V0PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFRhcmdldCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8UmVmZXJlbmNlfFRleHRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+KSB7fVxuXG4gIGdldERpcmVjdGl2ZXNPZk5vZGUobm9kZTogRWxlbWVudHxUZW1wbGF0ZSk6IERpcmVjdGl2ZVRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5kaXJlY3RpdmVzLmdldChub2RlKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZjogUmVmZXJlbmNlKToge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZXMuZ2V0KHJlZikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldENvbnN1bWVyT2ZCaW5kaW5nKGJpbmRpbmc6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSk6IERpcmVjdGl2ZVR8RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdzLmdldChiaW5kaW5nKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvblRhcmdldChleHByOiBBU1QpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZXhwclRhcmdldHMuZ2V0KGV4cHIpIHx8IG51bGw7XG4gIH1cblxuICBnZXRUZW1wbGF0ZU9mU3ltYm9sKHN5bWJvbDogUmVmZXJlbmNlfFZhcmlhYmxlKTogVGVtcGxhdGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9scy5nZXQoc3ltYm9sKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0TmVzdGluZ0xldmVsKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IG51bWJlciB7IHJldHVybiB0aGlzLm5lc3RpbmdMZXZlbC5nZXQodGVtcGxhdGUpIHx8IDA7IH1cblxuICBnZXRVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4oKTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJzID0+IGRpcnMuZm9yRWFjaChkaXIgPT4gc2V0LmFkZChkaXIpKSk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBzdHJpbmdbXSB7IHJldHVybiBBcnJheS5mcm9tKHRoaXMudXNlZFBpcGVzKTsgfVxufVxuIl19