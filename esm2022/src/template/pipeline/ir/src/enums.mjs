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
    OpKind[OpKind["IcuStart"] = 41] = "IcuStart";
    /**
     * An instruction to update an ICU expression.
     */
    OpKind[OpKind["IcuEnd"] = 42] = "IcuEnd";
    /**
     * An i18n context containing information needed to generate an i18n message.
     */
    OpKind[OpKind["I18nContext"] = 43] = "I18nContext";
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
 * Repeaters implicitly define these derived variables, and child nodes may read them.
 */
export var DerivedRepeaterVarIdentity;
(function (DerivedRepeaterVarIdentity) {
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["First"] = 0] = "First";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Last"] = 1] = "Last";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Even"] = 2] = "Even";
    DerivedRepeaterVarIdentity[DerivedRepeaterVarIdentity["Odd"] = 3] = "Odd";
})(DerivedRepeaterVarIdentity || (DerivedRepeaterVarIdentity = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQStOWDtBQS9ORCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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Q0gsMkVBQWtCLENBQUE7SUFFbEI7O09BRUc7SUFDSCxtRUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILHFFQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsb0ZBQXlCLENBQUE7QUFDM0IsQ0FBQyxFQTNCVyxtQkFBbUIsS0FBbkIsbUJBQW1CLFFBMkI5QjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksU0FJWDtBQUpELFdBQVksU0FBUztJQUNuQix5Q0FBSSxDQUFBO0lBQ0osdUNBQUcsQ0FBQTtJQUNILHlDQUFJLENBQUE7QUFDTixDQUFDLEVBSlcsU0FBUyxLQUFULFNBQVMsUUFJcEI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGdCQU9YO0FBUEQsV0FBWSxnQkFBZ0I7SUFDMUIsdURBQUksQ0FBQTtJQUNKLGlFQUFTLENBQUE7SUFDVCx5REFBSyxDQUFBO0lBQ0wseURBQUssQ0FBQTtJQUNMLHFFQUFXLENBQUE7SUFDWCwrREFBUSxDQUFBO0FBQ1YsQ0FBQyxFQVBXLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFPM0I7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLDBCQUtYO0FBTEQsV0FBWSwwQkFBMEI7SUFDcEMsNkVBQUssQ0FBQTtJQUNMLDJFQUFJLENBQUE7SUFDSiwyRUFBSSxDQUFBO0lBQ0oseUVBQUcsQ0FBQTtBQUNMLENBQUMsRUFMVywwQkFBMEIsS0FBMUIsMEJBQTBCLFFBS3JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgb3BlcmF0aW9ucy5cbiAqXG4gKiBJbmNsdWRlcyBib3RoIGNyZWF0aW9uIGFuZCB1cGRhdGUgb3BlcmF0aW9ucy5cbiAqL1xuZXhwb3J0IGVudW0gT3BLaW5kIHtcbiAgLyoqXG4gICAqIEEgc3BlY2lhbCBvcGVyYXRpb24gdHlwZSB3aGljaCBpcyB1c2VkIHRvIHJlcHJlc2VudCB0aGUgYmVnaW5uaW5nIGFuZCBlbmQgbm9kZXMgb2YgYSBsaW5rZWRcbiAgICogbGlzdCBvZiBvcGVyYXRpb25zLlxuICAgKi9cbiAgTGlzdEVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIHdyYXBzIGFuIG91dHB1dCBBU1Qgc3RhdGVtZW50LlxuICAgKi9cbiAgU3RhdGVtZW50LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggZGVjbGFyZXMgYW5kIGluaXRpYWxpemVzIGEgYFNlbWFudGljVmFyaWFibGVgLlxuICAgKi9cbiAgVmFyaWFibGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiZWdpbiByZW5kZXJpbmcgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIEVsZW1lbnRTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIHJlbmRlciBhbiBlbGVtZW50IHdpdGggbm8gY2hpbGRyZW4uXG4gICAqL1xuICBFbGVtZW50LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggZGVjbGFyZXMgYW4gZW1iZWRkZWQgdmlldy5cbiAgICovXG4gIFRlbXBsYXRlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50IHByZXZpb3VzbHkgc3RhcnRlZCB3aXRoIGBFbGVtZW50U3RhcnRgLlxuICAgKi9cbiAgRWxlbWVudEVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyU3RhcnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBmb3IgYW4gYG5nLWNvbnRhaW5lcmAgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIENvbnRhaW5lcixcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGVuZCBhbiBgbmctY29udGFpbmVyYC5cbiAgICovXG4gIENvbnRhaW5lckVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRpc2FibGUgYmluZGluZyBmb3Igc3Vic2VxdWVudCBlbGVtZW50cywgd2hpY2ggYXJlIGRlc2NlbmRhbnRzIG9mIGEgbm9uLWJpbmRhYmxlXG4gICAqIG5vZGUuXG4gICAqL1xuICBEaXNhYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wIHRvIGNvbmRpdGlvbmFsbHkgcmVuZGVyIGEgdGVtcGxhdGUuXG4gICAqL1xuICBDb25kaXRpb25hbCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIHJlLWVuYWJsZSBiaW5kaW5nLCBhZnRlciBpdCB3YXMgcHJldmlvdXNseSBkaXNhYmxlZC5cbiAgICovXG4gIEVuYWJsZUJpbmRpbmdzLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgVGV4dCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRlY2xhcmluZyBhbiBldmVudCBsaXN0ZW5lciBmb3IgYW4gZWxlbWVudC5cbiAgICovXG4gIExpc3RlbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBpbnRlcm1lZGlhdGUgYmluZGluZyBvcCwgdGhhdCBoYXMgbm90IHlldCBiZWVuIHByb2Nlc3NlZCBpbnRvIGFuIGluZGl2aWR1YWwgcHJvcGVydHksXG4gICAqIGF0dHJpYnV0ZSwgc3R5bGUsIGV0Yy5cbiAgICovXG4gIEJpbmRpbmcsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBzdHlsZSBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgU3R5bGVQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgY2xhc3MgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIENsYXNzUHJvcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byB0aGUgc3R5bGVzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZU1hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byB0aGUgY2xhc3NlcyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NNYXAsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhZHZhbmNlIHRoZSBydW50aW1lJ3MgaW1wbGljaXQgc2xvdCBjb250ZXh0IGR1cmluZyB0aGUgdXBkYXRlIHBoYXNlIG9mIGEgdmlldy5cbiAgICovXG4gIEFkdmFuY2UsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnN0YW50aWF0ZSBhIHBpcGUuXG4gICAqL1xuICBQaXBlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYXNzb2NpYXRlIGFuIGF0dHJpYnV0ZSB3aXRoIGFuIGVsZW1lbnQuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIEFuIGF0dHJpYnV0ZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAqL1xuICBFeHRyYWN0ZWRBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0aGF0IGNvbmZpZ3VyZXMgYSBgQGRlZmVyYCBibG9jay5cbiAgICovXG4gIERlZmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdGhhdCBjb250cm9scyB3aGVuIGEgYEBkZWZlcmAgbG9hZHMuXG4gICAqL1xuICBEZWZlck9uLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdGhhdCBjb250cm9scyB3aGVuIGEgYEBkZWZlcmAgbG9hZHMsIHVzaW5nIGEgY3VzdG9tIGV4cHJlc3Npb24gYXMgdGhlIGNvbmRpdGlvbi5cbiAgICovXG4gIERlZmVyV2hlbixcblxuICAvKipcbiAgICogQW4gaTE4biBtZXNzYWdlIHRoYXQgaGFzIGJlZW4gZXh0cmFjdGVkIGZvciBpbmNsdXNpb24gaW4gdGhlIGNvbnN0cyBhcnJheS5cbiAgICovXG4gIEkxOG5NZXNzYWdlLFxuXG4gIC8qKlxuICAgKiBBIGhvc3QgYmluZGluZyBwcm9wZXJ0eS5cbiAgICovXG4gIEhvc3RQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQSBuYW1lc3BhY2UgY2hhbmdlLCB3aGljaCBjYXVzZXMgdGhlIHN1YnNlcXVlbnQgZWxlbWVudHMgdG8gYmUgcHJvY2Vzc2VkIGFzIGVpdGhlciBIVE1MIG9yIFNWRy5cbiAgICovXG4gIE5hbWVzcGFjZSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGEgY29udGVudCBwcm9qZWNpdG9uIGRlZmluaXRpb24gZm9yIHRoZSB2aWV3LlxuICAgKi9cbiAgUHJvamVjdGlvbkRlZixcblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gICAqL1xuICBQcm9qZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSByZXBlYXRlciBjcmVhdGlvbiBpbnN0cnVjdGlvbiBvcC5cbiAgICovXG4gIFJlcGVhdGVyQ3JlYXRlLFxuXG4gIC8qKlxuICAgKiBBbiB1cGRhdGUgdXAgZm9yIGEgcmVwZWF0ZXIuXG4gICAqL1xuICBSZXBlYXRlcixcblxuICAvKipcbiAgICogVGhlIHN0YXJ0IG9mIGFuIGkxOG4gYmxvY2suXG4gICAqL1xuICBJMThuU3RhcnQsXG5cbiAgLyoqXG4gICAqIEEgc2VsZi1jbG9zaW5nIGkxOG4gb24gYSBzaW5nbGUgZWxlbWVudC5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIFRoZSBlbmQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5FbmQsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gaW4gYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkV4cHJlc3Npb24sXG5cbiAgLyoqXG4gICAqIEFuIGluc3RydWN0aW9uIHRoYXQgYXBwbGllcyBhIHNldCBvZiBpMThuIGV4cHJlc3Npb25zLlxuICAgKi9cbiAgSTE4bkFwcGx5LFxuXG4gIC8qKlxuICAgKiBBbiBpbnN0cnVjdGlvbiB0byBjcmVhdGUgYW4gSUNVIGV4cHJlc3Npb24uXG4gICAqL1xuICBJY3VTdGFydCxcblxuICAvKipcbiAgICogQW4gaW5zdHJ1Y3Rpb24gdG8gdXBkYXRlIGFuIElDVSBleHByZXNzaW9uLlxuICAgKi9cbiAgSWN1RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBpMThuIGNvbnRleHQgY29udGFpbmluZyBpbmZvcm1hdGlvbiBuZWVkZWQgdG8gZ2VuZXJhdGUgYW4gaTE4biBtZXNzYWdlLlxuICAgKi9cbiAgSTE4bkNvbnRleHQsXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIEV4cHJlc3Npb25LaW5kIHtcbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBpbiBhIGxleGljYWwgc2NvcGUuXG4gICAqL1xuICBMZXhpY2FsUmVhZCxcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIHZpZXcgY29udGV4dCwgZm9yIHVzZSBpbnNpZGUgYSB0cmFjayBmdW5jdGlvbi5cbiAgICovXG4gIFRyYWNrQ29udGV4dCxcblxuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGRlY2xhcmVkIGluIGEgYFZhcmlhYmxlT3BgLlxuICAgKi9cbiAgUmVhZFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICAgKi9cbiAgTmV4dENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAgICovXG4gIFJlZmVyZW5jZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gc25hcHNob3QgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgR2V0Q3VycmVudFZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICAgKi9cbiAgUmVzdG9yZVZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICAgKi9cbiAgUmVzZXRWaWV3LFxuXG4gIC8qKlxuICAgKiBEZWZpbmVzIGFuZCBjYWxscyBhIGZ1bmN0aW9uIHdpdGggY2hhbmdlLWRldGVjdGVkIGFyZ3VtZW50cy5cbiAgICovXG4gIFB1cmVGdW5jdGlvbkV4cHIsXG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyBhIHBvc2l0aW9uYWwgcGFyYW1ldGVyIHRvIGEgcHVyZSBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcixcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24uXG4gICAqL1xuICBQaXBlQmluZGluZyxcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24gd2l0aCBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqL1xuICBQaXBlQmluZGluZ1ZhcmlhZGljLFxuXG4gIC8qXG4gICAqIEEgc2FmZSBwcm9wZXJ0eSByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlUHJvcGVydHlSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUga2V5ZWQgcmVhZCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUtleWVkUmVhZCxcblxuICAvKipcbiAgICogQSBzYWZlIGZ1bmN0aW9uIGNhbGwgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVJbnZva2VGdW5jdGlvbixcblxuICAvKipcbiAgICogQW4gaW50ZXJtZWRpYXRlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIGV4cGFuZGVkIGZyb20gYSBzYWZlIHJlYWQgaW50byBhbiBleHBsaWNpdCB0ZXJuYXJ5LlxuICAgKi9cbiAgU2FmZVRlcm5hcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBlbXB0eSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBzdGlwcGVkIGJlZm9yZSBnZW5lcmF0aW5nIHRoZSBmaW5hbCBvdXRwdXQuXG4gICAqL1xuICBFbXB0eUV4cHIsXG5cbiAgLypcbiAgICogQW4gYXNzaWdubWVudCB0byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIEFzc2lnblRlbXBvcmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgUmVhZFRlbXBvcmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGV4cHJlc3Npb24gcmVwcmVzZW50aW5nIGEgc2FuaXRpemVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2FuaXRpemVyRXhwcixcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiB0aGF0IHdpbGwgY2F1c2UgYSBsaXRlcmFsIHNsb3QgaW5kZXggdG8gYmUgZW1pdHRlZC5cbiAgICovXG4gIFNsb3RMaXRlcmFsRXhwcixcblxuICAvKipcbiAgICogQSB0ZXN0IGV4cHJlc3Npb24gZm9yIGEgY29uZGl0aW9uYWwgb3AuXG4gICAqL1xuICBDb25kaXRpb25hbENhc2UsXG5cbiAgLyoqXG4gICAqIEEgdmFyaWFibGUgZm9yIHVzZSBpbnNpZGUgYSByZXBlYXRlciwgcHJvdmlkaW5nIG9uZSBvZiB0aGUgYW1iaWVudGx5LWF2YWlsYWJsZSBjb250ZXh0XG4gICAqIHByb3BlcnRpZXMgKCRldmVuLCAkZmlyc3QsIGV0Yy4pLlxuICAgKi9cbiAgRGVyaXZlZFJlcGVhdGVyVmFyLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGV4dHJhY3RlZCB0byB0aGUgY29tcG9uZW50IGNvbnN0IGFycmF5LlxuICAgKi9cbiAgQ29uc3RDb2xsZWN0ZWQsXG59XG5cbmV4cG9ydCBlbnVtIFZhcmlhYmxlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiBBbHdheXMgaW5saW5lIHRoaXMgdmFyaWFibGUsIHJlZ2FyZGxlc3Mgb2YgdGhlIG51bWJlciBvZiB0aW1lcyBpdCdzIHVzZWQuXG4gICAqIEFuIGBBbHdheXNJbmxpbmVgIHZhcmlhYmxlIG1heSBub3QgZGVwZW5kIG9uIGNvbnRleHQsIGJlY2F1c2UgZG9pbmcgc28gbWF5IGNhdXNlIHNpZGUgZWZmZWN0c1xuICAgKiB0aGF0IGFyZSBpbGxlZ2FsIHdoZW4gbXVsdGktaW5saW5lZC4gKFRoZSBvcHRpbWl6ZXIgd2lsbCBlbmZvcmNlIHRoaXMgY29uc3RyYWludC4pXG4gICAqL1xuICBBbHdheXNJbmxpbmUgPSAwYjAwMDEsXG59XG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgYmV0d2VlbiBkaWZmZXJlbnQga2luZHMgb2YgYFNlbWFudGljVmFyaWFibGVgcy5cbiAqL1xuZXhwb3J0IGVudW0gU2VtYW50aWNWYXJpYWJsZUtpbmQge1xuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgY29udGV4dCBvZiBhIHBhcnRpY3VsYXIgdmlldy5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYW4gaWRlbnRpZmllciBkZWNsYXJlZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiBhIHZpZXcuXG4gICAqL1xuICBJZGVudGlmaWVyLFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgc2F2ZWQgc3RhdGUgdGhhdCBjYW4gYmUgdXNlZCB0byByZXN0b3JlIGEgdmlldyBpbiBhIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYXZlZFZpZXcsXG5cbiAgLyoqXG4gICAqIEFuIGFsaWFzIGdlbmVyYXRlZCBieSBhIHNwZWNpYWwgZW1iZWRkZWQgdmlldyB0eXBlIChlLmcuIGEgYEBmb3JgIGJsb2NrKS5cbiAgICovXG4gIEFsaWFzLFxufVxuXG4vKipcbiAqIFdoZXRoZXIgdG8gY29tcGlsZSBpbiBjb21wYXRpYmlsdHkgbW9kZS4gSW4gY29tcGF0aWJpbGl0eSBtb2RlLCB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgd2lsbFxuICogYXR0ZW1wdCB0byBtYXRjaCB0aGUgb3V0cHV0IG9mIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCBhcyBleGFjdGx5IGFzIHBvc3NpYmxlLCBhdCB0aGUgY29zdFxuICogb2YgcHJvZHVjaW5nIHF1aXJreSBvciBsYXJnZXIgY29kZSBpbiBzb21lIGNhc2VzLlxuICovXG5leHBvcnQgZW51bSBDb21wYXRpYmlsaXR5TW9kZSB7XG4gIE5vcm1hbCxcbiAgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcixcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGZ1bmN0aW9ucyB1c2VkIHRvIHNhbml0aXplIGRpZmZlcmVudCBwaWVjZXMgb2YgYSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGVudW0gU2FuaXRpemVyRm4ge1xuICBIdG1sLFxuICBTY3JpcHQsXG4gIFN0eWxlLFxuICBVcmwsXG4gIFJlc291cmNlVXJsLFxuICBJZnJhbWVBdHRyaWJ1dGUsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIGRpZmZlcmVudCBraW5kcyBvZiBgQGRlZmVyYCBzZWNvbmRhcnkgYmxvY2tzLlxuICovXG5leHBvcnQgZW51bSBEZWZlclNlY29uZGFyeUtpbmQge1xuICBMb2FkaW5nLFxuICBQbGFjZWhvbGRlcixcbiAgRXJyb3IsXG59XG5cbi8qKlxuICogRW51bWVyYXRpb24gb2YgdGhlIHR5cGVzIG9mIGF0dHJpYnV0ZXMgd2hpY2ggY2FuIGJlIGFwcGxpZWQgdG8gYW4gZWxlbWVudC5cbiAqL1xuZXhwb3J0IGVudW0gQmluZGluZ0tpbmQge1xuICAvKipcbiAgICogU3RhdGljIGF0dHJpYnV0ZXMuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIENsYXNzIGJpbmRpbmdzLlxuICAgKi9cbiAgQ2xhc3NOYW1lLFxuXG4gIC8qKlxuICAgKiBTdHlsZSBiaW5kaW5ncy5cbiAgICovXG4gIFN0eWxlUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIER5bmFtaWMgcHJvcGVydHkgYmluZGluZ3MuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogUHJvcGVydHkgb3IgYXR0cmlidXRlIGJpbmRpbmdzIG9uIGEgdGVtcGxhdGUuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogSW50ZXJuYXRpb25hbGl6ZWQgYXR0cmlidXRlcy5cbiAgICovXG4gIEkxOG4sXG5cbiAgLyoqXG4gICAqIEFuaW1hdGlvbiBwcm9wZXJ0eSBiaW5kaW5ncy5cbiAgICovXG4gIEFuaW1hdGlvbixcbn1cblxuLyoqXG4gKiBFbnVtZXJhdGlvbiBvZiBwb3NzaWJsZSB0aW1lcyBpMThuIHBhcmFtcyBjYW4gYmUgcmVzb2x2ZWQuXG4gKi9cbmV4cG9ydCBlbnVtIEkxOG5QYXJhbVJlc29sdXRpb25UaW1lIHtcbiAgLyoqXG4gICAqIFBhcmFtIGlzIHJlc29sdmVkIGF0IG1lc3NhZ2UgY3JlYXRpb24gdGltZS4gTW9zdCBwYXJhbXMgc2hvdWxkIGJlIHJlc29sdmVkIGF0IG1lc3NhZ2UgY3JlYXRpb25cbiAgICogdGltZS4gSG93ZXZlciwgSUNVIHBhcmFtcyBuZWVkIHRvIGJlIGhhbmRsZWQgaW4gcG9zdC1wcm9jZXNzaW5nLlxuICAgKi9cbiAgQ3JlYXRpb24sXG5cbiAgLyoqXG4gICAqIFBhcmFtIGlzIHJlc29sdmVkIGR1cmluZyBwb3N0LXByb2Nlc3NpbmcuIFRoaXMgc2hvdWxkIGJlIHVzZWQgZm9yIHBhcmFtcyB3aG8ncyB2YWx1ZSBjb21lcyBmcm9tXG4gICAqIGFuIElDVS5cbiAgICovXG4gIFBvc3Rwcm9jY2Vzc2luZ1xufVxuXG4vKipcbiAqIEZsYWdzIHRoYXQgZGVzY3JpYmUgd2hhdCBhbiBpMThuIHBhcmFtIHZhbHVlLiBUaGVzZSBkZXRlcm1pbmUgaG93IHRoZSB2YWx1ZSBpcyBzZXJpYWxpemVkIGludG9cbiAqIHRoZSBmaW5hbCBtYXAuXG4gKi9cbmV4cG9ydCBlbnVtIEkxOG5QYXJhbVZhbHVlRmxhZ3Mge1xuICBOb25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiAgVGhpcyB2YWx1ZSByZXByZXN0ZW50cyBhbiBlbGVtZW50IHRhZy5cbiAgICovXG4gIEVsZW1lbnRUYWcgPSAwYjEsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyBhIHRlbXBsYXRlIHRhZy5cbiAgICovXG4gIFRlbXBsYXRlVGFnID0gMGIxMCxcblxuICAvKipcbiAgICogVGhpcyB2YWx1ZSByZXByZXNlbnRzIHRoZSBvcGVuaW5nIG9mIGEgdGFnLlxuICAgKi9cbiAgT3BlblRhZyA9IDBiMDEwMCxcblxuICAvKipcbiAgICogVGhpcyB2YWx1ZSByZXByZXNlbnRzIHRoZSBjbG9zaW5nIG9mIGEgdGFnLlxuICAgKi9cbiAgQ2xvc2VUYWcgPSAwYjEwMDAsXG5cbiAgLyoqXG4gICAqIFRoaXMgdmFsdWUgcmVwcmVzZW50cyBhbiBpMThuIGV4cHJlc3Npb24gaW5kZXguXG4gICAqL1xuICBFeHByZXNzaW9uSW5kZXggPSAwYjEwMDAwXG59XG5cbi8qKlxuICogV2hldGhlciB0aGUgYWN0aXZlIG5hbWVzcGFjZSBpcyBIVE1MLCBNYXRoTUwsIG9yIFNWRyBtb2RlLlxuICovXG5leHBvcnQgZW51bSBOYW1lc3BhY2Uge1xuICBIVE1MLFxuICBTVkcsXG4gIE1hdGgsXG59XG5cbi8qKlxuICogVGhlIHR5cGUgb2YgYSBgQGRlZmVyYCB0cmlnZ2VyLCBmb3IgdXNlIGluIHRoZSBpci5cbiAqL1xuZXhwb3J0IGVudW0gRGVmZXJUcmlnZ2VyS2luZCB7XG4gIElkbGUsXG4gIEltbWVkaWF0ZSxcbiAgVGltZXIsXG4gIEhvdmVyLFxuICBJbnRlcmFjdGlvbixcbiAgVmlld3BvcnQsXG59XG5cbi8qKlxuICogUmVwZWF0ZXJzIGltcGxpY2l0bHkgZGVmaW5lIHRoZXNlIGRlcml2ZWQgdmFyaWFibGVzLCBhbmQgY2hpbGQgbm9kZXMgbWF5IHJlYWQgdGhlbS5cbiAqL1xuZXhwb3J0IGVudW0gRGVyaXZlZFJlcGVhdGVyVmFySWRlbnRpdHkge1xuICBGaXJzdCxcbiAgTGFzdCxcbiAgRXZlbixcbiAgT2RkLFxufVxuIl19