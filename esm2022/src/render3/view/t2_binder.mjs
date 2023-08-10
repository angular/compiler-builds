/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ImplicitReceiver, RecursiveAstVisitor } from '../../expression_parser/ast';
import { BoundDeferredTrigger, Template } from '../r3_ast';
import { createCssSelector } from './template';
import { getAttrsForDirectiveMatching } from './util';
/**
 * Processes `Target`s with a given set of directives and performs a binding operation, which
 * returns an object similar to TypeScript's `ts.TypeChecker` that contains knowledge about the
 * target.
 */
export class R3TargetBinder {
    constructor(directiveMatcher) {
        this.directiveMatcher = directiveMatcher;
    }
    /**
     * Perform a binding operation on the given `Target` and return a `BoundTarget` which contains
     * metadata about the types referenced in the template.
     */
    bind(target) {
        if (!target.template) {
            // TODO(alxhub): handle targets which contain things like HostBindings, etc.
            throw new Error('Binding without a template not yet supported');
        }
        // First, parse the template into a `Scope` structure. This operation captures the syntactic
        // scopes in the template and makes them available for later use.
        const scope = Scope.apply(target.template);
        // Use the `Scope` to extract the entities present at every level of the template.
        const templateEntities = extractTemplateEntities(scope);
        // Next, perform directive matching on the template using the `DirectiveBinder`. This returns:
        //   - directives: Map of nodes (elements & ng-templates) to the directives on them.
        //   - bindings: Map of inputs, outputs, and attributes to the directive/element that claims
        //     them. TODO(alxhub): handle multiple directives claiming an input/output/etc.
        //   - references: Map of #references to their targets.
        const { directives, eagerDirectives, bindings, references } = DirectiveBinder.apply(target.template, this.directiveMatcher);
        // Finally, run the TemplateBinder to bind references, variables, and other entities within the
        // template. This extracts all the metadata that doesn't depend on directive matching.
        const { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks } = TemplateBinder.applyWithScope(target.template, scope);
        return new R3BoundTarget(target, directives, eagerDirectives, bindings, references, expressions, symbols, nestingLevel, templateEntities, usedPipes, eagerPipes, deferBlocks);
    }
}
/**
 * Represents a binding scope within a template.
 *
 * Any variables, references, or other named entities declared within the template will
 * be captured and available by name in `namedEntities`. Additionally, child templates will
 * be analyzed and have their child `Scope`s available in `childScopes`.
 */
class Scope {
    constructor(parentScope, template) {
        this.parentScope = parentScope;
        this.template = template;
        /**
         * Named members of the `Scope`, such as `Reference`s or `Variable`s.
         */
        this.namedEntities = new Map();
        /**
         * Child `Scope`s for immediately nested `Template`s.
         */
        this.childScopes = new Map();
    }
    static newRootScope() {
        return new Scope(null, null);
    }
    /**
     * Process a template (either as a `Template` sub-template with variables, or a plain array of
     * template `Node`s) and construct its `Scope`.
     */
    static apply(template) {
        const scope = Scope.newRootScope();
        scope.ingest(template);
        return scope;
    }
    /**
     * Internal method to process the template and populate the `Scope`.
     */
    ingest(template) {
        if (template instanceof Template) {
            // Variables on an <ng-template> are defined in the inner scope.
            template.variables.forEach(node => this.visitVariable(node));
            // Process the nodes of the template.
            template.children.forEach(node => node.visit(this));
        }
        else {
            // No overarching `Template` instance, so process the nodes directly.
            template.forEach(node => node.visit(this));
        }
    }
    visitElement(element) {
        // `Element`s in the template may have `Reference`s which are captured in the scope.
        element.references.forEach(node => this.visitReference(node));
        // Recurse into the `Element`'s children.
        element.children.forEach(node => node.visit(this));
    }
    visitTemplate(template) {
        // References on a <ng-template> are defined in the outer scope, so capture them before
        // processing the template's child scope.
        template.references.forEach(node => this.visitReference(node));
        // Next, create an inner scope and process the template within it.
        const scope = new Scope(this, template);
        scope.ingest(template);
        this.childScopes.set(template, scope);
    }
    visitVariable(variable) {
        // Declare the variable if it's not already.
        this.maybeDeclare(variable);
    }
    visitReference(reference) {
        // Declare the variable if it's not already.
        this.maybeDeclare(reference);
    }
    visitDeferredBlock(deferred) {
        deferred.children.forEach(node => node.visit(this));
        deferred.placeholder?.visit(this);
        deferred.loading?.visit(this);
        deferred.error?.visit(this);
    }
    visitDeferredBlockPlaceholder(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitDeferredBlockError(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitDeferredBlockLoading(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitSwitchBlock(block) {
        block.cases.forEach(node => node.visit(this));
    }
    visitSwitchBlockCase(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitForLoopBlock(block) {
        block.children.forEach(node => node.visit(this));
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitIfBlock(block) {
        block.branches.forEach(node => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.children.forEach(node => node.visit(this));
    }
    // Unused visitors.
    visitContent(content) { }
    visitBoundAttribute(attr) { }
    visitBoundEvent(event) { }
    visitBoundText(text) { }
    visitText(text) { }
    visitTextAttribute(attr) { }
    visitIcu(icu) { }
    visitDeferredTrigger(trigger) { }
    maybeDeclare(thing) {
        // Declare something with a name, as long as that name isn't taken.
        if (!this.namedEntities.has(thing.name)) {
            this.namedEntities.set(thing.name, thing);
        }
    }
    /**
     * Look up a variable within this `Scope`.
     *
     * This can recurse into a parent `Scope` if it's available.
     */
    lookup(name) {
        if (this.namedEntities.has(name)) {
            // Found in the local scope.
            return this.namedEntities.get(name);
        }
        else if (this.parentScope !== null) {
            // Not in the local scope, but there's a parent scope so check there.
            return this.parentScope.lookup(name);
        }
        else {
            // At the top level and it wasn't found.
            return null;
        }
    }
    /**
     * Get the child scope for a `Template`.
     *
     * This should always be defined.
     */
    getChildScope(template) {
        const res = this.childScopes.get(template);
        if (res === undefined) {
            throw new Error(`Assertion error: child scope for ${template} not found`);
        }
        return res;
    }
}
/**
 * Processes a template and matches directives on nodes (elements and templates).
 *
 * Usually used via the static `apply()` method.
 */
class DirectiveBinder {
    constructor(matcher, directives, eagerDirectives, bindings, references) {
        this.matcher = matcher;
        this.directives = directives;
        this.eagerDirectives = eagerDirectives;
        this.bindings = bindings;
        this.references = references;
        // Indicates whether we are visiting elements within a {#defer} block
        this.isInDeferBlock = false;
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
    static apply(template, selectorMatcher) {
        const directives = new Map();
        const bindings = new Map();
        const references = new Map();
        const eagerDirectives = [];
        const matcher = new DirectiveBinder(selectorMatcher, directives, eagerDirectives, bindings, references);
        matcher.ingest(template);
        return { directives, eagerDirectives, bindings, references };
    }
    ingest(template) {
        template.forEach(node => node.visit(this));
    }
    visitElement(element) {
        this.visitElementOrTemplate(element.name, element);
    }
    visitTemplate(template) {
        this.visitElementOrTemplate('ng-template', template);
    }
    visitElementOrTemplate(elementName, node) {
        // First, determine the HTML shape of the node for the purpose of directive matching.
        // Do this by building up a `CssSelector` for the node.
        const cssSelector = createCssSelector(elementName, getAttrsForDirectiveMatching(node));
        // Next, use the `SelectorMatcher` to get the list of directives on the node.
        const directives = [];
        this.matcher.match(cssSelector, (_selector, results) => directives.push(...results));
        if (directives.length > 0) {
            this.directives.set(node, directives);
            if (!this.isInDeferBlock) {
                this.eagerDirectives.push(...directives);
            }
        }
        // Resolve any references that are created on this node.
        node.references.forEach(ref => {
            let dirTarget = null;
            // If the reference expression is empty, then it matches the "primary" directive on the node
            // (if there is one). Otherwise it matches the host node itself (either an element or
            // <ng-template> node).
            if (ref.value.trim() === '') {
                // This could be a reference to a component if there is one.
                dirTarget = directives.find(dir => dir.isComponent) || null;
            }
            else {
                // This should be a reference to a directive exported via exportAs.
                dirTarget =
                    directives.find(dir => dir.exportAs !== null && dir.exportAs.some(value => value === ref.value)) ||
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
                this.references.set(ref, { directive: dirTarget, node });
            }
            else {
                // This reference points to the node itself.
                this.references.set(ref, node);
            }
        });
        const setAttributeBinding = (attribute, ioType) => {
            const dir = directives.find(dir => dir[ioType].hasBindingPropertyName(attribute.name));
            const binding = dir !== undefined ? dir : node;
            this.bindings.set(attribute, binding);
        };
        // Node inputs (bound attributes) and text attributes can be bound to an
        // input on a directive.
        node.inputs.forEach(input => setAttributeBinding(input, 'inputs'));
        node.attributes.forEach(attr => setAttributeBinding(attr, 'inputs'));
        if (node instanceof Template) {
            node.templateAttrs.forEach(attr => setAttributeBinding(attr, 'inputs'));
        }
        // Node outputs (bound events) can be bound to an output on a directive.
        node.outputs.forEach(output => setAttributeBinding(output, 'outputs'));
        // Recurse into the node's children.
        node.children.forEach(child => child.visit(this));
    }
    visitDeferredBlock(deferred) {
        const wasInDeferBlock = this.isInDeferBlock;
        this.isInDeferBlock = true;
        deferred.children.forEach(child => child.visit(this));
        this.isInDeferBlock = wasInDeferBlock;
        deferred.placeholder?.visit(this);
        deferred.loading?.visit(this);
        deferred.error?.visit(this);
    }
    visitDeferredBlockPlaceholder(block) {
        block.children.forEach(child => child.visit(this));
    }
    visitDeferredBlockError(block) {
        block.children.forEach(child => child.visit(this));
    }
    visitDeferredBlockLoading(block) {
        block.children.forEach(child => child.visit(this));
    }
    visitSwitchBlock(block) {
        block.cases.forEach(node => node.visit(this));
    }
    visitSwitchBlockCase(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitForLoopBlock(block) {
        block.children.forEach(node => node.visit(this));
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        block.children.forEach(node => node.visit(this));
    }
    visitIfBlock(block) {
        block.branches.forEach(node => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.children.forEach(node => node.visit(this));
    }
    // Unused visitors.
    visitContent(content) { }
    visitVariable(variable) { }
    visitReference(reference) { }
    visitTextAttribute(attribute) { }
    visitBoundAttribute(attribute) { }
    visitBoundEvent(attribute) { }
    visitBoundAttributeOrEvent(node) { }
    visitText(text) { }
    visitBoundText(text) { }
    visitIcu(icu) { }
    visitDeferredTrigger(trigger) { }
}
/**
 * Processes a template and extract metadata about expressions and symbols within.
 *
 * This is a companion to the `DirectiveBinder` that doesn't require knowledge of directives matched
 * within the template in order to operate.
 *
 * Expressions are visited by the superclass `RecursiveAstVisitor`, with custom logic provided
 * by overridden methods from that visitor.
 */
class TemplateBinder extends RecursiveAstVisitor {
    constructor(bindings, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, template, level) {
        super();
        this.bindings = bindings;
        this.symbols = symbols;
        this.usedPipes = usedPipes;
        this.eagerPipes = eagerPipes;
        this.deferBlocks = deferBlocks;
        this.nestingLevel = nestingLevel;
        this.scope = scope;
        this.template = template;
        this.level = level;
        // Indicates whether we are visiting elements within a {#defer} block
        this.isInDeferBlock = false;
        // Save a bit of processing time by constructing this closure in advance.
        this.visitNode = (node) => node.visit(this);
    }
    // This method is defined to reconcile the type of TemplateBinder since both
    // RecursiveAstVisitor and Visitor define the visit() method in their
    // interfaces.
    visit(node, context) {
        if (node instanceof AST) {
            node.visit(this, context);
        }
        else {
            node.visit(this);
        }
    }
    /**
     * Process a template and extract metadata about expressions and symbols within.
     *
     * @param nodes the nodes of the template to process
     * @param scope the `Scope` of the template being processed.
     * @returns three maps which contain metadata about the template: `expressions` which interprets
     * special `AST` nodes in expressions as pointing to references or variables declared within the
     * template, `symbols` which maps those variables and references to the nested `Template` which
     * declares them, if any, and `nestingLevel` which associates each `Template` with a integer
     * nesting level (how many levels deep within the template structure the `Template` is), starting
     * at 1.
     */
    static applyWithScope(nodes, scope) {
        const expressions = new Map();
        const symbols = new Map();
        const nestingLevel = new Map();
        const usedPipes = new Set();
        const eagerPipes = new Set();
        const template = nodes instanceof Template ? nodes : null;
        const deferBlocks = new Set();
        // The top-level template has nesting level 0.
        const binder = new TemplateBinder(expressions, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, template, 0);
        binder.ingest(nodes);
        return { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks };
    }
    ingest(template) {
        if (template instanceof Template) {
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
    }
    visitElement(element) {
        // Visit the inputs, outputs, and children of the element.
        element.inputs.forEach(this.visitNode);
        element.outputs.forEach(this.visitNode);
        element.children.forEach(this.visitNode);
    }
    visitTemplate(template) {
        // First, visit inputs, outputs and template attributes of the template node.
        template.inputs.forEach(this.visitNode);
        template.outputs.forEach(this.visitNode);
        template.templateAttrs.forEach(this.visitNode);
        // References are also evaluated in the outer context.
        template.references.forEach(this.visitNode);
        // Next, recurse into the template using its scope, and bumping the nesting level up by one.
        const childScope = this.scope.getChildScope(template);
        const binder = new TemplateBinder(this.bindings, this.symbols, this.usedPipes, this.eagerPipes, this.deferBlocks, this.nestingLevel, childScope, template, this.level + 1);
        binder.ingest(template);
    }
    visitVariable(variable) {
        // Register the `Variable` as a symbol in the current `Template`.
        if (this.template !== null) {
            this.symbols.set(variable, this.template);
        }
    }
    visitReference(reference) {
        // Register the `Reference` as a symbol in the current `Template`.
        if (this.template !== null) {
            this.symbols.set(reference, this.template);
        }
    }
    // Unused template visitors
    visitText(text) { }
    visitContent(content) { }
    visitTextAttribute(attribute) { }
    visitIcu(icu) {
        Object.keys(icu.vars).forEach(key => icu.vars[key].visit(this));
        Object.keys(icu.placeholders).forEach(key => icu.placeholders[key].visit(this));
    }
    // The remaining visitors are concerned with processing AST expressions within template bindings
    visitBoundAttribute(attribute) {
        attribute.value.visit(this);
    }
    visitBoundEvent(event) {
        event.handler.visit(this);
    }
    visitDeferredBlock(deferred) {
        this.deferBlocks.add(deferred);
        const wasInDeferBlock = this.isInDeferBlock;
        this.isInDeferBlock = true;
        deferred.children.forEach(this.visitNode);
        this.isInDeferBlock = wasInDeferBlock;
        deferred.placeholder && this.visitNode(deferred.placeholder);
        deferred.loading && this.visitNode(deferred.loading);
        deferred.error && this.visitNode(deferred.error);
    }
    visitDeferredTrigger(trigger) {
        if (trigger instanceof BoundDeferredTrigger) {
            trigger.value.visit(this);
        }
    }
    visitDeferredBlockPlaceholder(block) {
        block.children.forEach(this.visitNode);
    }
    visitDeferredBlockError(block) {
        block.children.forEach(this.visitNode);
    }
    visitDeferredBlockLoading(block) {
        block.children.forEach(this.visitNode);
    }
    visitSwitchBlock(block) {
        block.expression.visit(this);
        block.cases.forEach(this.visitNode);
    }
    visitSwitchBlockCase(block) {
        block.expression?.visit(this);
        block.children.forEach(this.visitNode);
    }
    visitForLoopBlock(block) {
        block.expression.visit(this);
        block.children.forEach(this.visitNode);
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        block.children.forEach(this.visitNode);
    }
    visitIfBlock(block) {
        block.branches.forEach(node => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.expression?.visit(this);
        block.children.forEach(node => node.visit(this));
    }
    visitBoundText(text) {
        text.value.visit(this);
    }
    visitPipe(ast, context) {
        this.usedPipes.add(ast.name);
        if (!this.isInDeferBlock) {
            this.eagerPipes.add(ast.name);
        }
        return super.visitPipe(ast, context);
    }
    // These five types of AST expressions can refer to expression roots, which could be variables
    // or references in the current scope.
    visitPropertyRead(ast, context) {
        this.maybeMap(context, ast, ast.name);
        return super.visitPropertyRead(ast, context);
    }
    visitSafePropertyRead(ast, context) {
        this.maybeMap(context, ast, ast.name);
        return super.visitSafePropertyRead(ast, context);
    }
    visitPropertyWrite(ast, context) {
        this.maybeMap(context, ast, ast.name);
        return super.visitPropertyWrite(ast, context);
    }
    maybeMap(scope, ast, name) {
        // If the receiver of the expression isn't the `ImplicitReceiver`, this isn't the root of an
        // `AST` expression that maps to a `Variable` or `Reference`.
        if (!(ast.receiver instanceof ImplicitReceiver)) {
            return;
        }
        // Check whether the name exists in the current scope. If so, map it. Otherwise, the name is
        // probably a property on the top-level component context.
        let target = this.scope.lookup(name);
        if (target !== null) {
            this.bindings.set(ast, target);
        }
    }
}
/**
 * Metadata container for a `Target` that allows queries for specific bits of metadata.
 *
 * See `BoundTarget` for documentation on the individual methods.
 */
export class R3BoundTarget {
    constructor(target, directives, eagerDirectives, bindings, references, exprTargets, symbols, nestingLevel, templateEntities, usedPipes, eagerPipes, deferredBlocks) {
        this.target = target;
        this.directives = directives;
        this.eagerDirectives = eagerDirectives;
        this.bindings = bindings;
        this.references = references;
        this.exprTargets = exprTargets;
        this.symbols = symbols;
        this.nestingLevel = nestingLevel;
        this.templateEntities = templateEntities;
        this.usedPipes = usedPipes;
        this.eagerPipes = eagerPipes;
        this.deferredBlocks = deferredBlocks;
    }
    getEntitiesInTemplateScope(template) {
        return this.templateEntities.get(template) ?? new Set();
    }
    getDirectivesOfNode(node) {
        return this.directives.get(node) || null;
    }
    getReferenceTarget(ref) {
        return this.references.get(ref) || null;
    }
    getConsumerOfBinding(binding) {
        return this.bindings.get(binding) || null;
    }
    getExpressionTarget(expr) {
        return this.exprTargets.get(expr) || null;
    }
    getTemplateOfSymbol(symbol) {
        return this.symbols.get(symbol) || null;
    }
    getNestingLevel(template) {
        return this.nestingLevel.get(template) || 0;
    }
    getUsedDirectives() {
        const set = new Set();
        this.directives.forEach(dirs => dirs.forEach(dir => set.add(dir)));
        return Array.from(set.values());
    }
    getEagerlyUsedDirectives() {
        const set = new Set(this.eagerDirectives);
        return Array.from(set.values());
    }
    getUsedPipes() {
        return Array.from(this.usedPipes);
    }
    getEagerlyUsedPipes() {
        return Array.from(this.eagerPipes);
    }
    getDeferBlocks() {
        return Array.from(this.deferredBlocks);
    }
}
function extractTemplateEntities(rootScope) {
    const entityMap = new Map();
    function extractScopeEntities(scope) {
        if (entityMap.has(scope.template)) {
            return entityMap.get(scope.template);
        }
        const currentEntities = scope.namedEntities;
        let templateEntities;
        if (scope.parentScope !== null) {
            templateEntities = new Map([...extractScopeEntities(scope.parentScope), ...currentEntities]);
        }
        else {
            templateEntities = new Map(currentEntities);
        }
        entityMap.set(scope.template, templateEntities);
        return templateEntities;
    }
    const scopesToProcess = [rootScope];
    while (scopesToProcess.length > 0) {
        const scope = scopesToProcess.pop();
        for (const childScope of scope.childScopes.values()) {
            scopesToProcess.push(childScope);
        }
        extractScopeEntities(scope);
    }
    const templateEntities = new Map();
    for (const [template, entities] of entityMap) {
        templateEntities.set(template, new Set(entities.values()));
    }
    return templateEntities;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBZSxnQkFBZ0IsRUFBK0IsbUJBQW1CLEVBQW1CLE1BQU0sNkJBQTZCLENBQUM7QUFFbkosT0FBTyxFQUFpQixvQkFBb0IsRUFBNFAsUUFBUSxFQUF5QyxNQUFNLFdBQVcsQ0FBQztBQUczVyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDN0MsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBR3BEOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sY0FBYztJQUN6QixZQUFvQixnQkFBK0M7UUFBL0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUErQjtJQUFHLENBQUM7SUFFdkU7OztPQUdHO0lBQ0gsSUFBSSxDQUFDLE1BQWM7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7WUFDcEIsNEVBQTRFO1lBQzVFLE1BQU0sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztTQUNqRTtRQUVELDRGQUE0RjtRQUM1RixpRUFBaUU7UUFDakUsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFHM0Msa0ZBQWtGO1FBQ2xGLE1BQU0sZ0JBQWdCLEdBQUcsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFeEQsOEZBQThGO1FBQzlGLG9GQUFvRjtRQUNwRiw0RkFBNEY7UUFDNUYsbUZBQW1GO1FBQ25GLHVEQUF1RDtRQUN2RCxNQUFNLEVBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFDLEdBQ3JELGVBQWUsQ0FB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LE1BQU0sZUFBZSxHQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0MsT0FBTyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUNqQyxNQUFNLEtBQUssR0FBRyxlQUFlLENBQUMsR0FBRyxFQUFHLENBQUM7UUFDckMsS0FBSyxNQUFNLFVBQVUsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ25ELGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDbEM7UUFDRCxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUM3QjtJQUVELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQTBDLENBQUM7SUFDM0UsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLFNBQVMsRUFBRTtRQUM1QyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDNUQ7SUFDRCxPQUFPLGdCQUFnQixDQUFDO0FBQzFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1QsIEJpbmRpbmdQaXBlLCBJbXBsaWNpdFJlY2VpdmVyLCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1NlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCb3VuZEF0dHJpYnV0ZSwgQm91bmREZWZlcnJlZFRyaWdnZXIsIEJvdW5kRXZlbnQsIEJvdW5kVGV4dCwgQ29udGVudCwgRGVmZXJyZWRCbG9jaywgRGVmZXJyZWRCbG9ja0Vycm9yLCBEZWZlcnJlZEJsb2NrTG9hZGluZywgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyLCBEZWZlcnJlZFRyaWdnZXIsIEVsZW1lbnQsIEZvckxvb3BCbG9jaywgRm9yTG9vcEJsb2NrRW1wdHksIEljdSwgSWZCbG9jaywgSWZCbG9ja0JyYW5jaCwgTm9kZSwgUmVmZXJlbmNlLCBTd2l0Y2hCbG9jaywgU3dpdGNoQmxvY2tDYXNlLCBUZW1wbGF0ZSwgVGV4dCwgVGV4dEF0dHJpYnV0ZSwgVmFyaWFibGUsIFZpc2l0b3J9IGZyb20gJy4uL3IzX2FzdCc7XG5cbmltcG9ydCB7Qm91bmRUYXJnZXQsIERpcmVjdGl2ZU1ldGEsIFRhcmdldCwgVGFyZ2V0QmluZGVyfSBmcm9tICcuL3QyX2FwaSc7XG5pbXBvcnQge2NyZWF0ZUNzc1NlbGVjdG9yfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Z2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZ30gZnJvbSAnLi91dGlsJztcblxuXG4vKipcbiAqIFByb2Nlc3NlcyBgVGFyZ2V0YHMgd2l0aCBhIGdpdmVuIHNldCBvZiBkaXJlY3RpdmVzIGFuZCBwZXJmb3JtcyBhIGJpbmRpbmcgb3BlcmF0aW9uLCB3aGljaFxuICogcmV0dXJucyBhbiBvYmplY3Qgc2ltaWxhciB0byBUeXBlU2NyaXB0J3MgYHRzLlR5cGVDaGVja2VyYCB0aGF0IGNvbnRhaW5zIGtub3dsZWRnZSBhYm91dCB0aGVcbiAqIHRhcmdldC5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFRhcmdldEJpbmRlcjxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgZGlyZWN0aXZlTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVRbXT4pIHt9XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gYSBiaW5kaW5nIG9wZXJhdGlvbiBvbiB0aGUgZ2l2ZW4gYFRhcmdldGAgYW5kIHJldHVybiBhIGBCb3VuZFRhcmdldGAgd2hpY2ggY29udGFpbnNcbiAgICogbWV0YWRhdGEgYWJvdXQgdGhlIHR5cGVzIHJlZmVyZW5jZWQgaW4gdGhlIHRlbXBsYXRlLlxuICAgKi9cbiAgYmluZCh0YXJnZXQ6IFRhcmdldCk6IEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgICBpZiAoIXRhcmdldC50ZW1wbGF0ZSkge1xuICAgICAgLy8gVE9ETyhhbHhodWIpOiBoYW5kbGUgdGFyZ2V0cyB3aGljaCBjb250YWluIHRoaW5ncyBsaWtlIEhvc3RCaW5kaW5ncywgZXRjLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCaW5kaW5nIHdpdGhvdXQgYSB0ZW1wbGF0ZSBub3QgeWV0IHN1cHBvcnRlZCcpO1xuICAgIH1cblxuICAgIC8vIEZpcnN0LCBwYXJzZSB0aGUgdGVtcGxhdGUgaW50byBhIGBTY29wZWAgc3RydWN0dXJlLiBUaGlzIG9wZXJhdGlvbiBjYXB0dXJlcyB0aGUgc3ludGFjdGljXG4gICAgLy8gc2NvcGVzIGluIHRoZSB0ZW1wbGF0ZSBhbmQgbWFrZXMgdGhlbSBhdmFpbGFibGUgZm9yIGxhdGVyIHVzZS5cbiAgICBjb25zdCBzY29wZSA9IFNjb3BlLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSk7XG5cblxuICAgIC8vIFVzZSB0aGUgYFNjb3BlYCB0byBleHRyYWN0IHRoZSBlbnRpdGllcyBwcmVzZW50IGF0IGV2ZXJ5IGxldmVsIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICBjb25zdCB0ZW1wbGF0ZUVudGl0aWVzID0gZXh0cmFjdFRlbXBsYXRlRW50aXRpZXMoc2NvcGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9ID1cbiAgICAgICAgRGlyZWN0aXZlQmluZGVyLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyKTtcbiAgICAvLyBGaW5hbGx5LCBydW4gdGhlIFRlbXBsYXRlQmluZGVyIHRvIGJpbmQgcmVmZXJlbmNlcywgdmFyaWFibGVzLCBhbmQgb3RoZXIgZW50aXRpZXMgd2l0aGluIHRoZVxuICAgIC8vIHRlbXBsYXRlLiBUaGlzIGV4dHJhY3RzIGFsbCB0aGUgbWV0YWRhdGEgdGhhdCBkb2Vzbid0IGRlcGVuZCBvbiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgY29uc3Qge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3N9ID1cbiAgICAgICAgVGVtcGxhdGVCaW5kZXIuYXBwbHlXaXRoU2NvcGUodGFyZ2V0LnRlbXBsYXRlLCBzY29wZSk7XG4gICAgcmV0dXJuIG5ldyBSM0JvdW5kVGFyZ2V0KFxuICAgICAgICB0YXJnZXQsIGRpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXMsIGV4cHJlc3Npb25zLCBzeW1ib2xzLFxuICAgICAgICBuZXN0aW5nTGV2ZWwsIHRlbXBsYXRlRW50aXRpZXMsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3MpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGJpbmRpbmcgc2NvcGUgd2l0aGluIGEgdGVtcGxhdGUuXG4gKlxuICogQW55IHZhcmlhYmxlcywgcmVmZXJlbmNlcywgb3Igb3RoZXIgbmFtZWQgZW50aXRpZXMgZGVjbGFyZWQgd2l0aGluIHRoZSB0ZW1wbGF0ZSB3aWxsXG4gKiBiZSBjYXB0dXJlZCBhbmQgYXZhaWxhYmxlIGJ5IG5hbWUgaW4gYG5hbWVkRW50aXRpZXNgLiBBZGRpdGlvbmFsbHksIGNoaWxkIHRlbXBsYXRlcyB3aWxsXG4gKiBiZSBhbmFseXplZCBhbmQgaGF2ZSB0aGVpciBjaGlsZCBgU2NvcGVgcyBhdmFpbGFibGUgaW4gYGNoaWxkU2NvcGVzYC5cbiAqL1xuY2xhc3MgU2NvcGUgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLyoqXG4gICAqIE5hbWVkIG1lbWJlcnMgb2YgdGhlIGBTY29wZWAsIHN1Y2ggYXMgYFJlZmVyZW5jZWBzIG9yIGBWYXJpYWJsZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgbmFtZWRFbnRpdGllcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIENoaWxkIGBTY29wZWBzIGZvciBpbW1lZGlhdGVseSBuZXN0ZWQgYFRlbXBsYXRlYHMuXG4gICAqL1xuICByZWFkb25seSBjaGlsZFNjb3BlcyA9IG5ldyBNYXA8VGVtcGxhdGUsIFNjb3BlPigpO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocmVhZG9ubHkgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwsIHJlYWRvbmx5IHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsKSB7fVxuXG4gIHN0YXRpYyBuZXdSb290U2NvcGUoKTogU2NvcGUge1xuICAgIHJldHVybiBuZXcgU2NvcGUobnVsbCwgbnVsbCk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChlaXRoZXIgYXMgYSBgVGVtcGxhdGVgIHN1Yi10ZW1wbGF0ZSB3aXRoIHZhcmlhYmxlcywgb3IgYSBwbGFpbiBhcnJheSBvZlxuICAgKiB0ZW1wbGF0ZSBgTm9kZWBzKSBhbmQgY29uc3RydWN0IGl0cyBgU2NvcGVgLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5KHRlbXBsYXRlOiBOb2RlW10pOiBTY29wZSB7XG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5uZXdSb290U2NvcGUoKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiBzY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcHJvY2VzcyB0aGUgdGVtcGxhdGUgYW5kIHBvcHVsYXRlIHRoZSBgU2NvcGVgLlxuICAgKi9cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBWYXJpYWJsZXMgb24gYW4gPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgaW5uZXIgc2NvcGUuXG4gICAgICB0ZW1wbGF0ZS52YXJpYWJsZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRWYXJpYWJsZShub2RlKSk7XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICAgIHRlbXBsYXRlLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gb3ZlcmFyY2hpbmcgYFRlbXBsYXRlYCBpbnN0YW5jZSwgc28gcHJvY2VzcyB0aGUgbm9kZXMgZGlyZWN0bHkuXG4gICAgICB0ZW1wbGF0ZS5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBgRWxlbWVudGBzIGluIHRoZSB0ZW1wbGF0ZSBtYXkgaGF2ZSBgUmVmZXJlbmNlYHMgd2hpY2ggYXJlIGNhcHR1cmVkIGluIHRoZSBzY29wZS5cbiAgICBlbGVtZW50LnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBgRWxlbWVudGAncyBjaGlsZHJlbi5cbiAgICBlbGVtZW50LmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gUmVmZXJlbmNlcyBvbiBhIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIG91dGVyIHNjb3BlLCBzbyBjYXB0dXJlIHRoZW0gYmVmb3JlXG4gICAgLy8gcHJvY2Vzc2luZyB0aGUgdGVtcGxhdGUncyBjaGlsZCBzY29wZS5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIE5leHQsIGNyZWF0ZSBhbiBpbm5lciBzY29wZSBhbmQgcHJvY2VzcyB0aGUgdGVtcGxhdGUgd2l0aGluIGl0LlxuICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlKHRoaXMsIHRlbXBsYXRlKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHRoaXMuY2hpbGRTY29wZXMuc2V0KHRlbXBsYXRlLCBzY29wZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUodmFyaWFibGUpO1xuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHJlZmVyZW5jZSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spIHtcbiAgICBkZWZlcnJlZC5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgZGVmZXJyZWQucGxhY2Vob2xkZXI/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmxvYWRpbmc/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmVycm9yPy52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jaykge1xuICAgIGJsb2NrLmNhc2VzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKSB7XG4gICAgYmxvY2suYnJhbmNoZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyOiBCb3VuZEF0dHJpYnV0ZSkge31cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cjogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcikge31cblxuICBwcml2YXRlIG1heWJlRGVjbGFyZSh0aGluZzogUmVmZXJlbmNlfFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSBzb21ldGhpbmcgd2l0aCBhIG5hbWUsIGFzIGxvbmcgYXMgdGhhdCBuYW1lIGlzbid0IHRha2VuLlxuICAgIGlmICghdGhpcy5uYW1lZEVudGl0aWVzLmhhcyh0aGluZy5uYW1lKSkge1xuICAgICAgdGhpcy5uYW1lZEVudGl0aWVzLnNldCh0aGluZy5uYW1lLCB0aGluZyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgdXAgYSB2YXJpYWJsZSB3aXRoaW4gdGhpcyBgU2NvcGVgLlxuICAgKlxuICAgKiBUaGlzIGNhbiByZWN1cnNlIGludG8gYSBwYXJlbnQgYFNjb3BlYCBpZiBpdCdzIGF2YWlsYWJsZS5cbiAgICovXG4gIGxvb2t1cChuYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgaWYgKHRoaXMubmFtZWRFbnRpdGllcy5oYXMobmFtZSkpIHtcbiAgICAgIC8vIEZvdW5kIGluIHRoZSBsb2NhbCBzY29wZS5cbiAgICAgIHJldHVybiB0aGlzLm5hbWVkRW50aXRpZXMuZ2V0KG5hbWUpITtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIC8vIE5vdCBpbiB0aGUgbG9jYWwgc2NvcGUsIGJ1dCB0aGVyZSdzIGEgcGFyZW50IHNjb3BlIHNvIGNoZWNrIHRoZXJlLlxuICAgICAgcmV0dXJuIHRoaXMucGFyZW50U2NvcGUubG9va3VwKG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBdCB0aGUgdG9wIGxldmVsIGFuZCBpdCB3YXNuJ3QgZm91bmQuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjaGlsZCBzY29wZSBmb3IgYSBgVGVtcGxhdGVgLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBhbHdheXMgYmUgZGVmaW5lZC5cbiAgICovXG4gIGdldENoaWxkU2NvcGUodGVtcGxhdGU6IFRlbXBsYXRlKTogU2NvcGUge1xuICAgIGNvbnN0IHJlcyA9IHRoaXMuY2hpbGRTY29wZXMuZ2V0KHRlbXBsYXRlKTtcbiAgICBpZiAocmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uIGVycm9yOiBjaGlsZCBzY29wZSBmb3IgJHt0ZW1wbGF0ZX0gbm90IGZvdW5kYCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgbWF0Y2hlcyBkaXJlY3RpdmVzIG9uIG5vZGVzIChlbGVtZW50cyBhbmQgdGVtcGxhdGVzKS5cbiAqXG4gKiBVc3VhbGx5IHVzZWQgdmlhIHRoZSBzdGF0aWMgYGFwcGx5KClgIG1ldGhvZC5cbiAqL1xuY2xhc3MgRGlyZWN0aXZlQmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvLyBJbmRpY2F0ZXMgd2hldGhlciB3ZSBhcmUgdmlzaXRpbmcgZWxlbWVudHMgd2l0aGluIGEgeyNkZWZlcn0gYmxvY2tcbiAgcHJpdmF0ZSBpc0luRGVmZXJCbG9jayA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBtYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50fFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPikge31cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChsaXN0IG9mIGBOb2RlYHMpIGFuZCBwZXJmb3JtIGRpcmVjdGl2ZSBtYXRjaGluZyBhZ2FpbnN0IGVhY2ggbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBsaXN0IG9mIHRlbXBsYXRlIGBOb2RlYHMgdG8gbWF0Y2ggKHJlY3Vyc2l2ZWx5KS5cbiAgICogQHBhcmFtIHNlbGVjdG9yTWF0Y2hlciBhIGBTZWxlY3Rvck1hdGNoZXJgIGNvbnRhaW5pbmcgdGhlIGRpcmVjdGl2ZXMgdGhhdCBhcmUgaW4gc2NvcGUgZm9yXG4gICAqIHRoaXMgdGVtcGxhdGUuXG4gICAqIEByZXR1cm5zIHRocmVlIG1hcHMgd2hpY2ggY29udGFpbiBpbmZvcm1hdGlvbiBhYm91dCBkaXJlY3RpdmVzIGluIHRoZSB0ZW1wbGF0ZTogdGhlXG4gICAqIGBkaXJlY3RpdmVzYCBtYXAgd2hpY2ggbGlzdHMgZGlyZWN0aXZlcyBtYXRjaGVkIG9uIGVhY2ggbm9kZSwgdGhlIGBiaW5kaW5nc2AgbWFwIHdoaWNoXG4gICAqIGluZGljYXRlcyB3aGljaCBkaXJlY3RpdmVzIGNsYWltZWQgd2hpY2ggYmluZGluZ3MgKGlucHV0cywgb3V0cHV0cywgZXRjKSwgYW5kIHRoZSBgcmVmZXJlbmNlc2BcbiAgICogbWFwIHdoaWNoIHJlc29sdmVzICNyZWZlcmVuY2VzIChgUmVmZXJlbmNlYHMpIHdpdGhpbiB0aGUgdGVtcGxhdGUgdG8gdGhlIG5hbWVkIGRpcmVjdGl2ZSBvclxuICAgKiB0ZW1wbGF0ZSBub2RlLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPihcbiAgICAgIHRlbXBsYXRlOiBOb2RlW10sIHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVRbXT4pOiB7XG4gICAgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10sXG4gICAgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgcmVmZXJlbmNlczogTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gIH0ge1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4oKTtcbiAgICBjb25zdCBiaW5kaW5ncyA9XG4gICAgICAgIG5ldyBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlcyA9XG4gICAgICAgIG5ldyBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10gPSBbXTtcbiAgICBjb25zdCBtYXRjaGVyID1cbiAgICAgICAgbmV3IERpcmVjdGl2ZUJpbmRlcihzZWxlY3Rvck1hdGNoZXIsIGRpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXMpO1xuICAgIG1hdGNoZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2RpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IE5vZGVbXSk6IHZvaWQge1xuICAgIHRlbXBsYXRlLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZSgnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKGVsZW1lbnROYW1lOiBzdHJpbmcsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBGaXJzdCwgZGV0ZXJtaW5lIHRoZSBIVE1MIHNoYXBlIG9mIHRoZSBub2RlIGZvciB0aGUgcHVycG9zZSBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgLy8gRG8gdGhpcyBieSBidWlsZGluZyB1cCBhIGBDc3NTZWxlY3RvcmAgZm9yIHRoZSBub2RlLlxuICAgIGNvbnN0IGNzc1NlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoZWxlbWVudE5hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgdXNlIHRoZSBgU2VsZWN0b3JNYXRjaGVyYCB0byBnZXQgdGhlIGxpc3Qgb2YgZGlyZWN0aXZlcyBvbiB0aGUgbm9kZS5cbiAgICBjb25zdCBkaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10gPSBbXTtcbiAgICB0aGlzLm1hdGNoZXIubWF0Y2goY3NzU2VsZWN0b3IsIChfc2VsZWN0b3IsIHJlc3VsdHMpID0+IGRpcmVjdGl2ZXMucHVzaCguLi5yZXN1bHRzKSk7XG4gICAgaWYgKGRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5kaXJlY3RpdmVzLnNldChub2RlLCBkaXJlY3RpdmVzKTtcbiAgICAgIGlmICghdGhpcy5pc0luRGVmZXJCbG9jaykge1xuICAgICAgICB0aGlzLmVhZ2VyRGlyZWN0aXZlcy5wdXNoKC4uLmRpcmVjdGl2ZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlc29sdmUgYW55IHJlZmVyZW5jZXMgdGhhdCBhcmUgY3JlYXRlZCBvbiB0aGlzIG5vZGUuXG4gICAgbm9kZS5yZWZlcmVuY2VzLmZvckVhY2gocmVmID0+IHtcbiAgICAgIGxldCBkaXJUYXJnZXQ6IERpcmVjdGl2ZVR8bnVsbCA9IG51bGw7XG5cbiAgICAgIC8vIElmIHRoZSByZWZlcmVuY2UgZXhwcmVzc2lvbiBpcyBlbXB0eSwgdGhlbiBpdCBtYXRjaGVzIHRoZSBcInByaW1hcnlcIiBkaXJlY3RpdmUgb24gdGhlIG5vZGVcbiAgICAgIC8vIChpZiB0aGVyZSBpcyBvbmUpLiBPdGhlcndpc2UgaXQgbWF0Y2hlcyB0aGUgaG9zdCBub2RlIGl0c2VsZiAoZWl0aGVyIGFuIGVsZW1lbnQgb3JcbiAgICAgIC8vIDxuZy10ZW1wbGF0ZT4gbm9kZSkuXG4gICAgICBpZiAocmVmLnZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgLy8gVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbXBvbmVudCBpZiB0aGVyZSBpcyBvbmUuXG4gICAgICAgIGRpclRhcmdldCA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLmlzQ29tcG9uZW50KSB8fCBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBkaXJlY3RpdmUgZXhwb3J0ZWQgdmlhIGV4cG9ydEFzLlxuICAgICAgICBkaXJUYXJnZXQgPVxuICAgICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgICAgIGRpciA9PiBkaXIuZXhwb3J0QXMgIT09IG51bGwgJiYgZGlyLmV4cG9ydEFzLnNvbWUodmFsdWUgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSkpIHx8XG4gICAgICAgICAgICBudWxsO1xuICAgICAgICAvLyBDaGVjayBpZiBhIG1hdGNoaW5nIGRpcmVjdGl2ZSB3YXMgZm91bmQuXG4gICAgICAgIGlmIChkaXJUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBObyBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kIC0gdGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGFuIHVua25vd24gdGFyZ2V0LiBMZWF2ZSBpdFxuICAgICAgICAgIC8vIHVubWFwcGVkLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGlyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhIGRpcmVjdGl2ZS5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIHtkaXJlY3RpdmU6IGRpclRhcmdldCwgbm9kZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIHRoZSBub2RlIGl0c2VsZi5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIGF0dHJpYnV0ZXMvYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuICAgIHR5cGUgQm91bmROb2RlID0gQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlO1xuICAgIGNvbnN0IHNldEF0dHJpYnV0ZUJpbmRpbmcgPVxuICAgICAgICAoYXR0cmlidXRlOiBCb3VuZE5vZGUsIGlvVHlwZToga2V5b2YgUGljazxEaXJlY3RpdmVNZXRhLCAnaW5wdXRzJ3wnb3V0cHV0cyc+KSA9PiB7XG4gICAgICAgICAgY29uc3QgZGlyID0gZGlyZWN0aXZlcy5maW5kKGRpciA9PiBkaXJbaW9UeXBlXS5oYXNCaW5kaW5nUHJvcGVydHlOYW1lKGF0dHJpYnV0ZS5uYW1lKSk7XG4gICAgICAgICAgY29uc3QgYmluZGluZyA9IGRpciAhPT0gdW5kZWZpbmVkID8gZGlyIDogbm9kZTtcbiAgICAgICAgICB0aGlzLmJpbmRpbmdzLnNldChhdHRyaWJ1dGUsIGJpbmRpbmcpO1xuICAgICAgICB9O1xuXG4gICAgLy8gTm9kZSBpbnB1dHMgKGJvdW5kIGF0dHJpYnV0ZXMpIGFuZCB0ZXh0IGF0dHJpYnV0ZXMgY2FuIGJlIGJvdW5kIHRvIGFuXG4gICAgLy8gaW5wdXQgb24gYSBkaXJlY3RpdmUuXG4gICAgbm9kZS5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiBzZXRBdHRyaWJ1dGVCaW5kaW5nKGlucHV0LCAnaW5wdXRzJykpO1xuICAgIG5vZGUuYXR0cmlidXRlcy5mb3JFYWNoKGF0dHIgPT4gc2V0QXR0cmlidXRlQmluZGluZyhhdHRyLCAnaW5wdXRzJykpO1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIG5vZGUudGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gc2V0QXR0cmlidXRlQmluZGluZyhhdHRyLCAnaW5wdXRzJykpO1xuICAgIH1cbiAgICAvLyBOb2RlIG91dHB1dHMgKGJvdW5kIGV2ZW50cykgY2FuIGJlIGJvdW5kIHRvIGFuIG91dHB1dCBvbiBhIGRpcmVjdGl2ZS5cbiAgICBub2RlLm91dHB1dHMuZm9yRWFjaChvdXRwdXQgPT4gc2V0QXR0cmlidXRlQmluZGluZyhvdXRwdXQsICdvdXRwdXRzJykpO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBub2RlJ3MgY2hpbGRyZW4uXG4gICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGNvbnN0IHdhc0luRGVmZXJCbG9jayA9IHRoaXMuaXNJbkRlZmVyQmxvY2s7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHRydWU7XG4gICAgZGVmZXJyZWQuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHdhc0luRGVmZXJCbG9jaztcblxuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5lcnJvcj8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKTogdm9pZCB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKTogdm9pZCB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spIHtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jaykge1xuICAgIGJsb2NrLmJyYW5jaGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHt9XG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlT3JFdmVudChub2RlOiBCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KTogdm9pZCB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge31cbiAgdmlzaXREZWZlcnJlZFRyaWdnZXIodHJpZ2dlcjogRGVmZXJyZWRUcmlnZ2VyKTogdm9pZCB7fVxufVxuXG4vKipcbiAqIFByb2Nlc3NlcyBhIHRlbXBsYXRlIGFuZCBleHRyYWN0IG1ldGFkYXRhIGFib3V0IGV4cHJlc3Npb25zIGFuZCBzeW1ib2xzIHdpdGhpbi5cbiAqXG4gKiBUaGlzIGlzIGEgY29tcGFuaW9uIHRvIHRoZSBgRGlyZWN0aXZlQmluZGVyYCB0aGF0IGRvZXNuJ3QgcmVxdWlyZSBrbm93bGVkZ2Ugb2YgZGlyZWN0aXZlcyBtYXRjaGVkXG4gKiB3aXRoaW4gdGhlIHRlbXBsYXRlIGluIG9yZGVyIHRvIG9wZXJhdGUuXG4gKlxuICogRXhwcmVzc2lvbnMgYXJlIHZpc2l0ZWQgYnkgdGhlIHN1cGVyY2xhc3MgYFJlY3Vyc2l2ZUFzdFZpc2l0b3JgLCB3aXRoIGN1c3RvbSBsb2dpYyBwcm92aWRlZFxuICogYnkgb3ZlcnJpZGRlbiBtZXRob2RzIGZyb20gdGhhdCB2aXNpdG9yLlxuICovXG5jbGFzcyBUZW1wbGF0ZUJpbmRlciBleHRlbmRzIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgcHJpdmF0ZSB2aXNpdE5vZGU6IChub2RlOiBOb2RlKSA9PiB2b2lkO1xuXG4gIC8vIEluZGljYXRlcyB3aGV0aGVyIHdlIGFyZSB2aXNpdGluZyBlbGVtZW50cyB3aXRoaW4gYSB7I2RlZmVyfSBibG9ja1xuICBwcml2YXRlIGlzSW5EZWZlckJsb2NrID0gZmFsc2U7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgICBwcml2YXRlIHN5bWJvbHM6IE1hcDxSZWZlcmVuY2V8VmFyaWFibGUsIFRlbXBsYXRlPiwgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgICAgcHJpdmF0ZSBlYWdlclBpcGVzOiBTZXQ8c3RyaW5nPiwgcHJpdmF0ZSBkZWZlckJsb2NrczogU2V0PERlZmVycmVkQmxvY2s+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPiwgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgICBwcml2YXRlIHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyBkZWZpbmVkIHRvIHJlY29uY2lsZSB0aGUgdHlwZSBvZiBUZW1wbGF0ZUJpbmRlciBzaW5jZSBib3RoXG4gIC8vIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgYW5kIFZpc2l0b3IgZGVmaW5lIHRoZSB2aXNpdCgpIG1ldGhvZCBpbiB0aGVpclxuICAvLyBpbnRlcmZhY2VzLlxuICBvdmVycmlkZSB2aXNpdChub2RlOiBBU1R8Tm9kZSwgY29udGV4dD86IGFueSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgQVNUKSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZXMgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZSB0byBwcm9jZXNzXG4gICAqIEBwYXJhbSBzY29wZSB0aGUgYFNjb3BlYCBvZiB0aGUgdGVtcGxhdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gbWV0YWRhdGEgYWJvdXQgdGhlIHRlbXBsYXRlOiBgZXhwcmVzc2lvbnNgIHdoaWNoIGludGVycHJldHNcbiAgICogc3BlY2lhbCBgQVNUYCBub2RlcyBpbiBleHByZXNzaW9ucyBhcyBwb2ludGluZyB0byByZWZlcmVuY2VzIG9yIHZhcmlhYmxlcyBkZWNsYXJlZCB3aXRoaW4gdGhlXG4gICAqIHRlbXBsYXRlLCBgc3ltYm9sc2Agd2hpY2ggbWFwcyB0aG9zZSB2YXJpYWJsZXMgYW5kIHJlZmVyZW5jZXMgdG8gdGhlIG5lc3RlZCBgVGVtcGxhdGVgIHdoaWNoXG4gICAqIGRlY2xhcmVzIHRoZW0sIGlmIGFueSwgYW5kIGBuZXN0aW5nTGV2ZWxgIHdoaWNoIGFzc29jaWF0ZXMgZWFjaCBgVGVtcGxhdGVgIHdpdGggYSBpbnRlZ2VyXG4gICAqIG5lc3RpbmcgbGV2ZWwgKGhvdyBtYW55IGxldmVscyBkZWVwIHdpdGhpbiB0aGUgdGVtcGxhdGUgc3RydWN0dXJlIHRoZSBgVGVtcGxhdGVgIGlzKSwgc3RhcnRpbmdcbiAgICogYXQgMS5cbiAgICovXG4gIHN0YXRpYyBhcHBseVdpdGhTY29wZShub2RlczogTm9kZVtdLCBzY29wZTogU2NvcGUpOiB7XG4gICAgZXhwcmVzc2lvbnM6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgc3ltYm9sczogTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+LFxuICAgIG5lc3RpbmdMZXZlbDogTWFwPFRlbXBsYXRlLCBudW1iZXI+LFxuICAgIHVzZWRQaXBlczogU2V0PHN0cmluZz4sXG4gICAgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sXG4gICAgZGVmZXJCbG9ja3M6IFNldDxEZWZlcnJlZEJsb2NrPixcbiAgfSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBuZXcgTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPigpO1xuICAgIGNvbnN0IHN5bWJvbHMgPSBuZXcgTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+KCk7XG4gICAgY29uc3QgbmVzdGluZ0xldmVsID0gbmV3IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPigpO1xuICAgIGNvbnN0IHVzZWRQaXBlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGVhZ2VyUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG5vZGVzIGluc3RhbmNlb2YgVGVtcGxhdGUgPyBub2RlcyA6IG51bGw7XG4gICAgY29uc3QgZGVmZXJCbG9ja3MgPSBuZXcgU2V0PERlZmVycmVkQmxvY2s+KCk7XG4gICAgLy8gVGhlIHRvcC1sZXZlbCB0ZW1wbGF0ZSBoYXMgbmVzdGluZyBsZXZlbCAwLlxuICAgIGNvbnN0IGJpbmRlciA9IG5ldyBUZW1wbGF0ZUJpbmRlcihcbiAgICAgICAgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3MsIG5lc3RpbmdMZXZlbCwgc2NvcGUsIHRlbXBsYXRlLCAwKTtcbiAgICBiaW5kZXIuaW5nZXN0KG5vZGVzKTtcbiAgICByZXR1cm4ge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3N9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IFRlbXBsYXRlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmICh0ZW1wbGF0ZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3Mgb25seSB2YXJpYWJsZXMgYW5kIGNoaWxkIG5vZGVzLiBJbnB1dHMsIG91dHB1dHMsIHRlbXBsYXRlQXR0cnMsXG4gICAgICAvLyBhbmQgcmVmZXJlbmNlcyB3ZXJlIGFsbCBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgdGVtcGxhdGUudmFyaWFibGVzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGVtcGxhdGUuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAgIC8vIFNldCB0aGUgbmVzdGluZyBsZXZlbC5cbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldCh0ZW1wbGF0ZSwgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFZpc2l0IGVhY2ggbm9kZSBmcm9tIHRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUuXG4gICAgICB0ZW1wbGF0ZS5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIFZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gRmlyc3QsIHZpc2l0IGlucHV0cywgb3V0cHV0cyBhbmQgdGVtcGxhdGUgYXR0cmlidXRlcyBvZiB0aGUgdGVtcGxhdGUgbm9kZS5cbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gUmVmZXJlbmNlcyBhcmUgYWxzbyBldmFsdWF0ZWQgaW4gdGhlIG91dGVyIGNvbnRleHQuXG4gICAgdGVtcGxhdGUucmVmZXJlbmNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcblxuICAgIC8vIE5leHQsIHJlY3Vyc2UgaW50byB0aGUgdGVtcGxhdGUgdXNpbmcgaXRzIHNjb3BlLCBhbmQgYnVtcGluZyB0aGUgbmVzdGluZyBsZXZlbCB1cCBieSBvbmUuXG4gICAgY29uc3QgY2hpbGRTY29wZSA9IHRoaXMuc2NvcGUuZ2V0Q2hpbGRTY29wZSh0ZW1wbGF0ZSk7XG4gICAgY29uc3QgYmluZGVyID0gbmV3IFRlbXBsYXRlQmluZGVyKFxuICAgICAgICB0aGlzLmJpbmRpbmdzLCB0aGlzLnN5bWJvbHMsIHRoaXMudXNlZFBpcGVzLCB0aGlzLmVhZ2VyUGlwZXMsIHRoaXMuZGVmZXJCbG9ja3MsXG4gICAgICAgIHRoaXMubmVzdGluZ0xldmVsLCBjaGlsZFNjb3BlLCB0ZW1wbGF0ZSwgdGhpcy5sZXZlbCArIDEpO1xuICAgIGJpbmRlci5pbmdlc3QodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFZhcmlhYmxlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHZhcmlhYmxlLCB0aGlzLnRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgUmVmZXJlbmNlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnRlbXBsYXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHJlZmVyZW5jZSwgdGhpcy50ZW1wbGF0ZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW51c2VkIHRlbXBsYXRlIHZpc2l0b3JzXG5cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdEljdShpY3U6IEljdSk6IHZvaWQge1xuICAgIE9iamVjdC5rZXlzKGljdS52YXJzKS5mb3JFYWNoKGtleSA9PiBpY3UudmFyc1trZXldLnZpc2l0KHRoaXMpKTtcbiAgICBPYmplY3Qua2V5cyhpY3UucGxhY2Vob2xkZXJzKS5mb3JFYWNoKGtleSA9PiBpY3UucGxhY2Vob2xkZXJzW2tleV0udmlzaXQodGhpcykpO1xuICB9XG5cbiAgLy8gVGhlIHJlbWFpbmluZyB2aXNpdG9ycyBhcmUgY29uY2VybmVkIHdpdGggcHJvY2Vzc2luZyBBU1QgZXhwcmVzc2lvbnMgd2l0aGluIHRlbXBsYXRlIGJpbmRpbmdzXG5cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKSB7XG4gICAgYXR0cmlidXRlLnZhbHVlLnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7XG4gICAgZXZlbnQuaGFuZGxlci52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jaykge1xuICAgIHRoaXMuZGVmZXJCbG9ja3MuYWRkKGRlZmVycmVkKTtcblxuICAgIGNvbnN0IHdhc0luRGVmZXJCbG9jayA9IHRoaXMuaXNJbkRlZmVyQmxvY2s7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHRydWU7XG4gICAgZGVmZXJyZWQuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHdhc0luRGVmZXJCbG9jaztcblxuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLnBsYWNlaG9sZGVyKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmxvYWRpbmcpO1xuICAgIGRlZmVycmVkLmVycm9yICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmVycm9yKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge1xuICAgIGlmICh0cmlnZ2VyIGluc3RhbmNlb2YgQm91bmREZWZlcnJlZFRyaWdnZXIpIHtcbiAgICAgIHRyaWdnZXIudmFsdWUudmlzaXQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcikge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcikge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spIHtcbiAgICBibG9jay5leHByZXNzaW9uLnZpc2l0KHRoaXMpO1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spIHtcbiAgICBibG9jay5icmFuY2hlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHtcbiAgICB0ZXh0LnZhbHVlLnZpc2l0KHRoaXMpO1xuICB9XG4gIG92ZXJyaWRlIHZpc2l0UGlwZShhc3Q6IEJpbmRpbmdQaXBlLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudXNlZFBpcGVzLmFkZChhc3QubmFtZSk7XG4gICAgaWYgKCF0aGlzLmlzSW5EZWZlckJsb2NrKSB7XG4gICAgICB0aGlzLmVhZ2VyUGlwZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UGlwZShhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gVGhlc2UgZml2ZSB0eXBlcyBvZiBBU1QgZXhwcmVzc2lvbnMgY2FuIHJlZmVyIHRvIGV4cHJlc3Npb24gcm9vdHMsIHdoaWNoIGNvdWxkIGJlIHZhcmlhYmxlc1xuICAvLyBvciByZWZlcmVuY2VzIGluIHRoZSBjdXJyZW50IHNjb3BlLlxuXG4gIG92ZXJyaWRlIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UHJvcGVydHlSZWFkKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoY29udGV4dCwgYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGNvbnRleHQsIGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5V3JpdGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoc2NvcGU6IFNjb3BlLCBhc3Q6IFByb3BlcnR5UmVhZHxTYWZlUHJvcGVydHlSZWFkfFByb3BlcnR5V3JpdGUsIG5hbWU6IHN0cmluZyk6XG4gICAgICB2b2lkIHtcbiAgICAvLyBJZiB0aGUgcmVjZWl2ZXIgb2YgdGhlIGV4cHJlc3Npb24gaXNuJ3QgdGhlIGBJbXBsaWNpdFJlY2VpdmVyYCwgdGhpcyBpc24ndCB0aGUgcm9vdCBvZiBhblxuICAgIC8vIGBBU1RgIGV4cHJlc3Npb24gdGhhdCBtYXBzIHRvIGEgYFZhcmlhYmxlYCBvciBgUmVmZXJlbmNlYC5cbiAgICBpZiAoIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlIG5hbWUgZXhpc3RzIGluIHRoZSBjdXJyZW50IHNjb3BlLiBJZiBzbywgbWFwIGl0LiBPdGhlcndpc2UsIHRoZSBuYW1lIGlzXG4gICAgLy8gcHJvYmFibHkgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCBjb250ZXh0LlxuICAgIGxldCB0YXJnZXQgPSB0aGlzLnNjb3BlLmxvb2t1cChuYW1lKTtcbiAgICBpZiAodGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmJpbmRpbmdzLnNldChhc3QsIHRhcmdldCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWV0YWRhdGEgY29udGFpbmVyIGZvciBhIGBUYXJnZXRgIHRoYXQgYWxsb3dzIHF1ZXJpZXMgZm9yIHNwZWNpZmljIGJpdHMgb2YgbWV0YWRhdGEuXG4gKlxuICogU2VlIGBCb3VuZFRhcmdldGAgZm9yIGRvY3VtZW50YXRpb24gb24gdGhlIGluZGl2aWR1YWwgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzQm91bmRUYXJnZXQ8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgQm91bmRUYXJnZXQ8RGlyZWN0aXZlVD4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHJlYWRvbmx5IHRhcmdldDogVGFyZ2V0LCBwcml2YXRlIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+LFxuICAgICAgcHJpdmF0ZSBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSxcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8UmVmZXJlbmNlfFRleHRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgVGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxUZW1wbGF0ZSwgbnVtYmVyPixcbiAgICAgIHByaXZhdGUgdGVtcGxhdGVFbnRpdGllczogTWFwPFRlbXBsYXRlfG51bGwsIFJlYWRvbmx5U2V0PFJlZmVyZW5jZXxWYXJpYWJsZT4+LFxuICAgICAgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LCBwcml2YXRlIGVhZ2VyUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgICAgcHJpdmF0ZSBkZWZlcnJlZEJsb2NrczogU2V0PERlZmVycmVkQmxvY2s+KSB7fVxuXG4gIGdldEVudGl0aWVzSW5UZW1wbGF0ZVNjb3BlKHRlbXBsYXRlOiBUZW1wbGF0ZXxudWxsKTogUmVhZG9ubHlTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPiB7XG4gICAgcmV0dXJuIHRoaXMudGVtcGxhdGVFbnRpdGllcy5nZXQodGVtcGxhdGUpID8/IG5ldyBTZXQoKTtcbiAgfVxuXG4gIGdldERpcmVjdGl2ZXNPZk5vZGUobm9kZTogRWxlbWVudHxUZW1wbGF0ZSk6IERpcmVjdGl2ZVRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5kaXJlY3RpdmVzLmdldChub2RlKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZjogUmVmZXJlbmNlKToge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZXMuZ2V0KHJlZikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldENvbnN1bWVyT2ZCaW5kaW5nKGJpbmRpbmc6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSk6IERpcmVjdGl2ZVR8RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdzLmdldChiaW5kaW5nKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvblRhcmdldChleHByOiBBU1QpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZXhwclRhcmdldHMuZ2V0KGV4cHIpIHx8IG51bGw7XG4gIH1cblxuICBnZXRUZW1wbGF0ZU9mU3ltYm9sKHN5bWJvbDogUmVmZXJlbmNlfFZhcmlhYmxlKTogVGVtcGxhdGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuc3ltYm9scy5nZXQoc3ltYm9sKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0TmVzdGluZ0xldmVsKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubmVzdGluZ0xldmVsLmdldCh0ZW1wbGF0ZSkgfHwgMDtcbiAgfVxuXG4gIGdldFVzZWREaXJlY3RpdmVzKCk6IERpcmVjdGl2ZVRbXSB7XG4gICAgY29uc3Qgc2V0ID0gbmV3IFNldDxEaXJlY3RpdmVUPigpO1xuICAgIHRoaXMuZGlyZWN0aXZlcy5mb3JFYWNoKGRpcnMgPT4gZGlycy5mb3JFYWNoKGRpciA9PiBzZXQuYWRkKGRpcikpKTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShzZXQudmFsdWVzKCkpO1xuICB9XG5cbiAgZ2V0RWFnZXJseVVzZWREaXJlY3RpdmVzKCk6IERpcmVjdGl2ZVRbXSB7XG4gICAgY29uc3Qgc2V0ID0gbmV3IFNldDxEaXJlY3RpdmVUPih0aGlzLmVhZ2VyRGlyZWN0aXZlcyk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy51c2VkUGlwZXMpO1xuICB9XG5cbiAgZ2V0RWFnZXJseVVzZWRQaXBlcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5lYWdlclBpcGVzKTtcbiAgfVxuXG4gIGdldERlZmVyQmxvY2tzKCk6IERlZmVycmVkQmxvY2tbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5kZWZlcnJlZEJsb2Nrcyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFRlbXBsYXRlRW50aXRpZXMocm9vdFNjb3BlOiBTY29wZSk6IE1hcDxUZW1wbGF0ZXxudWxsLCBTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4ge1xuICBjb25zdCBlbnRpdHlNYXAgPSBuZXcgTWFwPFRlbXBsYXRlfG51bGwsIE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4+KCk7XG5cbiAgZnVuY3Rpb24gZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGU6IFNjb3BlKTogTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPiB7XG4gICAgaWYgKGVudGl0eU1hcC5oYXMoc2NvcGUudGVtcGxhdGUpKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwLmdldChzY29wZS50ZW1wbGF0ZSkhO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRFbnRpdGllcyA9IHNjb3BlLm5hbWVkRW50aXRpZXM7XG5cbiAgICBsZXQgdGVtcGxhdGVFbnRpdGllczogTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPjtcbiAgICBpZiAoc2NvcGUucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIHRlbXBsYXRlRW50aXRpZXMgPSBuZXcgTWFwKFsuLi5leHRyYWN0U2NvcGVFbnRpdGllcyhzY29wZS5wYXJlbnRTY29wZSksIC4uLmN1cnJlbnRFbnRpdGllc10pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0ZW1wbGF0ZUVudGl0aWVzID0gbmV3IE1hcChjdXJyZW50RW50aXRpZXMpO1xuICAgIH1cblxuICAgIGVudGl0eU1hcC5zZXQoc2NvcGUudGVtcGxhdGUsIHRlbXBsYXRlRW50aXRpZXMpO1xuICAgIHJldHVybiB0ZW1wbGF0ZUVudGl0aWVzO1xuICB9XG5cbiAgY29uc3Qgc2NvcGVzVG9Qcm9jZXNzOiBTY29wZVtdID0gW3Jvb3RTY29wZV07XG4gIHdoaWxlIChzY29wZXNUb1Byb2Nlc3MubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHNjb3BlID0gc2NvcGVzVG9Qcm9jZXNzLnBvcCgpITtcbiAgICBmb3IgKGNvbnN0IGNoaWxkU2NvcGUgb2Ygc2NvcGUuY2hpbGRTY29wZXMudmFsdWVzKCkpIHtcbiAgICAgIHNjb3Blc1RvUHJvY2Vzcy5wdXNoKGNoaWxkU2NvcGUpO1xuICAgIH1cbiAgICBleHRyYWN0U2NvcGVFbnRpdGllcyhzY29wZSk7XG4gIH1cblxuICBjb25zdCB0ZW1wbGF0ZUVudGl0aWVzID0gbmV3IE1hcDxUZW1wbGF0ZXxudWxsLCBTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4oKTtcbiAgZm9yIChjb25zdCBbdGVtcGxhdGUsIGVudGl0aWVzXSBvZiBlbnRpdHlNYXApIHtcbiAgICB0ZW1wbGF0ZUVudGl0aWVzLnNldCh0ZW1wbGF0ZSwgbmV3IFNldChlbnRpdGllcy52YWx1ZXMoKSkpO1xuICB9XG4gIHJldHVybiB0ZW1wbGF0ZUVudGl0aWVzO1xufVxuIl19