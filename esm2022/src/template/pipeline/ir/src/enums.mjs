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
     * An operation to interpolate text into a property binding.
     */
    OpKind[OpKind["InterpolateProperty"] = 14] = "InterpolateProperty";
    /**
     * An operation to advance the runtime's implicit slot context during the update phase of a view.
     */
    OpKind[OpKind["Advance"] = 15] = "Advance";
    /**
     * An operation to instantiate a pipe.
     */
    OpKind[OpKind["Pipe"] = 16] = "Pipe";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQXNGWDtBQXRGRCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsdURBQWMsQ0FBQTtJQUVkOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gsb0NBQUksQ0FBQTtJQUVKOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsMERBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsa0VBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCwwQ0FBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxvQ0FBSSxDQUFBO0FBQ04sQ0FBQyxFQXRGVyxNQUFNLEtBQU4sTUFBTSxRQXNGakI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGNBNERYO0FBNURELFdBQVksY0FBYztJQUN4Qjs7T0FFRztJQUNILGlFQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILHlEQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILG1FQUFZLENBQUE7SUFFWjs7T0FFRztJQUNILGlFQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILDZEQUFTLENBQUE7SUFFVDs7T0FFRztJQUNILHVFQUFjLENBQUE7SUFFZDs7T0FFRztJQUNILGlFQUFXLENBQUE7SUFFWDs7T0FFRztJQUNILDZEQUFTLENBQUE7SUFFVDs7T0FFRztJQUNILDJFQUFnQixDQUFBO0lBRWhCOztPQUVHO0lBQ0gsNkZBQXlCLENBQUE7SUFFekI7O09BRUc7SUFDSCxrRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCxrRkFBbUIsQ0FBQTtBQUNyQixDQUFDLEVBNURXLGNBQWMsS0FBZCxjQUFjLFFBNER6QjtBQUVEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksb0JBZVg7QUFmRCxXQUFZLG9CQUFvQjtJQUM5Qjs7T0FFRztJQUNILHFFQUFPLENBQUE7SUFFUDs7T0FFRztJQUNILDJFQUFVLENBQUE7SUFFVjs7T0FFRztJQUNILHlFQUFTLENBQUE7QUFDWCxDQUFDLEVBZlcsb0JBQW9CLEtBQXBCLG9CQUFvQixRQWUvQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIG9wZXJhdGlvbnMuXG4gKlxuICogSW5jbHVkZXMgYm90aCBjcmVhdGlvbiBhbmQgdXBkYXRlIG9wZXJhdGlvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIE9wS2luZCB7XG4gIC8qKlxuICAgKiBBIHNwZWNpYWwgb3BlcmF0aW9uIHR5cGUgd2hpY2ggaXMgdXNlZCB0byByZXByZXNlbnQgdGhlIGJlZ2lubmluZyBhbmQgZW5kIG5vZGVzIG9mIGEgbGlua2VkXG4gICAqIGxpc3Qgb2Ygb3BlcmF0aW9ucy5cbiAgICovXG4gIExpc3RFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCB3cmFwcyBhbiBvdXRwdXQgQVNUIHN0YXRlbWVudC5cbiAgICovXG4gIFN0YXRlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuZCBpbml0aWFsaXplcyBhIGBTZW1hbnRpY1ZhcmlhYmxlYC5cbiAgICovXG4gIFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmVnaW4gcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQuXG4gICAqL1xuICBFbGVtZW50U3RhcnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYW4gZWxlbWVudCB3aXRoIG5vIGNoaWxkcmVuLlxuICAgKi9cbiAgRWxlbWVudCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHdoaWNoIGRlY2xhcmVzIGFuIGVtYmVkZGVkIHZpZXcuXG4gICAqL1xuICBUZW1wbGF0ZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGVuZCByZW5kZXJpbmcgb2YgYW4gZWxlbWVudCBwcmV2aW91c2x5IHN0YXJ0ZWQgd2l0aCBgRWxlbWVudFN0YXJ0YC5cbiAgICovXG4gIEVsZW1lbnRFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiZWdpbiBhbiBgbmctY29udGFpbmVyYC5cbiAgICovXG4gIENvbnRhaW5lclN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZm9yIGFuIGBuZy1jb250YWluZXJgIHdpdGggbm8gY2hpbGRyZW4uXG4gICAqL1xuICBDb250YWluZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgYW4gYG5nLWNvbnRhaW5lcmAuXG4gICAqL1xuICBDb250YWluZXJFbmQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byByZW5kZXIgYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gZGVjbGFyaW5nIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBlbGVtZW50LlxuICAgKi9cbiAgTGlzdGVuZXIsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSB0ZXh0IG5vZGUuXG4gICAqL1xuICBJbnRlcnBvbGF0ZVRleHQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBiaW5kIGFuIGV4cHJlc3Npb24gdG8gYSBwcm9wZXJ0eSBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgUHJvcGVydHksXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBpbnRlcnBvbGF0ZSB0ZXh0IGludG8gYSBwcm9wZXJ0eSBiaW5kaW5nLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVQcm9wZXJ0eSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGFkdmFuY2UgdGhlIHJ1bnRpbWUncyBpbXBsaWNpdCBzbG90IGNvbnRleHQgZHVyaW5nIHRoZSB1cGRhdGUgcGhhc2Ugb2YgYSB2aWV3LlxuICAgKi9cbiAgQWR2YW5jZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGluc3RhbnRpYXRlIGEgcGlwZS5cbiAgICovXG4gIFBpcGUsXG59XG5cbi8qKlxuICogRGlzdGluZ3Vpc2hlcyBkaWZmZXJlbnQga2luZHMgb2YgSVIgZXhwcmVzc2lvbnMuXG4gKi9cbmV4cG9ydCBlbnVtIEV4cHJlc3Npb25LaW5kIHtcbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBpbiBhIGxleGljYWwgc2NvcGUuXG4gICAqL1xuICBMZXhpY2FsUmVhZCxcblxuICAvKipcbiAgICogQSByZWZlcmVuY2UgdG8gdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgQ29udGV4dCxcblxuICAvKipcbiAgICogUmVhZCBvZiBhIHZhcmlhYmxlIGRlY2xhcmVkIGluIGEgYFZhcmlhYmxlT3BgLlxuICAgKi9cbiAgUmVhZFZhcmlhYmxlLFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byBuYXZpZ2F0ZSB0byB0aGUgbmV4dCB2aWV3IGNvbnRleHQgaW4gdGhlIHZpZXcgaGllcmFyY2h5LlxuICAgKi9cbiAgTmV4dENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJldHJpZXZlIHRoZSB2YWx1ZSBvZiBhIGxvY2FsIHJlZmVyZW5jZS5cbiAgICovXG4gIFJlZmVyZW5jZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gc25hcHNob3QgdGhlIGN1cnJlbnQgdmlldyBjb250ZXh0LlxuICAgKi9cbiAgR2V0Q3VycmVudFZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc3RvcmUgYSBzbmFwc2hvdHRlZCB2aWV3LlxuICAgKi9cbiAgUmVzdG9yZVZpZXcsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHJlc2V0IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dCBhZnRlciBgUmVzdG9yZVZpZXdgLlxuICAgKi9cbiAgUmVzZXRWaWV3LFxuXG4gIC8qKlxuICAgKiBEZWZpbmVzIGFuZCBjYWxscyBhIGZ1bmN0aW9uIHdpdGggY2hhbmdlLWRldGVjdGVkIGFyZ3VtZW50cy5cbiAgICovXG4gIFB1cmVGdW5jdGlvbkV4cHIsXG5cbiAgLyoqXG4gICAqIEluZGljYXRlcyBhIHBvc2l0aW9uYWwgcGFyYW1ldGVyIHRvIGEgcHVyZSBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICAgKi9cbiAgUHVyZUZ1bmN0aW9uUGFyYW1ldGVyRXhwcixcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24uXG4gICAqL1xuICBQaXBlQmluZGluZyxcblxuICAvKipcbiAgICogQmluZGluZyB0byBhIHBpcGUgdHJhbnNmb3JtYXRpb24gd2l0aCBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqL1xuICBQaXBlQmluZGluZ1ZhcmlhZGljLFxufVxuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgYmV0d2VlbiBkaWZmZXJlbnQga2luZHMgb2YgYFNlbWFudGljVmFyaWFibGVgcy5cbiAqL1xuZXhwb3J0IGVudW0gU2VtYW50aWNWYXJpYWJsZUtpbmQge1xuICAvKipcbiAgICogUmVwcmVzZW50cyB0aGUgY29udGV4dCBvZiBhIHBhcnRpY3VsYXIgdmlldy5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYW4gaWRlbnRpZmllciBkZWNsYXJlZCBpbiB0aGUgbGV4aWNhbCBzY29wZSBvZiBhIHZpZXcuXG4gICAqL1xuICBJZGVudGlmaWVyLFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGEgc2F2ZWQgc3RhdGUgdGhhdCBjYW4gYmUgdXNlZCB0byByZXN0b3JlIGEgdmlldyBpbiBhIGxpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAqL1xuICBTYXZlZFZpZXcsXG59XG4iXX0=