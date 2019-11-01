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
                    // This should be a reference to a directive exported via exportAs.
                    dirTarget =
                        directives.find(function (dir) { return dir.exportAs !== null && dir.exportAs.some(function (value) { return value === ref.value; }); }) ||
                            null;
                    // Check if a matching directive was found.
                    if (dirTarget === null) {
                        // No matching directive was found - this reference points to an unknown target. Leave it
                        // unmapped.
                        return;
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
            // Associate attributes/bindings on the node with directives or with the node itself.
            var processAttribute = function (attribute) {
                var dir = directives.find(function (dir) { return dir.inputs.hasOwnProperty(attribute.name); });
                if (dir !== undefined) {
                    _this.bindings.set(attribute, dir);
                }
                else {
                    _this.bindings.set(attribute, node);
                }
            };
            node.attributes.forEach(processAttribute);
            node.inputs.forEach(processAttribute);
            node.outputs.forEach(processAttribute);
            if (node instanceof r3_ast_1.Template) {
                node.templateAttrs.forEach(processAttribute);
            }
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
                // For <ng-template>s, process only variables and child nodes. Inputs, outputs, templateAttrs,
                // and references were all processed in the scope of the containing template.
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
            // Visit the inputs, outputs, and children of the element.
            element.inputs.forEach(this.visitNode);
            element.outputs.forEach(this.visitNode);
            element.children.forEach(this.visitNode);
        };
        TemplateBinder.prototype.visitTemplate = function (template) {
            // First, visit inputs, outputs and template attributes of the template node.
            template.inputs.forEach(this.visitNode);
            template.outputs.forEach(this.visitNode);
            template.templateAttrs.forEach(this.visitNode);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsbUVBQStLO0lBQy9LLDJEQUE0RDtJQUM1RCwrREFBMEo7SUFHMUosZ0VBQW9EO0lBR3BEOzs7O09BSUc7SUFDSDtRQUNFLHdCQUFvQixnQkFBNkM7WUFBN0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE2QjtRQUFHLENBQUM7UUFFckU7OztXQUdHO1FBQ0gsNkJBQUksR0FBSixVQUFLLE1BQWM7WUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Z0JBQ3BCLDRFQUE0RTtnQkFDNUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO2FBQ2pFO1lBRUQsNEZBQTRGO1lBQzVGLGlFQUFpRTtZQUNqRSxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUUzQyw4RkFBOEY7WUFDOUYsb0ZBQW9GO1lBQ3BGLDRGQUE0RjtZQUM1RixtRkFBbUY7WUFDbkYsdURBQXVEO1lBQ2pELElBQUEsa0VBQzJELEVBRDFELDBCQUFVLEVBQUUsc0JBQVEsRUFBRSwwQkFDb0MsQ0FBQztZQUNsRSwrRkFBK0Y7WUFDL0Ysc0ZBQXNGO1lBQ2hGLElBQUEsaURBQzBDLEVBRHpDLDRCQUFXLEVBQUUsb0JBQU8sRUFBRSw4QkFBWSxFQUFFLHdCQUNLLENBQUM7WUFDakQsT0FBTyxJQUFJLGFBQWEsQ0FDcEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9GLENBQUM7UUFDSCxxQkFBQztJQUFELENBQUMsQUEvQkQsSUErQkM7SUEvQlksd0NBQWM7SUFpQzNCOzs7Ozs7T0FNRztJQUNIO1FBV0UsZUFBNkIsV0FBbUI7WUFBbkIsZ0JBQVcsR0FBWCxXQUFXLENBQVE7WUFWaEQ7O2VBRUc7WUFDTSxrQkFBYSxHQUFHLElBQUksR0FBRyxFQUE4QixDQUFDO1lBRS9EOztlQUVHO1lBQ00sZ0JBQVcsR0FBRyxJQUFJLEdBQUcsRUFBbUIsQ0FBQztRQUVDLENBQUM7UUFFcEQ7OztXQUdHO1FBQ0ksV0FBSyxHQUFaLFVBQWEsUUFBeUI7WUFDcEMsSUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUMxQixLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVEOztXQUVHO1FBQ0ssc0JBQU0sR0FBZCxVQUFlLFFBQXlCO1lBQXhDLGlCQVdDO1lBVkMsSUFBSSxRQUFRLFlBQVksaUJBQVEsRUFBRTtnQkFDaEMsZ0VBQWdFO2dCQUNoRSxRQUFRLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLEtBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQXhCLENBQXdCLENBQUMsQ0FBQztnQkFFN0QscUNBQXFDO2dCQUNyQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQzthQUNyRDtpQkFBTTtnQkFDTCxxRUFBcUU7Z0JBQ3JFLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUksQ0FBQyxFQUFoQixDQUFnQixDQUFDLENBQUM7YUFDNUM7UUFDSCxDQUFDO1FBRUQsNEJBQVksR0FBWixVQUFhLE9BQWdCO1lBQTdCLGlCQU1DO1lBTEMsb0ZBQW9GO1lBQ3BGLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsS0FBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBekIsQ0FBeUIsQ0FBQyxDQUFDO1lBRTlELHlDQUF5QztZQUN6QyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBRUQsNkJBQWEsR0FBYixVQUFjLFFBQWtCO1lBQWhDLGlCQVNDO1lBUkMsdUZBQXVGO1lBQ3ZGLHlDQUF5QztZQUN6QyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLEtBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQXpCLENBQXlCLENBQUMsQ0FBQztZQUUvRCxrRUFBa0U7WUFDbEUsSUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUVELDZCQUFhLEdBQWIsVUFBYyxRQUFrQjtZQUM5Qiw0Q0FBNEM7WUFDNUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM5QixDQUFDO1FBRUQsOEJBQWMsR0FBZCxVQUFlLFNBQW9CO1lBQ2pDLDRDQUE0QztZQUM1QyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsNEJBQVksR0FBWixVQUFhLE9BQWdCLElBQUcsQ0FBQztRQUNqQyxtQ0FBbUIsR0FBbkIsVUFBb0IsSUFBb0IsSUFBRyxDQUFDO1FBQzVDLCtCQUFlLEdBQWYsVUFBZ0IsS0FBaUIsSUFBRyxDQUFDO1FBQ3JDLDhCQUFjLEdBQWQsVUFBZSxJQUFlLElBQUcsQ0FBQztRQUNsQyx5QkFBUyxHQUFULFVBQVUsSUFBVSxJQUFHLENBQUM7UUFDeEIsa0NBQWtCLEdBQWxCLFVBQW1CLElBQW1CLElBQUcsQ0FBQztRQUMxQyx3QkFBUSxHQUFSLFVBQVMsR0FBUSxJQUFHLENBQUM7UUFFYiw0QkFBWSxHQUFwQixVQUFxQixLQUF5QjtZQUM1QyxtRUFBbUU7WUFDbkUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQzthQUMzQztRQUNILENBQUM7UUFFRDs7OztXQUlHO1FBQ0gsc0JBQU0sR0FBTixVQUFPLElBQVk7WUFDakIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDaEMsNEJBQTRCO2dCQUM1QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRyxDQUFDO2FBQ3ZDO2lCQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQUU7Z0JBQ3pDLHFFQUFxRTtnQkFDckUsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUN0QztpQkFBTTtnQkFDTCx3Q0FBd0M7Z0JBQ3hDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7UUFDSCxDQUFDO1FBRUQ7Ozs7V0FJRztRQUNILDZCQUFhLEdBQWIsVUFBYyxRQUFrQjtZQUM5QixJQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzQyxJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUU7Z0JBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0NBQW9DLFFBQVEsZUFBWSxDQUFDLENBQUM7YUFDM0U7WUFDRCxPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUM7UUFDSCxZQUFDO0lBQUQsQ0FBQyxBQWxIRCxJQWtIQztJQUVEOzs7O09BSUc7SUFDSDtRQUNFLHlCQUNZLE9BQW9DLEVBQ3BDLFVBQStDLEVBQy9DLFFBQW1GLEVBQ25GLFVBQzRFO1lBSjVFLFlBQU8sR0FBUCxPQUFPLENBQTZCO1lBQ3BDLGVBQVUsR0FBVixVQUFVLENBQXFDO1lBQy9DLGFBQVEsR0FBUixRQUFRLENBQTJFO1lBQ25GLGVBQVUsR0FBVixVQUFVLENBQ2tFO1FBQUcsQ0FBQztRQUU1Rjs7Ozs7Ozs7Ozs7V0FXRztRQUNJLHFCQUFLLEdBQVosVUFDSSxRQUFnQixFQUFFLGVBQTRDO1lBS2hFLElBQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUFrQyxDQUFDO1lBQzdELElBQU0sUUFBUSxHQUNWLElBQUksR0FBRyxFQUF3RSxDQUFDO1lBQ3BGLElBQU0sVUFBVSxHQUNaLElBQUksR0FBRyxFQUFpRixDQUFDO1lBQzdGLElBQU0sT0FBTyxHQUFHLElBQUksZUFBZSxDQUFDLGVBQWUsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZGLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDekIsT0FBTyxFQUFDLFVBQVUsWUFBQSxFQUFFLFFBQVEsVUFBQSxFQUFFLFVBQVUsWUFBQSxFQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVPLGdDQUFNLEdBQWQsVUFBZSxRQUFnQjtZQUEvQixpQkFBc0Y7WUFBN0MsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQztRQUFDLENBQUM7UUFFdEYsc0NBQVksR0FBWixVQUFhLE9BQWdCLElBQVUsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVGLHVDQUFhLEdBQWIsVUFBYyxRQUFrQixJQUFVLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRWpHLGdEQUFzQixHQUF0QixVQUF1QixHQUFXLEVBQUUsSUFBc0I7WUFBMUQsaUJBOEVDO1lBN0VDLHFGQUFxRjtZQUNyRix1REFBdUQ7WUFDdkQsSUFBTSxXQUFXLEdBQUcsSUFBSSxzQkFBVyxFQUFFLENBQUM7WUFDdEMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUU1QixzQ0FBc0M7WUFDdEMsSUFBTSxLQUFLLEdBQUcsbUNBQTRCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLElBQUk7Z0JBQzdDLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFMUIsV0FBVyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBRXRDLHlDQUF5QztnQkFDekMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxFQUFFO29CQUNsQyxJQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUMzQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUyxJQUFJLE9BQUEsV0FBVyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBbkMsQ0FBbUMsQ0FBQyxDQUFDO2lCQUNuRTtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsNkVBQTZFO1lBQzdFLElBQU0sVUFBVSxHQUFpQixFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLFVBQUMsQ0FBQyxFQUFFLFNBQVMsSUFBSyxPQUFBLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQTFCLENBQTBCLENBQUMsQ0FBQztZQUM5RSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUN6QixJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDdkM7WUFFRCx3REFBd0Q7WUFDeEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHO2dCQUN6QixJQUFJLFNBQVMsR0FBb0IsSUFBSSxDQUFDO2dCQUV0Qyw0RkFBNEY7Z0JBQzVGLHFGQUFxRjtnQkFDckYsdUJBQXVCO2dCQUN2QixJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO29CQUMzQiw0REFBNEQ7b0JBQzVELFNBQVMsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLFdBQVcsRUFBZixDQUFlLENBQUMsSUFBSSxJQUFJLENBQUM7aUJBQzdEO3FCQUFNO29CQUNMLG1FQUFtRTtvQkFDbkUsU0FBUzt3QkFDTCxVQUFVLENBQUMsSUFBSSxDQUNYLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLFFBQVEsS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBbkIsQ0FBbUIsQ0FBQyxFQUF4RSxDQUF3RSxDQUFDOzRCQUNwRixJQUFJLENBQUM7b0JBQ1QsMkNBQTJDO29CQUMzQyxJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUU7d0JBQ3RCLHlGQUF5Rjt3QkFDekYsWUFBWTt3QkFDWixPQUFPO3FCQUNSO2lCQUNGO2dCQUVELElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtvQkFDdEIsd0NBQXdDO29CQUN4QyxLQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksTUFBQSxFQUFDLENBQUMsQ0FBQztpQkFDeEQ7cUJBQU07b0JBQ0wsNENBQTRDO29CQUM1QyxLQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQ2hDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxxRkFBcUY7WUFDckYsSUFBTSxnQkFBZ0IsR0FBRyxVQUFDLFNBQXNEO2dCQUM5RSxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUF6QyxDQUF5QyxDQUFDLENBQUM7Z0JBQzVFLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtvQkFDckIsS0FBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUNuQztxQkFBTTtvQkFDTCxLQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQ3BDO1lBQ0gsQ0FBQyxDQUFDO1lBQ0YsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDdkMsSUFBSSxJQUFJLFlBQVksaUJBQVEsRUFBRTtnQkFDNUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzthQUM5QztZQUVELG9DQUFvQztZQUNwQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWpCLENBQWlCLENBQUMsQ0FBQztRQUNwRCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLHNDQUFZLEdBQVosVUFBYSxPQUFnQixJQUFTLENBQUM7UUFDdkMsdUNBQWEsR0FBYixVQUFjLFFBQWtCLElBQVMsQ0FBQztRQUMxQyx3Q0FBYyxHQUFkLFVBQWUsU0FBb0IsSUFBUyxDQUFDO1FBQzdDLDRDQUFrQixHQUFsQixVQUFtQixTQUF3QixJQUFTLENBQUM7UUFDckQsNkNBQW1CLEdBQW5CLFVBQW9CLFNBQXlCLElBQVMsQ0FBQztRQUN2RCx5Q0FBZSxHQUFmLFVBQWdCLFNBQXFCLElBQVMsQ0FBQztRQUMvQyxvREFBMEIsR0FBMUIsVUFBMkIsSUFBK0IsSUFBRyxDQUFDO1FBQzlELG1DQUFTLEdBQVQsVUFBVSxJQUFVLElBQVMsQ0FBQztRQUM5Qix3Q0FBYyxHQUFkLFVBQWUsSUFBZSxJQUFTLENBQUM7UUFDeEMsa0NBQVEsR0FBUixVQUFTLEdBQVEsSUFBUyxDQUFDO1FBQzdCLHNCQUFDO0lBQUQsQ0FBQyxBQXJJRCxJQXFJQztJQUVEOzs7Ozs7OztPQVFHO0lBQ0g7UUFBNkIsMENBQW1CO1FBSzlDLHdCQUNZLFFBQXNDLEVBQ3RDLE9BQTBDLEVBQVUsU0FBc0IsRUFDMUUsWUFBbUMsRUFBVSxLQUFZLEVBQ3pELFFBQXVCLEVBQVUsS0FBYTtZQUoxRCxZQUtFLGlCQUFPLFNBSVI7WUFSVyxjQUFRLEdBQVIsUUFBUSxDQUE4QjtZQUN0QyxhQUFPLEdBQVAsT0FBTyxDQUFtQztZQUFVLGVBQVMsR0FBVCxTQUFTLENBQWE7WUFDMUUsa0JBQVksR0FBWixZQUFZLENBQXVCO1lBQVUsV0FBSyxHQUFMLEtBQUssQ0FBTztZQUN6RCxjQUFRLEdBQVIsUUFBUSxDQUFlO1lBQVUsV0FBSyxHQUFMLEtBQUssQ0FBUTtZQU5sRCxlQUFTLEdBQWEsRUFBRSxDQUFDO1lBUy9CLHlFQUF5RTtZQUN6RSxLQUFJLENBQUMsU0FBUyxHQUFHLFVBQUMsSUFBVSxJQUFLLE9BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFJLENBQUMsRUFBaEIsQ0FBZ0IsQ0FBQzs7UUFDcEQsQ0FBQztRQUVEOzs7Ozs7Ozs7OztXQVdHO1FBQ0ksb0JBQUssR0FBWixVQUFhLFFBQWdCLEVBQUUsS0FBWTtZQU16QyxJQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBMkIsQ0FBQztZQUN2RCxJQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztZQUN4RCxJQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsRUFBb0IsQ0FBQztZQUNqRCxJQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1lBQ3BDLDhDQUE4QztZQUM5QyxJQUFNLE1BQU0sR0FBRyxJQUFJLGNBQWMsQ0FDN0IsV0FBVyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFDcEQsUUFBUSxZQUFZLGlCQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEIsT0FBTyxFQUFDLFdBQVcsYUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLFlBQVksY0FBQSxFQUFFLFNBQVMsV0FBQSxFQUFDLENBQUM7UUFDekQsQ0FBQztRQUVPLCtCQUFNLEdBQWQsVUFBZSxRQUF5QjtZQUN0QyxJQUFJLFFBQVEsWUFBWSxpQkFBUSxFQUFFO2dCQUNoQyw4RkFBOEY7Z0JBQzlGLDZFQUE2RTtnQkFDN0UsUUFBUSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBRTFDLHlCQUF5QjtnQkFDekIsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUM3QztpQkFBTTtnQkFDTCwrQ0FBK0M7Z0JBQy9DLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xDO1FBQ0gsQ0FBQztRQUVELHFDQUFZLEdBQVosVUFBYSxPQUFnQjtZQUMzQiwwREFBMEQ7WUFDMUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4QyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELHNDQUFhLEdBQWIsVUFBYyxRQUFrQjtZQUM5Qiw2RUFBNkU7WUFDN0UsUUFBUSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN6QyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFL0Msc0RBQXNEO1lBQ3RELFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU1Qyw0RkFBNEY7WUFDNUYsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEQsSUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFjLENBQzdCLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFDcEYsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNwQixNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLENBQUM7UUFFRCxzQ0FBYSxHQUFiLFVBQWMsUUFBa0I7WUFDOUIsaUVBQWlFO1lBQ2pFLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7Z0JBQzFCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDM0M7UUFDSCxDQUFDO1FBRUQsdUNBQWMsR0FBZCxVQUFlLFNBQW9CO1lBQ2pDLGtFQUFrRTtZQUNsRSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFO2dCQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQzVDO1FBQ0gsQ0FBQztRQUVELDJCQUEyQjtRQUUzQixrQ0FBUyxHQUFULFVBQVUsSUFBVSxJQUFHLENBQUM7UUFDeEIscUNBQVksR0FBWixVQUFhLE9BQWdCLElBQUcsQ0FBQztRQUNqQywyQ0FBa0IsR0FBbEIsVUFBbUIsU0FBd0IsSUFBRyxDQUFDO1FBQy9DLGlDQUFRLEdBQVIsVUFBUyxHQUFRLElBQVMsQ0FBQztRQUUzQixnR0FBZ0c7UUFFaEcsNENBQW1CLEdBQW5CLFVBQW9CLFNBQXlCLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRS9FLHdDQUFlLEdBQWYsVUFBZ0IsS0FBaUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFakUsdUNBQWMsR0FBZCxVQUFlLElBQWUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0Qsa0NBQVMsR0FBVCxVQUFVLEdBQWdCLEVBQUUsT0FBWTtZQUN0QyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0IsT0FBTyxpQkFBTSxTQUFTLFlBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFFRCw4RkFBOEY7UUFDOUYsc0NBQXNDO1FBRXRDLDBDQUFpQixHQUFqQixVQUFrQixHQUFpQixFQUFFLE9BQVk7WUFDL0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QyxPQUFPLGlCQUFNLGlCQUFpQixZQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsOENBQXFCLEdBQXJCLFVBQXNCLEdBQXFCLEVBQUUsT0FBWTtZQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RDLE9BQU8saUJBQU0scUJBQXFCLFlBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCwyQ0FBa0IsR0FBbEIsVUFBbUIsR0FBa0IsRUFBRSxPQUFZO1lBQ2pELElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDdEMsT0FBTyxpQkFBTSxrQkFBa0IsWUFBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUVELHdDQUFlLEdBQWYsVUFBZ0IsR0FBZSxFQUFFLE9BQVk7WUFDM0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QyxPQUFPLGlCQUFNLGVBQWUsWUFBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDN0MsQ0FBQztRQUVELDRDQUFtQixHQUFuQixVQUFvQixHQUFtQixFQUFFLE9BQVk7WUFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0QyxPQUFPLGlCQUFNLG1CQUFtQixZQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRU8saUNBQVEsR0FBaEIsVUFDSSxLQUFZLEVBQUUsR0FBMEUsRUFDeEYsSUFBWTtZQUNkLDRGQUE0RjtZQUM1Riw2REFBNkQ7WUFDN0QsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsWUFBWSxzQkFBZ0IsQ0FBQyxFQUFFO2dCQUMvQyxPQUFPO2FBQ1I7WUFFRCw0RkFBNEY7WUFDNUYsMERBQTBEO1lBQzFELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JDLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtnQkFDbkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2FBQ2hDO1FBQ0gsQ0FBQztRQUNILHFCQUFDO0lBQUQsQ0FBQyxBQWxLRCxDQUE2Qix5QkFBbUIsR0FrSy9DO0lBRUQ7Ozs7T0FJRztJQUNIO1FBQ0UsdUJBQ2EsTUFBYyxFQUFVLFVBQStDLEVBQ3hFLFFBQW1GLEVBQ25GLFVBRWlFLEVBQ2pFLFdBQXlDLEVBQ3pDLE9BQTBDLEVBQzFDLFlBQW1DLEVBQVUsU0FBc0I7WUFQbEUsV0FBTSxHQUFOLE1BQU0sQ0FBUTtZQUFVLGVBQVUsR0FBVixVQUFVLENBQXFDO1lBQ3hFLGFBQVEsR0FBUixRQUFRLENBQTJFO1lBQ25GLGVBQVUsR0FBVixVQUFVLENBRXVEO1lBQ2pFLGdCQUFXLEdBQVgsV0FBVyxDQUE4QjtZQUN6QyxZQUFPLEdBQVAsT0FBTyxDQUFtQztZQUMxQyxpQkFBWSxHQUFaLFlBQVksQ0FBdUI7WUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFhO1FBQUcsQ0FBQztRQUVuRiwyQ0FBbUIsR0FBbkIsVUFBb0IsSUFBc0I7WUFDeEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDM0MsQ0FBQztRQUVELDBDQUFrQixHQUFsQixVQUFtQixHQUFjO1lBRS9CLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzFDLENBQUM7UUFFRCw0Q0FBb0IsR0FBcEIsVUFBcUIsT0FBZ0Q7WUFFbkUsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDNUMsQ0FBQztRQUVELDJDQUFtQixHQUFuQixVQUFvQixJQUFTO1lBQzNCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO1FBQzVDLENBQUM7UUFFRCwyQ0FBbUIsR0FBbkIsVUFBb0IsTUFBMEI7WUFDNUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDMUMsQ0FBQztRQUVELHVDQUFlLEdBQWYsVUFBZ0IsUUFBa0IsSUFBWSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFNUYseUNBQWlCLEdBQWpCO1lBQ0UsSUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQWMsQ0FBQztZQUNsQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFaLENBQVksQ0FBQyxFQUFqQyxDQUFpQyxDQUFDLENBQUM7WUFDbkUsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFFRCxvQ0FBWSxHQUFaLGNBQTJCLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLG9CQUFDO0lBQUQsQ0FBQyxBQTFDRCxJQTBDQztJQTFDWSxzQ0FBYSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1QsIEJpbmRpbmdQaXBlLCBJbXBsaWNpdFJlY2VpdmVyLCBNZXRob2RDYWxsLCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVNZXRob2RDYWxsLCBTYWZlUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge0JvdW5kQXR0cmlidXRlLCBCb3VuZEV2ZW50LCBCb3VuZFRleHQsIENvbnRlbnQsIEVsZW1lbnQsIEljdSwgTm9kZSwgUmVmZXJlbmNlLCBUZW1wbGF0ZSwgVGV4dCwgVGV4dEF0dHJpYnV0ZSwgVmFyaWFibGUsIFZpc2l0b3J9IGZyb20gJy4uL3IzX2FzdCc7XG5cbmltcG9ydCB7Qm91bmRUYXJnZXQsIERpcmVjdGl2ZU1ldGEsIFRhcmdldCwgVGFyZ2V0QmluZGVyfSBmcm9tICcuL3QyX2FwaSc7XG5pbXBvcnQge2dldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmd9IGZyb20gJy4vdXRpbCc7XG5cblxuLyoqXG4gKiBQcm9jZXNzZXMgYFRhcmdldGBzIHdpdGggYSBnaXZlbiBzZXQgb2YgZGlyZWN0aXZlcyBhbmQgcGVyZm9ybXMgYSBiaW5kaW5nIG9wZXJhdGlvbiwgd2hpY2hcbiAqIHJldHVybnMgYW4gb2JqZWN0IHNpbWlsYXIgdG8gVHlwZVNjcmlwdCdzIGB0cy5UeXBlQ2hlY2tlcmAgdGhhdCBjb250YWlucyBrbm93bGVkZ2UgYWJvdXQgdGhlXG4gKiB0YXJnZXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM1RhcmdldEJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBUYXJnZXRCaW5kZXI8RGlyZWN0aXZlVD4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUPikge31cblxuICAvKipcbiAgICogUGVyZm9ybSBhIGJpbmRpbmcgb3BlcmF0aW9uIG9uIHRoZSBnaXZlbiBgVGFyZ2V0YCBhbmQgcmV0dXJuIGEgYEJvdW5kVGFyZ2V0YCB3aGljaCBjb250YWluc1xuICAgKiBtZXRhZGF0YSBhYm91dCB0aGUgdHlwZXMgcmVmZXJlbmNlZCBpbiB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBiaW5kKHRhcmdldDogVGFyZ2V0KTogQm91bmRUYXJnZXQ8RGlyZWN0aXZlVD4ge1xuICAgIGlmICghdGFyZ2V0LnRlbXBsYXRlKSB7XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IGhhbmRsZSB0YXJnZXRzIHdoaWNoIGNvbnRhaW4gdGhpbmdzIGxpa2UgSG9zdEJpbmRpbmdzLCBldGMuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JpbmRpbmcgd2l0aG91dCBhIHRlbXBsYXRlIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG4gICAgfVxuXG4gICAgLy8gRmlyc3QsIHBhcnNlIHRoZSB0ZW1wbGF0ZSBpbnRvIGEgYFNjb3BlYCBzdHJ1Y3R1cmUuIFRoaXMgb3BlcmF0aW9uIGNhcHR1cmVzIHRoZSBzeW50YWN0aWNcbiAgICAvLyBzY29wZXMgaW4gdGhlIHRlbXBsYXRlIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgbGF0ZXIgdXNlLlxuICAgIGNvbnN0IHNjb3BlID0gU2NvcGUuYXBwbHkodGFyZ2V0LnRlbXBsYXRlKTtcblxuICAgIC8vIE5leHQsIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIG9uIHRoZSB0ZW1wbGF0ZSB1c2luZyB0aGUgYERpcmVjdGl2ZUJpbmRlcmAuIFRoaXMgcmV0dXJuczpcbiAgICAvLyAgIC0gZGlyZWN0aXZlczogTWFwIG9mIG5vZGVzIChlbGVtZW50cyAmIG5nLXRlbXBsYXRlcykgdG8gdGhlIGRpcmVjdGl2ZXMgb24gdGhlbS5cbiAgICAvLyAgIC0gYmluZGluZ3M6IE1hcCBvZiBpbnB1dHMsIG91dHB1dHMsIGFuZCBhdHRyaWJ1dGVzIHRvIHRoZSBkaXJlY3RpdmUvZWxlbWVudCB0aGF0IGNsYWltc1xuICAgIC8vICAgICB0aGVtLiBUT0RPKGFseGh1Yik6IGhhbmRsZSBtdWx0aXBsZSBkaXJlY3RpdmVzIGNsYWltaW5nIGFuIGlucHV0L291dHB1dC9ldGMuXG4gICAgLy8gICAtIHJlZmVyZW5jZXM6IE1hcCBvZiAjcmVmZXJlbmNlcyB0byB0aGVpciB0YXJnZXRzLlxuICAgIGNvbnN0IHtkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlc30gPVxuICAgICAgICBEaXJlY3RpdmVCaW5kZXIuYXBwbHkodGFyZ2V0LnRlbXBsYXRlLCB0aGlzLmRpcmVjdGl2ZU1hdGNoZXIpO1xuICAgIC8vIEZpbmFsbHksIHJ1biB0aGUgVGVtcGxhdGVCaW5kZXIgdG8gYmluZCByZWZlcmVuY2VzLCB2YXJpYWJsZXMsIGFuZCBvdGhlciBlbnRpdGllcyB3aXRoaW4gdGhlXG4gICAgLy8gdGVtcGxhdGUuIFRoaXMgZXh0cmFjdHMgYWxsIHRoZSBtZXRhZGF0YSB0aGF0IGRvZXNuJ3QgZGVwZW5kIG9uIGRpcmVjdGl2ZSBtYXRjaGluZy5cbiAgICBjb25zdCB7ZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCwgdXNlZFBpcGVzfSA9XG4gICAgICAgIFRlbXBsYXRlQmluZGVyLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSwgc2NvcGUpO1xuICAgIHJldHVybiBuZXcgUjNCb3VuZFRhcmdldChcbiAgICAgICAgdGFyZ2V0LCBkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcywgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCwgdXNlZFBpcGVzKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBiaW5kaW5nIHNjb3BlIHdpdGhpbiBhIHRlbXBsYXRlLlxuICpcbiAqIEFueSB2YXJpYWJsZXMsIHJlZmVyZW5jZXMsIG9yIG90aGVyIG5hbWVkIGVudGl0aWVzIGRlY2xhcmVkIHdpdGhpbiB0aGUgdGVtcGxhdGUgd2lsbFxuICogYmUgY2FwdHVyZWQgYW5kIGF2YWlsYWJsZSBieSBuYW1lIGluIGBuYW1lZEVudGl0aWVzYC4gQWRkaXRpb25hbGx5LCBjaGlsZCB0ZW1wbGF0ZXMgd2lsbFxuICogYmUgYW5hbHl6ZWQgYW5kIGhhdmUgdGhlaXIgY2hpbGQgYFNjb3BlYHMgYXZhaWxhYmxlIGluIGBjaGlsZFNjb3Blc2AuXG4gKi9cbmNsYXNzIFNjb3BlIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIC8qKlxuICAgKiBOYW1lZCBtZW1iZXJzIG9mIHRoZSBgU2NvcGVgLCBzdWNoIGFzIGBSZWZlcmVuY2VgcyBvciBgVmFyaWFibGVgcy5cbiAgICovXG4gIHJlYWRvbmx5IG5hbWVkRW50aXRpZXMgPSBuZXcgTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPigpO1xuXG4gIC8qKlxuICAgKiBDaGlsZCBgU2NvcGVgcyBmb3IgaW1tZWRpYXRlbHkgbmVzdGVkIGBUZW1wbGF0ZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgY2hpbGRTY29wZXMgPSBuZXcgTWFwPFRlbXBsYXRlLCBTY29wZT4oKTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHBhcmVudFNjb3BlPzogU2NvcGUpIHt9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSAoZWl0aGVyIGFzIGEgYFRlbXBsYXRlYCBzdWItdGVtcGxhdGUgd2l0aCB2YXJpYWJsZXMsIG9yIGEgcGxhaW4gYXJyYXkgb2ZcbiAgICogdGVtcGxhdGUgYE5vZGVgcykgYW5kIGNvbnN0cnVjdCBpdHMgYFNjb3BlYC5cbiAgICovXG4gIHN0YXRpYyBhcHBseSh0ZW1wbGF0ZTogVGVtcGxhdGV8Tm9kZVtdKTogU2NvcGUge1xuICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlKCk7XG4gICAgc2NvcGUuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHByb2Nlc3MgdGhlIHRlbXBsYXRlIGFuZCBwb3B1bGF0ZSB0aGUgYFNjb3BlYC5cbiAgICovXG4gIHByaXZhdGUgaW5nZXN0KHRlbXBsYXRlOiBUZW1wbGF0ZXxOb2RlW10pOiB2b2lkIHtcbiAgICBpZiAodGVtcGxhdGUgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgLy8gVmFyaWFibGVzIG9uIGFuIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIGlubmVyIHNjb3BlLlxuICAgICAgdGVtcGxhdGUudmFyaWFibGVzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0VmFyaWFibGUobm9kZSkpO1xuXG4gICAgICAvLyBQcm9jZXNzIHRoZSBub2RlcyBvZiB0aGUgdGVtcGxhdGUuXG4gICAgICB0ZW1wbGF0ZS5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vIG92ZXJhcmNoaW5nIGBUZW1wbGF0ZWAgaW5zdGFuY2UsIHNvIHByb2Nlc3MgdGhlIG5vZGVzIGRpcmVjdGx5LlxuICAgICAgdGVtcGxhdGUuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KSB7XG4gICAgLy8gYEVsZW1lbnRgcyBpbiB0aGUgdGVtcGxhdGUgbWF5IGhhdmUgYFJlZmVyZW5jZWBzIHdoaWNoIGFyZSBjYXB0dXJlZCBpbiB0aGUgc2NvcGUuXG4gICAgZWxlbWVudC5yZWZlcmVuY2VzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgYEVsZW1lbnRgJ3MgY2hpbGRyZW4uXG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSkge1xuICAgIC8vIFJlZmVyZW5jZXMgb24gYSA8bmctdGVtcGxhdGU+IGFyZSBkZWZpbmVkIGluIHRoZSBvdXRlciBzY29wZSwgc28gY2FwdHVyZSB0aGVtIGJlZm9yZVxuICAgIC8vIHByb2Nlc3NpbmcgdGhlIHRlbXBsYXRlJ3MgY2hpbGQgc2NvcGUuXG4gICAgdGVtcGxhdGUucmVmZXJlbmNlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFJlZmVyZW5jZShub2RlKSk7XG5cbiAgICAvLyBOZXh0LCBjcmVhdGUgYW4gaW5uZXIgc2NvcGUgYW5kIHByb2Nlc3MgdGhlIHRlbXBsYXRlIHdpdGhpbiBpdC5cbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSh0aGlzKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHRoaXMuY2hpbGRTY29wZXMuc2V0KHRlbXBsYXRlLCBzY29wZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUodmFyaWFibGUpO1xuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHJlZmVyZW5jZSk7XG4gIH1cblxuICAvLyBVbnVzZWQgdmlzaXRvcnMuXG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHI6IEJvdW5kQXR0cmlidXRlKSB7fVxuICB2aXNpdEJvdW5kRXZlbnQoZXZlbnQ6IEJvdW5kRXZlbnQpIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCkge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdEljdShpY3U6IEljdSkge31cblxuICBwcml2YXRlIG1heWJlRGVjbGFyZSh0aGluZzogUmVmZXJlbmNlfFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSBzb21ldGhpbmcgd2l0aCBhIG5hbWUsIGFzIGxvbmcgYXMgdGhhdCBuYW1lIGlzbid0IHRha2VuLlxuICAgIGlmICghdGhpcy5uYW1lZEVudGl0aWVzLmhhcyh0aGluZy5uYW1lKSkge1xuICAgICAgdGhpcy5uYW1lZEVudGl0aWVzLnNldCh0aGluZy5uYW1lLCB0aGluZyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgdXAgYSB2YXJpYWJsZSB3aXRoaW4gdGhpcyBgU2NvcGVgLlxuICAgKlxuICAgKiBUaGlzIGNhbiByZWN1cnNlIGludG8gYSBwYXJlbnQgYFNjb3BlYCBpZiBpdCdzIGF2YWlsYWJsZS5cbiAgICovXG4gIGxvb2t1cChuYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgaWYgKHRoaXMubmFtZWRFbnRpdGllcy5oYXMobmFtZSkpIHtcbiAgICAgIC8vIEZvdW5kIGluIHRoZSBsb2NhbCBzY29wZS5cbiAgICAgIHJldHVybiB0aGlzLm5hbWVkRW50aXRpZXMuZ2V0KG5hbWUpICE7XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFNjb3BlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIE5vdCBpbiB0aGUgbG9jYWwgc2NvcGUsIGJ1dCB0aGVyZSdzIGEgcGFyZW50IHNjb3BlIHNvIGNoZWNrIHRoZXJlLlxuICAgICAgcmV0dXJuIHRoaXMucGFyZW50U2NvcGUubG9va3VwKG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBdCB0aGUgdG9wIGxldmVsIGFuZCBpdCB3YXNuJ3QgZm91bmQuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjaGlsZCBzY29wZSBmb3IgYSBgVGVtcGxhdGVgLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBhbHdheXMgYmUgZGVmaW5lZC5cbiAgICovXG4gIGdldENoaWxkU2NvcGUodGVtcGxhdGU6IFRlbXBsYXRlKTogU2NvcGUge1xuICAgIGNvbnN0IHJlcyA9IHRoaXMuY2hpbGRTY29wZXMuZ2V0KHRlbXBsYXRlKTtcbiAgICBpZiAocmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uIGVycm9yOiBjaGlsZCBzY29wZSBmb3IgJHt0ZW1wbGF0ZX0gbm90IGZvdW5kYCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgbWF0Y2hlcyBkaXJlY3RpdmVzIG9uIG5vZGVzIChlbGVtZW50cyBhbmQgdGVtcGxhdGVzKS5cbiAqXG4gKiBVc3VhbGx5IHVzZWQgdmlhIHRoZSBzdGF0aWMgYGFwcGx5KClgIG1ldGhvZC5cbiAqL1xuY2xhc3MgRGlyZWN0aXZlQmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgbWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVQ+LFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4pIHt9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSAobGlzdCBvZiBgTm9kZWBzKSBhbmQgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgYWdhaW5zdCBlYWNoIG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZSB0aGUgbGlzdCBvZiB0ZW1wbGF0ZSBgTm9kZWBzIHRvIG1hdGNoIChyZWN1cnNpdmVseSkuXG4gICAqIEBwYXJhbSBzZWxlY3Rvck1hdGNoZXIgYSBgU2VsZWN0b3JNYXRjaGVyYCBjb250YWluaW5nIHRoZSBkaXJlY3RpdmVzIHRoYXQgYXJlIGluIHNjb3BlIGZvclxuICAgKiB0aGlzIHRlbXBsYXRlLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gaW5mb3JtYXRpb24gYWJvdXQgZGlyZWN0aXZlcyBpbiB0aGUgdGVtcGxhdGU6IHRoZVxuICAgKiBgZGlyZWN0aXZlc2AgbWFwIHdoaWNoIGxpc3RzIGRpcmVjdGl2ZXMgbWF0Y2hlZCBvbiBlYWNoIG5vZGUsIHRoZSBgYmluZGluZ3NgIG1hcCB3aGljaFxuICAgKiBpbmRpY2F0ZXMgd2hpY2ggZGlyZWN0aXZlcyBjbGFpbWVkIHdoaWNoIGJpbmRpbmdzIChpbnB1dHMsIG91dHB1dHMsIGV0YyksIGFuZCB0aGUgYHJlZmVyZW5jZXNgXG4gICAqIG1hcCB3aGljaCByZXNvbHZlcyAjcmVmZXJlbmNlcyAoYFJlZmVyZW5jZWBzKSB3aXRoaW4gdGhlIHRlbXBsYXRlIHRvIHRoZSBuYW1lZCBkaXJlY3RpdmUgb3JcbiAgICogdGVtcGxhdGUgbm9kZS5cbiAgICovXG4gIHN0YXRpYyBhcHBseTxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4oXG4gICAgICB0ZW1wbGF0ZTogTm9kZVtdLCBzZWxlY3Rvck1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUPik6IHtcbiAgICBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICByZWZlcmVuY2VzOiBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50fFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPixcbiAgfSB7XG4gICAgY29uc3QgZGlyZWN0aXZlcyA9IG5ldyBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPigpO1xuICAgIGNvbnN0IGJpbmRpbmdzID1cbiAgICAgICAgbmV3IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCByZWZlcmVuY2VzID1cbiAgICAgICAgbmV3IE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnQgfCBUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IERpcmVjdGl2ZUJpbmRlcihzZWxlY3Rvck1hdGNoZXIsIGRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzKTtcbiAgICBtYXRjaGVyLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHtkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogTm9kZVtdKTogdm9pZCB7IHRlbXBsYXRlLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTsgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7IHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShlbGVtZW50Lm5hbWUsIGVsZW1lbnQpOyB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHsgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKCduZy10ZW1wbGF0ZScsIHRlbXBsYXRlKTsgfVxuXG4gIHZpc2l0RWxlbWVudE9yVGVtcGxhdGUodGFnOiBzdHJpbmcsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBGaXJzdCwgZGV0ZXJtaW5lIHRoZSBIVE1MIHNoYXBlIG9mIHRoZSBub2RlIGZvciB0aGUgcHVycG9zZSBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgLy8gRG8gdGhpcyBieSBidWlsZGluZyB1cCBhIGBDc3NTZWxlY3RvcmAgZm9yIHRoZSBub2RlLlxuICAgIGNvbnN0IGNzc1NlbGVjdG9yID0gbmV3IENzc1NlbGVjdG9yKCk7XG4gICAgY3NzU2VsZWN0b3Iuc2V0RWxlbWVudCh0YWcpO1xuXG4gICAgLy8gQWRkIGF0dHJpYnV0ZXMgdG8gdGhlIENTUyBzZWxlY3Rvci5cbiAgICBjb25zdCBhdHRycyA9IGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcobm9kZSk7XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cnMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXR0cnNbbmFtZV07XG5cbiAgICAgIGNzc1NlbGVjdG9yLmFkZEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG5cbiAgICAgIC8vIFRyZWF0IHRoZSAnY2xhc3MnIGF0dHJpYnV0ZSBzcGVjaWFsbHkuXG4gICAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSAnY2xhc3MnKSB7XG4gICAgICAgIGNvbnN0IGNsYXNzZXMgPSB2YWx1ZS50cmltKCkuc3BsaXQoL1xccysvZyk7XG4gICAgICAgIGNsYXNzZXMuZm9yRWFjaChjbGFzc05hbWUgPT4gY3NzU2VsZWN0b3IuYWRkQ2xhc3NOYW1lKGNsYXNzTmFtZSkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTmV4dCwgdXNlIHRoZSBgU2VsZWN0b3JNYXRjaGVyYCB0byBnZXQgdGhlIGxpc3Qgb2YgZGlyZWN0aXZlcyBvbiB0aGUgbm9kZS5cbiAgICBjb25zdCBkaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10gPSBbXTtcbiAgICB0aGlzLm1hdGNoZXIubWF0Y2goY3NzU2VsZWN0b3IsIChfLCBkaXJlY3RpdmUpID0+IGRpcmVjdGl2ZXMucHVzaChkaXJlY3RpdmUpKTtcbiAgICBpZiAoZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXMuc2V0KG5vZGUsIGRpcmVjdGl2ZXMpO1xuICAgIH1cblxuICAgIC8vIFJlc29sdmUgYW55IHJlZmVyZW5jZXMgdGhhdCBhcmUgY3JlYXRlZCBvbiB0aGlzIG5vZGUuXG4gICAgbm9kZS5yZWZlcmVuY2VzLmZvckVhY2gocmVmID0+IHtcbiAgICAgIGxldCBkaXJUYXJnZXQ6IERpcmVjdGl2ZVR8bnVsbCA9IG51bGw7XG5cbiAgICAgIC8vIElmIHRoZSByZWZlcmVuY2UgZXhwcmVzc2lvbiBpcyBlbXB0eSwgdGhlbiBpdCBtYXRjaGVzIHRoZSBcInByaW1hcnlcIiBkaXJlY3RpdmUgb24gdGhlIG5vZGVcbiAgICAgIC8vIChpZiB0aGVyZSBpcyBvbmUpLiBPdGhlcndpc2UgaXQgbWF0Y2hlcyB0aGUgaG9zdCBub2RlIGl0c2VsZiAoZWl0aGVyIGFuIGVsZW1lbnQgb3JcbiAgICAgIC8vIDxuZy10ZW1wbGF0ZT4gbm9kZSkuXG4gICAgICBpZiAocmVmLnZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgLy8gVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbXBvbmVudCBpZiB0aGVyZSBpcyBvbmUuXG4gICAgICAgIGRpclRhcmdldCA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLmlzQ29tcG9uZW50KSB8fCBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBkaXJlY3RpdmUgZXhwb3J0ZWQgdmlhIGV4cG9ydEFzLlxuICAgICAgICBkaXJUYXJnZXQgPVxuICAgICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgICAgIGRpciA9PiBkaXIuZXhwb3J0QXMgIT09IG51bGwgJiYgZGlyLmV4cG9ydEFzLnNvbWUodmFsdWUgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSkpIHx8XG4gICAgICAgICAgICBudWxsO1xuICAgICAgICAvLyBDaGVjayBpZiBhIG1hdGNoaW5nIGRpcmVjdGl2ZSB3YXMgZm91bmQuXG4gICAgICAgIGlmIChkaXJUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBObyBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kIC0gdGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGFuIHVua25vd24gdGFyZ2V0LiBMZWF2ZSBpdFxuICAgICAgICAgIC8vIHVubWFwcGVkLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGlyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhIGRpcmVjdGl2ZS5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIHtkaXJlY3RpdmU6IGRpclRhcmdldCwgbm9kZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIHRoZSBub2RlIGl0c2VsZi5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIGF0dHJpYnV0ZXMvYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuICAgIGNvbnN0IHByb2Nlc3NBdHRyaWJ1dGUgPSAoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQgfCBUZXh0QXR0cmlidXRlKSA9PiB7XG4gICAgICBsZXQgZGlyID0gZGlyZWN0aXZlcy5maW5kKGRpciA9PiBkaXIuaW5wdXRzLmhhc093blByb3BlcnR5KGF0dHJpYnV0ZS5uYW1lKSk7XG4gICAgICBpZiAoZGlyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXR0cmlidXRlLCBkaXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXR0cmlidXRlLCBub2RlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIG5vZGUuYXR0cmlidXRlcy5mb3JFYWNoKHByb2Nlc3NBdHRyaWJ1dGUpO1xuICAgIG5vZGUuaW5wdXRzLmZvckVhY2gocHJvY2Vzc0F0dHJpYnV0ZSk7XG4gICAgbm9kZS5vdXRwdXRzLmZvckVhY2gocHJvY2Vzc0F0dHJpYnV0ZSk7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgbm9kZS50ZW1wbGF0ZUF0dHJzLmZvckVhY2gocHJvY2Vzc0F0dHJpYnV0ZSk7XG4gICAgfVxuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBub2RlJ3MgY2hpbGRyZW4uXG4gICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlT3JFdmVudChub2RlOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gKlxuICogVGhpcyBpcyBhIGNvbXBhbmlvbiB0byB0aGUgYERpcmVjdGl2ZUJpbmRlcmAgdGhhdCBkb2Vzbid0IHJlcXVpcmUga25vd2xlZGdlIG9mIGRpcmVjdGl2ZXMgbWF0Y2hlZFxuICogd2l0aGluIHRoZSB0ZW1wbGF0ZSBpbiBvcmRlciB0byBvcGVyYXRlLlxuICpcbiAqIEV4cHJlc3Npb25zIGFyZSB2aXNpdGVkIGJ5IHRoZSBzdXBlcmNsYXNzIGBSZWN1cnNpdmVBc3RWaXNpdG9yYCwgd2l0aCBjdXN0b20gbG9naWMgcHJvdmlkZWRcbiAqIGJ5IG92ZXJyaWRkZW4gbWV0aG9kcyBmcm9tIHRoYXQgdmlzaXRvci5cbiAqL1xuY2xhc3MgVGVtcGxhdGVCaW5kZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIHByaXZhdGUgdmlzaXROb2RlOiAobm9kZTogTm9kZSkgPT4gdm9pZDtcblxuICBwcml2YXRlIHBpcGVzVXNlZDogc3RyaW5nW10gPSBbXTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LCBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFRlbXBsYXRlLCBudW1iZXI+LCBwcml2YXRlIHNjb3BlOiBTY29wZSxcbiAgICAgIHByaXZhdGUgdGVtcGxhdGU6IFRlbXBsYXRlfG51bGwsIHByaXZhdGUgbGV2ZWw6IG51bWJlcikge1xuICAgIHN1cGVyKCk7XG5cbiAgICAvLyBTYXZlIGEgYml0IG9mIHByb2Nlc3NpbmcgdGltZSBieSBjb25zdHJ1Y3RpbmcgdGhpcyBjbG9zdXJlIGluIGFkdmFuY2UuXG4gICAgdGhpcy52aXNpdE5vZGUgPSAobm9kZTogTm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGUgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZSB0byBwcm9jZXNzXG4gICAqIEBwYXJhbSBzY29wZSB0aGUgYFNjb3BlYCBvZiB0aGUgdGVtcGxhdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gbWV0YWRhdGEgYWJvdXQgdGhlIHRlbXBsYXRlOiBgZXhwcmVzc2lvbnNgIHdoaWNoIGludGVycHJldHNcbiAgICogc3BlY2lhbCBgQVNUYCBub2RlcyBpbiBleHByZXNzaW9ucyBhcyBwb2ludGluZyB0byByZWZlcmVuY2VzIG9yIHZhcmlhYmxlcyBkZWNsYXJlZCB3aXRoaW4gdGhlXG4gICAqIHRlbXBsYXRlLCBgc3ltYm9sc2Agd2hpY2ggbWFwcyB0aG9zZSB2YXJpYWJsZXMgYW5kIHJlZmVyZW5jZXMgdG8gdGhlIG5lc3RlZCBgVGVtcGxhdGVgIHdoaWNoXG4gICAqIGRlY2xhcmVzIHRoZW0sIGlmIGFueSwgYW5kIGBuZXN0aW5nTGV2ZWxgIHdoaWNoIGFzc29jaWF0ZXMgZWFjaCBgVGVtcGxhdGVgIHdpdGggYSBpbnRlZ2VyXG4gICAqIG5lc3RpbmcgbGV2ZWwgKGhvdyBtYW55IGxldmVscyBkZWVwIHdpdGhpbiB0aGUgdGVtcGxhdGUgc3RydWN0dXJlIHRoZSBgVGVtcGxhdGVgIGlzKSwgc3RhcnRpbmdcbiAgICogYXQgMS5cbiAgICovXG4gIHN0YXRpYyBhcHBseSh0ZW1wbGF0ZTogTm9kZVtdLCBzY29wZTogU2NvcGUpOiB7XG4gICAgZXhwcmVzc2lvbnM6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgc3ltYm9sczogTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+LFxuICAgIG5lc3RpbmdMZXZlbDogTWFwPFRlbXBsYXRlLCBudW1iZXI+LFxuICAgIHVzZWRQaXBlczogU2V0PHN0cmluZz4sXG4gIH0ge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gbmV3IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4oKTtcbiAgICBjb25zdCBzeW1ib2xzID0gbmV3IE1hcDxWYXJpYWJsZXxSZWZlcmVuY2UsIFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IG5lc3RpbmdMZXZlbCA9IG5ldyBNYXA8VGVtcGxhdGUsIG51bWJlcj4oKTtcbiAgICBjb25zdCB1c2VkUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAvLyBUaGUgdG9wLWxldmVsIHRlbXBsYXRlIGhhcyBuZXN0aW5nIGxldmVsIDAuXG4gICAgY29uc3QgYmluZGVyID0gbmV3IFRlbXBsYXRlQmluZGVyKFxuICAgICAgICBleHByZXNzaW9ucywgc3ltYm9scywgdXNlZFBpcGVzLCBuZXN0aW5nTGV2ZWwsIHNjb3BlLFxuICAgICAgICB0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlID8gdGVtcGxhdGUgOiBudWxsLCAwKTtcbiAgICBiaW5kZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHVzZWRQaXBlc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogVGVtcGxhdGV8Tm9kZVtdKTogdm9pZCB7XG4gICAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIC8vIEZvciA8bmctdGVtcGxhdGU+cywgcHJvY2VzcyBvbmx5IHZhcmlhYmxlcyBhbmQgY2hpbGQgbm9kZXMuIElucHV0cywgb3V0cHV0cywgdGVtcGxhdGVBdHRycyxcbiAgICAgIC8vIGFuZCByZWZlcmVuY2VzIHdlcmUgYWxsIHByb2Nlc3NlZCBpbiB0aGUgc2NvcGUgb2YgdGhlIGNvbnRhaW5pbmcgdGVtcGxhdGUuXG4gICAgICB0ZW1wbGF0ZS52YXJpYWJsZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgICB0ZW1wbGF0ZS5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcblxuICAgICAgLy8gU2V0IHRoZSBuZXN0aW5nIGxldmVsLlxuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KHRlbXBsYXRlLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVmlzaXQgZWFjaCBub2RlIGZyb20gdGhlIHRvcC1sZXZlbCB0ZW1wbGF0ZS5cbiAgICAgIHRlbXBsYXRlLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KSB7XG4gICAgLy8gVmlzaXQgdGhlIGlucHV0cywgb3V0cHV0cywgYW5kIGNoaWxkcmVuIG9mIHRoZSBlbGVtZW50LlxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIGVsZW1lbnQub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50LmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICAvLyBGaXJzdCwgdmlzaXQgaW5wdXRzLCBvdXRwdXRzIGFuZCB0ZW1wbGF0ZSBhdHRyaWJ1dGVzIG9mIHRoZSB0ZW1wbGF0ZSBub2RlLlxuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS5vdXRwdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAvLyBSZWZlcmVuY2VzIGFyZSBhbHNvIGV2YWx1YXRlZCBpbiB0aGUgb3V0ZXIgY29udGV4dC5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZSB1c2luZyBpdHMgc2NvcGUsIGFuZCBidW1waW5nIHRoZSBuZXN0aW5nIGxldmVsIHVwIGJ5IG9uZS5cbiAgICBjb25zdCBjaGlsZFNjb3BlID0gdGhpcy5zY29wZS5nZXRDaGlsZFNjb3BlKHRlbXBsYXRlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy51c2VkUGlwZXMsIHRoaXMubmVzdGluZ0xldmVsLCBjaGlsZFNjb3BlLCB0ZW1wbGF0ZSxcbiAgICAgICAgdGhpcy5sZXZlbCArIDEpO1xuICAgIGJpbmRlci5pbmdlc3QodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFZhcmlhYmxlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHZhcmlhYmxlLCB0aGlzLnRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgUmVmZXJlbmNlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHJlZmVyZW5jZSwgdGhpcy50ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW51c2VkIHRlbXBsYXRlIHZpc2l0b3JzXG5cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cblxuICAvLyBUaGUgcmVtYWluaW5nIHZpc2l0b3JzIGFyZSBjb25jZXJuZWQgd2l0aCBwcm9jZXNzaW5nIEFTVCBleHByZXNzaW9ucyB3aXRoaW4gdGVtcGxhdGUgYmluZGluZ3NcblxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpIHsgYXR0cmlidXRlLnZhbHVlLnZpc2l0KHRoaXMpOyB9XG5cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7IGV2ZW50LmhhbmRsZXIudmlzaXQodGhpcyk7IH1cblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHsgdGV4dC52YWx1ZS52aXNpdCh0aGlzKTsgfVxuICB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnVzZWRQaXBlcy5hZGQoYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFBpcGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIC8vIFRoZXNlIGZpdmUgdHlwZXMgb2YgQVNUIGV4cHJlc3Npb25zIGNhbiByZWZlciB0byBleHByZXNzaW9uIHJvb3RzLCB3aGljaCBjb3VsZCBiZSB2YXJpYWJsZXNcbiAgLy8gb3IgcmVmZXJlbmNlcyBpbiB0aGUgY3VycmVudCBzY29wZS5cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5tYXliZU1hcChjb250ZXh0LCBhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0TWV0aG9kQ2FsbChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZU1ldGhvZENhbGwoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoXG4gICAgICBzY29wZTogU2NvcGUsIGFzdDogUHJvcGVydHlSZWFkfFNhZmVQcm9wZXJ0eVJlYWR8UHJvcGVydHlXcml0ZXxNZXRob2RDYWxsfFNhZmVNZXRob2RDYWxsLFxuICAgICAgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIHJlY2VpdmVyIG9mIHRoZSBleHByZXNzaW9uIGlzbid0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAsIHRoaXMgaXNuJ3QgdGhlIHJvb3Qgb2YgYW5cbiAgICAvLyBgQVNUYCBleHByZXNzaW9uIHRoYXQgbWFwcyB0byBhIGBWYXJpYWJsZWAgb3IgYFJlZmVyZW5jZWAuXG4gICAgaWYgKCEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBuYW1lIGV4aXN0cyBpbiB0aGUgY3VycmVudCBzY29wZS4gSWYgc28sIG1hcCBpdC4gT3RoZXJ3aXNlLCB0aGUgbmFtZSBpc1xuICAgIC8vIHByb2JhYmx5IGEgcHJvcGVydHkgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAgICBsZXQgdGFyZ2V0ID0gdGhpcy5zY29wZS5sb29rdXAobmFtZSk7XG4gICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXN0LCB0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ldGFkYXRhIGNvbnRhaW5lciBmb3IgYSBgVGFyZ2V0YCB0aGF0IGFsbG93cyBxdWVyaWVzIGZvciBzcGVjaWZpYyBiaXRzIG9mIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBgQm91bmRUYXJnZXRgIGZvciBkb2N1bWVudGF0aW9uIG9uIHRoZSBpbmRpdmlkdWFsIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0JvdW5kVGFyZ2V0PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFRhcmdldCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8UmVmZXJlbmNlfFRleHRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+KSB7fVxuXG4gIGdldERpcmVjdGl2ZXNPZk5vZGUobm9kZTogRWxlbWVudHxUZW1wbGF0ZSk6IERpcmVjdGl2ZVRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5kaXJlY3RpdmVzLmdldChub2RlKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZjogUmVmZXJlbmNlKToge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZXMuZ2V0KHJlZikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldENvbnN1bWVyT2ZCaW5kaW5nKGJpbmRpbmc6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSk6IERpcmVjdGl2ZVR8RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdzLmdldChiaW5kaW5nKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvblRhcmdldChleHByOiBBU1QpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZXhwclRhcmdldHMuZ2V0KGV4cHIpIHx8IG51bGw7XG4gIH1cblxuICBnZXRUZW1wbGF0ZU9mU3ltYm9sKHN5bWJvbDogUmVmZXJlbmNlfFZhcmlhYmxlKTogVGVtcGxhdGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9scy5nZXQoc3ltYm9sKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0TmVzdGluZ0xldmVsKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IG51bWJlciB7IHJldHVybiB0aGlzLm5lc3RpbmdMZXZlbC5nZXQodGVtcGxhdGUpIHx8IDA7IH1cblxuICBnZXRVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4oKTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJzID0+IGRpcnMuZm9yRWFjaChkaXIgPT4gc2V0LmFkZChkaXIpKSk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBzdHJpbmdbXSB7IHJldHVybiBBcnJheS5mcm9tKHRoaXMudXNlZFBpcGVzKTsgfVxufVxuIl19