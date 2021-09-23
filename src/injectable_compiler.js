/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
        define("@angular/compiler/src/injectable_compiler", ["require", "exports", "@angular/compiler/src/identifiers", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/output/value_util", "@angular/compiler/src/parse_util", "@angular/compiler/src/render3/r3_identifiers"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InjectableCompiler = void 0;
    var identifiers_1 = require("@angular/compiler/src/identifiers");
    var o = require("@angular/compiler/src/output/output_ast");
    var value_util_1 = require("@angular/compiler/src/output/value_util");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    function mapEntry(key, value) {
        return { key: key, value: value, quoted: false };
    }
    var InjectableCompiler = /** @class */ (function () {
        function InjectableCompiler(reflector, alwaysGenerateDef) {
            this.reflector = reflector;
            this.alwaysGenerateDef = alwaysGenerateDef;
            this.tokenInjector = reflector.resolveExternalReference(identifiers_1.Identifiers.Injector);
        }
        InjectableCompiler.prototype.depsArray = function (deps, ctx) {
            var _this = this;
            return deps.map(function (dep) {
                var token = dep;
                var args = [token];
                var flags = 0 /* Default */;
                if (Array.isArray(dep)) {
                    for (var i = 0; i < dep.length; i++) {
                        var v = dep[i];
                        if (v) {
                            if (v.ngMetadataName === 'Optional') {
                                flags |= 8 /* Optional */;
                            }
                            else if (v.ngMetadataName === 'SkipSelf') {
                                flags |= 4 /* SkipSelf */;
                            }
                            else if (v.ngMetadataName === 'Self') {
                                flags |= 2 /* Self */;
                            }
                            else if (v.ngMetadataName === 'Inject') {
                                token = v.token;
                            }
                            else {
                                token = v;
                            }
                        }
                    }
                }
                var tokenExpr;
                if (typeof token === 'string') {
                    tokenExpr = o.literal(token);
                }
                else if (token === _this.tokenInjector) {
                    tokenExpr = o.importExpr(identifiers_1.Identifiers.INJECTOR);
                }
                else {
                    tokenExpr = ctx.importExpr(token);
                }
                if (flags !== 0 /* Default */) {
                    args = [tokenExpr, o.literal(flags)];
                }
                else {
                    args = [tokenExpr];
                }
                return o.importExpr(identifiers_1.Identifiers.inject).callFn(args);
            });
        };
        InjectableCompiler.prototype.factoryFor = function (injectable, ctx) {
            var retValue;
            if (injectable.useExisting) {
                retValue = o.importExpr(identifiers_1.Identifiers.inject).callFn([ctx.importExpr(injectable.useExisting)]);
            }
            else if (injectable.useFactory) {
                var deps = injectable.deps || [];
                if (deps.length > 0) {
                    retValue = ctx.importExpr(injectable.useFactory).callFn(this.depsArray(deps, ctx));
                }
                else {
                    return ctx.importExpr(injectable.useFactory);
                }
            }
            else if (injectable.useValue) {
                retValue = (0, value_util_1.convertValueToOutputAst)(ctx, injectable.useValue);
            }
            else {
                var clazz = injectable.useClass || injectable.symbol;
                var depArgs = this.depsArray(this.reflector.parameters(clazz), ctx);
                retValue = new o.InstantiateExpr(ctx.importExpr(clazz), depArgs);
            }
            return o.fn([], [new o.ReturnStatement(retValue)], undefined, undefined, injectable.symbol.name + '_Factory');
        };
        InjectableCompiler.prototype.injectableDef = function (injectable, ctx) {
            var providedIn = o.NULL_EXPR;
            if (injectable.providedIn !== undefined) {
                if (injectable.providedIn === null) {
                    providedIn = o.NULL_EXPR;
                }
                else if (typeof injectable.providedIn === 'string') {
                    providedIn = o.literal(injectable.providedIn);
                }
                else {
                    providedIn = ctx.importExpr(injectable.providedIn);
                }
            }
            var def = [
                mapEntry('factory', this.factoryFor(injectable, ctx)),
                mapEntry('token', ctx.importExpr(injectable.type.reference)),
                mapEntry('providedIn', providedIn),
            ];
            return o.importExpr(r3_identifiers_1.Identifiers.ɵɵdefineInjectable).callFn([o.literalMap(def)], undefined, true);
        };
        InjectableCompiler.prototype.compile = function (injectable, ctx) {
            if (this.alwaysGenerateDef || injectable.providedIn !== undefined) {
                var className = (0, parse_util_1.identifierName)(injectable.type);
                var clazz = new o.ClassStmt(className, null, [
                    new o.ClassField('ɵprov', o.INFERRED_TYPE, [o.StmtModifier.Static], this.injectableDef(injectable, ctx)),
                ], [], new o.ClassMethod(null, [], []), []);
                ctx.statements.push(clazz);
            }
        };
        return InjectableCompiler;
    }());
    exports.InjectableCompiler = InjectableCompiler;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pbmplY3RhYmxlX2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQU9ILGlFQUEwQztJQUMxQywyREFBeUM7SUFDekMsc0VBQTREO0lBQzVELCtEQUE0QztJQUM1QywrRUFBMkQ7SUFTM0QsU0FBUyxRQUFRLENBQUMsR0FBVyxFQUFFLEtBQW1CO1FBQ2hELE9BQU8sRUFBQyxHQUFHLEtBQUEsRUFBRSxLQUFLLE9BQUEsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFDLENBQUM7SUFDckMsQ0FBQztJQUVEO1FBRUUsNEJBQW9CLFNBQTJCLEVBQVUsaUJBQTBCO1lBQS9ELGNBQVMsR0FBVCxTQUFTLENBQWtCO1lBQVUsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFTO1lBQ2pGLElBQUksQ0FBQyxhQUFhLEdBQUcsU0FBUyxDQUFDLHdCQUF3QixDQUFDLHlCQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUVPLHNDQUFTLEdBQWpCLFVBQWtCLElBQVcsRUFBRSxHQUFrQjtZQUFqRCxpQkF3Q0M7WUF2Q0MsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRztnQkFDakIsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDO2dCQUNoQixJQUFJLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNuQixJQUFJLEtBQUssa0JBQW1DLENBQUM7Z0JBQzdDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDdEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7d0JBQ25DLElBQU0sQ0FBQyxHQUFHLEdBQUcs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QyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDMUYsQ0FBQztRQUVELG9DQUFPLEdBQVAsVUFBUSxVQUFxQyxFQUFFLEdBQWtCO1lBQy9ELElBQUksSUFBSSxDQUFDLGlCQUFpQixJQUFJLFVBQVUsQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFO2dCQUNqRSxJQUFNLFNBQVMsR0FBRyxJQUFBLDJCQUFjLEVBQUMsVUFBVSxDQUFDLElBQUksQ0FBRSxDQUFDO2dCQUNuRCxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQ3pCLFNBQVMsRUFBRSxJQUFJLEVBQ2Y7b0JBQ0UsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUNaLE9BQU8sRUFBRSxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFDakQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7aUJBQ3pDLEVBQ0QsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM3QyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUM1QjtRQUNILENBQUM7UUFDSCx5QkFBQztJQUFELENBQUMsQUF4R0QsSUF3R0M7SUF4R1ksZ0RBQWtCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7U3RhdGljU3ltYm9sfSBmcm9tICcuL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZUluamVjdGFibGVNZXRhZGF0YX0gZnJvbSAnLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi9jb21waWxlX3JlZmxlY3Rvcic7XG5pbXBvcnQge091dHB1dENvbnRleHR9IGZyb20gJy4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQge0luamVjdEZsYWdzfSBmcm9tICcuL2NvcmUnO1xuaW1wb3J0IHtJZGVudGlmaWVyc30gZnJvbSAnLi9pZGVudGlmaWVycyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjb252ZXJ0VmFsdWVUb091dHB1dEFzdH0gZnJvbSAnLi9vdXRwdXQvdmFsdWVfdXRpbCc7XG5pbXBvcnQge2lkZW50aWZpZXJOYW1lfSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi9yZW5kZXIzL3IzX2lkZW50aWZpZXJzJztcblxudHlwZSBNYXBFbnRyeSA9IHtcbiAga2V5OiBzdHJpbmcsXG4gIHF1b3RlZDogYm9vbGVhbixcbiAgdmFsdWU6IG8uRXhwcmVzc2lvblxufTtcbnR5cGUgTWFwTGl0ZXJhbCA9IE1hcEVudHJ5W107XG5cbmZ1bmN0aW9uIG1hcEVudHJ5KGtleTogc3RyaW5nLCB2YWx1ZTogby5FeHByZXNzaW9uKTogTWFwRW50cnkge1xuICByZXR1cm4ge2tleSwgdmFsdWUsIHF1b3RlZDogZmFsc2V9O1xufVxuXG5leHBvcnQgY2xhc3MgSW5qZWN0YWJsZUNvbXBpbGVyIHtcbiAgcHJpdmF0ZSB0b2tlbkluamVjdG9yOiBTdGF0aWNTeW1ib2w7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLCBwcml2YXRlIGFsd2F5c0dlbmVyYXRlRGVmOiBib29sZWFuKSB7XG4gICAgdGhpcy50b2tlbkluamVjdG9yID0gcmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShJZGVudGlmaWVycy5JbmplY3Rvcik7XG4gIH1cblxuICBwcml2YXRlIGRlcHNBcnJheShkZXBzOiBhbnlbXSwgY3R4OiBPdXRwdXRDb250ZXh0KTogby5FeHByZXNzaW9uW10ge1xuICAgIHJldHVybiBkZXBzLm1hcChkZXAgPT4ge1xuICAgICAgbGV0IHRva2VuID0gZGVwO1xuICAgICAgbGV0IGFyZ3MgPSBbdG9rZW5dO1xuICAgICAgbGV0IGZsYWdzOiBJbmplY3RGbGFncyA9IEluamVjdEZsYWdzLkRlZmF1bHQ7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkZXApKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGVwLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgdiA9IGRlcFtpXTtcbiAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgaWYgKHYubmdNZXRhZGF0YU5hbWUgPT09ICdPcHRpb25hbCcpIHtcbiAgICAgICAgICAgICAgZmxhZ3MgfD0gSW5qZWN0RmxhZ3MuT3B0aW9uYWw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHYubmdNZXRhZGF0YU5hbWUgPT09ICdTa2lwU2VsZicpIHtcbiAgICAgICAgICAgICAgZmxhZ3MgfD0gSW5qZWN0RmxhZ3MuU2tpcFNlbGY7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHYubmdNZXRhZGF0YU5hbWUgPT09ICdTZWxmJykge1xuICAgICAgICAgICAgICBmbGFncyB8PSBJbmplY3RGbGFncy5TZWxmO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2Lm5nTWV0YWRhdGFOYW1lID09PSAnSW5qZWN0Jykge1xuICAgICAgICAgICAgICB0b2tlbiA9IHYudG9rZW47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0b2tlbiA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldCB0b2tlbkV4cHI6IG8uRXhwcmVzc2lvbjtcbiAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRva2VuRXhwciA9IG8ubGl0ZXJhbCh0b2tlbik7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuID09PSB0aGlzLnRva2VuSW5qZWN0b3IpIHtcbiAgICAgICAgdG9rZW5FeHByID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLklOSkVDVE9SKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRva2VuRXhwciA9IGN0eC5pbXBvcnRFeHByKHRva2VuKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGZsYWdzICE9PSBJbmplY3RGbGFncy5EZWZhdWx0KSB7XG4gICAgICAgIGFyZ3MgPSBbdG9rZW5FeHByLCBvLmxpdGVyYWwoZmxhZ3MpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFyZ3MgPSBbdG9rZW5FeHByXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5qZWN0KS5jYWxsRm4oYXJncyk7XG4gICAgfSk7XG4gIH1cblxuICBmYWN0b3J5Rm9yKGluamVjdGFibGU6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGEsIGN0eDogT3V0cHV0Q29udGV4dCk6IG8uRXhwcmVzc2lvbiB7XG4gICAgbGV0IHJldFZhbHVlOiBvLkV4cHJlc3Npb247XG4gICAgaWYgKGluamVjdGFibGUudXNlRXhpc3RpbmcpIHtcbiAgICAgIHJldFZhbHVlID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLmluamVjdCkuY2FsbEZuKFtjdHguaW1wb3J0RXhwcihpbmplY3RhYmxlLnVzZUV4aXN0aW5nKV0pO1xuICAgIH0gZWxzZSBpZiAoaW5qZWN0YWJsZS51c2VGYWN0b3J5KSB7XG4gICAgICBjb25zdCBkZXBzID0gaW5qZWN0YWJsZS5kZXBzIHx8IFtdO1xuICAgICAgaWYgKGRlcHMubGVuZ3RoID4gMCkge1xuICAgICAgICByZXRWYWx1ZSA9IGN0eC5pbXBvcnRFeHByKGluamVjdGFibGUudXNlRmFjdG9yeSkuY2FsbEZuKHRoaXMuZGVwc0FycmF5KGRlcHMsIGN0eCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGN0eC5pbXBvcnRFeHByKGluamVjdGFibGUudXNlRmFjdG9yeSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpbmplY3RhYmxlLnVzZVZhbHVlKSB7XG4gICAgICByZXRWYWx1ZSA9IGNvbnZlcnRWYWx1ZVRvT3V0cHV0QXN0KGN0eCwgaW5qZWN0YWJsZS51c2VWYWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNsYXp6ID0gaW5qZWN0YWJsZS51c2VDbGFzcyB8fCBpbmplY3RhYmxlLnN5bWJvbDtcbiAgICAgIGNvbnN0IGRlcEFyZ3MgPSB0aGlzLmRlcHNBcnJheSh0aGlzLnJlZmxlY3Rvci5wYXJhbWV0ZXJzKGNsYXp6KSwgY3R4KTtcbiAgICAgIHJldFZhbHVlID0gbmV3IG8uSW5zdGFudGlhdGVFeHByKGN0eC5pbXBvcnRFeHByKGNsYXp6KSwgZGVwQXJncyk7XG4gICAgfVxuICAgIHJldHVybiBvLmZuKFxuICAgICAgICBbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChyZXRWYWx1ZSldLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgaW5qZWN0YWJsZS5zeW1ib2wubmFtZSArICdfRmFjdG9yeScpO1xuICB9XG5cbiAgaW5qZWN0YWJsZURlZihpbmplY3RhYmxlOiBDb21waWxlSW5qZWN0YWJsZU1ldGFkYXRhLCBjdHg6IE91dHB1dENvbnRleHQpOiBvLkV4cHJlc3Npb24ge1xuICAgIGxldCBwcm92aWRlZEluOiBvLkV4cHJlc3Npb24gPSBvLk5VTExfRVhQUjtcbiAgICBpZiAoaW5qZWN0YWJsZS5wcm92aWRlZEluICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChpbmplY3RhYmxlLnByb3ZpZGVkSW4gPT09IG51bGwpIHtcbiAgICAgICAgcHJvdmlkZWRJbiA9IG8uTlVMTF9FWFBSO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaW5qZWN0YWJsZS5wcm92aWRlZEluID09PSAnc3RyaW5nJykge1xuICAgICAgICBwcm92aWRlZEluID0gby5saXRlcmFsKGluamVjdGFibGUucHJvdmlkZWRJbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm92aWRlZEluID0gY3R4LmltcG9ydEV4cHIoaW5qZWN0YWJsZS5wcm92aWRlZEluKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgZGVmOiBNYXBMaXRlcmFsID0gW1xuICAgICAgbWFwRW50cnkoJ2ZhY3RvcnknLCB0aGlzLmZhY3RvcnlGb3IoaW5qZWN0YWJsZSwgY3R4KSksXG4gICAgICBtYXBFbnRyeSgndG9rZW4nLCBjdHguaW1wb3J0RXhwcihpbmplY3RhYmxlLnR5cGUucmVmZXJlbmNlKSksXG4gICAgICBtYXBFbnRyeSgncHJvdmlkZWRJbicsIHByb3ZpZGVkSW4pLFxuICAgIF07XG4gICAgcmV0dXJuIG8uaW1wb3J0RXhwcihSMy7Jtcm1ZGVmaW5lSW5qZWN0YWJsZSkuY2FsbEZuKFtvLmxpdGVyYWxNYXAoZGVmKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIH1cblxuICBjb21waWxlKGluamVjdGFibGU6IENvbXBpbGVJbmplY3RhYmxlTWV0YWRhdGEsIGN0eDogT3V0cHV0Q29udGV4dCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmFsd2F5c0dlbmVyYXRlRGVmIHx8IGluamVjdGFibGUucHJvdmlkZWRJbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBjbGFzc05hbWUgPSBpZGVudGlmaWVyTmFtZShpbmplY3RhYmxlLnR5cGUpITtcbiAgICAgIGNvbnN0IGNsYXp6ID0gbmV3IG8uQ2xhc3NTdG10KFxuICAgICAgICAgIGNsYXNzTmFtZSwgbnVsbCxcbiAgICAgICAgICBbXG4gICAgICAgICAgICBuZXcgby5DbGFzc0ZpZWxkKFxuICAgICAgICAgICAgICAgICfJtXByb3YnLCBvLklORkVSUkVEX1RZUEUsIFtvLlN0bXRNb2RpZmllci5TdGF0aWNdLFxuICAgICAgICAgICAgICAgIHRoaXMuaW5qZWN0YWJsZURlZihpbmplY3RhYmxlLCBjdHgpKSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIFtdLCBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLCBbXSk7XG4gICAgICBjdHguc3RhdGVtZW50cy5wdXNoKGNsYXp6KTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==