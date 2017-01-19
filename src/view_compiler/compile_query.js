/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { tokenReference } from '../compile_metadata';
import { ListWrapper } from '../facade/collection';
import { Identifiers, createIdentifier } from '../identifiers';
import * as o from '../output/output_ast';
import { getPropertyInView } from './util';
class ViewQueryValues {
    /**
     * @param {?} view
     * @param {?} values
     */
    constructor(view, values) {
        this.view = view;
        this.values = values;
    }
}
function ViewQueryValues_tsickle_Closure_declarations() {
    /** @type {?} */
    ViewQueryValues.prototype.view;
    /** @type {?} */
    ViewQueryValues.prototype.values;
}
export class CompileQuery {
    /**
     * @param {?} meta
     * @param {?} queryList
     * @param {?} ownerDirectiveExpression
     * @param {?} view
     */
    constructor(meta, queryList, ownerDirectiveExpression, view) {
        this.meta = meta;
        this.queryList = queryList;
        this.ownerDirectiveExpression = ownerDirectiveExpression;
        this.view = view;
        this._values = new ViewQueryValues(view, []);
    }
    /**
     * @param {?} value
     * @param {?} view
     * @return {?}
     */
    addValue(value, view) {
        let /** @type {?} */ currentView = view;
        const /** @type {?} */ elPath = [];
        while (currentView && currentView !== this.view) {
            const /** @type {?} */ parentEl = currentView.declarationElement;
            elPath.unshift(parentEl);
            currentView = parentEl.view;
        }
        const /** @type {?} */ queryListForDirtyExpr = getPropertyInView(this.queryList, view, this.view);
        let /** @type {?} */ viewValues = this._values;
        elPath.forEach((el) => {
            const /** @type {?} */ last = viewValues.values.length > 0 ? viewValues.values[viewValues.values.length - 1] : null;
            if (last instanceof ViewQueryValues && last.view === el.embeddedView) {
                viewValues = last;
            }
            else {
                const /** @type {?} */ newViewValues = new ViewQueryValues(el.embeddedView, []);
                viewValues.values.push(newViewValues);
                viewValues = newViewValues;
            }
        });
        viewValues.values.push(value);
        if (elPath.length > 0) {
            view.dirtyParentQueriesMethod.addStmt(queryListForDirtyExpr.callMethod('setDirty', []).toStmt());
        }
    }
    /**
     * @return {?}
     */
    _isStatic() {
        return !this._values.values.some(value => value instanceof ViewQueryValues);
    }
    /**
     * @param {?} targetStaticMethod
     * @param {?} targetDynamicMethod
     * @return {?}
     */
    generateStatements(targetStaticMethod, targetDynamicMethod) {
        const /** @type {?} */ values = createQueryValues(this._values);
        const /** @type {?} */ updateStmts = [this.queryList.callMethod('reset', [o.literalArr(values)]).toStmt()];
        if (this.ownerDirectiveExpression) {
            const /** @type {?} */ valueExpr = this.meta.first ? this.queryList.prop('first') : this.queryList;
            updateStmts.push(this.ownerDirectiveExpression.prop(this.meta.propertyName).set(valueExpr).toStmt());
        }
        if (!this.meta.first) {
            updateStmts.push(this.queryList.callMethod('notifyOnChanges', []).toStmt());
        }
        if (this.meta.first && this._isStatic()) {
            // for queries that don't change and the user asked for a single element,
            // set it immediately. That is e.g. needed for querying for ViewContainerRefs, ...
            // we don't do this for QueryLists for now as this would break the timing when
            // we call QueryList listeners...
            targetStaticMethod.addStmts(updateStmts);
        }
        else {
            targetDynamicMethod.addStmt(new o.IfStmt(this.queryList.prop('dirty'), updateStmts));
        }
    }
}
function CompileQuery_tsickle_Closure_declarations() {
    /** @type {?} */
    CompileQuery.prototype._values;
    /** @type {?} */
    CompileQuery.prototype.meta;
    /** @type {?} */
    CompileQuery.prototype.queryList;
    /** @type {?} */
    CompileQuery.prototype.ownerDirectiveExpression;
    /** @type {?} */
    CompileQuery.prototype.view;
}
/**
 * @param {?} viewValues
 * @return {?}
 */
function createQueryValues(viewValues) {
    return ListWrapper.flatten(viewValues.values.map((entry) => {
        if (entry instanceof ViewQueryValues) {
            return mapNestedViews(entry.view.declarationElement.viewContainer, entry.view, createQueryValues(entry));
        }
        else {
            return (entry);
        }
    }));
}
/**
 * @param {?} viewContainer
 * @param {?} view
 * @param {?} expressions
 * @return {?}
 */
function mapNestedViews(viewContainer, view, expressions) {
    const /** @type {?} */ adjustedExpressions = expressions.map((expr) => o.replaceVarInExpression(o.THIS_EXPR.name, o.variable('nestedView'), expr));
    return viewContainer.callMethod('mapNestedViews', [
        o.variable(view.className),
        o.fn([new o.FnParam('nestedView', view.classType)], [new o.ReturnStatement(o.literalArr(adjustedExpressions))], o.DYNAMIC_TYPE)
    ]);
}
/**
 * @param {?} propertyName
 * @param {?} compileView
 * @return {?}
 */
export function createQueryList(propertyName, compileView) {
    compileView.fields.push(new o.ClassField(propertyName, o.importType(createIdentifier(Identifiers.QueryList), [o.DYNAMIC_TYPE])));
    const /** @type {?} */ expr = o.THIS_EXPR.prop(propertyName);
    compileView.createMethod.addStmt(o.THIS_EXPR.prop(propertyName)
        .set(o.importExpr(createIdentifier(Identifiers.QueryList), [o.DYNAMIC_TYPE]).instantiate([]))
        .toStmt());
    return expr;
}
/**
 * @param {?} map
 * @param {?} query
 * @return {?}
 */
export function addQueryToTokenMap(map, query) {
    query.meta.selectors.forEach((selector) => {
        let /** @type {?} */ entry = map.get(tokenReference(selector));
        if (!entry) {
            entry = [];
            map.set(tokenReference(selector), entry);
        }
        entry.push(query);
    });
}
//# sourceMappingURL=compile_query.js.map