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
        Identifiers.namespaceHTML = { name: 'ɵnamespaceHTML', moduleName: CORE };
        Identifiers.namespaceMathML = { name: 'ɵnamespaceMathML', moduleName: CORE };
        Identifiers.namespaceSVG = { name: 'ɵnamespaceSVG', moduleName: CORE };
        Identifiers.element = { name: 'ɵelement', moduleName: CORE };
        Identifiers.elementStart = { name: 'ɵelementStart', moduleName: CORE };
        Identifiers.elementEnd = { name: 'ɵelementEnd', moduleName: CORE };
        Identifiers.elementProperty = { name: 'ɵelementProperty', moduleName: CORE };
        Identifiers.flushHooksUpTo = { name: 'ɵflushHooksUpTo', moduleName: CORE };
        Identifiers.componentHostSyntheticProperty = { name: 'ɵcomponentHostSyntheticProperty', moduleName: CORE };
        Identifiers.componentHostSyntheticListener = { name: 'ɵcomponentHostSyntheticListener', moduleName: CORE };
        Identifiers.elementAttribute = { name: 'ɵelementAttribute', moduleName: CORE };
        Identifiers.elementClassProp = { name: 'ɵelementClassProp', moduleName: CORE };
        Identifiers.elementContainerStart = { name: 'ɵelementContainerStart', moduleName: CORE };
        Identifiers.elementContainerEnd = { name: 'ɵelementContainerEnd', moduleName: CORE };
        Identifiers.elementStyling = { name: 'ɵelementStyling', moduleName: CORE };
        Identifiers.elementStylingMap = { name: 'ɵelementStylingMap', moduleName: CORE };
        Identifiers.elementStyleProp = { name: 'ɵelementStyleProp', moduleName: CORE };
        Identifiers.elementStylingApply = { name: 'ɵelementStylingApply', moduleName: CORE };
        Identifiers.elementHostAttrs = { name: 'ɵelementHostAttrs', moduleName: CORE };
        Identifiers.elementHostStyling = { name: 'ɵelementHostStyling', moduleName: CORE };
        Identifiers.elementHostStylingMap = { name: 'ɵelementHostStylingMap', moduleName: CORE };
        Identifiers.elementHostStyleProp = { name: 'ɵelementHostStyleProp', moduleName: CORE };
        Identifiers.elementHostClassProp = { name: 'ɵelementHostClassProp', moduleName: CORE };
        Identifiers.elementHostStylingApply = { name: 'ɵelementHostStylingApply', moduleName: CORE };
        Identifiers.containerCreate = { name: 'ɵcontainer', moduleName: CORE };
        Identifiers.nextContext = { name: 'ɵnextContext', moduleName: CORE };
        Identifiers.templateCreate = { name: 'ɵtemplate', moduleName: CORE };
        Identifiers.text = { name: 'ɵtext', moduleName: CORE };
        Identifiers.textBinding = { name: 'ɵtextBinding', moduleName: CORE };
        Identifiers.bind = { name: 'ɵbind', moduleName: CORE };
        Identifiers.enableBindings = { name: 'ɵenableBindings', moduleName: CORE };
        Identifiers.disableBindings = { name: 'ɵdisableBindings', moduleName: CORE };
        Identifiers.allocHostVars = { name: 'ɵallocHostVars', moduleName: CORE };
        Identifiers.getCurrentView = { name: 'ɵgetCurrentView', moduleName: CORE };
        Identifiers.restoreView = { name: 'ɵrestoreView', moduleName: CORE };
        Identifiers.interpolation1 = { name: 'ɵinterpolation1', moduleName: CORE };
        Identifiers.interpolation2 = { name: 'ɵinterpolation2', moduleName: CORE };
        Identifiers.interpolation3 = { name: 'ɵinterpolation3', moduleName: CORE };
        Identifiers.interpolation4 = { name: 'ɵinterpolation4', moduleName: CORE };
        Identifiers.interpolation5 = { name: 'ɵinterpolation5', moduleName: CORE };
        Identifiers.interpolation6 = { name: 'ɵinterpolation6', moduleName: CORE };
        Identifiers.interpolation7 = { name: 'ɵinterpolation7', moduleName: CORE };
        Identifiers.interpolation8 = { name: 'ɵinterpolation8', moduleName: CORE };
        Identifiers.interpolationV = { name: 'ɵinterpolationV', moduleName: CORE };
        Identifiers.pureFunction0 = { name: 'ɵpureFunction0', moduleName: CORE };
        Identifiers.pureFunction1 = { name: 'ɵpureFunction1', moduleName: CORE };
        Identifiers.pureFunction2 = { name: 'ɵpureFunction2', moduleName: CORE };
        Identifiers.pureFunction3 = { name: 'ɵpureFunction3', moduleName: CORE };
        Identifiers.pureFunction4 = { name: 'ɵpureFunction4', moduleName: CORE };
        Identifiers.pureFunction5 = { name: 'ɵpureFunction5', moduleName: CORE };
        Identifiers.pureFunction6 = { name: 'ɵpureFunction6', moduleName: CORE };
        Identifiers.pureFunction7 = { name: 'ɵpureFunction7', moduleName: CORE };
        Identifiers.pureFunction8 = { name: 'ɵpureFunction8', moduleName: CORE };
        Identifiers.pureFunctionV = { name: 'ɵpureFunctionV', moduleName: CORE };
        Identifiers.pipeBind1 = { name: 'ɵpipeBind1', moduleName: CORE };
        Identifiers.pipeBind2 = { name: 'ɵpipeBind2', moduleName: CORE };
        Identifiers.pipeBind3 = { name: 'ɵpipeBind3', moduleName: CORE };
        Identifiers.pipeBind4 = { name: 'ɵpipeBind4', moduleName: CORE };
        Identifiers.pipeBindV = { name: 'ɵpipeBindV', moduleName: CORE };
        Identifiers.i18n = { name: 'ɵi18n', moduleName: CORE };
        Identifiers.i18nAttributes = { name: 'ɵi18nAttributes', moduleName: CORE };
        Identifiers.i18nExp = { name: 'ɵi18nExp', moduleName: CORE };
        Identifiers.i18nStart = { name: 'ɵi18nStart', moduleName: CORE };
        Identifiers.i18nEnd = { name: 'ɵi18nEnd', moduleName: CORE };
        Identifiers.i18nApply = { name: 'ɵi18nApply', moduleName: CORE };
        Identifiers.i18nPostprocess = { name: 'ɵi18nPostprocess', moduleName: CORE };
        Identifiers.load = { name: 'ɵload', moduleName: CORE };
        Identifiers.pipe = { name: 'ɵpipe', moduleName: CORE };
        Identifiers.projection = { name: 'ɵprojection', moduleName: CORE };
        Identifiers.projectionDef = { name: 'ɵprojectionDef', moduleName: CORE };
        Identifiers.reference = { name: 'ɵreference', moduleName: CORE };
        Identifiers.inject = { name: 'inject', moduleName: CORE };
        Identifiers.injectAttribute = { name: 'ɵinjectAttribute', moduleName: CORE };
        Identifiers.directiveInject = { name: 'ɵdirectiveInject', moduleName: CORE };
        Identifiers.templateRefExtractor = { name: 'ɵtemplateRefExtractor', moduleName: CORE };
        Identifiers.resolveWindow = { name: 'ɵresolveWindow', moduleName: CORE };
        Identifiers.resolveDocument = { name: 'ɵresolveDocument', moduleName: CORE };
        Identifiers.resolveBody = { name: 'ɵresolveBody', moduleName: CORE };
        Identifiers.defineBase = { name: 'ɵdefineBase', moduleName: CORE };
        Identifiers.BaseDef = {
            name: 'ɵBaseDef',
            moduleName: CORE,
        };
        Identifiers.defineComponent = { name: 'ɵdefineComponent', moduleName: CORE };
        Identifiers.setComponentScope = { name: 'ɵsetComponentScope', moduleName: CORE };
        Identifiers.ComponentDefWithMeta = {
            name: 'ɵComponentDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.defineDirective = {
            name: 'ɵdefineDirective',
            moduleName: CORE,
        };
        Identifiers.DirectiveDefWithMeta = {
            name: 'ɵDirectiveDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.InjectorDef = {
            name: 'ɵInjectorDef',
            moduleName: CORE,
        };
        Identifiers.defineInjector = {
            name: 'defineInjector',
            moduleName: CORE,
        };
        Identifiers.NgModuleDefWithMeta = {
            name: 'ɵNgModuleDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.defineNgModule = { name: 'ɵdefineNgModule', moduleName: CORE };
        Identifiers.PipeDefWithMeta = { name: 'ɵPipeDefWithMeta', moduleName: CORE };
        Identifiers.definePipe = { name: 'ɵdefinePipe', moduleName: CORE };
        Identifiers.queryRefresh = { name: 'ɵqueryRefresh', moduleName: CORE };
        Identifiers.viewQuery = { name: 'ɵviewQuery', moduleName: CORE };
        Identifiers.staticViewQuery = { name: 'ɵstaticViewQuery', moduleName: CORE };
        Identifiers.staticContentQuery = { name: 'ɵstaticContentQuery', moduleName: CORE };
        Identifiers.loadViewQuery = { name: 'ɵloadViewQuery', moduleName: CORE };
        Identifiers.contentQuery = { name: 'ɵcontentQuery', moduleName: CORE };
        Identifiers.loadContentQuery = { name: 'ɵloadContentQuery', moduleName: CORE };
        Identifiers.NgOnChangesFeature = { name: 'ɵNgOnChangesFeature', moduleName: CORE };
        Identifiers.InheritDefinitionFeature = { name: 'ɵInheritDefinitionFeature', moduleName: CORE };
        Identifiers.ProvidersFeature = { name: 'ɵProvidersFeature', moduleName: CORE };
        Identifiers.listener = { name: 'ɵlistener', moduleName: CORE };
        Identifiers.getFactoryOf = {
            name: 'ɵgetFactoryOf',
            moduleName: CORE,
        };
        Identifiers.getInheritedFactory = {
            name: 'ɵgetInheritedFactory',
            moduleName: CORE,
        };
        // sanitization-related functions
        Identifiers.sanitizeHtml = { name: 'ɵsanitizeHtml', moduleName: CORE };
        Identifiers.sanitizeStyle = { name: 'ɵsanitizeStyle', moduleName: CORE };
        Identifiers.defaultStyleSanitizer = { name: 'ɵdefaultStyleSanitizer', moduleName: CORE };
        Identifiers.sanitizeResourceUrl = { name: 'ɵsanitizeResourceUrl', moduleName: CORE };
        Identifiers.sanitizeScript = { name: 'ɵsanitizeScript', moduleName: CORE };
        Identifiers.sanitizeUrl = { name: 'ɵsanitizeUrl', moduleName: CORE };
        Identifiers.sanitizeUrlOrResourceUrl = { name: 'ɵsanitizeUrlOrResourceUrl', moduleName: CORE };
        return Identifiers;
    }());
    exports.Identifiers = Identifiers;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaWRlbnRpZmllcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19pZGVudGlmaWVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILElBQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQztJQUU3QjtRQUFBO1FBb09BLENBQUM7UUFuT0MsYUFBYTtRQUNOLHNCQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ3ZCLDRCQUFnQixHQUFHLFdBQVcsQ0FBQztRQUMvQixzQkFBVSxHQUFHLGFBQWEsQ0FBQztRQUVsQyxrQkFBa0I7UUFDWCx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFaEYsMkJBQWUsR0FBd0IsRUFBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXBGLHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFOUUsbUJBQU8sR0FBd0IsRUFBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVwRSx3QkFBWSxHQUF3QixFQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRTlFLHNCQUFVLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFMUUsMkJBQWUsR0FBd0IsRUFBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXBGLDBCQUFjLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVs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LEFBcE9ELElBb09DO0lBcE9ZLGtDQUFXIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuY29uc3QgQ09SRSA9ICdAYW5ndWxhci9jb3JlJztcblxuZXhwb3J0IGNsYXNzIElkZW50aWZpZXJzIHtcbiAgLyogTWV0aG9kcyAqL1xuICBzdGF0aWMgTkVXX01FVEhPRCA9ICdmYWN0b3J5JztcbiAgc3RhdGljIFRSQU5TRk9STV9NRVRIT0QgPSAndHJhbnNmb3JtJztcbiAgc3RhdGljIFBBVENIX0RFUFMgPSAncGF0Y2hlZERlcHMnO1xuXG4gIC8qIEluc3RydWN0aW9ucyAqL1xuICBzdGF0aWMgbmFtZXNwYWNlSFRNTDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVuYW1lc3BhY2VIVE1MJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIG5hbWVzcGFjZU1hdGhNTDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVuYW1lc3BhY2VNYXRoTUwnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbmFtZXNwYWNlU1ZHOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtW5hbWVzcGFjZVNWRycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0YXJ0OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRTdGFydCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50RW5kOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRFbmQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFByb3BlcnR5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRQcm9wZXJ0eScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBmbHVzaEhvb2tzVXBUbzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVmbHVzaEhvb2tzVXBUbycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBjb21wb25lbnRIb3N0U3ludGhldGljUHJvcGVydHk6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWNvbXBvbmVudEhvc3RTeW50aGV0aWNQcm9wZXJ0eScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBjb21wb25lbnRIb3N0U3ludGhldGljTGlzdGVuZXI6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWNvbXBvbmVudEhvc3RTeW50aGV0aWNMaXN0ZW5lcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50QXR0cmlidXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRBdHRyaWJ1dGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudENsYXNzUHJvcDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50Q2xhc3NQcm9wJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRDb250YWluZXJTdGFydDpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZWxlbWVudENvbnRhaW5lclN0YXJ0JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRDb250YWluZXJFbmQ6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRDb250YWluZXJFbmQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0eWxpbmc6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZWxlbWVudFN0eWxpbmcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0eWxpbmdNYXA6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZWxlbWVudFN0eWxpbmdNYXAnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0eWxlUHJvcDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50U3R5bGVQcm9wJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRTdHlsaW5nQXBwbHk6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRTdHlsaW5nQXBwbHknLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudEhvc3RBdHRyczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50SG9zdEF0dHJzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0U3R5bGluZzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50SG9zdFN0eWxpbmcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudEhvc3RTdHlsaW5nTWFwOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50SG9zdFN0eWxpbmdNYXAnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudEhvc3RTdHlsZVByb3A6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVsZW1lbnRIb3N0U3R5bGVQcm9wJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0Q2xhc3NQcm9wOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVlbGVtZW50SG9zdENsYXNzUHJvcCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50SG9zdFN0eWxpbmdBcHBseTpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZWxlbWVudEhvc3RTdHlsaW5nQXBwbHknLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgY29udGFpbmVyQ3JlYXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWNvbnRhaW5lcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBuZXh0Q29udGV4dDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVuZXh0Q29udGV4dCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyB0ZW1wbGF0ZUNyZWF0ZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybV0ZW1wbGF0ZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyB0ZXh0OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXRleHQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgdGV4dEJpbmRpbmc6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1dGV4dEJpbmRpbmcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgYmluZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybViaW5kJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVuYWJsZUJpbmRpbmdzOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWVuYWJsZUJpbmRpbmdzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRpc2FibGVCaW5kaW5nczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVkaXNhYmxlQmluZGluZ3MnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgYWxsb2NIb3N0VmFyczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVhbGxvY0hvc3RWYXJzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGdldEN1cnJlbnRWaWV3OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWdldEN1cnJlbnRWaWV3JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHJlc3RvcmVWaWV3OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXJlc3RvcmVWaWV3JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGludGVycG9sYXRpb24xOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWludGVycG9sYXRpb24xJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uMjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbnRlcnBvbGF0aW9uMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aW50ZXJwb2xhdGlvbjMnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGludGVycG9sYXRpb240OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWludGVycG9sYXRpb240JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uNTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbnRlcnBvbGF0aW9uNScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aW50ZXJwb2xhdGlvbjYnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGludGVycG9sYXRpb243OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWludGVycG9sYXRpb243JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpbnRlcnBvbGF0aW9uODogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbnRlcnBvbGF0aW9uOCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvblY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aW50ZXJwb2xhdGlvblYnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwdXJlRnVuY3Rpb24wJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb24xOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXB1cmVGdW5jdGlvbjEnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjI6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cHVyZUZ1bmN0aW9uMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwdXJlRnVuY3Rpb24zJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb240OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXB1cmVGdW5jdGlvbjQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cHVyZUZ1bmN0aW9uNScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwdXJlRnVuY3Rpb242JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb243OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXB1cmVGdW5jdGlvbjcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjg6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cHVyZUZ1bmN0aW9uOCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uVjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwdXJlRnVuY3Rpb25WJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHBpcGVCaW5kMTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwaXBlQmluZDEnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kMjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwaXBlQmluZDInLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kMzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwaXBlQmluZDMnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kNDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwaXBlQmluZDQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kVjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVwaXBlQmluZFYnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgaTE4bjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMThuJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpMThuQXR0cmlidXRlczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMThuQXR0cmlidXRlcycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaTE4bkV4cDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMThuRXhwJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpMThuU3RhcnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1aTE4blN0YXJ0JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpMThuRW5kOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWkxOG5FbmQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGkxOG5BcHBseTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMThuQXBwbHknLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGkxOG5Qb3N0cHJvY2Vzczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpMThuUG9zdHByb2Nlc3MnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbG9hZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVsb2FkJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHBpcGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cGlwZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBwcm9qZWN0aW9uOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXByb2plY3Rpb24nLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHByb2plY3Rpb25EZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cHJvamVjdGlvbkRlZicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyByZWZlcmVuY2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cmVmZXJlbmNlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGluamVjdDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnaW5qZWN0JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGluamVjdEF0dHJpYnV0ZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVpbmplY3RBdHRyaWJ1dGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZGlyZWN0aXZlSW5qZWN0OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWRpcmVjdGl2ZUluamVjdCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyB0ZW1wbGF0ZVJlZkV4dHJhY3RvcjpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1dGVtcGxhdGVSZWZFeHRyYWN0b3InLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcmVzb2x2ZVdpbmRvdzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVyZXNvbHZlV2luZG93JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyByZXNvbHZlRG9jdW1lbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cmVzb2x2ZURvY3VtZW50JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyByZXNvbHZlQm9keTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVyZXNvbHZlQm9keScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBkZWZpbmVCYXNlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWRlZmluZUJhc2UnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgQmFzZURlZjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybVCYXNlRGVmJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVDb21wb25lbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZGVmaW5lQ29tcG9uZW50JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHNldENvbXBvbmVudFNjb3BlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXNldENvbXBvbmVudFNjb3BlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIENvbXBvbmVudERlZldpdGhNZXRhOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtUNvbXBvbmVudERlZldpdGhNZXRhJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVEaXJlY3RpdmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1ZGVmaW5lRGlyZWN0aXZlJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBEaXJlY3RpdmVEZWZXaXRoTWV0YTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybVEaXJlY3RpdmVEZWZXaXRoTWV0YScsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgSW5qZWN0b3JEZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1SW5qZWN0b3JEZWYnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIGRlZmluZUluamVjdG9yOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICdkZWZpbmVJbmplY3RvcicsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgTmdNb2R1bGVEZWZXaXRoTWV0YTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybVOZ01vZHVsZURlZldpdGhNZXRhJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVOZ01vZHVsZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVkZWZpbmVOZ01vZHVsZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBQaXBlRGVmV2l0aE1ldGE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1UGlwZURlZldpdGhNZXRhJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRlZmluZVBpcGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZGVmaW5lUGlwZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBxdWVyeVJlZnJlc2g6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1cXVlcnlSZWZyZXNoJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyB2aWV3UXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1dmlld1F1ZXJ5JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzdGF0aWNWaWV3UXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c3RhdGljVmlld1F1ZXJ5JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzdGF0aWNDb250ZW50UXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c3RhdGljQ29udGVudFF1ZXJ5JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBsb2FkVmlld1F1ZXJ5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtWxvYWRWaWV3UXVlcnknLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGNvbnRlbnRRdWVyeTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVjb250ZW50UXVlcnknLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGxvYWRDb250ZW50UXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1bG9hZENvbnRlbnRRdWVyeScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBOZ09uQ2hhbmdlc0ZlYXR1cmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1TmdPbkNoYW5nZXNGZWF0dXJlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIEluaGVyaXREZWZpbml0aW9uRmVhdHVyZTpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1SW5oZXJpdERlZmluaXRpb25GZWF0dXJlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIFByb3ZpZGVyc0ZlYXR1cmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1UHJvdmlkZXJzRmVhdHVyZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBsaXN0ZW5lcjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVsaXN0ZW5lcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBnZXRGYWN0b3J5T2Y6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1Z2V0RmFjdG9yeU9mJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBnZXRJbmhlcml0ZWRGYWN0b3J5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtWdldEluaGVyaXRlZEZhY3RvcnknLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgLy8gc2FuaXRpemF0aW9uLXJlbGF0ZWQgZnVuY3Rpb25zXG4gIHN0YXRpYyBzYW5pdGl6ZUh0bWw6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c2FuaXRpemVIdG1sJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVN0eWxlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtXNhbml0aXplU3R5bGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGRlZmF1bHRTdHlsZVNhbml0aXplcjpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ZGVmYXVsdFN0eWxlU2FuaXRpemVyJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVJlc291cmNlVXJsOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVzYW5pdGl6ZVJlc291cmNlVXJsJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVNjcmlwdDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVzYW5pdGl6ZVNjcmlwdCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgc2FuaXRpemVVcmw6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c2FuaXRpemVVcmwnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHNhbml0aXplVXJsT3JSZXNvdXJjZVVybDpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1c2FuaXRpemVVcmxPclJlc291cmNlVXJsJywgbW9kdWxlTmFtZTogQ09SRX07XG59XG4iXX0=