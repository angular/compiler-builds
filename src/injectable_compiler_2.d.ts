import * as o from './output/output_ast';
export interface InjectableDef {
    expression: o.Expression;
    type: o.Type;
}
export interface IvyInjectableDep {
    token: o.Expression;
    optional: boolean;
    self: boolean;
    skipSelf: boolean;
}
export interface IvyInjectableMetadata {
    name: string;
    type: o.Expression;
    providedIn: o.Expression;
    useType?: IvyInjectableDep[];
    useClass?: o.Expression;
    useFactory?: {
        factory: o.Expression;
        deps: IvyInjectableDep[];
    };
    useExisting?: o.Expression;
    useValue?: o.Expression;
}
export declare function compileIvyInjectable(meta: IvyInjectableMetadata): InjectableDef;
