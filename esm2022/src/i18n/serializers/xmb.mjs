/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { decimalDigest } from '../digest';
import { Serializer, SimplePlaceholderMapper } from './serializer';
import * as xml from './xml_helper';
const _MESSAGES_TAG = 'messagebundle';
const _MESSAGE_TAG = 'msg';
const _PLACEHOLDER_TAG = 'ph';
const _EXAMPLE_TAG = 'ex';
const _SOURCE_TAG = 'source';
const _DOCTYPE = `<!ELEMENT messagebundle (msg)*>
<!ATTLIST messagebundle class CDATA #IMPLIED>

<!ELEMENT msg (#PCDATA|ph|source)*>
<!ATTLIST msg id CDATA #IMPLIED>
<!ATTLIST msg seq CDATA #IMPLIED>
<!ATTLIST msg name CDATA #IMPLIED>
<!ATTLIST msg desc CDATA #IMPLIED>
<!ATTLIST msg meaning CDATA #IMPLIED>
<!ATTLIST msg obsolete (obsolete) #IMPLIED>
<!ATTLIST msg xml:space (default|preserve) "default">
<!ATTLIST msg is_hidden CDATA #IMPLIED>

<!ELEMENT source (#PCDATA)>

<!ELEMENT ph (#PCDATA|ex)*>
<!ATTLIST ph name CDATA #REQUIRED>

<!ELEMENT ex (#PCDATA)>`;
export class Xmb extends Serializer {
    write(messages, locale) {
        const exampleVisitor = new ExampleVisitor();
        const visitor = new _Visitor();
        let rootNode = new xml.Tag(_MESSAGES_TAG);
        messages.forEach(message => {
            const attrs = { id: message.id };
            if (message.description) {
                attrs['desc'] = message.description;
            }
            if (message.meaning) {
                attrs['meaning'] = message.meaning;
            }
            let sourceTags = [];
            message.sources.forEach((source) => {
                sourceTags.push(new xml.Tag(_SOURCE_TAG, {}, [new xml.Text(`${source.filePath}:${source.startLine}${source.endLine !== source.startLine ? ',' + source.endLine : ''}`)]));
            });
            rootNode.children.push(new xml.CR(2), new xml.Tag(_MESSAGE_TAG, attrs, [...sourceTags, ...visitor.serialize(message.nodes)]));
        });
        rootNode.children.push(new xml.CR());
        return xml.serialize([
            new xml.Declaration({ version: '1.0', encoding: 'UTF-8' }),
            new xml.CR(),
            new xml.Doctype(_MESSAGES_TAG, _DOCTYPE),
            new xml.CR(),
            exampleVisitor.addDefaultExamples(rootNode),
            new xml.CR(),
        ]);
    }
    load(content, url) {
        throw new Error('Unsupported');
    }
    digest(message) {
        return digest(message);
    }
    createNameMapper(message) {
        return new SimplePlaceholderMapper(message, toPublicName);
    }
}
class _Visitor {
    visitText(text, context) {
        return [new xml.Text(text.value)];
    }
    visitContainer(container, context) {
        const nodes = [];
        container.children.forEach((node) => nodes.push(...node.visit(this)));
        return nodes;
    }
    visitIcu(icu, context) {
        const nodes = [new xml.Text(`{${icu.expressionPlaceholder}, ${icu.type}, `)];
        Object.keys(icu.cases).forEach((c) => {
            nodes.push(new xml.Text(`${c} {`), ...icu.cases[c].visit(this), new xml.Text(`} `));
        });
        nodes.push(new xml.Text(`}`));
        return nodes;
    }
    visitTagPlaceholder(ph, context) {
        const startTagAsText = new xml.Text(`<${ph.tag}>`);
        const startEx = new xml.Tag(_EXAMPLE_TAG, {}, [startTagAsText]);
        // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
        const startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.startName }, [startEx, startTagAsText]);
        if (ph.isVoid) {
            // void tags have no children nor closing tags
            return [startTagPh];
        }
        const closeTagAsText = new xml.Text(`</${ph.tag}>`);
        const closeEx = new xml.Tag(_EXAMPLE_TAG, {}, [closeTagAsText]);
        // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
        const closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.closeName }, [closeEx, closeTagAsText]);
        return [startTagPh, ...this.serialize(ph.children), closeTagPh];
    }
    visitPlaceholder(ph, context) {
        const interpolationAsText = new xml.Text(`{{${ph.value}}}`);
        // Example tag needs to be not-empty for TC.
        const exTag = new xml.Tag(_EXAMPLE_TAG, {}, [interpolationAsText]);
        return [
            // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
            new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag, interpolationAsText])
        ];
    }
    visitBlockPlaceholder(ph, context) {
        const startAsText = new xml.Text(`@${ph.name}`);
        const startEx = new xml.Tag(_EXAMPLE_TAG, {}, [startAsText]);
        // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
        const startTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.startName }, [startEx, startAsText]);
        const closeAsText = new xml.Text(`}`);
        const closeEx = new xml.Tag(_EXAMPLE_TAG, {}, [closeAsText]);
        // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
        const closeTagPh = new xml.Tag(_PLACEHOLDER_TAG, { name: ph.closeName }, [closeEx, closeAsText]);
        return [startTagPh, ...this.serialize(ph.children), closeTagPh];
    }
    visitIcuPlaceholder(ph, context) {
        const icuExpression = ph.value.expression;
        const icuType = ph.value.type;
        const icuCases = Object.keys(ph.value.cases).map((value) => value + ' {...}').join(' ');
        const icuAsText = new xml.Text(`{${icuExpression}, ${icuType}, ${icuCases}}`);
        const exTag = new xml.Tag(_EXAMPLE_TAG, {}, [icuAsText]);
        return [
            // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
            new xml.Tag(_PLACEHOLDER_TAG, { name: ph.name }, [exTag, icuAsText])
        ];
    }
    serialize(nodes) {
        return [].concat(...nodes.map(node => node.visit(this)));
    }
}
export function digest(message) {
    return decimalDigest(message);
}
// TC requires at least one non-empty example on placeholders
class ExampleVisitor {
    addDefaultExamples(node) {
        node.visit(this);
        return node;
    }
    visitTag(tag) {
        if (tag.name === _PLACEHOLDER_TAG) {
            if (!tag.children || tag.children.length == 0) {
                const exText = new xml.Text(tag.attrs['name'] || '...');
                tag.children = [new xml.Tag(_EXAMPLE_TAG, {}, [exText])];
            }
        }
        else if (tag.children) {
            tag.children.forEach(node => node.visit(this));
        }
    }
    visitText(text) { }
    visitDeclaration(decl) { }
    visitDoctype(doctype) { }
}
// XMB/XTB placeholders can only contain A-Z, 0-9 and _
export function toPublicName(internalName) {
    return internalName.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1iLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vc2VyaWFsaXplcnMveG1iLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFHeEMsT0FBTyxFQUFvQixVQUFVLEVBQUUsdUJBQXVCLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDcEYsT0FBTyxLQUFLLEdBQUcsTUFBTSxjQUFjLENBQUM7QUFFcEMsTUFBTSxhQUFhLEdBQUcsZUFBZSxDQUFDO0FBQ3RDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUMzQixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUM5QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDO0FBRTdCLE1BQU0sUUFBUSxHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7d0JBa0JPLENBQUM7QUFFekIsTUFBTSxPQUFPLEdBQUksU0FBUSxVQUFVO0lBQ3hCLEtBQUssQ0FBQyxRQUF3QixFQUFFLE1BQW1CO1FBQzFELE1BQU0sY0FBYyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUMvQixJQUFJLFFBQVEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUN6QixNQUFNLEtBQUssR0FBMEIsRUFBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBQyxDQUFDO1lBRXRELElBQUksT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUN4QixLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FB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QUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDO2dCQUN4RCxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0QsQ0FBQztRQUNILENBQUM7YUFBTSxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN4QixHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNqRCxDQUFDO0lBQ0gsQ0FBQztJQUVELFNBQVMsQ0FBQyxJQUFjLElBQVMsQ0FBQztJQUNsQyxnQkFBZ0IsQ0FBQyxJQUFxQixJQUFTLENBQUM7SUFDaEQsWUFBWSxDQUFDLE9BQW9CLElBQVMsQ0FBQztDQUM1QztBQUVELHVEQUF1RDtBQUN2RCxNQUFNLFVBQVUsWUFBWSxDQUFDLFlBQW9CO0lBQy9DLE9BQU8sWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDaEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2RlY2ltYWxEaWdlc3R9IGZyb20gJy4uL2RpZ2VzdCc7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uL2kxOG5fYXN0JztcblxuaW1wb3J0IHtQbGFjZWhvbGRlck1hcHBlciwgU2VyaWFsaXplciwgU2ltcGxlUGxhY2Vob2xkZXJNYXBwZXJ9IGZyb20gJy4vc2VyaWFsaXplcic7XG5pbXBvcnQgKiBhcyB4bWwgZnJvbSAnLi94bWxfaGVscGVyJztcblxuY29uc3QgX01FU1NBR0VTX1RBRyA9ICdtZXNzYWdlYnVuZGxlJztcbmNvbnN0IF9NRVNTQUdFX1RBRyA9ICdtc2cnO1xuY29uc3QgX1BMQUNFSE9MREVSX1RBRyA9ICdwaCc7XG5jb25zdCBfRVhBTVBMRV9UQUcgPSAnZXgnO1xuY29uc3QgX1NPVVJDRV9UQUcgPSAnc291cmNlJztcblxuY29uc3QgX0RPQ1RZUEUgPSBgPCFFTEVNRU5UIG1lc3NhZ2VidW5kbGUgKG1zZykqPlxuPCFBVFRMSVNUIG1lc3NhZ2VidW5kbGUgY2xhc3MgQ0RBVEEgI0lNUExJRUQ+XG5cbjwhRUxFTUVOVCBtc2cgKCNQQ0RBVEF8cGh8c291cmNlKSo+XG48IUFUVExJU1QgbXNnIGlkIENEQVRBICNJTVBMSUVEPlxuPCFBVFRMSVNUIG1zZyBzZXEgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG5hbWUgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIGRlc2MgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG1lYW5pbmcgQ0RBVEEgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIG9ic29sZXRlIChvYnNvbGV0ZSkgI0lNUExJRUQ+XG48IUFUVExJU1QgbXNnIHhtbDpzcGFjZSAoZGVmYXVsdHxwcmVzZXJ2ZSkgXCJkZWZhdWx0XCI+XG48IUFUVExJU1QgbXNnIGlzX2hpZGRlbiBDREFUQSAjSU1QTElFRD5cblxuPCFFTEVNRU5UIHNvdXJjZSAoI1BDREFUQSk+XG5cbjwhRUxFTUVOVCBwaCAoI1BDREFUQXxleCkqPlxuPCFBVFRMSVNUIHBoIG5hbWUgQ0RBVEEgI1JFUVVJUkVEPlxuXG48IUVMRU1FTlQgZXggKCNQQ0RBVEEpPmA7XG5cbmV4cG9ydCBjbGFzcyBYbWIgZXh0ZW5kcyBTZXJpYWxpemVyIHtcbiAgb3ZlcnJpZGUgd3JpdGUobWVzc2FnZXM6IGkxOG4uTWVzc2FnZVtdLCBsb2NhbGU6IHN0cmluZ3xudWxsKTogc3RyaW5nIHtcbiAgICBjb25zdCBleGFtcGxlVmlzaXRvciA9IG5ldyBFeGFtcGxlVmlzaXRvcigpO1xuICAgIGNvbnN0IHZpc2l0b3IgPSBuZXcgX1Zpc2l0b3IoKTtcbiAgICBsZXQgcm9vdE5vZGUgPSBuZXcgeG1sLlRhZyhfTUVTU0FHRVNfVEFHKTtcblxuICAgIG1lc3NhZ2VzLmZvckVhY2gobWVzc2FnZSA9PiB7XG4gICAgICBjb25zdCBhdHRyczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge2lkOiBtZXNzYWdlLmlkfTtcblxuICAgICAgaWYgKG1lc3NhZ2UuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgYXR0cnNbJ2Rlc2MnXSA9IG1lc3NhZ2UuZGVzY3JpcHRpb247XG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlLm1lYW5pbmcpIHtcbiAgICAgICAgYXR0cnNbJ21lYW5pbmcnXSA9IG1lc3NhZ2UubWVhbmluZztcbiAgICAgIH1cblxuICAgICAgbGV0IHNvdXJjZVRhZ3M6IHhtbC5UYWdbXSA9IFtdO1xuICAgICAgbWVzc2FnZS5zb3VyY2VzLmZvckVhY2goKHNvdXJjZTogaTE4bi5NZXNzYWdlU3BhbikgPT4ge1xuICAgICAgICBzb3VyY2VUYWdzLnB1c2gobmV3IHhtbC5UYWcoXG4gICAgICAgICAgICBfU09VUkNFX1RBRywge30sXG4gICAgICAgICAgICBbbmV3IHhtbC5UZXh0KGAke3NvdXJjZS5maWxlUGF0aH06JHtzb3VyY2Uuc3RhcnRMaW5lfSR7XG4gICAgICAgICAgICAgICAgc291cmNlLmVuZExpbmUgIT09IHNvdXJjZS5zdGFydExpbmUgPyAnLCcgKyBzb3VyY2UuZW5kTGluZSA6ICcnfWApXSkpO1xuICAgICAgfSk7XG5cbiAgICAgIHJvb3ROb2RlLmNoaWxkcmVuLnB1c2goXG4gICAgICAgICAgbmV3IHhtbC5DUigyKSxcbiAgICAgICAgICBuZXcgeG1sLlRhZyhfTUVTU0FHRV9UQUcsIGF0dHJzLCBbLi4uc291cmNlVGFncywgLi4udmlzaXRvci5zZXJpYWxpemUobWVzc2FnZS5ub2RlcyldKSk7XG4gICAgfSk7XG5cbiAgICByb290Tm9kZS5jaGlsZHJlbi5wdXNoKG5ldyB4bWwuQ1IoKSk7XG5cbiAgICByZXR1cm4geG1sLnNlcmlhbGl6ZShbXG4gICAgICBuZXcgeG1sLkRlY2xhcmF0aW9uKHt2ZXJzaW9uOiAnMS4wJywgZW5jb2Rpbmc6ICdVVEYtOCd9KSxcbiAgICAgIG5ldyB4bWwuQ1IoKSxcbiAgICAgIG5ldyB4bWwuRG9jdHlwZShfTUVTU0FHRVNfVEFHLCBfRE9DVFlQRSksXG4gICAgICBuZXcgeG1sLkNSKCksXG4gICAgICBleGFtcGxlVmlzaXRvci5hZGREZWZhdWx0RXhhbXBsZXMocm9vdE5vZGUpLFxuICAgICAgbmV3IHhtbC5DUigpLFxuICAgIF0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgbG9hZChjb250ZW50OiBzdHJpbmcsIHVybDogc3RyaW5nKTpcbiAgICAgIHtsb2NhbGU6IHN0cmluZywgaTE4bk5vZGVzQnlNc2dJZDoge1ttc2dJZDogc3RyaW5nXTogaTE4bi5Ob2RlW119fSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCcpO1xuICB9XG5cbiAgb3ZlcnJpZGUgZGlnZXN0KG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRpZ2VzdChtZXNzYWdlKTtcbiAgfVxuXG5cbiAgb3ZlcnJpZGUgY3JlYXRlTmFtZU1hcHBlcihtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBQbGFjZWhvbGRlck1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVQbGFjZWhvbGRlck1hcHBlcihtZXNzYWdlLCB0b1B1YmxpY05hbWUpO1xuICB9XG59XG5cbmNsYXNzIF9WaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIHJldHVybiBbbmV3IHhtbC5UZXh0KHRleHQudmFsdWUpXTtcbiAgfVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogaTE4bi5Db250YWluZXIsIGNvbnRleHQ6IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IG5vZGVzOiB4bWwuTm9kZVtdID0gW107XG4gICAgY29udGFpbmVyLmNoaWxkcmVuLmZvckVhY2goKG5vZGU6IGkxOG4uTm9kZSkgPT4gbm9kZXMucHVzaCguLi5ub2RlLnZpc2l0KHRoaXMpKSk7XG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgdmlzaXRJY3UoaWN1OiBpMThuLkljdSwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IG5vZGVzID0gW25ldyB4bWwuVGV4dChgeyR7aWN1LmV4cHJlc3Npb25QbGFjZWhvbGRlcn0sICR7aWN1LnR5cGV9LCBgKV07XG5cbiAgICBPYmplY3Qua2V5cyhpY3UuY2FzZXMpLmZvckVhY2goKGM6IHN0cmluZykgPT4ge1xuICAgICAgbm9kZXMucHVzaChuZXcgeG1sLlRleHQoYCR7Y30ge2ApLCAuLi5pY3UuY2FzZXNbY10udmlzaXQodGhpcyksIG5ldyB4bWwuVGV4dChgfSBgKSk7XG4gICAgfSk7XG5cbiAgICBub2Rlcy5wdXNoKG5ldyB4bWwuVGV4dChgfWApKTtcblxuICAgIHJldHVybiBub2RlcztcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBzdGFydFRhZ0FzVGV4dCA9IG5ldyB4bWwuVGV4dChgPCR7cGgudGFnfT5gKTtcbiAgICBjb25zdCBzdGFydEV4ID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW3N0YXJ0VGFnQXNUZXh0XSk7XG4gICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgY29uc3Qgc3RhcnRUYWdQaCA9XG4gICAgICAgIG5ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtuYW1lOiBwaC5zdGFydE5hbWV9LCBbc3RhcnRFeCwgc3RhcnRUYWdBc1RleHRdKTtcbiAgICBpZiAocGguaXNWb2lkKSB7XG4gICAgICAvLyB2b2lkIHRhZ3MgaGF2ZSBubyBjaGlsZHJlbiBub3IgY2xvc2luZyB0YWdzXG4gICAgICByZXR1cm4gW3N0YXJ0VGFnUGhdO1xuICAgIH1cblxuICAgIGNvbnN0IGNsb3NlVGFnQXNUZXh0ID0gbmV3IHhtbC5UZXh0KGA8LyR7cGgudGFnfT5gKTtcbiAgICBjb25zdCBjbG9zZUV4ID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2Nsb3NlVGFnQXNUZXh0XSk7XG4gICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgY29uc3QgY2xvc2VUYWdQaCA9XG4gICAgICAgIG5ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtuYW1lOiBwaC5jbG9zZU5hbWV9LCBbY2xvc2VFeCwgY2xvc2VUYWdBc1RleHRdKTtcblxuICAgIHJldHVybiBbc3RhcnRUYWdQaCwgLi4udGhpcy5zZXJpYWxpemUocGguY2hpbGRyZW4pLCBjbG9zZVRhZ1BoXTtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiB4bWwuTm9kZVtdIHtcbiAgICBjb25zdCBpbnRlcnBvbGF0aW9uQXNUZXh0ID0gbmV3IHhtbC5UZXh0KGB7eyR7cGgudmFsdWV9fX1gKTtcbiAgICAvLyBFeGFtcGxlIHRhZyBuZWVkcyB0byBiZSBub3QtZW1wdHkgZm9yIFRDLlxuICAgIGNvbnN0IGV4VGFnID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2ludGVycG9sYXRpb25Bc1RleHRdKTtcbiAgICByZXR1cm4gW1xuICAgICAgLy8gVEMgcmVxdWlyZXMgUEggdG8gaGF2ZSBhIG5vbiBlbXB0eSBFWCwgYW5kIHVzZXMgdGhlIHRleHQgbm9kZSB0byBzaG93IHRoZSBcIm9yaWdpbmFsXCIgdmFsdWUuXG4gICAgICBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGgubmFtZX0sIFtleFRhZywgaW50ZXJwb2xhdGlvbkFzVGV4dF0pXG4gICAgXTtcbiAgfVxuXG4gIHZpc2l0QmxvY2tQbGFjZWhvbGRlcihwaDogaTE4bi5CbG9ja1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogeG1sLk5vZGVbXSB7XG4gICAgY29uc3Qgc3RhcnRBc1RleHQgPSBuZXcgeG1sLlRleHQoYEAke3BoLm5hbWV9YCk7XG4gICAgY29uc3Qgc3RhcnRFeCA9IG5ldyB4bWwuVGFnKF9FWEFNUExFX1RBRywge30sIFtzdGFydEFzVGV4dF0pO1xuICAgIC8vIFRDIHJlcXVpcmVzIFBIIHRvIGhhdmUgYSBub24gZW1wdHkgRVgsIGFuZCB1c2VzIHRoZSB0ZXh0IG5vZGUgdG8gc2hvdyB0aGUgXCJvcmlnaW5hbFwiIHZhbHVlLlxuICAgIGNvbnN0IHN0YXJ0VGFnUGggPSBuZXcgeG1sLlRhZyhfUExBQ0VIT0xERVJfVEFHLCB7bmFtZTogcGguc3RhcnROYW1lfSwgW3N0YXJ0RXgsIHN0YXJ0QXNUZXh0XSk7XG5cbiAgICBjb25zdCBjbG9zZUFzVGV4dCA9IG5ldyB4bWwuVGV4dChgfWApO1xuICAgIGNvbnN0IGNsb3NlRXggPSBuZXcgeG1sLlRhZyhfRVhBTVBMRV9UQUcsIHt9LCBbY2xvc2VBc1RleHRdKTtcbiAgICAvLyBUQyByZXF1aXJlcyBQSCB0byBoYXZlIGEgbm9uIGVtcHR5IEVYLCBhbmQgdXNlcyB0aGUgdGV4dCBub2RlIHRvIHNob3cgdGhlIFwib3JpZ2luYWxcIiB2YWx1ZS5cbiAgICBjb25zdCBjbG9zZVRhZ1BoID0gbmV3IHhtbC5UYWcoX1BMQUNFSE9MREVSX1RBRywge25hbWU6IHBoLmNsb3NlTmFtZX0sIFtjbG9zZUV4LCBjbG9zZUFzVGV4dF0pO1xuXG4gICAgcmV0dXJuIFtzdGFydFRhZ1BoLCAuLi50aGlzLnNlcmlhbGl6ZShwaC5jaGlsZHJlbiksIGNsb3NlVGFnUGhdO1xuICB9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogaTE4bi5JY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IHhtbC5Ob2RlW10ge1xuICAgIGNvbnN0IGljdUV4cHJlc3Npb24gPSBwaC52YWx1ZS5leHByZXNzaW9uO1xuICAgIGNvbnN0IGljdVR5cGUgPSBwaC52YWx1ZS50eXBlO1xuICAgIGNvbnN0IGljdUNhc2VzID0gT2JqZWN0LmtleXMocGgudmFsdWUuY2FzZXMpLm1hcCgodmFsdWU6IHN0cmluZykgPT4gdmFsdWUgKyAnIHsuLi59Jykuam9pbignICcpO1xuICAgIGNvbnN0IGljdUFzVGV4dCA9IG5ldyB4bWwuVGV4dChgeyR7aWN1RXhwcmVzc2lvbn0sICR7aWN1VHlwZX0sICR7aWN1Q2FzZXN9fWApO1xuICAgIGNvbnN0IGV4VGFnID0gbmV3IHhtbC5UYWcoX0VYQU1QTEVfVEFHLCB7fSwgW2ljdUFzVGV4dF0pO1xuICAgIHJldHVybiBbXG4gICAgICAvLyBUQyByZXF1aXJlcyBQSCB0byBoYXZlIGEgbm9uIGVtcHR5IEVYLCBhbmQgdXNlcyB0aGUgdGV4dCBub2RlIHRvIHNob3cgdGhlIFwib3JpZ2luYWxcIiB2YWx1ZS5cbiAgICAgIG5ldyB4bWwuVGFnKF9QTEFDRUhPTERFUl9UQUcsIHtuYW1lOiBwaC5uYW1lfSwgW2V4VGFnLCBpY3VBc1RleHRdKVxuICAgIF07XG4gIH1cblxuICBzZXJpYWxpemUobm9kZXM6IGkxOG4uTm9kZVtdKTogeG1sLk5vZGVbXSB7XG4gICAgcmV0dXJuIFtdLmNvbmNhdCguLi5ub2Rlcy5tYXAobm9kZSA9PiBub2RlLnZpc2l0KHRoaXMpKSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRpZ2VzdChtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBzdHJpbmcge1xuICByZXR1cm4gZGVjaW1hbERpZ2VzdChtZXNzYWdlKTtcbn1cblxuLy8gVEMgcmVxdWlyZXMgYXQgbGVhc3Qgb25lIG5vbi1lbXB0eSBleGFtcGxlIG9uIHBsYWNlaG9sZGVyc1xuY2xhc3MgRXhhbXBsZVZpc2l0b3IgaW1wbGVtZW50cyB4bWwuSVZpc2l0b3Ige1xuICBhZGREZWZhdWx0RXhhbXBsZXMobm9kZTogeG1sLk5vZGUpOiB4bWwuTm9kZSB7XG4gICAgbm9kZS52aXNpdCh0aGlzKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0VGFnKHRhZzogeG1sLlRhZyk6IHZvaWQge1xuICAgIGlmICh0YWcubmFtZSA9PT0gX1BMQUNFSE9MREVSX1RBRykge1xuICAgICAgaWYgKCF0YWcuY2hpbGRyZW4gfHwgdGFnLmNoaWxkcmVuLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIGNvbnN0IGV4VGV4dCA9IG5ldyB4bWwuVGV4dCh0YWcuYXR0cnNbJ25hbWUnXSB8fCAnLi4uJyk7XG4gICAgICAgIHRhZy5jaGlsZHJlbiA9IFtuZXcgeG1sLlRhZyhfRVhBTVBMRV9UQUcsIHt9LCBbZXhUZXh0XSldO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGFnLmNoaWxkcmVuKSB7XG4gICAgICB0YWcuY2hpbGRyZW4uZm9yRWFjaChub2RlID0+IG5vZGUudmlzaXQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiB4bWwuVGV4dCk6IHZvaWQge31cbiAgdmlzaXREZWNsYXJhdGlvbihkZWNsOiB4bWwuRGVjbGFyYXRpb24pOiB2b2lkIHt9XG4gIHZpc2l0RG9jdHlwZShkb2N0eXBlOiB4bWwuRG9jdHlwZSk6IHZvaWQge31cbn1cblxuLy8gWE1CL1hUQiBwbGFjZWhvbGRlcnMgY2FuIG9ubHkgY29udGFpbiBBLVosIDAtOSBhbmQgX1xuZXhwb3J0IGZ1bmN0aW9uIHRvUHVibGljTmFtZShpbnRlcm5hbE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnRlcm5hbE5hbWUudG9VcHBlckNhc2UoKS5yZXBsYWNlKC9bXkEtWjAtOV9dL2csICdfJyk7XG59XG4iXX0=