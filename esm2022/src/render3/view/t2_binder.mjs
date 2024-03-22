/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ImplicitReceiver, RecursiveAstVisitor } from '../../expression_parser/ast';
import { Comment, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, Element, ForLoopBlock, ForLoopBlockEmpty, HoverDeferredTrigger, IfBlockBranch, InteractionDeferredTrigger, Reference, SwitchBlockCase, Template, ViewportDeferredTrigger } from '../r3_ast';
import { createCssSelectorFromNode } from './util';
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
        const scopedNodeEntities = extractScopedNodeEntities(scope);
        // Next, perform directive matching on the template using the `DirectiveBinder`. This returns:
        //   - directives: Map of nodes (elements & ng-templates) to the directives on them.
        //   - bindings: Map of inputs, outputs, and attributes to the directive/element that claims
        //     them. TODO(alxhub): handle multiple directives claiming an input/output/etc.
        //   - references: Map of #references to their targets.
        const { directives, eagerDirectives, bindings, references } = DirectiveBinder.apply(target.template, this.directiveMatcher);
        // Finally, run the TemplateBinder to bind references, variables, and other entities within the
        // template. This extracts all the metadata that doesn't depend on directive matching.
        const { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks } = TemplateBinder.applyWithScope(target.template, scope);
        return new R3BoundTarget(target, directives, eagerDirectives, bindings, references, expressions, symbols, nestingLevel, scopedNodeEntities, usedPipes, eagerPipes, deferBlocks);
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
    constructor(parentScope, rootNode) {
        this.parentScope = parentScope;
        this.rootNode = rootNode;
        /**
         * Named members of the `Scope`, such as `Reference`s or `Variable`s.
         */
        this.namedEntities = new Map();
        /**
         * Set of elements that belong to this scope.
         */
        this.elementsInScope = new Set();
        /**
         * Child `Scope`s for immediately nested `ScopedNode`s.
         */
        this.childScopes = new Map();
        this.isDeferred =
            parentScope !== null && parentScope.isDeferred ? true : rootNode instanceof DeferredBlock;
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
     * Internal method to process the scoped node and populate the `Scope`.
     */
    ingest(nodeOrNodes) {
        if (nodeOrNodes instanceof Template) {
            // Variables on an <ng-template> are defined in the inner scope.
            nodeOrNodes.variables.forEach(node => this.visitVariable(node));
            // Process the nodes of the template.
            nodeOrNodes.children.forEach(node => node.visit(this));
        }
        else if (nodeOrNodes instanceof IfBlockBranch) {
            if (nodeOrNodes.expressionAlias !== null) {
                this.visitVariable(nodeOrNodes.expressionAlias);
            }
            nodeOrNodes.children.forEach(node => node.visit(this));
        }
        else if (nodeOrNodes instanceof ForLoopBlock) {
            this.visitVariable(nodeOrNodes.item);
            nodeOrNodes.contextVariables.forEach(v => this.visitVariable(v));
            nodeOrNodes.children.forEach(node => node.visit(this));
        }
        else if (nodeOrNodes instanceof SwitchBlockCase || nodeOrNodes instanceof ForLoopBlockEmpty ||
            nodeOrNodes instanceof DeferredBlock || nodeOrNodes instanceof DeferredBlockError ||
            nodeOrNodes instanceof DeferredBlockPlaceholder ||
            nodeOrNodes instanceof DeferredBlockLoading) {
            nodeOrNodes.children.forEach(node => node.visit(this));
        }
        else {
            // No overarching `Template` instance, so process the nodes directly.
            nodeOrNodes.forEach(node => node.visit(this));
        }
    }
    visitElement(element) {
        // `Element`s in the template may have `Reference`s which are captured in the scope.
        element.references.forEach(node => this.visitReference(node));
        // Recurse into the `Element`'s children.
        element.children.forEach(node => node.visit(this));
        this.elementsInScope.add(element);
    }
    visitTemplate(template) {
        // References on a <ng-template> are defined in the outer scope, so capture them before
        // processing the template's child scope.
        template.references.forEach(node => this.visitReference(node));
        // Next, create an inner scope and process the template within it.
        this.ingestScopedNode(template);
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
        this.ingestScopedNode(deferred);
        deferred.placeholder?.visit(this);
        deferred.loading?.visit(this);
        deferred.error?.visit(this);
    }
    visitDeferredBlockPlaceholder(block) {
        this.ingestScopedNode(block);
    }
    visitDeferredBlockError(block) {
        this.ingestScopedNode(block);
    }
    visitDeferredBlockLoading(block) {
        this.ingestScopedNode(block);
    }
    visitSwitchBlock(block) {
        block.cases.forEach(node => node.visit(this));
    }
    visitSwitchBlockCase(block) {
        this.ingestScopedNode(block);
    }
    visitForLoopBlock(block) {
        this.ingestScopedNode(block);
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        this.ingestScopedNode(block);
    }
    visitIfBlock(block) {
        block.branches.forEach(node => node.visit(this));
    }
    visitIfBlockBranch(block) {
        this.ingestScopedNode(block);
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
    visitUnknownBlock(block) { }
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
     * Get the child scope for a `ScopedNode`.
     *
     * This should always be defined.
     */
    getChildScope(node) {
        const res = this.childScopes.get(node);
        if (res === undefined) {
            throw new Error(`Assertion error: child scope for ${node} not found`);
        }
        return res;
    }
    ingestScopedNode(node) {
        const scope = new Scope(this, node);
        scope.ingest(node);
        this.childScopes.set(node, scope);
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
        // Indicates whether we are visiting elements within a `defer` block
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
        this.visitElementOrTemplate(element);
    }
    visitTemplate(template) {
        this.visitElementOrTemplate(template);
    }
    visitElementOrTemplate(node) {
        // First, determine the HTML shape of the node for the purpose of directive matching.
        // Do this by building up a `CssSelector` for the node.
        const cssSelector = createCssSelectorFromNode(node);
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
        block.item.visit(this);
        block.contextVariables.forEach(v => v.visit(this));
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
        block.expressionAlias?.visit(this);
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
    visitUnknownBlock(block) { }
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
    constructor(bindings, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, rootNode, level) {
        super();
        this.bindings = bindings;
        this.symbols = symbols;
        this.usedPipes = usedPipes;
        this.eagerPipes = eagerPipes;
        this.deferBlocks = deferBlocks;
        this.nestingLevel = nestingLevel;
        this.scope = scope;
        this.rootNode = rootNode;
        this.level = level;
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
        const deferBlocks = [];
        // The top-level template has nesting level 0.
        const binder = new TemplateBinder(expressions, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, template, 0);
        binder.ingest(nodes);
        return { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks };
    }
    ingest(nodeOrNodes) {
        if (nodeOrNodes instanceof Template) {
            // For <ng-template>s, process only variables and child nodes. Inputs, outputs, templateAttrs,
            // and references were all processed in the scope of the containing template.
            nodeOrNodes.variables.forEach(this.visitNode);
            nodeOrNodes.children.forEach(this.visitNode);
            // Set the nesting level.
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof IfBlockBranch) {
            if (nodeOrNodes.expressionAlias !== null) {
                this.visitNode(nodeOrNodes.expressionAlias);
            }
            nodeOrNodes.children.forEach(this.visitNode);
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof ForLoopBlock) {
            this.visitNode(nodeOrNodes.item);
            nodeOrNodes.contextVariables.forEach(v => this.visitNode(v));
            nodeOrNodes.trackBy.visit(this);
            nodeOrNodes.children.forEach(this.visitNode);
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof DeferredBlock) {
            if (this.scope.rootNode !== nodeOrNodes) {
                throw new Error(`Assertion error: resolved incorrect scope for deferred block ${nodeOrNodes}`);
            }
            this.deferBlocks.push([nodeOrNodes, this.scope]);
            nodeOrNodes.children.forEach(node => node.visit(this));
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof SwitchBlockCase || nodeOrNodes instanceof ForLoopBlockEmpty ||
            nodeOrNodes instanceof DeferredBlockError ||
            nodeOrNodes instanceof DeferredBlockPlaceholder ||
            nodeOrNodes instanceof DeferredBlockLoading) {
            nodeOrNodes.children.forEach(node => node.visit(this));
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else {
            // Visit each node from the top-level template.
            nodeOrNodes.forEach(this.visitNode);
        }
    }
    visitElement(element) {
        // Visit the inputs, outputs, and children of the element.
        element.inputs.forEach(this.visitNode);
        element.outputs.forEach(this.visitNode);
        element.children.forEach(this.visitNode);
        element.references.forEach(this.visitNode);
    }
    visitTemplate(template) {
        // First, visit inputs, outputs and template attributes of the template node.
        template.inputs.forEach(this.visitNode);
        template.outputs.forEach(this.visitNode);
        template.templateAttrs.forEach(this.visitNode);
        template.references.forEach(this.visitNode);
        // Next, recurse into the template.
        this.ingestScopedNode(template);
    }
    visitVariable(variable) {
        // Register the `Variable` as a symbol in the current `Template`.
        if (this.rootNode !== null) {
            this.symbols.set(variable, this.rootNode);
        }
    }
    visitReference(reference) {
        // Register the `Reference` as a symbol in the current `Template`.
        if (this.rootNode !== null) {
            this.symbols.set(reference, this.rootNode);
        }
    }
    // Unused template visitors
    visitText(text) { }
    visitContent(content) { }
    visitTextAttribute(attribute) { }
    visitUnknownBlock(block) { }
    visitDeferredTrigger() { }
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
        this.ingestScopedNode(deferred);
        deferred.triggers.when?.value.visit(this);
        deferred.prefetchTriggers.when?.value.visit(this);
        deferred.placeholder && this.visitNode(deferred.placeholder);
        deferred.loading && this.visitNode(deferred.loading);
        deferred.error && this.visitNode(deferred.error);
    }
    visitDeferredBlockPlaceholder(block) {
        this.ingestScopedNode(block);
    }
    visitDeferredBlockError(block) {
        this.ingestScopedNode(block);
    }
    visitDeferredBlockLoading(block) {
        this.ingestScopedNode(block);
    }
    visitSwitchBlock(block) {
        block.expression.visit(this);
        block.cases.forEach(this.visitNode);
    }
    visitSwitchBlockCase(block) {
        block.expression?.visit(this);
        this.ingestScopedNode(block);
    }
    visitForLoopBlock(block) {
        block.expression.visit(this);
        this.ingestScopedNode(block);
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        this.ingestScopedNode(block);
    }
    visitIfBlock(block) {
        block.branches.forEach(node => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.expression?.visit(this);
        this.ingestScopedNode(block);
    }
    visitBoundText(text) {
        text.value.visit(this);
    }
    visitPipe(ast, context) {
        this.usedPipes.add(ast.name);
        if (!this.scope.isDeferred) {
            this.eagerPipes.add(ast.name);
        }
        return super.visitPipe(ast, context);
    }
    // These five types of AST expressions can refer to expression roots, which could be variables
    // or references in the current scope.
    visitPropertyRead(ast, context) {
        this.maybeMap(ast, ast.name);
        return super.visitPropertyRead(ast, context);
    }
    visitSafePropertyRead(ast, context) {
        this.maybeMap(ast, ast.name);
        return super.visitSafePropertyRead(ast, context);
    }
    visitPropertyWrite(ast, context) {
        this.maybeMap(ast, ast.name);
        return super.visitPropertyWrite(ast, context);
    }
    ingestScopedNode(node) {
        const childScope = this.scope.getChildScope(node);
        const binder = new TemplateBinder(this.bindings, this.symbols, this.usedPipes, this.eagerPipes, this.deferBlocks, this.nestingLevel, childScope, node, this.level + 1);
        binder.ingest(node);
    }
    maybeMap(ast, name) {
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
    constructor(target, directives, eagerDirectives, bindings, references, exprTargets, symbols, nestingLevel, scopedNodeEntities, usedPipes, eagerPipes, rawDeferred) {
        this.target = target;
        this.directives = directives;
        this.eagerDirectives = eagerDirectives;
        this.bindings = bindings;
        this.references = references;
        this.exprTargets = exprTargets;
        this.symbols = symbols;
        this.nestingLevel = nestingLevel;
        this.scopedNodeEntities = scopedNodeEntities;
        this.usedPipes = usedPipes;
        this.eagerPipes = eagerPipes;
        this.deferredBlocks = rawDeferred.map(current => current[0]);
        this.deferredScopes = new Map(rawDeferred);
    }
    getEntitiesInScope(node) {
        return this.scopedNodeEntities.get(node) ?? new Set();
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
    getDefinitionNodeOfSymbol(symbol) {
        return this.symbols.get(symbol) || null;
    }
    getNestingLevel(node) {
        return this.nestingLevel.get(node) || 0;
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
        return this.deferredBlocks;
    }
    getDeferredTriggerTarget(block, trigger) {
        // Only triggers that refer to DOM nodes can be resolved.
        if (!(trigger instanceof InteractionDeferredTrigger) &&
            !(trigger instanceof ViewportDeferredTrigger) &&
            !(trigger instanceof HoverDeferredTrigger)) {
            return null;
        }
        const name = trigger.reference;
        if (name === null) {
            let trigger = null;
            if (block.placeholder !== null) {
                for (const child of block.placeholder.children) {
                    // Skip over comment nodes. Currently by default the template parser doesn't capture
                    // comments, but we have a safeguard here just in case since it can be enabled.
                    if (child instanceof Comment) {
                        continue;
                    }
                    // We can only infer the trigger if there's one root element node. Any other
                    // nodes at the root make it so that we can't infer the trigger anymore.
                    if (trigger !== null) {
                        return null;
                    }
                    if (child instanceof Element) {
                        trigger = child;
                    }
                }
            }
            return trigger;
        }
        const outsideRef = this.findEntityInScope(block, name);
        // First try to resolve the target in the scope of the main deferred block. Note that we
        // skip triggers defined inside the main block itself, because they might not exist yet.
        if (outsideRef instanceof Reference && this.getDefinitionNodeOfSymbol(outsideRef) !== block) {
            const target = this.getReferenceTarget(outsideRef);
            if (target !== null) {
                return this.referenceTargetToElement(target);
            }
        }
        // If the trigger couldn't be found in the main block, check the
        // placeholder block which is shown before the main block has loaded.
        if (block.placeholder !== null) {
            const refInPlaceholder = this.findEntityInScope(block.placeholder, name);
            const targetInPlaceholder = refInPlaceholder instanceof Reference ? this.getReferenceTarget(refInPlaceholder) : null;
            if (targetInPlaceholder !== null) {
                return this.referenceTargetToElement(targetInPlaceholder);
            }
        }
        return null;
    }
    isDeferred(element) {
        for (const block of this.deferredBlocks) {
            if (!this.deferredScopes.has(block)) {
                continue;
            }
            const stack = [this.deferredScopes.get(block)];
            while (stack.length > 0) {
                const current = stack.pop();
                if (current.elementsInScope.has(element)) {
                    return true;
                }
                stack.push(...current.childScopes.values());
            }
        }
        return false;
    }
    /**
     * Finds an entity with a specific name in a scope.
     * @param rootNode Root node of the scope.
     * @param name Name of the entity.
     */
    findEntityInScope(rootNode, name) {
        const entities = this.getEntitiesInScope(rootNode);
        for (const entitity of entities) {
            if (entitity.name === name) {
                return entitity;
            }
        }
        return null;
    }
    /** Coerces a `ReferenceTarget` to an `Element`, if possible. */
    referenceTargetToElement(target) {
        if (target instanceof Element) {
            return target;
        }
        if (target instanceof Template) {
            return null;
        }
        return this.referenceTargetToElement(target.node);
    }
}
function extractScopedNodeEntities(rootScope) {
    const entityMap = new Map();
    function extractScopeEntities(scope) {
        if (entityMap.has(scope.rootNode)) {
            return entityMap.get(scope.rootNode);
        }
        const currentEntities = scope.namedEntities;
        let entities;
        if (scope.parentScope !== null) {
            entities = new Map([...extractScopeEntities(scope.parentScope), ...currentEntities]);
        }
        else {
            entities = new Map(currentEntities);
        }
        entityMap.set(scope.rootNode, entities);
        return entities;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBZSxnQkFBZ0IsRUFBK0IsbUJBQW1CLEVBQW1CLE1BQU0sNkJBQTZCLENBQUM7QUFFbkosT0FBTyxFQUF3QyxPQUFPLEVBQVcsYUFBYSxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLHdCQUF3QixFQUFtQixPQUFPLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFnQixhQUFhLEVBQUUsMEJBQTBCLEVBQVEsU0FBUyxFQUFlLGVBQWUsRUFBRSxRQUFRLEVBQStDLHVCQUF1QixFQUFVLE1BQU0sV0FBVyxDQUFDO0FBR3ZiLE9BQU8sRUFBQyx5QkFBeUIsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUVqRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFDekIsWUFBb0IsZ0JBQStDO1FBQS9DLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBK0I7SUFBRyxDQUFDO0lBRXZFOzs7T0FHRztJQUNILElBQUksQ0FBQyxNQUFjO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDckIsNEVBQTRFO1lBQzVFLE1BQU0sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBRUQsNEZBQTRGO1FBQzVGLGlFQUFpRTtRQUNqRSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUzQyxrRkFBa0Y7UUFDbEYsTUFBTSxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1RCw4RkFBOEY7UUFDOUYsb0ZBQW9G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QUksU0FBUyxFQUFFLENBQUM7UUFDN0MsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFDRCxPQUFPLGdCQUFnQixDQUFDO0FBQzFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBU1QsIEJpbmRpbmdQaXBlLCBJbXBsaWNpdFJlY2VpdmVyLCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsIFNhZmVQcm9wZXJ0eVJlYWR9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1NlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtCb3VuZEF0dHJpYnV0ZSwgQm91bmRFdmVudCwgQm91bmRUZXh0LCBDb21tZW50LCBDb250ZW50LCBEZWZlcnJlZEJsb2NrLCBEZWZlcnJlZEJsb2NrRXJyb3IsIERlZmVycmVkQmxvY2tMb2FkaW5nLCBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIsIERlZmVycmVkVHJpZ2dlciwgRWxlbWVudCwgRm9yTG9vcEJsb2NrLCBGb3JMb29wQmxvY2tFbXB0eSwgSG92ZXJEZWZlcnJlZFRyaWdnZXIsIEljdSwgSWZCbG9jaywgSWZCbG9ja0JyYW5jaCwgSW50ZXJhY3Rpb25EZWZlcnJlZFRyaWdnZXIsIE5vZGUsIFJlZmVyZW5jZSwgU3dpdGNoQmxvY2ssIFN3aXRjaEJsb2NrQ2FzZSwgVGVtcGxhdGUsIFRleHQsIFRleHRBdHRyaWJ1dGUsIFVua25vd25CbG9jaywgVmFyaWFibGUsIFZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyLCBWaXNpdG9yfSBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge0JvdW5kVGFyZ2V0LCBEaXJlY3RpdmVNZXRhLCBSZWZlcmVuY2VUYXJnZXQsIFNjb3BlZE5vZGUsIFRhcmdldCwgVGFyZ2V0QmluZGVyfSBmcm9tICcuL3QyX2FwaSc7XG5pbXBvcnQge2NyZWF0ZUNzc1NlbGVjdG9yRnJvbU5vZGV9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogUHJvY2Vzc2VzIGBUYXJnZXRgcyB3aXRoIGEgZ2l2ZW4gc2V0IG9mIGRpcmVjdGl2ZXMgYW5kIHBlcmZvcm1zIGEgYmluZGluZyBvcGVyYXRpb24sIHdoaWNoXG4gKiByZXR1cm5zIGFuIG9iamVjdCBzaW1pbGFyIHRvIFR5cGVTY3JpcHQncyBgdHMuVHlwZUNoZWNrZXJgIHRoYXQgY29udGFpbnMga25vd2xlZGdlIGFib3V0IHRoZVxuICogdGFyZ2V0LlxuICovXG5leHBvcnQgY2xhc3MgUjNUYXJnZXRCaW5kZXI8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPikge31cblxuICAvKipcbiAgICogUGVyZm9ybSBhIGJpbmRpbmcgb3BlcmF0aW9uIG9uIHRoZSBnaXZlbiBgVGFyZ2V0YCBhbmQgcmV0dXJuIGEgYEJvdW5kVGFyZ2V0YCB3aGljaCBjb250YWluc1xuICAgKiBtZXRhZGF0YSBhYm91dCB0aGUgdHlwZXMgcmVmZXJlbmNlZCBpbiB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBiaW5kKHRhcmdldDogVGFyZ2V0KTogQm91bmRUYXJnZXQ8RGlyZWN0aXZlVD4ge1xuICAgIGlmICghdGFyZ2V0LnRlbXBsYXRlKSB7XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IGhhbmRsZSB0YXJnZXRzIHdoaWNoIGNvbnRhaW4gdGhpbmdzIGxpa2UgSG9zdEJpbmRpbmdzLCBldGMuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JpbmRpbmcgd2l0aG91dCBhIHRlbXBsYXRlIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG4gICAgfVxuXG4gICAgLy8gRmlyc3QsIHBhcnNlIHRoZSB0ZW1wbGF0ZSBpbnRvIGEgYFNjb3BlYCBzdHJ1Y3R1cmUuIFRoaXMgb3BlcmF0aW9uIGNhcHR1cmVzIHRoZSBzeW50YWN0aWNcbiAgICAvLyBzY29wZXMgaW4gdGhlIHRlbXBsYXRlIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgbGF0ZXIgdXNlLlxuICAgIGNvbnN0IHNjb3BlID0gU2NvcGUuYXBwbHkodGFyZ2V0LnRlbXBsYXRlKTtcblxuICAgIC8vIFVzZSB0aGUgYFNjb3BlYCB0byBleHRyYWN0IHRoZSBlbnRpdGllcyBwcmVzZW50IGF0IGV2ZXJ5IGxldmVsIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICBjb25zdCBzY29wZWROb2RlRW50aXRpZXMgPSBleHRyYWN0U2NvcGVkTm9kZUVudGl0aWVzKHNjb3BlKTtcblxuICAgIC8vIE5leHQsIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIG9uIHRoZSB0ZW1wbGF0ZSB1c2luZyB0aGUgYERpcmVjdGl2ZUJpbmRlcmAuIFRoaXMgcmV0dXJuczpcbiAgICAvLyAgIC0gZGlyZWN0aXZlczogTWFwIG9mIG5vZGVzIChlbGVtZW50cyAmIG5nLXRlbXBsYXRlcykgdG8gdGhlIGRpcmVjdGl2ZXMgb24gdGhlbS5cbiAgICAvLyAgIC0gYmluZGluZ3M6IE1hcCBvZiBpbnB1dHMsIG91dHB1dHMsIGFuZCBhdHRyaWJ1dGVzIHRvIHRoZSBkaXJlY3RpdmUvZWxlbWVudCB0aGF0IGNsYWltc1xuICAgIC8vICAgICB0aGVtLiBUT0RPKGFseGh1Yik6IGhhbmRsZSBtdWx0aXBsZSBkaXJlY3RpdmVzIGNsYWltaW5nIGFuIGlucHV0L291dHB1dC9ldGMuXG4gICAgLy8gICAtIHJlZmVyZW5jZXM6IE1hcCBvZiAjcmVmZXJlbmNlcyB0byB0aGVpciB0YXJnZXRzLlxuICAgIGNvbnN0IHtkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfSA9XG4gICAgICAgIERpcmVjdGl2ZUJpbmRlci5hcHBseSh0YXJnZXQudGVtcGxhdGUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlcik7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXMsIGVhZ2VyUGlwZXMsIGRlZmVyQmxvY2tzfSA9XG4gICAgICAgIFRlbXBsYXRlQmluZGVyLmFwcGx5V2l0aFNjb3BlKHRhcmdldC50ZW1wbGF0ZSwgc2NvcGUpO1xuICAgIHJldHVybiBuZXcgUjNCb3VuZFRhcmdldChcbiAgICAgICAgdGFyZ2V0LCBkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzLCBleHByZXNzaW9ucywgc3ltYm9scyxcbiAgICAgICAgbmVzdGluZ0xldmVsLCBzY29wZWROb2RlRW50aXRpZXMsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3MpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGJpbmRpbmcgc2NvcGUgd2l0aGluIGEgdGVtcGxhdGUuXG4gKlxuICogQW55IHZhcmlhYmxlcywgcmVmZXJlbmNlcywgb3Igb3RoZXIgbmFtZWQgZW50aXRpZXMgZGVjbGFyZWQgd2l0aGluIHRoZSB0ZW1wbGF0ZSB3aWxsXG4gKiBiZSBjYXB0dXJlZCBhbmQgYXZhaWxhYmxlIGJ5IG5hbWUgaW4gYG5hbWVkRW50aXRpZXNgLiBBZGRpdGlvbmFsbHksIGNoaWxkIHRlbXBsYXRlcyB3aWxsXG4gKiBiZSBhbmFseXplZCBhbmQgaGF2ZSB0aGVpciBjaGlsZCBgU2NvcGVgcyBhdmFpbGFibGUgaW4gYGNoaWxkU2NvcGVzYC5cbiAqL1xuY2xhc3MgU2NvcGUgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLyoqXG4gICAqIE5hbWVkIG1lbWJlcnMgb2YgdGhlIGBTY29wZWAsIHN1Y2ggYXMgYFJlZmVyZW5jZWBzIG9yIGBWYXJpYWJsZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgbmFtZWRFbnRpdGllcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIFNldCBvZiBlbGVtZW50cyB0aGF0IGJlbG9uZyB0byB0aGlzIHNjb3BlLlxuICAgKi9cbiAgcmVhZG9ubHkgZWxlbWVudHNJblNjb3BlID0gbmV3IFNldDxFbGVtZW50PigpO1xuXG4gIC8qKlxuICAgKiBDaGlsZCBgU2NvcGVgcyBmb3IgaW1tZWRpYXRlbHkgbmVzdGVkIGBTY29wZWROb2RlYHMuXG4gICAqL1xuICByZWFkb25seSBjaGlsZFNjb3BlcyA9IG5ldyBNYXA8U2NvcGVkTm9kZSwgU2NvcGU+KCk7XG5cbiAgLyoqIFdoZXRoZXIgdGhpcyBzY29wZSBpcyBkZWZlcnJlZCBvciBpZiBhbnkgb2YgaXRzIGFuY2VzdG9ycyBhcmUgZGVmZXJyZWQuICovXG4gIHJlYWRvbmx5IGlzRGVmZXJyZWQ6IGJvb2xlYW47XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihyZWFkb25seSBwYXJlbnRTY29wZTogU2NvcGV8bnVsbCwgcmVhZG9ubHkgcm9vdE5vZGU6IFNjb3BlZE5vZGV8bnVsbCkge1xuICAgIHRoaXMuaXNEZWZlcnJlZCA9XG4gICAgICAgIHBhcmVudFNjb3BlICE9PSBudWxsICYmIHBhcmVudFNjb3BlLmlzRGVmZXJyZWQgPyB0cnVlIDogcm9vdE5vZGUgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrO1xuICB9XG5cbiAgc3RhdGljIG5ld1Jvb3RTY29wZSgpOiBTY29wZSB7XG4gICAgcmV0dXJuIG5ldyBTY29wZShudWxsLCBudWxsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGVpdGhlciBhcyBhIGBUZW1wbGF0ZWAgc3ViLXRlbXBsYXRlIHdpdGggdmFyaWFibGVzLCBvciBhIHBsYWluIGFycmF5IG9mXG4gICAqIHRlbXBsYXRlIGBOb2RlYHMpIGFuZCBjb25zdHJ1Y3QgaXRzIGBTY29wZWAuXG4gICAqL1xuICBzdGF0aWMgYXBwbHkodGVtcGxhdGU6IE5vZGVbXSk6IFNjb3BlIHtcbiAgICBjb25zdCBzY29wZSA9IFNjb3BlLm5ld1Jvb3RTY29wZSgpO1xuICAgIHNjb3BlLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHNjb3BlO1xuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIG1ldGhvZCB0byBwcm9jZXNzIHRoZSBzY29wZWQgbm9kZSBhbmQgcG9wdWxhdGUgdGhlIGBTY29wZWAuXG4gICAqL1xuICBwcml2YXRlIGluZ2VzdChub2RlT3JOb2RlczogU2NvcGVkTm9kZXxOb2RlW10pOiB2b2lkIHtcbiAgICBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgLy8gVmFyaWFibGVzIG9uIGFuIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIGlubmVyIHNjb3BlLlxuICAgICAgbm9kZU9yTm9kZXMudmFyaWFibGVzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0VmFyaWFibGUobm9kZSkpO1xuXG4gICAgICAvLyBQcm9jZXNzIHRoZSBub2RlcyBvZiB0aGUgdGVtcGxhdGUuXG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIElmQmxvY2tCcmFuY2gpIHtcbiAgICAgIGlmIChub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy52aXNpdFZhcmlhYmxlKG5vZGVPck5vZGVzLmV4cHJlc3Npb25BbGlhcyk7XG4gICAgICB9XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9jaykge1xuICAgICAgdGhpcy52aXNpdFZhcmlhYmxlKG5vZGVPck5vZGVzLml0ZW0pO1xuICAgICAgbm9kZU9yTm9kZXMuY29udGV4dFZhcmlhYmxlcy5mb3JFYWNoKHYgPT4gdGhpcy52aXNpdFZhcmlhYmxlKHYpKTtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFN3aXRjaEJsb2NrQ2FzZSB8fCBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9ja0VtcHR5IHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9jayB8fCBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tFcnJvciB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tMb2FkaW5nKSB7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vIG92ZXJhcmNoaW5nIGBUZW1wbGF0ZWAgaW5zdGFuY2UsIHNvIHByb2Nlc3MgdGhlIG5vZGVzIGRpcmVjdGx5LlxuICAgICAgbm9kZU9yTm9kZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KSB7XG4gICAgLy8gYEVsZW1lbnRgcyBpbiB0aGUgdGVtcGxhdGUgbWF5IGhhdmUgYFJlZmVyZW5jZWBzIHdoaWNoIGFyZSBjYXB0dXJlZCBpbiB0aGUgc2NvcGUuXG4gICAgZWxlbWVudC5yZWZlcmVuY2VzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgYEVsZW1lbnRgJ3MgY2hpbGRyZW4uXG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG5cbiAgICB0aGlzLmVsZW1lbnRzSW5TY29wZS5hZGQoZWxlbWVudCk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSkge1xuICAgIC8vIFJlZmVyZW5jZXMgb24gYSA8bmctdGVtcGxhdGU+IGFyZSBkZWZpbmVkIGluIHRoZSBvdXRlciBzY29wZSwgc28gY2FwdHVyZSB0aGVtIGJlZm9yZVxuICAgIC8vIHByb2Nlc3NpbmcgdGhlIHRlbXBsYXRlJ3MgY2hpbGQgc2NvcGUuXG4gICAgdGVtcGxhdGUucmVmZXJlbmNlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFJlZmVyZW5jZShub2RlKSk7XG5cbiAgICAvLyBOZXh0LCBjcmVhdGUgYW4gaW5uZXIgc2NvcGUgYW5kIHByb2Nlc3MgdGhlIHRlbXBsYXRlIHdpdGhpbiBpdC5cbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHZhcmlhYmxlKTtcbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZShyZWZlcmVuY2UpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrKGRlZmVycmVkOiBEZWZlcnJlZEJsb2NrKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGRlZmVycmVkKTtcbiAgICBkZWZlcnJlZC5wbGFjZWhvbGRlcj8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQubG9hZGluZz8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQuZXJyb3I/LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suY2FzZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spIHtcbiAgICBibG9jay5icmFuY2hlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyOiBCb3VuZEF0dHJpYnV0ZSkge31cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cjogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcikge31cbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jaykge31cblxuICBwcml2YXRlIG1heWJlRGVjbGFyZSh0aGluZzogUmVmZXJlbmNlfFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSBzb21ldGhpbmcgd2l0aCBhIG5hbWUsIGFzIGxvbmcgYXMgdGhhdCBuYW1lIGlzbid0IHRha2VuLlxuICAgIGlmICghdGhpcy5uYW1lZEVudGl0aWVzLmhhcyh0aGluZy5uYW1lKSkge1xuICAgICAgdGhpcy5uYW1lZEVudGl0aWVzLnNldCh0aGluZy5uYW1lLCB0aGluZyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIExvb2sgdXAgYSB2YXJpYWJsZSB3aXRoaW4gdGhpcyBgU2NvcGVgLlxuICAgKlxuICAgKiBUaGlzIGNhbiByZWN1cnNlIGludG8gYSBwYXJlbnQgYFNjb3BlYCBpZiBpdCdzIGF2YWlsYWJsZS5cbiAgICovXG4gIGxvb2t1cChuYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgaWYgKHRoaXMubmFtZWRFbnRpdGllcy5oYXMobmFtZSkpIHtcbiAgICAgIC8vIEZvdW5kIGluIHRoZSBsb2NhbCBzY29wZS5cbiAgICAgIHJldHVybiB0aGlzLm5hbWVkRW50aXRpZXMuZ2V0KG5hbWUpITtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIC8vIE5vdCBpbiB0aGUgbG9jYWwgc2NvcGUsIGJ1dCB0aGVyZSdzIGEgcGFyZW50IHNjb3BlIHNvIGNoZWNrIHRoZXJlLlxuICAgICAgcmV0dXJuIHRoaXMucGFyZW50U2NvcGUubG9va3VwKG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBdCB0aGUgdG9wIGxldmVsIGFuZCBpdCB3YXNuJ3QgZm91bmQuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjaGlsZCBzY29wZSBmb3IgYSBgU2NvcGVkTm9kZWAuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGFsd2F5cyBiZSBkZWZpbmVkLlxuICAgKi9cbiAgZ2V0Q2hpbGRTY29wZShub2RlOiBTY29wZWROb2RlKTogU2NvcGUge1xuICAgIGNvbnN0IHJlcyA9IHRoaXMuY2hpbGRTY29wZXMuZ2V0KG5vZGUpO1xuICAgIGlmIChyZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb24gZXJyb3I6IGNoaWxkIHNjb3BlIGZvciAke25vZGV9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3RTY29wZWROb2RlKG5vZGU6IFNjb3BlZE5vZGUpIHtcbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSh0aGlzLCBub2RlKTtcbiAgICBzY29wZS5pbmdlc3Qobm9kZSk7XG4gICAgdGhpcy5jaGlsZFNjb3Blcy5zZXQobm9kZSwgc2NvcGUpO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIG1hdGNoZXMgZGlyZWN0aXZlcyBvbiBub2RlcyAoZWxlbWVudHMgYW5kIHRlbXBsYXRlcykuXG4gKlxuICogVXN1YWxseSB1c2VkIHZpYSB0aGUgc3RhdGljIGBhcHBseSgpYCBtZXRob2QuXG4gKi9cbmNsYXNzIERpcmVjdGl2ZUJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLy8gSW5kaWNhdGVzIHdoZXRoZXIgd2UgYXJlIHZpc2l0aW5nIGVsZW1lbnRzIHdpdGhpbiBhIGBkZWZlcmAgYmxvY2tcbiAgcHJpdmF0ZSBpc0luRGVmZXJCbG9jayA9IGZhbHNlO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUW10+LFxuICAgICAgcHJpdmF0ZSBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10sXG4gICAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgICAgcHJpdmF0ZSByZWZlcmVuY2VzOlxuICAgICAgICAgIE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGxpc3Qgb2YgYE5vZGVgcykgYW5kIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIGFnYWluc3QgZWFjaCBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGUgdGhlIGxpc3Qgb2YgdGVtcGxhdGUgYE5vZGVgcyB0byBtYXRjaCAocmVjdXJzaXZlbHkpLlxuICAgKiBAcGFyYW0gc2VsZWN0b3JNYXRjaGVyIGEgYFNlbGVjdG9yTWF0Y2hlcmAgY29udGFpbmluZyB0aGUgZGlyZWN0aXZlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3JcbiAgICogdGhpcyB0ZW1wbGF0ZS5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIGluZm9ybWF0aW9uIGFib3V0IGRpcmVjdGl2ZXMgaW4gdGhlIHRlbXBsYXRlOiB0aGVcbiAgICogYGRpcmVjdGl2ZXNgIG1hcCB3aGljaCBsaXN0cyBkaXJlY3RpdmVzIG1hdGNoZWQgb24gZWFjaCBub2RlLCB0aGUgYGJpbmRpbmdzYCBtYXAgd2hpY2hcbiAgICogaW5kaWNhdGVzIHdoaWNoIGRpcmVjdGl2ZXMgY2xhaW1lZCB3aGljaCBiaW5kaW5ncyAoaW5wdXRzLCBvdXRwdXRzLCBldGMpLCBhbmQgdGhlIGByZWZlcmVuY2VzYFxuICAgKiBtYXAgd2hpY2ggcmVzb2x2ZXMgI3JlZmVyZW5jZXMgKGBSZWZlcmVuY2Vgcykgd2l0aGluIHRoZSB0ZW1wbGF0ZSB0byB0aGUgbmFtZWQgZGlyZWN0aXZlIG9yXG4gICAqIHRlbXBsYXRlIG5vZGUuXG4gICAqL1xuICBzdGF0aWMgYXBwbHk8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+KFxuICAgICAgdGVtcGxhdGU6IE5vZGVbXSwgc2VsZWN0b3JNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPik6IHtcbiAgICBkaXJlY3RpdmVzOiBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPixcbiAgICBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSxcbiAgICBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICByZWZlcmVuY2VzOiBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50fFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPixcbiAgfSB7XG4gICAgY29uc3QgZGlyZWN0aXZlcyA9IG5ldyBNYXA8RWxlbWVudHxUZW1wbGF0ZSwgRGlyZWN0aXZlVFtdPigpO1xuICAgIGNvbnN0IGJpbmRpbmdzID1cbiAgICAgICAgbmV3IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCByZWZlcmVuY2VzID1cbiAgICAgICAgbmV3IE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnQgfCBUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSA9IFtdO1xuICAgIGNvbnN0IG1hdGNoZXIgPVxuICAgICAgICBuZXcgRGlyZWN0aXZlQmluZGVyKHNlbGVjdG9yTWF0Y2hlciwgZGlyZWN0aXZlcywgZWFnZXJEaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlcyk7XG4gICAgbWF0Y2hlci5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiB7ZGlyZWN0aXZlcywgZWFnZXJEaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogTm9kZVtdKTogdm9pZCB7XG4gICAgdGVtcGxhdGUuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoZWxlbWVudCk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZSh0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBGaXJzdCwgZGV0ZXJtaW5lIHRoZSBIVE1MIHNoYXBlIG9mIHRoZSBub2RlIGZvciB0aGUgcHVycG9zZSBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgLy8gRG8gdGhpcyBieSBidWlsZGluZyB1cCBhIGBDc3NTZWxlY3RvcmAgZm9yIHRoZSBub2RlLlxuICAgIGNvbnN0IGNzc1NlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3JGcm9tTm9kZShub2RlKTtcblxuICAgIC8vIE5leHQsIHVzZSB0aGUgYFNlbGVjdG9yTWF0Y2hlcmAgdG8gZ2V0IHRoZSBsaXN0IG9mIGRpcmVjdGl2ZXMgb24gdGhlIG5vZGUuXG4gICAgY29uc3QgZGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgdGhpcy5tYXRjaGVyLm1hdGNoKGNzc1NlbGVjdG9yLCAoX3NlbGVjdG9yLCByZXN1bHRzKSA9PiBkaXJlY3RpdmVzLnB1c2goLi4ucmVzdWx0cykpO1xuICAgIGlmIChkaXJlY3RpdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZGlyZWN0aXZlcy5zZXQobm9kZSwgZGlyZWN0aXZlcyk7XG4gICAgICBpZiAoIXRoaXMuaXNJbkRlZmVyQmxvY2spIHtcbiAgICAgICAgdGhpcy5lYWdlckRpcmVjdGl2ZXMucHVzaCguLi5kaXJlY3RpdmVzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFueSByZWZlcmVuY2VzIHRoYXQgYXJlIGNyZWF0ZWQgb24gdGhpcyBub2RlLlxuICAgIG5vZGUucmVmZXJlbmNlcy5mb3JFYWNoKHJlZiA9PiB7XG4gICAgICBsZXQgZGlyVGFyZ2V0OiBEaXJlY3RpdmVUfG51bGwgPSBudWxsO1xuXG4gICAgICAvLyBJZiB0aGUgcmVmZXJlbmNlIGV4cHJlc3Npb24gaXMgZW1wdHksIHRoZW4gaXQgbWF0Y2hlcyB0aGUgXCJwcmltYXJ5XCIgZGlyZWN0aXZlIG9uIHRoZSBub2RlXG4gICAgICAvLyAoaWYgdGhlcmUgaXMgb25lKS4gT3RoZXJ3aXNlIGl0IG1hdGNoZXMgdGhlIGhvc3Qgbm9kZSBpdHNlbGYgKGVpdGhlciBhbiBlbGVtZW50IG9yXG4gICAgICAvLyA8bmctdGVtcGxhdGU+IG5vZGUpLlxuICAgICAgaWYgKHJlZi52YWx1ZS50cmltKCkgPT09ICcnKSB7XG4gICAgICAgIC8vIFRoaXMgY291bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBjb21wb25lbnQgaWYgdGhlcmUgaXMgb25lLlxuICAgICAgICBkaXJUYXJnZXQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5pc0NvbXBvbmVudCkgfHwgbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIGJlIGEgcmVmZXJlbmNlIHRvIGEgZGlyZWN0aXZlIGV4cG9ydGVkIHZpYSBleHBvcnRBcy5cbiAgICAgICAgZGlyVGFyZ2V0ID1cbiAgICAgICAgICAgIGRpcmVjdGl2ZXMuZmluZChcbiAgICAgICAgICAgICAgICBkaXIgPT4gZGlyLmV4cG9ydEFzICE9PSBudWxsICYmIGRpci5leHBvcnRBcy5zb21lKHZhbHVlID0+IHZhbHVlID09PSByZWYudmFsdWUpKSB8fFxuICAgICAgICAgICAgbnVsbDtcbiAgICAgICAgLy8gQ2hlY2sgaWYgYSBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kLlxuICAgICAgICBpZiAoZGlyVGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gTm8gbWF0Y2hpbmcgZGlyZWN0aXZlIHdhcyBmb3VuZCAtIHRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhbiB1bmtub3duIHRhcmdldC4gTGVhdmUgaXRcbiAgICAgICAgICAvLyB1bm1hcHBlZC5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGRpclRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBUaGlzIHJlZmVyZW5jZSBwb2ludHMgdG8gYSBkaXJlY3RpdmUuXG4gICAgICAgIHRoaXMucmVmZXJlbmNlcy5zZXQocmVmLCB7ZGlyZWN0aXZlOiBkaXJUYXJnZXQsIG5vZGV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byB0aGUgbm9kZSBpdHNlbGYuXG4gICAgICAgIHRoaXMucmVmZXJlbmNlcy5zZXQocmVmLCBub2RlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFzc29jaWF0ZSBhdHRyaWJ1dGVzL2JpbmRpbmdzIG9uIHRoZSBub2RlIHdpdGggZGlyZWN0aXZlcyBvciB3aXRoIHRoZSBub2RlIGl0c2VsZi5cbiAgICB0eXBlIEJvdW5kTm9kZSA9IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZTtcbiAgICBjb25zdCBzZXRBdHRyaWJ1dGVCaW5kaW5nID1cbiAgICAgICAgKGF0dHJpYnV0ZTogQm91bmROb2RlLCBpb1R5cGU6IGtleW9mIFBpY2s8RGlyZWN0aXZlTWV0YSwgJ2lucHV0cyd8J291dHB1dHMnPikgPT4ge1xuICAgICAgICAgIGNvbnN0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyW2lvVHlwZV0uaGFzQmluZGluZ1Byb3BlcnR5TmFtZShhdHRyaWJ1dGUubmFtZSkpO1xuICAgICAgICAgIGNvbnN0IGJpbmRpbmcgPSBkaXIgIT09IHVuZGVmaW5lZCA/IGRpciA6IG5vZGU7XG4gICAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXR0cmlidXRlLCBiaW5kaW5nKTtcbiAgICAgICAgfTtcblxuICAgIC8vIE5vZGUgaW5wdXRzIChib3VuZCBhdHRyaWJ1dGVzKSBhbmQgdGV4dCBhdHRyaWJ1dGVzIGNhbiBiZSBib3VuZCB0byBhblxuICAgIC8vIGlucHV0IG9uIGEgZGlyZWN0aXZlLlxuICAgIG5vZGUuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4gc2V0QXR0cmlidXRlQmluZGluZyhpbnB1dCwgJ2lucHV0cycpKTtcbiAgICBub2RlLmF0dHJpYnV0ZXMuZm9yRWFjaChhdHRyID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcoYXR0ciwgJ2lucHV0cycpKTtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICBub2RlLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChhdHRyID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcoYXR0ciwgJ2lucHV0cycpKTtcbiAgICB9XG4gICAgLy8gTm9kZSBvdXRwdXRzIChib3VuZCBldmVudHMpIGNhbiBiZSBib3VuZCB0byBhbiBvdXRwdXQgb24gYSBkaXJlY3RpdmUuXG4gICAgbm9kZS5vdXRwdXRzLmZvckVhY2gob3V0cHV0ID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcob3V0cHV0LCAnb3V0cHV0cycpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgbm9kZSdzIGNoaWxkcmVuLlxuICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiB2b2lkIHtcbiAgICBjb25zdCB3YXNJbkRlZmVyQmxvY2sgPSB0aGlzLmlzSW5EZWZlckJsb2NrO1xuICAgIHRoaXMuaXNJbkRlZmVyQmxvY2sgPSB0cnVlO1xuICAgIGRlZmVycmVkLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICAgIHRoaXMuaXNJbkRlZmVyQmxvY2sgPSB3YXNJbkRlZmVyQmxvY2s7XG5cbiAgICBkZWZlcnJlZC5wbGFjZWhvbGRlcj8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQubG9hZGluZz8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQuZXJyb3I/LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcik6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiB2b2lkIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suY2FzZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spIHtcbiAgICBibG9jay5pdGVtLnZpc2l0KHRoaXMpO1xuICAgIGJsb2NrLmNvbnRleHRWYXJpYWJsZXMuZm9yRWFjaCh2ID0+IHYudmlzaXQodGhpcykpO1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jaykge1xuICAgIGJsb2NrLmJyYW5jaGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCkge1xuICAgIGJsb2NrLmV4cHJlc3Npb25BbGlhcz8udmlzaXQodGhpcyk7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IHZvaWQge31cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiB2b2lkIHt9XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogdm9pZCB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGVPckV2ZW50KG5vZGU6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHt9XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spIHt9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICpcbiAqIFRoaXMgaXMgYSBjb21wYW5pb24gdG8gdGhlIGBEaXJlY3RpdmVCaW5kZXJgIHRoYXQgZG9lc24ndCByZXF1aXJlIGtub3dsZWRnZSBvZiBkaXJlY3RpdmVzIG1hdGNoZWRcbiAqIHdpdGhpbiB0aGUgdGVtcGxhdGUgaW4gb3JkZXIgdG8gb3BlcmF0ZS5cbiAqXG4gKiBFeHByZXNzaW9ucyBhcmUgdmlzaXRlZCBieSB0aGUgc3VwZXJjbGFzcyBgUmVjdXJzaXZlQXN0VmlzaXRvcmAsIHdpdGggY3VzdG9tIGxvZ2ljIHByb3ZpZGVkXG4gKiBieSBvdmVycmlkZGVuIG1ldGhvZHMgZnJvbSB0aGF0IHZpc2l0b3IuXG4gKi9cbmNsYXNzIFRlbXBsYXRlQmluZGVyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICBwcml2YXRlIHZpc2l0Tm9kZTogKG5vZGU6IE5vZGUpID0+IHZvaWQ7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgICBwcml2YXRlIHN5bWJvbHM6IE1hcDxSZWZlcmVuY2V8VmFyaWFibGUsIFNjb3BlZE5vZGU+LCBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIGVhZ2VyUGlwZXM6IFNldDxzdHJpbmc+LCBwcml2YXRlIGRlZmVyQmxvY2tzOiBbRGVmZXJyZWRCbG9jaywgU2NvcGVdW10sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sIHByaXZhdGUgc2NvcGU6IFNjb3BlLFxuICAgICAgcHJpdmF0ZSByb290Tm9kZTogU2NvcGVkTm9kZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyBkZWZpbmVkIHRvIHJlY29uY2lsZSB0aGUgdHlwZSBvZiBUZW1wbGF0ZUJpbmRlciBzaW5jZSBib3RoXG4gIC8vIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgYW5kIFZpc2l0b3IgZGVmaW5lIHRoZSB2aXNpdCgpIG1ldGhvZCBpbiB0aGVpclxuICAvLyBpbnRlcmZhY2VzLlxuICBvdmVycmlkZSB2aXNpdChub2RlOiBBU1R8Tm9kZSwgY29udGV4dD86IGFueSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgQVNUKSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZXMgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZSB0byBwcm9jZXNzXG4gICAqIEBwYXJhbSBzY29wZSB0aGUgYFNjb3BlYCBvZiB0aGUgdGVtcGxhdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gbWV0YWRhdGEgYWJvdXQgdGhlIHRlbXBsYXRlOiBgZXhwcmVzc2lvbnNgIHdoaWNoIGludGVycHJldHNcbiAgICogc3BlY2lhbCBgQVNUYCBub2RlcyBpbiBleHByZXNzaW9ucyBhcyBwb2ludGluZyB0byByZWZlcmVuY2VzIG9yIHZhcmlhYmxlcyBkZWNsYXJlZCB3aXRoaW4gdGhlXG4gICAqIHRlbXBsYXRlLCBgc3ltYm9sc2Agd2hpY2ggbWFwcyB0aG9zZSB2YXJpYWJsZXMgYW5kIHJlZmVyZW5jZXMgdG8gdGhlIG5lc3RlZCBgVGVtcGxhdGVgIHdoaWNoXG4gICAqIGRlY2xhcmVzIHRoZW0sIGlmIGFueSwgYW5kIGBuZXN0aW5nTGV2ZWxgIHdoaWNoIGFzc29jaWF0ZXMgZWFjaCBgVGVtcGxhdGVgIHdpdGggYSBpbnRlZ2VyXG4gICAqIG5lc3RpbmcgbGV2ZWwgKGhvdyBtYW55IGxldmVscyBkZWVwIHdpdGhpbiB0aGUgdGVtcGxhdGUgc3RydWN0dXJlIHRoZSBgVGVtcGxhdGVgIGlzKSwgc3RhcnRpbmdcbiAgICogYXQgMS5cbiAgICovXG4gIHN0YXRpYyBhcHBseVdpdGhTY29wZShub2RlczogTm9kZVtdLCBzY29wZTogU2NvcGUpOiB7XG4gICAgZXhwcmVzc2lvbnM6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgc3ltYm9sczogTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+LFxuICAgIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgdXNlZFBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICBlYWdlclBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICBkZWZlckJsb2NrczogW0RlZmVycmVkQmxvY2ssIFNjb3BlXVtdLFxuICB9IHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IG5ldyBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IG5ldyBNYXA8VmFyaWFibGV8UmVmZXJlbmNlLCBUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCBuZXN0aW5nTGV2ZWwgPSBuZXcgTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4oKTtcbiAgICBjb25zdCB1c2VkUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBlYWdlclBpcGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgdGVtcGxhdGUgPSBub2RlcyBpbnN0YW5jZW9mIFRlbXBsYXRlID8gbm9kZXMgOiBudWxsO1xuICAgIGNvbnN0IGRlZmVyQmxvY2tzOiBbRGVmZXJyZWRCbG9jaywgU2NvcGVdW10gPSBbXTtcbiAgICAvLyBUaGUgdG9wLWxldmVsIHRlbXBsYXRlIGhhcyBuZXN0aW5nIGxldmVsIDAuXG4gICAgY29uc3QgYmluZGVyID0gbmV3IFRlbXBsYXRlQmluZGVyKFxuICAgICAgICBleHByZXNzaW9ucywgc3ltYm9scywgdXNlZFBpcGVzLCBlYWdlclBpcGVzLCBkZWZlckJsb2NrcywgbmVzdGluZ0xldmVsLCBzY29wZSwgdGVtcGxhdGUsIDApO1xuICAgIGJpbmRlci5pbmdlc3Qobm9kZXMpO1xuICAgIHJldHVybiB7ZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCwgdXNlZFBpcGVzLCBlYWdlclBpcGVzLCBkZWZlckJsb2Nrc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdChub2RlT3JOb2RlczogU2NvcGVkTm9kZXxOb2RlW10pOiB2b2lkIHtcbiAgICBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgLy8gRm9yIDxuZy10ZW1wbGF0ZT5zLCBwcm9jZXNzIG9ubHkgdmFyaWFibGVzIGFuZCBjaGlsZCBub2Rlcy4gSW5wdXRzLCBvdXRwdXRzLCB0ZW1wbGF0ZUF0dHJzLFxuICAgICAgLy8gYW5kIHJlZmVyZW5jZXMgd2VyZSBhbGwgcHJvY2Vzc2VkIGluIHRoZSBzY29wZSBvZiB0aGUgY29udGFpbmluZyB0ZW1wbGF0ZS5cbiAgICAgIG5vZGVPck5vZGVzLnZhcmlhYmxlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgICAvLyBTZXQgdGhlIG5lc3RpbmcgbGV2ZWwuXG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQobm9kZU9yTm9kZXMsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgICBpZiAobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudmlzaXROb2RlKG5vZGVPck5vZGVzLmV4cHJlc3Npb25BbGlhcyk7XG4gICAgICB9XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9jaykge1xuICAgICAgdGhpcy52aXNpdE5vZGUobm9kZU9yTm9kZXMuaXRlbSk7XG4gICAgICBub2RlT3JOb2Rlcy5jb250ZXh0VmFyaWFibGVzLmZvckVhY2godiA9PiB0aGlzLnZpc2l0Tm9kZSh2KSk7XG4gICAgICBub2RlT3JOb2Rlcy50cmFja0J5LnZpc2l0KHRoaXMpO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQobm9kZU9yTm9kZXMsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrKSB7XG4gICAgICBpZiAodGhpcy5zY29wZS5yb290Tm9kZSAhPT0gbm9kZU9yTm9kZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYEFzc2VydGlvbiBlcnJvcjogcmVzb2x2ZWQgaW5jb3JyZWN0IHNjb3BlIGZvciBkZWZlcnJlZCBibG9jayAke25vZGVPck5vZGVzfWApO1xuICAgICAgfVxuICAgICAgdGhpcy5kZWZlckJsb2Nrcy5wdXNoKFtub2RlT3JOb2RlcywgdGhpcy5zY29wZV0pO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFN3aXRjaEJsb2NrQ2FzZSB8fCBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9ja0VtcHR5IHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0Vycm9yIHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFZpc2l0IGVhY2ggbm9kZSBmcm9tIHRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUuXG4gICAgICBub2RlT3JOb2Rlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIFZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50LnJlZmVyZW5jZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSkge1xuICAgIC8vIEZpcnN0LCB2aXNpdCBpbnB1dHMsIG91dHB1dHMgYW5kIHRlbXBsYXRlIGF0dHJpYnV0ZXMgb2YgdGhlIHRlbXBsYXRlIG5vZGUuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGVtcGxhdGUudGVtcGxhdGVBdHRycy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZS5cbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFZhcmlhYmxlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnJvb3ROb2RlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHZhcmlhYmxlLCB0aGlzLnJvb3ROb2RlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgUmVmZXJlbmNlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnJvb3ROb2RlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHJlZmVyZW5jZSwgdGhpcy5yb290Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW51c2VkIHRlbXBsYXRlIHZpc2l0b3JzXG5cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdFVua25vd25CbG9jayhibG9jazogVW5rbm93bkJsb2NrKSB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcigpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7XG4gICAgT2JqZWN0LmtleXMoaWN1LnZhcnMpLmZvckVhY2goa2V5ID0+IGljdS52YXJzW2tleV0udmlzaXQodGhpcykpO1xuICAgIE9iamVjdC5rZXlzKGljdS5wbGFjZWhvbGRlcnMpLmZvckVhY2goa2V5ID0+IGljdS5wbGFjZWhvbGRlcnNba2V5XS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICAvLyBUaGUgcmVtYWluaW5nIHZpc2l0b3JzIGFyZSBjb25jZXJuZWQgd2l0aCBwcm9jZXNzaW5nIEFTVCBleHByZXNzaW9ucyB3aXRoaW4gdGVtcGxhdGUgYmluZGluZ3NcblxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpIHtcbiAgICBhdHRyaWJ1dGUudmFsdWUudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEJvdW5kRXZlbnQoZXZlbnQ6IEJvdW5kRXZlbnQpIHtcbiAgICBldmVudC5oYW5kbGVyLnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrKGRlZmVycmVkOiBEZWZlcnJlZEJsb2NrKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGRlZmVycmVkKTtcbiAgICBkZWZlcnJlZC50cmlnZ2Vycy53aGVuPy52YWx1ZS52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5wcmVmZXRjaFRyaWdnZXJzLndoZW4/LnZhbHVlLnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLnBsYWNlaG9sZGVyKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmxvYWRpbmcpO1xuICAgIGRlZmVycmVkLmVycm9yICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmVycm9yKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jaykge1xuICAgIGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgYmxvY2suY2FzZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbj8udmlzaXQodGhpcyk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spIHtcbiAgICBibG9jay5leHByZXNzaW9uLnZpc2l0KHRoaXMpO1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gICAgYmxvY2suZW1wdHk/LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2tFbXB0eShibG9jazogRm9yTG9vcEJsb2NrRW1wdHkpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKSB7XG4gICAgYmxvY2suYnJhbmNoZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbj8udmlzaXQodGhpcyk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCkge1xuICAgIHRleHQudmFsdWUudmlzaXQodGhpcyk7XG4gIH1cbiAgb3ZlcnJpZGUgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy51c2VkUGlwZXMuYWRkKGFzdC5uYW1lKTtcbiAgICBpZiAoIXRoaXMuc2NvcGUuaXNEZWZlcnJlZCkge1xuICAgICAgdGhpcy5lYWdlclBpcGVzLmFkZChhc3QubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBzdXBlci52aXNpdFBpcGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIC8vIFRoZXNlIGZpdmUgdHlwZXMgb2YgQVNUIGV4cHJlc3Npb25zIGNhbiByZWZlciB0byBleHByZXNzaW9uIHJvb3RzLCB3aGljaCBjb3VsZCBiZSB2YXJpYWJsZXNcbiAgLy8gb3IgcmVmZXJlbmNlcyBpbiB0aGUgY3VycmVudCBzY29wZS5cblxuICBvdmVycmlkZSB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0UHJvcGVydHlXcml0ZShhc3Q6IFByb3BlcnR5V3JpdGUsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgdGhpcy5tYXliZU1hcChhc3QsIGFzdC5uYW1lKTtcbiAgICByZXR1cm4gc3VwZXIudmlzaXRQcm9wZXJ0eVdyaXRlKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdFNjb3BlZE5vZGUobm9kZTogU2NvcGVkTm9kZSkge1xuICAgIGNvbnN0IGNoaWxkU2NvcGUgPSB0aGlzLnNjb3BlLmdldENoaWxkU2NvcGUobm9kZSk7XG4gICAgY29uc3QgYmluZGVyID0gbmV3IFRlbXBsYXRlQmluZGVyKFxuICAgICAgICB0aGlzLmJpbmRpbmdzLCB0aGlzLnN5bWJvbHMsIHRoaXMudXNlZFBpcGVzLCB0aGlzLmVhZ2VyUGlwZXMsIHRoaXMuZGVmZXJCbG9ja3MsXG4gICAgICAgIHRoaXMubmVzdGluZ0xldmVsLCBjaGlsZFNjb3BlLCBub2RlLCB0aGlzLmxldmVsICsgMSk7XG4gICAgYmluZGVyLmluZ2VzdChub2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoYXN0OiBQcm9wZXJ0eVJlYWR8U2FmZVByb3BlcnR5UmVhZHxQcm9wZXJ0eVdyaXRlLCBuYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBJZiB0aGUgcmVjZWl2ZXIgb2YgdGhlIGV4cHJlc3Npb24gaXNuJ3QgdGhlIGBJbXBsaWNpdFJlY2VpdmVyYCwgdGhpcyBpc24ndCB0aGUgcm9vdCBvZiBhblxuICAgIC8vIGBBU1RgIGV4cHJlc3Npb24gdGhhdCBtYXBzIHRvIGEgYFZhcmlhYmxlYCBvciBgUmVmZXJlbmNlYC5cbiAgICBpZiAoIShhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlIG5hbWUgZXhpc3RzIGluIHRoZSBjdXJyZW50IHNjb3BlLiBJZiBzbywgbWFwIGl0LiBPdGhlcndpc2UsIHRoZSBuYW1lIGlzXG4gICAgLy8gcHJvYmFibHkgYSBwcm9wZXJ0eSBvbiB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCBjb250ZXh0LlxuICAgIGxldCB0YXJnZXQgPSB0aGlzLnNjb3BlLmxvb2t1cChuYW1lKTtcbiAgICBpZiAodGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmJpbmRpbmdzLnNldChhc3QsIHRhcmdldCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWV0YWRhdGEgY29udGFpbmVyIGZvciBhIGBUYXJnZXRgIHRoYXQgYWxsb3dzIHF1ZXJpZXMgZm9yIHNwZWNpZmljIGJpdHMgb2YgbWV0YWRhdGEuXG4gKlxuICogU2VlIGBCb3VuZFRhcmdldGAgZm9yIGRvY3VtZW50YXRpb24gb24gdGhlIGluZGl2aWR1YWwgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFIzQm91bmRUYXJnZXQ8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgQm91bmRUYXJnZXQ8RGlyZWN0aXZlVD4ge1xuICAvKiogRGVmZXJyZWQgYmxvY2tzLCBvcmRlcmVkIGFzIHRoZXkgYXBwZWFyIGluIHRoZSB0ZW1wbGF0ZS4gKi9cbiAgcHJpdmF0ZSBkZWZlcnJlZEJsb2NrczogRGVmZXJyZWRCbG9ja1tdO1xuXG4gIC8qKiBNYXAgb2YgZGVmZXJyZWQgYmxvY2tzIHRvIHRoZWlyIHNjb3BlLiAqL1xuICBwcml2YXRlIGRlZmVycmVkU2NvcGVzOiBNYXA8RGVmZXJyZWRCbG9jaywgU2NvcGU+O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdGFyZ2V0OiBUYXJnZXQsIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxSZWZlcmVuY2V8VGV4dEF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIGV4cHJUYXJnZXRzOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgICAgcHJpdmF0ZSBzeW1ib2xzOiBNYXA8UmVmZXJlbmNlfFZhcmlhYmxlLCBUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgICBwcml2YXRlIHNjb3BlZE5vZGVFbnRpdGllczogTWFwPFNjb3BlZE5vZGV8bnVsbCwgUmVhZG9ubHlTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4sXG4gICAgICBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sIHByaXZhdGUgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICByYXdEZWZlcnJlZDogW0RlZmVycmVkQmxvY2ssIFNjb3BlXVtdKSB7XG4gICAgdGhpcy5kZWZlcnJlZEJsb2NrcyA9IHJhd0RlZmVycmVkLm1hcChjdXJyZW50ID0+IGN1cnJlbnRbMF0pO1xuICAgIHRoaXMuZGVmZXJyZWRTY29wZXMgPSBuZXcgTWFwKHJhd0RlZmVycmVkKTtcbiAgfVxuXG4gIGdldEVudGl0aWVzSW5TY29wZShub2RlOiBTY29wZWROb2RlfG51bGwpOiBSZWFkb25seVNldDxSZWZlcmVuY2V8VmFyaWFibGU+IHtcbiAgICByZXR1cm4gdGhpcy5zY29wZWROb2RlRW50aXRpZXMuZ2V0KG5vZGUpID8/IG5ldyBTZXQoKTtcbiAgfVxuXG4gIGdldERpcmVjdGl2ZXNPZk5vZGUobm9kZTogRWxlbWVudHxUZW1wbGF0ZSk6IERpcmVjdGl2ZVRbXXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5kaXJlY3RpdmVzLmdldChub2RlKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZjogUmVmZXJlbmNlKTogUmVmZXJlbmNlVGFyZ2V0PERpcmVjdGl2ZVQ+fG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZXMuZ2V0KHJlZikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldENvbnN1bWVyT2ZCaW5kaW5nKGJpbmRpbmc6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSk6IERpcmVjdGl2ZVR8RWxlbWVudFxuICAgICAgfFRlbXBsYXRlfG51bGwge1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmdzLmdldChiaW5kaW5nKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvblRhcmdldChleHByOiBBU1QpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZXhwclRhcmdldHMuZ2V0KGV4cHIpIHx8IG51bGw7XG4gIH1cblxuICBnZXREZWZpbml0aW9uTm9kZU9mU3ltYm9sKHN5bWJvbDogUmVmZXJlbmNlfFZhcmlhYmxlKTogU2NvcGVkTm9kZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xzLmdldChzeW1ib2wpIHx8IG51bGw7XG4gIH1cblxuICBnZXROZXN0aW5nTGV2ZWwobm9kZTogU2NvcGVkTm9kZSk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubmVzdGluZ0xldmVsLmdldChub2RlKSB8fCAwO1xuICB9XG5cbiAgZ2V0VXNlZERpcmVjdGl2ZXMoKTogRGlyZWN0aXZlVFtdIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PERpcmVjdGl2ZVQ+KCk7XG4gICAgdGhpcy5kaXJlY3RpdmVzLmZvckVhY2goZGlycyA9PiBkaXJzLmZvckVhY2goZGlyID0+IHNldC5hZGQoZGlyKSkpO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNldC52YWx1ZXMoKSk7XG4gIH1cblxuICBnZXRFYWdlcmx5VXNlZERpcmVjdGl2ZXMoKTogRGlyZWN0aXZlVFtdIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PERpcmVjdGl2ZVQ+KHRoaXMuZWFnZXJEaXJlY3RpdmVzKTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShzZXQudmFsdWVzKCkpO1xuICB9XG5cbiAgZ2V0VXNlZFBpcGVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLnVzZWRQaXBlcyk7XG4gIH1cblxuICBnZXRFYWdlcmx5VXNlZFBpcGVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmVhZ2VyUGlwZXMpO1xuICB9XG5cbiAgZ2V0RGVmZXJCbG9ja3MoKTogRGVmZXJyZWRCbG9ja1tdIHtcbiAgICByZXR1cm4gdGhpcy5kZWZlcnJlZEJsb2NrcztcbiAgfVxuXG4gIGdldERlZmVycmVkVHJpZ2dlclRhcmdldChibG9jazogRGVmZXJyZWRCbG9jaywgdHJpZ2dlcjogRGVmZXJyZWRUcmlnZ2VyKTogRWxlbWVudHxudWxsIHtcbiAgICAvLyBPbmx5IHRyaWdnZXJzIHRoYXQgcmVmZXIgdG8gRE9NIG5vZGVzIGNhbiBiZSByZXNvbHZlZC5cbiAgICBpZiAoISh0cmlnZ2VyIGluc3RhbmNlb2YgSW50ZXJhY3Rpb25EZWZlcnJlZFRyaWdnZXIpICYmXG4gICAgICAgICEodHJpZ2dlciBpbnN0YW5jZW9mIFZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyKSAmJlxuICAgICAgICAhKHRyaWdnZXIgaW5zdGFuY2VvZiBIb3ZlckRlZmVycmVkVHJpZ2dlcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG5hbWUgPSB0cmlnZ2VyLnJlZmVyZW5jZTtcblxuICAgIGlmIChuYW1lID09PSBudWxsKSB7XG4gICAgICBsZXQgdHJpZ2dlcjogRWxlbWVudHxudWxsID0gbnVsbDtcblxuICAgICAgaWYgKGJsb2NrLnBsYWNlaG9sZGVyICE9PSBudWxsKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgYmxvY2sucGxhY2Vob2xkZXIuY2hpbGRyZW4pIHtcbiAgICAgICAgICAvLyBTa2lwIG92ZXIgY29tbWVudCBub2Rlcy4gQ3VycmVudGx5IGJ5IGRlZmF1bHQgdGhlIHRlbXBsYXRlIHBhcnNlciBkb2Vzbid0IGNhcHR1cmVcbiAgICAgICAgICAvLyBjb21tZW50cywgYnV0IHdlIGhhdmUgYSBzYWZlZ3VhcmQgaGVyZSBqdXN0IGluIGNhc2Ugc2luY2UgaXQgY2FuIGJlIGVuYWJsZWQuXG4gICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgQ29tbWVudCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gV2UgY2FuIG9ubHkgaW5mZXIgdGhlIHRyaWdnZXIgaWYgdGhlcmUncyBvbmUgcm9vdCBlbGVtZW50IG5vZGUuIEFueSBvdGhlclxuICAgICAgICAgIC8vIG5vZGVzIGF0IHRoZSByb290IG1ha2UgaXQgc28gdGhhdCB3ZSBjYW4ndCBpbmZlciB0aGUgdHJpZ2dlciBhbnltb3JlLlxuICAgICAgICAgIGlmICh0cmlnZ2VyICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICAgICAgICB0cmlnZ2VyID0gY2hpbGQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cmlnZ2VyO1xuICAgIH1cblxuICAgIGNvbnN0IG91dHNpZGVSZWYgPSB0aGlzLmZpbmRFbnRpdHlJblNjb3BlKGJsb2NrLCBuYW1lKTtcblxuICAgIC8vIEZpcnN0IHRyeSB0byByZXNvbHZlIHRoZSB0YXJnZXQgaW4gdGhlIHNjb3BlIG9mIHRoZSBtYWluIGRlZmVycmVkIGJsb2NrLiBOb3RlIHRoYXQgd2VcbiAgICAvLyBza2lwIHRyaWdnZXJzIGRlZmluZWQgaW5zaWRlIHRoZSBtYWluIGJsb2NrIGl0c2VsZiwgYmVjYXVzZSB0aGV5IG1pZ2h0IG5vdCBleGlzdCB5ZXQuXG4gICAgaWYgKG91dHNpZGVSZWYgaW5zdGFuY2VvZiBSZWZlcmVuY2UgJiYgdGhpcy5nZXREZWZpbml0aW9uTm9kZU9mU3ltYm9sKG91dHNpZGVSZWYpICE9PSBibG9jaykge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5nZXRSZWZlcmVuY2VUYXJnZXQob3V0c2lkZVJlZik7XG5cbiAgICAgIGlmICh0YXJnZXQgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHRyaWdnZXIgY291bGRuJ3QgYmUgZm91bmQgaW4gdGhlIG1haW4gYmxvY2ssIGNoZWNrIHRoZVxuICAgIC8vIHBsYWNlaG9sZGVyIGJsb2NrIHdoaWNoIGlzIHNob3duIGJlZm9yZSB0aGUgbWFpbiBibG9jayBoYXMgbG9hZGVkLlxuICAgIGlmIChibG9jay5wbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcmVmSW5QbGFjZWhvbGRlciA9IHRoaXMuZmluZEVudGl0eUluU2NvcGUoYmxvY2sucGxhY2Vob2xkZXIsIG5hbWUpO1xuICAgICAgY29uc3QgdGFyZ2V0SW5QbGFjZWhvbGRlciA9XG4gICAgICAgICAgcmVmSW5QbGFjZWhvbGRlciBpbnN0YW5jZW9mIFJlZmVyZW5jZSA/IHRoaXMuZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZkluUGxhY2Vob2xkZXIpIDogbnVsbDtcblxuICAgICAgaWYgKHRhcmdldEluUGxhY2Vob2xkZXIgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldEluUGxhY2Vob2xkZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaXNEZWZlcnJlZChlbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgZm9yIChjb25zdCBibG9jayBvZiB0aGlzLmRlZmVycmVkQmxvY2tzKSB7XG4gICAgICBpZiAoIXRoaXMuZGVmZXJyZWRTY29wZXMuaGFzKGJsb2NrKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc3RhY2s6IFNjb3BlW10gPSBbdGhpcy5kZWZlcnJlZFNjb3Blcy5nZXQoYmxvY2spIV07XG5cbiAgICAgIHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSBzdGFjay5wb3AoKSE7XG5cbiAgICAgICAgaWYgKGN1cnJlbnQuZWxlbWVudHNJblNjb3BlLmhhcyhlbGVtZW50KSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhY2sucHVzaCguLi5jdXJyZW50LmNoaWxkU2NvcGVzLnZhbHVlcygpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogRmluZHMgYW4gZW50aXR5IHdpdGggYSBzcGVjaWZpYyBuYW1lIGluIGEgc2NvcGUuXG4gICAqIEBwYXJhbSByb290Tm9kZSBSb290IG5vZGUgb2YgdGhlIHNjb3BlLlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBlbnRpdHkuXG4gICAqL1xuICBwcml2YXRlIGZpbmRFbnRpdHlJblNjb3BlKHJvb3ROb2RlOiBTY29wZWROb2RlLCBuYW1lOiBzdHJpbmcpOiBSZWZlcmVuY2V8VmFyaWFibGV8bnVsbCB7XG4gICAgY29uc3QgZW50aXRpZXMgPSB0aGlzLmdldEVudGl0aWVzSW5TY29wZShyb290Tm9kZSk7XG5cbiAgICBmb3IgKGNvbnN0IGVudGl0aXR5IG9mIGVudGl0aWVzKSB7XG4gICAgICBpZiAoZW50aXRpdHkubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICByZXR1cm4gZW50aXRpdHk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKiogQ29lcmNlcyBhIGBSZWZlcmVuY2VUYXJnZXRgIHRvIGFuIGBFbGVtZW50YCwgaWYgcG9zc2libGUuICovXG4gIHByaXZhdGUgcmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldDogUmVmZXJlbmNlVGFyZ2V0PERpcmVjdGl2ZVQ+KTogRWxlbWVudHxudWxsIHtcbiAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZVRhcmdldFRvRWxlbWVudCh0YXJnZXQubm9kZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0cmFjdFNjb3BlZE5vZGVFbnRpdGllcyhyb290U2NvcGU6IFNjb3BlKTpcbiAgICBNYXA8U2NvcGVkTm9kZXxudWxsLCBTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4ge1xuICBjb25zdCBlbnRpdHlNYXAgPSBuZXcgTWFwPFNjb3BlZE5vZGV8bnVsbCwgTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPj4oKTtcblxuICBmdW5jdGlvbiBleHRyYWN0U2NvcGVFbnRpdGllcyhzY29wZTogU2NvcGUpOiBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+IHtcbiAgICBpZiAoZW50aXR5TWFwLmhhcyhzY29wZS5yb290Tm9kZSkpIHtcbiAgICAgIHJldHVybiBlbnRpdHlNYXAuZ2V0KHNjb3BlLnJvb3ROb2RlKSE7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudEVudGl0aWVzID0gc2NvcGUubmFtZWRFbnRpdGllcztcblxuICAgIGxldCBlbnRpdGllczogTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPjtcbiAgICBpZiAoc2NvcGUucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIGVudGl0aWVzID0gbmV3IE1hcChbLi4uZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGUucGFyZW50U2NvcGUpLCAuLi5jdXJyZW50RW50aXRpZXNdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50aXRpZXMgPSBuZXcgTWFwKGN1cnJlbnRFbnRpdGllcyk7XG4gICAgfVxuXG4gICAgZW50aXR5TWFwLnNldChzY29wZS5yb290Tm9kZSwgZW50aXRpZXMpO1xuICAgIHJldHVybiBlbnRpdGllcztcbiAgfVxuXG4gIGNvbnN0IHNjb3Blc1RvUHJvY2VzczogU2NvcGVbXSA9IFtyb290U2NvcGVdO1xuICB3aGlsZSAoc2NvcGVzVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzY29wZSA9IHNjb3Blc1RvUHJvY2Vzcy5wb3AoKSE7XG4gICAgZm9yIChjb25zdCBjaGlsZFNjb3BlIG9mIHNjb3BlLmNoaWxkU2NvcGVzLnZhbHVlcygpKSB7XG4gICAgICBzY29wZXNUb1Byb2Nlc3MucHVzaChjaGlsZFNjb3BlKTtcbiAgICB9XG4gICAgZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGUpO1xuICB9XG5cbiAgY29uc3QgdGVtcGxhdGVFbnRpdGllcyA9IG5ldyBNYXA8U2NvcGVkTm9kZXxudWxsLCBTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4oKTtcbiAgZm9yIChjb25zdCBbdGVtcGxhdGUsIGVudGl0aWVzXSBvZiBlbnRpdHlNYXApIHtcbiAgICB0ZW1wbGF0ZUVudGl0aWVzLnNldCh0ZW1wbGF0ZSwgbmV3IFNldChlbnRpdGllcy52YWx1ZXMoKSkpO1xuICB9XG4gIHJldHVybiB0ZW1wbGF0ZUVudGl0aWVzO1xufVxuIl19