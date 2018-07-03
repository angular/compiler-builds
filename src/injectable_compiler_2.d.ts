import * as o from './output/output_ast';
import { R3DependencyMetadata } from './render3/r3_factory';
export interface InjectableDef {
    expression: o.Expression;
    type: o.Type;
}
export interface R3InjectableMetadata {
    name: string;
    type: o.Expression;
    providedIn: o.Expression;
    useClass?: o.Expression;
    useFactory?: o.Expression;
    useExisting?: o.Expression;
    useValue?: o.Expression;
    deps?: R3DependencyMetadata[];
}
export declare function compileInjectable(meta: R3InjectableMetadata): InjectableDef;
