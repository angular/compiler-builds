import { identifierToken } from '../identifiers';
import { templateVisitAll } from '../template_parser/template_ast';
import { CompileElementAnimationOutput, bindAnimationOutputs, bindDirectiveOutputs, bindRenderOutputs, collectEventListeners } from './event_binder';
import { bindDirectiveAfterContentLifecycleCallbacks, bindDirectiveAfterViewLifecycleCallbacks, bindDirectiveDetectChangesLifecycleCallbacks, bindInjectableDestroyLifecycleCallbacks, bindPipeDestroyLifecycleCallbacks } from './lifecycle_binder';
import { bindDirectiveHostProps, bindDirectiveInputs, bindRenderInputs, bindRenderText } from './property_binder';
export function bindView(view, parsedTemplate, animationOutputs) {
    var visitor = new ViewBinderVisitor(view, animationOutputs);
    templateVisitAll(visitor, parsedTemplate);
    view.pipes.forEach((pipe) => { bindPipeDestroyLifecycleCallbacks(pipe.meta, pipe.instance, pipe.view); });
}
class ViewBinderVisitor {
    constructor(view, animationOutputs) {
        this.view = view;
        this._nodeIndex = 0;
        this._animationOutputsMap = {};
        animationOutputs.forEach(entry => { this._animationOutputsMap[entry.fullPropertyName] = entry; });
    }
    visitBoundText(ast, parent) {
        var node = this.view.nodes[this._nodeIndex++];
        bindRenderText(ast, node, this.view);
        return null;
    }
    visitText(ast, parent) {
        this._nodeIndex++;
        return null;
    }
    visitNgContent(ast, parent) { return null; }
    visitElement(ast, parent) {
        var compileElement = this.view.nodes[this._nodeIndex++];
        var eventListeners = [];
        var animationEventListeners = [];
        collectEventListeners(ast.outputs, ast.directives, compileElement).forEach(entry => {
            // TODO: figure out how to abstract this `if` statement elsewhere
            if (entry.eventName[0] == '@') {
                let animationOutputName = entry.eventName.substr(1);
                let output = this._animationOutputsMap[animationOutputName];
                // no need to report an error here since the parser will
                // have caught the missing animation trigger definition
                if (output) {
                    animationEventListeners.push(new CompileElementAnimationOutput(entry, output));
                }
            }
            else {
                eventListeners.push(entry);
            }
        });
        bindAnimationOutputs(animationEventListeners);
        bindRenderInputs(ast.inputs, compileElement);
        bindRenderOutputs(eventListeners);
        ast.directives.forEach((directiveAst) => {
            var directiveInstance = compileElement.instances.get(identifierToken(directiveAst.directive.type));
            bindDirectiveInputs(directiveAst, directiveInstance, compileElement);
            bindDirectiveDetectChangesLifecycleCallbacks(directiveAst, directiveInstance, compileElement);
            bindDirectiveHostProps(directiveAst, directiveInstance, compileElement);
            bindDirectiveOutputs(directiveAst, directiveInstance, eventListeners);
        });
        templateVisitAll(this, ast.children, compileElement);
        // afterContent and afterView lifecycles need to be called bottom up
        // so that children are notified before parents
        ast.directives.forEach((directiveAst) => {
            var directiveInstance = compileElement.instances.get(identifierToken(directiveAst.directive.type));
            bindDirectiveAfterContentLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveAfterViewLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
        });
        ast.providers.forEach((providerAst) => {
            var providerInstance = compileElement.instances.get(providerAst.token);
            bindInjectableDestroyLifecycleCallbacks(providerAst, providerInstance, compileElement);
        });
        return null;
    }
    visitEmbeddedTemplate(ast, parent) {
        var compileElement = this.view.nodes[this._nodeIndex++];
        var eventListeners = collectEventListeners(ast.outputs, ast.directives, compileElement);
        ast.directives.forEach((directiveAst) => {
            var directiveInstance = compileElement.instances.get(identifierToken(directiveAst.directive.type));
            bindDirectiveInputs(directiveAst, directiveInstance, compileElement);
            bindDirectiveDetectChangesLifecycleCallbacks(directiveAst, directiveInstance, compileElement);
            bindDirectiveOutputs(directiveAst, directiveInstance, eventListeners);
            bindDirectiveAfterContentLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
            bindDirectiveAfterViewLifecycleCallbacks(directiveAst.directive, directiveInstance, compileElement);
        });
        ast.providers.forEach((providerAst) => {
            var providerInstance = compileElement.instances.get(providerAst.token);
            bindInjectableDestroyLifecycleCallbacks(providerAst, providerInstance, compileElement);
        });
        bindView(compileElement.embeddedView, ast.children, []);
        return null;
    }
    visitAttr(ast, ctx) { return null; }
    visitDirective(ast, ctx) { return null; }
    visitEvent(ast, eventTargetAndNames) {
        return null;
    }
    visitReference(ast, ctx) { return null; }
    visitVariable(ast, ctx) { return null; }
    visitDirectiveProperty(ast, context) { return null; }
    visitElementProperty(ast, context) { return null; }
}
//# sourceMappingURL=view_binder.js.map