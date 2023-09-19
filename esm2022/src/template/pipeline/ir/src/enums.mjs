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
     * An i18n message that has been extracted for inclusion in the consts array.
     */
    OpKind[OpKind["ExtractedMessage"] = 26] = "ExtractedMessage";
    /**
     * A host binding property.
     */
    OpKind[OpKind["HostProperty"] = 27] = "HostProperty";
    /**
     * A namespace change, which causes the subsequent elements to be processed as either HTML or SVG.
     */
    OpKind[OpKind["Namespace"] = 28] = "Namespace";
    /**
     * Configure a content projeciton definition for the view.
     */
    OpKind[OpKind["ProjectionDef"] = 29] = "ProjectionDef";
    /**
     * Create a content projection slot.
     */
    OpKind[OpKind["Projection"] = 30] = "Projection";
    /**
     * The start of an i18n block.
     */
    OpKind[OpKind["I18nStart"] = 31] = "I18nStart";
    /**
     * A self-closing i18n on a single element.
     */
    OpKind[OpKind["I18n"] = 32] = "I18n";
    /**
     * The end of an i18n block.
     */
    OpKind[OpKind["I18nEnd"] = 33] = "I18nEnd";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQTZLWDtBQTdLRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILGtEQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09B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Z2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgb3BlcmF0aW9ucy5cbiAqXG4gKiBJbmNsdWRlcyBib3RoIGNyZWF0aW9uIGFuZCB1cGRhdGUgb3BlcmF0aW9ucy5cbiAqL1xuZXhwb3J0IGVudW0gT3BLaW5kIHtcbiAgLyoqXG4gICAqIEEgc3BlY2lhbCBvcGVyYXRpb24gdHlwZSB3aGljaCBpcyB1c2VkIHRvIHJlcHJlc2VudCB0aGUgYmVnaW5uaW5nIGFuZCBlbmQgbm9kZXMgb2YgYSBsaW5rZWRcbiAgICogbGlzdCBvZiBvcGVyYXRpb25zLlxuICAgKi9cbiAgTGlzdEVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIHdyYXBzIGFuIG91dHB1dCBBU1Qgc3RhdGVtZW50LlxuICAgKi9cbiAgU3RhdGVtZW50LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggZGVjbGFyZXMgYW5kIGluaXRpYWxpemVzIGEgYFNlbWFudGljVmFyaWFibGVgLlxuICAgKi9cbiAgVmFyaWFibGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiZWdpbiByZW5kZXJpbmcgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIEVsZW1lbnRTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIHJlbmRlciBhbiBlbGVtZW50IHdpdGggbm8gY2hpbGRyZW4uXG4gICAqL1xuICBFbGVtZW50LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggZGVjbGFyZXMgYW4gZW1iZWRkZWQgdmlldy5cbiAgICovXG4gIFRlbXBsYXRlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50IHByZXZpb3VzbHkgc3RhcnRlZCB3aXRoIGBFbGVtZW50U3RhcnRgLlxuICAgKi9cbiAgRWxlbWVudEVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyU3RhcnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBmb3IgYW4gYG5nLWNvbnRhaW5lcmAgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIENvbnRhaW5lcixcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGVuZCBhbiBgbmctY29udGFpbmVyYC5cbiAgICovXG4gIENvbnRhaW5lckVuZCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRpc2FibGUgYmluZGluZyBmb3Igc3Vic2VxdWVudCBlbGVtZW50cywgd2hpY2ggYXJlIGRlc2NlbmRhbnRzIG9mIGEgbm9uLWJpbmRhYmxlXG4gICAqIG5vZGUuXG4gICAqL1xuICBEaXNhYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wIHRvIGNvbmRpdGlvbmFsbHkgcmVuZGVyIGEgdGVtcGxhdGUuXG4gICAqL1xuICBDb25kaXRpb25hbCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIHJlLWVuYWJsZSBiaW5kaW5nLCBhZnRlciBpdCB3YXMgcHJldmlvdXNseSBkaXNhYmxlZC5cbiAgICovXG4gIEVuYWJsZUJpbmRpbmdzLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgVGV4dCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRlY2xhcmluZyBhbiBldmVudCBsaXN0ZW5lciBmb3IgYW4gZWxlbWVudC5cbiAgICovXG4gIExpc3RlbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBpbnRlcm1lZGlhdGUgYmluZGluZyBvcCwgdGhhdCBoYXMgbm90IHlldCBiZWVuIHByb2Nlc3NlZCBpbnRvIGFuIGluZGl2aWR1YWwgcHJvcGVydHksXG4gICAqIGF0dHJpYnV0ZSwgc3R5bGUsIGV0Yy5cbiAgICovXG4gIEJpbmRpbmcsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBzdHlsZSBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgU3R5bGVQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgY2xhc3MgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIENsYXNzUHJvcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byB0aGUgc3R5bGVzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZU1hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byB0aGUgY2xhc3NlcyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NNYXAsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhZHZhbmNlIHRoZSBydW50aW1lJ3MgaW1wbGljaXQgc2xvdCBjb250ZXh0IGR1cmluZyB0aGUgdXBkYXRlIHBoYXNlIG9mIGEgdmlldy5cbiAgICovXG4gIEFkdmFuY2UsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnN0YW50aWF0ZSBhIHBpcGUuXG4gICAqL1xuICBQaXBlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYXNzb2NpYXRlIGFuIGF0dHJpYnV0ZSB3aXRoIGFuIGVsZW1lbnQuXG4gICAqL1xuICBBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIEFuIGF0dHJpYnV0ZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAqL1xuICBFeHRyYWN0ZWRBdHRyaWJ1dGUsXG5cbiAgLyoqXG4gICAqIEFuIGkxOG4gbWVzc2FnZSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmb3IgaW5jbHVzaW9uIGluIHRoZSBjb25zdHMgYXJyYXkuXG4gICAqL1xuICBFeHRyYWN0ZWRNZXNzYWdlLFxuXG4gIC8qKlxuICAgKiBBIGhvc3QgYmluZGluZyBwcm9wZXJ0eS5cbiAgICovXG4gIEhvc3RQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQSBuYW1lc3BhY2UgY2hhbmdlLCB3aGljaCBjYXVzZXMgdGhlIHN1YnNlcXVlbnQgZWxlbWVudHMgdG8gYmUgcHJvY2Vzc2VkIGFzIGVpdGhlciBIVE1MIG9yIFNWRy5cbiAgICovXG4gIE5hbWVzcGFjZSxcblxuICAvKipcbiAgICogQ29uZmlndXJlIGEgY29udGVudCBwcm9qZWNpdG9uIGRlZmluaXRpb24gZm9yIHRoZSB2aWV3LlxuICAgKi9cbiAgUHJvamVjdGlvbkRlZixcblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29udGVudCBwcm9qZWN0aW9uIHNsb3QuXG4gICAqL1xuICBQcm9qZWN0aW9uLFxuXG4gIC8qKlxuICAgKiBUaGUgc3RhcnQgb2YgYW4gaTE4biBibG9jay5cbiAgICovXG4gIEkxOG5TdGFydCxcblxuICAvKipcbiAgICogQSBzZWxmLWNsb3NpbmcgaTE4biBvbiBhIHNpbmdsZSBlbGVtZW50LlxuICAgKi9cbiAgSTE4bixcblxuICAvKipcbiAgICogVGhlIGVuZCBvZiBhbiBpMThuIGJsb2NrLlxuICAgKi9cbiAgSTE4bkVuZCxcbn1cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGVudW0gRXhwcmVzc2lvbktpbmQge1xuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGluIGEgbGV4aWNhbCBzY29wZS5cbiAgICovXG4gIExleGljYWxSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgaW4gYSBgVmFyaWFibGVPcGAuXG4gICAqL1xuICBSZWFkVmFyaWFibGUsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIG5hdmlnYXRlIHRvIHRoZSBuZXh0IHZpZXcgY29udGV4dCBpbiB0aGUgdmlldyBoaWVyYXJjaHkuXG4gICAqL1xuICBOZXh0Q29udGV4dCxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmV0cmlldmUgdGhlIHZhbHVlIG9mIGEgbG9jYWwgcmVmZXJlbmNlLlxuICAgKi9cbiAgUmVmZXJlbmNlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBzbmFwc2hvdCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBHZXRDdXJyZW50VmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzdG9yZSBhIHNuYXBzaG90dGVkIHZpZXcuXG4gICAqL1xuICBSZXN0b3JlVmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzZXQgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0IGFmdGVyIGBSZXN0b3JlVmlld2AuXG4gICAqL1xuICBSZXNldFZpZXcsXG5cbiAgLyoqXG4gICAqIERlZmluZXMgYW5kIGNhbGxzIGEgZnVuY3Rpb24gd2l0aCBjaGFuZ2UtZGV0ZWN0ZWQgYXJndW1lbnRzLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uRXhwcixcblxuICAvKipcbiAgICogSW5kaWNhdGVzIGEgcG9zaXRpb25hbCBwYXJhbWV0ZXIgdG8gYSBwdXJlIGZ1bmN0aW9uIGRlZmluaXRpb24uXG4gICAqL1xuICBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICovXG4gIFBpcGVCaW5kaW5nLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbiB3aXRoIGEgdmFyaWFibGUgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICovXG4gIFBpcGVCaW5kaW5nVmFyaWFkaWMsXG5cbiAgLypcbiAgICogQSBzYWZlIHByb3BlcnR5IHJlYWQgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVQcm9wZXJ0eVJlYWQsXG5cbiAgLyoqXG4gICAqIEEgc2FmZSBrZXllZCByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlS2V5ZWRSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUgZnVuY3Rpb24gY2FsbCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUludm9rZUZ1bmN0aW9uLFxuXG4gIC8qKlxuICAgKiBBbiBpbnRlcm1lZGlhdGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgZXhwYW5kZWQgZnJvbSBhIHNhZmUgcmVhZCBpbnRvIGFuIGV4cGxpY2l0IHRlcm5hcnkuXG4gICAqL1xuICBTYWZlVGVybmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGVtcHR5IGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHN0aXBwZWQgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIGZpbmFsIG91dHB1dC5cbiAgICovXG4gIEVtcHR5RXhwcixcblxuICAvKlxuICAgKiBBbiBhc3NpZ25tZW50IHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgQXNzaWduVGVtcG9yYXJ5RXhwcixcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBSZWFkVGVtcG9yYXJ5RXhwcixcblxuICAvKipcbiAgICogQW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgYSBzYW5pdGl6ZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYW5pdGl6ZXJFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBleHByZXNzaW9uIHRoYXQgd2lsbCBjYXVzZSBhIGxpdGVyYWwgc2xvdCBpbmRleCB0byBiZSBlbWl0dGVkLlxuICAgKi9cbiAgU2xvdExpdGVyYWxFeHByLFxufVxuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgYmV0d2VlbiBkaWZmZXJlbnQga2luZHMgb2YgYFNlbWFudGljVmFyaWFibGVgcy5cbiAqL1xuZXhwb3J0IGVudW0gU2VtYW50aWNWYXJpYWJsZUtpbmQge1xuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgY29udGV4dCBvZiBhIHBhcnRpY3VsYXIgdmlldy5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYW4gaWRlbnRpZmllciBkZWNsYXJlZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiBhIHZpZXcuXG4gICAqL1xuICBJZGVudGlmaWVyLFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgc2F2ZWQgc3RhdGUgdGhhdCBjYW4gYmUgdXNlZCB0byByZXN0b3JlIGEgdmlldyBpbiBhIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYXZlZFZpZXcsXG59XG5cbi8qKlxuICogV2hldGhlciB0byBjb21waWxlIGluIGNvbXBhdGliaWx0eSBtb2RlLiBJbiBjb21wYXRpYmlsaXR5IG1vZGUsIHRoZSB0ZW1wbGF0ZSBwaXBlbGluZSB3aWxsXG4gKiBhdHRlbXB0IHRvIG1hdGNoIHRoZSBvdXRwdXQgb2YgYFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXJgIGFzIGV4YWN0bHkgYXMgcG9zc2libGUsIGF0IHRoZSBjb3N0XG4gKiBvZiBwcm9kdWNpbmcgcXVpcmt5IG9yIGxhcmdlciBjb2RlIGluIHNvbWUgY2FzZXMuXG4gKi9cbmV4cG9ydCBlbnVtIENvbXBhdGliaWxpdHlNb2RlIHtcbiAgTm9ybWFsLFxuICBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLFxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgZnVuY3Rpb25zIHVzZWQgdG8gc2FuaXRpemUgZGlmZmVyZW50IHBpZWNlcyBvZiBhIHRlbXBsYXRlLlxuICovXG5leHBvcnQgZW51bSBTYW5pdGl6ZXJGbiB7XG4gIEh0bWwsXG4gIFNjcmlwdCxcbiAgU3R5bGUsXG4gIFVybCxcbiAgUmVzb3VyY2VVcmwsXG4gIElmcmFtZUF0dHJpYnV0ZSxcbn1cblxuLyoqXG4gKiBFbnVtZXJhdGlvbiBvZiB0aGUgdHlwZXMgb2YgYXR0cmlidXRlcyB3aGljaCBjYW4gYmUgYXBwbGllZCB0byBhbiBlbGVtZW50LlxuICovXG5leHBvcnQgZW51bSBCaW5kaW5nS2luZCB7XG4gIC8qKlxuICAgKiBTdGF0aWMgYXR0cmlidXRlcy5cbiAgICovXG4gIEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQ2xhc3MgYmluZGluZ3MuXG4gICAqL1xuICBDbGFzc05hbWUsXG5cbiAgLyoqXG4gICAqIFN0eWxlIGJpbmRpbmdzLlxuICAgKi9cbiAgU3R5bGVQcm9wZXJ0eSxcblxuICAvKipcbiAgICogRHluYW1pYyBwcm9wZXJ0eSBiaW5kaW5ncy5cbiAgICovXG4gIFByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBQcm9wZXJ0eSBvciBhdHRyaWJ1dGUgYmluZGluZ3Mgb24gYSB0ZW1wbGF0ZS5cbiAgICovXG4gIFRlbXBsYXRlLFxuXG4gIC8qKlxuICAgKiBJbnRlcm5hdGlvbmFsaXplZCBhdHRyaWJ1dGVzLlxuICAgKi9cbiAgSTE4bixcblxuICAvKipcbiAgICogQW5pbWF0aW9uIHByb3BlcnR5IGJpbmRpbmdzLlxuICAgKi9cbiAgQW5pbWF0aW9uLFxufVxuIl19