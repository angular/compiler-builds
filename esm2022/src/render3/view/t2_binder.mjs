/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ImplicitReceiver, RecursiveAstVisitor } from '../../expression_parser/ast';
import { BoundDeferredTrigger, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, Element, ForLoopBlock, ForLoopBlockEmpty, HoverDeferredTrigger, IfBlockBranch, InteractionDeferredTrigger, Reference, SwitchBlockCase, Template, ViewportDeferredTrigger } from '../r3_ast';
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
            Object.values(nodeOrNodes.contextVariables).forEach(v => this.visitVariable(v));
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
        block.item.visit(this);
        Object.values(block.contextVariables).forEach(v => v.visit(this));
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
        const deferBlocks = new Set();
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
            Object.values(nodeOrNodes.contextVariables).forEach(v => this.visitNode(v));
            nodeOrNodes.trackBy.visit(this);
            nodeOrNodes.children.forEach(this.visitNode);
            this.nestingLevel.set(nodeOrNodes, this.level);
        }
        else if (nodeOrNodes instanceof SwitchBlockCase || nodeOrNodes instanceof ForLoopBlockEmpty ||
            nodeOrNodes instanceof DeferredBlock || nodeOrNodes instanceof DeferredBlockError ||
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
        this.ingestScopedNode(deferred);
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
    constructor(target, directives, eagerDirectives, bindings, references, exprTargets, symbols, nestingLevel, scopedNodeEntities, usedPipes, eagerPipes, deferredBlocks) {
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
        this.deferredBlocks = deferredBlocks;
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
        return Array.from(this.deferredBlocks);
    }
    getDeferredTriggerTarget(block, trigger) {
        // Only triggers that refer to DOM nodes can be resolved.
        if (!(trigger instanceof InteractionDeferredTrigger) &&
            !(trigger instanceof ViewportDeferredTrigger) &&
            !(trigger instanceof HoverDeferredTrigger)) {
            return null;
        }
        const name = trigger.reference;
        // TODO(crisbeto): account for `viewport` trigger without a `reference`.
        if (name === null) {
            return null;
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
        // placeholder  block which is shown before the main block has loaded.
        if (block.placeholder !== null) {
            const refInPlaceholder = this.findEntityInScope(block.placeholder, name);
            const targetInPlaceholder = refInPlaceholder instanceof Reference ? this.getReferenceTarget(refInPlaceholder) : null;
            if (targetInPlaceholder !== null) {
                return this.referenceTargetToElement(targetInPlaceholder);
            }
        }
        return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBZSxnQkFBZ0IsRUFBK0IsbUJBQW1CLEVBQW1CLE1BQU0sNkJBQTZCLENBQUM7QUFFbkosT0FBTyxFQUFpQixvQkFBb0IsRUFBa0MsYUFBYSxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLHdCQUF3QixFQUFtQixPQUFPLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFnQixhQUFhLEVBQUUsMEJBQTBCLEVBQVEsU0FBUyxFQUFlLGVBQWUsRUFBRSxRQUFRLEVBQWlDLHVCQUF1QixFQUFVLE1BQU0sV0FBVyxDQUFDO0FBR3RiLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUM3QyxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFcEQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBQ3pCLFlBQW9CLGdCQUErQztRQUEvQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQStCO0lBQUcsQ0FBQztJQUV2RTs7O09BR0c7SUFDSCxJQUFJLENBQUMsTUFBYztRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUNwQiw0RUFBNEU7WUFDNUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1NBQ2pFO1FBRUQsNEZBQTRGO1FBQzVGLGlFQUFpRTtRQUNqRSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUzQyxrRkFBa0Y7UUFDbEYsTUFBTSxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQyxLQUFL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Q0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNULCBCaW5kaW5nUGlwZSwgSW1wbGljaXRSZWNlaXZlciwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7Qm91bmRBdHRyaWJ1dGUsIEJvdW5kRGVmZXJyZWRUcmlnZ2VyLCBCb3VuZEV2ZW50LCBCb3VuZFRleHQsIENvbnRlbnQsIERlZmVycmVkQmxvY2ssIERlZmVycmVkQmxvY2tFcnJvciwgRGVmZXJyZWRCbG9ja0xvYWRpbmcsIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciwgRGVmZXJyZWRUcmlnZ2VyLCBFbGVtZW50LCBGb3JMb29wQmxvY2ssIEZvckxvb3BCbG9ja0VtcHR5LCBIb3ZlckRlZmVycmVkVHJpZ2dlciwgSWN1LCBJZkJsb2NrLCBJZkJsb2NrQnJhbmNoLCBJbnRlcmFjdGlvbkRlZmVycmVkVHJpZ2dlciwgTm9kZSwgUmVmZXJlbmNlLCBTd2l0Y2hCbG9jaywgU3dpdGNoQmxvY2tDYXNlLCBUZW1wbGF0ZSwgVGV4dCwgVGV4dEF0dHJpYnV0ZSwgVmFyaWFibGUsIFZpZXdwb3J0RGVmZXJyZWRUcmlnZ2VyLCBWaXNpdG9yfSBmcm9tICcuLi9yM19hc3QnO1xuXG5pbXBvcnQge0JvdW5kVGFyZ2V0LCBEaXJlY3RpdmVNZXRhLCBSZWZlcmVuY2VUYXJnZXQsIFNjb3BlZE5vZGUsIFRhcmdldCwgVGFyZ2V0QmluZGVyfSBmcm9tICcuL3QyX2FwaSc7XG5pbXBvcnQge2NyZWF0ZUNzc1NlbGVjdG9yfSBmcm9tICcuL3RlbXBsYXRlJztcbmltcG9ydCB7Z2V0QXR0cnNGb3JEaXJlY3RpdmVNYXRjaGluZ30gZnJvbSAnLi91dGlsJztcblxuLyoqXG4gKiBQcm9jZXNzZXMgYFRhcmdldGBzIHdpdGggYSBnaXZlbiBzZXQgb2YgZGlyZWN0aXZlcyBhbmQgcGVyZm9ybXMgYSBiaW5kaW5nIG9wZXJhdGlvbiwgd2hpY2hcbiAqIHJldHVybnMgYW4gb2JqZWN0IHNpbWlsYXIgdG8gVHlwZVNjcmlwdCdzIGB0cy5UeXBlQ2hlY2tlcmAgdGhhdCBjb250YWlucyBrbm93bGVkZ2UgYWJvdXQgdGhlXG4gKiB0YXJnZXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBSM1RhcmdldEJpbmRlcjxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBUYXJnZXRCaW5kZXI8RGlyZWN0aXZlVD4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGRpcmVjdGl2ZU1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUW10+KSB7fVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtIGEgYmluZGluZyBvcGVyYXRpb24gb24gdGhlIGdpdmVuIGBUYXJnZXRgIGFuZCByZXR1cm4gYSBgQm91bmRUYXJnZXRgIHdoaWNoIGNvbnRhaW5zXG4gICAqIG1ldGFkYXRhIGFib3V0IHRoZSB0eXBlcyByZWZlcmVuY2VkIGluIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIGJpbmQodGFyZ2V0OiBUYXJnZXQpOiBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gICAgaWYgKCF0YXJnZXQudGVtcGxhdGUpIHtcbiAgICAgIC8vIFRPRE8oYWx4aHViKTogaGFuZGxlIHRhcmdldHMgd2hpY2ggY29udGFpbiB0aGluZ3MgbGlrZSBIb3N0QmluZGluZ3MsIGV0Yy5cbiAgICAgIHRocm93IG5ldyBFcnJvcignQmluZGluZyB3aXRob3V0IGEgdGVtcGxhdGUgbm90IHlldCBzdXBwb3J0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCwgcGFyc2UgdGhlIHRlbXBsYXRlIGludG8gYSBgU2NvcGVgIHN0cnVjdHVyZS4gVGhpcyBvcGVyYXRpb24gY2FwdHVyZXMgdGhlIHN5bnRhY3RpY1xuICAgIC8vIHNjb3BlcyBpbiB0aGUgdGVtcGxhdGUgYW5kIG1ha2VzIHRoZW0gYXZhaWxhYmxlIGZvciBsYXRlciB1c2UuXG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5hcHBseSh0YXJnZXQudGVtcGxhdGUpO1xuXG4gICAgLy8gVXNlIHRoZSBgU2NvcGVgIHRvIGV4dHJhY3QgdGhlIGVudGl0aWVzIHByZXNlbnQgYXQgZXZlcnkgbGV2ZWwgb2YgdGhlIHRlbXBsYXRlLlxuICAgIGNvbnN0IHNjb3BlZE5vZGVFbnRpdGllcyA9IGV4dHJhY3RTY29wZWROb2RlRW50aXRpZXMoc2NvcGUpO1xuXG4gICAgLy8gTmV4dCwgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgb24gdGhlIHRlbXBsYXRlIHVzaW5nIHRoZSBgRGlyZWN0aXZlQmluZGVyYC4gVGhpcyByZXR1cm5zOlxuICAgIC8vICAgLSBkaXJlY3RpdmVzOiBNYXAgb2Ygbm9kZXMgKGVsZW1lbnRzICYgbmctdGVtcGxhdGVzKSB0byB0aGUgZGlyZWN0aXZlcyBvbiB0aGVtLlxuICAgIC8vICAgLSBiaW5kaW5nczogTWFwIG9mIGlucHV0cywgb3V0cHV0cywgYW5kIGF0dHJpYnV0ZXMgdG8gdGhlIGRpcmVjdGl2ZS9lbGVtZW50IHRoYXQgY2xhaW1zXG4gICAgLy8gICAgIHRoZW0uIFRPRE8oYWx4aHViKTogaGFuZGxlIG11bHRpcGxlIGRpcmVjdGl2ZXMgY2xhaW1pbmcgYW4gaW5wdXQvb3V0cHV0L2V0Yy5cbiAgICAvLyAgIC0gcmVmZXJlbmNlczogTWFwIG9mICNyZWZlcmVuY2VzIHRvIHRoZWlyIHRhcmdldHMuXG4gICAgY29uc3Qge2RpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9ID1cbiAgICAgICAgRGlyZWN0aXZlQmluZGVyLmFwcGx5KHRhcmdldC50ZW1wbGF0ZSwgdGhpcy5kaXJlY3RpdmVNYXRjaGVyKTtcbiAgICAvLyBGaW5hbGx5LCBydW4gdGhlIFRlbXBsYXRlQmluZGVyIHRvIGJpbmQgcmVmZXJlbmNlcywgdmFyaWFibGVzLCBhbmQgb3RoZXIgZW50aXRpZXMgd2l0aGluIHRoZVxuICAgIC8vIHRlbXBsYXRlLiBUaGlzIGV4dHJhY3RzIGFsbCB0aGUgbWV0YWRhdGEgdGhhdCBkb2Vzbid0IGRlcGVuZCBvbiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgY29uc3Qge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3N9ID1cbiAgICAgICAgVGVtcGxhdGVCaW5kZXIuYXBwbHlXaXRoU2NvcGUodGFyZ2V0LnRlbXBsYXRlLCBzY29wZSk7XG4gICAgcmV0dXJuIG5ldyBSM0JvdW5kVGFyZ2V0KFxuICAgICAgICB0YXJnZXQsIGRpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXMsIGV4cHJlc3Npb25zLCBzeW1ib2xzLFxuICAgICAgICBuZXN0aW5nTGV2ZWwsIHNjb3BlZE5vZGVFbnRpdGllcywgdXNlZFBpcGVzLCBlYWdlclBpcGVzLCBkZWZlckJsb2Nrcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgYmluZGluZyBzY29wZSB3aXRoaW4gYSB0ZW1wbGF0ZS5cbiAqXG4gKiBBbnkgdmFyaWFibGVzLCByZWZlcmVuY2VzLCBvciBvdGhlciBuYW1lZCBlbnRpdGllcyBkZWNsYXJlZCB3aXRoaW4gdGhlIHRlbXBsYXRlIHdpbGxcbiAqIGJlIGNhcHR1cmVkIGFuZCBhdmFpbGFibGUgYnkgbmFtZSBpbiBgbmFtZWRFbnRpdGllc2AuIEFkZGl0aW9uYWxseSwgY2hpbGQgdGVtcGxhdGVzIHdpbGxcbiAqIGJlIGFuYWx5emVkIGFuZCBoYXZlIHRoZWlyIGNoaWxkIGBTY29wZWBzIGF2YWlsYWJsZSBpbiBgY2hpbGRTY29wZXNgLlxuICovXG5jbGFzcyBTY29wZSBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvKipcbiAgICogTmFtZWQgbWVtYmVycyBvZiB0aGUgYFNjb3BlYCwgc3VjaCBhcyBgUmVmZXJlbmNlYHMgb3IgYFZhcmlhYmxlYHMuXG4gICAqL1xuICByZWFkb25seSBuYW1lZEVudGl0aWVzID0gbmV3IE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4oKTtcblxuICAvKipcbiAgICogQ2hpbGQgYFNjb3BlYHMgZm9yIGltbWVkaWF0ZWx5IG5lc3RlZCBgU2NvcGVkTm9kZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgY2hpbGRTY29wZXMgPSBuZXcgTWFwPFNjb3BlZE5vZGUsIFNjb3BlPigpO1xuXG4gIC8qKiBXaGV0aGVyIHRoaXMgc2NvcGUgaXMgZGVmZXJyZWQgb3IgaWYgYW55IG9mIGl0cyBhbmNlc3RvcnMgYXJlIGRlZmVycmVkLiAqL1xuICByZWFkb25seSBpc0RlZmVycmVkOiBib29sZWFuO1xuXG4gIHByaXZhdGUgY29uc3RydWN0b3IocmVhZG9ubHkgcGFyZW50U2NvcGU6IFNjb3BlfG51bGwsIHJlYWRvbmx5IHJvb3ROb2RlOiBTY29wZWROb2RlfG51bGwpIHtcbiAgICB0aGlzLmlzRGVmZXJyZWQgPVxuICAgICAgICBwYXJlbnRTY29wZSAhPT0gbnVsbCAmJiBwYXJlbnRTY29wZS5pc0RlZmVycmVkID8gdHJ1ZSA6IHJvb3ROb2RlIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9jaztcbiAgfVxuXG4gIHN0YXRpYyBuZXdSb290U2NvcGUoKTogU2NvcGUge1xuICAgIHJldHVybiBuZXcgU2NvcGUobnVsbCwgbnVsbCk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChlaXRoZXIgYXMgYSBgVGVtcGxhdGVgIHN1Yi10ZW1wbGF0ZSB3aXRoIHZhcmlhYmxlcywgb3IgYSBwbGFpbiBhcnJheSBvZlxuICAgKiB0ZW1wbGF0ZSBgTm9kZWBzKSBhbmQgY29uc3RydWN0IGl0cyBgU2NvcGVgLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5KHRlbXBsYXRlOiBOb2RlW10pOiBTY29wZSB7XG4gICAgY29uc3Qgc2NvcGUgPSBTY29wZS5uZXdSb290U2NvcGUoKTtcbiAgICBzY29wZS5pbmdlc3QodGVtcGxhdGUpO1xuICAgIHJldHVybiBzY29wZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBtZXRob2QgdG8gcHJvY2VzcyB0aGUgc2NvcGVkIG5vZGUgYW5kIHBvcHVsYXRlIHRoZSBgU2NvcGVgLlxuICAgKi9cbiAgcHJpdmF0ZSBpbmdlc3Qobm9kZU9yTm9kZXM6IFNjb3BlZE5vZGV8Tm9kZVtdKTogdm9pZCB7XG4gICAgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIC8vIFZhcmlhYmxlcyBvbiBhbiA8bmctdGVtcGxhdGU+IGFyZSBkZWZpbmVkIGluIHRoZSBpbm5lciBzY29wZS5cbiAgICAgIG5vZGVPck5vZGVzLnZhcmlhYmxlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFZhcmlhYmxlKG5vZGUpKTtcblxuICAgICAgLy8gUHJvY2VzcyB0aGUgbm9kZXMgb2YgdGhlIHRlbXBsYXRlLlxuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgICBpZiAobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudmlzaXRWYXJpYWJsZShub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMpO1xuICAgICAgfVxuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBGb3JMb29wQmxvY2spIHtcbiAgICAgIHRoaXMudmlzaXRWYXJpYWJsZShub2RlT3JOb2Rlcy5pdGVtKTtcbiAgICAgIE9iamVjdC52YWx1ZXMobm9kZU9yTm9kZXMuY29udGV4dFZhcmlhYmxlcykuZm9yRWFjaCh2ID0+IHRoaXMudmlzaXRWYXJpYWJsZSh2KSk7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBTd2l0Y2hCbG9ja0Nhc2UgfHwgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBGb3JMb29wQmxvY2tFbXB0eSB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2sgfHwgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrRXJyb3IgfHxcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIgfHxcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrTG9hZGluZykge1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBObyBvdmVyYXJjaGluZyBgVGVtcGxhdGVgIGluc3RhbmNlLCBzbyBwcm9jZXNzIHRoZSBub2RlcyBkaXJlY3RseS5cbiAgICAgIG5vZGVPck5vZGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCkge1xuICAgIC8vIGBFbGVtZW50YHMgaW4gdGhlIHRlbXBsYXRlIG1heSBoYXZlIGBSZWZlcmVuY2VgcyB3aGljaCBhcmUgY2FwdHVyZWQgaW4gdGhlIHNjb3BlLlxuICAgIGVsZW1lbnQucmVmZXJlbmNlcy5mb3JFYWNoKG5vZGUgPT4gdGhpcy52aXNpdFJlZmVyZW5jZShub2RlKSk7XG5cbiAgICAvLyBSZWN1cnNlIGludG8gdGhlIGBFbGVtZW50YCdzIGNoaWxkcmVuLlxuICAgIGVsZW1lbnQuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICAvLyBSZWZlcmVuY2VzIG9uIGEgPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgb3V0ZXIgc2NvcGUsIHNvIGNhcHR1cmUgdGhlbSBiZWZvcmVcbiAgICAvLyBwcm9jZXNzaW5nIHRoZSB0ZW1wbGF0ZSdzIGNoaWxkIHNjb3BlLlxuICAgIHRlbXBsYXRlLnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgY3JlYXRlIGFuIGlubmVyIHNjb3BlIGFuZCBwcm9jZXNzIHRoZSB0ZW1wbGF0ZSB3aXRoaW4gaXQuXG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKHRlbXBsYXRlKTtcbiAgfVxuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKSB7XG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUgaWYgaXQncyBub3QgYWxyZWFkeS5cbiAgICB0aGlzLm1heWJlRGVjbGFyZSh2YXJpYWJsZSk7XG4gIH1cblxuICB2aXNpdFJlZmVyZW5jZShyZWZlcmVuY2U6IFJlZmVyZW5jZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUocmVmZXJlbmNlKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jaykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShkZWZlcnJlZCk7XG4gICAgZGVmZXJyZWQucGxhY2Vob2xkZXI/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmxvYWRpbmc/LnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLmVycm9yPy52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKGJsb2NrOiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrKGJsb2NrOiBTd2l0Y2hCbG9jaykge1xuICAgIGJsb2NrLmNhc2VzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gICAgYmxvY2suZW1wdHk/LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2tFbXB0eShibG9jazogRm9yTG9vcEJsb2NrRW1wdHkpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKSB7XG4gICAgYmxvY2suYnJhbmNoZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIC8vIFVudXNlZCB2aXNpdG9ycy5cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cjogQm91bmRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0Qm91bmRFdmVudChldmVudDogQm91bmRFdmVudCkge31cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KSB7fVxuICB2aXNpdFRleHQodGV4dDogVGV4dCkge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHI6IFRleHRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KSB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpIHt9XG5cbiAgcHJpdmF0ZSBtYXliZURlY2xhcmUodGhpbmc6IFJlZmVyZW5jZXxWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgc29tZXRoaW5nIHdpdGggYSBuYW1lLCBhcyBsb25nIGFzIHRoYXQgbmFtZSBpc24ndCB0YWtlbi5cbiAgICBpZiAoIXRoaXMubmFtZWRFbnRpdGllcy5oYXModGhpbmcubmFtZSkpIHtcbiAgICAgIHRoaXMubmFtZWRFbnRpdGllcy5zZXQodGhpbmcubmFtZSwgdGhpbmcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMb29rIHVwIGEgdmFyaWFibGUgd2l0aGluIHRoaXMgYFNjb3BlYC5cbiAgICpcbiAgICogVGhpcyBjYW4gcmVjdXJzZSBpbnRvIGEgcGFyZW50IGBTY29wZWAgaWYgaXQncyBhdmFpbGFibGUuXG4gICAqL1xuICBsb29rdXAobmFtZTogc3RyaW5nKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIGlmICh0aGlzLm5hbWVkRW50aXRpZXMuaGFzKG5hbWUpKSB7XG4gICAgICAvLyBGb3VuZCBpbiB0aGUgbG9jYWwgc2NvcGUuXG4gICAgICByZXR1cm4gdGhpcy5uYW1lZEVudGl0aWVzLmdldChuYW1lKSE7XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFNjb3BlICE9PSBudWxsKSB7XG4gICAgICAvLyBOb3QgaW4gdGhlIGxvY2FsIHNjb3BlLCBidXQgdGhlcmUncyBhIHBhcmVudCBzY29wZSBzbyBjaGVjayB0aGVyZS5cbiAgICAgIHJldHVybiB0aGlzLnBhcmVudFNjb3BlLmxvb2t1cChuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQXQgdGhlIHRvcCBsZXZlbCBhbmQgaXQgd2Fzbid0IGZvdW5kLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2hpbGQgc2NvcGUgZm9yIGEgYFNjb3BlZE5vZGVgLlxuICAgKlxuICAgKiBUaGlzIHNob3VsZCBhbHdheXMgYmUgZGVmaW5lZC5cbiAgICovXG4gIGdldENoaWxkU2NvcGUobm9kZTogU2NvcGVkTm9kZSk6IFNjb3BlIHtcbiAgICBjb25zdCByZXMgPSB0aGlzLmNoaWxkU2NvcGVzLmdldChub2RlKTtcbiAgICBpZiAocmVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXJ0aW9uIGVycm9yOiBjaGlsZCBzY29wZSBmb3IgJHtub2RlfSBub3QgZm91bmRgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0U2NvcGVkTm9kZShub2RlOiBTY29wZWROb2RlKSB7XG4gICAgY29uc3Qgc2NvcGUgPSBuZXcgU2NvcGUodGhpcywgbm9kZSk7XG4gICAgc2NvcGUuaW5nZXN0KG5vZGUpO1xuICAgIHRoaXMuY2hpbGRTY29wZXMuc2V0KG5vZGUsIHNjb3BlKTtcbiAgfVxufVxuXG4vKipcbiAqIFByb2Nlc3NlcyBhIHRlbXBsYXRlIGFuZCBtYXRjaGVzIGRpcmVjdGl2ZXMgb24gbm9kZXMgKGVsZW1lbnRzIGFuZCB0ZW1wbGF0ZXMpLlxuICpcbiAqIFVzdWFsbHkgdXNlZCB2aWEgdGhlIHN0YXRpYyBgYXBwbHkoKWAgbWV0aG9kLlxuICovXG5jbGFzcyBEaXJlY3RpdmVCaW5kZXI8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgVmlzaXRvciB7XG4gIC8vIEluZGljYXRlcyB3aGV0aGVyIHdlIGFyZSB2aXNpdGluZyBlbGVtZW50cyB3aXRoaW4gYSBgZGVmZXJgIGJsb2NrXG4gIHByaXZhdGUgaXNJbkRlZmVyQmxvY2sgPSBmYWxzZTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBtYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPixcbiAgICAgIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50fFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPikge31cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHRlbXBsYXRlIChsaXN0IG9mIGBOb2RlYHMpIGFuZCBwZXJmb3JtIGRpcmVjdGl2ZSBtYXRjaGluZyBhZ2FpbnN0IGVhY2ggbm9kZS5cbiAgICpcbiAgICogQHBhcmFtIHRlbXBsYXRlIHRoZSBsaXN0IG9mIHRlbXBsYXRlIGBOb2RlYHMgdG8gbWF0Y2ggKHJlY3Vyc2l2ZWx5KS5cbiAgICogQHBhcmFtIHNlbGVjdG9yTWF0Y2hlciBhIGBTZWxlY3Rvck1hdGNoZXJgIGNvbnRhaW5pbmcgdGhlIGRpcmVjdGl2ZXMgdGhhdCBhcmUgaW4gc2NvcGUgZm9yXG4gICAqIHRoaXMgdGVtcGxhdGUuXG4gICAqIEByZXR1cm5zIHRocmVlIG1hcHMgd2hpY2ggY29udGFpbiBpbmZvcm1hdGlvbiBhYm91dCBkaXJlY3RpdmVzIGluIHRoZSB0ZW1wbGF0ZTogdGhlXG4gICAqIGBkaXJlY3RpdmVzYCBtYXAgd2hpY2ggbGlzdHMgZGlyZWN0aXZlcyBtYXRjaGVkIG9uIGVhY2ggbm9kZSwgdGhlIGBiaW5kaW5nc2AgbWFwIHdoaWNoXG4gICAqIGluZGljYXRlcyB3aGljaCBkaXJlY3RpdmVzIGNsYWltZWQgd2hpY2ggYmluZGluZ3MgKGlucHV0cywgb3V0cHV0cywgZXRjKSwgYW5kIHRoZSBgcmVmZXJlbmNlc2BcbiAgICogbWFwIHdoaWNoIHJlc29sdmVzICNyZWZlcmVuY2VzIChgUmVmZXJlbmNlYHMpIHdpdGhpbiB0aGUgdGVtcGxhdGUgdG8gdGhlIG5hbWVkIGRpcmVjdGl2ZSBvclxuICAgKiB0ZW1wbGF0ZSBub2RlLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5PERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPihcbiAgICAgIHRlbXBsYXRlOiBOb2RlW10sIHNlbGVjdG9yTWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVRbXT4pOiB7XG4gICAgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10sXG4gICAgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgcmVmZXJlbmNlczogTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gIH0ge1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSBuZXcgTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4oKTtcbiAgICBjb25zdCBiaW5kaW5ncyA9XG4gICAgICAgIG5ldyBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgcmVmZXJlbmNlcyA9XG4gICAgICAgIG5ldyBNYXA8UmVmZXJlbmNlLCB7ZGlyZWN0aXZlOiBEaXJlY3RpdmVULCBub2RlOiBFbGVtZW50IHwgVGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+KCk7XG4gICAgY29uc3QgZWFnZXJEaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10gPSBbXTtcbiAgICBjb25zdCBtYXRjaGVyID1cbiAgICAgICAgbmV3IERpcmVjdGl2ZUJpbmRlcihzZWxlY3Rvck1hdGNoZXIsIGRpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXMpO1xuICAgIG1hdGNoZXIuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4ge2RpcmVjdGl2ZXMsIGVhZ2VyRGlyZWN0aXZlcywgYmluZGluZ3MsIHJlZmVyZW5jZXN9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3QodGVtcGxhdGU6IE5vZGVbXSk6IHZvaWQge1xuICAgIHRlbXBsYXRlLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgdGhpcy52aXNpdEVsZW1lbnRPclRlbXBsYXRlKGVsZW1lbnQubmFtZSwgZWxlbWVudCk7XG4gIH1cblxuICB2aXNpdFRlbXBsYXRlKHRlbXBsYXRlOiBUZW1wbGF0ZSk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZSgnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnRPclRlbXBsYXRlKGVsZW1lbnROYW1lOiBzdHJpbmcsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGUpOiB2b2lkIHtcbiAgICAvLyBGaXJzdCwgZGV0ZXJtaW5lIHRoZSBIVE1MIHNoYXBlIG9mIHRoZSBub2RlIGZvciB0aGUgcHVycG9zZSBvZiBkaXJlY3RpdmUgbWF0Y2hpbmcuXG4gICAgLy8gRG8gdGhpcyBieSBidWlsZGluZyB1cCBhIGBDc3NTZWxlY3RvcmAgZm9yIHRoZSBub2RlLlxuICAgIGNvbnN0IGNzc1NlbGVjdG9yID0gY3JlYXRlQ3NzU2VsZWN0b3IoZWxlbWVudE5hbWUsIGdldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmcobm9kZSkpO1xuXG4gICAgLy8gTmV4dCwgdXNlIHRoZSBgU2VsZWN0b3JNYXRjaGVyYCB0byBnZXQgdGhlIGxpc3Qgb2YgZGlyZWN0aXZlcyBvbiB0aGUgbm9kZS5cbiAgICBjb25zdCBkaXJlY3RpdmVzOiBEaXJlY3RpdmVUW10gPSBbXTtcbiAgICB0aGlzLm1hdGNoZXIubWF0Y2goY3NzU2VsZWN0b3IsIChfc2VsZWN0b3IsIHJlc3VsdHMpID0+IGRpcmVjdGl2ZXMucHVzaCguLi5yZXN1bHRzKSk7XG4gICAgaWYgKGRpcmVjdGl2ZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5kaXJlY3RpdmVzLnNldChub2RlLCBkaXJlY3RpdmVzKTtcbiAgICAgIGlmICghdGhpcy5pc0luRGVmZXJCbG9jaykge1xuICAgICAgICB0aGlzLmVhZ2VyRGlyZWN0aXZlcy5wdXNoKC4uLmRpcmVjdGl2ZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlc29sdmUgYW55IHJlZmVyZW5jZXMgdGhhdCBhcmUgY3JlYXRlZCBvbiB0aGlzIG5vZGUuXG4gICAgbm9kZS5yZWZlcmVuY2VzLmZvckVhY2gocmVmID0+IHtcbiAgICAgIGxldCBkaXJUYXJnZXQ6IERpcmVjdGl2ZVR8bnVsbCA9IG51bGw7XG5cbiAgICAgIC8vIElmIHRoZSByZWZlcmVuY2UgZXhwcmVzc2lvbiBpcyBlbXB0eSwgdGhlbiBpdCBtYXRjaGVzIHRoZSBcInByaW1hcnlcIiBkaXJlY3RpdmUgb24gdGhlIG5vZGVcbiAgICAgIC8vIChpZiB0aGVyZSBpcyBvbmUpLiBPdGhlcndpc2UgaXQgbWF0Y2hlcyB0aGUgaG9zdCBub2RlIGl0c2VsZiAoZWl0aGVyIGFuIGVsZW1lbnQgb3JcbiAgICAgIC8vIDxuZy10ZW1wbGF0ZT4gbm9kZSkuXG4gICAgICBpZiAocmVmLnZhbHVlLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgLy8gVGhpcyBjb3VsZCBiZSBhIHJlZmVyZW5jZSB0byBhIGNvbXBvbmVudCBpZiB0aGVyZSBpcyBvbmUuXG4gICAgICAgIGRpclRhcmdldCA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyLmlzQ29tcG9uZW50KSB8fCBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyBzaG91bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBkaXJlY3RpdmUgZXhwb3J0ZWQgdmlhIGV4cG9ydEFzLlxuICAgICAgICBkaXJUYXJnZXQgPVxuICAgICAgICAgICAgZGlyZWN0aXZlcy5maW5kKFxuICAgICAgICAgICAgICAgIGRpciA9PiBkaXIuZXhwb3J0QXMgIT09IG51bGwgJiYgZGlyLmV4cG9ydEFzLnNvbWUodmFsdWUgPT4gdmFsdWUgPT09IHJlZi52YWx1ZSkpIHx8XG4gICAgICAgICAgICBudWxsO1xuICAgICAgICAvLyBDaGVjayBpZiBhIG1hdGNoaW5nIGRpcmVjdGl2ZSB3YXMgZm91bmQuXG4gICAgICAgIGlmIChkaXJUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgICAvLyBObyBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kIC0gdGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIGFuIHVua25vd24gdGFyZ2V0LiBMZWF2ZSBpdFxuICAgICAgICAgIC8vIHVubWFwcGVkLlxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZGlyVGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhIGRpcmVjdGl2ZS5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIHtkaXJlY3RpdmU6IGRpclRhcmdldCwgbm9kZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhpcyByZWZlcmVuY2UgcG9pbnRzIHRvIHRoZSBub2RlIGl0c2VsZi5cbiAgICAgICAgdGhpcy5yZWZlcmVuY2VzLnNldChyZWYsIG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQXNzb2NpYXRlIGF0dHJpYnV0ZXMvYmluZGluZ3Mgb24gdGhlIG5vZGUgd2l0aCBkaXJlY3RpdmVzIG9yIHdpdGggdGhlIG5vZGUgaXRzZWxmLlxuICAgIHR5cGUgQm91bmROb2RlID0gQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlO1xuICAgIGNvbnN0IHNldEF0dHJpYnV0ZUJpbmRpbmcgPVxuICAgICAgICAoYXR0cmlidXRlOiBCb3VuZE5vZGUsIGlvVHlwZToga2V5b2YgUGljazxEaXJlY3RpdmVNZXRhLCAnaW5wdXRzJ3wnb3V0cHV0cyc+KSA9PiB7XG4gICAgICAgICAgY29uc3QgZGlyID0gZGlyZWN0aXZlcy5maW5kKGRpciA9PiBkaXJbaW9UeXBlXS5oYXNCaW5kaW5nUHJvcGVydHlOYW1lKGF0dHJpYnV0ZS5uYW1lKSk7XG4gICAgICAgICAgY29uc3QgYmluZGluZyA9IGRpciAhPT0gdW5kZWZpbmVkID8gZGlyIDogbm9kZTtcbiAgICAgICAgICB0aGlzLmJpbmRpbmdzLnNldChhdHRyaWJ1dGUsIGJpbmRpbmcpO1xuICAgICAgICB9O1xuXG4gICAgLy8gTm9kZSBpbnB1dHMgKGJvdW5kIGF0dHJpYnV0ZXMpIGFuZCB0ZXh0IGF0dHJpYnV0ZXMgY2FuIGJlIGJvdW5kIHRvIGFuXG4gICAgLy8gaW5wdXQgb24gYSBkaXJlY3RpdmUuXG4gICAgbm9kZS5pbnB1dHMuZm9yRWFjaChpbnB1dCA9PiBzZXRBdHRyaWJ1dGVCaW5kaW5nKGlucHV0LCAnaW5wdXRzJykpO1xuICAgIG5vZGUuYXR0cmlidXRlcy5mb3JFYWNoKGF0dHIgPT4gc2V0QXR0cmlidXRlQmluZGluZyhhdHRyLCAnaW5wdXRzJykpO1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIG5vZGUudGVtcGxhdGVBdHRycy5mb3JFYWNoKGF0dHIgPT4gc2V0QXR0cmlidXRlQmluZGluZyhhdHRyLCAnaW5wdXRzJykpO1xuICAgIH1cbiAgICAvLyBOb2RlIG91dHB1dHMgKGJvdW5kIGV2ZW50cykgY2FuIGJlIGJvdW5kIHRvIGFuIG91dHB1dCBvbiBhIGRpcmVjdGl2ZS5cbiAgICBub2RlLm91dHB1dHMuZm9yRWFjaChvdXRwdXQgPT4gc2V0QXR0cmlidXRlQmluZGluZyhvdXRwdXQsICdvdXRwdXRzJykpO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBub2RlJ3MgY2hpbGRyZW4uXG4gICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9jayhkZWZlcnJlZDogRGVmZXJyZWRCbG9jayk6IHZvaWQge1xuICAgIGNvbnN0IHdhc0luRGVmZXJCbG9jayA9IHRoaXMuaXNJbkRlZmVyQmxvY2s7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHRydWU7XG4gICAgZGVmZXJyZWQuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gICAgdGhpcy5pc0luRGVmZXJCbG9jayA9IHdhc0luRGVmZXJCbG9jaztcblxuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5lcnJvcj8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKTogdm9pZCB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKTogdm9pZCB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tMb2FkaW5nKGJsb2NrOiBEZWZlcnJlZEJsb2NrTG9hZGluZyk6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spIHtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIGJsb2NrLml0ZW0udmlzaXQodGhpcyk7XG4gICAgT2JqZWN0LnZhbHVlcyhibG9jay5jb250ZXh0VmFyaWFibGVzKS5mb3JFYWNoKHYgPT4gdi52aXNpdCh0aGlzKSk7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrKGJsb2NrOiBJZkJsb2NrKSB7XG4gICAgYmxvY2suYnJhbmNoZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRJZkJsb2NrQnJhbmNoKGJsb2NrOiBJZkJsb2NrQnJhbmNoKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbkFsaWFzPy52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICAvLyBVbnVzZWQgdmlzaXRvcnMuXG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KTogdm9pZCB7fVxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSk6IHZvaWQge31cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpOiB2b2lkIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEV2ZW50KGF0dHJpYnV0ZTogQm91bmRFdmVudCk6IHZvaWQge31cbiAgdmlzaXRCb3VuZEF0dHJpYnV0ZU9yRXZlbnQobm9kZTogQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudCkge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge31cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gKlxuICogVGhpcyBpcyBhIGNvbXBhbmlvbiB0byB0aGUgYERpcmVjdGl2ZUJpbmRlcmAgdGhhdCBkb2Vzbid0IHJlcXVpcmUga25vd2xlZGdlIG9mIGRpcmVjdGl2ZXMgbWF0Y2hlZFxuICogd2l0aGluIHRoZSB0ZW1wbGF0ZSBpbiBvcmRlciB0byBvcGVyYXRlLlxuICpcbiAqIEV4cHJlc3Npb25zIGFyZSB2aXNpdGVkIGJ5IHRoZSBzdXBlcmNsYXNzIGBSZWN1cnNpdmVBc3RWaXNpdG9yYCwgd2l0aCBjdXN0b20gbG9naWMgcHJvdmlkZWRcbiAqIGJ5IG92ZXJyaWRkZW4gbWV0aG9kcyBmcm9tIHRoYXQgdmlzaXRvci5cbiAqL1xuY2xhc3MgVGVtcGxhdGVCaW5kZXIgZXh0ZW5kcyBSZWN1cnNpdmVBc3RWaXNpdG9yIGltcGxlbWVudHMgVmlzaXRvciB7XG4gIHByaXZhdGUgdmlzaXROb2RlOiAobm9kZTogTm9kZSkgPT4gdm9pZDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICAgIHByaXZhdGUgc3ltYm9sczogTWFwPFJlZmVyZW5jZXxWYXJpYWJsZSwgU2NvcGVkTm9kZT4sIHByaXZhdGUgdXNlZFBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICAgIHByaXZhdGUgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sIHByaXZhdGUgZGVmZXJCbG9ja3M6IFNldDxEZWZlcnJlZEJsb2NrPixcbiAgICAgIHByaXZhdGUgbmVzdGluZ0xldmVsOiBNYXA8U2NvcGVkTm9kZSwgbnVtYmVyPiwgcHJpdmF0ZSBzY29wZTogU2NvcGUsXG4gICAgICBwcml2YXRlIHJvb3ROb2RlOiBTY29wZWROb2RlfG51bGwsIHByaXZhdGUgbGV2ZWw6IG51bWJlcikge1xuICAgIHN1cGVyKCk7XG5cbiAgICAvLyBTYXZlIGEgYml0IG9mIHByb2Nlc3NpbmcgdGltZSBieSBjb25zdHJ1Y3RpbmcgdGhpcyBjbG9zdXJlIGluIGFkdmFuY2UuXG4gICAgdGhpcy52aXNpdE5vZGUgPSAobm9kZTogTm9kZSkgPT4gbm9kZS52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIGRlZmluZWQgdG8gcmVjb25jaWxlIHRoZSB0eXBlIG9mIFRlbXBsYXRlQmluZGVyIHNpbmNlIGJvdGhcbiAgLy8gUmVjdXJzaXZlQXN0VmlzaXRvciBhbmQgVmlzaXRvciBkZWZpbmUgdGhlIHZpc2l0KCkgbWV0aG9kIGluIHRoZWlyXG4gIC8vIGludGVyZmFjZXMuXG4gIG92ZXJyaWRlIHZpc2l0KG5vZGU6IEFTVHxOb2RlLCBjb250ZXh0PzogYW55KSB7XG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBBU1QpIHtcbiAgICAgIG5vZGUudmlzaXQodGhpcywgY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGUudmlzaXQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSBhbmQgZXh0cmFjdCBtZXRhZGF0YSBhYm91dCBleHByZXNzaW9ucyBhbmQgc3ltYm9scyB3aXRoaW4uXG4gICAqXG4gICAqIEBwYXJhbSBub2RlcyB0aGUgbm9kZXMgb2YgdGhlIHRlbXBsYXRlIHRvIHByb2Nlc3NcbiAgICogQHBhcmFtIHNjb3BlIHRoZSBgU2NvcGVgIG9mIHRoZSB0ZW1wbGF0ZSBiZWluZyBwcm9jZXNzZWQuXG4gICAqIEByZXR1cm5zIHRocmVlIG1hcHMgd2hpY2ggY29udGFpbiBtZXRhZGF0YSBhYm91dCB0aGUgdGVtcGxhdGU6IGBleHByZXNzaW9uc2Agd2hpY2ggaW50ZXJwcmV0c1xuICAgKiBzcGVjaWFsIGBBU1RgIG5vZGVzIGluIGV4cHJlc3Npb25zIGFzIHBvaW50aW5nIHRvIHJlZmVyZW5jZXMgb3IgdmFyaWFibGVzIGRlY2xhcmVkIHdpdGhpbiB0aGVcbiAgICogdGVtcGxhdGUsIGBzeW1ib2xzYCB3aGljaCBtYXBzIHRob3NlIHZhcmlhYmxlcyBhbmQgcmVmZXJlbmNlcyB0byB0aGUgbmVzdGVkIGBUZW1wbGF0ZWAgd2hpY2hcbiAgICogZGVjbGFyZXMgdGhlbSwgaWYgYW55LCBhbmQgYG5lc3RpbmdMZXZlbGAgd2hpY2ggYXNzb2NpYXRlcyBlYWNoIGBUZW1wbGF0ZWAgd2l0aCBhIGludGVnZXJcbiAgICogbmVzdGluZyBsZXZlbCAoaG93IG1hbnkgbGV2ZWxzIGRlZXAgd2l0aGluIHRoZSB0ZW1wbGF0ZSBzdHJ1Y3R1cmUgdGhlIGBUZW1wbGF0ZWAgaXMpLCBzdGFydGluZ1xuICAgKiBhdCAxLlxuICAgKi9cbiAgc3RhdGljIGFwcGx5V2l0aFNjb3BlKG5vZGVzOiBOb2RlW10sIHNjb3BlOiBTY29wZSk6IHtcbiAgICBleHByZXNzaW9uczogTWFwPEFTVCwgUmVmZXJlbmNlfFZhcmlhYmxlPixcbiAgICBzeW1ib2xzOiBNYXA8VmFyaWFibGV8UmVmZXJlbmNlLCBUZW1wbGF0ZT4sXG4gICAgbmVzdGluZ0xldmVsOiBNYXA8U2NvcGVkTm9kZSwgbnVtYmVyPixcbiAgICB1c2VkUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgIGVhZ2VyUGlwZXM6IFNldDxzdHJpbmc+LFxuICAgIGRlZmVyQmxvY2tzOiBTZXQ8RGVmZXJyZWRCbG9jaz4sXG4gIH0ge1xuICAgIGNvbnN0IGV4cHJlc3Npb25zID0gbmV3IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4oKTtcbiAgICBjb25zdCBzeW1ib2xzID0gbmV3IE1hcDxWYXJpYWJsZXxSZWZlcmVuY2UsIFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IG5lc3RpbmdMZXZlbCA9IG5ldyBNYXA8U2NvcGVkTm9kZSwgbnVtYmVyPigpO1xuICAgIGNvbnN0IHVzZWRQaXBlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGVhZ2VyUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCB0ZW1wbGF0ZSA9IG5vZGVzIGluc3RhbmNlb2YgVGVtcGxhdGUgPyBub2RlcyA6IG51bGw7XG4gICAgY29uc3QgZGVmZXJCbG9ja3MgPSBuZXcgU2V0PERlZmVycmVkQmxvY2s+KCk7XG4gICAgLy8gVGhlIHRvcC1sZXZlbCB0ZW1wbGF0ZSBoYXMgbmVzdGluZyBsZXZlbCAwLlxuICAgIGNvbnN0IGJpbmRlciA9IG5ldyBUZW1wbGF0ZUJpbmRlcihcbiAgICAgICAgZXhwcmVzc2lvbnMsIHN5bWJvbHMsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3MsIG5lc3RpbmdMZXZlbCwgc2NvcGUsIHRlbXBsYXRlLCAwKTtcbiAgICBiaW5kZXIuaW5nZXN0KG5vZGVzKTtcbiAgICByZXR1cm4ge2V4cHJlc3Npb25zLCBzeW1ib2xzLCBuZXN0aW5nTGV2ZWwsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3N9O1xuICB9XG5cbiAgcHJpdmF0ZSBpbmdlc3Qobm9kZU9yTm9kZXM6IFNjb3BlZE5vZGV8Tm9kZVtdKTogdm9pZCB7XG4gICAgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgVGVtcGxhdGUpIHtcbiAgICAgIC8vIEZvciA8bmctdGVtcGxhdGU+cywgcHJvY2VzcyBvbmx5IHZhcmlhYmxlcyBhbmQgY2hpbGQgbm9kZXMuIElucHV0cywgb3V0cHV0cywgdGVtcGxhdGVBdHRycyxcbiAgICAgIC8vIGFuZCByZWZlcmVuY2VzIHdlcmUgYWxsIHByb2Nlc3NlZCBpbiB0aGUgc2NvcGUgb2YgdGhlIGNvbnRhaW5pbmcgdGVtcGxhdGUuXG4gICAgICBub2RlT3JOb2Rlcy52YXJpYWJsZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcblxuICAgICAgLy8gU2V0IHRoZSBuZXN0aW5nIGxldmVsLlxuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgSWZCbG9ja0JyYW5jaCkge1xuICAgICAgaWYgKG5vZGVPck5vZGVzLmV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnZpc2l0Tm9kZShub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMpO1xuICAgICAgfVxuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQobm9kZU9yTm9kZXMsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSBpZiAobm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBGb3JMb29wQmxvY2spIHtcbiAgICAgIHRoaXMudmlzaXROb2RlKG5vZGVPck5vZGVzLml0ZW0pO1xuICAgICAgT2JqZWN0LnZhbHVlcyhub2RlT3JOb2Rlcy5jb250ZXh0VmFyaWFibGVzKS5mb3JFYWNoKHYgPT4gdGhpcy52aXNpdE5vZGUodikpO1xuICAgICAgbm9kZU9yTm9kZXMudHJhY2tCeS52aXNpdCh0aGlzKTtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFN3aXRjaEJsb2NrQ2FzZSB8fCBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIEZvckxvb3BCbG9ja0VtcHR5IHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9jayB8fCBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tFcnJvciB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tQbGFjZWhvbGRlciB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2tMb2FkaW5nKSB7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgICB0aGlzLm5lc3RpbmdMZXZlbC5zZXQobm9kZU9yTm9kZXMsIHRoaXMubGV2ZWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBWaXNpdCBlYWNoIG5vZGUgZnJvbSB0aGUgdG9wLWxldmVsIHRlbXBsYXRlLlxuICAgICAgbm9kZU9yTm9kZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBWaXNpdCB0aGUgaW5wdXRzLCBvdXRwdXRzLCBhbmQgY2hpbGRyZW4gb2YgdGhlIGVsZW1lbnQuXG4gICAgZWxlbWVudC5pbnB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5vdXRwdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIGVsZW1lbnQuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgZWxlbWVudC5yZWZlcmVuY2VzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpIHtcbiAgICAvLyBGaXJzdCwgdmlzaXQgaW5wdXRzLCBvdXRwdXRzIGFuZCB0ZW1wbGF0ZSBhdHRyaWJ1dGVzIG9mIHRoZSB0ZW1wbGF0ZSBub2RlLlxuICAgIHRlbXBsYXRlLmlucHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS5vdXRwdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLnRlbXBsYXRlQXR0cnMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGVtcGxhdGUucmVmZXJlbmNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcblxuICAgIC8vIE5leHQsIHJlY3Vyc2UgaW50byB0aGUgdGVtcGxhdGUuXG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKHRlbXBsYXRlKTtcbiAgfVxuXG4gIHZpc2l0VmFyaWFibGUodmFyaWFibGU6IFZhcmlhYmxlKSB7XG4gICAgLy8gUmVnaXN0ZXIgdGhlIGBWYXJpYWJsZWAgYXMgYSBzeW1ib2wgaW4gdGhlIGN1cnJlbnQgYFRlbXBsYXRlYC5cbiAgICBpZiAodGhpcy5yb290Tm9kZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zeW1ib2xzLnNldCh2YXJpYWJsZSwgdGhpcy5yb290Tm9kZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpIHtcbiAgICAvLyBSZWdpc3RlciB0aGUgYFJlZmVyZW5jZWAgYXMgYSBzeW1ib2wgaW4gdGhlIGN1cnJlbnQgYFRlbXBsYXRlYC5cbiAgICBpZiAodGhpcy5yb290Tm9kZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zeW1ib2xzLnNldChyZWZlcmVuY2UsIHRoaXMucm9vdE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFVudXNlZCB0ZW1wbGF0ZSB2aXNpdG9yc1xuXG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KSB7fVxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCkge31cbiAgdmlzaXRUZXh0QXR0cmlidXRlKGF0dHJpYnV0ZTogVGV4dEF0dHJpYnV0ZSkge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyhpY3UudmFycykuZm9yRWFjaChrZXkgPT4gaWN1LnZhcnNba2V5XS52aXNpdCh0aGlzKSk7XG4gICAgT2JqZWN0LmtleXMoaWN1LnBsYWNlaG9sZGVycykuZm9yRWFjaChrZXkgPT4gaWN1LnBsYWNlaG9sZGVyc1trZXldLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFRoZSByZW1haW5pbmcgdmlzaXRvcnMgYXJlIGNvbmNlcm5lZCB3aXRoIHByb2Nlc3NpbmcgQVNUIGV4cHJlc3Npb25zIHdpdGhpbiB0ZW1wbGF0ZSBiaW5kaW5nc1xuXG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSkge1xuICAgIGF0dHJpYnV0ZS52YWx1ZS52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Qm91bmRFdmVudChldmVudDogQm91bmRFdmVudCkge1xuICAgIGV2ZW50LmhhbmRsZXIudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spIHtcbiAgICB0aGlzLmRlZmVyQmxvY2tzLmFkZChkZWZlcnJlZCk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGRlZmVycmVkKTtcblxuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLnBsYWNlaG9sZGVyKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmxvYWRpbmcpO1xuICAgIGRlZmVycmVkLmVycm9yICYmIHRoaXMudmlzaXROb2RlKGRlZmVycmVkLmVycm9yKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IHZvaWQge1xuICAgIGlmICh0cmlnZ2VyIGluc3RhbmNlb2YgQm91bmREZWZlcnJlZFRyaWdnZXIpIHtcbiAgICAgIHRyaWdnZXIudmFsdWUudmlzaXQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spIHtcbiAgICBibG9jay5icmFuY2hlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KSB7XG4gICAgdGV4dC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnVzZWRQaXBlcy5hZGQoYXN0Lm5hbWUpO1xuICAgIGlmICghdGhpcy5zY29wZS5pc0RlZmVycmVkKSB7XG4gICAgICB0aGlzLmVhZ2VyUGlwZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UGlwZShhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gVGhlc2UgZml2ZSB0eXBlcyBvZiBBU1QgZXhwcmVzc2lvbnMgY2FuIHJlZmVyIHRvIGV4cHJlc3Npb24gcm9vdHMsIHdoaWNoIGNvdWxkIGJlIHZhcmlhYmxlc1xuICAvLyBvciByZWZlcmVuY2VzIGluIHRoZSBjdXJyZW50IHNjb3BlLlxuXG4gIG92ZXJyaWRlIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UHJvcGVydHlSZWFkKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5V3JpdGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0U2NvcGVkTm9kZShub2RlOiBTY29wZWROb2RlKSB7XG4gICAgY29uc3QgY2hpbGRTY29wZSA9IHRoaXMuc2NvcGUuZ2V0Q2hpbGRTY29wZShub2RlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy51c2VkUGlwZXMsIHRoaXMuZWFnZXJQaXBlcywgdGhpcy5kZWZlckJsb2NrcyxcbiAgICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwsIGNoaWxkU2NvcGUsIG5vZGUsIHRoaXMubGV2ZWwgKyAxKTtcbiAgICBiaW5kZXIuaW5nZXN0KG5vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXliZU1hcChhc3Q6IFByb3BlcnR5UmVhZHxTYWZlUHJvcGVydHlSZWFkfFByb3BlcnR5V3JpdGUsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIElmIHRoZSByZWNlaXZlciBvZiB0aGUgZXhwcmVzc2lvbiBpc24ndCB0aGUgYEltcGxpY2l0UmVjZWl2ZXJgLCB0aGlzIGlzbid0IHRoZSByb290IG9mIGFuXG4gICAgLy8gYEFTVGAgZXhwcmVzc2lvbiB0aGF0IG1hcHMgdG8gYSBgVmFyaWFibGVgIG9yIGBSZWZlcmVuY2VgLlxuICAgIGlmICghKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgbmFtZSBleGlzdHMgaW4gdGhlIGN1cnJlbnQgc2NvcGUuIElmIHNvLCBtYXAgaXQuIE90aGVyd2lzZSwgdGhlIG5hbWUgaXNcbiAgICAvLyBwcm9iYWJseSBhIHByb3BlcnR5IG9uIHRoZSB0b3AtbGV2ZWwgY29tcG9uZW50IGNvbnRleHQuXG4gICAgbGV0IHRhcmdldCA9IHRoaXMuc2NvcGUubG9va3VwKG5hbWUpO1xuICAgIGlmICh0YXJnZXQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGFzdCwgdGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBNZXRhZGF0YSBjb250YWluZXIgZm9yIGEgYFRhcmdldGAgdGhhdCBhbGxvd3MgcXVlcmllcyBmb3Igc3BlY2lmaWMgYml0cyBvZiBtZXRhZGF0YS5cbiAqXG4gKiBTZWUgYEJvdW5kVGFyZ2V0YCBmb3IgZG9jdW1lbnRhdGlvbiBvbiB0aGUgaW5kaXZpZHVhbCBtZXRob2RzLlxuICovXG5leHBvcnQgY2xhc3MgUjNCb3VuZFRhcmdldDxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdGFyZ2V0OiBUYXJnZXQsIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxSZWZlcmVuY2V8VGV4dEF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIGV4cHJUYXJnZXRzOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgICAgcHJpdmF0ZSBzeW1ib2xzOiBNYXA8UmVmZXJlbmNlfFZhcmlhYmxlLCBUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgICBwcml2YXRlIHNjb3BlZE5vZGVFbnRpdGllczogTWFwPFNjb3BlZE5vZGV8bnVsbCwgUmVhZG9ubHlTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4sXG4gICAgICBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sIHByaXZhdGUgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIGRlZmVycmVkQmxvY2tzOiBTZXQ8RGVmZXJyZWRCbG9jaz4pIHt9XG5cbiAgZ2V0RW50aXRpZXNJblNjb3BlKG5vZGU6IFNjb3BlZE5vZGV8bnVsbCk6IFJlYWRvbmx5U2V0PFJlZmVyZW5jZXxWYXJpYWJsZT4ge1xuICAgIHJldHVybiB0aGlzLnNjb3BlZE5vZGVFbnRpdGllcy5nZXQobm9kZSkgPz8gbmV3IFNldCgpO1xuICB9XG5cbiAgZ2V0RGlyZWN0aXZlc09mTm9kZShub2RlOiBFbGVtZW50fFRlbXBsYXRlKTogRGlyZWN0aXZlVFtdfG51bGwge1xuICAgIHJldHVybiB0aGlzLmRpcmVjdGl2ZXMuZ2V0KG5vZGUpIHx8IG51bGw7XG4gIH1cblxuICBnZXRSZWZlcmVuY2VUYXJnZXQocmVmOiBSZWZlcmVuY2UpOiBSZWZlcmVuY2VUYXJnZXQ8RGlyZWN0aXZlVD58bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlcy5nZXQocmVmKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0Q29uc3VtZXJPZkJpbmRpbmcoYmluZGluZzogQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlKTogRGlyZWN0aXZlVHxFbGVtZW50XG4gICAgICB8VGVtcGxhdGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ3MuZ2V0KGJpbmRpbmcpIHx8IG51bGw7XG4gIH1cblxuICBnZXRFeHByZXNzaW9uVGFyZ2V0KGV4cHI6IEFTVCk6IFJlZmVyZW5jZXxWYXJpYWJsZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5leHByVGFyZ2V0cy5nZXQoZXhwcikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldERlZmluaXRpb25Ob2RlT2ZTeW1ib2woc3ltYm9sOiBSZWZlcmVuY2V8VmFyaWFibGUpOiBTY29wZWROb2RlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbHMuZ2V0KHN5bWJvbCkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldE5lc3RpbmdMZXZlbChub2RlOiBTY29wZWROb2RlKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5uZXN0aW5nTGV2ZWwuZ2V0KG5vZGUpIHx8IDA7XG4gIH1cblxuICBnZXRVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4oKTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJzID0+IGRpcnMuZm9yRWFjaChkaXIgPT4gc2V0LmFkZChkaXIpKSk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldEVhZ2VybHlVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4odGhpcy5lYWdlckRpcmVjdGl2ZXMpO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNldC52YWx1ZXMoKSk7XG4gIH1cblxuICBnZXRVc2VkUGlwZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMudXNlZFBpcGVzKTtcbiAgfVxuXG4gIGdldEVhZ2VybHlVc2VkUGlwZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZWFnZXJQaXBlcyk7XG4gIH1cblxuICBnZXREZWZlckJsb2NrcygpOiBEZWZlcnJlZEJsb2NrW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZGVmZXJyZWRCbG9ja3MpO1xuICB9XG5cblxuICBnZXREZWZlcnJlZFRyaWdnZXJUYXJnZXQoYmxvY2s6IERlZmVycmVkQmxvY2ssIHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IEVsZW1lbnR8bnVsbCB7XG4gICAgLy8gT25seSB0cmlnZ2VycyB0aGF0IHJlZmVyIHRvIERPTSBub2RlcyBjYW4gYmUgcmVzb2x2ZWQuXG4gICAgaWYgKCEodHJpZ2dlciBpbnN0YW5jZW9mIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyKSAmJlxuICAgICAgICAhKHRyaWdnZXIgaW5zdGFuY2VvZiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcikgJiZcbiAgICAgICAgISh0cmlnZ2VyIGluc3RhbmNlb2YgSG92ZXJEZWZlcnJlZFRyaWdnZXIpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lID0gdHJpZ2dlci5yZWZlcmVuY2U7XG5cbiAgICAvLyBUT0RPKGNyaXNiZXRvKTogYWNjb3VudCBmb3IgYHZpZXdwb3J0YCB0cmlnZ2VyIHdpdGhvdXQgYSBgcmVmZXJlbmNlYC5cbiAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0c2lkZVJlZiA9IHRoaXMuZmluZEVudGl0eUluU2NvcGUoYmxvY2ssIG5hbWUpO1xuXG4gICAgLy8gRmlyc3QgdHJ5IHRvIHJlc29sdmUgdGhlIHRhcmdldCBpbiB0aGUgc2NvcGUgb2YgdGhlIG1haW4gZGVmZXJyZWQgYmxvY2suIE5vdGUgdGhhdCB3ZVxuICAgIC8vIHNraXAgdHJpZ2dlcnMgZGVmaW5lZCBpbnNpZGUgdGhlIG1haW4gYmxvY2sgaXRzZWxmLCBiZWNhdXNlIHRoZXkgbWlnaHQgbm90IGV4aXN0IHlldC5cbiAgICBpZiAob3V0c2lkZVJlZiBpbnN0YW5jZW9mIFJlZmVyZW5jZSAmJiB0aGlzLmdldERlZmluaXRpb25Ob2RlT2ZTeW1ib2wob3V0c2lkZVJlZikgIT09IGJsb2NrKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmdldFJlZmVyZW5jZVRhcmdldChvdXRzaWRlUmVmKTtcblxuICAgICAgaWYgKHRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWZlcmVuY2VUYXJnZXRUb0VsZW1lbnQodGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgdHJpZ2dlciBjb3VsZG4ndCBiZSBmb3VuZCBpbiB0aGUgbWFpbiBibG9jaywgY2hlY2sgdGhlXG4gICAgLy8gcGxhY2Vob2xkZXIgIGJsb2NrIHdoaWNoIGlzIHNob3duIGJlZm9yZSB0aGUgbWFpbiBibG9jayBoYXMgbG9hZGVkLlxuICAgIGlmIChibG9jay5wbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcmVmSW5QbGFjZWhvbGRlciA9IHRoaXMuZmluZEVudGl0eUluU2NvcGUoYmxvY2sucGxhY2Vob2xkZXIsIG5hbWUpO1xuICAgICAgY29uc3QgdGFyZ2V0SW5QbGFjZWhvbGRlciA9XG4gICAgICAgICAgcmVmSW5QbGFjZWhvbGRlciBpbnN0YW5jZW9mIFJlZmVyZW5jZSA/IHRoaXMuZ2V0UmVmZXJlbmNlVGFyZ2V0KHJlZkluUGxhY2Vob2xkZXIpIDogbnVsbDtcblxuICAgICAgaWYgKHRhcmdldEluUGxhY2Vob2xkZXIgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldEluUGxhY2Vob2xkZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpbmRzIGFuIGVudGl0eSB3aXRoIGEgc3BlY2lmaWMgbmFtZSBpbiBhIHNjb3BlLlxuICAgKiBAcGFyYW0gcm9vdE5vZGUgUm9vdCBub2RlIG9mIHRoZSBzY29wZS5cbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZW50aXR5LlxuICAgKi9cbiAgcHJpdmF0ZSBmaW5kRW50aXR5SW5TY29wZShyb290Tm9kZTogU2NvcGVkTm9kZSwgbmFtZTogc3RyaW5nKTogUmVmZXJlbmNlfFZhcmlhYmxlfG51bGwge1xuICAgIGNvbnN0IGVudGl0aWVzID0gdGhpcy5nZXRFbnRpdGllc0luU2NvcGUocm9vdE5vZGUpO1xuXG4gICAgZm9yIChjb25zdCBlbnRpdGl0eSBvZiBlbnRpdGllcykge1xuICAgICAgaWYgKGVudGl0aXR5Lm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGVudGl0aXR5O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqIENvZXJjZXMgYSBgUmVmZXJlbmNlVGFyZ2V0YCB0byBhbiBgRWxlbWVudGAsIGlmIHBvc3NpYmxlLiAqL1xuICBwcml2YXRlIHJlZmVyZW5jZVRhcmdldFRvRWxlbWVudCh0YXJnZXQ6IFJlZmVyZW5jZVRhcmdldDxEaXJlY3RpdmVUPik6IEVsZW1lbnR8bnVsbCB7XG4gICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZWZlcmVuY2VUYXJnZXRUb0VsZW1lbnQodGFyZ2V0Lm5vZGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RTY29wZWROb2RlRW50aXRpZXMocm9vdFNjb3BlOiBTY29wZSk6XG4gICAgTWFwPFNjb3BlZE5vZGV8bnVsbCwgU2V0PFJlZmVyZW5jZXxWYXJpYWJsZT4+IHtcbiAgY29uc3QgZW50aXR5TWFwID0gbmV3IE1hcDxTY29wZWROb2RlfG51bGwsIE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4+KCk7XG5cbiAgZnVuY3Rpb24gZXh0cmFjdFNjb3BlRW50aXRpZXMoc2NvcGU6IFNjb3BlKTogTWFwPHN0cmluZywgUmVmZXJlbmNlfFZhcmlhYmxlPiB7XG4gICAgaWYgKGVudGl0eU1hcC5oYXMoc2NvcGUucm9vdE5vZGUpKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwLmdldChzY29wZS5yb290Tm9kZSkhO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnRFbnRpdGllcyA9IHNjb3BlLm5hbWVkRW50aXRpZXM7XG5cbiAgICBsZXQgZW50aXRpZXM6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT47XG4gICAgaWYgKHNjb3BlLnBhcmVudFNjb3BlICE9PSBudWxsKSB7XG4gICAgICBlbnRpdGllcyA9IG5ldyBNYXAoWy4uLmV4dHJhY3RTY29wZUVudGl0aWVzKHNjb3BlLnBhcmVudFNjb3BlKSwgLi4uY3VycmVudEVudGl0aWVzXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudGl0aWVzID0gbmV3IE1hcChjdXJyZW50RW50aXRpZXMpO1xuICAgIH1cblxuICAgIGVudGl0eU1hcC5zZXQoc2NvcGUucm9vdE5vZGUsIGVudGl0aWVzKTtcbiAgICByZXR1cm4gZW50aXRpZXM7XG4gIH1cblxuICBjb25zdCBzY29wZXNUb1Byb2Nlc3M6IFNjb3BlW10gPSBbcm9vdFNjb3BlXTtcbiAgd2hpbGUgKHNjb3Blc1RvUHJvY2Vzcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc2NvcGUgPSBzY29wZXNUb1Byb2Nlc3MucG9wKCkhO1xuICAgIGZvciAoY29uc3QgY2hpbGRTY29wZSBvZiBzY29wZS5jaGlsZFNjb3Blcy52YWx1ZXMoKSkge1xuICAgICAgc2NvcGVzVG9Qcm9jZXNzLnB1c2goY2hpbGRTY29wZSk7XG4gICAgfVxuICAgIGV4dHJhY3RTY29wZUVudGl0aWVzKHNjb3BlKTtcbiAgfVxuXG4gIGNvbnN0IHRlbXBsYXRlRW50aXRpZXMgPSBuZXcgTWFwPFNjb3BlZE5vZGV8bnVsbCwgU2V0PFJlZmVyZW5jZXxWYXJpYWJsZT4+KCk7XG4gIGZvciAoY29uc3QgW3RlbXBsYXRlLCBlbnRpdGllc10gb2YgZW50aXR5TWFwKSB7XG4gICAgdGVtcGxhdGVFbnRpdGllcy5zZXQodGVtcGxhdGUsIG5ldyBTZXQoZW50aXRpZXMudmFsdWVzKCkpKTtcbiAgfVxuICByZXR1cm4gdGVtcGxhdGVFbnRpdGllcztcbn1cbiJdfQ==