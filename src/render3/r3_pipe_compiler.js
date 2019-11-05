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
        define("@angular/compiler/src/render3/r3_pipe_compiler", ["require", "exports", "tslib", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/util");
    function compilePipeFromMetadata(metadata) {
        var definitionMapValues = [];
        // e.g. `name: 'myPipe'`
        definitionMapValues.push({ key: 'name', value: o.literal(metadata.pipeName), quoted: false });
        // e.g. `type: MyPipe`
        definitionMapValues.push({ key: 'type', value: metadata.type, quoted: false });
        // e.g. `pure: true`
        definitionMapValues.push({ key: 'pure', value: o.literal(metadata.pure), quoted: false });
        var expression = o.importExpr(r3_identifiers_1.Identifiers.definePipe).callFn([o.literalMap(definitionMapValues)]);
        var type = new o.ExpressionType(o.importExpr(r3_identifiers_1.Identifiers.PipeDefWithMeta, [
            util_2.typeWithParameters(metadata.type, metadata.typeArgumentCount),
            new o.ExpressionType(new o.LiteralExpr(metadata.pipeName)),
        ]));
        return { expression: expression, type: type };
    }
    exports.compilePipeFromMetadata = compilePipeFromMetadata;
    /**
     * Write a pipe definition to the output context.
     */
    function compilePipeFromRender2(outputCtx, pipe, reflector) {
        var name = compile_metadata_1.identifierName(pipe.type);
        if (!name) {
            return util_1.error("Cannot resolve the name of " + pipe.type);
        }
        var metadata = {
            name: name,
            pipeName: pipe.name,
            type: outputCtx.importExpr(pipe.type.reference),
            typeArgumentCount: 0,
            deps: r3_factory_1.dependenciesFromGlobalMetadata(pipe.type, outputCtx, reflector),
            pure: pipe.pure,
        };
        var res = compilePipeFromMetadata(metadata);
        var factoryRes = r3_factory_1.compileFactoryFunction(tslib_1.__assign(tslib_1.__assign({}, metadata), { injectFn: r3_identifiers_1.Identifiers.directiveInject, target: r3_factory_1.R3FactoryTarget.Pipe }));
        var definitionField = outputCtx.constantPool.propertyNameOf(3 /* Pipe */);
        var ngFactoryDefStatement = new o.ClassStmt(
        /* name */ name, 
        /* parent */ null, 
        /* fields */
        [new o.ClassField(
            /* name */ 'ɵfac', 
            /* type */ o.INFERRED_TYPE, 
            /* modifiers */ [o.StmtModifier.Static], 
            /* initializer */ factoryRes.factory)], 
        /* getters */ [], 
        /* constructorMethod */ new o.ClassMethod(null, [], []), 
        /* methods */ []);
        var pipeDefStatement = new o.ClassStmt(
        /* name */ name, 
        /* parent */ null, 
        /* fields */ [new o.ClassField(
            /* name */ definitionField, 
            /* type */ o.INFERRED_TYPE, 
            /* modifiers */ [o.StmtModifier.Static], 
            /* initializer */ res.expression)], 
        /* getters */ [], 
        /* constructorMethod */ new o.ClassMethod(null, [], []), 
        /* methods */ []);
        outputCtx.statements.push(ngFactoryDefStatement, pipeDefStatement);
    }
    exports.compilePipeFromRender2 = compilePipeFromRender2;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfcGlwZV9jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsMkVBQXdFO0lBR3hFLDJEQUEwQztJQUMxQyxtREFBNkM7SUFFN0MsdUVBQTJIO0lBQzNILCtFQUFtRDtJQUNuRCwyREFBMEM7SUFrQzFDLFNBQWdCLHVCQUF1QixDQUFDLFFBQXdCO1FBQzlELElBQU0sbUJBQW1CLEdBQTBELEVBQUUsQ0FBQztRQUV0Rix3QkFBd0I7UUFDeEIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7UUFFNUYsc0JBQXNCO1FBQ3RCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7UUFFN0Usb0JBQW9CO1FBQ3BCLG1CQUFtQixDQUFDLElBQUksQ0FBQyxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO1FBRXhGLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNGLElB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LENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUE3Q0Qsd0RBNkNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVQaXBlTWV0YWRhdGEsIGlkZW50aWZpZXJOYW1lfSBmcm9tICcuLi9jb21waWxlX21ldGFkYXRhJztcbmltcG9ydCB7Q29tcGlsZVJlZmxlY3Rvcn0gZnJvbSAnLi4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtEZWZpbml0aW9uS2luZH0gZnJvbSAnLi4vY29uc3RhbnRfcG9vbCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7T3V0cHV0Q29udGV4dCwgZXJyb3J9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1IzRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0ZhY3RvcnlUYXJnZXQsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24sIGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YX0gZnJvbSAnLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHt0eXBlV2l0aFBhcmFtZXRlcnN9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUjNQaXBlTWV0YWRhdGEge1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgcGlwZSB0eXBlLlxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHJlZmVyZW5jZSB0byB0aGUgcGlwZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyBvZiB0aGUgdHlwZSBpdHNlbGYuXG4gICAqL1xuICB0eXBlQXJndW1lbnRDb3VudDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBwaXBlLlxuICAgKi9cbiAgcGlwZU5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogRGVwZW5kZW5jaWVzIG9mIHRoZSBwaXBlJ3MgY29uc3RydWN0b3IuXG4gICAqL1xuICBkZXBzOiBSM0RlcGVuZGVuY3lNZXRhZGF0YVtdfG51bGw7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIHBpcGUgaXMgbWFya2VkIGFzIHB1cmUuXG4gICAqL1xuICBwdXJlOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZVBpcGVGcm9tTWV0YWRhdGEobWV0YWRhdGE6IFIzUGlwZU1ldGFkYXRhKSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXBWYWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgLy8gZS5nLiBgbmFtZTogJ215UGlwZSdgXG4gIGRlZmluaXRpb25NYXBWYWx1ZXMucHVzaCh7a2V5OiAnbmFtZScsIHZhbHVlOiBvLmxpdGVyYWwobWV0YWRhdGEucGlwZU5hbWUpLCBxdW90ZWQ6IGZhbHNlfSk7XG5cbiAgLy8gZS5nLiBgdHlwZTogTXlQaXBlYFxuICBkZWZpbml0aW9uTWFwVmFsdWVzLnB1c2goe2tleTogJ3R5cGUnLCB2YWx1ZTogbWV0YWRhdGEudHlwZSwgcXVvdGVkOiBmYWxzZX0pO1xuXG4gIC8vIGUuZy4gYHB1cmU6IHRydWVgXG4gIGRlZmluaXRpb25NYXBWYWx1ZXMucHVzaCh7a2V5OiAncHVyZScsIHZhbHVlOiBvLmxpdGVyYWwobWV0YWRhdGEucHVyZSksIHF1b3RlZDogZmFsc2V9KTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlZmluZVBpcGUpLmNhbGxGbihbby5saXRlcmFsTWFwKGRlZmluaXRpb25NYXBWYWx1ZXMpXSk7XG4gIGNvbnN0IHR5cGUgPSBuZXcgby5FeHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuUGlwZURlZldpdGhNZXRhLCBbXG4gICAgdHlwZVdpdGhQYXJhbWV0ZXJzKG1ldGFkYXRhLnR5cGUsIG1ldGFkYXRhLnR5cGVBcmd1bWVudENvdW50KSxcbiAgICBuZXcgby5FeHByZXNzaW9uVHlwZShuZXcgby5MaXRlcmFsRXhwcihtZXRhZGF0YS5waXBlTmFtZSkpLFxuICBdKSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlfTtcbn1cblxuLyoqXG4gKiBXcml0ZSBhIHBpcGUgZGVmaW5pdGlvbiB0byB0aGUgb3V0cHV0IGNvbnRleHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlUGlwZUZyb21SZW5kZXIyKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgcGlwZTogQ29tcGlsZVBpcGVNZXRhZGF0YSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7XG4gIGNvbnN0IG5hbWUgPSBpZGVudGlmaWVyTmFtZShwaXBlLnR5cGUpO1xuXG4gIGlmICghbmFtZSkge1xuICAgIHJldHVybiBlcnJvcihgQ2Fubm90IHJlc29sdmUgdGhlIG5hbWUgb2YgJHtwaXBlLnR5cGV9YCk7XG4gIH1cblxuICBjb25zdCBtZXRhZGF0YTogUjNQaXBlTWV0YWRhdGEgPSB7XG4gICAgbmFtZSxcbiAgICBwaXBlTmFtZTogcGlwZS5uYW1lLFxuICAgIHR5cGU6IG91dHB1dEN0eC5pbXBvcnRFeHByKHBpcGUudHlwZS5yZWZlcmVuY2UpLFxuICAgIHR5cGVBcmd1bWVudENvdW50OiAwLFxuICAgIGRlcHM6IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShwaXBlLnR5cGUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKSxcbiAgICBwdXJlOiBwaXBlLnB1cmUsXG4gIH07XG4gIGNvbnN0IHJlcyA9IGNvbXBpbGVQaXBlRnJvbU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oXG4gICAgICB7Li4ubWV0YWRhdGEsIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0LlBpcGV9KTtcbiAgY29uc3QgZGVmaW5pdGlvbkZpZWxkID0gb3V0cHV0Q3R4LmNvbnN0YW50UG9vbC5wcm9wZXJ0eU5hbWVPZihEZWZpbml0aW9uS2luZC5QaXBlKTtcbiAgY29uc3QgbmdGYWN0b3J5RGVmU3RhdGVtZW50ID0gbmV3IG8uQ2xhc3NTdG10KFxuICAgICAgLyogbmFtZSAqLyBuYW1lLFxuICAgICAgLyogcGFyZW50ICovIG51bGwsXG4gICAgICAvKiBmaWVsZHMgKi9cbiAgICAgIFtuZXcgby5DbGFzc0ZpZWxkKFxuICAgICAgICAgIC8qIG5hbWUgKi8gJ8m1ZmFjJyxcbiAgICAgICAgICAvKiB0eXBlICovIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi9bby5TdG10TW9kaWZpZXIuU3RhdGljXSxcbiAgICAgICAgICAvKiBpbml0aWFsaXplciAqLyBmYWN0b3J5UmVzLmZhY3RvcnkpXSxcbiAgICAgIC8qIGdldHRlcnMgKi9bXSxcbiAgICAgIC8qIGNvbnN0cnVjdG9yTWV0aG9kICovIG5ldyBvLkNsYXNzTWV0aG9kKG51bGwsIFtdLCBbXSksXG4gICAgICAvKiBtZXRob2RzICovW10pO1xuICBjb25zdCBwaXBlRGVmU3RhdGVtZW50ID0gbmV3IG8uQ2xhc3NTdG10KFxuICAgICAgLyogbmFtZSAqLyBuYW1lLFxuICAgICAgLyogcGFyZW50ICovIG51bGwsXG4gICAgICAvKiBmaWVsZHMgKi9bbmV3IG8uQ2xhc3NGaWVsZChcbiAgICAgICAgICAvKiBuYW1lICovIGRlZmluaXRpb25GaWVsZCxcbiAgICAgICAgICAvKiB0eXBlICovIG8uSU5GRVJSRURfVFlQRSxcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi9bby5TdG10TW9kaWZpZXIuU3RhdGljXSxcbiAgICAgICAgICAvKiBpbml0aWFsaXplciAqLyByZXMuZXhwcmVzc2lvbildLFxuICAgICAgLyogZ2V0dGVycyAqL1tdLFxuICAgICAgLyogY29uc3RydWN0b3JNZXRob2QgKi8gbmV3IG8uQ2xhc3NNZXRob2QobnVsbCwgW10sIFtdKSxcbiAgICAgIC8qIG1ldGhvZHMgKi9bXSk7XG5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZ0ZhY3RvcnlEZWZTdGF0ZW1lbnQsIHBpcGVEZWZTdGF0ZW1lbnQpO1xufVxuIl19