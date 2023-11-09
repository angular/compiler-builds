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
    'abbr,address,article,aside,b,bdi,bdo,cite,content,code,dd,dfn,dt,em,figcaption,figure,footer,header,hgroup,i,kbd,main,mark,nav,noscript,rb,rp,rt,rtc,ruby,s,samp,section,small,strong,sub,sup,u,var,wbr^[HTMLElement]|accessKey,autocapitalize,!autofocus,contentEditable,dir,!draggable,enterKeyHint,!hidden,innerText,inputMode,lang,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,outerText,!spellcheck,%style,#tabIndex,title,!translate,virtualKeyboardPolicy',
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
    'content^[HTMLElement]|select',
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
    ':svg:discard^:svg:|',
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
    'data^[HTMLElement]|value',
    'keygen^[HTMLElement]|!autofocus,challenge,!disabled,form,keytype,name',
    'menuitem^[HTMLElement]|type,label,icon,!disabled,!checked,radiogroup,!default',
    'summary^[HTMLElement]|',
    'time^[HTMLElement]|dateTime',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX2VsZW1lbnRfc2NoZW1hX3JlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3NjaGVtYS9kb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHNCQUFzQixFQUFFLGdCQUFnQixFQUFrQixlQUFlLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFDbEcsT0FBTyxFQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RCxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxTQUFTLENBQUM7QUFFNUMsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3RELE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRWhFLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQztBQUMxQixNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDeEIsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBQ3hCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUV4Qjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F5Q0c7QUFFSCxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLG9HQUFvRztBQUNwRyxvR0FBb0c7QUFDcEcsb0dBQW9HO0FBQ3BHLEVBQUU7QUFDRiwrRUFBK0U7QUFDL0UsRUFBRTtBQUNGLGtHQUFrRztBQUNsRyxxRUFBcUU7QUFDckUsRUFBRTtBQUNGLG9HQUFvRztBQUVwRyxNQUFNLE1BQU0sR0FBYTtJQUN2Qix1d0JBQXV3QjtRQUNud0IsOENBQThDO1FBQzlDLGtLQUFrSztJQUN0SyxndkNBQWd2QztJQUNodkMsODZDQUE4NkM7SUFDOTZDLCtPQUErTztJQUMvTyx5a0NBQXlrQztJQUN6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QUFRLElBQUksRUFBRSxDQUFDO1FBQ2IsS0FBSyxPQUFPLENBQUM7UUFDYixLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssVUFBVSxDQUFDO1FBQ2hCLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssVUFBVSxDQUFDO1FBQ2hCLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssTUFBTSxDQUFDO1FBQ1osS0FBSyxLQUFLLENBQUM7UUFDWCxLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssT0FBTyxDQUFDO1FBQ2IsS0FBSyxVQUFVLENBQUM7UUFDaEIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxlQUFlLENBQUM7UUFDckIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxlQUFlLENBQUM7UUFDckIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxXQUFXLENBQUM7UUFDakIsS0FBSyxZQUFZLENBQUM7UUFDbEIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxjQUFjLENBQUM7UUFDcEIsS0FBSyxhQUFhLENBQUM7UUFDbkIsS0FBSyxnQkFBZ0IsQ0FBQztRQUN0QixLQUFLLGlCQUFpQixDQUFDO1FBQ3ZCLEtBQUssa0JBQWtCLENBQUM7UUFDeEIsS0FBSyxtQkFBbUIsQ0FBQztRQUN6QixLQUFLLFlBQVk7WUFDZixPQUFPLElBQUksQ0FBQztRQUVkO1lBQ0UsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDVVNUT01fRUxFTUVOVFNfU0NIRU1BLCBOT19FUlJPUlNfU0NIRU1BLCBTY2hlbWFNZXRhZGF0YSwgU2VjdXJpdHlDb250ZXh0fSBmcm9tICcuLi9jb3JlJztcbmltcG9ydCB7aXNOZ0NvbnRhaW5lciwgaXNOZ0NvbnRlbnR9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7ZGFzaENhc2VUb0NhbWVsQ2FzZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCB7U0VDVVJJVFlfU0NIRU1BfSBmcm9tICcuL2RvbV9zZWN1cml0eV9zY2hlbWEnO1xuaW1wb3J0IHtFbGVtZW50U2NoZW1hUmVnaXN0cnl9IGZyb20gJy4vZWxlbWVudF9zY2hlbWFfcmVnaXN0cnknO1xuXG5jb25zdCBCT09MRUFOID0gJ2Jvb2xlYW4nO1xuY29uc3QgTlVNQkVSID0gJ251bWJlcic7XG5jb25zdCBTVFJJTkcgPSAnc3RyaW5nJztcbmNvbnN0IE9CSkVDVCA9ICdvYmplY3QnO1xuXG4vKipcbiAqIFRoaXMgYXJyYXkgcmVwcmVzZW50cyB0aGUgRE9NIHNjaGVtYS4gSXQgZW5jb2RlcyBpbmhlcml0YW5jZSwgcHJvcGVydGllcywgYW5kIGV2ZW50cy5cbiAqXG4gKiAjIyBPdmVydmlld1xuICpcbiAqIEVhY2ggbGluZSByZXByZXNlbnRzIG9uZSBraW5kIG9mIGVsZW1lbnQuIFRoZSBgZWxlbWVudF9pbmhlcml0YW5jZWAgYW5kIHByb3BlcnRpZXMgYXJlIGpvaW5lZFxuICogdXNpbmcgYGVsZW1lbnRfaW5oZXJpdGFuY2V8cHJvcGVydGllc2Agc3ludGF4LlxuICpcbiAqICMjIEVsZW1lbnQgSW5oZXJpdGFuY2VcbiAqXG4gKiBUaGUgYGVsZW1lbnRfaW5oZXJpdGFuY2VgIGNhbiBiZSBmdXJ0aGVyIHN1YmRpdmlkZWQgYXMgYGVsZW1lbnQxLGVsZW1lbnQyLC4uLl5wYXJlbnRFbGVtZW50YC5cbiAqIEhlcmUgdGhlIGluZGl2aWR1YWwgZWxlbWVudHMgYXJlIHNlcGFyYXRlZCBieSBgLGAgKGNvbW1hcykuIEV2ZXJ5IGVsZW1lbnQgaW4gdGhlIGxpc3RcbiAqIGhhcyBpZGVudGljYWwgcHJvcGVydGllcy5cbiAqXG4gKiBBbiBgZWxlbWVudGAgbWF5IGluaGVyaXQgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIGZyb20gYHBhcmVudEVsZW1lbnRgIElmIG5vIGBecGFyZW50RWxlbWVudGAgaXNcbiAqIHNwZWNpZmllZCB0aGVuIGBcIlwiYCAoYmxhbmspIGVsZW1lbnQgaXMgYXNzdW1lZC5cbiAqXG4gKiBOT1RFOiBUaGUgYmxhbmsgZWxlbWVudCBpbmhlcml0cyBmcm9tIHJvb3QgYFtFbGVtZW50XWAgZWxlbWVudCwgdGhlIHN1cGVyIGVsZW1lbnQgb2YgYWxsXG4gKiBlbGVtZW50cy5cbiAqXG4gKiBOT1RFIGFuIGVsZW1lbnQgcHJlZml4IHN1Y2ggYXMgYDpzdmc6YCBoYXMgbm8gc3BlY2lhbCBtZWFuaW5nIHRvIHRoZSBzY2hlbWEuXG4gKlxuICogIyMgUHJvcGVydGllc1xuICpcbiAqIEVhY2ggZWxlbWVudCBoYXMgYSBzZXQgb2YgcHJvcGVydGllcyBzZXBhcmF0ZWQgYnkgYCxgIChjb21tYXMpLiBFYWNoIHByb3BlcnR5IGNhbiBiZSBwcmVmaXhlZFxuICogYnkgYSBzcGVjaWFsIGNoYXJhY3RlciBkZXNpZ25hdGluZyBpdHMgdHlwZTpcbiAqXG4gKiAtIChubyBwcmVmaXgpOiBwcm9wZXJ0eSBpcyBhIHN0cmluZy5cbiAqIC0gYCpgOiBwcm9wZXJ0eSByZXByZXNlbnRzIGFuIGV2ZW50LlxuICogLSBgIWA6IHByb3BlcnR5IGlzIGEgYm9vbGVhbi5cbiAqIC0gYCNgOiBwcm9wZXJ0eSBpcyBhIG51bWJlci5cbiAqIC0gYCVgOiBwcm9wZXJ0eSBpcyBhbiBvYmplY3QuXG4gKlxuICogIyMgUXVlcnlcbiAqXG4gKiBUaGUgY2xhc3MgY3JlYXRlcyBhbiBpbnRlcm5hbCBzcXVhcyByZXByZXNlbnRhdGlvbiB3aGljaCBhbGxvd3MgdG8gZWFzaWx5IGFuc3dlciB0aGUgcXVlcnkgb2ZcbiAqIGlmIGEgZ2l2ZW4gcHJvcGVydHkgZXhpc3Qgb24gYSBnaXZlbiBlbGVtZW50LlxuICpcbiAqIE5PVEU6IFdlIGRvbid0IHlldCBzdXBwb3J0IHF1ZXJ5aW5nIGZvciB0eXBlcyBvciBldmVudHMuXG4gKiBOT1RFOiBUaGlzIHNjaGVtYSBpcyBhdXRvIGV4dHJhY3RlZCBmcm9tIGBzY2hlbWFfZXh0cmFjdG9yLnRzYCBsb2NhdGVkIGluIHRoZSB0ZXN0IGZvbGRlcixcbiAqICAgICAgIHNlZSBkb21fZWxlbWVudF9zY2hlbWFfcmVnaXN0cnlfc3BlYy50c1xuICovXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09IFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgPT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyAgICAgICAgICAgICAgICAgICAgICAgRE8gTk9UIEVESVQgVEhJUyBET00gU0NIRU1BIFdJVEhPVVQgQSBTRUNVUklUWSBSRVZJRVchXG4vL1xuLy8gTmV3bHkgYWRkZWQgcHJvcGVydGllcyBtdXN0IGJlIHNlY3VyaXR5IHJldmlld2VkIGFuZCBhc3NpZ25lZCBhbiBhcHByb3ByaWF0ZSBTZWN1cml0eUNvbnRleHQgaW5cbi8vIGRvbV9zZWN1cml0eV9zY2hlbWEudHMuIFJlYWNoIG91dCB0byBtcHJvYnN0ICYgcmphbWV0IGZvciBkZXRhaWxzLlxuLy9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgU0NIRU1BOiBzdHJpbmdbXSA9IFtcbiAgJ1tFbGVtZW50XXx0ZXh0Q29udGVudCwlYXJpYUF0b21pYywlYXJpYUF1dG9Db21wbGV0ZSwlYXJpYUJ1c3ksJWFyaWFDaGVja2VkLCVhcmlhQ29sQ291bnQsJWFyaWFDb2xJbmRleCwlYXJpYUNvbFNwYW4sJWFyaWFDdXJyZW50LCVhcmlhRGVzY3JpcHRpb24sJWFyaWFEaXNhYmxlZCwlYXJpYUV4cGFuZGVkLCVhcmlhSGFzUG9wdXAsJWFyaWFIaWRkZW4sJWFyaWFLZXlTaG9ydGN1dHMsJWFyaWFMYWJlbCwlYXJpYUxldmVsLCVhcmlhTGl2ZSwlYXJpYU1vZGFsLCVhcmlhTXVsdGlMaW5lLCVhcmlhTXVsdGlTZWxlY3RhYmxlLCVhcmlhT3JpZW50YXRpb24sJWFyaWFQbGFjZWhvbGRlciwlYXJpYVBvc0luU2V0LCVhcmlhUHJlc3NlZCwlYXJpYVJlYWRPbmx5LCVhcmlhUmVsZXZhbnQsJWFyaWFSZXF1aXJlZCwlYXJpYVJvbGVEZXNjcmlwdGlvbiwlYXJpYVJvd0NvdW50LCVhcmlhUm93SW5kZXgsJWFyaWFSb3dTcGFuLCVhcmlhU2VsZWN0ZWQsJWFyaWFTZXRTaXplLCVhcmlhU29ydCwlYXJpYVZhbHVlTWF4LCVhcmlhVmFsdWVNaW4sJWFyaWFWYWx1ZU5vdywlYXJpYVZhbHVlVGV4dCwlY2xhc3NMaXN0LGNsYXNzTmFtZSxlbGVtZW50VGltaW5nLGlkLGlubmVySFRNTCwqYmVmb3JlY29weSwqYmVmb3JlY3V0LCpiZWZvcmVwYXN0ZSwqZnVsbHNjcmVlbmNoYW5nZSwqZnVsbHNjcmVlbmVycm9yLCpzZWFyY2gsKndlYmtpdGZ1bGxzY3JlZW5jaGFuZ2UsKndlYmtpdGZ1bGxzY3JlZW5lcnJvcixvdXRlckhUTUwsJXBhcnQsI3Njcm9sbExlZnQsI3Njcm9sbFRvcCxzbG90JyArXG4gICAgICAvKiBhZGRlZCBtYW51YWxseSB0byBhdm9pZCBicmVha2luZyBjaGFuZ2VzICovXG4gICAgICAnLCptZXNzYWdlLCptb3pmdWxsc2NyZWVuY2hhbmdlLCptb3pmdWxsc2NyZWVuZXJyb3IsKm1venBvaW50ZXJsb2NrY2hhbmdlLCptb3pwb2ludGVybG9ja2Vycm9yLCp3ZWJnbGNvbnRleHRjcmVhdGlvbmVycm9yLCp3ZWJnbGNvbnRleHRsb3N0LCp3ZWJnbGNvbnRleHRyZXN0b3JlZCcsXG4gICdbSFRNTEVsZW1lbnRdXltFbGVtZW50XXxhY2Nlc3NLZXksYXV0b2NhcGl0YWxpemUsIWF1dG9mb2N1cyxjb250ZW50RWRpdGFibGUsZGlyLCFkcmFnZ2FibGUsZW50ZXJLZXlIaW50LCFoaWRkZW4saW5uZXJUZXh0LGlucHV0TW9kZSxsYW5nLG5vbmNlLCphYm9ydCwqYW5pbWF0aW9uZW5kLCphbmltYXRpb25pdGVyYXRpb24sKmFuaW1hdGlvbnN0YXJ0LCphdXhjbGljaywqYmVmb3JleHJzZWxlY3QsKmJsdXIsKmNhbmNlbCwqY2FucGxheSwqY2FucGxheXRocm91Z2gsKmNoYW5nZSwqY2xpY2ssKmNsb3NlLCpjb250ZXh0bWVudSwqY29weSwqY3VlY2hhbmdlLCpjdXQsKmRibGNsaWNrLCpkcmFnLCpkcmFnZW5kLCpkcmFnZW50ZXIsKmRyYWdsZWF2ZSwqZHJhZ292ZXIsKmRyYWdzdGFydCwqZHJvcCwqZHVyYXRpb25jaGFuZ2UsKmVtcHRpZWQsKmVuZGVkLCplcnJvciwqZm9jdXMsKmZvcm1kYXRhLCpnb3Rwb2ludGVyY2FwdHVyZSwqaW5wdXQsKmludmFsaWQsKmtleWRvd24sKmtleXByZXNzLCprZXl1cCwqbG9hZCwqbG9hZGVkZGF0YSwqbG9hZGVkbWV0YWRhdGEsKmxvYWRzdGFydCwqbG9zdHBvaW50ZXJjYXB0dXJlLCptb3VzZWRvd24sKm1vdXNlZW50ZXIsKm1vdXNlbGVhdmUsKm1vdXNlbW92ZSwqbW91c2VvdXQsKm1vdXNlb3ZlciwqbW91c2V1cCwqbW91c2V3aGVlbCwqcGFzdGUsKnBhdXNlLCpwbGF5LCpwbGF5aW5nLCpwb2ludGVyY2FuY2VsLCpwb2ludGVyZG93biwqcG9pbnRlcmVudGVyLCpwb2ludGVybGVhdmUsKnBvaW50ZXJtb3ZlLCpwb2ludGVyb3V0LCpwb2ludGVyb3ZlciwqcG9pbnRlcnJhd3VwZGF0ZSwqcG9pbnRlcnVwLCpwcm9ncmVzcywqcmF0ZWNoYW5nZSwqcmVzZXQsKnJlc2l6ZSwqc2Nyb2xsLCpzZWN1cml0eXBvbGljeXZpb2xhdGlvbiwqc2Vla2VkLCpzZWVraW5nLCpzZWxlY3QsKnNlbGVjdGlvbmNoYW5nZSwqc2VsZWN0c3RhcnQsKnNsb3RjaGFuZ2UsKnN0YWxsZWQsKnN1Ym1pdCwqc3VzcGVuZCwqdGltZXVwZGF0ZSwqdG9nZ2xlLCp0cmFuc2l0aW9uY2FuY2VsLCp0cmFuc2l0aW9uZW5kLCp0cmFuc2l0aW9ucnVuLCp0cmFuc2l0aW9uc3RhcnQsKnZvbHVtZWNoYW5nZSwqd2FpdGluZywqd2Via2l0YW5pbWF0aW9uZW5kLCp3ZWJraXRhbmltYXRpb25pdGVyYXRpb24sKndlYmtpdGFuaW1hdGlvbnN0YXJ0LCp3ZWJraXR0cmFuc2l0aW9uZW5kLCp3aGVlbCxvdXRlclRleHQsIXNwZWxsY2hlY2ssJXN0eWxlLCN0YWJJbmRleCx0aXRsZSwhdHJhbnNsYXRlLHZpcnR1YWxLZXlib2FyZFBvbGljeScsXG4gICdhYmJyLGFkZHJlc3MsYXJ0aWNsZSxhc2lkZSxiLGJkaSxiZG8sY2l0ZSxjb250ZW50LGNvZGUsZGQsZGZuLGR0LGVtLGZpZ2NhcHRpb24sZmlndXJlLGZvb3RlcixoZWFkZXIsaGdyb3VwLGksa2JkLG1haW4sbWFyayxuYXYsbm9zY3JpcHQscmIscnAscnQscnRjLHJ1YnkscyxzYW1wLHNlY3Rpb24sc21hbGwsc3Ryb25nLHN1YixzdXAsdSx2YXIsd2JyXltIVE1MRWxlbWVudF18YWNjZXNzS2V5LGF1dG9jYXBpdGFsaXplLCFhdXRvZm9jdXMsY29udGVudEVkaXRhYmxlLGRpciwhZHJhZ2dhYmxlLGVudGVyS2V5SGludCwhaGlkZGVuLGlubmVyVGV4dCxpbnB1dE1vZGUsbGFuZyxub25jZSwqYWJvcnQsKmFuaW1hdGlvbmVuZCwqYW5pbWF0aW9uaXRlcmF0aW9uLCphbmltYXRpb25zdGFydCwqYXV4Y2xpY2ssKmJlZm9yZXhyc2VsZWN0LCpibHVyLCpjYW5jZWwsKmNhbnBsYXksKmNhbnBsYXl0aHJvdWdoLCpjaGFuZ2UsKmNsaWNrLCpjbG9zZSwqY29udGV4dG1lbnUsKmNvcHksKmN1ZWNoYW5nZSwqY3V0LCpkYmxjbGljaywqZHJhZywqZHJhZ2VuZCwqZHJhZ2VudGVyLCpkcmFnbGVhdmUsKmRyYWdvdmVyLCpkcmFnc3RhcnQsKmRyb3AsKmR1cmF0aW9uY2hhbmdlLCplbXB0aWVkLCplbmRlZCwqZXJyb3IsKmZvY3VzLCpmb3JtZGF0YSwqZ290cG9pbnRlcmNhcHR1cmUsKmlucHV0LCppbnZhbGlkLCprZXlkb3duLCprZXlwcmVzcywqa2V5dXAsKmxvYWQsKmxvYWRlZGRhdGEsKmxvYWRlZG1ldGFkYXRhLCpsb2Fkc3RhcnQsKmxvc3Rwb2ludGVyY2FwdHVyZSwqbW91c2Vkb3duLCptb3VzZWVudGVyLCptb3VzZWxlYXZlLCptb3VzZW1vdmUsKm1vdXNlb3V0LCptb3VzZW92ZXIsKm1vdXNldXAsKm1vdXNld2hlZWwsKnBhc3RlLCpwYXVzZSwqcGxheSwqcGxheWluZywqcG9pbnRlcmNhbmNlbCwqcG9pbnRlcmRvd24sKnBvaW50ZXJlbnRlciwqcG9pbnRlcmxlYXZlLCpwb2ludGVybW92ZSwqcG9pbnRlcm91dCwqcG9pbnRlcm92ZXIsKnBvaW50ZXJyYXd1cGRhdGUsKnBvaW50ZXJ1cCwqcHJvZ3Jlc3MsKnJhdGVjaGFuZ2UsKnJlc2V0LCpyZXNpemUsKnNjcm9sbCwqc2VjdXJpdHlwb2xpY3l2aW9sYXRpb24sKnNlZWtlZCwqc2Vla2luZywqc2VsZWN0LCpzZWxlY3Rpb25jaGFuZ2UsKnNlbGVjdHN0YXJ0LCpzbG90Y2hhbmdlLCpzdGFsbGVkLCpzdWJtaXQsKnN1c3BlbmQsKnRpbWV1cGRhdGUsKnRvZ2dsZSwqdHJhbnNpdGlvbmNhbmNlbCwqdHJhbnNpdGlvbmVuZCwqdHJhbnNpdGlvbnJ1biwqdHJhbnNpdGlvbnN0YXJ0LCp2b2x1bWVjaGFuZ2UsKndhaXRpbmcsKndlYmtpdGFuaW1hdGlvbmVuZCwqd2Via2l0YW5pbWF0aW9uaXRlcmF0aW9uLCp3ZWJraXRhbmltYXRpb25zdGFydCwqd2Via2l0dHJhbnNpdGlvbmVuZCwqd2hlZWwsb3V0ZXJUZXh0LCFzcGVsbGNoZWNrLCVzdHlsZSwjdGFiSW5kZXgsdGl0bGUsIXRyYW5zbGF0ZSx2aXJ0dWFsS2V5Ym9hcmRQb2xpY3knLFxuICAnbWVkaWFeW0hUTUxFbGVtZW50XXwhYXV0b3BsYXksIWNvbnRyb2xzLCVjb250cm9sc0xpc3QsJWNyb3NzT3JpZ2luLCNjdXJyZW50VGltZSwhZGVmYXVsdE11dGVkLCNkZWZhdWx0UGxheWJhY2tSYXRlLCFkaXNhYmxlUmVtb3RlUGxheWJhY2ssIWxvb3AsIW11dGVkLCplbmNyeXB0ZWQsKndhaXRpbmdmb3JrZXksI3BsYXliYWNrUmF0ZSxwcmVsb2FkLCFwcmVzZXJ2ZXNQaXRjaCxzcmMsJXNyY09iamVjdCwjdm9sdW1lJyxcbiAgJzpzdmc6XltIVE1MRWxlbWVudF18IWF1dG9mb2N1cyxub25jZSwqYWJvcnQsKmFuaW1hdGlvbmVuZCwqYW5pbWF0aW9uaXRlcmF0aW9uLCphbmltYXRpb25zdGFydCwqYXV4Y2xpY2ssKmJlZm9yZXhyc2VsZWN0LCpibHVyLCpjYW5jZWwsKmNhbnBsYXksKmNhbnBsYXl0aHJvdWdoLCpjaGFuZ2UsKmNsaWNrLCpjbG9zZSwqY29udGV4dG1lbnUsKmNvcHksKmN1ZWNoYW5nZSwqY3V0LCpkYmxjbGljaywqZHJhZywqZHJhZ2VuZCwqZHJhZ2VudGVyLCpkcmFnbGVhdmUsKmRyYWdvdmVyLCpkcmFnc3RhcnQsKmRyb3AsKmR1cmF0aW9uY2hhbmdlLCplbXB0aWVkLCplbmRlZCwqZXJyb3IsKmZvY3VzLCpmb3JtZGF0YSwqZ290cG9pbnRlcmNhcHR1cmUsKmlucHV0LCppbnZhbGlkLCprZXlkb3duLCprZXlwcmVzcywqa2V5dXAsKmxvYWQsKmxvYWRlZGRhdGEsKmxvYWRlZG1ldGFkYXRhLCpsb2Fkc3RhcnQsKmxvc3Rwb2ludGVyY2FwdHVyZSwqbW91c2Vkb3duLCptb3VzZWVudGVyLCptb3VzZWxlYXZlLCptb3VzZW1vdmUsKm1vdXNlb3V0LCptb3VzZW92ZXIsKm1vdXNldXAsKm1vdXNld2hlZWwsKnBhc3RlLCpwYXVzZSwqcGxheSwqcGxheWluZywqcG9pbnRlcmNhbmNlbCwqcG9pbnRlcmRvd24sKnBvaW50ZXJlbnRlciwqcG9pbnRlcmxlYXZlLCpwb2ludGVybW92ZSwqcG9pbnRlcm91dCwqcG9pbnRlcm92ZXIsKnBvaW50ZXJyYXd1cGRhdGUsKnBvaW50ZXJ1cCwqcHJvZ3Jlc3MsKnJhdGVjaGFuZ2UsKnJlc2V0LCpyZXNpemUsKnNjcm9sbCwqc2VjdXJpdHlwb2xpY3l2aW9sYXRpb24sKnNlZWtlZCwqc2Vla2luZywqc2VsZWN0LCpzZWxlY3Rpb25jaGFuZ2UsKnNlbGVjdHN0YXJ0LCpzbG90Y2hhbmdlLCpzdGFsbGVkLCpzdWJtaXQsKnN1c3BlbmQsKnRpbWV1cGRhdGUsKnRvZ2dsZSwqdHJhbnNpdGlvbmNhbmNlbCwqdHJhbnNpdGlvbmVuZCwqdHJhbnNpdGlvbnJ1biwqdHJhbnNpdGlvbnN0YXJ0LCp2b2x1bWVjaGFuZ2UsKndhaXRpbmcsKndlYmtpdGFuaW1hdGlvbmVuZCwqd2Via2l0YW5pbWF0aW9uaXRlcmF0aW9uLCp3ZWJraXRhbmltYXRpb25zdGFydCwqd2Via2l0dHJhbnNpdGlvbmVuZCwqd2hlZWwsJXN0eWxlLCN0YWJJbmRleCcsXG4gICc6c3ZnOmdyYXBoaWNzXjpzdmc6fCcsXG4gICc6c3ZnOmFuaW1hdGlvbl46c3ZnOnwqYmVnaW4sKmVuZCwqcmVwZWF0JyxcbiAgJzpzdmc6Z2VvbWV0cnleOnN2Zzp8JyxcbiAgJzpzdmc6Y29tcG9uZW50VHJhbnNmZXJGdW5jdGlvbl46c3ZnOnwnLFxuICAnOnN2ZzpncmFkaWVudF46c3ZnOnwnLFxuICAnOnN2Zzp0ZXh0Q29udGVudF46c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOnRleHRQb3NpdGlvbmluZ146c3ZnOnRleHRDb250ZW50fCcsXG4gICdhXltIVE1MRWxlbWVudF18Y2hhcnNldCxjb29yZHMsZG93bmxvYWQsaGFzaCxob3N0LGhvc3RuYW1lLGhyZWYsaHJlZmxhbmcsbmFtZSxwYXNzd29yZCxwYXRobmFtZSxwaW5nLHBvcnQscHJvdG9jb2wscmVmZXJyZXJQb2xpY3kscmVsLCVyZWxMaXN0LHJldixzZWFyY2gsc2hhcGUsdGFyZ2V0LHRleHQsdHlwZSx1c2VybmFtZScsXG4gICdhcmVhXltIVE1MRWxlbWVudF18YWx0LGNvb3Jkcyxkb3dubG9hZCxoYXNoLGhvc3QsaG9zdG5hbWUsaHJlZiwhbm9IcmVmLHBhc3N3b3JkLHBhdGhuYW1lLHBpbmcscG9ydCxwcm90b2NvbCxyZWZlcnJlclBvbGljeSxyZWwsJXJlbExpc3Qsc2VhcmNoLHNoYXBlLHRhcmdldCx1c2VybmFtZScsXG4gICdhdWRpb15tZWRpYXwnLFxuICAnYnJeW0hUTUxFbGVtZW50XXxjbGVhcicsXG4gICdiYXNlXltIVE1MRWxlbWVudF18aHJlZix0YXJnZXQnLFxuICAnYm9keV5bSFRNTEVsZW1lbnRdfGFMaW5rLGJhY2tncm91bmQsYmdDb2xvcixsaW5rLCphZnRlcnByaW50LCpiZWZvcmVwcmludCwqYmVmb3JldW5sb2FkLCpibHVyLCplcnJvciwqZm9jdXMsKmhhc2hjaGFuZ2UsKmxhbmd1YWdlY2hhbmdlLCpsb2FkLCptZXNzYWdlLCptZXNzYWdlZXJyb3IsKm9mZmxpbmUsKm9ubGluZSwqcGFnZWhpZGUsKnBhZ2VzaG93LCpwb3BzdGF0ZSwqcmVqZWN0aW9uaGFuZGxlZCwqcmVzaXplLCpzY3JvbGwsKnN0b3JhZ2UsKnVuaGFuZGxlZHJlamVjdGlvbiwqdW5sb2FkLHRleHQsdkxpbmsnLFxuICAnYnV0dG9uXltIVE1MRWxlbWVudF18IWRpc2FibGVkLGZvcm1BY3Rpb24sZm9ybUVuY3R5cGUsZm9ybU1ldGhvZCwhZm9ybU5vVmFsaWRhdGUsZm9ybVRhcmdldCxuYW1lLHR5cGUsdmFsdWUnLFxuICAnY2FudmFzXltIVE1MRWxlbWVudF18I2hlaWdodCwjd2lkdGgnLFxuICAnY29udGVudF5bSFRNTEVsZW1lbnRdfHNlbGVjdCcsXG4gICdkbF5bSFRNTEVsZW1lbnRdfCFjb21wYWN0JyxcbiAgJ2RhdGFeW0hUTUxFbGVtZW50XXx2YWx1ZScsXG4gICdkYXRhbGlzdF5bSFRNTEVsZW1lbnRdfCcsXG4gICdkZXRhaWxzXltIVE1MRWxlbWVudF18IW9wZW4nLFxuICAnZGlhbG9nXltIVE1MRWxlbWVudF18IW9wZW4scmV0dXJuVmFsdWUnLFxuICAnZGlyXltIVE1MRWxlbWVudF18IWNvbXBhY3QnLFxuICAnZGl2XltIVE1MRWxlbWVudF18YWxpZ24nLFxuICAnZW1iZWReW0hUTUxFbGVtZW50XXxhbGlnbixoZWlnaHQsbmFtZSxzcmMsdHlwZSx3aWR0aCcsXG4gICdmaWVsZHNldF5bSFRNTEVsZW1lbnRdfCFkaXNhYmxlZCxuYW1lJyxcbiAgJ2ZvbnReW0hUTUxFbGVtZW50XXxjb2xvcixmYWNlLHNpemUnLFxuICAnZm9ybV5bSFRNTEVsZW1lbnRdfGFjY2VwdENoYXJzZXQsYWN0aW9uLGF1dG9jb21wbGV0ZSxlbmNvZGluZyxlbmN0eXBlLG1ldGhvZCxuYW1lLCFub1ZhbGlkYXRlLHRhcmdldCcsXG4gICdmcmFtZV5bSFRNTEVsZW1lbnRdfGZyYW1lQm9yZGVyLGxvbmdEZXNjLG1hcmdpbkhlaWdodCxtYXJnaW5XaWR0aCxuYW1lLCFub1Jlc2l6ZSxzY3JvbGxpbmcsc3JjJyxcbiAgJ2ZyYW1lc2V0XltIVE1MRWxlbWVudF18Y29scywqYWZ0ZXJwcmludCwqYmVmb3JlcHJpbnQsKmJlZm9yZXVubG9hZCwqYmx1ciwqZXJyb3IsKmZvY3VzLCpoYXNoY2hhbmdlLCpsYW5ndWFnZWNoYW5nZSwqbG9hZCwqbWVzc2FnZSwqbWVzc2FnZWVycm9yLCpvZmZsaW5lLCpvbmxpbmUsKnBhZ2VoaWRlLCpwYWdlc2hvdywqcG9wc3RhdGUsKnJlamVjdGlvbmhhbmRsZWQsKnJlc2l6ZSwqc2Nyb2xsLCpzdG9yYWdlLCp1bmhhbmRsZWRyZWplY3Rpb24sKnVubG9hZCxyb3dzJyxcbiAgJ2hyXltIVE1MRWxlbWVudF18YWxpZ24sY29sb3IsIW5vU2hhZGUsc2l6ZSx3aWR0aCcsXG4gICdoZWFkXltIVE1MRWxlbWVudF18JyxcbiAgJ2gxLGgyLGgzLGg0LGg1LGg2XltIVE1MRWxlbWVudF18YWxpZ24nLFxuICAnaHRtbF5bSFRNTEVsZW1lbnRdfHZlcnNpb24nLFxuICAnaWZyYW1lXltIVE1MRWxlbWVudF18YWxpZ24sYWxsb3csIWFsbG93RnVsbHNjcmVlbiwhYWxsb3dQYXltZW50UmVxdWVzdCxjc3AsZnJhbWVCb3JkZXIsaGVpZ2h0LGxvYWRpbmcsbG9uZ0Rlc2MsbWFyZ2luSGVpZ2h0LG1hcmdpbldpZHRoLG5hbWUscmVmZXJyZXJQb2xpY3ksJXNhbmRib3gsc2Nyb2xsaW5nLHNyYyxzcmNkb2Msd2lkdGgnLFxuICAnaW1nXltIVE1MRWxlbWVudF18YWxpZ24sYWx0LGJvcmRlciwlY3Jvc3NPcmlnaW4sZGVjb2RpbmcsI2hlaWdodCwjaHNwYWNlLCFpc01hcCxsb2FkaW5nLGxvbmdEZXNjLGxvd3NyYyxuYW1lLHJlZmVycmVyUG9saWN5LHNpemVzLHNyYyxzcmNzZXQsdXNlTWFwLCN2c3BhY2UsI3dpZHRoJyxcbiAgJ2lucHV0XltIVE1MRWxlbWVudF18YWNjZXB0LGFsaWduLGFsdCxhdXRvY29tcGxldGUsIWNoZWNrZWQsIWRlZmF1bHRDaGVja2VkLGRlZmF1bHRWYWx1ZSxkaXJOYW1lLCFkaXNhYmxlZCwlZmlsZXMsZm9ybUFjdGlvbixmb3JtRW5jdHlwZSxmb3JtTWV0aG9kLCFmb3JtTm9WYWxpZGF0ZSxmb3JtVGFyZ2V0LCNoZWlnaHQsIWluY3JlbWVudGFsLCFpbmRldGVybWluYXRlLG1heCwjbWF4TGVuZ3RoLG1pbiwjbWluTGVuZ3RoLCFtdWx0aXBsZSxuYW1lLHBhdHRlcm4scGxhY2Vob2xkZXIsIXJlYWRPbmx5LCFyZXF1aXJlZCxzZWxlY3Rpb25EaXJlY3Rpb24sI3NlbGVjdGlvbkVuZCwjc2VsZWN0aW9uU3RhcnQsI3NpemUsc3JjLHN0ZXAsdHlwZSx1c2VNYXAsdmFsdWUsJXZhbHVlQXNEYXRlLCN2YWx1ZUFzTnVtYmVyLCN3aWR0aCcsXG4gICdsaV5bSFRNTEVsZW1lbnRdfHR5cGUsI3ZhbHVlJyxcbiAgJ2xhYmVsXltIVE1MRWxlbWVudF18aHRtbEZvcicsXG4gICdsZWdlbmReW0hUTUxFbGVtZW50XXxhbGlnbicsXG4gICdsaW5rXltIVE1MRWxlbWVudF18YXMsY2hhcnNldCwlY3Jvc3NPcmlnaW4sIWRpc2FibGVkLGhyZWYsaHJlZmxhbmcsaW1hZ2VTaXplcyxpbWFnZVNyY3NldCxpbnRlZ3JpdHksbWVkaWEscmVmZXJyZXJQb2xpY3kscmVsLCVyZWxMaXN0LHJldiwlc2l6ZXMsdGFyZ2V0LHR5cGUnLFxuICAnbWFwXltIVE1MRWxlbWVudF18bmFtZScsXG4gICdtYXJxdWVlXltIVE1MRWxlbWVudF18YmVoYXZpb3IsYmdDb2xvcixkaXJlY3Rpb24saGVpZ2h0LCNoc3BhY2UsI2xvb3AsI3Njcm9sbEFtb3VudCwjc2Nyb2xsRGVsYXksIXRydWVTcGVlZCwjdnNwYWNlLHdpZHRoJyxcbiAgJ21lbnVeW0hUTUxFbGVtZW50XXwhY29tcGFjdCcsXG4gICdtZXRhXltIVE1MRWxlbWVudF18Y29udGVudCxodHRwRXF1aXYsbWVkaWEsbmFtZSxzY2hlbWUnLFxuICAnbWV0ZXJeW0hUTUxFbGVtZW50XXwjaGlnaCwjbG93LCNtYXgsI21pbiwjb3B0aW11bSwjdmFsdWUnLFxuICAnaW5zLGRlbF5bSFRNTEVsZW1lbnRdfGNpdGUsZGF0ZVRpbWUnLFxuICAnb2xeW0hUTUxFbGVtZW50XXwhY29tcGFjdCwhcmV2ZXJzZWQsI3N0YXJ0LHR5cGUnLFxuICAnb2JqZWN0XltIVE1MRWxlbWVudF18YWxpZ24sYXJjaGl2ZSxib3JkZXIsY29kZSxjb2RlQmFzZSxjb2RlVHlwZSxkYXRhLCFkZWNsYXJlLGhlaWdodCwjaHNwYWNlLG5hbWUsc3RhbmRieSx0eXBlLHVzZU1hcCwjdnNwYWNlLHdpZHRoJyxcbiAgJ29wdGdyb3VwXltIVE1MRWxlbWVudF18IWRpc2FibGVkLGxhYmVsJyxcbiAgJ29wdGlvbl5bSFRNTEVsZW1lbnRdfCFkZWZhdWx0U2VsZWN0ZWQsIWRpc2FibGVkLGxhYmVsLCFzZWxlY3RlZCx0ZXh0LHZhbHVlJyxcbiAgJ291dHB1dF5bSFRNTEVsZW1lbnRdfGRlZmF1bHRWYWx1ZSwlaHRtbEZvcixuYW1lLHZhbHVlJyxcbiAgJ3BeW0hUTUxFbGVtZW50XXxhbGlnbicsXG4gICdwYXJhbV5bSFRNTEVsZW1lbnRdfG5hbWUsdHlwZSx2YWx1ZSx2YWx1ZVR5cGUnLFxuICAncGljdHVyZV5bSFRNTEVsZW1lbnRdfCcsXG4gICdwcmVeW0hUTUxFbGVtZW50XXwjd2lkdGgnLFxuICAncHJvZ3Jlc3NeW0hUTUxFbGVtZW50XXwjbWF4LCN2YWx1ZScsXG4gICdxLGJsb2NrcXVvdGUsY2l0ZV5bSFRNTEVsZW1lbnRdfCcsXG4gICdzY3JpcHReW0hUTUxFbGVtZW50XXwhYXN5bmMsY2hhcnNldCwlY3Jvc3NPcmlnaW4sIWRlZmVyLGV2ZW50LGh0bWxGb3IsaW50ZWdyaXR5LCFub01vZHVsZSwlcmVmZXJyZXJQb2xpY3ksc3JjLHRleHQsdHlwZScsXG4gICdzZWxlY3ReW0hUTUxFbGVtZW50XXxhdXRvY29tcGxldGUsIWRpc2FibGVkLCNsZW5ndGgsIW11bHRpcGxlLG5hbWUsIXJlcXVpcmVkLCNzZWxlY3RlZEluZGV4LCNzaXplLHZhbHVlJyxcbiAgJ3Nsb3ReW0hUTUxFbGVtZW50XXxuYW1lJyxcbiAgJ3NvdXJjZV5bSFRNTEVsZW1lbnRdfCNoZWlnaHQsbWVkaWEsc2l6ZXMsc3JjLHNyY3NldCx0eXBlLCN3aWR0aCcsXG4gICdzcGFuXltIVE1MRWxlbWVudF18JyxcbiAgJ3N0eWxlXltIVE1MRWxlbWVudF18IWRpc2FibGVkLG1lZGlhLHR5cGUnLFxuICAnY2FwdGlvbl5bSFRNTEVsZW1lbnRdfGFsaWduJyxcbiAgJ3RoLHRkXltIVE1MRWxlbWVudF18YWJicixhbGlnbixheGlzLGJnQ29sb3IsY2gsY2hPZmYsI2NvbFNwYW4saGVhZGVycyxoZWlnaHQsIW5vV3JhcCwjcm93U3BhbixzY29wZSx2QWxpZ24sd2lkdGgnLFxuICAnY29sLGNvbGdyb3VwXltIVE1MRWxlbWVudF18YWxpZ24sY2gsY2hPZmYsI3NwYW4sdkFsaWduLHdpZHRoJyxcbiAgJ3RhYmxlXltIVE1MRWxlbWVudF18YWxpZ24sYmdDb2xvcixib3JkZXIsJWNhcHRpb24sY2VsbFBhZGRpbmcsY2VsbFNwYWNpbmcsZnJhbWUscnVsZXMsc3VtbWFyeSwldEZvb3QsJXRIZWFkLHdpZHRoJyxcbiAgJ3RyXltIVE1MRWxlbWVudF18YWxpZ24sYmdDb2xvcixjaCxjaE9mZix2QWxpZ24nLFxuICAndGZvb3QsdGhlYWQsdGJvZHleW0hUTUxFbGVtZW50XXxhbGlnbixjaCxjaE9mZix2QWxpZ24nLFxuICAndGVtcGxhdGVeW0hUTUxFbGVtZW50XXwnLFxuICAndGV4dGFyZWFeW0hUTUxFbGVtZW50XXxhdXRvY29tcGxldGUsI2NvbHMsZGVmYXVsdFZhbHVlLGRpck5hbWUsIWRpc2FibGVkLCNtYXhMZW5ndGgsI21pbkxlbmd0aCxuYW1lLHBsYWNlaG9sZGVyLCFyZWFkT25seSwhcmVxdWlyZWQsI3Jvd3Msc2VsZWN0aW9uRGlyZWN0aW9uLCNzZWxlY3Rpb25FbmQsI3NlbGVjdGlvblN0YXJ0LHZhbHVlLHdyYXAnLFxuICAndGltZV5bSFRNTEVsZW1lbnRdfGRhdGVUaW1lJyxcbiAgJ3RpdGxlXltIVE1MRWxlbWVudF18dGV4dCcsXG4gICd0cmFja15bSFRNTEVsZW1lbnRdfCFkZWZhdWx0LGtpbmQsbGFiZWwsc3JjLHNyY2xhbmcnLFxuICAndWxeW0hUTUxFbGVtZW50XXwhY29tcGFjdCx0eXBlJyxcbiAgJ3Vua25vd25eW0hUTUxFbGVtZW50XXwnLFxuICAndmlkZW9ebWVkaWF8IWRpc2FibGVQaWN0dXJlSW5QaWN0dXJlLCNoZWlnaHQsKmVudGVycGljdHVyZWlucGljdHVyZSwqbGVhdmVwaWN0dXJlaW5waWN0dXJlLCFwbGF5c0lubGluZSxwb3N0ZXIsI3dpZHRoJyxcbiAgJzpzdmc6YV46c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOmFuaW1hdGVeOnN2ZzphbmltYXRpb258JyxcbiAgJzpzdmc6YW5pbWF0ZU1vdGlvbl46c3ZnOmFuaW1hdGlvbnwnLFxuICAnOnN2ZzphbmltYXRlVHJhbnNmb3JtXjpzdmc6YW5pbWF0aW9ufCcsXG4gICc6c3ZnOmNpcmNsZV46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOmNsaXBQYXRoXjpzdmc6Z3JhcGhpY3N8JyxcbiAgJzpzdmc6ZGVmc146c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOmRlc2NeOnN2Zzp8JyxcbiAgJzpzdmc6ZGlzY2FyZF46c3ZnOnwnLFxuICAnOnN2ZzplbGxpcHNlXjpzdmc6Z2VvbWV0cnl8JyxcbiAgJzpzdmc6ZmVCbGVuZF46c3ZnOnwnLFxuICAnOnN2ZzpmZUNvbG9yTWF0cml4Xjpzdmc6fCcsXG4gICc6c3ZnOmZlQ29tcG9uZW50VHJhbnNmZXJeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVDb21wb3NpdGVeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVDb252b2x2ZU1hdHJpeF46c3ZnOnwnLFxuICAnOnN2ZzpmZURpZmZ1c2VMaWdodGluZ146c3ZnOnwnLFxuICAnOnN2ZzpmZURpc3BsYWNlbWVudE1hcF46c3ZnOnwnLFxuICAnOnN2ZzpmZURpc3RhbnRMaWdodF46c3ZnOnwnLFxuICAnOnN2ZzpmZURyb3BTaGFkb3deOnN2Zzp8JyxcbiAgJzpzdmc6ZmVGbG9vZF46c3ZnOnwnLFxuICAnOnN2ZzpmZUZ1bmNBXjpzdmc6Y29tcG9uZW50VHJhbnNmZXJGdW5jdGlvbnwnLFxuICAnOnN2ZzpmZUZ1bmNCXjpzdmc6Y29tcG9uZW50VHJhbnNmZXJGdW5jdGlvbnwnLFxuICAnOnN2ZzpmZUZ1bmNHXjpzdmc6Y29tcG9uZW50VHJhbnNmZXJGdW5jdGlvbnwnLFxuICAnOnN2ZzpmZUZ1bmNSXjpzdmc6Y29tcG9uZW50VHJhbnNmZXJGdW5jdGlvbnwnLFxuICAnOnN2ZzpmZUdhdXNzaWFuQmx1cl46c3ZnOnwnLFxuICAnOnN2ZzpmZUltYWdlXjpzdmc6fCcsXG4gICc6c3ZnOmZlTWVyZ2VeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVNZXJnZU5vZGVeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVNb3JwaG9sb2d5Xjpzdmc6fCcsXG4gICc6c3ZnOmZlT2Zmc2V0Xjpzdmc6fCcsXG4gICc6c3ZnOmZlUG9pbnRMaWdodF46c3ZnOnwnLFxuICAnOnN2ZzpmZVNwZWN1bGFyTGlnaHRpbmdeOnN2Zzp8JyxcbiAgJzpzdmc6ZmVTcG90TGlnaHReOnN2Zzp8JyxcbiAgJzpzdmc6ZmVUaWxlXjpzdmc6fCcsXG4gICc6c3ZnOmZlVHVyYnVsZW5jZV46c3ZnOnwnLFxuICAnOnN2ZzpmaWx0ZXJeOnN2Zzp8JyxcbiAgJzpzdmc6Zm9yZWlnbk9iamVjdF46c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOmdeOnN2ZzpncmFwaGljc3wnLFxuICAnOnN2ZzppbWFnZV46c3ZnOmdyYXBoaWNzfGRlY29kaW5nJyxcbiAgJzpzdmc6bGluZV46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOmxpbmVhckdyYWRpZW50Xjpzdmc6Z3JhZGllbnR8JyxcbiAgJzpzdmc6bXBhdGheOnN2Zzp8JyxcbiAgJzpzdmc6bWFya2VyXjpzdmc6fCcsXG4gICc6c3ZnOm1hc2teOnN2Zzp8JyxcbiAgJzpzdmc6bWV0YWRhdGFeOnN2Zzp8JyxcbiAgJzpzdmc6cGF0aF46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOnBhdHRlcm5eOnN2Zzp8JyxcbiAgJzpzdmc6cG9seWdvbl46c3ZnOmdlb21ldHJ5fCcsXG4gICc6c3ZnOnBvbHlsaW5lXjpzdmc6Z2VvbWV0cnl8JyxcbiAgJzpzdmc6cmFkaWFsR3JhZGllbnReOnN2ZzpncmFkaWVudHwnLFxuICAnOnN2ZzpyZWN0Xjpzdmc6Z2VvbWV0cnl8JyxcbiAgJzpzdmc6c3ZnXjpzdmc6Z3JhcGhpY3N8I2N1cnJlbnRTY2FsZSwjem9vbUFuZFBhbicsXG4gICc6c3ZnOnNjcmlwdF46c3ZnOnx0eXBlJyxcbiAgJzpzdmc6c2V0Xjpzdmc6YW5pbWF0aW9ufCcsXG4gICc6c3ZnOnN0b3BeOnN2Zzp8JyxcbiAgJzpzdmc6c3R5bGVeOnN2Zzp8IWRpc2FibGVkLG1lZGlhLHRpdGxlLHR5cGUnLFxuICAnOnN2Zzpzd2l0Y2heOnN2ZzpncmFwaGljc3wnLFxuICAnOnN2ZzpzeW1ib2xeOnN2Zzp8JyxcbiAgJzpzdmc6dHNwYW5eOnN2Zzp0ZXh0UG9zaXRpb25pbmd8JyxcbiAgJzpzdmc6dGV4dF46c3ZnOnRleHRQb3NpdGlvbmluZ3wnLFxuICAnOnN2Zzp0ZXh0UGF0aF46c3ZnOnRleHRDb250ZW50fCcsXG4gICc6c3ZnOnRpdGxlXjpzdmc6fCcsXG4gICc6c3ZnOnVzZV46c3ZnOmdyYXBoaWNzfCcsXG4gICc6c3ZnOnZpZXdeOnN2Zzp8I3pvb21BbmRQYW4nLFxuICAnZGF0YV5bSFRNTEVsZW1lbnRdfHZhbHVlJyxcbiAgJ2tleWdlbl5bSFRNTEVsZW1lbnRdfCFhdXRvZm9jdXMsY2hhbGxlbmdlLCFkaXNhYmxlZCxmb3JtLGtleXR5cGUsbmFtZScsXG4gICdtZW51aXRlbV5bSFRNTEVsZW1lbnRdfHR5cGUsbGFiZWwsaWNvbiwhZGlzYWJsZWQsIWNoZWNrZWQscmFkaW9ncm91cCwhZGVmYXVsdCcsXG4gICdzdW1tYXJ5XltIVE1MRWxlbWVudF18JyxcbiAgJ3RpbWVeW0hUTUxFbGVtZW50XXxkYXRlVGltZScsXG4gICc6c3ZnOmN1cnNvcl46c3ZnOnwnLFxuXTtcblxuY29uc3QgX0FUVFJfVE9fUFJPUCA9IG5ldyBNYXAoT2JqZWN0LmVudHJpZXMoe1xuICAnY2xhc3MnOiAnY2xhc3NOYW1lJyxcbiAgJ2Zvcic6ICdodG1sRm9yJyxcbiAgJ2Zvcm1hY3Rpb24nOiAnZm9ybUFjdGlvbicsXG4gICdpbm5lckh0bWwnOiAnaW5uZXJIVE1MJyxcbiAgJ3JlYWRvbmx5JzogJ3JlYWRPbmx5JyxcbiAgJ3RhYmluZGV4JzogJ3RhYkluZGV4Jyxcbn0pKTtcblxuLy8gSW52ZXJ0IF9BVFRSX1RPX1BST1AuXG5jb25zdCBfUFJPUF9UT19BVFRSID1cbiAgICBBcnJheS5mcm9tKF9BVFRSX1RPX1BST1ApLnJlZHVjZSgoaW52ZXJ0ZWQsIFtwcm9wZXJ0eU5hbWUsIGF0dHJpYnV0ZU5hbWVdKSA9PiB7XG4gICAgICBpbnZlcnRlZC5zZXQocHJvcGVydHlOYW1lLCBhdHRyaWJ1dGVOYW1lKTtcbiAgICAgIHJldHVybiBpbnZlcnRlZDtcbiAgICB9LCBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpKTtcblxuZXhwb3J0IGNsYXNzIERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSBleHRlbmRzIEVsZW1lbnRTY2hlbWFSZWdpc3RyeSB7XG4gIHByaXZhdGUgX3NjaGVtYSA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBzdHJpbmc+PigpO1xuICAvLyBXZSBkb24ndCBhbGxvdyBiaW5kaW5nIHRvIGV2ZW50cyBmb3Igc2VjdXJpdHkgcmVhc29ucy4gQWxsb3dpbmcgZXZlbnQgYmluZGluZ3Mgd291bGQgYWxtb3N0XG4gIC8vIGNlcnRhaW5seSBpbnRyb2R1Y2UgYmFkIFhTUyB2dWxuZXJhYmlsaXRpZXMuIEluc3RlYWQsIHdlIHN0b3JlIGV2ZW50cyBpbiBhIHNlcGFyYXRlIHNjaGVtYS5cbiAgcHJpdmF0ZSBfZXZlbnRTY2hlbWEgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgU0NIRU1BLmZvckVhY2goZW5jb2RlZFR5cGUgPT4ge1xuICAgICAgY29uc3QgdHlwZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgICBjb25zdCBldmVudHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuICAgICAgY29uc3QgW3N0clR5cGUsIHN0clByb3BlcnRpZXNdID0gZW5jb2RlZFR5cGUuc3BsaXQoJ3wnKTtcbiAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBzdHJQcm9wZXJ0aWVzLnNwbGl0KCcsJyk7XG4gICAgICBjb25zdCBbdHlwZU5hbWVzLCBzdXBlck5hbWVdID0gc3RyVHlwZS5zcGxpdCgnXicpO1xuICAgICAgdHlwZU5hbWVzLnNwbGl0KCcsJykuZm9yRWFjaCh0YWcgPT4ge1xuICAgICAgICB0aGlzLl9zY2hlbWEuc2V0KHRhZy50b0xvd2VyQ2FzZSgpLCB0eXBlKTtcbiAgICAgICAgdGhpcy5fZXZlbnRTY2hlbWEuc2V0KHRhZy50b0xvd2VyQ2FzZSgpLCBldmVudHMpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBzdXBlclR5cGUgPSBzdXBlck5hbWUgJiYgdGhpcy5fc2NoZW1hLmdldChzdXBlck5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICBpZiAoc3VwZXJUeXBlKSB7XG4gICAgICAgIGZvciAoY29uc3QgW3Byb3AsIHZhbHVlXSBvZiBzdXBlclR5cGUpIHtcbiAgICAgICAgICB0eXBlLnNldChwcm9wLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBzdXBlckV2ZW50IG9mIHRoaXMuX2V2ZW50U2NoZW1hLmdldChzdXBlck5hbWUudG9Mb3dlckNhc2UoKSkhKSB7XG4gICAgICAgICAgZXZlbnRzLmFkZChzdXBlckV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmIChwcm9wZXJ0eS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgc3dpdGNoIChwcm9wZXJ0eVswXSkge1xuICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgIGV2ZW50cy5hZGQocHJvcGVydHkuc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICchJzpcbiAgICAgICAgICAgICAgdHlwZS5zZXQocHJvcGVydHkuc3Vic3RyaW5nKDEpLCBCT09MRUFOKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICcjJzpcbiAgICAgICAgICAgICAgdHlwZS5zZXQocHJvcGVydHkuc3Vic3RyaW5nKDEpLCBOVU1CRVIpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJyUnOlxuICAgICAgICAgICAgICB0eXBlLnNldChwcm9wZXJ0eS5zdWJzdHJpbmcoMSksIE9CSkVDVCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdHlwZS5zZXQocHJvcGVydHksIFNUUklORyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIGhhc1Byb3BlcnR5KHRhZ05hbWU6IHN0cmluZywgcHJvcE5hbWU6IHN0cmluZywgc2NoZW1hTWV0YXM6IFNjaGVtYU1ldGFkYXRhW10pOiBib29sZWFuIHtcbiAgICBpZiAoc2NoZW1hTWV0YXMuc29tZSgoc2NoZW1hKSA9PiBzY2hlbWEubmFtZSA9PT0gTk9fRVJST1JTX1NDSEVNQS5uYW1lKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHRhZ05hbWUuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIGlmIChpc05nQ29udGFpbmVyKHRhZ05hbWUpIHx8IGlzTmdDb250ZW50KHRhZ05hbWUpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNjaGVtYU1ldGFzLnNvbWUoKHNjaGVtYSkgPT4gc2NoZW1hLm5hbWUgPT09IENVU1RPTV9FTEVNRU5UU19TQ0hFTUEubmFtZSkpIHtcbiAgICAgICAgLy8gQ2FuJ3QgdGVsbCBub3cgYXMgd2UgZG9uJ3Qga25vdyB3aGljaCBwcm9wZXJ0aWVzIGEgY3VzdG9tIGVsZW1lbnQgd2lsbCBnZXRcbiAgICAgICAgLy8gb25jZSBpdCBpcyBpbnN0YW50aWF0ZWRcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZWxlbWVudFByb3BlcnRpZXMgPVxuICAgICAgICB0aGlzLl9zY2hlbWEuZ2V0KHRhZ05hbWUudG9Mb3dlckNhc2UoKSkgfHwgdGhpcy5fc2NoZW1hLmdldCgndW5rbm93bicpITtcbiAgICByZXR1cm4gZWxlbWVudFByb3BlcnRpZXMuaGFzKHByb3BOYW1lKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGhhc0VsZW1lbnQodGFnTmFtZTogc3RyaW5nLCBzY2hlbWFNZXRhczogU2NoZW1hTWV0YWRhdGFbXSk6IGJvb2xlYW4ge1xuICAgIGlmIChzY2hlbWFNZXRhcy5zb21lKChzY2hlbWEpID0+IHNjaGVtYS5uYW1lID09PSBOT19FUlJPUlNfU0NIRU1BLm5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGFnTmFtZS5pbmRleE9mKCctJykgPiAtMSkge1xuICAgICAgaWYgKGlzTmdDb250YWluZXIodGFnTmFtZSkgfHwgaXNOZ0NvbnRlbnQodGFnTmFtZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChzY2hlbWFNZXRhcy5zb21lKChzY2hlbWEpID0+IHNjaGVtYS5uYW1lID09PSBDVVNUT01fRUxFTUVOVFNfU0NIRU1BLm5hbWUpKSB7XG4gICAgICAgIC8vIEFsbG93IGFueSBjdXN0b20gZWxlbWVudHNcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYS5oYXModGFnTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBzZWN1cml0eUNvbnRleHQgcmV0dXJucyB0aGUgc2VjdXJpdHkgY29udGV4dCBmb3IgdGhlIGdpdmVuIHByb3BlcnR5IG9uIHRoZSBnaXZlbiBET00gdGFnLlxuICAgKlxuICAgKiBUYWcgYW5kIHByb3BlcnR5IG5hbWUgYXJlIHN0YXRpY2FsbHkga25vd24gYW5kIGNhbm5vdCBjaGFuZ2UgYXQgcnVudGltZSwgaS5lLiBpdCBpcyBub3RcbiAgICogcG9zc2libGUgdG8gYmluZCBhIHZhbHVlIGludG8gYSBjaGFuZ2luZyBhdHRyaWJ1dGUgb3IgdGFnIG5hbWUuXG4gICAqXG4gICAqIFRoZSBmaWx0ZXJpbmcgaXMgYmFzZWQgb24gYSBsaXN0IG9mIGFsbG93ZWQgdGFnc3xhdHRyaWJ1dGVzLiBBbGwgYXR0cmlidXRlcyBpbiB0aGUgc2NoZW1hXG4gICAqIGFib3ZlIGFyZSBhc3N1bWVkIHRvIGhhdmUgdGhlICdOT05FJyBzZWN1cml0eSBjb250ZXh0LCBpLmUuIHRoYXQgdGhleSBhcmUgc2FmZSBpbmVydFxuICAgKiBzdHJpbmcgdmFsdWVzLiBPbmx5IHNwZWNpZmljIHdlbGwga25vd24gYXR0YWNrIHZlY3RvcnMgYXJlIGFzc2lnbmVkIHRoZWlyIGFwcHJvcHJpYXRlIGNvbnRleHQuXG4gICAqL1xuICBvdmVycmlkZSBzZWN1cml0eUNvbnRleHQodGFnTmFtZTogc3RyaW5nLCBwcm9wTmFtZTogc3RyaW5nLCBpc0F0dHJpYnV0ZTogYm9vbGVhbik6XG4gICAgICBTZWN1cml0eUNvbnRleHQge1xuICAgIGlmIChpc0F0dHJpYnV0ZSkge1xuICAgICAgLy8gTkI6IEZvciBzZWN1cml0eSBwdXJwb3NlcywgdXNlIHRoZSBtYXBwZWQgcHJvcGVydHkgbmFtZSwgbm90IHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICAgIHByb3BOYW1lID0gdGhpcy5nZXRNYXBwZWRQcm9wTmFtZShwcm9wTmFtZSk7XG4gICAgfVxuXG4gICAgLy8gTWFrZSBzdXJlIGNvbXBhcmlzb25zIGFyZSBjYXNlIGluc2Vuc2l0aXZlLCBzbyB0aGF0IGNhc2UgZGlmZmVyZW5jZXMgYmV0d2VlbiBhdHRyaWJ1dGUgYW5kXG4gICAgLy8gcHJvcGVydHkgbmFtZXMgZG8gbm90IGhhdmUgYSBzZWN1cml0eSBpbXBhY3QuXG4gICAgdGFnTmFtZSA9IHRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBwcm9wTmFtZSA9IHByb3BOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgbGV0IGN0eCA9IFNFQ1VSSVRZX1NDSEVNQSgpW3RhZ05hbWUgKyAnfCcgKyBwcm9wTmFtZV07XG4gICAgaWYgKGN0eCkge1xuICAgICAgcmV0dXJuIGN0eDtcbiAgICB9XG4gICAgY3R4ID0gU0VDVVJJVFlfU0NIRU1BKClbJyp8JyArIHByb3BOYW1lXTtcbiAgICByZXR1cm4gY3R4ID8gY3R4IDogU2VjdXJpdHlDb250ZXh0Lk5PTkU7XG4gIH1cblxuICBvdmVycmlkZSBnZXRNYXBwZWRQcm9wTmFtZShwcm9wTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gX0FUVFJfVE9fUFJPUC5nZXQocHJvcE5hbWUpID8/IHByb3BOYW1lO1xuICB9XG5cbiAgb3ZlcnJpZGUgZ2V0RGVmYXVsdENvbXBvbmVudEVsZW1lbnROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICduZy1jb21wb25lbnQnO1xuICB9XG5cbiAgb3ZlcnJpZGUgdmFsaWRhdGVQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiB7ZXJyb3I6IGJvb2xlYW4sIG1zZz86IHN0cmluZ30ge1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgnb24nKSkge1xuICAgICAgY29uc3QgbXNnID0gYEJpbmRpbmcgdG8gZXZlbnQgcHJvcGVydHkgJyR7bmFtZX0nIGlzIGRpc2FsbG93ZWQgZm9yIHNlY3VyaXR5IHJlYXNvbnMsIGAgK1xuICAgICAgICAgIGBwbGVhc2UgdXNlICgke25hbWUuc2xpY2UoMil9KT0uLi5gICtcbiAgICAgICAgICBgXFxuSWYgJyR7bmFtZX0nIGlzIGEgZGlyZWN0aXZlIGlucHV0LCBtYWtlIHN1cmUgdGhlIGRpcmVjdGl2ZSBpcyBpbXBvcnRlZCBieSB0aGVgICtcbiAgICAgICAgICBgIGN1cnJlbnQgbW9kdWxlLmA7XG4gICAgICByZXR1cm4ge2Vycm9yOiB0cnVlLCBtc2c6IG1zZ307XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7ZXJyb3I6IGZhbHNlfTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSB2YWxpZGF0ZUF0dHJpYnV0ZShuYW1lOiBzdHJpbmcpOiB7ZXJyb3I6IGJvb2xlYW4sIG1zZz86IHN0cmluZ30ge1xuICAgIGlmIChuYW1lLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgnb24nKSkge1xuICAgICAgY29uc3QgbXNnID0gYEJpbmRpbmcgdG8gZXZlbnQgYXR0cmlidXRlICcke25hbWV9JyBpcyBkaXNhbGxvd2VkIGZvciBzZWN1cml0eSByZWFzb25zLCBgICtcbiAgICAgICAgICBgcGxlYXNlIHVzZSAoJHtuYW1lLnNsaWNlKDIpfSk9Li4uYDtcbiAgICAgIHJldHVybiB7ZXJyb3I6IHRydWUsIG1zZzogbXNnfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtlcnJvcjogZmFsc2V9O1xuICAgIH1cbiAgfVxuXG4gIG92ZXJyaWRlIGFsbEtub3duRWxlbWVudE5hbWVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9zY2hlbWEua2V5cygpKTtcbiAgfVxuXG4gIGFsbEtub3duQXR0cmlidXRlc09mRWxlbWVudCh0YWdOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZWxlbWVudFByb3BlcnRpZXMgPVxuICAgICAgICB0aGlzLl9zY2hlbWEuZ2V0KHRhZ05hbWUudG9Mb3dlckNhc2UoKSkgfHwgdGhpcy5fc2NoZW1hLmdldCgndW5rbm93bicpITtcbiAgICAvLyBDb252ZXJ0IHByb3BlcnRpZXMgdG8gYXR0cmlidXRlcy5cbiAgICByZXR1cm4gQXJyYXkuZnJvbShlbGVtZW50UHJvcGVydGllcy5rZXlzKCkpLm1hcChwcm9wID0+IF9QUk9QX1RPX0FUVFIuZ2V0KHByb3ApID8/IHByb3ApO1xuICB9XG5cbiAgYWxsS25vd25FdmVudHNPZkVsZW1lbnQodGFnTmFtZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuX2V2ZW50U2NoZW1hLmdldCh0YWdOYW1lLnRvTG93ZXJDYXNlKCkpID8/IFtdKTtcbiAgfVxuXG4gIG92ZXJyaWRlIG5vcm1hbGl6ZUFuaW1hdGlvblN0eWxlUHJvcGVydHkocHJvcE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGRhc2hDYXNlVG9DYW1lbENhc2UocHJvcE5hbWUpO1xuICB9XG5cbiAgb3ZlcnJpZGUgbm9ybWFsaXplQW5pbWF0aW9uU3R5bGVWYWx1ZShcbiAgICAgIGNhbWVsQ2FzZVByb3A6IHN0cmluZywgdXNlclByb3ZpZGVkUHJvcDogc3RyaW5nLFxuICAgICAgdmFsOiBzdHJpbmd8bnVtYmVyKToge2Vycm9yOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmd9IHtcbiAgICBsZXQgdW5pdDogc3RyaW5nID0gJyc7XG4gICAgY29uc3Qgc3RyVmFsID0gdmFsLnRvU3RyaW5nKCkudHJpbSgpO1xuICAgIGxldCBlcnJvck1zZzogc3RyaW5nID0gbnVsbCE7XG5cbiAgICBpZiAoX2lzUGl4ZWxEaW1lbnNpb25TdHlsZShjYW1lbENhc2VQcm9wKSAmJiB2YWwgIT09IDAgJiYgdmFsICE9PSAnMCcpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgICAgICB1bml0ID0gJ3B4JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHZhbEFuZFN1ZmZpeE1hdGNoID0gdmFsLm1hdGNoKC9eWystXT9bXFxkXFwuXSsoW2Etel0qKSQvKTtcbiAgICAgICAgaWYgKHZhbEFuZFN1ZmZpeE1hdGNoICYmIHZhbEFuZFN1ZmZpeE1hdGNoWzFdLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgZXJyb3JNc2cgPSBgUGxlYXNlIHByb3ZpZGUgYSBDU1MgdW5pdCB2YWx1ZSBmb3IgJHt1c2VyUHJvdmlkZWRQcm9wfToke3ZhbH1gO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7ZXJyb3I6IGVycm9yTXNnLCB2YWx1ZTogc3RyVmFsICsgdW5pdH07XG4gIH1cbn1cblxuZnVuY3Rpb24gX2lzUGl4ZWxEaW1lbnNpb25TdHlsZShwcm9wOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgc3dpdGNoIChwcm9wKSB7XG4gICAgY2FzZSAnd2lkdGgnOlxuICAgIGNhc2UgJ2hlaWdodCc6XG4gICAgY2FzZSAnbWluV2lkdGgnOlxuICAgIGNhc2UgJ21pbkhlaWdodCc6XG4gICAgY2FzZSAnbWF4V2lkdGgnOlxuICAgIGNhc2UgJ21heEhlaWdodCc6XG4gICAgY2FzZSAnbGVmdCc6XG4gICAgY2FzZSAndG9wJzpcbiAgICBjYXNlICdib3R0b20nOlxuICAgIGNhc2UgJ3JpZ2h0JzpcbiAgICBjYXNlICdmb250U2l6ZSc6XG4gICAgY2FzZSAnb3V0bGluZVdpZHRoJzpcbiAgICBjYXNlICdvdXRsaW5lT2Zmc2V0JzpcbiAgICBjYXNlICdwYWRkaW5nVG9wJzpcbiAgICBjYXNlICdwYWRkaW5nTGVmdCc6XG4gICAgY2FzZSAncGFkZGluZ0JvdHRvbSc6XG4gICAgY2FzZSAncGFkZGluZ1JpZ2h0JzpcbiAgICBjYXNlICdtYXJnaW5Ub3AnOlxuICAgIGNhc2UgJ21hcmdpbkxlZnQnOlxuICAgIGNhc2UgJ21hcmdpbkJvdHRvbSc6XG4gICAgY2FzZSAnbWFyZ2luUmlnaHQnOlxuICAgIGNhc2UgJ2JvcmRlclJhZGl1cyc6XG4gICAgY2FzZSAnYm9yZGVyV2lkdGgnOlxuICAgIGNhc2UgJ2JvcmRlclRvcFdpZHRoJzpcbiAgICBjYXNlICdib3JkZXJMZWZ0V2lkdGgnOlxuICAgIGNhc2UgJ2JvcmRlclJpZ2h0V2lkdGgnOlxuICAgIGNhc2UgJ2JvcmRlckJvdHRvbVdpZHRoJzpcbiAgICBjYXNlICd0ZXh0SW5kZW50JzpcbiAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19