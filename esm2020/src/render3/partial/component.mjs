/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as core from '../../core';
import { DEFAULT_INTERPOLATION_CONFIG } from '../../ml_parser/interpolation_config';
import * as o from '../../output/output_ast';
import { ParseLocation, ParseSourceFile, ParseSourceSpan } from '../../parse_util';
import { Identifiers as R3 } from '../r3_identifiers';
import { generateForwardRef } from '../util';
import { R3TemplateDependencyKind } from '../view/api';
import { createComponentType } from '../view/compiler';
import { DefinitionMap } from '../view/util';
import { createDirectiveDefinitionMap } from './directive';
import { toOptionalLiteralArray } from './util';
/**
 * Compile a component declaration defined by the `R3ComponentMetadata`.
 */
export function compileDeclareComponentFromMetadata(meta, template, additionalTemplateInfo) {
    const definitionMap = createComponentDefinitionMap(meta, template, additionalTemplateInfo);
    const expression = o.importExpr(R3.declareComponent).callFn([definitionMap.toLiteralMap()]);
    const type = createComponentType(meta);
    return { expression, type, statements: [] };
}
/**
 * Gathers the declaration fields for a component into a `DefinitionMap`.
 */
export function createComponentDefinitionMap(meta, template, templateInfo) {
    const definitionMap = createDirectiveDefinitionMap(meta);
    definitionMap.set('template', getTemplateExpression(template, templateInfo));
    if (templateInfo.isInline) {
        definitionMap.set('isInline', o.literal(true));
    }
    definitionMap.set('styles', toOptionalLiteralArray(meta.styles, o.literal));
    definitionMap.set('dependencies', compileUsedDependenciesMetadata(meta));
    definitionMap.set('viewProviders', meta.viewProviders);
    definitionMap.set('animations', meta.animations);
    if (meta.changeDetection !== undefined) {
        definitionMap.set('changeDetection', o.importExpr(R3.ChangeDetectionStrategy)
            .prop(core.ChangeDetectionStrategy[meta.changeDetection]));
    }
    if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
        definitionMap.set('encapsulation', o.importExpr(R3.ViewEncapsulation).prop(core.ViewEncapsulation[meta.encapsulation]));
    }
    if (meta.interpolation !== DEFAULT_INTERPOLATION_CONFIG) {
        definitionMap.set('interpolation', o.literalArr([o.literal(meta.interpolation.start), o.literal(meta.interpolation.end)]));
    }
    if (template.preserveWhitespaces === true) {
        definitionMap.set('preserveWhitespaces', o.literal(true));
    }
    return definitionMap;
}
function getTemplateExpression(template, templateInfo) {
    // If the template has been defined using a direct literal, we use that expression directly
    // without any modifications. This is ensures proper source mapping from the partially
    // compiled code to the source file declaring the template. Note that this does not capture
    // template literals referenced indirectly through an identifier.
    if (templateInfo.inlineTemplateLiteralExpression !== null) {
        return templateInfo.inlineTemplateLiteralExpression;
    }
    // If the template is defined inline but not through a literal, the template has been resolved
    // through static interpretation. We create a literal but cannot provide any source span. Note
    // that we cannot use the expression defining the template because the linker expects the template
    // to be defined as a literal in the declaration.
    if (templateInfo.isInline) {
        return o.literal(templateInfo.content, null, null);
    }
    // The template is external so we must synthesize an expression node with
    // the appropriate source-span.
    const contents = templateInfo.content;
    const file = new ParseSourceFile(contents, templateInfo.sourceUrl);
    const start = new ParseLocation(file, 0, 0, 0);
    const end = computeEndLocation(file, contents);
    const span = new ParseSourceSpan(start, end);
    return o.literal(contents, null, span);
}
function computeEndLocation(file, contents) {
    const length = contents.length;
    let lineStart = 0;
    let lastLineStart = 0;
    let line = 0;
    do {
        lineStart = contents.indexOf('\n', lastLineStart);
        if (lineStart !== -1) {
            lastLineStart = lineStart + 1;
            line++;
        }
    } while (lineStart !== -1);
    return new ParseLocation(file, length, line, length - lastLineStart);
}
function compileUsedDependenciesMetadata(meta) {
    const wrapType = meta.declarationListEmitMode !== 0 /* Direct */ ?
        generateForwardRef :
        (expr) => expr;
    return toOptionalLiteralArray(meta.declarations, decl => {
        switch (decl.kind) {
            case R3TemplateDependencyKind.Directive:
                const dirMeta = new DefinitionMap();
                dirMeta.set('kind', o.literal(decl.isComponent ? 'component' : 'directive'));
                dirMeta.set('type', wrapType(decl.type));
                dirMeta.set('selector', o.literal(decl.selector));
                dirMeta.set('inputs', toOptionalLiteralArray(decl.inputs, o.literal));
                dirMeta.set('outputs', toOptionalLiteralArray(decl.outputs, o.literal));
                dirMeta.set('exportAs', toOptionalLiteralArray(decl.exportAs, o.literal));
                return dirMeta.toLiteralMap();
            case R3TemplateDependencyKind.Pipe:
                const pipeMeta = new DefinitionMap();
                pipeMeta.set('kind', o.literal('pipe'));
                pipeMeta.set('type', wrapType(decl.type));
                pipeMeta.set('name', o.literal(decl.name));
                return pipeMeta.toLiteralMap();
            case R3TemplateDependencyKind.NgModule:
                const ngModuleMeta = new DefinitionMap();
                ngModuleMeta.set('kind', o.literal('ngmodule'));
                ngModuleMeta.set('type', wrapType(decl.type));
                return ngModuleMeta.toLiteralMap();
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcGFydGlhbC9jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxLQUFLLElBQUksTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFDLDRCQUE0QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDbEYsT0FBTyxLQUFLLENBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRixPQUFPLEVBQUMsV0FBVyxJQUFJLEVBQUUsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBQyxrQkFBa0IsRUFBdUIsTUFBTSxTQUFTLENBQUM7QUFDakUsT0FBTyxFQUErQyx3QkFBd0IsRUFBK0IsTUFBTSxhQUFhLENBQUM7QUFDakksT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFckQsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUczQyxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDekQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBK0I5Qzs7R0FFRztBQUNILE1BQU0sVUFBVSxtQ0FBbUMsQ0FDL0MsSUFBdUQsRUFBRSxRQUF3QixFQUNqRixzQkFBb0Q7SUFDdEQsTUFBTSxhQUFhLEdBQUcsNEJBQTRCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0lBRTNGLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsYUFB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VUFBVSxFQUFFLHNCQUFzQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQzFFLE9BQU8sT0FBTyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hDLEtBQUssd0JBQXdCLENBQUMsSUFBSTtnQkFDaEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxhQUFhLEVBQW1DLENBQUM7Z0JBQ3RFLFFBQVEsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDeEMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxPQUFPLFFBQVEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNqQyxLQUFLLHdCQUF3QixDQUFDLFFBQVE7Z0JBQ3BDLE1BQU0sWUFBWSxHQUFHLElBQUksYUFBYSxFQUF1QyxDQUFDO2dCQUM5RSxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDOUMsT0FBTyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDdEM7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0RFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUd9IGZyb20gJy4uLy4uL21sX3BhcnNlci9pbnRlcnBvbGF0aW9uX2NvbmZpZyc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VMb2NhdGlvbiwgUGFyc2VTb3VyY2VGaWxlLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtJZGVudGlmaWVycyBhcyBSM30gZnJvbSAnLi4vcjNfaWRlbnRpZmllcnMnO1xuaW1wb3J0IHtnZW5lcmF0ZUZvcndhcmRSZWYsIFIzQ29tcGlsZWRFeHByZXNzaW9ufSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7RGVjbGFyYXRpb25MaXN0RW1pdE1vZGUsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZCwgUjNUZW1wbGF0ZURlcGVuZGVuY3lNZXRhZGF0YX0gZnJvbSAnLi4vdmlldy9hcGknO1xuaW1wb3J0IHtjcmVhdGVDb21wb25lbnRUeXBlfSBmcm9tICcuLi92aWV3L2NvbXBpbGVyJztcbmltcG9ydCB7UGFyc2VkVGVtcGxhdGV9IGZyb20gJy4uL3ZpZXcvdGVtcGxhdGUnO1xuaW1wb3J0IHtEZWZpbml0aW9uTWFwfSBmcm9tICcuLi92aWV3L3V0aWwnO1xuXG5pbXBvcnQge1IzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhLCBSM0RlY2xhcmVEaXJlY3RpdmVEZXBlbmRlbmN5TWV0YWRhdGEsIFIzRGVjbGFyZU5nTW9kdWxlRGVwZW5kZW5jeU1ldGFkYXRhLCBSM0RlY2xhcmVQaXBlRGVwZW5kZW5jeU1ldGFkYXRhfSBmcm9tICcuL2FwaSc7XG5pbXBvcnQge2NyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXB9IGZyb20gJy4vZGlyZWN0aXZlJztcbmltcG9ydCB7dG9PcHRpb25hbExpdGVyYWxBcnJheX0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGludGVyZmFjZSBEZWNsYXJlQ29tcG9uZW50VGVtcGxhdGVJbmZvIHtcbiAgLyoqXG4gICAqIFRoZSBzdHJpbmcgY29udGVudHMgb2YgdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGlzIHRoZSBcImxvZ2ljYWxcIiB0ZW1wbGF0ZSBzdHJpbmcsIGFmdGVyIGV4cGFuc2lvbiBvZiBhbnkgZXNjYXBlZCBjaGFyYWN0ZXJzIChmb3IgaW5saW5lXG4gICAqIHRlbXBsYXRlcykuIFRoaXMgbWF5IGRpZmZlciBmcm9tIHRoZSBhY3R1YWwgdGVtcGxhdGUgYnl0ZXMgYXMgdGhleSBhcHBlYXIgaW4gdGhlIC50cyBmaWxlLlxuICAgKi9cbiAgY29udGVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBIGZ1bGwgcGF0aCB0byB0aGUgZmlsZSB3aGljaCBjb250YWlucyB0aGUgdGVtcGxhdGUuXG4gICAqXG4gICAqIFRoaXMgY2FuIGJlIGVpdGhlciB0aGUgb3JpZ2luYWwgLnRzIGZpbGUgaWYgdGhlIHRlbXBsYXRlIGlzIGlubGluZSwgb3IgdGhlIC5odG1sIGZpbGUgaWYgYW5cbiAgICogZXh0ZXJuYWwgZmlsZSB3YXMgdXNlZC5cbiAgICovXG4gIHNvdXJjZVVybDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSB0ZW1wbGF0ZSB3YXMgaW5saW5lICh1c2luZyBgdGVtcGxhdGVgKSBvciBleHRlcm5hbCAodXNpbmcgYHRlbXBsYXRlVXJsYCkuXG4gICAqL1xuICBpc0lubGluZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogSWYgdGhlIHRlbXBsYXRlIHdhcyBkZWZpbmVkIGlubGluZSBieSBhIGRpcmVjdCBzdHJpbmcgbGl0ZXJhbCwgdGhlbiB0aGlzIGlzIHRoYXQgbGl0ZXJhbFxuICAgKiBleHByZXNzaW9uLiBPdGhlcndpc2UgYG51bGxgLCBpZiB0aGUgdGVtcGxhdGUgd2FzIG5vdCBkZWZpbmVkIGlubGluZSBvciB3YXMgbm90IGEgbGl0ZXJhbC5cbiAgICovXG4gIGlubGluZVRlbXBsYXRlTGl0ZXJhbEV4cHJlc3Npb246IG8uRXhwcmVzc2lvbnxudWxsO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBjb21wb25lbnQgZGVjbGFyYXRpb24gZGVmaW5lZCBieSB0aGUgYFIzQ29tcG9uZW50TWV0YWRhdGFgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZURlY2xhcmVDb21wb25lbnRGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNDb21wb25lbnRNZXRhZGF0YTxSM1RlbXBsYXRlRGVwZW5kZW5jeU1ldGFkYXRhPiwgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlLFxuICAgIGFkZGl0aW9uYWxUZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8pOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKG1ldGEsIHRlbXBsYXRlLCBhZGRpdGlvbmFsVGVtcGxhdGVJbmZvKTtcblxuICBjb25zdCBleHByZXNzaW9uID0gby5pbXBvcnRFeHByKFIzLmRlY2xhcmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0pO1xuICBjb25zdCB0eXBlID0gY3JlYXRlQ29tcG9uZW50VHlwZShtZXRhKTtcblxuICByZXR1cm4ge2V4cHJlc3Npb24sIHR5cGUsIHN0YXRlbWVudHM6IFtdfTtcbn1cblxuLyoqXG4gKiBHYXRoZXJzIHRoZSBkZWNsYXJhdGlvbiBmaWVsZHMgZm9yIGEgY29tcG9uZW50IGludG8gYSBgRGVmaW5pdGlvbk1hcGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnREZWZpbml0aW9uTWFwKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3lNZXRhZGF0YT4sIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSxcbiAgICB0ZW1wbGF0ZUluZm86IERlY2xhcmVDb21wb25lbnRUZW1wbGF0ZUluZm8pOiBEZWZpbml0aW9uTWFwPFIzRGVjbGFyZUNvbXBvbmVudE1ldGFkYXRhPiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXA6IERlZmluaXRpb25NYXA8UjNEZWNsYXJlQ29tcG9uZW50TWV0YWRhdGE+ID1cbiAgICAgIGNyZWF0ZURpcmVjdGl2ZURlZmluaXRpb25NYXAobWV0YSk7XG5cbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3RlbXBsYXRlJywgZ2V0VGVtcGxhdGVFeHByZXNzaW9uKHRlbXBsYXRlLCB0ZW1wbGF0ZUluZm8pKTtcbiAgaWYgKHRlbXBsYXRlSW5mby5pc0lubGluZSkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdpc0lubGluZScsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgdG9PcHRpb25hbExpdGVyYWxBcnJheShtZXRhLnN0eWxlcywgby5saXRlcmFsKSk7XG4gIGRlZmluaXRpb25NYXAuc2V0KCdkZXBlbmRlbmNpZXMnLCBjb21waWxlVXNlZERlcGVuZGVuY2llc01ldGFkYXRhKG1ldGEpKTtcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3ZpZXdQcm92aWRlcnMnLCBtZXRhLnZpZXdQcm92aWRlcnMpO1xuICBkZWZpbml0aW9uTWFwLnNldCgnYW5pbWF0aW9ucycsIG1ldGEuYW5pbWF0aW9ucyk7XG5cbiAgaWYgKG1ldGEuY2hhbmdlRGV0ZWN0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldChcbiAgICAgICAgJ2NoYW5nZURldGVjdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5DaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSlcbiAgICAgICAgICAgIC5wcm9wKGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3lbbWV0YS5jaGFuZ2VEZXRlY3Rpb25dKSk7XG4gIH1cbiAgaWYgKG1ldGEuZW5jYXBzdWxhdGlvbiAhPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAnZW5jYXBzdWxhdGlvbicsXG4gICAgICAgIG8uaW1wb3J0RXhwcihSMy5WaWV3RW5jYXBzdWxhdGlvbikucHJvcChjb3JlLlZpZXdFbmNhcHN1bGF0aW9uW21ldGEuZW5jYXBzdWxhdGlvbl0pKTtcbiAgfVxuICBpZiAobWV0YS5pbnRlcnBvbGF0aW9uICE9PSBERUZBVUxUX0lOVEVSUE9MQVRJT05fQ09ORklHKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdpbnRlcnBvbGF0aW9uJyxcbiAgICAgICAgby5saXRlcmFsQXJyKFtvLmxpdGVyYWwobWV0YS5pbnRlcnBvbGF0aW9uLnN0YXJ0KSwgby5saXRlcmFsKG1ldGEuaW50ZXJwb2xhdGlvbi5lbmQpXSkpO1xuICB9XG5cbiAgaWYgKHRlbXBsYXRlLnByZXNlcnZlV2hpdGVzcGFjZXMgPT09IHRydWUpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgncHJlc2VydmVXaGl0ZXNwYWNlcycsIG8ubGl0ZXJhbCh0cnVlKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVFeHByZXNzaW9uKFxuICAgIHRlbXBsYXRlOiBQYXJzZWRUZW1wbGF0ZSwgdGVtcGxhdGVJbmZvOiBEZWNsYXJlQ29tcG9uZW50VGVtcGxhdGVJbmZvKTogby5FeHByZXNzaW9uIHtcbiAgLy8gSWYgdGhlIHRlbXBsYXRlIGhhcyBiZWVuIGRlZmluZWQgdXNpbmcgYSBkaXJlY3QgbGl0ZXJhbCwgd2UgdXNlIHRoYXQgZXhwcmVzc2lvbiBkaXJlY3RseVxuICAvLyB3aXRob3V0IGFueSBtb2RpZmljYXRpb25zLiBUaGlzIGlzIGVuc3VyZXMgcHJvcGVyIHNvdXJjZSBtYXBwaW5nIGZyb20gdGhlIHBhcnRpYWxseVxuICAvLyBjb21waWxlZCBjb2RlIHRvIHRoZSBzb3VyY2UgZmlsZSBkZWNsYXJpbmcgdGhlIHRlbXBsYXRlLiBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBjYXB0dXJlXG4gIC8vIHRlbXBsYXRlIGxpdGVyYWxzIHJlZmVyZW5jZWQgaW5kaXJlY3RseSB0aHJvdWdoIGFuIGlkZW50aWZpZXIuXG4gIGlmICh0ZW1wbGF0ZUluZm8uaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbiAhPT0gbnVsbCkge1xuICAgIHJldHVybiB0ZW1wbGF0ZUluZm8uaW5saW5lVGVtcGxhdGVMaXRlcmFsRXhwcmVzc2lvbjtcbiAgfVxuXG4gIC8vIElmIHRoZSB0ZW1wbGF0ZSBpcyBkZWZpbmVkIGlubGluZSBidXQgbm90IHRocm91Z2ggYSBsaXRlcmFsLCB0aGUgdGVtcGxhdGUgaGFzIGJlZW4gcmVzb2x2ZWRcbiAgLy8gdGhyb3VnaCBzdGF0aWMgaW50ZXJwcmV0YXRpb24uIFdlIGNyZWF0ZSBhIGxpdGVyYWwgYnV0IGNhbm5vdCBwcm92aWRlIGFueSBzb3VyY2Ugc3Bhbi4gTm90ZVxuICAvLyB0aGF0IHdlIGNhbm5vdCB1c2UgdGhlIGV4cHJlc3Npb24gZGVmaW5pbmcgdGhlIHRlbXBsYXRlIGJlY2F1c2UgdGhlIGxpbmtlciBleHBlY3RzIHRoZSB0ZW1wbGF0ZVxuICAvLyB0byBiZSBkZWZpbmVkIGFzIGEgbGl0ZXJhbCBpbiB0aGUgZGVjbGFyYXRpb24uXG4gIGlmICh0ZW1wbGF0ZUluZm8uaXNJbmxpbmUpIHtcbiAgICByZXR1cm4gby5saXRlcmFsKHRlbXBsYXRlSW5mby5jb250ZW50LCBudWxsLCBudWxsKTtcbiAgfVxuXG4gIC8vIFRoZSB0ZW1wbGF0ZSBpcyBleHRlcm5hbCBzbyB3ZSBtdXN0IHN5bnRoZXNpemUgYW4gZXhwcmVzc2lvbiBub2RlIHdpdGhcbiAgLy8gdGhlIGFwcHJvcHJpYXRlIHNvdXJjZS1zcGFuLlxuICBjb25zdCBjb250ZW50cyA9IHRlbXBsYXRlSW5mby5jb250ZW50O1xuICBjb25zdCBmaWxlID0gbmV3IFBhcnNlU291cmNlRmlsZShjb250ZW50cywgdGVtcGxhdGVJbmZvLnNvdXJjZVVybCk7XG4gIGNvbnN0IHN0YXJ0ID0gbmV3IFBhcnNlTG9jYXRpb24oZmlsZSwgMCwgMCwgMCk7XG4gIGNvbnN0IGVuZCA9IGNvbXB1dGVFbmRMb2NhdGlvbihmaWxlLCBjb250ZW50cyk7XG4gIGNvbnN0IHNwYW4gPSBuZXcgUGFyc2VTb3VyY2VTcGFuKHN0YXJ0LCBlbmQpO1xuICByZXR1cm4gby5saXRlcmFsKGNvbnRlbnRzLCBudWxsLCBzcGFuKTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUVuZExvY2F0aW9uKGZpbGU6IFBhcnNlU291cmNlRmlsZSwgY29udGVudHM6IHN0cmluZyk6IFBhcnNlTG9jYXRpb24ge1xuICBjb25zdCBsZW5ndGggPSBjb250ZW50cy5sZW5ndGg7XG4gIGxldCBsaW5lU3RhcnQgPSAwO1xuICBsZXQgbGFzdExpbmVTdGFydCA9IDA7XG4gIGxldCBsaW5lID0gMDtcbiAgZG8ge1xuICAgIGxpbmVTdGFydCA9IGNvbnRlbnRzLmluZGV4T2YoJ1xcbicsIGxhc3RMaW5lU3RhcnQpO1xuICAgIGlmIChsaW5lU3RhcnQgIT09IC0xKSB7XG4gICAgICBsYXN0TGluZVN0YXJ0ID0gbGluZVN0YXJ0ICsgMTtcbiAgICAgIGxpbmUrKztcbiAgICB9XG4gIH0gd2hpbGUgKGxpbmVTdGFydCAhPT0gLTEpO1xuXG4gIHJldHVybiBuZXcgUGFyc2VMb2NhdGlvbihmaWxlLCBsZW5ndGgsIGxpbmUsIGxlbmd0aCAtIGxhc3RMaW5lU3RhcnQpO1xufVxuXG5mdW5jdGlvbiBjb21waWxlVXNlZERlcGVuZGVuY2llc01ldGFkYXRhKG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGE8UjNUZW1wbGF0ZURlcGVuZGVuY3lNZXRhZGF0YT4pOlxuICAgIG8uTGl0ZXJhbEFycmF5RXhwcnxudWxsIHtcbiAgY29uc3Qgd3JhcFR5cGUgPSBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlICE9PSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5EaXJlY3QgP1xuICAgICAgZ2VuZXJhdGVGb3J3YXJkUmVmIDpcbiAgICAgIChleHByOiBvLkV4cHJlc3Npb24pID0+IGV4cHI7XG5cbiAgcmV0dXJuIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkobWV0YS5kZWNsYXJhdGlvbnMsIGRlY2wgPT4ge1xuICAgIHN3aXRjaCAoZGVjbC5raW5kKSB7XG4gICAgICBjYXNlIFIzVGVtcGxhdGVEZXBlbmRlbmN5S2luZC5EaXJlY3RpdmU6XG4gICAgICAgIGNvbnN0IGRpck1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVEaXJlY3RpdmVEZXBlbmRlbmN5TWV0YWRhdGE+KCk7XG4gICAgICAgIGRpck1ldGEuc2V0KCdraW5kJywgby5saXRlcmFsKGRlY2wuaXNDb21wb25lbnQgPyAnY29tcG9uZW50JyA6ICdkaXJlY3RpdmUnKSk7XG4gICAgICAgIGRpck1ldGEuc2V0KCd0eXBlJywgd3JhcFR5cGUoZGVjbC50eXBlKSk7XG4gICAgICAgIGRpck1ldGEuc2V0KCdzZWxlY3RvcicsIG8ubGl0ZXJhbChkZWNsLnNlbGVjdG9yKSk7XG4gICAgICAgIGRpck1ldGEuc2V0KCdpbnB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRlY2wuaW5wdXRzLCBvLmxpdGVyYWwpKTtcbiAgICAgICAgZGlyTWV0YS5zZXQoJ291dHB1dHMnLCB0b09wdGlvbmFsTGl0ZXJhbEFycmF5KGRlY2wub3V0cHV0cywgby5saXRlcmFsKSk7XG4gICAgICAgIGRpck1ldGEuc2V0KCdleHBvcnRBcycsIHRvT3B0aW9uYWxMaXRlcmFsQXJyYXkoZGVjbC5leHBvcnRBcywgby5saXRlcmFsKSk7XG4gICAgICAgIHJldHVybiBkaXJNZXRhLnRvTGl0ZXJhbE1hcCgpO1xuICAgICAgY2FzZSBSM1RlbXBsYXRlRGVwZW5kZW5jeUtpbmQuUGlwZTpcbiAgICAgICAgY29uc3QgcGlwZU1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVQaXBlRGVwZW5kZW5jeU1ldGFkYXRhPigpO1xuICAgICAgICBwaXBlTWV0YS5zZXQoJ2tpbmQnLCBvLmxpdGVyYWwoJ3BpcGUnKSk7XG4gICAgICAgIHBpcGVNZXRhLnNldCgndHlwZScsIHdyYXBUeXBlKGRlY2wudHlwZSkpO1xuICAgICAgICBwaXBlTWV0YS5zZXQoJ25hbWUnLCBvLmxpdGVyYWwoZGVjbC5uYW1lKSk7XG4gICAgICAgIHJldHVybiBwaXBlTWV0YS50b0xpdGVyYWxNYXAoKTtcbiAgICAgIGNhc2UgUjNUZW1wbGF0ZURlcGVuZGVuY3lLaW5kLk5nTW9kdWxlOlxuICAgICAgICBjb25zdCBuZ01vZHVsZU1ldGEgPSBuZXcgRGVmaW5pdGlvbk1hcDxSM0RlY2xhcmVOZ01vZHVsZURlcGVuZGVuY3lNZXRhZGF0YT4oKTtcbiAgICAgICAgbmdNb2R1bGVNZXRhLnNldCgna2luZCcsIG8ubGl0ZXJhbCgnbmdtb2R1bGUnKSk7XG4gICAgICAgIG5nTW9kdWxlTWV0YS5zZXQoJ3R5cGUnLCB3cmFwVHlwZShkZWNsLnR5cGUpKTtcbiAgICAgICAgcmV0dXJuIG5nTW9kdWxlTWV0YS50b0xpdGVyYWxNYXAoKTtcbiAgICB9XG4gIH0pO1xufVxuIl19