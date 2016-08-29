/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { ChangeDetectorStatus, ViewType } from '../../core_private';
import { Identifiers, resolveEnumIdentifier, resolveIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
function _enumExpression(classIdentifier, name) {
    return o.importExpr(resolveEnumIdentifier(classIdentifier, name));
}
export class ViewTypeEnum {
    static fromValue(value) {
        const viewType = resolveIdentifier(Identifiers.ViewType);
        switch (value) {
            case ViewType.HOST:
                return _enumExpression(viewType, 'HOST');
            case ViewType.COMPONENT:
                return _enumExpression(viewType, 'COMPONENT');
            case ViewType.EMBEDDED:
                return _enumExpression(viewType, 'EMBEDDED');
            default:
                throw Error(`Inavlid ViewType value: ${value}`);
        }
    }
}
export class ViewEncapsulationEnum {
    static fromValue(value) {
        const viewEncapsulation = resolveIdentifier(Identifiers.ViewEncapsulation);
        switch (value) {
            case ViewEncapsulation.Emulated:
                return _enumExpression(viewEncapsulation, 'Emulated');
            case ViewEncapsulation.Native:
                return _enumExpression(viewEncapsulation, 'Native');
            case ViewEncapsulation.None:
                return _enumExpression(viewEncapsulation, 'None');
            default:
                throw Error(`Inavlid ViewEncapsulation value: ${value}`);
        }
    }
}
export class ChangeDetectionStrategyEnum {
    static fromValue(value) {
        const changeDetectionStrategy = resolveIdentifier(Identifiers.ChangeDetectionStrategy);
        switch (value) {
            case ChangeDetectionStrategy.OnPush:
                return _enumExpression(changeDetectionStrategy, 'OnPush');
            case ChangeDetectionStrategy.Default:
                return _enumExpression(changeDetectionStrategy, 'Default');
            default:
                throw Error(`Inavlid ChangeDetectionStrategy value: ${value}`);
        }
    }
}
export class ChangeDetectorStatusEnum {
    static fromValue(value) {
        const changeDetectorStatus = resolveIdentifier(Identifiers.ChangeDetectorStatus);
        switch (value) {
            case ChangeDetectorStatus.CheckOnce:
                return _enumExpression(changeDetectorStatus, 'CheckOnce');
            case ChangeDetectorStatus.Checked:
                return _enumExpression(changeDetectorStatus, 'Checked');
            case ChangeDetectorStatus.CheckAlways:
                return _enumExpression(changeDetectorStatus, 'CheckAlways');
            case ChangeDetectorStatus.Detached:
                return _enumExpression(changeDetectorStatus, 'Detached');
            case ChangeDetectorStatus.Errored:
                return _enumExpression(changeDetectorStatus, 'Errored');
            case ChangeDetectorStatus.Destroyed:
                return _enumExpression(changeDetectorStatus, 'Destroyed');
            default:
                throw Error(`Inavlid ChangeDetectorStatus value: ${value}`);
        }
    }
}
export class ViewConstructorVars {
}
ViewConstructorVars.viewUtils = o.variable('viewUtils');
ViewConstructorVars.parentInjector = o.variable('parentInjector');
ViewConstructorVars.declarationEl = o.variable('declarationEl');
export class ViewProperties {
}
ViewProperties.renderer = o.THIS_EXPR.prop('renderer');
ViewProperties.projectableNodes = o.THIS_EXPR.prop('projectableNodes');
ViewProperties.viewUtils = o.THIS_EXPR.prop('viewUtils');
export class EventHandlerVars {
}
EventHandlerVars.event = o.variable('$event');
export class InjectMethodVars {
}
InjectMethodVars.token = o.variable('token');
InjectMethodVars.requestNodeIndex = o.variable('requestNodeIndex');
InjectMethodVars.notFoundResult = o.variable('notFoundResult');
export class DetectChangesVars {
}
DetectChangesVars.throwOnChange = o.variable(`throwOnChange`);
DetectChangesVars.changes = o.variable(`changes`);
DetectChangesVars.changed = o.variable(`changed`);
DetectChangesVars.valUnwrapper = o.variable(`valUnwrapper`);
//# sourceMappingURL=constants.js.map