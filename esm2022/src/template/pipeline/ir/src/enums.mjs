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
     * Create a repeater creation instruction op.
     */
    OpKind[OpKind["RepeaterCreate"] = 34] = "RepeaterCreate";
    /**
     * An update up for a repeater.
     */
    OpKind[OpKind["Repeater"] = 35] = "Repeater";
    /**
     * The start of an i18n block.
     */
    OpKind[OpKind["I18nStart"] = 36] = "I18nStart";
    /**
     * A self-closing i18n on a single element.
     */
    OpKind[OpKind["I18n"] = 37] = "I18n";
    /**
     * The end of an i18n block.
     */
    OpKind[OpKind["I18nEnd"] = 38] = "I18nEnd";
    /**
     * An expression in an i18n message.
     */
    OpKind[OpKind["I18nExpression"] = 39] = "I18nExpression";
    /**
     * An instruction that applies a set of i18n expressions.
     */
    OpKind[OpKind["I18nApply"] = 40] = "I18nApply";
    /**
     * An instruction to create an ICU expression.
     */
    OpKind[OpKind["Icu"] = 41] = "Icu";
    /**
     * An instruction to update an ICU expression.
     */
    OpKind[OpKind["IcuUpdate"] = 42] = "IcuUpdate";
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
     * A reference to the view context, for use inside a track function.
     */
    ExpressionKind[ExpressionKind["TrackContext"] = 2] = "TrackContext";
    /**
     * Read of a variable declared in a `VariableOp`.
     */
    ExpressionKind[ExpressionKind["ReadVariable"] = 3] = "ReadVariable";
    /**
     * Runtime operation to navigate to the next view context in the view hierarchy.
     */
    ExpressionKind[ExpressionKind["NextContext"] = 4] = "NextContext";
    /**
     * Runtime operation to retrieve the value of a local reference.
     */
    ExpressionKind[ExpressionKind["Reference"] = 5] = "Reference";
    /**
     * Runtime operation to snapshot the current view context.
     */
    ExpressionKind[ExpressionKind["GetCurrentView"] = 6] = "GetCurrentView";
    /**
     * Runtime operation to restore a snapshotted view.
     */
    ExpressionKind[ExpressionKind["RestoreView"] = 7] = "RestoreView";
    /**
     * Runtime operation to reset the current view context after `RestoreView`.
     */
    ExpressionKind[ExpressionKind["ResetView"] = 8] = "ResetView";
    /**
     * Defines and calls a function with change-detected arguments.
     */
    ExpressionKind[ExpressionKind["PureFunctionExpr"] = 9] = "PureFunctionExpr";
    /**
     * Indicates a positional parameter to a pure function definition.
     */
    ExpressionKind[ExpressionKind["PureFunctionParameterExpr"] = 10] = "PureFunctionParameterExpr";
    /**
     * Binding to a pipe transformation.
     */
    ExpressionKind[ExpressionKind["PipeBinding"] = 11] = "PipeBinding";
    /**
     * Binding to a pipe transformation with a variable number of arguments.
     */
    ExpressionKind[ExpressionKind["PipeBindingVariadic"] = 12] = "PipeBindingVariadic";
    /*
     * A safe property read requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafePropertyRead"] = 13] = "SafePropertyRead";
    /**
     * A safe keyed read requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafeKeyedRead"] = 14] = "SafeKeyedRead";
    /**
     * A safe function call requiring expansion into a null check.
     */
    ExpressionKind[ExpressionKind["SafeInvokeFunction"] = 15] = "SafeInvokeFunction";
    /**
     * An intermediate expression that will be expanded from a safe read into an explicit ternary.
     */
    ExpressionKind[ExpressionKind["SafeTernaryExpr"] = 16] = "SafeTernaryExpr";
    /**
     * An empty expression that will be stipped before generating the final output.
     */
    ExpressionKind[ExpressionKind["EmptyExpr"] = 17] = "EmptyExpr";
    /*
     * An assignment to a temporary variable.
     */
    ExpressionKind[ExpressionKind["AssignTemporaryExpr"] = 18] = "AssignTemporaryExpr";
    /**
     * A reference to a temporary variable.
     */
    ExpressionKind[ExpressionKind["ReadTemporaryExpr"] = 19] = "ReadTemporaryExpr";
    /**
     * An expression representing a sanitizer function.
     */
    ExpressionKind[ExpressionKind["SanitizerExpr"] = 20] = "SanitizerExpr";
    /**
     * An expression that will cause a literal slot index to be emitted.
     */
    ExpressionKind[ExpressionKind["SlotLiteralExpr"] = 21] = "SlotLiteralExpr";
    /**
     * A test expression for a conditional op.
     */
    ExpressionKind[ExpressionKind["ConditionalCase"] = 22] = "ConditionalCase";
    /**
     * A variable for use inside a repeater, providing one of the ambiently-available context
     * properties ($even, $first, etc.).
     */
    ExpressionKind[ExpressionKind["DerivedRepeaterVar"] = 23] = "DerivedRepeaterVar";
})(ExpressionKind || (ExpressionKind = {}));
export var VariableFlags;
(function (VariableFlags) {
    VariableFlags[VariableFlags["None"] = 0] = "None";
    /**
     * Always inline this variable, regardless of the number of times it's used.
     * An `AlwaysInline` variable may not depend on context, because doing so may cause side effects
     * that are illegal when multi-inlined. (The optimizer will enforce this constraint.)
     */
    VariableFlags[VariableFlags["AlwaysInline"] = 1] = "AlwaysInline";
})(VariableFlags || (VariableFlags = {}));
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
    /**
     * An alias generated by a special embedded view type (e.g. a `@for` block).
     */
    SemanticVariableKind[SemanticVariableKind["Alias"] = 3] = "Alias";
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
/**
 * Enumeration of possible times i18n params can be resolved.
 */
export var I18nParamResolutionTime;
(function (I18nParamResolutionTime) {
    /**
     * Param is resolved at message creation time. Most params should be resolved at message creation
     * time. However, ICU params need to be handled in post-processing.
     */
    I18nParamResolutionTime[I18nParamResolutionTime["Creation"] = 0] = "Creation";
    /**
     * Param is resolved during post-processing. This should be used for params who's value comes from
     * an ICU.
     */
    I18nParamResolutionTime[I18nParamResolutionTime["Postproccessing"] = 1] = "Postproccessing";
})(I18nParamResolutionTime || (I18nParamResolutionTime = {}));
/**
 * Flags that describe what an i18n param value. These determine how the value is serialized into
 * the final map.
 */
export var I18nParamValueFlags;
(function (I18nParamValueFlags) {
    I18nParamValueFlags[I18nParamValueFlags["None"] = 0] = "None";
    /**
     *  This value represtents an element tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["ElementTag"] = 1] = "ElementTag";
    /**
     * This value represents a template tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["TemplateTag"] = 2] = "TemplateTag";
    /**
     * This value represents the opening of a tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["OpenTag"] = 4] = "OpenTag";
    /**
     * This value represents the closing of a tag.
     */
    I18nParamValueFlags[I18nParamValueFlags["CloseTag"] = 8] = "CloseTag";
})(I18nParamValueFlags || (I18nParamValueFlags = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQTBOWDtBQTFORCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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T0FFRztJQUNILHFFQUFpQixDQUFBO0FBQ25CLENBQUMsRUF0QlcsbUJBQW1CLEtBQW5CLG1CQUFtQixRQXNCOUIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBvcGVyYXRpb25zLlxuICpcbiAqIEluY2x1ZGVzIGJvdGggY3JlYXRpb24gYW5kIHVwZGF0ZSBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZW51bSBPcEtpbmQge1xuICAvKipcbiAgICogQSBzcGVjaWFsIG9wZXJhdGlvbiB0eXBlIHdoaWNoIGlzIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBub2RlcyBvZiBhIGxpbmtlZFxuICAgKiBsaXN0IG9mIG9wZXJhdGlvbnMuXG4gICAqL1xuICBMaXN0RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggd3JhcHMgYW4gb3V0cHV0IEFTVCBzdGF0ZW1lbnQuXG4gICAqL1xuICBTdGF0ZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbmQgaW5pdGlhbGl6ZXMgYSBgU2VtYW50aWNWYXJpYWJsZWAuXG4gICAqL1xuICBWYXJpYWJsZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgRWxlbWVudFN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIEVsZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbiBlbWJlZGRlZCB2aWV3LlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQgcHJldmlvdXNseSBzdGFydGVkIHdpdGggYEVsZW1lbnRTdGFydGAuXG4gICAqL1xuICBFbGVtZW50RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGZvciBhbiBgbmctY29udGFpbmVyYCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgQ29udGFpbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyRW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGlzYWJsZSBiaW5kaW5nIGZvciBzdWJzZXF1ZW50IGVsZW1lbnRzLCB3aGljaCBhcmUgZGVzY2VuZGFudHMgb2YgYSBub24tYmluZGFibGVcbiAgICogbm9kZS5cbiAgICovXG4gIERpc2FibGVCaW5kaW5ncyxcblxuICAvKipcbiAgICogQW4gb3AgdG8gY29uZGl0aW9uYWxseSByZW5kZXIgYSB0ZW1wbGF0ZS5cbiAgICovXG4gIENvbmRpdGlvbmFsLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmUtZW5hYmxlIGJpbmRpbmcsIGFmdGVyIGl0IHdhcyBwcmV2aW91c2x5IGRpc2FibGVkLlxuICAgKi9cbiAgRW5hYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGVjbGFyaW5nIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBlbGVtZW50LlxuICAgKi9cbiAgTGlzdGVuZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBJbnRlcnBvbGF0ZVRleHQsXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBiaW5kaW5nIG9wLCB0aGF0IGhhcyBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkIGludG8gYW4gaW5kaXZpZHVhbCBwcm9wZXJ0eSxcbiAgICogYXR0cmlidXRlLCBzdHlsZSwgZXRjLlxuICAgKi9cbiAgQmluZGluZyxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHN0eWxlIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZVByb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBjbGFzcyBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBzdHlsZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBjbGFzc2VzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc01hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgZHVyaW5nIHRoZSB1cGRhdGUgcGhhc2Ugb2YgYSB2aWV3LlxuICAgKi9cbiAgQWR2YW5jZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGluc3RhbnRpYXRlIGEgcGlwZS5cbiAgICovXG4gIFBpcGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhc3NvY2lhdGUgYW4gYXR0cmlidXRlIHdpdGggYW4gZWxlbWVudC5cbiAgICovXG4gIEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gYXR0cmlidXRlIHRoYXQgaGFzIGJlZW4gZXh0cmFjdGVkIGZvciBpbmNsdXNpb24gaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICovXG4gIEV4dHJhY3RlZEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRoYXQgY29uZmlndXJlcyBhIGBAZGVmZXJgIGJsb2NrLlxuICAgKi9cbiAgRGVmZXIsXG5cbiAgLyoqXG4gICAqIEFuIElSIG9wZXJhdGlvbiB0aGF0IHByb3ZpZGVzIHNlY29uZGFyeSB0ZW1wbGF0ZXMgb2YgYSBgQGRlZmVyYCBibG9jay5cbiAgICovXG4gIERlZmVyU2Vjb25kYXJ5QmxvY2ssXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0aGF0IGNvbnRyb2xzIHdoZW4gYSBgQGRlZmVyYCBsb2Fkcy5cbiAgICovXG4gIERlZmVyT24sXG5cbiAgLyoqXG4gICAqIEFuIGkxOG4gbWVzc2FnZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAqL1xuICBFeHRyYWN0ZWRNZXNzYWdlLFxuXG4gIC8qKlxuICAgKiBBIGhvc3QgYmluZGluZyBwcm9wZXJ0eS5cbiAgICovXG4gIEhvc3RQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQSBuYW1lc3BhY2UgY2hhbmdlLCB3aGljaCBjYXVzZXMgdGhlIHN1YnNlcXVlbnQgZWxlbWVudHMgdG8gYmUgcHJvY2Vzc2VkIGFzIGVpdGhlciBIVE1MIG9yIFNWRy5cbiAgICovXG4gIE5hbWVzcGFjZSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGEgY29udGVudCBwcm9qZWNpdG9uIGRlZmluaXRpb24gZm9yIHRoZSB2aWV3LlxuICAgKi9cbiAgUHJvamVjdGlvbkRlZixcblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gICAqL1xuICBQcm9qZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSByZXBlYXRlciBjcmVhdGlvbiBpbnN0cnVjdGlvbiBvcC5cbiAgICovXG4gIFJlcGVhdGVyQ3JlYXRlLFxuXG4gIC8qKlxuICAgKiBBbiB1cGRhdGUgdXAgZm9yIGEgcmVwZWF0ZXIuXG4gICAqL1xuICBSZXBlYXRlcixcblxuICAvKipcbiAgICogVGhlIHN0YXJ0IG9mIGFuIGkxOG4gYmxvY2suXG4gICAqL1xuICBJMThuU3RhcnQsXG5cbiAgLyoqXG4gICAqIEEgc2VsZi1jbG9zaW5nIGkxOG4gb24gYSBzaW5nbGUgZWxlbWVudC5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIFRoZSBlbmQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5FbmQsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gaW4gYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkV4cHJlc3Npb24sXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRoYXQgYXBwbGllcyBhIHNldCBvZiBpMThuIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgSTE4bkFwcGx5LFxuXG4gIC8qKlxuICAgKiBBbiBpbnN0cnVjdGlvbiB0byBjcmVhdGUgYW4gSUNVIGV4cHJlc3Npb24uXG4gICAqL1xuICBJY3UsXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRvIHVwZGF0ZSBhbiBJQ1UgZXhwcmVzc2lvbi5cbiAgICovXG4gIEljdVVwZGF0ZSxcbn1cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGVudW0gRXhwcmVzc2lvbktpbmQge1xuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGluIGEgbGV4aWNhbCBzY29wZS5cbiAgICovXG4gIExleGljYWxSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgdmlldyBjb250ZXh0LCBmb3IgdXNlIGluc2lkZSBhIHRyYWNrIGZ1bmN0aW9uLlxuICAgKi9cbiAgVHJhY2tDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgaW4gYSBgVmFyaWFibGVPcGAuXG4gICAqL1xuICBSZWFkVmFyaWFibGUsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIG5hdmlnYXRlIHRvIHRoZSBuZXh0IHZpZXcgY29udGV4dCBpbiB0aGUgdmlldyBoaWVyYXJjaHkuXG4gICAqL1xuICBOZXh0Q29udGV4dCxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmV0cmlldmUgdGhlIHZhbHVlIG9mIGEgbG9jYWwgcmVmZXJlbmNlLlxuICAgKi9cbiAgUmVmZXJlbmNlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBzbmFwc2hvdCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBHZXRDdXJyZW50VmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzdG9yZSBhIHNuYXBzaG90dGVkIHZpZXcuXG4gICAqL1xuICBSZXN0b3JlVmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzZXQgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0IGFmdGVyIGBSZXN0b3JlVmlld2AuXG4gICAqL1xuICBSZXNldFZpZXcsXG5cbiAgLyoqXG4gICAqIERlZmluZXMgYW5kIGNhbGxzIGEgZnVuY3Rpb24gd2l0aCBjaGFuZ2UtZGV0ZWN0ZWQgYXJndW1lbnRzLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uRXhwcixcblxuICAvKipcbiAgICogSW5kaWNhdGVzIGEgcG9zaXRpb25hbCBwYXJhbWV0ZXIgdG8gYSBwdXJlIGZ1bmN0aW9uIGRlZmluaXRpb24uXG4gICAqL1xuICBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICovXG4gIFBpcGVCaW5kaW5nLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbiB3aXRoIGEgdmFyaWFibGUgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICovXG4gIFBpcGVCaW5kaW5nVmFyaWFkaWMsXG5cbiAgLypcbiAgICogQSBzYWZlIHByb3BlcnR5IHJlYWQgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVQcm9wZXJ0eVJlYWQsXG5cbiAgLyoqXG4gICAqIEEgc2FmZSBrZXllZCByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlS2V5ZWRSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUgZnVuY3Rpb24gY2FsbCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUludm9rZUZ1bmN0aW9uLFxuXG4gIC8qKlxuICAgKiBBbiBpbnRlcm1lZGlhdGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgZXhwYW5kZWQgZnJvbSBhIHNhZmUgcmVhZCBpbnRvIGFuIGV4cGxpY2l0IHRlcm5hcnkuXG4gICAqL1xuICBTYWZlVGVybmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGVtcHR5IGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHN0aXBwZWQgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIGZpbmFsIG91dHB1dC5cbiAgICovXG4gIEVtcHR5RXhwcixcblxuICAvKlxuICAgKiBBbiBhc3NpZ25tZW50IHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgQXNzaWduVGVtcG9yYXJ5RXhwcixcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBSZWFkVGVtcG9yYXJ5RXhwcixcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSBzYW5pdGl6ZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYW5pdGl6ZXJFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHRoYXQgd2lsbCBjYXVzZSBhIGxpdGVyYWwgc2xvdCBpbmRleCB0byBiZSBlbWl0dGVkLlxuICAgKi9cbiAgU2xvdExpdGVyYWxFeHByLFxuXG4gIC8qKlxuICAgKiBBIHRlc3QgZXhwcmVzc2lvbiBmb3IgYSBjb25kaXRpb25hbCBvcC5cbiAgICovXG4gIENvbmRpdGlvbmFsQ2FzZSxcblxuICAvKipcbiAgICogQSB2YXJpYWJsZSBmb3IgdXNlIGluc2lkZSBhIHJlcGVhdGVyLCBwcm92aWRpbmcgb25lIG9mIHRoZSBhbWJpZW50bHktYXZhaWxhYmxlIGNvbnRleHRcbiAgICogcHJvcGVydGllcyAoJGV2ZW4sICRmaXJzdCwgZXRjLikuXG4gICAqL1xuICBEZXJpdmVkUmVwZWF0ZXJWYXIsXG59XG5cbmV4cG9ydCBlbnVtIFZhcmlhYmxlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiBBbHdheXMgaW5saW5lIHRoaXMgdmFyaWFibGUsIHJlZ2FyZGxlc3Mgb2YgdGhlIG51bWJlciBvZiB0aW1lcyBpdCdzIHVzZWQuXG4gICAqIEFuIGBBbHdheXNJbmxpbmVgIHZhcmlhYmxlIG1heSBub3QgZGVwZW5kIG9uIGNvbnRleHQsIGJlY2F1c2UgZG9pbmcgc28gbWF5IGNhdXNlIHNpZGUgZWZmZWN0c1xuICAgKiB0aGF0IGFyZSBpbGxlZ2FsIHdoZW4gbXVsdGktaW5saW5lZC4gKFRoZSBvcHRpbWl6ZXIgd2lsbCBlbmZvcmNlIHRoaXMgY29uc3RyYWludC4pXG4gICAqL1xuICBBbHdheXNJbmxpbmUgPSAwYjAwMDEsXG59XG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgYmV0d2VlbiBkaWZmZXJlbnQga2luZHMgb2YgYFNlbWFudGljVmFyaWFibGVgcy5cbiAqL1xuZXhwb3J0IGVudW0gU2VtYW50aWNWYXJpYWJsZUtpbmQge1xuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgY29udGV4dCBvZiBhIHBhcnRpY3VsYXIgdmlldy5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYW4gaWRlbnRpZmllciBkZWNsYXJlZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiBhIHZpZXcuXG4gICAqL1xuICBJZGVudGlmaWVyLFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgc2F2ZWQgc3RhdGUgdGhhdCBjYW4gYmUgdXNlZCB0byByZXN0b3JlIGEgdmlldyBpbiBhIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYXZlZFZpZXcsXG5cbiAgLyoqXG4gICAqIEFuIGFsaWFzIGdlbmVyYXRlZCBieSBhIHNwZWNpYWwgZW1iZWRkZWQgdmlldyB0eXBlIChlLmcuIGEgYEBmb3JgIGJsb2NrKS5cbiAgICovXG4gIEFsaWFzLFxufVxuXG4vKipcbiAqIFdoZXRoZXIgdG8gY29tcGlsZSBpbiBjb21wYXRpYmlsdHkgbW9kZS4gSW4gY29tcGF0aWJpbGl0eSBtb2RlLCB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgd2lsbFxuICogYXR0ZW1wdCB0byBtYXRjaCB0aGUgb3V0cHV0IG9mIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCBhcyBleGFjdGx5IGFzIHBvc3NpYmxlLCBhdCB0aGUgY29zdFxuICogb2YgcHJvZHVjaW5nIHF1aXJreSBvciBsYXJnZXIgY29kZSBpbiBzb21lIGNhc2VzLlxuICovXG5leHBvcnQgZW51bSBDb21wYXRpYmlsaXR5TW9kZSB7XG4gIE5vcm1hbCxcbiAgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcixcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGZ1bmN0aW9ucyB1c2VkIHRvIHNhbml0aXplIGRpZmZlcmVudCBwaWVjZXMgb2YgYSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGVudW0gU2FuaXRpemVyRm4ge1xuICBIdG1sLFxuICBTY3JpcHQsXG4gIFN0eWxlLFxuICBVcmwsXG4gIFJlc291cmNlVXJsLFxuICBJZnJhbWVBdHRyaWJ1dGUsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIGRpZmZlcmVudCBraW5kcyBvZiBgQGRlZmVyYCBzZWNvbmRhcnkgYmxvY2tzLlxuICovXG5leHBvcnQgZW51bSBEZWZlclNlY29uZGFyeUtpbmQge1xuICBMb2FkaW5nLFxuICBQbGFjZWhvbGRlcixcbiAgRXJyb3IsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIHR5cGVzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggY2FuIGJlIGFwcGxpZWQgdG8gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGVudW0gQmluZGluZ0tpbmQge1xuICAvKipcbiAgICogU3RhdGljIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIENsYXNzIGJpbmRpbmdzLlxuICAgKi9cbiAgQ2xhc3NOYW1lLFxuXG4gIC8qKlxuICAgKiBTdHlsZSBiaW5kaW5ncy5cbiAgICovXG4gIFN0eWxlUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIER5bmFtaWMgcHJvcGVydHkgYmluZGluZ3MuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogUHJvcGVydHkgb3IgYXR0cmlidXRlIGJpbmRpbmdzIG9uIGEgdGVtcGxhdGUuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogSW50ZXJuYXRpb25hbGl6ZWQgYXR0cmlidXRlcy5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIEFuaW1hdGlvbiBwcm9wZXJ0eSBiaW5kaW5ncy5cbiAgICovXG4gIEFuaW1hdGlvbixcbn1cblxuLyoqXG4gKiBFbnVtZXJhdGlvbiBvZiBwb3NzaWJsZSB0aW1lcyBpMThuIHBhcmFtcyBjYW4gYmUgcmVzb2x2ZWQuXG4gKi9cbmV4cG9ydCBlbnVtIEkxOG5QYXJhbVJlc29sdXRpb25UaW1lIHtcbiAgLyoqXG4gICAqIFBhcmFtIGlzIHJlc29sdmVkIGF0IG1lc3NhZ2UgY3JlYXRpb24gdGltZS4gTW9zdCBwYXJhbXMgc2hvdWxkIGJlIHJlc29sdmVkIGF0IG1lc3NhZ2UgY3JlYXRpb25cbiAgICogdGltZS4gSG93ZXZlciwgSUNVIHBhcmFtcyBuZWVkIHRvIGJlIGhhbmRsZWQgaW4gcG9zdC1wcm9jZXNzaW5nLlxuICAgKi9cbiAgQ3JlYXRpb24sXG5cbiAgLyoqXG4gICAqIFBhcmFtIGlzIHJlc29sdmVkIGR1cmluZyBwb3N0LXByb2Nlc3NpbmcuIFRoaXMgc2hvdWxkIGJlIHVzZWQgZm9yIHBhcmFtcyB3aG8ncyB2YWx1ZSBjb21lcyBmcm9tXG4gICAqIGFuIElDVS5cbiAgICovXG4gIFBvc3Rwcm9jY2Vzc2luZ1xufVxuXG4vKipcbiAqIEZsYWdzIHRoYXQgZGVzY3JpYmUgd2hhdCBhbiBpMThuIHBhcmFtIHZhbHVlLiBUaGVzZSBkZXRlcm1pbmUgaG93IHRoZSB2YWx1ZSBpcyBzZXJpYWxpemVkIGludG9cbiAqIHRoZSBmaW5hbCBtYXAuXG4gKi9cbmV4cG9ydCBlbnVtIEkxOG5QYXJhbVZhbHVlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiAgVGhpcyB2YWx1ZSByZXByZXN0ZW50cyBhbiBlbGVtZW50IHRhZy5cbiAgICovXG4gIEVsZW1lbnRUYWcgPSAwYjAwMSxcblxuICAvKipcbiAgICogVGhpcyB2YWx1ZSByZXByZXNlbnRzIGEgdGVtcGxhdGUgdGFnLlxuICAgKi9cbiAgVGVtcGxhdGVUYWcgPSAwYjAwMTAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgb3BlbmluZyBvZiBhIHRhZy5cbiAgICovXG4gIE9wZW5UYWcgPSAwYjAxMDAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgY2xvc2luZyBvZiBhIHRhZy5cbiAgICovXG4gIENsb3NlVGFnID0gMGIxMDAwLFxufVxuIl19