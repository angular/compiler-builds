/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../output/output_ast';
export declare const enum LifeCycleGuard {
    ON_INIT = 1,
    ON_DESTROY = 2,
    ON_CHANGES = 4,
}
export declare class Identifiers {
    static NEW_METHOD: string;
    static HOST_BINDING_METHOD: string;
    static createElement: o.ExternalReference;
    static elementEnd: o.ExternalReference;
    static elementProperty: o.ExternalReference;
    static elementAttribute: o.ExternalReference;
    static elementClass: o.ExternalReference;
    static elementStyle: o.ExternalReference;
    static containerCreate: o.ExternalReference;
    static containerEnd: o.ExternalReference;
    static containerRefreshStart: o.ExternalReference;
    static containerRefreshEnd: o.ExternalReference;
    static directiveCreate: o.ExternalReference;
    static text: o.ExternalReference;
    static directiveInput: o.ExternalReference;
    static textCreateBound: o.ExternalReference;
    static bind: o.ExternalReference;
    static bind1: o.ExternalReference;
    static bind2: o.ExternalReference;
    static bind3: o.ExternalReference;
    static bind4: o.ExternalReference;
    static bind5: o.ExternalReference;
    static bind6: o.ExternalReference;
    static bind7: o.ExternalReference;
    static bind8: o.ExternalReference;
    static bindV: o.ExternalReference;
    static memory: o.ExternalReference;
    static projection: o.ExternalReference;
    static projectionDef: o.ExternalReference;
    static refreshComponent: o.ExternalReference;
    static directiveLifeCycle: o.ExternalReference;
    static injectElementRef: o.ExternalReference;
    static injectTemplateRef: o.ExternalReference;
    static injectViewContainerRef: o.ExternalReference;
    static inject: o.ExternalReference;
    static defineComponent: o.ExternalReference;
    static defineDirective: o.ExternalReference;
    static NgOnChangesFeature: o.ExternalReference;
}
