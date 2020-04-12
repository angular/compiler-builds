/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/ng_module_resolver", ["require", "exports", "@angular/compiler/src/core", "@angular/compiler/src/directive_resolver", "@angular/compiler/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require("@angular/compiler/src/core");
    var directive_resolver_1 = require("@angular/compiler/src/directive_resolver");
    var util_1 = require("@angular/compiler/src/util");
    /**
     * Resolves types to {@link NgModule}.
     */
    var NgModuleResolver = /** @class */ (function () {
        function NgModuleResolver(_reflector) {
            this._reflector = _reflector;
        }
        NgModuleResolver.prototype.isNgModule = function (type) { return this._reflector.annotations(type).some(core_1.createNgModule.isTypeOf); };
        NgModuleResolver.prototype.resolve = function (type, throwIfNotFound) {
            if (throwIfNotFound === void 0) { throwIfNotFound = true; }
            var ngModuleMeta = directive_resolver_1.findLast(this._reflector.annotations(type), core_1.createNgModule.isTypeOf);
            if (ngModuleMeta) {
                return ngModuleMeta;
            }
            else {
                if (throwIfNotFound) {
                    throw new Error("No NgModule metadata found for '" + util_1.stringify(type) + "'.");
                }
                return null;
            }
        };
        return NgModuleResolver;
    }());
    exports.NgModuleResolver = NgModuleResolver;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX3Jlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL25nX21vZHVsZV9yZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUdILG1EQUFzRDtJQUN0RCwrRUFBOEM7SUFDOUMsbURBQWlDO0lBSWpDOztPQUVHO0lBQ0g7UUFDRSwwQkFBb0IsVUFBNEI7WUFBNUIsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7UUFBRyxDQUFDO1FBRXBELHFDQUFVLEdBQVYsVUFBVyxJQUFTLElBQUksT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMscUJBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFakcsa0NBQU8sR0FBUCxVQUFRLElBQVUsRUFBRSxlQUFzQjtZQUF0QixnQ0FBQSxFQUFBLHNCQUFzQjtZQUN4QyxJQUFNLFlBQVksR0FDZCw2QkFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFLHFCQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFekUsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLE9BQU8sWUFBWSxDQUFDO2FBQ3JCO2lCQUFNO2dCQUNMLElBQUksZUFBZSxFQUFFO29CQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFtQyxnQkFBUyxDQUFDLElBQUksQ0FBQyxPQUFJLENBQUMsQ0FBQztpQkFDekU7Z0JBQ0QsT0FBTyxJQUFJLENBQUM7YUFDYjtRQUNILENBQUM7UUFDSCx1QkFBQztJQUFELENBQUMsQUFsQkQsSUFrQkM7SUFsQlksNENBQWdCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtOZ01vZHVsZSwgVHlwZSwgY3JlYXRlTmdNb2R1bGV9IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge2ZpbmRMYXN0fSBmcm9tICcuL2RpcmVjdGl2ZV9yZXNvbHZlcic7XG5pbXBvcnQge3N0cmluZ2lmeX0gZnJvbSAnLi91dGlsJztcblxuXG5cbi8qKlxuICogUmVzb2x2ZXMgdHlwZXMgdG8ge0BsaW5rIE5nTW9kdWxlfS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5nTW9kdWxlUmVzb2x2ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9yZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHt9XG5cbiAgaXNOZ01vZHVsZSh0eXBlOiBhbnkpIHsgcmV0dXJuIHRoaXMuX3JlZmxlY3Rvci5hbm5vdGF0aW9ucyh0eXBlKS5zb21lKGNyZWF0ZU5nTW9kdWxlLmlzVHlwZU9mKTsgfVxuXG4gIHJlc29sdmUodHlwZTogVHlwZSwgdGhyb3dJZk5vdEZvdW5kID0gdHJ1ZSk6IE5nTW9kdWxlfG51bGwge1xuICAgIGNvbnN0IG5nTW9kdWxlTWV0YTogTmdNb2R1bGUgPVxuICAgICAgICBmaW5kTGFzdCh0aGlzLl9yZWZsZWN0b3IuYW5ub3RhdGlvbnModHlwZSksIGNyZWF0ZU5nTW9kdWxlLmlzVHlwZU9mKTtcblxuICAgIGlmIChuZ01vZHVsZU1ldGEpIHtcbiAgICAgIHJldHVybiBuZ01vZHVsZU1ldGE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aHJvd0lmTm90Rm91bmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBOZ01vZHVsZSBtZXRhZGF0YSBmb3VuZCBmb3IgJyR7c3RyaW5naWZ5KHR5cGUpfScuYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbn1cbiJdfQ==