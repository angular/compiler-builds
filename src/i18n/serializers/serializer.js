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
        define("@angular/compiler/src/i18n/serializers/serializer", ["require", "exports", "tslib", "@angular/compiler/src/i18n/i18n_ast"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SimplePlaceholderMapper = exports.Serializer = void 0;
    var tslib_1 = require("tslib");
    var i18n = require("@angular/compiler/src/i18n/i18n_ast");
    var Serializer = /** @class */ (function () {
        function Serializer() {
        }
        // Creates a name mapper, see `PlaceholderMapper`
        // Returning `null` means that no name mapping is used.
        Serializer.prototype.createNameMapper = function (message) {
            return null;
        };
        return Serializer;
    }());
    exports.Serializer = Serializer;
    /**
     * A simple mapper that take a function to transform an internal name to a public name
     */
    var SimplePlaceholderMapper = /** @class */ (function (_super) {
        tslib_1.__extends(SimplePlaceholderMapper, _super);
        // create a mapping from the message
        function SimplePlaceholderMapper(message, mapName) {
            var _this = _super.call(this) || this;
            _this.mapName = mapName;
            _this.internalToPublic = {};
            _this.publicToNextId = {};
            _this.publicToInternal = {};
            message.nodes.forEach(function (node) { return node.visit(_this); });
            return _this;
        }
        SimplePlaceholderMapper.prototype.toPublicName = function (internalName) {
            return this.internalToPublic.hasOwnProperty(internalName) ?
                this.internalToPublic[internalName] :
                null;
        };
        SimplePlaceholderMapper.prototype.toInternalName = function (publicName) {
            return this.publicToInternal.hasOwnProperty(publicName) ? this.publicToInternal[publicName] :
                null;
        };
        SimplePlaceholderMapper.prototype.visitText = function (text, context) {
            return null;
        };
        SimplePlaceholderMapper.prototype.visitTagPlaceholder = function (ph, context) {
            this.visitPlaceholderName(ph.startName);
            _super.prototype.visitTagPlaceholder.call(this, ph, context);
            this.visitPlaceholderName(ph.closeName);
        };
        SimplePlaceholderMapper.prototype.visitPlaceholder = function (ph, context) {
            this.visitPlaceholderName(ph.name);
        };
        SimplePlaceholderMapper.prototype.visitIcuPlaceholder = function (ph, context) {
            this.visitPlaceholderName(ph.name);
        };
        // XMB placeholders could only contains A-Z, 0-9 and _
        SimplePlaceholderMapper.prototype.visitPlaceholderName = function (internalName) {
            if (!internalName || this.internalToPublic.hasOwnProperty(internalName)) {
                return;
            }
            var publicName = this.mapName(internalName);
            if (this.publicToInternal.hasOwnProperty(publicName)) {
                // Create a new XMB when it has already been used
                var nextId = this.publicToNextId[publicName];
                this.publicToNextId[publicName] = nextId + 1;
                publicName = publicName + "_" + nextId;
            }
            else {
                this.publicToNextId[publicName] = 1;
            }
            this.internalToPublic[internalName] = publicName;
            this.publicToInternal[publicName] = internalName;
        };
        return SimplePlaceholderMapper;
    }(i18n.RecurseVisitor));
    exports.SimplePlaceholderMapper = SimplePlaceholderMapper;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9pMThuL3NlcmlhbGl6ZXJzL3NlcmlhbGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILDBEQUFvQztJQUVwQztRQUFBO1FBZ0JBLENBQUM7UUFMQyxpREFBaUQ7UUFDakQsdURBQXVEO1FBQ3ZELHFDQUFnQixHQUFoQixVQUFpQixPQUFxQjtZQUNwQyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDSCxpQkFBQztJQUFELENBQUMsQUFoQkQsSUFnQkM7SUFoQnFCLGdDQUFVO0lBOEJoQzs7T0FFRztJQUNIO1FBQTZDLG1EQUFtQjtRQUs5RCxvQ0FBb0M7UUFDcEMsaUNBQVksT0FBcUIsRUFBVSxPQUFpQztZQUE1RSxZQUNFLGlCQUFPLFNBRVI7WUFIMEMsYUFBTyxHQUFQLE9BQU8sQ0FBMEI7WUFMcEUsc0JBQWdCLEdBQTBCLEVBQUUsQ0FBQztZQUM3QyxvQkFBYyxHQUEwQixFQUFFLENBQUM7WUFDM0Msc0JBQWdCLEdBQTBCLEVBQUUsQ0FBQztZQUtuRCxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSSxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQzs7UUFDbEQsQ0FBQztRQUVELDhDQUFZLEdBQVosVUFBYSxZQUFvQjtZQUMvQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztnQkFDdkQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ3JDLElBQUksQ0FBQztRQUNYLENBQUM7UUFFRCxnREFBYyxHQUFkLFVBQWUsVUFBa0I7WUFDL0IsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDO1FBQ2pFLENBQUM7UUFFRCwyQ0FBUyxHQUFULFVBQVUsSUFBZSxFQUFFLE9BQWE7WUFDdEMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQscURBQW1CLEdBQW5CLFVBQW9CLEVBQXVCLEVBQUUsT0FBYTtZQUN4RCxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hDLGlCQUFNLG1CQUFtQixZQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLENBQUM7UUFFRCxrREFBZ0IsR0FBaEIsVUFBaUIsRUFBb0IsRUFBRSxPQUFhO1lBQ2xELElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckMsQ0FBQztRQUVELHFEQUFtQixHQUFuQixVQUFvQixFQUF1QixFQUFFLE9BQWE7WUFDeEQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBRUQsc0RBQXNEO1FBQzlDLHNEQUFvQixHQUE1QixVQUE2QixZQUFvQjtZQUMvQyxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQ3ZFLE9BQU87YUFDUjtZQUVELElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFNUMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUNwRCxpREFBaUQ7Z0JBQ2pELElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQy9DLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDN0MsVUFBVSxHQUFNLFVBQVUsU0FBSSxNQUFRLENBQUM7YUFDeEM7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDckM7WUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEdBQUcsVUFBVSxDQUFDO1lBQ2pELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsR0FBRyxZQUFZLENBQUM7UUFDbkQsQ0FBQztRQUNILDhCQUFDO0lBQUQsQ0FBQyxBQTVERCxDQUE2QyxJQUFJLENBQUMsY0FBYyxHQTREL0Q7SUE1RFksMERBQXVCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBpMThuIGZyb20gJy4uL2kxOG5fYXN0JztcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFNlcmlhbGl6ZXIge1xuICAvLyAtIFRoZSBgcGxhY2Vob2xkZXJzYCBhbmQgYHBsYWNlaG9sZGVyVG9NZXNzYWdlYCBwcm9wZXJ0aWVzIGFyZSBpcnJlbGV2YW50IGluIHRoZSBpbnB1dCBtZXNzYWdlc1xuICAvLyAtIFRoZSBgaWRgIGNvbnRhaW5zIHRoZSBtZXNzYWdlIGlkIHRoYXQgdGhlIHNlcmlhbGl6ZXIgaXMgZXhwZWN0ZWQgdG8gdXNlXG4gIC8vIC0gUGxhY2Vob2xkZXIgbmFtZXMgYXJlIGFscmVhZHkgbWFwIHRvIHB1YmxpYyBuYW1lcyB1c2luZyB0aGUgcHJvdmlkZWQgbWFwcGVyXG4gIGFic3RyYWN0IHdyaXRlKG1lc3NhZ2VzOiBpMThuLk1lc3NhZ2VbXSwgbG9jYWxlOiBzdHJpbmd8bnVsbCk6IHN0cmluZztcblxuICBhYnN0cmFjdCBsb2FkKGNvbnRlbnQ6IHN0cmluZywgdXJsOiBzdHJpbmcpOlxuICAgICAge2xvY2FsZTogc3RyaW5nfG51bGwsIGkxOG5Ob2Rlc0J5TXNnSWQ6IHtbbXNnSWQ6IHN0cmluZ106IGkxOG4uTm9kZVtdfX07XG5cbiAgYWJzdHJhY3QgZGlnZXN0KG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHN0cmluZztcblxuICAvLyBDcmVhdGVzIGEgbmFtZSBtYXBwZXIsIHNlZSBgUGxhY2Vob2xkZXJNYXBwZXJgXG4gIC8vIFJldHVybmluZyBgbnVsbGAgbWVhbnMgdGhhdCBubyBuYW1lIG1hcHBpbmcgaXMgdXNlZC5cbiAgY3JlYXRlTmFtZU1hcHBlcihtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBQbGFjZWhvbGRlck1hcHBlcnxudWxsIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFBsYWNlaG9sZGVyTWFwcGVyYCBjb252ZXJ0cyBwbGFjZWhvbGRlciBuYW1lcyBmcm9tIGludGVybmFsIHRvIHNlcmlhbGl6ZWQgcmVwcmVzZW50YXRpb24gYW5kXG4gKiBiYWNrLlxuICpcbiAqIEl0IHNob3VsZCBiZSB1c2VkIGZvciBzZXJpYWxpemF0aW9uIGZvcm1hdCB0aGF0IHB1dCBjb25zdHJhaW50cyBvbiB0aGUgcGxhY2Vob2xkZXIgbmFtZXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGxhY2Vob2xkZXJNYXBwZXIge1xuICB0b1B1YmxpY05hbWUoaW50ZXJuYWxOYW1lOiBzdHJpbmcpOiBzdHJpbmd8bnVsbDtcblxuICB0b0ludGVybmFsTmFtZShwdWJsaWNOYW1lOiBzdHJpbmcpOiBzdHJpbmd8bnVsbDtcbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBtYXBwZXIgdGhhdCB0YWtlIGEgZnVuY3Rpb24gdG8gdHJhbnNmb3JtIGFuIGludGVybmFsIG5hbWUgdG8gYSBwdWJsaWMgbmFtZVxuICovXG5leHBvcnQgY2xhc3MgU2ltcGxlUGxhY2Vob2xkZXJNYXBwZXIgZXh0ZW5kcyBpMThuLlJlY3Vyc2VWaXNpdG9yIGltcGxlbWVudHMgUGxhY2Vob2xkZXJNYXBwZXIge1xuICBwcml2YXRlIGludGVybmFsVG9QdWJsaWM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICBwcml2YXRlIHB1YmxpY1RvTmV4dElkOiB7W2s6IHN0cmluZ106IG51bWJlcn0gPSB7fTtcbiAgcHJpdmF0ZSBwdWJsaWNUb0ludGVybmFsOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcblxuICAvLyBjcmVhdGUgYSBtYXBwaW5nIGZyb20gdGhlIG1lc3NhZ2VcbiAgY29uc3RydWN0b3IobWVzc2FnZTogaTE4bi5NZXNzYWdlLCBwcml2YXRlIG1hcE5hbWU6IChuYW1lOiBzdHJpbmcpID0+IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgbWVzc2FnZS5ub2Rlcy5mb3JFYWNoKG5vZGUgPT4gbm9kZS52aXNpdCh0aGlzKSk7XG4gIH1cblxuICB0b1B1YmxpY05hbWUoaW50ZXJuYWxOYW1lOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJuYWxUb1B1YmxpYy5oYXNPd25Qcm9wZXJ0eShpbnRlcm5hbE5hbWUpID9cbiAgICAgICAgdGhpcy5pbnRlcm5hbFRvUHVibGljW2ludGVybmFsTmFtZV0gOlxuICAgICAgICBudWxsO1xuICB9XG5cbiAgdG9JbnRlcm5hbE5hbWUocHVibGljTmFtZTogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICAgIHJldHVybiB0aGlzLnB1YmxpY1RvSW50ZXJuYWwuaGFzT3duUHJvcGVydHkocHVibGljTmFtZSkgPyB0aGlzLnB1YmxpY1RvSW50ZXJuYWxbcHVibGljTmFtZV0gOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuICB9XG5cbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdFRhZ1BsYWNlaG9sZGVyKHBoOiBpMThuLlRhZ1BsYWNlaG9sZGVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICB0aGlzLnZpc2l0UGxhY2Vob2xkZXJOYW1lKHBoLnN0YXJ0TmFtZSk7XG4gICAgc3VwZXIudmlzaXRUYWdQbGFjZWhvbGRlcihwaCwgY29udGV4dCk7XG4gICAgdGhpcy52aXNpdFBsYWNlaG9sZGVyTmFtZShwaC5jbG9zZU5hbWUpO1xuICB9XG5cbiAgdmlzaXRQbGFjZWhvbGRlcihwaDogaTE4bi5QbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgdGhpcy52aXNpdFBsYWNlaG9sZGVyTmFtZShwaC5uYW1lKTtcbiAgfVxuXG4gIHZpc2l0SWN1UGxhY2Vob2xkZXIocGg6IGkxOG4uSWN1UGxhY2Vob2xkZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgIHRoaXMudmlzaXRQbGFjZWhvbGRlck5hbWUocGgubmFtZSk7XG4gIH1cblxuICAvLyBYTUIgcGxhY2Vob2xkZXJzIGNvdWxkIG9ubHkgY29udGFpbnMgQS1aLCAwLTkgYW5kIF9cbiAgcHJpdmF0ZSB2aXNpdFBsYWNlaG9sZGVyTmFtZShpbnRlcm5hbE5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghaW50ZXJuYWxOYW1lIHx8IHRoaXMuaW50ZXJuYWxUb1B1YmxpYy5oYXNPd25Qcm9wZXJ0eShpbnRlcm5hbE5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHB1YmxpY05hbWUgPSB0aGlzLm1hcE5hbWUoaW50ZXJuYWxOYW1lKTtcblxuICAgIGlmICh0aGlzLnB1YmxpY1RvSW50ZXJuYWwuaGFzT3duUHJvcGVydHkocHVibGljTmFtZSkpIHtcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyBYTUIgd2hlbiBpdCBoYXMgYWxyZWFkeSBiZWVuIHVzZWRcbiAgICAgIGNvbnN0IG5leHRJZCA9IHRoaXMucHVibGljVG9OZXh0SWRbcHVibGljTmFtZV07XG4gICAgICB0aGlzLnB1YmxpY1RvTmV4dElkW3B1YmxpY05hbWVdID0gbmV4dElkICsgMTtcbiAgICAgIHB1YmxpY05hbWUgPSBgJHtwdWJsaWNOYW1lfV8ke25leHRJZH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1YmxpY1RvTmV4dElkW3B1YmxpY05hbWVdID0gMTtcbiAgICB9XG5cbiAgICB0aGlzLmludGVybmFsVG9QdWJsaWNbaW50ZXJuYWxOYW1lXSA9IHB1YmxpY05hbWU7XG4gICAgdGhpcy5wdWJsaWNUb0ludGVybmFsW3B1YmxpY05hbWVdID0gaW50ZXJuYWxOYW1lO1xuICB9XG59XG4iXX0=