/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { __assign, __read, __spread } from "tslib";
import { ConstantPool } from './constant_pool';
import { Identifiers } from './identifiers';
import { compileInjectable } from './injectable_compiler_2';
import { DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig } from './ml_parser/interpolation_config';
import { DeclareVarStmt, LiteralExpr, StmtModifier, WrappedNodeExpr } from './output/output_ast';
import { JitEvaluator } from './output/output_jit';
import { r3JitTypeSourceSpan } from './parse_util';
import { R3FactoryTarget, R3ResolvedDependencyType, compileFactoryFunction } from './render3/r3_factory';
import { R3JitReflector } from './render3/r3_jit';
import { compileInjector, compileNgModule } from './render3/r3_module_compiler';
import { compilePipeFromMetadata } from './render3/r3_pipe_compiler';
import { compileComponentFromMetadata, compileDirectiveFromMetadata, parseHostBindings, verifyHostBindings } from './render3/view/compiler';
import { makeBindingParser, parseTemplate } from './render3/view/template';
import { ResourceLoader } from './resource_loader';
import { DomElementSchemaRegistry } from './schema/dom_element_schema_registry';
var CompilerFacadeImpl = /** @class */ (function () {
    function CompilerFacadeImpl(jitEvaluator) {
        if (jitEvaluator === void 0) { jitEvaluator = new JitEvaluator(); }
        this.jitEvaluator = jitEvaluator;
        this.R3ResolvedDependencyType = R3ResolvedDependencyType;
        this.R3FactoryTarget = R3FactoryTarget;
        this.ResourceLoader = ResourceLoader;
        this.elementSchemaRegistry = new DomElementSchemaRegistry();
    }
    CompilerFacadeImpl.prototype.compilePipe = function (angularCoreEnv, sourceMapUrl, facade) {
        var metadata = {
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            typeArgumentCount: facade.typeArgumentCount,
            deps: convertR3DependencyMetadataArray(facade.deps),
            pipeName: facade.pipeName,
            pure: facade.pure,
        };
        var res = compilePipeFromMetadata(metadata);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    };
    CompilerFacadeImpl.prototype.compileInjectable = function (angularCoreEnv, sourceMapUrl, facade) {
        var _a = compileInjectable({
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            typeArgumentCount: facade.typeArgumentCount,
            providedIn: computeProvidedIn(facade.providedIn),
            useClass: wrapExpression(facade, USE_CLASS),
            useFactory: wrapExpression(facade, USE_FACTORY),
            useValue: wrapExpression(facade, USE_VALUE),
            useExisting: wrapExpression(facade, USE_EXISTING),
            userDeps: convertR3DependencyMetadataArray(facade.userDeps) || undefined,
        }), expression = _a.expression, statements = _a.statements;
        return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
    };
    CompilerFacadeImpl.prototype.compileInjector = function (angularCoreEnv, sourceMapUrl, facade) {
        var meta = {
            name: facade.name,
            type: new WrappedNodeExpr(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            deps: convertR3DependencyMetadataArray(facade.deps),
            providers: new WrappedNodeExpr(facade.providers),
            imports: facade.imports.map(function (i) { return new WrappedNodeExpr(i); }),
        };
        var res = compileInjector(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, res.statements);
    };
    CompilerFacadeImpl.prototype.compileNgModule = function (angularCoreEnv, sourceMapUrl, facade) {
        var meta = {
            type: new WrappedNodeExpr(facade.type),
            internalType: new WrappedNodeExpr(facade.type),
            adjacentType: new WrappedNodeExpr(facade.type),
            bootstrap: facade.bootstrap.map(wrapReference),
            declarations: facade.declarations.map(wrapReference),
            imports: facade.imports.map(wrapReference),
            exports: facade.exports.map(wrapReference),
            emitInline: true,
            containsForwardDecls: false,
            schemas: facade.schemas ? facade.schemas.map(wrapReference) : null,
            id: facade.id ? new WrappedNodeExpr(facade.id) : null,
        };
        var res = compileNgModule(meta);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
    };
    CompilerFacadeImpl.prototype.compileDirective = function (angularCoreEnv, sourceMapUrl, facade) {
        var constantPool = new ConstantPool();
        var bindingParser = makeBindingParser();
        var meta = convertDirectiveFacadeToMetadata(facade);
        var res = compileDirectiveFromMetadata(meta, constantPool, bindingParser);
        return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
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
        var metadata = __assign(__assign(__assign({}, facade), convertDirectiveFacadeToMetadata(facade)), { selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(), template: template, wrapDirectivesAndPipesInClosure: false, styles: facade.styles || [], encapsulation: facade.encapsulation, interpolation: interpolationConfig, changeDetection: facade.changeDetection, animations: facade.animations != null ? new WrappedNodeExpr(facade.animations) : null, viewProviders: facade.viewProviders != null ? new WrappedNodeExpr(facade.viewProviders) :
                null, relativeContextFilePath: '', i18nUseExternalIds: true });
        var res = compileComponentFromMetadata(metadata, constantPool, makeBindingParser(interpolationConfig));
        var jitExpressionSourceMap = "ng:///" + facade.name + ".js";
        return this.jitExpression(res.expression, angularCoreEnv, jitExpressionSourceMap, constantPool.statements);
    };
    CompilerFacadeImpl.prototype.compileFactory = function (angularCoreEnv, sourceMapUrl, meta) {
        var factoryRes = compileFactoryFunction({
            name: meta.name,
            type: new WrappedNodeExpr(meta.type),
            internalType: new WrappedNodeExpr(meta.type),
            typeArgumentCount: meta.typeArgumentCount,
            deps: convertR3DependencyMetadataArray(meta.deps),
            injectFn: meta.injectFn === 'directiveInject' ? Identifiers.directiveInject :
                Identifiers.inject,
            target: meta.target,
        });
        return this.jitExpression(factoryRes.factory, angularCoreEnv, sourceMapUrl, factoryRes.statements);
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
        var statements = __spread(preStatements, [
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
    return __assign(__assign({}, facade), { predicate: Array.isArray(facade.predicate) ? facade.predicate :
            new WrappedNodeExpr(facade.predicate), read: facade.read ? new WrappedNodeExpr(facade.read) : null, static: facade.static });
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
    return __assign(__assign({}, facade), { typeSourceSpan: facade.typeSourceSpan, type: new WrappedNodeExpr(facade.type), internalType: new WrappedNodeExpr(facade.type), deps: convertR3DependencyMetadataArray(facade.deps), host: extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host), inputs: __assign(__assign({}, inputsFromMetadata), inputsFromType), outputs: __assign(__assign({}, outputsFromMetadata), outputsFromType), queries: facade.queries.map(convertToR3QueryMetadata), providers: facade.providers != null ? new WrappedNodeExpr(facade.providers) : null, viewQueries: facade.viewQueries.map(convertToR3QueryMetadata), fullInheritance: false });
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
function extractHostBindings(propMetadata, sourceSpan, host) {
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
        var _a = __read(value.split(',').map(function (piece) { return piece.trim(); }), 2), field = _a[0], property = _a[1];
        map[field] = property || field;
        return map;
    }, {});
}
export function publishFacade(global) {
    var ng = global.ng || (global.ng = {});
    ng.ɵcompilerFacade = new CompilerFacadeImpl();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaml0X2NvbXBpbGVyX2ZhY2FkZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9qaXRfY29tcGlsZXJfZmFjYWRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7QUFJSCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFFN0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsNEJBQTRCLEVBQUUsbUJBQW1CLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRyxPQUFPLEVBQUMsY0FBYyxFQUFjLFdBQVcsRUFBYSxZQUFZLEVBQUUsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDdEgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBOEIsbUJBQW1CLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDOUUsT0FBTyxFQUF1QixlQUFlLEVBQUUsd0JBQXdCLEVBQUUsc0JBQXNCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUM3SCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUF5QyxlQUFlLEVBQUUsZUFBZSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDdEgsT0FBTyxFQUFpQix1QkFBdUIsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBR25GLE9BQU8sRUFBcUIsNEJBQTRCLEVBQUUsNEJBQTRCLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM5SixPQUFPLEVBQUMsaUJBQWlCLEVBQUUsYUFBYSxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDekUsT0FBTyxFQUFDLGNBQWMs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QUE5RCxhQUFLLEVBQUUsZ0JBQXVELENBQUM7UUFDdEUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLFFBQVEsSUFBSSxLQUFLLENBQUM7UUFDL0IsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDLEVBQ0QsRUFBZSxDQUFDLENBQUM7QUFDdkIsQ0FBQztBQUVELE1BQU0sVUFBVSxhQUFhLENBQUMsTUFBVztJQUN2QyxJQUFNLEVBQUUsR0FBMkIsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDakUsRUFBRSxDQUFDLGVBQWUsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7QUFDaEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuXG5pbXBvcnQge0NvbXBpbGVyRmFjYWRlLCBDb3JlRW52aXJvbm1lbnQsIEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUsIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUsIFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlLCBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlLCBSM0ZhY3RvcnlEZWZNZXRhZGF0YUZhY2FkZSwgUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUsIFIzSW5qZWN0b3JNZXRhZGF0YUZhY2FkZSwgUjNOZ01vZHVsZU1ldGFkYXRhRmFjYWRlLCBSM1BpcGVNZXRhZGF0YUZhY2FkZSwgUjNRdWVyeU1ldGFkYXRhRmFjYWRlLCBTdHJpbmdNYXAsIFN0cmluZ01hcFdpdGhSZW5hbWV9IGZyb20gJy4vY29tcGlsZXJfZmFjYWRlX2ludGVyZmFjZSc7XG5pbXBvcnQge0NvbnN0YW50UG9vbH0gZnJvbSAnLi9jb25zdGFudF9wb29sJztcbmltcG9ydCB7SG9zdEJpbmRpbmcsIEhvc3RMaXN0ZW5lciwgSW5wdXQsIE91dHB1dCwgVHlwZX0gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtjb21waWxlSW5qZWN0YWJsZX0gZnJvbSAnLi9pbmplY3RhYmxlX2NvbXBpbGVyXzInO1xuaW1wb3J0IHtERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHLCBJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQge0RlY2xhcmVWYXJTdG10LCBFeHByZXNzaW9uLCBMaXRlcmFsRXhwciwgU3RhdGVtZW50LCBTdG10TW9kaWZpZXIsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge0ppdEV2YWx1YXRvcn0gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2ppdCc7XG5pbXBvcnQge1BhcnNlRXJyb3IsIFBhcnNlU291cmNlU3BhbiwgcjNKaXRUeXBlU291cmNlU3Bhbn0gZnJvbSAnLi9wYXJzZV91dGlsJztcbmltcG9ydCB7UjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeVRhcmdldCwgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLCBjb21waWxlRmFjdG9yeUZ1bmN0aW9ufSBmcm9tICcuL3JlbmRlcjMvcjNfZmFjdG9yeSc7XG5pbXBvcnQge1IzSml0UmVmbGVjdG9yfSBmcm9tICcuL3JlbmRlcjMvcjNfaml0JztcbmltcG9ydCB7UjNJbmplY3Rvck1ldGFkYXRhLCBSM05nTW9kdWxlTWV0YWRhdGEsIGNvbXBpbGVJbmplY3RvciwgY29tcGlsZU5nTW9kdWxlfSBmcm9tICcuL3JlbmRlcjMvcjNfbW9kdWxlX2NvbXBpbGVyJztcbmltcG9ydCB7UjNQaXBlTWV0YWRhdGEsIGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhfSBmcm9tICcuL3JlbmRlcjMvcjNfcGlwZV9jb21waWxlcic7XG5pbXBvcnQge1IzUmVmZXJlbmNlfSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5pbXBvcnQge1IzRGlyZWN0aXZlTWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9yZW5kZXIzL3ZpZXcvYXBpJztcbmltcG9ydCB7UGFyc2VkSG9zdEJpbmRpbmdzLCBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhLCBjb21waWxlRGlyZWN0aXZlRnJvbU1ldGFkYXRhLCBwYXJzZUhvc3RCaW5kaW5ncywgdmVyaWZ5SG9zdEJpbmRpbmdzfSBmcm9tICcuL3JlbmRlcjMvdmlldy9jb21waWxlcic7XG5pbXBvcnQge21ha2VCaW5kaW5nUGFyc2VyLCBwYXJzZVRlbXBsYXRlfSBmcm9tICcuL3JlbmRlcjMvdmlldy90ZW1wbGF0ZSc7XG5pbXBvcnQge1Jlc291cmNlTG9hZGVyfSBmcm9tICcuL3Jlc291cmNlX2xvYWRlcic7XG5pbXBvcnQge0RvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeX0gZnJvbSAnLi9zY2hlbWEvZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcblxuZXhwb3J0IGNsYXNzIENvbXBpbGVyRmFjYWRlSW1wbCBpbXBsZW1lbnRzIENvbXBpbGVyRmFjYWRlIHtcbiAgUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlID0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlIGFzIGFueTtcbiAgUjNGYWN0b3J5VGFyZ2V0ID0gUjNGYWN0b3J5VGFyZ2V0IGFzIGFueTtcbiAgUmVzb3VyY2VMb2FkZXIgPSBSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBlbGVtZW50U2NoZW1hUmVnaXN0cnkgPSBuZXcgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBqaXRFdmFsdWF0b3IgPSBuZXcgSml0RXZhbHVhdG9yKCkpIHt9XG5cbiAgY29tcGlsZVBpcGUoYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsIGZhY2FkZTogUjNQaXBlTWV0YWRhdGFGYWNhZGUpOlxuICAgICAgYW55IHtcbiAgICBjb25zdCBtZXRhZGF0YTogUjNQaXBlTWV0YWRhdGEgPSB7XG4gICAgICBuYW1lOiBmYWNhZGUubmFtZSxcbiAgICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgaW50ZXJuYWxUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBmYWNhZGUudHlwZUFyZ3VtZW50Q291bnQsXG4gICAgICBkZXBzOiBjb252ZXJ0UjNEZXBlbmRlbmN5TWV0YWRhdGFBcnJheShmYWNhZGUuZGVwcyksXG4gICAgICBwaXBlTmFtZTogZmFjYWRlLnBpcGVOYW1lLFxuICAgICAgcHVyZTogZmFjYWRlLnB1cmUsXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlUGlwZUZyb21NZXRhZGF0YShtZXRhZGF0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgW10pO1xuICB9XG5cbiAgY29tcGlsZUluamVjdGFibGUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNJbmplY3RhYmxlTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IHtleHByZXNzaW9uLCBzdGF0ZW1lbnRzfSA9IGNvbXBpbGVJbmplY3RhYmxlKHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgdHlwZUFyZ3VtZW50Q291bnQ6IGZhY2FkZS50eXBlQXJndW1lbnRDb3VudCxcbiAgICAgIHByb3ZpZGVkSW46IGNvbXB1dGVQcm92aWRlZEluKGZhY2FkZS5wcm92aWRlZEluKSxcbiAgICAgIHVzZUNsYXNzOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9DTEFTUyksXG4gICAgICB1c2VGYWN0b3J5OiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9GQUNUT1JZKSxcbiAgICAgIHVzZVZhbHVlOiB3cmFwRXhwcmVzc2lvbihmYWNhZGUsIFVTRV9WQUxVRSksXG4gICAgICB1c2VFeGlzdGluZzogd3JhcEV4cHJlc3Npb24oZmFjYWRlLCBVU0VfRVhJU1RJTkcpLFxuICAgICAgdXNlckRlcHM6IGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YUFycmF5KGZhY2FkZS51c2VyRGVwcykgfHwgdW5kZWZpbmVkLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihleHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBzdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNvbXBpbGVJbmplY3RvcihcbiAgICAgIGFuZ3VsYXJDb3JlRW52OiBDb3JlRW52aXJvbm1lbnQsIHNvdXJjZU1hcFVybDogc3RyaW5nLFxuICAgICAgZmFjYWRlOiBSM0luamVjdG9yTWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIGNvbnN0IG1ldGE6IFIzSW5qZWN0b3JNZXRhZGF0YSA9IHtcbiAgICAgIG5hbWU6IGZhY2FkZS5uYW1lLFxuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgICAgcHJvdmlkZXJzOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKGkgPT4gbmV3IFdyYXBwZWROb2RlRXhwcihpKSksXG4gICAgfTtcbiAgICBjb25zdCByZXMgPSBjb21waWxlSW5qZWN0b3IobWV0YSk7XG4gICAgcmV0dXJuIHRoaXMuaml0RXhwcmVzc2lvbihyZXMuZXhwcmVzc2lvbiwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgcmVzLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZU5nTW9kdWxlKFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzTmdNb2R1bGVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgbWV0YTogUjNOZ01vZHVsZU1ldGFkYXRhID0ge1xuICAgICAgdHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgICAgYWRqYWNlbnRUeXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS50eXBlKSxcbiAgICAgIGJvb3RzdHJhcDogZmFjYWRlLmJvb3RzdHJhcC5tYXAod3JhcFJlZmVyZW5jZSksXG4gICAgICBkZWNsYXJhdGlvbnM6IGZhY2FkZS5kZWNsYXJhdGlvbnMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgaW1wb3J0czogZmFjYWRlLmltcG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZXhwb3J0czogZmFjYWRlLmV4cG9ydHMubWFwKHdyYXBSZWZlcmVuY2UpLFxuICAgICAgZW1pdElubGluZTogdHJ1ZSxcbiAgICAgIGNvbnRhaW5zRm9yd2FyZERlY2xzOiBmYWxzZSxcbiAgICAgIHNjaGVtYXM6IGZhY2FkZS5zY2hlbWFzID8gZmFjYWRlLnNjaGVtYXMubWFwKHdyYXBSZWZlcmVuY2UpIDogbnVsbCxcbiAgICAgIGlkOiBmYWNhZGUuaWQgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5pZCkgOiBudWxsLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZU5nTW9kdWxlKG1ldGEpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24ocmVzLmV4cHJlc3Npb24sIGFuZ3VsYXJDb3JlRW52LCBzb3VyY2VNYXBVcmwsIFtdKTtcbiAgfVxuXG4gIGNvbXBpbGVEaXJlY3RpdmUoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZyxcbiAgICAgIGZhY2FkZTogUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSk6IGFueSB7XG4gICAgY29uc3QgY29uc3RhbnRQb29sID0gbmV3IENvbnN0YW50UG9vbCgpO1xuICAgIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuXG4gICAgY29uc3QgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSA9IGNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSk7XG4gICAgY29uc3QgcmVzID0gY29tcGlsZURpcmVjdGl2ZUZyb21NZXRhZGF0YShtZXRhLCBjb25zdGFudFBvb2wsIGJpbmRpbmdQYXJzZXIpO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgc291cmNlTWFwVXJsLCBjb25zdGFudFBvb2wuc3RhdGVtZW50cyk7XG4gIH1cblxuICBjb21waWxlQ29tcG9uZW50KFxuICAgICAgYW5ndWxhckNvcmVFbnY6IENvcmVFbnZpcm9ubWVudCwgc291cmNlTWFwVXJsOiBzdHJpbmcsXG4gICAgICBmYWNhZGU6IFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGUpOiBhbnkge1xuICAgIC8vIFRoZSBDb25zdGFudFBvb2wgaXMgYSByZXF1aXJlbWVudCBvZiB0aGUgSklUJ2VyLlxuICAgIGNvbnN0IGNvbnN0YW50UG9vbCA9IG5ldyBDb25zdGFudFBvb2woKTtcblxuICAgIGNvbnN0IGludGVycG9sYXRpb25Db25maWcgPSBmYWNhZGUuaW50ZXJwb2xhdGlvbiA/XG4gICAgICAgIEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KGZhY2FkZS5pbnRlcnBvbGF0aW9uKSA6XG4gICAgICAgIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUc7XG4gICAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlIGFuZCBjaGVjayBmb3IgZXJyb3JzLlxuICAgIGNvbnN0IHRlbXBsYXRlID0gcGFyc2VUZW1wbGF0ZShcbiAgICAgICAgZmFjYWRlLnRlbXBsYXRlLCBzb3VyY2VNYXBVcmwsXG4gICAgICAgIHtwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBmYWNhZGUucHJlc2VydmVXaGl0ZXNwYWNlcywgaW50ZXJwb2xhdGlvbkNvbmZpZ30pO1xuICAgIGlmICh0ZW1wbGF0ZS5lcnJvcnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgZXJyb3JzID0gdGVtcGxhdGUuZXJyb3JzLm1hcChlcnIgPT4gZXJyLnRvU3RyaW5nKCkpLmpvaW4oJywgJyk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEVycm9ycyBkdXJpbmcgSklUIGNvbXBpbGF0aW9uIG9mIHRlbXBsYXRlIGZvciAke2ZhY2FkZS5uYW1lfTogJHtlcnJvcnN9YCk7XG4gICAgfVxuXG4gICAgLy8gQ29tcGlsZSB0aGUgY29tcG9uZW50IG1ldGFkYXRhLCBpbmNsdWRpbmcgdGVtcGxhdGUsIGludG8gYW4gZXhwcmVzc2lvbi5cbiAgICAvLyBUT0RPKGFseGh1Yik6IGltcGxlbWVudCBpbnB1dHMsIG91dHB1dHMsIHF1ZXJpZXMsIGV0Yy5cbiAgICBjb25zdCBtZXRhZGF0YSA9IHtcbiAgICAgIC4uLmZhY2FkZSBhcyBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICAgIC4uLmNvbnZlcnREaXJlY3RpdmVGYWNhZGVUb01ldGFkYXRhKGZhY2FkZSksXG4gICAgICBzZWxlY3RvcjogZmFjYWRlLnNlbGVjdG9yIHx8IHRoaXMuZWxlbWVudFNjaGVtYVJlZ2lzdHJ5LmdldERlZmF1bHRDb21wb25lbnRFbGVtZW50TmFtZSgpLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICB3cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlOiBmYWxzZSxcbiAgICAgIHN0eWxlczogZmFjYWRlLnN0eWxlcyB8fCBbXSxcbiAgICAgIGVuY2Fwc3VsYXRpb246IGZhY2FkZS5lbmNhcHN1bGF0aW9uIGFzIGFueSxcbiAgICAgIGludGVycG9sYXRpb246IGludGVycG9sYXRpb25Db25maWcsXG4gICAgICBjaGFuZ2VEZXRlY3Rpb246IGZhY2FkZS5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICBhbmltYXRpb25zOiBmYWNhZGUuYW5pbWF0aW9ucyAhPSBudWxsID8gbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUuYW5pbWF0aW9ucykgOiBudWxsLFxuICAgICAgdmlld1Byb3ZpZGVyczogZmFjYWRlLnZpZXdQcm92aWRlcnMgIT0gbnVsbCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnZpZXdQcm92aWRlcnMpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgcmVsYXRpdmVDb250ZXh0RmlsZVBhdGg6ICcnLFxuICAgICAgaTE4blVzZUV4dGVybmFsSWRzOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShcbiAgICAgICAgbWV0YWRhdGEsIGNvbnN0YW50UG9vbCwgbWFrZUJpbmRpbmdQYXJzZXIoaW50ZXJwb2xhdGlvbkNvbmZpZykpO1xuICAgIGNvbnN0IGppdEV4cHJlc3Npb25Tb3VyY2VNYXAgPSBgbmc6Ly8vJHtmYWNhZGUubmFtZX0uanNgO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIHJlcy5leHByZXNzaW9uLCBhbmd1bGFyQ29yZUVudiwgaml0RXhwcmVzc2lvblNvdXJjZU1hcCwgY29uc3RhbnRQb29sLnN0YXRlbWVudHMpO1xuICB9XG5cbiAgY29tcGlsZUZhY3RvcnkoXG4gICAgICBhbmd1bGFyQ29yZUVudjogQ29yZUVudmlyb25tZW50LCBzb3VyY2VNYXBVcmw6IHN0cmluZywgbWV0YTogUjNGYWN0b3J5RGVmTWV0YWRhdGFGYWNhZGUpIHtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICBuYW1lOiBtZXRhLm5hbWUsXG4gICAgICB0eXBlOiBuZXcgV3JhcHBlZE5vZGVFeHByKG1ldGEudHlwZSksXG4gICAgICBpbnRlcm5hbFR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIobWV0YS50eXBlKSxcbiAgICAgIHR5cGVBcmd1bWVudENvdW50OiBtZXRhLnR5cGVBcmd1bWVudENvdW50LFxuICAgICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkobWV0YS5kZXBzKSxcbiAgICAgIGluamVjdEZuOiBtZXRhLmluamVjdEZuID09PSAnZGlyZWN0aXZlSW5qZWN0JyA/IElkZW50aWZpZXJzLmRpcmVjdGl2ZUluamVjdCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgICB0YXJnZXQ6IG1ldGEudGFyZ2V0LFxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmppdEV4cHJlc3Npb24oXG4gICAgICAgIGZhY3RvcnlSZXMuZmFjdG9yeSwgYW5ndWxhckNvcmVFbnYsIHNvdXJjZU1hcFVybCwgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzKTtcbiAgfVxuXG4gIGNyZWF0ZVBhcnNlU291cmNlU3BhbihraW5kOiBzdHJpbmcsIHR5cGVOYW1lOiBzdHJpbmcsIHNvdXJjZVVybDogc3RyaW5nKTogUGFyc2VTb3VyY2VTcGFuIHtcbiAgICByZXR1cm4gcjNKaXRUeXBlU291cmNlU3BhbihraW5kLCB0eXBlTmFtZSwgc291cmNlVXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBKSVQgY29tcGlsZXMgYW4gZXhwcmVzc2lvbiBhbmQgcmV0dXJucyB0aGUgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGF0IGV4cHJlc3Npb24uXG4gICAqXG4gICAqIEBwYXJhbSBkZWYgdGhlIGRlZmluaXRpb24gd2hpY2ggd2lsbCBiZSBjb21waWxlZCBhbmQgZXhlY3V0ZWQgdG8gZ2V0IHRoZSB2YWx1ZSB0byBwYXRjaFxuICAgKiBAcGFyYW0gY29udGV4dCBhbiBvYmplY3QgbWFwIG9mIEBhbmd1bGFyL2NvcmUgc3ltYm9sIG5hbWVzIHRvIHN5bWJvbHMgd2hpY2ggd2lsbCBiZSBhdmFpbGFibGVcbiAgICogaW4gdGhlIGNvbnRleHQgb2YgdGhlIGNvbXBpbGVkIGV4cHJlc3Npb25cbiAgICogQHBhcmFtIHNvdXJjZVVybCBhIFVSTCB0byB1c2UgZm9yIHRoZSBzb3VyY2UgbWFwIG9mIHRoZSBjb21waWxlZCBleHByZXNzaW9uXG4gICAqIEBwYXJhbSBwcmVTdGF0ZW1lbnRzIGEgY29sbGVjdGlvbiBvZiBzdGF0ZW1lbnRzIHRoYXQgc2hvdWxkIGJlIGV2YWx1YXRlZCBiZWZvcmUgdGhlIGV4cHJlc3Npb24uXG4gICAqL1xuICBwcml2YXRlIGppdEV4cHJlc3Npb24oXG4gICAgICBkZWY6IEV4cHJlc3Npb24sIGNvbnRleHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9LCBzb3VyY2VVcmw6IHN0cmluZyxcbiAgICAgIHByZVN0YXRlbWVudHM6IFN0YXRlbWVudFtdKTogYW55IHtcbiAgICAvLyBUaGUgQ29uc3RhbnRQb29sIG1heSBjb250YWluIFN0YXRlbWVudHMgd2hpY2ggZGVjbGFyZSB2YXJpYWJsZXMgdXNlZCBpbiB0aGUgZmluYWwgZXhwcmVzc2lvbi5cbiAgICAvLyBUaGVyZWZvcmUsIGl0cyBzdGF0ZW1lbnRzIG5lZWQgdG8gcHJlY2VkZSB0aGUgYWN0dWFsIEpJVCBvcGVyYXRpb24uIFRoZSBmaW5hbCBzdGF0ZW1lbnQgaXMgYVxuICAgIC8vIGRlY2xhcmF0aW9uIG9mICRkZWYgd2hpY2ggaXMgc2V0IHRvIHRoZSBleHByZXNzaW9uIGJlaW5nIGNvbXBpbGVkLlxuICAgIGNvbnN0IHN0YXRlbWVudHM6IFN0YXRlbWVudFtdID0gW1xuICAgICAgLi4ucHJlU3RhdGVtZW50cyxcbiAgICAgIG5ldyBEZWNsYXJlVmFyU3RtdCgnJGRlZicsIGRlZiwgdW5kZWZpbmVkLCBbU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlcyA9IHRoaXMuaml0RXZhbHVhdG9yLmV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgICAgc291cmNlVXJsLCBzdGF0ZW1lbnRzLCBuZXcgUjNKaXRSZWZsZWN0b3IoY29udGV4dCksIC8qIGVuYWJsZVNvdXJjZU1hcHMgKi8gdHJ1ZSk7XG4gICAgcmV0dXJuIHJlc1snJGRlZiddO1xuICB9XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzQ29tcG9uZW50TWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID0gUGljazxcbiAgICBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLFxuICAgIEV4Y2x1ZGU8RXhjbHVkZTxrZXlvZiBSM0NvbXBvbmVudE1ldGFkYXRhRmFjYWRlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyc+LCAncHJvcE1ldGFkYXRhJz4+O1xuXG5jb25zdCBVU0VfQ0xBU1MgPSBPYmplY3Qua2V5cyh7dXNlQ2xhc3M6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9GQUNUT1JZID0gT2JqZWN0LmtleXMoe3VzZUZhY3Rvcnk6IG51bGx9KVswXTtcbmNvbnN0IFVTRV9WQUxVRSA9IE9iamVjdC5rZXlzKHt1c2VWYWx1ZTogbnVsbH0pWzBdO1xuY29uc3QgVVNFX0VYSVNUSU5HID0gT2JqZWN0LmtleXMoe3VzZUV4aXN0aW5nOiBudWxsfSlbMF07XG5cbmNvbnN0IHdyYXBSZWZlcmVuY2UgPSBmdW5jdGlvbih2YWx1ZTogYW55KTogUjNSZWZlcmVuY2Uge1xuICBjb25zdCB3cmFwcGVkID0gbmV3IFdyYXBwZWROb2RlRXhwcih2YWx1ZSk7XG4gIHJldHVybiB7dmFsdWU6IHdyYXBwZWQsIHR5cGU6IHdyYXBwZWR9O1xufTtcblxuZnVuY3Rpb24gY29udmVydFRvUjNRdWVyeU1ldGFkYXRhKGZhY2FkZTogUjNRdWVyeU1ldGFkYXRhRmFjYWRlKTogUjNRdWVyeU1ldGFkYXRhIHtcbiAgcmV0dXJuIHtcbiAgICAuLi5mYWNhZGUsXG4gICAgcHJlZGljYXRlOiBBcnJheS5pc0FycmF5KGZhY2FkZS5wcmVkaWNhdGUpID8gZmFjYWRlLnByZWRpY2F0ZSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUucHJlZGljYXRlKSxcbiAgICByZWFkOiBmYWNhZGUucmVhZCA/IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnJlYWQpIDogbnVsbCxcbiAgICBzdGF0aWM6IGZhY2FkZS5zdGF0aWNcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydERpcmVjdGl2ZUZhY2FkZVRvTWV0YWRhdGEoZmFjYWRlOiBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlKTogUjNEaXJlY3RpdmVNZXRhZGF0YSB7XG4gIGNvbnN0IGlucHV0c0Zyb21NZXRhZGF0YSA9IHBhcnNlSW5wdXRPdXRwdXRzKGZhY2FkZS5pbnB1dHMgfHwgW10pO1xuICBjb25zdCBvdXRwdXRzRnJvbU1ldGFkYXRhID0gcGFyc2VJbnB1dE91dHB1dHMoZmFjYWRlLm91dHB1dHMgfHwgW10pO1xuICBjb25zdCBwcm9wTWV0YWRhdGEgPSBmYWNhZGUucHJvcE1ldGFkYXRhO1xuICBjb25zdCBpbnB1dHNGcm9tVHlwZTogU3RyaW5nTWFwV2l0aFJlbmFtZSA9IHt9O1xuICBjb25zdCBvdXRwdXRzRnJvbVR5cGU6IFN0cmluZ01hcCA9IHt9O1xuICBmb3IgKGNvbnN0IGZpZWxkIGluIHByb3BNZXRhZGF0YSkge1xuICAgIGlmIChwcm9wTWV0YWRhdGEuaGFzT3duUHJvcGVydHkoZmllbGQpKSB7XG4gICAgICBwcm9wTWV0YWRhdGFbZmllbGRdLmZvckVhY2goYW5uID0+IHtcbiAgICAgICAgaWYgKGlzSW5wdXQoYW5uKSkge1xuICAgICAgICAgIGlucHV0c0Zyb21UeXBlW2ZpZWxkXSA9XG4gICAgICAgICAgICAgIGFubi5iaW5kaW5nUHJvcGVydHlOYW1lID8gW2Fubi5iaW5kaW5nUHJvcGVydHlOYW1lLCBmaWVsZF0gOiBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc091dHB1dChhbm4pKSB7XG4gICAgICAgICAgb3V0cHV0c0Zyb21UeXBlW2ZpZWxkXSA9IGFubi5iaW5kaW5nUHJvcGVydHlOYW1lIHx8IGZpZWxkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC4uLmZhY2FkZSBhcyBSM0RpcmVjdGl2ZU1ldGFkYXRhRmFjYWRlTm9Qcm9wQW5kV2hpdGVzcGFjZSxcbiAgICB0eXBlU291cmNlU3BhbjogZmFjYWRlLnR5cGVTb3VyY2VTcGFuLFxuICAgIHR5cGU6IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnR5cGUpLFxuICAgIGludGVybmFsVHlwZTogbmV3IFdyYXBwZWROb2RlRXhwcihmYWNhZGUudHlwZSksXG4gICAgZGVwczogY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlLmRlcHMpLFxuICAgIGhvc3Q6IGV4dHJhY3RIb3N0QmluZGluZ3MoZmFjYWRlLnByb3BNZXRhZGF0YSwgZmFjYWRlLnR5cGVTb3VyY2VTcGFuLCBmYWNhZGUuaG9zdCksXG4gICAgaW5wdXRzOiB7Li4uaW5wdXRzRnJvbU1ldGFkYXRhLCAuLi5pbnB1dHNGcm9tVHlwZX0sXG4gICAgb3V0cHV0czogey4uLm91dHB1dHNGcm9tTWV0YWRhdGEsIC4uLm91dHB1dHNGcm9tVHlwZX0sXG4gICAgcXVlcmllczogZmFjYWRlLnF1ZXJpZXMubWFwKGNvbnZlcnRUb1IzUXVlcnlNZXRhZGF0YSksXG4gICAgcHJvdmlkZXJzOiBmYWNhZGUucHJvdmlkZXJzICE9IG51bGwgPyBuZXcgV3JhcHBlZE5vZGVFeHByKGZhY2FkZS5wcm92aWRlcnMpIDogbnVsbCxcbiAgICB2aWV3UXVlcmllczogZmFjYWRlLnZpZXdRdWVyaWVzLm1hcChjb252ZXJ0VG9SM1F1ZXJ5TWV0YWRhdGEpLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogZmFsc2UsXG4gIH07XG59XG5cbi8vIFRoaXMgc2VlbXMgdG8gYmUgbmVlZGVkIHRvIHBsYWNhdGUgVFMgdjMuMCBvbmx5XG50eXBlIFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGVOb1Byb3BBbmRXaGl0ZXNwYWNlID1cbiAgICBQaWNrPFIzRGlyZWN0aXZlTWV0YWRhdGFGYWNhZGUsIEV4Y2x1ZGU8a2V5b2YgUjNEaXJlY3RpdmVNZXRhZGF0YUZhY2FkZSwgJ3Byb3BNZXRhZGF0YSc+PjtcblxuZnVuY3Rpb24gd3JhcEV4cHJlc3Npb24ob2JqOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBXcmFwcGVkTm9kZUV4cHI8YW55Pnx1bmRlZmluZWQge1xuICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKG9ialtwcm9wZXJ0eV0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVByb3ZpZGVkSW4ocHJvdmlkZWRJbjogVHlwZSB8IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBFeHByZXNzaW9uIHtcbiAgaWYgKHByb3ZpZGVkSW4gPT0gbnVsbCB8fCB0eXBlb2YgcHJvdmlkZWRJbiA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gbmV3IExpdGVyYWxFeHByKHByb3ZpZGVkSW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgV3JhcHBlZE5vZGVFeHByKHByb3ZpZGVkSW4pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRSM0RlcGVuZGVuY3lNZXRhZGF0YShmYWNhZGU6IFIzRGVwZW5kZW5jeU1ldGFkYXRhRmFjYWRlKTogUjNEZXBlbmRlbmN5TWV0YWRhdGEge1xuICBsZXQgdG9rZW5FeHByO1xuICBpZiAoZmFjYWRlLnRva2VuID09PSBudWxsKSB7XG4gICAgdG9rZW5FeHByID0gbmV3IExpdGVyYWxFeHByKG51bGwpO1xuICB9IGVsc2UgaWYgKGZhY2FkZS5yZXNvbHZlZCA9PT0gUjNSZXNvbHZlZERlcGVuZGVuY3lUeXBlLkF0dHJpYnV0ZSkge1xuICAgIHRva2VuRXhwciA9IG5ldyBMaXRlcmFsRXhwcihmYWNhZGUudG9rZW4pO1xuICB9IGVsc2Uge1xuICAgIHRva2VuRXhwciA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoZmFjYWRlLnRva2VuKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRva2VuOiB0b2tlbkV4cHIsXG4gICAgcmVzb2x2ZWQ6IGZhY2FkZS5yZXNvbHZlZCxcbiAgICBob3N0OiBmYWNhZGUuaG9zdCxcbiAgICBvcHRpb25hbDogZmFjYWRlLm9wdGlvbmFsLFxuICAgIHNlbGY6IGZhY2FkZS5zZWxmLFxuICAgIHNraXBTZWxmOiBmYWNhZGUuc2tpcFNlbGZcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhQXJyYXkoZmFjYWRlczogUjNEZXBlbmRlbmN5TWV0YWRhdGFGYWNhZGVbXSB8IG51bGwgfCB1bmRlZmluZWQpOlxuICAgIFIzRGVwZW5kZW5jeU1ldGFkYXRhW118bnVsbCB7XG4gIHJldHVybiBmYWNhZGVzID09IG51bGwgPyBudWxsIDogZmFjYWRlcy5tYXAoY29udmVydFIzRGVwZW5kZW5jeU1ldGFkYXRhKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEhvc3RCaW5kaW5ncyhcbiAgICBwcm9wTWV0YWRhdGE6IHtba2V5OiBzdHJpbmddOiBhbnlbXX0sIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICBob3N0Pzoge1trZXk6IHN0cmluZ106IHN0cmluZ30pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICAvLyBGaXJzdCBwYXJzZSB0aGUgZGVjbGFyYXRpb25zIGZyb20gdGhlIG1ldGFkYXRhLlxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3QgfHwge30pO1xuXG4gIC8vIEFmdGVyIHRoYXQgY2hlY2sgaG9zdCBiaW5kaW5ncyBmb3IgZXJyb3JzXG4gIGNvbnN0IGVycm9ycyA9IHZlcmlmeUhvc3RCaW5kaW5ncyhiaW5kaW5ncywgc291cmNlU3Bhbik7XG4gIGlmIChlcnJvcnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5tYXAoKGVycm9yOiBQYXJzZUVycm9yKSA9PiBlcnJvci5tc2cpLmpvaW4oJ1xcbicpKTtcbiAgfVxuXG4gIC8vIE5leHQsIGxvb3Agb3ZlciB0aGUgcHJvcGVydGllcyBvZiB0aGUgb2JqZWN0LCBsb29raW5nIGZvciBASG9zdEJpbmRpbmcgYW5kIEBIb3N0TGlzdGVuZXIuXG4gIGZvciAoY29uc3QgZmllbGQgaW4gcHJvcE1ldGFkYXRhKSB7XG4gICAgaWYgKHByb3BNZXRhZGF0YS5oYXNPd25Qcm9wZXJ0eShmaWVsZCkpIHtcbiAgICAgIHByb3BNZXRhZGF0YVtmaWVsZF0uZm9yRWFjaChhbm4gPT4ge1xuICAgICAgICBpZiAoaXNIb3N0QmluZGluZyhhbm4pKSB7XG4gICAgICAgICAgYmluZGluZ3MucHJvcGVydGllc1thbm4uaG9zdFByb3BlcnR5TmFtZSB8fCBmaWVsZF0gPSBmaWVsZDtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvc3RMaXN0ZW5lcihhbm4pKSB7XG4gICAgICAgICAgYmluZGluZ3MubGlzdGVuZXJzW2Fubi5ldmVudE5hbWUgfHwgZmllbGRdID0gYCR7ZmllbGR9KCR7KGFubi5hcmdzIHx8IFtdKS5qb2luKCcsJyl9KWA7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBiaW5kaW5ncztcbn1cblxuZnVuY3Rpb24gaXNIb3N0QmluZGluZyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSG9zdEJpbmRpbmcge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0QmluZGluZyc7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdExpc3RlbmVyKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBIb3N0TGlzdGVuZXIge1xuICByZXR1cm4gdmFsdWUubmdNZXRhZGF0YU5hbWUgPT09ICdIb3N0TGlzdGVuZXInO1xufVxuXG5cbmZ1bmN0aW9uIGlzSW5wdXQodmFsdWU6IGFueSk6IHZhbHVlIGlzIElucHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnSW5wdXQnO1xufVxuXG5mdW5jdGlvbiBpc091dHB1dCh2YWx1ZTogYW55KTogdmFsdWUgaXMgT3V0cHV0IHtcbiAgcmV0dXJuIHZhbHVlLm5nTWV0YWRhdGFOYW1lID09PSAnT3V0cHV0Jztcbn1cblxuZnVuY3Rpb24gcGFyc2VJbnB1dE91dHB1dHModmFsdWVzOiBzdHJpbmdbXSk6IFN0cmluZ01hcCB7XG4gIHJldHVybiB2YWx1ZXMucmVkdWNlKFxuICAgICAgKG1hcCwgdmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgW2ZpZWxkLCBwcm9wZXJ0eV0gPSB2YWx1ZS5zcGxpdCgnLCcpLm1hcChwaWVjZSA9PiBwaWVjZS50cmltKCkpO1xuICAgICAgICBtYXBbZmllbGRdID0gcHJvcGVydHkgfHwgZmllbGQ7XG4gICAgICAgIHJldHVybiBtYXA7XG4gICAgICB9LFxuICAgICAge30gYXMgU3RyaW5nTWFwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHB1Ymxpc2hGYWNhZGUoZ2xvYmFsOiBhbnkpIHtcbiAgY29uc3Qgbmc6IEV4cG9ydGVkQ29tcGlsZXJGYWNhZGUgPSBnbG9iYWwubmcgfHwgKGdsb2JhbC5uZyA9IHt9KTtcbiAgbmcuybVjb21waWxlckZhY2FkZSA9IG5ldyBDb21waWxlckZhY2FkZUltcGwoKTtcbn1cbiJdfQ==