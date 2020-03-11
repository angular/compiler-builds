/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from '../aot/static_symbol';
import { BindingForm, EventHandlerVars, convertActionBinding, convertPropertyBinding, convertPropertyBindingBuiltins } from '../compiler_util/expression_converter';
import * as o from '../output/output_ast';
import { templateVisitAll } from '../template_parser/template_ast';
/**
 * Generates code that is used to type check templates.
 */
export class TypeCheckCompiler {
    constructor(options, reflector) {
        this.options = options;
        this.reflector = reflector;
    }
    /**
     * Important notes:
     * - This must not produce new `import` statements, but only refer to types outside
     *   of the file via the variables provided via externalReferenceVars.
     *   This allows Typescript to reuse the old program's structure as no imports have changed.
     * - This must not produce any exports, as this would pollute the .d.ts file
     *   and also violate the point above.
     */
    compileComponent(componentId, component, template, usedPipes, externalReferenceVars, ctx) {
        const pipes = new Map();
        usedPipes.forEach(p => pipes.set(p.name, p.type.reference));
        let embeddedViewCount = 0;
        const viewBuilderFactory = (parent, guards) => {
            const embeddedViewIndex = embeddedViewCount++;
            return new ViewBuilder(this.options, this.reflector, externalReferenceVars, parent, component.type.reference, component.isHost, embeddedViewIndex, pipes, guards, ctx, viewBuilderFactory);
        };
        const visitor = viewBuilderFactory(null, []);
        visitor.visitAll([], template);
        return visitor.build(componentId);
    }
}
const DYNAMIC_VAR_NAME = '_any';
class TypeCheckLocalResolver {
    notifyImplicitReceiverUse() { }
    getLocal(name) {
        if (name === EventHandlerVars.event.name) {
            // References to the event should not be type-checked.
            // TODO(chuckj): determine a better type for the event.
            return o.variable(DYNAMIC_VAR_NAME);
        }
        return null;
    }
}
const defaultResolver = new TypeCheckLocalResolver();
class ViewBuilder {
    constructor(options, reflector, externalReferenceVars, parent, component, isHostComponent, embeddedViewIndex, pipes, guards, ctx, viewBuilderFactory) {
        this.options = options;
        this.reflector = reflector;
        this.externalReferenceVars = externalReferenceVars;
        this.parent = parent;
        this.component = component;
        this.isHostComponent = isHostComponent;
        this.embeddedViewIndex = embeddedViewIndex;
        this.pipes = pipes;
        this.guards = guards;
        this.ctx = ctx;
        this.viewBuilderFactory = viewBuilderFactory;
        this.refOutputVars = new Map();
        this.variables = [];
        this.children = [];
        this.updates = [];
        this.actions = [];
    }
    getOutputVar(type) {
        let varName;
        if (type === this.component && this.isHostComponent) {
            varName = DYNAMIC_VAR_NAME;
        }
        else if (type instanceof StaticSymbol) {
            varName = this.externalReferenceVars.get(type);
        }
        else {
            varName = DYNAMIC_VAR_NAME;
        }
        if (!varName) {
            throw new Error(`Illegal State: referring to a type without a variable ${JSON.stringify(type)}`);
        }
        return varName;
    }
    getTypeGuardExpressions(ast) {
        const result = [...this.guards];
        for (let directive of ast.directives) {
            for (let input of directive.inputs) {
                const guard = directive.directive.guards[input.directiveName];
                if (guard) {
                    const useIf = guard === 'UseIf';
                    result.push({
                        guard,
                        useIf,
                        expression: {
                            context: this.component,
                            value: input.value,
                            sourceSpan: input.sourceSpan,
                        },
                    });
                }
            }
        }
        return result;
    }
    visitAll(variables, astNodes) {
        this.variables = variables;
        templateVisitAll(this, astNodes);
    }
    build(componentId, targetStatements = []) {
        this.children.forEach((child) => child.build(componentId, targetStatements));
        let viewStmts = [o.variable(DYNAMIC_VAR_NAME).set(o.NULL_EXPR).toDeclStmt(o.DYNAMIC_TYPE)];
        let bindingCount = 0;
        this.updates.forEach((expression) => {
            const { sourceSpan, context, value } = this.preprocessUpdateExpression(expression);
            const bindingId = `${bindingCount++}`;
            const nameResolver = context === this.component ? this : defaultResolver;
            const { stmts, currValExpr } = convertPropertyBinding(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId, BindingForm.General);
            stmts.push(new o.ExpressionStatement(currValExpr));
            viewStmts.push(...stmts.map((stmt) => o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan)));
        });
        this.actions.forEach(({ sourceSpan, context, value }) => {
            const bindingId = `${bindingCount++}`;
            const nameResolver = context === this.component ? this : defaultResolver;
            const { stmts } = convertActionBinding(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId);
            viewStmts.push(...stmts.map((stmt) => o.applySourceSpanToStatementIfNeeded(stmt, sourceSpan)));
        });
        if (this.guards.length) {
            let guardExpression = undefined;
            for (const guard of this.guards) {
                const { context, value } = this.preprocessUpdateExpression(guard.expression);
                const bindingId = `${bindingCount++}`;
                const nameResolver = context === this.component ? this : defaultResolver;
                // We only support support simple expressions and ignore others as they
                // are unlikely to affect type narrowing.
                const { stmts, currValExpr } = convertPropertyBinding(nameResolver, o.variable(this.getOutputVar(context)), value, bindingId, BindingForm.TrySimple);
                if (stmts.length == 0) {
                    const guardClause = guard.useIf ? currValExpr : this.ctx.importExpr(guard.guard).callFn([currValExpr]);
                    guardExpression = guardExpression ? guardExpression.and(guardClause) : guardClause;
                }
            }
            if (guardExpression) {
                viewStmts = [new o.IfStmt(guardExpression, viewStmts)];
            }
        }
        const viewName = `_View_${componentId}_${this.embeddedViewIndex}`;
        const viewFactory = new o.DeclareFunctionStmt(viewName, [], viewStmts);
        targetStatements.push(viewFactory);
        return targetStatements;
    }
    visitBoundText(ast, context) {
        const astWithSource = ast.value;
        const inter = astWithSource.ast;
        inter.expressions.forEach((expr) => this.updates.push({ context: this.component, value: expr, sourceSpan: ast.sourceSpan }));
    }
    visitEmbeddedTemplate(ast, context) {
        this.visitElementOrTemplate(ast);
        // Note: The old view compiler used to use an `any` type
        // for the context in any embedded view.
        // We keep this behaivor behind a flag for now.
        if (this.options.fullTemplateTypeCheck) {
            // Find any applicable type guards. For example, NgIf has a type guard on ngIf
            // (see NgIf.ngIfTypeGuard) that can be used to indicate that a template is only
            // stamped out if ngIf is truthy so any bindings in the template can assume that,
            // if a nullable type is used for ngIf, that expression is not null or undefined.
            const guards = this.getTypeGuardExpressions(ast);
            const childVisitor = this.viewBuilderFactory(this, guards);
            this.children.push(childVisitor);
            childVisitor.visitAll(ast.variables, ast.children);
        }
    }
    visitElement(ast, context) {
        this.visitElementOrTemplate(ast);
        let inputDefs = [];
        let updateRendererExpressions = [];
        let outputDefs = [];
        ast.inputs.forEach((inputAst) => {
            this.updates.push({ context: this.component, value: inputAst.value, sourceSpan: inputAst.sourceSpan });
        });
        templateVisitAll(this, ast.children);
    }
    visitElementOrTemplate(ast) {
        ast.directives.forEach((dirAst) => { this.visitDirective(dirAst); });
        ast.references.forEach((ref) => {
            let outputVarType = null;
            // Note: The old view compiler used to use an `any` type
            // for directives exposed via `exportAs`.
            // We keep this behaivor behind a flag for now.
            if (ref.value && ref.value.identifier && this.options.fullTemplateTypeCheck) {
                outputVarType = ref.value.identifier.reference;
            }
            else {
                outputVarType = o.BuiltinTypeName.Dynamic;
            }
            this.refOutputVars.set(ref.name, outputVarType);
        });
        ast.outputs.forEach((outputAst) => {
            this.actions.push({ context: this.component, value: outputAst.handler, sourceSpan: outputAst.sourceSpan });
        });
    }
    visitDirective(dirAst) {
        const dirType = dirAst.directive.type.reference;
        dirAst.inputs.forEach((input) => this.updates.push({ context: this.component, value: input.value, sourceSpan: input.sourceSpan }));
        // Note: The old view compiler used to use an `any` type
        // for expressions in host properties / events.
        // We keep this behaivor behind a flag for now.
        if (this.options.fullTemplateTypeCheck) {
            dirAst.hostProperties.forEach((inputAst) => this.updates.push({ context: dirType, value: inputAst.value, sourceSpan: inputAst.sourceSpan }));
            dirAst.hostEvents.forEach((hostEventAst) => this.actions.push({
                context: dirType,
                value: hostEventAst.handler,
                sourceSpan: hostEventAst.sourceSpan
            }));
        }
    }
    notifyImplicitReceiverUse() { }
    getLocal(name) {
        if (name == EventHandlerVars.event.name) {
            return o.variable(this.getOutputVar(o.BuiltinTypeName.Dynamic));
        }
        for (let currBuilder = this; currBuilder; currBuilder = currBuilder.parent) {
            let outputVarType;
            // check references
            outputVarType = currBuilder.refOutputVars.get(name);
            if (outputVarType == null) {
                // check variables
                const varAst = currBuilder.variables.find((varAst) => varAst.name === name);
                if (varAst) {
                    outputVarType = o.BuiltinTypeName.Dynamic;
                }
            }
            if (outputVarType != null) {
                return o.variable(this.getOutputVar(outputVarType));
            }
        }
        return null;
    }
    pipeOutputVar(name) {
        const pipe = this.pipes.get(name);
        if (!pipe) {
            throw new Error(`Illegal State: Could not find pipe ${name} in template of ${this.component}`);
        }
        return this.getOutputVar(pipe);
    }
    preprocessUpdateExpression(expression) {
        return {
            sourceSpan: expression.sourceSpan,
            context: expression.context,
            value: convertPropertyBindingBuiltins({
                createLiteralArrayConverter: (argCount) => (args) => {
                    const arr = o.literalArr(args);
                    // Note: The old view compiler used to use an `any` type
                    // for arrays.
                    return this.options.fullTemplateTypeCheck ? arr : arr.cast(o.DYNAMIC_TYPE);
                },
                createLiteralMapConverter: (keys) => (values) => {
                    const entries = keys.map((k, i) => ({
                        key: k.key,
                        value: values[i],
                        quoted: k.quoted,
                    }));
                    const map = o.literalMap(entries);
                    // Note: The old view compiler used to use an `any` type
                    // for maps.
                    return this.options.fullTemplateTypeCheck ? map : map.cast(o.DYNAMIC_TYPE);
                },
                createPipeConverter: (name, argCount) => (args) => {
                    // Note: The old view compiler used to use an `any` type
                    // for pipes.
                    const pipeExpr = this.options.fullTemplateTypeCheck ?
                        o.variable(this.pipeOutputVar(name)) :
                        o.variable(this.getOutputVar(o.BuiltinTypeName.Dynamic));
                    return pipeExpr.callMethod('transform', args);
                },
            }, expression.value)
        };
    }
    visitNgContent(ast, context) { }
    visitText(ast, context) { }
    visitDirectiveProperty(ast, context) { }
    visitReference(ast, context) { }
    visitVariable(ast, context) { }
    visitEvent(ast, context) { }
    visitElementProperty(ast, context) { }
    visitAttr(ast, context) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy92aWV3X2NvbXBpbGVyL3R5cGVfY2hlY2tfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBRWxELE9BQU8sRUFBQyxXQUFXLEVBQUUsZ0JBQWdCLEVBQWlCLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLDhCQUE4QixFQUFDLE1BQU0sdUNBQXVDLENBQUM7QUFFakwsT0FBTyxLQUFLLENBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUUxQyxPQUFPLEVBQTZOLGdCQUFnQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFJN1I7O0dBRUc7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBQzVCLFlBQW9CLE9BQTJCLEVBQVUsU0FBMEI7UUFBL0QsWUFBTyxHQUFQLE9BQU8sQ0FBb0I7UUFBVSxjQUFTLEdBQVQsU0FBUyxDQUFpQjtJQUFHLENBQUM7SUFFdkY7Ozs7Ozs7T0FPRztJQUNILGdCQUFnQixDQUNaLFdBQW1CLEVBQUUsU0FBbUMsRUFBRSxRQUF1QixFQUNqRixTQUErQixFQUFFLHFCQUFnRCxFQUNqRixHQUFrQjtRQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBd0IsQ0FBQztRQUM5QyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUM1RCxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztRQUMxQixNQUFNLGtCQUFrQixHQUNwQixDQUFDLE1BQTBCLEVBQUUsTUFBeUIsRUFBZSxFQUFFO1lBQ3JFLE1B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QWE7b0JBQ2IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO3dCQUNqRCxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUN0QyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUM3RCxPQUFPLFFBQVEsQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO2FBQ0YsRUFDRCxVQUFVLENBQUMsS0FBSyxDQUFDO1NBQ3RCLENBQUM7SUFDSixDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQWlCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDdkQsU0FBUyxDQUFDLEdBQVksRUFBRSxPQUFZLElBQVEsQ0FBQztJQUM3QyxzQkFBc0IsQ0FBQyxHQUE4QixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQzVFLGNBQWMsQ0FBQyxHQUFpQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ3ZELGFBQWEsQ0FBQyxHQUFnQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ3JELFVBQVUsQ0FBQyxHQUFrQixFQUFFLE9BQVksSUFBUSxDQUFDO0lBQ3BELG9CQUFvQixDQUFDLEdBQTRCLEVBQUUsT0FBWSxJQUFRLENBQUM7SUFDeEUsU0FBUyxDQUFDLEdBQVksRUFBRSxPQUFZLElBQVEsQ0FBQztDQUM5QyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBb3RDb21waWxlck9wdGlvbnN9IGZyb20gJy4uL2FvdC9jb21waWxlcl9vcHRpb25zJztcbmltcG9ydCB7U3RhdGljUmVmbGVjdG9yfSBmcm9tICcuLi9hb3Qvc3RhdGljX3JlZmxlY3Rvcic7XG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi4vYW90L3N0YXRpY19zeW1ib2wnO1xuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEsIENvbXBpbGVQaXBlU3VtbWFyeX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBFdmVudEhhbmRsZXJWYXJzLCBMb2NhbFJlc29sdmVyLCBjb252ZXJ0QWN0aW9uQmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZywgY29udmVydFByb3BlcnR5QmluZGluZ0J1aWx0aW5zfSBmcm9tICcuLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7QVNULCBBU1RXaXRoU291cmNlLCBJbnRlcnBvbGF0aW9ufSBmcm9tICcuLi9leHByZXNzaW9uX3BhcnNlci9hc3QnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge1BhcnNlU291cmNlU3Bhbn0gZnJvbSAnLi4vcGFyc2VfdXRpbCc7XG5pbXBvcnQge0F0dHJBc3QsIEJvdW5kRGlyZWN0aXZlUHJvcGVydHlBc3QsIEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBCb3VuZEV2ZW50QXN0LCBCb3VuZFRleHRBc3QsIERpcmVjdGl2ZUFzdCwgRWxlbWVudEFzdCwgRW1iZWRkZWRUZW1wbGF0ZUFzdCwgTmdDb250ZW50QXN0LCBSZWZlcmVuY2VBc3QsIFRlbXBsYXRlQXN0LCBUZW1wbGF0ZUFzdFZpc2l0b3IsIFRleHRBc3QsIFZhcmlhYmxlQXN0LCB0ZW1wbGF0ZVZpc2l0QWxsfSBmcm9tICcuLi90ZW1wbGF0ZV9wYXJzZXIvdGVtcGxhdGVfYXN0JztcbmltcG9ydCB7T3V0cHV0Q29udGV4dH0gZnJvbSAnLi4vdXRpbCc7XG5cblxuLyoqXG4gKiBHZW5lcmF0ZXMgY29kZSB0aGF0IGlzIHVzZWQgdG8gdHlwZSBjaGVjayB0ZW1wbGF0ZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlQ2hlY2tDb21waWxlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3B0aW9uczogQW90Q29tcGlsZXJPcHRpb25zLCBwcml2YXRlIHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yKSB7fVxuXG4gIC8qKlxuICAgKiBJbXBvcnRhbnQgbm90ZXM6XG4gICAqIC0gVGhpcyBtdXN0IG5vdCBwcm9kdWNlIG5ldyBgaW1wb3J0YCBzdGF0ZW1lbnRzLCBidXQgb25seSByZWZlciB0byB0eXBlcyBvdXRzaWRlXG4gICAqICAgb2YgdGhlIGZpbGUgdmlhIHRoZSB2YXJpYWJsZXMgcHJvdmlkZWQgdmlhIGV4dGVybmFsUmVmZXJlbmNlVmFycy5cbiAgICogICBUaGlzIGFsbG93cyBUeXBlc2NyaXB0IHRvIHJldXNlIHRoZSBvbGQgcHJvZ3JhbSdzIHN0cnVjdHVyZSBhcyBubyBpbXBvcnRzIGhhdmUgY2hhbmdlZC5cbiAgICogLSBUaGlzIG11c3Qgbm90IHByb2R1Y2UgYW55IGV4cG9ydHMsIGFzIHRoaXMgd291bGQgcG9sbHV0ZSB0aGUgLmQudHMgZmlsZVxuICAgKiAgIGFuZCBhbHNvIHZpb2xhdGUgdGhlIHBvaW50IGFib3ZlLlxuICAgKi9cbiAgY29tcGlsZUNvbXBvbmVudChcbiAgICAgIGNvbXBvbmVudElkOiBzdHJpbmcsIGNvbXBvbmVudDogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhLCB0ZW1wbGF0ZTogVGVtcGxhdGVBc3RbXSxcbiAgICAgIHVzZWRQaXBlczogQ29tcGlsZVBpcGVTdW1tYXJ5W10sIGV4dGVybmFsUmVmZXJlbmNlVmFyczogTWFwPFN0YXRpY1N5bWJvbCwgc3RyaW5nPixcbiAgICAgIGN0eDogT3V0cHV0Q29udGV4dCk6IG8uU3RhdGVtZW50W10ge1xuICAgIGNvbnN0IHBpcGVzID0gbmV3IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4oKTtcbiAgICB1c2VkUGlwZXMuZm9yRWFjaChwID0+IHBpcGVzLnNldChwLm5hbWUsIHAudHlwZS5yZWZlcmVuY2UpKTtcbiAgICBsZXQgZW1iZWRkZWRWaWV3Q291bnQgPSAwO1xuICAgIGNvbnN0IHZpZXdCdWlsZGVyRmFjdG9yeSA9XG4gICAgICAgIChwYXJlbnQ6IFZpZXdCdWlsZGVyIHwgbnVsbCwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyID0+IHtcbiAgICAgICAgICBjb25zdCBlbWJlZGRlZFZpZXdJbmRleCA9IGVtYmVkZGVkVmlld0NvdW50Kys7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWaWV3QnVpbGRlcihcbiAgICAgICAgICAgICAgdGhpcy5vcHRpb25zLCB0aGlzLnJlZmxlY3RvciwgZXh0ZXJuYWxSZWZlcmVuY2VWYXJzLCBwYXJlbnQsIGNvbXBvbmVudC50eXBlLnJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgY29tcG9uZW50LmlzSG9zdCwgZW1iZWRkZWRWaWV3SW5kZXgsIHBpcGVzLCBndWFyZHMsIGN0eCwgdmlld0J1aWxkZXJGYWN0b3J5KTtcbiAgICAgICAgfTtcblxuICAgIGNvbnN0IHZpc2l0b3IgPSB2aWV3QnVpbGRlckZhY3RvcnkobnVsbCwgW10pO1xuICAgIHZpc2l0b3IudmlzaXRBbGwoW10sIHRlbXBsYXRlKTtcblxuICAgIHJldHVybiB2aXNpdG9yLmJ1aWxkKGNvbXBvbmVudElkKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgR3VhcmRFeHByZXNzaW9uIHtcbiAgZ3VhcmQ6IFN0YXRpY1N5bWJvbDtcbiAgdXNlSWY6IGJvb2xlYW47XG4gIGV4cHJlc3Npb246IEV4cHJlc3Npb247XG59XG5cbmludGVyZmFjZSBWaWV3QnVpbGRlckZhY3Rvcnkge1xuICAocGFyZW50OiBWaWV3QnVpbGRlciwgZ3VhcmRzOiBHdWFyZEV4cHJlc3Npb25bXSk6IFZpZXdCdWlsZGVyO1xufVxuXG4vLyBOb3RlOiBUaGlzIGlzIHVzZWQgYXMga2V5IGluIE1hcCBhbmQgc2hvdWxkIHRoZXJlZm9yZSBiZVxuLy8gdW5pcXVlIHBlciB2YWx1ZS5cbnR5cGUgT3V0cHV0VmFyVHlwZSA9IG8uQnVpbHRpblR5cGVOYW1lIHwgU3RhdGljU3ltYm9sO1xuXG5pbnRlcmZhY2UgRXhwcmVzc2lvbiB7XG4gIGNvbnRleHQ6IE91dHB1dFZhclR5cGU7XG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbjtcbiAgdmFsdWU6IEFTVDtcbn1cblxuY29uc3QgRFlOQU1JQ19WQVJfTkFNRSA9ICdfYW55JztcblxuY2xhc3MgVHlwZUNoZWNrTG9jYWxSZXNvbHZlciBpbXBsZW1lbnRzIExvY2FsUmVzb2x2ZXIge1xuICBub3RpZnlJbXBsaWNpdFJlY2VpdmVyVXNlKCk6IHZvaWQge31cbiAgZ2V0TG9jYWwobmFtZTogc3RyaW5nKTogby5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChuYW1lID09PSBFdmVudEhhbmRsZXJWYXJzLmV2ZW50Lm5hbWUpIHtcbiAgICAgIC8vIFJlZmVyZW5jZXMgdG8gdGhlIGV2ZW50IHNob3VsZCBub3QgYmUgdHlwZS1jaGVja2VkLlxuICAgICAgLy8gVE9ETyhjaHVja2opOiBkZXRlcm1pbmUgYSBiZXR0ZXIgdHlwZSBmb3IgdGhlIGV2ZW50LlxuICAgICAgcmV0dXJuIG8udmFyaWFibGUoRFlOQU1JQ19WQVJfTkFNRSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmNvbnN0IGRlZmF1bHRSZXNvbHZlciA9IG5ldyBUeXBlQ2hlY2tMb2NhbFJlc29sdmVyKCk7XG5cbmNsYXNzIFZpZXdCdWlsZGVyIGltcGxlbWVudHMgVGVtcGxhdGVBc3RWaXNpdG9yLCBMb2NhbFJlc29sdmVyIHtcbiAgcHJpdmF0ZSByZWZPdXRwdXRWYXJzID0gbmV3IE1hcDxzdHJpbmcsIE91dHB1dFZhclR5cGU+KCk7XG4gIHByaXZhdGUgdmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdID0gW107XG4gIHByaXZhdGUgY2hpbGRyZW46IFZpZXdCdWlsZGVyW10gPSBbXTtcbiAgcHJpdmF0ZSB1cGRhdGVzOiBFeHByZXNzaW9uW10gPSBbXTtcbiAgcHJpdmF0ZSBhY3Rpb25zOiBFeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgb3B0aW9uczogQW90Q29tcGlsZXJPcHRpb25zLCBwcml2YXRlIHJlZmxlY3RvcjogU3RhdGljUmVmbGVjdG9yLFxuICAgICAgcHJpdmF0ZSBleHRlcm5hbFJlZmVyZW5jZVZhcnM6IE1hcDxTdGF0aWNTeW1ib2wsIHN0cmluZz4sIHByaXZhdGUgcGFyZW50OiBWaWV3QnVpbGRlcnxudWxsLFxuICAgICAgcHJpdmF0ZSBjb21wb25lbnQ6IFN0YXRpY1N5bWJvbCwgcHJpdmF0ZSBpc0hvc3RDb21wb25lbnQ6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGVtYmVkZGVkVmlld0luZGV4OiBudW1iZXIsIHByaXZhdGUgcGlwZXM6IE1hcDxzdHJpbmcsIFN0YXRpY1N5bWJvbD4sXG4gICAgICBwcml2YXRlIGd1YXJkczogR3VhcmRFeHByZXNzaW9uW10sIHByaXZhdGUgY3R4OiBPdXRwdXRDb250ZXh0LFxuICAgICAgcHJpdmF0ZSB2aWV3QnVpbGRlckZhY3Rvcnk6IFZpZXdCdWlsZGVyRmFjdG9yeSkge31cblxuICBwcml2YXRlIGdldE91dHB1dFZhcih0eXBlOiBvLkJ1aWx0aW5UeXBlTmFtZXxTdGF0aWNTeW1ib2wpOiBzdHJpbmcge1xuICAgIGxldCB2YXJOYW1lOiBzdHJpbmd8dW5kZWZpbmVkO1xuICAgIGlmICh0eXBlID09PSB0aGlzLmNvbXBvbmVudCAmJiB0aGlzLmlzSG9zdENvbXBvbmVudCkge1xuICAgICAgdmFyTmFtZSA9IERZTkFNSUNfVkFSX05BTUU7XG4gICAgfSBlbHNlIGlmICh0eXBlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sKSB7XG4gICAgICB2YXJOYW1lID0gdGhpcy5leHRlcm5hbFJlZmVyZW5jZVZhcnMuZ2V0KHR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXJOYW1lID0gRFlOQU1JQ19WQVJfTkFNRTtcbiAgICB9XG4gICAgaWYgKCF2YXJOYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYElsbGVnYWwgU3RhdGU6IHJlZmVycmluZyB0byBhIHR5cGUgd2l0aG91dCBhIHZhcmlhYmxlICR7SlNPTi5zdHJpbmdpZnkodHlwZSl9YCk7XG4gICAgfVxuICAgIHJldHVybiB2YXJOYW1lO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRUeXBlR3VhcmRFeHByZXNzaW9ucyhhc3Q6IEVtYmVkZGVkVGVtcGxhdGVBc3QpOiBHdWFyZEV4cHJlc3Npb25bXSB7XG4gICAgY29uc3QgcmVzdWx0ID0gWy4uLnRoaXMuZ3VhcmRzXTtcbiAgICBmb3IgKGxldCBkaXJlY3RpdmUgb2YgYXN0LmRpcmVjdGl2ZXMpIHtcbiAgICAgIGZvciAobGV0IGlucHV0IG9mIGRpcmVjdGl2ZS5pbnB1dHMpIHtcbiAgICAgICAgY29uc3QgZ3VhcmQgPSBkaXJlY3RpdmUuZGlyZWN0aXZlLmd1YXJkc1tpbnB1dC5kaXJlY3RpdmVOYW1lXTtcbiAgICAgICAgaWYgKGd1YXJkKSB7XG4gICAgICAgICAgY29uc3QgdXNlSWYgPSBndWFyZCA9PT0gJ1VzZUlmJztcbiAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICBndWFyZCxcbiAgICAgICAgICAgIHVzZUlmLFxuICAgICAgICAgICAgZXhwcmVzc2lvbjoge1xuICAgICAgICAgICAgICBjb250ZXh0OiB0aGlzLmNvbXBvbmVudCxcbiAgICAgICAgICAgICAgdmFsdWU6IGlucHV0LnZhbHVlLFxuICAgICAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5zb3VyY2VTcGFuLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmlzaXRBbGwodmFyaWFibGVzOiBWYXJpYWJsZUFzdFtdLCBhc3ROb2RlczogVGVtcGxhdGVBc3RbXSkge1xuICAgIHRoaXMudmFyaWFibGVzID0gdmFyaWFibGVzO1xuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0Tm9kZXMpO1xuICB9XG5cbiAgYnVpbGQoY29tcG9uZW50SWQ6IHN0cmluZywgdGFyZ2V0U3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdKTogby5TdGF0ZW1lbnRbXSB7XG4gICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4gY2hpbGQuYnVpbGQoY29tcG9uZW50SWQsIHRhcmdldFN0YXRlbWVudHMpKTtcbiAgICBsZXQgdmlld1N0bXRzOiBvLlN0YXRlbWVudFtdID1cbiAgICAgICAgW28udmFyaWFibGUoRFlOQU1JQ19WQVJfTkFNRSkuc2V0KG8uTlVMTF9FWFBSKS50b0RlY2xTdG10KG8uRFlOQU1JQ19UWVBFKV07XG4gICAgbGV0IGJpbmRpbmdDb3VudCA9IDA7XG4gICAgdGhpcy51cGRhdGVzLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcbiAgICAgIGNvbnN0IHtzb3VyY2VTcGFuLCBjb250ZXh0LCB2YWx1ZX0gPSB0aGlzLnByZXByb2Nlc3NVcGRhdGVFeHByZXNzaW9uKGV4cHJlc3Npb24pO1xuICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7YmluZGluZ0NvdW50Kyt9YDtcbiAgICAgIGNvbnN0IG5hbWVSZXNvbHZlciA9IGNvbnRleHQgPT09IHRoaXMuY29tcG9uZW50ID8gdGhpcyA6IGRlZmF1bHRSZXNvbHZlcjtcbiAgICAgIGNvbnN0IHtzdG10cywgY3VyclZhbEV4cHJ9ID0gY29udmVydFByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICBuYW1lUmVzb2x2ZXIsIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoY29udGV4dCkpLCB2YWx1ZSwgYmluZGluZ0lkLFxuICAgICAgICAgIEJpbmRpbmdGb3JtLkdlbmVyYWwpO1xuICAgICAgc3RtdHMucHVzaChuZXcgby5FeHByZXNzaW9uU3RhdGVtZW50KGN1cnJWYWxFeHByKSk7XG4gICAgICB2aWV3U3RtdHMucHVzaCguLi5zdG10cy5tYXAoXG4gICAgICAgICAgKHN0bXQ6IG8uU3RhdGVtZW50KSA9PiBvLmFwcGx5U291cmNlU3BhblRvU3RhdGVtZW50SWZOZWVkZWQoc3RtdCwgc291cmNlU3BhbikpKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWN0aW9ucy5mb3JFYWNoKCh7c291cmNlU3BhbiwgY29udGV4dCwgdmFsdWV9KSA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nSWQgPSBgJHtiaW5kaW5nQ291bnQrK31gO1xuICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gdGhpcy5jb21wb25lbnQgPyB0aGlzIDogZGVmYXVsdFJlc29sdmVyO1xuICAgICAgY29uc3Qge3N0bXRzfSA9IGNvbnZlcnRBY3Rpb25CaW5kaW5nKFxuICAgICAgICAgIG5hbWVSZXNvbHZlciwgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihjb250ZXh0KSksIHZhbHVlLCBiaW5kaW5nSWQpO1xuICAgICAgdmlld1N0bXRzLnB1c2goLi4uc3RtdHMubWFwKFxuICAgICAgICAgIChzdG10OiBvLlN0YXRlbWVudCkgPT4gby5hcHBseVNvdXJjZVNwYW5Ub1N0YXRlbWVudElmTmVlZGVkKHN0bXQsIHNvdXJjZVNwYW4pKSk7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5ndWFyZHMubGVuZ3RoKSB7XG4gICAgICBsZXQgZ3VhcmRFeHByZXNzaW9uOiBvLkV4cHJlc3Npb258dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgZm9yIChjb25zdCBndWFyZCBvZiB0aGlzLmd1YXJkcykge1xuICAgICAgICBjb25zdCB7Y29udGV4dCwgdmFsdWV9ID0gdGhpcy5wcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihndWFyZC5leHByZXNzaW9uKTtcbiAgICAgICAgY29uc3QgYmluZGluZ0lkID0gYCR7YmluZGluZ0NvdW50Kyt9YDtcbiAgICAgICAgY29uc3QgbmFtZVJlc29sdmVyID0gY29udGV4dCA9PT0gdGhpcy5jb21wb25lbnQgPyB0aGlzIDogZGVmYXVsdFJlc29sdmVyO1xuICAgICAgICAvLyBXZSBvbmx5IHN1cHBvcnQgc3VwcG9ydCBzaW1wbGUgZXhwcmVzc2lvbnMgYW5kIGlnbm9yZSBvdGhlcnMgYXMgdGhleVxuICAgICAgICAvLyBhcmUgdW5saWtlbHkgdG8gYWZmZWN0IHR5cGUgbmFycm93aW5nLlxuICAgICAgICBjb25zdCB7c3RtdHMsIGN1cnJWYWxFeHByfSA9IGNvbnZlcnRQcm9wZXJ0eUJpbmRpbmcoXG4gICAgICAgICAgICBuYW1lUmVzb2x2ZXIsIG8udmFyaWFibGUodGhpcy5nZXRPdXRwdXRWYXIoY29udGV4dCkpLCB2YWx1ZSwgYmluZGluZ0lkLFxuICAgICAgICAgICAgQmluZGluZ0Zvcm0uVHJ5U2ltcGxlKTtcbiAgICAgICAgaWYgKHN0bXRzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgY29uc3QgZ3VhcmRDbGF1c2UgPVxuICAgICAgICAgICAgICBndWFyZC51c2VJZiA/IGN1cnJWYWxFeHByIDogdGhpcy5jdHguaW1wb3J0RXhwcihndWFyZC5ndWFyZCkuY2FsbEZuKFtjdXJyVmFsRXhwcl0pO1xuICAgICAgICAgIGd1YXJkRXhwcmVzc2lvbiA9IGd1YXJkRXhwcmVzc2lvbiA/IGd1YXJkRXhwcmVzc2lvbi5hbmQoZ3VhcmRDbGF1c2UpIDogZ3VhcmRDbGF1c2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChndWFyZEV4cHJlc3Npb24pIHtcbiAgICAgICAgdmlld1N0bXRzID0gW25ldyBvLklmU3RtdChndWFyZEV4cHJlc3Npb24sIHZpZXdTdG10cyldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHZpZXdOYW1lID0gYF9WaWV3XyR7Y29tcG9uZW50SWR9XyR7dGhpcy5lbWJlZGRlZFZpZXdJbmRleH1gO1xuICAgIGNvbnN0IHZpZXdGYWN0b3J5ID0gbmV3IG8uRGVjbGFyZUZ1bmN0aW9uU3RtdCh2aWV3TmFtZSwgW10sIHZpZXdTdG10cyk7XG4gICAgdGFyZ2V0U3RhdGVtZW50cy5wdXNoKHZpZXdGYWN0b3J5KTtcbiAgICByZXR1cm4gdGFyZ2V0U3RhdGVtZW50cztcbiAgfVxuXG4gIHZpc2l0Qm91bmRUZXh0KGFzdDogQm91bmRUZXh0QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IGFzdFdpdGhTb3VyY2UgPSA8QVNUV2l0aFNvdXJjZT5hc3QudmFsdWU7XG4gICAgY29uc3QgaW50ZXIgPSA8SW50ZXJwb2xhdGlvbj5hc3RXaXRoU291cmNlLmFzdDtcblxuICAgIGludGVyLmV4cHJlc3Npb25zLmZvckVhY2goXG4gICAgICAgIChleHByKSA9PlxuICAgICAgICAgICAgdGhpcy51cGRhdGVzLnB1c2goe2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogZXhwciwgc291cmNlU3BhbjogYXN0LnNvdXJjZVNwYW59KSk7XG4gIH1cblxuICB2aXNpdEVtYmVkZGVkVGVtcGxhdGUoYXN0OiBFbWJlZGRlZFRlbXBsYXRlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3QpO1xuICAgIC8vIE5vdGU6IFRoZSBvbGQgdmlldyBjb21waWxlciB1c2VkIHRvIHVzZSBhbiBgYW55YCB0eXBlXG4gICAgLy8gZm9yIHRoZSBjb250ZXh0IGluIGFueSBlbWJlZGRlZCB2aWV3LlxuICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgIC8vIEZpbmQgYW55IGFwcGxpY2FibGUgdHlwZSBndWFyZHMuIEZvciBleGFtcGxlLCBOZ0lmIGhhcyBhIHR5cGUgZ3VhcmQgb24gbmdJZlxuICAgICAgLy8gKHNlZSBOZ0lmLm5nSWZUeXBlR3VhcmQpIHRoYXQgY2FuIGJlIHVzZWQgdG8gaW5kaWNhdGUgdGhhdCBhIHRlbXBsYXRlIGlzIG9ubHlcbiAgICAgIC8vIHN0YW1wZWQgb3V0IGlmIG5nSWYgaXMgdHJ1dGh5IHNvIGFueSBiaW5kaW5ncyBpbiB0aGUgdGVtcGxhdGUgY2FuIGFzc3VtZSB0aGF0LFxuICAgICAgLy8gaWYgYSBudWxsYWJsZSB0eXBlIGlzIHVzZWQgZm9yIG5nSWYsIHRoYXQgZXhwcmVzc2lvbiBpcyBub3QgbnVsbCBvciB1bmRlZmluZWQuXG4gICAgICBjb25zdCBndWFyZHMgPSB0aGlzLmdldFR5cGVHdWFyZEV4cHJlc3Npb25zKGFzdCk7XG4gICAgICBjb25zdCBjaGlsZFZpc2l0b3IgPSB0aGlzLnZpZXdCdWlsZGVyRmFjdG9yeSh0aGlzLCBndWFyZHMpO1xuICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKGNoaWxkVmlzaXRvcik7XG4gICAgICBjaGlsZFZpc2l0b3IudmlzaXRBbGwoYXN0LnZhcmlhYmxlcywgYXN0LmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cblxuICB2aXNpdEVsZW1lbnQoYXN0OiBFbGVtZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3QpO1xuXG4gICAgbGV0IGlucHV0RGVmczogby5FeHByZXNzaW9uW10gPSBbXTtcbiAgICBsZXQgdXBkYXRlUmVuZGVyZXJFeHByZXNzaW9uczogRXhwcmVzc2lvbltdID0gW107XG4gICAgbGV0IG91dHB1dERlZnM6IG8uRXhwcmVzc2lvbltdID0gW107XG4gICAgYXN0LmlucHV0cy5mb3JFYWNoKChpbnB1dEFzdCkgPT4ge1xuICAgICAgdGhpcy51cGRhdGVzLnB1c2goXG4gICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogaW5wdXRBc3QudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0QXN0LnNvdXJjZVNwYW59KTtcbiAgICB9KTtcblxuICAgIHRlbXBsYXRlVmlzaXRBbGwodGhpcywgYXN0LmNoaWxkcmVuKTtcbiAgfVxuXG4gIHByaXZhdGUgdmlzaXRFbGVtZW50T3JUZW1wbGF0ZShhc3Q6IHtcbiAgICBvdXRwdXRzOiBCb3VuZEV2ZW50QXN0W10sXG4gICAgZGlyZWN0aXZlczogRGlyZWN0aXZlQXN0W10sXG4gICAgcmVmZXJlbmNlczogUmVmZXJlbmNlQXN0W10sXG4gIH0pIHtcbiAgICBhc3QuZGlyZWN0aXZlcy5mb3JFYWNoKChkaXJBc3QpID0+IHsgdGhpcy52aXNpdERpcmVjdGl2ZShkaXJBc3QpOyB9KTtcblxuICAgIGFzdC5yZWZlcmVuY2VzLmZvckVhY2goKHJlZikgPT4ge1xuICAgICAgbGV0IG91dHB1dFZhclR5cGU6IE91dHB1dFZhclR5cGUgPSBudWxsICE7XG4gICAgICAvLyBOb3RlOiBUaGUgb2xkIHZpZXcgY29tcGlsZXIgdXNlZCB0byB1c2UgYW4gYGFueWAgdHlwZVxuICAgICAgLy8gZm9yIGRpcmVjdGl2ZXMgZXhwb3NlZCB2aWEgYGV4cG9ydEFzYC5cbiAgICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgICBpZiAocmVmLnZhbHVlICYmIHJlZi52YWx1ZS5pZGVudGlmaWVyICYmIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgICAgb3V0cHV0VmFyVHlwZSA9IHJlZi52YWx1ZS5pZGVudGlmaWVyLnJlZmVyZW5jZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dFZhclR5cGUgPSBvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljO1xuICAgICAgfVxuICAgICAgdGhpcy5yZWZPdXRwdXRWYXJzLnNldChyZWYubmFtZSwgb3V0cHV0VmFyVHlwZSk7XG4gICAgfSk7XG4gICAgYXN0Lm91dHB1dHMuZm9yRWFjaCgob3V0cHV0QXN0KSA9PiB7XG4gICAgICB0aGlzLmFjdGlvbnMucHVzaChcbiAgICAgICAgICB7Y29udGV4dDogdGhpcy5jb21wb25lbnQsIHZhbHVlOiBvdXRwdXRBc3QuaGFuZGxlciwgc291cmNlU3Bhbjogb3V0cHV0QXN0LnNvdXJjZVNwYW59KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpc2l0RGlyZWN0aXZlKGRpckFzdDogRGlyZWN0aXZlQXN0KSB7XG4gICAgY29uc3QgZGlyVHlwZSA9IGRpckFzdC5kaXJlY3RpdmUudHlwZS5yZWZlcmVuY2U7XG4gICAgZGlyQXN0LmlucHV0cy5mb3JFYWNoKFxuICAgICAgICAoaW5wdXQpID0+IHRoaXMudXBkYXRlcy5wdXNoKFxuICAgICAgICAgICAge2NvbnRleHQ6IHRoaXMuY29tcG9uZW50LCB2YWx1ZTogaW5wdXQudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0LnNvdXJjZVNwYW59KSk7XG4gICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAvLyBmb3IgZXhwcmVzc2lvbnMgaW4gaG9zdCBwcm9wZXJ0aWVzIC8gZXZlbnRzLlxuICAgIC8vIFdlIGtlZXAgdGhpcyBiZWhhaXZvciBiZWhpbmQgYSBmbGFnIGZvciBub3cuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2spIHtcbiAgICAgIGRpckFzdC5ob3N0UHJvcGVydGllcy5mb3JFYWNoKFxuICAgICAgICAgIChpbnB1dEFzdCkgPT4gdGhpcy51cGRhdGVzLnB1c2goXG4gICAgICAgICAgICAgIHtjb250ZXh0OiBkaXJUeXBlLCB2YWx1ZTogaW5wdXRBc3QudmFsdWUsIHNvdXJjZVNwYW46IGlucHV0QXN0LnNvdXJjZVNwYW59KSk7XG4gICAgICBkaXJBc3QuaG9zdEV2ZW50cy5mb3JFYWNoKChob3N0RXZlbnRBc3QpID0+IHRoaXMuYWN0aW9ucy5wdXNoKHtcbiAgICAgICAgY29udGV4dDogZGlyVHlwZSxcbiAgICAgICAgdmFsdWU6IGhvc3RFdmVudEFzdC5oYW5kbGVyLFxuICAgICAgICBzb3VyY2VTcGFuOiBob3N0RXZlbnRBc3Quc291cmNlU3BhblxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxuXG4gIG5vdGlmeUltcGxpY2l0UmVjZWl2ZXJVc2UoKTogdm9pZCB7fVxuICBnZXRMb2NhbChuYW1lOiBzdHJpbmcpOiBvLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKG5hbWUgPT0gRXZlbnRIYW5kbGVyVmFycy5ldmVudC5uYW1lKSB7XG4gICAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljKSk7XG4gICAgfVxuICAgIGZvciAobGV0IGN1cnJCdWlsZGVyOiBWaWV3QnVpbGRlcnxudWxsID0gdGhpczsgY3VyckJ1aWxkZXI7IGN1cnJCdWlsZGVyID0gY3VyckJ1aWxkZXIucGFyZW50KSB7XG4gICAgICBsZXQgb3V0cHV0VmFyVHlwZTogT3V0cHV0VmFyVHlwZXx1bmRlZmluZWQ7XG4gICAgICAvLyBjaGVjayByZWZlcmVuY2VzXG4gICAgICBvdXRwdXRWYXJUeXBlID0gY3VyckJ1aWxkZXIucmVmT3V0cHV0VmFycy5nZXQobmFtZSk7XG4gICAgICBpZiAob3V0cHV0VmFyVHlwZSA9PSBudWxsKSB7XG4gICAgICAgIC8vIGNoZWNrIHZhcmlhYmxlc1xuICAgICAgICBjb25zdCB2YXJBc3QgPSBjdXJyQnVpbGRlci52YXJpYWJsZXMuZmluZCgodmFyQXN0KSA9PiB2YXJBc3QubmFtZSA9PT0gbmFtZSk7XG4gICAgICAgIGlmICh2YXJBc3QpIHtcbiAgICAgICAgICBvdXRwdXRWYXJUeXBlID0gby5CdWlsdGluVHlwZU5hbWUuRHluYW1pYztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG91dHB1dFZhclR5cGUgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvdXRwdXRWYXJUeXBlKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBwaXBlT3V0cHV0VmFyKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgcGlwZSA9IHRoaXMucGlwZXMuZ2V0KG5hbWUpO1xuICAgIGlmICghcGlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBJbGxlZ2FsIFN0YXRlOiBDb3VsZCBub3QgZmluZCBwaXBlICR7bmFtZX0gaW4gdGVtcGxhdGUgb2YgJHt0aGlzLmNvbXBvbmVudH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZ2V0T3V0cHV0VmFyKHBpcGUpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVwcm9jZXNzVXBkYXRlRXhwcmVzc2lvbihleHByZXNzaW9uOiBFeHByZXNzaW9uKTogRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNvdXJjZVNwYW46IGV4cHJlc3Npb24uc291cmNlU3BhbixcbiAgICAgIGNvbnRleHQ6IGV4cHJlc3Npb24uY29udGV4dCxcbiAgICAgIHZhbHVlOiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nQnVpbHRpbnMoXG4gICAgICAgICAge1xuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbEFycmF5Q29udmVydGVyOiAoYXJnQ291bnQ6IG51bWJlcikgPT4gKGFyZ3M6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGFyciA9IG8ubGl0ZXJhbEFycihhcmdzKTtcbiAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgLy8gZm9yIGFycmF5cy5cbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgPyBhcnIgOiBhcnIuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY3JlYXRlTGl0ZXJhbE1hcENvbnZlcnRlcjpcbiAgICAgICAgICAgICAgICAoa2V5czoge2tleTogc3RyaW5nLCBxdW90ZWQ6IGJvb2xlYW59W10pID0+ICh2YWx1ZXM6IG8uRXhwcmVzc2lvbltdKSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlbnRyaWVzID0ga2V5cy5tYXAoKGssIGkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGsua2V5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHZhbHVlc1tpXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1b3RlZDogay5xdW90ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgY29uc3QgbWFwID0gby5saXRlcmFsTWFwKGVudHJpZXMpO1xuICAgICAgICAgICAgICAgICAgLy8gTm90ZTogVGhlIG9sZCB2aWV3IGNvbXBpbGVyIHVzZWQgdG8gdXNlIGFuIGBhbnlgIHR5cGVcbiAgICAgICAgICAgICAgICAgIC8vIGZvciBtYXBzLlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5mdWxsVGVtcGxhdGVUeXBlQ2hlY2sgPyBtYXAgOiBtYXAuY2FzdChvLkRZTkFNSUNfVFlQRSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNyZWF0ZVBpcGVDb252ZXJ0ZXI6IChuYW1lOiBzdHJpbmcsIGFyZ0NvdW50OiBudW1iZXIpID0+IChhcmdzOiBvLkV4cHJlc3Npb25bXSkgPT4ge1xuICAgICAgICAgICAgICAvLyBOb3RlOiBUaGUgb2xkIHZpZXcgY29tcGlsZXIgdXNlZCB0byB1c2UgYW4gYGFueWAgdHlwZVxuICAgICAgICAgICAgICAvLyBmb3IgcGlwZXMuXG4gICAgICAgICAgICAgIGNvbnN0IHBpcGVFeHByID0gdGhpcy5vcHRpb25zLmZ1bGxUZW1wbGF0ZVR5cGVDaGVjayA/XG4gICAgICAgICAgICAgICAgICBvLnZhcmlhYmxlKHRoaXMucGlwZU91dHB1dFZhcihuYW1lKSkgOlxuICAgICAgICAgICAgICAgICAgby52YXJpYWJsZSh0aGlzLmdldE91dHB1dFZhcihvLkJ1aWx0aW5UeXBlTmFtZS5EeW5hbWljKSk7XG4gICAgICAgICAgICAgIHJldHVybiBwaXBlRXhwci5jYWxsTWV0aG9kKCd0cmFuc2Zvcm0nLCBhcmdzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBleHByZXNzaW9uLnZhbHVlKVxuICAgIH07XG4gIH1cblxuICB2aXNpdE5nQ29udGVudChhc3Q6IE5nQ29udGVudEFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0VGV4dChhc3Q6IFRleHRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdERpcmVjdGl2ZVByb3BlcnR5KGFzdDogQm91bmREaXJlY3RpdmVQcm9wZXJ0eUFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG4gIHZpc2l0UmVmZXJlbmNlKGFzdDogUmVmZXJlbmNlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRWYXJpYWJsZShhc3Q6IFZhcmlhYmxlQXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRFdmVudChhc3Q6IEJvdW5kRXZlbnRBc3QsIGNvbnRleHQ6IGFueSk6IGFueSB7fVxuICB2aXNpdEVsZW1lbnRQcm9wZXJ0eShhc3Q6IEJvdW5kRWxlbWVudFByb3BlcnR5QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkge31cbiAgdmlzaXRBdHRyKGFzdDogQXR0ckFzdCwgY29udGV4dDogYW55KTogYW55IHt9XG59XG4iXX0=