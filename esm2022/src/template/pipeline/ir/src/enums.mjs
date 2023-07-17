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
     * An operation to render a text node.
     */
    OpKind[OpKind["Text"] = 10] = "Text";
    /**
     * An operation declaring an event listener for an element.
     */
    OpKind[OpKind["Listener"] = 11] = "Listener";
    /**
     * An operation to interpolate text into a text node.
     */
    OpKind[OpKind["InterpolateText"] = 12] = "InterpolateText";
    /**
     * An operation to bind an expression to a property of an element.
     */
    OpKind[OpKind["Property"] = 13] = "Property";
    /**
     * An operation to bind an expression to a style property of an element.
     */
    OpKind[OpKind["StyleProp"] = 14] = "StyleProp";
    /**
     * An operation to bind an expression to a class property of an element.
     */
    OpKind[OpKind["ClassProp"] = 15] = "ClassProp";
    /**
     * An operation to bind an expression to the styles of an element.
     */
    OpKind[OpKind["StyleMap"] = 16] = "StyleMap";
    /**
     * An operation to bind an expression to the classes of an element.
     */
    OpKind[OpKind["ClassMap"] = 17] = "ClassMap";
    /**
     * An operation to interpolate text into a property binding.
     */
    OpKind[OpKind["InterpolateProperty"] = 18] = "InterpolateProperty";
    /**
     * An operation to interpolate text into a style property binding.
     */
    OpKind[OpKind["InterpolateStyleProp"] = 19] = "InterpolateStyleProp";
    /**
     * An operation to interpolate text into a style mapping.
     */
    OpKind[OpKind["InterpolateStyleMap"] = 20] = "InterpolateStyleMap";
    /**
     * An operation to interpolate text into a class mapping.
     */
    OpKind[OpKind["InterpolateClassMap"] = 21] = "InterpolateClassMap";
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
     * An operation to interpolate text into an attribute binding.
     */
    OpKind[OpKind["InterpolateAttribute"] = 25] = "InterpolateAttribute";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQW1JWDtBQW5JRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsb0NBQUksQ0FBQTtJQUVKOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsMERBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsOENBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsOENBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsa0VBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCxvRUFBb0IsQ0FBQTtJQUVwQjs7T0FFRztJQUNILGtFQUFtQixDQUFBO0lBRW5COztPQUVHO0lBQ0gsa0VBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0lBRUo7O09BRUc7SUFDSCw4Q0FBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCxvRUFBb0IsQ0FBQTtBQUN0QixDQUFDLEVBbklXLE1BQU0sS0FBTixNQUFNLFFBbUlqQjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksY0ErRlg7QUEvRkQsV0FBWSxjQUFjO0lBQ3hCOztPQUVHO0lBQ0gsaUVBQVcsQ0FBQTtJQUVYOztPQUVHO0lBQ0gseURBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsbUVBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsaUVBQVcsQ0FBQTtJQUVYOztPQUVHO0lBQ0gsNkRBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsdUVBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsaUVBQVcsQ0FBQTtJQUVYOztPQUVHO0lBQ0gsNkRBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkVBQWdCLENBQUE7SUFFaEI7O09BRUc7SUFDSCw2RkFBeUIsQ0FBQTtJQUV6Qjs7T0FFRztJQUNILGtFQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILGtGQUFtQixDQUFBO0lBRW5COztPQUVHO0lBQ0gsNEVBQWdCLENBQUE7SUFFaEI7O09BRUc7SUFDSCxzRUFBYSxDQUFBO0lBRWI7O09BRUc7SUFDSCxnRkFBa0IsQ0FBQTtJQUVsQjs7T0FFRztJQUNILDBFQUFlLENBQUE7SUFFZjs7T0FFRztJQUNILDhEQUFTLENBQUE7SUFFVDs7T0FFRztJQUNILGtGQUFtQixDQUFBO0lBRW5COztPQUVHO0lBQ0gsOEVBQWlCLENBQUE7QUFDbkIsQ0FBQyxFQS9GVyxjQUFjLEtBQWQsY0FBYyxRQStGekI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLG9CQWVYO0FBZkQsV0FBWSxvQkFBb0I7SUFDOUI7O09BRUc7SUFDSCxxRUFBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCwyRUFBVSxDQUFBO0lBRVY7O09BRUc7SUFDSCx5RUFBUyxDQUFBO0FBQ1gsQ0FBQyxFQWZXLG9CQUFvQixLQUFwQixvQkFBb0IsUUFlL0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBvcGVyYXRpb25zLlxuICpcbiAqIEluY2x1ZGVzIGJvdGggY3JlYXRpb24gYW5kIHVwZGF0ZSBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZW51bSBPcEtpbmQge1xuICAvKipcbiAgICogQSBzcGVjaWFsIG9wZXJhdGlvbiB0eXBlIHdoaWNoIGlzIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBub2RlcyBvZiBhIGxpbmtlZFxuICAgKiBsaXN0IG9mIG9wZXJhdGlvbnMuXG4gICAqL1xuICBMaXN0RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggd3JhcHMgYW4gb3V0cHV0IEFTVCBzdGF0ZW1lbnQuXG4gICAqL1xuICBTdGF0ZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbmQgaW5pdGlhbGl6ZXMgYSBgU2VtYW50aWNWYXJpYWJsZWAuXG4gICAqL1xuICBWYXJpYWJsZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgRWxlbWVudFN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIEVsZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbiBlbWJlZGRlZCB2aWV3LlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQgcHJldmlvdXNseSBzdGFydGVkIHdpdGggYEVsZW1lbnRTdGFydGAuXG4gICAqL1xuICBFbGVtZW50RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJTdGFydCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGZvciBhbiBgbmctY29udGFpbmVyYCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgQ29udGFpbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gZW5kIGFuIGBuZy1jb250YWluZXJgLlxuICAgKi9cbiAgQ29udGFpbmVyRW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgVGV4dCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRlY2xhcmluZyBhbiBldmVudCBsaXN0ZW5lciBmb3IgYW4gZWxlbWVudC5cbiAgICovXG4gIExpc3RlbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgc3R5bGUgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFN0eWxlUHJvcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJpbmQgYW4gZXhwcmVzc2lvbiB0byBhIGNsYXNzIHByb3BlcnR5IG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBDbGFzc1Byb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gdGhlIHN0eWxlcyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgU3R5bGVNYXAsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gdGhlIGNsYXNzZXMgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIENsYXNzTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGEgcHJvcGVydHkgYmluZGluZy5cbiAgICovXG4gIEludGVycG9sYXRlUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSBzdHlsZSBwcm9wZXJ0eSBiaW5kaW5nLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVTdHlsZVByb3AsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSBzdHlsZSBtYXBwaW5nLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVTdHlsZU1hcCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGludGVycG9sYXRlIHRleHQgaW50byBhIGNsYXNzIG1hcHBpbmcuXG4gICAqL1xuICBJbnRlcnBvbGF0ZUNsYXNzTWFwLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYWR2YW5jZSB0aGUgcnVudGltZSdzIGltcGxpY2l0IHNsb3QgY29udGV4dCBkdXJpbmcgdGhlIHVwZGF0ZSBwaGFzZSBvZiBhIHZpZXcuXG4gICAqL1xuICBBZHZhbmNlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW5zdGFudGlhdGUgYSBwaXBlLlxuICAgKi9cbiAgUGlwZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFzc29jaWF0ZSBhbiBhdHRyaWJ1dGUgd2l0aCBhbiBlbGVtZW50LlxuICAgKi9cbiAgQXR0cmlidXRlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGFuIGF0dHJpYnV0ZSBiaW5kaW5nLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVBdHRyaWJ1dGUsXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIEV4cHJlc3Npb25LaW5kIHtcbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBpbiBhIGxleGljYWwgc2NvcGUuXG4gICAqL1xuICBMZXhpY2FsUmVhZCxcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGRlY2xhcmVkIGluIGEgYFZhcmlhYmxlT3BgLlxuICAgKi9cbiAgUmVhZFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICAgKi9cbiAgTmV4dENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAgICovXG4gIFJlZmVyZW5jZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gc25hcHNob3QgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgR2V0Q3VycmVudFZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICAgKi9cbiAgUmVzdG9yZVZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICAgKi9cbiAgUmVzZXRWaWV3LFxuXG4gIC8qKlxuICAgKiBEZWZpbmVzIGFuZCBjYWxscyBhIGZ1bmN0aW9uIHdpdGggY2hhbmdlLWRldGVjdGVkIGFyZ3VtZW50cy5cbiAgICovXG4gIFB1cmVGdW5jdGlvbkV4cHIsXG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyBhIHBvc2l0aW9uYWwgcGFyYW1ldGVyIHRvIGEgcHVyZSBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcixcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24uXG4gICAqL1xuICBQaXBlQmluZGluZyxcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24gd2l0aCBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqL1xuICBQaXBlQmluZGluZ1ZhcmlhZGljLFxuXG4gIC8qXG4gICAqIEEgc2FmZSBwcm9wZXJ0eSByZWFkIHJlcXVpcmluZyBleHBhbnNpb24gaW50byBhIG51bGwgY2hlY2suXG4gICAqL1xuICBTYWZlUHJvcGVydHlSZWFkLFxuXG4gIC8qKlxuICAgKiBBIHNhZmUga2V5ZWQgcmVhZCByZXF1aXJpbmcgZXhwYW5zaW9uIGludG8gYSBudWxsIGNoZWNrLlxuICAgKi9cbiAgU2FmZUtleWVkUmVhZCxcblxuICAvKipcbiAgICogQSBzYWZlIGZ1bmN0aW9uIGNhbGwgcmVxdWlyaW5nIGV4cGFuc2lvbiBpbnRvIGEgbnVsbCBjaGVjay5cbiAgICovXG4gIFNhZmVJbnZva2VGdW5jdGlvbixcblxuICAvKipcbiAgICogQW4gaW50ZXJtZWRpYXRlIGV4cHJlc3Npb24gdGhhdCB3aWxsIGJlIGV4cGFuZGVkIGZyb20gYSBzYWZlIHJlYWQgaW50byBhbiBleHBsaWNpdCB0ZXJuYXJ5LlxuICAgKi9cbiAgU2FmZVRlcm5hcnlFeHByLFxuXG4gIC8qKlxuICAgKiBBbiBlbXB0eSBleHByZXNzaW9uIHRoYXQgd2lsbCBiZSBzdGlwcGVkIGJlZm9yZSBnZW5lcmF0aW5nIHRoZSBmaW5hbCBvdXRwdXQuXG4gICAqL1xuICBFbXB0eUV4cHIsXG5cbiAgLypcbiAgICogQW4gYXNzaWdubWVudCB0byBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIEFzc2lnblRlbXBvcmFyeUV4cHIsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIGEgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgUmVhZFRlbXBvcmFyeUV4cHIsXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBiZXR3ZWVuIGRpZmZlcmVudCBraW5kcyBvZiBgU2VtYW50aWNWYXJpYWJsZWBzLlxuICovXG5leHBvcnQgZW51bSBTZW1hbnRpY1ZhcmlhYmxlS2luZCB7XG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIHRoZSBjb250ZXh0IG9mIGEgcGFydGljdWxhciB2aWV3LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhbiBpZGVudGlmaWVyIGRlY2xhcmVkIGluIHRoZSBsZXhpY2FsIHNjb3BlIG9mIGEgdmlldy5cbiAgICovXG4gIElkZW50aWZpZXIsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYSBzYXZlZCBzdGF0ZSB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlc3RvcmUgYSB2aWV3IGluIGEgbGlzdGVuZXIgaGFuZGxlciBmdW5jdGlvbi5cbiAgICovXG4gIFNhdmVkVmlldyxcbn1cbiJdfQ==