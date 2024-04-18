/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ImplicitReceiver, RecursiveAstVisitor, } from '../../expression_parser/ast';
import { Comment, Content, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, Element, ForLoopBlock, ForLoopBlockEmpty, HoverDeferredTrigger, IfBlockBranch, InteractionDeferredTrigger, Reference, SwitchBlockCase, Template, ViewportDeferredTrigger, } from '../r3_ast';
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
            nodeOrNodes.variables.forEach((node) => this.visitVariable(node));
            // Process the nodes of the template.
            nodeOrNodes.children.forEach((node) => node.visit(this));
        }
        else if (nodeOrNodes instanceof IfBlockBranch) {
            if (nodeOrNodes.expressionAlias !== null) {
                this.visitVariable(nodeOrNodes.expressionAlias);
            }
            nodeOrNodes.children.forEach((node) => node.visit(this));
        }
        else if (nodeOrNodes instanceof ForLoopBlock) {
            this.visitVariable(nodeOrNodes.item);
            nodeOrNodes.contextVariables.forEach((v) => this.visitVariable(v));
            nodeOrNodes.children.forEach((node) => node.visit(this));
        }
        else if (nodeOrNodes instanceof SwitchBlockCase ||
            nodeOrNodes instanceof ForLoopBlockEmpty ||
            nodeOrNodes instanceof DeferredBlock ||
            nodeOrNodes instanceof DeferredBlockError ||
            nodeOrNodes instanceof DeferredBlockPlaceholder ||
            nodeOrNodes instanceof DeferredBlockLoading ||
            nodeOrNodes instanceof Content) {
            nodeOrNodes.children.forEach((node) => node.visit(this));
        }
        else {
            // No overarching `Template` instance, so process the nodes directly.
            nodeOrNodes.forEach((node) => node.visit(this));
        }
    }
    visitElement(element) {
        // `Element`s in the template may have `Reference`s which are captured in the scope.
        element.references.forEach((node) => this.visitReference(node));
        // Recurse into the `Element`'s children.
        element.children.forEach((node) => node.visit(this));
        this.elementsInScope.add(element);
    }
    visitTemplate(template) {
        // References on a <ng-template> are defined in the outer scope, so capture them before
        // processing the template's child scope.
        template.references.forEach((node) => this.visitReference(node));
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
        block.cases.forEach((node) => node.visit(this));
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
        block.branches.forEach((node) => node.visit(this));
    }
    visitIfBlockBranch(block) {
        this.ingestScopedNode(block);
    }
    visitContent(content) {
        this.ingestScopedNode(content);
    }
    // Unused visitors.
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
        template.forEach((node) => node.visit(this));
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
        node.references.forEach((ref) => {
            let dirTarget = null;
            // If the reference expression is empty, then it matches the "primary" directive on the node
            // (if there is one). Otherwise it matches the host node itself (either an element or
            // <ng-template> node).
            if (ref.value.trim() === '') {
                // This could be a reference to a component if there is one.
                dirTarget = directives.find((dir) => dir.isComponent) || null;
            }
            else {
                // This should be a reference to a directive exported via exportAs.
                dirTarget =
                    directives.find((dir) => dir.exportAs !== null && dir.exportAs.some((value) => value === ref.value)) || null;
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
            const dir = directives.find((dir) => dir[ioType].hasBindingPropertyName(attribute.name));
            const binding = dir !== undefined ? dir : node;
            this.bindings.set(attribute, binding);
        };
        // Node inputs (bound attributes) and text attributes can be bound to an
        // input on a directive.
        node.inputs.forEach((input) => setAttributeBinding(input, 'inputs'));
        node.attributes.forEach((attr) => setAttributeBinding(attr, 'inputs'));
        if (node instanceof Template) {
            node.templateAttrs.forEach((attr) => setAttributeBinding(attr, 'inputs'));
        }
        // Node outputs (bound events) can be bound to an output on a directive.
        node.outputs.forEach((output) => setAttributeBinding(output, 'outputs'));
        // Recurse into the node's children.
        node.children.forEach((child) => child.visit(this));
    }
    visitDeferredBlock(deferred) {
        const wasInDeferBlock = this.isInDeferBlock;
        this.isInDeferBlock = true;
        deferred.children.forEach((child) => child.visit(this));
        this.isInDeferBlock = wasInDeferBlock;
        deferred.placeholder?.visit(this);
        deferred.loading?.visit(this);
        deferred.error?.visit(this);
    }
    visitDeferredBlockPlaceholder(block) {
        block.children.forEach((child) => child.visit(this));
    }
    visitDeferredBlockError(block) {
        block.children.forEach((child) => child.visit(this));
    }
    visitDeferredBlockLoading(block) {
        block.children.forEach((child) => child.visit(this));
    }
    visitSwitchBlock(block) {
        block.cases.forEach((node) => node.visit(this));
    }
    visitSwitchBlockCase(block) {
        block.children.forEach((node) => node.visit(this));
    }
    visitForLoopBlock(block) {
        block.item.visit(this);
        block.contextVariables.forEach((v) => v.visit(this));
        block.children.forEach((node) => node.visit(this));
        block.empty?.visit(this);
    }
    visitForLoopBlockEmpty(block) {
        block.children.forEach((node) => node.visit(this));
    }
    visitIfBlock(block) {
        block.branches.forEach((node) => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.expressionAlias?.visit(this);
        block.children.forEach((node) => node.visit(this));
    }
    visitContent(content) {
        content.children.forEach((child) => child.visit(this));
    }
    // Unused visitors.
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
            nodeOrNodes.contextVariables.forEach((v) => this.visitNode(v));
            nodeOrNodes.trackBy.visit(this);
            nodeOrNodes.children.forEach(this.visitNode);
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof DeferredBlock) {
            if (this.scope.rootNode !== nodeOrNodes) {
                throw new Error(`Assertion error: resolved incorrect scope for deferred block ${nodeOrNodes}`);
            }
            this.deferBlocks.push([nodeOrNodes, this.scope]);
            nodeOrNodes.children.forEach((node) => node.visit(this));
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof SwitchBlockCase ||
            nodeOrNodes instanceof ForLoopBlockEmpty ||
            nodeOrNodes instanceof DeferredBlockError ||
            nodeOrNodes instanceof DeferredBlockPlaceholder ||
            nodeOrNodes instanceof DeferredBlockLoading ||
            nodeOrNodes instanceof Content) {
            nodeOrNodes.children.forEach((node) => node.visit(this));
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
    visitTextAttribute(attribute) { }
    visitUnknownBlock(block) { }
    visitDeferredTrigger() { }
    visitIcu(icu) {
        Object.keys(icu.vars).forEach((key) => icu.vars[key].visit(this));
        Object.keys(icu.placeholders).forEach((key) => icu.placeholders[key].visit(this));
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
        block.branches.forEach((node) => node.visit(this));
    }
    visitIfBlockBranch(block) {
        block.expression?.visit(this);
        this.ingestScopedNode(block);
    }
    visitContent(content) {
        this.ingestScopedNode(content);
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
        this.deferredBlocks = rawDeferred.map((current) => current[0]);
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
        this.directives.forEach((dirs) => dirs.forEach((dir) => set.add(dir)));
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
        for (const entity of entities) {
            if (entity.name === name) {
                return entity;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLEdBQUcsRUFFSCxnQkFBZ0IsRUFHaEIsbUJBQW1CLEdBRXBCLE1BQU0sNkJBQTZCLENBQUM7QUFFckMsT0FBTyxFQUlMLE9BQU8sRUFDUCxPQUFPLEVBQ1AsYUFBYSxFQUNiLGtCQUFrQixFQUNsQixvQkFBb0IsRUFDcEIsd0JBQXdCLEVBRXhCLE9BQU8sRUFDUCxZQUFZLEVBQ1osaUJBQWlCLEVBQ2pCLG9CQUFvQixFQUdwQixhQUFhLEVBQ2IsMEJBQTBCLEVBRTFCLFNBQVMsRUFFVCxlQUFlLEVBQ2YsUUFBUSxFQUtSLHVCQUF1QixHQUV4QixNQUFNLFdBQVcsQ0FBQztBQVVuQixPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFakQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBQ3pCLFlBQW9CLGdCQUErQztRQUEvQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQStCO0lBQUcsQ0FBQztJQUV2RTs7O09BR0c7SUFDSCxJQUFJLENBQUMsTUFBYztRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JCLDRFQUE0RTtZQUM1RSxNQUFNLElBQUksS0FBSyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUVELDRGQUE0RjtRQUM1RixpRUFBaUU7UUFDakUsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFM0Msa0ZBQWtGO1FBQ2xGLE1BQU0sa0JBQWtCLEdBQUcseUJBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUQsOEZBQThG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QUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN4QyxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxlQUFlLEdBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM3QyxPQUFPLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDbEMsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLEdBQUcsRUFBRyxDQUFDO1FBQ3JDLEtBQUssTUFBTSxVQUFVLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1lBQ3BELGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxFQUFnRCxDQUFDO0lBQ2pGLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUM3QyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUNELE9BQU8sZ0JBQWdCLENBQUM7QUFDMUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBBU1QsXG4gIEJpbmRpbmdQaXBlLFxuICBJbXBsaWNpdFJlY2VpdmVyLFxuICBQcm9wZXJ0eVJlYWQsXG4gIFByb3BlcnR5V3JpdGUsXG4gIFJlY3Vyc2l2ZUFzdFZpc2l0b3IsXG4gIFNhZmVQcm9wZXJ0eVJlYWQsXG59IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQge1NlbGVjdG9yTWF0Y2hlcn0gZnJvbSAnLi4vLi4vc2VsZWN0b3InO1xuaW1wb3J0IHtcbiAgQm91bmRBdHRyaWJ1dGUsXG4gIEJvdW5kRXZlbnQsXG4gIEJvdW5kVGV4dCxcbiAgQ29tbWVudCxcbiAgQ29udGVudCxcbiAgRGVmZXJyZWRCbG9jayxcbiAgRGVmZXJyZWRCbG9ja0Vycm9yLFxuICBEZWZlcnJlZEJsb2NrTG9hZGluZyxcbiAgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyLFxuICBEZWZlcnJlZFRyaWdnZXIsXG4gIEVsZW1lbnQsXG4gIEZvckxvb3BCbG9jayxcbiAgRm9yTG9vcEJsb2NrRW1wdHksXG4gIEhvdmVyRGVmZXJyZWRUcmlnZ2VyLFxuICBJY3UsXG4gIElmQmxvY2ssXG4gIElmQmxvY2tCcmFuY2gsXG4gIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyLFxuICBOb2RlLFxuICBSZWZlcmVuY2UsXG4gIFN3aXRjaEJsb2NrLFxuICBTd2l0Y2hCbG9ja0Nhc2UsXG4gIFRlbXBsYXRlLFxuICBUZXh0LFxuICBUZXh0QXR0cmlidXRlLFxuICBVbmtub3duQmxvY2ssXG4gIFZhcmlhYmxlLFxuICBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcixcbiAgVmlzaXRvcixcbn0gZnJvbSAnLi4vcjNfYXN0JztcblxuaW1wb3J0IHtcbiAgQm91bmRUYXJnZXQsXG4gIERpcmVjdGl2ZU1ldGEsXG4gIFJlZmVyZW5jZVRhcmdldCxcbiAgU2NvcGVkTm9kZSxcbiAgVGFyZ2V0LFxuICBUYXJnZXRCaW5kZXIsXG59IGZyb20gJy4vdDJfYXBpJztcbmltcG9ydCB7Y3JlYXRlQ3NzU2VsZWN0b3JGcm9tTm9kZX0gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBQcm9jZXNzZXMgYFRhcmdldGBzIHdpdGggYSBnaXZlbiBzZXQgb2YgZGlyZWN0aXZlcyBhbmQgcGVyZm9ybXMgYSBiaW5kaW5nIG9wZXJhdGlvbiwgd2hpY2hcbiAqIHJldHVybnMgYW4gb2JqZWN0IHNpbWlsYXIgdG8gVHlwZVNjcmlwdCdzIGB0cy5UeXBlQ2hlY2tlcmAgdGhhdCBjb250YWlucyBrbm93bGVkZ2UgYWJvdXQgdGhlXG4gKiB0YXJnZXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM1RhcmdldEJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBUYXJnZXRCaW5kZXI8RGlyZWN0aXZlVD4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUW10+KSB7fVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGEgYmluZGluZyBvcGVyYXRpb24gb24gdGhlIGdpdmVuIGBUYXJnZXRgIGFuZCByZXR1cm4gYSBgQm91bmRUYXJnZXRgIHdoaWNoIGNvbnRhaW5zXG4gICAqIG1ldGFkYXRhIGFib3V0IHRoZSB0eXBlcyByZWZlcmVuY2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGJpbmQodGFyZ2V0OiBUYXJnZXQpOiBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gICAgaWYgKCF0YXJnZXQudGVtcGxhdGUpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogaGFuZGxlIHRhcmdldHMgd2hpY2ggY29udGFpbiB0aGluZ3MgbGlrZSBIb3N0QmluZGluZ3MsIGV0Yy5cbiAgICAgIHRocm93IG5ldyBFcnJvcignQmluZGluZyB3aXRob3V0IGEgdGVtcGxhdGUgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCwgcGFyc2UgdGhlIHRlbXBsYXRlIGludG8gYSBgU2NvcGVgIHN0cnVjdHVyZS4gVGhpcyBvcGVyYXRpb24gY2FwdHVyZXMgdGhlIHN5bnRhY3RpY1xuICAgIC8vIHNjb3BlcyBpbiB0aGUgdGVtcGxhdGUgYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciBsYXRlciB1c2UuXG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5hcHBseSh0YXJnZXQudGVtcGxhdGUpO1xuXG4gICAgLy8gVXNlIHRoZSBgU2NvcGVgIHRvIGV4dHJhY3QgdGhlIGVudGl0aWVzIHByZXNlbnQgYXQgZXZlcnkgbGV2ZWwgb2YgdGhlIHRlbXBsYXRlLlxuICAgIGNvbnN0IHNjb3BlZE5vZGVFbnRpdGllcyA9IGV4dHJhY3RTY29wZWROb2RlRW50aXRpZXMoc2NvcGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9ID0gRGlyZWN0aXZlQmluZGVyLmFwcGx5KFxuICAgICAgdGFyZ2V0LnRlbXBsYXRlLFxuICAgICAgdGhpcy5kaXJlY3RpdmVNYXRjaGVyLFxuICAgICk7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXMsIGVhZ2VyUGlwZXMsIGRlZmVyQmxvY2tzfSA9XG4gICAgICBUZW1wbGF0ZUJpbmRlci5hcHBseVdpdGhTY29wZSh0YXJnZXQudGVtcGxhdGUsIHNjb3BlKTtcbiAgICByZXR1cm4gbmV3IFIzQm91bmRUYXJnZXQoXG4gICAgICB0YXJnZXQsXG4gICAgICBkaXJlY3RpdmVzLFxuICAgICAgZWFnZXJEaXJlY3RpdmVzLFxuICAgICAgYmluZGluZ3MsXG4gICAgICByZWZlcmVuY2VzLFxuICAgICAgZXhwcmVzc2lvbnMsXG4gICAgICBzeW1ib2xzLFxuICAgICAgbmVzdGluZ0xldmVsLFxuICAgICAgc2NvcGVkTm9kZUVudGl0aWVzLFxuICAgICAgdXNlZFBpcGVzLFxuICAgICAgZWFnZXJQaXBlcyxcbiAgICAgIGRlZmVyQmxvY2tzLFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgYmluZGluZyBzY29wZSB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBBbnkgdmFyaWFibGVzLCByZWZlcmVuY2VzLCBvciBvdGhlciBuYW1lZCBlbnRpdGllcyBkZWNsYXJlZCB3aXRoaW4gdGhlIHRlbXBsYXRlIHdpbGxcbiAqIGJlIGNhcHR1cmVkIGFuZCBhdmFpbGFibGUgYnkgbmFtZSBpbiBgbmFtZWRFbnRpdGllc2AuIEFkZGl0aW9uYWxseSwgY2hpbGQgdGVtcGxhdGVzIHdpbGxcbiAqIGJlIGFuYWx5emVkIGFuZCBoYXZlIHRoZWlyIGNoaWxkIGBTY29wZWBzIGF2YWlsYWJsZSBpbiBgY2hpbGRTY29wZXNgLlxuICovXG5jbGFzcyBTY29wZSBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvKipcbiAgICogTmFtZWQgbWVtYmVycyBvZiB0aGUgYFNjb3BlYCwgc3VjaCBhcyBgUmVmZXJlbmNlYHMgb3IgYFZhcmlhYmxlYHMuXG4gICAqL1xuICByZWFkb25seSBuYW1lZEVudGl0aWVzID0gbmV3IE1hcDxzdHJpbmcsIFJlZmVyZW5jZSB8IFZhcmlhYmxlPigpO1xuXG4gIC8qKlxuICAgKiBTZXQgb2YgZWxlbWVudHMgdGhhdCBiZWxvbmcgdG8gdGhpcyBzY29wZS5cbiAgICovXG4gIHJlYWRvbmx5IGVsZW1lbnRzSW5TY29wZSA9IG5ldyBTZXQ8RWxlbWVudD4oKTtcblxuICAvKipcbiAgICogQ2hpbGQgYFNjb3BlYHMgZm9yIGltbWVkaWF0ZWx5IG5lc3RlZCBgU2NvcGVkTm9kZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgY2hpbGRTY29wZXMgPSBuZXcgTWFwPFNjb3BlZE5vZGUsIFNjb3BlPigpO1xuXG4gIC8qKiBXaGV0aGVyIHRoaXMgc2NvcGUgaXMgZGVmZXJyZWQgb3IgaWYgYW55IG9mIGl0cyBhbmNlc3RvcnMgYXJlIGRlZmVycmVkLiAqL1xuICByZWFkb25seSBpc0RlZmVycmVkOiBib29sZWFuO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgcGFyZW50U2NvcGU6IFNjb3BlIHwgbnVsbCxcbiAgICByZWFkb25seSByb290Tm9kZTogU2NvcGVkTm9kZSB8IG51bGwsXG4gICkge1xuICAgIHRoaXMuaXNEZWZlcnJlZCA9XG4gICAgICBwYXJlbnRTY29wZSAhPT0gbnVsbCAmJiBwYXJlbnRTY29wZS5pc0RlZmVycmVkID8gdHJ1ZSA6IHJvb3ROb2RlIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9jaztcbiAgfVxuXG4gIHN0YXRpYyBuZXdSb290U2NvcGUoKTogU2NvcGUge1xuICAgIHJldHVybiBuZXcgU2NvcGUobnVsbCwgbnVsbCk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChlaXRoZXIgYXMgYSBgVGVtcGxhdGVgIHN1Yi10ZW1wbGF0ZSB3aXRoIHZhcmlhYmxlcywgb3IgYSBwbGFpbiBhcnJheSBvZlxuICAgKiB0ZW1wbGF0ZSBgTm9kZWBzKSBhbmQgY29uc3RydWN0IGl0cyBgU2NvcGVgLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5KHRlbXBsYXRlOiBOb2RlW10pOiBTY29wZSB7XG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5uZXdSb290U2NvcGUoKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiBzY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcHJvY2VzcyB0aGUgc2NvcGVkIG5vZGUgYW5kIHBvcHVsYXRlIHRoZSBgU2NvcGVgLlxuICAgKi9cbiAgcHJpdmF0ZSBpbmdlc3Qobm9kZU9yTm9kZXM6IFNjb3BlZE5vZGUgfCBOb2RlW10pOiB2b2lkIHtcbiAgICBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgLy8gVmFyaWFibGVzIG9uIGFuIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIGlubmVyIHNjb3BlLlxuICAgICAgbm9kZU9yTm9kZXMudmFyaWFibGVzLmZvckVhY2goKG5vZGUpID0+IHRoaXMudmlzaXRWYXJpYWJsZShub2RlKSk7XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgICBpZiAobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudmlzaXRWYXJpYWJsZShub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMpO1xuICAgICAgfVxuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9jaykge1xuICAgICAgdGhpcy52aXNpdFZhcmlhYmxlKG5vZGVPck5vZGVzLml0ZW0pO1xuICAgICAgbm9kZU9yTm9kZXMuY29udGV4dFZhcmlhYmxlcy5mb3JFYWNoKCh2KSA9PiB0aGlzLnZpc2l0VmFyaWFibGUodikpO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgU3dpdGNoQmxvY2tDYXNlIHx8XG4gICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9ja0VtcHR5IHx8XG4gICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2sgfHxcbiAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0Vycm9yIHx8XG4gICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciB8fFxuICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrTG9hZGluZyB8fFxuICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBDb250ZW50XG4gICAgKSB7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gb3ZlcmFyY2hpbmcgYFRlbXBsYXRlYCBpbnN0YW5jZSwgc28gcHJvY2VzcyB0aGUgbm9kZXMgZGlyZWN0bHkuXG4gICAgICBub2RlT3JOb2Rlcy5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIGBFbGVtZW50YHMgaW4gdGhlIHRlbXBsYXRlIG1heSBoYXZlIGBSZWZlcmVuY2VgcyB3aGljaCBhcmUgY2FwdHVyZWQgaW4gdGhlIHNjb3BlLlxuICAgIGVsZW1lbnQucmVmZXJlbmNlcy5mb3JFYWNoKChub2RlKSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgYEVsZW1lbnRgJ3MgY2hpbGRyZW4uXG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcblxuICAgIHRoaXMuZWxlbWVudHNJblNjb3BlLmFkZChlbGVtZW50KTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gUmVmZXJlbmNlcyBvbiBhIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIG91dGVyIHNjb3BlLCBzbyBjYXB0dXJlIHRoZW0gYmVmb3JlXG4gICAgLy8gcHJvY2Vzc2luZyB0aGUgdGVtcGxhdGUncyBjaGlsZCBzY29wZS5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2goKG5vZGUpID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgY3JlYXRlIGFuIGlubmVyIHNjb3BlIGFuZCBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSB3aXRoaW4gaXQuXG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKHRlbXBsYXRlKTtcbiAgfVxuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZSh2YXJpYWJsZSk7XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUocmVmZXJlbmNlKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jaykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShkZWZlcnJlZCk7XG4gICAgZGVmZXJyZWQucGxhY2Vob2xkZXI/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmxvYWRpbmc/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmVycm9yPy52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jaykge1xuICAgIGJsb2NrLmNhc2VzLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spIHtcbiAgICBibG9jay5icmFuY2hlcy5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShjb250ZW50KTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyOiBCb3VuZEF0dHJpYnV0ZSkge31cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cjogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcikge31cbiAgdmlzaXRVbmtub3duQmxvY2soYmxvY2s6IFVua25vd25CbG9jaykge31cblxuICBwcml2YXRlIG1heWJlRGVjbGFyZSh0aGluZzogUmVmZXJlbmNlIHwgVmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHNvbWV0aGluZyB3aXRoIGEgbmFtZSwgYXMgbG9uZyBhcyB0aGF0IG5hbWUgaXNuJ3QgdGFrZW4uXG4gICAgaWYgKCF0aGlzLm5hbWVkRW50aXRpZXMuaGFzKHRoaW5nLm5hbWUpKSB7XG4gICAgICB0aGlzLm5hbWVkRW50aXRpZXMuc2V0KHRoaW5nLm5hbWUsIHRoaW5nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIHZhcmlhYmxlIHdpdGhpbiB0aGlzIGBTY29wZWAuXG4gICAqXG4gICAqIFRoaXMgY2FuIHJlY3Vyc2UgaW50byBhIHBhcmVudCBgU2NvcGVgIGlmIGl0J3MgYXZhaWxhYmxlLlxuICAgKi9cbiAgbG9va3VwKG5hbWU6IHN0cmluZyk6IFJlZmVyZW5jZSB8IFZhcmlhYmxlIHwgbnVsbCB7XG4gICAgaWYgKHRoaXMubmFtZWRFbnRpdGllcy5oYXMobmFtZSkpIHtcbiAgICAgIC8vIEZvdW5kIGluIHRoZSBsb2NhbCBzY29wZS5cbiAgICAgIHJldHVybiB0aGlzLm5hbWVkRW50aXRpZXMuZ2V0KG5hbWUpITtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIC8vIE5vdCBpbiB0aGUgbG9jYWwgc2NvcGUsIGJ1dCB0aGVyZSdzIGEgcGFyZW50IHNjb3BlIHNvIGNoZWNrIHRoZXJlLlxuICAgICAgcmV0dXJuIHRoaXMucGFyZW50U2NvcGUubG9va3VwKG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBdCB0aGUgdG9wIGxldmVsIGFuZCBpdCB3YXNuJ3QgZm91bmQuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjaGlsZCBzY29wZSBmb3IgYSBgU2NvcGVkTm9kZWAuXG4gICAqXG4gICAqIFRoaXMgc2hvdWxkIGFsd2F5cyBiZSBkZWZpbmVkLlxuICAgKi9cbiAgZ2V0Q2hpbGRTY29wZShub2RlOiBTY29wZWROb2RlKTogU2NvcGUge1xuICAgIGNvbnN0IHJlcyA9IHRoaXMuY2hpbGRTY29wZXMuZ2V0KG5vZGUpO1xuICAgIGlmIChyZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NlcnRpb24gZXJyb3I6IGNoaWxkIHNjb3BlIGZvciAke25vZGV9IG5vdCBmb3VuZGApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3RTY29wZWROb2RlKG5vZGU6IFNjb3BlZE5vZGUpIHtcbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSh0aGlzLCBub2RlKTtcbiAgICBzY29wZS5pbmdlc3Qobm9kZSk7XG4gICAgdGhpcy5jaGlsZFNjb3Blcy5zZXQobm9kZSwgc2NvcGUpO1xuICB9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIG1hdGNoZXMgZGlyZWN0aXZlcyBvbiBub2RlcyAoZWxlbWVudHMgYW5kIHRlbXBsYXRlcykuXG4gKlxuICogVXN1YWxseSB1c2VkIHZpYSB0aGUgc3RhdGljIGBhcHBseSgpYCBtZXRob2QuXG4gKi9cbmNsYXNzIERpcmVjdGl2ZUJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLy8gSW5kaWNhdGVzIHdoZXRoZXIgd2UgYXJlIHZpc2l0aW5nIGVsZW1lbnRzIHdpdGhpbiBhIGBkZWZlcmAgYmxvY2tcbiAgcHJpdmF0ZSBpc0luRGVmZXJCbG9jayA9IGZhbHNlO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBtYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPixcbiAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50IHwgVGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgcHJpdmF0ZSBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSxcbiAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8XG4gICAgICBCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQgfCBUZXh0QXR0cmlidXRlLFxuICAgICAgRGlyZWN0aXZlVCB8IEVsZW1lbnQgfCBUZW1wbGF0ZVxuICAgID4sXG4gICAgcHJpdmF0ZSByZWZlcmVuY2VzOiBNYXA8XG4gICAgICBSZWZlcmVuY2UsXG4gICAgICB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVUOyBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9IHwgRWxlbWVudCB8IFRlbXBsYXRlXG4gICAgPixcbiAgKSB7fVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgKGxpc3Qgb2YgYE5vZGVgcykgYW5kIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIGFnYWluc3QgZWFjaCBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0gdGVtcGxhdGUgdGhlIGxpc3Qgb2YgdGVtcGxhdGUgYE5vZGVgcyB0byBtYXRjaCAocmVjdXJzaXZlbHkpLlxuICAgKiBAcGFyYW0gc2VsZWN0b3JNYXRjaGVyIGEgYFNlbGVjdG9yTWF0Y2hlcmAgY29udGFpbmluZyB0aGUgZGlyZWN0aXZlcyB0aGF0IGFyZSBpbiBzY29wZSBmb3JcbiAgICogdGhpcyB0ZW1wbGF0ZS5cbiAgICogQHJldHVybnMgdGhyZWUgbWFwcyB3aGljaCBjb250YWluIGluZm9ybWF0aW9uIGFib3V0IGRpcmVjdGl2ZXMgaW4gdGhlIHRlbXBsYXRlOiB0aGVcbiAgICogYGRpcmVjdGl2ZXNgIG1hcCB3aGljaCBsaXN0cyBkaXJlY3RpdmVzIG1hdGNoZWQgb24gZWFjaCBub2RlLCB0aGUgYGJpbmRpbmdzYCBtYXAgd2hpY2hcbiAgICogaW5kaWNhdGVzIHdoaWNoIGRpcmVjdGl2ZXMgY2xhaW1lZCB3aGljaCBiaW5kaW5ncyAoaW5wdXRzLCBvdXRwdXRzLCBldGMpLCBhbmQgdGhlIGByZWZlcmVuY2VzYFxuICAgKiBtYXAgd2hpY2ggcmVzb2x2ZXMgI3JlZmVyZW5jZXMgKGBSZWZlcmVuY2Vgcykgd2l0aGluIHRoZSB0ZW1wbGF0ZSB0byB0aGUgbmFtZWQgZGlyZWN0aXZlIG9yXG4gICAqIHRlbXBsYXRlIG5vZGUuXG4gICAqL1xuICBzdGF0aWMgYXBwbHk8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+KFxuICAgIHRlbXBsYXRlOiBOb2RlW10sXG4gICAgc2VsZWN0b3JNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPixcbiAgKToge1xuICAgIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50IHwgVGVtcGxhdGUsIERpcmVjdGl2ZVRbXT47XG4gICAgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW107XG4gICAgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQgfCBUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUIHwgRWxlbWVudCB8IFRlbXBsYXRlPjtcbiAgICByZWZlcmVuY2VzOiBNYXA8XG4gICAgICBSZWZlcmVuY2UsXG4gICAgICB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVUOyBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9IHwgRWxlbWVudCB8IFRlbXBsYXRlXG4gICAgPjtcbiAgfSB7XG4gICAgY29uc3QgZGlyZWN0aXZlcyA9IG5ldyBNYXA8RWxlbWVudCB8IFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+KCk7XG4gICAgY29uc3QgYmluZGluZ3MgPSBuZXcgTWFwPFxuICAgICAgQm91bmRBdHRyaWJ1dGUgfCBCb3VuZEV2ZW50IHwgVGV4dEF0dHJpYnV0ZSxcbiAgICAgIERpcmVjdGl2ZVQgfCBFbGVtZW50IHwgVGVtcGxhdGVcbiAgICA+KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlcyA9IG5ldyBNYXA8XG4gICAgICBSZWZlcmVuY2UsXG4gICAgICB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVUOyBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9IHwgRWxlbWVudCB8IFRlbXBsYXRlXG4gICAgPigpO1xuICAgIGNvbnN0IGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBEaXJlY3RpdmVCaW5kZXIoXG4gICAgICBzZWxlY3Rvck1hdGNoZXIsXG4gICAgICBkaXJlY3RpdmVzLFxuICAgICAgZWFnZXJEaXJlY3RpdmVzLFxuICAgICAgYmluZGluZ3MsXG4gICAgICByZWZlcmVuY2VzLFxuICAgICk7XG4gICAgbWF0Y2hlci5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiB7ZGlyZWN0aXZlcywgZWFnZXJEaXJlY3RpdmVzLCBiaW5kaW5ncywgcmVmZXJlbmNlc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdCh0ZW1wbGF0ZTogTm9kZVtdKTogdm9pZCB7XG4gICAgdGVtcGxhdGUuZm9yRWFjaCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShlbGVtZW50KTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKTogdm9pZCB7XG4gICAgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKHRlbXBsYXRlKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudE9yVGVtcGxhdGUobm9kZTogRWxlbWVudCB8IFRlbXBsYXRlKTogdm9pZCB7XG4gICAgLy8gRmlyc3QsIGRldGVybWluZSB0aGUgSFRNTCBzaGFwZSBvZiB0aGUgbm9kZSBmb3IgdGhlIHB1cnBvc2Ugb2YgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIC8vIERvIHRoaXMgYnkgYnVpbGRpbmcgdXAgYSBgQ3NzU2VsZWN0b3JgIGZvciB0aGUgbm9kZS5cbiAgICBjb25zdCBjc3NTZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yRnJvbU5vZGUobm9kZSk7XG5cbiAgICAvLyBOZXh0LCB1c2UgdGhlIGBTZWxlY3Rvck1hdGNoZXJgIHRvIGdldCB0aGUgbGlzdCBvZiBkaXJlY3RpdmVzIG9uIHRoZSBub2RlLlxuICAgIGNvbnN0IGRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSA9IFtdO1xuICAgIHRoaXMubWF0Y2hlci5tYXRjaChjc3NTZWxlY3RvciwgKF9zZWxlY3RvciwgcmVzdWx0cykgPT4gZGlyZWN0aXZlcy5wdXNoKC4uLnJlc3VsdHMpKTtcbiAgICBpZiAoZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXMuc2V0KG5vZGUsIGRpcmVjdGl2ZXMpO1xuICAgICAgaWYgKCF0aGlzLmlzSW5EZWZlckJsb2NrKSB7XG4gICAgICAgIHRoaXMuZWFnZXJEaXJlY3RpdmVzLnB1c2goLi4uZGlyZWN0aXZlcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVzb2x2ZSBhbnkgcmVmZXJlbmNlcyB0aGF0IGFyZSBjcmVhdGVkIG9uIHRoaXMgbm9kZS5cbiAgICBub2RlLnJlZmVyZW5jZXMuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICBsZXQgZGlyVGFyZ2V0OiBEaXJlY3RpdmVUIHwgbnVsbCA9IG51bGw7XG5cbiAgICAgIC8vIElmIHRoZSByZWZlcmVuY2UgZXhwcmVzc2lvbiBpcyBlbXB0eSwgdGhlbiBpdCBtYXRjaGVzIHRoZSBcInByaW1hcnlcIiBkaXJlY3RpdmUgb24gdGhlIG5vZGVcbiAgICAgIC8vIChpZiB0aGVyZSBpcyBvbmUpLiBPdGhlcndpc2UgaXQgbWF0Y2hlcyB0aGUgaG9zdCBub2RlIGl0c2VsZiAoZWl0aGVyIGFuIGVsZW1lbnQgb3JcbiAgICAgIC8vIDxuZy10ZW1wbGF0ZT4gbm9kZSkuXG4gICAgICBpZiAocmVmLnZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgLy8gVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbXBvbmVudCBpZiB0aGVyZSBpcyBvbmUuXG4gICAgICAgIGRpclRhcmdldCA9IGRpcmVjdGl2ZXMuZmluZCgoZGlyKSA9PiBkaXIuaXNDb21wb25lbnQpIHx8IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGlzIHNob3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGRpcmVjdGl2ZSBleHBvcnRlZCB2aWEgZXhwb3J0QXMuXG4gICAgICAgIGRpclRhcmdldCA9XG4gICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgKGRpcikgPT4gZGlyLmV4cG9ydEFzICE9PSBudWxsICYmIGRpci5leHBvcnRBcy5zb21lKCh2YWx1ZSkgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSksXG4gICAgICAgICAgKSB8fCBudWxsO1xuICAgICAgICAvLyBDaGVjayBpZiBhIG1hdGNoaW5nIGRpcmVjdGl2ZSB3YXMgZm91bmQuXG4gICAgICAgIGlmIChkaXJUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBObyBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kIC0gdGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGFuIHVua25vd24gdGFyZ2V0LiBMZWF2ZSBpdFxuICAgICAgICAgIC8vIHVubWFwcGVkLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGlyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhIGRpcmVjdGl2ZS5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIHtkaXJlY3RpdmU6IGRpclRhcmdldCwgbm9kZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIHRoZSBub2RlIGl0c2VsZi5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIGF0dHJpYnV0ZXMvYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuICAgIHR5cGUgQm91bmROb2RlID0gQm91bmRBdHRyaWJ1dGUgfCBCb3VuZEV2ZW50IHwgVGV4dEF0dHJpYnV0ZTtcbiAgICBjb25zdCBzZXRBdHRyaWJ1dGVCaW5kaW5nID0gKFxuICAgICAgYXR0cmlidXRlOiBCb3VuZE5vZGUsXG4gICAgICBpb1R5cGU6IGtleW9mIFBpY2s8RGlyZWN0aXZlTWV0YSwgJ2lucHV0cycgfCAnb3V0cHV0cyc+LFxuICAgICkgPT4ge1xuICAgICAgY29uc3QgZGlyID0gZGlyZWN0aXZlcy5maW5kKChkaXIpID0+IGRpcltpb1R5cGVdLmhhc0JpbmRpbmdQcm9wZXJ0eU5hbWUoYXR0cmlidXRlLm5hbWUpKTtcbiAgICAgIGNvbnN0IGJpbmRpbmcgPSBkaXIgIT09IHVuZGVmaW5lZCA/IGRpciA6IG5vZGU7XG4gICAgICB0aGlzLmJpbmRpbmdzLnNldChhdHRyaWJ1dGUsIGJpbmRpbmcpO1xuICAgIH07XG5cbiAgICAvLyBOb2RlIGlucHV0cyAoYm91bmQgYXR0cmlidXRlcykgYW5kIHRleHQgYXR0cmlidXRlcyBjYW4gYmUgYm91bmQgdG8gYW5cbiAgICAvLyBpbnB1dCBvbiBhIGRpcmVjdGl2ZS5cbiAgICBub2RlLmlucHV0cy5mb3JFYWNoKChpbnB1dCkgPT4gc2V0QXR0cmlidXRlQmluZGluZyhpbnB1dCwgJ2lucHV0cycpKTtcbiAgICBub2RlLmF0dHJpYnV0ZXMuZm9yRWFjaCgoYXR0cikgPT4gc2V0QXR0cmlidXRlQmluZGluZyhhdHRyLCAnaW5wdXRzJykpO1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIG5vZGUudGVtcGxhdGVBdHRycy5mb3JFYWNoKChhdHRyKSA9PiBzZXRBdHRyaWJ1dGVCaW5kaW5nKGF0dHIsICdpbnB1dHMnKSk7XG4gICAgfVxuICAgIC8vIE5vZGUgb3V0cHV0cyAoYm91bmQgZXZlbnRzKSBjYW4gYmUgYm91bmQgdG8gYW4gb3V0cHV0IG9uIGEgZGlyZWN0aXZlLlxuICAgIG5vZGUub3V0cHV0cy5mb3JFYWNoKChvdXRwdXQpID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcob3V0cHV0LCAnb3V0cHV0cycpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgbm9kZSdzIGNoaWxkcmVuLlxuICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGNvbnN0IHdhc0luRGVmZXJCbG9jayA9IHRoaXMuaXNJbkRlZmVyQmxvY2s7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHRydWU7XG4gICAgZGVmZXJyZWQuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgICB0aGlzLmlzSW5EZWZlckJsb2NrID0gd2FzSW5EZWZlckJsb2NrO1xuXG4gICAgZGVmZXJyZWQucGxhY2Vob2xkZXI/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmxvYWRpbmc/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmVycm9yPy52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpOiB2b2lkIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jaykge1xuICAgIGJsb2NrLmNhc2VzLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIGJsb2NrLml0ZW0udmlzaXQodGhpcyk7XG4gICAgYmxvY2suY29udGV4dFZhcmlhYmxlcy5mb3JFYWNoKCh2KSA9PiB2LnZpc2l0KHRoaXMpKTtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKSB7XG4gICAgYmxvY2suYnJhbmNoZXMuZm9yRWFjaCgobm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpIHtcbiAgICBibG9jay5leHByZXNzaW9uQWxpYXM/LnZpc2l0KHRoaXMpO1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpOiB2b2lkIHtcbiAgICBjb250ZW50LmNoaWxkcmVuLmZvckVhY2goKGNoaWxkKSA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICAvLyBVbnVzZWQgdmlzaXRvcnMuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKTogdm9pZCB7fVxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSk6IHZvaWQge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kRXZlbnQoYXR0cmlidXRlOiBCb3VuZEV2ZW50KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlT3JFdmVudChub2RlOiBCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHt9XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spIHt9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICpcbiAqIFRoaXMgaXMgYSBjb21wYW5pb24gdG8gdGhlIGBEaXJlY3RpdmVCaW5kZXJgIHRoYXQgZG9lc24ndCByZXF1aXJlIGtub3dsZWRnZSBvZiBkaXJlY3RpdmVzIG1hdGNoZWRcbiAqIHdpdGhpbiB0aGUgdGVtcGxhdGUgaW4gb3JkZXIgdG8gb3BlcmF0ZS5cbiAqXG4gKiBFeHByZXNzaW9ucyBhcmUgdmlzaXRlZCBieSB0aGUgc3VwZXJjbGFzcyBgUmVjdXJzaXZlQXN0VmlzaXRvcmAsIHdpdGggY3VzdG9tIGxvZ2ljIHByb3ZpZGVkXG4gKiBieSBvdmVycmlkZGVuIG1ldGhvZHMgZnJvbSB0aGF0IHZpc2l0b3IuXG4gKi9cbmNsYXNzIFRlbXBsYXRlQmluZGVyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICBwcml2YXRlIHZpc2l0Tm9kZTogKG5vZGU6IE5vZGUpID0+IHZvaWQ7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8QVNULCBSZWZlcmVuY2UgfCBWYXJpYWJsZT4sXG4gICAgcHJpdmF0ZSBzeW1ib2xzOiBNYXA8UmVmZXJlbmNlIHwgVmFyaWFibGUsIFNjb3BlZE5vZGU+LFxuICAgIHByaXZhdGUgdXNlZFBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICBwcml2YXRlIGVhZ2VyUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgIHByaXZhdGUgZGVmZXJCbG9ja3M6IFtEZWZlcnJlZEJsb2NrLCBTY29wZV1bXSxcbiAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgcHJpdmF0ZSByb290Tm9kZTogU2NvcGVkTm9kZSB8IG51bGwsXG4gICAgcHJpdmF0ZSBsZXZlbDogbnVtYmVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyBkZWZpbmVkIHRvIHJlY29uY2lsZSB0aGUgdHlwZSBvZiBUZW1wbGF0ZUJpbmRlciBzaW5jZSBib3RoXG4gIC8vIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgYW5kIFZpc2l0b3IgZGVmaW5lIHRoZSB2aXNpdCgpIG1ldGhvZCBpbiB0aGVpclxuICAvLyBpbnRlcmZhY2VzLlxuICBvdmVycmlkZSB2aXNpdChub2RlOiBBU1QgfCBOb2RlLCBjb250ZXh0PzogYW55KSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBBU1QpIHtcbiAgICAgIG5vZGUudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUudmlzaXQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gICAqXG4gICAqIEBwYXJhbSBub2RlcyB0aGUgbm9kZXMgb2YgdGhlIHRlbXBsYXRlIHRvIHByb2Nlc3NcbiAgICogQHBhcmFtIHNjb3BlIHRoZSBgU2NvcGVgIG9mIHRoZSB0ZW1wbGF0ZSBiZWluZyBwcm9jZXNzZWQuXG4gICAqIEByZXR1cm5zIHRocmVlIG1hcHMgd2hpY2ggY29udGFpbiBtZXRhZGF0YSBhYm91dCB0aGUgdGVtcGxhdGU6IGBleHByZXNzaW9uc2Agd2hpY2ggaW50ZXJwcmV0c1xuICAgKiBzcGVjaWFsIGBBU1RgIG5vZGVzIGluIGV4cHJlc3Npb25zIGFzIHBvaW50aW5nIHRvIHJlZmVyZW5jZXMgb3IgdmFyaWFibGVzIGRlY2xhcmVkIHdpdGhpbiB0aGVcbiAgICogdGVtcGxhdGUsIGBzeW1ib2xzYCB3aGljaCBtYXBzIHRob3NlIHZhcmlhYmxlcyBhbmQgcmVmZXJlbmNlcyB0byB0aGUgbmVzdGVkIGBUZW1wbGF0ZWAgd2hpY2hcbiAgICogZGVjbGFyZXMgdGhlbSwgaWYgYW55LCBhbmQgYG5lc3RpbmdMZXZlbGAgd2hpY2ggYXNzb2NpYXRlcyBlYWNoIGBUZW1wbGF0ZWAgd2l0aCBhIGludGVnZXJcbiAgICogbmVzdGluZyBsZXZlbCAoaG93IG1hbnkgbGV2ZWxzIGRlZXAgd2l0aGluIHRoZSB0ZW1wbGF0ZSBzdHJ1Y3R1cmUgdGhlIGBUZW1wbGF0ZWAgaXMpLCBzdGFydGluZ1xuICAgKiBhdCAxLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5V2l0aFNjb3BlKFxuICAgIG5vZGVzOiBOb2RlW10sXG4gICAgc2NvcGU6IFNjb3BlLFxuICApOiB7XG4gICAgZXhwcmVzc2lvbnM6IE1hcDxBU1QsIFJlZmVyZW5jZSB8IFZhcmlhYmxlPjtcbiAgICBzeW1ib2xzOiBNYXA8VmFyaWFibGUgfCBSZWZlcmVuY2UsIFRlbXBsYXRlPjtcbiAgICBuZXN0aW5nTGV2ZWw6IE1hcDxTY29wZWROb2RlLCBudW1iZXI+O1xuICAgIHVzZWRQaXBlczogU2V0PHN0cmluZz47XG4gICAgZWFnZXJQaXBlczogU2V0PHN0cmluZz47XG4gICAgZGVmZXJCbG9ja3M6IFtEZWZlcnJlZEJsb2NrLCBTY29wZV1bXTtcbiAgfSB7XG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSBuZXcgTWFwPEFTVCwgUmVmZXJlbmNlIHwgVmFyaWFibGU+KCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IG5ldyBNYXA8VmFyaWFibGUgfCBSZWZlcmVuY2UsIFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IG5lc3RpbmdMZXZlbCA9IG5ldyBNYXA8U2NvcGVkTm9kZSwgbnVtYmVyPigpO1xuICAgIGNvbnN0IHVzZWRQaXBlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGVhZ2VyUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG5vZGVzIGluc3RhbmNlb2YgVGVtcGxhdGUgPyBub2RlcyA6IG51bGw7XG4gICAgY29uc3QgZGVmZXJCbG9ja3M6IFtEZWZlcnJlZEJsb2NrLCBTY29wZV1bXSA9IFtdO1xuICAgIC8vIFRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUgaGFzIG5lc3RpbmcgbGV2ZWwgMC5cbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICBleHByZXNzaW9ucyxcbiAgICAgIHN5bWJvbHMsXG4gICAgICB1c2VkUGlwZXMsXG4gICAgICBlYWdlclBpcGVzLFxuICAgICAgZGVmZXJCbG9ja3MsXG4gICAgICBuZXN0aW5nTGV2ZWwsXG4gICAgICBzY29wZSxcbiAgICAgIHRlbXBsYXRlLFxuICAgICAgMCxcbiAgICApO1xuICAgIGJpbmRlci5pbmdlc3Qobm9kZXMpO1xuICAgIHJldHVybiB7ZXhwcmVzc2lvbnMsIHN5bWJvbHMsIG5lc3RpbmdMZXZlbCwgdXNlZFBpcGVzLCBlYWdlclBpcGVzLCBkZWZlckJsb2Nrc307XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdChub2RlT3JOb2RlczogU2NvcGVkTm9kZSB8IE5vZGVbXSk6IHZvaWQge1xuICAgIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3Mgb25seSB2YXJpYWJsZXMgYW5kIGNoaWxkIG5vZGVzLiBJbnB1dHMsIG91dHB1dHMsIHRlbXBsYXRlQXR0cnMsXG4gICAgICAvLyBhbmQgcmVmZXJlbmNlcyB3ZXJlIGFsbCBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgbm9kZU9yTm9kZXMudmFyaWFibGVzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAgIC8vIFNldCB0aGUgbmVzdGluZyBsZXZlbC5cbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIElmQmxvY2tCcmFuY2gpIHtcbiAgICAgIGlmIChub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy52aXNpdE5vZGUobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICAgIH1cbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRm9yTG9vcEJsb2NrKSB7XG4gICAgICB0aGlzLnZpc2l0Tm9kZShub2RlT3JOb2Rlcy5pdGVtKTtcbiAgICAgIG5vZGVPck5vZGVzLmNvbnRleHRWYXJpYWJsZXMuZm9yRWFjaCgodikgPT4gdGhpcy52aXNpdE5vZGUodikpO1xuICAgICAgbm9kZU9yTm9kZXMudHJhY2tCeS52aXNpdCh0aGlzKTtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9jaykge1xuICAgICAgaWYgKHRoaXMuc2NvcGUucm9vdE5vZGUgIT09IG5vZGVPck5vZGVzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQXNzZXJ0aW9uIGVycm9yOiByZXNvbHZlZCBpbmNvcnJlY3Qgc2NvcGUgZm9yIGRlZmVycmVkIGJsb2NrICR7bm9kZU9yTm9kZXN9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVmZXJCbG9ja3MucHVzaChbbm9kZU9yTm9kZXMsIHRoaXMuc2NvcGVdKTtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBTd2l0Y2hCbG9ja0Nhc2UgfHxcbiAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRm9yTG9vcEJsb2NrRW1wdHkgfHxcbiAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0Vycm9yIHx8XG4gICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciB8fFxuICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrTG9hZGluZyB8fFxuICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBDb250ZW50XG4gICAgKSB7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKChub2RlKSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFZpc2l0IGVhY2ggbm9kZSBmcm9tIHRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUuXG4gICAgICBub2RlT3JOb2Rlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIFZpc2l0IHRoZSBpbnB1dHMsIG91dHB1dHMsIGFuZCBjaGlsZHJlbiBvZiB0aGUgZWxlbWVudC5cbiAgICBlbGVtZW50LmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50Lm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50LnJlZmVyZW5jZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSkge1xuICAgIC8vIEZpcnN0LCB2aXNpdCBpbnB1dHMsIG91dHB1dHMgYW5kIHRlbXBsYXRlIGF0dHJpYnV0ZXMgb2YgdGhlIHRlbXBsYXRlIG5vZGUuXG4gICAgdGVtcGxhdGUuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLm91dHB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGVtcGxhdGUudGVtcGxhdGVBdHRycy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuXG4gICAgLy8gTmV4dCwgcmVjdXJzZSBpbnRvIHRoZSB0ZW1wbGF0ZS5cbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUodGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFZhcmlhYmxlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnJvb3ROb2RlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHZhcmlhYmxlLCB0aGlzLnJvb3ROb2RlKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgUmVmZXJlbmNlYCBhcyBhIHN5bWJvbCBpbiB0aGUgY3VycmVudCBgVGVtcGxhdGVgLlxuICAgIGlmICh0aGlzLnJvb3ROb2RlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN5bWJvbHMuc2V0KHJlZmVyZW5jZSwgdGhpcy5yb290Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVW51c2VkIHRlbXBsYXRlIHZpc2l0b3JzXG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdFVua25vd25CbG9jayhibG9jazogVW5rbm93bkJsb2NrKSB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcigpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7XG4gICAgT2JqZWN0LmtleXMoaWN1LnZhcnMpLmZvckVhY2goKGtleSkgPT4gaWN1LnZhcnNba2V5XS52aXNpdCh0aGlzKSk7XG4gICAgT2JqZWN0LmtleXMoaWN1LnBsYWNlaG9sZGVycykuZm9yRWFjaCgoa2V5KSA9PiBpY3UucGxhY2Vob2xkZXJzW2tleV0udmlzaXQodGhpcykpO1xuICB9XG5cbiAgLy8gVGhlIHJlbWFpbmluZyB2aXNpdG9ycyBhcmUgY29uY2VybmVkIHdpdGggcHJvY2Vzc2luZyBBU1QgZXhwcmVzc2lvbnMgd2l0aGluIHRlbXBsYXRlIGJpbmRpbmdzXG5cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZShhdHRyaWJ1dGU6IEJvdW5kQXR0cmlidXRlKSB7XG4gICAgYXR0cmlidXRlLnZhbHVlLnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXRCb3VuZEV2ZW50KGV2ZW50OiBCb3VuZEV2ZW50KSB7XG4gICAgZXZlbnQuaGFuZGxlci52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jaykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShkZWZlcnJlZCk7XG4gICAgZGVmZXJyZWQudHJpZ2dlcnMud2hlbj8udmFsdWUudmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQucHJlZmV0Y2hUcmlnZ2Vycy53aGVuPy52YWx1ZS52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5wbGFjZWhvbGRlciAmJiB0aGlzLnZpc2l0Tm9kZShkZWZlcnJlZC5wbGFjZWhvbGRlcik7XG4gICAgZGVmZXJyZWQubG9hZGluZyAmJiB0aGlzLnZpc2l0Tm9kZShkZWZlcnJlZC5sb2FkaW5nKTtcbiAgICBkZWZlcnJlZC5lcnJvciAmJiB0aGlzLnZpc2l0Tm9kZShkZWZlcnJlZC5lcnJvcik7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spIHtcbiAgICBibG9jay5leHByZXNzaW9uLnZpc2l0KHRoaXMpO1xuICAgIGJsb2NrLmNhc2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIGJsb2NrLmV4cHJlc3Npb24/LnZpc2l0KHRoaXMpO1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9jayhibG9jazogRm9yTG9vcEJsb2NrKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jaykge1xuICAgIGJsb2NrLmJyYW5jaGVzLmZvckVhY2goKG5vZGUpID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbj8udmlzaXQodGhpcyk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGNvbnRlbnQpO1xuICB9XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KSB7XG4gICAgdGV4dC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnVzZWRQaXBlcy5hZGQoYXN0Lm5hbWUpO1xuICAgIGlmICghdGhpcy5zY29wZS5pc0RlZmVycmVkKSB7XG4gICAgICB0aGlzLmVhZ2VyUGlwZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UGlwZShhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gVGhlc2UgZml2ZSB0eXBlcyBvZiBBU1QgZXhwcmVzc2lvbnMgY2FuIHJlZmVyIHRvIGV4cHJlc3Npb24gcm9vdHMsIHdoaWNoIGNvdWxkIGJlIHZhcmlhYmxlc1xuICAvLyBvciByZWZlcmVuY2VzIGluIHRoZSBjdXJyZW50IHNjb3BlLlxuXG4gIG92ZXJyaWRlIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UHJvcGVydHlSZWFkKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5V3JpdGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0U2NvcGVkTm9kZShub2RlOiBTY29wZWROb2RlKSB7XG4gICAgY29uc3QgY2hpbGRTY29wZSA9IHRoaXMuc2NvcGUuZ2V0Q2hpbGRTY29wZShub2RlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICB0aGlzLmJpbmRpbmdzLFxuICAgICAgdGhpcy5zeW1ib2xzLFxuICAgICAgdGhpcy51c2VkUGlwZXMsXG4gICAgICB0aGlzLmVhZ2VyUGlwZXMsXG4gICAgICB0aGlzLmRlZmVyQmxvY2tzLFxuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwsXG4gICAgICBjaGlsZFNjb3BlLFxuICAgICAgbm9kZSxcbiAgICAgIHRoaXMubGV2ZWwgKyAxLFxuICAgICk7XG4gICAgYmluZGVyLmluZ2VzdChub2RlKTtcbiAgfVxuXG4gIHByaXZhdGUgbWF5YmVNYXAoYXN0OiBQcm9wZXJ0eVJlYWQgfCBTYWZlUHJvcGVydHlSZWFkIHwgUHJvcGVydHlXcml0ZSwgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIHJlY2VpdmVyIG9mIHRoZSBleHByZXNzaW9uIGlzbid0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAsIHRoaXMgaXNuJ3QgdGhlIHJvb3Qgb2YgYW5cbiAgICAvLyBgQVNUYCBleHByZXNzaW9uIHRoYXQgbWFwcyB0byBhIGBWYXJpYWJsZWAgb3IgYFJlZmVyZW5jZWAuXG4gICAgaWYgKCEoYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBuYW1lIGV4aXN0cyBpbiB0aGUgY3VycmVudCBzY29wZS4gSWYgc28sIG1hcCBpdC4gT3RoZXJ3aXNlLCB0aGUgbmFtZSBpc1xuICAgIC8vIHByb2JhYmx5IGEgcHJvcGVydHkgb24gdGhlIHRvcC1sZXZlbCBjb21wb25lbnQgY29udGV4dC5cbiAgICBsZXQgdGFyZ2V0ID0gdGhpcy5zY29wZS5sb29rdXAobmFtZSk7XG4gICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXN0LCB0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ldGFkYXRhIGNvbnRhaW5lciBmb3IgYSBgVGFyZ2V0YCB0aGF0IGFsbG93cyBxdWVyaWVzIGZvciBzcGVjaWZpYyBiaXRzIG9mIG1ldGFkYXRhLlxuICpcbiAqIFNlZSBgQm91bmRUYXJnZXRgIGZvciBkb2N1bWVudGF0aW9uIG9uIHRoZSBpbmRpdmlkdWFsIG1ldGhvZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM0JvdW5kVGFyZ2V0PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIEJvdW5kVGFyZ2V0PERpcmVjdGl2ZVQ+IHtcbiAgLyoqIERlZmVycmVkIGJsb2Nrcywgb3JkZXJlZCBhcyB0aGV5IGFwcGVhciBpbiB0aGUgdGVtcGxhdGUuICovXG4gIHByaXZhdGUgZGVmZXJyZWRCbG9ja3M6IERlZmVycmVkQmxvY2tbXTtcblxuICAvKiogTWFwIG9mIGRlZmVycmVkIGJsb2NrcyB0byB0aGVpciBzY29wZS4gKi9cbiAgcHJpdmF0ZSBkZWZlcnJlZFNjb3BlczogTWFwPERlZmVycmVkQmxvY2ssIFNjb3BlPjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICByZWFkb25seSB0YXJnZXQ6IFRhcmdldCxcbiAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50IHwgVGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgcHJpdmF0ZSBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSxcbiAgICBwcml2YXRlIGJpbmRpbmdzOiBNYXA8XG4gICAgICBCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQgfCBUZXh0QXR0cmlidXRlLFxuICAgICAgRGlyZWN0aXZlVCB8IEVsZW1lbnQgfCBUZW1wbGF0ZVxuICAgID4sXG4gICAgcHJpdmF0ZSByZWZlcmVuY2VzOiBNYXA8XG4gICAgICBCb3VuZEF0dHJpYnV0ZSB8IEJvdW5kRXZlbnQgfCBSZWZlcmVuY2UgfCBUZXh0QXR0cmlidXRlLFxuICAgICAge2RpcmVjdGl2ZTogRGlyZWN0aXZlVDsgbm9kZTogRWxlbWVudCB8IFRlbXBsYXRlfSB8IEVsZW1lbnQgfCBUZW1wbGF0ZVxuICAgID4sXG4gICAgcHJpdmF0ZSBleHByVGFyZ2V0czogTWFwPEFTVCwgUmVmZXJlbmNlIHwgVmFyaWFibGU+LFxuICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZSB8IFZhcmlhYmxlLCBUZW1wbGF0ZT4sXG4gICAgcHJpdmF0ZSBuZXN0aW5nTGV2ZWw6IE1hcDxTY29wZWROb2RlLCBudW1iZXI+LFxuICAgIHByaXZhdGUgc2NvcGVkTm9kZUVudGl0aWVzOiBNYXA8U2NvcGVkTm9kZSB8IG51bGwsIFJlYWRvbmx5U2V0PFJlZmVyZW5jZSB8IFZhcmlhYmxlPj4sXG4gICAgcHJpdmF0ZSB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgIHByaXZhdGUgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sXG4gICAgcmF3RGVmZXJyZWQ6IFtEZWZlcnJlZEJsb2NrLCBTY29wZV1bXSxcbiAgKSB7XG4gICAgdGhpcy5kZWZlcnJlZEJsb2NrcyA9IHJhd0RlZmVycmVkLm1hcCgoY3VycmVudCkgPT4gY3VycmVudFswXSk7XG4gICAgdGhpcy5kZWZlcnJlZFNjb3BlcyA9IG5ldyBNYXAocmF3RGVmZXJyZWQpO1xuICB9XG5cbiAgZ2V0RW50aXRpZXNJblNjb3BlKG5vZGU6IFNjb3BlZE5vZGUgfCBudWxsKTogUmVhZG9ubHlTZXQ8UmVmZXJlbmNlIHwgVmFyaWFibGU+IHtcbiAgICByZXR1cm4gdGhpcy5zY29wZWROb2RlRW50aXRpZXMuZ2V0KG5vZGUpID8/IG5ldyBTZXQoKTtcbiAgfVxuXG4gIGdldERpcmVjdGl2ZXNPZk5vZGUobm9kZTogRWxlbWVudCB8IFRlbXBsYXRlKTogRGlyZWN0aXZlVFtdIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZGlyZWN0aXZlcy5nZXQobm9kZSkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldFJlZmVyZW5jZVRhcmdldChyZWY6IFJlZmVyZW5jZSk6IFJlZmVyZW5jZVRhcmdldDxEaXJlY3RpdmVUPiB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZXMuZ2V0KHJlZikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldENvbnN1bWVyT2ZCaW5kaW5nKFxuICAgIGJpbmRpbmc6IEJvdW5kQXR0cmlidXRlIHwgQm91bmRFdmVudCB8IFRleHRBdHRyaWJ1dGUsXG4gICk6IERpcmVjdGl2ZVQgfCBFbGVtZW50IHwgVGVtcGxhdGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5iaW5kaW5ncy5nZXQoYmluZGluZykgfHwgbnVsbDtcbiAgfVxuXG4gIGdldEV4cHJlc3Npb25UYXJnZXQoZXhwcjogQVNUKTogUmVmZXJlbmNlIHwgVmFyaWFibGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5leHByVGFyZ2V0cy5nZXQoZXhwcikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldERlZmluaXRpb25Ob2RlT2ZTeW1ib2woc3ltYm9sOiBSZWZlcmVuY2UgfCBWYXJpYWJsZSk6IFNjb3BlZE5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5zeW1ib2xzLmdldChzeW1ib2wpIHx8IG51bGw7XG4gIH1cblxuICBnZXROZXN0aW5nTGV2ZWwobm9kZTogU2NvcGVkTm9kZSk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubmVzdGluZ0xldmVsLmdldChub2RlKSB8fCAwO1xuICB9XG5cbiAgZ2V0VXNlZERpcmVjdGl2ZXMoKTogRGlyZWN0aXZlVFtdIHtcbiAgICBjb25zdCBzZXQgPSBuZXcgU2V0PERpcmVjdGl2ZVQ+KCk7XG4gICAgdGhpcy5kaXJlY3RpdmVzLmZvckVhY2goKGRpcnMpID0+IGRpcnMuZm9yRWFjaCgoZGlyKSA9PiBzZXQuYWRkKGRpcikpKTtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShzZXQudmFsdWVzKCkpO1xuICB9XG5cbiAgZ2V0RWFnZXJseVVzZWREaXJlY3RpdmVzKCk6IERpcmVjdGl2ZVRbXSB7XG4gICAgY29uc3Qgc2V0ID0gbmV3IFNldDxEaXJlY3RpdmVUPih0aGlzLmVhZ2VyRGlyZWN0aXZlcyk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldFVzZWRQaXBlcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy51c2VkUGlwZXMpO1xuICB9XG5cbiAgZ2V0RWFnZXJseVVzZWRQaXBlcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5lYWdlclBpcGVzKTtcbiAgfVxuXG4gIGdldERlZmVyQmxvY2tzKCk6IERlZmVycmVkQmxvY2tbXSB7XG4gICAgcmV0dXJuIHRoaXMuZGVmZXJyZWRCbG9ja3M7XG4gIH1cblxuICBnZXREZWZlcnJlZFRyaWdnZXJUYXJnZXQoYmxvY2s6IERlZmVycmVkQmxvY2ssIHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IEVsZW1lbnQgfCBudWxsIHtcbiAgICAvLyBPbmx5IHRyaWdnZXJzIHRoYXQgcmVmZXIgdG8gRE9NIG5vZGVzIGNhbiBiZSByZXNvbHZlZC5cbiAgICBpZiAoXG4gICAgICAhKHRyaWdnZXIgaW5zdGFuY2VvZiBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlcikgJiZcbiAgICAgICEodHJpZ2dlciBpbnN0YW5jZW9mIFZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyKSAmJlxuICAgICAgISh0cmlnZ2VyIGluc3RhbmNlb2YgSG92ZXJEZWZlcnJlZFRyaWdnZXIpXG4gICAgKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lID0gdHJpZ2dlci5yZWZlcmVuY2U7XG5cbiAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgbGV0IHRyaWdnZXI6IEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICAgICAgaWYgKGJsb2NrLnBsYWNlaG9sZGVyICE9PSBudWxsKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgYmxvY2sucGxhY2Vob2xkZXIuY2hpbGRyZW4pIHtcbiAgICAgICAgICAvLyBTa2lwIG92ZXIgY29tbWVudCBub2Rlcy4gQ3VycmVudGx5IGJ5IGRlZmF1bHQgdGhlIHRlbXBsYXRlIHBhcnNlciBkb2Vzbid0IGNhcHR1cmVcbiAgICAgICAgICAvLyBjb21tZW50cywgYnV0IHdlIGhhdmUgYSBzYWZlZ3VhcmQgaGVyZSBqdXN0IGluIGNhc2Ugc2luY2UgaXQgY2FuIGJlIGVuYWJsZWQuXG4gICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgQ29tbWVudCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gV2UgY2FuIG9ubHkgaW5mZXIgdGhlIHRyaWdnZXIgaWYgdGhlcmUncyBvbmUgcm9vdCBlbGVtZW50IG5vZGUuIEFueSBvdGhlclxuICAgICAgICAgIC8vIG5vZGVzIGF0IHRoZSByb290IG1ha2UgaXQgc28gdGhhdCB3ZSBjYW4ndCBpbmZlciB0aGUgdHJpZ2dlciBhbnltb3JlLlxuICAgICAgICAgIGlmICh0cmlnZ2VyICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICAgICAgICB0cmlnZ2VyID0gY2hpbGQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cmlnZ2VyO1xuICAgIH1cblxuICAgIGNvbnN0IG91dHNpZGVSZWYgPSB0aGlzLmZpbmRFbnRpdHlJblNjb3BlKGJsb2NrLCBuYW1lKTtcblxuICAgIC8vIEZpcnN0IHRyeSB0byByZXNvbHZlIHRoZSB0YXJnZXQgaW4gdGhlIHNjb3BlIG9mIHRoZSBtYWluIGRlZmVycmVkIGJsb2NrLiBOb3RlIHRoYXQgd2VcbiAgICAvLyBza2lwIHRyaWdnZXJzIGRlZmluZWQgaW5zaWRlIHRoZSBtYWluIGJsb2NrIGl0c2VsZiwgYmVjYXVzZSB0aGV5IG1pZ2h0IG5vdCBleGlzdCB5ZXQuXG4gICAgaWYgKG91dHNpZGVSZWYgaW5zdGFuY2VvZiBSZWZlcmVuY2UgJiYgdGhpcy5nZXREZWZpbml0aW9uTm9kZU9mU3ltYm9sKG91dHNpZGVSZWYpICE9PSBibG9jaykge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5nZXRSZWZlcmVuY2VUYXJnZXQob3V0c2lkZVJlZik7XG5cbiAgICAgIGlmICh0YXJnZXQgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHRyaWdnZXIgY291bGRuJ3QgYmUgZm91bmQgaW4gdGhlIG1haW4gYmxvY2ssIGNoZWNrIHRoZVxuICAgIC8vIHBsYWNlaG9sZGVyIGJsb2NrIHdoaWNoIGlzIHNob3duIGJlZm9yZSB0aGUgbWFpbiBibG9jayBoYXMgbG9hZGVkLlxuICAgIGlmIChibG9jay5wbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcmVmSW5QbGFjZWhvbGRlciA9IHRoaXMuZmluZEVudGl0eUluU2NvcGUoYmxvY2sucGxhY2Vob2xkZXIsIG5hbWUpO1xuICAgICAgY29uc3QgdGFyZ2V0SW5QbGFjZWhvbGRlciA9XG4gICAgICAgIHJlZkluUGxhY2Vob2xkZXIgaW5zdGFuY2VvZiBSZWZlcmVuY2UgPyB0aGlzLmdldFJlZmVyZW5jZVRhcmdldChyZWZJblBsYWNlaG9sZGVyKSA6IG51bGw7XG5cbiAgICAgIGlmICh0YXJnZXRJblBsYWNlaG9sZGVyICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZVRhcmdldFRvRWxlbWVudCh0YXJnZXRJblBsYWNlaG9sZGVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGlzRGVmZXJyZWQoZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgdGhpcy5kZWZlcnJlZEJsb2Nrcykge1xuICAgICAgaWYgKCF0aGlzLmRlZmVycmVkU2NvcGVzLmhhcyhibG9jaykpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0YWNrOiBTY29wZVtdID0gW3RoaXMuZGVmZXJyZWRTY29wZXMuZ2V0KGJsb2NrKSFdO1xuXG4gICAgICB3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gc3RhY2sucG9wKCkhO1xuXG4gICAgICAgIGlmIChjdXJyZW50LmVsZW1lbnRzSW5TY29wZS5oYXMoZWxlbWVudCkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YWNrLnB1c2goLi4uY3VycmVudC5jaGlsZFNjb3Blcy52YWx1ZXMoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIGFuIGVudGl0eSB3aXRoIGEgc3BlY2lmaWMgbmFtZSBpbiBhIHNjb3BlLlxuICAgKiBAcGFyYW0gcm9vdE5vZGUgUm9vdCBub2RlIG9mIHRoZSBzY29wZS5cbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZW50aXR5LlxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kRW50aXR5SW5TY29wZShyb290Tm9kZTogU2NvcGVkTm9kZSwgbmFtZTogc3RyaW5nKTogUmVmZXJlbmNlIHwgVmFyaWFibGUgfCBudWxsIHtcbiAgICBjb25zdCBlbnRpdGllcyA9IHRoaXMuZ2V0RW50aXRpZXNJblNjb3BlKHJvb3ROb2RlKTtcblxuICAgIGZvciAoY29uc3QgZW50aXR5IG9mIGVudGl0aWVzKSB7XG4gICAgICBpZiAoZW50aXR5Lm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGVudGl0eTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBDb2VyY2VzIGEgYFJlZmVyZW5jZVRhcmdldGAgdG8gYW4gYEVsZW1lbnRgLCBpZiBwb3NzaWJsZS4gKi9cbiAgcHJpdmF0ZSByZWZlcmVuY2VUYXJnZXRUb0VsZW1lbnQodGFyZ2V0OiBSZWZlcmVuY2VUYXJnZXQ8RGlyZWN0aXZlVD4pOiBFbGVtZW50IHwgbnVsbCB7XG4gICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZWZlcmVuY2VUYXJnZXRUb0VsZW1lbnQodGFyZ2V0Lm5vZGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RTY29wZWROb2RlRW50aXRpZXMoXG4gIHJvb3RTY29wZTogU2NvcGUsXG4pOiBNYXA8U2NvcGVkTm9kZSB8IG51bGwsIFNldDxSZWZlcmVuY2UgfCBWYXJpYWJsZT4+IHtcbiAgY29uc3QgZW50aXR5TWFwID0gbmV3IE1hcDxTY29wZWROb2RlIHwgbnVsbCwgTWFwPHN0cmluZywgUmVmZXJlbmNlIHwgVmFyaWFibGU+PigpO1xuXG4gIGZ1bmN0aW9uIGV4dHJhY3RTY29wZUVudGl0aWVzKHNjb3BlOiBTY29wZSk6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZSB8IFZhcmlhYmxlPiB7XG4gICAgaWYgKGVudGl0eU1hcC5oYXMoc2NvcGUucm9vdE5vZGUpKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwLmdldChzY29wZS5yb290Tm9kZSkhO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRFbnRpdGllcyA9IHNjb3BlLm5hbWVkRW50aXRpZXM7XG5cbiAgICBsZXQgZW50aXRpZXM6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZSB8IFZhcmlhYmxlPjtcbiAgICBpZiAoc2NvcGUucGFyZW50U2NvcGUgIT09IG51bGwpIHtcbiAgICAgIGVudGl0aWVzID0gbmV3IE1hcChbLi4uZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGUucGFyZW50U2NvcGUpLCAuLi5jdXJyZW50RW50aXRpZXNdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50aXRpZXMgPSBuZXcgTWFwKGN1cnJlbnRFbnRpdGllcyk7XG4gICAgfVxuXG4gICAgZW50aXR5TWFwLnNldChzY29wZS5yb290Tm9kZSwgZW50aXRpZXMpO1xuICAgIHJldHVybiBlbnRpdGllcztcbiAgfVxuXG4gIGNvbnN0IHNjb3Blc1RvUHJvY2VzczogU2NvcGVbXSA9IFtyb290U2NvcGVdO1xuICB3aGlsZSAoc2NvcGVzVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzY29wZSA9IHNjb3Blc1RvUHJvY2Vzcy5wb3AoKSE7XG4gICAgZm9yIChjb25zdCBjaGlsZFNjb3BlIG9mIHNjb3BlLmNoaWxkU2NvcGVzLnZhbHVlcygpKSB7XG4gICAgICBzY29wZXNUb1Byb2Nlc3MucHVzaChjaGlsZFNjb3BlKTtcbiAgICB9XG4gICAgZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGUpO1xuICB9XG5cbiAgY29uc3QgdGVtcGxhdGVFbnRpdGllcyA9IG5ldyBNYXA8U2NvcGVkTm9kZSB8IG51bGwsIFNldDxSZWZlcmVuY2UgfCBWYXJpYWJsZT4+KCk7XG4gIGZvciAoY29uc3QgW3RlbXBsYXRlLCBlbnRpdGllc10gb2YgZW50aXR5TWFwKSB7XG4gICAgdGVtcGxhdGVFbnRpdGllcy5zZXQodGVtcGxhdGUsIG5ldyBTZXQoZW50aXRpZXMudmFsdWVzKCkpKTtcbiAgfVxuICByZXR1cm4gdGVtcGxhdGVFbnRpdGllcztcbn1cbiJdfQ==