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
     * An operation to re-enable binding, after it was previously disabled.
     */
    OpKind[OpKind["EnableBindings"] = 11] = "EnableBindings";
    /**
     * An operation to render a text node.
     */
    OpKind[OpKind["Text"] = 12] = "Text";
    /**
     * An operation declaring an event listener for an element.
     */
    OpKind[OpKind["Listener"] = 13] = "Listener";
    /**
     * An operation to interpolate text into a text node.
     */
    OpKind[OpKind["InterpolateText"] = 14] = "InterpolateText";
    /**
     * An intermediate binding op, that has not yet been processed into an individual property,
     * attribute, style, etc.
     */
    OpKind[OpKind["Binding"] = 15] = "Binding";
    /**
     * An operation to bind an expression to a property of an element.
     */
    OpKind[OpKind["Property"] = 16] = "Property";
    /**
     * An operation to bind an expression to a style property of an element.
     */
    OpKind[OpKind["StyleProp"] = 17] = "StyleProp";
    /**
     * An operation to bind an expression to a class property of an element.
     */
    OpKind[OpKind["ClassProp"] = 18] = "ClassProp";
    /**
     * An operation to bind an expression to the styles of an element.
     */
    OpKind[OpKind["StyleMap"] = 19] = "StyleMap";
    /**
     * An operation to bind an expression to the classes of an element.
     */
    OpKind[OpKind["ClassMap"] = 20] = "ClassMap";
    /**
     * An operation to advance the runtime's implicit slot context during the update phase of a view.
     */
    OpKind[OpKind["Advance"] = 21] = "Advance";
    /**
     * An operation to instantiate a pipe.
     */
    OpKind[OpKind["Pipe"] = 22] = "Pipe";
    /**
     * An operation to associate an attribute with an element.
     */
    OpKind[OpKind["Attribute"] = 23] = "Attribute";
    /**
     * A host binding property.
     */
    OpKind[OpKind["HostProperty"] = 24] = "HostProperty";
    /**
     * A namespace change, which causes the subsequent elements to be processed as either HTML or SVG.
     */
    OpKind[OpKind["Namespace"] = 25] = "Namespace";
    // TODO: Add Host Listeners, and possibly other host ops also.
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
 * attempt to match the output of `TemplateDefinitionBuilder` as exactly as possible, at the cost of
 * producing quirky or larger code in some cases.
 */
export var CompatibilityMode;
(function (CompatibilityMode) {
    CompatibilityMode[CompatibilityMode["Normal"] = 0] = "Normal";
    CompatibilityMode[CompatibilityMode["TemplateDefinitionBuilder"] = 1] = "TemplateDefinitionBuilder";
})(CompatibilityMode || (CompatibilityMode = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQXVJWDtBQXZJRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOzs7T0FHRztJQUNILDBEQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILHdEQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILG9DQUFJLENBQUE7SUFFSjs7T0FFRztJQUNILDRDQUFRLENBQUE7SUFFUjs7T0FFRztJQUNILDBEQUFlLENBQUE7SUFFZjs7O09BR0c7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCw0Q0FBUSxDQUFBO0lBRVI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCxvREFBWSxDQUFBO0lBRVo7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQsOERBQThEO0FBQ2hFLENBQUMsRUF2SVcsTUFBTSxLQUFOLE1BQU0sUUF1SWpCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxjQStGWDtBQS9GRCxXQUFZLGNBQWM7SUFDeEI7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCx5REFBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxtRUFBWSxDQUFBO0lBRVo7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCw2REFBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCx1RUFBYyxDQUFBO0lBRWQ7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCw2REFBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCwyRUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILDZGQUF5QixDQUFBO0lBRXpCOztPQUVHO0lBQ0gsa0VBQVcsQ0FBQTtJQUVYOztPQUVHO0lBQ0gsa0ZBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCw0RUFBZ0IsQ0FBQTtJQUVoQjs7T0FFRztJQUNILHNFQUFhLENBQUE7SUFFYjs7T0FFRztJQUNILGdGQUFrQixDQUFBO0lBRWxCOztPQUVHO0lBQ0gsMEVBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsOERBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsa0ZBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCw4RUFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBL0ZXLGNBQWMsS0FBZCxjQUFjLFFBK0Z6QjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksb0JBZVg7QUFmRCxXQUFZLG9CQUFvQjtJQUM5Qjs7T0FFRztJQUNILHFFQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILDJFQUFVLENBQUE7SUFFVjs7T0FFRztJQUNILHlFQUFTLENBQUE7QUFDWCxDQUFDLEVBZlcsb0JBQW9CLEtBQXBCLG9CQUFvQixRQWUvQjtBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxpQkFHWDtBQUhELFdBQVksaUJBQWlCO0lBQzNCLDZEQUFNLENBQUE7SUFDTixtR0FBeUIsQ0FBQTtBQUMzQixDQUFDLEVBSFcsaUJBQWlCLEtBQWpCLGlCQUFpQixRQUc1QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIG9wZXJhdGlvbnMuXG4gKlxuICogSW5jbHVkZXMgYm90aCBjcmVhdGlvbiBhbmQgdXBkYXRlIG9wZXJhdGlvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIE9wS2luZCB7XG4gIC8qKlxuICAgKiBBIHNwZWNpYWwgb3BlcmF0aW9uIHR5cGUgd2hpY2ggaXMgdXNlZCB0byByZXByZXNlbnQgdGhlIGJlZ2lubmluZyBhbmQgZW5kIG5vZGVzIG9mIGEgbGlua2VkXG4gICAqIGxpc3Qgb2Ygb3BlcmF0aW9ucy5cbiAgICovXG4gIExpc3RFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCB3cmFwcyBhbiBvdXRwdXQgQVNUIHN0YXRlbWVudC5cbiAgICovXG4gIFN0YXRlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuZCBpbml0aWFsaXplcyBhIGBTZW1hbnRpY1ZhcmlhYmxlYC5cbiAgICovXG4gIFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBFbGVtZW50U3RhcnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYW4gZWxlbWVudCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgRWxlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuIGVtYmVkZGVkIHZpZXcuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGVuZCByZW5kZXJpbmcgb2YgYW4gZWxlbWVudCBwcmV2aW91c2x5IHN0YXJ0ZWQgd2l0aCBgRWxlbWVudFN0YXJ0YC5cbiAgICovXG4gIEVsZW1lbnRFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiZWdpbiBhbiBgbmctY29udGFpbmVyYC5cbiAgICovXG4gIENvbnRhaW5lclN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZm9yIGFuIGBuZy1jb250YWluZXJgIHdpdGggbm8gY2hpbGRyZW4uXG4gICAqL1xuICBDb250YWluZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiBkaXNhYmxlIGJpbmRpbmcgZm9yIHN1YnNlcXVlbnQgZWxlbWVudHMsIHdoaWNoIGFyZSBkZXNjZW5kYW50cyBvZiBhIG5vbi1iaW5kYWJsZVxuICAgKiBub2RlLlxuICAgKi9cbiAgRGlzYWJsZUJpbmRpbmdzLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmUtZW5hYmxlIGJpbmRpbmcsIGFmdGVyIGl0IHdhcyBwcmV2aW91c2x5IGRpc2FibGVkLlxuICAgKi9cbiAgRW5hYmxlQmluZGluZ3MsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGVjbGFyaW5nIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBlbGVtZW50LlxuICAgKi9cbiAgTGlzdGVuZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBJbnRlcnBvbGF0ZVRleHQsXG5cbiAgLyoqXG4gICAqIEFuIGludGVybWVkaWF0ZSBiaW5kaW5nIG9wLCB0aGF0IGhhcyBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkIGludG8gYW4gaW5kaXZpZHVhbCBwcm9wZXJ0eSxcbiAgICogYXR0cmlidXRlLCBzdHlsZSwgZXRjLlxuICAgKi9cbiAgQmluZGluZyxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIHN0eWxlIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBTdHlsZVByb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBjbGFzcyBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgQ2xhc3NQcm9wLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBzdHlsZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIHRoZSBjbGFzc2VzIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc01hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgZHVyaW5nIHRoZSB1cGRhdGUgcGhhc2Ugb2YgYSB2aWV3LlxuICAgKi9cbiAgQWR2YW5jZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGluc3RhbnRpYXRlIGEgcGlwZS5cbiAgICovXG4gIFBpcGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBhc3NvY2lhdGUgYW4gYXR0cmlidXRlIHdpdGggYW4gZWxlbWVudC5cbiAgICovXG4gIEF0dHJpYnV0ZSxcblxuICAvKipcbiAgICogQSBob3N0IGJpbmRpbmcgcHJvcGVydHkuXG4gICAqL1xuICBIb3N0UHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEEgbmFtZXNwYWNlIGNoYW5nZSwgd2hpY2ggY2F1c2VzIHRoZSBzdWJzZXF1ZW50IGVsZW1lbnRzIHRvIGJlIHByb2Nlc3NlZCBhcyBlaXRoZXIgSFRNTCBvciBTVkcuXG4gICAqL1xuICBOYW1lc3BhY2UsXG5cbiAgLy8gVE9ETzogQWRkIEhvc3QgTGlzdGVuZXJzLCBhbmQgcG9zc2libHkgb3RoZXIgaG9zdCBvcHMgYWxzby5cbn1cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBleHByZXNzaW9ucy5cbiAqL1xuZXhwb3J0IGVudW0gRXhwcmVzc2lvbktpbmQge1xuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGluIGEgbGV4aWNhbCBzY29wZS5cbiAgICovXG4gIExleGljYWxSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgZGVjbGFyZWQgaW4gYSBgVmFyaWFibGVPcGAuXG4gICAqL1xuICBSZWFkVmFyaWFibGUsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIG5hdmlnYXRlIHRvIHRoZSBuZXh0IHZpZXcgY29udGV4dCBpbiB0aGUgdmlldyBoaWVyYXJjaHkuXG4gICAqL1xuICBOZXh0Q29udGV4dCxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmV0cmlldmUgdGhlIHZhbHVlIG9mIGEgbG9jYWwgcmVmZXJlbmNlLlxuICAgKi9cbiAgUmVmZXJlbmNlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBzbmFwc2hvdCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQuXG4gICAqL1xuICBHZXRDdXJyZW50VmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzdG9yZSBhIHNuYXBzaG90dGVkIHZpZXcuXG4gICAqL1xuICBSZXN0b3JlVmlldyxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gcmVzZXQgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0IGFmdGVyIGBSZXN0b3JlVmlld2AuXG4gICAqL1xuICBSZXNldFZpZXcsXG5cbiAgLyoqXG4gICAqIERlZmluZXMgYW5kIGNhbGxzIGEgZnVuY3Rpb24gd2l0aCBjaGFuZ2UtZGV0ZWN0ZWQgYXJndW1lbnRzLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uRXhwcixcblxuICAvKipcbiAgICogSW5kaWNhdGVzIGEgcG9zaXRpb25hbCBwYXJhbWV0ZXIgdG8gYSBwdXJlIGZ1bmN0aW9uIGRlZmluaXRpb24uXG4gICAqL1xuICBQdXJlRnVuY3Rpb25QYXJhbWV0ZXJFeHByLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICovXG4gIFBpcGVCaW5kaW5nLFxuXG4gIC8qKlxuICAgKiBCaW5kaW5nIHRvIGEgcGlwZSB0cmFuc2Zvcm1hdGlvbiB3aXRoIGEgdmFyaWFibGUgbnVtYmVyIG9mIGFyZ3VtZW50cy5cbiAgICovXG4gIFBpcGVCaW5kaW5nVmFyaWFkaWMsXG5cbiAgLypcbiAgICogQSBzYWZlIHByb3BlcnR5IHJlYWQgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVQcm9wZXJ0eVJlYWQsXG5cbiAgLyoqXG4gICAqIEEgc2FmZSBrZXllZCByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlS2V5ZWRSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUgZnVuY3Rpb24gY2FsbCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUludm9rZUZ1bmN0aW9uLFxuXG4gIC8qKlxuICAgKiBBbiBpbnRlcm1lZGlhdGUgZXhwcmVzc2lvbiB0aGF0IHdpbGwgYmUgZXhwYW5kZWQgZnJvbSBhIHNhZmUgcmVhZCBpbnRvIGFuIGV4cGxpY2l0IHRlcm5hcnkuXG4gICAqL1xuICBTYWZlVGVybmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEFuIGVtcHR5IGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIHN0aXBwZWQgYmVmb3JlIGdlbmVyYXRpbmcgdGhlIGZpbmFsIG91dHB1dC5cbiAgICovXG4gIEVtcHR5RXhwcixcblxuICAvKlxuICAgKiBBbiBhc3NpZ25tZW50IHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgQXNzaWduVGVtcG9yYXJ5RXhwcixcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBSZWFkVGVtcG9yYXJ5RXhwcixcbn1cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGJldHdlZW4gZGlmZmVyZW50IGtpbmRzIG9mIGBTZW1hbnRpY1ZhcmlhYmxlYHMuXG4gKi9cbmV4cG9ydCBlbnVtIFNlbWFudGljVmFyaWFibGVLaW5kIHtcbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGNvbnRleHQgb2YgYSBwYXJ0aWN1bGFyIHZpZXcuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGlkZW50aWZpZXIgZGVjbGFyZWQgaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgYSB2aWV3LlxuICAgKi9cbiAgSWRlbnRpZmllcixcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHNhdmVkIHN0YXRlIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzdG9yZSBhIHZpZXcgaW4gYSBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2F2ZWRWaWV3LFxufVxuXG4vKipcbiAqIFdoZXRoZXIgdG8gY29tcGlsZSBpbiBjb21wYXRpYmlsdHkgbW9kZS4gSW4gY29tcGF0aWJpbGl0eSBtb2RlLCB0aGUgdGVtcGxhdGUgcGlwZWxpbmUgd2lsbFxuICogYXR0ZW1wdCB0byBtYXRjaCB0aGUgb3V0cHV0IG9mIGBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyYCBhcyBleGFjdGx5IGFzIHBvc3NpYmxlLCBhdCB0aGUgY29zdCBvZlxuICogcHJvZHVjaW5nIHF1aXJreSBvciBsYXJnZXIgY29kZSBpbiBzb21lIGNhc2VzLlxuICovXG5leHBvcnQgZW51bSBDb21wYXRpYmlsaXR5TW9kZSB7XG4gIE5vcm1hbCxcbiAgVGVtcGxhdGVEZWZpbml0aW9uQnVpbGRlcixcbn1cbiJdfQ==