/**
 * @license Angular v22.3.0-next.2+sha-4690b54
 * (c) 2010-2026 Google LLC. https://angular.dev/
 * License: MIT
 */

/**
 * A SecurityContext marks a location that has dangerous security implications, e.g. a DOM property
 * like `innerHTML` that could cause Cross Site Scripting (XSS) security bugs when improperly
 * handled.
 *
 * See DomSanitizer for more details on security in Angular applications.
 *
 * @publicApi
 */
declare enum SecurityContext {
    NONE = 0,
    HTML = 1,
    STYLE = 2,
    SCRIPT = 3,
    URL = 4,
    RESOURCE_URL = 5,
    ATTRIBUTE_NO_BINDING = 6
}

declare class ParseLocation {
    file: ParseSourceFile;
    offset: number;
    line: number;
    col: number;
    constructor(file: ParseSourceFile, offset: number, line: number, col: number);
    toString(): string;
    moveBy(delta: number): ParseLocation;
    getContext(maxChars: number, maxLines: number): {
        before: string;
        after: string;
    } | null;
}
declare class ParseSourceFile {
    content: string;
    url: string;
    constructor(content: string, url: string);
}
declare class ParseSourceSpan {
    start: ParseLocation;
    end: ParseLocation;
    fullStart: ParseLocation;
    details: string | null;
    /**
     * Create an object that holds information about spans of tokens/nodes captured during
     * lexing/parsing of text.
     *
     * @param start
     * The location of the start of the span (having skipped leading trivia).
     * Skipping leading trivia makes source-spans more "user friendly", since things like HTML
     * elements will appear to begin at the start of the opening tag, rather than at the start of any
     * leading trivia, which could include newlines.
     *
     * @param end
     * The location of the end of the span.
     *
     * @param fullStart
     * The start of the token without skipping the leading trivia.
     * This is used by tooling that splits tokens further, such as extracting Angular interpolations
     * from text tokens. Such tooling creates new source-spans relative to the original token's
     * source-span. If leading trivia characters have been skipped then the new source-spans may be
     * incorrectly offset.
     *
     * @param details
     * Additional information (such as identifier names) that should be associated with the span.
     */
    constructor(start: ParseLocation, end: ParseLocation, fullStart?: ParseLocation, details?: string | null);
    toString(): string;
}
declare enum ParseErrorLevel {
    WARNING = 0,
    ERROR = 1
}
declare class ParseError extends Error {
    /** Location of the error. */
    readonly span: ParseSourceSpan;
    /** Error message. */
    readonly msg: string;
    /** Severity level of the error. */
    readonly level: ParseErrorLevel;
    /**
     * Error that caused the error to be surfaced. For example, an error in a sub-expression that
     * couldn't be parsed. Not guaranteed to be defined, but can be used to provide more context.
     */
    readonly relatedError?: unknown | undefined;
    constructor(
    /** Location of the error. */
    span: ParseSourceSpan, 
    /** Error message. */
    msg: string, 
    /** Severity level of the error. */
    level?: ParseErrorLevel, 
    /**
     * Error that caused the error to be surfaced. For example, an error in a sub-expression that
     * couldn't be parsed. Not guaranteed to be defined, but can be used to provide more context.
     */
    relatedError?: unknown | undefined);
    contextualMessage(): string;
    toString(): string;
}
/**
 * Generates Source Span object for a given R3 Type for JIT mode.
 *
 * @param kind Component or Directive.
 * @param typeName name of the Component or Directive.
 * @param sourceUrl reference to Component or Directive source.
 * @returns instance of ParseSourceSpan that represent a given Component or Directive.
 */
declare function r3JitTypeSourceSpan(kind: string, typeName: string, sourceUrl: string): ParseSourceSpan;
declare function identifierName(compileIdentifier: CompileIdentifierMetadata | null | undefined): string | null;
interface CompileIdentifierMetadata {
    reference: any;
}
declare function sanitizeIdentifier(name: string): string;

/**
 * Describes the text contents of a placeholder as it appears in an ICU expression, including its
 * source span information.
 */
interface MessagePlaceholder {
    /** The text contents of the placeholder */
    text: string;
    /** The source span of the placeholder */
    sourceSpan: ParseSourceSpan;
}
declare class Message {
    nodes: Node$1[];
    placeholders: {
        [phName: string]: MessagePlaceholder;
    };
    placeholderToMessage: {
        [phName: string]: Message;
    };
    meaning: string;
    description: string;
    customId: string;
    sources: MessageSpan[];
    id: string;
    /** The ids to use if there are no custom id and if `i18nLegacyMessageIdFormat` is not empty */
    legacyIds: string[];
    messageString: string;
    /**
     * @param nodes message AST
     * @param placeholders maps placeholder names to static content and their source spans
     * @param placeholderToMessage maps placeholder names to messages (used for nested ICU messages)
     * @param meaning
     * @param description
     * @param customId
     */
    constructor(nodes: Node$1[], placeholders: {
        [phName: string]: MessagePlaceholder;
    }, placeholderToMessage: {
        [phName: string]: Message;
    }, meaning: string, description: string, customId: string);
}
interface MessageSpan {
    filePath: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}
interface Node$1 {
    sourceSpan: ParseSourceSpan;
    visit(visitor: Visitor$1, context?: any): any;
}
declare class Text$1 implements Node$1 {
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(value: string, sourceSpan: ParseSourceSpan);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class Container implements Node$1 {
    children: Node$1[];
    sourceSpan: ParseSourceSpan;
    constructor(children: Node$1[], sourceSpan: ParseSourceSpan);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class Icu$1 implements Node$1 {
    expression: string;
    type: string;
    cases: {
        [k: string]: Node$1;
    };
    sourceSpan: ParseSourceSpan;
    expressionPlaceholder?: string | undefined;
    constructor(expression: string, type: string, cases: {
        [k: string]: Node$1;
    }, sourceSpan: ParseSourceSpan, expressionPlaceholder?: string | undefined);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class TagPlaceholder implements Node$1 {
    tag: string;
    attrs: {
        [k: string]: string;
    };
    startName: string;
    closeName: string;
    children: Node$1[];
    isVoid: boolean;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan | null;
    endSourceSpan: ParseSourceSpan | null;
    constructor(tag: string, attrs: {
        [k: string]: string;
    }, startName: string, closeName: string, children: Node$1[], isVoid: boolean, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan | null, endSourceSpan: ParseSourceSpan | null);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class Placeholder implements Node$1 {
    value: string;
    name: string;
    sourceSpan: ParseSourceSpan;
    constructor(value: string, name: string, sourceSpan: ParseSourceSpan);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class IcuPlaceholder implements Node$1 {
    value: Icu$1;
    name: string;
    sourceSpan: ParseSourceSpan;
    /** Used to capture a message computed from a previous processing pass (see `setI18nRefs()`). */
    previousMessage?: Message;
    constructor(value: Icu$1, name: string, sourceSpan: ParseSourceSpan);
    visit(visitor: Visitor$1, context?: any): any;
}
declare class BlockPlaceholder implements Node$1 {
    name: string;
    parameters: string[];
    startName: string;
    closeName: string;
    children: Node$1[];
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan | null;
    endSourceSpan: ParseSourceSpan | null;
    constructor(name: string, parameters: string[], startName: string, closeName: string, children: Node$1[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan | null, endSourceSpan: ParseSourceSpan | null);
    visit(visitor: Visitor$1, context?: any): any;
}
/**
 * Each HTML node that is affect by an i18n tag will also have an `i18n` property that is of type
 * `I18nMeta`.
 * This information is either a `Message`, which indicates it is the root of an i18n message, or a
 * `Node`, which indicates is it part of a containing `Message`.
 */
type I18nMeta = Message | Node$1;
interface Visitor$1 {
    visitText(text: Text$1, context?: any): any;
    visitContainer(container: Container, context?: any): any;
    visitIcu(icu: Icu$1, context?: any): any;
    visitTagPlaceholder(ph: TagPlaceholder, context?: any): any;
    visitPlaceholder(ph: Placeholder, context?: any): any;
    visitIcuPlaceholder(ph: IcuPlaceholder, context?: any): any;
    visitBlockPlaceholder(ph: BlockPlaceholder, context?: any): any;
}

declare class ParseSpan {
    start: number;
    end: number;
    constructor(start: number, end: number);
    toAbsolute(absoluteOffset: number): AbsoluteSourceSpan;
}
declare abstract class AST {
    span: ParseSpan;
    /**
     * Absolute location of the expression AST in a source code file.
     */
    sourceSpan: AbsoluteSourceSpan;
    constructor(span: ParseSpan, 
    /**
     * Absolute location of the expression AST in a source code file.
     */
    sourceSpan: AbsoluteSourceSpan);
    abstract visit(visitor: AstVisitor, context?: any): any;
    toString(): string;
}
declare abstract class ASTWithName extends AST {
    nameSpan: AbsoluteSourceSpan;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, nameSpan: AbsoluteSourceSpan);
}
declare class EmptyExpr extends AST {
    visit(visitor: AstVisitor, context?: any): any;
}
declare class ImplicitReceiver extends AST {
    visit(visitor: AstVisitor, context?: any): any;
}
declare class ThisReceiver extends AST {
    visit(visitor: AstVisitor, context?: any): any;
}
/**
 * Multiple expressions separated by a semicolon.
 */
declare class Chain extends AST {
    expressions: AST[];
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expressions: AST[]);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class Conditional extends AST {
    condition: AST;
    trueExp: AST;
    falseExp: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, condition: AST, trueExp: AST, falseExp: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class PropertyRead extends ASTWithName {
    receiver: AST;
    name: string;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, nameSpan: AbsoluteSourceSpan, receiver: AST, name: string);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class SafePropertyRead extends ASTWithName {
    receiver: AST;
    name: string;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, nameSpan: AbsoluteSourceSpan, receiver: AST, name: string);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class KeyedRead extends AST {
    receiver: AST;
    key: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, receiver: AST, key: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class SafeKeyedRead extends AST {
    receiver: AST;
    key: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, receiver: AST, key: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
/** Possible types for a pipe. */
declare enum BindingPipeType {
    /**
     * Pipe is being referenced by its name, for example:
     * `@Pipe({name: 'foo'}) class FooPipe` and `{{123 | foo}}`.
     */
    ReferencedByName = 0,
    /**
     * Pipe is being referenced by its class name, for example:
     * `@Pipe() class FooPipe` and `{{123 | FooPipe}}`.
     */
    ReferencedDirectly = 1
}
declare class BindingPipe extends ASTWithName {
    exp: AST;
    name: string;
    args: AST[];
    readonly type: BindingPipeType;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, exp: AST, name: string, args: AST[], type: BindingPipeType, nameSpan: AbsoluteSourceSpan);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class LiteralPrimitive extends AST {
    value: string | number | boolean | null | undefined;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, value: string | number | boolean | null | undefined);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class LiteralArray extends AST {
    expressions: AST[];
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expressions: AST[]);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class SpreadElement extends AST {
    readonly expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
interface LiteralMapPropertyKey {
    kind: 'property';
    key: string;
    quoted: boolean;
    span: ParseSpan;
    sourceSpan: AbsoluteSourceSpan;
    isShorthandInitialized?: boolean;
}
interface LiteralMapSpreadKey {
    kind: 'spread';
    span: ParseSpan;
    sourceSpan: AbsoluteSourceSpan;
}
type LiteralMapKey = LiteralMapPropertyKey | LiteralMapSpreadKey;
declare class LiteralMap extends AST {
    keys: LiteralMapKey[];
    values: AST[];
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, keys: LiteralMapKey[], values: AST[]);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class Interpolation extends AST {
    strings: string[];
    expressions: AST[];
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, strings: string[], expressions: AST[]);
    visit(visitor: AstVisitor, context?: any): any;
}
type AssignmentOperation = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=' | '&&=' | '||=' | '??=';
type BinaryOperation = AssignmentOperation | '&&' | '||' | '??' | '==' | '!=' | '===' | '!==' | '<' | '>' | '<=' | '>=' | 'in' | 'instanceof' | '+' | '-' | '*' | '%' | '/' | '**';
declare class Binary extends AST {
    operation: BinaryOperation;
    left: AST;
    right: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, operation: BinaryOperation, left: AST, right: AST);
    visit(visitor: AstVisitor, context?: any): any;
    static isAssignmentOperation(op: string): op is AssignmentOperation;
}
/**
 * For backwards compatibility reasons, `Unary` inherits from `Binary` and mimics the binary AST
 * node that was originally used. This inheritance relation can be deleted in some future major,
 * after consumers have been given a chance to fully support Unary.
 */
declare class Unary extends Binary {
    operator: '+' | '-' | '++' | '--';
    expr: AST;
    isPrefix: boolean;
    left: never;
    right: never;
    operation: never;
    static isUpdateOperation(op: string): op is '++' | '--';
    /**
     * Creates a unary minus expression (e.g. `-x`).
     */
    static createMinus(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expr: AST): Unary;
    /**
     * Creates a unary plus expression (e.g. `+x`).
     */
    static createPlus(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expr: AST): Unary;
    /**
     * Creates a prefix expression (e.g. `++x` or `--y`).
     */
    static createPrefixUpdate(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, operator: '++' | '--', expr: AST): Unary;
    /**
     * Creates a postfix expression (e.g. `x++` or `y--`).
     */
    static createPostfixUpdate(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, operator: '++' | '--', expr: AST): Unary;
    /**
     * During the deprecation period this constructor is private, to avoid consumers from creating
     * a `Unary` with the fallback properties for `Binary`.
     */
    private constructor();
    visit(visitor: AstVisitor, context?: any): any;
}
declare class PrefixNot extends AST {
    expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class TypeofExpression extends AST {
    expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class VoidExpression extends AST {
    expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class NonNullAssert extends AST {
    expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class Call extends AST {
    receiver: AST;
    args: AST[];
    argumentSpan: AbsoluteSourceSpan;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, receiver: AST, args: AST[], argumentSpan: AbsoluteSourceSpan);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class SafeCall extends AST {
    receiver: AST;
    args: AST[];
    argumentSpan: AbsoluteSourceSpan;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, receiver: AST, args: AST[], argumentSpan: AbsoluteSourceSpan);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class TaggedTemplateLiteral extends AST {
    tag: AST;
    template: TemplateLiteral;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, tag: AST, template: TemplateLiteral);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class TemplateLiteral extends AST {
    elements: TemplateLiteralElement[];
    expressions: AST[];
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, elements: TemplateLiteralElement[], expressions: AST[]);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class TemplateLiteralElement extends AST {
    text: string;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, text: string);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class ParenthesizedExpression extends AST {
    expression: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, expression: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
/**
 * Unwraps any parentheses and non-null assertions around the target of a write operation.
 */
declare function unwrapWriteTarget(ast: AST): AST;
declare class ArrowFunctionIdentifierParameter {
    name: string;
    span: ParseSpan;
    sourceSpan: AbsoluteSourceSpan;
    constructor(name: string, span: ParseSpan, sourceSpan: AbsoluteSourceSpan);
}
type ArrowFunctionParameter = ArrowFunctionIdentifierParameter;
declare class ArrowFunction extends AST {
    parameters: ArrowFunctionParameter[];
    body: AST;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, parameters: ArrowFunctionParameter[], body: AST);
    visit(visitor: AstVisitor, context?: any): any;
}
declare class RegularExpressionLiteral extends AST {
    readonly body: string;
    readonly flags: string | null;
    constructor(span: ParseSpan, sourceSpan: AbsoluteSourceSpan, body: string, flags: string | null);
    visit(visitor: AstVisitor, context?: any): any;
}
/**
 * Records the absolute position of a text span in a source file, where `start` and `end` are the
 * starting and ending byte offsets, respectively, of the text span in a source file.
 */
declare class AbsoluteSourceSpan {
    readonly start: number;
    readonly end: number;
    constructor(start: number, end: number);
}
declare class ASTWithSource<T extends AST = AST> extends AST {
    ast: T;
    source: string | null;
    location: string;
    errors: ParseError[];
    constructor(ast: T, source: string | null, location: string, absoluteOffset: number, errors: ParseError[]);
    visit(visitor: AstVisitor, context?: any): any;
    toString(): string;
}
/**
 * TemplateBinding refers to a particular key-value pair in a microsyntax
 * expression. A few examples are:
 *
 *   |---------------------|--------------|---------|--------------|
 *   |     expression      |     key      |  value  | binding type |
 *   |---------------------|--------------|---------|--------------|
 *   | 1. let item         |    item      |  null   |   variable   |
 *   | 2. of items         |   ngForOf    |  items  |  expression  |
 *   | 3. let x = y        |      x       |    y    |   variable   |
 *   | 4. index as i       |      i       |  index  |   variable   |
 *   | 5. trackBy: func    | ngForTrackBy |   func  |  expression  |
 *   | 6. *ngIf="cond"     |     ngIf     |   cond  |  expression  |
 *   |---------------------|--------------|---------|--------------|
 *
 * (6) is a notable exception because it is a binding from the template key in
 * the LHS of a HTML attribute to the expression in the RHS. All other bindings
 * in the example above are derived solely from the RHS.
 */
type TemplateBinding = VariableBinding | ExpressionBinding;
declare class VariableBinding {
    readonly sourceSpan: AbsoluteSourceSpan;
    readonly key: TemplateBindingIdentifier;
    readonly value: TemplateBindingIdentifier | null;
    /**
     * @param sourceSpan entire span of the binding.
     * @param key name of the LHS along with its span.
     * @param value optional value for the RHS along with its span.
     */
    constructor(sourceSpan: AbsoluteSourceSpan, key: TemplateBindingIdentifier, value: TemplateBindingIdentifier | null);
}
declare class ExpressionBinding {
    readonly sourceSpan: AbsoluteSourceSpan;
    readonly key: TemplateBindingIdentifier;
    readonly value: ASTWithSource | null;
    /**
     * @param sourceSpan entire span of the binding.
     * @param key binding name, like ngForOf, ngForTrackBy, ngIf, along with its
     * span. Note that the length of the span may not be the same as
     * `key.source.length`. For example,
     * 1. key.source = ngFor, key.span is for "ngFor"
     * 2. key.source = ngForOf, key.span is for "of"
     * 3. key.source = ngForTrackBy, key.span is for "trackBy"
     * @param value optional expression for the RHS.
     */
    constructor(sourceSpan: AbsoluteSourceSpan, key: TemplateBindingIdentifier, value: ASTWithSource | null);
}
interface TemplateBindingIdentifier {
    source: string;
    span: AbsoluteSourceSpan;
}
interface AstVisitor {
    /**
     * The `visitUnary` method is declared as optional for backwards compatibility. In an upcoming
     * major release, this method will be made required.
     */
    visitUnary?(ast: Unary, context: any): any;
    visitBinary(ast: Binary, context: any): any;
    visitChain(ast: Chain, context: any): any;
    visitConditional(ast: Conditional, context: any): any;
    /**
     * The `visitThisReceiver` method is declared as optional for backwards compatibility.
     * In an upcoming major release, this method will be made required.
     */
    visitThisReceiver?(ast: ThisReceiver, context: any): any;
    visitImplicitReceiver(ast: ImplicitReceiver, context: any): any;
    visitInterpolation(ast: Interpolation, context: any): any;
    visitKeyedRead(ast: KeyedRead, context: any): any;
    visitLiteralArray(ast: LiteralArray, context: any): any;
    visitLiteralMap(ast: LiteralMap, context: any): any;
    visitLiteralPrimitive(ast: LiteralPrimitive, context: any): any;
    visitPipe(ast: BindingPipe, context: any): any;
    visitPrefixNot(ast: PrefixNot, context: any): any;
    visitTypeofExpression(ast: TypeofExpression, context: any): any;
    visitVoidExpression(ast: TypeofExpression, context: any): any;
    visitNonNullAssert(ast: NonNullAssert, context: any): any;
    visitPropertyRead(ast: PropertyRead, context: any): any;
    visitSafePropertyRead(ast: SafePropertyRead, context: any): any;
    visitSafeKeyedRead(ast: SafeKeyedRead, context: any): any;
    visitCall(ast: Call, context: any): any;
    visitSafeCall(ast: SafeCall, context: any): any;
    visitTemplateLiteral(ast: TemplateLiteral, context: any): any;
    visitTemplateLiteralElement(ast: TemplateLiteralElement, context: any): any;
    visitTaggedTemplateLiteral(ast: TaggedTemplateLiteral, context: any): any;
    visitParenthesizedExpression(ast: ParenthesizedExpression, context: any): any;
    visitArrowFunction(ast: ArrowFunction, context: any): any;
    visitRegularExpressionLiteral(ast: RegularExpressionLiteral, context: any): any;
    visitSpreadElement(ast: SpreadElement, context: any): any;
    visitASTWithSource?(ast: ASTWithSource, context: any): any;
    visitEmptyExpr?(ast: EmptyExpr, context: any): any;
    /**
     * This function is optionally defined to allow classes that implement this
     * interface to selectively decide if the specified `ast` should be visited.
     * @param ast node to visit
     * @param context context that gets passed to the node and all its children
     */
    visit?(ast: AST, context?: any): any;
}
declare class RecursiveAstVisitor implements AstVisitor {
    visit(ast: AST, context?: any): any;
    visitUnary(ast: Unary, context: any): any;
    visitBinary(ast: Binary, context: any): any;
    visitChain(ast: Chain, context: any): any;
    visitConditional(ast: Conditional, context: any): any;
    visitPipe(ast: BindingPipe, context: any): any;
    visitImplicitReceiver(ast: ThisReceiver, context: any): any;
    visitThisReceiver(ast: ThisReceiver, context: any): any;
    visitInterpolation(ast: Interpolation, context: any): any;
    visitKeyedRead(ast: KeyedRead, context: any): any;
    visitLiteralArray(ast: LiteralArray, context: any): any;
    visitLiteralMap(ast: LiteralMap, context: any): any;
    visitLiteralPrimitive(ast: LiteralPrimitive, context: any): any;
    visitPrefixNot(ast: PrefixNot, context: any): any;
    visitTypeofExpression(ast: TypeofExpression, context: any): void;
    visitVoidExpression(ast: VoidExpression, context: any): void;
    visitNonNullAssert(ast: NonNullAssert, context: any): any;
    visitPropertyRead(ast: PropertyRead, context: any): any;
    visitSafePropertyRead(ast: SafePropertyRead, context: any): any;
    visitSafeKeyedRead(ast: SafeKeyedRead, context: any): any;
    visitCall(ast: Call, context: any): any;
    visitSafeCall(ast: SafeCall, context: any): any;
    visitTemplateLiteral(ast: TemplateLiteral, context: any): void;
    visitTemplateLiteralElement(ast: TemplateLiteralElement, context: any): void;
    visitTaggedTemplateLiteral(ast: TaggedTemplateLiteral, context: any): void;
    visitParenthesizedExpression(ast: ParenthesizedExpression, context: any): void;
    visitArrowFunction(ast: ArrowFunction, context: any): any;
    visitRegularExpressionLiteral(ast: RegularExpressionLiteral, context: any): void;
    visitSpreadElement(ast: SpreadElement, context: any): void;
    visitEmptyExpr(ast: EmptyExpr, context: any): any;
    visitAll(asts: AST[], context: any): any;
}
declare class ParsedProperty {
    name: string;
    expression: ASTWithSource;
    type: ParsedPropertyType;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    valueSpan: ParseSourceSpan | undefined;
    readonly isLiteral: boolean;
    readonly isLegacyAnimation: boolean;
    readonly isAnimation: boolean;
    constructor(name: string, expression: ASTWithSource, type: ParsedPropertyType, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan, valueSpan: ParseSourceSpan | undefined);
}
declare enum ParsedPropertyType {
    DEFAULT = 0,
    LITERAL_ATTR = 1,
    LEGACY_ANIMATION = 2,
    TWO_WAY = 3,
    ANIMATION = 4
}
declare enum ParsedEventType {
    Regular = 0,
    LegacyAnimation = 1,
    TwoWay = 2,
    Animation = 3
}
declare class ParsedEvent {
    name: string;
    targetOrPhase: string | null;
    type: ParsedEventType;
    handler: ASTWithSource;
    sourceSpan: ParseSourceSpan;
    handlerSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    constructor(name: string, targetOrPhase: string | null, type: ParsedEventType.TwoWay, handler: ASTWithSource<NonNullAssert | PropertyRead | KeyedRead>, sourceSpan: ParseSourceSpan, handlerSpan: ParseSourceSpan, keySpan: ParseSourceSpan);
    constructor(name: string, targetOrPhase: string | null, type: ParsedEventType, handler: ASTWithSource, sourceSpan: ParseSourceSpan, handlerSpan: ParseSourceSpan, keySpan: ParseSourceSpan);
}
/**
 * ParsedVariable represents a variable declaration in a microsyntax expression.
 */
declare class ParsedVariable {
    readonly name: string;
    readonly value: string;
    readonly sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    readonly valueSpan?: ParseSourceSpan | undefined;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan, valueSpan?: ParseSourceSpan | undefined);
}
declare enum BindingType {
    Property = 0,
    Attribute = 1,
    Class = 2,
    Style = 3,
    LegacyAnimation = 4,
    TwoWay = 5,
    Animation = 6
}
declare class BoundElementProperty {
    name: string;
    type: BindingType;
    securityContext: SecurityContext;
    value: ASTWithSource;
    unit: string | null;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan | undefined;
    valueSpan: ParseSourceSpan | undefined;
    constructor(name: string, type: BindingType, securityContext: SecurityContext, value: ASTWithSource, unit: string | null, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan | undefined, valueSpan: ParseSourceSpan | undefined);
}

interface Node {
    sourceSpan: ParseSourceSpan;
    visit<Result>(visitor: Visitor<Result>): Result;
}
/**
 * This is an R3 `Node`-like wrapper for a raw `html.Comment` node. We do not currently
 * require the implementation of a visitor for Comments as they are only collected at
 * the top-level of the R3 AST, and only if `Render3ParseOptions['collectCommentNodes']`
 * is true.
 */
declare class Comment implements Node {
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(value: string, sourceSpan: ParseSourceSpan);
    visit<Result>(_visitor: Visitor<Result>): Result;
}
declare class Text implements Node {
    value: string;
    sourceSpan: ParseSourceSpan;
    constructor(value: string, sourceSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundText implements Node {
    value: AST;
    sourceSpan: ParseSourceSpan;
    i18n?: I18nMeta | undefined;
    constructor(value: AST, sourceSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
/**
 * Represents a text attribute in the template.
 *
 * `valueSpan` may not be present in cases where there is no value `<div a></div>`.
 * `keySpan` may also not be present for synthetic attributes from ICU expansions.
 */
declare class TextAttribute implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan | undefined;
    valueSpan?: ParseSourceSpan | undefined;
    i18n?: I18nMeta | undefined;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan | undefined, valueSpan?: ParseSourceSpan | undefined, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundAttribute implements Node {
    name: string;
    type: BindingType;
    securityContext: SecurityContext;
    value: AST;
    unit: string | null;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    valueSpan: ParseSourceSpan | undefined;
    i18n: I18nMeta | undefined;
    constructor(name: string, type: BindingType, securityContext: SecurityContext, value: AST, unit: string | null, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan, valueSpan: ParseSourceSpan | undefined, i18n: I18nMeta | undefined);
    static fromBoundElementProperty(prop: BoundElementProperty, i18n?: I18nMeta): BoundAttribute;
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundEvent implements Node {
    name: string;
    type: ParsedEventType;
    handler: AST;
    target: string | null;
    phase: string | null;
    sourceSpan: ParseSourceSpan;
    handlerSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    constructor(name: string, type: ParsedEventType, handler: AST, target: string | null, phase: string | null, sourceSpan: ParseSourceSpan, handlerSpan: ParseSourceSpan, keySpan: ParseSourceSpan);
    static fromParsedEvent(event: ParsedEvent): BoundEvent;
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Element implements Node {
    name: string;
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    outputs: BoundEvent[];
    directives: Directive[];
    children: Node[];
    references: Reference[];
    isSelfClosing: boolean;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    readonly isVoid: boolean;
    i18n?: I18nMeta | undefined;
    constructor(name: string, attributes: TextAttribute[], inputs: BoundAttribute[], outputs: BoundEvent[], directives: Directive[], children: Node[], references: Reference[], isSelfClosing: boolean, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, isVoid: boolean, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare abstract class DeferredTrigger implements Node {
    nameSpan: ParseSourceSpan | null;
    sourceSpan: ParseSourceSpan;
    prefetchSpan: ParseSourceSpan | null;
    whenOrOnSourceSpan: ParseSourceSpan | null;
    hydrateSpan: ParseSourceSpan | null;
    constructor(nameSpan: ParseSourceSpan | null, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, whenOrOnSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundDeferredTrigger extends DeferredTrigger {
    value: AST;
    constructor(value: AST, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, whenSourceSpan: ParseSourceSpan, hydrateSpan: ParseSourceSpan | null);
}
declare class NeverDeferredTrigger extends DeferredTrigger {
}
declare class IdleDeferredTrigger extends DeferredTrigger {
    timeout: number | null;
    constructor(nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, onSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null, timeout: number | null);
}
declare class ImmediateDeferredTrigger extends DeferredTrigger {
}
declare class HoverDeferredTrigger extends DeferredTrigger {
    reference: string | null;
    constructor(reference: string | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, onSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null);
}
declare class TimerDeferredTrigger extends DeferredTrigger {
    delay: number;
    constructor(delay: number, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, onSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null);
}
declare class InteractionDeferredTrigger extends DeferredTrigger {
    reference: string | null;
    constructor(reference: string | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, onSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null);
}
declare class ViewportDeferredTrigger extends DeferredTrigger {
    readonly reference: string | null;
    readonly options: LiteralMap | null;
    constructor(reference: string | null, options: LiteralMap | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, prefetchSpan: ParseSourceSpan | null, onSourceSpan: ParseSourceSpan | null, hydrateSpan: ParseSourceSpan | null);
}
declare class BlockNode {
    nameSpan: ParseSourceSpan;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    constructor(nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null);
}
declare class DeferredBlockPlaceholder extends BlockNode implements Node {
    children: Node[];
    minimumTime: number | null;
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], minimumTime: number | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class DeferredBlockLoading extends BlockNode implements Node {
    children: Node[];
    afterTime: number | null;
    minimumTime: number | null;
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], afterTime: number | null, minimumTime: number | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class DeferredBlockError extends BlockNode implements Node {
    children: Node[];
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class ContentBlock extends BlockNode implements Node {
    name: string;
    variables: Variable[];
    children: Node[];
    i18n?: I18nMeta | undefined;
    constructor(name: string, variables: Variable[], children: Node[], nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundaryBlock extends BlockNode implements Node {
    children: Node[];
    errorBlocks: BoundaryErrorBlock[];
    mainBlockSpan: ParseSourceSpan;
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], errorBlocks: BoundaryErrorBlock[], nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, mainBlockSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class BoundaryErrorBlock extends BlockNode implements Node {
    children: Node[];
    contextVariables: Variable[];
    expression: AST | null;
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], contextVariables: Variable[], expression: AST | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
interface DeferredBlockTriggers {
    when?: BoundDeferredTrigger;
    idle?: IdleDeferredTrigger;
    immediate?: ImmediateDeferredTrigger;
    hover?: HoverDeferredTrigger;
    timer?: TimerDeferredTrigger;
    interaction?: InteractionDeferredTrigger;
    viewport?: ViewportDeferredTrigger;
    never?: NeverDeferredTrigger;
}
declare class DeferredBlock extends BlockNode implements Node {
    children: Node[];
    placeholder: DeferredBlockPlaceholder | null;
    loading: DeferredBlockLoading | null;
    error: DeferredBlockError | null;
    mainBlockSpan: ParseSourceSpan;
    definedName: string | null;
    i18n?: I18nMeta | undefined;
    readonly triggers: Readonly<DeferredBlockTriggers>;
    readonly prefetchTriggers: Readonly<DeferredBlockTriggers>;
    readonly hydrateTriggers: Readonly<DeferredBlockTriggers>;
    private readonly definedTriggers;
    private readonly definedPrefetchTriggers;
    private readonly definedHydrateTriggers;
    constructor(children: Node[], triggers: DeferredBlockTriggers, prefetchTriggers: DeferredBlockTriggers, hydrateTriggers: DeferredBlockTriggers, placeholder: DeferredBlockPlaceholder | null, loading: DeferredBlockLoading | null, error: DeferredBlockError | null, nameSpan: ParseSourceSpan, sourceSpan: ParseSourceSpan, mainBlockSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, definedName: string | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
    visitAll(visitor: Visitor<unknown>): void;
    private visitTriggers;
}
declare class SwitchBlock extends BlockNode implements Node {
    expression: AST;
    groups: SwitchBlockCaseGroup[];
    /**
     * These blocks are only captured to allow for autocompletion in the language service. They
     * aren't meant to be processed in any other way.
     */
    unknownBlocks: UnknownBlock[];
    exhaustiveCheck: SwitchExhaustiveCheck | null;
    constructor(expression: AST, groups: SwitchBlockCaseGroup[], 
    /**
     * These blocks are only captured to allow for autocompletion in the language service. They
     * aren't meant to be processed in any other way.
     */
    unknownBlocks: UnknownBlock[], exhaustiveCheck: SwitchExhaustiveCheck | null, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class SwitchBlockCase extends BlockNode implements Node {
    expression: AST | null;
    constructor(expression: AST | null, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class SwitchBlockCaseGroup extends BlockNode implements Node {
    cases: SwitchBlockCase[];
    children: Node[];
    i18n?: I18nMeta | undefined;
    constructor(cases: SwitchBlockCase[], children: Node[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class SwitchExhaustiveCheck extends BlockNode implements Node {
    expression: AST | null;
    constructor(expression: AST | null, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class ForLoopBlock extends BlockNode implements Node {
    item: Variable;
    expression: ASTWithSource;
    trackBy: ASTWithSource | null;
    trackKeywordSpan: ParseSourceSpan | null;
    contextVariables: Variable[];
    children: Node[];
    empty: ForLoopBlockEmpty | null;
    mainBlockSpan: ParseSourceSpan;
    i18n?: I18nMeta | undefined;
    constructor(item: Variable, expression: ASTWithSource, trackBy: ASTWithSource | null, trackKeywordSpan: ParseSourceSpan | null, contextVariables: Variable[], children: Node[], empty: ForLoopBlockEmpty | null, sourceSpan: ParseSourceSpan, mainBlockSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class ForLoopBlockEmpty extends BlockNode implements Node {
    children: Node[];
    i18n?: I18nMeta | undefined;
    constructor(children: Node[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class IfBlock extends BlockNode implements Node {
    branches: IfBlockBranch[];
    constructor(branches: IfBlockBranch[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class IfBlockBranch extends BlockNode implements Node {
    expression: AST | null;
    children: Node[];
    expressionAlias: Variable | null;
    i18n?: I18nMeta | undefined;
    constructor(expression: AST | null, children: Node[], expressionAlias: Variable | null, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, nameSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class UnknownBlock implements Node {
    name: string;
    sourceSpan: ParseSourceSpan;
    nameSpan: ParseSourceSpan;
    constructor(name: string, sourceSpan: ParseSourceSpan, nameSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class LetDeclaration implements Node {
    name: string;
    value: AST;
    sourceSpan: ParseSourceSpan;
    nameSpan: ParseSourceSpan;
    valueSpan: ParseSourceSpan;
    constructor(name: string, value: AST, sourceSpan: ParseSourceSpan, nameSpan: ParseSourceSpan, valueSpan: ParseSourceSpan);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Component implements Node {
    componentName: string;
    tagName: string | null;
    fullName: string;
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    outputs: BoundEvent[];
    directives: Directive[];
    children: Node[];
    references: Reference[];
    isSelfClosing: boolean;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    i18n?: I18nMeta | undefined;
    constructor(componentName: string, tagName: string | null, fullName: string, attributes: TextAttribute[], inputs: BoundAttribute[], outputs: BoundEvent[], directives: Directive[], children: Node[], references: Reference[], isSelfClosing: boolean, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Directive implements Node {
    name: string;
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    outputs: BoundEvent[];
    references: Reference[];
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    i18n?: I18nMeta | undefined;
    constructor(name: string, attributes: TextAttribute[], inputs: BoundAttribute[], outputs: BoundEvent[], references: Reference[], sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Template implements Node {
    tagName: string | null;
    attributes: TextAttribute[];
    inputs: BoundAttribute[];
    outputs: BoundEvent[];
    directives: Directive[];
    templateAttrs: (BoundAttribute | TextAttribute)[];
    children: Node[];
    references: Reference[];
    variables: Variable[];
    isSelfClosing: boolean;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    i18n?: I18nMeta | undefined;
    constructor(tagName: string | null, attributes: TextAttribute[], inputs: BoundAttribute[], outputs: BoundEvent[], directives: Directive[], templateAttrs: (BoundAttribute | TextAttribute)[], children: Node[], references: Reference[], variables: Variable[], isSelfClosing: boolean, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Content implements Node {
    selector: string;
    attributes: TextAttribute[];
    children: Node[];
    isSelfClosing: boolean;
    sourceSpan: ParseSourceSpan;
    startSourceSpan: ParseSourceSpan;
    endSourceSpan: ParseSourceSpan | null;
    i18n?: I18nMeta | undefined;
    readonly name = "ng-content";
    constructor(selector: string, attributes: TextAttribute[], children: Node[], isSelfClosing: boolean, sourceSpan: ParseSourceSpan, startSourceSpan: ParseSourceSpan, endSourceSpan: ParseSourceSpan | null, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Variable implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    valueSpan?: ParseSourceSpan | undefined;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan, valueSpan?: ParseSourceSpan | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Reference implements Node {
    name: string;
    value: string;
    sourceSpan: ParseSourceSpan;
    readonly keySpan: ParseSourceSpan;
    valueSpan?: ParseSourceSpan | undefined;
    constructor(name: string, value: string, sourceSpan: ParseSourceSpan, keySpan: ParseSourceSpan, valueSpan?: ParseSourceSpan | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
declare class Icu implements Node {
    vars: {
        [name: string]: BoundText;
    };
    placeholders: {
        [name: string]: Text | BoundText;
    };
    sourceSpan: ParseSourceSpan;
    i18n?: I18nMeta | undefined;
    constructor(vars: {
        [name: string]: BoundText;
    }, placeholders: {
        [name: string]: Text | BoundText;
    }, sourceSpan: ParseSourceSpan, i18n?: I18nMeta | undefined);
    visit<Result>(visitor: Visitor<Result>): Result;
}
/**
 * AST node that represents the host element of a directive.
 * This node is used only for type checking purposes and cannot be produced from a user's template.
 */
declare class HostElement implements Node {
    readonly tagNames: string[];
    readonly bindings: BoundAttribute[];
    readonly listeners: BoundEvent[];
    readonly sourceSpan: ParseSourceSpan;
    constructor(tagNames: string[], bindings: BoundAttribute[], listeners: BoundEvent[], sourceSpan: ParseSourceSpan);
    visit<Result>(): Result;
}
interface Visitor<Result = any> {
    visit?(node: Node): Result;
    visitElement(element: Element): Result;
    visitTemplate(template: Template): Result;
    visitContent(content: Content): Result;
    visitVariable(variable: Variable): Result;
    visitReference(reference: Reference): Result;
    visitTextAttribute(attribute: TextAttribute): Result;
    visitBoundAttribute(attribute: BoundAttribute): Result;
    visitBoundEvent(attribute: BoundEvent): Result;
    visitText(text: Text): Result;
    visitBoundText(text: BoundText): Result;
    visitIcu(icu: Icu): Result;
    visitDeferredBlock(deferred: DeferredBlock): Result;
    visitDeferredBlockPlaceholder(block: DeferredBlockPlaceholder): Result;
    visitDeferredBlockError(block: DeferredBlockError): Result;
    visitDeferredBlockLoading(block: DeferredBlockLoading): Result;
    visitDeferredTrigger(trigger: DeferredTrigger): Result;
    visitSwitchBlock(block: SwitchBlock): Result;
    visitSwitchBlockCase(block: SwitchBlockCase): Result;
    visitSwitchBlockCaseGroup(block: SwitchBlockCaseGroup): Result;
    visitSwitchExhaustiveCheck(block: SwitchExhaustiveCheck): Result;
    visitForLoopBlock(block: ForLoopBlock): Result;
    visitForLoopBlockEmpty(block: ForLoopBlockEmpty): Result;
    visitIfBlock(block: IfBlock): Result;
    visitIfBlockBranch(block: IfBlockBranch): Result;
    visitBoundaryBlock(block: BoundaryBlock): Result;
    visitBoundaryErrorBlock(block: BoundaryErrorBlock): Result;
    visitUnknownBlock(block: UnknownBlock): Result;
    visitLetDeclaration(decl: LetDeclaration): Result;
    visitComponent(component: Component): Result;
    visitDirective(directive: Directive): Result;
    visitContentBlock(block: ContentBlock): Result;
}
declare class RecursiveVisitor implements Visitor<void> {
    visitElement(element: Element): void;
    visitTemplate(template: Template): void;
    visitDeferredBlock(deferred: DeferredBlock): void;
    visitDeferredBlockPlaceholder(block: DeferredBlockPlaceholder): void;
    visitDeferredBlockError(block: DeferredBlockError): void;
    visitDeferredBlockLoading(block: DeferredBlockLoading): void;
    visitSwitchBlock(block: SwitchBlock): void;
    visitSwitchBlockCase(block: SwitchBlockCase): void;
    visitSwitchBlockCaseGroup(block: SwitchBlockCaseGroup): void;
    visitSwitchExhaustiveCheck(block: SwitchExhaustiveCheck): void;
    visitForLoopBlock(block: ForLoopBlock): void;
    visitForLoopBlockEmpty(block: ForLoopBlockEmpty): void;
    visitIfBlock(block: IfBlock): void;
    visitIfBlockBranch(block: IfBlockBranch): void;
    visitBoundaryBlock(block: BoundaryBlock): void;
    visitBoundaryErrorBlock(block: BoundaryErrorBlock): void;
    visitContent(content: Content): void;
    visitComponent(component: Component): void;
    visitDirective(directive: Directive): void;
    visitVariable(variable: Variable): void;
    visitReference(reference: Reference): void;
    visitTextAttribute(attribute: TextAttribute): void;
    visitBoundAttribute(attribute: BoundAttribute): void;
    visitBoundEvent(attribute: BoundEvent): void;
    visitText(text: Text): void;
    visitBoundText(text: BoundText): void;
    visitIcu(icu: Icu): void;
    visitDeferredTrigger(trigger: DeferredTrigger): void;
    visitUnknownBlock(block: UnknownBlock): void;
    visitLetDeclaration(decl: LetDeclaration): void;
    visitContentBlock(block: ContentBlock): void;
}
declare function visitAll<Result>(visitor: Visitor<Result>, nodes: Node[]): Result[];

/**
 * Visitor that traverses all template and expression AST nodes in a template.
 * Useful for cases where every single node needs to be visited.
 */
declare class CombinedRecursiveAstVisitor extends RecursiveAstVisitor implements RecursiveVisitor {
    visit(node: AST | Node): void;
    visitElement(element: Element): void;
    visitTemplate(template: Template): void;
    visitContent(content: Content): void;
    visitContentBlock(block: ContentBlock): void;
    visitBoundAttribute(attribute: BoundAttribute): void;
    visitBoundEvent(attribute: BoundEvent): void;
    visitBoundText(text: BoundText): void;
    visitIcu(icu: Icu): void;
    visitDeferredBlock(deferred: DeferredBlock): void;
    visitDeferredTrigger(trigger: DeferredTrigger): void;
    visitDeferredBlockPlaceholder(block: DeferredBlockPlaceholder): void;
    visitDeferredBlockError(block: DeferredBlockError): void;
    visitDeferredBlockLoading(block: DeferredBlockLoading): void;
    visitSwitchBlock(block: SwitchBlock): void;
    visitSwitchBlockCase(block: SwitchBlockCase): void;
    visitSwitchBlockCaseGroup(block: SwitchBlockCaseGroup): void;
    visitSwitchExhaustiveCheck(block: SwitchExhaustiveCheck): void;
    visitForLoopBlock(block: ForLoopBlock): void;
    visitForLoopBlockEmpty(block: ForLoopBlockEmpty): void;
    visitIfBlock(block: IfBlock): void;
    visitIfBlockBranch(block: IfBlockBranch): void;
    visitBoundaryBlock(block: BoundaryBlock): void;
    visitBoundaryErrorBlock(block: BoundaryErrorBlock): void;
    visitLetDeclaration(decl: LetDeclaration): void;
    visitComponent(component: Component): void;
    visitDirective(directive: Directive): void;
    visitVariable(variable: Variable): void;
    visitReference(reference: Reference): void;
    visitTextAttribute(attribute: TextAttribute): void;
    visitText(text: Text): void;
    visitUnknownBlock(block: UnknownBlock): void;
    protected visitAllTemplateNodes(nodes: Node[]): void;
}

/**
 * Describes the kind of identifier found in a template.
 */
declare enum IdentifierKind {
    Property = 0,
    Method = 1,// TODO: No longer being used. To be removed together with `MethodIdentifier`.
    Element = 2,
    Template = 3,
    Attribute = 4,
    Reference = 5,
    Variable = 6,
    LetDeclaration = 7,
    Component = 8,
    Directive = 9,
    Input = 10,
    Output = 11,
    Pipe = 12
}
/**
 * Describes a semantically-interesting identifier in a template, such as an interpolated variable
 * or selector.
 */
interface TemplateIdentifier {
    name: string;
    span: AbsoluteSourceSpan;
    kind: IdentifierKind;
}
/** Describes a template expression, which may have a template reference or variable target. */
interface TemplateExpressionIdentifier<T = unknown> extends TemplateIdentifier {
    /**
     * ReferenceIdentifier or VariableIdentifier in the template that this identifier targets, if
     * any. If the target is `null`, it points to a declaration on the component class.
     */
    target: ReferenceIdentifier<T> | VariableIdentifier | LetDeclarationIdentifier | null;
}
/** Describes a property accessed in a template. */
interface PropertyIdentifier<T = unknown> extends TemplateExpressionIdentifier<T> {
    kind: IdentifierKind.Property;
}
/**
 * Describes a method accessed in a template.
 * @deprecated No longer being used. To be removed.
 */
interface MethodIdentifier<T = unknown> extends TemplateExpressionIdentifier<T> {
    kind: IdentifierKind.Method;
}
/** Describes an element attribute in a template. */
interface AttributeIdentifier extends TemplateIdentifier {
    kind: IdentifierKind.Attribute;
}
/** A reference to a directive node and its selector. */
interface DirectiveReference<T = unknown> {
    node: T;
    selector: string;
}
/** A base interface for element and template identifiers. */
interface BaseDirectiveHostIdentifier<T = unknown> extends TemplateIdentifier {
    /** Attributes on an element or template. */
    attributes: Set<AttributeIdentifier>;
    /** Directives applied to an element or template. */
    usedDirectives: Set<DirectiveReference<T>>;
}
/**
 * Describes an indexed element in a template. The name of an `ElementIdentifier` is the entire
 * element tag, which can be parsed by an indexer to determine where used directives should be
 * referenced.
 */
interface ElementIdentifier<T = unknown> extends BaseDirectiveHostIdentifier<T> {
    kind: IdentifierKind.Element;
}
/** Describes an indexed template node in a component template file. */
interface TemplateNodeIdentifier<T = unknown> extends BaseDirectiveHostIdentifier<T> {
    kind: IdentifierKind.Template;
}
/** Describes a selectorless component node in a template file. */
interface ComponentNodeIdentifier<T = unknown> extends BaseDirectiveHostIdentifier<T> {
    kind: IdentifierKind.Component;
}
/** Describes a selectorless directive node in a template file. */
interface DirectiveNodeIdentifier<T = unknown> extends BaseDirectiveHostIdentifier<T> {
    kind: IdentifierKind.Directive;
}
/** Describes a reference in a template like "foo" in `<div #foo></div>`. */
interface ReferenceIdentifier<T = unknown> extends TemplateIdentifier {
    kind: IdentifierKind.Reference;
    /** The target of this reference. If the target is not known, this is `null`. */
    target: {
        /** The template AST node that the reference targets. */
        node: DirectiveHostIdentifier<T>;
        /**
         * The directive on `node` that the reference targets. If no directive is targeted, this is
         * `null`.
         */
        directive: T | null;
    } | null;
}
/** Describes a template variable like "foo" in `<div *ngFor="let foo of foos"></div>`. */
interface VariableIdentifier extends TemplateIdentifier {
    kind: IdentifierKind.Variable;
}
/** Describes an `@let` declaration in a template. */
interface LetDeclarationIdentifier extends TemplateIdentifier {
    kind: IdentifierKind.LetDeclaration;
}
/** Describes a bound attribute or event in a template targeting an Angular input/output. */
interface BoundAttributeIdentifier<T = unknown> extends TemplateIdentifier {
    kind: IdentifierKind.Input | IdentifierKind.Output;
    target: {
        node: T;
    } | null;
}
/** Describes a pipe used in a template expression. */
interface PipeIdentifier<T = unknown> extends TemplateIdentifier {
    kind: IdentifierKind.Pipe;
    target: {
        node: T;
    } | null;
}
/**
 * Identifiers recorded at the top level of the template, without any context about the HTML nodes
 * they were discovered in.
 */
type TopLevelIdentifier<T = unknown> = PropertyIdentifier<T> | ElementIdentifier<T> | TemplateNodeIdentifier<T> | ReferenceIdentifier<T> | VariableIdentifier | MethodIdentifier<T> | LetDeclarationIdentifier | ComponentNodeIdentifier<T> | DirectiveNodeIdentifier<T> | BoundAttributeIdentifier<T> | PipeIdentifier<T>;
/** Identifiers that can bring in directives to the template. */
type DirectiveHostIdentifier<T = unknown> = ElementIdentifier<T> | TemplateNodeIdentifier<T> | ComponentNodeIdentifier<T> | DirectiveNodeIdentifier<T>;
/**
 * Describes an analyzed, indexed component and its template.
 */
interface IndexedComponent<T = unknown> {
    name: string;
    selector: string | null;
    fileUrl: string;
    template: {
        identifiers: Set<TopLevelIdentifier<T>>;
        fileUrl: string;
    };
    errors: Error[];
}
/**
 * Abstract representation of a bound template, providing methods to query
 * directives and targets in the template.
 */
interface AbstractBoundTemplate<T = unknown> {
    getDirectivesOfNode(node: Element | Template | Component | Directive): Array<{
        ref: {
            node: T;
        };
        selector: string | null;
    }> | null;
    getReferenceTarget(node: Reference): Element | Template | Component | Directive | {
        node: Element | Template | Component | Directive;
        directive: {
            ref: {
                node: T;
            };
        };
    } | null;
    getConsumerOfBinding?(binding: BoundAttribute | BoundEvent | TextAttribute): {
        ref: {
            node: T;
        };
    } | Element | Template | null;
    getExpressionTarget(ast: AST): Reference | Variable | LetDeclaration | null;
    getUsedDirectives(): Array<{
        ref: {
            node: T;
        };
        isComponent: boolean;
    }>;
    getTemplateAst(): Node[] | undefined;
    getPipe(name: string): {
        ref: {
            node: T;
        };
    } | null;
}
/**
 * Adapter to extract information from a node, such as its name and file name.
 */
interface NodeAdapter<T = unknown> {
    getName(node: T): string;
    getFileName(node: T): string;
}

/**
 * An intermediate representation of a component.
 */
interface IndexerComponentInfo<T = unknown> {
    /** Component class declaration */
    declaration: T;
    /** Component template selector if it exists, otherwise null. */
    selector: string | null;
    /**
     * BoundTarget containing the parsed template. Can also be used to query for directives used in
     * the template.
     */
    boundTemplate: AbstractBoundTemplate<T>;
    /** Metadata about the template */
    templateMeta: {
        /** Whether the component template is inline */
        isInline: boolean;
        /** Template file recorded by template parser */
        file: ParseSourceFile;
    };
}
/**
 * A context for storing indexing information about components of a program.
 *
 * An `IndexingContext` collects component and template analysis information from
 * `DecoratorHandler`s and exposes them to be indexed.
 */
declare class IndexingContext<T = unknown> {
    readonly components: Set<IndexerComponentInfo<T>>;
    /**
     * Adds a component to the context.
     */
    addComponent(info: IndexerComponentInfo<T>): void;
}

/**
 * Visits the AST of a parsed Angular template. Discovers and stores
 * identifiers of interest, deferring to an `ExpressionVisitor` as needed.
 */
declare class IndexerVisitor<T = unknown> extends CombinedRecursiveAstVisitor {
    private boundTemplate;
    readonly identifiers: Set<TopLevelIdentifier<T>>;
    readonly errors: Error[];
    private currentAstWithSource;
    private readonly targetIdentifierCache;
    private readonly directiveHostIdentifierCache;
    /**
     * Creates a template visitor for a bound template target. The bound target can be used when
     * deferred to the expression visitor to get information about the target of an expression.
     *
     * @param boundTemplate bound template target
     */
    constructor(boundTemplate: AbstractBoundTemplate<T>);
    /**
     * Add an identifier for an HTML element and visit its children recursively.
     *
     * @param element
     */
    visitElement(element: Element): void;
    visitTemplate(template: Template): void;
    visitReference(reference: Reference): void;
    visitVariable(variable: Variable): void;
    visitLetDeclaration(decl: LetDeclaration): void;
    visitComponent(component: Component): void;
    visitDirective(directive: Directive): void;
    visitPropertyRead(ast: PropertyRead): void;
    visitPipe(ast: BindingPipe): void;
    private visitPipeIdentifier;
    visitBoundAttribute(attribute: BoundAttribute): void;
    visitBoundEvent(event: BoundEvent): void;
    visitTextAttribute(attribute: TextAttribute): void;
    private bindingToIdentifier;
    /** Creates an identifier for a template element or template node. */
    private directiveHostToIdentifier;
    /** Creates an identifier for a template reference or template variable target. */
    private targetToIdentifier;
    /** Gets the start location of a string in a SourceSpan */
    private getStartLocation;
    /**
     * Visits a node's expression and adds its identifiers, if any, to the visitor's state.
     * Only ASTs with information about the expression source and its location are visited.
     *
     * @param node node whose expression to visit
     */
    visit(node: Node | AST): void;
    /**
     * Visits an identifier, adding it to the identifier store if it is useful for indexing.
     *
     * @param ast expression AST the identifier is in
     * @param kind identifier kind
     */
    private visitIdentifier;
}
/**
 * Traverses a template AST and builds identifiers discovered in it.
 *
 * @param boundTemplate bound template target, which can be used for querying expression targets.
 * @return identifiers in template
 */
declare function getIndexerTemplateIdentifiers<T>(boundTemplate: AbstractBoundTemplate<T>): {
    identifiers: Set<TopLevelIdentifier<T>>;
    errors: Error[];
};

/**
 * Generates `IndexedComponent` entries from a `IndexingContext`, which has information
 * about components discovered in the program registered in it.
 *
 * The context must be populated before `generateIndexerAnalysis` is called.
 */
declare function generateIndexerAnalysis<T>(context: IndexingContext<T>, adapter: NodeAdapter<T>): Map<T, IndexedComponent<T>>;

export { AST, ASTWithName, ASTWithSource, AbsoluteSourceSpan, ArrowFunction, ArrowFunctionIdentifierParameter, Binary, BindingPipe, BindingPipeType, BindingType, BlockNode, BoundAttribute, BoundDeferredTrigger, BoundElementProperty, BoundEvent, BoundText, BoundaryBlock, BoundaryErrorBlock, Call, Chain, CombinedRecursiveAstVisitor, Comment, Component, Conditional, Content, ContentBlock, DeferredBlock, DeferredBlockError, DeferredBlockLoading, DeferredBlockPlaceholder, DeferredTrigger, Directive, Element, EmptyExpr, ExpressionBinding, ForLoopBlock, ForLoopBlockEmpty, HostElement, HoverDeferredTrigger, Icu, IdentifierKind, IdleDeferredTrigger, IfBlock, IfBlockBranch, ImmediateDeferredTrigger, ImplicitReceiver, IndexerVisitor, IndexingContext, InteractionDeferredTrigger, Interpolation, KeyedRead, LetDeclaration, LiteralArray, LiteralMap, LiteralPrimitive, Message, NeverDeferredTrigger, NonNullAssert, ParenthesizedExpression, ParseError, ParseErrorLevel, ParseLocation, ParseSourceFile, ParseSourceSpan, ParseSpan, ParsedEvent, ParsedEventType, ParsedProperty, ParsedPropertyType, ParsedVariable, PrefixNot, PropertyRead, RecursiveAstVisitor, RecursiveVisitor, Reference, RegularExpressionLiteral, SafeCall, SafeKeyedRead, SafePropertyRead, SecurityContext, SpreadElement, SwitchBlock, SwitchBlockCase, SwitchBlockCaseGroup, SwitchExhaustiveCheck, TaggedTemplateLiteral, Template, TemplateLiteral, TemplateLiteralElement, Text, TextAttribute, ThisReceiver, TimerDeferredTrigger, TypeofExpression, Unary, UnknownBlock, Variable, VariableBinding, ViewportDeferredTrigger, VoidExpression, generateIndexerAnalysis, getIndexerTemplateIdentifiers, identifierName, r3JitTypeSourceSpan, sanitizeIdentifier, unwrapWriteTarget, visitAll };
export type { AbstractBoundTemplate, ArrowFunctionParameter, AssignmentOperation, AstVisitor, AttributeIdentifier, BoundAttributeIdentifier, CompileIdentifierMetadata, ComponentNodeIdentifier, DeferredBlockTriggers, DirectiveHostIdentifier, DirectiveNodeIdentifier, DirectiveReference, ElementIdentifier, I18nMeta, IndexedComponent, IndexerComponentInfo, LetDeclarationIdentifier, LiteralMapKey, LiteralMapPropertyKey, LiteralMapSpreadKey, MethodIdentifier, Node$1 as Node, Node as Node$1, NodeAdapter, PipeIdentifier, PropertyIdentifier, ReferenceIdentifier, TemplateBinding, TemplateBindingIdentifier, TemplateIdentifier, TemplateNodeIdentifier, TopLevelIdentifier, VariableIdentifier, Visitor };
