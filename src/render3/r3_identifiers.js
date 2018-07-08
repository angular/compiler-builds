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
        define("@angular/compiler/src/render3/r3_identifiers", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var CORE = '@angular/core';
    var Identifiers = /** @class */ (function () {
        function Identifiers() {
        }
        /* Methods */
        Identifiers.NEW_METHOD = 'factory';
        Identifiers.TRANSFORM_METHOD = 'transform';
        Identifiers.PATCH_DEPS = 'patchedDeps';
        /* Instructions */
        Identifiers.namespaceHTML = { name: 'ɵNH', moduleName: CORE };
        Identifiers.namespaceMathML = { name: 'ɵNM', moduleName: CORE };
        Identifiers.namespaceSVG = { name: 'ɵNS', moduleName: CORE };
        Identifiers.element = { name: 'ɵEe', moduleName: CORE };
        Identifiers.elementStart = { name: 'ɵE', moduleName: CORE };
        Identifiers.elementEnd = { name: 'ɵe', moduleName: CORE };
        Identifiers.elementProperty = { name: 'ɵp', moduleName: CORE };
        Identifiers.elementAttribute = { name: 'ɵa', moduleName: CORE };
        Identifiers.elementClass = { name: 'ɵk', moduleName: CORE };
        Identifiers.elementClassNamed = { name: 'ɵkn', moduleName: CORE };
        Identifiers.elementStyling = { name: 'ɵs', moduleName: CORE };
        Identifiers.elementStyle = { name: 'ɵsm', moduleName: CORE };
        Identifiers.elementStyleProp = { name: 'ɵsp', moduleName: CORE };
        Identifiers.elementStylingApply = { name: 'ɵsa', moduleName: CORE };
        Identifiers.containerCreate = { name: 'ɵC', moduleName: CORE };
        Identifiers.text = { name: 'ɵT', moduleName: CORE };
        Identifiers.textBinding = { name: 'ɵt', moduleName: CORE };
        Identifiers.bind = { name: 'ɵb', moduleName: CORE };
        Identifiers.interpolation1 = { name: 'ɵi1', moduleName: CORE };
        Identifiers.interpolation2 = { name: 'ɵi2', moduleName: CORE };
        Identifiers.interpolation3 = { name: 'ɵi3', moduleName: CORE };
        Identifiers.interpolation4 = { name: 'ɵi4', moduleName: CORE };
        Identifiers.interpolation5 = { name: 'ɵi5', moduleName: CORE };
        Identifiers.interpolation6 = { name: 'ɵi6', moduleName: CORE };
        Identifiers.interpolation7 = { name: 'ɵi7', moduleName: CORE };
        Identifiers.interpolation8 = { name: 'ɵi8', moduleName: CORE };
        Identifiers.interpolationV = { name: 'ɵiV', moduleName: CORE };
        Identifiers.pureFunction0 = { name: 'ɵf0', moduleName: CORE };
        Identifiers.pureFunction1 = { name: 'ɵf1', moduleName: CORE };
        Identifiers.pureFunction2 = { name: 'ɵf2', moduleName: CORE };
        Identifiers.pureFunction3 = { name: 'ɵf3', moduleName: CORE };
        Identifiers.pureFunction4 = { name: 'ɵf4', moduleName: CORE };
        Identifiers.pureFunction5 = { name: 'ɵf5', moduleName: CORE };
        Identifiers.pureFunction6 = { name: 'ɵf6', moduleName: CORE };
        Identifiers.pureFunction7 = { name: 'ɵf7', moduleName: CORE };
        Identifiers.pureFunction8 = { name: 'ɵf8', moduleName: CORE };
        Identifiers.pureFunctionV = { name: 'ɵfV', moduleName: CORE };
        Identifiers.pipeBind1 = { name: 'ɵpb1', moduleName: CORE };
        Identifiers.pipeBind2 = { name: 'ɵpb2', moduleName: CORE };
        Identifiers.pipeBind3 = { name: 'ɵpb3', moduleName: CORE };
        Identifiers.pipeBind4 = { name: 'ɵpb4', moduleName: CORE };
        Identifiers.pipeBindV = { name: 'ɵpbV', moduleName: CORE };
        Identifiers.load = { name: 'ɵld', moduleName: CORE };
        Identifiers.loadDirective = { name: 'ɵd', moduleName: CORE };
        Identifiers.pipe = { name: 'ɵPp', moduleName: CORE };
        Identifiers.projection = { name: 'ɵP', moduleName: CORE };
        Identifiers.projectionDef = { name: 'ɵpD', moduleName: CORE };
        Identifiers.inject = { name: 'inject', moduleName: CORE };
        Identifiers.injectAttribute = { name: 'ɵinjectAttribute', moduleName: CORE };
        Identifiers.injectElementRef = { name: 'ɵinjectElementRef', moduleName: CORE };
        Identifiers.injectTemplateRef = { name: 'ɵinjectTemplateRef', moduleName: CORE };
        Identifiers.injectViewContainerRef = { name: 'ɵinjectViewContainerRef', moduleName: CORE };
        Identifiers.directiveInject = { name: 'ɵdirectiveInject', moduleName: CORE };
        Identifiers.defineComponent = { name: 'ɵdefineComponent', moduleName: CORE };
        Identifiers.ComponentDef = {
            name: 'ComponentDef',
            moduleName: CORE,
        };
        Identifiers.defineDirective = {
            name: 'ɵdefineDirective',
            moduleName: CORE,
        };
        Identifiers.DirectiveDef = {
            name: 'DirectiveDef',
            moduleName: CORE,
        };
        Identifiers.InjectorDef = {
            name: 'InjectorDef',
            moduleName: CORE,
        };
        Identifiers.defineInjector = {
            name: 'defineInjector',
            moduleName: CORE,
        };
        Identifiers.NgModuleDef = {
            name: 'NgModuleDef',
            moduleName: CORE,
        };
        Identifiers.defineNgModule = { name: 'ɵdefineNgModule', moduleName: CORE };
        Identifiers.PipeDef = { name: 'ɵPipeDef', moduleName: CORE };
        Identifiers.definePipe = { name: 'ɵdefinePipe', moduleName: CORE };
        Identifiers.query = { name: 'ɵQ', moduleName: CORE };
        Identifiers.queryRefresh = { name: 'ɵqR', moduleName: CORE };
        Identifiers.NgOnChangesFeature = { name: 'ɵNgOnChangesFeature', moduleName: CORE };
        Identifiers.InheritDefinitionFeature = { name: 'ɵInheritDefinitionFeature', moduleName: CORE };
        Identifiers.listener = { name: 'ɵL', moduleName: CORE };
        // Reserve slots for pure functions
        Identifiers.reserveSlots = { name: 'ɵrS', moduleName: CORE };
        return Identifiers;
    }());
    exports.Identifiers = Identifiers;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaWRlbnRpZmllcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19pZGVudGlmaWVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILElBQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQztJQUU3QjtRQUFBO1FBNklBLENBQUM7UUE1SUMsYUFBYTtRQUNOLHNCQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ3ZCLDRCQUFnQixHQUFHLFdBQVcsQ0FBQztRQUMvQixzQkFBVSxHQUFHLGFBQWEsQ0FBQztRQUVsQyxrQkFBa0I7UUFDWCx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXJFLDJCQUFlLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFdkUsd0JBQVksR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVwRSxtQkFBTyxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRS9ELHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFbkUsc0JBQVUsR0FBd0IsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVqRSwyQkFBZSxHQUF3QixFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXRFLDRCQUFnQixHQUF3QixFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXZFLHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFbkUsNkJBQWlCLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFekUsMEJBQWMsR0FBd0IsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVyRSx3QkFBWSxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXBFLDRCQUFnQixHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXhFLCtCQUFtQixHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRTNFLDJCQUFlLEdBQXdCLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFdEUsZ0JBQUksR0FBd0IsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUUzRCx1QkFBVyxHQUF3QixFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRWxFLGdCQUFJLEdBQXdCLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFM0QsMEJBQWMsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUN0RSwwQkFBYyxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3RFLDBCQUFjLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDdEUsMEJBQWMsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUN0RSwwQkFBYyxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3RFLDBCQUFjLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDdEUsMEJBQWMsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUN0RSwwQkFBYyxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3RFLDBCQUFjLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFdEUseUJBQWEsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUNyRSx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3JFLHlCQUFhLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDckUseUJBQWEsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUNyRSx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ3JFLHlCQUFhLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDckUseUJBQWEsR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUNyRSx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxLQUFLLEVB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QUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRWxGLG1CQUFPLEdBQXdCLEVBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFcEUsc0JBQVUsR0FBd0IsRUFBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUUxRSxpQkFBSyxHQUF3QixFQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQzVELHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFcEUsOEJBQWtCLEdBQXdCLEVBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUUxRixvQ0FBd0IsR0FDTCxFQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFekUsb0JBQVEsR0FBd0IsRUFBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUV0RSxtQ0FBbUM7UUFDNUIsd0JBQVksR0FBd0IsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUM3RSxrQkFBQztLQUFBLEFBN0lELElBNklDO0lBN0lZLGtDQUFXIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuY29uc3QgQ09SRSA9ICdAYW5ndWxhci9jb3JlJztcblxuZXhwb3J0IGNsYXNzIElkZW50aWZpZXJzIHtcbiAgLyogTWV0aG9kcyAqL1xuICBzdGF0aWMgTkVXX01FVEhPRCA9ICdmYWN0b3J5JztcbiAgc3RhdGljIFRSQU5TRk9STV9NRVRIT0QgPSAndHJhbnNmb3JtJztcbiAgc3RhdGljIFBBVENIX0RFUFMgPSAncGF0Y2hlZERlcHMnO1xuXG4gIC8qIEluc3RydWN0aW9ucyAqL1xuICBzdGF0aWMgbmFtZXNwYWNlSFRNTDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVOSCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBuYW1lc3BhY2VNYXRoTUw6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1Tk0nLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbmFtZXNwYWNlU1ZHOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtU5TJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1RWUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0YXJ0OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtUUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudEVuZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRQcm9wZXJ0eTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRBdHRyaWJ1dGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1YScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50Q2xhc3M6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50Q2xhc3NOYW1lZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVrbicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50U3R5bGluZzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRTdHlsZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVzbScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50U3R5bGVQcm9wOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXNwJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRTdHlsaW5nQXBwbHk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c2EnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgY29udGFpbmVyQ3JlYXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtUMnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgdGV4dDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVUJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHRleHRCaW5kaW5nOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgYmluZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybViJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGludGVycG9sYXRpb24xOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWkxJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uMjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aTMnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGludGVycG9sYXRpb240OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWk0JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uNTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpNScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aTYnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGludGVycG9sYXRpb243OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWk3JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uODogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpOCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvblY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aVYnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmMCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmMScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmMycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmNCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmNScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmNicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmNycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uODogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmOCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uVjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmVicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBwaXBlQmluZDE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGIxJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwaXBlQmluZDI6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGIyJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwaXBlQmluZDM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGIzJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwaXBlQmluZDQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGI0JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwaXBlQmluZFY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGJWJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGxvYWQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1bGQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGxvYWREaXJlY3RpdmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBwaXBlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtVBwJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHByb2plY3Rpb246IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1UCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHJvamVjdGlvbkRlZjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwRCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpbmplY3Q6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ2luamVjdCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpbmplY3RBdHRyaWJ1dGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aW5qZWN0QXR0cmlidXRlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGluamVjdEVsZW1lbnRSZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aW5qZWN0RWxlbWVudFJlZicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpbmplY3RUZW1wbGF0ZVJlZjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbmplY3RUZW1wbGF0ZVJlZicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpbmplY3RWaWV3Q29udGFpbmVyUmVmOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbmplY3RWaWV3Q29udGFpbmVyUmVmJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRpcmVjdGl2ZUluamVjdDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVkaXJlY3RpdmVJbmplY3QnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZGVmaW5lQ29tcG9uZW50OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWRlZmluZUNvbXBvbmVudCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBDb21wb25lbnREZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ0NvbXBvbmVudERlZicsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgZGVmaW5lRGlyZWN0aXZlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtWRlZmluZURpcmVjdGl2ZScsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgRGlyZWN0aXZlRGVmOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICdEaXJlY3RpdmVEZWYnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIEluamVjdG9yRGVmOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICdJbmplY3RvckRlZicsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgZGVmaW5lSW5qZWN0b3I6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ2RlZmluZUluamVjdG9yJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBOZ01vZHVsZURlZjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnTmdNb2R1bGVEZWYnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIGRlZmluZU5nTW9kdWxlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWRlZmluZU5nTW9kdWxlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIFBpcGVEZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1UGlwZURlZicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBkZWZpbmVQaXBlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWRlZmluZVBpcGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1UScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcXVlcnlSZWZyZXNoOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXFSJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIE5nT25DaGFuZ2VzRmVhdHVyZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVOZ09uQ2hhbmdlc0ZlYXR1cmUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgSW5oZXJpdERlZmluaXRpb25GZWF0dXJlOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVJbmhlcml0RGVmaW5pdGlvbkZlYXR1cmUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbGlzdGVuZXI6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1TCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIC8vIFJlc2VydmUgc2xvdHMgZm9yIHB1cmUgZnVuY3Rpb25zXG4gIHN0YXRpYyByZXNlcnZlU2xvdHM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1clMnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbn1cbiJdfQ==