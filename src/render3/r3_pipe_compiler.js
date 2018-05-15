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
        define("@angular/compiler/src/render3/r3_pipe_compiler", ["require", "exports", "@angular/compiler/src/compile_metadata", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_factory", "@angular/compiler/src/render3/r3_identifiers"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var compile_metadata_1 = require("@angular/compiler/src/compile_metadata");
    var o = require("@angular/compiler/src/output/output_ast");
    var util_1 = require("@angular/compiler/src/util");
    var r3_factory_1 = require("@angular/compiler/src/render3/r3_factory");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    /**
     * Write a pipe definition to the output context.
     */
    function compilePipe(outputCtx, pipe, reflector) {
        var definitionMapValues = [];
        // e.g. `name: 'myPipe'`
        definitionMapValues.push({ key: 'name', value: o.literal(pipe.name), quoted: false });
        // e.g. `type: MyPipe`
        definitionMapValues.push({ key: 'type', value: outputCtx.importExpr(pipe.type.reference), quoted: false });
        // e.g. `factory: function MyPipe_Factory() { return new MyPipe(); }`
        var deps = r3_factory_1.dependenciesFromGlobalMetadata(pipe.type, outputCtx, reflector);
        var templateFactory = r3_factory_1.compileFactoryFunction({
            name: compile_metadata_1.identifierName(pipe.type),
            fnOrClass: outputCtx.importExpr(pipe.type.reference), deps: deps,
            useNew: true,
            injectFn: r3_identifiers_1.Identifiers.directiveInject,
            useOptionalParam: false,
        });
        definitionMapValues.push({ key: 'factory', value: templateFactory, quoted: false });
        // e.g. `pure: true`
        if (pipe.pure) {
            definitionMapValues.push({ key: 'pure', value: o.literal(true), quoted: false });
        }
        var className = compile_metadata_1.identifierName(pipe.type);
        className || util_1.error("Cannot resolve the name of " + pipe.type);
        var definitionField = outputCtx.constantPool.propertyNameOf(3 /* Pipe */);
        var definitionFunction = o.importExpr(r3_identifiers_1.Identifiers.definePipe).callFn([o.literalMap(definitionMapValues)]);
        outputCtx.statements.push(new o.ClassStmt(
        /* name */ className, 
        /* parent */ null, 
        /* fields */ [new o.ClassField(
            /* name */ definitionField, 
            /* type */ o.INFERRED_TYPE, 
            /* modifiers */ [o.StmtModifier.Static], 
            /* initializer */ definitionFunction)], 
        /* getters */ [], 
        /* constructorMethod */ new o.ClassMethod(null, [], []), 
        /* methods */ []));
    }
    exports.compilePipe = compilePipe;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfcGlwZV9jb21waWxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3IzX3BpcGVfY29tcGlsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFFSCwyRUFBd0U7SUFHeEUsMkRBQTBDO0lBQzFDLG1EQUE2QztJQUU3Qyx1RUFBb0Y7SUFDcEYsK0VBQW1EO0lBR25EOztPQUVHO0lBQ0gscUJBQ0ksU0FBd0IsRUFBRSxJQUF5QixFQUFFLFNBQTJCO1FBQ2xGLElBQU0sbUJBQW1CLEdBQTBELEVBQUUsQ0FBQztRQUV0Rix3QkFBd0I7UUFDeEIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7UUFFcEYsc0JBQXNCO1FBQ3RCLG1CQUFtQixDQUFDLElBQUksQ0FDcEIsRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7UUFFcEYscUVBQXFFO1FBQ3JFLElBQU0sSUFBSSxHQUFHLDJDQUE4QixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzdFLElBQU0sZUFBZSxHQUFHLG1DQUFzQixDQUFDO1lBQzdDLElBQUksRUFBRSxpQ0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUc7WUFDakMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLE1BQUE7WUFDMUQsTUFBTSxFQUFFLElBQUk7WUFDWixRQUFRLEVBQUUsNEJBQUUsQ0FBQyxlQUFlO1lBQzVCLGdCQUFnQixFQUFFLEtBQUs7U0FDeEIsQ0FBQyxDQUFDO1FBQ0gsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO1FBRWxGLG9CQUFvQjtRQUNwQixJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDYixtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUMsQ0FBQyxDQUFDO1NBQ2hGO1FBRUQsSUFBTSxTQUFTLEdBQUcsaUNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFHLENBQUM7UUFDOUMsU0FBUyxJQUFJLFlBQUssQ0FBQyxnQ0FBOEIsSUFBSSxDQUFDLElBQU0sQ0FBQyxDQUFDO1FBRTlELElBQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsY0FBYyxjQUFxQixDQUFDO1FBQ25GLElBQU0sa0JBQWtCLEdBQ3BCLENBQUMsQ0FBQyxVQUFVLENBQUMsNEJBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTVFLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVM7UUFDckMsVUFBVSxDQUFDLFNBQVM7UUFDcEIsWUFBWSxDQUFDLElBQUk7UUFDakIsWUFBWSxDQUFBLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVTtZQUN6QixVQUFVLENBQUMsZUFBZTtZQUMxQixVQUFVLENBQUMsQ0FBQyxDQUFDLGFBQWE7WUFDMUIsZUFBZSxDQUFBLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDdEMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUMxQyxhQUFhLENBQUEsRUFBRTtRQUNmLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUN2RCxhQUFhLENBQUEsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBN0NELGtDQTZDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlUGlwZU1ldGFkYXRhLCBpZGVudGlmaWVyTmFtZX0gZnJvbSAnLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4uL2NvbXBpbGVfcmVmbGVjdG9yJztcbmltcG9ydCB7RGVmaW5pdGlvbktpbmR9IGZyb20gJy4uL2NvbnN0YW50X3Bvb2wnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge091dHB1dENvbnRleHQsIGVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtjb21waWxlRmFjdG9yeUZ1bmN0aW9uLCBkZXBlbmRlbmNpZXNGcm9tR2xvYmFsTWV0YWRhdGF9IGZyb20gJy4vcjNfZmFjdG9yeSc7XG5pbXBvcnQge0lkZW50aWZpZXJzIGFzIFIzfSBmcm9tICcuL3IzX2lkZW50aWZpZXJzJztcblxuXG4vKipcbiAqIFdyaXRlIGEgcGlwZSBkZWZpbml0aW9uIHRvIHRoZSBvdXRwdXQgY29udGV4dC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVQaXBlKFxuICAgIG91dHB1dEN0eDogT3V0cHV0Q29udGV4dCwgcGlwZTogQ29tcGlsZVBpcGVNZXRhZGF0YSwgcmVmbGVjdG9yOiBDb21waWxlUmVmbGVjdG9yKSB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXBWYWx1ZXM6IHtrZXk6IHN0cmluZywgcXVvdGVkOiBib29sZWFuLCB2YWx1ZTogby5FeHByZXNzaW9ufVtdID0gW107XG5cbiAgLy8gZS5nLiBgbmFtZTogJ215UGlwZSdgXG4gIGRlZmluaXRpb25NYXBWYWx1ZXMucHVzaCh7a2V5OiAnbmFtZScsIHZhbHVlOiBvLmxpdGVyYWwocGlwZS5uYW1lKSwgcXVvdGVkOiBmYWxzZX0pO1xuXG4gIC8vIGUuZy4gYHR5cGU6IE15UGlwZWBcbiAgZGVmaW5pdGlvbk1hcFZhbHVlcy5wdXNoKFxuICAgICAge2tleTogJ3R5cGUnLCB2YWx1ZTogb3V0cHV0Q3R4LmltcG9ydEV4cHIocGlwZS50eXBlLnJlZmVyZW5jZSksIHF1b3RlZDogZmFsc2V9KTtcblxuICAvLyBlLmcuIGBmYWN0b3J5OiBmdW5jdGlvbiBNeVBpcGVfRmFjdG9yeSgpIHsgcmV0dXJuIG5ldyBNeVBpcGUoKTsgfWBcbiAgY29uc3QgZGVwcyA9IGRlcGVuZGVuY2llc0Zyb21HbG9iYWxNZXRhZGF0YShwaXBlLnR5cGUsIG91dHB1dEN0eCwgcmVmbGVjdG9yKTtcbiAgY29uc3QgdGVtcGxhdGVGYWN0b3J5ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgbmFtZTogaWRlbnRpZmllck5hbWUocGlwZS50eXBlKSAhLFxuICAgIGZuT3JDbGFzczogb3V0cHV0Q3R4LmltcG9ydEV4cHIocGlwZS50eXBlLnJlZmVyZW5jZSksIGRlcHMsXG4gICAgdXNlTmV3OiB0cnVlLFxuICAgIGluamVjdEZuOiBSMy5kaXJlY3RpdmVJbmplY3QsXG4gICAgdXNlT3B0aW9uYWxQYXJhbTogZmFsc2UsXG4gIH0pO1xuICBkZWZpbml0aW9uTWFwVmFsdWVzLnB1c2goe2tleTogJ2ZhY3RvcnknLCB2YWx1ZTogdGVtcGxhdGVGYWN0b3J5LCBxdW90ZWQ6IGZhbHNlfSk7XG5cbiAgLy8gZS5nLiBgcHVyZTogdHJ1ZWBcbiAgaWYgKHBpcGUucHVyZSkge1xuICAgIGRlZmluaXRpb25NYXBWYWx1ZXMucHVzaCh7a2V5OiAncHVyZScsIHZhbHVlOiBvLmxpdGVyYWwodHJ1ZSksIHF1b3RlZDogZmFsc2V9KTtcbiAgfVxuXG4gIGNvbnN0IGNsYXNzTmFtZSA9IGlkZW50aWZpZXJOYW1lKHBpcGUudHlwZSkgITtcbiAgY2xhc3NOYW1lIHx8IGVycm9yKGBDYW5ub3QgcmVzb2x2ZSB0aGUgbmFtZSBvZiAke3BpcGUudHlwZX1gKTtcblxuICBjb25zdCBkZWZpbml0aW9uRmllbGQgPSBvdXRwdXRDdHguY29uc3RhbnRQb29sLnByb3BlcnR5TmFtZU9mKERlZmluaXRpb25LaW5kLlBpcGUpO1xuICBjb25zdCBkZWZpbml0aW9uRnVuY3Rpb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZVBpcGUpLmNhbGxGbihbby5saXRlcmFsTWFwKGRlZmluaXRpb25NYXBWYWx1ZXMpXSk7XG5cbiAgb3V0cHV0Q3R4LnN0YXRlbWVudHMucHVzaChuZXcgby5DbGFzc1N0bXQoXG4gICAgICAvKiBuYW1lICovIGNsYXNzTmFtZSxcbiAgICAgIC8qIHBhcmVudCAqLyBudWxsLFxuICAgICAgLyogZmllbGRzICovW25ldyBvLkNsYXNzRmllbGQoXG4gICAgICAgICAgLyogbmFtZSAqLyBkZWZpbml0aW9uRmllbGQsXG4gICAgICAgICAgLyogdHlwZSAqLyBvLklORkVSUkVEX1RZUEUsXG4gICAgICAgICAgLyogbW9kaWZpZXJzICovW28uU3RtdE1vZGlmaWVyLlN0YXRpY10sXG4gICAgICAgICAgLyogaW5pdGlhbGl6ZXIgKi8gZGVmaW5pdGlvbkZ1bmN0aW9uKV0sXG4gICAgICAvKiBnZXR0ZXJzICovW10sXG4gICAgICAvKiBjb25zdHJ1Y3Rvck1ldGhvZCAqLyBuZXcgby5DbGFzc01ldGhvZChudWxsLCBbXSwgW10pLFxuICAgICAgLyogbWV0aG9kcyAqL1tdKSk7XG59Il19