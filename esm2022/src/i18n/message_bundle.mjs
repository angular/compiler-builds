/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { extractMessages } from './extractor_merger';
import * as i18n from './i18n_ast';
/**
 * A container for message extracted from the templates.
 */
export class MessageBundle {
    constructor(_htmlParser, _implicitTags, _implicitAttrs, _locale = null) {
        this._htmlParser = _htmlParser;
        this._implicitTags = _implicitTags;
        this._implicitAttrs = _implicitAttrs;
        this._locale = _locale;
        this._messages = [];
    }
    updateFromTemplate(html, url, interpolationConfig) {
        const htmlParserResult = this._htmlParser.parse(html, url, {
            tokenizeExpansionForms: true,
            interpolationConfig,
        });
        if (htmlParserResult.errors.length) {
            return htmlParserResult.errors;
        }
        const i18nParserResult = extractMessages(htmlParserResult.rootNodes, interpolationConfig, this._implicitTags, this._implicitAttrs);
        if (i18nParserResult.errors.length) {
            return i18nParserResult.errors;
        }
        this._messages.push(...i18nParserResult.messages);
        return [];
    }
    // Return the message in the internal format
    // The public (serialized) format might be different, see the `write` method.
    getMessages() {
        return this._messages;
    }
    write(serializer, filterSources) {
        const messages = {};
        const mapperVisitor = new MapPlaceholderNames();
        // Deduplicate messages based on their ID
        this._messages.forEach((message) => {
            const id = serializer.digest(message);
            if (!messages.hasOwnProperty(id)) {
                messages[id] = message;
            }
            else {
                messages[id].sources.push(...message.sources);
            }
        });
        // Transform placeholder names using the serializer mapping
        const msgList = Object.keys(messages).map((id) => {
            const mapper = serializer.createNameMapper(messages[id]);
            const src = messages[id];
            const nodes = mapper ? mapperVisitor.convert(src.nodes, mapper) : src.nodes;
            let transformedMessage = new i18n.Message(nodes, {}, {}, src.meaning, src.description, id);
            transformedMessage.sources = src.sources;
            if (filterSources) {
                transformedMessage.sources.forEach((source) => (source.filePath = filterSources(source.filePath)));
            }
            return transformedMessage;
        });
        return serializer.write(msgList, this._locale);
    }
}
// Transform an i18n AST by renaming the placeholder nodes with the given mapper
class MapPlaceholderNames extends i18n.CloneVisitor {
    convert(nodes, mapper) {
        return mapper ? nodes.map((n) => n.visit(this, mapper)) : nodes;
    }
    visitTagPlaceholder(ph, mapper) {
        const startName = mapper.toPublicName(ph.startName);
        const closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
        const children = ph.children.map((n) => n.visit(this, mapper));
        return new i18n.TagPlaceholder(ph.tag, ph.attrs, startName, closeName, children, ph.isVoid, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
    }
    visitBlockPlaceholder(ph, mapper) {
        const startName = mapper.toPublicName(ph.startName);
        const closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
        const children = ph.children.map((n) => n.visit(this, mapper));
        return new i18n.BlockPlaceholder(ph.name, ph.parameters, startName, closeName, children, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
    }
    visitPlaceholder(ph, mapper) {
        return new i18n.Placeholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
    }
    visitIcuPlaceholder(ph, mapper) {
        return new i18n.IcuPlaceholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzc2FnZV9idW5kbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvaTE4bi9tZXNzYWdlX2J1bmRsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFNSCxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDbkQsT0FBTyxLQUFLLElBQUksTUFBTSxZQUFZLENBQUM7QUFHbkM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sYUFBYTtJQUd4QixZQUNVLFdBQXVCLEVBQ3ZCLGFBQXVCLEVBQ3ZCLGNBQXVDLEVBQ3ZDLFVBQXlCLElBQUk7UUFIN0IsZ0JBQVcsR0FBWCxXQUFXLENBQVk7UUFDdkIsa0JBQWEsR0FBYixhQUFhLENBQVU7UUFDdkIsbUJBQWMsR0FBZCxjQUFjLENBQXlCO1FBQ3ZDLFlBQU8sR0FBUCxPQUFPLENBQXNCO1FBTi9CLGNBQVMsR0FBbUIsRUFBRSxDQUFDO0lBT3BDLENBQUM7SUFFSixrQkFBa0IsQ0FDaEIsSUFBWSxFQUNaLEdBQVcsRUFDWCxtQkFBd0M7UUFFeEMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO1lBQ3pELHNCQUFzQixFQUFFLElBQUk7WUFDNUIsbUJBQW1CO1NBQ3BCLENBQUMsQ0FBQztRQUVILElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ25DLE9BQU8sZ0JBQWdCLENBQUMsTUFBTSxDQUFDO1FBQ2pDLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FDdEMsZ0JBQWdCLENBQUMsU0FBUyxFQUMxQixtQkFBbUIsRUFDbkIsSUFBSSxDQUFDLGFBQWEsRUFDbEIsSUFBSSxDQUFDLGNBQWMsQ0FDcEIsQ0FBQztRQUVGLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE1B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QixDQUM5QixFQUFFLENBQUMsSUFBSSxFQUNQLEVBQUUsQ0FBQyxVQUFVLEVBQ2IsU0FBUyxFQUNULFNBQVMsRUFDVCxRQUFRLEVBQ1IsRUFBRSxDQUFDLFVBQVUsRUFDYixFQUFFLENBQUMsZUFBZSxFQUNsQixFQUFFLENBQUMsYUFBYSxDQUNqQixDQUFDO0lBQ0osQ0FBQztJQUVRLGdCQUFnQixDQUFDLEVBQW9CLEVBQUUsTUFBeUI7UUFDdkUsT0FBTyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUVRLG1CQUFtQixDQUMxQixFQUF1QixFQUN2QixNQUF5QjtRQUV6QixPQUFPLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBRSxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN6RixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtJbnRlcnBvbGF0aW9uQ29uZmlnfSBmcm9tICcuLi9tbF9wYXJzZXIvZGVmYXVsdHMnO1xuaW1wb3J0IHtIdG1sUGFyc2VyfSBmcm9tICcuLi9tbF9wYXJzZXIvaHRtbF9wYXJzZXInO1xuaW1wb3J0IHtQYXJzZUVycm9yfSBmcm9tICcuLi9wYXJzZV91dGlsJztcblxuaW1wb3J0IHtleHRyYWN0TWVzc2FnZXN9IGZyb20gJy4vZXh0cmFjdG9yX21lcmdlcic7XG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4vaTE4bl9hc3QnO1xuaW1wb3J0IHtQbGFjZWhvbGRlck1hcHBlciwgU2VyaWFsaXplcn0gZnJvbSAnLi9zZXJpYWxpemVycy9zZXJpYWxpemVyJztcblxuLyoqXG4gKiBBIGNvbnRhaW5lciBmb3IgbWVzc2FnZSBleHRyYWN0ZWQgZnJvbSB0aGUgdGVtcGxhdGVzLlxuICovXG5leHBvcnQgY2xhc3MgTWVzc2FnZUJ1bmRsZSB7XG4gIHByaXZhdGUgX21lc3NhZ2VzOiBpMThuLk1lc3NhZ2VbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgX2h0bWxQYXJzZXI6IEh0bWxQYXJzZXIsXG4gICAgcHJpdmF0ZSBfaW1wbGljaXRUYWdzOiBzdHJpbmdbXSxcbiAgICBwcml2YXRlIF9pbXBsaWNpdEF0dHJzOiB7W2s6IHN0cmluZ106IHN0cmluZ1tdfSxcbiAgICBwcml2YXRlIF9sb2NhbGU6IHN0cmluZyB8IG51bGwgPSBudWxsLFxuICApIHt9XG5cbiAgdXBkYXRlRnJvbVRlbXBsYXRlKFxuICAgIGh0bWw6IHN0cmluZyxcbiAgICB1cmw6IHN0cmluZyxcbiAgICBpbnRlcnBvbGF0aW9uQ29uZmlnOiBJbnRlcnBvbGF0aW9uQ29uZmlnLFxuICApOiBQYXJzZUVycm9yW10ge1xuICAgIGNvbnN0IGh0bWxQYXJzZXJSZXN1bHQgPSB0aGlzLl9odG1sUGFyc2VyLnBhcnNlKGh0bWwsIHVybCwge1xuICAgICAgdG9rZW5pemVFeHBhbnNpb25Gb3JtczogdHJ1ZSxcbiAgICAgIGludGVycG9sYXRpb25Db25maWcsXG4gICAgfSk7XG5cbiAgICBpZiAoaHRtbFBhcnNlclJlc3VsdC5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gaHRtbFBhcnNlclJlc3VsdC5lcnJvcnM7XG4gICAgfVxuXG4gICAgY29uc3QgaTE4blBhcnNlclJlc3VsdCA9IGV4dHJhY3RNZXNzYWdlcyhcbiAgICAgIGh0bWxQYXJzZXJSZXN1bHQucm9vdE5vZGVzLFxuICAgICAgaW50ZXJwb2xhdGlvbkNvbmZpZyxcbiAgICAgIHRoaXMuX2ltcGxpY2l0VGFncyxcbiAgICAgIHRoaXMuX2ltcGxpY2l0QXR0cnMsXG4gICAgKTtcblxuICAgIGlmIChpMThuUGFyc2VyUmVzdWx0LmVycm9ycy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBpMThuUGFyc2VyUmVzdWx0LmVycm9ycztcbiAgICB9XG5cbiAgICB0aGlzLl9tZXNzYWdlcy5wdXNoKC4uLmkxOG5QYXJzZXJSZXN1bHQubWVzc2FnZXMpO1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbWVzc2FnZSBpbiB0aGUgaW50ZXJuYWwgZm9ybWF0XG4gIC8vIFRoZSBwdWJsaWMgKHNlcmlhbGl6ZWQpIGZvcm1hdCBtaWdodCBiZSBkaWZmZXJlbnQsIHNlZSB0aGUgYHdyaXRlYCBtZXRob2QuXG4gIGdldE1lc3NhZ2VzKCk6IGkxOG4uTWVzc2FnZVtdIHtcbiAgICByZXR1cm4gdGhpcy5fbWVzc2FnZXM7XG4gIH1cblxuICB3cml0ZShzZXJpYWxpemVyOiBTZXJpYWxpemVyLCBmaWx0ZXJTb3VyY2VzPzogKHBhdGg6IHN0cmluZykgPT4gc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBtZXNzYWdlczoge1tpZDogc3RyaW5nXTogaTE4bi5NZXNzYWdlfSA9IHt9O1xuICAgIGNvbnN0IG1hcHBlclZpc2l0b3IgPSBuZXcgTWFwUGxhY2Vob2xkZXJOYW1lcygpO1xuXG4gICAgLy8gRGVkdXBsaWNhdGUgbWVzc2FnZXMgYmFzZWQgb24gdGhlaXIgSURcbiAgICB0aGlzLl9tZXNzYWdlcy5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IHNlcmlhbGl6ZXIuZGlnZXN0KG1lc3NhZ2UpO1xuICAgICAgaWYgKCFtZXNzYWdlcy5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgbWVzc2FnZXNbaWRdID0gbWVzc2FnZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lc3NhZ2VzW2lkXS5zb3VyY2VzLnB1c2goLi4ubWVzc2FnZS5zb3VyY2VzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFRyYW5zZm9ybSBwbGFjZWhvbGRlciBuYW1lcyB1c2luZyB0aGUgc2VyaWFsaXplciBtYXBwaW5nXG4gICAgY29uc3QgbXNnTGlzdCA9IE9iamVjdC5rZXlzKG1lc3NhZ2VzKS5tYXAoKGlkKSA9PiB7XG4gICAgICBjb25zdCBtYXBwZXIgPSBzZXJpYWxpemVyLmNyZWF0ZU5hbWVNYXBwZXIobWVzc2FnZXNbaWRdKTtcbiAgICAgIGNvbnN0IHNyYyA9IG1lc3NhZ2VzW2lkXTtcbiAgICAgIGNvbnN0IG5vZGVzID0gbWFwcGVyID8gbWFwcGVyVmlzaXRvci5jb252ZXJ0KHNyYy5ub2RlcywgbWFwcGVyKSA6IHNyYy5ub2RlcztcbiAgICAgIGxldCB0cmFuc2Zvcm1lZE1lc3NhZ2UgPSBuZXcgaTE4bi5NZXNzYWdlKG5vZGVzLCB7fSwge30sIHNyYy5tZWFuaW5nLCBzcmMuZGVzY3JpcHRpb24sIGlkKTtcbiAgICAgIHRyYW5zZm9ybWVkTWVzc2FnZS5zb3VyY2VzID0gc3JjLnNvdXJjZXM7XG4gICAgICBpZiAoZmlsdGVyU291cmNlcykge1xuICAgICAgICB0cmFuc2Zvcm1lZE1lc3NhZ2Uuc291cmNlcy5mb3JFYWNoKFxuICAgICAgICAgIChzb3VyY2U6IGkxOG4uTWVzc2FnZVNwYW4pID0+IChzb3VyY2UuZmlsZVBhdGggPSBmaWx0ZXJTb3VyY2VzKHNvdXJjZS5maWxlUGF0aCkpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRyYW5zZm9ybWVkTWVzc2FnZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzZXJpYWxpemVyLndyaXRlKG1zZ0xpc3QsIHRoaXMuX2xvY2FsZSk7XG4gIH1cbn1cblxuLy8gVHJhbnNmb3JtIGFuIGkxOG4gQVNUIGJ5IHJlbmFtaW5nIHRoZSBwbGFjZWhvbGRlciBub2RlcyB3aXRoIHRoZSBnaXZlbiBtYXBwZXJcbmNsYXNzIE1hcFBsYWNlaG9sZGVyTmFtZXMgZXh0ZW5kcyBpMThuLkNsb25lVmlzaXRvciB7XG4gIGNvbnZlcnQobm9kZXM6IGkxOG4uTm9kZVtdLCBtYXBwZXI6IFBsYWNlaG9sZGVyTWFwcGVyKTogaTE4bi5Ob2RlW10ge1xuICAgIHJldHVybiBtYXBwZXIgPyBub2Rlcy5tYXAoKG4pID0+IG4udmlzaXQodGhpcywgbWFwcGVyKSkgOiBub2RlcztcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0VGFnUGxhY2Vob2xkZXIoXG4gICAgcGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsXG4gICAgbWFwcGVyOiBQbGFjZWhvbGRlck1hcHBlcixcbiAgKTogaTE4bi5UYWdQbGFjZWhvbGRlciB7XG4gICAgY29uc3Qgc3RhcnROYW1lID0gbWFwcGVyLnRvUHVibGljTmFtZShwaC5zdGFydE5hbWUpITtcbiAgICBjb25zdCBjbG9zZU5hbWUgPSBwaC5jbG9zZU5hbWUgPyBtYXBwZXIudG9QdWJsaWNOYW1lKHBoLmNsb3NlTmFtZSkhIDogcGguY2xvc2VOYW1lO1xuICAgIGNvbnN0IGNoaWxkcmVuID0gcGguY2hpbGRyZW4ubWFwKChuKSA9PiBuLnZpc2l0KHRoaXMsIG1hcHBlcikpO1xuICAgIHJldHVybiBuZXcgaTE4bi5UYWdQbGFjZWhvbGRlcihcbiAgICAgIHBoLnRhZyxcbiAgICAgIHBoLmF0dHJzLFxuICAgICAgc3RhcnROYW1lLFxuICAgICAgY2xvc2VOYW1lLFxuICAgICAgY2hpbGRyZW4sXG4gICAgICBwaC5pc1ZvaWQsXG4gICAgICBwaC5zb3VyY2VTcGFuLFxuICAgICAgcGguc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgcGguZW5kU291cmNlU3BhbixcbiAgICApO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmlzaXRCbG9ja1BsYWNlaG9sZGVyKFxuICAgIHBoOiBpMThuLkJsb2NrUGxhY2Vob2xkZXIsXG4gICAgbWFwcGVyOiBQbGFjZWhvbGRlck1hcHBlcixcbiAgKTogaTE4bi5CbG9ja1BsYWNlaG9sZGVyIHtcbiAgICBjb25zdCBzdGFydE5hbWUgPSBtYXBwZXIudG9QdWJsaWNOYW1lKHBoLnN0YXJ0TmFtZSkhO1xuICAgIGNvbnN0IGNsb3NlTmFtZSA9IHBoLmNsb3NlTmFtZSA/IG1hcHBlci50b1B1YmxpY05hbWUocGguY2xvc2VOYW1lKSEgOiBwaC5jbG9zZU5hbWU7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBwaC5jaGlsZHJlbi5tYXAoKG4pID0+IG4udmlzaXQodGhpcywgbWFwcGVyKSk7XG4gICAgcmV0dXJuIG5ldyBpMThuLkJsb2NrUGxhY2Vob2xkZXIoXG4gICAgICBwaC5uYW1lLFxuICAgICAgcGgucGFyYW1ldGVycyxcbiAgICAgIHN0YXJ0TmFtZSxcbiAgICAgIGNsb3NlTmFtZSxcbiAgICAgIGNoaWxkcmVuLFxuICAgICAgcGguc291cmNlU3BhbixcbiAgICAgIHBoLnN0YXJ0U291cmNlU3BhbixcbiAgICAgIHBoLmVuZFNvdXJjZVNwYW4sXG4gICAgKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIG1hcHBlcjogUGxhY2Vob2xkZXJNYXBwZXIpOiBpMThuLlBsYWNlaG9sZGVyIHtcbiAgICByZXR1cm4gbmV3IGkxOG4uUGxhY2Vob2xkZXIocGgudmFsdWUsIG1hcHBlci50b1B1YmxpY05hbWUocGgubmFtZSkhLCBwaC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIG92ZXJyaWRlIHZpc2l0SWN1UGxhY2Vob2xkZXIoXG4gICAgcGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsXG4gICAgbWFwcGVyOiBQbGFjZWhvbGRlck1hcHBlcixcbiAgKTogaTE4bi5JY3VQbGFjZWhvbGRlciB7XG4gICAgcmV0dXJuIG5ldyBpMThuLkljdVBsYWNlaG9sZGVyKHBoLnZhbHVlLCBtYXBwZXIudG9QdWJsaWNOYW1lKHBoLm5hbWUpISwgcGguc291cmNlU3Bhbik7XG4gIH1cbn1cbiJdfQ==