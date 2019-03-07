/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName } from '../compile_metadata';
import { EmitterVisitorContext } from './abstract_emitter';
import { AbstractJsEmitterVisitor } from './abstract_js_emitter';
import * as o from './output_ast';
/**
 * A helper class to manage the evaluation of JIT generated code.
 */
export class JitEvaluator {
    /**
     *
     * @param sourceUrl The URL of the generated code.
     * @param statements An array of Angular statement AST nodes to be evaluated.
     * @param reflector A helper used when converting the statements to executable code.
     * @param createSourceMaps If true then create a source-map for the generated code and include it
     * inline as a source-map comment.
     * @returns A map of all the variables in the generated code.
     */
    evaluateStatements(sourceUrl, statements, reflector, createSourceMaps) {
        const converter = new JitEmitterVisitor(reflector);
        const ctx = EmitterVisitorContext.createRoot();
        converter.visitAllStatements(statements, ctx);
        converter.createReturnStmt(ctx);
        return this.evaluateCode(sourceUrl, ctx, converter.getArgs(), createSourceMaps);
    }
    /**
     * Evaluate a piece of JIT generated code.
     * @param sourceUrl The URL of this generated code.
     * @param ctx A context object that contains an AST of the code to be evaluated.
     * @param vars A map containing the names and values of variables that the evaluated code might
     * reference.
     * @param createSourceMap If true then create a source-map for the generated code and include it
     * inline as a source-map comment.
     * @returns The result of evaluating the code.
     */
    evaluateCode(sourceUrl, ctx, vars, createSourceMap) {
        let fnBody = `${ctx.toSource()}\n//# sourceURL=${sourceUrl}`;
        const fnArgNames = [];
        const fnArgValues = [];
        for (const argName in vars) {
            fnArgValues.push(vars[argName]);
            fnArgNames.push(argName);
        }
        if (createSourceMap) {
            // using `new Function(...)` generates a header, 1 line of no arguments, 2 lines otherwise
            // E.g. ```
            // function anonymous(a,b,c
            // /**/) { ... }```
            // We don't want to hard code this fact, so we auto detect it via an empty function first.
            const emptyFn = new Function(...fnArgNames.concat('return null;')).toString();
            const headerLines = emptyFn.slice(0, emptyFn.indexOf('return null;')).split('\n').length - 1;
            fnBody += `\n${ctx.toSourceMapGenerator(sourceUrl, headerLines).toJsComment()}`;
        }
        const fn = new Function(...fnArgNames.concat(fnBody));
        return this.executeFunction(fn, fnArgValues);
    }
    /**
     * Execute a JIT generated function by calling it.
     *
     * This method can be overridden in tests to capture the functions that are generated
     * by this `JitEvaluator` class.
     *
     * @param fn A function to execute.
     * @param args The arguments to pass to the function being executed.
     * @returns The return value of the executed function.
     */
    executeFunction(fn, args) { return fn(...args); }
}
/**
 * An Angular AST visitor that converts AST nodes into executable JavaScript code.
 */
export class JitEmitterVisitor extends AbstractJsEmitterVisitor {
    constructor(reflector) {
        super();
        this.reflector = reflector;
        this._evalArgNames = [];
        this._evalArgValues = [];
        this._evalExportedVars = [];
    }
    createReturnStmt(ctx) {
        const stmt = new o.ReturnStatement(new o.LiteralMapExpr(this._evalExportedVars.map(resultVar => new o.LiteralMapEntry(resultVar, o.variable(resultVar), false))));
        stmt.visitStatement(this, ctx);
    }
    getArgs() {
        const result = {};
        for (let i = 0; i < this._evalArgNames.length; i++) {
            result[this._evalArgNames[i]] = this._evalArgValues[i];
        }
        return result;
    }
    visitExternalExpr(ast, ctx) {
        this._emitReferenceToExternal(ast, this.reflector.resolveExternalReference(ast.value), ctx);
        return null;
    }
    visitWrappedNodeExpr(ast, ctx) {
        this._emitReferenceToExternal(ast, ast.node, ctx);
        return null;
    }
    visitDeclareVarStmt(stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return super.visitDeclareVarStmt(stmt, ctx);
    }
    visitDeclareFunctionStmt(stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return super.visitDeclareFunctionStmt(stmt, ctx);
    }
    visitDeclareClassStmt(stmt, ctx) {
        if (stmt.hasModifier(o.StmtModifier.Exported)) {
            this._evalExportedVars.push(stmt.name);
        }
        return super.visitDeclareClassStmt(stmt, ctx);
    }
    _emitReferenceToExternal(ast, value, ctx) {
        let id = this._evalArgValues.indexOf(value);
        if (id === -1) {
            id = this._evalArgValues.length;
            this._evalArgValues.push(value);
            const name = identifierName({ reference: value }) || 'val';
            this._evalArgNames.push(`jit_${name}_${id}`);
        }
        ctx.print(ast, this._evalArgNames[id]);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0X2ppdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9vdXRwdXQvb3V0cHV0X2ppdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFHbkQsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDL0QsT0FBTyxLQUFLLENBQUMsTUFBTSxjQUFjLENBQUM7QUFFbEM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sWUFBWTtJQUN2Qjs7Ozs7Ozs7T0FRRztJQUNILGtCQUFrQixDQUNkLFNBQWlCLEVBQUUsVUFBeUIsRUFBRSxTQUEyQixFQUN6RSxnQkFBeUI7UUFDM0IsTUFBTSxTQUFTLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuRCxNQUFNLEdBQUcsR0FBRyxxQkFBcUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMvQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzlDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxTQUFTLENBQUMsT0FBTyxFQUFFLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQ7Ozs7Ozs7OztPQVNHO0lBQ0gsWUFBWSxDQUNSLFNBQWlCLEVBQUUsR0FBMEIsRUFBRSxJQUEwQixFQUN6RSxlQUF3QjtRQUMxQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsbUJBQW1CLFNBQVMsRUFBRSxDQUFDO1FBQzdELE1BQU0sVUFB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QUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUNiLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQztZQUNoQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNoQyxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsRUFBQyxTQUFTLEVBQUUsS0FBSyxFQUFDLENBQUMsSUFBSSxLQUFLLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztTQUM5QztRQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7aWRlbnRpZmllck5hbWV9IGZyb20gJy4uL2NvbXBpbGVfbWV0YWRhdGEnO1xuaW1wb3J0IHtDb21waWxlUmVmbGVjdG9yfSBmcm9tICcuLi9jb21waWxlX3JlZmxlY3Rvcic7XG5cbmltcG9ydCB7RW1pdHRlclZpc2l0b3JDb250ZXh0fSBmcm9tICcuL2Fic3RyYWN0X2VtaXR0ZXInO1xuaW1wb3J0IHtBYnN0cmFjdEpzRW1pdHRlclZpc2l0b3J9IGZyb20gJy4vYWJzdHJhY3RfanNfZW1pdHRlcic7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4vb3V0cHV0X2FzdCc7XG5cbi8qKlxuICogQSBoZWxwZXIgY2xhc3MgdG8gbWFuYWdlIHRoZSBldmFsdWF0aW9uIG9mIEpJVCBnZW5lcmF0ZWQgY29kZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEppdEV2YWx1YXRvciB7XG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gc291cmNlVXJsIFRoZSBVUkwgb2YgdGhlIGdlbmVyYXRlZCBjb2RlLlxuICAgKiBAcGFyYW0gc3RhdGVtZW50cyBBbiBhcnJheSBvZiBBbmd1bGFyIHN0YXRlbWVudCBBU1Qgbm9kZXMgdG8gYmUgZXZhbHVhdGVkLlxuICAgKiBAcGFyYW0gcmVmbGVjdG9yIEEgaGVscGVyIHVzZWQgd2hlbiBjb252ZXJ0aW5nIHRoZSBzdGF0ZW1lbnRzIHRvIGV4ZWN1dGFibGUgY29kZS5cbiAgICogQHBhcmFtIGNyZWF0ZVNvdXJjZU1hcHMgSWYgdHJ1ZSB0aGVuIGNyZWF0ZSBhIHNvdXJjZS1tYXAgZm9yIHRoZSBnZW5lcmF0ZWQgY29kZSBhbmQgaW5jbHVkZSBpdFxuICAgKiBpbmxpbmUgYXMgYSBzb3VyY2UtbWFwIGNvbW1lbnQuXG4gICAqIEByZXR1cm5zIEEgbWFwIG9mIGFsbCB0aGUgdmFyaWFibGVzIGluIHRoZSBnZW5lcmF0ZWQgY29kZS5cbiAgICovXG4gIGV2YWx1YXRlU3RhdGVtZW50cyhcbiAgICAgIHNvdXJjZVVybDogc3RyaW5nLCBzdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdLCByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IsXG4gICAgICBjcmVhdGVTb3VyY2VNYXBzOiBib29sZWFuKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGNvbnN0IGNvbnZlcnRlciA9IG5ldyBKaXRFbWl0dGVyVmlzaXRvcihyZWZsZWN0b3IpO1xuICAgIGNvbnN0IGN0eCA9IEVtaXR0ZXJWaXNpdG9yQ29udGV4dC5jcmVhdGVSb290KCk7XG4gICAgY29udmVydGVyLnZpc2l0QWxsU3RhdGVtZW50cyhzdGF0ZW1lbnRzLCBjdHgpO1xuICAgIGNvbnZlcnRlci5jcmVhdGVSZXR1cm5TdG10KGN0eCk7XG4gICAgcmV0dXJuIHRoaXMuZXZhbHVhdGVDb2RlKHNvdXJjZVVybCwgY3R4LCBjb252ZXJ0ZXIuZ2V0QXJncygpLCBjcmVhdGVTb3VyY2VNYXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFdmFsdWF0ZSBhIHBpZWNlIG9mIEpJVCBnZW5lcmF0ZWQgY29kZS5cbiAgICogQHBhcmFtIHNvdXJjZVVybCBUaGUgVVJMIG9mIHRoaXMgZ2VuZXJhdGVkIGNvZGUuXG4gICAqIEBwYXJhbSBjdHggQSBjb250ZXh0IG9iamVjdCB0aGF0IGNvbnRhaW5zIGFuIEFTVCBvZiB0aGUgY29kZSB0byBiZSBldmFsdWF0ZWQuXG4gICAqIEBwYXJhbSB2YXJzIEEgbWFwIGNvbnRhaW5pbmcgdGhlIG5hbWVzIGFuZCB2YWx1ZXMgb2YgdmFyaWFibGVzIHRoYXQgdGhlIGV2YWx1YXRlZCBjb2RlIG1pZ2h0XG4gICAqIHJlZmVyZW5jZS5cbiAgICogQHBhcmFtIGNyZWF0ZVNvdXJjZU1hcCBJZiB0cnVlIHRoZW4gY3JlYXRlIGEgc291cmNlLW1hcCBmb3IgdGhlIGdlbmVyYXRlZCBjb2RlIGFuZCBpbmNsdWRlIGl0XG4gICAqIGlubGluZSBhcyBhIHNvdXJjZS1tYXAgY29tbWVudC5cbiAgICogQHJldHVybnMgVGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIHRoZSBjb2RlLlxuICAgKi9cbiAgZXZhbHVhdGVDb2RlKFxuICAgICAgc291cmNlVXJsOiBzdHJpbmcsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0LCB2YXJzOiB7W2tleTogc3RyaW5nXTogYW55fSxcbiAgICAgIGNyZWF0ZVNvdXJjZU1hcDogYm9vbGVhbik6IGFueSB7XG4gICAgbGV0IGZuQm9keSA9IGAke2N0eC50b1NvdXJjZSgpfVxcbi8vIyBzb3VyY2VVUkw9JHtzb3VyY2VVcmx9YDtcbiAgICBjb25zdCBmbkFyZ05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGZuQXJnVmFsdWVzOiBhbnlbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgYXJnTmFtZSBpbiB2YXJzKSB7XG4gICAgICBmbkFyZ1ZhbHVlcy5wdXNoKHZhcnNbYXJnTmFtZV0pO1xuICAgICAgZm5BcmdOYW1lcy5wdXNoKGFyZ05hbWUpO1xuICAgIH1cbiAgICBpZiAoY3JlYXRlU291cmNlTWFwKSB7XG4gICAgICAvLyB1c2luZyBgbmV3IEZ1bmN0aW9uKC4uLilgIGdlbmVyYXRlcyBhIGhlYWRlciwgMSBsaW5lIG9mIG5vIGFyZ3VtZW50cywgMiBsaW5lcyBvdGhlcndpc2VcbiAgICAgIC8vIEUuZy4gYGBgXG4gICAgICAvLyBmdW5jdGlvbiBhbm9ueW1vdXMoYSxiLGNcbiAgICAgIC8vIC8qKi8pIHsgLi4uIH1gYGBcbiAgICAgIC8vIFdlIGRvbid0IHdhbnQgdG8gaGFyZCBjb2RlIHRoaXMgZmFjdCwgc28gd2UgYXV0byBkZXRlY3QgaXQgdmlhIGFuIGVtcHR5IGZ1bmN0aW9uIGZpcnN0LlxuICAgICAgY29uc3QgZW1wdHlGbiA9IG5ldyBGdW5jdGlvbiguLi5mbkFyZ05hbWVzLmNvbmNhdCgncmV0dXJuIG51bGw7JykpLnRvU3RyaW5nKCk7XG4gICAgICBjb25zdCBoZWFkZXJMaW5lcyA9IGVtcHR5Rm4uc2xpY2UoMCwgZW1wdHlGbi5pbmRleE9mKCdyZXR1cm4gbnVsbDsnKSkuc3BsaXQoJ1xcbicpLmxlbmd0aCAtIDE7XG4gICAgICBmbkJvZHkgKz0gYFxcbiR7Y3R4LnRvU291cmNlTWFwR2VuZXJhdG9yKHNvdXJjZVVybCwgaGVhZGVyTGluZXMpLnRvSnNDb21tZW50KCl9YDtcbiAgICB9XG4gICAgY29uc3QgZm4gPSBuZXcgRnVuY3Rpb24oLi4uZm5BcmdOYW1lcy5jb25jYXQoZm5Cb2R5KSk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZUZ1bmN0aW9uKGZuLCBmbkFyZ1ZhbHVlcyk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSBhIEpJVCBnZW5lcmF0ZWQgZnVuY3Rpb24gYnkgY2FsbGluZyBpdC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgY2FuIGJlIG92ZXJyaWRkZW4gaW4gdGVzdHMgdG8gY2FwdHVyZSB0aGUgZnVuY3Rpb25zIHRoYXQgYXJlIGdlbmVyYXRlZFxuICAgKiBieSB0aGlzIGBKaXRFdmFsdWF0b3JgIGNsYXNzLlxuICAgKlxuICAgKiBAcGFyYW0gZm4gQSBmdW5jdGlvbiB0byBleGVjdXRlLlxuICAgKiBAcGFyYW0gYXJncyBUaGUgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIGZ1bmN0aW9uIGJlaW5nIGV4ZWN1dGVkLlxuICAgKiBAcmV0dXJucyBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBleGVjdXRlZCBmdW5jdGlvbi5cbiAgICovXG4gIGV4ZWN1dGVGdW5jdGlvbihmbjogRnVuY3Rpb24sIGFyZ3M6IGFueVtdKSB7IHJldHVybiBmbiguLi5hcmdzKTsgfVxufVxuXG4vKipcbiAqIEFuIEFuZ3VsYXIgQVNUIHZpc2l0b3IgdGhhdCBjb252ZXJ0cyBBU1Qgbm9kZXMgaW50byBleGVjdXRhYmxlIEphdmFTY3JpcHQgY29kZS5cbiAqL1xuZXhwb3J0IGNsYXNzIEppdEVtaXR0ZXJWaXNpdG9yIGV4dGVuZHMgQWJzdHJhY3RKc0VtaXR0ZXJWaXNpdG9yIHtcbiAgcHJpdmF0ZSBfZXZhbEFyZ05hbWVzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIF9ldmFsQXJnVmFsdWVzOiBhbnlbXSA9IFtdO1xuICBwcml2YXRlIF9ldmFsRXhwb3J0ZWRWYXJzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7IHN1cGVyKCk7IH1cblxuICBjcmVhdGVSZXR1cm5TdG10KGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KSB7XG4gICAgY29uc3Qgc3RtdCA9IG5ldyBvLlJldHVyblN0YXRlbWVudChuZXcgby5MaXRlcmFsTWFwRXhwcih0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLm1hcChcbiAgICAgICAgcmVzdWx0VmFyID0+IG5ldyBvLkxpdGVyYWxNYXBFbnRyeShyZXN1bHRWYXIsIG8udmFyaWFibGUocmVzdWx0VmFyKSwgZmFsc2UpKSkpO1xuICAgIHN0bXQudmlzaXRTdGF0ZW1lbnQodGhpcywgY3R4KTtcbiAgfVxuXG4gIGdldEFyZ3MoKToge1trZXk6IHN0cmluZ106IGFueX0ge1xuICAgIGNvbnN0IHJlc3VsdDoge1trZXk6IHN0cmluZ106IGFueX0gPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2V2YWxBcmdOYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0W3RoaXMuX2V2YWxBcmdOYW1lc1tpXV0gPSB0aGlzLl9ldmFsQXJnVmFsdWVzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmlzaXRFeHRlcm5hbEV4cHIoYXN0OiBvLkV4dGVybmFsRXhwciwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOiBhbnkge1xuICAgIHRoaXMuX2VtaXRSZWZlcmVuY2VUb0V4dGVybmFsKGFzdCwgdGhpcy5yZWZsZWN0b3IucmVzb2x2ZUV4dGVybmFsUmVmZXJlbmNlKGFzdC52YWx1ZSksIGN0eCk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IG8uV3JhcHBlZE5vZGVFeHByPGFueT4sIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICB0aGlzLl9lbWl0UmVmZXJlbmNlVG9FeHRlcm5hbChhc3QsIGFzdC5ub2RlLCBjdHgpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlVmFyU3RtdChzdG10OiBvLkRlY2xhcmVWYXJTdG10LCBjdHg6IEVtaXR0ZXJWaXNpdG9yQ29udGV4dCk6IGFueSB7XG4gICAgaWYgKHN0bXQuaGFzTW9kaWZpZXIoby5TdG10TW9kaWZpZXIuRXhwb3J0ZWQpKSB7XG4gICAgICB0aGlzLl9ldmFsRXhwb3J0ZWRWYXJzLnB1c2goc3RtdC5uYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1cGVyLnZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdCwgY3R4KTtcbiAgfVxuXG4gIHZpc2l0RGVjbGFyZUZ1bmN0aW9uU3RtdChzdG10OiBvLkRlY2xhcmVGdW5jdGlvblN0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIHRoaXMuX2V2YWxFeHBvcnRlZFZhcnMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gc3VwZXIudmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQsIGN0eCk7XG4gIH1cblxuICB2aXNpdERlY2xhcmVDbGFzc1N0bXQoc3RtdDogby5DbGFzc1N0bXQsIGN0eDogRW1pdHRlclZpc2l0b3JDb250ZXh0KTogYW55IHtcbiAgICBpZiAoc3RtdC5oYXNNb2RpZmllcihvLlN0bXRNb2RpZmllci5FeHBvcnRlZCkpIHtcbiAgICAgIHRoaXMuX2V2YWxFeHBvcnRlZFZhcnMucHVzaChzdG10Lm5hbWUpO1xuICAgIH1cbiAgICByZXR1cm4gc3VwZXIudmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQsIGN0eCk7XG4gIH1cblxuICBwcml2YXRlIF9lbWl0UmVmZXJlbmNlVG9FeHRlcm5hbChhc3Q6IG8uRXhwcmVzc2lvbiwgdmFsdWU6IGFueSwgY3R4OiBFbWl0dGVyVmlzaXRvckNvbnRleHQpOlxuICAgICAgdm9pZCB7XG4gICAgbGV0IGlkID0gdGhpcy5fZXZhbEFyZ1ZhbHVlcy5pbmRleE9mKHZhbHVlKTtcbiAgICBpZiAoaWQgPT09IC0xKSB7XG4gICAgICBpZCA9IHRoaXMuX2V2YWxBcmdWYWx1ZXMubGVuZ3RoO1xuICAgICAgdGhpcy5fZXZhbEFyZ1ZhbHVlcy5wdXNoKHZhbHVlKTtcbiAgICAgIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZSh7cmVmZXJlbmNlOiB2YWx1ZX0pIHx8ICd2YWwnO1xuICAgICAgdGhpcy5fZXZhbEFyZ05hbWVzLnB1c2goYGppdF8ke25hbWV9XyR7aWR9YCk7XG4gICAgfVxuICAgIGN0eC5wcmludChhc3QsIHRoaXMuX2V2YWxBcmdOYW1lc1tpZF0pO1xuICB9XG59XG4iXX0=