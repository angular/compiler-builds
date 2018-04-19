/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SecurityContext } from '../core';
import { AST } from '../expression_parser/ast';
import { ParseSourceSpan } from '../parse_util';
export interface Node {
    sourceSpan: ParseSourceSpan;
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Text implements Node {
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(value: string, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class BoundText implements Node {
    value: AST;
    sourceSpan: ParseSourceSpan;
    constructor(value: AST, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class TextAttribute implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    valueSpan: ParseSourceSpan | undefined;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan, valueSpan?: ParseSourceSpan | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
/**
 * Enumeration of types of property bindings.
 */
export declare enum PropertyBindingType {
    /**
     * A normal binding to a property (e.g. `[property]="expression"`).
     */
    Property = 0,
    /**
     * A binding to an element attribute (e.g. `[attr.name]="expression"`).
     */
    Attribute = 1,
    /**
     * A binding to a CSS class (e.g. `[class.name]="condition"`).
     */
    Class = 2,
    /**
     * A binding to a style rule (e.g. `[style.rule]="expression"`).
     */
    Style = 3,
    /**
     * A binding to an animation reference (e.g. `[animate.key]="expression"`).
     */
    Animation = 4,
}
export declare class BoundAttribute implements Node {
    name: string;
    type: PropertyBindingType;
    securityContext: SecurityContext;
    value: AST;
    unit: string | null;
    sourceSpan: ParseSourceSpan;
    constructor(name: string, type: PropertyBindingType, securityContext: SecurityContext, value: AST, unit: string | null, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class BoundEvent implements Node {
    name: string;
    handler: AST;
    target: string | null;
    phase: string | null;
    sourceSpan: ParseSourceSpan;
    constructor(name: string, handler: AST, target: string | null, phase: string | null, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Element implements Node {
    name: string;
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    outputs: BoundEvent[];
    children: Node[];
    references: Reference[];
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan | null;
    endSourceSpan: ParseSourceSpan | null;
    constructor(name: string, attributes: TextAttribute[], inputs: BoundAttribute[], outputs: BoundEvent[], children: Node[], references: Reference[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan | null, endSourceSpan: ParseSourceSpan | null);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Template implements Node {
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    children: Node[];
    references: Reference[];
    variables: Variable[];
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan | null;
    endSourceSpan: ParseSourceSpan | null;
    constructor(attributes: TextAttribute[], inputs: BoundAttribute[], children: Node[], references: Reference[], variables: Variable[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan | null, endSourceSpan: ParseSourceSpan | null);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Content implements Node {
    selectorIndex: number;
    attributes: TextAttribute[];
    sourceSpan: ParseSourceSpan;
    constructor(selectorIndex: number, attributes: TextAttribute[], sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Variable implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export declare class Reference implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
export interface Visitor<Result = any> {
    visit?(node: Node): Result;
    visitElement(element: Element): Result;
    visitTemplate(template: Template): Result;
    visitContent(content: Content): Result;
    visitVariable(variable: Variable): Result;
    visitReference(reference: Reference): Result;
    visitAttribute(attribute: TextAttribute): Result;
    visitBoundAttribute(attribute: BoundAttribute): Result;
    visitBoundEvent(attribute: BoundEvent): Result;
    visitText(text: Text): Result;
    visitBoundText(text: BoundText): Result;
}
export declare class NullVisitor implements Visitor<void> {
    visitElement(element: Element): void;
    visitTemplate(template: Template): void;
    visitContent(content: Content): void;
    visitVariable(variable: Variable): void;
    visitReference(reference: Reference): void;
    visitAttribute(attribute: TextAttribute): void;
    visitBoundAttribute(attribute: BoundAttribute): void;
    visitBoundEvent(attribute: BoundEvent): void;
    visitText(text: Text): void;
    visitBoundText(text: BoundText): void;
}
export declare class RecursiveVisitor implements Visitor<void> {
    visitElement(element: Element): void;
    visitTemplate(template: Template): void;
    visitContent(content: Content): void;
    visitVariable(variable: Variable): void;
    visitReference(reference: Reference): void;
    visitAttribute(attribute: TextAttribute): void;
    visitBoundAttribute(attribute: BoundAttribute): void;
    visitBoundEvent(attribute: BoundEvent): void;
    visitText(text: Text): void;
    visitBoundText(text: BoundText): void;
}
export declare class TransformVisitor implements Visitor<Node> {
    visitElement(element: Element): Node;
    visitTemplate(template: Template): Node;
    visitContent(content: Content): Node;
    visitVariable(variable: Variable): Node;
    visitReference(reference: Reference): Node;
    visitAttribute(attribute: TextAttribute): Node;
    visitBoundAttribute(attribute: BoundAttribute): Node;
    visitBoundEvent(attribute: BoundEvent): Node;
    visitText(text: Text): Node;
    visitBoundText(text: BoundText): Node;
}
export declare function visitAll<Result>(visitor: Visitor<Result>, nodes: Node[]): Result[];
export declare function transformAll<Result extends Node>(visitor: Visitor<Node>, nodes: Result[]): Result[];
