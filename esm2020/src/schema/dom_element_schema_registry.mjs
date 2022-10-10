/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, SecurityContext } from '../core';
import { isNgContainer, isNgContent } from '../ml_parser/tags';
import { dashCaseToCamelCase } from '../util';
import { SECURITY_SCHEMA } from './dom_security_schema';
import { ElementSchemaRegistry } from './element_schema_registry';
const BOOLEAN = 'boolean';
const NUMBER = 'number';
const STRING = 'string';
const OBJECT = 'object';
/**
 * This array represents the DOM schema. It encodes inheritance, properties, and events.
 *
 * ## Overview
 *
 * Each line represents one kind of element. The `element_inheritance` and properties are joined
 * using `element_inheritance|properties` syntax.
 *
 * ## Element Inheritance
 *
 * The `element_inheritance` can be further subdivided as `element1,element2,...^parentElement`.
 * Here the individual elements are separated by `,` (commas). Every element in the list
 * has identical properties.
 *
 * An `element` may inherit additional properties from `parentElement` If no `^parentElement` is
 * specified then `""` (blank) element is assumed.
 *
 * NOTE: The blank element inherits from root `[Element]` element, the super element of all
 * elements.
 *
 * NOTE an element prefix such as `:svg:` has no special meaning to the schema.
 *
 * ## Properties
 *
 * Each element has a set of properties separated by `,` (commas). Each property can be prefixed
 * by a special character designating its type:
 *
 * - (no prefix): property is a string.
 * - `*`: property represents an event.
 * - `!`: property is a boolean.
 * - `#`: property is a number.
 * - `%`: property is an object.
 *
 * ## Query
 *
 * The class creates an internal squas representation which allows to easily answer the query of
 * if a given property exist on a given element.
 *
 * NOTE: We don't yet support querying for types or events.
 * NOTE: This schema is auto extracted from `schema_extractor.ts` located in the test folder,
 *       see dom_element_schema_registry_spec.ts
 */
// =================================================================================================
// =================================================================================================
// =========== S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P  ===========
// =================================================================================================
// =================================================================================================
//
//                       DO NOT EDIT THIS DOM SCHEMA WITHOUT A SECURITY REVIEW!
//
// Newly added properties must be security reviewed and assigned an appropriate SecurityContext in
// dom_security_schema.ts. Reach out to mprobst & rjamet for details.
//
// =================================================================================================
const SCHEMA = [
    '[Element]|textContent,%ariaAtomic,%ariaAutoComplete,%ariaBusy,%ariaChecked,%ariaColCount,%ariaColIndex,%ariaColSpan,%ariaCurrent,%ariaDescription,%ariaDisabled,%ariaExpanded,%ariaHasPopup,%ariaHidden,%ariaKeyShortcuts,%ariaLabel,%ariaLevel,%ariaLive,%ariaModal,%ariaMultiLine,%ariaMultiSelectable,%ariaOrientation,%ariaPlaceholder,%ariaPosInSet,%ariaPressed,%ariaReadOnly,%ariaRelevant,%ariaRequired,%ariaRoleDescription,%ariaRowCount,%ariaRowIndex,%ariaRowSpan,%ariaSelected,%ariaSetSize,%ariaSort,%ariaValueMax,%ariaValueMin,%ariaValueNow,%ariaValueText,%classList,className,elementTiming,id,innerHTML,*beforecopy,*beforecut,*beforepaste,*fullscreenchange,*fullscreenerror,*search,*webkitfullscreenchange,*webkitfullscreenerror,outerHTML,%part,#scrollLeft,#scrollTop,slot' +
        /* added manually to avoid breaking changes */
        ',*message,*mozfullscreenchange,*mozfullscreenerror,*mozpointerlockchange,*mozpointerlockerror,*webglcontextcreationerror,*webglcontextlost,*webglcontextrestored',
    '[HTMLElement]^[Element]|accessKey,autocapitalize,!autofocus,contentEditable,dir,!draggable,enterKeyHint,!hidden,innerText,inputMode,lang,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,outerText,!spellcheck,%style,#tabIndex,title,!translate,virtualKeyboardPolicy',
    'abbr,address,article,aside,b,bdi,bdo,cite,code,dd,dfn,dt,em,figcaption,figure,footer,header,hgroup,i,kbd,main,mark,nav,noscript,rb,rp,rt,rtc,ruby,s,samp,section,small,strong,sub,sup,u,var,wbr^[HTMLElement]|accessKey,autocapitalize,!autofocus,contentEditable,dir,!draggable,enterKeyHint,!hidden,innerText,inputMode,lang,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,outerText,!spellcheck,%style,#tabIndex,title,!translate,virtualKeyboardPolicy',
    'media^[HTMLElement]|!autoplay,!controls,%controlsList,%crossOrigin,#currentTime,!defaultMuted,#defaultPlaybackRate,!disableRemotePlayback,!loop,!muted,*encrypted,*waitingforkey,#playbackRate,preload,!preservesPitch,src,%srcObject,#volume',
    ':svg:^[HTMLElement]|!autofocus,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,%style,#tabIndex',
    ':svg:graphics^:svg:|',
    ':svg:animation^:svg:|*begin,*end,*repeat',
    ':svg:geometry^:svg:|',
    ':svg:componentTransferFunction^:svg:|',
    ':svg:gradient^:svg:|',
    ':svg:textContent^:svg:graphics|',
    ':svg:textPositioning^:svg:textContent|',
    'a^[HTMLElement]|charset,coords,download,hash,host,hostname,href,hreflang,name,password,pathname,ping,port,protocol,referrerPolicy,rel,%relList,rev,search,shape,target,text,type,username',
    'area^[HTMLElement]|alt,coords,download,hash,host,hostname,href,!noHref,password,pathname,ping,port,protocol,referrerPolicy,rel,%relList,search,shape,target,username',
    'audio^media|',
    'br^[HTMLElement]|clear',
    'base^[HTMLElement]|href,target',
    'body^[HTMLElement]|aLink,background,bgColor,link,*afterprint,*beforeprint,*beforeunload,*blur,*error,*focus,*hashchange,*languagechange,*load,*message,*messageerror,*offline,*online,*pagehide,*pageshow,*popstate,*rejectionhandled,*resize,*scroll,*storage,*unhandledrejection,*unload,text,vLink',
    'button^[HTMLElement]|!disabled,formAction,formEnctype,formMethod,!formNoValidate,formTarget,name,type,value',
    'canvas^[HTMLElement]|#height,#width',
    'dl^[HTMLElement]|!compact',
    'data^[HTMLElement]|value',
    'datalist^[HTMLElement]|',
    'details^[HTMLElement]|!open',
    'dialog^[HTMLElement]|!open,returnValue',
    'dir^[HTMLElement]|!compact',
    'div^[HTMLElement]|align',
    'embed^[HTMLElement]|align,height,name,src,type,width',
    'fieldset^[HTMLElement]|!disabled,name',
    'font^[HTMLElement]|color,face,size',
    'form^[HTMLElement]|acceptCharset,action,autocomplete,encoding,enctype,method,name,!noValidate,target',
    'frame^[HTMLElement]|frameBorder,longDesc,marginHeight,marginWidth,name,!noResize,scrolling,src',
    'frameset^[HTMLElement]|cols,*afterprint,*beforeprint,*beforeunload,*blur,*error,*focus,*hashchange,*languagechange,*load,*message,*messageerror,*offline,*online,*pagehide,*pageshow,*popstate,*rejectionhandled,*resize,*scroll,*storage,*unhandledrejection,*unload,rows',
    'hr^[HTMLElement]|align,color,!noShade,size,width',
    'head^[HTMLElement]|',
    'h1,h2,h3,h4,h5,h6^[HTMLElement]|align',
    'html^[HTMLElement]|version',
    'iframe^[HTMLElement]|align,allow,!allowFullscreen,!allowPaymentRequest,csp,frameBorder,height,loading,longDesc,marginHeight,marginWidth,name,referrerPolicy,%sandbox,scrolling,src,srcdoc,width',
    'img^[HTMLElement]|align,alt,border,%crossOrigin,decoding,#height,#hspace,!isMap,loading,longDesc,lowsrc,name,referrerPolicy,sizes,src,srcset,useMap,#vspace,#width',
    'input^[HTMLElement]|accept,align,alt,autocomplete,!checked,!defaultChecked,defaultValue,dirName,!disabled,%files,formAction,formEnctype,formMethod,!formNoValidate,formTarget,#height,!incremental,!indeterminate,max,#maxLength,min,#minLength,!multiple,name,pattern,placeholder,!readOnly,!required,selectionDirection,#selectionEnd,#selectionStart,#size,src,step,type,useMap,value,%valueAsDate,#valueAsNumber,#width',
    'li^[HTMLElement]|type,#value',
    'label^[HTMLElement]|htmlFor',
    'legend^[HTMLElement]|align',
    'link^[HTMLElement]|as,charset,%crossOrigin,!disabled,href,hreflang,imageSizes,imageSrcset,integrity,media,referrerPolicy,rel,%relList,rev,%sizes,target,type',
    'map^[HTMLElement]|name',
    'marquee^[HTMLElement]|behavior,bgColor,direction,height,#hspace,#loop,#scrollAmount,#scrollDelay,!trueSpeed,#vspace,width',
    'menu^[HTMLElement]|!compact',
    'meta^[HTMLElement]|content,httpEquiv,media,name,scheme',
    'meter^[HTMLElement]|#high,#low,#max,#min,#optimum,#value',
    'ins,del^[HTMLElement]|cite,dateTime',
    'ol^[HTMLElement]|!compact,!reversed,#start,type',
    'object^[HTMLElement]|align,archive,border,code,codeBase,codeType,data,!declare,height,#hspace,name,standby,type,useMap,#vspace,width',
    'optgroup^[HTMLElement]|!disabled,label',
    'option^[HTMLElement]|!defaultSelected,!disabled,label,!selected,text,value',
    'output^[HTMLElement]|defaultValue,%htmlFor,name,value',
    'p^[HTMLElement]|align',
    'param^[HTMLElement]|name,type,value,valueType',
    'picture^[HTMLElement]|',
    'pre^[HTMLElement]|#width',
    'progress^[HTMLElement]|#max,#value',
    'q,blockquote,cite^[HTMLElement]|',
    'script^[HTMLElement]|!async,charset,%crossOrigin,!defer,event,htmlFor,integrity,!noModule,%referrerPolicy,src,text,type',
    'select^[HTMLElement]|autocomplete,!disabled,#length,!multiple,name,!required,#selectedIndex,#size,value',
    'slot^[HTMLElement]|name',
    'source^[HTMLElement]|#height,media,sizes,src,srcset,type,#width',
    'span^[HTMLElement]|',
    'style^[HTMLElement]|!disabled,media,type',
    'caption^[HTMLElement]|align',
    'th,td^[HTMLElement]|abbr,align,axis,bgColor,ch,chOff,#colSpan,headers,height,!noWrap,#rowSpan,scope,vAlign,width',
    'col,colgroup^[HTMLElement]|align,ch,chOff,#span,vAlign,width',
    'table^[HTMLElement]|align,bgColor,border,%caption,cellPadding,cellSpacing,frame,rules,summary,%tFoot,%tHead,width',
    'tr^[HTMLElement]|align,bgColor,ch,chOff,vAlign',
    'tfoot,thead,tbody^[HTMLElement]|align,ch,chOff,vAlign',
    'template^[HTMLElement]|',
    'textarea^[HTMLElement]|autocomplete,#cols,defaultValue,dirName,!disabled,#maxLength,#minLength,name,placeholder,!readOnly,!required,#rows,selectionDirection,#selectionEnd,#selectionStart,value,wrap',
    'time^[HTMLElement]|dateTime',
    'title^[HTMLElement]|text',
    'track^[HTMLElement]|!default,kind,label,src,srclang',
    'ul^[HTMLElement]|!compact,type',
    'unknown^[HTMLElement]|',
    'video^media|!disablePictureInPicture,#height,*enterpictureinpicture,*leavepictureinpicture,!playsInline,poster,#width',
    ':svg:a^:svg:graphics|',
    ':svg:animate^:svg:animation|',
    ':svg:animateMotion^:svg:animation|',
    ':svg:animateTransform^:svg:animation|',
    ':svg:circle^:svg:geometry|',
    ':svg:clipPath^:svg:graphics|',
    ':svg:defs^:svg:graphics|',
    ':svg:desc^:svg:|',
    ':svg:ellipse^:svg:geometry|',
    ':svg:feBlend^:svg:|',
    ':svg:feColorMatrix^:svg:|',
    ':svg:feComponentTransfer^:svg:|',
    ':svg:feComposite^:svg:|',
    ':svg:feConvolveMatrix^:svg:|',
    ':svg:feDiffuseLighting^:svg:|',
    ':svg:feDisplacementMap^:svg:|',
    ':svg:feDistantLight^:svg:|',
    ':svg:feDropShadow^:svg:|',
    ':svg:feFlood^:svg:|',
    ':svg:feFuncA^:svg:componentTransferFunction|',
    ':svg:feFuncB^:svg:componentTransferFunction|',
    ':svg:feFuncG^:svg:componentTransferFunction|',
    ':svg:feFuncR^:svg:componentTransferFunction|',
    ':svg:feGaussianBlur^:svg:|',
    ':svg:feImage^:svg:|',
    ':svg:feMerge^:svg:|',
    ':svg:feMergeNode^:svg:|',
    ':svg:feMorphology^:svg:|',
    ':svg:feOffset^:svg:|',
    ':svg:fePointLight^:svg:|',
    ':svg:feSpecularLighting^:svg:|',
    ':svg:feSpotLight^:svg:|',
    ':svg:feTile^:svg:|',
    ':svg:feTurbulence^:svg:|',
    ':svg:filter^:svg:|',
    ':svg:foreignObject^:svg:graphics|',
    ':svg:g^:svg:graphics|',
    ':svg:image^:svg:graphics|decoding',
    ':svg:line^:svg:geometry|',
    ':svg:linearGradient^:svg:gradient|',
    ':svg:mpath^:svg:|',
    ':svg:marker^:svg:|',
    ':svg:mask^:svg:|',
    ':svg:metadata^:svg:|',
    ':svg:path^:svg:geometry|',
    ':svg:pattern^:svg:|',
    ':svg:polygon^:svg:geometry|',
    ':svg:polyline^:svg:geometry|',
    ':svg:radialGradient^:svg:gradient|',
    ':svg:rect^:svg:geometry|',
    ':svg:svg^:svg:graphics|#currentScale,#zoomAndPan',
    ':svg:script^:svg:|type',
    ':svg:set^:svg:animation|',
    ':svg:stop^:svg:|',
    ':svg:style^:svg:|!disabled,media,title,type',
    ':svg:switch^:svg:graphics|',
    ':svg:symbol^:svg:|',
    ':svg:tspan^:svg:textPositioning|',
    ':svg:text^:svg:textPositioning|',
    ':svg:textPath^:svg:textContent|',
    ':svg:title^:svg:|',
    ':svg:use^:svg:graphics|',
    ':svg:view^:svg:|#zoomAndPan',
    'keygen^[HTMLElement]|!autofocus,challenge,!disabled,form,keytype,name',
    'menuitem^[HTMLElement]|type,label,icon,!disabled,!checked,radiogroup,!default',
    'summary^[HTMLElement]|',
    ':svg:cursor^:svg:|',
];
const _ATTR_TO_PROP = new Map(Object.entries({
    'class': 'className',
    'for': 'htmlFor',
    'formaction': 'formAction',
    'innerHtml': 'innerHTML',
    'readonly': 'readOnly',
    'tabindex': 'tabIndex',
}));
// Invert _ATTR_TO_PROP.
const _PROP_TO_ATTR = Array.from(_ATTR_TO_PROP).reduce((inverted, [propertyName, attributeName]) => {
    inverted.set(propertyName, attributeName);
    return inverted;
}, new Map());
export class DomElementSchemaRegistry extends ElementSchemaRegistry {
    constructor() {
        super();
        this._schema = new Map();
        // We don't allow binding to events for security reasons. Allowing event bindings would almost
        // certainly introduce bad XSS vulnerabilities. Instead, we store events in a separate schema.
        this._eventSchema = new Map;
        SCHEMA.forEach(encodedType => {
            const type = new Map();
            const events = new Set();
            const [strType, strProperties] = encodedType.split('|');
            const properties = strProperties.split(',');
            const [typeNames, superName] = strType.split('^');
            typeNames.split(',').forEach(tag => {
                this._schema.set(tag.toLowerCase(), type);
                this._eventSchema.set(tag.toLowerCase(), events);
            });
            const superType = superName && this._schema.get(superName.toLowerCase());
            if (superType) {
                for (const [prop, value] of superType) {
                    type.set(prop, value);
                }
                for (const superEvent of this._eventSchema.get(superName.toLowerCase())) {
                    events.add(superEvent);
                }
            }
            properties.forEach((property) => {
                if (property.length > 0) {
                    switch (property[0]) {
                        case '*':
                            events.add(property.substring(1));
                            break;
                        case '!':
                            type.set(property.substring(1), BOOLEAN);
                            break;
                        case '#':
                            type.set(property.substring(1), NUMBER);
                            break;
                        case '%':
                            type.set(property.substring(1), OBJECT);
                            break;
                        default:
                            type.set(property, STRING);
                    }
                }
            });
        });
    }
    hasProperty(tagName, propName, schemaMetas) {
        if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
            return true;
        }
        if (tagName.indexOf('-') > -1) {
            if (isNgContainer(tagName) || isNgContent(tagName)) {
                return false;
            }
            if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
                // Can't tell now as we don't know which properties a custom element will get
                // once it is instantiated
                return true;
            }
        }
        const elementProperties = this._schema.get(tagName.toLowerCase()) || this._schema.get('unknown');
        return elementProperties.has(propName);
    }
    hasElement(tagName, schemaMetas) {
        if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
            return true;
        }
        if (tagName.indexOf('-') > -1) {
            if (isNgContainer(tagName) || isNgContent(tagName)) {
                return true;
            }
            if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
                // Allow any custom elements
                return true;
            }
        }
        return this._schema.has(tagName.toLowerCase());
    }
    /**
     * securityContext returns the security context for the given property on the given DOM tag.
     *
     * Tag and property name are statically known and cannot change at runtime, i.e. it is not
     * possible to bind a value into a changing attribute or tag name.
     *
     * The filtering is based on a list of allowed tags|attributes. All attributes in the schema
     * above are assumed to have the 'NONE' security context, i.e. that they are safe inert
     * string values. Only specific well known attack vectors are assigned their appropriate context.
     */
    securityContext(tagName, propName, isAttribute) {
        if (isAttribute) {
            // NB: For security purposes, use the mapped property name, not the attribute name.
            propName = this.getMappedPropName(propName);
        }
        // Make sure comparisons are case insensitive, so that case differences between attribute and
        // property names do not have a security impact.
        tagName = tagName.toLowerCase();
        propName = propName.toLowerCase();
        let ctx = SECURITY_SCHEMA()[tagName + '|' + propName];
        if (ctx) {
            return ctx;
        }
        ctx = SECURITY_SCHEMA()['*|' + propName];
        return ctx ? ctx : SecurityContext.NONE;
    }
    getMappedPropName(propName) {
        return _ATTR_TO_PROP.get(propName) ?? propName;
    }
    getDefaultComponentElementName() {
        return 'ng-component';
    }
    validateProperty(name) {
        if (name.toLowerCase().startsWith('on')) {
            const msg = `Binding to event property '${name}' is disallowed for security reasons, ` +
                `please use (${name.slice(2)})=...` +
                `\nIf '${name}' is a directive input, make sure the directive is imported by the` +
                ` current module.`;
            return { error: true, msg: msg };
        }
        else {
            return { error: false };
        }
    }
    validateAttribute(name) {
        if (name.toLowerCase().startsWith('on')) {
            const msg = `Binding to event attribute '${name}' is disallowed for security reasons, ` +
                `please use (${name.slice(2)})=...`;
            return { error: true, msg: msg };
        }
        else {
            return { error: false };
        }
    }
    allKnownElementNames() {
        return Array.from(this._schema.keys());
    }
    allKnownAttributesOfElement(tagName) {
        const elementProperties = this._schema.get(tagName.toLowerCase()) || this._schema.get('unknown');
        // Convert properties to attributes.
        return Array.from(elementProperties.keys()).map(prop => _PROP_TO_ATTR.get(prop) ?? prop);
    }
    allKnownEventsOfElement(tagName) {
        return Array.from(this._eventSchema.get(tagName.toLowerCase()) ?? []);
    }
    normalizeAnimationStyleProperty(propName) {
        return dashCaseToCamelCase(propName);
    }
    normalizeAnimationStyleValue(camelCaseProp, userProvidedProp, val) {
        let unit = '';
        const strVal = val.toString().trim();
        let errorMsg = null;
        if (_isPixelDimensionStyle(camelCaseProp) && val !== 0 && val !== '0') {
            if (typeof val === 'number') {
                unit = 'px';
            }
            else {
                const valAndSuffixMatch = val.match(/^[+-]?[\d\.]+([a-z]*)$/);
                if (valAndSuffixMatch && valAndSuffixMatch[1].length == 0) {
                    errorMsg = `Please provide a CSS unit value for ${userProvidedProp}:${val}`;
                }
            }
        }
        return { error: errorMsg, value: strVal + unit };
    }
}
function _isPixelDimensionStyle(prop) {
    switch (prop) {
        case 'width':
        case 'height':
        case 'minWidth':
        case 'minHeight':
        case 'maxWidth':
        case 'maxHeight':
        case 'left':
        case 'top':
        case 'bottom':
        case 'right':
        case 'fontSize':
        case 'outlineWidth':
        case 'outlineOffset':
        case 'paddingTop':
        case 'paddingLeft':
        case 'paddingBottom':
        case 'paddingRight':
        case 'marginTop':
        case 'marginLeft':
        case 'marginBottom':
        case 'marginRight':
        case 'borderRadius':
        case 'borderWidth':
        case 'borderTopWidth':
        case 'borderLeftWidth':
        case 'borderRightWidth':
        case 'borderBottomWidth':
        case 'textIndent':
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGdCQUFnQixFQUFrQixlQUFlLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDbEcsT0FBTyxFQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFNUMsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3RELE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRWhFLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQztBQUMxQixNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDeEIsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBQ3hCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F5Q0c7QUFFSCxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLEVBQUU7QUFDRiwrRUFBK0U7QUFDL0UsRUFBRTtBQUNGLGtHQUFrRztBQUNsRyxxRUFBcUU7QUFDckUsRUFBRTtBQUNGLG9HQUFvRztBQUVwRyxNQUFNLE1BQU0sR0FBYTtJQUN2Qix1d0JBQXV3QjtRQUNud0IsOENBQThDO1FBQzlDLGtLQUFrSztJQUN0SyxndkNBQWd2QztJQUNodkMsczZDQUFzNkM7SUFDdDZDLCtPQUErTztJQUMvTyx5a0NBQXlrQztJQUN6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ckIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxlQUFlLENBQUM7UUFDckIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxXQUFXLENBQUM7UUFDakIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxnQkFBZ0IsQ0FBQztRQUN0QixLQUFLLGlCQUFpQixDQUFDO1FBQ3ZCLEtBQUssa0JBQWtCLENBQUM7UUFDeEIsS0FBSyxtQkFBbUIsQ0FBQztRQUN6QixLQUFLLFlBQVk7WUFDZixPQUFPLElBQUksQ0FBQztRQUVkO1lBQ0UsT0FBTyxLQUFLLENBQUM7S0FDaEI7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q1VTVE9NX0VMRU1FTlRTX1NDSEVNQSwgTk9fRVJST1JTX1NDSEVNQSwgU2NoZW1hTWV0YWRhdGEsIFNlY3VyaXR5Q29udGV4dH0gZnJvbSAnLi4vY29yZSc7XG5pbXBvcnQge2lzTmdDb250YWluZXIsIGlzTmdDb250ZW50fSBmcm9tICcuLi9tbF9wYXJzZXIvdGFncyc7XG5pbXBvcnQge2Rhc2hDYXNlVG9DYW1lbENhc2V9IGZyb20gJy4uL3V0aWwnO1xuXG5pbXBvcnQge1NFQ1VSSVRZX1NDSEVNQX0gZnJvbSAnLi9kb21fc2VjdXJpdHlfc2NoZW1hJztcbmltcG9ydCB7RWxlbWVudFNjaGVtYVJlZ2lzdHJ5fSBmcm9tICcuL2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5JztcblxuY29uc3QgQk9PTEVBTiA9ICdib29sZWFuJztcbmNvbnN0IE5VTUJFUiA9ICdudW1iZXInO1xuY29uc3QgU1RSSU5HID0gJ3N0cmluZyc7XG5jb25zdCBPQkpFQ1QgPSAnb2JqZWN0JztcblxuLyoqXG4gKiBUaGlzIGFycmF5IHJlcHJlc2VudHMgdGhlIERPTSBzY2hlbWEuIEl0IGVuY29kZXMgaW5oZXJpdGFuY2UsIHByb3BlcnRpZXMsIGFuZCBldmVudHMuXG4gKlxuICogIyMgT3ZlcnZpZXdcbiAqXG4gKiBFYWNoIGxpbmUgcmVwcmVzZW50cyBvbmUga2luZCBvZiBlbGVtZW50LiBUaGUgYGVsZW1lbnRfaW5oZXJpdGFuY2VgIGFuZCBwcm9wZXJ0aWVzIGFyZSBqb2luZWRcbiAqIHVzaW5nIGBlbGVtZW50X2luaGVyaXRhbmNlfHByb3BlcnRpZXNgIHN5bnRheC5cbiAqXG4gKiAjIyBFbGVtZW50IEluaGVyaXRhbmNlXG4gKlxuICogVGhlIGBlbGVtZW50X2luaGVyaXRhbmNlYCBjYW4gYmUgZnVydGhlciBzdWJkaXZpZGVkIGFzIGBlbGVtZW50MSxlbGVtZW50MiwuLi5ecGFyZW50RWxlbWVudGAuXG4gKiBIZXJlIHRoZSBpbmRpdmlkdWFsIGVsZW1lbnRzIGFyZSBzZXBhcmF0ZWQgYnkgYCxgIChjb21tYXMpLiBFdmVyeSBlbGVtZW50IGluIHRoZSBsaXN0XG4gKiBoYXMgaWRlbnRpY2FsIHByb3BlcnRpZXMuXG4gKlxuICogQW4gYGVsZW1lbnRgIG1heSBpbmhlcml0IGFkZGl0aW9uYWwgcHJvcGVydGllcyBmcm9tIGBwYXJlbnRFbGVtZW50YCBJZiBubyBgXnBhcmVudEVsZW1lbnRgIGlzXG4gKiBzcGVjaWZpZWQgdGhlbiBgXCJcImAgKGJsYW5rKSBlbGVtZW50IGlzIGFzc3VtZWQuXG4gKlxuICogTk9URTogVGhlIGJsYW5rIGVsZW1lbnQgaW5oZXJpdHMgZnJvbSByb290IGBbRWxlbWVudF1gIGVsZW1lbnQsIHRoZSBzdXBlciBlbGVtZW50IG9mIGFsbFxuICogZWxlbWVudHMuXG4gKlxuICogTk9URSBhbiBlbGVtZW50IHByZWZpeCBzdWNoIGFzIGA6c3ZnOmAgaGFzIG5vIHNwZWNpYWwgbWVhbmluZyB0byB0aGUgc2NoZW1hLlxuICpcbiAqICMjIFByb3BlcnRpZXNcbiAqXG4gKiBFYWNoIGVsZW1lbnQgaGFzIGEgc2V0IG9mIHByb3BlcnRpZXMgc2VwYXJhdGVkIGJ5IGAsYCAoY29tbWFzKS4gRWFjaCBwcm9wZXJ0eSBjYW4gYmUgcHJlZml4ZWRcbiAqIGJ5IGEgc3BlY2lhbCBjaGFyYWN0ZXIgZGVzaWduYXRpbmcgaXRzIHR5cGU6XG4gKlxuICogLSAobm8gcHJlZml4KTogcHJvcGVydHkgaXMgYSBzdHJpbmcuXG4gKiAtIGAqYDogcHJvcGVydHkgcmVwcmVzZW50cyBhbiBldmVudC5cbiAqIC0gYCFgOiBwcm9wZXJ0eSBpcyBhIGJvb2xlYW4uXG4gKiAtIGAjYDogcHJvcGVydHkgaXMgYSBudW1iZXIuXG4gKiAtIGAlYDogcHJvcGVydHkgaXMgYW4gb2JqZWN0LlxuICpcbiAqICMjIFF1ZXJ5XG4gKlxuICogVGhlIGNsYXNzIGNyZWF0ZXMgYW4gaW50ZXJuYWwgc3F1YXMgcmVwcmVzZW50YXRpb24gd2hpY2ggYWxsb3dzIHRvIGVhc2lseSBhbnN3ZXIgdGhlIHF1ZXJ5IG9mXG4gKiBpZiBhIGdpdmVuIHByb3BlcnR5IGV4aXN0IG9uIGEgZ2l2ZW4gZWxlbWVudC5cbiAqXG4gKiBOT1RFOiBXZSBkb24ndCB5ZXQgc3VwcG9ydCBxdWVyeWluZyBmb3IgdHlwZXMgb3IgZXZlbnRzLlxuICogTk9URTogVGhpcyBzY2hlbWEgaXMgYXV0byBleHRyYWN0ZWQgZnJvbSBgc2NoZW1hX2V4dHJhY3Rvci50c2AgbG9jYXRlZCBpbiB0aGUgdGVzdCBmb2xkZXIsXG4gKiAgICAgICBzZWUgZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5X3NwZWMudHNcbiAqL1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PSBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgID09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gICAgICAgICAgICAgICAgICAgICAgIERPIE5PVCBFRElUIFRISVMgRE9NIFNDSEVNQSBXSVRIT1VUIEEgU0VDVVJJVFkgUkVWSUVXIVxuLy9cbi8vIE5ld2x5IGFkZGVkIHByb3BlcnRpZXMgbXVzdCBiZSBzZWN1cml0eSByZXZpZXdlZCBhbmQgYXNzaWduZWQgYW4gYXBwcm9wcmlhdGUgU2VjdXJpdHlDb250ZXh0IGluXG4vLyBkb21fc2VjdXJpdHlfc2NoZW1hLnRzLiBSZWFjaCBvdXQgdG8gbXByb2JzdCAmIHJqYW1ldCBmb3IgZGV0YWlscy5cbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IFNDSEVNQTogc3RyaW5nW10gPSBbXG4gICdbRWxlbWVudF18dGV4dENvbnRlbnQsJWFyaWFBdG9taWMsJWFyaWFBdXRvQ29tcGxldGUsJWFyaWFCdXN5LCVhcmlhQ2hlY2tlZCwlYXJpYUNvbENvdW50LCVhcmlhQ29sSW5kZXgsJWFyaWFDb2xTcGFuLCVhcmlhQ3VycmVudCwlYXJpYURlc2NyaXB0aW9uLCVhcmlhRGlzYWJsZWQsJWFyaWFFeHBhbmRlZCwlYXJpYUhhc1BvcHVwLCVhcmlhSGlkZGVuLCVhcmlhS2V5U2hvcnRjdXRzLCVhcmlhTGFiZWwsJWFyaWFMZXZlbCwlYXJpYUxpdmUsJWFyaWFNb2RhbCwlYXJpYU11bHRpTGluZSwlYXJpYU11bHRpU2VsZWN0YWJsZSwlYXJpYU9yaWVudGF0aW9uLCVhcmlhUGxhY2Vob2xkZXIsJWFyaWFQb3NJblNldCwlYXJpYVByZXNzZWQsJWFyaWFSZWFkT25seSwlYXJpYVJlbGV2YW50LCVhcmlhUmVxdWlyZWQsJWFyaWFSb2xlRGVzY3JpcHRpb24sJWFyaWFSb3dDb3VudCwlYXJpYVJvd0luZGV4LCVhcmlhUm93U3BhbiwlYXJpYVNlbGVjdGVkLCVhcmlhU2V0U2l6ZSwlYXJpYVNvcnQsJWFyaWFWYWx1ZU1heCwlYXJpYVZhbHVlTWluLCVhcmlhVmFsdWVOb3csJWFyaWFWYWx1ZVRleHQsJWNsYXNzTGlzdCxjbGFzc05hbWUsZWxlbWVudFRpbWluZyxpZCxpbm5lckhUTUwsKmJlZm9yZWNvcHksKmJlZm9yZWN1dCwqYmVmb3JlcGFzdGUsKmZ1bGxzY3JlZW5jaGFuZ2UsKmZ1bGxzY3JlZW5lcnJvciwqc2VhcmNoLCp3ZWJraXRmdWxsc2NyZWVuY2hhbmdlLCp3ZWJraXRmdWxsc2NyZWVuZXJyb3Isb3V0ZXJIVE1MLCVwYXJ0LCNzY3JvbGxMZWZ0LCNzY3JvbGxUb3Asc2xvdCcgK1xuICAgICAgLyogYWRkZWQgbWFudWFsbHkgdG8gYXZvaWQgYnJlYWtpbmcgY2hhbmdlcyAqL1xuICAgICAgJywqbWVzc2FnZSwqbW96ZnVsbHNjcmVlbmNoYW5nZSwqbW96ZnVsbHNjcmVlbmVycm9yLCptb3pwb2ludGVybG9ja2NoYW5nZSwqbW96cG9pbnRlcmxvY2tlcnJvciwqd2ViZ2xjb250ZXh0Y3JlYXRpb25lcnJvciwqd2ViZ2xjb250ZXh0bG9zdCwqd2ViZ2xjb250ZXh0cmVzdG9yZWQnLFxuICAnW0hUTUxFbGVtZW50XV5bRWxlbWVudF18YWNjZXNzS2V5LGF1dG9jYXBpdGFsaXplLCFhdXRvZm9jdXMsY29udGVudEVkaXRhYmxlLGRpciwhZHJhZ2dhYmxlLGVudGVyS2V5SGludCwhaGlkZGVuLGlubmVyVGV4dCxpbnB1dE1vZGUsbGFuZyxub25jZSwqYWJvcnQsKmFuaW1hdGlvbmVuZCwqYW5pbWF0aW9uaXRlcmF0aW9uLCphbmltYXRpb25zdGFydCwqYXV4Y2xpY2ssKmJlZm9yZXhyc2VsZWN0LCpibHVyLCpjYW5jZWwsKmNhbnBsYXksKmNhbnBsYXl0aHJvdWdoLCpjaGFuZ2UsKmNsaWNrLCpjbG9zZSwqY29udGV4dG1lbnUsKmNvcHksKmN1ZWNoYW5nZSwqY3V0LCpkYmxjbGljaywqZHJhZywqZHJhZ2VuZCwqZHJhZ2VudGVyLCpkcmFnbGVhdmUsKmRyYWdvdmVyLCpkcmFnc3RhcnQsKmRyb3AsKmR1cmF0aW9uY2hhbmdlLCplbXB0aWVkLCplbmRlZCwqZXJyb3IsKmZvY3VzLCpmb3JtZGF0YSwqZ290cG9pbnRlcmNhcHR1cmUsKmlucHV0LCppbnZhbGlkLCprZXlkb3duLCprZXlwcmVzcywqa2V5dXAsKmxvYWQsKmxvYWRlZGRhdGEsKmxvYWRlZG1ldGFkYXRhLCpsb2Fkc3RhcnQsKmxvc3Rwb2ludGVyY2FwdHVyZSwqbW91c2Vkb3duLCptb3VzZWVudGVyLCptb3VzZWxlYXZlLCptb3VzZW1vdmUsKm1vdXNlb3V0LCptb3VzZW92ZXIsKm1vdXNldXAsKm1vdXNld2hlZWwsKnBhc3RlLCpwYXVzZSwqcGxheSwqcGxheWluZywqcG9pbnRlcmNhbmNlbCwqcG9pbnRlcmRvd24sKnBvaW50ZXJlbnRlciwqcG9pbnRlcmxlYXZlLCpwb2ludGVybW92ZSwqcG9pbnRlcm91dCwqcG9pbnRlcm92ZXIsKnBvaW50ZXJyYXd1cGRhdGUsKnBvaW50ZXJ1cCwqcHJvZ3Jlc3MsKnJhdGVjaGFuZ2UsKnJlc2V0LCpyZXNpemUsKnNjcm9sbCwqc2VjdXJpdHlwb2xpY3l2aW9sYXRpb24sKnNlZWtlZCwqc2Vla2luZywqc2VsZWN0LCpzZWxlY3Rpb25jaGFuZ2UsKnNlbGVjdHN0YXJ0LCpzbG90Y2hhbmdlLCpzdGFsbGVkLCpzdWJtaXQsKnN1c3BlbmQsKnRpbWV1cGRhdGUsKnRvZ2dsZSwqdHJhbnNpdGlvbmNhbmNlbCwqdHJhbnNpdGlvbmVuZCwqdHJhbnNpdGlvbnJ1biwqdHJhbnNpdGlvbnN0YXJ0LCp2b2x1bWVjaGFuZ2UsKndhaXRpbmcsKndlYmtpdGFuaW1hdGlvbmVuZCwqd2Via2l0YW5pbWF0aW9uaXRlcmF0aW9uLCp3ZWJraXRhbmltYXRpb25zdGFydCwqd2Via2l0dHJhbnNpdGlvbmVuZCwqd2hlZWwsb3V0ZXJUZXh0LCFzcGVsbGNoZWNrLCVzdHlsZSwjdGFiSW5kZXgsdGl0bGUsIXRyYW5zbGF0ZSx2aXJ0dWFsS2V5Ym9hcmRQb2xpY3knLFxuICAnYWJicixhZGRyZXNzLGFydGljbGUsYXNpZGUsYixiZGksYmRvLGNpdGUsY29kZSxkZCxkZm4sZHQsZW0sZmlnY2FwdGlvbixmaWd1cmUsZm9vdGVyLGhlYWRlcixoZ3JvdXAsaSxrYmQsbWFpbixtYXJrLG5hdixub3NjcmlwdCxyYixycCxydCxydGMscnVieSxzLHNhbXAsc2VjdGlvbixzbWFsbCxzdHJvbmcsc3ViLHN1cCx1LHZhcix3YnJeW0hUTUxFbGVtZW50XXxhY2Nlc3NLZXksYXV0b2NhcGl0YWxpemUsIWF1dG9mb2N1cyxjb250ZW50RWRpdGFibGUsZGlyLCFkcmFnZ2FibGUsZW50ZXJLZXlIaW50LCFoaWRkZW4saW5uZXJUZXh0LGlucHV0TW9kZSxsYW5nLG5vbmNlLCphYm9ydCwqYW5pbWF0aW9uZW5kLCphbmltYXRpb25pdGVyYXRpb24sKmFuaW1hdGlvbnN0YXJ0LCphdXhjbGljaywqYmVmb3JleHJzZWxlY3QsKmJsdXIsKmNhbmNlbCwqY2FucGxheSwqY2FucGxheXRocm91Z2gsKmNoYW5nZSwqY2xpY2ssKmNsb3NlLCpjb250ZXh0bWVudSwqY29weSwqY3VlY2hhbmdlLCpjdXQsKmRibGNsaWNrLCpkcmFnLCpkcmFnZW5kLCpkcmFnZW50ZXIsKmRyYWdsZWF2ZSwqZHJhZ292ZXIsKmRyYWdzdGFydCwqZHJvcCwqZHVyYXRpb25jaGFuZ2UsKmVtcHRpZWQsKmVuZGVkLCplcnJvciwqZm9jdXMsKmZvcm1kYXRhLCpnb3Rwb2ludGVyY2FwdHVyZSwqaW5wdXQsKmludmFsaWQsKmtleWRvd24sKmtleXByZXNzLCprZXl1cCwqbG9hZCwqbG9hZGVkZGF0YSwqbG9hZGVkbWV0YWRhdGEsKmxvYWRzdGFydCwqbG9zdHBvaW50ZXJjYXB0dXJlLCptb3VzZWRvd24sKm1vdXNlZW50ZXIsKm1vdXNlbGVhdmUsKm1vdXNlbW92ZSwqbW91c2VvdXQsKm1vdXNlb3ZlciwqbW91c2V1cCwqbW91c2V3aGVlbCwqcGFzdGUsKnBhdXNlLCpwbGF5LCpwbGF5aW5nLCpwb2ludGVyY2FuY2VsLCpwb2ludGVyZG93biwqcG9pbnRlcmVudGVyLCpwb2ludGVybGVhdmUsKnBvaW50ZXJtb3ZlLCpwb2ludGVyb3V0LCpwb2ludGVyb3ZlciwqcG9pbnRlcnJhd3VwZGF0ZSwqcG9pbnRlcnVwLCpwcm9ncmVzcywqcmF0ZWNoYW5nZSwqcmVzZXQsKnJlc2l6ZSwqc2Nyb2xsLCpzZWN1cml0eXBvbGljeXZpb2xhdGlvbiwqc2Vla2VkLCpzZWVraW5nLCpzZWxlY3QsKnNlbGVjdGlvbmNoYW5nZSwqc2VsZWN0c3RhcnQsKnNsb3RjaGFuZ2UsKnN0YWxsZWQsKnN1Ym1pdCwqc3VzcGVuZCwqdGltZXVwZGF0ZSwqdG9nZ2xlLCp0cmFuc2l0aW9uY2FuY2VsLCp0cmFuc2l0aW9uZW5kLCp0cmFuc2l0aW9ucnVuLCp0cmFuc2l0aW9uc3RhcnQsKnZvbHVtZWNoYW5nZSwqd2FpdGluZywqd2Via2l0YW5pbWF0aW9uZW5kLCp3ZWJraXRhbmltYXRpb25pdGVyYXRpb24sKndlYmtpdGFuaW1hdGlvbnN0YXJ0LCp3ZWJraXR0cmFuc2l0aW9uZW5kLCp3aGVlbCxvdXRlclRleHQsIXNwZWxsY2hlY2ssJXN0eWxlLCN0YWJJbmRleCx0aXRsZSwhdHJhbnNsYXRlLHZpcnR1YWxLZXlib2FyZFBvbGljeScsXG4gICdtZWRpYV5bSFRNTEVsZW1lbnRdfCFhdXRvcGxheSwhY29udHJvbHMsJWNvbnRyb2xzTGlzdCwlY3Jvc3NPcmlnaW4sI2N1cnJlbnRUaW1lLCFkZWZhdWx0TXV0ZWQsI2RlZmF1bHRQbGF5YmFja1JhdGUsIWRpc2FibGVSZW1vdGVQbGF5YmFjaywhbG9vcCwhbXV0ZWQsKmVuY3J5cHRlZCwqd2FpdGluZ2ZvcmtleSwjcGxheWJhY2tSYXRlLHByZWxvYWQsIXByZXNlcnZlc1BpdGNoLHNyYywlc3JjT2JqZWN0LCN2b2x1bWUnLFxuICAnOnN2ZzpeW0hUTUxFbGVtZW50XXwhYXV0b2ZvY3VzLG5vbmNlLCphYm9ydCwqYW5pbWF0aW9uZW5kLCphbmltYXRpb25pdGVyYXRpb24sKmFuaW1hdGlvbnN0YXJ0LCphdXhjbGljaywqYmVmb3JleHJzZWxlY3QsKmJsdXIsKmNhbmNlbCwqY2FucGxheSwqY2FucGxheXRocm91Z2gsKmNoYW5nZSwqY2xpY2ssKmNsb3NlLCpjb250ZXh0bWVudSwqY29weSwqY3VlY2hhbmdlLCpjdXQsKmRibGNsaWNrLCpkcmFnLCpkcmFnZW5kLCpkcmFnZW50ZXIsKmRyYWdsZWF2ZSwqZHJhZ292ZXIsKmRyYWdzdGFydCwqZHJvcCwqZHVyYXRpb25jaGFuZ2UsKmVtcHRpZWQsKmVuZGVkLCplcnJvciwqZm9jdXMsKmZvcm1kYXRhLCpnb3Rwb2ludGVyY2FwdHVyZSwqaW5wdXQsKmludmFsaWQsKmtleWRvd24sKmtleXByZXNzLCprZXl1cCwqbG9hZCwqbG9hZGVkZGF0YSwqbG9hZGVkbWV0YWRhdGEsKmxvYWRzdGFydCwqbG9zdHBvaW50ZXJjYXB0dXJlLCptb3VzZWRvd24sKm1vdXNlZW50ZXIsKm1vdXNlbGVhdmUsKm1vdXNlbW92ZSwqbW91c2VvdXQsKm1vdXNlb3ZlciwqbW91c2V1cCwqbW91c2V3aGVlbCwqcGFzdGUsKnBhdXNlLCpwbGF5LCpwbGF5aW5nLCpwb2ludGVyY2FuY2VsLCpwb2ludGVyZG93biwqcG9pbnRlcmVudGVyLCpwb2ludGVybGVhdmUsKnBvaW50ZXJtb3ZlLCpwb2ludGVyb3V0LCpwb2ludGVyb3ZlciwqcG9pbnRlcnJhd3VwZGF0ZSwqcG9pbnRlcnVwLCpwcm9ncmVzcywqcmF0ZWNoYW5nZSwqcmVzZXQsKnJlc2l6ZSwqc2Nyb2xsLCpzZWN1cml0eXBvbGljeXZpb2xhdGlvbiwqc2Vla2VkLCpzZWVraW5nLCpzZWxlY3QsKnNlbGVjdGlvbmNoYW5nZSwqc2VsZWN0c3RhcnQsKnNsb3RjaGFuZ2UsKnN0YWxsZWQsKnN1Ym1pdCwqc3VzcGVuZCwqdGltZXVwZGF0ZSwqdG9nZ2xlLCp0cmFuc2l0aW9uY2FuY2VsLCp0cmFuc2l0aW9uZW5kLCp0cmFuc2l0aW9ucnVuLCp0cmFuc2l0aW9uc3RhcnQsKnZvbHVtZWNoYW5nZSwqd2FpdGluZywqd2Via2l0YW5pbWF0aW9uZW5kLCp3ZWJraXRhbmltYXRpb25pdGVyYXRpb24sKndlYmtpdGFuaW1hdGlvbnN0YXJ0LCp3ZWJraXR0cmFuc2l0aW9uZW5kLCp3aGVlbCwlc3R5bGUsI3RhYkluZGV4JyxcbiAgJzpzdmc6Z3JhcGhpY3NeOnN2Zzp8JyxcbiAgJzpzdmc6YW5pbWF0aW9uXjpzdmc6fCpiZWdpbiwqZW5kLCpyZXBlYXQnLFxuICAnOnN2ZzpnZW9tZXRyeV46c3ZnOnwnLFxuICAnOnN2Zzpjb21wb25lbnRUcmFuc2ZlckZ1bmN0aW9uXjpzdmc6fCcsXG4gICc6c3ZnOmdyYWRpZW50Xjpzdmc6fCcsXG4gICc6c3ZnOnRleHRDb250ZW50Xjpzdmc6Z3JhcGhpY3N8JyxcbiAgJzpzdmc6dGV4dFBvc2l0aW9uaW5nXjpzdmc6dGV4dENvbnRlbnR8JyxcbiAgJ2FeW0hUTUxFbGVtZW50XXxjaGFyc2V0LGNvb3Jkcyxkb3dubG9hZCxoYXNoLGhvc3QsaG9zdG5hbWUsaHJlZixocmVmbGFuZyxuYW1lLHBhc3N3b3JkLHBhdGhuYW1lLHBpbmcscG9ydCxwcm90b2NvbCxyZWZlcnJlclBvbGljeSxyZWwsJXJlbExpc3QscmV2LHNlYXJjaCxzaGFwZSx0YXJnZXQsdGV4dCx0eXBlLHVzZXJuYW1lJyxcbiAgJ2FyZWFeW0hUTUxFbGVtZW50XXxhbHQsY29vcmRzLGRvd25sb2FkLGhhc2gsaG9zdCxob3N0bmFtZSxocmVmLCFub0hyZWYscGFzc3dvcmQscGF0aG5hbWUscGluZyxwb3J0LHByb3RvY29sLHJlZmVycmVyUG9saWN5LHJlbCwlcmVsTGlzdCxzZWFyY2gsc2hhcGUsdGFyZ2V0LHVzZXJuYW1lJyxcbiAgJ2F1ZGlvXm1lZGlhfCcsXG4gICdicl5bSFRNTEVsZW1lbnRdfGNsZWFyJyxcbiAgJ2Jhc2VeW0hUTUxFbGVtZW50XXxocmVmLHRhcmdldCcsXG4gICdib2R5XltIVE1MRWxlbWVudF18YUxpbmssYmFja2dyb3VuZCxiZ0NvbG9yLGxpbmssKmFmdGVycHJpbnQsKmJlZm9yZXByaW50LCpiZWZvcmV1bmxvYWQsKmJsdXIsKmVycm9yLCpmb2N1cywqaGFzaGNoYW5nZSwqbGFuZ3VhZ2VjaGFuZ2UsKmxvYWQsKm1lc3NhZ2UsKm1lc3NhZ2VlcnJvciwqb2ZmbGluZSwqb25saW5lLCpwYWdlaGlkZSwqcGFnZXNob3csKnBvcHN0YXRlLCpyZWplY3Rpb25oYW5kbGVkLCpyZXNpemUsKnNjcm9sbCwqc3RvcmFnZSwqdW5oYW5kbGVkcmVqZWN0aW9uLCp1bmxvYWQsdGV4dCx2TGluaycsXG4gICdidXR0b25eW0hUTUxFbGVtZW50XXwhZGlzYWJsZWQsZm9ybUFjdGlvbixmb3JtRW5jdHlwZSxmb3JtTWV0aG9kLCFmb3JtTm9WYWxpZGF0ZSxmb3JtVGFyZ2V0LG5hbWUsdHlwZSx2YWx1ZScsXG4gICdjYW52YXNeW0hUTUxFbGVtZW50XXwjaGVpZ2h0LCN3aWR0aCcsXG4gICdkbF5bSFRNTEVsZW1lbnRdfCFjb21wYWN0JyxcbiAgJ2RhdGFeW0hUTUxFbGVtZW50XXx2YWx1ZScsXG4gICdkYXRhbGlzdF5bSFRNTEVsZW1lbnRdfCcsXG4gICdkZXRhaWxzXltIVE1MRWxlbWVudF18IW9wZW4nLFxuICAnZGlhbG9nXltIVE1MRWxlbWVudF18IW9wZW4scmV0dXJuVmFsdWUnLFxuICAnZGlyXltIVE1MRWxlbWVudF18IWNvbXBhY3QnLFxuICAnZGl2XltIVE1MRWxlbWVudF18YWxpZ24nLFxuICAnZW1iZWReW0hUTUxFbGVtZW50XXxhbGlnbixoZWlnaHQsbmFtZSxzcmMsdHlwZSx3aWR0aCcsXG4gICdmaWVsZHNldF5bSFRNTEVsZW1lbnRdfCFkaXNhYmxlZCxuYW1lJyxcbiAgJ2ZvbnReW0hUTUxFbGVtZW50XXxjb2xvcixmYWNlLHNpemUnLFxuICAnZm9ybV5bSFRNTEVsZW1lbnRdfGFjY2VwdENoYXJzZXQsYWN0aW9uLGF1dG9jb21wbGV0ZSxlbmNvZGluZyxlbmN0eXBlLG1ldGhvZCxuYW1lLCFub1ZhbGlkYXRlLHRhcmdldCcsXG4gICdmcmFtZV5bSFRNTEVsZW1lbnRdfGZyYW1lQm9yZGVyLGxvbmdEZXNjLG1hcmdpbkhlaWdodCxtYXJnaW5XaWR0aCxuYW1lLCFub1Jlc2l6ZSxzY3JvbGxpbmcsc3JjJyxcbiAgJ2ZyYW1lc2V0XltIVE1MRWxlbWVudF18Y29scywqYWZ0ZXJwcmludCwqYmVmb3JlcHJpbnQsKmJlZm9yZXVubG9hZCwqYmx1ciwqZXJyb3IsKmZvY3VzLCpoYXNoY2hhbmdlLCpsYW5ndWFnZWNoYW5nZSwqbG9hZCwqbWVzc2FnZSwqbWVzc2FnZWVycm9yLCpvZmZsaW5lLCpvbmxpbmUsKnBhZ2VoaWRlLCpwYWdlc2hvdywqcG9wc3RhdGUsKnJlamVjdGlvbmhhbmRsZWQsKnJlc2l6ZSwqc2Nyb2xsLCpzdG9yYWdlLCp1bmhhbmRsZWRyZWplY3Rpb24sKnVubG9hZCxyb3dzJyxcbiAgJ2hyXltIVE1MRWxlbWVudF18YWxpZ24sY29sb3IsIW5vU2hhZGUsc2l6ZSx3aWR0aCcsXG4gICdoZWFkXltIVE1MRWxlbWVudF18JyxcbiAgJ2gxLGgyLGgzLGg0LGg1LGg2XltIVE1MRWxlbWVudF18YWxpZ24nLFxuICAnaHRtbF5bSFRNTEVsZW1lbnRdfHZlcnNpb24nLFxuICAnaWZyYW1lXltIVE1MRWxlbWVudF18YWxpZ24sYWxsb3csIWFsbG93RnVsbHNjcmVlbiwhYWxsb3dQYXltZW50UmVxdWVzdCxjc3AsZnJhbWVCb3JkZXIsaGVpZ2h0LGxvYWRpbmcsbG9uZ0Rlc2MsbWFyZ2luSGVpZ2h0LG1hcmdpbldpZHRoLG5hbWUscmVmZXJyZXJQb2xpY3ksJXNhbmRib3gsc2Nyb2xsaW5nLHNyYyxzcmNkb2Msd2lkdGgnLFxuICAnaW1nXltIVE1MRWxlbWVudF18YWxpZ24sYWx0LGJvcmRlciwlY3Jvc3NPcmlnaW4sZGVjb2RpbmcsI2hlaWdodCwjaHNwYWNlLCFpc01hcCxsb2FkaW5nLGxvbmdEZXNjLGxvd3NyYyxuYW1lLHJlZmVycmVyUG9saWN5LHNpemVzLHNyYyxzcmNzZXQsdXNlTWFwLCN2c3BhY2UsI3dpZHRoJyxcbiAgJ2lucHV0XltIVE1MRWxlbWVudF18YWNjZXB0LGFsaWduLGFsdCxhdXRvY29tcGxldGUsIWNoZWNrZWQsIWRlZmF1bHRDaGVja2VkLGRlZmF1bHRWYWx1ZSxkaXJOYW1lLCFkaXNhYmxlZCwlZmlsZXMsZm9ybUFjdGlvbixmb3JtRW5jdHlwZSxmb3JtTWV0aG9kLCFmb3JtTm9WYWxpZGF0ZSxmb3JtVGFyZ2V0LCNoZWlnaHQsIWluY3JlbWVudGFsLCFpbmRldGVybWluYXRlLG1heCwjbWF4TGVuZ3RoLG1pbiwjbWluTGVuZ3RoLCFtdWx0aXBsZSxuYW1lLHBhdHRlcm4scGxhY2Vob2xkZXIsIXJlYWRPbmx5LCFyZXF1aXJlZCxzZWxlY3Rpb25EaXJlY3Rpb24sI3NlbGVjdGlvbkVuZCwjc2VsZWN0aW9uU3RhcnQsI3NpemUsc3JjLHN0ZXAsdHlwZSx1c2VNYXAsdmFsdWUsJXZhbHVlQXNEYXRlLCN2YWx1ZUFzTnVtYmVyLCN3aWR0aCcsXG4gICdsaV5bSFRNTEVsZW1lbnRdfHR5cGUsI3ZhbHVlJyxcbiAgJ2xhYmVsXltIVE1MRWxlbWVudF18aHRtbEZvcicsXG4gICdsZWdlbmReW0hUTUxFbGVtZW50XXxhbGlnbicsXG4gICdsaW5rXltIVE1MRWxlbWVudF18YXMsY2hhcnNldCwlY3Jvc3NPcmlnaW4sIWRpc2FibGVkLGhyZWYsaHJlZmxhbmcsaW1hZ2VTaXplcyxpbWFnZVNyY3NldCxpbnRlZ3JpdHksbWVkaWEscmVmZXJyZXJQb2xpY3kscmVsLCVyZWxMaXN0LHJldiwlc2l6ZXMsdGFyZ2V0LHR5cGUnLFxuICAnbWFwXltIVE1MRWxlbWVudF18bmFtZScsXG4gICdtYXJxdWVlXltIVE1MRWxlbWVudF18YmVoYXZpb3IsYmdDb2xvcixkaXJlY3Rpb24saGVpZ2h0LCNoc3BhY2UsI2xvb3AsI3Njcm9sbEFtb3VudCwjc2Nyb2xsRGVsYXksIXRydWVTcGVlZCwjdnNwYWNlLHdpZHRoJyxcbiAgJ21lbnVeW0hUTUxFbGVtZW50XXwhY29tcGFjdCcsXG4gICdtZXRhXltIVE1MRWxlbWVudF18Y29udGVudCxodHRwRXF1aXYsbWVkaWEsbmFtZSxzY2hlbWUnLFxuICAnbWV0ZXJeW0hUTUxFbGVtZW50XXwjaGlnaCwjbG93LCNtYXgsI21pbiwjb3B0aW11bSwjdmFsdWUnLFxuICAnaW5zLGRlbF5bSFRNTEVsZW1lbnRdfGNpdGUsZGF0ZVRpbWUnLFxuICAnb2xeW0hUTUxFbGVtZW50XXwhY29tcGFjdCwhcmV2ZXJzZWQsI3N0YXJ0LHR5cGUnLFxuICAnb2JqZWN0XltIVE1MRWxlbWVudF18YWxpZ24sYXJjaGl2ZSxib3JkZXIsY29kZSxjb2RlQmFzZSxjb2RlVHlwZSxkYXRhLCFkZWNsYXJlLGhlaWdodCwjaHNwYWNlLG5hbWUsc3RhbmRieSx0eXBlLHVzZU1hcCwjdnNwYWNlLHdpZHRoJyxcbiAgJ29wdGdyb3VwXltIVE1MRWxlbWVudF18IWRpc2FibGVkLGxhYmVsJyxcbiAgJ29wdGlvbl5bSFRNTEVsZW1lbnRdfCFkZWZhdWx0U2VsZWN0ZWQsIWRpc2FibGVkLGxhYmVsLCFzZWxlY3RlZCx0ZXh0LHZhbHVlJyxcbiAgJ291dHB1dF5bSFRNTEVsZW1lbnRdfGRlZmF1bHRWYWx1ZSwlaHRtbEZvcixuYW1lLHZhbHVlJyxcbiAgJ3BeW0hUTUxFbGVtZW50XXxhbGlnbicsXG4gICdwYXJhbV5bSFRNTEVsZW1lbnRdfG5hbWUsdHlwZSx2YWx1ZSx2YWx1ZVR5cGUnLFxuICAncGljdHVyZV5bSFRNTEVsZW1lbnRdfCcsXG4gICdwcmVeW0hUTUxFbGVtZW50XXwjd2lkdGgnLFxuICAncHJvZ3Jlc3NeW0hUTUxFbGVtZW50XXwjbWF4LCN2YWx1ZScsXG4gICdxLGJsb2NrcXVvdGUsY2l0ZV5bSFRNTEVsZW1lbnRdfCcsXG4gICdzY3JpcHReW0hUTUxFbGVtZW50XXwhYXN5bmMsY2hhcnNldCwlY3Jvc3NPcmlnaW4sIWRlZmVyLGV2ZW50LGh0bWxGb3IsaW50ZWdyaXR5LCFub01vZHVsZSwlcmVmZXJyZXJQb2xpY3ksc3JjLHRleHQsdHlwZScsXG4gICdzZWxlY3ReW0hUTUxFbGVtZW50XXxhdXRvY29tcGxldGUsIWRpc2FibGVkLCNsZW5ndGgsIW11bHRpcGxlLG5hbWUsIXJlcXVpcmVkLCNzZWxlY3RlZEluZGV4LCNzaXplLHZhbHVlJyxcbiAgJ3Nsb3ReW0hUTUxFbGVtZW50XXxuYW1lJyxcbiAgJ3NvdXJjZV5bSFRNTEVsZW1lbnRdfCNoZWlnaHQsbWVkaWEsc2l6ZXMsc3JjLHNyY3NldCx0eXBlLCN3aWR0aCcsXG4gICdzcGFuXltIVE1MRWxlbWVudF18JyxcbiAgJ3N0eWxlXltIVE1MRWxlbWVudF18IWRpc2FibGVkLG1lZGlhLHR5cGUnLFxuICAnY2FwdGlvbl5bSFRNTEVsZW1lbnRdfGFsaWduJyxcbiAgJ3RoLHRkXltIVE1MRWxlbWVudF18YWJicixhbGlnbixheGlzLGJnQ29sb3IsY2gsY2hPZmYsI2NvbFNwYW4saGVhZGVycyxoZWlnaHQsIW5vV3JhcCwjcm93U3BhbixzY29wZSx2QWxpZ24sd2lkdGgnLFxuICAnY29sLGNvbGdyb3VwXltIVE1MRWxlbWVudF18YWxpZ24sY2gsY2hPZmYsI3NwYW4sdkFsaWduLHdpZHRoJyxcbiAgJ3RhYmxlXltIVE1MRWxlbWVudF18YWxpZ24sYmdDb2xvcixib3JkZXIsJWNhcHRpb24sY2VsbFBhZGRpbmcsY2VsbFNwYWNpbmcsZnJhbWUscnVsZXMsc3VtbWFyeSwldEZvb3QsJXRIZWFkLHdpZHRoJyxcbiAgJ3RyXltIVE1MRWxlbWVudF18YWxpZ24sYmdDb2xvcixjaCxjaE9mZix2QWxpZ24nLFxuICAndGZvb3QsdGhlYWQsdGJvZHleW0hUTUxFbGVtZW50XXxhbGlnbixjaCxjaE9mZix2QWxpZ24nLFxuICAndGVtcGxhdGVeW0hUTUxFbGVtZW50XXwnLFxuICAndGV4dGFyZWFeW0hUTUxFbGVtZW50XXxhdXRvY29tcGxldGUsI2NvbHMsZGVmYXVsdFZhbHVlLGRpck5hbWUsIWRpc2FibGVkLCNtYXhMZW5ndGgsI21pbkxlbmd0aCxuYW1lLHBsYWNlaG9sZGVyLCFyZWFkT25seSwhcmVxdWlyZWQsI3Jvd3Msc2VsZWN0aW9uRGlyZWN0aW9uLCNzZWxlY3Rpb25FbmQsI3NlbGVjdGlvblN0YXJ0LHZhbHVlLHdyYXAnLFxuICAndGltZV5bSFRNTEVsZW1lbnRdfGRhdGVUaW1lJyxcbiAgJ3RpdGxlXltIVE1MRWxlbWVudF18dGV4dCcsXG4gICd0cmFja15bSFRNTEVsZW1lbnRdfCFkZWZhdWx0LGtpbmQsbGFiZWwsc3JjLHNyY2xhbmcnLFxuICAndWxeW0hUTUxFbGVtZW50XXwhY29tcGFjdCx0eXBlJyxcbiAgJ3Vua25vd25eW0hUTUxFbGVtZW50XXwnLFxuICAndmlkZW9ebWVkaWF8IWRpc2FibGVQaWN0dXJlSW5QaWN0dXJlLCNoZWlnaHQsKmVudGVycGljdHVyZWlucGljdHVyZSwqbGVhdmVwaWN0dXJlaW5waWN0dXJlLCFwbGF5c0lubGluZSxwb3N0ZXIsI3dpZHRoJyxcbiAgJzpzdmc6YV46c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOmFuaW1hdGVeOnN2ZzphbmltYXRpb258JyxcbiAgJzpzdmc6YW5pbWF0ZU1vdGlvbl46c3ZnOmFuaW1hdGlvbnwnLFxuICAnOnN2ZzphbmltYXRlVHJhbnNmb3JtXjpzdmc6YW5pbWF0aW9ufCcsXG4gICc6c3ZnOmNpcmNsZV46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOmNsaXBQYXRoXjpzdmc6Z3JhcGhpY3N8JyxcbiAgJzpzdmc6ZGVmc146c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOmRlc2NeOnN2Zzp8JyxcbiAgJzpzdmc6ZWxsaXBzZV46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOmZlQmxlbmReOnN2Zzp8JyxcbiAgJzpzdmc6ZmVDb2xvck1hdHJpeF46c3ZnOnwnLFxuICAnOnN2ZzpmZUNvbXBvbmVudFRyYW5zZmVyXjpzdmc6fCcsXG4gICc6c3ZnOmZlQ29tcG9zaXRlXjpzdmc6fCcsXG4gICc6c3ZnOmZlQ29udm9sdmVNYXRyaXheOnN2Zzp8JyxcbiAgJzpzdmc6ZmVEaWZmdXNlTGlnaHRpbmdeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVEaXNwbGFjZW1lbnRNYXBeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVEaXN0YW50TGlnaHReOnN2Zzp8JyxcbiAgJzpzdmc6ZmVEcm9wU2hhZG93Xjpzdmc6fCcsXG4gICc6c3ZnOmZlRmxvb2ReOnN2Zzp8JyxcbiAgJzpzdmc6ZmVGdW5jQV46c3ZnOmNvbXBvbmVudFRyYW5zZmVyRnVuY3Rpb258JyxcbiAgJzpzdmc6ZmVGdW5jQl46c3ZnOmNvbXBvbmVudFRyYW5zZmVyRnVuY3Rpb258JyxcbiAgJzpzdmc6ZmVGdW5jR146c3ZnOmNvbXBvbmVudFRyYW5zZmVyRnVuY3Rpb258JyxcbiAgJzpzdmc6ZmVGdW5jUl46c3ZnOmNvbXBvbmVudFRyYW5zZmVyRnVuY3Rpb258JyxcbiAgJzpzdmc6ZmVHYXVzc2lhbkJsdXJeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVJbWFnZV46c3ZnOnwnLFxuICAnOnN2ZzpmZU1lcmdlXjpzdmc6fCcsXG4gICc6c3ZnOmZlTWVyZ2VOb2RlXjpzdmc6fCcsXG4gICc6c3ZnOmZlTW9ycGhvbG9neV46c3ZnOnwnLFxuICAnOnN2ZzpmZU9mZnNldF46c3ZnOnwnLFxuICAnOnN2ZzpmZVBvaW50TGlnaHReOnN2Zzp8JyxcbiAgJzpzdmc6ZmVTcGVjdWxhckxpZ2h0aW5nXjpzdmc6fCcsXG4gICc6c3ZnOmZlU3BvdExpZ2h0Xjpzdmc6fCcsXG4gICc6c3ZnOmZlVGlsZV46c3ZnOnwnLFxuICAnOnN2ZzpmZVR1cmJ1bGVuY2VeOnN2Zzp8JyxcbiAgJzpzdmc6ZmlsdGVyXjpzdmc6fCcsXG4gICc6c3ZnOmZvcmVpZ25PYmplY3ReOnN2ZzpncmFwaGljc3wnLFxuICAnOnN2ZzpnXjpzdmc6Z3JhcGhpY3N8JyxcbiAgJzpzdmc6aW1hZ2VeOnN2ZzpncmFwaGljc3xkZWNvZGluZycsXG4gICc6c3ZnOmxpbmVeOnN2ZzpnZW9tZXRyeXwnLFxuICAnOnN2ZzpsaW5lYXJHcmFkaWVudF46c3ZnOmdyYWRpZW50fCcsXG4gICc6c3ZnOm1wYXRoXjpzdmc6fCcsXG4gICc6c3ZnOm1hcmtlcl46c3ZnOnwnLFxuICAnOnN2ZzptYXNrXjpzdmc6fCcsXG4gICc6c3ZnOm1ldGFkYXRhXjpzdmc6fCcsXG4gICc6c3ZnOnBhdGheOnN2ZzpnZW9tZXRyeXwnLFxuICAnOnN2ZzpwYXR0ZXJuXjpzdmc6fCcsXG4gICc6c3ZnOnBvbHlnb25eOnN2ZzpnZW9tZXRyeXwnLFxuICAnOnN2Zzpwb2x5bGluZV46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOnJhZGlhbEdyYWRpZW50Xjpzdmc6Z3JhZGllbnR8JyxcbiAgJzpzdmc6cmVjdF46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOnN2Z146c3ZnOmdyYXBoaWNzfCNjdXJyZW50U2NhbGUsI3pvb21BbmRQYW4nLFxuICAnOnN2ZzpzY3JpcHReOnN2Zzp8dHlwZScsXG4gICc6c3ZnOnNldF46c3ZnOmFuaW1hdGlvbnwnLFxuICAnOnN2ZzpzdG9wXjpzdmc6fCcsXG4gICc6c3ZnOnN0eWxlXjpzdmc6fCFkaXNhYmxlZCxtZWRpYSx0aXRsZSx0eXBlJyxcbiAgJzpzdmc6c3dpdGNoXjpzdmc6Z3JhcGhpY3N8JyxcbiAgJzpzdmc6c3ltYm9sXjpzdmc6fCcsXG4gICc6c3ZnOnRzcGFuXjpzdmc6dGV4dFBvc2l0aW9uaW5nfCcsXG4gICc6c3ZnOnRleHReOnN2Zzp0ZXh0UG9zaXRpb25pbmd8JyxcbiAgJzpzdmc6dGV4dFBhdGheOnN2Zzp0ZXh0Q29udGVudHwnLFxuICAnOnN2Zzp0aXRsZV46c3ZnOnwnLFxuICAnOnN2Zzp1c2VeOnN2ZzpncmFwaGljc3wnLFxuICAnOnN2Zzp2aWV3Xjpzdmc6fCN6b29tQW5kUGFuJyxcbiAgJ2tleWdlbl5bSFRNTEVsZW1lbnRdfCFhdXRvZm9jdXMsY2hhbGxlbmdlLCFkaXNhYmxlZCxmb3JtLGtleXR5cGUsbmFtZScsXG4gICdtZW51aXRlbV5bSFRNTEVsZW1lbnRdfHR5cGUsbGFiZWwsaWNvbiwhZGlzYWJsZWQsIWNoZWNrZWQscmFkaW9ncm91cCwhZGVmYXVsdCcsXG4gICdzdW1tYXJ5XltIVE1MRWxlbWVudF18JyxcbiAgJzpzdmc6Y3Vyc29yXjpzdmc6fCcsXG5dO1xuXG5jb25zdCBfQVRUUl9UT19QUk9QID0gbmV3IE1hcChPYmplY3QuZW50cmllcyh7XG4gICdjbGFzcyc6ICdjbGFzc05hbWUnLFxuICAnZm9yJzogJ2h0bWxGb3InLFxuICAnZm9ybWFjdGlvbic6ICdmb3JtQWN0aW9uJyxcbiAgJ2lubmVySHRtbCc6ICdpbm5lckhUTUwnLFxuICAncmVhZG9ubHknOiAncmVhZE9ubHknLFxuICAndGFiaW5kZXgnOiAndGFiSW5kZXgnLFxufSkpO1xuXG4vLyBJbnZlcnQgX0FUVFJfVE9fUFJPUC5cbmNvbnN0IF9QUk9QX1RPX0FUVFIgPVxuICAgIEFycmF5LmZyb20oX0FUVFJfVE9fUFJPUCkucmVkdWNlKChpbnZlcnRlZCwgW3Byb3BlcnR5TmFtZSwgYXR0cmlidXRlTmFtZV0pID0+IHtcbiAgICAgIGludmVydGVkLnNldChwcm9wZXJ0eU5hbWUsIGF0dHJpYnV0ZU5hbWUpO1xuICAgICAgcmV0dXJuIGludmVydGVkO1xuICAgIH0sIG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCkpO1xuXG5leHBvcnQgY2xhc3MgRG9tRWxlbWVudFNjaGVtYVJlZ2lzdHJ5IGV4dGVuZHMgRWxlbWVudFNjaGVtYVJlZ2lzdHJ5IHtcbiAgcHJpdmF0ZSBfc2NoZW1hID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIHN0cmluZz4+KCk7XG4gIC8vIFdlIGRvbid0IGFsbG93IGJpbmRpbmcgdG8gZXZlbnRzIGZvciBzZWN1cml0eSByZWFzb25zLiBBbGxvd2luZyBldmVudCBiaW5kaW5ncyB3b3VsZCBhbG1vc3RcbiAgLy8gY2VydGFpbmx5IGludHJvZHVjZSBiYWQgWFNTIHZ1bG5lcmFiaWxpdGllcy4gSW5zdGVhZCwgd2Ugc3RvcmUgZXZlbnRzIGluIGEgc2VwYXJhdGUgc2NoZW1hLlxuICBwcml2YXRlIF9ldmVudFNjaGVtYSA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj47XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICBTQ0hFTUEuZm9yRWFjaChlbmNvZGVkVHlwZSA9PiB7XG4gICAgICBjb25zdCB0eXBlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICAgIGNvbnN0IGV2ZW50czogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG4gICAgICBjb25zdCBbc3RyVHlwZSwgc3RyUHJvcGVydGllc10gPSBlbmNvZGVkVHlwZS5zcGxpdCgnfCcpO1xuICAgICAgY29uc3QgcHJvcGVydGllcyA9IHN0clByb3BlcnRpZXMuc3BsaXQoJywnKTtcbiAgICAgIGNvbnN0IFt0eXBlTmFtZXMsIHN1cGVyTmFtZV0gPSBzdHJUeXBlLnNwbGl0KCdeJyk7XG4gICAgICB0eXBlTmFtZXMuc3BsaXQoJywnKS5mb3JFYWNoKHRhZyA9PiB7XG4gICAgICAgIHRoaXMuX3NjaGVtYS5zZXQodGFnLnRvTG93ZXJDYXNlKCksIHR5cGUpO1xuICAgICAgICB0aGlzLl9ldmVudFNjaGVtYS5zZXQodGFnLnRvTG93ZXJDYXNlKCksIGV2ZW50cyk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHN1cGVyVHlwZSA9IHN1cGVyTmFtZSAmJiB0aGlzLl9zY2hlbWEuZ2V0KHN1cGVyTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgIGlmIChzdXBlclR5cGUpIHtcbiAgICAgICAgZm9yIChjb25zdCBbcHJvcCwgdmFsdWVdIG9mIHN1cGVyVHlwZSkge1xuICAgICAgICAgIHR5cGUuc2V0KHByb3AsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHN1cGVyRXZlbnQgb2YgdGhpcy5fZXZlbnRTY2hlbWEuZ2V0KHN1cGVyTmFtZS50b0xvd2VyQ2FzZSgpKSEpIHtcbiAgICAgICAgICBldmVudHMuYWRkKHN1cGVyRXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKHByb3BlcnR5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBzd2l0Y2ggKHByb3BlcnR5WzBdKSB7XG4gICAgICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgICAgICAgZXZlbnRzLmFkZChwcm9wZXJ0eS5zdWJzdHJpbmcoMSkpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgICAgICB0eXBlLnNldChwcm9wZXJ0eS5zdWJzdHJpbmcoMSksIEJPT0xFQU4pO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgICAgICB0eXBlLnNldChwcm9wZXJ0eS5zdWJzdHJpbmcoMSksIE5VTUJFUik7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnJSc6XG4gICAgICAgICAgICAgIHR5cGUuc2V0KHByb3BlcnR5LnN1YnN0cmluZygxKSwgT0JKRUNUKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICB0eXBlLnNldChwcm9wZXJ0eSwgU1RSSU5HKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgaGFzUHJvcGVydHkodGFnTmFtZTogc3RyaW5nLCBwcm9wTmFtZTogc3RyaW5nLCBzY2hlbWFNZXRhczogU2NoZW1hTWV0YWRhdGFbXSk6IGJvb2xlYW4ge1xuICAgIGlmIChzY2hlbWFNZXRhcy5zb21lKChzY2hlbWEpID0+IHNjaGVtYS5uYW1lID09PSBOT19FUlJPUlNfU0NIRU1BLm5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgaWYgKGlzTmdDb250YWluZXIodGFnTmFtZSkgfHwgaXNOZ0NvbnRlbnQodGFnTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2NoZW1hTWV0YXMuc29tZSgoc2NoZW1hKSA9PiBzY2hlbWEubmFtZSA9PT0gQ1VTVE9NX0VMRU1FTlRTX1NDSEVNQS5uYW1lKSkge1xuICAgICAgICAvLyBDYW4ndCB0ZWxsIG5vdyBhcyB3ZSBkb24ndCBrbm93IHdoaWNoIHByb3BlcnRpZXMgYSBjdXN0b20gZWxlbWVudCB3aWxsIGdldFxuICAgICAgICAvLyBvbmNlIGl0IGlzIGluc3RhbnRpYXRlZFxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBlbGVtZW50UHJvcGVydGllcyA9XG4gICAgICAgIHRoaXMuX3NjaGVtYS5nZXQodGFnTmFtZS50b0xvd2VyQ2FzZSgpKSB8fCB0aGlzLl9zY2hlbWEuZ2V0KCd1bmtub3duJykhO1xuICAgIHJldHVybiBlbGVtZW50UHJvcGVydGllcy5oYXMocHJvcE5hbWUpO1xuICB9XG5cbiAgb3ZlcnJpZGUgaGFzRWxlbWVudCh0YWdOYW1lOiBzdHJpbmcsIHNjaGVtYU1ldGFzOiBTY2hlbWFNZXRhZGF0YVtdKTogYm9vbGVhbiB7XG4gICAgaWYgKHNjaGVtYU1ldGFzLnNvbWUoKHNjaGVtYSkgPT4gc2NoZW1hLm5hbWUgPT09IE5PX0VSUk9SU19TQ0hFTUEubmFtZSkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0YWdOYW1lLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICBpZiAoaXNOZ0NvbnRhaW5lcih0YWdOYW1lKSB8fCBpc05nQ29udGVudCh0YWdOYW1lKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNjaGVtYU1ldGFzLnNvbWUoKHNjaGVtYSkgPT4gc2NoZW1hLm5hbWUgPT09IENVU1RPTV9FTEVNRU5UU19TQ0hFTUEubmFtZSkpIHtcbiAgICAgICAgLy8gQWxsb3cgYW55IGN1c3RvbSBlbGVtZW50c1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fc2NoZW1hLmhhcyh0YWdOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIHNlY3VyaXR5Q29udGV4dCByZXR1cm5zIHRoZSBzZWN1cml0eSBjb250ZXh0IGZvciB0aGUgZ2l2ZW4gcHJvcGVydHkgb24gdGhlIGdpdmVuIERPTSB0YWcuXG4gICAqXG4gICAqIFRhZyBhbmQgcHJvcGVydHkgbmFtZSBhcmUgc3RhdGljYWxseSBrbm93biBhbmQgY2Fubm90IGNoYW5nZSBhdCBydW50aW1lLCBpLmUuIGl0IGlzIG5vdFxuICAgKiBwb3NzaWJsZSB0byBiaW5kIGEgdmFsdWUgaW50byBhIGNoYW5naW5nIGF0dHJpYnV0ZSBvciB0YWcgbmFtZS5cbiAgICpcbiAgICogVGhlIGZpbHRlcmluZyBpcyBiYXNlZCBvbiBhIGxpc3Qgb2YgYWxsb3dlZCB0YWdzfGF0dHJpYnV0ZXMuIEFsbCBhdHRyaWJ1dGVzIGluIHRoZSBzY2hlbWFcbiAgICogYWJvdmUgYXJlIGFzc3VtZWQgdG8gaGF2ZSB0aGUgJ05PTkUnIHNlY3VyaXR5IGNvbnRleHQsIGkuZS4gdGhhdCB0aGV5IGFyZSBzYWZlIGluZXJ0XG4gICAqIHN0cmluZyB2YWx1ZXMuIE9ubHkgc3BlY2lmaWMgd2VsbCBrbm93biBhdHRhY2sgdmVjdG9ycyBhcmUgYXNzaWduZWQgdGhlaXIgYXBwcm9wcmlhdGUgY29udGV4dC5cbiAgICovXG4gIG92ZXJyaWRlIHNlY3VyaXR5Q29udGV4dCh0YWdOYW1lOiBzdHJpbmcsIHByb3BOYW1lOiBzdHJpbmcsIGlzQXR0cmlidXRlOiBib29sZWFuKTpcbiAgICAgIFNlY3VyaXR5Q29udGV4dCB7XG4gICAgaWYgKGlzQXR0cmlidXRlKSB7XG4gICAgICAvLyBOQjogRm9yIHNlY3VyaXR5IHB1cnBvc2VzLCB1c2UgdGhlIG1hcHBlZCBwcm9wZXJ0eSBuYW1lLCBub3QgdGhlIGF0dHJpYnV0ZSBuYW1lLlxuICAgICAgcHJvcE5hbWUgPSB0aGlzLmdldE1hcHBlZFByb3BOYW1lKHByb3BOYW1lKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHN1cmUgY29tcGFyaXNvbnMgYXJlIGNhc2UgaW5zZW5zaXRpdmUsIHNvIHRoYXQgY2FzZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIGF0dHJpYnV0ZSBhbmRcbiAgICAvLyBwcm9wZXJ0eSBuYW1lcyBkbyBub3QgaGF2ZSBhIHNlY3VyaXR5IGltcGFjdC5cbiAgICB0YWdOYW1lID0gdGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIHByb3BOYW1lID0gcHJvcE5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBsZXQgY3R4ID0gU0VDVVJJVFlfU0NIRU1BKClbdGFnTmFtZSArICd8JyArIHByb3BOYW1lXTtcbiAgICBpZiAoY3R4KSB7XG4gICAgICByZXR1cm4gY3R4O1xuICAgIH1cbiAgICBjdHggPSBTRUNVUklUWV9TQ0hFTUEoKVsnKnwnICsgcHJvcE5hbWVdO1xuICAgIHJldHVybiBjdHggPyBjdHggOiBTZWN1cml0eUNvbnRleHQuTk9ORTtcbiAgfVxuXG4gIG92ZXJyaWRlIGdldE1hcHBlZFByb3BOYW1lKHByb3BOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBfQVRUUl9UT19QUk9QLmdldChwcm9wTmFtZSkgPz8gcHJvcE5hbWU7XG4gIH1cblxuICBvdmVycmlkZSBnZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gJ25nLWNvbXBvbmVudCc7XG4gIH1cblxuICBvdmVycmlkZSB2YWxpZGF0ZVByb3BlcnR5KG5hbWU6IHN0cmluZyk6IHtlcnJvcjogYm9vbGVhbiwgbXNnPzogc3RyaW5nfSB7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdvbicpKSB7XG4gICAgICBjb25zdCBtc2cgPSBgQmluZGluZyB0byBldmVudCBwcm9wZXJ0eSAnJHtuYW1lfScgaXMgZGlzYWxsb3dlZCBmb3Igc2VjdXJpdHkgcmVhc29ucywgYCArXG4gICAgICAgICAgYHBsZWFzZSB1c2UgKCR7bmFtZS5zbGljZSgyKX0pPS4uLmAgK1xuICAgICAgICAgIGBcXG5JZiAnJHtuYW1lfScgaXMgYSBkaXJlY3RpdmUgaW5wdXQsIG1ha2Ugc3VyZSB0aGUgZGlyZWN0aXZlIGlzIGltcG9ydGVkIGJ5IHRoZWAgK1xuICAgICAgICAgIGAgY3VycmVudCBtb2R1bGUuYDtcbiAgICAgIHJldHVybiB7ZXJyb3I6IHRydWUsIG1zZzogbXNnfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtlcnJvcjogZmFsc2V9O1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIHZhbGlkYXRlQXR0cmlidXRlKG5hbWU6IHN0cmluZyk6IHtlcnJvcjogYm9vbGVhbiwgbXNnPzogc3RyaW5nfSB7XG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdvbicpKSB7XG4gICAgICBjb25zdCBtc2cgPSBgQmluZGluZyB0byBldmVudCBhdHRyaWJ1dGUgJyR7bmFtZX0nIGlzIGRpc2FsbG93ZWQgZm9yIHNlY3VyaXR5IHJlYXNvbnMsIGAgK1xuICAgICAgICAgIGBwbGVhc2UgdXNlICgke25hbWUuc2xpY2UoMil9KT0uLi5gO1xuICAgICAgcmV0dXJuIHtlcnJvcjogdHJ1ZSwgbXNnOiBtc2d9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2Vycm9yOiBmYWxzZX07XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgYWxsS25vd25FbGVtZW50TmFtZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuX3NjaGVtYS5rZXlzKCkpO1xuICB9XG5cbiAgYWxsS25vd25BdHRyaWJ1dGVzT2ZFbGVtZW50KHRhZ05hbWU6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBlbGVtZW50UHJvcGVydGllcyA9XG4gICAgICAgIHRoaXMuX3NjaGVtYS5nZXQodGFnTmFtZS50b0xvd2VyQ2FzZSgpKSB8fCB0aGlzLl9zY2hlbWEuZ2V0KCd1bmtub3duJykhO1xuICAgIC8vIENvbnZlcnQgcHJvcGVydGllcyB0byBhdHRyaWJ1dGVzLlxuICAgIHJldHVybiBBcnJheS5mcm9tKGVsZW1lbnRQcm9wZXJ0aWVzLmtleXMoKSkubWFwKHByb3AgPT4gX1BST1BfVE9fQVRUUi5nZXQocHJvcCkgPz8gcHJvcCk7XG4gIH1cblxuICBhbGxLbm93bkV2ZW50c09mRWxlbWVudCh0YWdOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5fZXZlbnRTY2hlbWEuZ2V0KHRhZ05hbWUudG9Mb3dlckNhc2UoKSkgPz8gW10pO1xuICB9XG5cbiAgb3ZlcnJpZGUgbm9ybWFsaXplQW5pbWF0aW9uU3R5bGVQcm9wZXJ0eShwcm9wTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gZGFzaENhc2VUb0NhbWVsQ2FzZShwcm9wTmFtZSk7XG4gIH1cblxuICBvdmVycmlkZSBub3JtYWxpemVBbmltYXRpb25TdHlsZVZhbHVlKFxuICAgICAgY2FtZWxDYXNlUHJvcDogc3RyaW5nLCB1c2VyUHJvdmlkZWRQcm9wOiBzdHJpbmcsXG4gICAgICB2YWw6IHN0cmluZ3xudW1iZXIpOiB7ZXJyb3I6IHN0cmluZywgdmFsdWU6IHN0cmluZ30ge1xuICAgIGxldCB1bml0OiBzdHJpbmcgPSAnJztcbiAgICBjb25zdCBzdHJWYWwgPSB2YWwudG9TdHJpbmcoKS50cmltKCk7XG4gICAgbGV0IGVycm9yTXNnOiBzdHJpbmcgPSBudWxsITtcblxuICAgIGlmIChfaXNQaXhlbERpbWVuc2lvblN0eWxlKGNhbWVsQ2FzZVByb3ApICYmIHZhbCAhPT0gMCAmJiB2YWwgIT09ICcwJykge1xuICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHVuaXQgPSAncHgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdmFsQW5kU3VmZml4TWF0Y2ggPSB2YWwubWF0Y2goL15bKy1dP1tcXGRcXC5dKyhbYS16XSopJC8pO1xuICAgICAgICBpZiAodmFsQW5kU3VmZml4TWF0Y2ggJiYgdmFsQW5kU3VmZml4TWF0Y2hbMV0ubGVuZ3RoID09IDApIHtcbiAgICAgICAgICBlcnJvck1zZyA9IGBQbGVhc2UgcHJvdmlkZSBhIENTUyB1bml0IHZhbHVlIGZvciAke3VzZXJQcm92aWRlZFByb3B9OiR7dmFsfWA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtlcnJvcjogZXJyb3JNc2csIHZhbHVlOiBzdHJWYWwgKyB1bml0fTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfaXNQaXhlbERpbWVuc2lvblN0eWxlKHByb3A6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBzd2l0Y2ggKHByb3ApIHtcbiAgICBjYXNlICd3aWR0aCc6XG4gICAgY2FzZSAnaGVpZ2h0JzpcbiAgICBjYXNlICdtaW5XaWR0aCc6XG4gICAgY2FzZSAnbWluSGVpZ2h0JzpcbiAgICBjYXNlICdtYXhXaWR0aCc6XG4gICAgY2FzZSAnbWF4SGVpZ2h0JzpcbiAgICBjYXNlICdsZWZ0JzpcbiAgICBjYXNlICd0b3AnOlxuICAgIGNhc2UgJ2JvdHRvbSc6XG4gICAgY2FzZSAncmlnaHQnOlxuICAgIGNhc2UgJ2ZvbnRTaXplJzpcbiAgICBjYXNlICdvdXRsaW5lV2lkdGgnOlxuICAgIGNhc2UgJ291dGxpbmVPZmZzZXQnOlxuICAgIGNhc2UgJ3BhZGRpbmdUb3AnOlxuICAgIGNhc2UgJ3BhZGRpbmdMZWZ0JzpcbiAgICBjYXNlICdwYWRkaW5nQm90dG9tJzpcbiAgICBjYXNlICdwYWRkaW5nUmlnaHQnOlxuICAgIGNhc2UgJ21hcmdpblRvcCc6XG4gICAgY2FzZSAnbWFyZ2luTGVmdCc6XG4gICAgY2FzZSAnbWFyZ2luQm90dG9tJzpcbiAgICBjYXNlICdtYXJnaW5SaWdodCc6XG4gICAgY2FzZSAnYm9yZGVyUmFkaXVzJzpcbiAgICBjYXNlICdib3JkZXJXaWR0aCc6XG4gICAgY2FzZSAnYm9yZGVyVG9wV2lkdGgnOlxuICAgIGNhc2UgJ2JvcmRlckxlZnRXaWR0aCc6XG4gICAgY2FzZSAnYm9yZGVyUmlnaHRXaWR0aCc6XG4gICAgY2FzZSAnYm9yZGVyQm90dG9tV2lkdGgnOlxuICAgIGNhc2UgJ3RleHRJbmRlbnQnOlxuICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=