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
     * An operation that controls when a `@defer` loads.
     */
    OpKind[OpKind["DeferOn"] = 27] = "DeferOn";
    /**
     * An operation that controls when a `@defer` loads, using a custom expression as the condition.
     */
    OpKind[OpKind["DeferWhen"] = 28] = "DeferWhen";
    /**
     * An i18n message that has been extracted for inclusion in the consts array.
     */
    OpKind[OpKind["I18nMessage"] = 29] = "I18nMessage";
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
     * An operation to bind an expression to the property side of a two-way binding.
     */
    OpKind[OpKind["TwoWayProperty"] = 36] = "TwoWayProperty";
    /**
     * An operation declaring the event side of a two-way binding.
     */
    OpKind[OpKind["TwoWayListener"] = 37] = "TwoWayListener";
    /**
     * The start of an i18n block.
     */
    OpKind[OpKind["I18nStart"] = 38] = "I18nStart";
    /**
     * A self-closing i18n on a single element.
     */
    OpKind[OpKind["I18n"] = 39] = "I18n";
    /**
     * The end of an i18n block.
     */
    OpKind[OpKind["I18nEnd"] = 40] = "I18nEnd";
    /**
     * An expression in an i18n message.
     */
    OpKind[OpKind["I18nExpression"] = 41] = "I18nExpression";
    /**
     * An instruction that applies a set of i18n expressions.
     */
    OpKind[OpKind["I18nApply"] = 42] = "I18nApply";
    /**
     * An instruction to create an ICU expression.
     */
    OpKind[OpKind["IcuStart"] = 43] = "IcuStart";
    /**
     * An instruction to update an ICU expression.
     */
    OpKind[OpKind["IcuEnd"] = 44] = "IcuEnd";
    /**
     * An instruction representing a placeholder in an ICU expression.
     */
    OpKind[OpKind["IcuPlaceholder"] = 45] = "IcuPlaceholder";
    /**
     * An i18n context containing information needed to generate an i18n message.
     */
    OpKind[OpKind["I18nContext"] = 46] = "I18nContext";
    /**
     * A creation op that corresponds to i18n attributes on an element.
     */
    OpKind[OpKind["I18nAttributes"] = 47] = "I18nAttributes";
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
     * An expression representing a function to create trusted values.
     */
    ExpressionKind[ExpressionKind["TrustedValueFnExpr"] = 21] = "TrustedValueFnExpr";
    /**
     * An expression that will cause a literal slot index to be emitted.
     */
    ExpressionKind[ExpressionKind["SlotLiteralExpr"] = 22] = "SlotLiteralExpr";
    /**
     * A test expression for a conditional op.
     */
    ExpressionKind[ExpressionKind["ConditionalCase"] = 23] = "ConditionalCase";
    /**
     * A variable for use inside a repeater, providing one of the ambiently-available context
     * properties ($even, $first, etc.).
     */
    ExpressionKind[ExpressionKind["DerivedRepeaterVar"] = 24] = "DerivedRepeaterVar";
    /**
     * An expression that will be automatically extracted to the component const array.
     */
    ExpressionKind[ExpressionKind["ConstCollected"] = 25] = "ConstCollected";
    /**
     * Operation that sets the value of a two-way binding.
     */
    ExpressionKind[ExpressionKind["TwoWayBindingSet"] = 26] = "TwoWayBindingSet";
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
    /**
     * Property side of a two-way binding.
     */
    BindingKind[BindingKind["TwoWayProperty"] = 7] = "TwoWayProperty";
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
 * The contexts in which an i18n expression can be used.
 */
export var I18nExpressionFor;
(function (I18nExpressionFor) {
    /**
     * This expression is used as a value (i.e. inside an i18n block).
     */
    I18nExpressionFor[I18nExpressionFor["I18nText"] = 0] = "I18nText";
    /**
     * This expression is used in a binding.
     */
    I18nExpressionFor[I18nExpressionFor["I18nAttribute"] = 1] = "I18nAttribute";
})(I18nExpressionFor || (I18nExpressionFor = {}));
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
    /**
     * This value represents an i18n expression index.
     */
    I18nParamValueFlags[I18nParamValueFlags["ExpressionIndex"] = 16] = "ExpressionIndex";
})(I18nParamValueFlags || (I18nParamValueFlags = {}));
/**
 * Whether the active namespace is HTML, MathML, or SVG mode.
 */
export var Namespace;
(function (Namespace) {
    Namespace[Namespace["HTML"] = 0] = "HTML";
    Namespace[Namespace["SVG"] = 1] = "SVG";
    Namespace[Namespace["Math"] = 2] = "Math";
})(Namespace || (Namespace = {}));
/**
 * The type of a `@defer` trigger, for use in the ir.
 */
export var DeferTriggerKind;
(function (DeferTriggerKind) {
    DeferTriggerKind[DeferTriggerKind["Idle"] = 0] = "Idle";
    DeferTriggerKind[DeferTriggerKind["Immediate"] = 1] = "Immediate";
    DeferTriggerKind[DeferTriggerKind["Timer"] = 2] = "Timer";
    DeferTriggerKind[DeferTriggerKind["Hover"] = 3] = "Hover";
    DeferTriggerKind[DeferTriggerKind["Interaction"] = 4] = "Interaction";
    DeferTriggerKind[DeferTriggerKind["Viewport"] = 5] = "Viewport";
})(DeferTriggerKind || (DeferTriggerKind = {}));
/**
 * Kinds of i18n contexts. They can be created because of root i18n blocks, or ICUs.
 */
export var I18nContextKind;
(function (I18nContextKind) {
    I18nContextKind[I18nContextKind["RootI18n"] = 0] = "RootI18n";
    I18nContextKind[I18nContextKind["Icu"] = 1] = "Icu";
    I18nContextKind[I18nContextKind["Attr"] = 2] = "Attr";
})(I18nContextKind || (I18nContextKind = {}));
export var TemplateKind;
(function (TemplateKind) {
    TemplateKind[TemplateKind["NgTemplate"] = 0] = "NgTemplate";
    TemplateKind[TemplateKind["Structural"] = 1] = "Structural";
    TemplateKind[TemplateKind["Block"] = 2] = "Block";
})(TemplateKind || (TemplateKind = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQW1QWDtBQW5QRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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Y2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBvcGVyYXRpb25zLlxuICpcbiAqIEluY2x1ZGVzIGJvdGggY3JlYXRpb24gYW5kIHVwZGF0ZSBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZW51bSBPcEtpbmQge1xuICAvKipcbiAgICogQSBzcGVjaWFsIG9wZXJhdGlvbiB0eXBlIHdoaWNoIGlzIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBub2RlcyBvZiBhIGxpbmtlZFxuICAgKiBsaXN0IG9mIG9wZXJhdGlvbnMuXG4gICAqL1xuICBMaXN0RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggd3JhcHMgYW4gb3V0cHV0IEFTVCBzdGF0ZW1lbnQuXG4gICAqL1xuICBTdGF0ZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbmQgaW5pdGlhbGl6ZXMgYSBgU2VtYW50aWNWYXJpYWJsZWAuXG4gICAqL1xuICBWYXJpYWJsZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgRWxlbWVudFN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIEVsZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbiBlbWJlZGRlZCB2aWV3LlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQgcHJldmlvdXNseSBzdGFydGVkIHdpdGggYEVsZW1lbnRTdGFydGAuXG4gICAqL1xuICBFbGVtZW50RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGZvciBhbiBgbmctY29udGFpbmVyYCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgQ29udGFpbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyRW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGlzYWJsZSBiaW5kaW5nIGZvciBzdWJzZXF1ZW50IGVsZW1lbnRzLCB3aGljaCBhcmUgZGVzY2VuZGFudHMgb2YgYSBub24tYmluZGFibGVcbiAgICogbm9kZS5cbiAgICovXG4gIERpc2FibGVCaW5kaW5ncyxcblxuICAvKipcbiAgICogQW4gb3AgdG8gY29uZGl0aW9uYWxseSByZW5kZXIgYSB0ZW1wbGF0ZS5cbiAgICovXG4gIENvbmRpdGlvbmFsLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmUtZW5hYmxlIGJpbmRpbmcsIGFmdGVyIGl0IHdhcyBwcmV2aW91c2x5IGRpc2FibGVkLlxuICAgKi9cbiAgRW5hYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGVjbGFyaW5nIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBlbGVtZW50LlxuICAgKi9cbiAgTGlzdGVuZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBJbnRlcnBvbGF0ZVRleHQsXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBiaW5kaW5nIG9wLCB0aGF0IGhhcyBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkIGludG8gYW4gaW5kaXZpZHVhbCBwcm9wZXJ0eSxcbiAgICogYXR0cmlidXRlLCBzdHlsZSwgZXRjLlxuICAgKi9cbiAgQmluZGluZyxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHN0eWxlIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZVByb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBjbGFzcyBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBzdHlsZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBjbGFzc2VzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc01hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgZHVyaW5nIHRoZSB1cGRhdGUgcGhhc2Ugb2YgYSB2aWV3LlxuICAgKi9cbiAgQWR2YW5jZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGluc3RhbnRpYXRlIGEgcGlwZS5cbiAgICovXG4gIFBpcGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhc3NvY2lhdGUgYW4gYXR0cmlidXRlIHdpdGggYW4gZWxlbWVudC5cbiAgICovXG4gIEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gYXR0cmlidXRlIHRoYXQgaGFzIGJlZW4gZXh0cmFjdGVkIGZvciBpbmNsdXNpb24gaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICovXG4gIEV4dHJhY3RlZEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRoYXQgY29uZmlndXJlcyBhIGBAZGVmZXJgIGJsb2NrLlxuICAgKi9cbiAgRGVmZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0aGF0IGNvbnRyb2xzIHdoZW4gYSBgQGRlZmVyYCBsb2Fkcy5cbiAgICovXG4gIERlZmVyT24sXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0aGF0IGNvbnRyb2xzIHdoZW4gYSBgQGRlZmVyYCBsb2FkcywgdXNpbmcgYSBjdXN0b20gZXhwcmVzc2lvbiBhcyB0aGUgY29uZGl0aW9uLlxuICAgKi9cbiAgRGVmZXJXaGVuLFxuXG4gIC8qKlxuICAgKiBBbiBpMThuIG1lc3NhZ2UgdGhhdCBoYXMgYmVlbiBleHRyYWN0ZWQgZm9yIGluY2x1c2lvbiBpbiB0aGUgY29uc3RzIGFycmF5LlxuICAgKi9cbiAgSTE4bk1lc3NhZ2UsXG5cbiAgLyoqXG4gICAqIEEgaG9zdCBiaW5kaW5nIHByb3BlcnR5LlxuICAgKi9cbiAgSG9zdFByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBBIG5hbWVzcGFjZSBjaGFuZ2UsIHdoaWNoIGNhdXNlcyB0aGUgc3Vic2VxdWVudCBlbGVtZW50cyB0byBiZSBwcm9jZXNzZWQgYXMgZWl0aGVyIEhUTUwgb3IgU1ZHLlxuICAgKi9cbiAgTmFtZXNwYWNlLFxuXG4gIC8qKlxuICAgKiBDb25maWd1cmUgYSBjb250ZW50IHByb2plY2l0b24gZGVmaW5pdGlvbiBmb3IgdGhlIHZpZXcuXG4gICAqL1xuICBQcm9qZWN0aW9uRGVmLFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb250ZW50IHByb2plY3Rpb24gc2xvdC5cbiAgICovXG4gIFByb2plY3Rpb24sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIHJlcGVhdGVyIGNyZWF0aW9uIGluc3RydWN0aW9uIG9wLlxuICAgKi9cbiAgUmVwZWF0ZXJDcmVhdGUsXG5cbiAgLyoqXG4gICAqIEFuIHVwZGF0ZSB1cCBmb3IgYSByZXBlYXRlci5cbiAgICovXG4gIFJlcGVhdGVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBwcm9wZXJ0eSBzaWRlIG9mIGEgdHdvLXdheSBiaW5kaW5nLlxuICAgKi9cbiAgVHdvV2F5UHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBkZWNsYXJpbmcgdGhlIGV2ZW50IHNpZGUgb2YgYSB0d28td2F5IGJpbmRpbmcuXG4gICAqL1xuICBUd29XYXlMaXN0ZW5lcixcblxuICAvKipcbiAgICogVGhlIHN0YXJ0IG9mIGFuIGkxOG4gYmxvY2suXG4gICAqL1xuICBJMThuU3RhcnQsXG5cbiAgLyoqXG4gICAqIEEgc2VsZi1jbG9zaW5nIGkxOG4gb24gYSBzaW5nbGUgZWxlbWVudC5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIFRoZSBlbmQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5FbmQsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gaW4gYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkV4cHJlc3Npb24sXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRoYXQgYXBwbGllcyBhIHNldCBvZiBpMThuIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgSTE4bkFwcGx5LFxuXG4gIC8qKlxuICAgKiBBbiBpbnN0cnVjdGlvbiB0byBjcmVhdGUgYW4gSUNVIGV4cHJlc3Npb24uXG4gICAqL1xuICBJY3VTdGFydCxcblxuICAvKipcbiAgICogQW4gaW5zdHJ1Y3Rpb24gdG8gdXBkYXRlIGFuIElDVSBleHByZXNzaW9uLlxuICAgKi9cbiAgSWN1RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBpbnN0cnVjdGlvbiByZXByZXNlbnRpbmcgYSBwbGFjZWhvbGRlciBpbiBhbiBJQ1UgZXhwcmVzc2lvbi5cbiAgICovXG4gIEljdVBsYWNlaG9sZGVyLFxuXG4gIC8qKlxuICAgKiBBbiBpMThuIGNvbnRleHQgY29udGFpbmluZyBpbmZvcm1hdGlvbiBuZWVkZWQgdG8gZ2VuZXJhdGUgYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkNvbnRleHQsXG5cbiAgLyoqXG4gICAqIEEgY3JlYXRpb24gb3AgdGhhdCBjb3JyZXNwb25kcyB0byBpMThuIGF0dHJpYnV0ZXMgb24gYW4gZWxlbWVudC5cbiAgICovXG4gIEkxOG5BdHRyaWJ1dGVzLFxufVxuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZW51bSBFeHByZXNzaW9uS2luZCB7XG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgaW4gYSBsZXhpY2FsIHNjb3BlLlxuICAgKi9cbiAgTGV4aWNhbFJlYWQsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSB2aWV3IGNvbnRleHQsIGZvciB1c2UgaW5zaWRlIGEgdHJhY2sgZnVuY3Rpb24uXG4gICAqL1xuICBUcmFja0NvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBkZWNsYXJlZCBpbiBhIGBWYXJpYWJsZU9wYC5cbiAgICovXG4gIFJlYWRWYXJpYWJsZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gbmF2aWdhdGUgdG8gdGhlIG5leHQgdmlldyBjb250ZXh0IGluIHRoZSB2aWV3IGhpZXJhcmNoeS5cbiAgICovXG4gIE5leHRDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXRyaWV2ZSB0aGUgdmFsdWUgb2YgYSBsb2NhbCByZWZlcmVuY2UuXG4gICAqL1xuICBSZWZlcmVuY2UsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHNuYXBzaG90IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIEdldEN1cnJlbnRWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXN0b3JlIGEgc25hcHNob3R0ZWQgdmlldy5cbiAgICovXG4gIFJlc3RvcmVWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXNldCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgYWZ0ZXIgYFJlc3RvcmVWaWV3YC5cbiAgICovXG4gIFJlc2V0VmlldyxcblxuICAvKipcbiAgICogRGVmaW5lcyBhbmQgY2FsbHMgYSBmdW5jdGlvbiB3aXRoIGNoYW5nZS1kZXRlY3RlZCBhcmd1bWVudHMuXG4gICAqL1xuICBQdXJlRnVuY3Rpb25FeHByLFxuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgYSBwb3NpdGlvbmFsIHBhcmFtZXRlciB0byBhIHB1cmUgZnVuY3Rpb24gZGVmaW5pdGlvbi5cbiAgICovXG4gIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIsXG5cbiAgLyoqXG4gICAqIEJpbmRpbmcgdG8gYSBwaXBlIHRyYW5zZm9ybWF0aW9uLlxuICAgKi9cbiAgUGlwZUJpbmRpbmcsXG5cbiAgLyoqXG4gICAqIEJpbmRpbmcgdG8gYSBwaXBlIHRyYW5zZm9ybWF0aW9uIHdpdGggYSB2YXJpYWJsZSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKi9cbiAgUGlwZUJpbmRpbmdWYXJpYWRpYyxcblxuICAvKlxuICAgKiBBIHNhZmUgcHJvcGVydHkgcmVhZCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZVByb3BlcnR5UmVhZCxcblxuICAvKipcbiAgICogQSBzYWZlIGtleWVkIHJlYWQgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVLZXllZFJlYWQsXG5cbiAgLyoqXG4gICAqIEEgc2FmZSBmdW5jdGlvbiBjYWxsIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlSW52b2tlRnVuY3Rpb24sXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBleHBhbmRlZCBmcm9tIGEgc2FmZSByZWFkIGludG8gYW4gZXhwbGljaXQgdGVybmFyeS5cbiAgICovXG4gIFNhZmVUZXJuYXJ5RXhwcixcblxuICAvKipcbiAgICogQW4gZW1wdHkgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgc3RpcHBlZCBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgZmluYWwgb3V0cHV0LlxuICAgKi9cbiAgRW1wdHlFeHByLFxuXG4gIC8qXG4gICAqIEFuIGFzc2lnbm1lbnQgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBBc3NpZ25UZW1wb3JhcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIFJlYWRUZW1wb3JhcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHNhbml0aXplciBmdW5jdGlvbi5cbiAgICovXG4gIFNhbml0aXplckV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgZnVuY3Rpb24gdG8gY3JlYXRlIHRydXN0ZWQgdmFsdWVzLlxuICAgKi9cbiAgVHJ1c3RlZFZhbHVlRm5FeHByLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHRoYXQgd2lsbCBjYXVzZSBhIGxpdGVyYWwgc2xvdCBpbmRleCB0byBiZSBlbWl0dGVkLlxuICAgKi9cbiAgU2xvdExpdGVyYWxFeHByLFxuXG4gIC8qKlxuICAgKiBBIHRlc3QgZXhwcmVzc2lvbiBmb3IgYSBjb25kaXRpb25hbCBvcC5cbiAgICovXG4gIENvbmRpdGlvbmFsQ2FzZSxcblxuICAvKipcbiAgICogQSB2YXJpYWJsZSBmb3IgdXNlIGluc2lkZSBhIHJlcGVhdGVyLCBwcm92aWRpbmcgb25lIG9mIHRoZSBhbWJpZW50bHktYXZhaWxhYmxlIGNvbnRleHRcbiAgICogcHJvcGVydGllcyAoJGV2ZW4sICRmaXJzdCwgZXRjLikuXG4gICAqL1xuICBEZXJpdmVkUmVwZWF0ZXJWYXIsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgZXh0cmFjdGVkIHRvIHRoZSBjb21wb25lbnQgY29uc3QgYXJyYXkuXG4gICAqL1xuICBDb25zdENvbGxlY3RlZCxcblxuICAvKipcbiAgICogT3BlcmF0aW9uIHRoYXQgc2V0cyB0aGUgdmFsdWUgb2YgYSB0d28td2F5IGJpbmRpbmcuXG4gICAqL1xuICBUd29XYXlCaW5kaW5nU2V0LFxufVxuXG5leHBvcnQgZW51bSBWYXJpYWJsZUZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwMCxcblxuICAvKipcbiAgICogQWx3YXlzIGlubGluZSB0aGlzIHZhcmlhYmxlLCByZWdhcmRsZXNzIG9mIHRoZSBudW1iZXIgb2YgdGltZXMgaXQncyB1c2VkLlxuICAgKiBBbiBgQWx3YXlzSW5saW5lYCB2YXJpYWJsZSBtYXkgbm90IGRlcGVuZCBvbiBjb250ZXh0LCBiZWNhdXNlIGRvaW5nIHNvIG1heSBjYXVzZSBzaWRlIGVmZmVjdHNcbiAgICogdGhhdCBhcmUgaWxsZWdhbCB3aGVuIG11bHRpLWlubGluZWQuIChUaGUgb3B0aW1pemVyIHdpbGwgZW5mb3JjZSB0aGlzIGNvbnN0cmFpbnQuKVxuICAgKi9cbiAgQWx3YXlzSW5saW5lID0gMGIwMDAxLFxufVxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGJldHdlZW4gZGlmZmVyZW50IGtpbmRzIG9mIGBTZW1hbnRpY1ZhcmlhYmxlYHMuXG4gKi9cbmV4cG9ydCBlbnVtIFNlbWFudGljVmFyaWFibGVLaW5kIHtcbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGNvbnRleHQgb2YgYSBwYXJ0aWN1bGFyIHZpZXcuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGlkZW50aWZpZXIgZGVjbGFyZWQgaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgYSB2aWV3LlxuICAgKi9cbiAgSWRlbnRpZmllcixcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHNhdmVkIHN0YXRlIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzdG9yZSBhIHZpZXcgaW4gYSBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2F2ZWRWaWV3LFxuXG4gIC8qKlxuICAgKiBBbiBhbGlhcyBnZW5lcmF0ZWQgYnkgYSBzcGVjaWFsIGVtYmVkZGVkIHZpZXcgdHlwZSAoZS5nLiBhIGBAZm9yYCBibG9jaykuXG4gICAqL1xuICBBbGlhcyxcbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRvIGNvbXBpbGUgaW4gY29tcGF0aWJpbHR5IG1vZGUuIEluIGNvbXBhdGliaWxpdHkgbW9kZSwgdGhlIHRlbXBsYXRlIHBpcGVsaW5lIHdpbGxcbiAqIGF0dGVtcHQgdG8gbWF0Y2ggdGhlIG91dHB1dCBvZiBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgYXMgZXhhY3RseSBhcyBwb3NzaWJsZSwgYXQgdGhlIGNvc3RcbiAqIG9mIHByb2R1Y2luZyBxdWlya3kgb3IgbGFyZ2VyIGNvZGUgaW4gc29tZSBjYXNlcy5cbiAqL1xuZXhwb3J0IGVudW0gQ29tcGF0aWJpbGl0eU1vZGUge1xuICBOb3JtYWwsXG4gIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIGRpZmZlcmVudCBraW5kcyBvZiBgQGRlZmVyYCBzZWNvbmRhcnkgYmxvY2tzLlxuICovXG5leHBvcnQgZW51bSBEZWZlclNlY29uZGFyeUtpbmQge1xuICBMb2FkaW5nLFxuICBQbGFjZWhvbGRlcixcbiAgRXJyb3IsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIHR5cGVzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggY2FuIGJlIGFwcGxpZWQgdG8gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGVudW0gQmluZGluZ0tpbmQge1xuICAvKipcbiAgICogU3RhdGljIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIENsYXNzIGJpbmRpbmdzLlxuICAgKi9cbiAgQ2xhc3NOYW1lLFxuXG4gIC8qKlxuICAgKiBTdHlsZSBiaW5kaW5ncy5cbiAgICovXG4gIFN0eWxlUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIER5bmFtaWMgcHJvcGVydHkgYmluZGluZ3MuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogUHJvcGVydHkgb3IgYXR0cmlidXRlIGJpbmRpbmdzIG9uIGEgdGVtcGxhdGUuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogSW50ZXJuYXRpb25hbGl6ZWQgYXR0cmlidXRlcy5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIEFuaW1hdGlvbiBwcm9wZXJ0eSBiaW5kaW5ncy5cbiAgICovXG4gIEFuaW1hdGlvbixcblxuICAvKipcbiAgICogUHJvcGVydHkgc2lkZSBvZiBhIHR3by13YXkgYmluZGluZy5cbiAgICovXG4gIFR3b1dheVByb3BlcnR5LFxufVxuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHBvc3NpYmxlIHRpbWVzIGkxOG4gcGFyYW1zIGNhbiBiZSByZXNvbHZlZC5cbiAqL1xuZXhwb3J0IGVudW0gSTE4blBhcmFtUmVzb2x1dGlvblRpbWUge1xuICAvKipcbiAgICogUGFyYW0gaXMgcmVzb2x2ZWQgYXQgbWVzc2FnZSBjcmVhdGlvbiB0aW1lLiBNb3N0IHBhcmFtcyBzaG91bGQgYmUgcmVzb2x2ZWQgYXQgbWVzc2FnZSBjcmVhdGlvblxuICAgKiB0aW1lLiBIb3dldmVyLCBJQ1UgcGFyYW1zIG5lZWQgdG8gYmUgaGFuZGxlZCBpbiBwb3N0LXByb2Nlc3NpbmcuXG4gICAqL1xuICBDcmVhdGlvbixcblxuICAvKipcbiAgICogUGFyYW0gaXMgcmVzb2x2ZWQgZHVyaW5nIHBvc3QtcHJvY2Vzc2luZy4gVGhpcyBzaG91bGQgYmUgdXNlZCBmb3IgcGFyYW1zIHdobydzIHZhbHVlIGNvbWVzIGZyb21cbiAgICogYW4gSUNVLlxuICAgKi9cbiAgUG9zdHByb2NjZXNzaW5nXG59XG5cbi8qKlxuICogVGhlIGNvbnRleHRzIGluIHdoaWNoIGFuIGkxOG4gZXhwcmVzc2lvbiBjYW4gYmUgdXNlZC5cbiAqL1xuZXhwb3J0IGVudW0gSTE4bkV4cHJlc3Npb25Gb3Ige1xuICAvKipcbiAgICogVGhpcyBleHByZXNzaW9uIGlzIHVzZWQgYXMgYSB2YWx1ZSAoaS5lLiBpbnNpZGUgYW4gaTE4biBibG9jaykuXG4gICAqL1xuICBJMThuVGV4dCxcblxuICAvKipcbiAgICogVGhpcyBleHByZXNzaW9uIGlzIHVzZWQgaW4gYSBiaW5kaW5nLlxuICAgKi9cbiAgSTE4bkF0dHJpYnV0ZSxcbn1cblxuLyoqXG4gKiBGbGFncyB0aGF0IGRlc2NyaWJlIHdoYXQgYW4gaTE4biBwYXJhbSB2YWx1ZS4gVGhlc2UgZGV0ZXJtaW5lIGhvdyB0aGUgdmFsdWUgaXMgc2VyaWFsaXplZCBpbnRvXG4gKiB0aGUgZmluYWwgbWFwLlxuICovXG5leHBvcnQgZW51bSBJMThuUGFyYW1WYWx1ZUZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwMCxcblxuICAvKipcbiAgICogIFRoaXMgdmFsdWUgcmVwcmVzdGVudHMgYW4gZWxlbWVudCB0YWcuXG4gICAqL1xuICBFbGVtZW50VGFnID0gMGIxLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgYSB0ZW1wbGF0ZSB0YWcuXG4gICAqL1xuICBUZW1wbGF0ZVRhZyA9IDBiMTAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgb3BlbmluZyBvZiBhIHRhZy5cbiAgICovXG4gIE9wZW5UYWcgPSAwYjAxMDAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyB0aGUgY2xvc2luZyBvZiBhIHRhZy5cbiAgICovXG4gIENsb3NlVGFnID0gMGIxMDAwLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgYW4gaTE4biBleHByZXNzaW9uIGluZGV4LlxuICAgKi9cbiAgRXhwcmVzc2lvbkluZGV4ID0gMGIxMDAwMFxufVxuXG4vKipcbiAqIFdoZXRoZXIgdGhlIGFjdGl2ZSBuYW1lc3BhY2UgaXMgSFRNTCwgTWF0aE1MLCBvciBTVkcgbW9kZS5cbiAqL1xuZXhwb3J0IGVudW0gTmFtZXNwYWNlIHtcbiAgSFRNTCxcbiAgU1ZHLFxuICBNYXRoLFxufVxuXG4vKipcbiAqIFRoZSB0eXBlIG9mIGEgYEBkZWZlcmAgdHJpZ2dlciwgZm9yIHVzZSBpbiB0aGUgaXIuXG4gKi9cbmV4cG9ydCBlbnVtIERlZmVyVHJpZ2dlcktpbmQge1xuICBJZGxlLFxuICBJbW1lZGlhdGUsXG4gIFRpbWVyLFxuICBIb3ZlcixcbiAgSW50ZXJhY3Rpb24sXG4gIFZpZXdwb3J0LFxufVxuXG4vKipcbiAqIEtpbmRzIG9mIGkxOG4gY29udGV4dHMuIFRoZXkgY2FuIGJlIGNyZWF0ZWQgYmVjYXVzZSBvZiByb290IGkxOG4gYmxvY2tzLCBvciBJQ1VzLlxuICovXG5leHBvcnQgZW51bSBJMThuQ29udGV4dEtpbmQge1xuICBSb290STE4bixcbiAgSWN1LFxuICBBdHRyXG59XG5cbmV4cG9ydCBlbnVtIFRlbXBsYXRlS2luZCB7XG4gIE5nVGVtcGxhdGUsXG4gIFN0cnVjdHVyYWwsXG4gIEJsb2NrXG59XG4iXX0=