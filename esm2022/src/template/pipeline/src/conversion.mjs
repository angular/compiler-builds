/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as o from '../../../output/output_ast';
export const BINARY_OPERATORS = new Map([
    ['&&', o.BinaryOperator.And],
    ['>', o.BinaryOperator.Bigger],
    ['>=', o.BinaryOperator.BiggerEquals],
    ['&', o.BinaryOperator.BitwiseAnd],
    ['/', o.BinaryOperator.Divide],
    ['==', o.BinaryOperator.Equals],
    ['===', o.BinaryOperator.Identical],
    ['<', o.BinaryOperator.Lower],
    ['<=', o.BinaryOperator.LowerEquals],
    ['-', o.BinaryOperator.Minus],
    ['%', o.BinaryOperator.Modulo],
    ['*', o.BinaryOperator.Multiply],
    ['!=', o.BinaryOperator.NotEquals],
    ['!==', o.BinaryOperator.NotIdentical],
    ['??', o.BinaryOperator.NullishCoalesce],
    ['||', o.BinaryOperator.Or],
    ['+', o.BinaryOperator.Plus],
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVyc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy90ZW1wbGF0ZS9waXBlbGluZS9zcmMvY29udmVyc2lvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEtBQUssQ0FBQyxNQUFNLDRCQUE0QixDQUFDO0FBRWhELE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3RDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDO0lBQzVCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQzlCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDO0lBQ3JDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDO0lBQ2xDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQzlCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQy9CLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQ25DLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO0lBQzdCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDO0lBQ3BDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO0lBQzdCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQzlCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDO0lBQ2hDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQ2xDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDO0lBQ3RDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDO0lBQ3hDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO0lBQzNCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO0NBQzdCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcblxuZXhwb3J0IGNvbnN0IEJJTkFSWV9PUEVSQVRPUlMgPSBuZXcgTWFwKFtcbiAgWycmJicsIG8uQmluYXJ5T3BlcmF0b3IuQW5kXSxcbiAgWyc+Jywgby5CaW5hcnlPcGVyYXRvci5CaWdnZXJdLFxuICBbJz49Jywgby5CaW5hcnlPcGVyYXRvci5CaWdnZXJFcXVhbHNdLFxuICBbJyYnLCBvLkJpbmFyeU9wZXJhdG9yLkJpdHdpc2VBbmRdLFxuICBbJy8nLCBvLkJpbmFyeU9wZXJhdG9yLkRpdmlkZV0sXG4gIFsnPT0nLCBvLkJpbmFyeU9wZXJhdG9yLkVxdWFsc10sXG4gIFsnPT09Jywgby5CaW5hcnlPcGVyYXRvci5JZGVudGljYWxdLFxuICBbJzwnLCBvLkJpbmFyeU9wZXJhdG9yLkxvd2VyXSxcbiAgWyc8PScsIG8uQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHNdLFxuICBbJy0nLCBvLkJpbmFyeU9wZXJhdG9yLk1pbnVzXSxcbiAgWyclJywgby5CaW5hcnlPcGVyYXRvci5Nb2R1bG9dLFxuICBbJyonLCBvLkJpbmFyeU9wZXJhdG9yLk11bHRpcGx5XSxcbiAgWychPScsIG8uQmluYXJ5T3BlcmF0b3IuTm90RXF1YWxzXSxcbiAgWychPT0nLCBvLkJpbmFyeU9wZXJhdG9yLk5vdElkZW50aWNhbF0sXG4gIFsnPz8nLCBvLkJpbmFyeU9wZXJhdG9yLk51bGxpc2hDb2FsZXNjZV0sXG4gIFsnfHwnLCBvLkJpbmFyeU9wZXJhdG9yLk9yXSxcbiAgWycrJywgby5CaW5hcnlPcGVyYXRvci5QbHVzXSxcbl0pO1xuIl19