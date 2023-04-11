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
     * An operation to render a text node.
     */
    OpKind[OpKind["Text"] = 7] = "Text";
    /**
     * An operation declaring an event listener for an element.
     */
    OpKind[OpKind["Listener"] = 8] = "Listener";
    /**
     * An operation to interpolate text into a text node.
     */
    OpKind[OpKind["InterpolateText"] = 9] = "InterpolateText";
    /**
     * An operation to bind an expression to a property of an element.
     */
    OpKind[OpKind["Property"] = 10] = "Property";
    /**
     * An operation to advance the runtime's implicit slot context during the update phase of a view.
     */
    OpKind[OpKind["Advance"] = 11] = "Advance";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvdGVtcGxhdGUvcGlwZWxpbmUvaXIvc3JjL2VudW1zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFDSCxNQUFNLENBQU4sSUFBWSxNQTZEWDtBQTdERCxXQUFZLE1BQU07SUFDaEI7OztPQUdHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsNkNBQVMsQ0FBQTtJQUVUOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsbURBQVksQ0FBQTtJQUVaOztPQUVHO0lBQ0gseUNBQU8sQ0FBQTtJQUVQOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsK0NBQVUsQ0FBQTtJQUVWOztPQUVHO0lBQ0gsbUNBQUksQ0FBQTtJQUVKOztPQUVHO0lBQ0gsMkNBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gseURBQWUsQ0FBQTtJQUVmOztPQUVHO0lBQ0gsNENBQVEsQ0FBQTtJQUVSOztPQUVHO0lBQ0gsMENBQU8sQ0FBQTtBQUNULENBQUMsRUE3RFcsTUFBTSxLQUFOLE1BQU0sUUE2RGpCO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxjQXdDWDtBQXhDRCxXQUFZLGNBQWM7SUFDeEI7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCx5REFBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCxtRUFBWSxDQUFBO0lBRVo7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCw2REFBUyxDQUFBO0lBRVQ7O09BRUc7SUFDSCx1RUFBYyxDQUFBO0lBRWQ7O09BRUc7SUFDSCxpRUFBVyxDQUFBO0lBRVg7O09BRUc7SUFDSCw2REFBUyxDQUFBO0FBQ1gsQ0FBQyxFQXhDVyxjQUFjLEtBQWQsY0FBYyxRQXdDekI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLG9CQWVYO0FBZkQsV0FBWSxvQkFBb0I7SUFDOUI7O09BRUc7SUFDSCxxRUFBTyxDQUFBO0lBRVA7O09BRUc7SUFDSCwyRUFBVSxDQUFBO0lBRVY7O09BRUc7SUFDSCx5RUFBUyxDQUFBO0FBQ1gsQ0FBQyxFQWZXLG9CQUFvQixLQUFwQixvQkFBb0IsUUFlL0IiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGRpZmZlcmVudCBraW5kcyBvZiBJUiBvcGVyYXRpb25zLlxuICpcbiAqIEluY2x1ZGVzIGJvdGggY3JlYXRpb24gYW5kIHVwZGF0ZSBvcGVyYXRpb25zLlxuICovXG5leHBvcnQgZW51bSBPcEtpbmQge1xuICAvKipcbiAgICogQSBzcGVjaWFsIG9wZXJhdGlvbiB0eXBlIHdoaWNoIGlzIHVzZWQgdG8gcmVwcmVzZW50IHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBub2RlcyBvZiBhIGxpbmtlZFxuICAgKiBsaXN0IG9mIG9wZXJhdGlvbnMuXG4gICAqL1xuICBMaXN0RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gd2hpY2ggd3JhcHMgYW4gb3V0cHV0IEFTVCBzdGF0ZW1lbnQuXG4gICAqL1xuICBTdGF0ZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbmQgaW5pdGlhbGl6ZXMgYSBgU2VtYW50aWNWYXJpYWJsZWAuXG4gICAqL1xuICBWYXJpYWJsZSxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIHRvIGJlZ2luIHJlbmRlcmluZyBvZiBhbiBlbGVtZW50LlxuICAgKi9cbiAgRWxlbWVudFN0YXJ0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGFuIGVsZW1lbnQgd2l0aCBubyBjaGlsZHJlbi5cbiAgICovXG4gIEVsZW1lbnQsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB3aGljaCBkZWNsYXJlcyBhbiBlbWJlZGRlZCB2aWV3LlxuICAgKi9cbiAgVGVtcGxhdGUsXG5cbiAgLyoqXG4gICAqIEFuIG9wZXJhdGlvbiB0byBlbmQgcmVuZGVyaW5nIG9mIGFuIGVsZW1lbnQgcHJldmlvdXNseSBzdGFydGVkIHdpdGggYEVsZW1lbnRTdGFydGAuXG4gICAqL1xuICBFbGVtZW50RW5kLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gcmVuZGVyIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgVGV4dCxcblxuICAvKipcbiAgICogQW4gb3BlcmF0aW9uIGRlY2xhcmluZyBhbiBldmVudCBsaXN0ZW5lciBmb3IgYW4gZWxlbWVudC5cbiAgICovXG4gIExpc3RlbmVyLFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gaW50ZXJwb2xhdGUgdGV4dCBpbnRvIGEgdGV4dCBub2RlLlxuICAgKi9cbiAgSW50ZXJwb2xhdGVUZXh0LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYmluZCBhbiBleHByZXNzaW9uIHRvIGEgcHJvcGVydHkgb2YgYW4gZWxlbWVudC5cbiAgICovXG4gIFByb3BlcnR5LFxuXG4gIC8qKlxuICAgKiBBbiBvcGVyYXRpb24gdG8gYWR2YW5jZSB0aGUgcnVudGltZSdzIGltcGxpY2l0IHNsb3QgY29udGV4dCBkdXJpbmcgdGhlIHVwZGF0ZSBwaGFzZSBvZiBhIHZpZXcuXG4gICAqL1xuICBBZHZhbmNlLFxufVxuXG4vKipcbiAqIERpc3Rpbmd1aXNoZXMgZGlmZmVyZW50IGtpbmRzIG9mIElSIGV4cHJlc3Npb25zLlxuICovXG5leHBvcnQgZW51bSBFeHByZXNzaW9uS2luZCB7XG4gIC8qKlxuICAgKiBSZWFkIG9mIGEgdmFyaWFibGUgaW4gYSBsZXhpY2FsIHNjb3BlLlxuICAgKi9cbiAgTGV4aWNhbFJlYWQsXG5cbiAgLyoqXG4gICAqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIENvbnRleHQsXG5cbiAgLyoqXG4gICAqIFJlYWQgb2YgYSB2YXJpYWJsZSBkZWNsYXJlZCBpbiBhIGBWYXJpYWJsZU9wYC5cbiAgICovXG4gIFJlYWRWYXJpYWJsZSxcblxuICAvKipcbiAgICogUnVudGltZSBvcGVyYXRpb24gdG8gbmF2aWdhdGUgdG8gdGhlIG5leHQgdmlldyBjb250ZXh0IGluIHRoZSB2aWV3IGhpZXJhcmNoeS5cbiAgICovXG4gIE5leHRDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXRyaWV2ZSB0aGUgdmFsdWUgb2YgYSBsb2NhbCByZWZlcmVuY2UuXG4gICAqL1xuICBSZWZlcmVuY2UsXG5cbiAgLyoqXG4gICAqIFJ1bnRpbWUgb3BlcmF0aW9uIHRvIHNuYXBzaG90IHRoZSBjdXJyZW50IHZpZXcgY29udGV4dC5cbiAgICovXG4gIEdldEN1cnJlbnRWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXN0b3JlIGEgc25hcHNob3R0ZWQgdmlldy5cbiAgICovXG4gIFJlc3RvcmVWaWV3LFxuXG4gIC8qKlxuICAgKiBSdW50aW1lIG9wZXJhdGlvbiB0byByZXNldCB0aGUgY3VycmVudCB2aWV3IGNvbnRleHQgYWZ0ZXIgYFJlc3RvcmVWaWV3YC5cbiAgICovXG4gIFJlc2V0Vmlldyxcbn1cblxuLyoqXG4gKiBEaXN0aW5ndWlzaGVzIGJldHdlZW4gZGlmZmVyZW50IGtpbmRzIG9mIGBTZW1hbnRpY1ZhcmlhYmxlYHMuXG4gKi9cbmV4cG9ydCBlbnVtIFNlbWFudGljVmFyaWFibGVLaW5kIHtcbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIGNvbnRleHQgb2YgYSBwYXJ0aWN1bGFyIHZpZXcuXG4gICAqL1xuICBDb250ZXh0LFxuXG4gIC8qKlxuICAgKiBSZXByZXNlbnRzIGFuIGlkZW50aWZpZXIgZGVjbGFyZWQgaW4gdGhlIGxleGljYWwgc2NvcGUgb2YgYSB2aWV3LlxuICAgKi9cbiAgSWRlbnRpZmllcixcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIHNhdmVkIHN0YXRlIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVzdG9yZSBhIHZpZXcgaW4gYSBsaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKi9cbiAgU2F2ZWRWaWV3LFxufVxuIl19