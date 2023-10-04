/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Distinguishes different kinds of IR operations.
 *
 * Includes both creation and update operations.
 */
export var OpKind;
(function (OpKind) {
    /**
     * A special operation type which is used to represent the beginning and end nodes of a linked
     * list of operations.
     */
    OpKind[OpKind["ListEnd"] = 0] = "ListEnd";
    /**
     * An operation which wraps an output AST statement.
     */
    OpKind[OpKind["Statement"] = 1] = "Statement";
    /**
     * An operation which declares and initializes a `SemanticVariable`.
     */
    OpKind[OpKind["Variable"] = 2] = "Variable";
    /**
     * An operation to begin rendering of an element.
     */
    OpKind[OpKind["ElementStart"] = 3] = "ElementStart";
    /**
     * An operation to render an element with no children.
     */
    OpKind[OpKind["Element"] = 4] = "Element";
    /**
     * An operation which declares an embedded view.
     */
    OpKind[OpKind["Template"] = 5] = "Template";
    /**
     * An operation to end rendering of an element previously started with `ElementStart`.
     */
    OpKind[OpKind["ElementEnd"] = 6] = "ElementEnd";
    /**
     * An operation to begin an `ng-container`.
     */
    OpKind[OpKind["ContainerStart"] = 7] = "ContainerStart";
    /**
     * An operation for an `ng-container` with no children.
     */
    OpKind[OpKind["Container"] = 8] = "Container";
    /**
     * An operation to end an `ng-container`.
     */
    OpKind[OpKind["ContainerEnd"] = 9] = "ContainerEnd";
    /**
     * An operation disable binding for subsequent elements, which are descendants of a non-bindable
     * node.
     */
    OpKind[OpKind["DisableBindings"] = 10] = "DisableBindings";
    /**
     * An op to conditionally render a template.
     */
    OpKind[OpKind["Conditional"] = 11] = "Conditional";
    /**
     * An operation to re-enable binding, after it was previously disabled.
     */
    OpKind[OpKind["EnableBindings"] = 12] = "EnableBindings";
    /**
     * An operation to render a text node.
     */
    OpKind[OpKind["Text"] = 13] = "Text";
    /**
     * An operation declaring an event listener for an element.
     */
    OpKind[OpKind["Listener"] = 14] = "Listener";
    /**
     * An operation to interpolate text into a text node.
     */
    OpKind[OpKind["InterpolateText"] = 15] = "InterpolateText";
    /**
     * An intermediate binding op, that has not yet been processed into an individual property,
     * attribute, style, etc.
     */
    OpKind[OpKind["Binding"] = 16] = "Binding";
    /**
     * An operation to bind an expression to a property of an element.
     */
    OpKind[OpKind["Property"] = 17] = "Property";
    /**
     * An operation to bind an expression to a style property of an element.
     */
    OpKind[OpKind["StyleProp"] = 18] = "StyleProp";
    /**
     * An operation to bind an expression to a class property of an element.
     */
    OpKind[OpKind["ClassProp"] = 19] = "ClassProp";
    /**
     * An operation to bind an expression to the styles of an element.
     */
    OpKind[OpKind["StyleMap"] = 20] = "StyleMap";
    /**
     * An operation to bind an expression to the classes of an element.
     */
    OpKind[OpKind["ClassMap"] = 21] = "ClassMap";
    /**
     * An operation to advance the runtime's implicit slot context during the update phase of a view.
     */
    OpKind[OpKind["Advance"] = 22] = "Advance";
    /**
     * An operation to instantiate a pipe.
     */
    OpKind[OpKind["Pipe"] = 23] = "Pipe";
    /**
     * An operation to associate an attribute with an element.
     */
    OpKind[OpKind["Attribute"] = 24] = "Attribute";
    /**
     * An attribute that has been extracted for inclusion in the consts array.
     */
    OpKind[OpKind["ExtractedAttribute"] = 25] = "ExtractedAttribute";
    /**
     * An operation that configures a `@defer` block.
     */
    OpKind[OpKind["Defer"] = 26] = "Defer";
    /**
     * An IR operation that provides secondary templates of a `@defer` block.
     */
    OpKind[OpKind["DeferSecondaryBlock"] = 27] = "DeferSecondaryBlock";
    /**
     * An operation that controls when a `@defer` loads.
     */
    OpKind[OpKind["DeferOn"] = 28] = "DeferOn";
    /**
     * An i18n message that has been extracted for inclusion in the consts array.
     */
    OpKind[OpKind["ExtractedMessage"] = 29] = "ExtractedMessage";
    /**
     * A host binding property.
     */
    OpKind[OpKind["HostProperty"] = 30] = "HostProperty";
    /**
     * A namespace change, which causes the subsequent elements to be processed as either HTML or SVG.
     */
    OpKind[OpKind["Namespace"] = 31] = "Namespace";
    /**
     * Configure a content projeciton definition for the view.
     */
    OpKind[OpKind["ProjectionDef"] = 32] = "ProjectionDef";
    /**
     * Create a content projection slot.
     */
    OpKind[OpKind["Projection"] = 33] = "Projection";
    /**
     * The start of an i18n block.
     */
    OpKind[OpKind["I18nStart"] = 34] = "I18nStart";
    /**
     * A self-closing i18n on a single element.
     */
    OpKind[OpKind["I18n"] = 35] = "I18n";
    /**
     * The end of an i18n block.
     */
    OpKind[OpKind["I18nEnd"] = 36] = "I18nEnd";
    /**
     * An expression in an i18n message.
     */
    OpKind[OpKind["I18nExpression"] = 37] = "I18nExpression";
    /**
     * An instruction that applies a set of i18n expressions.
     */
    OpKind[OpKind["I18nApply"] = 38] = "I18nApply";
})(OpKind || (OpKind = {}));
/**
 * Distinguishes different kinds of IR expressions.
 */
export var ExpressionKind;
(function (ExpressionKind) {
    /**
     * Read of a variable in a lexical scope.
     */
    ExpressionKind[ExpressionKind["LexicalRead"] = 0] = "LexicalRead";
    /**
     * A reference to the current view context.
     */
    ExpressionKind[ExpressionKind["Context"] = 1] = "Context";
    /**
     * Read of a variable declared in a `VariableOp`.
     */
    ExpressionKind[ExpressionKind["ReadVariable"] = 2] = "ReadVariable";
    /**
     * Runtime operation to navigate to the next view context in the view hierarchy.
     */
    ExpressionKind[ExpressionKind["NextContext"] = 3] = "NextContext";
    /**
     * Runtime operation to retrieve the value of a local reference.
     */
    ExpressionKind[ExpressionKind["Reference"] = 4] = "Reference";
    /**
     * Runtime operation to snapshot the current view context.
     */
    ExpressionKind[ExpressionKind["GetCurrentView"] = 5] = "GetCurrentView";
    /**
     * Runtime operation to restore a snapshotted view.
     */
    ExpressionKind[ExpressionKind["RestoreView"] = 6] = "RestoreView";
    /**
     * Runtime operation to reset the current view context after `RestoreView`.
     */
    ExpressionKind[ExpressionKind["ResetView"] = 7] = "ResetView";
    /**
     * Defines and calls a function with change-detected arguments.
     */
    ExpressionKind[ExpressionKind["PureFunctionExpr"] = 8] = "PureFunctionExpr";
    /**
     * Indicates a positional parameter to a pure function definition.
     */
    ExpressionKind[ExpressionKind["PureFunctionParameterExpr"] = 9] = "PureFunctionParameterExpr";
    /**
     * Binding to a pipe transformation.
     */
    ExpressionKind[ExpressionKind["PipeBinding"] = 10] = "PipeBinding";
    /**
     * Binding to a pipe transformation with a variable number of arguments.
     */
    ExpressionKind[ExpressionKind["PipeBindingVariadic"] = 11] = "PipeBindingVariadic";
    /*
     * A safe property read requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafePropertyRead"] = 12] = "SafePropertyRead";
    /**
     * A safe keyed read requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafeKeyedRead"] = 13] = "SafeKeyedRead";
    /**
     * A safe function call requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafeInvokeFunction"] = 14] = "SafeInvokeFunction";
    /**
     * An intermediate expression that will be expanded from a safe read into an explicit ternary.
     */
    ExpressionKind[ExpressionKind["SafeTernaryExpr"] = 15] = "SafeTernaryExpr";
    /**
     * An empty expression that will be stipped before generating the final output.
     */
    ExpressionKind[ExpressionKind["EmptyExpr"] = 16] = "EmptyExpr";
    /*
     * An assignment to a temporary variable.
     */
    ExpressionKind[ExpressionKind["AssignTemporaryExpr"] = 17] = "AssignTemporaryExpr";
    /**
     * A reference to a temporary variable.
     */
    ExpressionKind[ExpressionKind["ReadTemporaryExpr"] = 18] = "ReadTemporaryExpr";
    /**
     * An expression representing a sanitizer function.
     */
    ExpressionKind[ExpressionKind["SanitizerExpr"] = 19] = "SanitizerExpr";
    /**
     * An expression that will cause a literal slot index to be emitted.
     */
    ExpressionKind[ExpressionKind["SlotLiteralExpr"] = 20] = "SlotLiteralExpr";
    /**
     * A test expression for a conditional op.
     */
    ExpressionKind[ExpressionKind["ConditionalCase"] = 21] = "ConditionalCase";
})(ExpressionKind || (ExpressionKind = {}));
/**
 * Distinguishes between different kinds of `SemanticVariable`s.
 */
export var SemanticVariableKind;
(function (SemanticVariableKind) {
    /**
     * Represents the context of a particular view.
     */
    SemanticVariableKind[SemanticVariableKind["Context"] = 0] = "Context";
    /**
     * Represents an identifier declared in the lexical scope of a view.
     */
    SemanticVariableKind[SemanticVariableKind["Identifier"] = 1] = "Identifier";
    /**
     * Represents a saved state that can be used to restore a view in a listener handler function.
     */
    SemanticVariableKind[SemanticVariableKind["SavedView"] = 2] = "SavedView";
})(SemanticVariableKind || (SemanticVariableKind = {}));
/**
 * Whether to compile in compatibilty mode. In compatibility mode, the template pipeline will
 * attempt to match the output of `TemplateDefinitionBuilder` as exactly as possible, at the cost
 * of producing quirky or larger code in some cases.
 */
export var CompatibilityMode;
(function (CompatibilityMode) {
    CompatibilityMode[CompatibilityMode["Normal"] = 0] = "Normal";
    CompatibilityMode[CompatibilityMode["TemplateDefinitionBuilder"] = 1] = "TemplateDefinitionBuilder";
})(CompatibilityMode || (CompatibilityMode = {}));
/**
 * Represents functions used to sanitize different pieces of a template.
 */
export var SanitizerFn;
(function (SanitizerFn) {
    SanitizerFn[SanitizerFn["Html"] = 0] = "Html";
    SanitizerFn[SanitizerFn["Script"] = 1] = "Script";
    SanitizerFn[SanitizerFn["Style"] = 2] = "Style";
    SanitizerFn[SanitizerFn["Url"] = 3] = "Url";
    SanitizerFn[SanitizerFn["ResourceUrl"] = 4] = "ResourceUrl";
    SanitizerFn[SanitizerFn["IframeAttribute"] = 5] = "IframeAttribute";
})(SanitizerFn || (SanitizerFn = {}));
/**
 * Enumeration of the different kinds of `@defer` secondary blocks.
 */
export var DeferSecondaryKind;
(function (DeferSecondaryKind) {
    DeferSecondaryKind[DeferSecondaryKind["Loading"] = 0] = "Loading";
    DeferSecondaryKind[DeferSecondaryKind["Placeholder"] = 1] = "Placeholder";
    DeferSecondaryKind[DeferSecondaryKind["Error"] = 2] = "Error";
})(DeferSecondaryKind || (DeferSecondaryKind = {}));
/**
 * Enumeration of the types of attributes which can be applied to an element.
 */
export var BindingKind;
(function (BindingKind) {
    /**
     * Static attributes.
     */
    BindingKind[BindingKind["Attribute"] = 0] = "Attribute";
    /**
     * Class bindings.
     */
    BindingKind[BindingKind["ClassName"] = 1] = "ClassName";
    /**
     * Style bindings.
     */
    BindingKind[BindingKind["StyleProperty"] = 2] = "StyleProperty";
    /**
     * Dynamic property bindings.
     */
    BindingKind[BindingKind["Property"] = 3] = "Property";
    /**
     * Property or attribute bindings on a template.
     */
    BindingKind[BindingKind["Template"] = 4] = "Template";
    /**
     * Internationalized attributes.
     */
    BindingKind[BindingKind["I18n"] = 5] = "I18n";
    /**
     * Animation property bindings.
     */
    BindingKind[BindingKind["Animation"] = 6] = "Animation";
})(BindingKind || (BindingKind = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQXNNWDtBQXRNRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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LENBQU4sSUFBWSxXQW1DWDtBQW5DRCxXQUFZLFdBQVc7SUFDckI7O09BRUc7SUFDSCx1REFBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCx1REFBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCwrREFBYSxDQUFBO0lBRWI7O09BRUc7SUFDSCxxREFBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCxxREFBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw2Q0FBSSxDQUFBO0lBRUo7O09BRUc7SUFDSCx1REFBUyxDQUFBO0FBQ1gsQ0FBQyxFQW5DVyxXQUFXLEtBQVgsV0FBVyxRQW1DdEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBvcGVyYXRpb25zLlxuICpcbiAqIEluY2x1ZGVzIGJvdGggY3JlYXRpb24gYW5kIHVwZGF0ZSBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZW51bSBPcEtpbmQge1xuICAvKipcbiAgICogQSBzcGVjaWFsIG9wZXJhdGlvbiB0eXBlIHdoaWNoIGlzIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBub2RlcyBvZiBhIGxpbmtlZFxuICAgKiBsaXN0IG9mIG9wZXJhdGlvbnMuXG4gICAqL1xuICBMaXN0RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggd3JhcHMgYW4gb3V0cHV0IEFTVCBzdGF0ZW1lbnQuXG4gICAqL1xuICBTdGF0ZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbmQgaW5pdGlhbGl6ZXMgYSBgU2VtYW50aWNWYXJpYWJsZWAuXG4gICAqL1xuICBWYXJpYWJsZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgRWxlbWVudFN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIEVsZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbiBlbWJlZGRlZCB2aWV3LlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQgcHJldmlvdXNseSBzdGFydGVkIHdpdGggYEVsZW1lbnRTdGFydGAuXG4gICAqL1xuICBFbGVtZW50RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGZvciBhbiBgbmctY29udGFpbmVyYCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgQ29udGFpbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyRW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGlzYWJsZSBiaW5kaW5nIGZvciBzdWJzZXF1ZW50IGVsZW1lbnRzLCB3aGljaCBhcmUgZGVzY2VuZGFudHMgb2YgYSBub24tYmluZGFibGVcbiAgICogbm9kZS5cbiAgICovXG4gIERpc2FibGVCaW5kaW5ncyxcblxuICAvKipcbiAgICogQW4gb3AgdG8gY29uZGl0aW9uYWxseSByZW5kZXIgYSB0ZW1wbGF0ZS5cbiAgICovXG4gIENvbmRpdGlvbmFsLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmUtZW5hYmxlIGJpbmRpbmcsIGFmdGVyIGl0IHdhcyBwcmV2aW91c2x5IGRpc2FibGVkLlxuICAgKi9cbiAgRW5hYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGVjbGFyaW5nIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBlbGVtZW50LlxuICAgKi9cbiAgTGlzdGVuZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBJbnRlcnBvbGF0ZVRleHQsXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBiaW5kaW5nIG9wLCB0aGF0IGhhcyBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkIGludG8gYW4gaW5kaXZpZHVhbCBwcm9wZXJ0eSxcbiAgICogYXR0cmlidXRlLCBzdHlsZSwgZXRjLlxuICAgKi9cbiAgQmluZGluZyxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHN0eWxlIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZVByb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBjbGFzcyBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBzdHlsZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBjbGFzc2VzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc01hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgZHVyaW5nIHRoZSB1cGRhdGUgcGhhc2Ugb2YgYSB2aWV3LlxuICAgKi9cbiAgQWR2YW5jZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGluc3RhbnRpYXRlIGEgcGlwZS5cbiAgICovXG4gIFBpcGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhc3NvY2lhdGUgYW4gYXR0cmlidXRlIHdpdGggYW4gZWxlbWVudC5cbiAgICovXG4gIEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gYXR0cmlidXRlIHRoYXQgaGFzIGJlZW4gZXh0cmFjdGVkIGZvciBpbmNsdXNpb24gaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICovXG4gIEV4dHJhY3RlZEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRoYXQgY29uZmlndXJlcyBhIGBAZGVmZXJgIGJsb2NrLlxuICAgKi9cbiAgRGVmZXIsXG5cbiAgLyoqXG4gICAqIEFuIElSIG9wZXJhdGlvbiB0aGF0IHByb3ZpZGVzIHNlY29uZGFyeSB0ZW1wbGF0ZXMgb2YgYSBgQGRlZmVyYCBibG9jay5cbiAgICovXG4gIERlZmVyU2Vjb25kYXJ5QmxvY2ssXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0aGF0IGNvbnRyb2xzIHdoZW4gYSBgQGRlZmVyYCBsb2Fkcy5cbiAgICovXG4gIERlZmVyT24sXG5cbiAgLyoqXG4gICAqIEFuIGkxOG4gbWVzc2FnZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAqL1xuICBFeHRyYWN0ZWRNZXNzYWdlLFxuXG4gIC8qKlxuICAgKiBBIGhvc3QgYmluZGluZyBwcm9wZXJ0eS5cbiAgICovXG4gIEhvc3RQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQSBuYW1lc3BhY2UgY2hhbmdlLCB3aGljaCBjYXVzZXMgdGhlIHN1YnNlcXVlbnQgZWxlbWVudHMgdG8gYmUgcHJvY2Vzc2VkIGFzIGVpdGhlciBIVE1MIG9yIFNWRy5cbiAgICovXG4gIE5hbWVzcGFjZSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGEgY29udGVudCBwcm9qZWNpdG9uIGRlZmluaXRpb24gZm9yIHRoZSB2aWV3LlxuICAgKi9cbiAgUHJvamVjdGlvbkRlZixcblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gICAqL1xuICBQcm9qZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5TdGFydCxcblxuICAvKipcbiAgICogQSBzZWxmLWNsb3NpbmcgaTE4biBvbiBhIHNpbmdsZSBlbGVtZW50LlxuICAgKi9cbiAgSTE4bixcblxuICAvKipcbiAgICogVGhlIGVuZCBvZiBhbiBpMThuIGJsb2NrLlxuICAgKi9cbiAgSTE4bkVuZCxcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiBpbiBhbiBpMThuIG1lc3NhZ2UuXG4gICAqL1xuICBJMThuRXhwcmVzc2lvbixcblxuICAvKipcbiAgICogQW4gaW5zdHJ1Y3Rpb24gdGhhdCBhcHBsaWVzIGEgc2V0IG9mIGkxOG4gZXhwcmVzc2lvbnMuXG4gICAqL1xuICBJMThuQXBwbHksXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIEV4cHJlc3Npb25LaW5kIHtcbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBpbiBhIGxleGljYWwgc2NvcGUuXG4gICAqL1xuICBMZXhpY2FsUmVhZCxcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGRlY2xhcmVkIGluIGEgYFZhcmlhYmxlT3BgLlxuICAgKi9cbiAgUmVhZFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICAgKi9cbiAgTmV4dENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAgICovXG4gIFJlZmVyZW5jZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gc25hcHNob3QgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgR2V0Q3VycmVudFZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICAgKi9cbiAgUmVzdG9yZVZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICAgKi9cbiAgUmVzZXRWaWV3LFxuXG4gIC8qKlxuICAgKiBEZWZpbmVzIGFuZCBjYWxscyBhIGZ1bmN0aW9uIHdpdGggY2hhbmdlLWRldGVjdGVkIGFyZ3VtZW50cy5cbiAgICovXG4gIFB1cmVGdW5jdGlvbkV4cHIsXG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyBhIHBvc2l0aW9uYWwgcGFyYW1ldGVyIHRvIGEgcHVyZSBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcixcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24uXG4gICAqL1xuICBQaXBlQmluZGluZyxcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24gd2l0aCBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqL1xuICBQaXBlQmluZGluZ1ZhcmlhZGljLFxuXG4gIC8qXG4gICAqIEEgc2FmZSBwcm9wZXJ0eSByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlUHJvcGVydHlSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUga2V5ZWQgcmVhZCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUtleWVkUmVhZCxcblxuICAvKipcbiAgICogQSBzYWZlIGZ1bmN0aW9uIGNhbGwgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVJbnZva2VGdW5jdGlvbixcblxuICAvKipcbiAgICogQW4gaW50ZXJtZWRpYXRlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIGV4cGFuZGVkIGZyb20gYSBzYWZlIHJlYWQgaW50byBhbiBleHBsaWNpdCB0ZXJuYXJ5LlxuICAgKi9cbiAgU2FmZVRlcm5hcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBlbXB0eSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBzdGlwcGVkIGJlZm9yZSBnZW5lcmF0aW5nIHRoZSBmaW5hbCBvdXRwdXQuXG4gICAqL1xuICBFbXB0eUV4cHIsXG5cbiAgLypcbiAgICogQW4gYXNzaWdubWVudCB0byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIEFzc2lnblRlbXBvcmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgUmVhZFRlbXBvcmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgc2FuaXRpemVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2FuaXRpemVyRXhwcixcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiB0aGF0IHdpbGwgY2F1c2UgYSBsaXRlcmFsIHNsb3QgaW5kZXggdG8gYmUgZW1pdHRlZC5cbiAgICovXG4gIFNsb3RMaXRlcmFsRXhwcixcblxuICAvKipcbiAgICogQSB0ZXN0IGV4cHJlc3Npb24gZm9yIGEgY29uZGl0aW9uYWwgb3AuXG4gICAqL1xuICBDb25kaXRpb25hbENhc2UsXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBiZXR3ZWVuIGRpZmZlcmVudCBraW5kcyBvZiBgU2VtYW50aWNWYXJpYWJsZWBzLlxuICovXG5leHBvcnQgZW51bSBTZW1hbnRpY1ZhcmlhYmxlS2luZCB7XG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBjb250ZXh0IG9mIGEgcGFydGljdWxhciB2aWV3LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhbiBpZGVudGlmaWVyIGRlY2xhcmVkIGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIGEgdmlldy5cbiAgICovXG4gIElkZW50aWZpZXIsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSBzYXZlZCBzdGF0ZSB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlc3RvcmUgYSB2aWV3IGluIGEgbGlzdGVuZXIgaGFuZGxlciBmdW5jdGlvbi5cbiAgICovXG4gIFNhdmVkVmlldyxcbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRvIGNvbXBpbGUgaW4gY29tcGF0aWJpbHR5IG1vZGUuIEluIGNvbXBhdGliaWxpdHkgbW9kZSwgdGhlIHRlbXBsYXRlIHBpcGVsaW5lIHdpbGxcbiAqIGF0dGVtcHQgdG8gbWF0Y2ggdGhlIG91dHB1dCBvZiBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgYXMgZXhhY3RseSBhcyBwb3NzaWJsZSwgYXQgdGhlIGNvc3RcbiAqIG9mIHByb2R1Y2luZyBxdWlya3kgb3IgbGFyZ2VyIGNvZGUgaW4gc29tZSBjYXNlcy5cbiAqL1xuZXhwb3J0IGVudW0gQ29tcGF0aWJpbGl0eU1vZGUge1xuICBOb3JtYWwsXG4gIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsXG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBmdW5jdGlvbnMgdXNlZCB0byBzYW5pdGl6ZSBkaWZmZXJlbnQgcGllY2VzIG9mIGEgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBlbnVtIFNhbml0aXplckZuIHtcbiAgSHRtbCxcbiAgU2NyaXB0LFxuICBTdHlsZSxcbiAgVXJsLFxuICBSZXNvdXJjZVVybCxcbiAgSWZyYW1lQXR0cmlidXRlLFxufVxuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHRoZSBkaWZmZXJlbnQga2luZHMgb2YgYEBkZWZlcmAgc2Vjb25kYXJ5IGJsb2Nrcy5cbiAqL1xuZXhwb3J0IGVudW0gRGVmZXJTZWNvbmRhcnlLaW5kIHtcbiAgTG9hZGluZyxcbiAgUGxhY2Vob2xkZXIsXG4gIEVycm9yLFxufVxuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHRoZSB0eXBlcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGNhbiBiZSBhcHBsaWVkIHRvIGFuIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBlbnVtIEJpbmRpbmdLaW5kIHtcbiAgLyoqXG4gICAqIFN0YXRpYyBhdHRyaWJ1dGVzLlxuICAgKi9cbiAgQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBDbGFzcyBiaW5kaW5ncy5cbiAgICovXG4gIENsYXNzTmFtZSxcblxuICAvKipcbiAgICogU3R5bGUgYmluZGluZ3MuXG4gICAqL1xuICBTdHlsZVByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBEeW5hbWljIHByb3BlcnR5IGJpbmRpbmdzLlxuICAgKi9cbiAgUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIFByb3BlcnR5IG9yIGF0dHJpYnV0ZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlLlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEludGVybmF0aW9uYWxpemVkIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBJMThuLFxuXG4gIC8qKlxuICAgKiBBbmltYXRpb24gcHJvcGVydHkgYmluZGluZ3MuXG4gICAqL1xuICBBbmltYXRpb24sXG59XG4iXX0=