/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../output/output_ast';
import { createFactoryType, FactoryTarget } from '../r3_factory';
import { Identifiers as R3 } from '../r3_identifiers';
import { DefinitionMap } from '../view/util';
export function compileDeclareFactoryFunction(meta) {
    const definitionMap = new DefinitionMap();
    definitionMap.set('version', o.literal('12.0.0-next.7+10.sha-fcd190a'));
    definitionMap.set('ngImport', o.importExpr(R3.core));
    definitionMap.set('type', meta.internalType);
    definitionMap.set('deps', compileDependencies(meta.deps));
    definitionMap.set('target', o.importExpr(R3.FactoryTarget).prop(FactoryTarget[meta.target]));
    return {
        expression: o.importExpr(R3.declareFactory).callFn([definitionMap.toLiteralMap()]),
        statements: [],
        type: createFactoryType(meta),
    };
}
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
    const depMeta = new DefinitionMap();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9yZW5kZXIzL3BhcnRpYWwvZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLHlCQUF5QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxpQkFBaUIsRUFBRSxhQUFhLEVBQTBDLE1BQU0sZUFBZSxDQUFDO0FBQ3hHLE9BQU8sRUFBQyxXQUFXLElBQUksRUFBRSxFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFcEQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUkzQyxNQUFNLFVBQVUsNkJBQTZCLENBQUMsSUFBdUI7SUFDbkUsTUFBTSxhQUFhLEdBQUcsSUFBSSxhQUFhLEVBQTRCLENBQUM7SUFDcEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7SUFDN0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNyRCxhQUFhLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDN0MsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUQsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTdGLE9BQU87UUFDTCxVQUFVLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDbEYsVUFBVSxFQUFFLEVBQUU7UUFDZCxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDO0tBQzlCLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxJQUEyQztJQUV0RSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7UUFDdEIsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0tBQzdCO1NBQU0sSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFO1FBQ3hCLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN4QjtTQUFNO1FBQ0wsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0tBQ2xEO0FBQ0gsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsR0FBeUI7SUFDbEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxhQUFhLEVBQStCLENBQUM7SUFDakUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hDLElBQUksR0FBRyxDQUFDLGlCQUFpQixLQUFLLElBQUksRUFBRTtRQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDM0M7SUFDRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUU7UUFDWixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDdEM7SUFDRCxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7UUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQzFDO0lBQ0QsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO1FBQ1osT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQ3RDO0lBQ0QsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFO1FBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUMxQztJQUNELE9BQU8sT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ2hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIG8gZnJvbSAnLi4vLi4vb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0IHtjcmVhdGVGYWN0b3J5VHlwZSwgRmFjdG9yeVRhcmdldCwgUjNEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuLi9yM19mYWN0b3J5JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7UjNDb21waWxlZEV4cHJlc3Npb259IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZURlcGVuZGVuY3lNZXRhZGF0YSwgUjNEZWNsYXJlRmFjdG9yeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRGVjbGFyZUZhY3RvcnlGdW5jdGlvbihtZXRhOiBSM0ZhY3RvcnlNZXRhZGF0YSk6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUZhY3RvcnlNZXRhZGF0YT4oKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZlcnNpb24nLCBvLmxpdGVyYWwoJzAuMC4wLVBMQUNFSE9MREVSJykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnbmdJbXBvcnQnLCBvLmltcG9ydEV4cHIoUjMuY29yZSkpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndHlwZScsIG1ldGEuaW50ZXJuYWxUeXBlKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ2RlcHMnLCBjb21waWxlRGVwZW5kZW5jaWVzKG1ldGEuZGVwcykpO1xuICBkZWZpbml0aW9uTWFwLnNldCgndGFyZ2V0Jywgby5pbXBvcnRFeHByKFIzLkZhY3RvcnlUYXJnZXQpLnByb3AoRmFjdG9yeVRhcmdldFttZXRhLnRhcmdldF0pKTtcblxuICByZXR1cm4ge1xuICAgIGV4cHJlc3Npb246IG8uaW1wb3J0RXhwcihSMy5kZWNsYXJlRmFjdG9yeSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSksXG4gICAgc3RhdGVtZW50czogW10sXG4gICAgdHlwZTogY3JlYXRlRmFjdG9yeVR5cGUobWV0YSksXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNvbXBpbGVEZXBlbmRlbmNpZXMoZGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXwnaW52YWxpZCd8bnVsbCk6IG8uTGl0ZXJhbEV4cHJ8XG4gICAgby5MaXRlcmFsQXJyYXlFeHByIHtcbiAgaWYgKGRlcHMgPT09ICdpbnZhbGlkJykge1xuICAgIHJldHVybiBvLmxpdGVyYWwoJ2ludmFsaWQnKTtcbiAgfSBlbHNlIGlmIChkZXBzID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG8ubGl0ZXJhbChudWxsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gby5saXRlcmFsQXJyKGRlcHMubWFwKGNvbXBpbGVEZXBlbmRlbmN5KSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcGlsZURlcGVuZGVuY3koZGVwOiBSM0RlcGVuZGVuY3lNZXRhZGF0YSk6IG8uTGl0ZXJhbE1hcEV4cHIge1xuICBjb25zdCBkZXBNZXRhID0gbmV3IERlZmluaXRpb25NYXA8UjNEZWNsYXJlRGVwZW5kZW5jeU1ldGFkYXRhPigpO1xuICBkZXBNZXRhLnNldCgndG9rZW4nLCBkZXAudG9rZW4pO1xuICBpZiAoZGVwLmF0dHJpYnV0ZU5hbWVUeXBlICE9PSBudWxsKSB7XG4gICAgZGVwTWV0YS5zZXQoJ2F0dHJpYnV0ZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cbiAgaWYgKGRlcC5ob3N0KSB7XG4gICAgZGVwTWV0YS5zZXQoJ2hvc3QnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChkZXAub3B0aW9uYWwpIHtcbiAgICBkZXBNZXRhLnNldCgnb3B0aW9uYWwnLCBvLmxpdGVyYWwodHJ1ZSkpO1xuICB9XG4gIGlmIChkZXAuc2VsZikge1xuICAgIGRlcE1ldGEuc2V0KCdzZWxmJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICBpZiAoZGVwLnNraXBTZWxmKSB7XG4gICAgZGVwTWV0YS5zZXQoJ3NraXBTZWxmJywgby5saXRlcmFsKHRydWUpKTtcbiAgfVxuICByZXR1cm4gZGVwTWV0YS50b0xpdGVyYWxNYXAoKTtcbn1cbiJdfQ==