/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { identifierName } from './compile_metadata';
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { typeSourceSpan } from './parse_util';
import { NgModuleProviderAnalyzer } from './provider_analyzer';
import { componentFactoryResolverProviderDef, providerDef } from './view_compiler/provider_compiler';
export class NgModuleCompileResult {
    constructor(ngModuleFactoryVar) {
        this.ngModuleFactoryVar = ngModuleFactoryVar;
    }
}
const LOG_VAR = o.variable('_l');
export class NgModuleCompiler {
    constructor(reflector) {
        this.reflector = reflector;
    }
    compile(ctx, ngModuleMeta, extraProviders) {
        const sourceSpan = typeSourceSpan('NgModule', ngModuleMeta.type);
        const entryComponentFactories = ngModuleMeta.transitiveModule.entryComponents;
        const bootstrapComponents = ngModuleMeta.bootstrapComponents;
        const providerParser = new NgModuleProviderAnalyzer(this.reflector, ngModuleMeta, extraProviders, sourceSpan);
        const providerDefs = [componentFactoryResolverProviderDef(this.reflector, ctx, 0 /* None */, entryComponentFactories)]
            .concat(providerParser.parse().map((provider) => providerDef(ctx, provider)))
            .map(({ providerExpr, depsExpr, flags, tokenExpr }) => {
            return o.importExpr(Identifiers.moduleProviderDef).callFn([
                o.literal(flags), tokenExpr, providerExpr, depsExpr
            ]);
        });
        const ngModuleDef = o.importExpr(Identifiers.moduleDef).callFn([o.literalArr(providerDefs)]);
        const ngModuleDefFactory = o.fn([new o.FnParam(LOG_VAR.name)], [new o.ReturnStatement(ngModuleDef)], o.INFERRED_TYPE);
        const ngModuleFactoryVar = `${identifierName(ngModuleMeta.type)}NgFactory`;
        this._createNgModuleFactory(ctx, ngModuleMeta.type.reference, o.importExpr(Identifiers.createModuleFactory).callFn([
            ctx.importExpr(ngModuleMeta.type.reference),
            o.literalArr(bootstrapComponents.map(id => ctx.importExpr(id.reference))),
            ngModuleDefFactory
        ]));
        if (ngModuleMeta.id) {
            const id = typeof ngModuleMeta.id === 'string' ? o.literal(ngModuleMeta.id) :
                ctx.importExpr(ngModuleMeta.id);
            const registerFactoryStmt = o.importExpr(Identifiers.RegisterModuleFactoryFn)
                .callFn([id, o.variable(ngModuleFactoryVar)])
                .toStmt();
            ctx.statements.push(registerFactoryStmt);
        }
        return new NgModuleCompileResult(ngModuleFactoryVar);
    }
    createStub(ctx, ngModuleReference) {
        this._createNgModuleFactory(ctx, ngModuleReference, o.NULL_EXPR);
    }
    _createNgModuleFactory(ctx, reference, value) {
        const ngModuleFactoryVar = `${identifierName({ reference: reference })}NgFactory`;
        const ngModuleFactoryStmt = o.variable(ngModuleFactoryVar)
            .set(value)
            .toDeclStmt(o.importType(Identifiers.NgModuleFactory, [o.expressionType(ctx.importExpr(reference))], [o.TypeModifier.Const]), [o.StmtModifier.Final, o.StmtModifier.Exported]);
        ctx.statements.push(ngModuleFactoryStmt);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmdfbW9kdWxlX2NvbXBpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL25nX21vZHVsZV9jb21waWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQW1ELGNBQWMsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBR3BHLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDMUMsT0FBTyxLQUFLLENBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUN6QyxPQUFPLEVBQUMsY0FBYyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzVDLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRTdELE9BQU8sRUFBQyxtQ0FBbUMsRUFBVSxXQUFXLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRyxNQUFNLE9BQU8scUJBQXFCO0lBQ2hDLFlBQW1CLGtCQUEwQjtRQUExQix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQVE7SUFBRyxDQUFDO0NBQ2xEO0FBRUQsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVqQyxNQUFNLE9BQU8sZ0JBQWdCO0lBQzNCLFlBQW9CLFNBQTJCO1FBQTNCLGNBQVMsR0FBVCxTQUFTLENBQWtCO0lBQUcsQ0FBQztJQUNuRCxPQUFPLENBQ0gsR0FBa0IsRUFBRSxZQUFxQyxFQUN6RCxjQUF5QztRQUMzQyxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRSxNQUFNLHVCQUF1QixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUM7UUFDOUUsTUFBTSxtQkFBbUIsR0FBRyxZQUFZLENBQUMsbUJBQW1CLENBQUM7UUFDN0QsTUFBTSxjQUFjLEdBQ2hCLElBQUksd0JB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QztJQUNuRSxDQUFDO0lBRU8sc0JBQXNCLENBQUMsR0FBa0IsRUFBRSxTQUFjLEVBQUUsS0FBbUI7UUFDcEYsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLGNBQWMsQ0FBQyxFQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUMsQ0FBQyxXQUFXLENBQUM7UUFDaEYsTUFBTSxtQkFBbUIsR0FDckIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQzthQUN6QixHQUFHLENBQUMsS0FBSyxDQUFDO2FBQ1YsVUFBVSxDQUNQLENBQUMsQ0FBQyxVQUFVLENBQ1IsV0FBVyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBRSxDQUFDLEVBQzNFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUMzQixDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUU3RCxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQzNDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NvbXBpbGVOZ01vZHVsZU1ldGFkYXRhLCBDb21waWxlUHJvdmlkZXJNZXRhZGF0YSwgaWRlbnRpZmllck5hbWV9IGZyb20gJy4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0NvbXBpbGVSZWZsZWN0b3J9IGZyb20gJy4vY29tcGlsZV9yZWZsZWN0b3InO1xuaW1wb3J0IHtOb2RlRmxhZ3N9IGZyb20gJy4vY29yZSc7XG5pbXBvcnQge0lkZW50aWZpZXJzfSBmcm9tICcuL2lkZW50aWZpZXJzJztcbmltcG9ydCAqIGFzIG8gZnJvbSAnLi9vdXRwdXQvb3V0cHV0X2FzdCc7XG5pbXBvcnQge3R5cGVTb3VyY2VTcGFufSBmcm9tICcuL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtOZ01vZHVsZVByb3ZpZGVyQW5hbHl6ZXJ9IGZyb20gJy4vcHJvdmlkZXJfYW5hbHl6ZXInO1xuaW1wb3J0IHtPdXRwdXRDb250ZXh0fSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHtjb21wb25lbnRGYWN0b3J5UmVzb2x2ZXJQcm92aWRlckRlZiwgZGVwRGVmLCBwcm92aWRlckRlZn0gZnJvbSAnLi92aWV3X2NvbXBpbGVyL3Byb3ZpZGVyX2NvbXBpbGVyJztcblxuZXhwb3J0IGNsYXNzIE5nTW9kdWxlQ29tcGlsZVJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuZ01vZHVsZUZhY3RvcnlWYXI6IHN0cmluZykge31cbn1cblxuY29uc3QgTE9HX1ZBUiA9IG8udmFyaWFibGUoJ19sJyk7XG5cbmV4cG9ydCBjbGFzcyBOZ01vZHVsZUNvbXBpbGVyIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWZsZWN0b3I6IENvbXBpbGVSZWZsZWN0b3IpIHt9XG4gIGNvbXBpbGUoXG4gICAgICBjdHg6IE91dHB1dENvbnRleHQsIG5nTW9kdWxlTWV0YTogQ29tcGlsZU5nTW9kdWxlTWV0YWRhdGEsXG4gICAgICBleHRyYVByb3ZpZGVyczogQ29tcGlsZVByb3ZpZGVyTWV0YWRhdGFbXSk6IE5nTW9kdWxlQ29tcGlsZVJlc3VsdCB7XG4gICAgY29uc3Qgc291cmNlU3BhbiA9IHR5cGVTb3VyY2VTcGFuKCdOZ01vZHVsZScsIG5nTW9kdWxlTWV0YS50eXBlKTtcbiAgICBjb25zdCBlbnRyeUNvbXBvbmVudEZhY3RvcmllcyA9IG5nTW9kdWxlTWV0YS50cmFuc2l0aXZlTW9kdWxlLmVudHJ5Q29tcG9uZW50cztcbiAgICBjb25zdCBib290c3RyYXBDb21wb25lbnRzID0gbmdNb2R1bGVNZXRhLmJvb3RzdHJhcENvbXBvbmVudHM7XG4gICAgY29uc3QgcHJvdmlkZXJQYXJzZXIgPVxuICAgICAgICBuZXcgTmdNb2R1bGVQcm92aWRlckFuYWx5emVyKHRoaXMucmVmbGVjdG9yLCBuZ01vZHVsZU1ldGEsIGV4dHJhUHJvdmlkZXJzLCBzb3VyY2VTcGFuKTtcbiAgICBjb25zdCBwcm92aWRlckRlZnMgPVxuICAgICAgICBbY29tcG9uZW50RmFjdG9yeVJlc29sdmVyUHJvdmlkZXJEZWYoXG4gICAgICAgICAgICAgdGhpcy5yZWZsZWN0b3IsIGN0eCwgTm9kZUZsYWdzLk5vbmUsIGVudHJ5Q29tcG9uZW50RmFjdG9yaWVzKV1cbiAgICAgICAgICAgIC5jb25jYXQocHJvdmlkZXJQYXJzZXIucGFyc2UoKS5tYXAoKHByb3ZpZGVyKSA9PiBwcm92aWRlckRlZihjdHgsIHByb3ZpZGVyKSkpXG4gICAgICAgICAgICAubWFwKCh7cHJvdmlkZXJFeHByLCBkZXBzRXhwciwgZmxhZ3MsIHRva2VuRXhwcn0pID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG8uaW1wb3J0RXhwcihJZGVudGlmaWVycy5tb2R1bGVQcm92aWRlckRlZikuY2FsbEZuKFtcbiAgICAgICAgICAgICAgICBvLmxpdGVyYWwoZmxhZ3MpLCB0b2tlbkV4cHIsIHByb3ZpZGVyRXhwciwgZGVwc0V4cHJcbiAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICB9KTtcblxuICAgIGNvbnN0IG5nTW9kdWxlRGVmID0gby5pbXBvcnRFeHByKElkZW50aWZpZXJzLm1vZHVsZURlZikuY2FsbEZuKFtvLmxpdGVyYWxBcnIocHJvdmlkZXJEZWZzKV0pO1xuICAgIGNvbnN0IG5nTW9kdWxlRGVmRmFjdG9yeSA9XG4gICAgICAgIG8uZm4oW25ldyBvLkZuUGFyYW0oTE9HX1ZBUi5uYW1lISldLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KG5nTW9kdWxlRGVmKV0sIG8uSU5GRVJSRURfVFlQRSk7XG5cbiAgICBjb25zdCBuZ01vZHVsZUZhY3RvcnlWYXIgPSBgJHtpZGVudGlmaWVyTmFtZShuZ01vZHVsZU1ldGEudHlwZSl9TmdGYWN0b3J5YDtcbiAgICB0aGlzLl9jcmVhdGVOZ01vZHVsZUZhY3RvcnkoXG4gICAgICAgIGN0eCwgbmdNb2R1bGVNZXRhLnR5cGUucmVmZXJlbmNlLCBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuY3JlYXRlTW9kdWxlRmFjdG9yeSkuY2FsbEZuKFtcbiAgICAgICAgICBjdHguaW1wb3J0RXhwcihuZ01vZHVsZU1ldGEudHlwZS5yZWZlcmVuY2UpLFxuICAgICAgICAgIG8ubGl0ZXJhbEFycihib290c3RyYXBDb21wb25lbnRzLm1hcChpZCA9PiBjdHguaW1wb3J0RXhwcihpZC5yZWZlcmVuY2UpKSksXG4gICAgICAgICAgbmdNb2R1bGVEZWZGYWN0b3J5XG4gICAgICAgIF0pKTtcblxuICAgIGlmIChuZ01vZHVsZU1ldGEuaWQpIHtcbiAgICAgIGNvbnN0IGlkID0gdHlwZW9mIG5nTW9kdWxlTWV0YS5pZCA9PT0gJ3N0cmluZycgPyBvLmxpdGVyYWwobmdNb2R1bGVNZXRhLmlkKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3R4LmltcG9ydEV4cHIobmdNb2R1bGVNZXRhLmlkKTtcbiAgICAgIGNvbnN0IHJlZ2lzdGVyRmFjdG9yeVN0bXQgPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuUmVnaXN0ZXJNb2R1bGVGYWN0b3J5Rm4pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYWxsRm4oW2lkLCBvLnZhcmlhYmxlKG5nTW9kdWxlRmFjdG9yeVZhcildKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudG9TdG10KCk7XG4gICAgICBjdHguc3RhdGVtZW50cy5wdXNoKHJlZ2lzdGVyRmFjdG9yeVN0bXQpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgTmdNb2R1bGVDb21waWxlUmVzdWx0KG5nTW9kdWxlRmFjdG9yeVZhcik7XG4gIH1cblxuICBjcmVhdGVTdHViKGN0eDogT3V0cHV0Q29udGV4dCwgbmdNb2R1bGVSZWZlcmVuY2U6IGFueSkge1xuICAgIHRoaXMuX2NyZWF0ZU5nTW9kdWxlRmFjdG9yeShjdHgsIG5nTW9kdWxlUmVmZXJlbmNlLCBvLk5VTExfRVhQUik7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVOZ01vZHVsZUZhY3RvcnkoY3R4OiBPdXRwdXRDb250ZXh0LCByZWZlcmVuY2U6IGFueSwgdmFsdWU6IG8uRXhwcmVzc2lvbikge1xuICAgIGNvbnN0IG5nTW9kdWxlRmFjdG9yeVZhciA9IGAke2lkZW50aWZpZXJOYW1lKHtyZWZlcmVuY2U6IHJlZmVyZW5jZX0pfU5nRmFjdG9yeWA7XG4gICAgY29uc3QgbmdNb2R1bGVGYWN0b3J5U3RtdCA9XG4gICAgICAgIG8udmFyaWFibGUobmdNb2R1bGVGYWN0b3J5VmFyKVxuICAgICAgICAgICAgLnNldCh2YWx1ZSlcbiAgICAgICAgICAgIC50b0RlY2xTdG10KFxuICAgICAgICAgICAgICAgIG8uaW1wb3J0VHlwZShcbiAgICAgICAgICAgICAgICAgICAgSWRlbnRpZmllcnMuTmdNb2R1bGVGYWN0b3J5LCBbby5leHByZXNzaW9uVHlwZShjdHguaW1wb3J0RXhwcihyZWZlcmVuY2UpKSFdLFxuICAgICAgICAgICAgICAgICAgICBbby5UeXBlTW9kaWZpZXIuQ29uc3RdKSxcbiAgICAgICAgICAgICAgICBbby5TdG10TW9kaWZpZXIuRmluYWwsIG8uU3RtdE1vZGlmaWVyLkV4cG9ydGVkXSk7XG5cbiAgICBjdHguc3RhdGVtZW50cy5wdXNoKG5nTW9kdWxlRmFjdG9yeVN0bXQpO1xuICB9XG59XG4iXX0=