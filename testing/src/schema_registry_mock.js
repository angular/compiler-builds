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
        define("@angular/compiler/testing/src/schema_registry_mock", ["require", "exports", "@angular/compiler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MockSchemaRegistry = void 0;
    var compiler_1 = require("@angular/compiler");
    var MockSchemaRegistry = /** @class */ (function () {
        function MockSchemaRegistry(existingProperties, attrPropMapping, existingElements, invalidProperties, invalidAttributes) {
            this.existingProperties = existingProperties;
            this.attrPropMapping = attrPropMapping;
            this.existingElements = existingElements;
            this.invalidProperties = invalidProperties;
            this.invalidAttributes = invalidAttributes;
        }
        MockSchemaRegistry.prototype.hasProperty = function (tagName, property, schemas) {
            var value = this.existingProperties[property];
            return value === void 0 ? true : value;
        };
        MockSchemaRegistry.prototype.hasElement = function (tagName, schemaMetas) {
            var value = this.existingElements[tagName.toLowerCase()];
            return value === void 0 ? true : value;
        };
        MockSchemaRegistry.prototype.allKnownElementNames = function () {
            return Object.keys(this.existingElements);
        };
        MockSchemaRegistry.prototype.securityContext = function (selector, property, isAttribute) {
            return compiler_1.core.SecurityContext.NONE;
        };
        MockSchemaRegistry.prototype.getMappedPropName = function (attrName) {
            return this.attrPropMapping[attrName] || attrName;
        };
        MockSchemaRegistry.prototype.getDefaultComponentElementName = function () {
            return 'ng-component';
        };
        MockSchemaRegistry.prototype.validateProperty = function (name) {
            if (this.invalidProperties.indexOf(name) > -1) {
                return { error: true, msg: "Binding to property '" + name + "' is disallowed for security reasons" };
            }
            else {
                return { error: false };
            }
        };
        MockSchemaRegistry.prototype.validateAttribute = function (name) {
            if (this.invalidAttributes.indexOf(name) > -1) {
                return {
                    error: true,
                    msg: "Binding to attribute '" + name + "' is disallowed for security reasons"
                };
            }
            else {
                return { error: false };
            }
        };
        MockSchemaRegistry.prototype.normalizeAnimationStyleProperty = function (propName) {
            return propName;
        };
        MockSchemaRegistry.prototype.normalizeAnimationStyleValue = function (camelCaseProp, userProvidedProp, val) {
            return { error: null, value: val.toString() };
        };
        return MockSchemaRegistry;
    }());
    exports.MockSchemaRegistry = MockSchemaRegistry;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hX3JlZ2lzdHJ5X21vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci90ZXN0aW5nL3NyYy9zY2hlbWFfcmVnaXN0cnlfbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBOEQ7SUFFOUQ7UUFDRSw0QkFDVyxrQkFBNEMsRUFDNUMsZUFBd0MsRUFDeEMsZ0JBQTBDLEVBQVMsaUJBQWdDLEVBQ25GLGlCQUFnQztZQUhoQyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQTBCO1lBQzVDLG9CQUFlLEdBQWYsZUFBZSxDQUF5QjtZQUN4QyxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQTBCO1lBQVMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFlO1lBQ25GLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBZTtRQUFHLENBQUM7UUFFL0Msd0NBQVcsR0FBWCxVQUFZLE9BQWUsRUFBRSxRQUFnQixFQUFFLE9BQThCO1lBQzNFLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNoRCxPQUFPLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDekMsQ0FBQztRQUVELHVDQUFVLEdBQVYsVUFBVyxPQUFlLEVBQUUsV0FBa0M7WUFDNUQsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQzNELE9BQU8sS0FBSyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUN6QyxDQUFDO1FBRUQsaURBQW9CLEdBQXBCO1lBQ0UsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCw0Q0FBZSxHQUFmLFVBQWdCLFFBQWdCLEVBQUUsUUFBZ0IsRUFBRSxXQUFvQjtZQUN0RSxPQUFPLGVBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO1FBQ25DLENBQUM7UUFFRCw4Q0FBaUIsR0FBakIsVUFBa0IsUUFBZ0I7WUFDaEMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsQ0FBQztRQUNwRCxDQUFDO1FBRUQsMkRBQThCLEdBQTlCO1lBQ0UsT0FBTyxjQUFjLENBQUM7UUFDeEIsQ0FBQztRQUVELDZDQUFnQixHQUFoQixVQUFpQixJQUFZO1lBQzNCLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDN0MsT0FBTyxFQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLDBCQUF3QixJQUFJLHlDQUFzQyxFQUFDLENBQUM7YUFDL0Y7aUJBQU07Z0JBQ0wsT0FBTyxFQUFDLEtBQUssRUFBRSxLQUFLLEVBQUMsQ0FBQzthQUN2QjtRQUNILENBQUM7UUFFRCw4Q0FBaUIsR0FBakIsVUFBa0IsSUFBWTtZQUM1QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7Z0JBQzdDLE9BQU87b0JBQ0wsS0FBSyxFQUFFLElBQUk7b0JBQ1gsR0FBRyxFQUFFLDJCQUF5QixJQUFJLHlDQUFzQztpQkFDekUsQ0FBQzthQUNIO2lCQUFNO2dCQUNMLE9BQU8sRUFBQyxLQUFLLEVBQUUsS0FBSyxFQUFDLENBQUM7YUFDdkI7UUFDSCxDQUFDO1FBRUQsNERBQStCLEdBQS9CLFVBQWdDLFFBQWdCO1lBQzlDLE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7UUFDRCx5REFBNEIsR0FBNUIsVUFBNkIsYUFBcUIsRUFBRSxnQkFBd0IsRUFBRSxHQUFrQjtZQUU5RixPQUFPLEVBQUMsS0FBSyxFQUFFLElBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFDLENBQUM7UUFDL0MsQ0FBQztRQUNILHlCQUFDO0lBQUQsQ0FBQyxBQTNERCxJQTJEQztJQTNEWSxnREFBa0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29yZSwgRWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5cbmV4cG9ydCBjbGFzcyBNb2NrU2NoZW1hUmVnaXN0cnkgaW1wbGVtZW50cyBFbGVtZW50U2NoZW1hUmVnaXN0cnkge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHB1YmxpYyBleGlzdGluZ1Byb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBib29sZWFufSxcbiAgICAgIHB1YmxpYyBhdHRyUHJvcE1hcHBpbmc6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9LFxuICAgICAgcHVibGljIGV4aXN0aW5nRWxlbWVudHM6IHtba2V5OiBzdHJpbmddOiBib29sZWFufSwgcHVibGljIGludmFsaWRQcm9wZXJ0aWVzOiBBcnJheTxzdHJpbmc+LFxuICAgICAgcHVibGljIGludmFsaWRBdHRyaWJ1dGVzOiBBcnJheTxzdHJpbmc+KSB7fVxuXG4gIGhhc1Byb3BlcnR5KHRhZ05hbWU6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgc2NoZW1hczogY29yZS5TY2hlbWFNZXRhZGF0YVtdKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmV4aXN0aW5nUHJvcGVydGllc1twcm9wZXJ0eV07XG4gICAgcmV0dXJuIHZhbHVlID09PSB2b2lkIDAgPyB0cnVlIDogdmFsdWU7XG4gIH1cblxuICBoYXNFbGVtZW50KHRhZ05hbWU6IHN0cmluZywgc2NoZW1hTWV0YXM6IGNvcmUuU2NoZW1hTWV0YWRhdGFbXSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5leGlzdGluZ0VsZW1lbnRzW3RhZ05hbWUudG9Mb3dlckNhc2UoKV07XG4gICAgcmV0dXJuIHZhbHVlID09PSB2b2lkIDAgPyB0cnVlIDogdmFsdWU7XG4gIH1cblxuICBhbGxLbm93bkVsZW1lbnROYW1lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZXhpc3RpbmdFbGVtZW50cyk7XG4gIH1cblxuICBzZWN1cml0eUNvbnRleHQoc2VsZWN0b3I6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgaXNBdHRyaWJ1dGU6IGJvb2xlYW4pOiBjb3JlLlNlY3VyaXR5Q29udGV4dCB7XG4gICAgcmV0dXJuIGNvcmUuU2VjdXJpdHlDb250ZXh0Lk5PTkU7XG4gIH1cblxuICBnZXRNYXBwZWRQcm9wTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyUHJvcE1hcHBpbmdbYXR0ck5hbWVdIHx8IGF0dHJOYW1lO1xuICB9XG5cbiAgZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICduZy1jb21wb25lbnQnO1xuICB9XG5cbiAgdmFsaWRhdGVQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiB7ZXJyb3I6IGJvb2xlYW4sIG1zZz86IHN0cmluZ30ge1xuICAgIGlmICh0aGlzLmludmFsaWRQcm9wZXJ0aWVzLmluZGV4T2YobmFtZSkgPiAtMSkge1xuICAgICAgcmV0dXJuIHtlcnJvcjogdHJ1ZSwgbXNnOiBgQmluZGluZyB0byBwcm9wZXJ0eSAnJHtuYW1lfScgaXMgZGlzYWxsb3dlZCBmb3Igc2VjdXJpdHkgcmVhc29uc2B9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2Vycm9yOiBmYWxzZX07XG4gICAgfVxuICB9XG5cbiAgdmFsaWRhdGVBdHRyaWJ1dGUobmFtZTogc3RyaW5nKToge2Vycm9yOiBib29sZWFuLCBtc2c/OiBzdHJpbmd9IHtcbiAgICBpZiAodGhpcy5pbnZhbGlkQXR0cmlidXRlcy5pbmRleE9mKG5hbWUpID4gLTEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICBtc2c6IGBCaW5kaW5nIHRvIGF0dHJpYnV0ZSAnJHtuYW1lfScgaXMgZGlzYWxsb3dlZCBmb3Igc2VjdXJpdHkgcmVhc29uc2BcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7ZXJyb3I6IGZhbHNlfTtcbiAgICB9XG4gIH1cblxuICBub3JtYWxpemVBbmltYXRpb25TdHlsZVByb3BlcnR5KHByb3BOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBwcm9wTmFtZTtcbiAgfVxuICBub3JtYWxpemVBbmltYXRpb25TdHlsZVZhbHVlKGNhbWVsQ2FzZVByb3A6IHN0cmluZywgdXNlclByb3ZpZGVkUHJvcDogc3RyaW5nLCB2YWw6IHN0cmluZ3xudW1iZXIpOlxuICAgICAge2Vycm9yOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd9IHtcbiAgICByZXR1cm4ge2Vycm9yOiBudWxsISwgdmFsdWU6IHZhbC50b1N0cmluZygpfTtcbiAgfVxufVxuIl19