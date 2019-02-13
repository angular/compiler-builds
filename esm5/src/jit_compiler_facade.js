/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { ConstantPool } from './constant_pool';
import { compileInjectable } from './injectable_compiler_2';
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from './ml_parser/interpolation_config';
import { DeclareVarStmt, LiteralExpr, StmtModifier, WrappedNodeExpr } from './output/output_ast';
import { JitEvaluator } from './output/output_jit';
import { r3JitTypeSourceSpan } from './parse_util';
import { R3ResolvedDependencyType } from './render3/r3_factory';
import { R3JitReflector } from './render3/r3_jit';
import { compileInjector, compileNgModule } from './render3/r3_module_compiler';
import { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
import { compileComponentFromMetadata, compileDirectiveFromMetadata, parseHostBindings, verifyHostBindings } from './render3/view/compiler';
import { makeBindingParser, parseTemplate } from './render3/view/template';
import { DomElementSchemaRegistry } from './schema/dom_element_schema_registry';
var CompilerFacadeImpl = /** @class */ (function () {
    function CompilerFacadeImpl(jitEvaluator) {
        if (jitEvaluator === void 0) { jitEvaluator = new JitEvaluator(); }
        this.jitEvaluator = jitEvaluator;
        this.R3ResolvedDependencyType = R3ResolvedDependencyType;
        this.elementSchemaRegistry = new DomElementSchemaRegistry();
    }
    CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
        var res = compilePipeFromMetadata({
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            deps: convertR3DependencyMetadataArray(facade.deps),
            pipeName: facade.pipeName,
            pure: facade.pure,
        });
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
    };
    CompilerFacadeImpl.prototype.compileInjectable = function (angularCoreEnv, sourceMapUrl, facade) {
        var _a = compileInjectable({
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            typeArgumentCount: facade.typeArgumentCount,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: wrapExpression(facade, USE_CLASS),
            useFactory: wrapExpression(facade, USE_FACTORY),
            useValue: wrapExpression(facade, USE_VALUE),
            useExisting: wrapExpression(facade, USE_EXISTING),
            ctorDeps: convertR3DependencyMetadataArray(facade.ctorDeps),
            userDeps: convertR3DependencyMetadataArray(facade.userDeps) || undefined,
        }), expression = _a.expression, statements = _a.statements;
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    };
    CompilerFacadeImpl.prototype.compileInjector = function (angularCoreEnv, sourceMapUrl, facade) {
        var meta = {
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            deps: convertR3DependencyMetadataArray(facade.deps),
            providers: new WrappedNodeExpr(facade.providers),
            imports: new WrappedNodeExpr(facade.imports),
        };
        var res = compileInjector(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
    };
    CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
        var meta = {
            type: new WrappedNodeExpr(facade.type),
            bootstrap: facade.bootstrap.map(wrapReference),
            declarations: facade.declarations.map(wrapReference),
            imports: facade.imports.map(wrapReference),
            exports: facade.exports.map(wrapReference),
            emitInline: true,
        };
        var res = compileNgModule(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    };
    CompilerFacadeImpl.prototype.compileDirective = function (angularCoreEnv, sourceMapUrl, facade) {
        var constantPool = new ConstantPool();
        var bindingParser = makeBindingParser();
        var meta = convertDirectiveFacadeToMetadata(facade);
        var res = compileDirectiveFromMetadata(meta, constantPool, bindingParser);
        var preStatements = tslib_1.__spread(constantPool.statements, res.statements);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, preStatements);
    };
    CompilerFacadeImpl.prototype.compileComponent = function (angularCoreEnv, sourceMapUrl, facade) {
        // The ConstantPool is a requirement of the JIT'er.
        var constantPool = new ConstantPool();
        var interpolationConfig = facade.interpolation ?
            InterpolationConfig.fromArray(facade.interpolation) :
            DEFAULT_INTERPOLATION_CONFIG;
        // Parse the template and check for errors.
        var template = parseTemplate(facade.template, sourceMapUrl, { preserveWhitespaces: facade.preserveWhitespaces, interpolationConfig: interpolationConfig });
        if (template.errors !== undefined) {
            var errors = template.errors.map(function (err) { return err.toString(); }).join(', ');
            throw new Error("Errors during JIT compilation of template for " + facade.name + ": " + errors);
        }
        // Compile the component metadata, including template, into an expression.
        // TODO(alxhub): implement inputs, outputs, queries, etc.
        var res = compileComponentFromMetadata(tslib_1.__assign({}, facade, convertDirectiveFacadeToMetadata(facade), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), wrapDirectivesAndPipesInClosure: false, styles: facade.styles || [], encapsulation: facade.encapsulation, interpolation: interpolationConfig, changeDetection: facade.changeDetection, animations: facade.animations != null ? new WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new WrappedNodeExpr(facade.viewProviders) :
                null, relativeContextFilePath: '', i18nUseExternalIds: true }), constantPool, makeBindingParser(interpolationConfig));
        var preStatements = tslib_1.__spread(constantPool.statements, res.statements);
        return this.jitExpression(res.expression, angularCoreEnv, "ng:///" + facade.name + ".js", preStatements);
    };
    CompilerFacadeImpl.prototype.createParseSourceSpan = function (kind, typeName, sourceUrl) {
        return r3JitTypeSourceSpan(kind, typeName, sourceUrl);
    };
    /**
     * JIT compiles an expression and returns the result of executing that expression.
     *
     * @param def the definition which will be compiled and executed to get the value to patch
     * @param context an object map of @angular/core symbol names to symbols which will be available
     * in the context of the compiled expression
     * @param sourceUrl a URL to use for the source map of the compiled expression
     * @param preStatements a collection of statements that should be evaluated before the expression.
     */
    CompilerFacadeImpl.prototype.jitExpression = function (def, context, sourceUrl, preStatements) {
        // The ConstantPool may contain Statements which declare variables used in the final expression.
        // Therefore, its statements need to precede the actual JIT operation. The final statement is a
        // declaration of $def which is set to the expression being compiled.
        var statements = tslib_1.__spread(preStatements, [
            new DeclareVarStmt('$def', def, undefined, [StmtModifier.Exported]),
        ]);
        var res = this.jitEvaluator.evaluateStatements(sourceUrl, statements, new R3JitReflector(context), /* enableSourceMaps */ true);
        return res['$def'];
    };
    return CompilerFacadeImpl;
}());
export { CompilerFacadeImpl };
var USE_CLASS = Object.keys({ useClass: null })[0];
var USE_FACTORY = Object.keys({ useFactory: null })[0];
var USE_VALUE = Object.keys({ useValue: null })[0];
var USE_EXISTING = Object.keys({ useExisting: null })[0];
var wrapReference = function (value) {
    var wrapped = new WrappedNodeExpr(value);
    return { value: wrapped, type: wrapped };
};
function convertToR3QueryMetadata(facade) {
    return tslib_1.__assign({}, facade, { predicate: Array.isArray(facade.predicate) ? facade.predicate :
            new WrappedNodeExpr(facade.predicate), read: facade.read ? new WrappedNodeExpr(facade.read) : null });
}
function convertDirectiveFacadeToMetadata(facade) {
    var inputsFromMetadata = parseInputOutputs(facade.inputs || []);
    var outputsFromMetadata = parseInputOutputs(facade.outputs || []);
    var propMetadata = facade.propMetadata;
    var inputsFromType = {};
    var outputsFromType = {};
    var _loop_1 = function (field) {
        if (propMetadata.hasOwnProperty(field)) {
            propMetadata[field].forEach(function (ann) {
                if (isInput(ann)) {
                    inputsFromType[field] =
                        ann.bindingPropertyName ? [ann.bindingPropertyName, field] : field;
                }
                else if (isOutput(ann)) {
                    outputsFromType[field] = ann.bindingPropertyName || field;
                }
            });
        }
    };
    for (var field in propMetadata) {
        _loop_1(field);
    }
    return tslib_1.__assign({}, facade, { typeSourceSpan: facade.typeSourceSpan, type: new WrappedNodeExpr(facade.type), deps: convertR3DependencyMetadataArray(facade.deps), host: extractHostBindings(facade.host, facade.propMetadata, facade.typeSourceSpan), inputs: tslib_1.__assign({}, inputsFromMetadata, inputsFromType), outputs: tslib_1.__assign({}, outputsFromMetadata, outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new WrappedNodeExpr(facade.providers) : null });
}
function wrapExpression(obj, property) {
    if (obj.hasOwnProperty(property)) {
        return new WrappedNodeExpr(obj[property]);
    }
    else {
        return undefined;
    }
}
function computeProvidedIn(providedIn) {
    if (providedIn == null || typeof providedIn === 'string') {
        return new LiteralExpr(providedIn);
    }
    else {
        return new WrappedNodeExpr(providedIn);
    }
}
function convertR3DependencyMetadata(facade) {
    var tokenExpr;
    if (facade.token === null) {
        tokenExpr = new LiteralExpr(null);
    }
    else if (facade.resolved === R3ResolvedDependencyType.Attribute) {
        tokenExpr = new LiteralExpr(facade.token);
    }
    else {
        tokenExpr = new WrappedNodeExpr(facade.token);
    }
    return {
        token: tokenExpr,
        resolved: facade.resolved,
        host: facade.host,
        optional: facade.optional,
        self: facade.self,
        skipSelf: facade.skipSelf
    };
}
function convertR3DependencyMetadataArray(facades) {
    return facades == null ? null : facades.map(convertR3DependencyMetadata);
}
function extractHostBindings(host, propMetadata, sourceSpan) {
    // First parse the declarations from the metadata.
    var bindings = parseHostBindings(host || {});
    // After that check host bindings for errors
    var errors = verifyHostBindings(bindings, sourceSpan);
    if (errors.length) {
        throw new Error(errors.map(function (error) { return error.msg; }).join('\n'));
    }
    var _loop_2 = function (field) {
        if (propMetadata.hasOwnProperty(field)) {
            propMetadata[field].forEach(function (ann) {
                if (isHostBinding(ann)) {
                    bindings.properties[ann.hostPropertyName || field] = field;
                }
                else if (isHostListener(ann)) {
                    bindings.listeners[ann.eventName || field] = field + "(" + (ann.args || []).join(',') + ")";
                }
            });
        }
    };
    // Next, loop over the properties of the object, looking for @HostBinding and @HostListener.
    for (var field in propMetadata) {
        _loop_2(field);
    }
    return bindings;
}
function isHostBinding(value) {
    return value.ngMetadataName === 'HostBinding';
}
function isHostListener(value) {
    return value.ngMetadataName === 'HostListener';
}
function isInput(value) {
    return value.ngMetadataName === 'Input';
}
function isOutput(value) {
    return value.ngMetadataName === 'Output';
}
function parseInputOutputs(values) {
    return values.reduce(function (map, value) {
        var _a = tslib_1.__read(value.split(',').map(function (piece) { return piece.trim(); }), 2), field = _a[0], property = _a[1];
        map[field] = property || field;
        return map;
    }, {});
}
export function publishFacade(global) {
    var ng = global.ng || (global.ng = {});
    ng.ɵcompilerFacade = new CompilerFacadeImpl();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFJSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDMUQsT0FBTyxFQUFDLDRCQUE0QixFQUFFLG1CQUFtQixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDbkcsT0FBTyxFQUFDLGNBQWMsRUFBYyxXQUFXLEVBQWEsWUFBWSxFQUFFLGVBQWUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3RILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRCxPQUFPLEVBQThCLG1CQUFtQixFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzlFLE9BQU8sRUFBdUIsd0JBQXdCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUNwRixPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUF5QyxlQUFlLEVBQUUsZUFBZSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDdEgsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFHbkUsT0FBTyxFQUFDLDRCQUE0QixFQUFFLDRCQUE0QixFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDMUksT0FBTyxFQUFDLGlCQUFpQixFQUFFLGFBQWEsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBQ3pFLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBRTlFO0lBSUUsNEJBQW9CLFlBQWlDO1FBQWpDLDZCQUFBLEVBQUEs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SUFBTSxLQUFLLElBQUksWUFBWTtnQkFBckIsS0FBSztLQVVmO0lBRUQsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUVELFNBQVMsYUFBYSxDQUFDLEtBQVU7SUFDL0IsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLGFBQWEsQ0FBQztBQUNoRCxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsS0FBVTtJQUNoQyxPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssY0FBYyxDQUFDO0FBQ2pELENBQUM7QUFHRCxTQUFTLE9BQU8sQ0FBQyxLQUFVO0lBQ3pCLE9BQU8sS0FBSyxDQUFDLGNBQWMsS0FBSyxPQUFPLENBQUM7QUFDMUMsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLEtBQVU7SUFDMUIsT0FBTyxLQUFLLENBQUMsY0FBYyxLQUFLLFFBQVEsQ0FBQztBQUMzQyxDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUFnQjtJQUN6QyxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQ2hCLFVBQUMsR0FBRyxFQUFFLEtBQUs7UUFDSCxJQUFBLHVGQUErRCxFQUE5RCxhQUFLLEVBQUUsZ0JBQXVELENBQUM7UUFDdEUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLFFBQVEsSUFBSSxLQUFLLENBQUM7UUFDL0IsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDLEVBQ0QsRUFBZSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsTUFBVztJQUN2QyxJQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7QUFDaEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVyRmFjYWRlLCBDb3JlRW52aXJvbm1lbnQsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsIFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlLCBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3Rvck1ldGFkYXRhRmFjYWRlLCBSM05nTW9kdWxlTWV0YWRhdGFGYWNhZGUsIFIzUGlwZU1ldGFkYXRhRmFjYWRlLCBSM1F1ZXJ5TWV0YWRhdGFGYWNhZGUsIFN0cmluZ01hcCwgU3RyaW5nTWFwV2l0aFJlbmFtZX0gZnJvbSAnLi9jb21waWxlcl9mYWNhZGVfaW50ZXJmYWNlJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0IHtIb3N0QmluZGluZywgSG9zdExpc3RlbmVyLCBJbnB1dCwgT3V0cHV0LCBUeXBlfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0YWJsZX0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZX0gZnJvbSAnLi9yZW5kZXIzL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtSM0ppdFJlZmxlY3Rvcn0gZnJvbSAnLi9yZW5kZXIzL3IzX2ppdCc7XG5pbXBvcnQge1IzSW5qZWN0b3JNZXRhZGF0YSwgUjNOZ01vZHVsZU1ldGFkYXRhLCBjb21waWxlSW5qZWN0b3IsIGNvbXBpbGVOZ01vZHVsZX0gZnJvbSAnLi9yZW5kZXIzL3IzX21vZHVsZV9jb21waWxlcic7XG5pbXBvcnQge2NvbXBpbGVQaXBlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5pbXBvcnQge1IzUmVmZXJlbmNlfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7Y29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YSwgY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YSwgcGFyc2VIb3N0QmluZGluZ3MsIHZlcmlmeUhvc3RCaW5kaW5nc30gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvY29tcGlsZXInO1xuaW1wb3J0IHttYWtlQmluZGluZ1BhcnNlciwgcGFyc2VUZW1wbGF0ZX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEb21FbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vc2NoZW1hL2RvbV9lbGVtZW50X3NjaGVtYV9yZWdpc3RyeSc7XG5cbmV4cG9ydCBjbGFzcyBDb21waWxlckZhY2FkZUltcGwgaW1wbGVtZW50cyBDb21waWxlckZhY2FkZSB7XG4gIFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSA9IFIzUmVzb2x2ZWREZXBlbmRlbmN5VHlwZSBhcyBhbnk7XG4gIHByaXZhdGUgZWxlbWVudFNjaGVtYVJlZ2lzdHJ5ID0gbmV3IERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSgpO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgaml0RXZhbHVhdG9yID0gbmV3IEppdEV2YWx1YXRvcigpKSB7fVxuXG4gIGNvbXBpbGVQaXBlKGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLCBmYWNhZGU6IFIzUGlwZU1ldGFkYXRhRmFjYWRlKTpcbiAgICAgIGFueSB7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEoe1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICAgIHBpcGVOYW1lOiBmYWNhZGUucGlwZU5hbWUsXG4gICAgICBwdXJlOiBmYWNhZGUucHVyZSxcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCByZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlSW5qZWN0YWJsZShcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdGFibGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3Qge2V4cHJlc3Npb24sIHN0YXRlbWVudHN9ID0gY29tcGlsZUluamVjdGFibGUoe1xuICAgICAgbmFtZTogZmFjYWRlLm5hbWUsXG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBwcm92aWRlZEluOiBjb21wdXRlUHJvdmlkZWRJbihmYWNhZGUucHJvdmlkZWRJbiksXG4gICAgICB1c2VDbGFzczogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfQ0xBU1MpLFxuICAgICAgdXNlRmFjdG9yeTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRkFDVE9SWSksXG4gICAgICB1c2VWYWx1ZTogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfVkFMVUUpLFxuICAgICAgdXNlRXhpc3Rpbmc6IHdyYXBFeHByZXNzaW9uKGZhY2FkZSwgVVNFX0VYSVNUSU5HKSxcbiAgICAgIGN0b3JEZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUuY3RvckRlcHMpLFxuICAgICAgdXNlckRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS51c2VyRGVwcykgfHwgdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvcihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUuZGVwcyksXG4gICAgICBwcm92aWRlcnM6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnByb3ZpZGVycyksXG4gICAgICBpbXBvcnRzOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pbXBvcnRzKSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVJbmplY3RvcihtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCByZXMuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlTmdNb2R1bGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlKTogYW55IHtcbiAgICBjb25zdCBtZXRhOiBSM05nTW9kdWxlTWV0YWRhdGEgPSB7XG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZXhwb3J0czogZmFjYWRlLmV4cG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZW1pdElubGluZTogdHJ1ZSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVOZ01vZHVsZShtZXRhKTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBbXSk7XG4gIH1cblxuICBjb21waWxlRGlyZWN0aXZlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcbiAgICBjb25zdCBiaW5kaW5nUGFyc2VyID0gbWFrZUJpbmRpbmdQYXJzZXIoKTtcblxuICAgIGNvbnN0IG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgPSBjb252ZXJ0RGlyZWN0aXZlRmFjYWRlVG9NZXRhZGF0YShmYWNhZGUpO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgICBjb25zdCBwcmVTdGF0ZW1lbnRzID0gWy4uLmNvbnN0YW50UG9vbC5zdGF0ZW1lbnRzLCAuLi5yZXMuc3RhdGVtZW50c107XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgcHJlU3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgaXMgYSByZXF1aXJlbWVudCBvZiB0aGUgSklUJ2VyLlxuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcblxuICAgIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPSBmYWNhZGUuaW50ZXJwb2xhdGlvbiA/XG4gICAgICAgIEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGZhY2FkZS5pbnRlcnBvbGF0aW9uKSA6XG4gICAgICAgIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICAgIGNvbnN0IHRlbXBsYXRlID0gcGFyc2VUZW1wbGF0ZShcbiAgICAgICAgZmFjYWRlLnRlbXBsYXRlLCBzb3VyY2VNYXBVcmwsXG4gICAgICAgIHtwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBmYWNhZGUucHJlc2VydmVXaGl0ZXNwYWNlcywgaW50ZXJwb2xhdGlvbkNvbmZpZ30pO1xuICAgIGlmICh0ZW1wbGF0ZS5lcnJvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZXJyb3JzID0gdGVtcGxhdGUuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9ycyBkdXJpbmcgSklUIGNvbXBpbGF0aW9uIG9mIHRlbXBsYXRlIGZvciAke2ZhY2FkZS5uYW1lfTogJHtlcnJvcnN9YCk7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgY29tcG9uZW50IG1ldGFkYXRhLCBpbmNsdWRpbmcgdGVtcGxhdGUsIGludG8gYW4gZXhwcmVzc2lvbi5cbiAgICAvLyBUT0RPKGFseGh1Yik6IGltcGxlbWVudCBpbnB1dHMsIG91dHB1dHMsIHF1ZXJpZXMsIGV0Yy5cbiAgICBjb25zdCByZXMgPSBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgICAgICB7XG4gICAgICAgICAgLi4uZmFjYWRlIGFzIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlLFxuICAgICAgICAgIC4uLmNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSksXG4gICAgICAgICAgc2VsZWN0b3I6IGZhY2FkZS5zZWxlY3RvciB8fCB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSxcbiAgICAgICAgICB0ZW1wbGF0ZSxcbiAgICAgICAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgICAgICAgIHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU6IGZhbHNlLFxuICAgICAgICAgIHN0eWxlczogZmFjYWRlLnN0eWxlcyB8fCBbXSxcbiAgICAgICAgICBlbmNhcHN1bGF0aW9uOiBmYWNhZGUuZW5jYXBzdWxhdGlvbiBhcyBhbnksXG4gICAgICAgICAgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICAgICAgYW5pbWF0aW9uczogZmFjYWRlLmFuaW1hdGlvbnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLmFuaW1hdGlvbnMpIDogbnVsbCxcbiAgICAgICAgICB2aWV3UHJvdmlkZXJzOiBmYWNhZGUudmlld1Byb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoOiAnJyxcbiAgICAgICAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGNvbnN0YW50UG9vbCwgbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZykpO1xuICAgIGNvbnN0IHByZVN0YXRlbWVudHMgPSBbLi4uY29uc3RhbnRQb29sLnN0YXRlbWVudHMsIC4uLnJlcy5zdGF0ZW1lbnRzXTtcbiAgICByZXR1cm4gdGhpcy5qaXRFeHByZXNzaW9uKFxuICAgICAgICByZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIGBuZzovLy8ke2ZhY2FkZS5uYW1lfS5qc2AsIHByZVN0YXRlbWVudHMpO1xuICB9XG5cbiAgY3JlYXRlUGFyc2VTb3VyY2VTcGFuKGtpbmQ6IHN0cmluZywgdHlwZU5hbWU6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZVNvdXJjZVNwYW4ge1xuICAgIHJldHVybiByM0ppdFR5cGVTb3VyY2VTcGFuKGtpbmQsIHR5cGVOYW1lLCBzb3VyY2VVcmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpJVCBjb21waWxlcyBhbiBleHByZXNzaW9uIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgb2YgZXhlY3V0aW5nIHRoYXQgZXhwcmVzc2lvbi5cbiAgICpcbiAgICogQHBhcmFtIGRlZiB0aGUgZGVmaW5pdGlvbiB3aGljaCB3aWxsIGJlIGNvbXBpbGVkIGFuZCBleGVjdXRlZCB0byBnZXQgdGhlIHZhbHVlIHRvIHBhdGNoXG4gICAqIEBwYXJhbSBjb250ZXh0IGFuIG9iamVjdCBtYXAgb2YgQGFuZ3VsYXIvY29yZSBzeW1ib2wgbmFtZXMgdG8gc3ltYm9scyB3aGljaCB3aWxsIGJlIGF2YWlsYWJsZVxuICAgKiBpbiB0aGUgY29udGV4dCBvZiB0aGUgY29tcGlsZWQgZXhwcmVzc2lvblxuICAgKiBAcGFyYW0gc291cmNlVXJsIGEgVVJMIHRvIHVzZSBmb3IgdGhlIHNvdXJjZSBtYXAgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHByZVN0YXRlbWVudHMgYSBjb2xsZWN0aW9uIG9mIHN0YXRlbWVudHMgdGhhdCBzaG91bGQgYmUgZXZhbHVhdGVkIGJlZm9yZSB0aGUgZXhwcmVzc2lvbi5cbiAgICovXG4gIHByaXZhdGUgaml0RXhwcmVzc2lvbihcbiAgICAgIGRlZjogRXhwcmVzc2lvbiwgY29udGV4dDoge1trZXk6IHN0cmluZ106IGFueX0sIHNvdXJjZVVybDogc3RyaW5nLFxuICAgICAgcHJlU3RhdGVtZW50czogU3RhdGVtZW50W10pOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgbWF5IGNvbnRhaW4gU3RhdGVtZW50cyB3aGljaCBkZWNsYXJlIHZhcmlhYmxlcyB1c2VkIGluIHRoZSBmaW5hbCBleHByZXNzaW9uLlxuICAgIC8vIFRoZXJlZm9yZSwgaXRzIHN0YXRlbWVudHMgbmVlZCB0byBwcmVjZWRlIHRoZSBhY3R1YWwgSklUIG9wZXJhdGlvbi4gVGhlIGZpbmFsIHN0YXRlbWVudCBpcyBhXG4gICAgLy8gZGVjbGFyYXRpb24gb2YgJGRlZiB3aGljaCBpcyBzZXQgdG8gdGhlIGV4cHJlc3Npb24gYmVpbmcgY29tcGlsZWQuXG4gICAgY29uc3Qgc3RhdGVtZW50czogU3RhdGVtZW50W10gPSBbXG4gICAgICAuLi5wcmVTdGF0ZW1lbnRzLFxuICAgICAgbmV3IERlY2xhcmVWYXJTdG10KCckZGVmJywgZGVmLCB1bmRlZmluZWQsIFtTdG10TW9kaWZpZXIuRXhwb3J0ZWRdKSxcbiAgICBdO1xuXG4gICAgY29uc3QgcmVzID0gdGhpcy5qaXRFdmFsdWF0b3IuZXZhbHVhdGVTdGF0ZW1lbnRzKFxuICAgICAgICBzb3VyY2VVcmwsIHN0YXRlbWVudHMsIG5ldyBSM0ppdFJlZmxlY3Rvcihjb250ZXh0KSwgLyogZW5hYmxlU291cmNlTWFwcyAqLyB0cnVlKTtcbiAgICByZXR1cm4gcmVzWyckZGVmJ107XG4gIH1cbn1cblxuLy8gVGhpcyBzZWVtcyB0byBiZSBuZWVkZWQgdG8gcGxhY2F0ZSBUUyB2My4wIG9ubHlcbnR5cGUgUjNDb21wb25lbnRNZXRhZGF0YUZhY2FkZU5vUHJvcEFuZFdoaXRlc3BhY2UgPSBQaWNrPFxuICAgIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsXG4gICAgRXhjbHVkZTxFeGNsdWRlPGtleW9mIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsICdwcmVzZXJ2ZVdoaXRlc3BhY2VzJz4sICdwcm9wTWV0YWRhdGEnPj47XG5cbmNvbnN0IFVTRV9DTEFTUyA9IE9iamVjdC5rZXlzKHt1c2VDbGFzczogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0ZBQ1RPUlkgPSBPYmplY3Qua2V5cyh7dXNlRmFjdG9yeTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX1ZBTFVFID0gT2JqZWN0LmtleXMoe3VzZVZhbHVlOiBudWxsfSlbMF07XG5jb25zdCBVU0VfRVhJU1RJTkcgPSBPYmplY3Qua2V5cyh7dXNlRXhpc3Rpbmc6IG51bGx9KVswXTtcblxuY29uc3Qgd3JhcFJlZmVyZW5jZSA9IGZ1bmN0aW9uKHZhbHVlOiBUeXBlKTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCB3cmFwcGVkID0gbmV3IFdyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufTtcblxuZnVuY3Rpb24gY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKGZhY2FkZTogUjNRdWVyeU1ldGFkYXRhRmFjYWRlKTogUjNRdWVyeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUsXG4gICAgcHJlZGljYXRlOiBBcnJheS5pc0FycmF5KGZhY2FkZS5wcmVkaWNhdGUpID8gZmFjYWRlLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5pbnB1dHMgfHwgW10pO1xuICBjb25zdCBvdXRwdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLm91dHB1dHMgfHwgW10pO1xuICBjb25zdCBwcm9wTWV0YWRhdGEgPSBmYWNhZGUucHJvcE1ldGFkYXRhO1xuICBjb25zdCBpbnB1dHNGcm9tVHlwZTogU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFN0cmluZ01hcCA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9XG4gICAgICAgICAgICAgIGFubi5iaW5kaW5nUHJvcGVydHlOYW1lID8gW2Fubi5iaW5kaW5nUHJvcGVydHlOYW1lLCBmaWVsZF0gOiBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5iaW5kaW5nUHJvcGVydHlOYW1lIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSBhcyBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgIGRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS5kZXBzKSxcbiAgICBob3N0OiBleHRyYWN0SG9zdEJpbmRpbmdzKGZhY2FkZS5ob3N0LCBmYWNhZGUucHJvcE1ldGFkYXRhLCBmYWNhZGUudHlwZVNvdXJjZVNwYW4pLFxuICAgIGlucHV0czogey4uLmlucHV0c0Zyb21NZXRhZGF0YSwgLi4uaW5wdXRzRnJvbVR5cGV9LFxuICAgIG91dHB1dHM6IHsuLi5vdXRwdXRzRnJvbU1ldGFkYXRhLCAuLi5vdXRwdXRzRnJvbVR5cGV9LFxuICAgIHF1ZXJpZXM6IGZhY2FkZS5xdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIHByb3ZpZGVyczogZmFjYWRlLnByb3ZpZGVycyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJvdmlkZXJzKSA6IG51bGwsXG4gIH07XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogVHlwZSB8IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBFeHByZXNzaW9uIHtcbiAgaWYgKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBsZXQgdG9rZW5FeHByO1xuICBpZiAoZmFjYWRlLnRva2VuID09PSBudWxsKSB7XG4gICAgdG9rZW5FeHByID0gbmV3IExpdGVyYWxFeHByKG51bGwpO1xuICB9IGVsc2UgaWYgKGZhY2FkZS5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSkge1xuICAgIHRva2VuRXhwciA9IG5ldyBMaXRlcmFsRXhwcihmYWNhZGUudG9rZW4pO1xuICB9IGVsc2Uge1xuICAgIHRva2VuRXhwciA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRva2VuOiB0b2tlbkV4cHIsXG4gICAgcmVzb2x2ZWQ6IGZhY2FkZS5yZXNvbHZlZCxcbiAgICBob3N0OiBmYWNhZGUuaG9zdCxcbiAgICBvcHRpb25hbDogZmFjYWRlLm9wdGlvbmFsLFxuICAgIHNlbGY6IGZhY2FkZS5zZWxmLFxuICAgIHNraXBTZWxmOiBmYWNhZGUuc2tpcFNlbGZcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXSB8IG51bGwgfCB1bmRlZmluZWQpOlxuICAgIFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbCB7XG4gIHJldHVybiBmYWNhZGVzID09IG51bGwgPyBudWxsIDogZmFjYWRlcy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSwgcHJvcE1ldGFkYXRhOiB7W2tleTogc3RyaW5nXTogYW55W119LFxuICAgIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbik6IHtcbiAgYXR0cmlidXRlczogU3RyaW5nTWFwLFxuICBsaXN0ZW5lcnM6IFN0cmluZ01hcCxcbiAgcHJvcGVydGllczogU3RyaW5nTWFwLFxufSB7XG4gIC8vIEZpcnN0IHBhcnNlIHRoZSBkZWNsYXJhdGlvbnMgZnJvbSB0aGUgbWV0YWRhdGEuXG4gIGNvbnN0IGJpbmRpbmdzID0gcGFyc2VIb3N0QmluZGluZ3MoaG9zdCB8fCB7fSk7XG5cbiAgLy8gQWZ0ZXIgdGhhdCBjaGVjayBob3N0IGJpbmRpbmdzIGZvciBlcnJvcnNcbiAgY29uc3QgZXJyb3JzID0gdmVyaWZ5SG9zdEJpbmRpbmdzKGJpbmRpbmdzLCBzb3VyY2VTcGFuKTtcbiAgaWYgKGVycm9ycy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1hcCgoZXJyb3I6IFBhcnNlRXJyb3IpID0+IGVycm9yLm1zZykuam9pbignXFxuJykpO1xuICB9XG5cbiAgLy8gTmV4dCwgbG9vcCBvdmVyIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3QsIGxvb2tpbmcgZm9yIEBIb3N0QmluZGluZyBhbmQgQEhvc3RMaXN0ZW5lci5cbiAgZm9yIChjb25zdCBmaWVsZCBpbiBwcm9wTWV0YWRhdGEpIHtcbiAgICBpZiAocHJvcE1ldGFkYXRhLmhhc093blByb3BlcnR5KGZpZWxkKSkge1xuICAgICAgcHJvcE1ldGFkYXRhW2ZpZWxkXS5mb3JFYWNoKGFubiA9PiB7XG4gICAgICAgIGlmIChpc0hvc3RCaW5kaW5nKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5wcm9wZXJ0aWVzW2Fubi5ob3N0UHJvcGVydHlOYW1lIHx8IGZpZWxkXSA9IGZpZWxkO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9zdExpc3RlbmVyKGFubikpIHtcbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbYW5uLmV2ZW50TmFtZSB8fCBmaWVsZF0gPSBgJHtmaWVsZH0oJHsoYW5uLmFyZ3MgfHwgW10pLmpvaW4oJywnKX0pYDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJpbmRpbmdzO1xufVxuXG5mdW5jdGlvbiBpc0hvc3RCaW5kaW5nKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0QmluZGluZyB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RCaW5kaW5nJztcbn1cblxuZnVuY3Rpb24gaXNIb3N0TGlzdGVuZXIodmFsdWU6IGFueSk6IHZhbHVlIGlzIEhvc3RMaXN0ZW5lciB7XG4gIHJldHVybiB2YWx1ZS5uZ01ldGFkYXRhTmFtZSA9PT0gJ0hvc3RMaXN0ZW5lcic7XG59XG5cblxuZnVuY3Rpb24gaXNJbnB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgSW5wdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdJbnB1dCc7XG59XG5cbmZ1bmN0aW9uIGlzT3V0cHV0KHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBPdXRwdXQge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdPdXRwdXQnO1xufVxuXG5mdW5jdGlvbiBwYXJzZUlucHV0T3V0cHV0cyh2YWx1ZXM6IHN0cmluZ1tdKTogU3RyaW5nTWFwIHtcbiAgcmV0dXJuIHZhbHVlcy5yZWR1Y2UoXG4gICAgICAobWFwLCB2YWx1ZSkgPT4ge1xuICAgICAgICBjb25zdCBbZmllbGQsIHByb3BlcnR5XSA9IHZhbHVlLnNwbGl0KCcsJykubWFwKHBpZWNlID0+IHBpZWNlLnRyaW0oKSk7XG4gICAgICAgIG1hcFtmaWVsZF0gPSBwcm9wZXJ0eSB8fCBmaWVsZDtcbiAgICAgICAgcmV0dXJuIG1hcDtcbiAgICAgIH0sXG4gICAgICB7fSBhcyBTdHJpbmdNYXApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHVibGlzaEZhY2FkZShnbG9iYWw6IGFueSkge1xuICBjb25zdCBuZzogRXhwb3J0ZWRDb21waWxlckZhY2FkZSA9IGdsb2JhbC5uZyB8fCAoZ2xvYmFsLm5nID0ge30pO1xuICBuZy7JtWNvbXBpbGVyRmFjYWRlID0gbmV3IENvbXBpbGVyRmFjYWRlSW1wbCgpO1xufVxuIl19