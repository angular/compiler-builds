/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A lazily created TextEncoder instance for converting strings into UTF-8 bytes
 */
let textEncoder;
/**
 * Return the message id or compute it using the XLIFF1 digest.
 */
export function digest(message) {
    return message.id || computeDigest(message);
}
/**
 * Compute the message id using the XLIFF1 digest.
 */
export function computeDigest(message) {
    return sha1(serializeNodes(message.nodes).join('') + `[${message.meaning}]`);
}
/**
 * Return the message id or compute it using the XLIFF2/XMB/$localize digest.
 */
export function decimalDigest(message) {
    return message.id || computeDecimalDigest(message);
}
/**
 * Compute the message id using the XLIFF2/XMB/$localize digest.
 */
export function computeDecimalDigest(message) {
    const visitor = new _SerializerIgnoreIcuExpVisitor();
    const parts = message.nodes.map((a) => a.visit(visitor, null));
    return computeMsgId(parts.join(''), message.meaning);
}
/**
 * Serialize the i18n ast to something xml-like in order to generate an UID.
 *
 * The visitor is also used in the i18n parser tests
 *
 * @internal
 */
class _SerializerVisitor {
    visitText(text, context) {
        return text.value;
    }
    visitContainer(container, context) {
        return `[${container.children.map((child) => child.visit(this)).join(', ')}]`;
    }
    visitIcu(icu, context) {
        const strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
        return `{${icu.expression}, ${icu.type}, ${strCases.join(', ')}}`;
    }
    visitTagPlaceholder(ph, context) {
        return ph.isVoid
            ? `<ph tag name="${ph.startName}"/>`
            : `<ph tag name="${ph.startName}">${ph.children
                .map((child) => child.visit(this))
                .join(', ')}</ph name="${ph.closeName}">`;
    }
    visitPlaceholder(ph, context) {
        return ph.value ? `<ph name="${ph.name}">${ph.value}</ph>` : `<ph name="${ph.name}"/>`;
    }
    visitIcuPlaceholder(ph, context) {
        return `<ph icu name="${ph.name}">${ph.value.visit(this)}</ph>`;
    }
    visitBlockPlaceholder(ph, context) {
        return `<ph block name="${ph.startName}">${ph.children
            .map((child) => child.visit(this))
            .join(', ')}</ph name="${ph.closeName}">`;
    }
}
const serializerVisitor = new _SerializerVisitor();
export function serializeNodes(nodes) {
    return nodes.map((a) => a.visit(serializerVisitor, null));
}
/**
 * Serialize the i18n ast to something xml-like in order to generate an UID.
 *
 * Ignore the ICU expressions so that message IDs stays identical if only the expression changes.
 *
 * @internal
 */
class _SerializerIgnoreIcuExpVisitor extends _SerializerVisitor {
    visitIcu(icu, context) {
        let strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
        // Do not take the expression into account
        return `{${icu.type}, ${strCases.join(', ')}}`;
    }
}
/**
 * Compute the SHA1 of the given string
 *
 * see https://csrc.nist.gov/publications/fips/fips180-4/fips-180-4.pdf
 *
 * WARNING: this function has not been designed not tested with security in mind.
 *          DO NOT USE IT IN A SECURITY SENSITIVE CONTEXT.
 */
export function sha1(str) {
    textEncoder ??= new TextEncoder();
    const utf8 = [...textEncoder.encode(str)];
    const words32 = bytesToWords32(utf8, Endian.Big);
    const len = utf8.length * 8;
    const w = new Uint32Array(80);
    let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476, e = 0xc3d2e1f0;
    words32[len >> 5] |= 0x80 << (24 - (len % 32));
    words32[(((len + 64) >> 9) << 4) + 15] = len;
    for (let i = 0; i < words32.length; i += 16) {
        const h0 = a, h1 = b, h2 = c, h3 = d, h4 = e;
        for (let j = 0; j < 80; j++) {
            if (j < 16) {
                w[j] = words32[i + j];
            }
            else {
                w[j] = rol32(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
            }
            const fkVal = fk(j, b, c, d);
            const f = fkVal[0];
            const k = fkVal[1];
            const temp = [rol32(a, 5), f, e, k, w[j]].reduce(add32);
            e = d;
            d = c;
            c = rol32(b, 30);
            b = a;
            a = temp;
        }
        a = add32(a, h0);
        b = add32(b, h1);
        c = add32(c, h2);
        d = add32(d, h3);
        e = add32(e, h4);
    }
    // Convert the output parts to a 160-bit hexadecimal string
    return toHexU32(a) + toHexU32(b) + toHexU32(c) + toHexU32(d) + toHexU32(e);
}
/**
 * Convert and format a number as a string representing a 32-bit unsigned hexadecimal number.
 * @param value The value to format as a string.
 * @returns A hexadecimal string representing the value.
 */
function toHexU32(value) {
    // unsigned right shift of zero ensures an unsigned 32-bit number
    return (value >>> 0).toString(16).padStart(8, '0');
}
function fk(index, b, c, d) {
    if (index < 20) {
        return [(b & c) | (~b & d), 0x5a827999];
    }
    if (index < 40) {
        return [b ^ c ^ d, 0x6ed9eba1];
    }
    if (index < 60) {
        return [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
    }
    return [b ^ c ^ d, 0xca62c1d6];
}
/**
 * Compute the fingerprint of the given string
 *
 * The output is 64 bit number encoded as a decimal string
 *
 * based on:
 * https://github.com/google/closure-compiler/blob/master/src/com/google/javascript/jscomp/GoogleJsMessageIdGenerator.java
 */
export function fingerprint(str) {
    textEncoder ??= new TextEncoder();
    const utf8 = textEncoder.encode(str);
    const view = new DataView(utf8.buffer, utf8.byteOffset, utf8.byteLength);
    let hi = hash32(view, utf8.length, 0);
    let lo = hash32(view, utf8.length, 102072);
    if (hi == 0 && (lo == 0 || lo == 1)) {
        hi = hi ^ 0x130f9bef;
        lo = lo ^ -0x6b5f56d8;
    }
    return (BigInt.asUintN(32, BigInt(hi)) << BigInt(32)) | BigInt.asUintN(32, BigInt(lo));
}
export function computeMsgId(msg, meaning = '') {
    let msgFingerprint = fingerprint(msg);
    if (meaning) {
        // Rotate the 64-bit message fingerprint one bit to the left and then add the meaning
        // fingerprint.
        msgFingerprint =
            BigInt.asUintN(64, msgFingerprint << BigInt(1)) |
                ((msgFingerprint >> BigInt(63)) & BigInt(1));
        msgFingerprint += fingerprint(meaning);
    }
    return BigInt.asUintN(63, msgFingerprint).toString();
}
function hash32(view, length, c) {
    let a = 0x9e3779b9, b = 0x9e3779b9;
    let index = 0;
    const end = length - 12;
    for (; index <= end; index += 12) {
        a += view.getUint32(index, true);
        b += view.getUint32(index + 4, true);
        c += view.getUint32(index + 8, true);
        const res = mix(a, b, c);
        (a = res[0]), (b = res[1]), (c = res[2]);
    }
    const remainder = length - index;
    // the first byte of c is reserved for the length
    c += length;
    if (remainder >= 4) {
        a += view.getUint32(index, true);
        index += 4;
        if (remainder >= 8) {
            b += view.getUint32(index, true);
            index += 4;
            // Partial 32-bit word for c
            if (remainder >= 9) {
                c += view.getUint8(index++) << 8;
            }
            if (remainder >= 10) {
                c += view.getUint8(index++) << 16;
            }
            if (remainder === 11) {
                c += view.getUint8(index++) << 24;
            }
        }
        else {
            // Partial 32-bit word for b
            if (remainder >= 5) {
                b += view.getUint8(index++);
            }
            if (remainder >= 6) {
                b += view.getUint8(index++) << 8;
            }
            if (remainder === 7) {
                b += view.getUint8(index++) << 16;
            }
        }
    }
    else {
        // Partial 32-bit word for a
        if (remainder >= 1) {
            a += view.getUint8(index++);
        }
        if (remainder >= 2) {
            a += view.getUint8(index++) << 8;
        }
        if (remainder === 3) {
            a += view.getUint8(index++) << 16;
        }
    }
    return mix(a, b, c)[2];
}
function mix(a, b, c) {
    a -= b;
    a -= c;
    a ^= c >>> 13;
    b -= c;
    b -= a;
    b ^= a << 8;
    c -= a;
    c -= b;
    c ^= b >>> 13;
    a -= b;
    a -= c;
    a ^= c >>> 12;
    b -= c;
    b -= a;
    b ^= a << 16;
    c -= a;
    c -= b;
    c ^= b >>> 5;
    a -= b;
    a -= c;
    a ^= c >>> 3;
    b -= c;
    b -= a;
    b ^= a << 10;
    c -= a;
    c -= b;
    c ^= b >>> 15;
    return [a, b, c];
}
// Utils
var Endian;
(function (Endian) {
    Endian[Endian["Little"] = 0] = "Little";
    Endian[Endian["Big"] = 1] = "Big";
})(Endian || (Endian = {}));
function add32(a, b) {
    return add32to64(a, b)[1];
}
function add32to64(a, b) {
    const low = (a & 0xffff) + (b & 0xffff);
    const high = (a >>> 16) + (b >>> 16) + (low >>> 16);
    return [high >>> 16, (high << 16) | (low & 0xffff)];
}
// Rotate a 32b number left `count` position
function rol32(a, count) {
    return (a << count) | (a >>> (32 - count));
}
function bytesToWords32(bytes, endian) {
    const size = (bytes.length + 3) >>> 2;
    const words32 = [];
    for (let i = 0; i < size; i++) {
        words32[i] = wordAt(bytes, i * 4, endian);
    }
    return words32;
}
function byteAt(bytes, index) {
    return index >= bytes.length ? 0 : bytes[index];
}
function wordAt(bytes, index, endian) {
    let word = 0;
    if (endian === Endian.Big) {
        for (let i = 0; i < 4; i++) {
            word += byteAt(bytes, index + i) << (24 - 8 * i);
        }
    }
    else {
        for (let i = 0; i < 4; i++) {
            word += byteAt(bytes, index + i) << (8 * i);
        }
    }
    return word;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlnZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL2kxOG4vZGlnZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQU1IOztHQUVHO0FBQ0gsSUFBSSxXQUFvQyxDQUFDO0FBRXpDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLE1BQU0sQ0FBQyxPQUFxQjtJQUMxQyxPQUFPLE9BQU8sQ0FBQyxFQUFFLElBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBcUI7SUFDakQsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztBQUMvRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsYUFBYSxDQUFDLE9BQXFCO0lBQ2pELE9BQU8sT0FBTyxDQUFDLEVBQUUsSUFBSSxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsT0FBcUI7SUFDeEQsTUFBTSxPQUFPLEdBQUcsSUFBSSw4QkFBOEIsRUFBRSxDQUFDO0lBQ3JELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQy9ELE9BQU8sWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLGtCQUFrQjtJQUN0QixTQUFTLENBQUMsSUFBZSxFQUFFLE9BQVk7UUFDckMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7SUFFRCxjQUFjLENBQUMsU0FBeUIsRUFBRSxPQUFZO1FBQ3BELE9BQU8sSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2hGLENBQUM7SUFFRCxRQUFRLENBQUMsR0FBYSxFQUFFLE9BQVk7UUFDbEMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUN6QyxDQUFDLENBQVMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FDcEQsQ0FBQztRQUNGLE9BQU8sSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxFQUF1QixFQUFFLE9BQVk7UUFDdkQsT0FBTyxFQUFFLENBQUMsTUFBTTtZQUNkLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLFNBQVMsS0FBSztZQUNwQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxTQUFTLEtBQUssRUFBRSxDQUFDLFFBQVE7aUJBQzFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxTQUFTLElBQUksQ0FBQztJQUNsRCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsRUFBb0IsRUFBRSxPQUFZO1FBQ2pELE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUM7SUFDekYsQ0FBQztJQUVELG1CQUFtQixDQUFDLEVBQXVCLEVBQUUsT0FBYTtRQUN4RCxPQUFPLGlCQUFpQixFQUFFLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDbEUsQ0FBQztJQUVELHFCQUFxQixDQUFDLEVBQXlCLEVBQUUsT0FBWTtRQUMzRCxPQUFPLG1CQUFtQixFQUFFLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxRQUFRO2FBQ25ELEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLFNBQVMsSUFBSSxDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQUVELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO0FBRW5ELE1BQU0sVUFBVSxjQUFjLENBQUMsS0FBa0I7SUFDL0MsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDNUQsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILE1BQU0sOEJBQStCLFNBQVEsa0JBQWtCO0lBQ3BELFFBQVEsQ0FBQyxHQUFhLEVBQUUsT0FBWTtRQUMzQyxJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFTLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvRiwwQ0FBMEM7UUFDMUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2pELENBQUM7Q0FDRjtBQUVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsSUFBSSxDQUFDLEdBQVc7SUFDOUIsV0FBVyxLQUFLLElBQUksV0FBVyxFQUFFLENBQUM7SUFDbEMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUU1QixNQUFNLENBQUMsR0FBRyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM5QixJQUFJLENBQUMsR0FBRyxVQUFVLEVBQ2hCLENBQUMsR0FBRyxVQUFVLEVBQ2QsQ0FBQyxHQUFHLFVBQVUsRUFDZCxDQUFDLEdBQUcsVUFBVSxFQUNkLENBQUMsR0FBRyxVQUFVLENBQUM7SUFFakIsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUU3QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDNUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUNWLEVBQUUsR0FBRyxDQUFDLEVBQ04sRUFBRSxHQUFHLENBQUMsRUFDTixFQUFFLEdBQUcsQ0FBQyxFQUNOLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFVCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7Z0JBQ1gsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMvRCxDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuQixNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN4RCxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ04sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNOLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2pCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDTixDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ1gsQ0FBQztRQUNELENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ25CLENBQUM7SUFFRCwyREFBMkQ7SUFDM0QsT0FBTyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdFLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxRQUFRLENBQUMsS0FBYTtJQUM3QixpRUFBaUU7SUFDakUsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBRUQsU0FBUyxFQUFFLENBQUMsS0FBYSxFQUFFLENBQVMsRUFBRSxDQUFTLEVBQUUsQ0FBUztJQUN4RCxJQUFJLEtBQUssR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxJQUFJLEtBQUssR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUNmLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsSUFBSSxLQUFLLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVELE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxXQUFXLENBQUMsR0FBVztJQUNyQyxXQUFXLEtBQUssSUFBSSxXQUFXLEVBQUUsQ0FBQztJQUNsQyxNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDLE1BQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFFekUsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLElBQUksRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUUzQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3BDLEVBQUUsR0FBRyxFQUFFLEdBQUcsVUFBVSxDQUFDO1FBQ3JCLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUM7SUFDeEIsQ0FBQztJQUVELE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN6RixDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxHQUFXLEVBQUUsVUFBa0IsRUFBRTtJQUM1RCxJQUFJLGNBQWMsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFdEMsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNaLHFGQUFxRjtRQUNyRixlQUFlO1FBQ2YsY0FBYztZQUNaLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLGNBQWMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9DLENBQUMsQ0FBQyxjQUFjLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0MsY0FBYyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxjQUFjLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUN2RCxDQUFDO0FBRUQsU0FBUyxNQUFNLENBQUMsSUFBYyxFQUFFLE1BQWMsRUFBRSxDQUFTO0lBQ3ZELElBQUksQ0FBQyxHQUFHLFVBQVUsRUFDaEIsQ0FBQyxHQUFHLFVBQVUsQ0FBQztJQUNqQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFFZCxNQUFNLEdBQUcsR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLE9BQU8sS0FBSyxJQUFJLEdBQUcsRUFBRSxLQUFLLElBQUksRUFBRSxFQUFFLENBQUM7UUFDakMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pDLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckMsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyQyxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QixDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxHQUFHLEtBQUssQ0FBQztJQUVqQyxpREFBaUQ7SUFDakQsQ0FBQyxJQUFJLE1BQU0sQ0FBQztJQUVaLElBQUksU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ25CLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqQyxLQUFLLElBQUksQ0FBQyxDQUFDO1FBRVgsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbkIsQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pDLEtBQUssSUFBSSxDQUFDLENBQUM7WUFFWCw0QkFBNEI7WUFDNUIsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ25CLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25DLENBQUM7WUFDRCxJQUFJLFNBQVMsSUFBSSxFQUFFLEVBQUUsQ0FBQztnQkFDcEIsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEMsQ0FBQztZQUNELElBQUksU0FBUyxLQUFLLEVBQUUsRUFBRSxDQUFDO2dCQUNyQixDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNwQyxDQUFDO1FBQ0gsQ0FBQzthQUFNLENBQUM7WUFDTiw0QkFBNEI7WUFDNUIsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ25CLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDOUIsQ0FBQztZQUNELElBQUksU0FBUyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNuQixDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3BCLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3BDLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztTQUFNLENBQUM7UUFDTiw0QkFBNEI7UUFDNUIsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbkIsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUM5QixDQUFDO1FBQ0QsSUFBSSxTQUFTLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDbkIsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELElBQUksU0FBUyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BCLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BDLENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QixDQUFDO0FBRUQsU0FBUyxHQUFHLENBQUMsQ0FBUyxFQUFFLENBQVMsRUFBRSxDQUFTO0lBQzFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1osQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNkLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNiLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDYixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNQLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDUCxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNkLE9B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bnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Qnl0ZX0gZnJvbSAnLi4vdXRpbCc7XG5cbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi9pMThuX2FzdCc7XG5cbi8qKlxuICogQSBsYXppbHkgY3JlYXRlZCBUZXh0RW5jb2RlciBpbnN0YW5jZSBmb3IgY29udmVydGluZyBzdHJpbmdzIGludG8gVVRGLTggYnl0ZXNcbiAqL1xubGV0IHRleHRFbmNvZGVyOiBUZXh0RW5jb2RlciB8IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIG1lc3NhZ2UgaWQgb3IgY29tcHV0ZSBpdCB1c2luZyB0aGUgWExJRkYxIGRpZ2VzdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZ2VzdChtZXNzYWdlOiBpMThuLk1lc3NhZ2UpOiBzdHJpbmcge1xuICByZXR1cm4gbWVzc2FnZS5pZCB8fCBjb21wdXRlRGlnZXN0KG1lc3NhZ2UpO1xufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIG1lc3NhZ2UgaWQgdXNpbmcgdGhlIFhMSUZGMSBkaWdlc3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlRGlnZXN0KG1lc3NhZ2U6IGkxOG4uTWVzc2FnZSk6IHN0cmluZyB7XG4gIHJldHVybiBzaGExKHNlcmlhbGl6ZU5vZGVzKG1lc3NhZ2Uubm9kZXMpLmpvaW4oJycpICsgYFske21lc3NhZ2UubWVhbmluZ31dYCk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBtZXNzYWdlIGlkIG9yIGNvbXB1dGUgaXQgdXNpbmcgdGhlIFhMSUZGMi9YTUIvJGxvY2FsaXplIGRpZ2VzdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlY2ltYWxEaWdlc3QobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHtcbiAgcmV0dXJuIG1lc3NhZ2UuaWQgfHwgY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZSk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0aGUgbWVzc2FnZSBpZCB1c2luZyB0aGUgWExJRkYyL1hNQi8kbG9jYWxpemUgZGlnZXN0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZURlY2ltYWxEaWdlc3QobWVzc2FnZTogaTE4bi5NZXNzYWdlKTogc3RyaW5nIHtcbiAgY29uc3QgdmlzaXRvciA9IG5ldyBfU2VyaWFsaXplcklnbm9yZUljdUV4cFZpc2l0b3IoKTtcbiAgY29uc3QgcGFydHMgPSBtZXNzYWdlLm5vZGVzLm1hcCgoYSkgPT4gYS52aXNpdCh2aXNpdG9yLCBudWxsKSk7XG4gIHJldHVybiBjb21wdXRlTXNnSWQocGFydHMuam9pbignJyksIG1lc3NhZ2UubWVhbmluZyk7XG59XG5cbi8qKlxuICogU2VyaWFsaXplIHRoZSBpMThuIGFzdCB0byBzb21ldGhpbmcgeG1sLWxpa2UgaW4gb3JkZXIgdG8gZ2VuZXJhdGUgYW4gVUlELlxuICpcbiAqIFRoZSB2aXNpdG9yIGlzIGFsc28gdXNlZCBpbiB0aGUgaTE4biBwYXJzZXIgdGVzdHNcbiAqXG4gKiBAaW50ZXJuYWxcbiAqL1xuY2xhc3MgX1NlcmlhbGl6ZXJWaXNpdG9yIGltcGxlbWVudHMgaTE4bi5WaXNpdG9yIHtcbiAgdmlzaXRUZXh0KHRleHQ6IGkxOG4uVGV4dCwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gdGV4dC52YWx1ZTtcbiAgfVxuXG4gIHZpc2l0Q29udGFpbmVyKGNvbnRhaW5lcjogaTE4bi5Db250YWluZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGBbJHtjb250YWluZXIuY2hpbGRyZW4ubWFwKChjaGlsZCkgPT4gY2hpbGQudmlzaXQodGhpcykpLmpvaW4oJywgJyl9XWA7XG4gIH1cblxuICB2aXNpdEljdShpY3U6IGkxOG4uSWN1LCBjb250ZXh0OiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHN0ckNhc2VzID0gT2JqZWN0LmtleXMoaWN1LmNhc2VzKS5tYXAoXG4gICAgICAoazogc3RyaW5nKSA9PiBgJHtrfSB7JHtpY3UuY2FzZXNba10udmlzaXQodGhpcyl9fWAsXG4gICAgKTtcbiAgICByZXR1cm4gYHske2ljdS5leHByZXNzaW9ufSwgJHtpY3UudHlwZX0sICR7c3RyQ2FzZXMuam9pbignLCAnKX19YDtcbiAgfVxuXG4gIHZpc2l0VGFnUGxhY2Vob2xkZXIocGg6IGkxOG4uVGFnUGxhY2Vob2xkZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHBoLmlzVm9pZFxuICAgICAgPyBgPHBoIHRhZyBuYW1lPVwiJHtwaC5zdGFydE5hbWV9XCIvPmBcbiAgICAgIDogYDxwaCB0YWcgbmFtZT1cIiR7cGguc3RhcnROYW1lfVwiPiR7cGguY2hpbGRyZW5cbiAgICAgICAgICAubWFwKChjaGlsZCkgPT4gY2hpbGQudmlzaXQodGhpcykpXG4gICAgICAgICAgLmpvaW4oJywgJyl9PC9waCBuYW1lPVwiJHtwaC5jbG9zZU5hbWV9XCI+YDtcbiAgfVxuXG4gIHZpc2l0UGxhY2Vob2xkZXIocGg6IGkxOG4uUGxhY2Vob2xkZXIsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIHBoLnZhbHVlID8gYDxwaCBuYW1lPVwiJHtwaC5uYW1lfVwiPiR7cGgudmFsdWV9PC9waD5gIDogYDxwaCBuYW1lPVwiJHtwaC5uYW1lfVwiLz5gO1xuICB9XG5cbiAgdmlzaXRJY3VQbGFjZWhvbGRlcihwaDogaTE4bi5JY3VQbGFjZWhvbGRlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgcmV0dXJuIGA8cGggaWN1IG5hbWU9XCIke3BoLm5hbWV9XCI+JHtwaC52YWx1ZS52aXNpdCh0aGlzKX08L3BoPmA7XG4gIH1cblxuICB2aXNpdEJsb2NrUGxhY2Vob2xkZXIocGg6IGkxOG4uQmxvY2tQbGFjZWhvbGRlciwgY29udGV4dDogYW55KTogYW55IHtcbiAgICByZXR1cm4gYDxwaCBibG9jayBuYW1lPVwiJHtwaC5zdGFydE5hbWV9XCI+JHtwaC5jaGlsZHJlblxuICAgICAgLm1hcCgoY2hpbGQpID0+IGNoaWxkLnZpc2l0KHRoaXMpKVxuICAgICAgLmpvaW4oJywgJyl9PC9waCBuYW1lPVwiJHtwaC5jbG9zZU5hbWV9XCI+YDtcbiAgfVxufVxuXG5jb25zdCBzZXJpYWxpemVyVmlzaXRvciA9IG5ldyBfU2VyaWFsaXplclZpc2l0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZU5vZGVzKG5vZGVzOiBpMThuLk5vZGVbXSk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIG5vZGVzLm1hcCgoYSkgPT4gYS52aXNpdChzZXJpYWxpemVyVmlzaXRvciwgbnVsbCkpO1xufVxuXG4vKipcbiAqIFNlcmlhbGl6ZSB0aGUgaTE4biBhc3QgdG8gc29tZXRoaW5nIHhtbC1saWtlIGluIG9yZGVyIHRvIGdlbmVyYXRlIGFuIFVJRC5cbiAqXG4gKiBJZ25vcmUgdGhlIElDVSBleHByZXNzaW9ucyBzbyB0aGF0IG1lc3NhZ2UgSURzIHN0YXlzIGlkZW50aWNhbCBpZiBvbmx5IHRoZSBleHByZXNzaW9uIGNoYW5nZXMuXG4gKlxuICogQGludGVybmFsXG4gKi9cbmNsYXNzIF9TZXJpYWxpemVySWdub3JlSWN1RXhwVmlzaXRvciBleHRlbmRzIF9TZXJpYWxpemVyVmlzaXRvciB7XG4gIG92ZXJyaWRlIHZpc2l0SWN1KGljdTogaTE4bi5JY3UsIGNvbnRleHQ6IGFueSk6IGFueSB7XG4gICAgbGV0IHN0ckNhc2VzID0gT2JqZWN0LmtleXMoaWN1LmNhc2VzKS5tYXAoKGs6IHN0cmluZykgPT4gYCR7a30geyR7aWN1LmNhc2VzW2tdLnZpc2l0KHRoaXMpfX1gKTtcbiAgICAvLyBEbyBub3QgdGFrZSB0aGUgZXhwcmVzc2lvbiBpbnRvIGFjY291bnRcbiAgICByZXR1cm4gYHske2ljdS50eXBlfSwgJHtzdHJDYXNlcy5qb2luKCcsICcpfX1gO1xuICB9XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0aGUgU0hBMSBvZiB0aGUgZ2l2ZW4gc3RyaW5nXG4gKlxuICogc2VlIGh0dHBzOi8vY3NyYy5uaXN0Lmdvdi9wdWJsaWNhdGlvbnMvZmlwcy9maXBzMTgwLTQvZmlwcy0xODAtNC5wZGZcbiAqXG4gKiBXQVJOSU5HOiB0aGlzIGZ1bmN0aW9uIGhhcyBub3QgYmVlbiBkZXNpZ25lZCBub3QgdGVzdGVkIHdpdGggc2VjdXJpdHkgaW4gbWluZC5cbiAqICAgICAgICAgIERPIE5PVCBVU0UgSVQgSU4gQSBTRUNVUklUWSBTRU5TSVRJVkUgQ09OVEVYVC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNoYTEoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICB0ZXh0RW5jb2RlciA/Pz0gbmV3IFRleHRFbmNvZGVyKCk7XG4gIGNvbnN0IHV0ZjggPSBbLi4udGV4dEVuY29kZXIuZW5jb2RlKHN0cildO1xuICBjb25zdCB3b3JkczMyID0gYnl0ZXNUb1dvcmRzMzIodXRmOCwgRW5kaWFuLkJpZyk7XG4gIGNvbnN0IGxlbiA9IHV0ZjgubGVuZ3RoICogODtcblxuICBjb25zdCB3ID0gbmV3IFVpbnQzMkFycmF5KDgwKTtcbiAgbGV0IGEgPSAweDY3NDUyMzAxLFxuICAgIGIgPSAweGVmY2RhYjg5LFxuICAgIGMgPSAweDk4YmFkY2ZlLFxuICAgIGQgPSAweDEwMzI1NDc2LFxuICAgIGUgPSAweGMzZDJlMWYwO1xuXG4gIHdvcmRzMzJbbGVuID4+IDVdIHw9IDB4ODAgPDwgKDI0IC0gKGxlbiAlIDMyKSk7XG4gIHdvcmRzMzJbKCgobGVuICsgNjQpID4+IDkpIDw8IDQpICsgMTVdID0gbGVuO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgd29yZHMzMi5sZW5ndGg7IGkgKz0gMTYpIHtcbiAgICBjb25zdCBoMCA9IGEsXG4gICAgICBoMSA9IGIsXG4gICAgICBoMiA9IGMsXG4gICAgICBoMyA9IGQsXG4gICAgICBoNCA9IGU7XG5cbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IDgwOyBqKyspIHtcbiAgICAgIGlmIChqIDwgMTYpIHtcbiAgICAgICAgd1tqXSA9IHdvcmRzMzJbaSArIGpdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgd1tqXSA9IHJvbDMyKHdbaiAtIDNdIF4gd1tqIC0gOF0gXiB3W2ogLSAxNF0gXiB3W2ogLSAxNl0sIDEpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBma1ZhbCA9IGZrKGosIGIsIGMsIGQpO1xuICAgICAgY29uc3QgZiA9IGZrVmFsWzBdO1xuICAgICAgY29uc3QgayA9IGZrVmFsWzFdO1xuICAgICAgY29uc3QgdGVtcCA9IFtyb2wzMihhLCA1KSwgZiwgZSwgaywgd1tqXV0ucmVkdWNlKGFkZDMyKTtcbiAgICAgIGUgPSBkO1xuICAgICAgZCA9IGM7XG4gICAgICBjID0gcm9sMzIoYiwgMzApO1xuICAgICAgYiA9IGE7XG4gICAgICBhID0gdGVtcDtcbiAgICB9XG4gICAgYSA9IGFkZDMyKGEsIGgwKTtcbiAgICBiID0gYWRkMzIoYiwgaDEpO1xuICAgIGMgPSBhZGQzMihjLCBoMik7XG4gICAgZCA9IGFkZDMyKGQsIGgzKTtcbiAgICBlID0gYWRkMzIoZSwgaDQpO1xuICB9XG5cbiAgLy8gQ29udmVydCB0aGUgb3V0cHV0IHBhcnRzIHRvIGEgMTYwLWJpdCBoZXhhZGVjaW1hbCBzdHJpbmdcbiAgcmV0dXJuIHRvSGV4VTMyKGEpICsgdG9IZXhVMzIoYikgKyB0b0hleFUzMihjKSArIHRvSGV4VTMyKGQpICsgdG9IZXhVMzIoZSk7XG59XG5cbi8qKlxuICogQ29udmVydCBhbmQgZm9ybWF0IGEgbnVtYmVyIGFzIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhIDMyLWJpdCB1bnNpZ25lZCBoZXhhZGVjaW1hbCBudW1iZXIuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIGZvcm1hdCBhcyBhIHN0cmluZy5cbiAqIEByZXR1cm5zIEEgaGV4YWRlY2ltYWwgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIHRvSGV4VTMyKHZhbHVlOiBudW1iZXIpOiBzdHJpbmcge1xuICAvLyB1bnNpZ25lZCByaWdodCBzaGlmdCBvZiB6ZXJvIGVuc3VyZXMgYW4gdW5zaWduZWQgMzItYml0IG51bWJlclxuICByZXR1cm4gKHZhbHVlID4+PiAwKS50b1N0cmluZygxNikucGFkU3RhcnQoOCwgJzAnKTtcbn1cblxuZnVuY3Rpb24gZmsoaW5kZXg6IG51bWJlciwgYjogbnVtYmVyLCBjOiBudW1iZXIsIGQ6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICBpZiAoaW5kZXggPCAyMCkge1xuICAgIHJldHVybiBbKGIgJiBjKSB8ICh+YiAmIGQpLCAweDVhODI3OTk5XTtcbiAgfVxuXG4gIGlmIChpbmRleCA8IDQwKSB7XG4gICAgcmV0dXJuIFtiIF4gYyBeIGQsIDB4NmVkOWViYTFdO1xuICB9XG5cbiAgaWYgKGluZGV4IDwgNjApIHtcbiAgICByZXR1cm4gWyhiICYgYykgfCAoYiAmIGQpIHwgKGMgJiBkKSwgMHg4ZjFiYmNkY107XG4gIH1cblxuICByZXR1cm4gW2IgXiBjIF4gZCwgMHhjYTYyYzFkNl07XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0aGUgZmluZ2VycHJpbnQgb2YgdGhlIGdpdmVuIHN0cmluZ1xuICpcbiAqIFRoZSBvdXRwdXQgaXMgNjQgYml0IG51bWJlciBlbmNvZGVkIGFzIGEgZGVjaW1hbCBzdHJpbmdcbiAqXG4gKiBiYXNlZCBvbjpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9nb29nbGUvY2xvc3VyZS1jb21waWxlci9ibG9iL21hc3Rlci9zcmMvY29tL2dvb2dsZS9qYXZhc2NyaXB0L2pzY29tcC9Hb29nbGVKc01lc3NhZ2VJZEdlbmVyYXRvci5qYXZhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5nZXJwcmludChzdHI6IHN0cmluZyk6IGJpZ2ludCB7XG4gIHRleHRFbmNvZGVyID8/PSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgY29uc3QgdXRmOCA9IHRleHRFbmNvZGVyLmVuY29kZShzdHIpO1xuICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KHV0ZjguYnVmZmVyLCB1dGY4LmJ5dGVPZmZzZXQsIHV0ZjguYnl0ZUxlbmd0aCk7XG5cbiAgbGV0IGhpID0gaGFzaDMyKHZpZXcsIHV0ZjgubGVuZ3RoLCAwKTtcbiAgbGV0IGxvID0gaGFzaDMyKHZpZXcsIHV0ZjgubGVuZ3RoLCAxMDIwNzIpO1xuXG4gIGlmIChoaSA9PSAwICYmIChsbyA9PSAwIHx8IGxvID09IDEpKSB7XG4gICAgaGkgPSBoaSBeIDB4MTMwZjliZWY7XG4gICAgbG8gPSBsbyBeIC0weDZiNWY1NmQ4O1xuICB9XG5cbiAgcmV0dXJuIChCaWdJbnQuYXNVaW50TigzMiwgQmlnSW50KGhpKSkgPDwgQmlnSW50KDMyKSkgfCBCaWdJbnQuYXNVaW50TigzMiwgQmlnSW50KGxvKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlTXNnSWQobXNnOiBzdHJpbmcsIG1lYW5pbmc6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgbGV0IG1zZ0ZpbmdlcnByaW50ID0gZmluZ2VycHJpbnQobXNnKTtcblxuICBpZiAobWVhbmluZykge1xuICAgIC8vIFJvdGF0ZSB0aGUgNjQtYml0IG1lc3NhZ2UgZmluZ2VycHJpbnQgb25lIGJpdCB0byB0aGUgbGVmdCBhbmQgdGhlbiBhZGQgdGhlIG1lYW5pbmdcbiAgICAvLyBmaW5nZXJwcmludC5cbiAgICBtc2dGaW5nZXJwcmludCA9XG4gICAgICBCaWdJbnQuYXNVaW50Tig2NCwgbXNnRmluZ2VycHJpbnQgPDwgQmlnSW50KDEpKSB8XG4gICAgICAoKG1zZ0ZpbmdlcnByaW50ID4+IEJpZ0ludCg2MykpICYgQmlnSW50KDEpKTtcbiAgICBtc2dGaW5nZXJwcmludCArPSBmaW5nZXJwcmludChtZWFuaW5nKTtcbiAgfVxuXG4gIHJldHVybiBCaWdJbnQuYXNVaW50Tig2MywgbXNnRmluZ2VycHJpbnQpLnRvU3RyaW5nKCk7XG59XG5cbmZ1bmN0aW9uIGhhc2gzMih2aWV3OiBEYXRhVmlldywgbGVuZ3RoOiBudW1iZXIsIGM6IG51bWJlcik6IG51bWJlciB7XG4gIGxldCBhID0gMHg5ZTM3NzliOSxcbiAgICBiID0gMHg5ZTM3NzliOTtcbiAgbGV0IGluZGV4ID0gMDtcblxuICBjb25zdCBlbmQgPSBsZW5ndGggLSAxMjtcbiAgZm9yICg7IGluZGV4IDw9IGVuZDsgaW5kZXggKz0gMTIpIHtcbiAgICBhICs9IHZpZXcuZ2V0VWludDMyKGluZGV4LCB0cnVlKTtcbiAgICBiICs9IHZpZXcuZ2V0VWludDMyKGluZGV4ICsgNCwgdHJ1ZSk7XG4gICAgYyArPSB2aWV3LmdldFVpbnQzMihpbmRleCArIDgsIHRydWUpO1xuICAgIGNvbnN0IHJlcyA9IG1peChhLCBiLCBjKTtcbiAgICAoYSA9IHJlc1swXSksIChiID0gcmVzWzFdKSwgKGMgPSByZXNbMl0pO1xuICB9XG5cbiAgY29uc3QgcmVtYWluZGVyID0gbGVuZ3RoIC0gaW5kZXg7XG5cbiAgLy8gdGhlIGZpcnN0IGJ5dGUgb2YgYyBpcyByZXNlcnZlZCBmb3IgdGhlIGxlbmd0aFxuICBjICs9IGxlbmd0aDtcblxuICBpZiAocmVtYWluZGVyID49IDQpIHtcbiAgICBhICs9IHZpZXcuZ2V0VWludDMyKGluZGV4LCB0cnVlKTtcbiAgICBpbmRleCArPSA0O1xuXG4gICAgaWYgKHJlbWFpbmRlciA+PSA4KSB7XG4gICAgICBiICs9IHZpZXcuZ2V0VWludDMyKGluZGV4LCB0cnVlKTtcbiAgICAgIGluZGV4ICs9IDQ7XG5cbiAgICAgIC8vIFBhcnRpYWwgMzItYml0IHdvcmQgZm9yIGNcbiAgICAgIGlmIChyZW1haW5kZXIgPj0gOSkge1xuICAgICAgICBjICs9IHZpZXcuZ2V0VWludDgoaW5kZXgrKykgPDwgODtcbiAgICAgIH1cbiAgICAgIGlmIChyZW1haW5kZXIgPj0gMTApIHtcbiAgICAgICAgYyArPSB2aWV3LmdldFVpbnQ4KGluZGV4KyspIDw8IDE2O1xuICAgICAgfVxuICAgICAgaWYgKHJlbWFpbmRlciA9PT0gMTEpIHtcbiAgICAgICAgYyArPSB2aWV3LmdldFVpbnQ4KGluZGV4KyspIDw8IDI0O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBQYXJ0aWFsIDMyLWJpdCB3b3JkIGZvciBiXG4gICAgICBpZiAocmVtYWluZGVyID49IDUpIHtcbiAgICAgICAgYiArPSB2aWV3LmdldFVpbnQ4KGluZGV4KyspO1xuICAgICAgfVxuICAgICAgaWYgKHJlbWFpbmRlciA+PSA2KSB7XG4gICAgICAgIGIgKz0gdmlldy5nZXRVaW50OChpbmRleCsrKSA8PCA4O1xuICAgICAgfVxuICAgICAgaWYgKHJlbWFpbmRlciA9PT0gNykge1xuICAgICAgICBiICs9IHZpZXcuZ2V0VWludDgoaW5kZXgrKykgPDwgMTY7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIFBhcnRpYWwgMzItYml0IHdvcmQgZm9yIGFcbiAgICBpZiAocmVtYWluZGVyID49IDEpIHtcbiAgICAgIGEgKz0gdmlldy5nZXRVaW50OChpbmRleCsrKTtcbiAgICB9XG4gICAgaWYgKHJlbWFpbmRlciA+PSAyKSB7XG4gICAgICBhICs9IHZpZXcuZ2V0VWludDgoaW5kZXgrKykgPDwgODtcbiAgICB9XG4gICAgaWYgKHJlbWFpbmRlciA9PT0gMykge1xuICAgICAgYSArPSB2aWV3LmdldFVpbnQ4KGluZGV4KyspIDw8IDE2O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtaXgoYSwgYiwgYylbMl07XG59XG5cbmZ1bmN0aW9uIG1peChhOiBudW1iZXIsIGI6IG51bWJlciwgYzogbnVtYmVyKTogW251bWJlciwgbnVtYmVyLCBudW1iZXJdIHtcbiAgYSAtPSBiO1xuICBhIC09IGM7XG4gIGEgXj0gYyA+Pj4gMTM7XG4gIGIgLT0gYztcbiAgYiAtPSBhO1xuICBiIF49IGEgPDwgODtcbiAgYyAtPSBhO1xuICBjIC09IGI7XG4gIGMgXj0gYiA+Pj4gMTM7XG4gIGEgLT0gYjtcbiAgYSAtPSBjO1xuICBhIF49IGMgPj4+IDEyO1xuICBiIC09IGM7XG4gIGIgLT0gYTtcbiAgYiBePSBhIDw8IDE2O1xuICBjIC09IGE7XG4gIGMgLT0gYjtcbiAgYyBePSBiID4+PiA1O1xuICBhIC09IGI7XG4gIGEgLT0gYztcbiAgYSBePSBjID4+PiAzO1xuICBiIC09IGM7XG4gIGIgLT0gYTtcbiAgYiBePSBhIDw8IDEwO1xuICBjIC09IGE7XG4gIGMgLT0gYjtcbiAgYyBePSBiID4+PiAxNTtcbiAgcmV0dXJuIFthLCBiLCBjXTtcbn1cblxuLy8gVXRpbHNcblxuZW51bSBFbmRpYW4ge1xuICBMaXR0bGUsXG4gIEJpZyxcbn1cblxuZnVuY3Rpb24gYWRkMzIoYTogbnVtYmVyLCBiOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gYWRkMzJ0bzY0KGEsIGIpWzFdO1xufVxuXG5mdW5jdGlvbiBhZGQzMnRvNjQoYTogbnVtYmVyLCBiOiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgY29uc3QgbG93ID0gKGEgJiAweGZmZmYpICsgKGIgJiAweGZmZmYpO1xuICBjb25zdCBoaWdoID0gKGEgPj4+IDE2KSArIChiID4+PiAxNikgKyAobG93ID4+PiAxNik7XG4gIHJldHVybiBbaGlnaCA+Pj4gMTYsIChoaWdoIDw8IDE2KSB8IChsb3cgJiAweGZmZmYpXTtcbn1cblxuLy8gUm90YXRlIGEgMzJiIG51bWJlciBsZWZ0IGBjb3VudGAgcG9zaXRpb25cbmZ1bmN0aW9uIHJvbDMyKGE6IG51bWJlciwgY291bnQ6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiAoYSA8PCBjb3VudCkgfCAoYSA+Pj4gKDMyIC0gY291bnQpKTtcbn1cblxuZnVuY3Rpb24gYnl0ZXNUb1dvcmRzMzIoYnl0ZXM6IEJ5dGVbXSwgZW5kaWFuOiBFbmRpYW4pOiBudW1iZXJbXSB7XG4gIGNvbnN0IHNpemUgPSAoYnl0ZXMubGVuZ3RoICsgMykgPj4+IDI7XG4gIGNvbnN0IHdvcmRzMzIgPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgIHdvcmRzMzJbaV0gPSB3b3JkQXQoYnl0ZXMsIGkgKiA0LCBlbmRpYW4pO1xuICB9XG5cbiAgcmV0dXJuIHdvcmRzMzI7XG59XG5cbmZ1bmN0aW9uIGJ5dGVBdChieXRlczogQnl0ZVtdLCBpbmRleDogbnVtYmVyKTogQnl0ZSB7XG4gIHJldHVybiBpbmRleCA+PSBieXRlcy5sZW5ndGggPyAwIDogYnl0ZXNbaW5kZXhdO1xufVxuXG5mdW5jdGlvbiB3b3JkQXQoYnl0ZXM6IEJ5dGVbXSwgaW5kZXg6IG51bWJlciwgZW5kaWFuOiBFbmRpYW4pOiBudW1iZXIge1xuICBsZXQgd29yZCA9IDA7XG4gIGlmIChlbmRpYW4gPT09IEVuZGlhbi5CaWcpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgd29yZCArPSBieXRlQXQoYnl0ZXMsIGluZGV4ICsgaSkgPDwgKDI0IC0gOCAqIGkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgd29yZCArPSBieXRlQXQoYnl0ZXMsIGluZGV4ICsgaSkgPDwgKDggKiBpKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHdvcmQ7XG59XG4iXX0=