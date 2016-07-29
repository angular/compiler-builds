import * as html from '../html_parser/ast';
import { InterpolationConfig } from '../html_parser/interpolation_config';
import * as i18n from './i18n_ast';
/**
 * Extract all the i18n messages from a component template.
 */
export declare function extractI18nMessages(sourceAst: html.Node[], interpolationConfig: InterpolationConfig, implicitTags: string[], implicitAttrs: {
    [k: string]: string[];
}): i18n.Message[];
