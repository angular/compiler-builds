/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { ImplicitReceiver, RecursiveAstVisitor } from '../../expression_parser/ast';
import { CssSelector } from '../../selector';
import { Template } from '../r3_ast';
import { getAttrsForDirectiveMatching } from './util';
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
export { R3TargetBinder };
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
        if (template instanceof Template) {
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
        var cssSelector = new CssSelector();
        cssSelector.setElement(tag);
        // Add attributes to the CSS selector.
        var attrs = getAttrsForDirectiveMatching(node);
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
        var binder = new TemplateBinder(expressions, symbols, nestingLevel, scope, template instanceof Template ? template : null, 0);
        binder.ingest(template);
        return { expressions: expressions, symbols: symbols, nestingLevel: nestingLevel };
    };
    TemplateBinder.prototype.ingest = function (template) {
        if (template instanceof Template) {
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
        if (!(ast.receiver instanceof ImplicitReceiver)) {
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
}(RecursiveAstVisitor));
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
export { R3BoundTarget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOztBQUVILE9BQU8sRUFBTSxnQkFBZ0IsRUFBMkMsbUJBQW1CLEVBQW1DLE1BQU0sNkJBQTZCLENBQUM7QUFDbEssT0FBTyxFQUFDLFdBQVcsRUFBa0IsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1RCxPQUFPLEVBQWdGLFFBQVEsRUFBeUMsTUFBTSxXQUFXLENBQUM7QUFHMUosT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXBEOzs7O0dBSUc7QUFDSDtJQUNFLHdCQUFvQixnQkFBNkM7UUFBN0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUE2QjtJQUFHLENBQUM7SUFFckU7OztPQUdHO0lBQ0gsNkJBQUksR0FBSixVQUFLLE1BQWM7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsNEVBQTRFO1lBQzVFLE1BQU0sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztTQUNqRTtRQUVELDRGQUE0RjtRQUM1RixpRUFBaUU7UUFDakUsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0MsOEZBQThGO1FBQzlGLG9GQUFvRjtRQUNwRiw0RkFBNEY7UUFDNUYsbUZBQW1GO1FBQ25GLHVEQUF1RDtRQUNqRCxJQUFBLGtFQUMyRCxFQUQxRCwwQkFBVSxFQUFFLHNCQUFRLEVBQUUsMEJBQ29DLENBQUM7UUFDbEUsK0ZBQStGO1FBQy9GLHNGQUFzRjtRQUNoRixJQUFBLGlEQUFtRixFQUFsRiw0QkFBVyxFQUFFLG9CQUFPLEVBQUUsOEJBQTRELENBQUM7UUFDMUYsT0FBTyxJ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SUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzVDLENBQUM7SUFFRCwyQ0FBbUIsR0FBbkIsVUFBb0IsSUFBUztRQUMzQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztJQUM1QyxDQUFDO0lBRUQsMkNBQW1CLEdBQW5CLFVBQW9CLE1BQTBCO1FBQzVDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFFRCx1Q0FBZSxHQUFmLFVBQWdCLFFBQWtCLElBQVksT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVGLHlDQUFpQixHQUFqQjtRQUNFLElBQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFjLENBQUM7UUFDbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBWixDQUFZLENBQUMsRUFBakMsQ0FBaUMsQ0FBQyxDQUFDO1FBQ25FLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBQ0gsb0JBQUM7QUFBRCxDQUFDLEFBeENELElBd0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVCwgSW1wbGljaXRSZWNlaXZlciwgTWV0aG9kQ2FsbCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlTWV0aG9kQ2FsbCwgU2FmZVByb3BlcnR5UmVhZH0gZnJvbSAnLi4vLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCB7Q3NzU2VsZWN0b3IsIFNlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCb3VuZEF0dHJpYnV0ZSwgQm91bmRFdmVudCwgQm91bmRUZXh0LCBDb250ZW50LCBFbGVtZW50LCBJY3UsIE5vZGUsIFJlZmVyZW5jZSwgVGVtcGxhdGUsIFRleHQsIFRleHRBdHRyaWJ1dGUsIFZhcmlhYmxlLCBWaXNpdG9yfSBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge0JvdW5kVGFyZ2V0LCBEaXJlY3RpdmVNZXRhLCBUYXJnZXQsIFRhcmdldEJpbmRlcn0gZnJvbSAnLi90Ml9hcGknO1xuaW1wb3J0IHtnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nfSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIFByb2Nlc3NlcyBgVGFyZ2V0YHMgd2l0aCBhIGdpdmVuIHNldCBvZiBkaXJlY3RpdmVzIGFuZCBwZXJmb3JtcyBhIGJpbmRpbmcgb3BlcmF0aW9uLCB3aGljaFxuICogcmV0dXJucyBhbiBvYmplY3Qgc2ltaWxhciB0byBUeXBlU2NyaXB0J3MgYHRzLlR5cGVDaGVja2VyYCB0aGF0IGNvbnRhaW5zIGtub3dsZWRnZSBhYm91dCB0aGVcbiAqIHRhcmdldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFRhcmdldEJpbmRlcjxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVQ+KSB7fVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGEgYmluZGluZyBvcGVyYXRpb24gb24gdGhlIGdpdmVuIGBUYXJnZXRgIGFuZCByZXR1cm4gYSBgQm91bmRUYXJnZXRgIHdoaWNoIGNvbnRhaW5zXG4gICAqIG1ldGFkYXRhIGFib3V0IHRoZSB0eXBlcyByZWZlcmVuY2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGJpbmQodGFyZ2V0OiBUYXJnZXQpOiBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gICAgaWYgKCF0YXJnZXQudGVtcGxhdGUpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogaGFuZGxlIHRhcmdldHMgd2hpY2ggY29udGFpbiB0aGluZ3MgbGlrZSBIb3N0QmluZGluZ3MsIGV0Yy5cbiAgICAgIHRocm93IG5ldyBFcnJvcignQmluZGluZyB3aXRob3V0IGEgdGVtcGxhdGUgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCwgcGFyc2UgdGhlIHRlbXBsYXRlIGludG8gYSBgU2NvcGVgIHN0cnVjdHVyZS4gVGhpcyBvcGVyYXRpb24gY2FwdHVyZXMgdGhlIHN5bnRhY3RpY1xuICAgIC8vIHNjb3BlcyBpbiB0aGUgdGVtcGxhdGUgYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciBsYXRlciB1c2UuXG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5hcHBseSh0YXJnZXQudGVtcGxhdGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfSA9XG4gICAgICAgIERpcmVjdGl2ZUJpbmRlci5hcHBseSh0YXJnZXQudGVtcGxhdGUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlcik7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsfSA9IFRlbXBsYXRlQmluZGVyLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSwgc2NvcGUpO1xuICAgIHJldHVybiBuZXcgUjNCb3VuZFRhcmdldChcbiAgICAgICAgdGFyZ2V0LCBkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcywgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgYmluZGluZyBzY29wZSB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBBbnkgdmFyaWFibGVzLCByZWZlcmVuY2VzLCBvciBvdGhlciBuYW1lZCBlbnRpdGllcyBkZWNsYXJlZCB3aXRoaW4gdGhlIHRlbXBsYXRlIHdpbGxcbiAqIGJlIGNhcHR1cmVkIGFuZCBhdmFpbGFibGUgYnkgbmFtZSBpbiBgbmFtZWRFbnRpdGllc2AuIEFkZGl0aW9uYWxseSwgY2hpbGQgdGVtcGxhdGVzIHdpbGxcbiAqIGJlIGFuYWx5emVkIGFuZCBoYXZlIHRoZWlyIGNoaWxkIGBTY29wZWBzIGF2YWlsYWJsZSBpbiBgY2hpbGRTY29wZXNgLlxuICovXG5jbGFzcyBTY29wZSBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvKipcbiAgICogTmFtZWQgbWVtYmVycyBvZiB0aGUgYFNjb3BlYCwgc3VjaCBhcyBgUmVmZXJlbmNlYHMgb3IgYFZhcmlhYmxlYHMuXG4gICAqL1xuICByZWFkb25seSBuYW1lZEVudGl0aWVzID0gbmV3IE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4oKTtcblxuICAvKipcbiAgICogQ2hpbGQgYFNjb3BlYHMgZm9yIGltbWVkaWF0ZWx5IG5lc3RlZCBgVGVtcGxhdGVgcy5cbiAgICovXG4gIHJlYWRvbmx5IGNoaWxkU2NvcGVzID0gbmV3IE1hcDxUZW1wbGF0ZSwgU2NvcGU+KCk7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihyZWFkb25seSBwYXJlbnRTY29wZT86IFNjb3BlKSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGVpdGhlciBhcyBhIGBUZW1wbGF0ZWAgc3ViLXRlbXBsYXRlIHdpdGggdmFyaWFibGVzLCBvciBhIHBsYWluIGFycmF5IG9mXG4gICAqIHRlbXBsYXRlIGBOb2RlYHMpIGFuZCBjb25zdHJ1Y3QgaXRzIGBTY29wZWAuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IFNjb3BlIHtcbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSgpO1xuICAgIHNjb3BlLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHNjb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSBhbmQgcG9wdWxhdGUgdGhlIGBTY29wZWAuXG4gICAqL1xuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogVGVtcGxhdGV8Tm9kZVtdKTogdm9pZCB7XG4gICAgaWYgKHRlbXBsYXRlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIC8vIFZhcmlhYmxlcyBvbiBhbiA8bmctdGVtcGxhdGU+IGFyZSBkZWZpbmVkIGluIHRoZSBpbm5lciBzY29wZS5cbiAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFZhcmlhYmxlKG5vZGUpKTtcblxuICAgICAgLy8gUHJvY2VzcyB0aGUgbm9kZXMgb2YgdGhlIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBvdmVyYXJjaGluZyBgVGVtcGxhdGVgIGluc3RhbmNlLCBzbyBwcm9jZXNzIHRoZSBub2RlcyBkaXJlY3RseS5cbiAgICAgIHRlbXBsYXRlLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIGBFbGVtZW50YHMgaW4gdGhlIHRlbXBsYXRlIG1heSBoYXZlIGBSZWZlcmVuY2VgcyB3aGljaCBhcmUgY2FwdHVyZWQgaW4gdGhlIHNjb3BlLlxuICAgIGVsZW1lbnQucmVmZXJlbmNlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFJlZmVyZW5jZShub2RlKSk7XG5cbiAgICAvLyBSZWN1cnNlIGludG8gdGhlIGBFbGVtZW50YCdzIGNoaWxkcmVuLlxuICAgIGVsZW1lbnQuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICAvLyBSZWZlcmVuY2VzIG9uIGEgPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgb3V0ZXIgc2NvcGUsIHNvIGNhcHR1cmUgdGhlbSBiZWZvcmVcbiAgICAvLyBwcm9jZXNzaW5nIHRoZSB0ZW1wbGF0ZSdzIGNoaWxkIHNjb3BlLlxuICAgIHRlbXBsYXRlLnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgY3JlYXRlIGFuIGlubmVyIHNjb3BlIGFuZCBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSB3aXRoaW4gaXQuXG4gICAgY29uc3Qgc2NvcGUgPSBuZXcgU2NvcGUodGhpcyk7XG4gICAgc2NvcGUuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICB0aGlzLmNoaWxkU2NvcGVzLnNldCh0ZW1wbGF0ZSwgc2NvcGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHZhcmlhYmxlKTtcbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZShyZWZlcmVuY2UpO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyOiBCb3VuZEF0dHJpYnV0ZSkge31cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cjogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpIHt9XG5cbiAgcHJpdmF0ZSBtYXliZURlY2xhcmUodGhpbmc6IFJlZmVyZW5jZXxWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgc29tZXRoaW5nIHdpdGggYSBuYW1lLCBhcyBsb25nIGFzIHRoYXQgbmFtZSBpc24ndCB0YWtlbi5cbiAgICBpZiAoIXRoaXMubmFtZWRFbnRpdGllcy5oYXModGhpbmcubmFtZSkpIHtcbiAgICAgIHRoaXMubmFtZWRFbnRpdGllcy5zZXQodGhpbmcubmFtZSwgdGhpbmcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb29rIHVwIGEgdmFyaWFibGUgd2l0aGluIHRoaXMgYFNjb3BlYC5cbiAgICpcbiAgICogVGhpcyBjYW4gcmVjdXJzZSBpbnRvIGEgcGFyZW50IGBTY29wZWAgaWYgaXQncyBhdmFpbGFibGUuXG4gICAqL1xuICBsb29rdXAobmFtZTogc3RyaW5nKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIGlmICh0aGlzLm5hbWVkRW50aXRpZXMuaGFzKG5hbWUpKSB7XG4gICAgICAvLyBGb3VuZCBpbiB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICByZXR1cm4gdGhpcy5uYW1lZEVudGl0aWVzLmdldChuYW1lKSAhO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRTY29wZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBOb3QgaW4gdGhlIGxvY2FsIHNjb3BlLCBidXQgdGhlcmUncyBhIHBhcmVudCBzY29wZSBzbyBjaGVjayB0aGVyZS5cbiAgICAgIHJldHVybiB0aGlzLnBhcmVudFNjb3BlLmxvb2t1cChuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQXQgdGhlIHRvcCBsZXZlbCBhbmQgaXQgd2Fzbid0IGZvdW5kLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2hpbGQgc2NvcGUgZm9yIGEgYFRlbXBsYXRlYC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYWx3YXlzIGJlIGRlZmluZWQuXG4gICAqL1xuICBnZXRDaGlsZFNjb3BlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IFNjb3BlIHtcbiAgICBjb25zdCByZXMgPSB0aGlzLmNoaWxkU2NvcGVzLmdldCh0ZW1wbGF0ZSk7XG4gICAgaWYgKHJlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBlcnJvcjogY2hpbGQgc2NvcGUgZm9yICR7dGVtcGxhdGV9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIG1hdGNoZXMgZGlyZWN0aXZlcyBvbiBub2RlcyAoZWxlbWVudHMgYW5kIHRlbXBsYXRlcykuXG4gKlxuICogVXN1YWxseSB1c2VkIHZpYSB0aGUgc3RhdGljIGBhcHBseSgpYCBtZXRob2QuXG4gKi9cbmNsYXNzIERpcmVjdGl2ZUJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUPixcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSByZWZlcmVuY2VzOlxuICAgICAgICAgIE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGxpc3Qgb2YgYE5vZGVgcykgYW5kIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIGFnYWluc3QgZWFjaCBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGUgdGhlIGxpc3Qgb2YgdGVtcGxhdGUgYE5vZGVgcyB0byBtYXRjaCAocmVjdXJzaXZlbHkpLlxuICAgKiBAcGFyYW0gc2VsZWN0b3JNYXRjaGVyIGEgYFNlbGVjdG9yTWF0Y2hlcmAgY29udGFpbmluZyB0aGUgZGlyZWN0aXZlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3JcbiAgICogdGhpcyB0ZW1wbGF0ZS5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIGluZm9ybWF0aW9uIGFib3V0IGRpcmVjdGl2ZXMgaW4gdGhlIHRlbXBsYXRlOiB0aGVcbiAgICogYGRpcmVjdGl2ZXNgIG1hcCB3aGljaCBsaXN0cyBkaXJlY3RpdmVzIG1hdGNoZWQgb24gZWFjaCBub2RlLCB0aGUgYGJpbmRpbmdzYCBtYXAgd2hpY2hcbiAgICogaW5kaWNhdGVzIHdoaWNoIGRpcmVjdGl2ZXMgY2xhaW1lZCB3aGljaCBiaW5kaW5ncyAoaW5wdXRzLCBvdXRwdXRzLCBldGMpLCBhbmQgdGhlIGByZWZlcmVuY2VzYFxuICAgKiBtYXAgd2hpY2ggcmVzb2x2ZXMgI3JlZmVyZW5jZXMgKGBSZWZlcmVuY2Vgcykgd2l0aGluIHRoZSB0ZW1wbGF0ZSB0byB0aGUgbmFtZWQgZGlyZWN0aXZlIG9yXG4gICAqIHRlbXBsYXRlIG5vZGUuXG4gICAqL1xuICBzdGF0aWMgYXBwbHk8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+KFxuICAgICAgdGVtcGxhdGU6IE5vZGVbXSwgc2VsZWN0b3JNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVD4pOiB7XG4gICAgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgcmVmZXJlbmNlczogTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gIH0ge1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4oKTtcbiAgICBjb25zdCBiaW5kaW5ncyA9XG4gICAgICAgIG5ldyBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlcyA9XG4gICAgICAgIG5ldyBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBEaXJlY3RpdmVCaW5kZXIoc2VsZWN0b3JNYXRjaGVyLCBkaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcyk7XG4gICAgbWF0Y2hlci5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiB7ZGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IE5vZGVbXSk6IHZvaWQgeyB0ZW1wbGF0ZS5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7IH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IHZvaWQgeyB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoZWxlbWVudC5uYW1lLCBlbGVtZW50KTsgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogdm9pZCB7IHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZSgnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7IH1cblxuICB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKHRhZzogc3RyaW5nLCBub2RlOiBFbGVtZW50fFRlbXBsYXRlKTogdm9pZCB7XG4gICAgLy8gRmlyc3QsIGRldGVybWluZSB0aGUgSFRNTCBzaGFwZSBvZiB0aGUgbm9kZSBmb3IgdGhlIHB1cnBvc2Ugb2YgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIC8vIERvIHRoaXMgYnkgYnVpbGRpbmcgdXAgYSBgQ3NzU2VsZWN0b3JgIGZvciB0aGUgbm9kZS5cbiAgICBjb25zdCBjc3NTZWxlY3RvciA9IG5ldyBDc3NTZWxlY3RvcigpO1xuICAgIGNzc1NlbGVjdG9yLnNldEVsZW1lbnQodGFnKTtcblxuICAgIC8vIEFkZCBhdHRyaWJ1dGVzIHRvIHRoZSBDU1Mgc2VsZWN0b3IuXG4gICAgY29uc3QgYXR0cnMgPSBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpO1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGF0dHJzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF0dHJzW25hbWVdO1xuXG4gICAgICBjc3NTZWxlY3Rvci5hZGRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuXG4gICAgICAvLyBUcmVhdCB0aGUgJ2NsYXNzJyBhdHRyaWJ1dGUgc3BlY2lhbGx5LlxuICAgICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2NsYXNzJykge1xuICAgICAgICBjb25zdCBjbGFzc2VzID0gdmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrL2cpO1xuICAgICAgICBjbGFzc2VzLmZvckVhY2goY2xhc3NOYW1lID0+IGNzc1NlbGVjdG9yLmFkZENsYXNzTmFtZShjbGFzc05hbWUpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE5leHQsIHVzZSB0aGUgYFNlbGVjdG9yTWF0Y2hlcmAgdG8gZ2V0IHRoZSBsaXN0IG9mIGRpcmVjdGl2ZXMgb24gdGhlIG5vZGUuXG4gICAgY29uc3QgZGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgdGhpcy5tYXRjaGVyLm1hdGNoKGNzc1NlbGVjdG9yLCAoXywgZGlyZWN0aXZlKSA9PiBkaXJlY3RpdmVzLnB1c2goZGlyZWN0aXZlKSk7XG4gICAgaWYgKGRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5kaXJlY3RpdmVzLnNldChub2RlLCBkaXJlY3RpdmVzKTtcbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFueSByZWZlcmVuY2VzIHRoYXQgYXJlIGNyZWF0ZWQgb24gdGhpcyBub2RlLlxuICAgIG5vZGUucmVmZXJlbmNlcy5mb3JFYWNoKHJlZiA9PiB7XG4gICAgICBsZXQgZGlyVGFyZ2V0OiBEaXJlY3RpdmVUfG51bGwgPSBudWxsO1xuXG4gICAgICAvLyBJZiB0aGUgcmVmZXJlbmNlIGV4cHJlc3Npb24gaXMgZW1wdHksIHRoZW4gaXQgbWF0Y2hlcyB0aGUgXCJwcmltYXJ5XCIgZGlyZWN0aXZlIG9uIHRoZSBub2RlXG4gICAgICAvLyAoaWYgdGhlcmUgaXMgb25lKS4gT3RoZXJ3aXNlIGl0IG1hdGNoZXMgdGhlIGhvc3Qgbm9kZSBpdHNlbGYgKGVpdGhlciBhbiBlbGVtZW50IG9yXG4gICAgICAvLyA8bmctdGVtcGxhdGU+IG5vZGUpLlxuICAgICAgaWYgKHJlZi52YWx1ZS50cmltKCkgPT09ICcnKSB7XG4gICAgICAgIC8vIFRoaXMgY291bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBjb21wb25lbnQgaWYgdGhlcmUgaXMgb25lLlxuICAgICAgICBkaXJUYXJnZXQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5pc0NvbXBvbmVudCkgfHwgbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgaXMgYSByZWZlcmVuY2UgdG8gYSBkaXJlY3RpdmUgZXhwb3J0ZWQgdmlhIGV4cG9ydEFzLiBPbmUgc2hvdWxkIGV4aXN0LlxuICAgICAgICBkaXJUYXJnZXQgPVxuICAgICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgICAgIGRpciA9PiBkaXIuZXhwb3J0QXMgIT09IG51bGwgJiYgZGlyLmV4cG9ydEFzLnNvbWUodmFsdWUgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSkpIHx8XG4gICAgICAgICAgICBudWxsO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIGEgbWF0Y2hpbmcgZGlyZWN0aXZlIHdhcyBmb3VuZCwgYW5kIGVycm9yIGlmIGl0IHdhc24ndC5cbiAgICAgICAgaWYgKGRpclRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogUmV0dXJuIGFuIGVycm9yIHZhbHVlIGhlcmUgdGhhdCBjYW4gYmUgdXNlZCBmb3IgdGVtcGxhdGUgdmFsaWRhdGlvbi5cbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBlcnJvcjogZmFpbGVkIHRvIGZpbmQgZGlyZWN0aXZlIHdpdGggZXhwb3J0QXM6ICR7cmVmLnZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChkaXJUYXJnZXQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGEgZGlyZWN0aXZlLlxuICAgICAgICB0aGlzLnJlZmVyZW5jZXMuc2V0KHJlZiwge2RpcmVjdGl2ZTogZGlyVGFyZ2V0LCBub2RlfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIHJlZmVyZW5jZSBwb2ludHMgdG8gdGhlIG5vZGUgaXRzZWxmLlxuICAgICAgICB0aGlzLnJlZmVyZW5jZXMuc2V0KHJlZiwgbm9kZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBc3NvY2lhdGUgYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuXG4gICAgLy8gSW5wdXRzOlxuICAgIFsuLi5ub2RlLmF0dHJpYnV0ZXMsIC4uLm5vZGUuaW5wdXRzXS5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgbGV0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLmlucHV0cy5oYXNPd25Qcm9wZXJ0eShiaW5kaW5nLm5hbWUpKTtcbiAgICAgIGlmIChkaXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmJpbmRpbmdzLnNldChiaW5kaW5nLCBkaXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYmluZGluZywgbm9kZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzOlxuICAgIG5vZGUub3V0cHV0cy5mb3JFYWNoKGJpbmRpbmcgPT4ge1xuICAgICAgbGV0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLm91dHB1dHMuaGFzT3duUHJvcGVydHkoYmluZGluZy5uYW1lKSk7XG4gICAgICBpZiAoZGlyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYmluZGluZywgZGlyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGJpbmRpbmcsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBub2RlJ3MgY2hpbGRyZW4uXG4gICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlT3JFdmVudChub2RlOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gKlxuICogVGhpcyBpcyBhIGNvbXBhbmlvbiB0byB0aGUgYERpcmVjdGl2ZUJpbmRlcmAgdGhhdCBkb2Vzbid0IHJlcXVpcmUga25vd2xlZGdlIG9mIGRpcmVjdGl2ZXMgbWF0Y2hlZFxuICogd2l0aGluIHRoZSB0ZW1wbGF0ZSBpbiBvcmRlciB0byBvcGVyYXRlLlxuICpcbiAqIEV4cHJlc3Npb25zIGFyZSB2aXNpdGVkIGJ5IHRoZSBzdXBlcmNsYXNzIGBSZWN1cnNpdmVBc3RWaXNpdG9yYCwgd2l0aCBjdXN0b20gbG9naWMgcHJvdmlkZWRcbiAqIGJ5IG92ZXJyaWRkZW4gbWV0aG9kcyBmcm9tIHRoYXQgdmlzaXRvci5cbiAqL1xuY2xhc3MgVGVtcGxhdGVCaW5kZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIHByaXZhdGUgdmlzaXROb2RlOiAobm9kZTogTm9kZSkgPT4gdm9pZDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIGFuZCBleHRyYWN0IG1ldGFkYXRhIGFib3V0IGV4cHJlc3Npb25zIGFuZCBzeW1ib2xzIHdpdGhpbi5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBub2RlcyBvZiB0aGUgdGVtcGxhdGUgdG8gcHJvY2Vzc1xuICAgKiBAcGFyYW0gc2NvcGUgdGhlIGBTY29wZWAgb2YgdGhlIHRlbXBsYXRlIGJlaW5nIHByb2Nlc3NlZC5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIG1ldGFkYXRhIGFib3V0IHRoZSB0ZW1wbGF0ZTogYGV4cHJlc3Npb25zYCB3aGljaCBpbnRlcnByZXRzXG4gICAqIHNwZWNpYWwgYEFTVGAgbm9kZXMgaW4gZXhwcmVzc2lvbnMgYXMgcG9pbnRpbmcgdG8gcmVmZXJlbmNlcyBvciB2YXJpYWJsZXMgZGVjbGFyZWQgd2l0aGluIHRoZVxuICAgKiB0ZW1wbGF0ZSwgYHN5bWJvbHNgIHdoaWNoIG1hcHMgdGhvc2UgdmFyaWFibGVzIGFuZCByZWZlcmVuY2VzIHRvIHRoZSBuZXN0ZWQgYFRlbXBsYXRlYCB3aGljaFxuICAgKiBkZWNsYXJlcyB0aGVtLCBpZiBhbnksIGFuZCBgbmVzdGluZ0xldmVsYCB3aGljaCBhc3NvY2lhdGVzIGVhY2ggYFRlbXBsYXRlYCB3aXRoIGEgaW50ZWdlclxuICAgKiBuZXN0aW5nIGxldmVsIChob3cgbWFueSBsZXZlbHMgZGVlcCB3aXRoaW4gdGhlIHRlbXBsYXRlIHN0cnVjdHVyZSB0aGUgYFRlbXBsYXRlYCBpcyksIHN0YXJ0aW5nXG4gICAqIGF0IDEuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IE5vZGVbXSwgc2NvcGU6IFNjb3BlKToge1xuICAgIGV4cHJlc3Npb25zOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgIHN5bWJvbHM6IE1hcDxWYXJpYWJsZXxSZWZlcmVuY2UsIFRlbXBsYXRlPixcbiAgICBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPixcbiAgfSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBuZXcgTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPigpO1xuICAgIGNvbnN0IHN5bWJvbHMgPSBuZXcgTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+KCk7XG4gICAgY29uc3QgbmVzdGluZ0xldmVsID0gbmV3IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPigpO1xuICAgIC8vIFRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUgaGFzIG5lc3RpbmcgbGV2ZWwgMC5cbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIGV4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHNjb3BlLCB0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlID8gdGVtcGxhdGUgOiBudWxsLFxuICAgICAgICAwKTtcbiAgICBiaW5kZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3MgaW5wdXRzLCBvdXRwdXRzLCB2YXJpYWJsZXMsIGFuZCBjaGlsZCBub2Rlcy4gUmVmZXJlbmNlcyB3ZXJlXG4gICAgICAvLyBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLnZhcmlhYmxlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgICAvLyBTZXQgdGhlIG5lc3RpbmcgbGV2ZWwuXG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQodGVtcGxhdGUsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBWaXNpdCBlYWNoIG5vZGUgZnJvbSB0aGUgdG9wLWxldmVsIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBWaXN0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gRmlyc3QsIHZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMgb2YgdGhlIHRlbXBsYXRlIG5vZGUuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAvLyBSZWZlcmVuY2VzIGFyZSBhbHNvIGV2YWx1YXRlZCBpbiB0aGUgb3V0ZXIgY29udGV4dC5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZSB1c2luZyBpdHMgc2NvcGUsIGFuZCBidW1waW5nIHRoZSBuZXN0aW5nIGxldmVsIHVwIGJ5IG9uZS5cbiAgICBjb25zdCBjaGlsZFNjb3BlID0gdGhpcy5zY29wZS5nZXRDaGlsZFNjb3BlKHRlbXBsYXRlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy5uZXN0aW5nTGV2ZWwsIGNoaWxkU2NvcGUsIHRlbXBsYXRlLCB0aGlzLmxldmVsICsgMSk7XG4gICAgYmluZGVyLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgVmFyaWFibGVgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMudGVtcGxhdGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQodmFyaWFibGUsIHRoaXMudGVtcGxhdGUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gUmVnaXN0ZXIgdGhlIGBSZWZlcmVuY2VgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMudGVtcGxhdGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQocmVmZXJlbmNlLCB0aGlzLnRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICAvLyBVbnVzZWQgdGVtcGxhdGUgdmlzaXRvcnNcblxuICB2aXNpdFRleHQodGV4dDogVGV4dCkge31cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuXG4gIC8vIFRoZSByZW1haW5pbmcgdmlzaXRvcnMgYXJlIGNvbmNlcm5lZCB3aXRoIHByb2Nlc3NpbmcgQVNUIGV4cHJlc3Npb25zIHdpdGhpbiB0ZW1wbGF0ZSBiaW5kaW5nc1xuXG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSkgeyBhdHRyaWJ1dGUudmFsdWUudmlzaXQodGhpcyk7IH1cblxuICB2aXNpdEJvdW5kRXZlbnQoZXZlbnQ6IEJvdW5kRXZlbnQpIHsgZXZlbnQuaGFuZGxlci52aXNpdCh0aGlzKTsgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCkgeyB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMpOyB9XG5cblxuXG4gIC8vIFRoZXNlIGZpdmUgdHlwZXMgb2YgQVNUIGV4cHJlc3Npb25zIGNhbiByZWZlciB0byBleHByZXNzaW9uIHJvb3RzLCB3aGljaCBjb3VsZCBiZSB2YXJpYWJsZXNcbiAgLy8gb3IgcmVmZXJlbmNlcyBpbiB0aGUgY3VycmVudCBzY29wZS5cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5tYXliZU1hcChjb250ZXh0LCBhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0TWV0aG9kQ2FsbChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZU1ldGhvZENhbGwoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoXG4gICAgICBzY29wZTogU2NvcGUsIGFzdDogUHJvcGVydHlSZWFkfFNhZmVQcm9wZXJ0eVJlYWR8UHJvcGVydHlXcml0ZXxNZXRob2RDYWxsfFNhZmVNZXRob2RDYWxsLFxuICAgICAgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIHJlY2VpdmVyIG9mIHRoZSBleHByZXNzaW9uIGlzbid0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAsIHRoaXMgaXNuJ3QgdGhlIHJvb3Qgb2YgYW5cbiAgICAvLyBgQVNUYCBleHByZXNzaW9uIHRoYXQgbWFwcyB0byBhIGBWYXJpYWJsZWAgb3IgYFJlZmVyZW5jZWAuXG4gICAgaWYgKCEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBuYW1lIGV4aXN0cyBpbiB0aGUgY3VycmVudCBzY29wZS4gSWYgc28sIG1hcCBpdC4gT3RoZXJ3aXNlLCB0aGUgbmFtZSBpc1xuICAgIC8vIHByb2JhYmx5IGEgcHJvcGVydHkgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAgICBsZXQgdGFyZ2V0ID0gdGhpcy5zY29wZS5sb29rdXAobmFtZSk7XG4gICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXN0LCB0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ldGFkYXRhIGNvbnRhaW5lciBmb3IgYSBgVGFyZ2V0YCB0aGF0IGFsbG93cyBxdWVyaWVzIGZvciBzcGVjaWZpYyBiaXRzIG9mIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBgQm91bmRUYXJnZXRgIGZvciBkb2N1bWVudGF0aW9uIG9uIHRoZSBpbmRpdmlkdWFsIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0JvdW5kVGFyZ2V0PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgICByZWFkb25seSB0YXJnZXQ6IFRhcmdldCwgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8UmVmZXJlbmNlfFRleHRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPikge31cblxuICBnZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiBEaXJlY3RpdmVUW118bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZGlyZWN0aXZlcy5nZXQobm9kZSkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldFJlZmVyZW5jZVRhcmdldChyZWY6IFJlZmVyZW5jZSk6IHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnRcbiAgICAgIHxUZW1wbGF0ZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5yZWZlcmVuY2VzLmdldChyZWYpIHx8IG51bGw7XG4gIH1cblxuICBnZXRDb25zdW1lck9mQmluZGluZyhiaW5kaW5nOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUpOiBEaXJlY3RpdmVUfEVsZW1lbnRcbiAgICAgIHxUZW1wbGF0ZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5ncy5nZXQoYmluZGluZykgfHwgbnVsbDtcbiAgfVxuXG4gIGdldEV4cHJlc3Npb25UYXJnZXQoZXhwcjogQVNUKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmV4cHJUYXJnZXRzLmdldChleHByKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0VGVtcGxhdGVPZlN5bWJvbChzeW1ib2w6IFJlZmVyZW5jZXxWYXJpYWJsZSk6IFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbHMuZ2V0KHN5bWJvbCkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldE5lc3RpbmdMZXZlbCh0ZW1wbGF0ZTogVGVtcGxhdGUpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5uZXN0aW5nTGV2ZWwuZ2V0KHRlbXBsYXRlKSB8fCAwOyB9XG5cbiAgZ2V0VXNlZERpcmVjdGl2ZXMoKTogRGlyZWN0aXZlVFtdIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PERpcmVjdGl2ZVQ+KCk7XG4gICAgdGhpcy5kaXJlY3RpdmVzLmZvckVhY2goZGlycyA9PiBkaXJzLmZvckVhY2goZGlyID0+IHNldC5hZGQoZGlyKSkpO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNldC52YWx1ZXMoKSk7XG4gIH1cbn1cbiJdfQ==