/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { StaticSymbol } from './aot/static_symbol';
import { splitAtColon, stringify } from './util';
// group 0: "[prop] or (event) or @trigger"
// group 1: "prop" from "[prop]"
// group 2: "event" from "(event)"
// group 3: "@trigger" from "@trigger"
var HOST_REG_EXP = /^(?:(?:\[([^\]]+)\])|(?:\(([^\)]+)\)))|(\@[-\w]+)$/;
export function sanitizeIdentifier(name) {
    return name.replace(/\W/g, '_');
}
var _anonymousTypeIndex = 0;
export function identifierName(compileIdentifier) {
    if (!compileIdentifier || !compileIdentifier.reference) {
        return null;
    }
    var ref = compileIdentifier.reference;
    if (ref instanceof StaticSymbol) {
        return ref.name;
    }
    if (ref['__anonymousType']) {
        return ref['__anonymousType'];
    }
    var identifier = stringify(ref);
    if (identifier.indexOf('(') >= 0) {
        // case: anonymous functions!
        identifier = "anonymous_" + _anonymousTypeIndex++;
        ref['__anonymousType'] = identifier;
    }
    else {
        identifier = sanitizeIdentifier(identifier);
    }
    return identifier;
}
export function identifierModuleUrl(compileIdentifier) {
    var ref = compileIdentifier.reference;
    if (ref instanceof StaticSymbol) {
        return ref.filePath;
    }
    // Runtime type
    return "./" + stringify(ref);
}
export function viewClassName(compType, embeddedTemplateIndex) {
    return "View_" + identifierName({ reference: compType }) + "_" + embeddedTemplateIndex;
}
export function rendererTypeName(compType) {
    return "RenderType_" + identifierName({ reference: compType });
}
export function hostViewClassName(compType) {
    return "HostView_" + identifierName({ reference: compType });
}
export function componentFactoryName(compType) {
    return identifierName({ reference: compType }) + "NgFactory";
}
export var CompileSummaryKind;
(function (CompileSummaryKind) {
    CompileSummaryKind[CompileSummaryKind["Pipe"] = 0] = "Pipe";
    CompileSummaryKind[CompileSummaryKind["Directive"] = 1] = "Directive";
    CompileSummaryKind[CompileSummaryKind["NgModule"] = 2] = "NgModule";
    CompileSummaryKind[CompileSummaryKind["Injectable"] = 3] = "Injectable";
})(CompileSummaryKind || (CompileSummaryKind = {}));
export function tokenName(token) {
    return token.value != null ? sanitizeIdentifier(token.value) : identifierName(token.identifier);
}
export function tokenReference(token) {
    if (token.identifier != null) {
        return token.identifier.reference;
    }
    else {
        return token.value;
    }
}
/**
 * Metadata about a stylesheet
 */
var CompileStylesheetMetadata = /** @class */ (function () {
    function CompileStylesheetMetadata(_a) {
        var _b = _a === void 0 ? {} : _a, moduleUrl = _b.moduleUrl, styles = _b.styles, styleUrls = _b.styleUrls;
        this.moduleUrl = moduleUrl || null;
        this.styles = _normalizeArray(styles);
        this.styleUrls = _normalizeArray(styleUrls);
    }
    return CompileStylesheetMetadata;
}());
export { CompileStylesheetMetadata };
/**
 * Metadata regarding compilation of a template.
 */
var CompileTemplateMetadata = /** @class */ (function () {
    function CompileTemplateMetadata(_a) {
        var encapsulation = _a.encapsulation, template = _a.template, templateUrl = _a.templateUrl, htmlAst = _a.htmlAst, styles = _a.styles, styleUrls = _a.styleUrls, externalStylesheets = _a.externalStylesheets, animations = _a.animations, ngContentSelectors = _a.ngContentSelectors, interpolation = _a.interpolation, isInline = _a.isInline, preserveWhitespaces = _a.preserveWhitespaces;
        this.encapsulation = encapsulation;
        this.template = template;
        this.templateUrl = templateUrl;
        this.htmlAst = htmlAst;
        this.styles = _normalizeArray(styles);
        this.styleUrls = _normalizeArray(styleUrls);
        this.externalStylesheets = _normalizeArray(externalStylesheets);
        this.animations = animations ? flatten(animations) : [];
        this.ngContentSelectors = ngContentSelectors || [];
        if (interpolation && interpolation.length != 2) {
            throw new Error("'interpolation' should have a start and an end symbol.");
        }
        this.interpolation = interpolation;
        this.isInline = isInline;
        this.preserveWhitespaces = preserveWhitespaces;
    }
    CompileTemplateMetadata.prototype.toSummary = function () {
        return {
            ngContentSelectors: this.ngContentSelectors,
            encapsulation: this.encapsulation,
            styles: this.styles
        };
    };
    return CompileTemplateMetadata;
}());
export { CompileTemplateMetadata };
/**
 * Metadata regarding compilation of a directive.
 */
var CompileDirectiveMetadata = /** @class */ (function () {
    function CompileDirectiveMetadata(_a) {
        var isHost = _a.isHost, type = _a.type, isComponent = _a.isComponent, selector = _a.selector, exportAs = _a.exportAs, changeDetection = _a.changeDetection, inputs = _a.inputs, outputs = _a.outputs, hostListeners = _a.hostListeners, hostProperties = _a.hostProperties, hostAttributes = _a.hostAttributes, providers = _a.providers, viewProviders = _a.viewProviders, queries = _a.queries, guards = _a.guards, viewQueries = _a.viewQueries, entryComponents = _a.entryComponents, template = _a.template, componentViewType = _a.componentViewType, rendererType = _a.rendererType, componentFactory = _a.componentFactory;
        this.isHost = !!isHost;
        this.type = type;
        this.isComponent = isComponent;
        this.selector = selector;
        this.exportAs = exportAs;
        this.changeDetection = changeDetection;
        this.inputs = inputs;
        this.outputs = outputs;
        this.hostListeners = hostListeners;
        this.hostProperties = hostProperties;
        this.hostAttributes = hostAttributes;
        this.providers = _normalizeArray(providers);
        this.viewProviders = _normalizeArray(viewProviders);
        this.queries = _normalizeArray(queries);
        this.guards = guards;
        this.viewQueries = _normalizeArray(viewQueries);
        this.entryComponents = _normalizeArray(entryComponents);
        this.template = template;
        this.componentViewType = componentViewType;
        this.rendererType = rendererType;
        this.componentFactory = componentFactory;
    }
    CompileDirectiveMetadata.create = function (_a) {
        var isHost = _a.isHost, type = _a.type, isComponent = _a.isComponent, selector = _a.selector, exportAs = _a.exportAs, changeDetection = _a.changeDetection, inputs = _a.inputs, outputs = _a.outputs, host = _a.host, providers = _a.providers, viewProviders = _a.viewProviders, queries = _a.queries, guards = _a.guards, viewQueries = _a.viewQueries, entryComponents = _a.entryComponents, template = _a.template, componentViewType = _a.componentViewType, rendererType = _a.rendererType, componentFactory = _a.componentFactory;
        var hostListeners = {};
        var hostProperties = {};
        var hostAttributes = {};
        if (host != null) {
            Object.keys(host).forEach(function (key) {
                var value = host[key];
                var matches = key.match(HOST_REG_EXP);
                if (matches === null) {
                    hostAttributes[key] = value;
                }
                else if (matches[1] != null) {
                    hostProperties[matches[1]] = value;
                }
                else if (matches[2] != null) {
                    hostListeners[matches[2]] = value;
                }
            });
        }
        var inputsMap = {};
        if (inputs != null) {
            inputs.forEach(function (bindConfig) {
                // canonical syntax: `dirProp: elProp`
                // if there is no `:`, use dirProp = elProp
                var parts = splitAtColon(bindConfig, [bindConfig, bindConfig]);
                inputsMap[parts[0]] = parts[1];
            });
        }
        var outputsMap = {};
        if (outputs != null) {
            outputs.forEach(function (bindConfig) {
                // canonical syntax: `dirProp: elProp`
                // if there is no `:`, use dirProp = elProp
                var parts = splitAtColon(bindConfig, [bindConfig, bindConfig]);
                outputsMap[parts[0]] = parts[1];
            });
        }
        return new CompileDirectiveMetadata({
            isHost: isHost,
            type: type,
            isComponent: !!isComponent, selector: selector, exportAs: exportAs, changeDetection: changeDetection,
            inputs: inputsMap,
            outputs: outputsMap,
            hostListeners: hostListeners,
            hostProperties: hostProperties,
            hostAttributes: hostAttributes,
            providers: providers,
            viewProviders: viewProviders,
            queries: queries,
            guards: guards,
            viewQueries: viewQueries,
            entryComponents: entryComponents,
            template: template,
            componentViewType: componentViewType,
            rendererType: rendererType,
            componentFactory: componentFactory,
        });
    };
    CompileDirectiveMetadata.prototype.toSummary = function () {
        return {
            summaryKind: CompileSummaryKind.Directive,
            type: this.type,
            isComponent: this.isComponent,
            selector: this.selector,
            exportAs: this.exportAs,
            inputs: this.inputs,
            outputs: this.outputs,
            hostListeners: this.hostListeners,
            hostProperties: this.hostProperties,
            hostAttributes: this.hostAttributes,
            providers: this.providers,
            viewProviders: this.viewProviders,
            queries: this.queries,
            guards: this.guards,
            viewQueries: this.viewQueries,
            entryComponents: this.entryComponents,
            changeDetection: this.changeDetection,
            template: this.template && this.template.toSummary(),
            componentViewType: this.componentViewType,
            rendererType: this.rendererType,
            componentFactory: this.componentFactory
        };
    };
    return CompileDirectiveMetadata;
}());
export { CompileDirectiveMetadata };
var CompilePipeMetadata = /** @class */ (function () {
    function CompilePipeMetadata(_a) {
        var type = _a.type, name = _a.name, pure = _a.pure;
        this.type = type;
        this.name = name;
        this.pure = !!pure;
    }
    CompilePipeMetadata.prototype.toSummary = function () {
        return {
            summaryKind: CompileSummaryKind.Pipe,
            type: this.type,
            name: this.name,
            pure: this.pure
        };
    };
    return CompilePipeMetadata;
}());
export { CompilePipeMetadata };
var CompileShallowModuleMetadata = /** @class */ (function () {
    function CompileShallowModuleMetadata() {
    }
    return CompileShallowModuleMetadata;
}());
export { CompileShallowModuleMetadata };
/**
 * Metadata regarding compilation of a module.
 */
var CompileNgModuleMetadata = /** @class */ (function () {
    function CompileNgModuleMetadata(_a) {
        var type = _a.type, providers = _a.providers, declaredDirectives = _a.declaredDirectives, exportedDirectives = _a.exportedDirectives, declaredPipes = _a.declaredPipes, exportedPipes = _a.exportedPipes, entryComponents = _a.entryComponents, bootstrapComponents = _a.bootstrapComponents, importedModules = _a.importedModules, exportedModules = _a.exportedModules, schemas = _a.schemas, transitiveModule = _a.transitiveModule, id = _a.id;
        this.type = type || null;
        this.declaredDirectives = _normalizeArray(declaredDirectives);
        this.exportedDirectives = _normalizeArray(exportedDirectives);
        this.declaredPipes = _normalizeArray(declaredPipes);
        this.exportedPipes = _normalizeArray(exportedPipes);
        this.providers = _normalizeArray(providers);
        this.entryComponents = _normalizeArray(entryComponents);
        this.bootstrapComponents = _normalizeArray(bootstrapComponents);
        this.importedModules = _normalizeArray(importedModules);
        this.exportedModules = _normalizeArray(exportedModules);
        this.schemas = _normalizeArray(schemas);
        this.id = id || null;
        this.transitiveModule = transitiveModule || null;
    }
    CompileNgModuleMetadata.prototype.toSummary = function () {
        var module = this.transitiveModule;
        return {
            summaryKind: CompileSummaryKind.NgModule,
            type: this.type,
            entryComponents: module.entryComponents,
            providers: module.providers,
            modules: module.modules,
            exportedDirectives: module.exportedDirectives,
            exportedPipes: module.exportedPipes
        };
    };
    return CompileNgModuleMetadata;
}());
export { CompileNgModuleMetadata };
var TransitiveCompileNgModuleMetadata = /** @class */ (function () {
    function TransitiveCompileNgModuleMetadata() {
        this.directivesSet = new Set();
        this.directives = [];
        this.exportedDirectivesSet = new Set();
        this.exportedDirectives = [];
        this.pipesSet = new Set();
        this.pipes = [];
        this.exportedPipesSet = new Set();
        this.exportedPipes = [];
        this.modulesSet = new Set();
        this.modules = [];
        this.entryComponentsSet = new Set();
        this.entryComponents = [];
        this.providers = [];
    }
    TransitiveCompileNgModuleMetadata.prototype.addProvider = function (provider, module) {
        this.providers.push({ provider: provider, module: module });
    };
    TransitiveCompileNgModuleMetadata.prototype.addDirective = function (id) {
        if (!this.directivesSet.has(id.reference)) {
            this.directivesSet.add(id.reference);
            this.directives.push(id);
        }
    };
    TransitiveCompileNgModuleMetadata.prototype.addExportedDirective = function (id) {
        if (!this.exportedDirectivesSet.has(id.reference)) {
            this.exportedDirectivesSet.add(id.reference);
            this.exportedDirectives.push(id);
        }
    };
    TransitiveCompileNgModuleMetadata.prototype.addPipe = function (id) {
        if (!this.pipesSet.has(id.reference)) {
            this.pipesSet.add(id.reference);
            this.pipes.push(id);
        }
    };
    TransitiveCompileNgModuleMetadata.prototype.addExportedPipe = function (id) {
        if (!this.exportedPipesSet.has(id.reference)) {
            this.exportedPipesSet.add(id.reference);
            this.exportedPipes.push(id);
        }
    };
    TransitiveCompileNgModuleMetadata.prototype.addModule = function (id) {
        if (!this.modulesSet.has(id.reference)) {
            this.modulesSet.add(id.reference);
            this.modules.push(id);
        }
    };
    TransitiveCompileNgModuleMetadata.prototype.addEntryComponent = function (ec) {
        if (!this.entryComponentsSet.has(ec.componentType)) {
            this.entryComponentsSet.add(ec.componentType);
            this.entryComponents.push(ec);
        }
    };
    return TransitiveCompileNgModuleMetadata;
}());
export { TransitiveCompileNgModuleMetadata };
function _normalizeArray(obj) {
    return obj || [];
}
var ProviderMeta = /** @class */ (function () {
    function ProviderMeta(token, _a) {
        var useClass = _a.useClass, useValue = _a.useValue, useExisting = _a.useExisting, useFactory = _a.useFactory, deps = _a.deps, multi = _a.multi;
        this.token = token;
        this.useClass = useClass || null;
        this.useValue = useValue;
        this.useExisting = useExisting;
        this.useFactory = useFactory || null;
        this.dependencies = deps || null;
        this.multi = !!multi;
    }
    return ProviderMeta;
}());
export { ProviderMeta };
export function flatten(list) {
    return list.reduce(function (flat, item) {
        var flatItem = Array.isArray(item) ? flatten(item) : item;
        return flat.concat(flatItem);
    }, []);
}
function jitSourceUrl(url) {
    // Note: We need 3 "/" so that ng shows up as a separate domain
    // in the chrome dev tools.
    return url.replace(/(\w+:\/\/[\w:-]+)?(\/+)?/, 'ng:///');
}
export function templateSourceUrl(ngModuleType, compMeta, templateMeta) {
    var url;
    if (templateMeta.isInline) {
        if (compMeta.type.reference instanceof StaticSymbol) {
            // Note: a .ts file might contain multiple components with inline templates,
            // so we need to give them unique urls, as these will be used for sourcemaps.
            url = compMeta.type.reference.filePath + "." + compMeta.type.reference.name + ".html";
        }
        else {
            url = identifierName(ngModuleType) + "/" + identifierName(compMeta.type) + ".html";
        }
    }
    else {
        url = templateMeta.templateUrl;
    }
    return compMeta.type.reference instanceof StaticSymbol ? url : jitSourceUrl(url);
}
export function sharedStylesheetJitUrl(meta, id) {
    var pathParts = meta.moduleUrl.split(/\/\\/g);
    var baseName = pathParts[pathParts.length - 1];
    return jitSourceUrl("css/" + id + baseName + ".ngstyle.js");
}
export function ngModuleJitUrl(moduleMeta) {
    return jitSourceUrl(identifierName(moduleMeta.type) + "/module.ngfactory.js");
}
export function templateJitUrl(ngModuleType, compMeta) {
    return jitSourceUrl(identifierName(ngModuleType) + "/" + identifierName(compMeta.type) + ".ngfactory.js");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZV9tZXRhZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9jb21waWxlX21ldGFkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUlqRCxPQUFPLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBQyxNQUFNLFFBQVEsQ0FBQztBQUUvQywyQ0FBMkM7QUFDM0MsZ0NBQWdDO0FBQ2hDLGtDQUFrQztBQUNsQyxzQ0FBc0M7QUFDdEMsSUFBTSxZQUFZLEdBQUcsb0RBQW9ELENBQUM7QUFFMUUsTUFBTSxVQUFVLGtCQUFrQixDQUFDLElBQVk7SUFDN0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQsSUFBSSxtQkFBbUIsR0FBRyxDQUFDLENBQUM7QUFFNUIsTUFBTSxVQUFVLGNBQWMsQ0FBQyxpQkFBK0Q7SUFFNUYsSUFBSSxDQUFDLGlCQUFpQixJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFO1FBQ3RELE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFDRCxJQUFNLEdBQUcsR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUM7SUFDeEMsSUFBSSxHQUFHLFlBQVksWUFBWSxFQUFFO1FBQy9CLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQztLQUNqQjtJQUNELElBQUksR0FBRyxDQUFDLGlCQUFpQixDQUFDLEVBQUU7UUFDMUIsT0FBTyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztLQUMvQjtJQUNELElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ2hD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QUM7QUFFRCxNQUFNLFVBQVUsY0FBYyxDQUFDLFVBQW1DO0lBQ2hFLE9BQU8sWUFBWSxDQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHlCQUFzQixDQUFDLENBQUM7QUFDaEYsQ0FBQztBQUVELE1BQU0sVUFBVSxjQUFjLENBQzFCLFlBQXVDLEVBQUUsUUFBa0M7SUFDN0UsT0FBTyxZQUFZLENBQ1osY0FBYyxDQUFDLFlBQVksQ0FBQyxTQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGtCQUFlLENBQUMsQ0FBQztBQUN2RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1N0YXRpY1N5bWJvbH0gZnJvbSAnLi9hb3Qvc3RhdGljX3N5bWJvbCc7XG5pbXBvcnQge0NoYW5nZURldGVjdGlvblN0cmF0ZWd5LCBTY2hlbWFNZXRhZGF0YSwgVHlwZSwgVmlld0VuY2Fwc3VsYXRpb259IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge0xpZmVjeWNsZUhvb2tzfSBmcm9tICcuL2xpZmVjeWNsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtQYXJzZVRyZWVSZXN1bHQgYXMgSHRtbFBhcnNlVHJlZVJlc3VsdH0gZnJvbSAnLi9tbF9wYXJzZXIvcGFyc2VyJztcbmltcG9ydCB7c3BsaXRBdENvbG9uLCBzdHJpbmdpZnl9IGZyb20gJy4vdXRpbCc7XG5cbi8vIGdyb3VwIDA6IFwiW3Byb3BdIG9yIChldmVudCkgb3IgQHRyaWdnZXJcIlxuLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiXG4vLyBncm91cCAyOiBcImV2ZW50XCIgZnJvbSBcIihldmVudClcIlxuLy8gZ3JvdXAgMzogXCJAdHJpZ2dlclwiIGZyb20gXCJAdHJpZ2dlclwiXG5jb25zdCBIT1NUX1JFR19FWFAgPSAvXig/Oig/OlxcWyhbXlxcXV0rKVxcXSl8KD86XFwoKFteXFwpXSspXFwpKSl8KFxcQFstXFx3XSspJC87XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZUlkZW50aWZpZXIobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hbWUucmVwbGFjZSgvXFxXL2csICdfJyk7XG59XG5cbmxldCBfYW5vbnltb3VzVHlwZUluZGV4ID0gMDtcblxuZXhwb3J0IGZ1bmN0aW9uIGlkZW50aWZpZXJOYW1lKGNvbXBpbGVJZGVudGlmaWVyOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhIHwgbnVsbCB8IHVuZGVmaW5lZCk6XG4gICAgc3RyaW5nfG51bGwge1xuICBpZiAoIWNvbXBpbGVJZGVudGlmaWVyIHx8ICFjb21waWxlSWRlbnRpZmllci5yZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCByZWYgPSBjb21waWxlSWRlbnRpZmllci5yZWZlcmVuY2U7XG4gIGlmIChyZWYgaW5zdGFuY2VvZiBTdGF0aWNTeW1ib2wpIHtcbiAgICByZXR1cm4gcmVmLm5hbWU7XG4gIH1cbiAgaWYgKHJlZlsnX19hbm9ueW1vdXNUeXBlJ10pIHtcbiAgICByZXR1cm4gcmVmWydfX2Fub255bW91c1R5cGUnXTtcbiAgfVxuICBsZXQgaWRlbnRpZmllciA9IHN0cmluZ2lmeShyZWYpO1xuICBpZiAoaWRlbnRpZmllci5pbmRleE9mKCcoJykgPj0gMCkge1xuICAgIC8vIGNhc2U6IGFub255bW91cyBmdW5jdGlvbnMhXG4gICAgaWRlbnRpZmllciA9IGBhbm9ueW1vdXNfJHtfYW5vbnltb3VzVHlwZUluZGV4Kyt9YDtcbiAgICByZWZbJ19fYW5vbnltb3VzVHlwZSddID0gaWRlbnRpZmllcjtcbiAgfSBlbHNlIHtcbiAgICBpZGVudGlmaWVyID0gc2FuaXRpemVJZGVudGlmaWVyKGlkZW50aWZpZXIpO1xuICB9XG4gIHJldHVybiBpZGVudGlmaWVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaWRlbnRpZmllck1vZHVsZVVybChjb21waWxlSWRlbnRpZmllcjogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSk6IHN0cmluZyB7XG4gIGNvbnN0IHJlZiA9IGNvbXBpbGVJZGVudGlmaWVyLnJlZmVyZW5jZTtcbiAgaWYgKHJlZiBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgIHJldHVybiByZWYuZmlsZVBhdGg7XG4gIH1cbiAgLy8gUnVudGltZSB0eXBlXG4gIHJldHVybiBgLi8ke3N0cmluZ2lmeShyZWYpfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2aWV3Q2xhc3NOYW1lKGNvbXBUeXBlOiBhbnksIGVtYmVkZGVkVGVtcGxhdGVJbmRleDogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBWaWV3XyR7aWRlbnRpZmllck5hbWUoe3JlZmVyZW5jZTogY29tcFR5cGV9KX1fJHtlbWJlZGRlZFRlbXBsYXRlSW5kZXh9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcmVyVHlwZU5hbWUoY29tcFR5cGU6IGFueSk6IHN0cmluZyB7XG4gIHJldHVybiBgUmVuZGVyVHlwZV8ke2lkZW50aWZpZXJOYW1lKHtyZWZlcmVuY2U6IGNvbXBUeXBlfSl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhvc3RWaWV3Q2xhc3NOYW1lKGNvbXBUeXBlOiBhbnkpOiBzdHJpbmcge1xuICByZXR1cm4gYEhvc3RWaWV3XyR7aWRlbnRpZmllck5hbWUoe3JlZmVyZW5jZTogY29tcFR5cGV9KX1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9uZW50RmFjdG9yeU5hbWUoY29tcFR5cGU6IGFueSk6IHN0cmluZyB7XG4gIHJldHVybiBgJHtpZGVudGlmaWVyTmFtZSh7cmVmZXJlbmNlOiBjb21wVHlwZX0pfU5nRmFjdG9yeWA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJveHlDbGFzcyB7IHNldERlbGVnYXRlKGRlbGVnYXRlOiBhbnkpOiB2b2lkOyB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSB7IHJlZmVyZW5jZTogYW55OyB9XG5cbmV4cG9ydCBlbnVtIENvbXBpbGVTdW1tYXJ5S2luZCB7XG4gIFBpcGUsXG4gIERpcmVjdGl2ZSxcbiAgTmdNb2R1bGUsXG4gIEluamVjdGFibGVcbn1cblxuLyoqXG4gKiBBIENvbXBpbGVTdW1tYXJ5IGlzIHRoZSBkYXRhIG5lZWRlZCB0byB1c2UgYSBkaXJlY3RpdmUgLyBwaXBlIC8gbW9kdWxlXG4gKiBpbiBvdGhlciBtb2R1bGVzIC8gY29tcG9uZW50cy4gSG93ZXZlciwgdGhpcyBkYXRhIGlzIG5vdCBlbm91Z2ggdG8gY29tcGlsZVxuICogdGhlIGRpcmVjdGl2ZSAvIG1vZHVsZSBpdHNlbGYuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZVR5cGVTdW1tYXJ5IHtcbiAgc3VtbWFyeUtpbmQ6IENvbXBpbGVTdW1tYXJ5S2luZHxudWxsO1xuICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YSB7XG4gIGlzQXR0cmlidXRlPzogYm9vbGVhbjtcbiAgaXNTZWxmPzogYm9vbGVhbjtcbiAgaXNIb3N0PzogYm9vbGVhbjtcbiAgaXNTa2lwU2VsZj86IGJvb2xlYW47XG4gIGlzT3B0aW9uYWw/OiBib29sZWFuO1xuICBpc1ZhbHVlPzogYm9vbGVhbjtcbiAgdG9rZW4/OiBDb21waWxlVG9rZW5NZXRhZGF0YTtcbiAgdmFsdWU/OiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEge1xuICB0b2tlbjogQ29tcGlsZVRva2VuTWV0YWRhdGE7XG4gIHVzZUNsYXNzPzogQ29tcGlsZVR5cGVNZXRhZGF0YTtcbiAgdXNlVmFsdWU/OiBhbnk7XG4gIHVzZUV4aXN0aW5nPzogQ29tcGlsZVRva2VuTWV0YWRhdGE7XG4gIHVzZUZhY3Rvcnk/OiBDb21waWxlRmFjdG9yeU1ldGFkYXRhO1xuICBkZXBzPzogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW107XG4gIG11bHRpPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlRmFjdG9yeU1ldGFkYXRhIGV4dGVuZHMgQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSB7XG4gIGRpRGVwczogQ29tcGlsZURpRGVwZW5kZW5jeU1ldGFkYXRhW107XG4gIHJlZmVyZW5jZTogYW55O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5OYW1lKHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSkge1xuICByZXR1cm4gdG9rZW4udmFsdWUgIT0gbnVsbCA/IHNhbml0aXplSWRlbnRpZmllcih0b2tlbi52YWx1ZSkgOiBpZGVudGlmaWVyTmFtZSh0b2tlbi5pZGVudGlmaWVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRva2VuUmVmZXJlbmNlKHRva2VuOiBDb21waWxlVG9rZW5NZXRhZGF0YSkge1xuICBpZiAodG9rZW4uaWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgcmV0dXJuIHRva2VuLmlkZW50aWZpZXIucmVmZXJlbmNlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0b2tlbi52YWx1ZTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVUb2tlbk1ldGFkYXRhIHtcbiAgdmFsdWU/OiBhbnk7XG4gIGlkZW50aWZpZXI/OiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhfENvbXBpbGVUeXBlTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZUluamVjdGFibGVNZXRhZGF0YSB7XG4gIHN5bWJvbDogU3RhdGljU3ltYm9sO1xuICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhO1xuXG4gIHByb3ZpZGVkSW4/OiBTdGF0aWNTeW1ib2w7XG5cbiAgdXNlVmFsdWU/OiBhbnk7XG4gIHVzZUNsYXNzPzogU3RhdGljU3ltYm9sO1xuICB1c2VFeGlzdGluZz86IFN0YXRpY1N5bWJvbDtcbiAgdXNlRmFjdG9yeT86IFN0YXRpY1N5bWJvbDtcbiAgZGVwcz86IGFueVtdO1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlZ2FyZGluZyBjb21waWxhdGlvbiBvZiBhIHR5cGUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZVR5cGVNZXRhZGF0YSBleHRlbmRzIENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGEge1xuICBkaURlcHM6IENvbXBpbGVEaURlcGVuZGVuY3lNZXRhZGF0YVtdO1xuICBsaWZlY3ljbGVIb29rczogTGlmZWN5Y2xlSG9va3NbXTtcbiAgcmVmZXJlbmNlOiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZVF1ZXJ5TWV0YWRhdGEge1xuICBzZWxlY3RvcnM6IEFycmF5PENvbXBpbGVUb2tlbk1ldGFkYXRhPjtcbiAgZGVzY2VuZGFudHM6IGJvb2xlYW47XG4gIGZpcnN0OiBib29sZWFuO1xuICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgcmVhZDogQ29tcGlsZVRva2VuTWV0YWRhdGE7XG59XG5cbi8qKlxuICogTWV0YWRhdGEgYWJvdXQgYSBzdHlsZXNoZWV0XG4gKi9cbmV4cG9ydCBjbGFzcyBDb21waWxlU3R5bGVzaGVldE1ldGFkYXRhIHtcbiAgbW9kdWxlVXJsOiBzdHJpbmd8bnVsbDtcbiAgc3R5bGVzOiBzdHJpbmdbXTtcbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcbiAgY29uc3RydWN0b3IoXG4gICAgICB7bW9kdWxlVXJsLCBzdHlsZXMsXG4gICAgICAgc3R5bGVVcmxzfToge21vZHVsZVVybD86IHN0cmluZywgc3R5bGVzPzogc3RyaW5nW10sIHN0eWxlVXJscz86IHN0cmluZ1tdfSA9IHt9KSB7XG4gICAgdGhpcy5tb2R1bGVVcmwgPSBtb2R1bGVVcmwgfHwgbnVsbDtcbiAgICB0aGlzLnN0eWxlcyA9IF9ub3JtYWxpemVBcnJheShzdHlsZXMpO1xuICAgIHRoaXMuc3R5bGVVcmxzID0gX25vcm1hbGl6ZUFycmF5KHN0eWxlVXJscyk7XG4gIH1cbn1cblxuLyoqXG4gKiBTdW1tYXJ5IE1ldGFkYXRhIHJlZ2FyZGluZyBjb21waWxhdGlvbiBvZiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVUZW1wbGF0ZVN1bW1hcnkge1xuICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHN0cmluZ1tdO1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbnxudWxsO1xuICBzdHlsZXM6IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlZ2FyZGluZyBjb21waWxhdGlvbiBvZiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgY2xhc3MgQ29tcGlsZVRlbXBsYXRlTWV0YWRhdGEge1xuICBlbmNhcHN1bGF0aW9uOiBWaWV3RW5jYXBzdWxhdGlvbnxudWxsO1xuICB0ZW1wbGF0ZTogc3RyaW5nfG51bGw7XG4gIHRlbXBsYXRlVXJsOiBzdHJpbmd8bnVsbDtcbiAgaHRtbEFzdDogSHRtbFBhcnNlVHJlZVJlc3VsdHxudWxsO1xuICBpc0lubGluZTogYm9vbGVhbjtcbiAgc3R5bGVzOiBzdHJpbmdbXTtcbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcbiAgZXh0ZXJuYWxTdHlsZXNoZWV0czogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YVtdO1xuICBhbmltYXRpb25zOiBhbnlbXTtcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXTtcbiAgaW50ZXJwb2xhdGlvbjogW3N0cmluZywgc3RyaW5nXXxudWxsO1xuICBwcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuO1xuICBjb25zdHJ1Y3Rvcih7ZW5jYXBzdWxhdGlvbiwgdGVtcGxhdGUsIHRlbXBsYXRlVXJsLCBodG1sQXN0LCBzdHlsZXMsIHN0eWxlVXJscyxcbiAgICAgICAgICAgICAgIGV4dGVybmFsU3R5bGVzaGVldHMsIGFuaW1hdGlvbnMsIG5nQ29udGVudFNlbGVjdG9ycywgaW50ZXJwb2xhdGlvbiwgaXNJbmxpbmUsXG4gICAgICAgICAgICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzfToge1xuICAgIGVuY2Fwc3VsYXRpb246IFZpZXdFbmNhcHN1bGF0aW9uIHwgbnVsbCxcbiAgICB0ZW1wbGF0ZTogc3RyaW5nfG51bGwsXG4gICAgdGVtcGxhdGVVcmw6IHN0cmluZ3xudWxsLFxuICAgIGh0bWxBc3Q6IEh0bWxQYXJzZVRyZWVSZXN1bHR8bnVsbCxcbiAgICBzdHlsZXM6IHN0cmluZ1tdLFxuICAgIHN0eWxlVXJsczogc3RyaW5nW10sXG4gICAgZXh0ZXJuYWxTdHlsZXNoZWV0czogQ29tcGlsZVN0eWxlc2hlZXRNZXRhZGF0YVtdLFxuICAgIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW10sXG4gICAgYW5pbWF0aW9uczogYW55W10sXG4gICAgaW50ZXJwb2xhdGlvbjogW3N0cmluZywgc3RyaW5nXXxudWxsLFxuICAgIGlzSW5saW5lOiBib29sZWFuLFxuICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW5cbiAgfSkge1xuICAgIHRoaXMuZW5jYXBzdWxhdGlvbiA9IGVuY2Fwc3VsYXRpb247XG4gICAgdGhpcy50ZW1wbGF0ZSA9IHRlbXBsYXRlO1xuICAgIHRoaXMudGVtcGxhdGVVcmwgPSB0ZW1wbGF0ZVVybDtcbiAgICB0aGlzLmh0bWxBc3QgPSBodG1sQXN0O1xuICAgIHRoaXMuc3R5bGVzID0gX25vcm1hbGl6ZUFycmF5KHN0eWxlcyk7XG4gICAgdGhpcy5zdHlsZVVybHMgPSBfbm9ybWFsaXplQXJyYXkoc3R5bGVVcmxzKTtcbiAgICB0aGlzLmV4dGVybmFsU3R5bGVzaGVldHMgPSBfbm9ybWFsaXplQXJyYXkoZXh0ZXJuYWxTdHlsZXNoZWV0cyk7XG4gICAgdGhpcy5hbmltYXRpb25zID0gYW5pbWF0aW9ucyA/IGZsYXR0ZW4oYW5pbWF0aW9ucykgOiBbXTtcbiAgICB0aGlzLm5nQ29udGVudFNlbGVjdG9ycyA9IG5nQ29udGVudFNlbGVjdG9ycyB8fCBbXTtcbiAgICBpZiAoaW50ZXJwb2xhdGlvbiAmJiBpbnRlcnBvbGF0aW9uLmxlbmd0aCAhPSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCdpbnRlcnBvbGF0aW9uJyBzaG91bGQgaGF2ZSBhIHN0YXJ0IGFuZCBhbiBlbmQgc3ltYm9sLmApO1xuICAgIH1cbiAgICB0aGlzLmludGVycG9sYXRpb24gPSBpbnRlcnBvbGF0aW9uO1xuICAgIHRoaXMuaXNJbmxpbmUgPSBpc0lubGluZTtcbiAgICB0aGlzLnByZXNlcnZlV2hpdGVzcGFjZXMgPSBwcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuICB9XG5cbiAgdG9TdW1tYXJ5KCk6IENvbXBpbGVUZW1wbGF0ZVN1bW1hcnkge1xuICAgIHJldHVybiB7XG4gICAgICBuZ0NvbnRlbnRTZWxlY3RvcnM6IHRoaXMubmdDb250ZW50U2VsZWN0b3JzLFxuICAgICAgZW5jYXBzdWxhdGlvbjogdGhpcy5lbmNhcHN1bGF0aW9uLFxuICAgICAgc3R5bGVzOiB0aGlzLnN0eWxlc1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YSB7XG4gIGNvbXBvbmVudFR5cGU6IGFueTtcbiAgY29tcG9uZW50RmFjdG9yeTogU3RhdGljU3ltYm9sfG9iamVjdDtcbn1cblxuLy8gTm90ZTogVGhpcyBzaG91bGQgb25seSB1c2UgaW50ZXJmYWNlcyBhcyBuZXN0ZWQgZGF0YSB0eXBlc1xuLy8gYXMgd2UgbmVlZCB0byBiZSBhYmxlIHRvIHNlcmlhbGl6ZSB0aGlzIGZyb20vdG8gSlNPTiFcbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGlsZURpcmVjdGl2ZVN1bW1hcnkgZXh0ZW5kcyBDb21waWxlVHlwZVN1bW1hcnkge1xuICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhO1xuICBpc0NvbXBvbmVudDogYm9vbGVhbjtcbiAgc2VsZWN0b3I6IHN0cmluZ3xudWxsO1xuICBleHBvcnRBczogc3RyaW5nfG51bGw7XG4gIGlucHV0czoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIG91dHB1dHM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBob3N0TGlzdGVuZXJzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgaG9zdFByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBob3N0QXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXTtcbiAgdmlld1Byb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXTtcbiAgcXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXTtcbiAgZ3VhcmRzOiB7W2tleTogc3RyaW5nXTogYW55fTtcbiAgdmlld1F1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW107XG4gIGVudHJ5Q29tcG9uZW50czogQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGFbXTtcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneXxudWxsO1xuICB0ZW1wbGF0ZTogQ29tcGlsZVRlbXBsYXRlU3VtbWFyeXxudWxsO1xuICBjb21wb25lbnRWaWV3VHlwZTogU3RhdGljU3ltYm9sfFByb3h5Q2xhc3N8bnVsbDtcbiAgcmVuZGVyZXJUeXBlOiBTdGF0aWNTeW1ib2x8b2JqZWN0fG51bGw7XG4gIGNvbXBvbmVudEZhY3Rvcnk6IFN0YXRpY1N5bWJvbHxvYmplY3R8bnVsbDtcbn1cblxuLyoqXG4gKiBNZXRhZGF0YSByZWdhcmRpbmcgY29tcGlsYXRpb24gb2YgYSBkaXJlY3RpdmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEge1xuICBzdGF0aWMgY3JlYXRlKHtpc0hvc3QsIHR5cGUsIGlzQ29tcG9uZW50LCBzZWxlY3RvciwgZXhwb3J0QXMsIGNoYW5nZURldGVjdGlvbiwgaW5wdXRzLCBvdXRwdXRzLFxuICAgICAgICAgICAgICAgICBob3N0LCBwcm92aWRlcnMsIHZpZXdQcm92aWRlcnMsIHF1ZXJpZXMsIGd1YXJkcywgdmlld1F1ZXJpZXMsIGVudHJ5Q29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICAgdGVtcGxhdGUsIGNvbXBvbmVudFZpZXdUeXBlLCByZW5kZXJlclR5cGUsIGNvbXBvbmVudEZhY3Rvcnl9OiB7XG4gICAgaXNIb3N0OiBib29sZWFuLFxuICAgIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGEsXG4gICAgaXNDb21wb25lbnQ6IGJvb2xlYW4sXG4gICAgc2VsZWN0b3I6IHN0cmluZ3xudWxsLFxuICAgIGV4cG9ydEFzOiBzdHJpbmd8bnVsbCxcbiAgICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5fG51bGwsXG4gICAgaW5wdXRzOiBzdHJpbmdbXSxcbiAgICBvdXRwdXRzOiBzdHJpbmdbXSxcbiAgICBob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgICBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10sXG4gICAgdmlld1Byb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSxcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLFxuICAgIGd1YXJkczoge1trZXk6IHN0cmluZ106IGFueX07XG4gICAgdmlld1F1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW10sXG4gICAgZW50cnlDb21wb25lbnRzOiBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdLFxuICAgIHRlbXBsYXRlOiBDb21waWxlVGVtcGxhdGVNZXRhZGF0YSxcbiAgICBjb21wb25lbnRWaWV3VHlwZTogU3RhdGljU3ltYm9sfFByb3h5Q2xhc3N8bnVsbCxcbiAgICByZW5kZXJlclR5cGU6IFN0YXRpY1N5bWJvbHxvYmplY3R8bnVsbCxcbiAgICBjb21wb25lbnRGYWN0b3J5OiBTdGF0aWNTeW1ib2x8b2JqZWN0fG51bGwsXG4gIH0pOiBDb21waWxlRGlyZWN0aXZlTWV0YWRhdGEge1xuICAgIGNvbnN0IGhvc3RMaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgaG9zdFByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgY29uc3QgaG9zdEF0dHJpYnV0ZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgaWYgKGhvc3QgIT0gbnVsbCkge1xuICAgICAgT2JqZWN0LmtleXMoaG9zdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGhvc3Rba2V5XTtcbiAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGtleS5tYXRjaChIT1NUX1JFR19FWFApO1xuICAgICAgICBpZiAobWF0Y2hlcyA9PT0gbnVsbCkge1xuICAgICAgICAgIGhvc3RBdHRyaWJ1dGVzW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChtYXRjaGVzWzFdICE9IG51bGwpIHtcbiAgICAgICAgICBob3N0UHJvcGVydGllc1ttYXRjaGVzWzFdXSA9IHZhbHVlO1xuICAgICAgICB9IGVsc2UgaWYgKG1hdGNoZXNbMl0gIT0gbnVsbCkge1xuICAgICAgICAgIGhvc3RMaXN0ZW5lcnNbbWF0Y2hlc1syXV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGlucHV0c01hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBpZiAoaW5wdXRzICE9IG51bGwpIHtcbiAgICAgIGlucHV0cy5mb3JFYWNoKChiaW5kQ29uZmlnOiBzdHJpbmcpID0+IHtcbiAgICAgICAgLy8gY2Fub25pY2FsIHN5bnRheDogYGRpclByb3A6IGVsUHJvcGBcbiAgICAgICAgLy8gaWYgdGhlcmUgaXMgbm8gYDpgLCB1c2UgZGlyUHJvcCA9IGVsUHJvcFxuICAgICAgICBjb25zdCBwYXJ0cyA9IHNwbGl0QXRDb2xvbihiaW5kQ29uZmlnLCBbYmluZENvbmZpZywgYmluZENvbmZpZ10pO1xuICAgICAgICBpbnB1dHNNYXBbcGFydHNbMF1dID0gcGFydHNbMV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3Qgb3V0cHV0c01hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICBpZiAob3V0cHV0cyAhPSBudWxsKSB7XG4gICAgICBvdXRwdXRzLmZvckVhY2goKGJpbmRDb25maWc6IHN0cmluZykgPT4ge1xuICAgICAgICAvLyBjYW5vbmljYWwgc3ludGF4OiBgZGlyUHJvcDogZWxQcm9wYFxuICAgICAgICAvLyBpZiB0aGVyZSBpcyBubyBgOmAsIHVzZSBkaXJQcm9wID0gZWxQcm9wXG4gICAgICAgIGNvbnN0IHBhcnRzID0gc3BsaXRBdENvbG9uKGJpbmRDb25maWcsIFtiaW5kQ29uZmlnLCBiaW5kQ29uZmlnXSk7XG4gICAgICAgIG91dHB1dHNNYXBbcGFydHNbMF1dID0gcGFydHNbMV07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IENvbXBpbGVEaXJlY3RpdmVNZXRhZGF0YSh7XG4gICAgICBpc0hvc3QsXG4gICAgICB0eXBlLFxuICAgICAgaXNDb21wb25lbnQ6ICEhaXNDb21wb25lbnQsIHNlbGVjdG9yLCBleHBvcnRBcywgY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgaW5wdXRzOiBpbnB1dHNNYXAsXG4gICAgICBvdXRwdXRzOiBvdXRwdXRzTWFwLFxuICAgICAgaG9zdExpc3RlbmVycyxcbiAgICAgIGhvc3RQcm9wZXJ0aWVzLFxuICAgICAgaG9zdEF0dHJpYnV0ZXMsXG4gICAgICBwcm92aWRlcnMsXG4gICAgICB2aWV3UHJvdmlkZXJzLFxuICAgICAgcXVlcmllcyxcbiAgICAgIGd1YXJkcyxcbiAgICAgIHZpZXdRdWVyaWVzLFxuICAgICAgZW50cnlDb21wb25lbnRzLFxuICAgICAgdGVtcGxhdGUsXG4gICAgICBjb21wb25lbnRWaWV3VHlwZSxcbiAgICAgIHJlbmRlcmVyVHlwZSxcbiAgICAgIGNvbXBvbmVudEZhY3RvcnksXG4gICAgfSk7XG4gIH1cbiAgaXNIb3N0OiBib29sZWFuO1xuICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhO1xuICBpc0NvbXBvbmVudDogYm9vbGVhbjtcbiAgc2VsZWN0b3I6IHN0cmluZ3xudWxsO1xuICBleHBvcnRBczogc3RyaW5nfG51bGw7XG4gIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3l8bnVsbDtcbiAgaW5wdXRzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgb3V0cHV0czoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIGhvc3RMaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBob3N0UHJvcGVydGllczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIGhvc3RBdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfTtcbiAgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdO1xuICB2aWV3UHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdO1xuICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdO1xuICBndWFyZHM6IHtba2V5OiBzdHJpbmddOiBhbnl9O1xuICB2aWV3UXVlcmllczogQ29tcGlsZVF1ZXJ5TWV0YWRhdGFbXTtcbiAgZW50cnlDb21wb25lbnRzOiBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdO1xuXG4gIHRlbXBsYXRlOiBDb21waWxlVGVtcGxhdGVNZXRhZGF0YXxudWxsO1xuXG4gIGNvbXBvbmVudFZpZXdUeXBlOiBTdGF0aWNTeW1ib2x8UHJveHlDbGFzc3xudWxsO1xuICByZW5kZXJlclR5cGU6IFN0YXRpY1N5bWJvbHxvYmplY3R8bnVsbDtcbiAgY29tcG9uZW50RmFjdG9yeTogU3RhdGljU3ltYm9sfG9iamVjdHxudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHtpc0hvc3QsXG4gICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgaXNDb21wb25lbnQsXG4gICAgICAgICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgICAgICAgIGV4cG9ydEFzLFxuICAgICAgICAgICAgICAgY2hhbmdlRGV0ZWN0aW9uLFxuICAgICAgICAgICAgICAgaW5wdXRzLFxuICAgICAgICAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgICAgICAgIGhvc3RMaXN0ZW5lcnMsXG4gICAgICAgICAgICAgICBob3N0UHJvcGVydGllcyxcbiAgICAgICAgICAgICAgIGhvc3RBdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgcHJvdmlkZXJzLFxuICAgICAgICAgICAgICAgdmlld1Byb3ZpZGVycyxcbiAgICAgICAgICAgICAgIHF1ZXJpZXMsXG4gICAgICAgICAgICAgICBndWFyZHMsXG4gICAgICAgICAgICAgICB2aWV3UXVlcmllcyxcbiAgICAgICAgICAgICAgIGVudHJ5Q29tcG9uZW50cyxcbiAgICAgICAgICAgICAgIHRlbXBsYXRlLFxuICAgICAgICAgICAgICAgY29tcG9uZW50Vmlld1R5cGUsXG4gICAgICAgICAgICAgICByZW5kZXJlclR5cGUsXG4gICAgICAgICAgICAgICBjb21wb25lbnRGYWN0b3J5fToge1xuICAgIGlzSG9zdDogYm9vbGVhbixcbiAgICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhLFxuICAgIGlzQ29tcG9uZW50OiBib29sZWFuLFxuICAgIHNlbGVjdG9yOiBzdHJpbmd8bnVsbCxcbiAgICBleHBvcnRBczogc3RyaW5nfG51bGwsXG4gICAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneXxudWxsLFxuICAgIGlucHV0czoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gICAgb3V0cHV0czoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gICAgaG9zdExpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ30sXG4gICAgaG9zdFByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICAgIGhvc3RBdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSxcbiAgICBwcm92aWRlcnM6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhW10sXG4gICAgdmlld1Byb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSxcbiAgICBxdWVyaWVzOiBDb21waWxlUXVlcnlNZXRhZGF0YVtdLFxuICAgIGd1YXJkczoge1trZXk6IHN0cmluZ106IGFueX0sXG4gICAgdmlld1F1ZXJpZXM6IENvbXBpbGVRdWVyeU1ldGFkYXRhW10sXG4gICAgZW50cnlDb21wb25lbnRzOiBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdLFxuICAgIHRlbXBsYXRlOiBDb21waWxlVGVtcGxhdGVNZXRhZGF0YXxudWxsLFxuICAgIGNvbXBvbmVudFZpZXdUeXBlOiBTdGF0aWNTeW1ib2x8UHJveHlDbGFzc3xudWxsLFxuICAgIHJlbmRlcmVyVHlwZTogU3RhdGljU3ltYm9sfG9iamVjdHxudWxsLFxuICAgIGNvbXBvbmVudEZhY3Rvcnk6IFN0YXRpY1N5bWJvbHxvYmplY3R8bnVsbCxcbiAgfSkge1xuICAgIHRoaXMuaXNIb3N0ID0gISFpc0hvc3Q7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLmlzQ29tcG9uZW50ID0gaXNDb21wb25lbnQ7XG4gICAgdGhpcy5zZWxlY3RvciA9IHNlbGVjdG9yO1xuICAgIHRoaXMuZXhwb3J0QXMgPSBleHBvcnRBcztcbiAgICB0aGlzLmNoYW5nZURldGVjdGlvbiA9IGNoYW5nZURldGVjdGlvbjtcbiAgICB0aGlzLmlucHV0cyA9IGlucHV0cztcbiAgICB0aGlzLm91dHB1dHMgPSBvdXRwdXRzO1xuICAgIHRoaXMuaG9zdExpc3RlbmVycyA9IGhvc3RMaXN0ZW5lcnM7XG4gICAgdGhpcy5ob3N0UHJvcGVydGllcyA9IGhvc3RQcm9wZXJ0aWVzO1xuICAgIHRoaXMuaG9zdEF0dHJpYnV0ZXMgPSBob3N0QXR0cmlidXRlcztcbiAgICB0aGlzLnByb3ZpZGVycyA9IF9ub3JtYWxpemVBcnJheShwcm92aWRlcnMpO1xuICAgIHRoaXMudmlld1Byb3ZpZGVycyA9IF9ub3JtYWxpemVBcnJheSh2aWV3UHJvdmlkZXJzKTtcbiAgICB0aGlzLnF1ZXJpZXMgPSBfbm9ybWFsaXplQXJyYXkocXVlcmllcyk7XG4gICAgdGhpcy5ndWFyZHMgPSBndWFyZHM7XG4gICAgdGhpcy52aWV3UXVlcmllcyA9IF9ub3JtYWxpemVBcnJheSh2aWV3UXVlcmllcyk7XG4gICAgdGhpcy5lbnRyeUNvbXBvbmVudHMgPSBfbm9ybWFsaXplQXJyYXkoZW50cnlDb21wb25lbnRzKTtcbiAgICB0aGlzLnRlbXBsYXRlID0gdGVtcGxhdGU7XG5cbiAgICB0aGlzLmNvbXBvbmVudFZpZXdUeXBlID0gY29tcG9uZW50Vmlld1R5cGU7XG4gICAgdGhpcy5yZW5kZXJlclR5cGUgPSByZW5kZXJlclR5cGU7XG4gICAgdGhpcy5jb21wb25lbnRGYWN0b3J5ID0gY29tcG9uZW50RmFjdG9yeTtcbiAgfVxuXG4gIHRvU3VtbWFyeSgpOiBDb21waWxlRGlyZWN0aXZlU3VtbWFyeSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1bW1hcnlLaW5kOiBDb21waWxlU3VtbWFyeUtpbmQuRGlyZWN0aXZlLFxuICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgaXNDb21wb25lbnQ6IHRoaXMuaXNDb21wb25lbnQsXG4gICAgICBzZWxlY3RvcjogdGhpcy5zZWxlY3RvcixcbiAgICAgIGV4cG9ydEFzOiB0aGlzLmV4cG9ydEFzLFxuICAgICAgaW5wdXRzOiB0aGlzLmlucHV0cyxcbiAgICAgIG91dHB1dHM6IHRoaXMub3V0cHV0cyxcbiAgICAgIGhvc3RMaXN0ZW5lcnM6IHRoaXMuaG9zdExpc3RlbmVycyxcbiAgICAgIGhvc3RQcm9wZXJ0aWVzOiB0aGlzLmhvc3RQcm9wZXJ0aWVzLFxuICAgICAgaG9zdEF0dHJpYnV0ZXM6IHRoaXMuaG9zdEF0dHJpYnV0ZXMsXG4gICAgICBwcm92aWRlcnM6IHRoaXMucHJvdmlkZXJzLFxuICAgICAgdmlld1Byb3ZpZGVyczogdGhpcy52aWV3UHJvdmlkZXJzLFxuICAgICAgcXVlcmllczogdGhpcy5xdWVyaWVzLFxuICAgICAgZ3VhcmRzOiB0aGlzLmd1YXJkcyxcbiAgICAgIHZpZXdRdWVyaWVzOiB0aGlzLnZpZXdRdWVyaWVzLFxuICAgICAgZW50cnlDb21wb25lbnRzOiB0aGlzLmVudHJ5Q29tcG9uZW50cyxcbiAgICAgIGNoYW5nZURldGVjdGlvbjogdGhpcy5jaGFuZ2VEZXRlY3Rpb24sXG4gICAgICB0ZW1wbGF0ZTogdGhpcy50ZW1wbGF0ZSAmJiB0aGlzLnRlbXBsYXRlLnRvU3VtbWFyeSgpLFxuICAgICAgY29tcG9uZW50Vmlld1R5cGU6IHRoaXMuY29tcG9uZW50Vmlld1R5cGUsXG4gICAgICByZW5kZXJlclR5cGU6IHRoaXMucmVuZGVyZXJUeXBlLFxuICAgICAgY29tcG9uZW50RmFjdG9yeTogdGhpcy5jb21wb25lbnRGYWN0b3J5XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVQaXBlU3VtbWFyeSBleHRlbmRzIENvbXBpbGVUeXBlU3VtbWFyeSB7XG4gIHR5cGU6IENvbXBpbGVUeXBlTWV0YWRhdGE7XG4gIG5hbWU6IHN0cmluZztcbiAgcHVyZTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIENvbXBpbGVQaXBlTWV0YWRhdGEge1xuICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhO1xuICBuYW1lOiBzdHJpbmc7XG4gIHB1cmU6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3Ioe3R5cGUsIG5hbWUsIHB1cmV9OiB7XG4gICAgdHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YSxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcHVyZTogYm9vbGVhbixcbiAgfSkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnB1cmUgPSAhIXB1cmU7XG4gIH1cblxuICB0b1N1bW1hcnkoKTogQ29tcGlsZVBpcGVTdW1tYXJ5IHtcbiAgICByZXR1cm4ge1xuICAgICAgc3VtbWFyeUtpbmQ6IENvbXBpbGVTdW1tYXJ5S2luZC5QaXBlLFxuICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgcHVyZTogdGhpcy5wdXJlXG4gICAgfTtcbiAgfVxufVxuXG4vLyBOb3RlOiBUaGlzIHNob3VsZCBvbmx5IHVzZSBpbnRlcmZhY2VzIGFzIG5lc3RlZCBkYXRhIHR5cGVzXG4vLyBhcyB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gc2VyaWFsaXplIHRoaXMgZnJvbS90byBKU09OIVxuZXhwb3J0IGludGVyZmFjZSBDb21waWxlTmdNb2R1bGVTdW1tYXJ5IGV4dGVuZHMgQ29tcGlsZVR5cGVTdW1tYXJ5IHtcbiAgdHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YTtcblxuICAvLyBOb3RlOiBUaGlzIGlzIHRyYW5zaXRpdmUgb3ZlciB0aGUgZXhwb3J0ZWQgbW9kdWxlcy5cbiAgZXhwb3J0ZWREaXJlY3RpdmVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW107XG4gIC8vIE5vdGU6IFRoaXMgaXMgdHJhbnNpdGl2ZSBvdmVyIHRoZSBleHBvcnRlZCBtb2R1bGVzLlxuICBleHBvcnRlZFBpcGVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW107XG5cbiAgLy8gTm90ZTogVGhpcyBpcyB0cmFuc2l0aXZlLlxuICBlbnRyeUNvbXBvbmVudHM6IENvbXBpbGVFbnRyeUNvbXBvbmVudE1ldGFkYXRhW107XG4gIC8vIE5vdGU6IFRoaXMgaXMgdHJhbnNpdGl2ZS5cbiAgcHJvdmlkZXJzOiB7cHJvdmlkZXI6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBtb2R1bGU6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGF9W107XG4gIC8vIE5vdGU6IFRoaXMgaXMgdHJhbnNpdGl2ZS5cbiAgbW9kdWxlczogQ29tcGlsZVR5cGVNZXRhZGF0YVtdO1xufVxuXG5leHBvcnQgY2xhc3MgQ29tcGlsZVNoYWxsb3dNb2R1bGVNZXRhZGF0YSB7XG4gIC8vIFRPRE8oaXNzdWUvMjQ1NzEpOiByZW1vdmUgJyEnLlxuICB0eXBlICE6IENvbXBpbGVUeXBlTWV0YWRhdGE7XG5cbiAgcmF3RXhwb3J0czogYW55O1xuICByYXdJbXBvcnRzOiBhbnk7XG4gIHJhd1Byb3ZpZGVyczogYW55O1xufVxuXG4vKipcbiAqIE1ldGFkYXRhIHJlZ2FyZGluZyBjb21waWxhdGlvbiBvZiBhIG1vZHVsZS5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBpbGVOZ01vZHVsZU1ldGFkYXRhIHtcbiAgdHlwZTogQ29tcGlsZVR5cGVNZXRhZGF0YTtcbiAgZGVjbGFyZWREaXJlY3RpdmVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW107XG4gIGV4cG9ydGVkRGlyZWN0aXZlczogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdO1xuICBkZWNsYXJlZFBpcGVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW107XG5cbiAgZXhwb3J0ZWRQaXBlczogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdO1xuICBlbnRyeUNvbXBvbmVudHM6IENvbXBpbGVFbnRyeUNvbXBvbmVudE1ldGFkYXRhW107XG4gIGJvb3RzdHJhcENvbXBvbmVudHM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXTtcbiAgcHJvdmlkZXJzOiBDb21waWxlUHJvdmlkZXJNZXRhZGF0YVtdO1xuXG4gIGltcG9ydGVkTW9kdWxlczogQ29tcGlsZU5nTW9kdWxlU3VtbWFyeVtdO1xuICBleHBvcnRlZE1vZHVsZXM6IENvbXBpbGVOZ01vZHVsZVN1bW1hcnlbXTtcbiAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXTtcbiAgaWQ6IHN0cmluZ3xudWxsO1xuXG4gIHRyYW5zaXRpdmVNb2R1bGU6IFRyYW5zaXRpdmVDb21waWxlTmdNb2R1bGVNZXRhZGF0YTtcblxuICBjb25zdHJ1Y3Rvcih7dHlwZSwgcHJvdmlkZXJzLCBkZWNsYXJlZERpcmVjdGl2ZXMsIGV4cG9ydGVkRGlyZWN0aXZlcywgZGVjbGFyZWRQaXBlcyxcbiAgICAgICAgICAgICAgIGV4cG9ydGVkUGlwZXMsIGVudHJ5Q29tcG9uZW50cywgYm9vdHN0cmFwQ29tcG9uZW50cywgaW1wb3J0ZWRNb2R1bGVzLFxuICAgICAgICAgICAgICAgZXhwb3J0ZWRNb2R1bGVzLCBzY2hlbWFzLCB0cmFuc2l0aXZlTW9kdWxlLCBpZH06IHtcbiAgICB0eXBlOiBDb21waWxlVHlwZU1ldGFkYXRhLFxuICAgIHByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSxcbiAgICBkZWNsYXJlZERpcmVjdGl2ZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSxcbiAgICBleHBvcnRlZERpcmVjdGl2ZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSxcbiAgICBkZWNsYXJlZFBpcGVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10sXG4gICAgZXhwb3J0ZWRQaXBlczogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YVtdLFxuICAgIGVudHJ5Q29tcG9uZW50czogQ29tcGlsZUVudHJ5Q29tcG9uZW50TWV0YWRhdGFbXSxcbiAgICBib290c3RyYXBDb21wb25lbnRzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10sXG4gICAgaW1wb3J0ZWRNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVTdW1tYXJ5W10sXG4gICAgZXhwb3J0ZWRNb2R1bGVzOiBDb21waWxlTmdNb2R1bGVTdW1tYXJ5W10sXG4gICAgdHJhbnNpdGl2ZU1vZHVsZTogVHJhbnNpdGl2ZUNvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLFxuICAgIHNjaGVtYXM6IFNjaGVtYU1ldGFkYXRhW10sXG4gICAgaWQ6IHN0cmluZ3xudWxsXG4gIH0pIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlIHx8IG51bGw7XG4gICAgdGhpcy5kZWNsYXJlZERpcmVjdGl2ZXMgPSBfbm9ybWFsaXplQXJyYXkoZGVjbGFyZWREaXJlY3RpdmVzKTtcbiAgICB0aGlzLmV4cG9ydGVkRGlyZWN0aXZlcyA9IF9ub3JtYWxpemVBcnJheShleHBvcnRlZERpcmVjdGl2ZXMpO1xuICAgIHRoaXMuZGVjbGFyZWRQaXBlcyA9IF9ub3JtYWxpemVBcnJheShkZWNsYXJlZFBpcGVzKTtcbiAgICB0aGlzLmV4cG9ydGVkUGlwZXMgPSBfbm9ybWFsaXplQXJyYXkoZXhwb3J0ZWRQaXBlcyk7XG4gICAgdGhpcy5wcm92aWRlcnMgPSBfbm9ybWFsaXplQXJyYXkocHJvdmlkZXJzKTtcbiAgICB0aGlzLmVudHJ5Q29tcG9uZW50cyA9IF9ub3JtYWxpemVBcnJheShlbnRyeUNvbXBvbmVudHMpO1xuICAgIHRoaXMuYm9vdHN0cmFwQ29tcG9uZW50cyA9IF9ub3JtYWxpemVBcnJheShib290c3RyYXBDb21wb25lbnRzKTtcbiAgICB0aGlzLmltcG9ydGVkTW9kdWxlcyA9IF9ub3JtYWxpemVBcnJheShpbXBvcnRlZE1vZHVsZXMpO1xuICAgIHRoaXMuZXhwb3J0ZWRNb2R1bGVzID0gX25vcm1hbGl6ZUFycmF5KGV4cG9ydGVkTW9kdWxlcyk7XG4gICAgdGhpcy5zY2hlbWFzID0gX25vcm1hbGl6ZUFycmF5KHNjaGVtYXMpO1xuICAgIHRoaXMuaWQgPSBpZCB8fCBudWxsO1xuICAgIHRoaXMudHJhbnNpdGl2ZU1vZHVsZSA9IHRyYW5zaXRpdmVNb2R1bGUgfHwgbnVsbDtcbiAgfVxuXG4gIHRvU3VtbWFyeSgpOiBDb21waWxlTmdNb2R1bGVTdW1tYXJ5IHtcbiAgICBjb25zdCBtb2R1bGUgPSB0aGlzLnRyYW5zaXRpdmVNb2R1bGUgITtcbiAgICByZXR1cm4ge1xuICAgICAgc3VtbWFyeUtpbmQ6IENvbXBpbGVTdW1tYXJ5S2luZC5OZ01vZHVsZSxcbiAgICAgIHR5cGU6IHRoaXMudHlwZSxcbiAgICAgIGVudHJ5Q29tcG9uZW50czogbW9kdWxlLmVudHJ5Q29tcG9uZW50cyxcbiAgICAgIHByb3ZpZGVyczogbW9kdWxlLnByb3ZpZGVycyxcbiAgICAgIG1vZHVsZXM6IG1vZHVsZS5tb2R1bGVzLFxuICAgICAgZXhwb3J0ZWREaXJlY3RpdmVzOiBtb2R1bGUuZXhwb3J0ZWREaXJlY3RpdmVzLFxuICAgICAgZXhwb3J0ZWRQaXBlczogbW9kdWxlLmV4cG9ydGVkUGlwZXNcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aXZlQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEge1xuICBkaXJlY3RpdmVzU2V0ID0gbmV3IFNldDxhbnk+KCk7XG4gIGRpcmVjdGl2ZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICBleHBvcnRlZERpcmVjdGl2ZXNTZXQgPSBuZXcgU2V0PGFueT4oKTtcbiAgZXhwb3J0ZWREaXJlY3RpdmVzOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhW10gPSBbXTtcbiAgcGlwZXNTZXQgPSBuZXcgU2V0PGFueT4oKTtcbiAgcGlwZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICBleHBvcnRlZFBpcGVzU2V0ID0gbmV3IFNldDxhbnk+KCk7XG4gIGV4cG9ydGVkUGlwZXM6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGFbXSA9IFtdO1xuICBtb2R1bGVzU2V0ID0gbmV3IFNldDxhbnk+KCk7XG4gIG1vZHVsZXM6IENvbXBpbGVUeXBlTWV0YWRhdGFbXSA9IFtdO1xuICBlbnRyeUNvbXBvbmVudHNTZXQgPSBuZXcgU2V0PGFueT4oKTtcbiAgZW50cnlDb21wb25lbnRzOiBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YVtdID0gW107XG5cbiAgcHJvdmlkZXJzOiB7cHJvdmlkZXI6IENvbXBpbGVQcm92aWRlck1ldGFkYXRhLCBtb2R1bGU6IENvbXBpbGVJZGVudGlmaWVyTWV0YWRhdGF9W10gPSBbXTtcblxuICBhZGRQcm92aWRlcihwcm92aWRlcjogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGEsIG1vZHVsZTogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSkge1xuICAgIHRoaXMucHJvdmlkZXJzLnB1c2goe3Byb3ZpZGVyOiBwcm92aWRlciwgbW9kdWxlOiBtb2R1bGV9KTtcbiAgfVxuXG4gIGFkZERpcmVjdGl2ZShpZDogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSkge1xuICAgIGlmICghdGhpcy5kaXJlY3RpdmVzU2V0LmhhcyhpZC5yZWZlcmVuY2UpKSB7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXNTZXQuYWRkKGlkLnJlZmVyZW5jZSk7XG4gICAgICB0aGlzLmRpcmVjdGl2ZXMucHVzaChpZCk7XG4gICAgfVxuICB9XG4gIGFkZEV4cG9ydGVkRGlyZWN0aXZlKGlkOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhKSB7XG4gICAgaWYgKCF0aGlzLmV4cG9ydGVkRGlyZWN0aXZlc1NldC5oYXMoaWQucmVmZXJlbmNlKSkge1xuICAgICAgdGhpcy5leHBvcnRlZERpcmVjdGl2ZXNTZXQuYWRkKGlkLnJlZmVyZW5jZSk7XG4gICAgICB0aGlzLmV4cG9ydGVkRGlyZWN0aXZlcy5wdXNoKGlkKTtcbiAgICB9XG4gIH1cbiAgYWRkUGlwZShpZDogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSkge1xuICAgIGlmICghdGhpcy5waXBlc1NldC5oYXMoaWQucmVmZXJlbmNlKSkge1xuICAgICAgdGhpcy5waXBlc1NldC5hZGQoaWQucmVmZXJlbmNlKTtcbiAgICAgIHRoaXMucGlwZXMucHVzaChpZCk7XG4gICAgfVxuICB9XG4gIGFkZEV4cG9ydGVkUGlwZShpZDogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSkge1xuICAgIGlmICghdGhpcy5leHBvcnRlZFBpcGVzU2V0LmhhcyhpZC5yZWZlcmVuY2UpKSB7XG4gICAgICB0aGlzLmV4cG9ydGVkUGlwZXNTZXQuYWRkKGlkLnJlZmVyZW5jZSk7XG4gICAgICB0aGlzLmV4cG9ydGVkUGlwZXMucHVzaChpZCk7XG4gICAgfVxuICB9XG4gIGFkZE1vZHVsZShpZDogQ29tcGlsZVR5cGVNZXRhZGF0YSkge1xuICAgIGlmICghdGhpcy5tb2R1bGVzU2V0LmhhcyhpZC5yZWZlcmVuY2UpKSB7XG4gICAgICB0aGlzLm1vZHVsZXNTZXQuYWRkKGlkLnJlZmVyZW5jZSk7XG4gICAgICB0aGlzLm1vZHVsZXMucHVzaChpZCk7XG4gICAgfVxuICB9XG4gIGFkZEVudHJ5Q29tcG9uZW50KGVjOiBDb21waWxlRW50cnlDb21wb25lbnRNZXRhZGF0YSkge1xuICAgIGlmICghdGhpcy5lbnRyeUNvbXBvbmVudHNTZXQuaGFzKGVjLmNvbXBvbmVudFR5cGUpKSB7XG4gICAgICB0aGlzLmVudHJ5Q29tcG9uZW50c1NldC5hZGQoZWMuY29tcG9uZW50VHlwZSk7XG4gICAgICB0aGlzLmVudHJ5Q29tcG9uZW50cy5wdXNoKGVjKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gX25vcm1hbGl6ZUFycmF5KG9iajogYW55W10gfCB1bmRlZmluZWQgfCBudWxsKTogYW55W10ge1xuICByZXR1cm4gb2JqIHx8IFtdO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvdmlkZXJNZXRhIHtcbiAgdG9rZW46IGFueTtcbiAgdXNlQ2xhc3M6IFR5cGV8bnVsbDtcbiAgdXNlVmFsdWU6IGFueTtcbiAgdXNlRXhpc3Rpbmc6IGFueTtcbiAgdXNlRmFjdG9yeTogRnVuY3Rpb258bnVsbDtcbiAgZGVwZW5kZW5jaWVzOiBPYmplY3RbXXxudWxsO1xuICBtdWx0aTogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3Rvcih0b2tlbjogYW55LCB7dXNlQ2xhc3MsIHVzZVZhbHVlLCB1c2VFeGlzdGluZywgdXNlRmFjdG9yeSwgZGVwcywgbXVsdGl9OiB7XG4gICAgdXNlQ2xhc3M/OiBUeXBlLFxuICAgIHVzZVZhbHVlPzogYW55LFxuICAgIHVzZUV4aXN0aW5nPzogYW55LFxuICAgIHVzZUZhY3Rvcnk/OiBGdW5jdGlvbnxudWxsLFxuICAgIGRlcHM/OiBPYmplY3RbXXxudWxsLFxuICAgIG11bHRpPzogYm9vbGVhblxuICB9KSB7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMudXNlQ2xhc3MgPSB1c2VDbGFzcyB8fCBudWxsO1xuICAgIHRoaXMudXNlVmFsdWUgPSB1c2VWYWx1ZTtcbiAgICB0aGlzLnVzZUV4aXN0aW5nID0gdXNlRXhpc3Rpbmc7XG4gICAgdGhpcy51c2VGYWN0b3J5ID0gdXNlRmFjdG9yeSB8fCBudWxsO1xuICAgIHRoaXMuZGVwZW5kZW5jaWVzID0gZGVwcyB8fCBudWxsO1xuICAgIHRoaXMubXVsdGkgPSAhIW11bHRpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmbGF0dGVuPFQ+KGxpc3Q6IEFycmF5PFR8VFtdPik6IFRbXSB7XG4gIHJldHVybiBsaXN0LnJlZHVjZSgoZmxhdDogYW55W10sIGl0ZW06IFQgfCBUW10pOiBUW10gPT4ge1xuICAgIGNvbnN0IGZsYXRJdGVtID0gQXJyYXkuaXNBcnJheShpdGVtKSA/IGZsYXR0ZW4oaXRlbSkgOiBpdGVtO1xuICAgIHJldHVybiAoPFRbXT5mbGF0KS5jb25jYXQoZmxhdEl0ZW0pO1xuICB9LCBbXSk7XG59XG5cbmZ1bmN0aW9uIGppdFNvdXJjZVVybCh1cmw6IHN0cmluZykge1xuICAvLyBOb3RlOiBXZSBuZWVkIDMgXCIvXCIgc28gdGhhdCBuZyBzaG93cyB1cCBhcyBhIHNlcGFyYXRlIGRvbWFpblxuICAvLyBpbiB0aGUgY2hyb21lIGRldiB0b29scy5cbiAgcmV0dXJuIHVybC5yZXBsYWNlKC8oXFx3KzpcXC9cXC9bXFx3Oi1dKyk/KFxcLyspPy8sICduZzovLy8nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlU291cmNlVXJsKFxuICAgIG5nTW9kdWxlVHlwZTogQ29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YSwgY29tcE1ldGE6IHt0eXBlOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhfSxcbiAgICB0ZW1wbGF0ZU1ldGE6IHtpc0lubGluZTogYm9vbGVhbiwgdGVtcGxhdGVVcmw6IHN0cmluZyB8IG51bGx9KSB7XG4gIGxldCB1cmw6IHN0cmluZztcbiAgaWYgKHRlbXBsYXRlTWV0YS5pc0lubGluZSkge1xuICAgIGlmIChjb21wTWV0YS50eXBlLnJlZmVyZW5jZSBpbnN0YW5jZW9mIFN0YXRpY1N5bWJvbCkge1xuICAgICAgLy8gTm90ZTogYSAudHMgZmlsZSBtaWdodCBjb250YWluIG11bHRpcGxlIGNvbXBvbmVudHMgd2l0aCBpbmxpbmUgdGVtcGxhdGVzLFxuICAgICAgLy8gc28gd2UgbmVlZCB0byBnaXZlIHRoZW0gdW5pcXVlIHVybHMsIGFzIHRoZXNlIHdpbGwgYmUgdXNlZCBmb3Igc291cmNlbWFwcy5cbiAgICAgIHVybCA9IGAke2NvbXBNZXRhLnR5cGUucmVmZXJlbmNlLmZpbGVQYXRofS4ke2NvbXBNZXRhLnR5cGUucmVmZXJlbmNlLm5hbWV9Lmh0bWxgO1xuICAgIH0gZWxzZSB7XG4gICAgICB1cmwgPSBgJHtpZGVudGlmaWVyTmFtZShuZ01vZHVsZVR5cGUpfS8ke2lkZW50aWZpZXJOYW1lKGNvbXBNZXRhLnR5cGUpfS5odG1sYDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdXJsID0gdGVtcGxhdGVNZXRhLnRlbXBsYXRlVXJsICE7XG4gIH1cbiAgcmV0dXJuIGNvbXBNZXRhLnR5cGUucmVmZXJlbmNlIGluc3RhbmNlb2YgU3RhdGljU3ltYm9sID8gdXJsIDogaml0U291cmNlVXJsKHVybCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaGFyZWRTdHlsZXNoZWV0Sml0VXJsKG1ldGE6IENvbXBpbGVTdHlsZXNoZWV0TWV0YWRhdGEsIGlkOiBudW1iZXIpIHtcbiAgY29uc3QgcGF0aFBhcnRzID0gbWV0YS5tb2R1bGVVcmwgIS5zcGxpdCgvXFwvXFxcXC9nKTtcbiAgY29uc3QgYmFzZU5hbWUgPSBwYXRoUGFydHNbcGF0aFBhcnRzLmxlbmd0aCAtIDFdO1xuICByZXR1cm4gaml0U291cmNlVXJsKGBjc3MvJHtpZH0ke2Jhc2VOYW1lfS5uZ3N0eWxlLmpzYCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZ01vZHVsZUppdFVybChtb2R1bGVNZXRhOiBDb21waWxlTmdNb2R1bGVNZXRhZGF0YSk6IHN0cmluZyB7XG4gIHJldHVybiBqaXRTb3VyY2VVcmwoYCR7aWRlbnRpZmllck5hbWUobW9kdWxlTWV0YS50eXBlKX0vbW9kdWxlLm5nZmFjdG9yeS5qc2ApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGVtcGxhdGVKaXRVcmwoXG4gICAgbmdNb2R1bGVUeXBlOiBDb21waWxlSWRlbnRpZmllck1ldGFkYXRhLCBjb21wTWV0YTogQ29tcGlsZURpcmVjdGl2ZU1ldGFkYXRhKTogc3RyaW5nIHtcbiAgcmV0dXJuIGppdFNvdXJjZVVybChcbiAgICAgIGAke2lkZW50aWZpZXJOYW1lKG5nTW9kdWxlVHlwZSl9LyR7aWRlbnRpZmllck5hbWUoY29tcE1ldGEudHlwZSl9Lm5nZmFjdG9yeS5qc2ApO1xufVxuIl19