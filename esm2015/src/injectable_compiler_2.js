/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Identifiers } from './identifiers';
import * as o from './output/output_ast';
import { compileFactoryFunction } from './render3/r3_factory';
import { mapToMapExpression } from './render3/util';
export function compileInjectable(meta) {
    let factory = o.NULL_EXPR;
    function makeFn(ret) {
        return o.fn([], [new o.ReturnStatement(ret)], undefined, undefined, `${meta.name}_Factory`);
    }
    if (meta.useClass !== undefined || meta.useFactory !== undefined) {
        // First, handle useClass and useFactory together, since both involve a similar call to
        // `compileFactoryFunction`. Either dependencies are explicitly specified, in which case
        // a factory function call is generated, or they're not specified and the calls are special-
        // cased.
        if (meta.deps !== undefined) {
            // Either call `new meta.useClass(...)` or `meta.useFactory(...)`.
            const fnOrClass = meta.useClass || meta.useFactory;
            // useNew: true if meta.useClass, false for meta.useFactory.
            const useNew = meta.useClass !== undefined;
            factory = compileFactoryFunction({
                name: meta.name,
                fnOrClass,
                useNew,
                injectFn: Identifiers.inject,
                useOptionalParam: true,
                deps: meta.deps,
            });
        }
        else if (meta.useClass !== undefined) {
            // Special case for useClass where the factory from the class's ngInjectableDef is used.
            if (meta.useClass.isEquivalent(meta.type)) {
                // For the injectable compiler, useClass represents a foreign type that should be
                // instantiated to satisfy construction of the given type. It's not valid to specify
                // useClass === type, since the useClass type is expected to already be compiled.
                throw new Error(`useClass is the same as the type, but no deps specified, which is invalid.`);
            }
            factory =
                makeFn(new o.ReadPropExpr(new o.ReadPropExpr(meta.useClass, 'ngInjectableDef'), 'factory')
                    .callFn([]));
        }
        else if (meta.useFactory !== undefined) {
            // Special case for useFactory where no arguments are passed.
            factory = meta.useFactory.callFn([]);
        }
        else {
            // Can't happen - outer conditional guards against both useClass and useFactory being
            // undefined.
            throw new Error('Reached unreachable block in injectable compiler.');
        }
    }
    else if (meta.useValue !== undefined) {
        // Note: it's safe to use `meta.useValue` instead of the `USE_VALUE in meta` check used for
        // client code because meta.useValue is an Expression which will be defined even if the actual
        // value is undefined.
        factory = makeFn(meta.useValue);
    }
    else if (meta.useExisting !== undefined) {
        // useExisting is an `inject` call on the existing token.
        factory = makeFn(o.importExpr(Identifiers.inject).callFn([meta.useExisting]));
    }
    else {
        // A strict type is compiled according to useClass semantics, except the dependencies are
        // required.
        if (meta.deps === undefined) {
            throw new Error(`Type compilation of an injectable requires dependencies.`);
        }
        factory = compileFactoryFunction({
            name: meta.name,
            fnOrClass: meta.type,
            useNew: true,
            injectFn: Identifiers.inject,
            useOptionalParam: true,
            deps: meta.deps,
        });
    }
    const token = meta.type;
    const providedIn = meta.providedIn;
    const expression = o.importExpr(Identifiers.defineInjectable).callFn([mapToMapExpression({ token, factory, providedIn })]);
    const type = new o.ExpressionType(o.importExpr(Identifiers.InjectableDef, [new o.ExpressionType(meta.type)]));
    return {
        expression, type,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0YWJsZV9jb21waWxlcl8yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2luamVjdGFibGVfY29tcGlsZXJfMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzFDLE9BQU8sS0FBSyxDQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDekMsT0FBTyxFQUF1QixzQkFBc0IsRUFBQyxNQUFNLHNCQUFzQixDQUFDO0FBQ2xGLE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBa0JsRCxNQUFNLDRCQUE0QixJQUEwQjtJQUMxRCxJQUFJLE9BQU8sR0FBaUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUV4QyxnQkFBZ0IsR0FBaUI7UUFDL0IsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsQ0FBQztJQUM5RixDQUFDO0lBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVMsRUFBRTtRQUNoRSx1RkFBdUY7UUFDdkYsd0ZBQXdGO1FBQ3hGLDRGQUE0RjtRQUM1RixTQUFTO1FBQ1QsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtZQUMzQixrRUFBa0U7WUFDbEUsTUFBTSxTQUFTLEdBQWlCLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVksQ0FBQztZQUVuRSw0REFBNEQ7WUFDNUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLENBQUM7WUFFM0MsT0FB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LE9BQU87UUFDSCxVQUFVLEVBQUUsSUFBSTtLQUNuQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJbmplY3RGbGFnc30gZnJvbSAnLi9jb3JlJztcbmltcG9ydCB7SWRlbnRpZmllcnN9IGZyb20gJy4vaWRlbnRpZmllcnMnO1xuaW1wb3J0ICogYXMgbyBmcm9tICcuL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UjNEZXBlbmRlbmN5TWV0YWRhdGEsIGNvbXBpbGVGYWN0b3J5RnVuY3Rpb259IGZyb20gJy4vcmVuZGVyMy9yM19mYWN0b3J5JztcbmltcG9ydCB7bWFwVG9NYXBFeHByZXNzaW9ufSBmcm9tICcuL3JlbmRlcjMvdXRpbCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSW5qZWN0YWJsZURlZiB7XG4gIGV4cHJlc3Npb246IG8uRXhwcmVzc2lvbjtcbiAgdHlwZTogby5UeXBlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFIzSW5qZWN0YWJsZU1ldGFkYXRhIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBvLkV4cHJlc3Npb247XG4gIHByb3ZpZGVkSW46IG8uRXhwcmVzc2lvbjtcbiAgdXNlQ2xhc3M/OiBvLkV4cHJlc3Npb247XG4gIHVzZUZhY3Rvcnk/OiBvLkV4cHJlc3Npb247XG4gIHVzZUV4aXN0aW5nPzogby5FeHByZXNzaW9uO1xuICB1c2VWYWx1ZT86IG8uRXhwcmVzc2lvbjtcbiAgZGVwcz86IFIzRGVwZW5kZW5jeU1ldGFkYXRhW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlSW5qZWN0YWJsZShtZXRhOiBSM0luamVjdGFibGVNZXRhZGF0YSk6IEluamVjdGFibGVEZWYge1xuICBsZXQgZmFjdG9yeTogby5FeHByZXNzaW9uID0gby5OVUxMX0VYUFI7XG5cbiAgZnVuY3Rpb24gbWFrZUZuKHJldDogby5FeHByZXNzaW9uKTogby5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gby5mbihbXSwgW25ldyBvLlJldHVyblN0YXRlbWVudChyZXQpXSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGAke21ldGEubmFtZX1fRmFjdG9yeWApO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlQ2xhc3MgIT09IHVuZGVmaW5lZCB8fCBtZXRhLnVzZUZhY3RvcnkgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIEZpcnN0LCBoYW5kbGUgdXNlQ2xhc3MgYW5kIHVzZUZhY3RvcnkgdG9nZXRoZXIsIHNpbmNlIGJvdGggaW52b2x2ZSBhIHNpbWlsYXIgY2FsbCB0b1xuICAgIC8vIGBjb21waWxlRmFjdG9yeUZ1bmN0aW9uYC4gRWl0aGVyIGRlcGVuZGVuY2llcyBhcmUgZXhwbGljaXRseSBzcGVjaWZpZWQsIGluIHdoaWNoIGNhc2VcbiAgICAvLyBhIGZhY3RvcnkgZnVuY3Rpb24gY2FsbCBpcyBnZW5lcmF0ZWQsIG9yIHRoZXkncmUgbm90IHNwZWNpZmllZCBhbmQgdGhlIGNhbGxzIGFyZSBzcGVjaWFsLVxuICAgIC8vIGNhc2VkLlxuICAgIGlmIChtZXRhLmRlcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gRWl0aGVyIGNhbGwgYG5ldyBtZXRhLnVzZUNsYXNzKC4uLilgIG9yIGBtZXRhLnVzZUZhY3RvcnkoLi4uKWAuXG4gICAgICBjb25zdCBmbk9yQ2xhc3M6IG8uRXhwcmVzc2lvbiA9IG1ldGEudXNlQ2xhc3MgfHwgbWV0YS51c2VGYWN0b3J5ICE7XG5cbiAgICAgIC8vIHVzZU5ldzogdHJ1ZSBpZiBtZXRhLnVzZUNsYXNzLCBmYWxzZSBmb3IgbWV0YS51c2VGYWN0b3J5LlxuICAgICAgY29uc3QgdXNlTmV3ID0gbWV0YS51c2VDbGFzcyAhPT0gdW5kZWZpbmVkO1xuXG4gICAgICBmYWN0b3J5ID0gY29tcGlsZUZhY3RvcnlGdW5jdGlvbih7XG4gICAgICAgIG5hbWU6IG1ldGEubmFtZSxcbiAgICAgICAgZm5PckNsYXNzLFxuICAgICAgICB1c2VOZXcsXG4gICAgICAgIGluamVjdEZuOiBJZGVudGlmaWVycy5pbmplY3QsXG4gICAgICAgIHVzZU9wdGlvbmFsUGFyYW06IHRydWUsXG4gICAgICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAobWV0YS51c2VDbGFzcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHVzZUNsYXNzIHdoZXJlIHRoZSBmYWN0b3J5IGZyb20gdGhlIGNsYXNzJ3MgbmdJbmplY3RhYmxlRGVmIGlzIHVzZWQuXG4gICAgICBpZiAobWV0YS51c2VDbGFzcy5pc0VxdWl2YWxlbnQobWV0YS50eXBlKSkge1xuICAgICAgICAvLyBGb3IgdGhlIGluamVjdGFibGUgY29tcGlsZXIsIHVzZUNsYXNzIHJlcHJlc2VudHMgYSBmb3JlaWduIHR5cGUgdGhhdCBzaG91bGQgYmVcbiAgICAgICAgLy8gaW5zdGFudGlhdGVkIHRvIHNhdGlzZnkgY29uc3RydWN0aW9uIG9mIHRoZSBnaXZlbiB0eXBlLiBJdCdzIG5vdCB2YWxpZCB0byBzcGVjaWZ5XG4gICAgICAgIC8vIHVzZUNsYXNzID09PSB0eXBlLCBzaW5jZSB0aGUgdXNlQ2xhc3MgdHlwZSBpcyBleHBlY3RlZCB0byBhbHJlYWR5IGJlIGNvbXBpbGVkLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgdXNlQ2xhc3MgaXMgdGhlIHNhbWUgYXMgdGhlIHR5cGUsIGJ1dCBubyBkZXBzIHNwZWNpZmllZCwgd2hpY2ggaXMgaW52YWxpZC5gKTtcbiAgICAgIH1cbiAgICAgIGZhY3RvcnkgPVxuICAgICAgICAgIG1ha2VGbihuZXcgby5SZWFkUHJvcEV4cHIobmV3IG8uUmVhZFByb3BFeHByKG1ldGEudXNlQ2xhc3MsICduZ0luamVjdGFibGVEZWYnKSwgJ2ZhY3RvcnknKVxuICAgICAgICAgICAgICAgICAgICAgLmNhbGxGbihbXSkpO1xuICAgIH0gZWxzZSBpZiAobWV0YS51c2VGYWN0b3J5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgdXNlRmFjdG9yeSB3aGVyZSBubyBhcmd1bWVudHMgYXJlIHBhc3NlZC5cbiAgICAgIGZhY3RvcnkgPSBtZXRhLnVzZUZhY3RvcnkuY2FsbEZuKFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ2FuJ3QgaGFwcGVuIC0gb3V0ZXIgY29uZGl0aW9uYWwgZ3VhcmRzIGFnYWluc3QgYm90aCB1c2VDbGFzcyBhbmQgdXNlRmFjdG9yeSBiZWluZ1xuICAgICAgLy8gdW5kZWZpbmVkLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWFjaGVkIHVucmVhY2hhYmxlIGJsb2NrIGluIGluamVjdGFibGUgY29tcGlsZXIuJyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1ldGEudXNlVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE5vdGU6IGl0J3Mgc2FmZSB0byB1c2UgYG1ldGEudXNlVmFsdWVgIGluc3RlYWQgb2YgdGhlIGBVU0VfVkFMVUUgaW4gbWV0YWAgY2hlY2sgdXNlZCBmb3JcbiAgICAvLyBjbGllbnQgY29kZSBiZWNhdXNlIG1ldGEudXNlVmFsdWUgaXMgYW4gRXhwcmVzc2lvbiB3aGljaCB3aWxsIGJlIGRlZmluZWQgZXZlbiBpZiB0aGUgYWN0dWFsXG4gICAgLy8gdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgIGZhY3RvcnkgPSBtYWtlRm4obWV0YS51c2VWYWx1ZSk7XG4gIH0gZWxzZSBpZiAobWV0YS51c2VFeGlzdGluZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgLy8gdXNlRXhpc3RpbmcgaXMgYW4gYGluamVjdGAgY2FsbCBvbiB0aGUgZXhpc3RpbmcgdG9rZW4uXG4gICAgZmFjdG9yeSA9IG1ha2VGbihvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuaW5qZWN0KS5jYWxsRm4oW21ldGEudXNlRXhpc3RpbmddKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQSBzdHJpY3QgdHlwZSBpcyBjb21waWxlZCBhY2NvcmRpbmcgdG8gdXNlQ2xhc3Mgc2VtYW50aWNzLCBleGNlcHQgdGhlIGRlcGVuZGVuY2llcyBhcmVcbiAgICAvLyByZXF1aXJlZC5cbiAgICBpZiAobWV0YS5kZXBzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBjb21waWxhdGlvbiBvZiBhbiBpbmplY3RhYmxlIHJlcXVpcmVzIGRlcGVuZGVuY2llcy5gKTtcbiAgICB9XG4gICAgZmFjdG9yeSA9IGNvbXBpbGVGYWN0b3J5RnVuY3Rpb24oe1xuICAgICAgbmFtZTogbWV0YS5uYW1lLFxuICAgICAgZm5PckNsYXNzOiBtZXRhLnR5cGUsXG4gICAgICB1c2VOZXc6IHRydWUsXG4gICAgICBpbmplY3RGbjogSWRlbnRpZmllcnMuaW5qZWN0LFxuICAgICAgdXNlT3B0aW9uYWxQYXJhbTogdHJ1ZSxcbiAgICAgIGRlcHM6IG1ldGEuZGVwcyxcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gbWV0YS50eXBlO1xuICBjb25zdCBwcm92aWRlZEluID0gbWV0YS5wcm92aWRlZEluO1xuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuZGVmaW5lSW5qZWN0YWJsZSkuY2FsbEZuKFttYXBUb01hcEV4cHJlc3Npb24oXG4gICAgICB7dG9rZW4sIGZhY3RvcnksIHByb3ZpZGVkSW59KV0pO1xuICBjb25zdCB0eXBlID0gbmV3IG8uRXhwcmVzc2lvblR5cGUoXG4gICAgICBvLmltcG9ydEV4cHIoSWRlbnRpZmllcnMuSW5qZWN0YWJsZURlZiwgW25ldyBvLkV4cHJlc3Npb25UeXBlKG1ldGEudHlwZSldKSk7XG5cbiAgcmV0dXJuIHtcbiAgICAgIGV4cHJlc3Npb24sIHR5cGUsXG4gIH07XG59XG4iXX0=