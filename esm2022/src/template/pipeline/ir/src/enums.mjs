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
     * An i18n message that has been extracted for inclusion in the consts array.
     */
    OpKind[OpKind["I18nMessage"] = 28] = "I18nMessage";
    /**
     * A host binding property.
     */
    OpKind[OpKind["HostProperty"] = 29] = "HostProperty";
    /**
     * A namespace change, which causes the subsequent elements to be processed as either HTML or SVG.
     */
    OpKind[OpKind["Namespace"] = 30] = "Namespace";
    /**
     * Configure a content projeciton definition for the view.
     */
    OpKind[OpKind["ProjectionDef"] = 31] = "ProjectionDef";
    /**
     * Create a content projection slot.
     */
    OpKind[OpKind["Projection"] = 32] = "Projection";
    /**
     * Create a repeater creation instruction op.
     */
    OpKind[OpKind["RepeaterCreate"] = 33] = "RepeaterCreate";
    /**
     * An update up for a repeater.
     */
    OpKind[OpKind["Repeater"] = 34] = "Repeater";
    /**
     * The start of an i18n block.
     */
    OpKind[OpKind["I18nStart"] = 35] = "I18nStart";
    /**
     * A self-closing i18n on a single element.
     */
    OpKind[OpKind["I18n"] = 36] = "I18n";
    /**
     * The end of an i18n block.
     */
    OpKind[OpKind["I18nEnd"] = 37] = "I18nEnd";
    /**
     * An expression in an i18n message.
     */
    OpKind[OpKind["I18nExpression"] = 38] = "I18nExpression";
    /**
     * An instruction that applies a set of i18n expressions.
     */
    OpKind[OpKind["I18nApply"] = 39] = "I18nApply";
    /**
     * An instruction to create an ICU expression.
     */
    OpKind[OpKind["Icu"] = 40] = "Icu";
    /**
     * An instruction to update an ICU expression.
     */
    OpKind[OpKind["IcuUpdate"] = 41] = "IcuUpdate";
    /**
     * An i18n context containing information needed to generate an i18n message.
     */
    OpKind[OpKind["I18nContext"] = 42] = "I18nContext";
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
    /**
     * An expression that will be automatically extracted to the component const array.
     */
    ExpressionKind[ExpressionKind["ConstCollected"] = 24] = "ConstCollected";
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
 * Repeaters implicitly define these derived variables, and child nodes may read them.
 */
export var DerivedRepeaterVarIdentity;
(function (DerivedRepeaterVarIdentity) {
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["First"] = 0] = "First";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Last"] = 1] = "Last";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Even"] = 2] = "Even";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Odd"] = 3] = "Odd";
})(DerivedRepeaterVarIdentity || (DerivedRepeaterVarIdentity = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQTBOWDtBQTFORCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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SUFDSCxtRUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILHFFQUFpQixDQUFBO0FBQ25CLENBQUMsRUF0QlcsbUJBQW1CLEtBQW5CLG1CQUFtQixRQXNCOUI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLFNBSVg7QUFKRCxXQUFZLFNBQVM7SUFDbkIseUNBQUksQ0FBQTtJQUNKLHVDQUFHLENBQUE7SUFDSCx5Q0FBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLFNBQVMsS0FBVCxTQUFTLFFBSXBCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxnQkFPWDtBQVBELFdBQVksZ0JBQWdCO0lBQzFCLHVEQUFJLENBQUE7SUFDSixpRUFBUyxDQUFBO0lBQ1QseURBQUssQ0FBQTtJQUNMLHlEQUFLLENBQUE7SUFDTCxxRUFBVyxDQUFBO0lBQ1gsK0RBQVEsQ0FBQTtBQUNWLENBQUMsRUFQVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBTzNCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSwwQkFLWDtBQUxELFdBQVksMEJBQTBCO0lBQ3BDLDZFQUFLLENBQUE7SUFDTCwyRUFBSSxDQUFBO0lBQ0osMkVBQUksQ0FBQTtJQUNKLHlFQUFHLENBQUE7QUFDTCxDQUFDLEVBTFcsMEJBQTBCLEtBQTFCLDBCQUEwQixRQUtyQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIG9wZXJhdGlvbnMuXG4gKlxuICogSW5jbHVkZXMgYm90aCBjcmVhdGlvbiBhbmQgdXBkYXRlIG9wZXJhdGlvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIE9wS2luZCB7XG4gIC8qKlxuICAgKiBBIHNwZWNpYWwgb3BlcmF0aW9uIHR5cGUgd2hpY2ggaXMgdXNlZCB0byByZXByZXNlbnQgdGhlIGJlZ2lubmluZyBhbmQgZW5kIG5vZGVzIG9mIGEgbGlua2VkXG4gICAqIGxpc3Qgb2Ygb3BlcmF0aW9ucy5cbiAgICovXG4gIExpc3RFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCB3cmFwcyBhbiBvdXRwdXQgQVNUIHN0YXRlbWVudC5cbiAgICovXG4gIFN0YXRlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuZCBpbml0aWFsaXplcyBhIGBTZW1hbnRpY1ZhcmlhYmxlYC5cbiAgICovXG4gIFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBFbGVtZW50U3RhcnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYW4gZWxlbWVudCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgRWxlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuIGVtYmVkZGVkIHZpZXcuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGVuZCByZW5kZXJpbmcgb2YgYW4gZWxlbWVudCBwcmV2aW91c2x5IHN0YXJ0ZWQgd2l0aCBgRWxlbWVudFN0YXJ0YC5cbiAgICovXG4gIEVsZW1lbnRFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiZWdpbiBhbiBgbmctY29udGFpbmVyYC5cbiAgICovXG4gIENvbnRhaW5lclN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZm9yIGFuIGBuZy1jb250YWluZXJgIHdpdGggbm8gY2hpbGRyZW4uXG4gICAqL1xuICBDb250YWluZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBkaXNhYmxlIGJpbmRpbmcgZm9yIHN1YnNlcXVlbnQgZWxlbWVudHMsIHdoaWNoIGFyZSBkZXNjZW5kYW50cyBvZiBhIG5vbi1iaW5kYWJsZVxuICAgKiBub2RlLlxuICAgKi9cbiAgRGlzYWJsZUJpbmRpbmdzLFxuXG4gIC8qKlxuICAgKiBBbiBvcCB0byBjb25kaXRpb25hbGx5IHJlbmRlciBhIHRlbXBsYXRlLlxuICAgKi9cbiAgQ29uZGl0aW9uYWwsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZS1lbmFibGUgYmluZGluZywgYWZ0ZXIgaXQgd2FzIHByZXZpb3VzbHkgZGlzYWJsZWQuXG4gICAqL1xuICBFbmFibGVCaW5kaW5ncyxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIHJlbmRlciBhIHRleHQgbm9kZS5cbiAgICovXG4gIFRleHQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBkZWNsYXJpbmcgYW4gZXZlbnQgbGlzdGVuZXIgZm9yIGFuIGVsZW1lbnQuXG4gICAqL1xuICBMaXN0ZW5lcixcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGludGVycG9sYXRlIHRleHQgaW50byBhIHRleHQgbm9kZS5cbiAgICovXG4gIEludGVycG9sYXRlVGV4dCxcblxuICAvKipcbiAgICogQW4gaW50ZXJtZWRpYXRlIGJpbmRpbmcgb3AsIHRoYXQgaGFzIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWQgaW50byBhbiBpbmRpdmlkdWFsIHByb3BlcnR5LFxuICAgKiBhdHRyaWJ1dGUsIHN0eWxlLCBldGMuXG4gICAqL1xuICBCaW5kaW5nLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgc3R5bGUgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlUHJvcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIGNsYXNzIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc1Byb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gdGhlIHN0eWxlcyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgU3R5bGVNYXAsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gdGhlIGNsYXNzZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIENsYXNzTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYWR2YW5jZSB0aGUgcnVudGltZSdzIGltcGxpY2l0IHNsb3QgY29udGV4dCBkdXJpbmcgdGhlIHVwZGF0ZSBwaGFzZSBvZiBhIHZpZXcuXG4gICAqL1xuICBBZHZhbmNlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW5zdGFudGlhdGUgYSBwaXBlLlxuICAgKi9cbiAgUGlwZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFzc29jaWF0ZSBhbiBhdHRyaWJ1dGUgd2l0aCBhbiBlbGVtZW50LlxuICAgKi9cbiAgQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBBbiBhdHRyaWJ1dGUgdGhhdCBoYXMgYmVlbiBleHRyYWN0ZWQgZm9yIGluY2x1c2lvbiBpbiB0aGUgY29uc3RzIGFycmF5LlxuICAgKi9cbiAgRXh0cmFjdGVkQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdGhhdCBjb25maWd1cmVzIGEgYEBkZWZlcmAgYmxvY2suXG4gICAqL1xuICBEZWZlcixcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRoYXQgY29udHJvbHMgd2hlbiBhIGBAZGVmZXJgIGxvYWRzLlxuICAgKi9cbiAgRGVmZXJPbixcblxuICAvKipcbiAgICogQW4gaTE4biBtZXNzYWdlIHRoYXQgaGFzIGJlZW4gZXh0cmFjdGVkIGZvciBpbmNsdXNpb24gaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICovXG4gIEkxOG5NZXNzYWdlLFxuXG4gIC8qKlxuICAgKiBBIGhvc3QgYmluZGluZyBwcm9wZXJ0eS5cbiAgICovXG4gIEhvc3RQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQSBuYW1lc3BhY2UgY2hhbmdlLCB3aGljaCBjYXVzZXMgdGhlIHN1YnNlcXVlbnQgZWxlbWVudHMgdG8gYmUgcHJvY2Vzc2VkIGFzIGVpdGhlciBIVE1MIG9yIFNWRy5cbiAgICovXG4gIE5hbWVzcGFjZSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGEgY29udGVudCBwcm9qZWNpdG9uIGRlZmluaXRpb24gZm9yIHRoZSB2aWV3LlxuICAgKi9cbiAgUHJvamVjdGlvbkRlZixcblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gICAqL1xuICBQcm9qZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSByZXBlYXRlciBjcmVhdGlvbiBpbnN0cnVjdGlvbiBvcC5cbiAgICovXG4gIFJlcGVhdGVyQ3JlYXRlLFxuXG4gIC8qKlxuICAgKiBBbiB1cGRhdGUgdXAgZm9yIGEgcmVwZWF0ZXIuXG4gICAqL1xuICBSZXBlYXRlcixcblxuICAvKipcbiAgICogVGhlIHN0YXJ0IG9mIGFuIGkxOG4gYmxvY2suXG4gICAqL1xuICBJMThuU3RhcnQsXG5cbiAgLyoqXG4gICAqIEEgc2VsZi1jbG9zaW5nIGkxOG4gb24gYSBzaW5nbGUgZWxlbWVudC5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIFRoZSBlbmQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5FbmQsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gaW4gYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkV4cHJlc3Npb24sXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRoYXQgYXBwbGllcyBhIHNldCBvZiBpMThuIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgSTE4bkFwcGx5LFxuXG4gIC8qKlxuICAgKiBBbiBpbnN0cnVjdGlvbiB0byBjcmVhdGUgYW4gSUNVIGV4cHJlc3Npb24uXG4gICAqL1xuICBJY3UsXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRvIHVwZGF0ZSBhbiBJQ1UgZXhwcmVzc2lvbi5cbiAgICovXG4gIEljdVVwZGF0ZSxcblxuICAvKipcbiAgICogQW4gaTE4biBjb250ZXh0IGNvbnRhaW5pbmcgaW5mb3JtYXRpb24gbmVlZGVkIHRvIGdlbmVyYXRlIGFuIGkxOG4gbWVzc2FnZS5cbiAgICovXG4gIEkxOG5Db250ZXh0LFxufVxuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZW51bSBFeHByZXNzaW9uS2luZCB7XG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgaW4gYSBsZXhpY2FsIHNjb3BlLlxuICAgKi9cbiAgTGV4aWNhbFJlYWQsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSB2aWV3IGNvbnRleHQsIGZvciB1c2UgaW5zaWRlIGEgdHJhY2sgZnVuY3Rpb24uXG4gICAqL1xuICBUcmFja0NvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBkZWNsYXJlZCBpbiBhIGBWYXJpYWJsZU9wYC5cbiAgICovXG4gIFJlYWRWYXJpYWJsZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gbmF2aWdhdGUgdG8gdGhlIG5leHQgdmlldyBjb250ZXh0IGluIHRoZSB2aWV3IGhpZXJhcmNoeS5cbiAgICovXG4gIE5leHRDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXRyaWV2ZSB0aGUgdmFsdWUgb2YgYSBsb2NhbCByZWZlcmVuY2UuXG4gICAqL1xuICBSZWZlcmVuY2UsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHNuYXBzaG90IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIEdldEN1cnJlbnRWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXN0b3JlIGEgc25hcHNob3R0ZWQgdmlldy5cbiAgICovXG4gIFJlc3RvcmVWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXNldCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgYWZ0ZXIgYFJlc3RvcmVWaWV3YC5cbiAgICovXG4gIFJlc2V0VmlldyxcblxuICAvKipcbiAgICogRGVmaW5lcyBhbmQgY2FsbHMgYSBmdW5jdGlvbiB3aXRoIGNoYW5nZS1kZXRlY3RlZCBhcmd1bWVudHMuXG4gICAqL1xuICBQdXJlRnVuY3Rpb25FeHByLFxuXG4gIC8qKlxuICAgKiBJbmRpY2F0ZXMgYSBwb3NpdGlvbmFsIHBhcmFtZXRlciB0byBhIHB1cmUgZnVuY3Rpb24gZGVmaW5pdGlvbi5cbiAgICovXG4gIFB1cmVGdW5jdGlvblBhcmFtZXRlckV4cHIsXG5cbiAgLyoqXG4gICAqIEJpbmRpbmcgdG8gYSBwaXBlIHRyYW5zZm9ybWF0aW9uLlxuICAgKi9cbiAgUGlwZUJpbmRpbmcsXG5cbiAgLyoqXG4gICAqIEJpbmRpbmcgdG8gYSBwaXBlIHRyYW5zZm9ybWF0aW9uIHdpdGggYSB2YXJpYWJsZSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKi9cbiAgUGlwZUJpbmRpbmdWYXJpYWRpYyxcblxuICAvKlxuICAgKiBBIHNhZmUgcHJvcGVydHkgcmVhZCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZVByb3BlcnR5UmVhZCxcblxuICAvKipcbiAgICogQSBzYWZlIGtleWVkIHJlYWQgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVLZXllZFJlYWQsXG5cbiAgLyoqXG4gICAqIEEgc2FmZSBmdW5jdGlvbiBjYWxsIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlSW52b2tlRnVuY3Rpb24sXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBleHBhbmRlZCBmcm9tIGEgc2FmZSByZWFkIGludG8gYW4gZXhwbGljaXQgdGVybmFyeS5cbiAgICovXG4gIFNhZmVUZXJuYXJ5RXhwcixcblxuICAvKipcbiAgICogQW4gZW1wdHkgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgc3RpcHBlZCBiZWZvcmUgZ2VuZXJhdGluZyB0aGUgZmluYWwgb3V0cHV0LlxuICAgKi9cbiAgRW1wdHlFeHByLFxuXG4gIC8qXG4gICAqIEFuIGFzc2lnbm1lbnQgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBBc3NpZ25UZW1wb3JhcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIFJlYWRUZW1wb3JhcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHJlcHJlc2VudGluZyBhIHNhbml0aXplciBmdW5jdGlvbi5cbiAgICovXG4gIFNhbml0aXplckV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gdGhhdCB3aWxsIGNhdXNlIGEgbGl0ZXJhbCBzbG90IGluZGV4IHRvIGJlIGVtaXR0ZWQuXG4gICAqL1xuICBTbG90TGl0ZXJhbEV4cHIsXG5cbiAgLyoqXG4gICAqIEEgdGVzdCBleHByZXNzaW9uIGZvciBhIGNvbmRpdGlvbmFsIG9wLlxuICAgKi9cbiAgQ29uZGl0aW9uYWxDYXNlLFxuXG4gIC8qKlxuICAgKiBBIHZhcmlhYmxlIGZvciB1c2UgaW5zaWRlIGEgcmVwZWF0ZXIsIHByb3ZpZGluZyBvbmUgb2YgdGhlIGFtYmllbnRseS1hdmFpbGFibGUgY29udGV4dFxuICAgKiBwcm9wZXJ0aWVzICgkZXZlbiwgJGZpcnN0LCBldGMuKS5cbiAgICovXG4gIERlcml2ZWRSZXBlYXRlclZhcixcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgYXV0b21hdGljYWxseSBleHRyYWN0ZWQgdG8gdGhlIGNvbXBvbmVudCBjb25zdCBhcnJheS5cbiAgICovXG4gIENvbnN0Q29sbGVjdGVkLFxufVxuXG5leHBvcnQgZW51bSBWYXJpYWJsZUZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwMCxcblxuICAvKipcbiAgICogQWx3YXlzIGlubGluZSB0aGlzIHZhcmlhYmxlLCByZWdhcmRsZXNzIG9mIHRoZSBudW1iZXIgb2YgdGltZXMgaXQncyB1c2VkLlxuICAgKiBBbiBgQWx3YXlzSW5saW5lYCB2YXJpYWJsZSBtYXkgbm90IGRlcGVuZCBvbiBjb250ZXh0LCBiZWNhdXNlIGRvaW5nIHNvIG1heSBjYXVzZSBzaWRlIGVmZmVjdHNcbiAgICogdGhhdCBhcmUgaWxsZWdhbCB3aGVuIG11bHRpLWlubGluZWQuIChUaGUgb3B0aW1pemVyIHdpbGwgZW5mb3JjZSB0aGlzIGNvbnN0cmFpbnQuKVxuICAgKi9cbiAgQWx3YXlzSW5saW5lID0gMGIwMDAxLFxufVxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGJldHdlZW4gZGlmZmVyZW50IGtpbmRzIG9mIGBTZW1hbnRpY1ZhcmlhYmxlYHMuXG4gKi9cbmV4cG9ydCBlbnVtIFNlbWFudGljVmFyaWFibGVLaW5kIHtcbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGNvbnRleHQgb2YgYSBwYXJ0aWN1bGFyIHZpZXcuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGlkZW50aWZpZXIgZGVjbGFyZWQgaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgYSB2aWV3LlxuICAgKi9cbiAgSWRlbnRpZmllcixcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHNhdmVkIHN0YXRlIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzdG9yZSBhIHZpZXcgaW4gYSBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2F2ZWRWaWV3LFxuXG4gIC8qKlxuICAgKiBBbiBhbGlhcyBnZW5lcmF0ZWQgYnkgYSBzcGVjaWFsIGVtYmVkZGVkIHZpZXcgdHlwZSAoZS5nLiBhIGBAZm9yYCBibG9jaykuXG4gICAqL1xuICBBbGlhcyxcbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRvIGNvbXBpbGUgaW4gY29tcGF0aWJpbHR5IG1vZGUuIEluIGNvbXBhdGliaWxpdHkgbW9kZSwgdGhlIHRlbXBsYXRlIHBpcGVsaW5lIHdpbGxcbiAqIGF0dGVtcHQgdG8gbWF0Y2ggdGhlIG91dHB1dCBvZiBgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcmAgYXMgZXhhY3RseSBhcyBwb3NzaWJsZSwgYXQgdGhlIGNvc3RcbiAqIG9mIHByb2R1Y2luZyBxdWlya3kgb3IgbGFyZ2VyIGNvZGUgaW4gc29tZSBjYXNlcy5cbiAqL1xuZXhwb3J0IGVudW0gQ29tcGF0aWJpbGl0eU1vZGUge1xuICBOb3JtYWwsXG4gIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIsXG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBmdW5jdGlvbnMgdXNlZCB0byBzYW5pdGl6ZSBkaWZmZXJlbnQgcGllY2VzIG9mIGEgdGVtcGxhdGUuXG4gKi9cbmV4cG9ydCBlbnVtIFNhbml0aXplckZuIHtcbiAgSHRtbCxcbiAgU2NyaXB0LFxuICBTdHlsZSxcbiAgVXJsLFxuICBSZXNvdXJjZVVybCxcbiAgSWZyYW1lQXR0cmlidXRlLFxufVxuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHRoZSBkaWZmZXJlbnQga2luZHMgb2YgYEBkZWZlcmAgc2Vjb25kYXJ5IGJsb2Nrcy5cbiAqL1xuZXhwb3J0IGVudW0gRGVmZXJTZWNvbmRhcnlLaW5kIHtcbiAgTG9hZGluZyxcbiAgUGxhY2Vob2xkZXIsXG4gIEVycm9yLFxufVxuXG4vKipcbiAqIEVudW1lcmF0aW9uIG9mIHRoZSB0eXBlcyBvZiBhdHRyaWJ1dGVzIHdoaWNoIGNhbiBiZSBhcHBsaWVkIHRvIGFuIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBlbnVtIEJpbmRpbmdLaW5kIHtcbiAgLyoqXG4gICAqIFN0YXRpYyBhdHRyaWJ1dGVzLlxuICAgKi9cbiAgQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBDbGFzcyBiaW5kaW5ncy5cbiAgICovXG4gIENsYXNzTmFtZSxcblxuICAvKipcbiAgICogU3R5bGUgYmluZGluZ3MuXG4gICAqL1xuICBTdHlsZVByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBEeW5hbWljIHByb3BlcnR5IGJpbmRpbmdzLlxuICAgKi9cbiAgUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIFByb3BlcnR5IG9yIGF0dHJpYnV0ZSBiaW5kaW5ncyBvbiBhIHRlbXBsYXRlLlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEludGVybmF0aW9uYWxpemVkIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBJMThuLFxuXG4gIC8qKlxuICAgKiBBbmltYXRpb24gcHJvcGVydHkgYmluZGluZ3MuXG4gICAqL1xuICBBbmltYXRpb24sXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgcG9zc2libGUgdGltZXMgaTE4biBwYXJhbXMgY2FuIGJlIHJlc29sdmVkLlxuICovXG5leHBvcnQgZW51bSBJMThuUGFyYW1SZXNvbHV0aW9uVGltZSB7XG4gIC8qKlxuICAgKiBQYXJhbSBpcyByZXNvbHZlZCBhdCBtZXNzYWdlIGNyZWF0aW9uIHRpbWUuIE1vc3QgcGFyYW1zIHNob3VsZCBiZSByZXNvbHZlZCBhdCBtZXNzYWdlIGNyZWF0aW9uXG4gICAqIHRpbWUuIEhvd2V2ZXIsIElDVSBwYXJhbXMgbmVlZCB0byBiZSBoYW5kbGVkIGluIHBvc3QtcHJvY2Vzc2luZy5cbiAgICovXG4gIENyZWF0aW9uLFxuXG4gIC8qKlxuICAgKiBQYXJhbSBpcyByZXNvbHZlZCBkdXJpbmcgcG9zdC1wcm9jZXNzaW5nLiBUaGlzIHNob3VsZCBiZSB1c2VkIGZvciBwYXJhbXMgd2hvJ3MgdmFsdWUgY29tZXMgZnJvbVxuICAgKiBhbiBJQ1UuXG4gICAqL1xuICBQb3N0cHJvY2Nlc3Npbmdcbn1cblxuLyoqXG4gKiBGbGFncyB0aGF0IGRlc2NyaWJlIHdoYXQgYW4gaTE4biBwYXJhbSB2YWx1ZS4gVGhlc2UgZGV0ZXJtaW5lIGhvdyB0aGUgdmFsdWUgaXMgc2VyaWFsaXplZCBpbnRvXG4gKiB0aGUgZmluYWwgbWFwLlxuICovXG5leHBvcnQgZW51bSBJMThuUGFyYW1WYWx1ZUZsYWdzIHtcbiAgTm9uZSA9IDBiMDAwMCxcblxuICAvKipcbiAgICogIFRoaXMgdmFsdWUgcmVwcmVzdGVudHMgYW4gZWxlbWVudCB0YWcuXG4gICAqL1xuICBFbGVtZW50VGFnID0gMGIwMDEsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyBhIHRlbXBsYXRlIHRhZy5cbiAgICovXG4gIFRlbXBsYXRlVGFnID0gMGIwMDEwLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgdGhlIG9wZW5pbmcgb2YgYSB0YWcuXG4gICAqL1xuICBPcGVuVGFnID0gMGIwMTAwLFxuXG4gIC8qKlxuICAgKiBUaGlzIHZhbHVlIHJlcHJlc2VudHMgdGhlIGNsb3Npbmcgb2YgYSB0YWcuXG4gICAqL1xuICBDbG9zZVRhZyA9IDBiMTAwMCxcbn1cblxuLyoqXG4gKiBXaGV0aGVyIHRoZSBhY3RpdmUgbmFtZXNwYWNlIGlzIEhUTUwsIE1hdGhNTCwgb3IgU1ZHIG1vZGUuXG4gKi9cbmV4cG9ydCBlbnVtIE5hbWVzcGFjZSB7XG4gIEhUTUwsXG4gIFNWRyxcbiAgTWF0aCxcbn1cblxuLyoqXG4gKiBUaGUgdHlwZSBvZiBhIGBAZGVmZXJgIHRyaWdnZXIsIGZvciB1c2UgaW4gdGhlIGlyLlxuICovXG5leHBvcnQgZW51bSBEZWZlclRyaWdnZXJLaW5kIHtcbiAgSWRsZSxcbiAgSW1tZWRpYXRlLFxuICBUaW1lcixcbiAgSG92ZXIsXG4gIEludGVyYWN0aW9uLFxuICBWaWV3cG9ydCxcbn1cblxuLyoqXG4gKiBSZXBlYXRlcnMgaW1wbGljaXRseSBkZWZpbmUgdGhlc2UgZGVyaXZlZCB2YXJpYWJsZXMsIGFuZCBjaGlsZCBub2RlcyBtYXkgcmVhZCB0aGVtLlxuICovXG5leHBvcnQgZW51bSBEZXJpdmVkUmVwZWF0ZXJWYXJJZGVudGl0eSB7XG4gIEZpcnN0LFxuICBMYXN0LFxuICBFdmVuLFxuICBPZGQsXG59XG4iXX0=