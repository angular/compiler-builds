(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/render3/partial/factory", ["require", "exports", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.compileDeclareFactoryFunction = void 0;
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var o = require("@angular/compiler/src/output/output_ast");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_1 = require("@angular/compiler/src/render3/view/util");
    function compileDeclareFactoryFunction(meta) {
        var definitionMap = new util_1.DefinitionMap();
        definitionMap.set('version', o.literal('12.0.0-next.7+40.sha-4b8bbe2'));
        definitionMap.set('ngImport', o.importExpr(r3_identifiers_1.Identifiers.core));
        definitionMap.set('type', meta.internalType);
        definitionMap.set('deps', compileDependencies(meta.deps));
        definitionMap.set('target', o.importExpr(r3_identifiers_1.Identifiers.FactoryTarget).prop(r3_factory_1.FactoryTarget[meta.target]));
        return {
            expression: o.importExpr(r3_identifiers_1.Identifiers.declareFactory).callFn([definitionMap.toLiteralMap()]),
            statements: [],
            type: r3_factory_1.createFactoryType(meta),
        };
    }
    exports.compileDeclareFactoryFunction = compileDeclareFactoryFunction;
    function compileDependencies(deps) {
        if (deps === 'invalid') {
            return o.literal('invalid');
        }
        else if (deps === null) {
            return o.literal(null);
        }
        else {
            return o.literalArr(deps.map(compileDependency));
        }
    }
    function compileDependency(dep) {
        var depMeta = new util_1.DefinitionMap();
        depMeta.set('token', dep.token);
        if (dep.attributeNameType !== null) {
            depMeta.set('attribute', o.literal(true));
        }
        if (dep.host) {
            depMeta.set('host', o.literal(true));
        }
        if (dep.optional) {
            depMeta.set('optional', o.literal(true));
        }
        if (dep.self) {
            depMeta.set('self', o.literal(true));
        }
        if (dep.skipSelf) {
            depMeta.set('skipSelf', o.literal(true));
        }
        return depMeta.toLiteralMap();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7SUFBQTs7Ozs7O09BTUc7SUFDSCwyREFBNkM7SUFDN0MsdUVBQXdHO0lBQ3hHLCtFQUFvRDtJQUVwRCxnRUFBMkM7SUFJM0MsU0FBZ0IsNkJBQTZCLENBQUMsSUFBdUI7UUFDbkUsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUE0QixDQUFDO1FBQ3BFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQzdELGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3JELGFBQWEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM3QyxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMxRCxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLDRCQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU3RixPQUFPO1lBQ0wsVUFBVSxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxjQUFjLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztZQUNsRixVQUFVLEVBQUUsRUFBRTtZQUNkLElBQUksRUFBRSw4QkFBaUIsQ0FBQyxJQUFJLENBQUM7U0FDOUIsQ0FBQztJQUNKLENBQUM7SUFiRCxzRUFhQztJQUVELFNBQVMsbUJBQW1CLENBQUMsSUFBMkM7UUFFdEUsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO1lBQ3RCLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM3QjthQUFNLElBQUksSUFBSSxLQUFLLElBQUksRUFBRTtZQUN4QixPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEI7YUFBTTtZQUNMLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztTQUNsRDtJQUNILENBQUM7SUFFRCxTQUFTLGlCQUFpQixDQUFDLEdBQXlCO1FBQ2xELElBQU0sT0FBTyxHQUFHLElBQUksb0JBQWEsRUFBK0IsQ0FBQztRQUNqRSxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEMsSUFBSSxHQUFHLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFO1lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMzQztRQUNELElBQUksR0FBRyxDQUFDLElBQUksRUFBRTtZQUNaLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUN0QztRQUNELElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDMUM7UUFDRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUU7WUFDWixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDdEM7UUFDRCxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7WUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzFDO1FBQ0QsT0FBTyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDaEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi8uLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge2NyZWF0ZUZhY3RvcnlUeXBlLCBGYWN0b3J5VGFyZ2V0LCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNGYWN0b3J5TWV0YWRhdGF9IGZyb20gJy4uL3IzX2ZhY3RvcnknO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtSM0NvbXBpbGVkRXhwcmVzc2lvbn0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQge0RlZmluaXRpb25NYXB9IGZyb20gJy4uL3ZpZXcvdXRpbCc7XG5cbmltcG9ydCB7UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0RlY2xhcmVGYWN0b3J5TWV0YWRhdGF9IGZyb20gJy4vYXBpJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJlRmFjdG9yeUZ1bmN0aW9uKG1ldGE6IFIzRmFjdG9yeU1ldGFkYXRhKTogUjNDb21waWxlZEV4cHJlc3Npb24ge1xuICBjb25zdCBkZWZpbml0aW9uTWFwID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhPigpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndmVyc2lvbicsIG8ubGl0ZXJhbCgnMC4wLjAtUExBQ0VIT0xERVInKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCduZ0ltcG9ydCcsIG8uaW1wb3J0RXhwcihSMy5jb3JlKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0eXBlJywgbWV0YS5pbnRlcm5hbFR5cGUpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnZGVwcycsIGNvbXBpbGVEZXBlbmRlbmNpZXMobWV0YS5kZXBzKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCd0YXJnZXQnLCBvLmltcG9ydEV4cHIoUjMuRmFjdG9yeVRhcmdldCkucHJvcChGYWN0b3J5VGFyZ2V0W21ldGEudGFyZ2V0XSkpO1xuXG4gIHJldHVybiB7XG4gICAgZXhwcmVzc2lvbjogby5pbXBvcnRFeHByKFIzLmRlY2xhcmVGYWN0b3J5KS5jYWxsRm4oW2RlZmluaXRpb25NYXAudG9MaXRlcmFsTWFwKCldKSxcbiAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICB0eXBlOiBjcmVhdGVGYWN0b3J5VHlwZShtZXRhKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY29tcGlsZURlcGVuZGVuY2llcyhkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfCdpbnZhbGlkJ3xudWxsKTogby5MaXRlcmFsRXhwcnxcbiAgICBvLkxpdGVyYWxBcnJheUV4cHIge1xuICBpZiAoZGVwcyA9PT0gJ2ludmFsaWQnKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbCgnaW52YWxpZCcpO1xuICB9IGVsc2UgaWYgKGRlcHMgPT09IG51bGwpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKG51bGwpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBvLmxpdGVyYWxBcnIoZGVwcy5tYXAoY29tcGlsZURlcGVuZGVuY3kpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb21waWxlRGVwZW5kZW5jeShkZXA6IFIzRGVwZW5kZW5jeU1ldGFkYXRhKTogby5MaXRlcmFsTWFwRXhwciB7XG4gIGNvbnN0IGRlcE1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEZXBlbmRlbmN5TWV0YWRhdGE+KCk7XG4gIGRlcE1ldGEuc2V0KCd0b2tlbicsIGRlcC50b2tlbik7XG4gIGlmIChkZXAuYXR0cmlidXRlTmFtZVR5cGUgIT09IG51bGwpIHtcbiAgICBkZXBNZXRhLnNldCgnYXR0cmlidXRlJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAoZGVwLmhvc3QpIHtcbiAgICBkZXBNZXRhLnNldCgnaG9zdCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5vcHRpb25hbCkge1xuICAgIGRlcE1ldGEuc2V0KCdvcHRpb25hbCcsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5zZWxmKSB7XG4gICAgZGVwTWV0YS5zZXQoJ3NlbGYnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChkZXAuc2tpcFNlbGYpIHtcbiAgICBkZXBNZXRhLnNldCgnc2tpcFNlbGYnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIHJldHVybiBkZXBNZXRhLnRvTGl0ZXJhbE1hcCgpO1xufVxuIl19