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
        Identifiers.namespaceHTML = { name: 'ɵɵnamespaceHTML', moduleName: CORE };
        Identifiers.namespaceMathML = { name: 'ɵɵnamespaceMathML', moduleName: CORE };
        Identifiers.namespaceSVG = { name: 'ɵɵnamespaceSVG', moduleName: CORE };
        Identifiers.element = { name: 'ɵɵelement', moduleName: CORE };
        Identifiers.elementStart = { name: 'ɵɵelementStart', moduleName: CORE };
        Identifiers.elementEnd = { name: 'ɵɵelementEnd', moduleName: CORE };
        Identifiers.elementProperty = { name: 'ɵɵelementProperty', moduleName: CORE };
        Identifiers.select = { name: 'ɵɵselect', moduleName: CORE };
        Identifiers.componentHostSyntheticProperty = { name: 'ɵɵcomponentHostSyntheticProperty', moduleName: CORE };
        Identifiers.componentHostSyntheticListener = { name: 'ɵɵcomponentHostSyntheticListener', moduleName: CORE };
        Identifiers.elementAttribute = { name: 'ɵɵelementAttribute', moduleName: CORE };
        Identifiers.elementClassProp = { name: 'ɵɵelementClassProp', moduleName: CORE };
        Identifiers.elementContainerStart = { name: 'ɵɵelementContainerStart', moduleName: CORE };
        Identifiers.elementContainerEnd = { name: 'ɵɵelementContainerEnd', moduleName: CORE };
        Identifiers.elementStyling = { name: 'ɵɵelementStyling', moduleName: CORE };
        Identifiers.elementStylingMap = { name: 'ɵɵelementStylingMap', moduleName: CORE };
        Identifiers.elementStyleProp = { name: 'ɵɵelementStyleProp', moduleName: CORE };
        Identifiers.elementStylingApply = { name: 'ɵɵelementStylingApply', moduleName: CORE };
        Identifiers.elementHostAttrs = { name: 'ɵɵelementHostAttrs', moduleName: CORE };
        Identifiers.elementHostStyling = { name: 'ɵɵelementHostStyling', moduleName: CORE };
        Identifiers.elementHostStylingMap = { name: 'ɵɵelementHostStylingMap', moduleName: CORE };
        Identifiers.elementHostStyleProp = { name: 'ɵɵelementHostStyleProp', moduleName: CORE };
        Identifiers.elementHostClassProp = { name: 'ɵɵelementHostClassProp', moduleName: CORE };
        Identifiers.elementHostStylingApply = { name: 'ɵɵelementHostStylingApply', moduleName: CORE };
        Identifiers.containerCreate = { name: 'ɵɵcontainer', moduleName: CORE };
        Identifiers.nextContext = { name: 'ɵɵnextContext', moduleName: CORE };
        Identifiers.templateCreate = { name: 'ɵɵtemplate', moduleName: CORE };
        Identifiers.text = { name: 'ɵɵtext', moduleName: CORE };
        Identifiers.textBinding = { name: 'ɵɵtextBinding', moduleName: CORE };
        Identifiers.bind = { name: 'ɵɵbind', moduleName: CORE };
        Identifiers.enableBindings = { name: 'ɵɵenableBindings', moduleName: CORE };
        Identifiers.disableBindings = { name: 'ɵɵdisableBindings', moduleName: CORE };
        Identifiers.allocHostVars = { name: 'ɵɵallocHostVars', moduleName: CORE };
        Identifiers.getCurrentView = { name: 'ɵɵgetCurrentView', moduleName: CORE };
        Identifiers.restoreView = { name: 'ɵɵrestoreView', moduleName: CORE };
        Identifiers.interpolation1 = { name: 'ɵɵinterpolation1', moduleName: CORE };
        Identifiers.interpolation2 = { name: 'ɵɵinterpolation2', moduleName: CORE };
        Identifiers.interpolation3 = { name: 'ɵɵinterpolation3', moduleName: CORE };
        Identifiers.interpolation4 = { name: 'ɵɵinterpolation4', moduleName: CORE };
        Identifiers.interpolation5 = { name: 'ɵɵinterpolation5', moduleName: CORE };
        Identifiers.interpolation6 = { name: 'ɵɵinterpolation6', moduleName: CORE };
        Identifiers.interpolation7 = { name: 'ɵɵinterpolation7', moduleName: CORE };
        Identifiers.interpolation8 = { name: 'ɵɵinterpolation8', moduleName: CORE };
        Identifiers.interpolationV = { name: 'ɵɵinterpolationV', moduleName: CORE };
        Identifiers.pureFunction0 = { name: 'ɵɵpureFunction0', moduleName: CORE };
        Identifiers.pureFunction1 = { name: 'ɵɵpureFunction1', moduleName: CORE };
        Identifiers.pureFunction2 = { name: 'ɵɵpureFunction2', moduleName: CORE };
        Identifiers.pureFunction3 = { name: 'ɵɵpureFunction3', moduleName: CORE };
        Identifiers.pureFunction4 = { name: 'ɵɵpureFunction4', moduleName: CORE };
        Identifiers.pureFunction5 = { name: 'ɵɵpureFunction5', moduleName: CORE };
        Identifiers.pureFunction6 = { name: 'ɵɵpureFunction6', moduleName: CORE };
        Identifiers.pureFunction7 = { name: 'ɵɵpureFunction7', moduleName: CORE };
        Identifiers.pureFunction8 = { name: 'ɵɵpureFunction8', moduleName: CORE };
        Identifiers.pureFunctionV = { name: 'ɵɵpureFunctionV', moduleName: CORE };
        Identifiers.pipeBind1 = { name: 'ɵɵpipeBind1', moduleName: CORE };
        Identifiers.pipeBind2 = { name: 'ɵɵpipeBind2', moduleName: CORE };
        Identifiers.pipeBind3 = { name: 'ɵɵpipeBind3', moduleName: CORE };
        Identifiers.pipeBind4 = { name: 'ɵɵpipeBind4', moduleName: CORE };
        Identifiers.pipeBindV = { name: 'ɵɵpipeBindV', moduleName: CORE };
        Identifiers.i18n = { name: 'ɵɵi18n', moduleName: CORE };
        Identifiers.i18nAttributes = { name: 'ɵɵi18nAttributes', moduleName: CORE };
        Identifiers.i18nExp = { name: 'ɵɵi18nExp', moduleName: CORE };
        Identifiers.i18nStart = { name: 'ɵɵi18nStart', moduleName: CORE };
        Identifiers.i18nEnd = { name: 'ɵɵi18nEnd', moduleName: CORE };
        Identifiers.i18nApply = { name: 'ɵɵi18nApply', moduleName: CORE };
        Identifiers.i18nPostprocess = { name: 'ɵɵi18nPostprocess', moduleName: CORE };
        Identifiers.i18nLocalize = { name: 'ɵɵi18nLocalize', moduleName: CORE };
        Identifiers.load = { name: 'ɵɵload', moduleName: CORE };
        Identifiers.pipe = { name: 'ɵɵpipe', moduleName: CORE };
        Identifiers.projection = { name: 'ɵɵprojection', moduleName: CORE };
        Identifiers.projectionDef = { name: 'ɵɵprojectionDef', moduleName: CORE };
        Identifiers.reference = { name: 'ɵɵreference', moduleName: CORE };
        Identifiers.inject = { name: 'ɵɵinject', moduleName: CORE };
        Identifiers.injectAttribute = { name: 'ɵɵinjectAttribute', moduleName: CORE };
        Identifiers.directiveInject = { name: 'ɵɵdirectiveInject', moduleName: CORE };
        Identifiers.templateRefExtractor = { name: 'ɵɵtemplateRefExtractor', moduleName: CORE };
        Identifiers.resolveWindow = { name: 'ɵɵresolveWindow', moduleName: CORE };
        Identifiers.resolveDocument = { name: 'ɵɵresolveDocument', moduleName: CORE };
        Identifiers.resolveBody = { name: 'ɵɵresolveBody', moduleName: CORE };
        Identifiers.defineBase = { name: 'ɵɵdefineBase', moduleName: CORE };
        Identifiers.BaseDef = {
            name: 'ɵɵBaseDef',
            moduleName: CORE,
        };
        Identifiers.defineComponent = { name: 'ɵɵdefineComponent', moduleName: CORE };
        Identifiers.setComponentScope = { name: 'ɵɵsetComponentScope', moduleName: CORE };
        Identifiers.ComponentDefWithMeta = {
            name: 'ɵɵComponentDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.defineDirective = {
            name: 'ɵɵdefineDirective',
            moduleName: CORE,
        };
        Identifiers.DirectiveDefWithMeta = {
            name: 'ɵɵDirectiveDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.InjectorDef = {
            name: 'ɵɵInjectorDef',
            moduleName: CORE,
        };
        Identifiers.defineInjector = {
            name: 'ɵɵdefineInjector',
            moduleName: CORE,
        };
        Identifiers.NgModuleDefWithMeta = {
            name: 'ɵɵNgModuleDefWithMeta',
            moduleName: CORE,
        };
        Identifiers.defineNgModule = { name: 'ɵɵdefineNgModule', moduleName: CORE };
        Identifiers.setNgModuleScope = { name: 'ɵɵsetNgModuleScope', moduleName: CORE };
        Identifiers.PipeDefWithMeta = { name: 'ɵɵPipeDefWithMeta', moduleName: CORE };
        Identifiers.definePipe = { name: 'ɵɵdefinePipe', moduleName: CORE };
        Identifiers.queryRefresh = { name: 'ɵɵqueryRefresh', moduleName: CORE };
        Identifiers.viewQuery = { name: 'ɵɵviewQuery', moduleName: CORE };
        Identifiers.staticViewQuery = { name: 'ɵɵstaticViewQuery', moduleName: CORE };
        Identifiers.staticContentQuery = { name: 'ɵɵstaticContentQuery', moduleName: CORE };
        Identifiers.loadViewQuery = { name: 'ɵɵloadViewQuery', moduleName: CORE };
        Identifiers.contentQuery = { name: 'ɵɵcontentQuery', moduleName: CORE };
        Identifiers.loadContentQuery = { name: 'ɵɵloadContentQuery', moduleName: CORE };
        Identifiers.NgOnChangesFeature = { name: 'ɵɵNgOnChangesFeature', moduleName: CORE };
        Identifiers.InheritDefinitionFeature = { name: 'ɵɵInheritDefinitionFeature', moduleName: CORE };
        Identifiers.ProvidersFeature = { name: 'ɵɵProvidersFeature', moduleName: CORE };
        Identifiers.listener = { name: 'ɵɵlistener', moduleName: CORE };
        Identifiers.getFactoryOf = {
            name: 'ɵɵgetFactoryOf',
            moduleName: CORE,
        };
        Identifiers.getInheritedFactory = {
            name: 'ɵɵgetInheritedFactory',
            moduleName: CORE,
        };
        Identifiers.registerNgModuleType = { name: 'ɵregisterNgModuleType', moduleName: CORE };
        // sanitization-related functions
        Identifiers.sanitizeHtml = { name: 'ɵɵsanitizeHtml', moduleName: CORE };
        Identifiers.sanitizeStyle = { name: 'ɵɵsanitizeStyle', moduleName: CORE };
        Identifiers.defaultStyleSanitizer = { name: 'ɵɵdefaultStyleSanitizer', moduleName: CORE };
        Identifiers.sanitizeResourceUrl = { name: 'ɵɵsanitizeResourceUrl', moduleName: CORE };
        Identifiers.sanitizeScript = { name: 'ɵɵsanitizeScript', moduleName: CORE };
        Identifiers.sanitizeUrl = { name: 'ɵɵsanitizeUrl', moduleName: CORE };
        Identifiers.sanitizeUrlOrResourceUrl = { name: 'ɵɵsanitizeUrlOrResourceUrl', moduleName: CORE };
        return Identifiers;
    }());
    exports.Identifiers = Identifiers;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfaWRlbnRpZmllcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy9yM19pZGVudGlmaWVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7OztJQUlILElBQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQztJQUU3QjtRQUFBO1FBeU9BLENBQUM7UUF4T0MsYUFBYTtRQUNOLHNCQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ3ZCLDRCQUFnQixHQUFHLFdBQVcsQ0FBQztRQUMvQixzQkFBVSxHQUFHLGFBQWEsQ0FBQztRQUVsQyxrQkFBa0I7UUFDWCx5QkFBYSxHQUF3QixFQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFFakYsMkJBQWUsR0FBd0IsRUFBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXJGLHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUUvRSxtQkFBTyxHQUF3QixFQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRXJFLHdCQUFZLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUUvRSxzQkFBVSxHQUF3QixFQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBRTNFLDJCQUFlLEdBQXdCLEVBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUMsQ0FBQztRQUVyRixrQkFBTSxHQUF3QixFQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FB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ckUsMEJBQWMsR0FBd0IsRUFBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ25GLHVCQUFXLEdBQXdCLEVBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLENBQUM7UUFDN0Usb0NBQXdCLEdBQ0wsRUFBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO1FBQ25GLGtCQUFDO0tBQUEsQUF6T0QsSUF5T0M7SUF6T1ksa0NBQVciLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuXG5jb25zdCBDT1JFID0gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5leHBvcnQgY2xhc3MgSWRlbnRpZmllcnMge1xuICAvKiBNZXRob2RzICovXG4gIHN0YXRpYyBORVdfTUVUSE9EID0gJ2ZhY3RvcnknO1xuICBzdGF0aWMgVFJBTlNGT1JNX01FVEhPRCA9ICd0cmFuc2Zvcm0nO1xuICBzdGF0aWMgUEFUQ0hfREVQUyA9ICdwYXRjaGVkRGVwcyc7XG5cbiAgLyogSW5zdHJ1Y3Rpb25zICovXG4gIHN0YXRpYyBuYW1lc3BhY2VIVE1MOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1bmFtZXNwYWNlSFRNTCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBuYW1lc3BhY2VNYXRoTUw6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVuYW1lc3BhY2VNYXRoTUwnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbmFtZXNwYWNlU1ZHOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1bmFtZXNwYWNlU1ZHJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVlbGVtZW50JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRTdGFydDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRTdGFydCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50RW5kOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudEVuZCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50UHJvcGVydHk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVlbGVtZW50UHJvcGVydHknLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgc2VsZWN0OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c2VsZWN0JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGNvbXBvbmVudEhvc3RTeW50aGV0aWNQcm9wZXJ0eTpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVjb21wb25lbnRIb3N0U3ludGhldGljUHJvcGVydHknLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgY29tcG9uZW50SG9zdFN5bnRoZXRpY0xpc3RlbmVyOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWNvbXBvbmVudEhvc3RTeW50aGV0aWNMaXN0ZW5lcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50QXR0cmlidXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudEF0dHJpYnV0ZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50Q2xhc3NQcm9wOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudENsYXNzUHJvcCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50Q29udGFpbmVyU3RhcnQ6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudENvbnRhaW5lclN0YXJ0JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRDb250YWluZXJFbmQ6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudENvbnRhaW5lckVuZCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50U3R5bGluZzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRTdHlsaW5nJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRTdHlsaW5nTWFwOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudFN0eWxpbmdNYXAnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0eWxlUHJvcDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRTdHlsZVByb3AnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZWxlbWVudFN0eWxpbmdBcHBseTpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVlbGVtZW50U3R5bGluZ0FwcGx5JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0QXR0cnM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVlbGVtZW50SG9zdEF0dHJzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0U3R5bGluZzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRIb3N0U3R5bGluZycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbGVtZW50SG9zdFN0eWxpbmdNYXA6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1ZWxlbWVudEhvc3RTdHlsaW5nTWFwJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0U3R5bGVQcm9wOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRIb3N0U3R5bGVQcm9wJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0Q2xhc3NQcm9wOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRIb3N0Q2xhc3NQcm9wJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGVsZW1lbnRIb3N0U3R5bGluZ0FwcGx5OlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVsZW1lbnRIb3N0U3R5bGluZ0FwcGx5JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGNvbnRhaW5lckNyZWF0ZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWNvbnRhaW5lcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBuZXh0Q29udGV4dDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtW5leHRDb250ZXh0JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHRlbXBsYXRlQ3JlYXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1dGVtcGxhdGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgdGV4dDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXRleHQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgdGV4dEJpbmRpbmc6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybV0ZXh0QmluZGluZycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBiaW5kOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1YmluZCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBlbmFibGVCaW5kaW5nczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWVuYWJsZUJpbmRpbmdzJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRpc2FibGVCaW5kaW5nczogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWRpc2FibGVCaW5kaW5ncycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBhbGxvY0hvc3RWYXJzOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1YWxsb2NIb3N0VmFycycsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBnZXRDdXJyZW50Vmlldzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWdldEN1cnJlbnRWaWV3JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHJlc3RvcmVWaWV3OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cmVzdG9yZVZpZXcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uMScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjI6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uMycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uNCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uNScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uNicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjc6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uNycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvbjg6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uOCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaW50ZXJwb2xhdGlvblY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbnRlcnBvbGF0aW9uVicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBwdXJlRnVuY3Rpb24wOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cHVyZUZ1bmN0aW9uMCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uMTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXB1cmVGdW5jdGlvbjEnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjI6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwdXJlRnVuY3Rpb24yJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb24zOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cHVyZUZ1bmN0aW9uMycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXB1cmVGdW5jdGlvbjQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwdXJlRnVuY3Rpb241JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb242OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cHVyZUZ1bmN0aW9uNicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcHVyZUZ1bmN0aW9uNzogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXB1cmVGdW5jdGlvbjcnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHB1cmVGdW5jdGlvbjg6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwdXJlRnVuY3Rpb244JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwdXJlRnVuY3Rpb25WOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cHVyZUZ1bmN0aW9uVicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBwaXBlQmluZDE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwaXBlQmluZDEnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kMjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXBpcGVCaW5kMicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcGlwZUJpbmQzOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cGlwZUJpbmQzJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBwaXBlQmluZDQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwaXBlQmluZDQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHBpcGVCaW5kVjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXBpcGVCaW5kVicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpMThuOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1aTE4bicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaTE4bkF0dHJpYnV0ZXM6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpMThuQXR0cmlidXRlcycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaTE4bkV4cDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWkxOG5FeHAnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGkxOG5TdGFydDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWkxOG5TdGFydCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaTE4bkVuZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWkxOG5FbmQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIGkxOG5BcHBseTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWkxOG5BcHBseScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgaTE4blBvc3Rwcm9jZXNzOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1aTE4blBvc3Rwcm9jZXNzJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBpMThuTG9jYWxpemU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpMThuTG9jYWxpemUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgbG9hZDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWxvYWQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcGlwZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXBpcGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcHJvamVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXByb2plY3Rpb24nLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHByb2plY3Rpb25EZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVwcm9qZWN0aW9uRGVmJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIHJlZmVyZW5jZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXJlZmVyZW5jZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBpbmplY3Q6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVpbmplY3QnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgaW5qZWN0QXR0cmlidXRlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1aW5qZWN0QXR0cmlidXRlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRpcmVjdGl2ZUluamVjdDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWRpcmVjdGl2ZUluamVjdCcsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyB0ZW1wbGF0ZVJlZkV4dHJhY3RvcjpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybV0ZW1wbGF0ZVJlZkV4dHJhY3RvcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyByZXNvbHZlV2luZG93OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cmVzb2x2ZVdpbmRvdycsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgcmVzb2x2ZURvY3VtZW50OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cmVzb2x2ZURvY3VtZW50JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyByZXNvbHZlQm9keTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXJlc29sdmVCb2R5JywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGRlZmluZUJhc2U6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVkZWZpbmVCYXNlJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIEJhc2VEZWY6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1ybVCYXNlRGVmJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVDb21wb25lbnQ6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVkZWZpbmVDb21wb25lbnQnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgc2V0Q29tcG9uZW50U2NvcGU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVzZXRDb21wb25lbnRTY29wZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBDb21wb25lbnREZWZXaXRoTWV0YTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybXJtUNvbXBvbmVudERlZldpdGhNZXRhJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVEaXJlY3RpdmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1ybVkZWZpbmVEaXJlY3RpdmUnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIERpcmVjdGl2ZURlZldpdGhNZXRhOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtcm1RGlyZWN0aXZlRGVmV2l0aE1ldGEnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIEluamVjdG9yRGVmOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtcm1SW5qZWN0b3JEZWYnLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIGRlZmluZUluamVjdG9yOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge1xuICAgIG5hbWU6ICfJtcm1ZGVmaW5lSW5qZWN0b3InLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIE5nTW9kdWxlRGVmV2l0aE1ldGE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7XG4gICAgbmFtZTogJ8m1ybVOZ01vZHVsZURlZldpdGhNZXRhJyxcbiAgICBtb2R1bGVOYW1lOiBDT1JFLFxuICB9O1xuXG4gIHN0YXRpYyBkZWZpbmVOZ01vZHVsZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWRlZmluZU5nTW9kdWxlJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzZXROZ01vZHVsZVNjb3BlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c2V0TmdNb2R1bGVTY29wZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBQaXBlRGVmV2l0aE1ldGE6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVQaXBlRGVmV2l0aE1ldGEnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgZGVmaW5lUGlwZTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWRlZmluZVBpcGUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgcXVlcnlSZWZyZXNoOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1cXVlcnlSZWZyZXNoJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyB2aWV3UXVlcnk6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybV2aWV3UXVlcnknLCBtb2R1bGVOYW1lOiBDT1JFfTtcbiAgc3RhdGljIHN0YXRpY1ZpZXdRdWVyeTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXN0YXRpY1ZpZXdRdWVyeScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgc3RhdGljQ29udGVudFF1ZXJ5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c3RhdGljQ29udGVudFF1ZXJ5JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBsb2FkVmlld1F1ZXJ5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1bG9hZFZpZXdRdWVyeScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgY29udGVudFF1ZXJ5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1Y29udGVudFF1ZXJ5JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBsb2FkQ29udGVudFF1ZXJ5OiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1bG9hZENvbnRlbnRRdWVyeScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBOZ09uQ2hhbmdlc0ZlYXR1cmU6IG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVOZ09uQ2hhbmdlc0ZlYXR1cmUnLCBtb2R1bGVOYW1lOiBDT1JFfTtcblxuICBzdGF0aWMgSW5oZXJpdERlZmluaXRpb25GZWF0dXJlOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtUluaGVyaXREZWZpbml0aW9uRmVhdHVyZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBQcm92aWRlcnNGZWF0dXJlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1UHJvdmlkZXJzRmVhdHVyZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIHN0YXRpYyBsaXN0ZW5lcjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWxpc3RlbmVyJywgbW9kdWxlTmFtZTogQ09SRX07XG5cbiAgc3RhdGljIGdldEZhY3RvcnlPZjogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybXJtWdldEZhY3RvcnlPZicsXG4gICAgbW9kdWxlTmFtZTogQ09SRSxcbiAgfTtcblxuICBzdGF0aWMgZ2V0SW5oZXJpdGVkRmFjdG9yeTogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtcbiAgICBuYW1lOiAnybXJtWdldEluaGVyaXRlZEZhY3RvcnknLFxuICAgIG1vZHVsZU5hbWU6IENPUkUsXG4gIH07XG5cbiAgc3RhdGljIHJlZ2lzdGVyTmdNb2R1bGVUeXBlOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybVyZWdpc3Rlck5nTW9kdWxlVHlwZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuXG4gIC8vIHNhbml0aXphdGlvbi1yZWxhdGVkIGZ1bmN0aW9uc1xuICBzdGF0aWMgc2FuaXRpemVIdG1sOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c2FuaXRpemVIdG1sJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVN0eWxlOiBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c2FuaXRpemVTdHlsZScsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgZGVmYXVsdFN0eWxlU2FuaXRpemVyOlxuICAgICAgby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtWRlZmF1bHRTdHlsZVNhbml0aXplcicsIG1vZHVsZU5hbWU6IENPUkV9O1xuICBzdGF0aWMgc2FuaXRpemVSZXNvdXJjZVVybDpcbiAgICAgIG8uRXh0ZXJuYWxSZWZlcmVuY2UgPSB7bmFtZTogJ8m1ybVzYW5pdGl6ZVJlc291cmNlVXJsJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVNjcmlwdDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXNhbml0aXplU2NyaXB0JywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVVybDogby5FeHRlcm5hbFJlZmVyZW5jZSA9IHtuYW1lOiAnybXJtXNhbml0aXplVXJsJywgbW9kdWxlTmFtZTogQ09SRX07XG4gIHN0YXRpYyBzYW5pdGl6ZVVybE9yUmVzb3VyY2VVcmw6XG4gICAgICBvLkV4dGVybmFsUmVmZXJlbmNlID0ge25hbWU6ICfJtcm1c2FuaXRpemVVcmxPclJlc291cmNlVXJsJywgbW9kdWxlTmFtZTogQ09SRX07XG59XG4iXX0=