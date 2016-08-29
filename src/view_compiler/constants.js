/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
"use strict";
var core_1 = require('@angular/core');
var core_private_1 = require('../../core_private');
var identifiers_1 = require('../identifiers');
var o = require('../output/output_ast');
function _enumExpression(classIdentifier, name) {
    return o.importExpr(identifiers_1.resolveEnumIdentifier(classIdentifier, name));
}
var ViewTypeEnum = (function () {
    function ViewTypeEnum() {
    }
    ViewTypeEnum.fromValue = function (value) {
        var viewType = identifiers_1.resolveIdentifier(identifiers_1.Identifiers.ViewType);
        switch (value) {
            case core_private_1.ViewType.HOST:
                return _enumExpression(viewType, 'HOST');
            case core_private_1.ViewType.COMPONENT:
                return _enumExpression(viewType, 'COMPONENT');
            case core_private_1.ViewType.EMBEDDED:
                return _enumExpression(viewType, 'EMBEDDED');
            default:
                throw Error("Inavlid ViewType value: " + value);
        }
    };
    return ViewTypeEnum;
}());
exports.ViewTypeEnum = ViewTypeEnum;
var ViewEncapsulationEnum = (function () {
    function ViewEncapsulationEnum() {
    }
    ViewEncapsulationEnum.fromValue = function (value) {
        var viewEncapsulation = identifiers_1.resolveIdentifier(identifiers_1.Identifiers.ViewEncapsulation);
        switch (value) {
            case core_1.ViewEncapsulation.Emulated:
                return _enumExpression(viewEncapsulation, 'Emulated');
            case core_1.ViewEncapsulation.Native:
                return _enumExpression(viewEncapsulation, 'Native');
            case core_1.ViewEncapsulation.None:
                return _enumExpression(viewEncapsulation, 'None');
            default:
                throw Error("Inavlid ViewEncapsulation value: " + value);
        }
    };
    return ViewEncapsulationEnum;
}());
exports.ViewEncapsulationEnum = ViewEncapsulationEnum;
var ChangeDetectionStrategyEnum = (function () {
    function ChangeDetectionStrategyEnum() {
    }
    ChangeDetectionStrategyEnum.fromValue = function (value) {
        var changeDetectionStrategy = identifiers_1.resolveIdentifier(identifiers_1.Identifiers.ChangeDetectionStrategy);
        switch (value) {
            case core_1.ChangeDetectionStrategy.OnPush:
                return _enumExpression(changeDetectionStrategy, 'OnPush');
            case core_1.ChangeDetectionStrategy.Default:
                return _enumExpression(changeDetectionStrategy, 'Default');
            default:
                throw Error("Inavlid ChangeDetectionStrategy value: " + value);
        }
    };
    return ChangeDetectionStrategyEnum;
}());
exports.ChangeDetectionStrategyEnum = ChangeDetectionStrategyEnum;
var ChangeDetectorStatusEnum = (function () {
    function ChangeDetectorStatusEnum() {
    }
    ChangeDetectorStatusEnum.fromValue = function (value) {
        var changeDetectorStatus = identifiers_1.resolveIdentifier(identifiers_1.Identifiers.ChangeDetectorStatus);
        switch (value) {
            case core_private_1.ChangeDetectorStatus.CheckOnce:
                return _enumExpression(changeDetectorStatus, 'CheckOnce');
            case core_private_1.ChangeDetectorStatus.Checked:
                return _enumExpression(changeDetectorStatus, 'Checked');
            case core_private_1.ChangeDetectorStatus.CheckAlways:
                return _enumExpression(changeDetectorStatus, 'CheckAlways');
            case core_private_1.ChangeDetectorStatus.Detached:
                return _enumExpression(changeDetectorStatus, 'Detached');
            case core_private_1.ChangeDetectorStatus.Errored:
                return _enumExpression(changeDetectorStatus, 'Errored');
            case core_private_1.ChangeDetectorStatus.Destroyed:
                return _enumExpression(changeDetectorStatus, 'Destroyed');
            default:
                throw Error("Inavlid ChangeDetectorStatus value: " + value);
        }
    };
    return ChangeDetectorStatusEnum;
}());
exports.ChangeDetectorStatusEnum = ChangeDetectorStatusEnum;
var ViewConstructorVars = (function () {
    function ViewConstructorVars() {
    }
    ViewConstructorVars.viewUtils = o.variable('viewUtils');
    ViewConstructorVars.parentInjector = o.variable('parentInjector');
    ViewConstructorVars.declarationEl = o.variable('declarationEl');
    return ViewConstructorVars;
}());
exports.ViewConstructorVars = ViewConstructorVars;
var ViewProperties = (function () {
    function ViewProperties() {
    }
    ViewProperties.renderer = o.THIS_EXPR.prop('renderer');
    ViewProperties.projectableNodes = o.THIS_EXPR.prop('projectableNodes');
    ViewProperties.viewUtils = o.THIS_EXPR.prop('viewUtils');
    return ViewProperties;
}());
exports.ViewProperties = ViewProperties;
var EventHandlerVars = (function () {
    function EventHandlerVars() {
    }
    EventHandlerVars.event = o.variable('$event');
    return EventHandlerVars;
}());
exports.EventHandlerVars = EventHandlerVars;
var InjectMethodVars = (function () {
    function InjectMethodVars() {
    }
    InjectMethodVars.token = o.variable('token');
    InjectMethodVars.requestNodeIndex = o.variable('requestNodeIndex');
    InjectMethodVars.notFoundResult = o.variable('notFoundResult');
    return InjectMethodVars;
}());
exports.InjectMethodVars = InjectMethodVars;
var DetectChangesVars = (function () {
    function DetectChangesVars() {
    }
    DetectChangesVars.throwOnChange = o.variable("throwOnChange");
    DetectChangesVars.changes = o.variable("changes");
    DetectChangesVars.changed = o.variable("changed");
    DetectChangesVars.valUnwrapper = o.variable("valUnwrapper");
    return DetectChangesVars;
}());
exports.DetectChangesVars = DetectChangesVars;
//# sourceMappingURL=constants.js.map