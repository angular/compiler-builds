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
        define("@angular/compiler/src/output/js_emitter", ["require", "exports", "tslib", "@angular/compiler/src/output/abstract_emitter", "@angular/compiler/src/output/abstract_js_emitter", "@angular/compiler/src/output/output_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var abstract_emitter_1 = require("@angular/compiler/src/output/abstract_emitter");
    var abstract_js_emitter_1 = require("@angular/compiler/src/output/abstract_js_emitter");
    var o = require("@angular/compiler/src/output/output_ast");
    var JavaScriptEmitter = /** @class */ (function () {
        function JavaScriptEmitter() {
        }
        JavaScriptEmitter.prototype.emitStatements = function (genFilePath, stmts, preamble) {
            if (preamble === void 0) { preamble = ''; }
            var converter = new JsEmitterVisitor();
            var ctx = abstract_emitter_1.EmitterVisitorContext.createRoot();
            converter.visitAllStatements(stmts, ctx);
            var preambleLines = preamble ? preamble.split('\n') : [];
            converter.importsWithPrefixes.forEach(function (prefix, importedModuleName) {
                // Note: can't write the real word for import as it screws up system.js auto detection...
                preambleLines.push("var " + prefix + " = req" +
                    ("uire('" + importedModuleName + "');"));
            });
            var sm = ctx.toSourceMapGenerator(genFilePath, preambleLines.length).toJsComment();
            var lines = tslib_1.__spread(preambleLines, [ctx.toSource(), sm]);
            if (sm) {
                // always add a newline at the end, as some tools have bugs without it.
                lines.push('');
            }
            return lines.join('\n');
        };
        return JavaScriptEmitter;
    }());
    exports.JavaScriptEmitter = JavaScriptEmitter;
    var JsEmitterVisitor = /** @class */ (function (_super) {
        tslib_1.__extends(JsEmitterVisitor, _super);
        function JsEmitterVisitor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.importsWithPrefixes = new Map();
            return _this;
        }
        JsEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) {
            var _a = ast.value, name = _a.name, moduleName = _a.moduleName;
            if (moduleName) {
                var prefix = this.importsWithPrefixes.get(moduleName);
                if (prefix == null) {
                    prefix = "i" + this.importsWithPrefixes.size;
                    this.importsWithPrefixes.set(moduleName, prefix);
                }
                ctx.print(ast, prefix + ".");
            }
            ctx.print(ast, name);
            return null;
        };
        JsEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
            _super.prototype.visitDeclareVarStmt.call(this, stmt, ctx);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.println(stmt, exportVar(stmt.name));
            }
            return null;
        };
        JsEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
            _super.prototype.visitDeclareFunctionStmt.call(this, stmt, ctx);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.println(stmt, exportVar(stmt.name));
            }
            return null;
        };
        JsEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
            _super.prototype.visitDeclareClassStmt.call(this, stmt, ctx);
            if (stmt.hasModifier(o.StmtModifier.Exported)) {
                ctx.println(stmt, exportVar(stmt.name));
            }
            return null;
        };
        return JsEmitterVisitor;
    }(abstract_js_emitter_1.AbstractJsEmitterVisitor));
    function exportVar(varName) {
        return "Object.defineProperty(exports, '" + varName + "', { get: function() { return " + varName + "; }});";
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNfZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvanNfZW1pdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFNSCxrRkFBd0U7SUFDeEUsd0ZBQStEO0lBQy9ELDJEQUFrQztJQUVsQztRQUFBO1FBc0JBLENBQUM7UUFyQkMsMENBQWMsR0FBZCxVQUFlLFdBQW1CLEVBQUUsS0FBb0IsRUFBRSxRQUFxQjtZQUFyQix5QkFBQSxFQUFBLGFBQXFCO1lBQzdFLElBQU0sU0FBUyxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztZQUN6QyxJQUFNLEdBQUcsR0FBRyx3Q0FBcUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMvQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRXpDLElBQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzNELFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsVUFBQyxNQUFNLEVBQUUsa0JBQWtCO2dCQUMvRCx5RkFBeUY7Z0JBQ3pGLGFBQWEsQ0FBQyxJQUFJLENBQ2QsU0FBTyxNQUFNLFdBQVE7cUJBQ3JCLFdBQVMsa0JBQWtCLFFBQUssQ0FBQSxDQUFDLENBQUM7WUFDeEMsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyRixJQUFNLEtBQUssb0JBQU8sYUFBYSxHQUFFLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLEVBQUMsQ0FBQztZQUNyRCxJQUFJLEVBQUUsRUFBRTtnQkFDTix1RUFBdUU7Z0JBQ3ZFLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDaEI7WUFDRCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUNILHdCQUFDO0lBQUQsQ0FBQyxBQXRCRCxJQXNCQztJQXRCWSw4Q0FBaUI7SUF3QjlCO1FBQStCLDRDQUF3QjtRQUF2RDtZQUFBLHFFQXFDQztZQXBDQyx5QkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQzs7UUFvQ2xELENBQUM7UUFsQ0MsNENBQWlCLEdBQWpCLFVBQWtCLEdBQW1CLEVBQUUsR0FBMEI7WUFDekQsSUFBQSxjQUE4QixFQUE3QixjQUFJLEVBQUUsMEJBQVUsQ0FBYztZQUNyQyxJQUFJLFVBQVUsRUFBRTtnQkFDZCxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUU7b0JBQ2xCLE1BQU0sR0FBRyxNQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFNLENBQUM7b0JBQzdDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUNsRDtnQkFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBSyxNQUFNLE1BQUcsQ0FBQyxDQUFDO2FBQzlCO1lBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBTSxDQUFDLENBQUM7WUFDdkIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsOENBQW1CLEdBQW5CLFVBQW9CLElBQXNCLEVBQUUsR0FBMEI7WUFDcEUsaUJBQU0sbUJBQW1CLFlBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3JDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUM3QyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDekM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxtREFBd0IsR0FBeEIsVUFBeUIsSUFBMkIsRUFBRSxHQUEwQjtZQUM5RSxpQkFBTSx3QkFBd0IsWUFBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDMUMsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQzdDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzthQUN6QztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELGdEQUFxQixHQUFyQixVQUFzQixJQUFpQixFQUFFLEdBQTBCO1lBQ2pFLGlCQUFNLHFCQUFxQixZQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN2QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDN0MsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQ3pDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0gsdUJBQUM7SUFBRCxDQUFDLEFBckNELENBQStCLDhDQUF3QixHQXFDdEQ7SUFFRCxTQUFTLFNBQVMsQ0FBQyxPQUFlO1FBQ2hDLE9BQU8scUNBQW1DLE9BQU8sc0NBQWlDLE9BQU8sV0FBUSxDQUFDO0lBQ3BHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cblxuaW1wb3J0IHtTdGF0aWNTeW1ib2x9IGZyb20gJy4uL2FvdC9zdGF0aWNfc3ltYm9sJztcbmltcG9ydCB7Q29tcGlsZUlkZW50aWZpZXJNZXRhZGF0YX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5cbmltcG9ydCB7RW1pdHRlclZpc2l0b3JDb250ZXh0LCBPdXRwdXRFbWl0dGVyfSBmcm9tICcuL2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0IHtBYnN0cmFjdEpzRW1pdHRlclZpc2l0b3J9IGZyb20gJy4vYWJzdHJhY3RfanNfZW1pdHRlcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5cbmV4cG9ydCBjbGFzcyBKYXZhU2NyaXB0RW1pdHRlciBpbXBsZW1lbnRzIE91dHB1dEVtaXR0ZXIge1xuICBlbWl0U3RhdGVtZW50cyhnZW5GaWxlUGF0aDogc3RyaW5nLCBzdG10czogby5TdGF0ZW1lbnRbXSwgcHJlYW1ibGU6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgICBjb25zdCBjb252ZXJ0ZXIgPSBuZXcgSnNFbWl0dGVyVmlzaXRvcigpO1xuICAgIGNvbnN0IGN0eCA9IEVtaXR0ZXJWaXNpdG9yQ29udGV4dC5jcmVhdGVSb290KCk7XG4gICAgY29udmVydGVyLnZpc2l0QWxsU3RhdGVtZW50cyhzdG10cywgY3R4KTtcblxuICAgIGNvbnN0IHByZWFtYmxlTGluZXMgPSBwcmVhbWJsZSA/IHByZWFtYmxlLnNwbGl0KCdcXG4nKSA6IFtdO1xuICAgIGNvbnZlcnRlci5pbXBvcnRzV2l0aFByZWZpeGVzLmZvckVhY2goKHByZWZpeCwgaW1wb3J0ZWRNb2R1bGVOYW1lKSA9PiB7XG4gICAgICAvLyBOb3RlOiBjYW4ndCB3cml0ZSB0aGUgcmVhbCB3b3JkIGZvciBpbXBvcnQgYXMgaXQgc2NyZXdzIHVwIHN5c3RlbS5qcyBhdXRvIGRldGVjdGlvbi4uLlxuICAgICAgcHJlYW1ibGVMaW5lcy5wdXNoKFxuICAgICAgICAgIGB2YXIgJHtwcmVmaXh9ID0gcmVxYCArXG4gICAgICAgICAgYHVpcmUoJyR7aW1wb3J0ZWRNb2R1bGVOYW1lfScpO2ApO1xuICAgIH0pO1xuXG4gICAgY29uc3Qgc20gPSBjdHgudG9Tb3VyY2VNYXBHZW5lcmF0b3IoZ2VuRmlsZVBhdGgsIHByZWFtYmxlTGluZXMubGVuZ3RoKS50b0pzQ29tbWVudCgpO1xuICAgIGNvbnN0IGxpbmVzID0gWy4uLnByZWFtYmxlTGluZXMsIGN0eC50b1NvdXJjZSgpLCBzbV07XG4gICAgaWYgKHNtKSB7XG4gICAgICAvLyBhbHdheXMgYWRkIGEgbmV3bGluZSBhdCB0aGUgZW5kLCBhcyBzb21lIHRvb2xzIGhhdmUgYnVncyB3aXRob3V0IGl0LlxuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgfVxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxufVxuXG5jbGFzcyBKc0VtaXR0ZXJWaXNpdG9yIGV4dGVuZHMgQWJzdHJhY3RKc0VtaXR0ZXJWaXNpdG9yIHtcbiAgaW1wb3J0c1dpdGhQcmVmaXhlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBvLkV4dGVybmFsRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGNvbnN0IHtuYW1lLCBtb2R1bGVOYW1lfSA9IGFzdC52YWx1ZTtcbiAgICBpZiAobW9kdWxlTmFtZSkge1xuICAgICAgbGV0IHByZWZpeCA9IHRoaXMuaW1wb3J0c1dpdGhQcmVmaXhlcy5nZXQobW9kdWxlTmFtZSk7XG4gICAgICBpZiAocHJlZml4ID09IG51bGwpIHtcbiAgICAgICAgcHJlZml4ID0gYGkke3RoaXMuaW1wb3J0c1dpdGhQcmVmaXhlcy5zaXplfWA7XG4gICAgICAgIHRoaXMuaW1wb3J0c1dpdGhQcmVmaXhlcy5zZXQobW9kdWxlTmFtZSwgcHJlZml4KTtcbiAgICAgIH1cbiAgICAgIGN0eC5wcmludChhc3QsIGAke3ByZWZpeH0uYCk7XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIG5hbWUgISk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgc3VwZXIudmlzaXREZWNsYXJlVmFyU3RtdChzdG10LCBjdHgpO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LnByaW50bG4oc3RtdCwgZXhwb3J0VmFyKHN0bXQubmFtZSkpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgc3VwZXIudmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQsIGN0eCk7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICBjdHgucHJpbnRsbihzdG10LCBleHBvcnRWYXIoc3RtdC5uYW1lKSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10OiBvLkNsYXNzU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIHN1cGVyLnZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10LCBjdHgpO1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgY3R4LnByaW50bG4oc3RtdCwgZXhwb3J0VmFyKHN0bXQubmFtZSkpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBleHBvcnRWYXIodmFyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJyR7dmFyTmFtZX0nLCB7IGdldDogZnVuY3Rpb24oKSB7IHJldHVybiAke3Zhck5hbWV9OyB9fSk7YDtcbn1cbiJdfQ==