/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as tslib_1 from "tslib";
import { identifierName } from '../compile_metadata';
import { EmitterVisitorContext } from './abstract_emitter';
import { AbstractJsEmitterVisitor } from './abstract_js_emitter';
import * as o from './output_ast';
function evalExpression(sourceUrl, ctx, vars, createSourceMap) {
    var fnBody = ctx.toSource() + "\n//# sourceURL=" + sourceUrl;
    var fnArgNames = [];
    var fnArgValues = [];
    for (var argName in vars) {
        fnArgNames.push(argName);
        fnArgValues.push(vars[argName]);
    }
    if (createSourceMap) {
        // using `new Function(...)` generates a header, 1 line of no arguments, 2 lines otherwise
        // E.g. ```
        // function anonymous(a,b,c
        // /**/) { ... }```
        // We don't want to hard code this fact, so we auto detect it via an empty function first.
        var emptyFn = new (Function.bind.apply(Function, tslib_1.__spread([void 0], fnArgNames.concat('return null;'))))().toString();
        var headerLines = emptyFn.slice(0, emptyFn.indexOf('return null;')).split('\n').length - 1;
        fnBody += "\n" + ctx.toSourceMapGenerator(sourceUrl, headerLines).toJsComment();
    }
    return new (Function.bind.apply(Function, tslib_1.__spread([void 0], fnArgNames.concat(fnBody))))().apply(void 0, tslib_1.__spread(fnArgValues));
}
export function jitStatements(sourceUrl, statements, reflector, createSourceMaps) {
    var converter = new JitEmitterVisitor(reflector);
    var ctx = EmitterVisitorContext.createRoot();
    converter.visitAllStatements(statements, ctx);
    converter.createReturnStmt(ctx);
    return evalExpression(sourceUrl, ctx, converter.getArgs(), createSourceMaps);
}
var JitEmitterVisitor = /** @class */ (function (_super) {
    tslib_1.__extends(JitEmitterVisitor, _super);
    function JitEmitterVisitor(reflector) {
        var _this = _super.call(this) || this;
        _this.reflector = reflector;
        _this._evalArgNames = [];
        _this._evalArgValues = [];
        _this._evalExportedVars = [];
        return _this;
    }
    JitEmitterVisitor.prototype.createReturnStmt = function (ctx) {
        var stmt = new o.ReturnStatement(new o.LiteralMapExpr(this._evalExportedVars.map(function (resultVar) { return new o.LiteralMapEntry(resultVar, o.variable(resultVar), false); })));
        stmt.visitStatement(this, ctx);
    };
    JitEmitterVisitor.prototype.getArgs = function () {
        var result = {};
        for (var i = 0; i < this._evalArgNames.length; i++) {
            result[this._evalArgNames[i]] = this._evalArgValues[i];
        }
        return result;
    };
    JitEmitterVisitor.prototype.visitExternalExpr = function (ast, ctx) {
        var value = this.reflector.resolveExternalReference(ast.value);
        var id = this._evalArgValues.indexOf(value);
        if (id === -1) {
            id = this._evalArgValues.length;
            this._evalArgValues.push(value);
            var name_1 = identifierName({ reference: value }) || 'val';
            this._evalArgNames.push("jit_" + name_1 + "_" + id);
        }
        ctx.print(ast, this._evalArgNames[id]);
        return null;
    };
    JitEmitterVisitor.prototype.visitDeclareVarStmt = function (stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return _super.prototype.visitDeclareVarStmt.call(this, stmt, ctx);
    };
    JitEmitterVisitor.prototype.visitDeclareFunctionStmt = function (stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return _super.prototype.visitDeclareFunctionStmt.call(this, stmt, ctx);
    };
    JitEmitterVisitor.prototype.visitDeclareClassStmt = function (stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return _super.prototype.visitDeclareClassStmt.call(this, stmt, ctx);
    };
    return JitEmitterVisitor;
}(AbstractJsEmitterVisitor));
export { JitEmitterVisitor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ppdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2ppdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7O0FBRUgsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBR25ELE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQy9ELE9BQU8sS0FBSyxDQUFDLE1BQU0sY0FBYyxDQUFDO0FBRWxDLHdCQUNJLFNBQWlCLEVBQUUsR0FBMEIsRUFBRSxJQUEwQixFQUN6RSxlQUF3QjtJQUMxQixJQUFJLE1BQU0sR0FBTSxHQUFHLENBQUMsUUFBUSxFQUFFLHdCQUFtQixTQUFXLENBQUM7SUFDN0QsSUFBTSxVQUFVLEdBQWEsRUFBRSxDQUFDO0lBQ2hDLElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztJQUM5QixLQUFLLElBQU0sT0FBTyxJQUFJLElBQUksRUFBRTtRQUMxQixVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3pCLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDakM7SUFDRCxJQUFJLGVBQWUsRUFBRTtRQUNuQiwwRkFBMEY7UUFDMUYsV0FBVztRQUNYLDJCQUEyQjtRQUMzQixtQkFBbUI7UUFDbkIsMEZBQTBGO1FBQzFGLElBQU0sT0FBTyxHQUFHLEtBQUksUUFBUSxZQUFSLFFBQVEsNkJBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBRSxRQUFRLEVBQUUsQ0FBQztRQUM5RSxJQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsT0FB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QXdCLEdBc0Q5RCIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcblxuaW1wb3J0IHtFbWl0dGVyVmlzaXRvckNvbnRleHR9IGZyb20gJy4vYWJzdHJhY3RfZW1pdHRlcic7XG5pbXBvcnQge0Fic3RyYWN0SnNFbWl0dGVyVmlzaXRvcn0gZnJvbSAnLi9hYnN0cmFjdF9qc19lbWl0dGVyJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXRfYXN0JztcblxuZnVuY3Rpb24gZXZhbEV4cHJlc3Npb24oXG4gICAgc291cmNlVXJsOiBzdHJpbmcsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LCB2YXJzOiB7W2tleTogc3RyaW5nXTogYW55fSxcbiAgICBjcmVhdGVTb3VyY2VNYXA6IGJvb2xlYW4pOiBhbnkge1xuICBsZXQgZm5Cb2R5ID0gYCR7Y3R4LnRvU291cmNlKCl9XFxuLy8jIHNvdXJjZVVSTD0ke3NvdXJjZVVybH1gO1xuICBjb25zdCBmbkFyZ05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBjb25zdCBmbkFyZ1ZhbHVlczogYW55W10gPSBbXTtcbiAgZm9yIChjb25zdCBhcmdOYW1lIGluIHZhcnMpIHtcbiAgICBmbkFyZ05hbWVzLnB1c2goYXJnTmFtZSk7XG4gICAgZm5BcmdWYWx1ZXMucHVzaCh2YXJzW2FyZ05hbWVdKTtcbiAgfVxuICBpZiAoY3JlYXRlU291cmNlTWFwKSB7XG4gICAgLy8gdXNpbmcgYG5ldyBGdW5jdGlvbiguLi4pYCBnZW5lcmF0ZXMgYSBoZWFkZXIsIDEgbGluZSBvZiBubyBhcmd1bWVudHMsIDIgbGluZXMgb3RoZXJ3aXNlXG4gICAgLy8gRS5nLiBgYGBcbiAgICAvLyBmdW5jdGlvbiBhbm9ueW1vdXMoYSxiLGNcbiAgICAvLyAvKiovKSB7IC4uLiB9YGBgXG4gICAgLy8gV2UgZG9uJ3Qgd2FudCB0byBoYXJkIGNvZGUgdGhpcyBmYWN0LCBzbyB3ZSBhdXRvIGRldGVjdCBpdCB2aWEgYW4gZW1wdHkgZnVuY3Rpb24gZmlyc3QuXG4gICAgY29uc3QgZW1wdHlGbiA9IG5ldyBGdW5jdGlvbiguLi5mbkFyZ05hbWVzLmNvbmNhdCgncmV0dXJuIG51bGw7JykpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgaGVhZGVyTGluZXMgPSBlbXB0eUZuLnNsaWNlKDAsIGVtcHR5Rm4uaW5kZXhPZigncmV0dXJuIG51bGw7JykpLnNwbGl0KCdcXG4nKS5sZW5ndGggLSAxO1xuICAgIGZuQm9keSArPSBgXFxuJHtjdHgudG9Tb3VyY2VNYXBHZW5lcmF0b3Ioc291cmNlVXJsLCBoZWFkZXJMaW5lcykudG9Kc0NvbW1lbnQoKX1gO1xuICB9XG4gIHJldHVybiBuZXcgRnVuY3Rpb24oLi4uZm5BcmdOYW1lcy5jb25jYXQoZm5Cb2R5KSkoLi4uZm5BcmdWYWx1ZXMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaml0U3RhdGVtZW50cyhcbiAgICBzb3VyY2VVcmw6IHN0cmluZywgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yLFxuICAgIGNyZWF0ZVNvdXJjZU1hcHM6IGJvb2xlYW4pOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gIGNvbnN0IGNvbnZlcnRlciA9IG5ldyBKaXRFbWl0dGVyVmlzaXRvcihyZWZsZWN0b3IpO1xuICBjb25zdCBjdHggPSBFbWl0dGVyVmlzaXRvckNvbnRleHQuY3JlYXRlUm9vdCgpO1xuICBjb252ZXJ0ZXIudmlzaXRBbGxTdGF0ZW1lbnRzKHN0YXRlbWVudHMsIGN0eCk7XG4gIGNvbnZlcnRlci5jcmVhdGVSZXR1cm5TdG10KGN0eCk7XG4gIHJldHVybiBldmFsRXhwcmVzc2lvbihzb3VyY2VVcmwsIGN0eCwgY29udmVydGVyLmdldEFyZ3MoKSwgY3JlYXRlU291cmNlTWFwcyk7XG59XG5cbmV4cG9ydCBjbGFzcyBKaXRFbWl0dGVyVmlzaXRvciBleHRlbmRzIEFic3RyYWN0SnNFbWl0dGVyVmlzaXRvciB7XG4gIHByaXZhdGUgX2V2YWxBcmdOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgcHJpdmF0ZSBfZXZhbEFyZ1ZhbHVlczogYW55W10gPSBbXTtcbiAgcHJpdmF0ZSBfZXZhbEV4cG9ydGVkVmFyczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlZmxlY3RvcjogQ29tcGlsZVJlZmxlY3RvcikgeyBzdXBlcigpOyB9XG5cbiAgY3JlYXRlUmV0dXJuU3RtdChjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCkge1xuICAgIGNvbnN0IHN0bXQgPSBuZXcgby5SZXR1cm5TdGF0ZW1lbnQobmV3IG8uTGl0ZXJhbE1hcEV4cHIodGhpcy5fZXZhbEV4cG9ydGVkVmFycy5tYXAoXG4gICAgICAgIHJlc3VsdFZhciA9PiBuZXcgby5MaXRlcmFsTWFwRW50cnkocmVzdWx0VmFyLCBvLnZhcmlhYmxlKHJlc3VsdFZhciksIGZhbHNlKSkpKTtcbiAgICBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGN0eCk7XG4gIH1cblxuICBnZXRBcmdzKCk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgICBjb25zdCByZXN1bHQ6IHtba2V5OiBzdHJpbmddOiBhbnl9ID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ldmFsQXJnTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdFt0aGlzLl9ldmFsQXJnTmFtZXNbaV1dID0gdGhpcy5fZXZhbEFyZ1ZhbHVlc1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogby5FeHRlcm5hbEV4cHIsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMucmVmbGVjdG9yLnJlc29sdmVFeHRlcm5hbFJlZmVyZW5jZShhc3QudmFsdWUpO1xuICAgIGxldCBpZCA9IHRoaXMuX2V2YWxBcmdWYWx1ZXMuaW5kZXhPZih2YWx1ZSk7XG4gICAgaWYgKGlkID09PSAtMSkge1xuICAgICAgaWQgPSB0aGlzLl9ldmFsQXJnVmFsdWVzLmxlbmd0aDtcbiAgICAgIHRoaXMuX2V2YWxBcmdWYWx1ZXMucHVzaCh2YWx1ZSk7XG4gICAgICBjb25zdCBuYW1lID0gaWRlbnRpZmllck5hbWUoe3JlZmVyZW5jZTogdmFsdWV9KSB8fCAndmFsJztcbiAgICAgIHRoaXMuX2V2YWxBcmdOYW1lcy5wdXNoKGBqaXRfJHtuYW1lfV8ke2lkfWApO1xuICAgIH1cbiAgICBjdHgucHJpbnQoYXN0LCB0aGlzLl9ldmFsQXJnTmFtZXNbaWRdKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogby5EZWNsYXJlVmFyU3RtdCwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIGlmIChzdG10Lmhhc01vZGlmaWVyKG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkKSkge1xuICAgICAgdGhpcy5fZXZhbEV4cG9ydGVkVmFycy5wdXNoKHN0bXQubmFtZSk7XG4gICAgfVxuICAgIHJldHVybiBzdXBlci52aXNpdERlY2xhcmVWYXJTdG10KHN0bXQsIGN0eCk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVGdW5jdGlvblN0bXQoc3RtdDogby5EZWNsYXJlRnVuY3Rpb25TdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICB0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10LCBjdHgpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IG8uQ2xhc3NTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICB0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0RGVjbGFyZUNsYXNzU3RtdChzdG10LCBjdHgpO1xuICB9XG59XG4iXX0=