/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AST, ImplicitReceiver, RecursiveAstVisitor } from '../../expression_parser/ast';
import { Comment, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, Element, ForLoopBlock, ForLoopBlockEmpty, HoverDeferredTrigger, IfBlockBranch, InteractionDeferredTrigger, Reference, SwitchBlockCase, Template, ViewportDeferredTrigger } from '../r3_ast';
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
        this.deferBlocks.add(deferred);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidDJfYmluZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvdmlldy90Ml9iaW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBZSxnQkFBZ0IsRUFBK0IsbUJBQW1CLEVBQW1CLE1BQU0sNkJBQTZCLENBQUM7QUFFbkosT0FBTyxFQUF3QyxPQUFPLEVBQVcsYUFBYSxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLHdCQUF3QixFQUFtQixPQUFPLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFnQixhQUFhLEVBQUUsMEJBQTBCLEVBQVEsU0FBUyxFQUFlLGVBQWUsRUFBRSxRQUFRLEVBQStDLHVCQUF1QixFQUFVLE1BQU0sV0FBVyxDQUFDO0FBR3ZiLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUM3QyxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFFcEQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxjQUFjO0lBQ3pCLFlBQW9CLGdCQUErQztRQUEvQyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQStCO0lBQUcsQ0FBQztJQUV2RTs7O09BR0c7SUFDSCxJQUFJLENBQUMsTUFBYztRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUNwQiw0RUFBNEU7WUFDNUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1NBQ2pFO1FBRUQsNEZBQTRGO1FBQzVGLGlFQUFpRTtRQUNqRSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUzQyxrRkFBa0Y7UUFDbEYsTUFBTSxrQkFBa0IsR0FBRyx5QkFBeUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUU1RCw4RkFBOEY7UUFDOUYsb0ZBQW9GO1FBQ3BGLDRGQUE0RjtRQUM1RixtRkFBbUY7UUFDbkYsdURBQXVEO1FBQ3ZELE1BQU0sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUMsR0FDckQsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2xFLCtGQUErRjtRQUMvRixzRkFBc0Y7UUFDdEYsTUFBTSxFQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFDLEdBQzFFLGNBQWMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxRCxPQUFPLElBQUksYUFBYSxDQUNwQixNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQy9FLFlBQVksRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzVFLENBQUM7Q0FDRjtBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sS0FBSztJQWNULFlBQTZCLFdBQXVCLEVBQVcsUUFBeUI7UUFBM0QsZ0JBQVcsR0FBWCxXQUFXLENBQVk7UUFBVyxhQUFRLEdBQVIsUUFBUSxDQUFpQjtRQWJ4Rjs7V0FFRztRQUNNLGtCQUFhLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7UUFFL0Q7O1dBRUc7UUFDTSxnQkFBVyxHQUFHLElBQUksR0FBRyxFQUFxQixDQUFDO1FBTWxELElBQUksQ0FBQyxVQUFVO1lBQ1gsV0FBVyxLQUFLLElBQUksSUFBSSxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsWUFBWSxhQUFhLENBQUM7SUFDaEcsQ0FBQztJQUVELE1BQU0sQ0FBQyxZQUFZO1FBQ2pCLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQWdCO1FBQzNCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNuQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0ssTUFBTSxDQUFDLFdBQThCO1FBQzNDLElBQUksV0FBVyxZQUFZLFFBQVEsRUFBRTtZQUNuQyxnRUFBZ0U7WUFDaEUsV0FBVyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFFaEUscUNBQXFDO1lBQ3JDLFdBQVcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ3hEO2FBQU0sSUFBSSxXQUFXLFlBQVksYUFBYSxFQUFFO1lBQy9DLElBQUksV0FBVyxDQUFDLGVBQWUsS0FBSyxJQUFJLEVBQUU7Z0JBQ3hDLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2FBQ2pEO1lBQ0QsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDeEQ7YUFBTSxJQUFJLFdBQVcsWUFBWSxZQUFZLEVBQUU7WUFDOUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEYsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDeEQ7YUFBTSxJQUNILFdBQVcsWUFBWSxlQUFlLElBQUksV0FBVyxZQUFZLGlCQUFpQjtZQUNsRixXQUFXLFlBQVksYUFBYSxJQUFJLFdBQVcsWUFBWSxrQkFBa0I7WUFDakYsV0FBVyxZQUFZLHdCQUF3QjtZQUMvQyxXQUFXLFlBQVksb0JBQW9CLEVBQUU7WUFDL0MsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDeEQ7YUFBTTtZQUNMLHFFQUFxRTtZQUNyRSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQy9DO0lBQ0gsQ0FBQztJQUVELFlBQVksQ0FBQyxPQUFnQjtRQUMzQixvRkFBb0Y7UUFDcEYsT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFOUQseUNBQXlDO1FBQ3pDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCxhQUFhLENBQUMsUUFBa0I7UUFDOUIsdUZBQXVGO1FBQ3ZGLHlDQUF5QztRQUN6QyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUUvRCxrRUFBa0U7UUFDbEUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2xDLENBQUM7SUFFRCxhQUFhLENBQUMsUUFBa0I7UUFDOUIsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELGNBQWMsQ0FBQyxTQUFvQjtRQUNqQyw0Q0FBNEM7UUFDNUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsa0JBQWtCLENBQUMsUUFBdUI7UUFDeEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLFFBQVEsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCw2QkFBNkIsQ0FBQyxLQUErQjtRQUMzRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELHVCQUF1QixDQUFDLEtBQXlCO1FBQy9DLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQseUJBQXlCLENBQUMsS0FBMkI7UUFDbkQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxLQUFrQjtRQUNqQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsb0JBQW9CLENBQUMsS0FBc0I7UUFDekMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxLQUFtQjtRQUNuQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVELHNCQUFzQixDQUFDLEtBQXdCO1FBQzdDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsWUFBWSxDQUFDLEtBQWM7UUFDekIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELGtCQUFrQixDQUFDLEtBQW9CO1FBQ3JDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsbUJBQW1CO0lBQ25CLFlBQVksQ0FBQyxPQUFnQixJQUFHLENBQUM7SUFDakMsbUJBQW1CLENBQUMsSUFBb0IsSUFBRyxDQUFDO0lBQzVDLGVBQWUsQ0FBQyxLQUFpQixJQUFHLENBQUM7SUFDckMsY0FBYyxDQUFDLElBQWUsSUFBRyxDQUFDO0lBQ2xDLFNBQVMsQ0FBQyxJQUFVLElBQUcsQ0FBQztJQUN4QixrQkFBa0IsQ0FBQyxJQUFtQixJQUFHLENBQUM7SUFDMUMsUUFBUSxDQUFDLEdBQVEsSUFBRyxDQUFDO0lBQ3JCLG9CQUFvQixDQUFDLE9BQXdCLElBQUcsQ0FBQztJQUNqRCxpQkFBaUIsQ0FBQyxLQUFtQixJQUFHLENBQUM7SUFFakMsWUFBWSxDQUFDLEtBQXlCO1FBQzVDLG1FQUFtRTtRQUNuRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3ZDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDM0M7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxJQUFZO1FBQ2pCLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDaEMsNEJBQTRCO1lBQzVCLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7U0FDdEM7YUFBTSxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO1lBQ3BDLHFFQUFxRTtZQUNyRSxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3RDO2FBQU07WUFDTCx3Q0FBd0M7WUFDeEMsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsYUFBYSxDQUFDLElBQWdCO1FBQzVCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxJQUFJLFlBQVksQ0FBQyxDQUFDO1NBQ3ZFO1FBQ0QsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsSUFBZ0I7UUFDdkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRjtBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLGVBQWU7SUFJbkIsWUFDWSxPQUFzQyxFQUN0QyxVQUErQyxFQUMvQyxlQUE2QixFQUM3QixRQUFtRixFQUNuRixVQUM0RTtRQUw1RSxZQUFPLEdBQVAsT0FBTyxDQUErQjtRQUN0QyxlQUFVLEdBQVYsVUFBVSxDQUFxQztRQUMvQyxvQkFBZSxHQUFmLGVBQWUsQ0FBYztRQUM3QixhQUFRLEdBQVIsUUFBUSxDQUEyRTtRQUNuRixlQUFVLEdBQVYsVUFBVSxDQUNrRTtRQVR4RixvRUFBb0U7UUFDNUQsbUJBQWMsR0FBRyxLQUFLLENBQUM7SUFRNEQsQ0FBQztJQUU1Rjs7Ozs7Ozs7Ozs7T0FXRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQ1IsUUFBZ0IsRUFBRSxlQUE4QztRQU1sRSxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBa0MsQ0FBQztRQUM3RCxNQUFNLFFBQVEsR0FDVixJQUFJLEdBQUcsRUFBd0UsQ0FBQztRQUNwRixNQUFNLFVBQVUsR0FDWixJQUFJLEdBQUcsRUFBaUYsQ0FBQztRQUM3RixNQUFNLGVBQWUsR0FBaUIsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sT0FBTyxHQUNULElBQUksZUFBZSxDQUFDLGVBQWUsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM1RixPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3pCLE9BQU8sRUFBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRU8sTUFBTSxDQUFDLFFBQWdCO1FBQzdCLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELFlBQVksQ0FBQyxPQUFnQjtRQUMzQixJQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQsYUFBYSxDQUFDLFFBQWtCO1FBQzlCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELHNCQUFzQixDQUFDLFdBQW1CLEVBQUUsSUFBc0I7UUFDaEUscUZBQXFGO1FBQ3JGLHVEQUF1RDtRQUN2RCxNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV2Riw2RUFBNkU7UUFDN0UsTUFBTSxVQUFVLEdBQWlCLEVBQUUsQ0FBQztRQUNwQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNyRixJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3pCLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtnQkFDeEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQzthQUMxQztTQUNGO1FBRUQsd0RBQXdEO1FBQ3hELElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzVCLElBQUksU0FBUyxHQUFvQixJQUFJLENBQUM7WUFFdEMsNEZBQTRGO1lBQzVGLHFGQUFxRjtZQUNyRix1QkFBdUI7WUFDdkIsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDM0IsNERBQTREO2dCQUM1RCxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLENBQUM7YUFDN0Q7aUJBQU07Z0JBQ0wsbUVBQW1FO2dCQUNuRSxTQUFTO29CQUNMLFVBQVUsQ0FBQyxJQUFJLENBQ1gsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ3BGLElBQUksQ0FBQztnQkFDVCwyQ0FBMkM7Z0JBQzNDLElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtvQkFDdEIseUZBQXlGO29CQUN6RixZQUFZO29CQUNaLE9BQU87aUJBQ1I7YUFDRjtZQUVELElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtnQkFDdEIsd0NBQXdDO2dCQUN4QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7YUFDeEQ7aUJBQU07Z0JBQ0wsNENBQTRDO2dCQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDaEM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUlILE1BQU0sbUJBQW1CLEdBQ3JCLENBQUMsU0FBb0IsRUFBRSxNQUFxRCxFQUFFLEVBQUU7WUFDOUUsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN2RixNQUFNLE9BQU8sR0FBRyxHQUFHLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUMvQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDeEMsQ0FBQyxDQUFDO1FBRU4sd0VBQXdFO1FBQ3hFLHdCQUF3QjtRQUN4QixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ25FLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDckUsSUFBSSxJQUFJLFlBQVksUUFBUSxFQUFFO1lBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7U0FDekU7UUFDRCx3RUFBd0U7UUFDeEUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUV2RSxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELGtCQUFrQixDQUFDLFFBQXVCO1FBQ3hDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDNUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUM7UUFDM0IsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLGNBQWMsR0FBRyxlQUFlLENBQUM7UUFFdEMsUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEMsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsUUFBUSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELDZCQUE2QixDQUFDLEtBQStCO1FBQzNELEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRCx1QkFBdUIsQ0FBQyxLQUF5QjtRQUMvQyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQseUJBQXlCLENBQUMsS0FBMkI7UUFDbkQsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELGdCQUFnQixDQUFDLEtBQWtCO1FBQ2pDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxLQUFzQjtRQUN6QyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsaUJBQWlCLENBQUMsS0FBbUI7UUFDbkMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbEUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakQsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVELHNCQUFzQixDQUFDLEtBQXdCO1FBQzdDLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxZQUFZLENBQUMsS0FBYztRQUN6QixLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRUQsa0JBQWtCLENBQUMsS0FBb0I7UUFDckMsS0FBSyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELG1CQUFtQjtJQUNuQixZQUFZLENBQUMsT0FBZ0IsSUFBUyxDQUFDO0lBQ3ZDLGFBQWEsQ0FBQyxRQUFrQixJQUFTLENBQUM7SUFDMUMsY0FBYyxDQUFDLFNBQW9CLElBQVMsQ0FBQztJQUM3QyxrQkFBa0IsQ0FBQyxTQUF3QixJQUFTLENBQUM7SUFDckQsbUJBQW1CLENBQUMsU0FBeUIsSUFBUyxDQUFDO0lBQ3ZELGVBQWUsQ0FBQyxTQUFxQixJQUFTLENBQUM7SUFDL0MsMEJBQTBCLENBQUMsSUFBK0IsSUFBRyxDQUFDO0lBQzlELFNBQVMsQ0FBQyxJQUFVLElBQVMsQ0FBQztJQUM5QixjQUFjLENBQUMsSUFBZSxJQUFTLENBQUM7SUFDeEMsUUFBUSxDQUFDLEdBQVEsSUFBUyxDQUFDO0lBQzNCLG9CQUFvQixDQUFDLE9BQXdCLElBQVMsQ0FBQztJQUN2RCxpQkFBaUIsQ0FBQyxLQUFtQixJQUFHLENBQUM7Q0FDMUM7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sY0FBZSxTQUFRLG1CQUFtQjtJQUc5QyxZQUNZLFFBQXNDLEVBQ3RDLE9BQTRDLEVBQVUsU0FBc0IsRUFDNUUsVUFBdUIsRUFBVSxXQUErQixFQUNoRSxZQUFxQyxFQUFVLEtBQVksRUFDM0QsUUFBeUIsRUFBVSxLQUFhO1FBQzFELEtBQUssRUFBRSxDQUFDO1FBTEUsYUFBUSxHQUFSLFFBQVEsQ0FBOEI7UUFDdEMsWUFBTyxHQUFQLE9BQU8sQ0FBcUM7UUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFhO1FBQzVFLGVBQVUsR0FBVixVQUFVLENBQWE7UUFBVSxnQkFBVyxHQUFYLFdBQVcsQ0FBb0I7UUFDaEUsaUJBQVksR0FBWixZQUFZLENBQXlCO1FBQVUsVUFBSyxHQUFMLEtBQUssQ0FBTztRQUMzRCxhQUFRLEdBQVIsUUFBUSxDQUFpQjtRQUFVLFVBQUssR0FBTCxLQUFLLENBQVE7UUFHMUQseUVBQXlFO1FBQ3pFLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxJQUFVLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELDRFQUE0RTtJQUM1RSxxRUFBcUU7SUFDckUsY0FBYztJQUNMLEtBQUssQ0FBQyxJQUFjLEVBQUUsT0FBYTtRQUMxQyxJQUFJLElBQUksWUFBWSxHQUFHLEVBQUU7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDM0I7YUFBTTtZQUNMLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDbEI7SUFDSCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7O09BV0c7SUFDSCxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQWEsRUFBRSxLQUFZO1FBUS9DLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUEyQixDQUFDO1FBQ3ZELE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO1FBQ3hELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO1FBQ25ELE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDcEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNyQyxNQUFNLFFBQVEsR0FBRyxLQUFLLFlBQVksUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBaUIsQ0FBQztRQUM3Qyw4Q0FBOEM7UUFDOUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxjQUFjLENBQzdCLFdBQVcsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQixPQUFPLEVBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUMsQ0FBQztJQUNsRixDQUFDO0lBRU8sTUFBTSxDQUFDLFdBQThCO1FBQzNDLElBQUksV0FBVyxZQUFZLFFBQVEsRUFBRTtZQUNuQyw4RkFBOEY7WUFDOUYsNkVBQTZFO1lBQzdFLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM5QyxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFN0MseUJBQXlCO1lBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDaEQ7YUFBTSxJQUFJLFdBQVcsWUFBWSxhQUFhLEVBQUU7WUFDL0MsSUFBSSxXQUFXLENBQUMsZUFBZSxLQUFLLElBQUksRUFBRTtnQkFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7YUFDN0M7WUFDRCxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNoRDthQUFNLElBQUksV0FBVyxZQUFZLFlBQVksRUFBRTtZQUM5QyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1RSxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoQyxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNoRDthQUFNLElBQ0gsV0FBVyxZQUFZLGVBQWUsSUFBSSxXQUFXLFlBQVksaUJBQWlCO1lBQ2xGLFdBQVcsWUFBWSxhQUFhLElBQUksV0FBVyxZQUFZLGtCQUFrQjtZQUNqRixXQUFXLFlBQVksd0JBQXdCO1lBQy9DLFdBQVcsWUFBWSxvQkFBb0IsRUFBRTtZQUMvQyxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN2RCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2hEO2FBQU07WUFDTCwrQ0FBK0M7WUFDL0MsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDckM7SUFDSCxDQUFDO0lBRUQsWUFBWSxDQUFDLE9BQWdCO1FBQzNCLDBEQUEwRDtRQUMxRCxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6QyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELGFBQWEsQ0FBQyxRQUFrQjtRQUM5Qiw2RUFBNkU7UUFDN0UsUUFBUSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6QyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDL0MsUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTVDLG1DQUFtQztRQUNuQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELGFBQWEsQ0FBQyxRQUFrQjtRQUM5QixpRUFBaUU7UUFDakUsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQzNDO0lBQ0gsQ0FBQztJQUVELGNBQWMsQ0FBQyxTQUFvQjtRQUNqQyxrRUFBa0U7UUFDbEUsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTtZQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQzVDO0lBQ0gsQ0FBQztJQUVELDJCQUEyQjtJQUUzQixTQUFTLENBQUMsSUFBVSxJQUFHLENBQUM7SUFDeEIsWUFBWSxDQUFDLE9BQWdCLElBQUcsQ0FBQztJQUNqQyxrQkFBa0IsQ0FBQyxTQUF3QixJQUFHLENBQUM7SUFDL0MsaUJBQWlCLENBQUMsS0FBbUIsSUFBRyxDQUFDO0lBQ3pDLG9CQUFvQixLQUFVLENBQUM7SUFDL0IsUUFBUSxDQUFDLEdBQVE7UUFDZixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEYsQ0FBQztJQUVELGdHQUFnRztJQUVoRyxtQkFBbUIsQ0FBQyxTQUF5QjtRQUMzQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsZUFBZSxDQUFDLEtBQWlCO1FBQy9CLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxRQUF1QjtRQUN4QyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFaEMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsUUFBUSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM3RCxRQUFRLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELFFBQVEsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELDZCQUE2QixDQUFDLEtBQStCO1FBQzNELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsdUJBQXVCLENBQUMsS0FBeUI7UUFDL0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCx5QkFBeUIsQ0FBQyxLQUEyQjtRQUNuRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELGdCQUFnQixDQUFDLEtBQWtCO1FBQ2pDLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsb0JBQW9CLENBQUMsS0FBc0I7UUFDekMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxLQUFtQjtRQUNuQyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDN0IsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVELHNCQUFzQixDQUFDLEtBQXdCO1FBQzdDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsWUFBWSxDQUFDLEtBQWM7UUFDekIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELGtCQUFrQixDQUFDLEtBQW9CO1FBQ3JDLEtBQUssQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQsY0FBYyxDQUFDLElBQWU7UUFDNUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUNRLFNBQVMsQ0FBQyxHQUFnQixFQUFFLE9BQVk7UUFDL0MsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRTtZQUMxQixJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFDRCxPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCw4RkFBOEY7SUFDOUYsc0NBQXNDO0lBRTdCLGlCQUFpQixDQUFDLEdBQWlCLEVBQUUsT0FBWTtRQUN4RCxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0IsT0FBTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFUSxxQkFBcUIsQ0FBQyxHQUFxQixFQUFFLE9BQVk7UUFDaEUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLE9BQU8sS0FBSyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRVEsa0JBQWtCLENBQUMsR0FBa0IsRUFBRSxPQUFZO1FBQzFELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixPQUFPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVPLGdCQUFnQixDQUFDLElBQWdCO1FBQ3ZDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xELE1BQU0sTUFBTSxHQUFHLElBQUksY0FBYyxDQUM3QixJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQzlFLElBQUksQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3pELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEIsQ0FBQztJQUVPLFFBQVEsQ0FBQyxHQUFnRCxFQUFFLElBQVk7UUFDN0UsNEZBQTRGO1FBQzVGLDZEQUE2RDtRQUM3RCxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxZQUFZLGdCQUFnQixDQUFDLEVBQUU7WUFDL0MsT0FBTztTQUNSO1FBRUQsNEZBQTRGO1FBQzVGLDBEQUEwRDtRQUMxRCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7WUFDbkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ2hDO0lBQ0gsQ0FBQztDQUNGO0FBRUQ7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxhQUFhO0lBQ3hCLFlBQ2EsTUFBYyxFQUFVLFVBQStDLEVBQ3hFLGVBQTZCLEVBQzdCLFFBQW1GLEVBQ25GLFVBRWlFLEVBQ2pFLFdBQXlDLEVBQ3pDLE9BQTBDLEVBQzFDLFlBQXFDLEVBQ3JDLGtCQUF5RSxFQUN6RSxTQUFzQixFQUFVLFVBQXVCLEVBQ3ZELGNBQWtDO1FBWGpDLFdBQU0sR0FBTixNQUFNLENBQVE7UUFBVSxlQUFVLEdBQVYsVUFBVSxDQUFxQztRQUN4RSxvQkFBZSxHQUFmLGVBQWUsQ0FBYztRQUM3QixhQUFRLEdBQVIsUUFBUSxDQUEyRTtRQUNuRixlQUFVLEdBQVYsVUFBVSxDQUV1RDtRQUNqRSxnQkFBVyxHQUFYLFdBQVcsQ0FBOEI7UUFDekMsWUFBTyxHQUFQLE9BQU8sQ0FBbUM7UUFDMUMsaUJBQVksR0FBWixZQUFZLENBQXlCO1FBQ3JDLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBdUQ7UUFDekUsY0FBUyxHQUFULFNBQVMsQ0FBYTtRQUFVLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDdkQsbUJBQWMsR0FBZCxjQUFjLENBQW9CO0lBQUcsQ0FBQztJQUVsRCxrQkFBa0IsQ0FBQyxJQUFxQjtRQUN0QyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsSUFBc0I7UUFDeEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDM0MsQ0FBQztJQUVELGtCQUFrQixDQUFDLEdBQWM7UUFDL0IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDMUMsQ0FBQztJQUVELG9CQUFvQixDQUFDLE9BQWdEO1FBRW5FLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzVDLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxJQUFTO1FBQzNCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzVDLENBQUM7SUFFRCx5QkFBeUIsQ0FBQyxNQUEwQjtRQUNsRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQztJQUMxQyxDQUFDO0lBRUQsZUFBZSxDQUFDLElBQWdCO1FBQzlCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxpQkFBaUI7UUFDZixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25FLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsd0JBQXdCO1FBQ3RCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFhLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN0RCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELFlBQVk7UUFDVixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxtQkFBbUI7UUFDakIsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsY0FBYztRQUNaLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUdELHdCQUF3QixDQUFDLEtBQW9CLEVBQUUsT0FBd0I7UUFDckUseURBQXlEO1FBQ3pELElBQUksQ0FBQyxDQUFDLE9BQU8sWUFBWSwwQkFBMEIsQ0FBQztZQUNoRCxDQUFDLENBQUMsT0FBTyxZQUFZLHVCQUF1QixDQUFDO1lBQzdDLENBQUMsQ0FBQyxPQUFPLFlBQVksb0JBQW9CLENBQUMsRUFBRTtZQUM5QyxPQUFPLElBQUksQ0FBQztTQUNiO1FBRUQsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUUvQixJQUFJLElBQUksS0FBSyxJQUFJLEVBQUU7WUFDakIsSUFBSSxPQUFPLEdBQWlCLElBQUksQ0FBQztZQUVqQyxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO2dCQUM5QixLQUFLLE1BQU0sS0FBSyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFO29CQUM5QyxvRkFBb0Y7b0JBQ3BGLCtFQUErRTtvQkFDL0UsSUFBSSxLQUFLLFlBQVksT0FBTyxFQUFFO3dCQUM1QixTQUFTO3FCQUNWO29CQUVELDRFQUE0RTtvQkFDNUUsd0VBQXdFO29CQUN4RSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7d0JBQ3BCLE9BQU8sSUFBSSxDQUFDO3FCQUNiO29CQUVELElBQUksS0FBSyxZQUFZLE9BQU8sRUFBRTt3QkFDNUIsT0FBTyxHQUFHLEtBQUssQ0FBQztxQkFDakI7aUJBQ0Y7YUFDRjtZQUVELE9BQU8sT0FBTyxDQUFDO1NBQ2hCO1FBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV2RCx3RkFBd0Y7UUFDeEYsd0ZBQXdGO1FBQ3hGLElBQUksVUFBVSxZQUFZLFNBQVMsSUFBSSxJQUFJLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLEtBQUssS0FBSyxFQUFFO1lBQzNGLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVuRCxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7Z0JBQ25CLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQzlDO1NBQ0Y7UUFFRCxnRUFBZ0U7UUFDaEUscUVBQXFFO1FBQ3JFLElBQUksS0FBSyxDQUFDLFdBQVcsS0FBSyxJQUFJLEVBQUU7WUFDOUIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN6RSxNQUFNLG1CQUFtQixHQUNyQixnQkFBZ0IsWUFBWSxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFFN0YsSUFBSSxtQkFBbUIsS0FBSyxJQUFJLEVBQUU7Z0JBQ2hDLE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLG1CQUFtQixDQUFDLENBQUM7YUFDM0Q7U0FDRjtRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxpQkFBaUIsQ0FBQyxRQUFvQixFQUFFLElBQVk7UUFDMUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRW5ELEtBQUssTUFBTSxRQUFRLElBQUksUUFBUSxFQUFFO1lBQy9CLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7Z0JBQzFCLE9BQU8sUUFBUSxDQUFDO2FBQ2pCO1NBQ0Y7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxnRUFBZ0U7SUFDeEQsd0JBQXdCLENBQUMsTUFBbUM7UUFDbEUsSUFBSSxNQUFNLFlBQVksT0FBTyxFQUFFO1lBQzdCLE9BQU8sTUFBTSxDQUFDO1NBQ2Y7UUFFRCxJQUFJLE1BQU0sWUFBWSxRQUFRLEVBQUU7WUFDOUIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwRCxDQUFDO0NBQ0Y7QUFFRCxTQUFTLHlCQUF5QixDQUFDLFNBQWdCO0lBRWpELE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFvRCxDQUFDO0lBRTlFLFNBQVMsb0JBQW9CLENBQUMsS0FBWTtRQUN4QyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ2pDLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFFLENBQUM7U0FDdkM7UUFFRCxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDO1FBRTVDLElBQUksUUFBeUMsQ0FBQztRQUM5QyxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFO1lBQzlCLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQztTQUN0RjthQUFNO1lBQ0wsUUFBUSxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1NBQ3JDO1FBRUQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3hDLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRCxNQUFNLGVBQWUsR0FBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLE9BQU8sZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDakMsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLEdBQUcsRUFBRyxDQUFDO1FBQ3JDLEtBQUssTUFBTSxVQUFVLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUNuRCxlQUFlLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ2xDO1FBQ0Qsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDN0I7SUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxFQUE0QyxDQUFDO0lBQzdFLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxTQUFTLEVBQUU7UUFDNUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQzVEO0lBQ0QsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNULCBCaW5kaW5nUGlwZSwgSW1wbGljaXRSZWNlaXZlciwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBSZWN1cnNpdmVBc3RWaXNpdG9yLCBTYWZlUHJvcGVydHlSZWFkfSBmcm9tICcuLi8uLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtTZWxlY3Rvck1hdGNoZXJ9IGZyb20gJy4uLy4uL3NlbGVjdG9yJztcbmltcG9ydCB7Qm91bmRBdHRyaWJ1dGUsIEJvdW5kRXZlbnQsIEJvdW5kVGV4dCwgQ29tbWVudCwgQ29udGVudCwgRGVmZXJyZWRCbG9jaywgRGVmZXJyZWRCbG9ja0Vycm9yLCBEZWZlcnJlZEJsb2NrTG9hZGluZywgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyLCBEZWZlcnJlZFRyaWdnZXIsIEVsZW1lbnQsIEZvckxvb3BCbG9jaywgRm9yTG9vcEJsb2NrRW1wdHksIEhvdmVyRGVmZXJyZWRUcmlnZ2VyLCBJY3UsIElmQmxvY2ssIElmQmxvY2tCcmFuY2gsIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyLCBOb2RlLCBSZWZlcmVuY2UsIFN3aXRjaEJsb2NrLCBTd2l0Y2hCbG9ja0Nhc2UsIFRlbXBsYXRlLCBUZXh0LCBUZXh0QXR0cmlidXRlLCBVbmtub3duQmxvY2ssIFZhcmlhYmxlLCBWaWV3cG9ydERlZmVycmVkVHJpZ2dlciwgVmlzaXRvcn0gZnJvbSAnLi4vcjNfYXN0JztcblxuaW1wb3J0IHtCb3VuZFRhcmdldCwgRGlyZWN0aXZlTWV0YSwgUmVmZXJlbmNlVGFyZ2V0LCBTY29wZWROb2RlLCBUYXJnZXQsIFRhcmdldEJpbmRlcn0gZnJvbSAnLi90Ml9hcGknO1xuaW1wb3J0IHtjcmVhdGVDc3NTZWxlY3Rvcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge2dldEF0dHJzRm9yRGlyZWN0aXZlTWF0Y2hpbmd9IGZyb20gJy4vdXRpbCc7XG5cbi8qKlxuICogUHJvY2Vzc2VzIGBUYXJnZXRgcyB3aXRoIGEgZ2l2ZW4gc2V0IG9mIGRpcmVjdGl2ZXMgYW5kIHBlcmZvcm1zIGEgYmluZGluZyBvcGVyYXRpb24sIHdoaWNoXG4gKiByZXR1cm5zIGFuIG9iamVjdCBzaW1pbGFyIHRvIFR5cGVTY3JpcHQncyBgdHMuVHlwZUNoZWNrZXJgIHRoYXQgY29udGFpbnMga25vd2xlZGdlIGFib3V0IHRoZVxuICogdGFyZ2V0LlxuICovXG5leHBvcnQgY2xhc3MgUjNUYXJnZXRCaW5kZXI8RGlyZWN0aXZlVCBleHRlbmRzIERpcmVjdGl2ZU1ldGE+IGltcGxlbWVudHMgVGFyZ2V0QmluZGVyPERpcmVjdGl2ZVQ+IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXI8RGlyZWN0aXZlVFtdPikge31cblxuICAvKipcbiAgICogUGVyZm9ybSBhIGJpbmRpbmcgb3BlcmF0aW9uIG9uIHRoZSBnaXZlbiBgVGFyZ2V0YCBhbmQgcmV0dXJuIGEgYEJvdW5kVGFyZ2V0YCB3aGljaCBjb250YWluc1xuICAgKiBtZXRhZGF0YSBhYm91dCB0aGUgdHlwZXMgcmVmZXJlbmNlZCBpbiB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBiaW5kKHRhcmdldDogVGFyZ2V0KTogQm91bmRUYXJnZXQ8RGlyZWN0aXZlVD4ge1xuICAgIGlmICghdGFyZ2V0LnRlbXBsYXRlKSB7XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IGhhbmRsZSB0YXJnZXRzIHdoaWNoIGNvbnRhaW4gdGhpbmdzIGxpa2UgSG9zdEJpbmRpbmdzLCBldGMuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JpbmRpbmcgd2l0aG91dCBhIHRlbXBsYXRlIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XG4gICAgfVxuXG4gICAgLy8gRmlyc3QsIHBhcnNlIHRoZSB0ZW1wbGF0ZSBpbnRvIGEgYFNjb3BlYCBzdHJ1Y3R1cmUuIFRoaXMgb3BlcmF0aW9uIGNhcHR1cmVzIHRoZSBzeW50YWN0aWNcbiAgICAvLyBzY29wZXMgaW4gdGhlIHRlbXBsYXRlIGFuZCBtYWtlcyB0aGVtIGF2YWlsYWJsZSBmb3IgbGF0ZXIgdXNlLlxuICAgIGNvbnN0IHNjb3BlID0gU2NvcGUuYXBwbHkodGFyZ2V0LnRlbXBsYXRlKTtcblxuICAgIC8vIFVzZSB0aGUgYFNjb3BlYCB0byBleHRyYWN0IHRoZSBlbnRpdGllcyBwcmVzZW50IGF0IGV2ZXJ5IGxldmVsIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICBjb25zdCBzY29wZWROb2RlRW50aXRpZXMgPSBleHRyYWN0U2NvcGVkTm9kZUVudGl0aWVzKHNjb3BlKTtcblxuICAgIC8vIE5leHQsIHBlcmZvcm0gZGlyZWN0aXZlIG1hdGNoaW5nIG9uIHRoZSB0ZW1wbGF0ZSB1c2luZyB0aGUgYERpcmVjdGl2ZUJpbmRlcmAuIFRoaXMgcmV0dXJuczpcbiAgICAvLyAgIC0gZGlyZWN0aXZlczogTWFwIG9mIG5vZGVzIChlbGVtZW50cyAmIG5nLXRlbXBsYXRlcykgdG8gdGhlIGRpcmVjdGl2ZXMgb24gdGhlbS5cbiAgICAvLyAgIC0gYmluZGluZ3M6IE1hcCBvZiBpbnB1dHMsIG91dHB1dHMsIGFuZCBhdHRyaWJ1dGVzIHRvIHRoZSBkaXJlY3RpdmUvZWxlbWVudCB0aGF0IGNsYWltc1xuICAgIC8vICAgICB0aGVtLiBUT0RPKGFseGh1Yik6IGhhbmRsZSBtdWx0aXBsZSBkaXJlY3RpdmVzIGNsYWltaW5nIGFuIGlucHV0L291dHB1dC9ldGMuXG4gICAgLy8gICAtIHJlZmVyZW5jZXM6IE1hcCBvZiAjcmVmZXJlbmNlcyB0byB0aGVpciB0YXJnZXRzLlxuICAgIGNvbnN0IHtkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfSA9XG4gICAgICAgIERpcmVjdGl2ZUJpbmRlci5hcHBseSh0YXJnZXQudGVtcGxhdGUsIHRoaXMuZGlyZWN0aXZlTWF0Y2hlcik7XG4gICAgLy8gRmluYWxseSwgcnVuIHRoZSBUZW1wbGF0ZUJpbmRlciB0byBiaW5kIHJlZmVyZW5jZXMsIHZhcmlhYmxlcywgYW5kIG90aGVyIGVudGl0aWVzIHdpdGhpbiB0aGVcbiAgICAvLyB0ZW1wbGF0ZS4gVGhpcyBleHRyYWN0cyBhbGwgdGhlIG1ldGFkYXRhIHRoYXQgZG9lc24ndCBkZXBlbmQgb24gZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIGNvbnN0IHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXMsIGVhZ2VyUGlwZXMsIGRlZmVyQmxvY2tzfSA9XG4gICAgICAgIFRlbXBsYXRlQmluZGVyLmFwcGx5V2l0aFNjb3BlKHRhcmdldC50ZW1wbGF0ZSwgc2NvcGUpO1xuICAgIHJldHVybiBuZXcgUjNCb3VuZFRhcmdldChcbiAgICAgICAgdGFyZ2V0LCBkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzLCBleHByZXNzaW9ucywgc3ltYm9scyxcbiAgICAgICAgbmVzdGluZ0xldmVsLCBzY29wZWROb2RlRW50aXRpZXMsIHVzZWRQaXBlcywgZWFnZXJQaXBlcywgZGVmZXJCbG9ja3MpO1xuICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGJpbmRpbmcgc2NvcGUgd2l0aGluIGEgdGVtcGxhdGUuXG4gKlxuICogQW55IHZhcmlhYmxlcywgcmVmZXJlbmNlcywgb3Igb3RoZXIgbmFtZWQgZW50aXRpZXMgZGVjbGFyZWQgd2l0aGluIHRoZSB0ZW1wbGF0ZSB3aWxsXG4gKiBiZSBjYXB0dXJlZCBhbmQgYXZhaWxhYmxlIGJ5IG5hbWUgaW4gYG5hbWVkRW50aXRpZXNgLiBBZGRpdGlvbmFsbHksIGNoaWxkIHRlbXBsYXRlcyB3aWxsXG4gKiBiZSBhbmFseXplZCBhbmQgaGF2ZSB0aGVpciBjaGlsZCBgU2NvcGVgcyBhdmFpbGFibGUgaW4gYGNoaWxkU2NvcGVzYC5cbiAqL1xuY2xhc3MgU2NvcGUgaW1wbGVtZW50cyBWaXNpdG9yIHtcbiAgLyoqXG4gICAqIE5hbWVkIG1lbWJlcnMgb2YgdGhlIGBTY29wZWAsIHN1Y2ggYXMgYFJlZmVyZW5jZWBzIG9yIGBWYXJpYWJsZWBzLlxuICAgKi9cbiAgcmVhZG9ubHkgbmFtZWRFbnRpdGllcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG5cbiAgLyoqXG4gICAqIENoaWxkIGBTY29wZWBzIGZvciBpbW1lZGlhdGVseSBuZXN0ZWQgYFNjb3BlZE5vZGVgcy5cbiAgICovXG4gIHJlYWRvbmx5IGNoaWxkU2NvcGVzID0gbmV3IE1hcDxTY29wZWROb2RlLCBTY29wZT4oKTtcblxuICAvKiogV2hldGhlciB0aGlzIHNjb3BlIGlzIGRlZmVycmVkIG9yIGlmIGFueSBvZiBpdHMgYW5jZXN0b3JzIGFyZSBkZWZlcnJlZC4gKi9cbiAgcmVhZG9ubHkgaXNEZWZlcnJlZDogYm9vbGVhbjtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHBhcmVudFNjb3BlOiBTY29wZXxudWxsLCByZWFkb25seSByb290Tm9kZTogU2NvcGVkTm9kZXxudWxsKSB7XG4gICAgdGhpcy5pc0RlZmVycmVkID1cbiAgICAgICAgcGFyZW50U2NvcGUgIT09IG51bGwgJiYgcGFyZW50U2NvcGUuaXNEZWZlcnJlZCA/IHRydWUgOiByb290Tm9kZSBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2s7XG4gIH1cblxuICBzdGF0aWMgbmV3Um9vdFNjb3BlKCk6IFNjb3BlIHtcbiAgICByZXR1cm4gbmV3IFNjb3BlKG51bGwsIG51bGwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSAoZWl0aGVyIGFzIGEgYFRlbXBsYXRlYCBzdWItdGVtcGxhdGUgd2l0aCB2YXJpYWJsZXMsIG9yIGEgcGxhaW4gYXJyYXkgb2ZcbiAgICogdGVtcGxhdGUgYE5vZGVgcykgYW5kIGNvbnN0cnVjdCBpdHMgYFNjb3BlYC5cbiAgICovXG4gIHN0YXRpYyBhcHBseSh0ZW1wbGF0ZTogTm9kZVtdKTogU2NvcGUge1xuICAgIGNvbnN0IHNjb3BlID0gU2NvcGUubmV3Um9vdFNjb3BlKCk7XG4gICAgc2NvcGUuaW5nZXN0KHRlbXBsYXRlKTtcbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHByb2Nlc3MgdGhlIHNjb3BlZCBub2RlIGFuZCBwb3B1bGF0ZSB0aGUgYFNjb3BlYC5cbiAgICovXG4gIHByaXZhdGUgaW5nZXN0KG5vZGVPck5vZGVzOiBTY29wZWROb2RlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBWYXJpYWJsZXMgb24gYW4gPG5nLXRlbXBsYXRlPiBhcmUgZGVmaW5lZCBpbiB0aGUgaW5uZXIgc2NvcGUuXG4gICAgICBub2RlT3JOb2Rlcy52YXJpYWJsZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRWYXJpYWJsZShub2RlKSk7XG5cbiAgICAgIC8vIFByb2Nlc3MgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgSWZCbG9ja0JyYW5jaCkge1xuICAgICAgaWYgKG5vZGVPck5vZGVzLmV4cHJlc3Npb25BbGlhcyAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnZpc2l0VmFyaWFibGUobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICAgIH1cbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRm9yTG9vcEJsb2NrKSB7XG4gICAgICB0aGlzLnZpc2l0VmFyaWFibGUobm9kZU9yTm9kZXMuaXRlbSk7XG4gICAgICBPYmplY3QudmFsdWVzKG5vZGVPck5vZGVzLmNvbnRleHRWYXJpYWJsZXMpLmZvckVhY2godiA9PiB0aGlzLnZpc2l0VmFyaWFibGUodikpO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgU3dpdGNoQmxvY2tDYXNlIHx8IG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRm9yTG9vcEJsb2NrRW1wdHkgfHxcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrIHx8IG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0Vycm9yIHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyIHx8XG4gICAgICAgIG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gb3ZlcmFyY2hpbmcgYFRlbXBsYXRlYCBpbnN0YW5jZSwgc28gcHJvY2VzcyB0aGUgbm9kZXMgZGlyZWN0bHkuXG4gICAgICBub2RlT3JOb2Rlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpIHtcbiAgICAvLyBgRWxlbWVudGBzIGluIHRoZSB0ZW1wbGF0ZSBtYXkgaGF2ZSBgUmVmZXJlbmNlYHMgd2hpY2ggYXJlIGNhcHR1cmVkIGluIHRoZSBzY29wZS5cbiAgICBlbGVtZW50LnJlZmVyZW5jZXMuZm9yRWFjaChub2RlID0+IHRoaXMudmlzaXRSZWZlcmVuY2Uobm9kZSkpO1xuXG4gICAgLy8gUmVjdXJzZSBpbnRvIHRoZSBgRWxlbWVudGAncyBjaGlsZHJlbi5cbiAgICBlbGVtZW50LmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gUmVmZXJlbmNlcyBvbiBhIDxuZy10ZW1wbGF0ZT4gYXJlIGRlZmluZWQgaW4gdGhlIG91dGVyIHNjb3BlLCBzbyBjYXB0dXJlIHRoZW0gYmVmb3JlXG4gICAgLy8gcHJvY2Vzc2luZyB0aGUgdGVtcGxhdGUncyBjaGlsZCBzY29wZS5cbiAgICB0ZW1wbGF0ZS5yZWZlcmVuY2VzLmZvckVhY2gobm9kZSA9PiB0aGlzLnZpc2l0UmVmZXJlbmNlKG5vZGUpKTtcblxuICAgIC8vIE5leHQsIGNyZWF0ZSBhbiBpbm5lciBzY29wZSBhbmQgcHJvY2VzcyB0aGUgdGVtcGxhdGUgd2l0aGluIGl0LlxuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZSh0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIERlY2xhcmUgdGhlIHZhcmlhYmxlIGlmIGl0J3Mgbm90IGFscmVhZHkuXG4gICAgdGhpcy5tYXliZURlY2xhcmUodmFyaWFibGUpO1xuICB9XG5cbiAgdmlzaXRSZWZlcmVuY2UocmVmZXJlbmNlOiBSZWZlcmVuY2UpIHtcbiAgICAvLyBEZWNsYXJlIHRoZSB2YXJpYWJsZSBpZiBpdCdzIG5vdCBhbHJlYWR5LlxuICAgIHRoaXMubWF5YmVEZWNsYXJlKHJlZmVyZW5jZSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoZGVmZXJyZWQpO1xuICAgIGRlZmVycmVkLnBsYWNlaG9sZGVyPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5sb2FkaW5nPy52aXNpdCh0aGlzKTtcbiAgICBkZWZlcnJlZC5lcnJvcj8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcihibG9jazogRGVmZXJyZWRCbG9ja1BsYWNlaG9sZGVyKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja0Vycm9yKGJsb2NrOiBEZWZlcnJlZEJsb2NrRXJyb3IpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9jayhibG9jazogU3dpdGNoQmxvY2spIHtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdFN3aXRjaEJsb2NrQ2FzZShibG9jazogU3dpdGNoQmxvY2tDYXNlKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spIHtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICAgIGJsb2NrLmVtcHR5Py52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrRW1wdHkoYmxvY2s6IEZvckxvb3BCbG9ja0VtcHR5KSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jaykge1xuICAgIGJsb2NrLmJyYW5jaGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICAvLyBVbnVzZWQgdmlzaXRvcnMuXG4gIHZpc2l0Q29udGVudChjb250ZW50OiBDb250ZW50KSB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHI6IEJvdW5kQXR0cmlidXRlKSB7fVxuICB2aXNpdEJvdW5kRXZlbnQoZXZlbnQ6IEJvdW5kRXZlbnQpIHt9XG4gIHZpc2l0Qm91bmRUZXh0KHRleHQ6IEJvdW5kVGV4dCkge31cbiAgdmlzaXRUZXh0KHRleHQ6IFRleHQpIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyOiBUZXh0QXR0cmlidXRlKSB7fVxuICB2aXNpdEljdShpY3U6IEljdSkge31cbiAgdmlzaXREZWZlcnJlZFRyaWdnZXIodHJpZ2dlcjogRGVmZXJyZWRUcmlnZ2VyKSB7fVxuICB2aXNpdFVua25vd25CbG9jayhibG9jazogVW5rbm93bkJsb2NrKSB7fVxuXG4gIHByaXZhdGUgbWF5YmVEZWNsYXJlKHRoaW5nOiBSZWZlcmVuY2V8VmFyaWFibGUpIHtcbiAgICAvLyBEZWNsYXJlIHNvbWV0aGluZyB3aXRoIGEgbmFtZSwgYXMgbG9uZyBhcyB0aGF0IG5hbWUgaXNuJ3QgdGFrZW4uXG4gICAgaWYgKCF0aGlzLm5hbWVkRW50aXRpZXMuaGFzKHRoaW5nLm5hbWUpKSB7XG4gICAgICB0aGlzLm5hbWVkRW50aXRpZXMuc2V0KHRoaW5nLm5hbWUsIHRoaW5nKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIHZhcmlhYmxlIHdpdGhpbiB0aGlzIGBTY29wZWAuXG4gICAqXG4gICAqIFRoaXMgY2FuIHJlY3Vyc2UgaW50byBhIHBhcmVudCBgU2NvcGVgIGlmIGl0J3MgYXZhaWxhYmxlLlxuICAgKi9cbiAgbG9va3VwKG5hbWU6IHN0cmluZyk6IFJlZmVyZW5jZXxWYXJpYWJsZXxudWxsIHtcbiAgICBpZiAodGhpcy5uYW1lZEVudGl0aWVzLmhhcyhuYW1lKSkge1xuICAgICAgLy8gRm91bmQgaW4gdGhlIGxvY2FsIHNjb3BlLlxuICAgICAgcmV0dXJuIHRoaXMubmFtZWRFbnRpdGllcy5nZXQobmFtZSkhO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRTY29wZSAhPT0gbnVsbCkge1xuICAgICAgLy8gTm90IGluIHRoZSBsb2NhbCBzY29wZSwgYnV0IHRoZXJlJ3MgYSBwYXJlbnQgc2NvcGUgc28gY2hlY2sgdGhlcmUuXG4gICAgICByZXR1cm4gdGhpcy5wYXJlbnRTY29wZS5sb29rdXAobmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEF0IHRoZSB0b3AgbGV2ZWwgYW5kIGl0IHdhc24ndCBmb3VuZC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGNoaWxkIHNjb3BlIGZvciBhIGBTY29wZWROb2RlYC5cbiAgICpcbiAgICogVGhpcyBzaG91bGQgYWx3YXlzIGJlIGRlZmluZWQuXG4gICAqL1xuICBnZXRDaGlsZFNjb3BlKG5vZGU6IFNjb3BlZE5vZGUpOiBTY29wZSB7XG4gICAgY29uc3QgcmVzID0gdGhpcy5jaGlsZFNjb3Blcy5nZXQobm9kZSk7XG4gICAgaWYgKHJlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbiBlcnJvcjogY2hpbGQgc2NvcGUgZm9yICR7bm9kZX0gbm90IGZvdW5kYCk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBwcml2YXRlIGluZ2VzdFNjb3BlZE5vZGUobm9kZTogU2NvcGVkTm9kZSkge1xuICAgIGNvbnN0IHNjb3BlID0gbmV3IFNjb3BlKHRoaXMsIG5vZGUpO1xuICAgIHNjb3BlLmluZ2VzdChub2RlKTtcbiAgICB0aGlzLmNoaWxkU2NvcGVzLnNldChub2RlLCBzY29wZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBQcm9jZXNzZXMgYSB0ZW1wbGF0ZSBhbmQgbWF0Y2hlcyBkaXJlY3RpdmVzIG9uIG5vZGVzIChlbGVtZW50cyBhbmQgdGVtcGxhdGVzKS5cbiAqXG4gKiBVc3VhbGx5IHVzZWQgdmlhIHRoZSBzdGF0aWMgYGFwcGx5KClgIG1ldGhvZC5cbiAqL1xuY2xhc3MgRGlyZWN0aXZlQmluZGVyPERpcmVjdGl2ZVQgZXh0ZW5kcyBEaXJlY3RpdmVNZXRhPiBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICAvLyBJbmRpY2F0ZXMgd2hldGhlciB3ZSBhcmUgdmlzaXRpbmcgZWxlbWVudHMgd2l0aGluIGEgYGRlZmVyYCBibG9ja1xuICBwcml2YXRlIGlzSW5EZWZlckJsb2NrID0gZmFsc2U7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgbWF0Y2hlcjogU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+LFxuICAgICAgcHJpdmF0ZSBlYWdlckRpcmVjdGl2ZXM6IERpcmVjdGl2ZVRbXSxcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxCb3VuZEF0dHJpYnV0ZXxCb3VuZEV2ZW50fFRleHRBdHRyaWJ1dGUsIERpcmVjdGl2ZVR8RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIHJlZmVyZW5jZXM6XG4gICAgICAgICAgTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4pIHt9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgYSB0ZW1wbGF0ZSAobGlzdCBvZiBgTm9kZWBzKSBhbmQgcGVyZm9ybSBkaXJlY3RpdmUgbWF0Y2hpbmcgYWdhaW5zdCBlYWNoIG5vZGUuXG4gICAqXG4gICAqIEBwYXJhbSB0ZW1wbGF0ZSB0aGUgbGlzdCBvZiB0ZW1wbGF0ZSBgTm9kZWBzIHRvIG1hdGNoIChyZWN1cnNpdmVseSkuXG4gICAqIEBwYXJhbSBzZWxlY3Rvck1hdGNoZXIgYSBgU2VsZWN0b3JNYXRjaGVyYCBjb250YWluaW5nIHRoZSBkaXJlY3RpdmVzIHRoYXQgYXJlIGluIHNjb3BlIGZvclxuICAgKiB0aGlzIHRlbXBsYXRlLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gaW5mb3JtYXRpb24gYWJvdXQgZGlyZWN0aXZlcyBpbiB0aGUgdGVtcGxhdGU6IHRoZVxuICAgKiBgZGlyZWN0aXZlc2AgbWFwIHdoaWNoIGxpc3RzIGRpcmVjdGl2ZXMgbWF0Y2hlZCBvbiBlYWNoIG5vZGUsIHRoZSBgYmluZGluZ3NgIG1hcCB3aGljaFxuICAgKiBpbmRpY2F0ZXMgd2hpY2ggZGlyZWN0aXZlcyBjbGFpbWVkIHdoaWNoIGJpbmRpbmdzIChpbnB1dHMsIG91dHB1dHMsIGV0YyksIGFuZCB0aGUgYHJlZmVyZW5jZXNgXG4gICAqIG1hcCB3aGljaCByZXNvbHZlcyAjcmVmZXJlbmNlcyAoYFJlZmVyZW5jZWBzKSB3aXRoaW4gdGhlIHRlbXBsYXRlIHRvIHRoZSBuYW1lZCBkaXJlY3RpdmUgb3JcbiAgICogdGVtcGxhdGUgbm9kZS5cbiAgICovXG4gIHN0YXRpYyBhcHBseTxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4oXG4gICAgICB0ZW1wbGF0ZTogTm9kZVtdLCBzZWxlY3Rvck1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVUW10+KToge1xuICAgIGRpcmVjdGl2ZXM6IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+LFxuICAgIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgIGJpbmRpbmdzOiBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlLCBEaXJlY3RpdmVUfEVsZW1lbnR8VGVtcGxhdGU+LFxuICAgIHJlZmVyZW5jZXM6IE1hcDxSZWZlcmVuY2UsIHtkaXJlY3RpdmU6IERpcmVjdGl2ZVQsIG5vZGU6IEVsZW1lbnR8VGVtcGxhdGV9fEVsZW1lbnR8VGVtcGxhdGU+LFxuICB9IHtcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gbmV3IE1hcDxFbGVtZW50fFRlbXBsYXRlLCBEaXJlY3RpdmVUW10+KCk7XG4gICAgY29uc3QgYmluZGluZ3MgPVxuICAgICAgICBuZXcgTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IHJlZmVyZW5jZXMgPVxuICAgICAgICBuZXcgTWFwPFJlZmVyZW5jZSwge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudCB8IFRlbXBsYXRlfXxFbGVtZW50fFRlbXBsYXRlPigpO1xuICAgIGNvbnN0IGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgY29uc3QgbWF0Y2hlciA9XG4gICAgICAgIG5ldyBEaXJlY3RpdmVCaW5kZXIoc2VsZWN0b3JNYXRjaGVyLCBkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzKTtcbiAgICBtYXRjaGVyLmluZ2VzdCh0ZW1wbGF0ZSk7XG4gICAgcmV0dXJuIHtkaXJlY3RpdmVzLCBlYWdlckRpcmVjdGl2ZXMsIGJpbmRpbmdzLCByZWZlcmVuY2VzfTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0KHRlbXBsYXRlOiBOb2RlW10pOiB2b2lkIHtcbiAgICB0ZW1wbGF0ZS5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogRWxlbWVudCk6IHZvaWQge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xuICB9XG5cbiAgdmlzaXRUZW1wbGF0ZSh0ZW1wbGF0ZTogVGVtcGxhdGUpOiB2b2lkIHtcbiAgICB0aGlzLnZpc2l0RWxlbWVudE9yVGVtcGxhdGUoJ25nLXRlbXBsYXRlJywgdGVtcGxhdGUpO1xuICB9XG5cbiAgdmlzaXRFbGVtZW50T3JUZW1wbGF0ZShlbGVtZW50TmFtZTogc3RyaW5nLCBub2RlOiBFbGVtZW50fFRlbXBsYXRlKTogdm9pZCB7XG4gICAgLy8gRmlyc3QsIGRldGVybWluZSB0aGUgSFRNTCBzaGFwZSBvZiB0aGUgbm9kZSBmb3IgdGhlIHB1cnBvc2Ugb2YgZGlyZWN0aXZlIG1hdGNoaW5nLlxuICAgIC8vIERvIHRoaXMgYnkgYnVpbGRpbmcgdXAgYSBgQ3NzU2VsZWN0b3JgIGZvciB0aGUgbm9kZS5cbiAgICBjb25zdCBjc3NTZWxlY3RvciA9IGNyZWF0ZUNzc1NlbGVjdG9yKGVsZW1lbnROYW1lLCBnZXRBdHRyc0ZvckRpcmVjdGl2ZU1hdGNoaW5nKG5vZGUpKTtcblxuICAgIC8vIE5leHQsIHVzZSB0aGUgYFNlbGVjdG9yTWF0Y2hlcmAgdG8gZ2V0IHRoZSBsaXN0IG9mIGRpcmVjdGl2ZXMgb24gdGhlIG5vZGUuXG4gICAgY29uc3QgZGlyZWN0aXZlczogRGlyZWN0aXZlVFtdID0gW107XG4gICAgdGhpcy5tYXRjaGVyLm1hdGNoKGNzc1NlbGVjdG9yLCAoX3NlbGVjdG9yLCByZXN1bHRzKSA9PiBkaXJlY3RpdmVzLnB1c2goLi4ucmVzdWx0cykpO1xuICAgIGlmIChkaXJlY3RpdmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZGlyZWN0aXZlcy5zZXQobm9kZSwgZGlyZWN0aXZlcyk7XG4gICAgICBpZiAoIXRoaXMuaXNJbkRlZmVyQmxvY2spIHtcbiAgICAgICAgdGhpcy5lYWdlckRpcmVjdGl2ZXMucHVzaCguLi5kaXJlY3RpdmVzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFueSByZWZlcmVuY2VzIHRoYXQgYXJlIGNyZWF0ZWQgb24gdGhpcyBub2RlLlxuICAgIG5vZGUucmVmZXJlbmNlcy5mb3JFYWNoKHJlZiA9PiB7XG4gICAgICBsZXQgZGlyVGFyZ2V0OiBEaXJlY3RpdmVUfG51bGwgPSBudWxsO1xuXG4gICAgICAvLyBJZiB0aGUgcmVmZXJlbmNlIGV4cHJlc3Npb24gaXMgZW1wdHksIHRoZW4gaXQgbWF0Y2hlcyB0aGUgXCJwcmltYXJ5XCIgZGlyZWN0aXZlIG9uIHRoZSBub2RlXG4gICAgICAvLyAoaWYgdGhlcmUgaXMgb25lKS4gT3RoZXJ3aXNlIGl0IG1hdGNoZXMgdGhlIGhvc3Qgbm9kZSBpdHNlbGYgKGVpdGhlciBhbiBlbGVtZW50IG9yXG4gICAgICAvLyA8bmctdGVtcGxhdGU+IG5vZGUpLlxuICAgICAgaWYgKHJlZi52YWx1ZS50cmltKCkgPT09ICcnKSB7XG4gICAgICAgIC8vIFRoaXMgY291bGQgYmUgYSByZWZlcmVuY2UgdG8gYSBjb21wb25lbnQgaWYgdGhlcmUgaXMgb25lLlxuICAgICAgICBkaXJUYXJnZXQgPSBkaXJlY3RpdmVzLmZpbmQoZGlyID0+IGRpci5pc0NvbXBvbmVudCkgfHwgbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgc2hvdWxkIGJlIGEgcmVmZXJlbmNlIHRvIGEgZGlyZWN0aXZlIGV4cG9ydGVkIHZpYSBleHBvcnRBcy5cbiAgICAgICAgZGlyVGFyZ2V0ID1cbiAgICAgICAgICAgIGRpcmVjdGl2ZXMuZmluZChcbiAgICAgICAgICAgICAgICBkaXIgPT4gZGlyLmV4cG9ydEFzICE9PSBudWxsICYmIGRpci5leHBvcnRBcy5zb21lKHZhbHVlID0+IHZhbHVlID09PSByZWYudmFsdWUpKSB8fFxuICAgICAgICAgICAgbnVsbDtcbiAgICAgICAgLy8gQ2hlY2sgaWYgYSBtYXRjaGluZyBkaXJlY3RpdmUgd2FzIGZvdW5kLlxuICAgICAgICBpZiAoZGlyVGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgICAgLy8gTm8gbWF0Y2hpbmcgZGlyZWN0aXZlIHdhcyBmb3VuZCAtIHRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byBhbiB1bmtub3duIHRhcmdldC4gTGVhdmUgaXRcbiAgICAgICAgICAvLyB1bm1hcHBlZC5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGRpclRhcmdldCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBUaGlzIHJlZmVyZW5jZSBwb2ludHMgdG8gYSBkaXJlY3RpdmUuXG4gICAgICAgIHRoaXMucmVmZXJlbmNlcy5zZXQocmVmLCB7ZGlyZWN0aXZlOiBkaXJUYXJnZXQsIG5vZGV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIHBvaW50cyB0byB0aGUgbm9kZSBpdHNlbGYuXG4gICAgICAgIHRoaXMucmVmZXJlbmNlcy5zZXQocmVmLCBub2RlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFzc29jaWF0ZSBhdHRyaWJ1dGVzL2JpbmRpbmdzIG9uIHRoZSBub2RlIHdpdGggZGlyZWN0aXZlcyBvciB3aXRoIHRoZSBub2RlIGl0c2VsZi5cbiAgICB0eXBlIEJvdW5kTm9kZSA9IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZTtcbiAgICBjb25zdCBzZXRBdHRyaWJ1dGVCaW5kaW5nID1cbiAgICAgICAgKGF0dHJpYnV0ZTogQm91bmROb2RlLCBpb1R5cGU6IGtleW9mIFBpY2s8RGlyZWN0aXZlTWV0YSwgJ2lucHV0cyd8J291dHB1dHMnPikgPT4ge1xuICAgICAgICAgIGNvbnN0IGRpciA9IGRpcmVjdGl2ZXMuZmluZChkaXIgPT4gZGlyW2lvVHlwZV0uaGFzQmluZGluZ1Byb3BlcnR5TmFtZShhdHRyaWJ1dGUubmFtZSkpO1xuICAgICAgICAgIGNvbnN0IGJpbmRpbmcgPSBkaXIgIT09IHVuZGVmaW5lZCA/IGRpciA6IG5vZGU7XG4gICAgICAgICAgdGhpcy5iaW5kaW5ncy5zZXQoYXR0cmlidXRlLCBiaW5kaW5nKTtcbiAgICAgICAgfTtcblxuICAgIC8vIE5vZGUgaW5wdXRzIChib3VuZCBhdHRyaWJ1dGVzKSBhbmQgdGV4dCBhdHRyaWJ1dGVzIGNhbiBiZSBib3VuZCB0byBhblxuICAgIC8vIGlucHV0IG9uIGEgZGlyZWN0aXZlLlxuICAgIG5vZGUuaW5wdXRzLmZvckVhY2goaW5wdXQgPT4gc2V0QXR0cmlidXRlQmluZGluZyhpbnB1dCwgJ2lucHV0cycpKTtcbiAgICBub2RlLmF0dHJpYnV0ZXMuZm9yRWFjaChhdHRyID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcoYXR0ciwgJ2lucHV0cycpKTtcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICBub2RlLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChhdHRyID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcoYXR0ciwgJ2lucHV0cycpKTtcbiAgICB9XG4gICAgLy8gTm9kZSBvdXRwdXRzIChib3VuZCBldmVudHMpIGNhbiBiZSBib3VuZCB0byBhbiBvdXRwdXQgb24gYSBkaXJlY3RpdmUuXG4gICAgbm9kZS5vdXRwdXRzLmZvckVhY2gob3V0cHV0ID0+IHNldEF0dHJpYnV0ZUJpbmRpbmcob3V0cHV0LCAnb3V0cHV0cycpKTtcblxuICAgIC8vIFJlY3Vyc2UgaW50byB0aGUgbm9kZSdzIGNoaWxkcmVuLlxuICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spOiB2b2lkIHtcbiAgICBjb25zdCB3YXNJbkRlZmVyQmxvY2sgPSB0aGlzLmlzSW5EZWZlckJsb2NrO1xuICAgIHRoaXMuaXNJbkRlZmVyQmxvY2sgPSB0cnVlO1xuICAgIGRlZmVycmVkLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICAgIHRoaXMuaXNJbkRlZmVyQmxvY2sgPSB3YXNJbkRlZmVyQmxvY2s7XG5cbiAgICBkZWZlcnJlZC5wbGFjZWhvbGRlcj8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQubG9hZGluZz8udmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQuZXJyb3I/LnZpc2l0KHRoaXMpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcik6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrRXJyb3IoYmxvY2s6IERlZmVycmVkQmxvY2tFcnJvcik6IHZvaWQge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrTG9hZGluZyhibG9jazogRGVmZXJyZWRCbG9ja0xvYWRpbmcpOiB2b2lkIHtcbiAgICBibG9jay5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IGNoaWxkLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suY2FzZXMuZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgdmlzaXRTd2l0Y2hCbG9ja0Nhc2UoYmxvY2s6IFN3aXRjaEJsb2NrQ2FzZSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0Rm9yTG9vcEJsb2NrKGJsb2NrOiBGb3JMb29wQmxvY2spIHtcbiAgICBibG9jay5pdGVtLnZpc2l0KHRoaXMpO1xuICAgIE9iamVjdC52YWx1ZXMoYmxvY2suY29udGV4dFZhcmlhYmxlcykuZm9yRWFjaCh2ID0+IHYudmlzaXQodGhpcykpO1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIGJsb2NrLmNoaWxkcmVuLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9jayhibG9jazogSWZCbG9jaykge1xuICAgIGJsb2NrLmJyYW5jaGVzLmZvckVhY2gobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIHZpc2l0SWZCbG9ja0JyYW5jaChibG9jazogSWZCbG9ja0JyYW5jaCkge1xuICAgIGJsb2NrLmV4cHJlc3Npb25BbGlhcz8udmlzaXQodGhpcyk7XG4gICAgYmxvY2suY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICB9XG5cbiAgLy8gVW51c2VkIHZpc2l0b3JzLlxuICB2aXNpdENvbnRlbnQoY29udGVudDogQ29udGVudCk6IHZvaWQge31cbiAgdmlzaXRWYXJpYWJsZSh2YXJpYWJsZTogVmFyaWFibGUpOiB2b2lkIHt9XG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKTogdm9pZCB7fVxuICB2aXNpdFRleHRBdHRyaWJ1dGUoYXR0cmlidXRlOiBUZXh0QXR0cmlidXRlKTogdm9pZCB7fVxuICB2aXNpdEJvdW5kQXR0cmlidXRlKGF0dHJpYnV0ZTogQm91bmRBdHRyaWJ1dGUpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRFdmVudChhdHRyaWJ1dGU6IEJvdW5kRXZlbnQpOiB2b2lkIHt9XG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGVPckV2ZW50KG5vZGU6IEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnQpIHt9XG4gIHZpc2l0VGV4dCh0ZXh0OiBUZXh0KTogdm9pZCB7fVxuICB2aXNpdEJvdW5kVGV4dCh0ZXh0OiBCb3VuZFRleHQpOiB2b2lkIHt9XG4gIHZpc2l0SWN1KGljdTogSWN1KTogdm9pZCB7fVxuICB2aXNpdERlZmVycmVkVHJpZ2dlcih0cmlnZ2VyOiBEZWZlcnJlZFRyaWdnZXIpOiB2b2lkIHt9XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spIHt9XG59XG5cbi8qKlxuICogUHJvY2Vzc2VzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICpcbiAqIFRoaXMgaXMgYSBjb21wYW5pb24gdG8gdGhlIGBEaXJlY3RpdmVCaW5kZXJgIHRoYXQgZG9lc24ndCByZXF1aXJlIGtub3dsZWRnZSBvZiBkaXJlY3RpdmVzIG1hdGNoZWRcbiAqIHdpdGhpbiB0aGUgdGVtcGxhdGUgaW4gb3JkZXIgdG8gb3BlcmF0ZS5cbiAqXG4gKiBFeHByZXNzaW9ucyBhcmUgdmlzaXRlZCBieSB0aGUgc3VwZXJjbGFzcyBgUmVjdXJzaXZlQXN0VmlzaXRvcmAsIHdpdGggY3VzdG9tIGxvZ2ljIHByb3ZpZGVkXG4gKiBieSBvdmVycmlkZGVuIG1ldGhvZHMgZnJvbSB0aGF0IHZpc2l0b3IuXG4gKi9cbmNsYXNzIFRlbXBsYXRlQmluZGVyIGV4dGVuZHMgUmVjdXJzaXZlQXN0VmlzaXRvciBpbXBsZW1lbnRzIFZpc2l0b3Ige1xuICBwcml2YXRlIHZpc2l0Tm9kZTogKG5vZGU6IE5vZGUpID0+IHZvaWQ7XG5cbiAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgYmluZGluZ3M6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgICBwcml2YXRlIHN5bWJvbHM6IE1hcDxSZWZlcmVuY2V8VmFyaWFibGUsIFNjb3BlZE5vZGU+LCBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIGVhZ2VyUGlwZXM6IFNldDxzdHJpbmc+LCBwcml2YXRlIGRlZmVyQmxvY2tzOiBTZXQ8RGVmZXJyZWRCbG9jaz4sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sIHByaXZhdGUgc2NvcGU6IFNjb3BlLFxuICAgICAgcHJpdmF0ZSByb290Tm9kZTogU2NvcGVkTm9kZXxudWxsLCBwcml2YXRlIGxldmVsOiBudW1iZXIpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgLy8gU2F2ZSBhIGJpdCBvZiBwcm9jZXNzaW5nIHRpbWUgYnkgY29uc3RydWN0aW5nIHRoaXMgY2xvc3VyZSBpbiBhZHZhbmNlLlxuICAgIHRoaXMudmlzaXROb2RlID0gKG5vZGU6IE5vZGUpID0+IG5vZGUudmlzaXQodGhpcyk7XG4gIH1cblxuICAvLyBUaGlzIG1ldGhvZCBpcyBkZWZpbmVkIHRvIHJlY29uY2lsZSB0aGUgdHlwZSBvZiBUZW1wbGF0ZUJpbmRlciBzaW5jZSBib3RoXG4gIC8vIFJlY3Vyc2l2ZUFzdFZpc2l0b3IgYW5kIFZpc2l0b3IgZGVmaW5lIHRoZSB2aXNpdCgpIG1ldGhvZCBpbiB0aGVpclxuICAvLyBpbnRlcmZhY2VzLlxuICBvdmVycmlkZSB2aXNpdChub2RlOiBBU1R8Tm9kZSwgY29udGV4dD86IGFueSkge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgQVNUKSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMsIGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLnZpc2l0KHRoaXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgdGVtcGxhdGUgYW5kIGV4dHJhY3QgbWV0YWRhdGEgYWJvdXQgZXhwcmVzc2lvbnMgYW5kIHN5bWJvbHMgd2l0aGluLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZXMgdGhlIG5vZGVzIG9mIHRoZSB0ZW1wbGF0ZSB0byBwcm9jZXNzXG4gICAqIEBwYXJhbSBzY29wZSB0aGUgYFNjb3BlYCBvZiB0aGUgdGVtcGxhdGUgYmVpbmcgcHJvY2Vzc2VkLlxuICAgKiBAcmV0dXJucyB0aHJlZSBtYXBzIHdoaWNoIGNvbnRhaW4gbWV0YWRhdGEgYWJvdXQgdGhlIHRlbXBsYXRlOiBgZXhwcmVzc2lvbnNgIHdoaWNoIGludGVycHJldHNcbiAgICogc3BlY2lhbCBgQVNUYCBub2RlcyBpbiBleHByZXNzaW9ucyBhcyBwb2ludGluZyB0byByZWZlcmVuY2VzIG9yIHZhcmlhYmxlcyBkZWNsYXJlZCB3aXRoaW4gdGhlXG4gICAqIHRlbXBsYXRlLCBgc3ltYm9sc2Agd2hpY2ggbWFwcyB0aG9zZSB2YXJpYWJsZXMgYW5kIHJlZmVyZW5jZXMgdG8gdGhlIG5lc3RlZCBgVGVtcGxhdGVgIHdoaWNoXG4gICAqIGRlY2xhcmVzIHRoZW0sIGlmIGFueSwgYW5kIGBuZXN0aW5nTGV2ZWxgIHdoaWNoIGFzc29jaWF0ZXMgZWFjaCBgVGVtcGxhdGVgIHdpdGggYSBpbnRlZ2VyXG4gICAqIG5lc3RpbmcgbGV2ZWwgKGhvdyBtYW55IGxldmVscyBkZWVwIHdpdGhpbiB0aGUgdGVtcGxhdGUgc3RydWN0dXJlIHRoZSBgVGVtcGxhdGVgIGlzKSwgc3RhcnRpbmdcbiAgICogYXQgMS5cbiAgICovXG4gIHN0YXRpYyBhcHBseVdpdGhTY29wZShub2RlczogTm9kZVtdLCBzY29wZTogU2NvcGUpOiB7XG4gICAgZXhwcmVzc2lvbnM6IE1hcDxBU1QsIFJlZmVyZW5jZXxWYXJpYWJsZT4sXG4gICAgc3ltYm9sczogTWFwPFZhcmlhYmxlfFJlZmVyZW5jZSwgVGVtcGxhdGU+LFxuICAgIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgdXNlZFBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICBlYWdlclBpcGVzOiBTZXQ8c3RyaW5nPixcbiAgICBkZWZlckJsb2NrczogU2V0PERlZmVycmVkQmxvY2s+LFxuICB9IHtcbiAgICBjb25zdCBleHByZXNzaW9ucyA9IG5ldyBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+KCk7XG4gICAgY29uc3Qgc3ltYm9scyA9IG5ldyBNYXA8VmFyaWFibGV8UmVmZXJlbmNlLCBUZW1wbGF0ZT4oKTtcbiAgICBjb25zdCBuZXN0aW5nTGV2ZWwgPSBuZXcgTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4oKTtcbiAgICBjb25zdCB1c2VkUGlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBlYWdlclBpcGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgY29uc3QgdGVtcGxhdGUgPSBub2RlcyBpbnN0YW5jZW9mIFRlbXBsYXRlID8gbm9kZXMgOiBudWxsO1xuICAgIGNvbnN0IGRlZmVyQmxvY2tzID0gbmV3IFNldDxEZWZlcnJlZEJsb2NrPigpO1xuICAgIC8vIFRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUgaGFzIG5lc3RpbmcgbGV2ZWwgMC5cbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIGV4cHJlc3Npb25zLCBzeW1ib2xzLCB1c2VkUGlwZXMsIGVhZ2VyUGlwZXMsIGRlZmVyQmxvY2tzLCBuZXN0aW5nTGV2ZWwsIHNjb3BlLCB0ZW1wbGF0ZSwgMCk7XG4gICAgYmluZGVyLmluZ2VzdChub2Rlcyk7XG4gICAgcmV0dXJuIHtleHByZXNzaW9ucywgc3ltYm9scywgbmVzdGluZ0xldmVsLCB1c2VkUGlwZXMsIGVhZ2VyUGlwZXMsIGRlZmVyQmxvY2tzfTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0KG5vZGVPck5vZGVzOiBTY29wZWROb2RlfE5vZGVbXSk6IHZvaWQge1xuICAgIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIFRlbXBsYXRlKSB7XG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMsIHByb2Nlc3Mgb25seSB2YXJpYWJsZXMgYW5kIGNoaWxkIG5vZGVzLiBJbnB1dHMsIG91dHB1dHMsIHRlbXBsYXRlQXR0cnMsXG4gICAgICAvLyBhbmQgcmVmZXJlbmNlcyB3ZXJlIGFsbCBwcm9jZXNzZWQgaW4gdGhlIHNjb3BlIG9mIHRoZSBjb250YWluaW5nIHRlbXBsYXRlLlxuICAgICAgbm9kZU9yTm9kZXMudmFyaWFibGVzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAgIC8vIFNldCB0aGUgbmVzdGluZyBsZXZlbC5cbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIGlmIChub2RlT3JOb2RlcyBpbnN0YW5jZW9mIElmQmxvY2tCcmFuY2gpIHtcbiAgICAgIGlmIChub2RlT3JOb2Rlcy5leHByZXNzaW9uQWxpYXMgIT09IG51bGwpIHtcbiAgICAgICAgdGhpcy52aXNpdE5vZGUobm9kZU9yTm9kZXMuZXhwcmVzc2lvbkFsaWFzKTtcbiAgICAgIH1cbiAgICAgIG5vZGVPck5vZGVzLmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2UgaWYgKG5vZGVPck5vZGVzIGluc3RhbmNlb2YgRm9yTG9vcEJsb2NrKSB7XG4gICAgICB0aGlzLnZpc2l0Tm9kZShub2RlT3JOb2Rlcy5pdGVtKTtcbiAgICAgIE9iamVjdC52YWx1ZXMobm9kZU9yTm9kZXMuY29udGV4dFZhcmlhYmxlcykuZm9yRWFjaCh2ID0+IHRoaXMudmlzaXROb2RlKHYpKTtcbiAgICAgIG5vZGVPck5vZGVzLnRyYWNrQnkudmlzaXQodGhpcyk7XG4gICAgICBub2RlT3JOb2Rlcy5jaGlsZHJlbi5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICAgIHRoaXMubmVzdGluZ0xldmVsLnNldChub2RlT3JOb2RlcywgdGhpcy5sZXZlbCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBTd2l0Y2hCbG9ja0Nhc2UgfHwgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBGb3JMb29wQmxvY2tFbXB0eSB8fFxuICAgICAgICBub2RlT3JOb2RlcyBpbnN0YW5jZW9mIERlZmVycmVkQmxvY2sgfHwgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrRXJyb3IgfHxcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIgfHxcbiAgICAgICAgbm9kZU9yTm9kZXMgaW5zdGFuY2VvZiBEZWZlcnJlZEJsb2NrTG9hZGluZykge1xuICAgICAgbm9kZU9yTm9kZXMuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwuc2V0KG5vZGVPck5vZGVzLCB0aGlzLmxldmVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVmlzaXQgZWFjaCBub2RlIGZyb20gdGhlIHRvcC1sZXZlbCB0ZW1wbGF0ZS5cbiAgICAgIG5vZGVPck5vZGVzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0RWxlbWVudChlbGVtZW50OiBFbGVtZW50KSB7XG4gICAgLy8gVmlzaXQgdGhlIGlucHV0cywgb3V0cHV0cywgYW5kIGNoaWxkcmVuIG9mIHRoZSBlbGVtZW50LlxuICAgIGVsZW1lbnQuaW5wdXRzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIGVsZW1lbnQub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICBlbGVtZW50LmNoaWxkcmVuLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIGVsZW1lbnQucmVmZXJlbmNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0VGVtcGxhdGUodGVtcGxhdGU6IFRlbXBsYXRlKSB7XG4gICAgLy8gRmlyc3QsIHZpc2l0IGlucHV0cywgb3V0cHV0cyBhbmQgdGVtcGxhdGUgYXR0cmlidXRlcyBvZiB0aGUgdGVtcGxhdGUgbm9kZS5cbiAgICB0ZW1wbGF0ZS5pbnB1dHMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG4gICAgdGVtcGxhdGUub3V0cHV0cy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgICB0ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzLmZvckVhY2godGhpcy52aXNpdE5vZGUpO1xuICAgIHRlbXBsYXRlLnJlZmVyZW5jZXMuZm9yRWFjaCh0aGlzLnZpc2l0Tm9kZSk7XG5cbiAgICAvLyBOZXh0LCByZWN1cnNlIGludG8gdGhlIHRlbXBsYXRlLlxuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZSh0ZW1wbGF0ZSk7XG4gIH1cblxuICB2aXNpdFZhcmlhYmxlKHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuICAgIC8vIFJlZ2lzdGVyIHRoZSBgVmFyaWFibGVgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMucm9vdE5vZGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQodmFyaWFibGUsIHRoaXMucm9vdE5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0UmVmZXJlbmNlKHJlZmVyZW5jZTogUmVmZXJlbmNlKSB7XG4gICAgLy8gUmVnaXN0ZXIgdGhlIGBSZWZlcmVuY2VgIGFzIGEgc3ltYm9sIGluIHRoZSBjdXJyZW50IGBUZW1wbGF0ZWAuXG4gICAgaWYgKHRoaXMucm9vdE5vZGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3ltYm9scy5zZXQocmVmZXJlbmNlLCB0aGlzLnJvb3ROb2RlKTtcbiAgICB9XG4gIH1cblxuICAvLyBVbnVzZWQgdGVtcGxhdGUgdmlzaXRvcnNcblxuICB2aXNpdFRleHQodGV4dDogVGV4dCkge31cbiAgdmlzaXRDb250ZW50KGNvbnRlbnQ6IENvbnRlbnQpIHt9XG4gIHZpc2l0VGV4dEF0dHJpYnV0ZShhdHRyaWJ1dGU6IFRleHRBdHRyaWJ1dGUpIHt9XG4gIHZpc2l0VW5rbm93bkJsb2NrKGJsb2NrOiBVbmtub3duQmxvY2spIHt9XG4gIHZpc2l0RGVmZXJyZWRUcmlnZ2VyKCk6IHZvaWQge31cbiAgdmlzaXRJY3UoaWN1OiBJY3UpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyhpY3UudmFycykuZm9yRWFjaChrZXkgPT4gaWN1LnZhcnNba2V5XS52aXNpdCh0aGlzKSk7XG4gICAgT2JqZWN0LmtleXMoaWN1LnBsYWNlaG9sZGVycykuZm9yRWFjaChrZXkgPT4gaWN1LnBsYWNlaG9sZGVyc1trZXldLnZpc2l0KHRoaXMpKTtcbiAgfVxuXG4gIC8vIFRoZSByZW1haW5pbmcgdmlzaXRvcnMgYXJlIGNvbmNlcm5lZCB3aXRoIHByb2Nlc3NpbmcgQVNUIGV4cHJlc3Npb25zIHdpdGhpbiB0ZW1wbGF0ZSBiaW5kaW5nc1xuXG4gIHZpc2l0Qm91bmRBdHRyaWJ1dGUoYXR0cmlidXRlOiBCb3VuZEF0dHJpYnV0ZSkge1xuICAgIGF0dHJpYnV0ZS52YWx1ZS52aXNpdCh0aGlzKTtcbiAgfVxuXG4gIHZpc2l0Qm91bmRFdmVudChldmVudDogQm91bmRFdmVudCkge1xuICAgIGV2ZW50LmhhbmRsZXIudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2soZGVmZXJyZWQ6IERlZmVycmVkQmxvY2spIHtcbiAgICB0aGlzLmRlZmVyQmxvY2tzLmFkZChkZWZlcnJlZCk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGRlZmVycmVkKTtcblxuICAgIGRlZmVycmVkLnRyaWdnZXJzLndoZW4/LnZhbHVlLnZpc2l0KHRoaXMpO1xuICAgIGRlZmVycmVkLnByZWZldGNoVHJpZ2dlcnMud2hlbj8udmFsdWUudmlzaXQodGhpcyk7XG4gICAgZGVmZXJyZWQucGxhY2Vob2xkZXIgJiYgdGhpcy52aXNpdE5vZGUoZGVmZXJyZWQucGxhY2Vob2xkZXIpO1xuICAgIGRlZmVycmVkLmxvYWRpbmcgJiYgdGhpcy52aXNpdE5vZGUoZGVmZXJyZWQubG9hZGluZyk7XG4gICAgZGVmZXJyZWQuZXJyb3IgJiYgdGhpcy52aXNpdE5vZGUoZGVmZXJyZWQuZXJyb3IpO1xuICB9XG5cbiAgdmlzaXREZWZlcnJlZEJsb2NrUGxhY2Vob2xkZXIoYmxvY2s6IERlZmVycmVkQmxvY2tQbGFjZWhvbGRlcikge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdERlZmVycmVkQmxvY2tFcnJvcihibG9jazogRGVmZXJyZWRCbG9ja0Vycm9yKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0RGVmZXJyZWRCbG9ja0xvYWRpbmcoYmxvY2s6IERlZmVycmVkQmxvY2tMb2FkaW5nKSB7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2soYmxvY2s6IFN3aXRjaEJsb2NrKSB7XG4gICAgYmxvY2suZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgICBibG9jay5jYXNlcy5mb3JFYWNoKHRoaXMudmlzaXROb2RlKTtcbiAgfVxuXG4gIHZpc2l0U3dpdGNoQmxvY2tDYXNlKGJsb2NrOiBTd2l0Y2hCbG9ja0Nhc2UpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRGb3JMb29wQmxvY2soYmxvY2s6IEZvckxvb3BCbG9jaykge1xuICAgIGJsb2NrLmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gICAgdGhpcy5pbmdlc3RTY29wZWROb2RlKGJsb2NrKTtcbiAgICBibG9jay5lbXB0eT8udmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdEZvckxvb3BCbG9ja0VtcHR5KGJsb2NrOiBGb3JMb29wQmxvY2tFbXB0eSkge1xuICAgIHRoaXMuaW5nZXN0U2NvcGVkTm9kZShibG9jayk7XG4gIH1cblxuICB2aXNpdElmQmxvY2soYmxvY2s6IElmQmxvY2spIHtcbiAgICBibG9jay5icmFuY2hlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB2aXNpdElmQmxvY2tCcmFuY2goYmxvY2s6IElmQmxvY2tCcmFuY2gpIHtcbiAgICBibG9jay5leHByZXNzaW9uPy52aXNpdCh0aGlzKTtcbiAgICB0aGlzLmluZ2VzdFNjb3BlZE5vZGUoYmxvY2spO1xuICB9XG5cbiAgdmlzaXRCb3VuZFRleHQodGV4dDogQm91bmRUZXh0KSB7XG4gICAgdGV4dC52YWx1ZS52aXNpdCh0aGlzKTtcbiAgfVxuICBvdmVycmlkZSB2aXNpdFBpcGUoYXN0OiBCaW5kaW5nUGlwZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLnVzZWRQaXBlcy5hZGQoYXN0Lm5hbWUpO1xuICAgIGlmICghdGhpcy5zY29wZS5pc0RlZmVycmVkKSB7XG4gICAgICB0aGlzLmVhZ2VyUGlwZXMuYWRkKGFzdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UGlwZShhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgLy8gVGhlc2UgZml2ZSB0eXBlcyBvZiBBU1QgZXhwcmVzc2lvbnMgY2FuIHJlZmVyIHRvIGV4cHJlc3Npb24gcm9vdHMsIHdoaWNoIGNvdWxkIGJlIHZhcmlhYmxlc1xuICAvLyBvciByZWZlcmVuY2VzIGluIHRoZSBjdXJyZW50IHNjb3BlLlxuXG4gIG92ZXJyaWRlIHZpc2l0UHJvcGVydHlSZWFkKGFzdDogUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0UHJvcGVydHlSZWFkKGFzdCwgY29udGV4dCk7XG4gIH1cblxuICBvdmVycmlkZSB2aXNpdFNhZmVQcm9wZXJ0eVJlYWQoYXN0OiBTYWZlUHJvcGVydHlSZWFkLCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMubWF5YmVNYXAoYXN0LCBhc3QubmFtZSk7XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0U2FmZVByb3BlcnR5UmVhZChhc3QsIGNvbnRleHQpO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSwgY29udGV4dDogYW55KTogYW55IHtcbiAgICB0aGlzLm1heWJlTWFwKGFzdCwgYXN0Lm5hbWUpO1xuICAgIHJldHVybiBzdXBlci52aXNpdFByb3BlcnR5V3JpdGUoYXN0LCBjb250ZXh0KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5nZXN0U2NvcGVkTm9kZShub2RlOiBTY29wZWROb2RlKSB7XG4gICAgY29uc3QgY2hpbGRTY29wZSA9IHRoaXMuc2NvcGUuZ2V0Q2hpbGRTY29wZShub2RlKTtcbiAgICBjb25zdCBiaW5kZXIgPSBuZXcgVGVtcGxhdGVCaW5kZXIoXG4gICAgICAgIHRoaXMuYmluZGluZ3MsIHRoaXMuc3ltYm9scywgdGhpcy51c2VkUGlwZXMsIHRoaXMuZWFnZXJQaXBlcywgdGhpcy5kZWZlckJsb2NrcyxcbiAgICAgICAgdGhpcy5uZXN0aW5nTGV2ZWwsIGNoaWxkU2NvcGUsIG5vZGUsIHRoaXMubGV2ZWwgKyAxKTtcbiAgICBiaW5kZXIuaW5nZXN0KG5vZGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXliZU1hcChhc3Q6IFByb3BlcnR5UmVhZHxTYWZlUHJvcGVydHlSZWFkfFByb3BlcnR5V3JpdGUsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIElmIHRoZSByZWNlaXZlciBvZiB0aGUgZXhwcmVzc2lvbiBpc24ndCB0aGUgYEltcGxpY2l0UmVjZWl2ZXJgLCB0aGlzIGlzbid0IHRoZSByb290IG9mIGFuXG4gICAgLy8gYEFTVGAgZXhwcmVzc2lvbiB0aGF0IG1hcHMgdG8gYSBgVmFyaWFibGVgIG9yIGBSZWZlcmVuY2VgLlxuICAgIGlmICghKGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgbmFtZSBleGlzdHMgaW4gdGhlIGN1cnJlbnQgc2NvcGUuIElmIHNvLCBtYXAgaXQuIE90aGVyd2lzZSwgdGhlIG5hbWUgaXNcbiAgICAvLyBwcm9iYWJseSBhIHByb3BlcnR5IG9uIHRoZSB0b3AtbGV2ZWwgY29tcG9uZW50IGNvbnRleHQuXG4gICAgbGV0IHRhcmdldCA9IHRoaXMuc2NvcGUubG9va3VwKG5hbWUpO1xuICAgIGlmICh0YXJnZXQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuYmluZGluZ3Muc2V0KGFzdCwgdGFyZ2V0KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBNZXRhZGF0YSBjb250YWluZXIgZm9yIGEgYFRhcmdldGAgdGhhdCBhbGxvd3MgcXVlcmllcyBmb3Igc3BlY2lmaWMgYml0cyBvZiBtZXRhZGF0YS5cbiAqXG4gKiBTZWUgYEJvdW5kVGFyZ2V0YCBmb3IgZG9jdW1lbnRhdGlvbiBvbiB0aGUgaW5kaXZpZHVhbCBtZXRob2RzLlxuICovXG5leHBvcnQgY2xhc3MgUjNCb3VuZFRhcmdldDxEaXJlY3RpdmVUIGV4dGVuZHMgRGlyZWN0aXZlTWV0YT4gaW1wbGVtZW50cyBCb3VuZFRhcmdldDxEaXJlY3RpdmVUPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgdGFyZ2V0OiBUYXJnZXQsIHByaXZhdGUgZGlyZWN0aXZlczogTWFwPEVsZW1lbnR8VGVtcGxhdGUsIERpcmVjdGl2ZVRbXT4sXG4gICAgICBwcml2YXRlIGVhZ2VyRGlyZWN0aXZlczogRGlyZWN0aXZlVFtdLFxuICAgICAgcHJpdmF0ZSBiaW5kaW5nczogTWFwPEJvdW5kQXR0cmlidXRlfEJvdW5kRXZlbnR8VGV4dEF0dHJpYnV0ZSwgRGlyZWN0aXZlVHxFbGVtZW50fFRlbXBsYXRlPixcbiAgICAgIHByaXZhdGUgcmVmZXJlbmNlczpcbiAgICAgICAgICBNYXA8Qm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxSZWZlcmVuY2V8VGV4dEF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAge2RpcmVjdGl2ZTogRGlyZWN0aXZlVCwgbm9kZTogRWxlbWVudHxUZW1wbGF0ZX18RWxlbWVudHxUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIGV4cHJUYXJnZXRzOiBNYXA8QVNULCBSZWZlcmVuY2V8VmFyaWFibGU+LFxuICAgICAgcHJpdmF0ZSBzeW1ib2xzOiBNYXA8UmVmZXJlbmNlfFZhcmlhYmxlLCBUZW1wbGF0ZT4sXG4gICAgICBwcml2YXRlIG5lc3RpbmdMZXZlbDogTWFwPFNjb3BlZE5vZGUsIG51bWJlcj4sXG4gICAgICBwcml2YXRlIHNjb3BlZE5vZGVFbnRpdGllczogTWFwPFNjb3BlZE5vZGV8bnVsbCwgUmVhZG9ubHlTZXQ8UmVmZXJlbmNlfFZhcmlhYmxlPj4sXG4gICAgICBwcml2YXRlIHVzZWRQaXBlczogU2V0PHN0cmluZz4sIHByaXZhdGUgZWFnZXJQaXBlczogU2V0PHN0cmluZz4sXG4gICAgICBwcml2YXRlIGRlZmVycmVkQmxvY2tzOiBTZXQ8RGVmZXJyZWRCbG9jaz4pIHt9XG5cbiAgZ2V0RW50aXRpZXNJblNjb3BlKG5vZGU6IFNjb3BlZE5vZGV8bnVsbCk6IFJlYWRvbmx5U2V0PFJlZmVyZW5jZXxWYXJpYWJsZT4ge1xuICAgIHJldHVybiB0aGlzLnNjb3BlZE5vZGVFbnRpdGllcy5nZXQobm9kZSkgPz8gbmV3IFNldCgpO1xuICB9XG5cbiAgZ2V0RGlyZWN0aXZlc09mTm9kZShub2RlOiBFbGVtZW50fFRlbXBsYXRlKTogRGlyZWN0aXZlVFtdfG51bGwge1xuICAgIHJldHVybiB0aGlzLmRpcmVjdGl2ZXMuZ2V0KG5vZGUpIHx8IG51bGw7XG4gIH1cblxuICBnZXRSZWZlcmVuY2VUYXJnZXQocmVmOiBSZWZlcmVuY2UpOiBSZWZlcmVuY2VUYXJnZXQ8RGlyZWN0aXZlVD58bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlcy5nZXQocmVmKSB8fCBudWxsO1xuICB9XG5cbiAgZ2V0Q29uc3VtZXJPZkJpbmRpbmcoYmluZGluZzogQm91bmRBdHRyaWJ1dGV8Qm91bmRFdmVudHxUZXh0QXR0cmlidXRlKTogRGlyZWN0aXZlVHxFbGVtZW50XG4gICAgICB8VGVtcGxhdGV8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuYmluZGluZ3MuZ2V0KGJpbmRpbmcpIHx8IG51bGw7XG4gIH1cblxuICBnZXRFeHByZXNzaW9uVGFyZ2V0KGV4cHI6IEFTVCk6IFJlZmVyZW5jZXxWYXJpYWJsZXxudWxsIHtcbiAgICByZXR1cm4gdGhpcy5leHByVGFyZ2V0cy5nZXQoZXhwcikgfHwgbnVsbDtcbiAgfVxuXG4gIGdldERlZmluaXRpb25Ob2RlT2ZTeW1ib2woc3ltYm9sOiBSZWZlcmVuY2V8VmFyaWFibGUpOiBTY29wZWROb2RlfG51bGwge1xuICAgIHJldHVybiB0aGlzLnN5bWJvbHMuZ2V0KHN5bWJvbCkgfHwgbnVsbDtcbiAgfVxuXG4gIGdldE5lc3RpbmdMZXZlbChub2RlOiBTY29wZWROb2RlKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5uZXN0aW5nTGV2ZWwuZ2V0KG5vZGUpIHx8IDA7XG4gIH1cblxuICBnZXRVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4oKTtcbiAgICB0aGlzLmRpcmVjdGl2ZXMuZm9yRWFjaChkaXJzID0+IGRpcnMuZm9yRWFjaChkaXIgPT4gc2V0LmFkZChkaXIpKSk7XG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0LnZhbHVlcygpKTtcbiAgfVxuXG4gIGdldEVhZ2VybHlVc2VkRGlyZWN0aXZlcygpOiBEaXJlY3RpdmVUW10ge1xuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8RGlyZWN0aXZlVD4odGhpcy5lYWdlckRpcmVjdGl2ZXMpO1xuICAgIHJldHVybiBBcnJheS5mcm9tKHNldC52YWx1ZXMoKSk7XG4gIH1cblxuICBnZXRVc2VkUGlwZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMudXNlZFBpcGVzKTtcbiAgfVxuXG4gIGdldEVhZ2VybHlVc2VkUGlwZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZWFnZXJQaXBlcyk7XG4gIH1cblxuICBnZXREZWZlckJsb2NrcygpOiBEZWZlcnJlZEJsb2NrW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuZGVmZXJyZWRCbG9ja3MpO1xuICB9XG5cblxuICBnZXREZWZlcnJlZFRyaWdnZXJUYXJnZXQoYmxvY2s6IERlZmVycmVkQmxvY2ssIHRyaWdnZXI6IERlZmVycmVkVHJpZ2dlcik6IEVsZW1lbnR8bnVsbCB7XG4gICAgLy8gT25seSB0cmlnZ2VycyB0aGF0IHJlZmVyIHRvIERPTSBub2RlcyBjYW4gYmUgcmVzb2x2ZWQuXG4gICAgaWYgKCEodHJpZ2dlciBpbnN0YW5jZW9mIEludGVyYWN0aW9uRGVmZXJyZWRUcmlnZ2VyKSAmJlxuICAgICAgICAhKHRyaWdnZXIgaW5zdGFuY2VvZiBWaWV3cG9ydERlZmVycmVkVHJpZ2dlcikgJiZcbiAgICAgICAgISh0cmlnZ2VyIGluc3RhbmNlb2YgSG92ZXJEZWZlcnJlZFRyaWdnZXIpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBuYW1lID0gdHJpZ2dlci5yZWZlcmVuY2U7XG5cbiAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgbGV0IHRyaWdnZXI6IEVsZW1lbnR8bnVsbCA9IG51bGw7XG5cbiAgICAgIGlmIChibG9jay5wbGFjZWhvbGRlciAhPT0gbnVsbCkge1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGJsb2NrLnBsYWNlaG9sZGVyLmNoaWxkcmVuKSB7XG4gICAgICAgICAgLy8gU2tpcCBvdmVyIGNvbW1lbnQgbm9kZXMuIEN1cnJlbnRseSBieSBkZWZhdWx0IHRoZSB0ZW1wbGF0ZSBwYXJzZXIgZG9lc24ndCBjYXB0dXJlXG4gICAgICAgICAgLy8gY29tbWVudHMsIGJ1dCB3ZSBoYXZlIGEgc2FmZWd1YXJkIGhlcmUganVzdCBpbiBjYXNlIHNpbmNlIGl0IGNhbiBiZSBlbmFibGVkLlxuICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIENvbW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFdlIGNhbiBvbmx5IGluZmVyIHRoZSB0cmlnZ2VyIGlmIHRoZXJlJ3Mgb25lIHJvb3QgZWxlbWVudCBub2RlLiBBbnkgb3RoZXJcbiAgICAgICAgICAvLyBub2RlcyBhdCB0aGUgcm9vdCBtYWtlIGl0IHNvIHRoYXQgd2UgY2FuJ3QgaW5mZXIgdGhlIHRyaWdnZXIgYW55bW9yZS5cbiAgICAgICAgICBpZiAodHJpZ2dlciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICAgICAgdHJpZ2dlciA9IGNoaWxkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJpZ2dlcjtcbiAgICB9XG5cbiAgICBjb25zdCBvdXRzaWRlUmVmID0gdGhpcy5maW5kRW50aXR5SW5TY29wZShibG9jaywgbmFtZSk7XG5cbiAgICAvLyBGaXJzdCB0cnkgdG8gcmVzb2x2ZSB0aGUgdGFyZ2V0IGluIHRoZSBzY29wZSBvZiB0aGUgbWFpbiBkZWZlcnJlZCBibG9jay4gTm90ZSB0aGF0IHdlXG4gICAgLy8gc2tpcCB0cmlnZ2VycyBkZWZpbmVkIGluc2lkZSB0aGUgbWFpbiBibG9jayBpdHNlbGYsIGJlY2F1c2UgdGhleSBtaWdodCBub3QgZXhpc3QgeWV0LlxuICAgIGlmIChvdXRzaWRlUmVmIGluc3RhbmNlb2YgUmVmZXJlbmNlICYmIHRoaXMuZ2V0RGVmaW5pdGlvbk5vZGVPZlN5bWJvbChvdXRzaWRlUmVmKSAhPT0gYmxvY2spIHtcbiAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZ2V0UmVmZXJlbmNlVGFyZ2V0KG91dHNpZGVSZWYpO1xuXG4gICAgICBpZiAodGFyZ2V0ICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZVRhcmdldFRvRWxlbWVudCh0YXJnZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHRoZSB0cmlnZ2VyIGNvdWxkbid0IGJlIGZvdW5kIGluIHRoZSBtYWluIGJsb2NrLCBjaGVjayB0aGVcbiAgICAvLyBwbGFjZWhvbGRlciBibG9jayB3aGljaCBpcyBzaG93biBiZWZvcmUgdGhlIG1haW4gYmxvY2sgaGFzIGxvYWRlZC5cbiAgICBpZiAoYmxvY2sucGxhY2Vob2xkZXIgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHJlZkluUGxhY2Vob2xkZXIgPSB0aGlzLmZpbmRFbnRpdHlJblNjb3BlKGJsb2NrLnBsYWNlaG9sZGVyLCBuYW1lKTtcbiAgICAgIGNvbnN0IHRhcmdldEluUGxhY2Vob2xkZXIgPVxuICAgICAgICAgIHJlZkluUGxhY2Vob2xkZXIgaW5zdGFuY2VvZiBSZWZlcmVuY2UgPyB0aGlzLmdldFJlZmVyZW5jZVRhcmdldChyZWZJblBsYWNlaG9sZGVyKSA6IG51bGw7XG5cbiAgICAgIGlmICh0YXJnZXRJblBsYWNlaG9sZGVyICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlZmVyZW5jZVRhcmdldFRvRWxlbWVudCh0YXJnZXRJblBsYWNlaG9sZGVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyBhbiBlbnRpdHkgd2l0aCBhIHNwZWNpZmljIG5hbWUgaW4gYSBzY29wZS5cbiAgICogQHBhcmFtIHJvb3ROb2RlIFJvb3Qgbm9kZSBvZiB0aGUgc2NvcGUuXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGVudGl0eS5cbiAgICovXG4gIHByaXZhdGUgZmluZEVudGl0eUluU2NvcGUocm9vdE5vZGU6IFNjb3BlZE5vZGUsIG5hbWU6IHN0cmluZyk6IFJlZmVyZW5jZXxWYXJpYWJsZXxudWxsIHtcbiAgICBjb25zdCBlbnRpdGllcyA9IHRoaXMuZ2V0RW50aXRpZXNJblNjb3BlKHJvb3ROb2RlKTtcblxuICAgIGZvciAoY29uc3QgZW50aXRpdHkgb2YgZW50aXRpZXMpIHtcbiAgICAgIGlmIChlbnRpdGl0eS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiBlbnRpdGl0eTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKiBDb2VyY2VzIGEgYFJlZmVyZW5jZVRhcmdldGAgdG8gYW4gYEVsZW1lbnRgLCBpZiBwb3NzaWJsZS4gKi9cbiAgcHJpdmF0ZSByZWZlcmVuY2VUYXJnZXRUb0VsZW1lbnQodGFyZ2V0OiBSZWZlcmVuY2VUYXJnZXQ8RGlyZWN0aXZlVD4pOiBFbGVtZW50fG51bGwge1xuICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBUZW1wbGF0ZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVmZXJlbmNlVGFyZ2V0VG9FbGVtZW50KHRhcmdldC5ub2RlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBleHRyYWN0U2NvcGVkTm9kZUVudGl0aWVzKHJvb3RTY29wZTogU2NvcGUpOlxuICAgIE1hcDxTY29wZWROb2RlfG51bGwsIFNldDxSZWZlcmVuY2V8VmFyaWFibGU+PiB7XG4gIGNvbnN0IGVudGl0eU1hcCA9IG5ldyBNYXA8U2NvcGVkTm9kZXxudWxsLCBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+PigpO1xuXG4gIGZ1bmN0aW9uIGV4dHJhY3RTY29wZUVudGl0aWVzKHNjb3BlOiBTY29wZSk6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZXxWYXJpYWJsZT4ge1xuICAgIGlmIChlbnRpdHlNYXAuaGFzKHNjb3BlLnJvb3ROb2RlKSkge1xuICAgICAgcmV0dXJuIGVudGl0eU1hcC5nZXQoc2NvcGUucm9vdE5vZGUpITtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJyZW50RW50aXRpZXMgPSBzY29wZS5uYW1lZEVudGl0aWVzO1xuXG4gICAgbGV0IGVudGl0aWVzOiBNYXA8c3RyaW5nLCBSZWZlcmVuY2V8VmFyaWFibGU+O1xuICAgIGlmIChzY29wZS5wYXJlbnRTY29wZSAhPT0gbnVsbCkge1xuICAgICAgZW50aXRpZXMgPSBuZXcgTWFwKFsuLi5leHRyYWN0U2NvcGVFbnRpdGllcyhzY29wZS5wYXJlbnRTY29wZSksIC4uLmN1cnJlbnRFbnRpdGllc10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbnRpdGllcyA9IG5ldyBNYXAoY3VycmVudEVudGl0aWVzKTtcbiAgICB9XG5cbiAgICBlbnRpdHlNYXAuc2V0KHNjb3BlLnJvb3ROb2RlLCBlbnRpdGllcyk7XG4gICAgcmV0dXJuIGVudGl0aWVzO1xuICB9XG5cbiAgY29uc3Qgc2NvcGVzVG9Qcm9jZXNzOiBTY29wZVtdID0gW3Jvb3RTY29wZV07XG4gIHdoaWxlIChzY29wZXNUb1Byb2Nlc3MubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHNjb3BlID0gc2NvcGVzVG9Qcm9jZXNzLnBvcCgpITtcbiAgICBmb3IgKGNvbnN0IGNoaWxkU2NvcGUgb2Ygc2NvcGUuY2hpbGRTY29wZXMudmFsdWVzKCkpIHtcbiAgICAgIHNjb3Blc1RvUHJvY2Vzcy5wdXNoKGNoaWxkU2NvcGUpO1xuICAgIH1cbiAgICBleHRyYWN0U2NvcGVFbnRpdGllcyhzY29wZSk7XG4gIH1cblxuICBjb25zdCB0ZW1wbGF0ZUVudGl0aWVzID0gbmV3IE1hcDxTY29wZWROb2RlfG51bGwsIFNldDxSZWZlcmVuY2V8VmFyaWFibGU+PigpO1xuICBmb3IgKGNvbnN0IFt0ZW1wbGF0ZSwgZW50aXRpZXNdIG9mIGVudGl0eU1hcCkge1xuICAgIHRlbXBsYXRlRW50aXRpZXMuc2V0KHRlbXBsYXRlLCBuZXcgU2V0KGVudGl0aWVzLnZhbHVlcygpKSk7XG4gIH1cbiAgcmV0dXJuIHRlbXBsYXRlRW50aXRpZXM7XG59XG4iXX0=