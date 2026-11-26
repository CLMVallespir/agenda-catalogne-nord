// ============================================================
// POSTAL-MIME — DEPENDÈNCIA VENDORITZADA. NO L'EDITIS A MÀ.
//
// Aquest fitxer no és codi del projecte: és una còpia fixada de la
// biblioteca postal-mime, l'única dependència externa que «Què fas?»
// es permet (CLAUDE.md §3). Serveix per parsejar el MIME cru dels
// correus que arriben a agenda@clm.cat.
//
//   Paquet   : postal-mime
//   Versió   : 4.2.1  (publicada 2026-11-10)
//   Autor    : Andris Reinman / Postal Systems
//   Llicència: MIT-0  (sense obligació d'atribució; hi és per cortesia)
//   Origen   : https://registry.npmjs.org/postal-mime/-/postal-mime-4.2.1.tgz
//   sha256 del .tgz:
//     dad2b616bad1b49df28308446d4ce28bb8e377c07c469217721b692eeb750ae0
//   Codi font: https://github.com/postalsys/postal-mime
//   Substitueix la 3.0.0 (GHSA-f2hq-32vh-53cc, CPU quadràtica sobre un
//   encapçalament RFC 2047; corregit a partir de la 4.0.8).
//
// COM S'HA FET (per si algun dia cal refer-ho amb una versió nova):
// des de la 4.x el paquet npm està escrit en TypeScript i publica els
// mòduls ja compilats a `dist/esm/` (catorze fitxers amb codi; `types.js`
// és buit). S'han concatenat aquests catorze fitxers, en l'ordre de
// dependències:
//     errors.js, decode-strings.js, base64-encoder.js, html-entities.js,
//     chunk-writer.js, pass-through-decoder.js, base64-decoder.js,
//     qp-decoder.js, boundary-stack.js, otp-token.js, text-format.js,
//     mime-node.js, address-parser.js, postal-mime.js
// CANVIS respecte de l'original, tots mecànics: s'han esborrat les
// línies `import ... from './...'` (ara tot viu en un sol fitxer), les
// línies `export { ... }` i `export default X;`, i s'ha tret la paraula
// `export` de les declaracions; s'han esborrat els comentaris
// `sourceMappingURL`. Cap línia de lògica no s'ha tocat. Cada mòdul
// comença amb una línia `// --- nom.js ---`.
//
// SI CONCATENES AQUEST FITXER DINS worker.js (desplegament d'un sol
// fitxer al tauler de Cloudflare): esborra només l'última línia del
// fitxer, la de l'`export`, que hi ha marcada amb un comentari.
// ============================================================

// --- errors.js ------------------------------------------------------
// The error class each code is thrown as. An invalid option or input is a TypeError, as an
// invalid option was before codes were added
const ERROR_TYPES = {
    EINVALIDOPTION: TypeError,
    EINVALIDINPUT: TypeError,
    EPARSERREUSED: Error,
    EMAXNESTINGDEPTH: Error,
    EMAXHEADERSIZE: Error,
    EMAXPARTCOUNT: Error,
    EMAXFORWARDEDADDRESSES: Error
};
/**
 * Creates an error with a code
 *
 * @param code Error code
 * @param message Error message
 * @returns The error
 */
function createError(code, message) {
    const error = new ERROR_TYPES[code](message);
    error.code = code;
    return error;
}

// --- decode-strings.js ----------------------------------------------
const textEncoder = new TextEncoder();
/** SP or HTAB, the only whitespace RFC 5322 and RFC 2045 give a meaning to in a line */
const isWsp = (c) => c === 0x20 || c === 0x09;
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// Use a lookup table to find the index.
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars.charCodeAt(i)] = i;
}
function decodeBase64(base64) {
    // Padding carries no data, so the byte count comes from the payload alone. Sizing the
    // buffer from the raw length instead treated '=' as a data character and left the
    // output padded with NUL bytes, which then travelled into subjects and filenames.
    let len = base64.length;
    while (len > 0 && base64.charAt(len - 1) === '=') {
        len--;
    }
    // A remainder of one character cannot encode a byte, it is a truncated group
    if (len % 4 === 1) {
        len--;
    }
    const remainder = len % 4;
    const bufferLength = Math.floor(len / 4) * 3 + (remainder ? remainder - 1 : 0);
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const bytes = new Uint8Array(arrayBuffer);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
        let encoded1 = base64Lookup[base64.charCodeAt(i)];
        let encoded2 = base64Lookup[base64.charCodeAt(i + 1)];
        let encoded3 = base64Lookup[base64.charCodeAt(i + 2)];
        let encoded4 = base64Lookup[base64.charCodeAt(i + 3)];
        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        if (p < bufferLength) {
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        }
        if (p < bufferLength) {
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
    }
    return arrayBuffer;
}
// Charset labels the WHATWG Encoding Standard does not list, but that name an encoding
// TextDecoder can decode. Without an entry the TextDecoder constructor throws and
// getDecoder falls back to windows-1252, turning the body into mojibake with nothing to
// signal that the wrong decoder was used.
//
// Keys are normalized (see normalizeCharset), so one entry covers every spelling of a
// label, eg. `eucjp` also catches `euc_jp`, `x-eucjp` and `x-euc-jp`. Only labels that
// need real encoding knowledge belong here; anything that differs from a supported
// label by nothing but an `x-` prefix or a separator is handled by normalization alone.
const charsetAliases = new Map([
    // Hebrew. The logical and explicit ordering variants share the iso-8859-8 index.
    ['iso88598i', 'iso-8859-8'],
    ['iso88598e', 'iso-8859-8'],
    // Japanese. WHATWG shift_jis is the Windows-31J index, so cp932 text decodes
    // identically, including the NEC and IBM extension rows.
    ['shiftjis', 'shift_jis'],
    ['windows31j', 'shift_jis'],
    ['mskanji', 'shift_jis'],
    ['eucjp', 'euc-jp'],
    // ISO-2022-JP, including the -1 / -2 supersets. Escape sequences outside plain
    // ISO-2022-JP (JIS X 0212, the non-Japanese G2 sets, and the SO/SI katakana shifts
    // cp50222 uses) decode to replacement characters, but the Japanese text around them
    // still comes out right.
    ['iso2022jp', 'iso-2022-jp'],
    ['iso2022jp1', 'iso-2022-jp'],
    ['iso2022jp2', 'iso-2022-jp'],
    ['junet', 'iso-2022-jp'],
    // Korean. The WHATWG euc-kr index is the extended cp949 / UHC index.
    ['euckr', 'euc-kr'],
    ['uhc', 'euc-kr'],
    // Thai.
    ['tis620', 'windows-874']
]);
// Windows and IBM code page numbers, as written in labels like cp932, windows-932, ms932
// or ibm932. An explicit allowlist rather than a derived one, because plenty of code
// pages that appear in mail (cp437, cp850, cp1361) have no equivalent to map onto and
// have to keep falling back.
const codePageAliases = new Map([
    ['932', 'shift_jis'],
    ['936', 'gbk'],
    ['949', 'euc-kr'],
    ['950', 'big5'],
    ['874', 'windows-874'],
    // Microsoft's EUC-JP and ISO-2022-JP variants. euc-jp and iso-2022-jp cover
    // everything they can express.
    ['51932', 'euc-jp'],
    ['50220', 'iso-2022-jp'],
    ['50221', 'iso-2022-jp'],
    ['50222', 'iso-2022-jp']
]);
const codePagePattern = /^(?:cp|windows|ms|ibm)(\d+)$/;
// Strip the decorations mail clients add to an otherwise standard label: an x- vendor
// prefix, the IANA cs- prefix, and any separators.
function normalizeCharset(charset) {
    return charset.replace(/^(?:x-ms-|x-|cs)/, '').replace(/[\s._-]+/g, '');
}
// Every label of the WHATWG Encoding Standard, https://encoding.spec.whatwg.org/encodings.json,
// but for the UTF-16 family, which UTF16_LABELS resolves on its own.
//
// TextDecoder accepts these and nothing else, so a label outside the list is turned away
// without constructing a decoder for it. Letting the constructor throw instead costs
// several times the decode itself, and a message controls how often it happens: once
// per encoded word, twice when the label also fails after normalization.
const ENCODING_LABELS = new Set([
    // UTF-8
    'unicode-1-1-utf-8 unicode11utf8 unicode20utf8 utf-8 utf8 x-unicode20utf8',
    // IBM866
    '866 cp866 csibm866 ibm866',
    // ISO-8859-2
    'csisolatin2 iso-8859-2 iso-ir-101 iso8859-2 iso88592 iso_8859-2 iso_8859-2:1987 l2 latin2',
    // ISO-8859-3
    'csisolatin3 iso-8859-3 iso-ir-109 iso8859-3 iso88593 iso_8859-3 iso_8859-3:1988 l3 latin3',
    // ISO-8859-4
    'csisolatin4 iso-8859-4 iso-ir-110 iso8859-4 iso88594 iso_8859-4 iso_8859-4:1988 l4 latin4',
    // ISO-8859-5
    'csisolatincyrillic cyrillic iso-8859-5 iso-ir-144 iso8859-5 iso88595 iso_8859-5 iso_8859-5:1988',
    // ISO-8859-6
    'arabic asmo-708 csiso88596e csiso88596i csisolatinarabic ecma-114 iso-8859-6 iso-8859-6-e',
    'iso-8859-6-i iso-ir-127 iso8859-6 iso88596 iso_8859-6 iso_8859-6:1987',
    // ISO-8859-7
    'csisolatingreek ecma-118 elot_928 greek greek8 iso-8859-7 iso-ir-126 iso8859-7 iso88597 iso_8859-7',
    'iso_8859-7:1987 sun_eu_greek',
    // ISO-8859-8
    'csiso88598e csisolatinhebrew hebrew iso-8859-8 iso-8859-8-e iso-ir-138 iso8859-8 iso88598 iso_8859-8',
    'iso_8859-8:1988 visual',
    // ISO-8859-8-I
    'csiso88598i iso-8859-8-i logical',
    // ISO-8859-10
    'csisolatin6 iso-8859-10 iso-ir-157 iso8859-10 iso885910 l6 latin6',
    // ISO-8859-13
    'iso-8859-13 iso8859-13 iso885913',
    // ISO-8859-14
    'iso-8859-14 iso8859-14 iso885914',
    // ISO-8859-15
    'csisolatin9 iso-8859-15 iso8859-15 iso885915 iso_8859-15 l9',
    // ISO-8859-16
    'iso-8859-16',
    // KOI8-R
    'cskoi8r koi koi8 koi8-r koi8_r',
    // KOI8-U
    'koi8-ru koi8-u',
    // macintosh
    'csmacintosh mac macintosh x-mac-roman',
    // windows-874
    'dos-874 iso-8859-11 iso8859-11 iso885911 tis-620 windows-874',
    // windows-1250
    'cp1250 windows-1250 x-cp1250',
    // windows-1251
    'cp1251 windows-1251 x-cp1251',
    // windows-1252
    'ansi_x3.4-1968 ascii cp1252 cp819 csisolatin1 ibm819 iso-8859-1 iso-ir-100 iso8859-1 iso88591',
    'iso_8859-1 iso_8859-1:1987 l1 latin1 us-ascii windows-1252 x-cp1252',
    // windows-1253
    'cp1253 windows-1253 x-cp1253',
    // windows-1254
    'cp1254 csisolatin5 iso-8859-9 iso-ir-148 iso8859-9 iso88599 iso_8859-9 iso_8859-9:1989 l5 latin5',
    'windows-1254 x-cp1254',
    // windows-1255
    'cp1255 windows-1255 x-cp1255',
    // windows-1256
    'cp1256 windows-1256 x-cp1256',
    // windows-1257
    'cp1257 windows-1257 x-cp1257',
    // windows-1258
    'cp1258 windows-1258 x-cp1258',
    // x-mac-cyrillic
    'x-mac-cyrillic x-mac-ukrainian',
    // GBK
    'chinese csgb2312 csiso58gb231280 gb2312 gb_2312 gb_2312-80 gbk iso-ir-58 x-gbk',
    // gb18030
    'gb18030',
    // Big5
    'big5 big5-hkscs cn-big5 csbig5 x-x-big5',
    // EUC-JP
    'cseucpkdfmtjapanese euc-jp x-euc-jp',
    // ISO-2022-JP
    'csiso2022jp iso-2022-jp',
    // Shift_JIS
    'csshiftjis ms932 ms_kanji shift-jis shift_jis sjis windows-31j x-sjis',
    // EUC-KR
    'cseuckr csksc56011987 euc-kr iso-ir-149 korean ks_c_5601-1987 ks_c_5601-1989 ksc5601 ksc_5601',
    'windows-949',
    // replacement
    'csiso2022kr hz-gb-2312 iso-2022-cn iso-2022-cn-ext iso-2022-kr replacement',
    // x-user-defined
    'x-user-defined'
]
    .join(' ')
    .split(' '));
// The labels the Encoding Standard maps to the replacement encoding: ISO-2022-KR,
// ISO-2022-CN and HZ-GB-2312, whose escape and shift sequences let the same bytes read as
// text to one decoder and as markup to another. A browser decodes a document in any of
// them to a single U+FFFD for that reason, and TextDecoder refuses to be constructed for
// them. They used to fall through to the UTF-8 or windows-1252 reading, which is the
// markup reading: a body of `ESC$)C SO <img onerror=…> SI` under charset=iso-2022-kr is
// Hangul to Python and a scanner built on it, and was an image tag here.
const REPLACEMENT_LABELS = new Set([
    'csiso2022kr',
    'hz-gb-2312',
    'iso-2022-cn',
    'iso-2022-cn-ext',
    'iso-2022-kr',
    'replacement'
]);
// The decoder of the replacement encoding: U+FFFD once there is a byte to replace
const replacementDecoder = {
    encoding: 'replacement',
    decode: input => (input && input.byteLength ? '�' : '')
};
// The UTF-16 labels honoured and the label of the standard each stands for: the spellings
// that Python and iconv-lite both decode, and nothing else. Matched as written only, never
// after normalization: `x-utf16` is known to neither.
//
// A label that one of the two reads and the other does not is the split this table
// exists to close: under it a scanner built on the other reads the bytes as single byte
// text, NUL interleaved and inert, where they decoded to markup here. So the standard's
// `unicode`, `csunicode`, `iso-10646-ucs-2`, `unicodefeff` and `unicodefffe`, which
// neither knows, are out, and so are `ucs-2`, `ucs2`, `utf16le` and `utf16be`, which
// iconv-lite alone knows (and `ucs-2` as little endian whatever mark the bytes carry).
// They all fall back like any unknown label.
const UTF16_LABELS = new Map([
    ['utf-16', 'utf-16'],
    ['utf16', 'utf-16'],
    ['utf_16', 'utf-16'],
    ['utf-16le', 'utf-16le'],
    ['utf-16be', 'utf-16be']
]);
/**
 * The label of the Encoding Standard a charset resolves to, as written or through the
 * alias tables, or null when it names no encoding the standard lists
 */
function resolveLabel(charset) {
    charset = (charset || 'utf8').trim().toLowerCase();
    // The label as written first, so the alias table only ever adds to what the standard
    // lists instead of shadowing it
    if (ENCODING_LABELS.has(charset)) {
        return charset;
    }
    const utf16 = UTF16_LABELS.get(charset);
    if (utf16) {
        return utf16;
    }
    const normalized = normalizeCharset(charset);
    const codePage = normalized.match(codePagePattern);
    // The normalized label is itself the last candidate, which resolves everything that
    // differed from a listed label only by a prefix or a separator, eg. x-big5.
    const alias = (codePage && codePageAliases.get(codePage[1])) || charsetAliases.get(normalized) || normalized;
    return ENCODING_LABELS.has(alias) ? alias : null;
}
// Decoders by label, or null where the runtime refuses the label (an encoding a runtime
// was built without). Only labels from the list above are stored, so the map can not grow
// past it however many labels a message makes up.
//
// Sharing a decoder is safe because nothing decodes with `stream: true`, so every
// decode() call starts from a fresh state.
const decoders = new Map();
function tryDecoder(label) {
    if (REPLACEMENT_LABELS.has(label)) {
        return replacementDecoder;
    }
    let decoder = decoders.get(label);
    if (decoder === undefined) {
        decoder = null;
        try {
            decoder = new TextDecoder(label);
        }
        catch {
            // not supported by this runtime
        }
        decoders.set(label, decoder);
    }
    return decoder;
}
// Every runtime has utf-8, so a decoder is always returned even where windows-1252 is
// missing, rather than letting the caller fail on a null decoder
const utf8Decoder = new TextDecoder();
/**
 * Finds the decoder for a charset label, or null when the runtime has no encoding for it
 */
function findDecoder(charset) {
    const label = resolveLabel(charset);
    return label ? tryDecoder(label) : null;
}
function getDecoder(charset) {
    return findDecoder(charset) || tryDecoder('windows-1252') || utf8Decoder;
}
const UTF16_ENCODINGS = new Set(['utf-16le', 'utf-16be']);
// The label of UTF-16 that leaves the byte order to the bytes, which a byte order mark
// then decides, as it does for Python's utf-16 codec and for iconv-lite. The labels that
// name the order, utf-16le and utf-16be, are read as they say whatever mark the bytes
// carry, and no label honours a UTF-8 mark. The Encoding Standard lets any mark override
// any label, but Python and mailparser do not, and following it here rendered as markup
// under charset=utf-16be a body that a scanner built on either reads as CJK text.
const UTF16_UNORDERED_LABELS = new Set(['utf-16']);
/**
 * The byte order a UTF-16 byte order mark at the start of the bytes names, or null without one
 */
function bomByteOrder(bytes) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return 'utf-16be';
    }
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return 'utf-16le';
    }
    return null;
}
/**
 * Whether the bytes are well formed UTF-8. A scan rather than a fatal TextDecoder, since
 * the exception one throws costs more than the decode itself and a message decides how
 * many lines throw it.
 */
function isUtf8(bytes) {
    for (let i = 0; i < bytes.length;) {
        const lead = bytes[i];
        if (lead < 0x80) {
            i++;
            continue;
        }
        // The number of continuation bytes, and the range the first of them may take,
        // which is what rules out overlong forms, surrogates and code points past U+10FFFF
        let count;
        if (lead >= 0xc2 && lead <= 0xdf) {
            count = 1;
        }
        else if (lead >= 0xe0 && lead <= 0xef) {
            count = 2;
        }
        else if (lead >= 0xf0 && lead <= 0xf4) {
            count = 3;
        }
        else {
            return false;
        }
        if (i + count >= bytes.length) {
            return false;
        }
        const second = bytes[i + 1];
        const min = lead === 0xe0 ? 0xa0 : lead === 0xf0 ? 0x90 : 0x80;
        const max = lead === 0xed ? 0x9f : lead === 0xf4 ? 0x8f : 0xbf;
        if (second < min || second > max) {
            return false;
        }
        for (let k = 2; k <= count; k++) {
            if ((bytes[i + k] & 0xc0) !== 0x80) {
                return false;
            }
        }
        i += count + 1;
    }
    return true;
}
/**
 * Decodes bytes whose encoding is not known: as UTF-8 when they are well formed UTF-8, as
 * windows-1252 otherwise.
 *
 * A message that declares no charset, or one the runtime has never heard of, usually
 * predates RFC 6532 or comes from a generator that never heard of it either, and its 8-bit
 * bytes are a legacy single byte encoding far more often than broken UTF-8. windows-1252
 * is the fallback the WHATWG Encoding Standard prescribes and what a mail client's default
 * charset amounts to, and it reads such text rather than filling it with replacement
 * characters.
 *
 * @param bytes Bytes to decode
 * @param utf8 The UTF-8 decoder to use, header lines bring one that keeps a BOM
 * @return Decoded text
 */
function decodeUtf8OrWindows1252(bytes, utf8 = utf8Decoder) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return isUtf8(view) ? utf8.decode(view) : getDecoder('windows-1252').decode(view);
}
/**
 * Decodes bytes in a named charset. A label the runtime does not know is no charset at
 * all, see decodeUtf8OrWindows1252.
 *
 * @param bytes Bytes to decode
 * @param charset Charset label
 * @return Decoded text
 */
function decodeCharset(bytes, charset) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const label = resolveLabel(charset);
    let decoder = label ? tryDecoder(label) : null;
    if (label && UTF16_UNORDERED_LABELS.has(label)) {
        // `utf-16` reads as little endian on its own, so a byte order mark decides the
        // order. Read in the other order the bytes are swapped pairs of the characters
        // every other reader got: FE FF and big endian text under charset=utf-16 was CJK
        // text to Python and a browser, and here it was the little endian reading, which
        // the sender picks to be markup.
        const order = bomByteOrder(view);
        decoder = (order && tryDecoder(order)) || decoder;
    }
    return decoder ? decoder.decode(view) : decodeUtf8OrWindows1252(view);
}
// The charset an html document names for itself, in a `<meta charset>` or in the
// Content-Type `<meta http-equiv>`, read from the first 1024 bytes like a browser's prescan.
// Tags are found with indexOf and the attribute is matched inside one tag at a time: a
// single pattern over the whole head rescans it once for every `<meta` in it, and a head of
// nothing but `<meta ` took it quadratic
const META_PRESCAN_BYTES = 1024;
const CHARSET_ATTRIBUTE = /charset\s*=\s*["']?\s*([^\s"';>]+)/;
function sniffHtmlCharset(bytes) {
    const head = utf8Decoder.decode(bytes.subarray(0, META_PRESCAN_BYTES)).toLowerCase();
    let pos = 0;
    while ((pos = head.indexOf('<meta', pos)) >= 0) {
        let end = head.indexOf('>', pos);
        if (end < 0) {
            end = head.length;
        }
        const match = CHARSET_ATTRIBUTE.exec(head.slice(pos, end));
        if (match) {
            return match[1];
        }
        pos = end;
    }
    return null;
}
/**
 * Decodes the bytes of a text part: in the declared charset, otherwise in the one an html
 * part names for itself, otherwise as UTF-8 or windows-1252 depending on what the bytes
 * turn out to be, see decodeUtf8OrWindows1252.
 *
 * @param bytes Decoded body of the part
 * @param charset The charset parameter of the Content-Type, if any
 * @param html Whether the part is html, which may name its own charset
 * @return The text of the part
 */
function decodeText(bytes, charset, html) {
    const view = new Uint8Array(bytes);
    if (charset) {
        return decodeCharset(view, charset);
    }
    // The HTML prescan has two overrides, and for a reason: a `<meta>` tag that could be
    // read as ASCII proves the document is not UTF-16, so such a label is read as UTF-8,
    // and x-user-defined is read as windows-1252. Without them a sender picks the encoding
    // that turns bytes a scanner sees as inert into markup for this parser alone. A label
    // of the replacement encoding is the replacement text, as it is for a browser, see
    // tryDecoder
    const sniffed = html ? sniffHtmlCharset(view) : null;
    const decoder = sniffed ? findDecoder(sniffed) : null;
    if (!decoder || UTF16_ENCODINGS.has(decoder.encoding)) {
        return decodeUtf8OrWindows1252(view);
    }
    return (decoder.encoding === 'x-user-defined' ? getDecoder('windows-1252') : decoder).decode(view);
}
/**
 * Converts a Blob into an ArrayBuffer
 * @param blob Blob to convert
 * @returns Converted value
 */
async function blobToArrayBuffer(blob) {
    if ('arrayBuffer' in blob) {
        return await blob.arrayBuffer();
    }
    const fr = new FileReader();
    return new Promise((resolve, reject) => {
        fr.onload = () => {
            resolve(fr.result);
        };
        fr.onerror = () => {
            reject(fr.error);
        };
        fr.readAsArrayBuffer(blob);
    });
}
/**
 * Numeric value of an ASCII hex digit
 *
 * @param c Byte to read
 * @return Value 0-15, or -1 if the byte is not a hex digit
 */
function hexNibble(c) {
    if (c >= 0x30 /* 0 */ && c <= 0x39 /* 9 */) {
        return c - 0x30;
    }
    if (c >= 0x61 /* a */ && c <= 0x66 /* f */) {
        return c - 0x61 + 10;
    }
    if (c >= 0x41 /* A */ && c <= 0x46 /* F */) {
        return c - 0x41 + 10;
    }
    return -1;
}
/**
 * Folds the line breaks of a header value into spaces.
 *
 * A header value holds no line breaks. The raw value is folded when the headers are
 * processed, see processHeaders in mime-node.ts, an RFC 2047 encoded word is folded as it
 * is decoded, and an RFC 2231 filename is folded where the attachment is built. Otherwise a
 * decoded name, subject or filename written into a header of an outgoing message by the
 * consumer ends the header early and starts another one with the rest of the value.
 *
 * The RFC 2231 percent decoder itself does not fold: it also produces the boundary, and a
 * boundary holding a line break can never match a line. That has to stay so, or a message
 * that has no parts for every other parser would have them here.
 *
 * @param str Header value
 * @return The value with every run of CR and LF replaced by a space
 */
function foldLineBreaks(str) {
    return str.replace(/[\r\n]+/g, ' ');
}
/**
 * Decode a complete mime word encoded string
 *
 * @param charset Character set of the encoded word
 * @param encoding `Q` or `B`
 * @param str Mime word encoded string
 * @return Decoded unicode string
 */
function decodeWord(charset, encoding, str) {
    // RFC2231 added language tag to the encoding
    // see: https://tools.ietf.org/html/rfc2231#section-5
    // this implementation silently ignores this tag
    let splitPos = charset.indexOf('*');
    if (splitPos >= 0) {
        charset = charset.slice(0, splitPos);
    }
    encoding = encoding.toUpperCase();
    let byteStr;
    if (encoding === 'Q') {
        str = str
            // remove spaces between = and hex char, this might indicate invalidly applied line splitting
            .replace(/=\s+([0-9a-fA-F])/g, '=$1')
            // convert all underscores to spaces
            .replace(/[_\s]/g, ' ');
        let buf = textEncoder.encode(str);
        let encodedBytes = [];
        for (let i = 0, len = buf.length; i < len; i++) {
            let c = buf[i];
            if (i <= len - 2 && c === 0x3d /* = */) {
                let high = hexNibble(buf[i + 1]);
                let low = hexNibble(buf[i + 2]);
                if (high >= 0 && low >= 0) {
                    encodedBytes.push((high << 4) | low);
                    i += 2;
                    continue;
                }
            }
            encodedBytes.push(c);
        }
        byteStr = new ArrayBuffer(encodedBytes.length);
        let dataView = new DataView(byteStr);
        for (let i = 0, len = encodedBytes.length; i < len; i++) {
            dataView.setUint8(i, encodedBytes[i]);
        }
    }
    else if (encoding === 'B') {
        byteStr = decodeBase64(str.replace(/[^a-zA-Z0-9\+\/=]+/g, ''));
    }
    else {
        // keep as is, convert ArrayBuffer to unicode string, assume utf8
        byteStr = textEncoder.encode(str);
    }
    return foldLineBreaks(decodeCharset(byteStr, charset));
}
// A charset label runs to the next '?' so that labels containing punctuation, eg.
// ISO_8859-1:1987, are recognised. Whitespace is excluded so a stray '=?' in running text
// can not swallow the rest of the line.
const ENCODED_WORD_PATTERN = '=\\?([^?\\s]+)\\?([QqBb])\\?([^?]*)\\?=';
const ENCODED_WORD_REGEX = new RegExp(ENCODED_WORD_PATTERN, 'g');
// Only linear whitespace separates encoded words, the rest is content
const WORD_SEPARATOR_REGEX = /^[ \t\r\n]+$/;
const ENCODED_WORDS_ONLY_REGEX = new RegExp(`^(?:${ENCODED_WORD_PATTERN}\\s*)+$`);
/**
 * Checks whether a string is nothing but RFC 2047 encoded words. Kept next to the grammar
 * it depends on, so the pattern has a single definition.
 *
 * @param str String to check
 * @return true if the string holds encoded words and nothing else
 */
function isEncodedWordsOnly(str) {
    return ENCODED_WORDS_ONLY_REGEX.test(str);
}
/**
 * Splits a string into encoded words and the literal text around them.
 *
 * Working on a token list rather than marking joinable words with an in band sentinel
 * means the input can not contain the marker, which previously let a sender delete text
 * from a subject or a display name by writing the marker into the header themselves.
 *
 * @param str String to split
 * @return Array of `{text}` and `{charset, encoding, encodedText}` tokens
 */
function splitEncodedWords(str) {
    const tokens = [];
    ENCODED_WORD_REGEX.lastIndex = 0;
    let pos = 0;
    let match;
    while ((match = ENCODED_WORD_REGEX.exec(str))) {
        if (match.index > pos) {
            tokens.push({ text: str.substring(pos, match.index) });
        }
        tokens.push({ charset: match[1], encoding: match[2], encodedText: match[3] });
        pos = match.index + match[0].length;
    }
    if (pos < str.length) {
        tokens.push({ text: str.substring(pos) });
    }
    return tokens;
}
/**
 * Checks if two adjacent encoded words may be decoded as a single unit. A multi byte
 * character is often split across two words, so the bytes have to be concatenated before
 * they are decoded. Base64 additionally needs the left chunk to end on a group boundary,
 * otherwise the concatenation shifts every byte that follows.
 */
function canJoinWords(left, right) {
    const encoding = left.encoding.toUpperCase();
    if (left.charset !== right.charset || encoding !== right.encoding.toUpperCase()) {
        return false;
    }
    if (encoding === 'B') {
        // The length of a string built by concatenation is stored with it, but a regex or
        // endsWith on it flattens everything joined so far first. Testing the growing text
        // for a pad on every word made a subject of a hundred thousand short words cost
        // seconds, so the pad is tracked as the words are appended instead.
        return left.encodedText.length % 4 === 0 && !left.padded;
    }
    return true;
}
/**
 * Decodes a token list into a string, optionally merging adjacent encoded words.
 *
 * @param tokens Tokens from splitEncodedWords
 * @param joinWords Whether adjacent encoded words may be decoded as one unit
 * @return Decoded string
 */
function renderTokens(tokens, joinWords) {
    let result = '';
    let pending = null;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.text !== undefined) {
            // whitespace between two encoded words is a folding artifact, not content
            const nextToken = tokens[i + 1];
            if (pending && nextToken && nextToken.text === undefined && WORD_SEPARATOR_REGEX.test(token.text)) {
                continue;
            }
            if (pending) {
                result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
                pending = null;
            }
            result += token.text;
            continue;
        }
        if (pending && joinWords && canJoinWords(pending, token)) {
            pending.encodedText += token.encodedText;
            pending.padded = token.encodedText.endsWith('=');
            continue;
        }
        if (pending) {
            result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
        }
        pending = {
            charset: token.charset,
            encoding: token.encoding,
            encodedText: token.encodedText,
            padded: token.encodedText.endsWith('=')
        };
    }
    if (pending) {
        result += decodeWord(pending.charset, pending.encoding, pending.encodedText);
    }
    return result;
}
/**
 * Decodes RFC 2047 encoded words in a string
 *
 * @param str String that may contain encoded words
 * @return Unicode string with every encoded word decoded
 */
function decodeWords(str) {
    const tokens = splitEncodedWords((str || '').toString());
    const result = renderTokens(tokens, true);
    // A replacement character means the bytes did not decode, which happens when two
    // words were joined that should have stayed apart. Retry keeping them separate.
    return result.indexOf('\ufffd') < 0 ? result : renderTokens(tokens, false);
}
function decodeURIComponentWithCharset(encodedStr, charset) {
    charset = charset || 'utf-8';
    let encodedBytes = [];
    for (let i = 0; i < encodedStr.length; i++) {
        let c = encodedStr.charAt(i);
        // -1 past the end of the string as well, since charCodeAt returns NaN there
        const high = c === '%' ? hexNibble(encodedStr.charCodeAt(i + 1)) : -1;
        const low = high >= 0 ? hexNibble(encodedStr.charCodeAt(i + 2)) : -1;
        if (low >= 0) {
            // encoded sequence
            encodedBytes.push((high << 4) | low);
            i += 2;
        }
        else if (c.charCodeAt(0) > 126) {
            const bytes = textEncoder.encode(c);
            for (let j = 0; j < bytes.length; j++) {
                encodedBytes.push(bytes[j]);
            }
        }
        else {
            // "normal" char
            encodedBytes.push(c.charCodeAt(0));
        }
    }
    const byteStr = new ArrayBuffer(encodedBytes.length);
    const dataView = new DataView(byteStr);
    for (let i = 0, len = encodedBytes.length; i < len; i++) {
        dataView.setUint8(i, encodedBytes[i]);
    }
    return decodeCharset(byteStr, charset);
}
function decodeParameterValueContinuations(header) {
    // handle parameter value continuations
    // https://tools.ietf.org/html/rfc2231#section-3
    // preprocess values
    let paramKeys = new Map();
    Object.keys(header.params).forEach(key => {
        let match = key.match(/\*((\d+)\*?)?$/);
        if (!match) {
            // nothing to do here, does not seem like a continuation param
            return;
        }
        let actualKey = key.slice(0, match.index).toLowerCase();
        let nr = Number(match[2]) || 0;
        let paramVal = paramKeys.get(actualKey);
        if (!paramVal) {
            paramVal = {
                charset: null,
                values: []
            };
            paramKeys.set(actualKey, paramVal);
        }
        let value = header.params[key];
        // RFC 2231 section 4.1: only a section whose name ends in '*' is percent encoded.
        // A plain `name*0=` section is literal text, so decoding it invents characters
        // that never appeared on the wire, turning `a%2F..%2Fetc` into a path traversal.
        let encoded = match[0].charAt(match[0].length - 1) === '*';
        if (nr === 0 && encoded && (match = value.match(/^([^']*)'[^']*'(.*)$/))) {
            paramVal.charset = match[1] || 'utf-8';
            value = match[2];
        }
        paramVal.values.push({ nr, value, encoded });
        // remove the old reference
        delete header.params[key];
    });
    paramKeys.forEach((paramVal, key) => {
        if (Object.prototype.hasOwnProperty.call(header.params, key)) {
            // The same name was also given as a plain parameter, which the starred keys were
            // just deleted from around, so this write would be the only one here to override a
            // name already taken. `filename="plain"; filename*0="cont"` resolves to the plain
            // parameter either way round, so the reading does not come down to which of the
            // two spellings the sender put first. See storeParam in mime-node.ts
            return;
        }
        let result = '';
        // Adjacent encoded sections are decoded together, because a single multi byte
        // character may be percent encoded across a section boundary.
        let pending = '';
        for (let part of paramVal.values.sort((a, b) => a.nr - b.nr)) {
            if (part.encoded) {
                pending += part.value;
                continue;
            }
            if (pending) {
                result += decodeURIComponentWithCharset(pending, paramVal.charset);
                pending = '';
            }
            result += part.value;
        }
        if (pending) {
            result += decodeURIComponentWithCharset(pending, paramVal.charset);
        }
        header.params[key] = result;
    });
}

// --- base64-encoder.js ----------------------------------------------
// Code from: https://gist.githubusercontent.com/jonleighton/958841/raw/fb05a8632efb75d85d43deb593df04367ce48371/base64ArrayBuffer.js
// Converts an ArrayBuffer directly to base64, without any intermediate 'convert to string then
// use window.btoa' step. According to my tests, this appears to be a faster approach:
// http://jsperf.com/encoding-xhr-image-data/5
/*
MIT LICENSE

Copyright 2011 Jon Leighton

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
function base64ArrayBuffer(arrayBuffer) {
    let base64 = '';
    const encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = new Uint8Array(arrayBuffer);
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;
    let a, b, c, d;
    let chunk;
    // Main loop deals with bytes in chunks of 3
    for (let i = 0; i < mainLength; i = i + 3) {
        // Combine the three bytes into a single integer
        chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        // Use bitmasks to extract 6-bit segments from the triplet
        a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
        b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
        c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
        d = chunk & 63; // 63       = 2^6 - 1
        // Convert the raw binary segments to the appropriate ASCII encoding
        base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }
    // Deal with the remaining bytes and padding
    if (byteRemainder === 1) {
        chunk = bytes[mainLength];
        a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2
        // Set the 4 least significant bits to zero
        b = (chunk & 3) << 4; // 3   = 2^2 - 1
        base64 += encodings[a] + encodings[b] + '==';
    }
    else if (byteRemainder === 2) {
        chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
        a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
        b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4
        // Set the 2 least significant bits to zero
        c = (chunk & 15) << 2; // 15    = 2^4 - 1
        base64 += encodings[a] + encodings[b] + encodings[c] + '=';
    }
    return base64;
}

// --- html-entities.js -----------------------------------------------
// Entity map from https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references
const htmlEntities = {
    '&AElig': '\u00C6',
    '&AElig;': '\u00C6',
    '&AMP': '\u0026',
    '&AMP;': '\u0026',
    '&Aacute': '\u00C1',
    '&Aacute;': '\u00C1',
    '&Abreve;': '\u0102',
    '&Acirc': '\u00C2',
    '&Acirc;': '\u00C2',
    '&Acy;': '\u0410',
    '&Afr;': '\uD835\uDD04',
    '&Agrave': '\u00C0',
    '&Agrave;': '\u00C0',
    '&Alpha;': '\u0391',
    '&Amacr;': '\u0100',
    '&And;': '\u2A53',
    '&Aogon;': '\u0104',
    '&Aopf;': '\uD835\uDD38',
    '&ApplyFunction;': '\u2061',
    '&Aring': '\u00C5',
    '&Aring;': '\u00C5',
    '&Ascr;': '\uD835\uDC9C',
    '&Assign;': '\u2254',
    '&Atilde': '\u00C3',
    '&Atilde;': '\u00C3',
    '&Auml': '\u00C4',
    '&Auml;': '\u00C4',
    '&Backslash;': '\u2216',
    '&Barv;': '\u2AE7',
    '&Barwed;': '\u2306',
    '&Bcy;': '\u0411',
    '&Because;': '\u2235',
    '&Bernoullis;': '\u212C',
    '&Beta;': '\u0392',
    '&Bfr;': '\uD835\uDD05',
    '&Bopf;': '\uD835\uDD39',
    '&Breve;': '\u02D8',
    '&Bscr;': '\u212C',
    '&Bumpeq;': '\u224E',
    '&CHcy;': '\u0427',
    '&COPY': '\u00A9',
    '&COPY;': '\u00A9',
    '&Cacute;': '\u0106',
    '&Cap;': '\u22D2',
    '&CapitalDifferentialD;': '\u2145',
    '&Cayleys;': '\u212D',
    '&Ccaron;': '\u010C',
    '&Ccedil': '\u00C7',
    '&Ccedil;': '\u00C7',
    '&Ccirc;': '\u0108',
    '&Cconint;': '\u2230',
    '&Cdot;': '\u010A',
    '&Cedilla;': '\u00B8',
    '&CenterDot;': '\u00B7',
    '&Cfr;': '\u212D',
    '&Chi;': '\u03A7',
    '&CircleDot;': '\u2299',
    '&CircleMinus;': '\u2296',
    '&CirclePlus;': '\u2295',
    '&CircleTimes;': '\u2297',
    '&ClockwiseContourIntegral;': '\u2232',
    '&CloseCurlyDoubleQuote;': '\u201D',
    '&CloseCurlyQuote;': '\u2019',
    '&Colon;': '\u2237',
    '&Colone;': '\u2A74',
    '&Congruent;': '\u2261',
    '&Conint;': '\u222F',
    '&ContourIntegral;': '\u222E',
    '&Copf;': '\u2102',
    '&Coproduct;': '\u2210',
    '&CounterClockwiseContourIntegral;': '\u2233',
    '&Cross;': '\u2A2F',
    '&Cscr;': '\uD835\uDC9E',
    '&Cup;': '\u22D3',
    '&CupCap;': '\u224D',
    '&DD;': '\u2145',
    '&DDotrahd;': '\u2911',
    '&DJcy;': '\u0402',
    '&DScy;': '\u0405',
    '&DZcy;': '\u040F',
    '&Dagger;': '\u2021',
    '&Darr;': '\u21A1',
    '&Dashv;': '\u2AE4',
    '&Dcaron;': '\u010E',
    '&Dcy;': '\u0414',
    '&Del;': '\u2207',
    '&Delta;': '\u0394',
    '&Dfr;': '\uD835\uDD07',
    '&DiacriticalAcute;': '\u00B4',
    '&DiacriticalDot;': '\u02D9',
    '&DiacriticalDoubleAcute;': '\u02DD',
    '&DiacriticalGrave;': '\u0060',
    '&DiacriticalTilde;': '\u02DC',
    '&Diamond;': '\u22C4',
    '&DifferentialD;': '\u2146',
    '&Dopf;': '\uD835\uDD3B',
    '&Dot;': '\u00A8',
    '&DotDot;': '\u20DC',
    '&DotEqual;': '\u2250',
    '&DoubleContourIntegral;': '\u222F',
    '&DoubleDot;': '\u00A8',
    '&DoubleDownArrow;': '\u21D3',
    '&DoubleLeftArrow;': '\u21D0',
    '&DoubleLeftRightArrow;': '\u21D4',
    '&DoubleLeftTee;': '\u2AE4',
    '&DoubleLongLeftArrow;': '\u27F8',
    '&DoubleLongLeftRightArrow;': '\u27FA',
    '&DoubleLongRightArrow;': '\u27F9',
    '&DoubleRightArrow;': '\u21D2',
    '&DoubleRightTee;': '\u22A8',
    '&DoubleUpArrow;': '\u21D1',
    '&DoubleUpDownArrow;': '\u21D5',
    '&DoubleVerticalBar;': '\u2225',
    '&DownArrow;': '\u2193',
    '&DownArrowBar;': '\u2913',
    '&DownArrowUpArrow;': '\u21F5',
    '&DownBreve;': '\u0311',
    '&DownLeftRightVector;': '\u2950',
    '&DownLeftTeeVector;': '\u295E',
    '&DownLeftVector;': '\u21BD',
    '&DownLeftVectorBar;': '\u2956',
    '&DownRightTeeVector;': '\u295F',
    '&DownRightVector;': '\u21C1',
    '&DownRightVectorBar;': '\u2957',
    '&DownTee;': '\u22A4',
    '&DownTeeArrow;': '\u21A7',
    '&Downarrow;': '\u21D3',
    '&Dscr;': '\uD835\uDC9F',
    '&Dstrok;': '\u0110',
    '&ENG;': '\u014A',
    '&ETH': '\u00D0',
    '&ETH;': '\u00D0',
    '&Eacute': '\u00C9',
    '&Eacute;': '\u00C9',
    '&Ecaron;': '\u011A',
    '&Ecirc': '\u00CA',
    '&Ecirc;': '\u00CA',
    '&Ecy;': '\u042D',
    '&Edot;': '\u0116',
    '&Efr;': '\uD835\uDD08',
    '&Egrave': '\u00C8',
    '&Egrave;': '\u00C8',
    '&Element;': '\u2208',
    '&Emacr;': '\u0112',
    '&EmptySmallSquare;': '\u25FB',
    '&EmptyVerySmallSquare;': '\u25AB',
    '&Eogon;': '\u0118',
    '&Eopf;': '\uD835\uDD3C',
    '&Epsilon;': '\u0395',
    '&Equal;': '\u2A75',
    '&EqualTilde;': '\u2242',
    '&Equilibrium;': '\u21CC',
    '&Escr;': '\u2130',
    '&Esim;': '\u2A73',
    '&Eta;': '\u0397',
    '&Euml': '\u00CB',
    '&Euml;': '\u00CB',
    '&Exists;': '\u2203',
    '&ExponentialE;': '\u2147',
    '&Fcy;': '\u0424',
    '&Ffr;': '\uD835\uDD09',
    '&FilledSmallSquare;': '\u25FC',
    '&FilledVerySmallSquare;': '\u25AA',
    '&Fopf;': '\uD835\uDD3D',
    '&ForAll;': '\u2200',
    '&Fouriertrf;': '\u2131',
    '&Fscr;': '\u2131',
    '&GJcy;': '\u0403',
    '&GT': '\u003E',
    '&GT;': '\u003E',
    '&Gamma;': '\u0393',
    '&Gammad;': '\u03DC',
    '&Gbreve;': '\u011E',
    '&Gcedil;': '\u0122',
    '&Gcirc;': '\u011C',
    '&Gcy;': '\u0413',
    '&Gdot;': '\u0120',
    '&Gfr;': '\uD835\uDD0A',
    '&Gg;': '\u22D9',
    '&Gopf;': '\uD835\uDD3E',
    '&GreaterEqual;': '\u2265',
    '&GreaterEqualLess;': '\u22DB',
    '&GreaterFullEqual;': '\u2267',
    '&GreaterGreater;': '\u2AA2',
    '&GreaterLess;': '\u2277',
    '&GreaterSlantEqual;': '\u2A7E',
    '&GreaterTilde;': '\u2273',
    '&Gscr;': '\uD835\uDCA2',
    '&Gt;': '\u226B',
    '&HARDcy;': '\u042A',
    '&Hacek;': '\u02C7',
    '&Hat;': '\u005E',
    '&Hcirc;': '\u0124',
    '&Hfr;': '\u210C',
    '&HilbertSpace;': '\u210B',
    '&Hopf;': '\u210D',
    '&HorizontalLine;': '\u2500',
    '&Hscr;': '\u210B',
    '&Hstrok;': '\u0126',
    '&HumpDownHump;': '\u224E',
    '&HumpEqual;': '\u224F',
    '&IEcy;': '\u0415',
    '&IJlig;': '\u0132',
    '&IOcy;': '\u0401',
    '&Iacute': '\u00CD',
    '&Iacute;': '\u00CD',
    '&Icirc': '\u00CE',
    '&Icirc;': '\u00CE',
    '&Icy;': '\u0418',
    '&Idot;': '\u0130',
    '&Ifr;': '\u2111',
    '&Igrave': '\u00CC',
    '&Igrave;': '\u00CC',
    '&Im;': '\u2111',
    '&Imacr;': '\u012A',
    '&ImaginaryI;': '\u2148',
    '&Implies;': '\u21D2',
    '&Int;': '\u222C',
    '&Integral;': '\u222B',
    '&Intersection;': '\u22C2',
    '&InvisibleComma;': '\u2063',
    '&InvisibleTimes;': '\u2062',
    '&Iogon;': '\u012E',
    '&Iopf;': '\uD835\uDD40',
    '&Iota;': '\u0399',
    '&Iscr;': '\u2110',
    '&Itilde;': '\u0128',
    '&Iukcy;': '\u0406',
    '&Iuml': '\u00CF',
    '&Iuml;': '\u00CF',
    '&Jcirc;': '\u0134',
    '&Jcy;': '\u0419',
    '&Jfr;': '\uD835\uDD0D',
    '&Jopf;': '\uD835\uDD41',
    '&Jscr;': '\uD835\uDCA5',
    '&Jsercy;': '\u0408',
    '&Jukcy;': '\u0404',
    '&KHcy;': '\u0425',
    '&KJcy;': '\u040C',
    '&Kappa;': '\u039A',
    '&Kcedil;': '\u0136',
    '&Kcy;': '\u041A',
    '&Kfr;': '\uD835\uDD0E',
    '&Kopf;': '\uD835\uDD42',
    '&Kscr;': '\uD835\uDCA6',
    '&LJcy;': '\u0409',
    '&LT': '\u003C',
    '&LT;': '\u003C',
    '&Lacute;': '\u0139',
    '&Lambda;': '\u039B',
    '&Lang;': '\u27EA',
    '&Laplacetrf;': '\u2112',
    '&Larr;': '\u219E',
    '&Lcaron;': '\u013D',
    '&Lcedil;': '\u013B',
    '&Lcy;': '\u041B',
    '&LeftAngleBracket;': '\u27E8',
    '&LeftArrow;': '\u2190',
    '&LeftArrowBar;': '\u21E4',
    '&LeftArrowRightArrow;': '\u21C6',
    '&LeftCeiling;': '\u2308',
    '&LeftDoubleBracket;': '\u27E6',
    '&LeftDownTeeVector;': '\u2961',
    '&LeftDownVector;': '\u21C3',
    '&LeftDownVectorBar;': '\u2959',
    '&LeftFloor;': '\u230A',
    '&LeftRightArrow;': '\u2194',
    '&LeftRightVector;': '\u294E',
    '&LeftTee;': '\u22A3',
    '&LeftTeeArrow;': '\u21A4',
    '&LeftTeeVector;': '\u295A',
    '&LeftTriangle;': '\u22B2',
    '&LeftTriangleBar;': '\u29CF',
    '&LeftTriangleEqual;': '\u22B4',
    '&LeftUpDownVector;': '\u2951',
    '&LeftUpTeeVector;': '\u2960',
    '&LeftUpVector;': '\u21BF',
    '&LeftUpVectorBar;': '\u2958',
    '&LeftVector;': '\u21BC',
    '&LeftVectorBar;': '\u2952',
    '&Leftarrow;': '\u21D0',
    '&Leftrightarrow;': '\u21D4',
    '&LessEqualGreater;': '\u22DA',
    '&LessFullEqual;': '\u2266',
    '&LessGreater;': '\u2276',
    '&LessLess;': '\u2AA1',
    '&LessSlantEqual;': '\u2A7D',
    '&LessTilde;': '\u2272',
    '&Lfr;': '\uD835\uDD0F',
    '&Ll;': '\u22D8',
    '&Lleftarrow;': '\u21DA',
    '&Lmidot;': '\u013F',
    '&LongLeftArrow;': '\u27F5',
    '&LongLeftRightArrow;': '\u27F7',
    '&LongRightArrow;': '\u27F6',
    '&Longleftarrow;': '\u27F8',
    '&Longleftrightarrow;': '\u27FA',
    '&Longrightarrow;': '\u27F9',
    '&Lopf;': '\uD835\uDD43',
    '&LowerLeftArrow;': '\u2199',
    '&LowerRightArrow;': '\u2198',
    '&Lscr;': '\u2112',
    '&Lsh;': '\u21B0',
    '&Lstrok;': '\u0141',
    '&Lt;': '\u226A',
    '&Map;': '\u2905',
    '&Mcy;': '\u041C',
    '&MediumSpace;': '\u205F',
    '&Mellintrf;': '\u2133',
    '&Mfr;': '\uD835\uDD10',
    '&MinusPlus;': '\u2213',
    '&Mopf;': '\uD835\uDD44',
    '&Mscr;': '\u2133',
    '&Mu;': '\u039C',
    '&NJcy;': '\u040A',
    '&Nacute;': '\u0143',
    '&Ncaron;': '\u0147',
    '&Ncedil;': '\u0145',
    '&Ncy;': '\u041D',
    '&NegativeMediumSpace;': '\u200B',
    '&NegativeThickSpace;': '\u200B',
    '&NegativeThinSpace;': '\u200B',
    '&NegativeVeryThinSpace;': '\u200B',
    '&NestedGreaterGreater;': '\u226B',
    '&NestedLessLess;': '\u226A',
    '&NewLine;': '\u000A',
    '&Nfr;': '\uD835\uDD11',
    '&NoBreak;': '\u2060',
    '&NonBreakingSpace;': '\u00A0',
    '&Nopf;': '\u2115',
    '&Not;': '\u2AEC',
    '&NotCongruent;': '\u2262',
    '&NotCupCap;': '\u226D',
    '&NotDoubleVerticalBar;': '\u2226',
    '&NotElement;': '\u2209',
    '&NotEqual;': '\u2260',
    '&NotEqualTilde;': '\u2242\u0338',
    '&NotExists;': '\u2204',
    '&NotGreater;': '\u226F',
    '&NotGreaterEqual;': '\u2271',
    '&NotGreaterFullEqual;': '\u2267\u0338',
    '&NotGreaterGreater;': '\u226B\u0338',
    '&NotGreaterLess;': '\u2279',
    '&NotGreaterSlantEqual;': '\u2A7E\u0338',
    '&NotGreaterTilde;': '\u2275',
    '&NotHumpDownHump;': '\u224E\u0338',
    '&NotHumpEqual;': '\u224F\u0338',
    '&NotLeftTriangle;': '\u22EA',
    '&NotLeftTriangleBar;': '\u29CF\u0338',
    '&NotLeftTriangleEqual;': '\u22EC',
    '&NotLess;': '\u226E',
    '&NotLessEqual;': '\u2270',
    '&NotLessGreater;': '\u2278',
    '&NotLessLess;': '\u226A\u0338',
    '&NotLessSlantEqual;': '\u2A7D\u0338',
    '&NotLessTilde;': '\u2274',
    '&NotNestedGreaterGreater;': '\u2AA2\u0338',
    '&NotNestedLessLess;': '\u2AA1\u0338',
    '&NotPrecedes;': '\u2280',
    '&NotPrecedesEqual;': '\u2AAF\u0338',
    '&NotPrecedesSlantEqual;': '\u22E0',
    '&NotReverseElement;': '\u220C',
    '&NotRightTriangle;': '\u22EB',
    '&NotRightTriangleBar;': '\u29D0\u0338',
    '&NotRightTriangleEqual;': '\u22ED',
    '&NotSquareSubset;': '\u228F\u0338',
    '&NotSquareSubsetEqual;': '\u22E2',
    '&NotSquareSuperset;': '\u2290\u0338',
    '&NotSquareSupersetEqual;': '\u22E3',
    '&NotSubset;': '\u2282\u20D2',
    '&NotSubsetEqual;': '\u2288',
    '&NotSucceeds;': '\u2281',
    '&NotSucceedsEqual;': '\u2AB0\u0338',
    '&NotSucceedsSlantEqual;': '\u22E1',
    '&NotSucceedsTilde;': '\u227F\u0338',
    '&NotSuperset;': '\u2283\u20D2',
    '&NotSupersetEqual;': '\u2289',
    '&NotTilde;': '\u2241',
    '&NotTildeEqual;': '\u2244',
    '&NotTildeFullEqual;': '\u2247',
    '&NotTildeTilde;': '\u2249',
    '&NotVerticalBar;': '\u2224',
    '&Nscr;': '\uD835\uDCA9',
    '&Ntilde': '\u00D1',
    '&Ntilde;': '\u00D1',
    '&Nu;': '\u039D',
    '&OElig;': '\u0152',
    '&Oacute': '\u00D3',
    '&Oacute;': '\u00D3',
    '&Ocirc': '\u00D4',
    '&Ocirc;': '\u00D4',
    '&Ocy;': '\u041E',
    '&Odblac;': '\u0150',
    '&Ofr;': '\uD835\uDD12',
    '&Ograve': '\u00D2',
    '&Ograve;': '\u00D2',
    '&Omacr;': '\u014C',
    '&Omega;': '\u03A9',
    '&Omicron;': '\u039F',
    '&Oopf;': '\uD835\uDD46',
    '&OpenCurlyDoubleQuote;': '\u201C',
    '&OpenCurlyQuote;': '\u2018',
    '&Or;': '\u2A54',
    '&Oscr;': '\uD835\uDCAA',
    '&Oslash': '\u00D8',
    '&Oslash;': '\u00D8',
    '&Otilde': '\u00D5',
    '&Otilde;': '\u00D5',
    '&Otimes;': '\u2A37',
    '&Ouml': '\u00D6',
    '&Ouml;': '\u00D6',
    '&OverBar;': '\u203E',
    '&OverBrace;': '\u23DE',
    '&OverBracket;': '\u23B4',
    '&OverParenthesis;': '\u23DC',
    '&PartialD;': '\u2202',
    '&Pcy;': '\u041F',
    '&Pfr;': '\uD835\uDD13',
    '&Phi;': '\u03A6',
    '&Pi;': '\u03A0',
    '&PlusMinus;': '\u00B1',
    '&Poincareplane;': '\u210C',
    '&Popf;': '\u2119',
    '&Pr;': '\u2ABB',
    '&Precedes;': '\u227A',
    '&PrecedesEqual;': '\u2AAF',
    '&PrecedesSlantEqual;': '\u227C',
    '&PrecedesTilde;': '\u227E',
    '&Prime;': '\u2033',
    '&Product;': '\u220F',
    '&Proportion;': '\u2237',
    '&Proportional;': '\u221D',
    '&Pscr;': '\uD835\uDCAB',
    '&Psi;': '\u03A8',
    '&QUOT': '\u0022',
    '&QUOT;': '\u0022',
    '&Qfr;': '\uD835\uDD14',
    '&Qopf;': '\u211A',
    '&Qscr;': '\uD835\uDCAC',
    '&RBarr;': '\u2910',
    '&REG': '\u00AE',
    '&REG;': '\u00AE',
    '&Racute;': '\u0154',
    '&Rang;': '\u27EB',
    '&Rarr;': '\u21A0',
    '&Rarrtl;': '\u2916',
    '&Rcaron;': '\u0158',
    '&Rcedil;': '\u0156',
    '&Rcy;': '\u0420',
    '&Re;': '\u211C',
    '&ReverseElement;': '\u220B',
    '&ReverseEquilibrium;': '\u21CB',
    '&ReverseUpEquilibrium;': '\u296F',
    '&Rfr;': '\u211C',
    '&Rho;': '\u03A1',
    '&RightAngleBracket;': '\u27E9',
    '&RightArrow;': '\u2192',
    '&RightArrowBar;': '\u21E5',
    '&RightArrowLeftArrow;': '\u21C4',
    '&RightCeiling;': '\u2309',
    '&RightDoubleBracket;': '\u27E7',
    '&RightDownTeeVector;': '\u295D',
    '&RightDownVector;': '\u21C2',
    '&RightDownVectorBar;': '\u2955',
    '&RightFloor;': '\u230B',
    '&RightTee;': '\u22A2',
    '&RightTeeArrow;': '\u21A6',
    '&RightTeeVector;': '\u295B',
    '&RightTriangle;': '\u22B3',
    '&RightTriangleBar;': '\u29D0',
    '&RightTriangleEqual;': '\u22B5',
    '&RightUpDownVector;': '\u294F',
    '&RightUpTeeVector;': '\u295C',
    '&RightUpVector;': '\u21BE',
    '&RightUpVectorBar;': '\u2954',
    '&RightVector;': '\u21C0',
    '&RightVectorBar;': '\u2953',
    '&Rightarrow;': '\u21D2',
    '&Ropf;': '\u211D',
    '&RoundImplies;': '\u2970',
    '&Rrightarrow;': '\u21DB',
    '&Rscr;': '\u211B',
    '&Rsh;': '\u21B1',
    '&RuleDelayed;': '\u29F4',
    '&SHCHcy;': '\u0429',
    '&SHcy;': '\u0428',
    '&SOFTcy;': '\u042C',
    '&Sacute;': '\u015A',
    '&Sc;': '\u2ABC',
    '&Scaron;': '\u0160',
    '&Scedil;': '\u015E',
    '&Scirc;': '\u015C',
    '&Scy;': '\u0421',
    '&Sfr;': '\uD835\uDD16',
    '&ShortDownArrow;': '\u2193',
    '&ShortLeftArrow;': '\u2190',
    '&ShortRightArrow;': '\u2192',
    '&ShortUpArrow;': '\u2191',
    '&Sigma;': '\u03A3',
    '&SmallCircle;': '\u2218',
    '&Sopf;': '\uD835\uDD4A',
    '&Sqrt;': '\u221A',
    '&Square;': '\u25A1',
    '&SquareIntersection;': '\u2293',
    '&SquareSubset;': '\u228F',
    '&SquareSubsetEqual;': '\u2291',
    '&SquareSuperset;': '\u2290',
    '&SquareSupersetEqual;': '\u2292',
    '&SquareUnion;': '\u2294',
    '&Sscr;': '\uD835\uDCAE',
    '&Star;': '\u22C6',
    '&Sub;': '\u22D0',
    '&Subset;': '\u22D0',
    '&SubsetEqual;': '\u2286',
    '&Succeeds;': '\u227B',
    '&SucceedsEqual;': '\u2AB0',
    '&SucceedsSlantEqual;': '\u227D',
    '&SucceedsTilde;': '\u227F',
    '&SuchThat;': '\u220B',
    '&Sum;': '\u2211',
    '&Sup;': '\u22D1',
    '&Superset;': '\u2283',
    '&SupersetEqual;': '\u2287',
    '&Supset;': '\u22D1',
    '&THORN': '\u00DE',
    '&THORN;': '\u00DE',
    '&TRADE;': '\u2122',
    '&TSHcy;': '\u040B',
    '&TScy;': '\u0426',
    '&Tab;': '\u0009',
    '&Tau;': '\u03A4',
    '&Tcaron;': '\u0164',
    '&Tcedil;': '\u0162',
    '&Tcy;': '\u0422',
    '&Tfr;': '\uD835\uDD17',
    '&Therefore;': '\u2234',
    '&Theta;': '\u0398',
    '&ThickSpace;': '\u205F\u200A',
    '&ThinSpace;': '\u2009',
    '&Tilde;': '\u223C',
    '&TildeEqual;': '\u2243',
    '&TildeFullEqual;': '\u2245',
    '&TildeTilde;': '\u2248',
    '&Topf;': '\uD835\uDD4B',
    '&TripleDot;': '\u20DB',
    '&Tscr;': '\uD835\uDCAF',
    '&Tstrok;': '\u0166',
    '&Uacute': '\u00DA',
    '&Uacute;': '\u00DA',
    '&Uarr;': '\u219F',
    '&Uarrocir;': '\u2949',
    '&Ubrcy;': '\u040E',
    '&Ubreve;': '\u016C',
    '&Ucirc': '\u00DB',
    '&Ucirc;': '\u00DB',
    '&Ucy;': '\u0423',
    '&Udblac;': '\u0170',
    '&Ufr;': '\uD835\uDD18',
    '&Ugrave': '\u00D9',
    '&Ugrave;': '\u00D9',
    '&Umacr;': '\u016A',
    '&UnderBar;': '\u005F',
    '&UnderBrace;': '\u23DF',
    '&UnderBracket;': '\u23B5',
    '&UnderParenthesis;': '\u23DD',
    '&Union;': '\u22C3',
    '&UnionPlus;': '\u228E',
    '&Uogon;': '\u0172',
    '&Uopf;': '\uD835\uDD4C',
    '&UpArrow;': '\u2191',
    '&UpArrowBar;': '\u2912',
    '&UpArrowDownArrow;': '\u21C5',
    '&UpDownArrow;': '\u2195',
    '&UpEquilibrium;': '\u296E',
    '&UpTee;': '\u22A5',
    '&UpTeeArrow;': '\u21A5',
    '&Uparrow;': '\u21D1',
    '&Updownarrow;': '\u21D5',
    '&UpperLeftArrow;': '\u2196',
    '&UpperRightArrow;': '\u2197',
    '&Upsi;': '\u03D2',
    '&Upsilon;': '\u03A5',
    '&Uring;': '\u016E',
    '&Uscr;': '\uD835\uDCB0',
    '&Utilde;': '\u0168',
    '&Uuml': '\u00DC',
    '&Uuml;': '\u00DC',
    '&VDash;': '\u22AB',
    '&Vbar;': '\u2AEB',
    '&Vcy;': '\u0412',
    '&Vdash;': '\u22A9',
    '&Vdashl;': '\u2AE6',
    '&Vee;': '\u22C1',
    '&Verbar;': '\u2016',
    '&Vert;': '\u2016',
    '&VerticalBar;': '\u2223',
    '&VerticalLine;': '\u007C',
    '&VerticalSeparator;': '\u2758',
    '&VerticalTilde;': '\u2240',
    '&VeryThinSpace;': '\u200A',
    '&Vfr;': '\uD835\uDD19',
    '&Vopf;': '\uD835\uDD4D',
    '&Vscr;': '\uD835\uDCB1',
    '&Vvdash;': '\u22AA',
    '&Wcirc;': '\u0174',
    '&Wedge;': '\u22C0',
    '&Wfr;': '\uD835\uDD1A',
    '&Wopf;': '\uD835\uDD4E',
    '&Wscr;': '\uD835\uDCB2',
    '&Xfr;': '\uD835\uDD1B',
    '&Xi;': '\u039E',
    '&Xopf;': '\uD835\uDD4F',
    '&Xscr;': '\uD835\uDCB3',
    '&YAcy;': '\u042F',
    '&YIcy;': '\u0407',
    '&YUcy;': '\u042E',
    '&Yacute': '\u00DD',
    '&Yacute;': '\u00DD',
    '&Ycirc;': '\u0176',
    '&Ycy;': '\u042B',
    '&Yfr;': '\uD835\uDD1C',
    '&Yopf;': '\uD835\uDD50',
    '&Yscr;': '\uD835\uDCB4',
    '&Yuml;': '\u0178',
    '&ZHcy;': '\u0416',
    '&Zacute;': '\u0179',
    '&Zcaron;': '\u017D',
    '&Zcy;': '\u0417',
    '&Zdot;': '\u017B',
    '&ZeroWidthSpace;': '\u200B',
    '&Zeta;': '\u0396',
    '&Zfr;': '\u2128',
    '&Zopf;': '\u2124',
    '&Zscr;': '\uD835\uDCB5',
    '&aacute': '\u00E1',
    '&aacute;': '\u00E1',
    '&abreve;': '\u0103',
    '&ac;': '\u223E',
    '&acE;': '\u223E\u0333',
    '&acd;': '\u223F',
    '&acirc': '\u00E2',
    '&acirc;': '\u00E2',
    '&acute': '\u00B4',
    '&acute;': '\u00B4',
    '&acy;': '\u0430',
    '&aelig': '\u00E6',
    '&aelig;': '\u00E6',
    '&af;': '\u2061',
    '&afr;': '\uD835\uDD1E',
    '&agrave': '\u00E0',
    '&agrave;': '\u00E0',
    '&alefsym;': '\u2135',
    '&aleph;': '\u2135',
    '&alpha;': '\u03B1',
    '&amacr;': '\u0101',
    '&amalg;': '\u2A3F',
    '&amp': '\u0026',
    '&amp;': '\u0026',
    '&and;': '\u2227',
    '&andand;': '\u2A55',
    '&andd;': '\u2A5C',
    '&andslope;': '\u2A58',
    '&andv;': '\u2A5A',
    '&ang;': '\u2220',
    '&ange;': '\u29A4',
    '&angle;': '\u2220',
    '&angmsd;': '\u2221',
    '&angmsdaa;': '\u29A8',
    '&angmsdab;': '\u29A9',
    '&angmsdac;': '\u29AA',
    '&angmsdad;': '\u29AB',
    '&angmsdae;': '\u29AC',
    '&angmsdaf;': '\u29AD',
    '&angmsdag;': '\u29AE',
    '&angmsdah;': '\u29AF',
    '&angrt;': '\u221F',
    '&angrtvb;': '\u22BE',
    '&angrtvbd;': '\u299D',
    '&angsph;': '\u2222',
    '&angst;': '\u00C5',
    '&angzarr;': '\u237C',
    '&aogon;': '\u0105',
    '&aopf;': '\uD835\uDD52',
    '&ap;': '\u2248',
    '&apE;': '\u2A70',
    '&apacir;': '\u2A6F',
    '&ape;': '\u224A',
    '&apid;': '\u224B',
    '&apos;': '\u0027',
    '&approx;': '\u2248',
    '&approxeq;': '\u224A',
    '&aring': '\u00E5',
    '&aring;': '\u00E5',
    '&ascr;': '\uD835\uDCB6',
    '&ast;': '\u002A',
    '&asymp;': '\u2248',
    '&asympeq;': '\u224D',
    '&atilde': '\u00E3',
    '&atilde;': '\u00E3',
    '&auml': '\u00E4',
    '&auml;': '\u00E4',
    '&awconint;': '\u2233',
    '&awint;': '\u2A11',
    '&bNot;': '\u2AED',
    '&backcong;': '\u224C',
    '&backepsilon;': '\u03F6',
    '&backprime;': '\u2035',
    '&backsim;': '\u223D',
    '&backsimeq;': '\u22CD',
    '&barvee;': '\u22BD',
    '&barwed;': '\u2305',
    '&barwedge;': '\u2305',
    '&bbrk;': '\u23B5',
    '&bbrktbrk;': '\u23B6',
    '&bcong;': '\u224C',
    '&bcy;': '\u0431',
    '&bdquo;': '\u201E',
    '&becaus;': '\u2235',
    '&because;': '\u2235',
    '&bemptyv;': '\u29B0',
    '&bepsi;': '\u03F6',
    '&bernou;': '\u212C',
    '&beta;': '\u03B2',
    '&beth;': '\u2136',
    '&between;': '\u226C',
    '&bfr;': '\uD835\uDD1F',
    '&bigcap;': '\u22C2',
    '&bigcirc;': '\u25EF',
    '&bigcup;': '\u22C3',
    '&bigodot;': '\u2A00',
    '&bigoplus;': '\u2A01',
    '&bigotimes;': '\u2A02',
    '&bigsqcup;': '\u2A06',
    '&bigstar;': '\u2605',
    '&bigtriangledown;': '\u25BD',
    '&bigtriangleup;': '\u25B3',
    '&biguplus;': '\u2A04',
    '&bigvee;': '\u22C1',
    '&bigwedge;': '\u22C0',
    '&bkarow;': '\u290D',
    '&blacklozenge;': '\u29EB',
    '&blacksquare;': '\u25AA',
    '&blacktriangle;': '\u25B4',
    '&blacktriangledown;': '\u25BE',
    '&blacktriangleleft;': '\u25C2',
    '&blacktriangleright;': '\u25B8',
    '&blank;': '\u2423',
    '&blk12;': '\u2592',
    '&blk14;': '\u2591',
    '&blk34;': '\u2593',
    '&block;': '\u2588',
    '&bne;': '\u003D\u20E5',
    '&bnequiv;': '\u2261\u20E5',
    '&bnot;': '\u2310',
    '&bopf;': '\uD835\uDD53',
    '&bot;': '\u22A5',
    '&bottom;': '\u22A5',
    '&bowtie;': '\u22C8',
    '&boxDL;': '\u2557',
    '&boxDR;': '\u2554',
    '&boxDl;': '\u2556',
    '&boxDr;': '\u2553',
    '&boxH;': '\u2550',
    '&boxHD;': '\u2566',
    '&boxHU;': '\u2569',
    '&boxHd;': '\u2564',
    '&boxHu;': '\u2567',
    '&boxUL;': '\u255D',
    '&boxUR;': '\u255A',
    '&boxUl;': '\u255C',
    '&boxUr;': '\u2559',
    '&boxV;': '\u2551',
    '&boxVH;': '\u256C',
    '&boxVL;': '\u2563',
    '&boxVR;': '\u2560',
    '&boxVh;': '\u256B',
    '&boxVl;': '\u2562',
    '&boxVr;': '\u255F',
    '&boxbox;': '\u29C9',
    '&boxdL;': '\u2555',
    '&boxdR;': '\u2552',
    '&boxdl;': '\u2510',
    '&boxdr;': '\u250C',
    '&boxh;': '\u2500',
    '&boxhD;': '\u2565',
    '&boxhU;': '\u2568',
    '&boxhd;': '\u252C',
    '&boxhu;': '\u2534',
    '&boxminus;': '\u229F',
    '&boxplus;': '\u229E',
    '&boxtimes;': '\u22A0',
    '&boxuL;': '\u255B',
    '&boxuR;': '\u2558',
    '&boxul;': '\u2518',
    '&boxur;': '\u2514',
    '&boxv;': '\u2502',
    '&boxvH;': '\u256A',
    '&boxvL;': '\u2561',
    '&boxvR;': '\u255E',
    '&boxvh;': '\u253C',
    '&boxvl;': '\u2524',
    '&boxvr;': '\u251C',
    '&bprime;': '\u2035',
    '&breve;': '\u02D8',
    '&brvbar': '\u00A6',
    '&brvbar;': '\u00A6',
    '&bscr;': '\uD835\uDCB7',
    '&bsemi;': '\u204F',
    '&bsim;': '\u223D',
    '&bsime;': '\u22CD',
    '&bsol;': '\u005C',
    '&bsolb;': '\u29C5',
    '&bsolhsub;': '\u27C8',
    '&bull;': '\u2022',
    '&bullet;': '\u2022',
    '&bump;': '\u224E',
    '&bumpE;': '\u2AAE',
    '&bumpe;': '\u224F',
    '&bumpeq;': '\u224F',
    '&cacute;': '\u0107',
    '&cap;': '\u2229',
    '&capand;': '\u2A44',
    '&capbrcup;': '\u2A49',
    '&capcap;': '\u2A4B',
    '&capcup;': '\u2A47',
    '&capdot;': '\u2A40',
    '&caps;': '\u2229\uFE00',
    '&caret;': '\u2041',
    '&caron;': '\u02C7',
    '&ccaps;': '\u2A4D',
    '&ccaron;': '\u010D',
    '&ccedil': '\u00E7',
    '&ccedil;': '\u00E7',
    '&ccirc;': '\u0109',
    '&ccups;': '\u2A4C',
    '&ccupssm;': '\u2A50',
    '&cdot;': '\u010B',
    '&cedil': '\u00B8',
    '&cedil;': '\u00B8',
    '&cemptyv;': '\u29B2',
    '&cent': '\u00A2',
    '&cent;': '\u00A2',
    '&centerdot;': '\u00B7',
    '&cfr;': '\uD835\uDD20',
    '&chcy;': '\u0447',
    '&check;': '\u2713',
    '&checkmark;': '\u2713',
    '&chi;': '\u03C7',
    '&cir;': '\u25CB',
    '&cirE;': '\u29C3',
    '&circ;': '\u02C6',
    '&circeq;': '\u2257',
    '&circlearrowleft;': '\u21BA',
    '&circlearrowright;': '\u21BB',
    '&circledR;': '\u00AE',
    '&circledS;': '\u24C8',
    '&circledast;': '\u229B',
    '&circledcirc;': '\u229A',
    '&circleddash;': '\u229D',
    '&cire;': '\u2257',
    '&cirfnint;': '\u2A10',
    '&cirmid;': '\u2AEF',
    '&cirscir;': '\u29C2',
    '&clubs;': '\u2663',
    '&clubsuit;': '\u2663',
    '&colon;': '\u003A',
    '&colone;': '\u2254',
    '&coloneq;': '\u2254',
    '&comma;': '\u002C',
    '&commat;': '\u0040',
    '&comp;': '\u2201',
    '&compfn;': '\u2218',
    '&complement;': '\u2201',
    '&complexes;': '\u2102',
    '&cong;': '\u2245',
    '&congdot;': '\u2A6D',
    '&conint;': '\u222E',
    '&copf;': '\uD835\uDD54',
    '&coprod;': '\u2210',
    '&copy': '\u00A9',
    '&copy;': '\u00A9',
    '&copysr;': '\u2117',
    '&crarr;': '\u21B5',
    '&cross;': '\u2717',
    '&cscr;': '\uD835\uDCB8',
    '&csub;': '\u2ACF',
    '&csube;': '\u2AD1',
    '&csup;': '\u2AD0',
    '&csupe;': '\u2AD2',
    '&ctdot;': '\u22EF',
    '&cudarrl;': '\u2938',
    '&cudarrr;': '\u2935',
    '&cuepr;': '\u22DE',
    '&cuesc;': '\u22DF',
    '&cularr;': '\u21B6',
    '&cularrp;': '\u293D',
    '&cup;': '\u222A',
    '&cupbrcap;': '\u2A48',
    '&cupcap;': '\u2A46',
    '&cupcup;': '\u2A4A',
    '&cupdot;': '\u228D',
    '&cupor;': '\u2A45',
    '&cups;': '\u222A\uFE00',
    '&curarr;': '\u21B7',
    '&curarrm;': '\u293C',
    '&curlyeqprec;': '\u22DE',
    '&curlyeqsucc;': '\u22DF',
    '&curlyvee;': '\u22CE',
    '&curlywedge;': '\u22CF',
    '&curren': '\u00A4',
    '&curren;': '\u00A4',
    '&curvearrowleft;': '\u21B6',
    '&curvearrowright;': '\u21B7',
    '&cuvee;': '\u22CE',
    '&cuwed;': '\u22CF',
    '&cwconint;': '\u2232',
    '&cwint;': '\u2231',
    '&cylcty;': '\u232D',
    '&dArr;': '\u21D3',
    '&dHar;': '\u2965',
    '&dagger;': '\u2020',
    '&daleth;': '\u2138',
    '&darr;': '\u2193',
    '&dash;': '\u2010',
    '&dashv;': '\u22A3',
    '&dbkarow;': '\u290F',
    '&dblac;': '\u02DD',
    '&dcaron;': '\u010F',
    '&dcy;': '\u0434',
    '&dd;': '\u2146',
    '&ddagger;': '\u2021',
    '&ddarr;': '\u21CA',
    '&ddotseq;': '\u2A77',
    '&deg': '\u00B0',
    '&deg;': '\u00B0',
    '&delta;': '\u03B4',
    '&demptyv;': '\u29B1',
    '&dfisht;': '\u297F',
    '&dfr;': '\uD835\uDD21',
    '&dharl;': '\u21C3',
    '&dharr;': '\u21C2',
    '&diam;': '\u22C4',
    '&diamond;': '\u22C4',
    '&diamondsuit;': '\u2666',
    '&diams;': '\u2666',
    '&die;': '\u00A8',
    '&digamma;': '\u03DD',
    '&disin;': '\u22F2',
    '&div;': '\u00F7',
    '&divide': '\u00F7',
    '&divide;': '\u00F7',
    '&divideontimes;': '\u22C7',
    '&divonx;': '\u22C7',
    '&djcy;': '\u0452',
    '&dlcorn;': '\u231E',
    '&dlcrop;': '\u230D',
    '&dollar;': '\u0024',
    '&dopf;': '\uD835\uDD55',
    '&dot;': '\u02D9',
    '&doteq;': '\u2250',
    '&doteqdot;': '\u2251',
    '&dotminus;': '\u2238',
    '&dotplus;': '\u2214',
    '&dotsquare;': '\u22A1',
    '&doublebarwedge;': '\u2306',
    '&downarrow;': '\u2193',
    '&downdownarrows;': '\u21CA',
    '&downharpoonleft;': '\u21C3',
    '&downharpoonright;': '\u21C2',
    '&drbkarow;': '\u2910',
    '&drcorn;': '\u231F',
    '&drcrop;': '\u230C',
    '&dscr;': '\uD835\uDCB9',
    '&dscy;': '\u0455',
    '&dsol;': '\u29F6',
    '&dstrok;': '\u0111',
    '&dtdot;': '\u22F1',
    '&dtri;': '\u25BF',
    '&dtrif;': '\u25BE',
    '&duarr;': '\u21F5',
    '&duhar;': '\u296F',
    '&dwangle;': '\u29A6',
    '&dzcy;': '\u045F',
    '&dzigrarr;': '\u27FF',
    '&eDDot;': '\u2A77',
    '&eDot;': '\u2251',
    '&eacute': '\u00E9',
    '&eacute;': '\u00E9',
    '&easter;': '\u2A6E',
    '&ecaron;': '\u011B',
    '&ecir;': '\u2256',
    '&ecirc': '\u00EA',
    '&ecirc;': '\u00EA',
    '&ecolon;': '\u2255',
    '&ecy;': '\u044D',
    '&edot;': '\u0117',
    '&ee;': '\u2147',
    '&efDot;': '\u2252',
    '&efr;': '\uD835\uDD22',
    '&eg;': '\u2A9A',
    '&egrave': '\u00E8',
    '&egrave;': '\u00E8',
    '&egs;': '\u2A96',
    '&egsdot;': '\u2A98',
    '&el;': '\u2A99',
    '&elinters;': '\u23E7',
    '&ell;': '\u2113',
    '&els;': '\u2A95',
    '&elsdot;': '\u2A97',
    '&emacr;': '\u0113',
    '&empty;': '\u2205',
    '&emptyset;': '\u2205',
    '&emptyv;': '\u2205',
    '&emsp13;': '\u2004',
    '&emsp14;': '\u2005',
    '&emsp;': '\u2003',
    '&eng;': '\u014B',
    '&ensp;': '\u2002',
    '&eogon;': '\u0119',
    '&eopf;': '\uD835\uDD56',
    '&epar;': '\u22D5',
    '&eparsl;': '\u29E3',
    '&eplus;': '\u2A71',
    '&epsi;': '\u03B5',
    '&epsilon;': '\u03B5',
    '&epsiv;': '\u03F5',
    '&eqcirc;': '\u2256',
    '&eqcolon;': '\u2255',
    '&eqsim;': '\u2242',
    '&eqslantgtr;': '\u2A96',
    '&eqslantless;': '\u2A95',
    '&equals;': '\u003D',
    '&equest;': '\u225F',
    '&equiv;': '\u2261',
    '&equivDD;': '\u2A78',
    '&eqvparsl;': '\u29E5',
    '&erDot;': '\u2253',
    '&erarr;': '\u2971',
    '&escr;': '\u212F',
    '&esdot;': '\u2250',
    '&esim;': '\u2242',
    '&eta;': '\u03B7',
    '&eth': '\u00F0',
    '&eth;': '\u00F0',
    '&euml': '\u00EB',
    '&euml;': '\u00EB',
    '&euro;': '\u20AC',
    '&excl;': '\u0021',
    '&exist;': '\u2203',
    '&expectation;': '\u2130',
    '&exponentiale;': '\u2147',
    '&fallingdotseq;': '\u2252',
    '&fcy;': '\u0444',
    '&female;': '\u2640',
    '&ffilig;': '\uFB03',
    '&fflig;': '\uFB00',
    '&ffllig;': '\uFB04',
    '&ffr;': '\uD835\uDD23',
    '&filig;': '\uFB01',
    '&fjlig;': '\u0066\u006A',
    '&flat;': '\u266D',
    '&fllig;': '\uFB02',
    '&fltns;': '\u25B1',
    '&fnof;': '\u0192',
    '&fopf;': '\uD835\uDD57',
    '&forall;': '\u2200',
    '&fork;': '\u22D4',
    '&forkv;': '\u2AD9',
    '&fpartint;': '\u2A0D',
    '&frac12': '\u00BD',
    '&frac12;': '\u00BD',
    '&frac13;': '\u2153',
    '&frac14': '\u00BC',
    '&frac14;': '\u00BC',
    '&frac15;': '\u2155',
    '&frac16;': '\u2159',
    '&frac18;': '\u215B',
    '&frac23;': '\u2154',
    '&frac25;': '\u2156',
    '&frac34': '\u00BE',
    '&frac34;': '\u00BE',
    '&frac35;': '\u2157',
    '&frac38;': '\u215C',
    '&frac45;': '\u2158',
    '&frac56;': '\u215A',
    '&frac58;': '\u215D',
    '&frac78;': '\u215E',
    '&frasl;': '\u2044',
    '&frown;': '\u2322',
    '&fscr;': '\uD835\uDCBB',
    '&gE;': '\u2267',
    '&gEl;': '\u2A8C',
    '&gacute;': '\u01F5',
    '&gamma;': '\u03B3',
    '&gammad;': '\u03DD',
    '&gap;': '\u2A86',
    '&gbreve;': '\u011F',
    '&gcirc;': '\u011D',
    '&gcy;': '\u0433',
    '&gdot;': '\u0121',
    '&ge;': '\u2265',
    '&gel;': '\u22DB',
    '&geq;': '\u2265',
    '&geqq;': '\u2267',
    '&geqslant;': '\u2A7E',
    '&ges;': '\u2A7E',
    '&gescc;': '\u2AA9',
    '&gesdot;': '\u2A80',
    '&gesdoto;': '\u2A82',
    '&gesdotol;': '\u2A84',
    '&gesl;': '\u22DB\uFE00',
    '&gesles;': '\u2A94',
    '&gfr;': '\uD835\uDD24',
    '&gg;': '\u226B',
    '&ggg;': '\u22D9',
    '&gimel;': '\u2137',
    '&gjcy;': '\u0453',
    '&gl;': '\u2277',
    '&glE;': '\u2A92',
    '&gla;': '\u2AA5',
    '&glj;': '\u2AA4',
    '&gnE;': '\u2269',
    '&gnap;': '\u2A8A',
    '&gnapprox;': '\u2A8A',
    '&gne;': '\u2A88',
    '&gneq;': '\u2A88',
    '&gneqq;': '\u2269',
    '&gnsim;': '\u22E7',
    '&gopf;': '\uD835\uDD58',
    '&grave;': '\u0060',
    '&gscr;': '\u210A',
    '&gsim;': '\u2273',
    '&gsime;': '\u2A8E',
    '&gsiml;': '\u2A90',
    '&gt': '\u003E',
    '&gt;': '\u003E',
    '&gtcc;': '\u2AA7',
    '&gtcir;': '\u2A7A',
    '&gtdot;': '\u22D7',
    '&gtlPar;': '\u2995',
    '&gtquest;': '\u2A7C',
    '&gtrapprox;': '\u2A86',
    '&gtrarr;': '\u2978',
    '&gtrdot;': '\u22D7',
    '&gtreqless;': '\u22DB',
    '&gtreqqless;': '\u2A8C',
    '&gtrless;': '\u2277',
    '&gtrsim;': '\u2273',
    '&gvertneqq;': '\u2269\uFE00',
    '&gvnE;': '\u2269\uFE00',
    '&hArr;': '\u21D4',
    '&hairsp;': '\u200A',
    '&half;': '\u00BD',
    '&hamilt;': '\u210B',
    '&hardcy;': '\u044A',
    '&harr;': '\u2194',
    '&harrcir;': '\u2948',
    '&harrw;': '\u21AD',
    '&hbar;': '\u210F',
    '&hcirc;': '\u0125',
    '&hearts;': '\u2665',
    '&heartsuit;': '\u2665',
    '&hellip;': '\u2026',
    '&hercon;': '\u22B9',
    '&hfr;': '\uD835\uDD25',
    '&hksearow;': '\u2925',
    '&hkswarow;': '\u2926',
    '&hoarr;': '\u21FF',
    '&homtht;': '\u223B',
    '&hookleftarrow;': '\u21A9',
    '&hookrightarrow;': '\u21AA',
    '&hopf;': '\uD835\uDD59',
    '&horbar;': '\u2015',
    '&hscr;': '\uD835\uDCBD',
    '&hslash;': '\u210F',
    '&hstrok;': '\u0127',
    '&hybull;': '\u2043',
    '&hyphen;': '\u2010',
    '&iacute': '\u00ED',
    '&iacute;': '\u00ED',
    '&ic;': '\u2063',
    '&icirc': '\u00EE',
    '&icirc;': '\u00EE',
    '&icy;': '\u0438',
    '&iecy;': '\u0435',
    '&iexcl': '\u00A1',
    '&iexcl;': '\u00A1',
    '&iff;': '\u21D4',
    '&ifr;': '\uD835\uDD26',
    '&igrave': '\u00EC',
    '&igrave;': '\u00EC',
    '&ii;': '\u2148',
    '&iiiint;': '\u2A0C',
    '&iiint;': '\u222D',
    '&iinfin;': '\u29DC',
    '&iiota;': '\u2129',
    '&ijlig;': '\u0133',
    '&imacr;': '\u012B',
    '&image;': '\u2111',
    '&imagline;': '\u2110',
    '&imagpart;': '\u2111',
    '&imath;': '\u0131',
    '&imof;': '\u22B7',
    '&imped;': '\u01B5',
    '&in;': '\u2208',
    '&incare;': '\u2105',
    '&infin;': '\u221E',
    '&infintie;': '\u29DD',
    '&inodot;': '\u0131',
    '&int;': '\u222B',
    '&intcal;': '\u22BA',
    '&integers;': '\u2124',
    '&intercal;': '\u22BA',
    '&intlarhk;': '\u2A17',
    '&intprod;': '\u2A3C',
    '&iocy;': '\u0451',
    '&iogon;': '\u012F',
    '&iopf;': '\uD835\uDD5A',
    '&iota;': '\u03B9',
    '&iprod;': '\u2A3C',
    '&iquest': '\u00BF',
    '&iquest;': '\u00BF',
    '&iscr;': '\uD835\uDCBE',
    '&isin;': '\u2208',
    '&isinE;': '\u22F9',
    '&isindot;': '\u22F5',
    '&isins;': '\u22F4',
    '&isinsv;': '\u22F3',
    '&isinv;': '\u2208',
    '&it;': '\u2062',
    '&itilde;': '\u0129',
    '&iukcy;': '\u0456',
    '&iuml': '\u00EF',
    '&iuml;': '\u00EF',
    '&jcirc;': '\u0135',
    '&jcy;': '\u0439',
    '&jfr;': '\uD835\uDD27',
    '&jmath;': '\u0237',
    '&jopf;': '\uD835\uDD5B',
    '&jscr;': '\uD835\uDCBF',
    '&jsercy;': '\u0458',
    '&jukcy;': '\u0454',
    '&kappa;': '\u03BA',
    '&kappav;': '\u03F0',
    '&kcedil;': '\u0137',
    '&kcy;': '\u043A',
    '&kfr;': '\uD835\uDD28',
    '&kgreen;': '\u0138',
    '&khcy;': '\u0445',
    '&kjcy;': '\u045C',
    '&kopf;': '\uD835\uDD5C',
    '&kscr;': '\uD835\uDCC0',
    '&lAarr;': '\u21DA',
    '&lArr;': '\u21D0',
    '&lAtail;': '\u291B',
    '&lBarr;': '\u290E',
    '&lE;': '\u2266',
    '&lEg;': '\u2A8B',
    '&lHar;': '\u2962',
    '&lacute;': '\u013A',
    '&laemptyv;': '\u29B4',
    '&lagran;': '\u2112',
    '&lambda;': '\u03BB',
    '&lang;': '\u27E8',
    '&langd;': '\u2991',
    '&langle;': '\u27E8',
    '&lap;': '\u2A85',
    '&laquo': '\u00AB',
    '&laquo;': '\u00AB',
    '&larr;': '\u2190',
    '&larrb;': '\u21E4',
    '&larrbfs;': '\u291F',
    '&larrfs;': '\u291D',
    '&larrhk;': '\u21A9',
    '&larrlp;': '\u21AB',
    '&larrpl;': '\u2939',
    '&larrsim;': '\u2973',
    '&larrtl;': '\u21A2',
    '&lat;': '\u2AAB',
    '&latail;': '\u2919',
    '&late;': '\u2AAD',
    '&lates;': '\u2AAD\uFE00',
    '&lbarr;': '\u290C',
    '&lbbrk;': '\u2772',
    '&lbrace;': '\u007B',
    '&lbrack;': '\u005B',
    '&lbrke;': '\u298B',
    '&lbrksld;': '\u298F',
    '&lbrkslu;': '\u298D',
    '&lcaron;': '\u013E',
    '&lcedil;': '\u013C',
    '&lceil;': '\u2308',
    '&lcub;': '\u007B',
    '&lcy;': '\u043B',
    '&ldca;': '\u2936',
    '&ldquo;': '\u201C',
    '&ldquor;': '\u201E',
    '&ldrdhar;': '\u2967',
    '&ldrushar;': '\u294B',
    '&ldsh;': '\u21B2',
    '&le;': '\u2264',
    '&leftarrow;': '\u2190',
    '&leftarrowtail;': '\u21A2',
    '&leftharpoondown;': '\u21BD',
    '&leftharpoonup;': '\u21BC',
    '&leftleftarrows;': '\u21C7',
    '&leftrightarrow;': '\u2194',
    '&leftrightarrows;': '\u21C6',
    '&leftrightharpoons;': '\u21CB',
    '&leftrightsquigarrow;': '\u21AD',
    '&leftthreetimes;': '\u22CB',
    '&leg;': '\u22DA',
    '&leq;': '\u2264',
    '&leqq;': '\u2266',
    '&leqslant;': '\u2A7D',
    '&les;': '\u2A7D',
    '&lescc;': '\u2AA8',
    '&lesdot;': '\u2A7F',
    '&lesdoto;': '\u2A81',
    '&lesdotor;': '\u2A83',
    '&lesg;': '\u22DA\uFE00',
    '&lesges;': '\u2A93',
    '&lessapprox;': '\u2A85',
    '&lessdot;': '\u22D6',
    '&lesseqgtr;': '\u22DA',
    '&lesseqqgtr;': '\u2A8B',
    '&lessgtr;': '\u2276',
    '&lesssim;': '\u2272',
    '&lfisht;': '\u297C',
    '&lfloor;': '\u230A',
    '&lfr;': '\uD835\uDD29',
    '&lg;': '\u2276',
    '&lgE;': '\u2A91',
    '&lhard;': '\u21BD',
    '&lharu;': '\u21BC',
    '&lharul;': '\u296A',
    '&lhblk;': '\u2584',
    '&ljcy;': '\u0459',
    '&ll;': '\u226A',
    '&llarr;': '\u21C7',
    '&llcorner;': '\u231E',
    '&llhard;': '\u296B',
    '&lltri;': '\u25FA',
    '&lmidot;': '\u0140',
    '&lmoust;': '\u23B0',
    '&lmoustache;': '\u23B0',
    '&lnE;': '\u2268',
    '&lnap;': '\u2A89',
    '&lnapprox;': '\u2A89',
    '&lne;': '\u2A87',
    '&lneq;': '\u2A87',
    '&lneqq;': '\u2268',
    '&lnsim;': '\u22E6',
    '&loang;': '\u27EC',
    '&loarr;': '\u21FD',
    '&lobrk;': '\u27E6',
    '&longleftarrow;': '\u27F5',
    '&longleftrightarrow;': '\u27F7',
    '&longmapsto;': '\u27FC',
    '&longrightarrow;': '\u27F6',
    '&looparrowleft;': '\u21AB',
    '&looparrowright;': '\u21AC',
    '&lopar;': '\u2985',
    '&lopf;': '\uD835\uDD5D',
    '&loplus;': '\u2A2D',
    '&lotimes;': '\u2A34',
    '&lowast;': '\u2217',
    '&lowbar;': '\u005F',
    '&loz;': '\u25CA',
    '&lozenge;': '\u25CA',
    '&lozf;': '\u29EB',
    '&lpar;': '\u0028',
    '&lparlt;': '\u2993',
    '&lrarr;': '\u21C6',
    '&lrcorner;': '\u231F',
    '&lrhar;': '\u21CB',
    '&lrhard;': '\u296D',
    '&lrm;': '\u200E',
    '&lrtri;': '\u22BF',
    '&lsaquo;': '\u2039',
    '&lscr;': '\uD835\uDCC1',
    '&lsh;': '\u21B0',
    '&lsim;': '\u2272',
    '&lsime;': '\u2A8D',
    '&lsimg;': '\u2A8F',
    '&lsqb;': '\u005B',
    '&lsquo;': '\u2018',
    '&lsquor;': '\u201A',
    '&lstrok;': '\u0142',
    '&lt': '\u003C',
    '&lt;': '\u003C',
    '&ltcc;': '\u2AA6',
    '&ltcir;': '\u2A79',
    '&ltdot;': '\u22D6',
    '&lthree;': '\u22CB',
    '&ltimes;': '\u22C9',
    '&ltlarr;': '\u2976',
    '&ltquest;': '\u2A7B',
    '&ltrPar;': '\u2996',
    '&ltri;': '\u25C3',
    '&ltrie;': '\u22B4',
    '&ltrif;': '\u25C2',
    '&lurdshar;': '\u294A',
    '&luruhar;': '\u2966',
    '&lvertneqq;': '\u2268\uFE00',
    '&lvnE;': '\u2268\uFE00',
    '&mDDot;': '\u223A',
    '&macr': '\u00AF',
    '&macr;': '\u00AF',
    '&male;': '\u2642',
    '&malt;': '\u2720',
    '&maltese;': '\u2720',
    '&map;': '\u21A6',
    '&mapsto;': '\u21A6',
    '&mapstodown;': '\u21A7',
    '&mapstoleft;': '\u21A4',
    '&mapstoup;': '\u21A5',
    '&marker;': '\u25AE',
    '&mcomma;': '\u2A29',
    '&mcy;': '\u043C',
    '&mdash;': '\u2014',
    '&measuredangle;': '\u2221',
    '&mfr;': '\uD835\uDD2A',
    '&mho;': '\u2127',
    '&micro': '\u00B5',
    '&micro;': '\u00B5',
    '&mid;': '\u2223',
    '&midast;': '\u002A',
    '&midcir;': '\u2AF0',
    '&middot': '\u00B7',
    '&middot;': '\u00B7',
    '&minus;': '\u2212',
    '&minusb;': '\u229F',
    '&minusd;': '\u2238',
    '&minusdu;': '\u2A2A',
    '&mlcp;': '\u2ADB',
    '&mldr;': '\u2026',
    '&mnplus;': '\u2213',
    '&models;': '\u22A7',
    '&mopf;': '\uD835\uDD5E',
    '&mp;': '\u2213',
    '&mscr;': '\uD835\uDCC2',
    '&mstpos;': '\u223E',
    '&mu;': '\u03BC',
    '&multimap;': '\u22B8',
    '&mumap;': '\u22B8',
    '&nGg;': '\u22D9\u0338',
    '&nGt;': '\u226B\u20D2',
    '&nGtv;': '\u226B\u0338',
    '&nLeftarrow;': '\u21CD',
    '&nLeftrightarrow;': '\u21CE',
    '&nLl;': '\u22D8\u0338',
    '&nLt;': '\u226A\u20D2',
    '&nLtv;': '\u226A\u0338',
    '&nRightarrow;': '\u21CF',
    '&nVDash;': '\u22AF',
    '&nVdash;': '\u22AE',
    '&nabla;': '\u2207',
    '&nacute;': '\u0144',
    '&nang;': '\u2220\u20D2',
    '&nap;': '\u2249',
    '&napE;': '\u2A70\u0338',
    '&napid;': '\u224B\u0338',
    '&napos;': '\u0149',
    '&napprox;': '\u2249',
    '&natur;': '\u266E',
    '&natural;': '\u266E',
    '&naturals;': '\u2115',
    '&nbsp': '\u00A0',
    '&nbsp;': '\u00A0',
    '&nbump;': '\u224E\u0338',
    '&nbumpe;': '\u224F\u0338',
    '&ncap;': '\u2A43',
    '&ncaron;': '\u0148',
    '&ncedil;': '\u0146',
    '&ncong;': '\u2247',
    '&ncongdot;': '\u2A6D\u0338',
    '&ncup;': '\u2A42',
    '&ncy;': '\u043D',
    '&ndash;': '\u2013',
    '&ne;': '\u2260',
    '&neArr;': '\u21D7',
    '&nearhk;': '\u2924',
    '&nearr;': '\u2197',
    '&nearrow;': '\u2197',
    '&nedot;': '\u2250\u0338',
    '&nequiv;': '\u2262',
    '&nesear;': '\u2928',
    '&nesim;': '\u2242\u0338',
    '&nexist;': '\u2204',
    '&nexists;': '\u2204',
    '&nfr;': '\uD835\uDD2B',
    '&ngE;': '\u2267\u0338',
    '&nge;': '\u2271',
    '&ngeq;': '\u2271',
    '&ngeqq;': '\u2267\u0338',
    '&ngeqslant;': '\u2A7E\u0338',
    '&nges;': '\u2A7E\u0338',
    '&ngsim;': '\u2275',
    '&ngt;': '\u226F',
    '&ngtr;': '\u226F',
    '&nhArr;': '\u21CE',
    '&nharr;': '\u21AE',
    '&nhpar;': '\u2AF2',
    '&ni;': '\u220B',
    '&nis;': '\u22FC',
    '&nisd;': '\u22FA',
    '&niv;': '\u220B',
    '&njcy;': '\u045A',
    '&nlArr;': '\u21CD',
    '&nlE;': '\u2266\u0338',
    '&nlarr;': '\u219A',
    '&nldr;': '\u2025',
    '&nle;': '\u2270',
    '&nleftarrow;': '\u219A',
    '&nleftrightarrow;': '\u21AE',
    '&nleq;': '\u2270',
    '&nleqq;': '\u2266\u0338',
    '&nleqslant;': '\u2A7D\u0338',
    '&nles;': '\u2A7D\u0338',
    '&nless;': '\u226E',
    '&nlsim;': '\u2274',
    '&nlt;': '\u226E',
    '&nltri;': '\u22EA',
    '&nltrie;': '\u22EC',
    '&nmid;': '\u2224',
    '&nopf;': '\uD835\uDD5F',
    '&not': '\u00AC',
    '&not;': '\u00AC',
    '&notin;': '\u2209',
    '&notinE;': '\u22F9\u0338',
    '&notindot;': '\u22F5\u0338',
    '&notinva;': '\u2209',
    '&notinvb;': '\u22F7',
    '&notinvc;': '\u22F6',
    '&notni;': '\u220C',
    '&notniva;': '\u220C',
    '&notnivb;': '\u22FE',
    '&notnivc;': '\u22FD',
    '&npar;': '\u2226',
    '&nparallel;': '\u2226',
    '&nparsl;': '\u2AFD\u20E5',
    '&npart;': '\u2202\u0338',
    '&npolint;': '\u2A14',
    '&npr;': '\u2280',
    '&nprcue;': '\u22E0',
    '&npre;': '\u2AAF\u0338',
    '&nprec;': '\u2280',
    '&npreceq;': '\u2AAF\u0338',
    '&nrArr;': '\u21CF',
    '&nrarr;': '\u219B',
    '&nrarrc;': '\u2933\u0338',
    '&nrarrw;': '\u219D\u0338',
    '&nrightarrow;': '\u219B',
    '&nrtri;': '\u22EB',
    '&nrtrie;': '\u22ED',
    '&nsc;': '\u2281',
    '&nsccue;': '\u22E1',
    '&nsce;': '\u2AB0\u0338',
    '&nscr;': '\uD835\uDCC3',
    '&nshortmid;': '\u2224',
    '&nshortparallel;': '\u2226',
    '&nsim;': '\u2241',
    '&nsime;': '\u2244',
    '&nsimeq;': '\u2244',
    '&nsmid;': '\u2224',
    '&nspar;': '\u2226',
    '&nsqsube;': '\u22E2',
    '&nsqsupe;': '\u22E3',
    '&nsub;': '\u2284',
    '&nsubE;': '\u2AC5\u0338',
    '&nsube;': '\u2288',
    '&nsubset;': '\u2282\u20D2',
    '&nsubseteq;': '\u2288',
    '&nsubseteqq;': '\u2AC5\u0338',
    '&nsucc;': '\u2281',
    '&nsucceq;': '\u2AB0\u0338',
    '&nsup;': '\u2285',
    '&nsupE;': '\u2AC6\u0338',
    '&nsupe;': '\u2289',
    '&nsupset;': '\u2283\u20D2',
    '&nsupseteq;': '\u2289',
    '&nsupseteqq;': '\u2AC6\u0338',
    '&ntgl;': '\u2279',
    '&ntilde': '\u00F1',
    '&ntilde;': '\u00F1',
    '&ntlg;': '\u2278',
    '&ntriangleleft;': '\u22EA',
    '&ntrianglelefteq;': '\u22EC',
    '&ntriangleright;': '\u22EB',
    '&ntrianglerighteq;': '\u22ED',
    '&nu;': '\u03BD',
    '&num;': '\u0023',
    '&numero;': '\u2116',
    '&numsp;': '\u2007',
    '&nvDash;': '\u22AD',
    '&nvHarr;': '\u2904',
    '&nvap;': '\u224D\u20D2',
    '&nvdash;': '\u22AC',
    '&nvge;': '\u2265\u20D2',
    '&nvgt;': '\u003E\u20D2',
    '&nvinfin;': '\u29DE',
    '&nvlArr;': '\u2902',
    '&nvle;': '\u2264\u20D2',
    '&nvlt;': '\u003C\u20D2',
    '&nvltrie;': '\u22B4\u20D2',
    '&nvrArr;': '\u2903',
    '&nvrtrie;': '\u22B5\u20D2',
    '&nvsim;': '\u223C\u20D2',
    '&nwArr;': '\u21D6',
    '&nwarhk;': '\u2923',
    '&nwarr;': '\u2196',
    '&nwarrow;': '\u2196',
    '&nwnear;': '\u2927',
    '&oS;': '\u24C8',
    '&oacute': '\u00F3',
    '&oacute;': '\u00F3',
    '&oast;': '\u229B',
    '&ocir;': '\u229A',
    '&ocirc': '\u00F4',
    '&ocirc;': '\u00F4',
    '&ocy;': '\u043E',
    '&odash;': '\u229D',
    '&odblac;': '\u0151',
    '&odiv;': '\u2A38',
    '&odot;': '\u2299',
    '&odsold;': '\u29BC',
    '&oelig;': '\u0153',
    '&ofcir;': '\u29BF',
    '&ofr;': '\uD835\uDD2C',
    '&ogon;': '\u02DB',
    '&ograve': '\u00F2',
    '&ograve;': '\u00F2',
    '&ogt;': '\u29C1',
    '&ohbar;': '\u29B5',
    '&ohm;': '\u03A9',
    '&oint;': '\u222E',
    '&olarr;': '\u21BA',
    '&olcir;': '\u29BE',
    '&olcross;': '\u29BB',
    '&oline;': '\u203E',
    '&olt;': '\u29C0',
    '&omacr;': '\u014D',
    '&omega;': '\u03C9',
    '&omicron;': '\u03BF',
    '&omid;': '\u29B6',
    '&ominus;': '\u2296',
    '&oopf;': '\uD835\uDD60',
    '&opar;': '\u29B7',
    '&operp;': '\u29B9',
    '&oplus;': '\u2295',
    '&or;': '\u2228',
    '&orarr;': '\u21BB',
    '&ord;': '\u2A5D',
    '&order;': '\u2134',
    '&orderof;': '\u2134',
    '&ordf': '\u00AA',
    '&ordf;': '\u00AA',
    '&ordm': '\u00BA',
    '&ordm;': '\u00BA',
    '&origof;': '\u22B6',
    '&oror;': '\u2A56',
    '&orslope;': '\u2A57',
    '&orv;': '\u2A5B',
    '&oscr;': '\u2134',
    '&oslash': '\u00F8',
    '&oslash;': '\u00F8',
    '&osol;': '\u2298',
    '&otilde': '\u00F5',
    '&otilde;': '\u00F5',
    '&otimes;': '\u2297',
    '&otimesas;': '\u2A36',
    '&ouml': '\u00F6',
    '&ouml;': '\u00F6',
    '&ovbar;': '\u233D',
    '&par;': '\u2225',
    '&para': '\u00B6',
    '&para;': '\u00B6',
    '&parallel;': '\u2225',
    '&parsim;': '\u2AF3',
    '&parsl;': '\u2AFD',
    '&part;': '\u2202',
    '&pcy;': '\u043F',
    '&percnt;': '\u0025',
    '&period;': '\u002E',
    '&permil;': '\u2030',
    '&perp;': '\u22A5',
    '&pertenk;': '\u2031',
    '&pfr;': '\uD835\uDD2D',
    '&phi;': '\u03C6',
    '&phiv;': '\u03D5',
    '&phmmat;': '\u2133',
    '&phone;': '\u260E',
    '&pi;': '\u03C0',
    '&pitchfork;': '\u22D4',
    '&piv;': '\u03D6',
    '&planck;': '\u210F',
    '&planckh;': '\u210E',
    '&plankv;': '\u210F',
    '&plus;': '\u002B',
    '&plusacir;': '\u2A23',
    '&plusb;': '\u229E',
    '&pluscir;': '\u2A22',
    '&plusdo;': '\u2214',
    '&plusdu;': '\u2A25',
    '&pluse;': '\u2A72',
    '&plusmn': '\u00B1',
    '&plusmn;': '\u00B1',
    '&plussim;': '\u2A26',
    '&plustwo;': '\u2A27',
    '&pm;': '\u00B1',
    '&pointint;': '\u2A15',
    '&popf;': '\uD835\uDD61',
    '&pound': '\u00A3',
    '&pound;': '\u00A3',
    '&pr;': '\u227A',
    '&prE;': '\u2AB3',
    '&prap;': '\u2AB7',
    '&prcue;': '\u227C',
    '&pre;': '\u2AAF',
    '&prec;': '\u227A',
    '&precapprox;': '\u2AB7',
    '&preccurlyeq;': '\u227C',
    '&preceq;': '\u2AAF',
    '&precnapprox;': '\u2AB9',
    '&precneqq;': '\u2AB5',
    '&precnsim;': '\u22E8',
    '&precsim;': '\u227E',
    '&prime;': '\u2032',
    '&primes;': '\u2119',
    '&prnE;': '\u2AB5',
    '&prnap;': '\u2AB9',
    '&prnsim;': '\u22E8',
    '&prod;': '\u220F',
    '&profalar;': '\u232E',
    '&profline;': '\u2312',
    '&profsurf;': '\u2313',
    '&prop;': '\u221D',
    '&propto;': '\u221D',
    '&prsim;': '\u227E',
    '&prurel;': '\u22B0',
    '&pscr;': '\uD835\uDCC5',
    '&psi;': '\u03C8',
    '&puncsp;': '\u2008',
    '&qfr;': '\uD835\uDD2E',
    '&qint;': '\u2A0C',
    '&qopf;': '\uD835\uDD62',
    '&qprime;': '\u2057',
    '&qscr;': '\uD835\uDCC6',
    '&quaternions;': '\u210D',
    '&quatint;': '\u2A16',
    '&quest;': '\u003F',
    '&questeq;': '\u225F',
    '&quot': '\u0022',
    '&quot;': '\u0022',
    '&rAarr;': '\u21DB',
    '&rArr;': '\u21D2',
    '&rAtail;': '\u291C',
    '&rBarr;': '\u290F',
    '&rHar;': '\u2964',
    '&race;': '\u223D\u0331',
    '&racute;': '\u0155',
    '&radic;': '\u221A',
    '&raemptyv;': '\u29B3',
    '&rang;': '\u27E9',
    '&rangd;': '\u2992',
    '&range;': '\u29A5',
    '&rangle;': '\u27E9',
    '&raquo': '\u00BB',
    '&raquo;': '\u00BB',
    '&rarr;': '\u2192',
    '&rarrap;': '\u2975',
    '&rarrb;': '\u21E5',
    '&rarrbfs;': '\u2920',
    '&rarrc;': '\u2933',
    '&rarrfs;': '\u291E',
    '&rarrhk;': '\u21AA',
    '&rarrlp;': '\u21AC',
    '&rarrpl;': '\u2945',
    '&rarrsim;': '\u2974',
    '&rarrtl;': '\u21A3',
    '&rarrw;': '\u219D',
    '&ratail;': '\u291A',
    '&ratio;': '\u2236',
    '&rationals;': '\u211A',
    '&rbarr;': '\u290D',
    '&rbbrk;': '\u2773',
    '&rbrace;': '\u007D',
    '&rbrack;': '\u005D',
    '&rbrke;': '\u298C',
    '&rbrksld;': '\u298E',
    '&rbrkslu;': '\u2990',
    '&rcaron;': '\u0159',
    '&rcedil;': '\u0157',
    '&rceil;': '\u2309',
    '&rcub;': '\u007D',
    '&rcy;': '\u0440',
    '&rdca;': '\u2937',
    '&rdldhar;': '\u2969',
    '&rdquo;': '\u201D',
    '&rdquor;': '\u201D',
    '&rdsh;': '\u21B3',
    '&real;': '\u211C',
    '&realine;': '\u211B',
    '&realpart;': '\u211C',
    '&reals;': '\u211D',
    '&rect;': '\u25AD',
    '&reg': '\u00AE',
    '&reg;': '\u00AE',
    '&rfisht;': '\u297D',
    '&rfloor;': '\u230B',
    '&rfr;': '\uD835\uDD2F',
    '&rhard;': '\u21C1',
    '&rharu;': '\u21C0',
    '&rharul;': '\u296C',
    '&rho;': '\u03C1',
    '&rhov;': '\u03F1',
    '&rightarrow;': '\u2192',
    '&rightarrowtail;': '\u21A3',
    '&rightharpoondown;': '\u21C1',
    '&rightharpoonup;': '\u21C0',
    '&rightleftarrows;': '\u21C4',
    '&rightleftharpoons;': '\u21CC',
    '&rightrightarrows;': '\u21C9',
    '&rightsquigarrow;': '\u219D',
    '&rightthreetimes;': '\u22CC',
    '&ring;': '\u02DA',
    '&risingdotseq;': '\u2253',
    '&rlarr;': '\u21C4',
    '&rlhar;': '\u21CC',
    '&rlm;': '\u200F',
    '&rmoust;': '\u23B1',
    '&rmoustache;': '\u23B1',
    '&rnmid;': '\u2AEE',
    '&roang;': '\u27ED',
    '&roarr;': '\u21FE',
    '&robrk;': '\u27E7',
    '&ropar;': '\u2986',
    '&ropf;': '\uD835\uDD63',
    '&roplus;': '\u2A2E',
    '&rotimes;': '\u2A35',
    '&rpar;': '\u0029',
    '&rpargt;': '\u2994',
    '&rppolint;': '\u2A12',
    '&rrarr;': '\u21C9',
    '&rsaquo;': '\u203A',
    '&rscr;': '\uD835\uDCC7',
    '&rsh;': '\u21B1',
    '&rsqb;': '\u005D',
    '&rsquo;': '\u2019',
    '&rsquor;': '\u2019',
    '&rthree;': '\u22CC',
    '&rtimes;': '\u22CA',
    '&rtri;': '\u25B9',
    '&rtrie;': '\u22B5',
    '&rtrif;': '\u25B8',
    '&rtriltri;': '\u29CE',
    '&ruluhar;': '\u2968',
    '&rx;': '\u211E',
    '&sacute;': '\u015B',
    '&sbquo;': '\u201A',
    '&sc;': '\u227B',
    '&scE;': '\u2AB4',
    '&scap;': '\u2AB8',
    '&scaron;': '\u0161',
    '&sccue;': '\u227D',
    '&sce;': '\u2AB0',
    '&scedil;': '\u015F',
    '&scirc;': '\u015D',
    '&scnE;': '\u2AB6',
    '&scnap;': '\u2ABA',
    '&scnsim;': '\u22E9',
    '&scpolint;': '\u2A13',
    '&scsim;': '\u227F',
    '&scy;': '\u0441',
    '&sdot;': '\u22C5',
    '&sdotb;': '\u22A1',
    '&sdote;': '\u2A66',
    '&seArr;': '\u21D8',
    '&searhk;': '\u2925',
    '&searr;': '\u2198',
    '&searrow;': '\u2198',
    '&sect': '\u00A7',
    '&sect;': '\u00A7',
    '&semi;': '\u003B',
    '&seswar;': '\u2929',
    '&setminus;': '\u2216',
    '&setmn;': '\u2216',
    '&sext;': '\u2736',
    '&sfr;': '\uD835\uDD30',
    '&sfrown;': '\u2322',
    '&sharp;': '\u266F',
    '&shchcy;': '\u0449',
    '&shcy;': '\u0448',
    '&shortmid;': '\u2223',
    '&shortparallel;': '\u2225',
    '&shy': '\u00AD',
    '&shy;': '\u00AD',
    '&sigma;': '\u03C3',
    '&sigmaf;': '\u03C2',
    '&sigmav;': '\u03C2',
    '&sim;': '\u223C',
    '&simdot;': '\u2A6A',
    '&sime;': '\u2243',
    '&simeq;': '\u2243',
    '&simg;': '\u2A9E',
    '&simgE;': '\u2AA0',
    '&siml;': '\u2A9D',
    '&simlE;': '\u2A9F',
    '&simne;': '\u2246',
    '&simplus;': '\u2A24',
    '&simrarr;': '\u2972',
    '&slarr;': '\u2190',
    '&smallsetminus;': '\u2216',
    '&smashp;': '\u2A33',
    '&smeparsl;': '\u29E4',
    '&smid;': '\u2223',
    '&smile;': '\u2323',
    '&smt;': '\u2AAA',
    '&smte;': '\u2AAC',
    '&smtes;': '\u2AAC\uFE00',
    '&softcy;': '\u044C',
    '&sol;': '\u002F',
    '&solb;': '\u29C4',
    '&solbar;': '\u233F',
    '&sopf;': '\uD835\uDD64',
    '&spades;': '\u2660',
    '&spadesuit;': '\u2660',
    '&spar;': '\u2225',
    '&sqcap;': '\u2293',
    '&sqcaps;': '\u2293\uFE00',
    '&sqcup;': '\u2294',
    '&sqcups;': '\u2294\uFE00',
    '&sqsub;': '\u228F',
    '&sqsube;': '\u2291',
    '&sqsubset;': '\u228F',
    '&sqsubseteq;': '\u2291',
    '&sqsup;': '\u2290',
    '&sqsupe;': '\u2292',
    '&sqsupset;': '\u2290',
    '&sqsupseteq;': '\u2292',
    '&squ;': '\u25A1',
    '&square;': '\u25A1',
    '&squarf;': '\u25AA',
    '&squf;': '\u25AA',
    '&srarr;': '\u2192',
    '&sscr;': '\uD835\uDCC8',
    '&ssetmn;': '\u2216',
    '&ssmile;': '\u2323',
    '&sstarf;': '\u22C6',
    '&star;': '\u2606',
    '&starf;': '\u2605',
    '&straightepsilon;': '\u03F5',
    '&straightphi;': '\u03D5',
    '&strns;': '\u00AF',
    '&sub;': '\u2282',
    '&subE;': '\u2AC5',
    '&subdot;': '\u2ABD',
    '&sube;': '\u2286',
    '&subedot;': '\u2AC3',
    '&submult;': '\u2AC1',
    '&subnE;': '\u2ACB',
    '&subne;': '\u228A',
    '&subplus;': '\u2ABF',
    '&subrarr;': '\u2979',
    '&subset;': '\u2282',
    '&subseteq;': '\u2286',
    '&subseteqq;': '\u2AC5',
    '&subsetneq;': '\u228A',
    '&subsetneqq;': '\u2ACB',
    '&subsim;': '\u2AC7',
    '&subsub;': '\u2AD5',
    '&subsup;': '\u2AD3',
    '&succ;': '\u227B',
    '&succapprox;': '\u2AB8',
    '&succcurlyeq;': '\u227D',
    '&succeq;': '\u2AB0',
    '&succnapprox;': '\u2ABA',
    '&succneqq;': '\u2AB6',
    '&succnsim;': '\u22E9',
    '&succsim;': '\u227F',
    '&sum;': '\u2211',
    '&sung;': '\u266A',
    '&sup1': '\u00B9',
    '&sup1;': '\u00B9',
    '&sup2': '\u00B2',
    '&sup2;': '\u00B2',
    '&sup3': '\u00B3',
    '&sup3;': '\u00B3',
    '&sup;': '\u2283',
    '&supE;': '\u2AC6',
    '&supdot;': '\u2ABE',
    '&supdsub;': '\u2AD8',
    '&supe;': '\u2287',
    '&supedot;': '\u2AC4',
    '&suphsol;': '\u27C9',
    '&suphsub;': '\u2AD7',
    '&suplarr;': '\u297B',
    '&supmult;': '\u2AC2',
    '&supnE;': '\u2ACC',
    '&supne;': '\u228B',
    '&supplus;': '\u2AC0',
    '&supset;': '\u2283',
    '&supseteq;': '\u2287',
    '&supseteqq;': '\u2AC6',
    '&supsetneq;': '\u228B',
    '&supsetneqq;': '\u2ACC',
    '&supsim;': '\u2AC8',
    '&supsub;': '\u2AD4',
    '&supsup;': '\u2AD6',
    '&swArr;': '\u21D9',
    '&swarhk;': '\u2926',
    '&swarr;': '\u2199',
    '&swarrow;': '\u2199',
    '&swnwar;': '\u292A',
    '&szlig': '\u00DF',
    '&szlig;': '\u00DF',
    '&target;': '\u2316',
    '&tau;': '\u03C4',
    '&tbrk;': '\u23B4',
    '&tcaron;': '\u0165',
    '&tcedil;': '\u0163',
    '&tcy;': '\u0442',
    '&tdot;': '\u20DB',
    '&telrec;': '\u2315',
    '&tfr;': '\uD835\uDD31',
    '&there4;': '\u2234',
    '&therefore;': '\u2234',
    '&theta;': '\u03B8',
    '&thetasym;': '\u03D1',
    '&thetav;': '\u03D1',
    '&thickapprox;': '\u2248',
    '&thicksim;': '\u223C',
    '&thinsp;': '\u2009',
    '&thkap;': '\u2248',
    '&thksim;': '\u223C',
    '&thorn': '\u00FE',
    '&thorn;': '\u00FE',
    '&tilde;': '\u02DC',
    '&times': '\u00D7',
    '&times;': '\u00D7',
    '&timesb;': '\u22A0',
    '&timesbar;': '\u2A31',
    '&timesd;': '\u2A30',
    '&tint;': '\u222D',
    '&toea;': '\u2928',
    '&top;': '\u22A4',
    '&topbot;': '\u2336',
    '&topcir;': '\u2AF1',
    '&topf;': '\uD835\uDD65',
    '&topfork;': '\u2ADA',
    '&tosa;': '\u2929',
    '&tprime;': '\u2034',
    '&trade;': '\u2122',
    '&triangle;': '\u25B5',
    '&triangledown;': '\u25BF',
    '&triangleleft;': '\u25C3',
    '&trianglelefteq;': '\u22B4',
    '&triangleq;': '\u225C',
    '&triangleright;': '\u25B9',
    '&trianglerighteq;': '\u22B5',
    '&tridot;': '\u25EC',
    '&trie;': '\u225C',
    '&triminus;': '\u2A3A',
    '&triplus;': '\u2A39',
    '&trisb;': '\u29CD',
    '&tritime;': '\u2A3B',
    '&trpezium;': '\u23E2',
    '&tscr;': '\uD835\uDCC9',
    '&tscy;': '\u0446',
    '&tshcy;': '\u045B',
    '&tstrok;': '\u0167',
    '&twixt;': '\u226C',
    '&twoheadleftarrow;': '\u219E',
    '&twoheadrightarrow;': '\u21A0',
    '&uArr;': '\u21D1',
    '&uHar;': '\u2963',
    '&uacute': '\u00FA',
    '&uacute;': '\u00FA',
    '&uarr;': '\u2191',
    '&ubrcy;': '\u045E',
    '&ubreve;': '\u016D',
    '&ucirc': '\u00FB',
    '&ucirc;': '\u00FB',
    '&ucy;': '\u0443',
    '&udarr;': '\u21C5',
    '&udblac;': '\u0171',
    '&udhar;': '\u296E',
    '&ufisht;': '\u297E',
    '&ufr;': '\uD835\uDD32',
    '&ugrave': '\u00F9',
    '&ugrave;': '\u00F9',
    '&uharl;': '\u21BF',
    '&uharr;': '\u21BE',
    '&uhblk;': '\u2580',
    '&ulcorn;': '\u231C',
    '&ulcorner;': '\u231C',
    '&ulcrop;': '\u230F',
    '&ultri;': '\u25F8',
    '&umacr;': '\u016B',
    '&uml': '\u00A8',
    '&uml;': '\u00A8',
    '&uogon;': '\u0173',
    '&uopf;': '\uD835\uDD66',
    '&uparrow;': '\u2191',
    '&updownarrow;': '\u2195',
    '&upharpoonleft;': '\u21BF',
    '&upharpoonright;': '\u21BE',
    '&uplus;': '\u228E',
    '&upsi;': '\u03C5',
    '&upsih;': '\u03D2',
    '&upsilon;': '\u03C5',
    '&upuparrows;': '\u21C8',
    '&urcorn;': '\u231D',
    '&urcorner;': '\u231D',
    '&urcrop;': '\u230E',
    '&uring;': '\u016F',
    '&urtri;': '\u25F9',
    '&uscr;': '\uD835\uDCCA',
    '&utdot;': '\u22F0',
    '&utilde;': '\u0169',
    '&utri;': '\u25B5',
    '&utrif;': '\u25B4',
    '&uuarr;': '\u21C8',
    '&uuml': '\u00FC',
    '&uuml;': '\u00FC',
    '&uwangle;': '\u29A7',
    '&vArr;': '\u21D5',
    '&vBar;': '\u2AE8',
    '&vBarv;': '\u2AE9',
    '&vDash;': '\u22A8',
    '&vangrt;': '\u299C',
    '&varepsilon;': '\u03F5',
    '&varkappa;': '\u03F0',
    '&varnothing;': '\u2205',
    '&varphi;': '\u03D5',
    '&varpi;': '\u03D6',
    '&varpropto;': '\u221D',
    '&varr;': '\u2195',
    '&varrho;': '\u03F1',
    '&varsigma;': '\u03C2',
    '&varsubsetneq;': '\u228A\uFE00',
    '&varsubsetneqq;': '\u2ACB\uFE00',
    '&varsupsetneq;': '\u228B\uFE00',
    '&varsupsetneqq;': '\u2ACC\uFE00',
    '&vartheta;': '\u03D1',
    '&vartriangleleft;': '\u22B2',
    '&vartriangleright;': '\u22B3',
    '&vcy;': '\u0432',
    '&vdash;': '\u22A2',
    '&vee;': '\u2228',
    '&veebar;': '\u22BB',
    '&veeeq;': '\u225A',
    '&vellip;': '\u22EE',
    '&verbar;': '\u007C',
    '&vert;': '\u007C',
    '&vfr;': '\uD835\uDD33',
    '&vltri;': '\u22B2',
    '&vnsub;': '\u2282\u20D2',
    '&vnsup;': '\u2283\u20D2',
    '&vopf;': '\uD835\uDD67',
    '&vprop;': '\u221D',
    '&vrtri;': '\u22B3',
    '&vscr;': '\uD835\uDCCB',
    '&vsubnE;': '\u2ACB\uFE00',
    '&vsubne;': '\u228A\uFE00',
    '&vsupnE;': '\u2ACC\uFE00',
    '&vsupne;': '\u228B\uFE00',
    '&vzigzag;': '\u299A',
    '&wcirc;': '\u0175',
    '&wedbar;': '\u2A5F',
    '&wedge;': '\u2227',
    '&wedgeq;': '\u2259',
    '&weierp;': '\u2118',
    '&wfr;': '\uD835\uDD34',
    '&wopf;': '\uD835\uDD68',
    '&wp;': '\u2118',
    '&wr;': '\u2240',
    '&wreath;': '\u2240',
    '&wscr;': '\uD835\uDCCC',
    '&xcap;': '\u22C2',
    '&xcirc;': '\u25EF',
    '&xcup;': '\u22C3',
    '&xdtri;': '\u25BD',
    '&xfr;': '\uD835\uDD35',
    '&xhArr;': '\u27FA',
    '&xharr;': '\u27F7',
    '&xi;': '\u03BE',
    '&xlArr;': '\u27F8',
    '&xlarr;': '\u27F5',
    '&xmap;': '\u27FC',
    '&xnis;': '\u22FB',
    '&xodot;': '\u2A00',
    '&xopf;': '\uD835\uDD69',
    '&xoplus;': '\u2A01',
    '&xotime;': '\u2A02',
    '&xrArr;': '\u27F9',
    '&xrarr;': '\u27F6',
    '&xscr;': '\uD835\uDCCD',
    '&xsqcup;': '\u2A06',
    '&xuplus;': '\u2A04',
    '&xutri;': '\u25B3',
    '&xvee;': '\u22C1',
    '&xwedge;': '\u22C0',
    '&yacute': '\u00FD',
    '&yacute;': '\u00FD',
    '&yacy;': '\u044F',
    '&ycirc;': '\u0177',
    '&ycy;': '\u044B',
    '&yen': '\u00A5',
    '&yen;': '\u00A5',
    '&yfr;': '\uD835\uDD36',
    '&yicy;': '\u0457',
    '&yopf;': '\uD835\uDD6A',
    '&yscr;': '\uD835\uDCCE',
    '&yucy;': '\u044E',
    '&yuml': '\u00FF',
    '&yuml;': '\u00FF',
    '&zacute;': '\u017A',
    '&zcaron;': '\u017E',
    '&zcy;': '\u0437',
    '&zdot;': '\u017C',
    '&zeetrf;': '\u2128',
    '&zeta;': '\u03B6',
    '&zfr;': '\uD835\uDD37',
    '&zhcy;': '\u0436',
    '&zigrarr;': '\u21DD',
    '&zopf;': '\uD835\uDD6B',
    '&zscr;': '\uD835\uDCCF',
    '&zwj;': '\u200D',
    '&zwnj;': '\u200C'
};

// --- chunk-writer.js ------------------------------------------------
/**
 * Collects decoded content in fixed size chunks, so memory follows the number of bytes
 * written rather than the number of writes. Decoders that write many short runs, such as
 * a quoted-printable line or a base64 body that pads every line, would otherwise hold a
 * buffer per run.
 */
class ChunkWriter {
    constructor(maxChunkSize = 100 * 1024) {
        this.maxChunkSize = maxChunkSize;
        // allocated on the first write, a part with no content costs nothing
        this.buffer = null;
        this.bufferPos = 0;
        this.chunks = [];
    }
    writeByte(byte) {
        if (!this.buffer || this.bufferPos >= this.buffer.length) {
            this.flush();
            this.buffer ??= new Uint8Array(this.maxChunkSize);
        }
        this.buffer[this.bufferPos++] = byte;
    }
    // Copied in runs rather than a byte at a time
    writeBytes(bytes, start = 0, end = bytes.length) {
        while (start < end) {
            if (!this.buffer || this.bufferPos >= this.buffer.length) {
                this.flush();
                this.buffer ??= new Uint8Array(this.maxChunkSize);
            }
            const count = Math.min(end - start, this.buffer.length - this.bufferPos);
            this.buffer.set(bytes.subarray(start, start + count), this.bufferPos);
            this.bufferPos += count;
            start += count;
        }
    }
    /**
     * Keeps a buffer the caller hands over and will not touch again. A large one is kept as
     * a chunk of its own instead of being copied, a small one is copied like any other write.
     */
    append(bytes) {
        if (bytes.length >= this.maxChunkSize / 2) {
            this.flush();
            this.chunks.push(bytes);
        }
        else {
            this.writeBytes(bytes);
        }
    }
    flush() {
        if (this.buffer && this.bufferPos) {
            this.chunks.push(this.buffer.slice(0, this.bufferPos));
            this.bufferPos = 0;
        }
    }
    finalize() {
        this.flush();
        // convert an array of arraybuffers into a blob and then back into a single arraybuffer
        return blobToArrayBuffer(new Blob(this.chunks, { type: 'application/octet-stream' }));
    }
}

// --- pass-through-decoder.js ----------------------------------------
// Hands the body through as it is, the line endings included.
//
// The line break is written when the next line arrives, not after each line. The CRLF in
// front of a multipart boundary belongs to the boundary (RFC 2046 5.1.1), so the last line
// of a part ended by a boundary must not carry one.
//
// The break written is the one the line came with. Writing LF for every line rewrote the
// bytes of every 7bit, 8bit and binary part: an attached message lost each of its CR and a
// binary attachment came out corrupted. Text is normalized to LF where it is read as text
// instead, see MimeNode.getTextContent.
//
// The lines of a part, breaks included, are one contiguous range of the message, so the
// decoder keeps the bounds of that range rather than a chunk per line: a Blob of two parts
// per line took 60 times longer to assemble than one of a single part.
class PassThroughDecoder {
    constructor() {
        this.chunks = [];
        this.runBuffer = null;
        this.runStart = 0;
        this.runEnd = 0;
        this.pendingLineBreak = null;
    }
    // Whether the bytes sit in the run's buffer right at the end of the run
    continuesRun(bytes) {
        return bytes.buffer === this.runBuffer && bytes.byteOffset === this.runEnd;
    }
    flushRun() {
        if (this.runBuffer && this.runEnd > this.runStart) {
            this.chunks.push(new Uint8Array(this.runBuffer, this.runStart, this.runEnd - this.runStart));
        }
        this.runBuffer = null;
    }
    update(line, lineBreak) {
        const pending = this.pendingLineBreak;
        if (pending &&
            this.continuesRun(pending) &&
            line.buffer === this.runBuffer &&
            line.byteOffset === this.runEnd + pending.byteLength) {
            // the break follows the run and the line follows the break, so the run grows
            this.runEnd = line.byteOffset + line.byteLength;
        }
        else {
            this.flushRun();
            if (pending) {
                this.chunks.push(pending);
            }
            this.runBuffer = line.buffer;
            this.runStart = line.byteOffset;
            this.runEnd = line.byteOffset + line.byteLength;
        }
        this.pendingLineBreak = lineBreak;
    }
    // A part ended by the end of the message has no boundary to own its final line
    // break, so there it stays content
    finalize(boundaryEnded = false) {
        const pending = this.pendingLineBreak;
        if (!boundaryEnded && pending) {
            if (this.continuesRun(pending)) {
                this.runEnd += pending.byteLength;
            }
            else {
                this.flushRun();
                this.chunks.push(pending);
            }
        }
        this.flushRun();
        // convert an array of arraybuffers into a blob and then back into a single arraybuffer
        return blobToArrayBuffer(new Blob(this.chunks, { type: 'application/octet-stream' }));
    }
}

// --- base64-decoder.js ----------------------------------------------
class Base64Decoder {
    constructor(opts) {
        opts = opts || {};
        this.decoder = opts.decoder || new TextDecoder();
        this.maxChunkSize = 100 * 1024;
        this.output = new ChunkWriter();
        this.remainder = '';
    }
    pushChunk(base64Str) {
        if (base64Str.length) {
            this.output.append(new Uint8Array(decodeBase64(base64Str)));
        }
    }
    flushRemainder() {
        this.pushChunk(this.remainder);
        this.remainder = '';
    }
    update(buffer) {
        let str = this.decoder.decode(buffer).replace(/[^a-zA-Z0-9+/=]+/g, '');
        // '=' terminates a base64 unit. Some mailers pad every line, and erasing the
        // padding used to concatenate the units, which knocked everything after the first
        // embedded pad out of 4 character alignment and decoded it to garbage.
        //
        // Each unit is flushed as soon as its '=' is found. A run of '=' flushes an empty
        // remainder, which writes nothing.
        let start = 0;
        let end;
        while ((end = str.indexOf('=', start)) >= 0) {
            this.remainder += str.substring(start, end);
            this.flushRemainder();
            start = end + 1;
        }
        // the trailing piece is not followed by padding, so it stays open
        this.remainder += str.substring(start);
        if (this.remainder.length >= this.maxChunkSize) {
            const alignedLength = Math.floor(this.remainder.length / 4) * 4;
            this.pushChunk(this.remainder.substring(0, alignedLength));
            this.remainder = this.remainder.substring(alignedLength);
        }
    }
    finalize() {
        this.flushRemainder();
        return this.output.finalize();
    }
}

// --- qp-decoder.js --------------------------------------------------
const CHR_EQUALS = 0x3d;
class QPDecoder {
    constructor() {
        this.output = new ChunkWriter();
        this.pendingLineBreak = null;
    }
    writeLineBreak() {
        if (this.pendingLineBreak) {
            this.output.writeBytes(this.pendingLineBreak);
        }
    }
    // Quoted-printable source is 7 bit by definition, so it is decoded byte by byte and
    // the result is handed on as bytes. Running the body charset over the encoded source
    // instead corrupted every part whose charset was not ASCII compatible: the same
    // content that decoded correctly in base64 came out as mojibake in quoted-printable.
    //
    // As in PassThroughDecoder, a hard line break is only written once the next line
    // arrives, so the CRLF that belongs to a following boundary is not decoded as content,
    // and the break written is the one the line came with.
    update(line, lineBreak) {
        this.writeLineBreak();
        let len = line.length;
        // Trailing white space on an encoded line was added in transit and is deleted (RFC
        // 2045 6.7 rule 3). Before the soft line break is looked for, since the `=` it
        // consists of may have had white space appended the same way
        while (len > 0 && isWsp(line[len - 1])) {
            len--;
        }
        // a line ending in '=' is a soft line break, the newline is not part of the content
        const softBreak = len > 0 && line[len - 1] === CHR_EQUALS;
        if (softBreak) {
            len--;
        }
        let literalStart = 0;
        for (let i = 0; i < len; i++) {
            if (line[i] !== CHR_EQUALS || i + 2 >= len) {
                continue;
            }
            const high = hexNibble(line[i + 1]);
            const low = hexNibble(line[i + 2]);
            if (high < 0 || low < 0) {
                // not a valid escape sequence, keep it as literal text
                continue;
            }
            this.output.writeBytes(line, literalStart, i);
            this.output.writeByte((high << 4) | low);
            i += 2;
            literalStart = i + 1;
        }
        this.output.writeBytes(line, literalStart, len);
        this.pendingLineBreak = softBreak ? null : lineBreak;
    }
    // see PassThroughDecoder.finalize
    finalize(boundaryEnded = false) {
        if (!boundaryEnded) {
            this.writeLineBreak();
        }
        return this.output.finalize();
    }
}

// --- boundary-stack.js ----------------------------------------------
// The line is decoded only to look it up. A boundary is ASCII (see MimeNode), and UTF-8
// decodes ASCII bytes as themselves and any other byte to a non-ASCII character, so a line
// that is not byte for byte a boundary never decodes to one. ignoreBOM keeps a leading
// EF BB BF from being dropped, which would let `--<BOM>abc` read as `--abc`
const keyDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
/**
 * The boundaries of the open multipart parts, indexed by value.
 *
 * A line is looked up instead of being compared against every open boundary in turn. With a
 * scan, a line sharing a long prefix with every boundary of a deeply nested message cost
 * the nesting depth times that prefix to reject, so a message of n such lines cost depth
 * times its size. A lookup costs the length of the line, whatever the depth.
 */
class BoundaryStack {
    constructor() {
        this.byValue = new Map();
        this.byNode = new Map();
        // how many open boundaries have each byte length, so that a line of a length no boundary
        // can match is turned away before it is decoded. A boundary is ASCII, so its string
        // length is its byte length
        this.lengths = new Map();
        this.nextOrder = 0;
    }
    get size() {
        return this.byNode.size;
    }
    /** Registers the boundary of a multipart node, which must be ASCII and not end in whitespace */
    push(value, node) {
        const boundary = { value, node, order: this.nextOrder++ };
        const list = this.byValue.get(value);
        if (list) {
            list.push(boundary);
        }
        else {
            this.byValue.set(value, [boundary]);
        }
        this.byNode.set(node, boundary);
        this.lengths.set(value.length, (this.lengths.get(value.length) || 0) + 1);
    }
    /** Removes the boundary of a node, if it registered one */
    remove(node) {
        const boundary = this.byNode.get(node);
        if (!boundary) {
            return;
        }
        this.byNode.delete(node);
        const list = this.byValue.get(boundary.value);
        if (list.length === 1) {
            this.byValue.delete(boundary.value);
        }
        else {
            list.splice(list.indexOf(boundary), 1);
        }
        const count = this.lengths.get(boundary.value.length) - 1;
        if (count) {
            this.lengths.set(boundary.value.length, count);
        }
        else {
            this.lengths.delete(boundary.value.length);
        }
    }
    /**
     * Finds the boundary a line delimits or terminates: `--` and the boundary, optionally
     * `--`, then optional whitespace (RFC 2046 5.1.1). When the line matches more than one
     * open boundary, the outermost wins: a boundary may not appear inside the parts it
     * delimits, and when a nested multipart declares the boundary of an ancestor anyway, or
     * one that the ancestor's terminator matches, the ancestor's delimiter is the one every
     * other parser reads the line as. Reading it as the nested one instead gave the nested
     * multipart parts, and an attachment after the ancestor's terminator, that Python and
     * Go leave in the epilogue.
     */
    match(line) {
        if (!this.byNode.size || line.length <= 2 || line[0] !== 0x2d || line[1] !== 0x2d) {
            return null;
        }
        // A boundary does not end in whitespace, so the trailing whitespace is never part of it
        let end = line.length;
        while (end > 2 && isWsp(line[end - 1])) {
            end--;
        }
        const delimiter = this.find(line, end);
        const terminator = end - 2 >= 2 && line[end - 1] === 0x2d && line[end - 2] === 0x2d ? this.find(line, end - 2) : null;
        if (terminator && (!delimiter || terminator.order < delimiter.order)) {
            return { node: terminator.node, isTerminator: true };
        }
        return delimiter ? { node: delimiter.node, isTerminator: false } : null;
    }
    // the outermost open boundary equal to line[2..end]
    find(line, end) {
        if (!this.lengths.has(end - 2)) {
            return null;
        }
        const list = this.byValue.get(keyDecoder.decode(line.subarray(2, end)));
        return list ? list[0] : null;
    }
}

// --- otp-token.js ---------------------------------------------------
// Parser for the OTP-Token header of draft-goto-otp-token-01, an Internet-Draft that expires
// on 25 March 2027. By then check for a newer revision of the draft or a published RFC, the
// header name and its parameters are still open questions in the draft.
//
// The header value is a structured field item (RFC 9651): a String holding the passcode,
// with an `origin` parameter naming the origin the passcode is bound to. Unknown parameters
// are ignored, but they still have to be valid, otherwise the whole field fails to parse.
// RFC 9651 lets a parser limit the size of a field. A passcode and an origin take well under
// a kilobyte, the limit keeps the regular expressions below away from megabyte inputs
const MAX_FIELD_LENGTH = 8192;
// The bare item syntax of RFC 9651 4.2.3.1, keyed by the first character of the item. An
// Integer has at most 15 digits, a Decimal at most 12 before and 1 to 3 after the dot, and a
// Date is an Integer. Whatever follows a match is left for the caller, which only accepts a
// parameter separator or the end of the field, so a 16th digit or a 4th decimal fails there
const NUMBER = /-?(?:\d{1,12}\.\d{1,3}|\d{1,15})/y;
const STRING = /"((?:[\x20\x21\x23-\x5b\x5d-\x7e]|\\["\\])*)"/y;
const TOKEN = /[A-Za-z*][!#$%&'*+\-.^_`|~0-9A-Za-z:/]*/y;
const BYTE_SEQUENCE = /:[A-Za-z0-9+/=]*:/y;
const BOOLEAN = /\?[01]/y;
const DATE = /@-?\d{1,15}/y;
const DISPLAY_STRING = /%"((?:[\x20\x21\x23\x24\x26-\x7e]|%[0-9a-f]{2})*)"/y;
const KEY = /[a-z*][a-z0-9_\-.*]*/y;
const SPACES = / */y;
// Matches the sticky expression at the cursor and moves past it, returns null if it does not match
function match(cursor, re) {
    re.lastIndex = cursor.pos;
    const result = re.exec(cursor.input);
    if (result) {
        cursor.pos = re.lastIndex;
    }
    return result;
}
// RFC 9651 4.2.5, returns the unescaped String or null if there is no valid String at the cursor
function parseString(cursor) {
    const result = match(cursor, STRING);
    return result && result[1].replace(/\\(["\\])/g, '$1');
}
// RFC 9651 4.2.10. The percent encoded bytes must be valid UTF-8, which decodeURIComponent
// checks as it decodes them
function isDisplayString(cursor) {
    const result = match(cursor, DISPLAY_STRING);
    if (!result) {
        return false;
    }
    try {
        decodeURIComponent(result[1]);
        return true;
    }
    catch {
        return false;
    }
}
// RFC 9651 4.2.3.1. Returns the value of a String, true for any other valid bare item and
// false for an invalid one
function parseBareItem(cursor) {
    const c = cursor.input.charAt(cursor.pos);
    switch (c) {
        case '"':
            return parseString(cursor) ?? false;
        case ':':
            return !!match(cursor, BYTE_SEQUENCE);
        case '?':
            return !!match(cursor, BOOLEAN);
        case '@':
            return !!match(cursor, DATE);
        case '%':
            return isDisplayString(cursor);
    }
    return !!match(cursor, c === '-' || (c >= '0' && c <= '9') ? NUMBER : TOKEN);
}
/**
 * Parses a structured field item (RFC 9651 4.2 with field_type "item") whose bare item is a
 * String. Returns the String and the String parameters, or null if the value does not parse
 * or the bare item is of another type. A parameter of any other type is stored as true
 * @internal
 */
function parseStringItem(value) {
    const cursor = { input: value, pos: 0 };
    match(cursor, SPACES);
    const item = parseString(cursor);
    if (item === null) {
        return null;
    }
    // a later parameter with the same key replaces the earlier one
    const params = new Map();
    while (cursor.input[cursor.pos] === ';') {
        cursor.pos++;
        match(cursor, SPACES);
        const key = match(cursor, KEY);
        if (!key) {
            return null;
        }
        let paramValue = true;
        if (cursor.input[cursor.pos] === '=') {
            cursor.pos++;
            paramValue = parseBareItem(cursor);
            if (paramValue === false) {
                return null;
            }
        }
        params.set(key[0], paramValue);
    }
    match(cursor, SPACES);
    return cursor.pos === cursor.input.length ? { value: item, params } : null;
}
/**
 * Checks that the origin is the canonical ASCII serialization of a potentially trustworthy
 * origin, as the draft requires: https, or http on a loopback host
 * @internal
 */
function isOtpOrigin(origin) {
    let url;
    try {
        url = new URL(origin);
    }
    catch {
        return false;
    }
    // the URL parser lowercases the host, converts it to punycode and drops the default port, so
    // a value that is not canonical, or has a path, userinfo or an opaque origin, does not match
    // its own origin. The WHATWG parser lets characters such as a quote or a brace into a host,
    // which the origin grammar (RFC 6454) does not allow, so only a DNS name, an IPv4 address or a
    // bracketed IPv6 address is accepted
    if (url.origin !== origin || !/^([a-z0-9_-]+\.)*[a-z0-9_-]+$|^\[[0-9a-f:.]+\]$/.test(url.hostname)) {
        return false;
    }
    const isLoopback = /^(localhost|.+\.localhost|127(\.\d+){3}|\[::1\])$/.test(url.hostname);
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback);
}
/**
 * Returns the one-time passcode from the OTP-Token header of a message, following the
 * receiver steps of the draft (section 3.2), or undefined if the message has no valid one.
 * Only the header of the message itself counts, the draft has an OTP-Token in a MIME part
 * ignored, and more than one OTP-Token header makes the message have none
 * @internal
 */
function getOtp(headers) {
    let otpHeader;
    for (const header of headers) {
        if (header.key === 'otp-token') {
            if (otpHeader) {
                return undefined;
            }
            otpHeader = header;
        }
    }
    if (!otpHeader || otpHeader.value.length > MAX_FIELD_LENGTH) {
        return undefined;
    }
    // the header value is already unfolded, which the draft requires before the structured field parse
    const parsed = parseStringItem(otpHeader.value);
    const origin = parsed?.params.get('origin');
    // an empty passcode is valid syntax, but there is nothing in it to fill in
    if (!parsed?.value || typeof origin !== 'string' || !isOtpOrigin(origin)) {
        return undefined;
    }
    return { code: parsed.value, origin };
}

// --- text-format.js -------------------------------------------------
// What a numeric character reference to the C1 control range stands for, per the HTML
// numeric character reference end state: the windows-1252 character at that byte. This is
// how Outlook and Word write their curly quotes and dashes (`&#146;`, `&#150;`), and the
// raw control character they decoded to otherwise is invisible in the text.
const C1_ENTITY_REPLACEMENTS = new Map([
    [0x80, 0x20ac],
    [0x82, 0x201a],
    [0x83, 0x0192],
    [0x84, 0x201e],
    [0x85, 0x2026],
    [0x86, 0x2020],
    [0x87, 0x2021],
    [0x88, 0x02c6],
    [0x89, 0x2030],
    [0x8a, 0x0160],
    [0x8b, 0x2039],
    [0x8c, 0x0152],
    [0x8e, 0x017d],
    [0x91, 0x2018],
    [0x92, 0x2019],
    [0x93, 0x201c],
    [0x94, 0x201d],
    [0x95, 0x2022],
    [0x96, 0x2013],
    [0x97, 0x2014],
    [0x98, 0x02dc],
    [0x99, 0x2122],
    [0x9a, 0x0161],
    [0x9b, 0x203a],
    [0x9c, 0x0153],
    [0x9e, 0x017e],
    [0x9f, 0x0178]
]);
function decodeHTMLEntities(str) {
    return str.replace(/&(#\d+|#x[a-f0-9]+|[a-z]+\d*);?/gi, (match, entity) => {
        if (typeof htmlEntities[match] === 'string') {
            return htmlEntities[match];
        }
        if (entity.charAt(0) !== '#' || match.charAt(match.length - 1) !== ';') {
            // keep as is, invalid or unknown sequence
            return match;
        }
        let codePoint;
        // The pattern matches the marker in either case, so the test has to as well. Reading
        // `&#X41;` as decimal gave NaN, which passes every range check below and comes out
        // of String.fromCharCode as a NUL character
        if (entity.charAt(1).toLowerCase() === 'x') {
            codePoint = parseInt(entity.slice(2), 16);
        }
        else {
            codePoint = parseInt(entity.slice(1), 10);
        }
        let output = '';
        // A NUL reference, a surrogate or a code point out of range is a replacement
        // character, like in a browser. A NUL in particular would truncate the text in
        // whatever reads it next
        if (codePoint === 0 || (codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
            return '\ufffd';
        }
        codePoint = C1_ENTITY_REPLACEMENTS.get(codePoint) ?? codePoint;
        if (codePoint > 0xffff) {
            codePoint -= 0x10000;
            output += String.fromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
            codePoint = 0xdc00 | (codePoint & 0x3ff);
        }
        output += String.fromCharCode(codePoint);
        return output;
    });
}
// two uppercase hex digits of a value below 256
const hexByte = (value) => value.toString(16).toUpperCase().padStart(2, '0');
function escapeHtml(str) {
    return str.trim().replace(/[<>"'?&]/g, c => '&#x' + hexByte(c.charCodeAt(0)) + ';');
}
// The characters an address may carry into a mailto URL as they are (RFC 6068 2:
// unreserved and some-delims). Anything else is percent encoded: a `?` or `&` starts the
// header fields of the URL, so `help@bank.example?cc=attacker@evil.example&body=…` given
// as the address of a forwarded message opened a compose window with a Cc and a body the
// sender chose once the link was clicked. Html escaping alone does not help, the browser
// decodes the entities back before it reads the URL
const MAILTO_UNSAFE = /[^A-Za-z0-9\-._~!$'()*+,;:@]+/g;
// the percent encoded form of every byte, so that an encoded run allocates nothing per byte
const PERCENT_ENCODED = Array.from({ length: 256 }, (_, byte) => '%' + hexByte(byte));
// Each unsafe run is encoded whole and the result is built flat by replace. Appended one
// character at a time it was a cons string of a node per character, which escapeHtml then
// flattened: a long address of percent signs in a forwarded header held some sixty bytes
// of heap per byte of it until then
function encodeMailto(address) {
    return address.replace(MAILTO_UNSAFE, run => Array.from(textEncoder.encode(run), byte => PERCENT_ENCODED[byte]).join(''));
}
function textToHtml(str) {
    let html = escapeHtml(str).replace(/\n/g, '<br />');
    return '<div>' + html + '</div>';
}
// htmlToText strips tags with regexes like `<br\b[^>]*>` and `<!--.*?-->`. Handed to
// String#replace as they are, the engine tries every candidate in turn and a candidate
// that does not close scans on to the next `>` or the end of the input before giving up,
// so an html part holding many unclosed `<`, `<a ` or `<!--` took seconds to minutes to
// convert. The helpers below give the same results in linear time. They run on text
// without line terminators, see htmlToText, so `.` matches every character of it.
/**
 * Returns a function that finds the next match of a global regex at or after a position.
 *
 * Callers only ever ask about positions that move forward, so a match stays the answer
 * until a position passes it, and no match stays the answer for good. That way every part
 * of the string is scanned once, however many times it is asked about.
 *
 * @param str String to search
 * @param regex Global regex to look for
 * @return `pos => match` of the next match, or null if there is none
 */
function createFinder(str, regex) {
    let searchedFrom = Infinity;
    let found = null;
    return pos => {
        if (pos < searchedFrom || (found && pos > found.index)) {
            regex.lastIndex = pos;
            found = regex.exec(str);
            searchedFrom = pos;
        }
        return found;
    };
}
/**
 * Runs `process` on the text up to and including the last `>` and appends the rest as is,
 * for a pass whose every match ends at a `>`. The text after the last `>` can never match
 * and is where a failing pattern rescans to the end from each candidate.
 *
 * @param str String to process
 * @param process The pass to run
 * @return Processed string
 */
function throughLastTag(str, process) {
    const end = str.lastIndexOf('>') + 1;
    return process(str.slice(0, end)) + str.slice(end);
}
/**
 * `str.replace(pattern, replacement)` for a pattern shaped like `<tag\b[^>]*>`.
 *
 * Such a pattern only fails at a candidate that has no `>` after it, so the text after
 * the last `>` can never match and is where every rescan happened. Leaving it out keeps
 * the native replace, and its speed, for everything else.
 *
 * @param str String to process
 * @param pattern Global regex that ends on the first `>` after its start
 * @param replacement Replacement text
 * @return Processed string
 */
function replaceClosedTags(str, pattern, replacement) {
    return throughLastTag(str, head => head.replace(pattern, replacement));
}
/**
 * `str.replace(pattern, replacement)` for a tag pattern that may fail even when a `>`
 * follows, like `<a\b[^>]*href...>`, or that runs on past its `>`.
 *
 * A candidate with no `>` after it ends the search, since no later candidate can close
 * either. A candidate that does not match skips every other candidate before the same
 * `>`, since those see the same tag body and fail the same way.
 *
 * @param str String to process
 * @param prefix Global regex for the start of a candidate, which can not contain `>`
 * @param pattern The whole pattern as a sticky regex
 * @param replacement Function given the match and its groups
 * @return Processed string
 */
function replaceTags(str, prefix, pattern, replacement) {
    const parts = [];
    // everything before this index is already in parts
    let copied = 0;
    let searchFrom = 0;
    while (true) {
        prefix.lastIndex = searchFrom;
        const candidate = prefix.exec(str);
        if (!candidate) {
            break;
        }
        const start = candidate.index;
        // Looked up before the pattern runs. The engine finds out on its own that there is
        // no `>` to close on, but only after it has retried the tail of the pattern at every
        // `href` in the rest of the input and rescanned to the end each time, which made an
        // html part of many unclosed `<a href` tags quadratic to convert
        const gt = str.indexOf('>', start);
        if (gt < 0) {
            break;
        }
        pattern.lastIndex = start;
        const match = pattern.exec(str);
        if (!match) {
            searchFrom = gt + 1;
            continue;
        }
        parts.push(str.slice(copied, start), replacement(...match));
        copied = searchFrom = start + match[0].length;
    }
    parts.push(str.slice(copied));
    return parts.join('');
}
/**
 * `str.replace(pattern, replacement)` for a pattern like `<!--.*?-->` or
 * `<script\b[^>]*>.*?<\/script\b[^>]*>`, ie. an opener and a closer, either of which may
 * continue with `[^>]*>`, and a lazy `.*?` between them. The engine rescans to the end of
 * the input for every opener that is not closed.
 *
 * @param str String to process
 * @param open Global regex for the opener
 * @param openToGt Whether the opener continues with `[^>]*>`
 * @param close Global regex for the closer
 * @param closeToGt Whether the closer continues with `[^>]*>`
 * @param replacement Replacement text
 * @return Processed string
 */
function replaceBlocks(str, open, openToGt, close, closeToGt, replacement) {
    const nextGt = createFinder(str, />/g);
    const nextClose = createFinder(str, close);
    const parts = [];
    let copied = 0;
    let searchFrom = 0;
    while (true) {
        open.lastIndex = searchFrom;
        const opener = open.exec(str);
        if (!opener) {
            break;
        }
        const start = opener.index;
        searchFrom = start + 1;
        // where the lazy `.*?` starts
        let from = start + opener[0].length;
        if (openToGt) {
            const gt = nextGt(from);
            if (!gt) {
                // neither this opener nor any later one can close
                break;
            }
            from = gt.index + 1;
        }
        const closer = nextClose(from);
        if (!closer) {
            // no closer follows this opener, so none follows a later one either
            break;
        }
        let end = closer.index + closer[0].length;
        if (closeToGt) {
            const gt = nextGt(end);
            if (!gt) {
                // this is the first closer after the opener, and any other one comes
                // later, so none of them is followed by `>`
                break;
            }
            end = gt.index + 1;
        }
        parts.push(str.slice(copied, start), replacement);
        copied = searchFrom = end;
    }
    parts.push(str.slice(copied));
    return parts.join('');
}
/**
 * `str.replace(pattern, '')` for `^.*<tag\b[^>]*>`, ie. drops everything up to and
 * including the last such tag.
 *
 * @param str String to process
 * @param prefix Global regex for the start of the tag, which can not contain `>`
 * @return Processed string
 */
function stripThroughLastTag(str, prefix) {
    // `[^>]*>` needs a `>` after the tag
    const limit = str.lastIndexOf('>');
    let last = -1;
    prefix.lastIndex = 0;
    let match;
    while ((match = prefix.exec(str)) && match.index < limit) {
        last = match.index;
    }
    return last < 0 ? str : str.slice(str.indexOf('>', last) + 1);
}
/**
 * `str.replace(pattern, '')` for `<tag\b[^>]*>.*$`, ie. drops the first such tag that is
 * closed, and everything after it.
 *
 * @param str String to process
 * @param prefix Global regex for the start of the tag, which can not contain `>`
 * @return Processed string
 */
function stripFromFirstTag(str, prefix) {
    prefix.lastIndex = 0;
    const match = prefix.exec(str);
    return match && match.index < str.lastIndexOf('>') ? str.slice(0, match.index) : str;
}
function htmlToText(str) {
    // Tags are not processed across lines, so every line terminator, every character `.`
    // does not match, becomes a placeholder first. Only `\r?\n` used to, and the patterns
    // below do not cross the others either: `.*?` stops at a bare CR or a U+2028, so a
    // script whose body held one was not removed as a block, its tags were stripped as
    // tags and the script itself landed in the text, which a filter reading the text then
    // took for content
    str = str.replace(/\r\n|[\n\r\u2028\u2029]/g, '\u0001');
    str = replaceBlocks(str, /<!--/g, false, /-->/g, false, ' ');
    str = replaceClosedTags(str, /<br\b[^>]*>/gi, '\n');
    str = replaceClosedTags(str, /<\/?(p|div|table|tr|td|th)\b[^>]*>/gi, '\n\n');
    str = replaceBlocks(str, /<script\b/gi, true, /<\/script\b/gi, true, ' ');
    // a stylesheet in the body is no text of the message either
    str = replaceBlocks(str, /<style\b/gi, true, /<\/style\b/gi, true, ' ');
    str = stripThroughLastTag(str, /<body\b/gi);
    str = stripThroughLastTag(str, /<\/head\b/gi);
    str = stripThroughLastTag(str, /<!doctype\b/gi);
    str = stripFromFirstTag(str, /<\/body\b/gi);
    str = stripFromFirstTag(str, /<\/html\b/gi);
    // The href capture also matches `>`, so after a link a run with no whitespace or quote
    // is taken to the end of the input and given back one character at a time, retrying
    // `[^>]*>` to the end from each, which is quadratic when no `>` follows
    str = throughLastTag(str, head => replaceTags(head, /<a\b/gi, /<a\b[^>]*href\s*=\s*["']?([^\s"']+)[^>]*>/iy, (match, href) => ` (${href}) `));
    str = replaceClosedTags(str, /<\/?(span|em|i|strong|b|u|a)\b[^>]*>/gi, '');
    // the whitespace after the tag may run on past the last `>`
    str = replaceTags(str, /<li\b/gi, /<li\b[^>]*>[\n\u0001\s]*/iy, () => '* ');
    str = replaceClosedTags(str, /<hr\b[^>]*>/g, '\n-------------\n');
    str = replaceClosedTags(str, /<[^>]*>/g, ' ');
    str = str
        // convert linebreak placeholders back to newlines
        .replace(/\u0001/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/^\s+$/gm, '')
        .replace(/\n\n+/g, '\n\n')
        .replace(/^\n+/, '\n')
        .replace(/\n+$/, '\n');
    str = decodeHTMLEntities(str);
    return str;
}
// The formatter the dates of forwarded headers are rendered with, created on first use.
// One instance serves every date, a formatter is immutable. Constructing one per rendered
// header held some 30 KB of ICU state outside the V8 heap for each, so a message of a few
// thousand dated forwards took hundreds of megabytes that no heap limit saw, and several
// times the time of the same message without the dates
let dateFormatter = null;
// A message date is not always a date. PostalMime keeps the raw header value when it does
// not parse, and Intl.DateTimeFormat throws a RangeError on that, which used to reject the
// whole parse of any message carrying a forwarded copy with a broken Date header.
function formatDate(date) {
    if (typeof Intl === 'undefined') {
        return date;
    }
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
        return date;
    }
    dateFormatter ??= new Intl.DateTimeFormat('default', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });
    return dateFormatter.format(parsed);
}
function formatTextAddress(address) {
    return (address.name ? [address.name, `<${address.address}>`] : [address.address]).join(' ');
}
function formatTextAddresses(addresses) {
    let parts = [];
    let processAddress = (address, partCounter) => {
        if (partCounter) {
            parts.push(', ');
        }
        if (address.group) {
            let groupStart = `${address.name}:`;
            let groupEnd = `;`;
            parts.push(groupStart);
            address.group.forEach(processAddress);
            parts.push(groupEnd);
        }
        else {
            parts.push(formatTextAddress(address));
        }
    };
    addresses.forEach(processAddress);
    return parts.join('');
}
function formatHtmlAddress(address) {
    return `<a href="mailto:${escapeHtml(encodeMailto(address.address))}" class="postal-email-address">${escapeHtml(address.name || `<${address.address}>`)}</a>`;
}
function formatHtmlAddresses(addresses) {
    let parts = [];
    let processAddress = (address, partCounter) => {
        if (partCounter) {
            parts.push('<span class="postal-email-address-separator">, </span>');
        }
        if (address.group) {
            let groupStart = `<span class="postal-email-address-group">${escapeHtml(address.name)}:</span>`;
            let groupEnd = `<span class="postal-email-address-group">;</span>`;
            parts.push(groupStart);
            address.group.forEach(processAddress);
            parts.push(groupEnd);
        }
        else {
            parts.push(formatHtmlAddress(address));
        }
    };
    addresses.forEach(processAddress);
    return parts.join(' ');
}
function foldLines(str, lineLength, afterSpace) {
    str = (str || '').toString();
    lineLength = lineLength || 76;
    let pos = 0, len = str.length, result = '', line, match;
    while (pos < len) {
        line = str.slice(pos, pos + lineLength);
        if (line.length < lineLength) {
            result += line;
            break;
        }
        if ((match = line.match(/^[^\n\r]*(\r?\n|\r)/))) {
            line = match[0];
            result += line;
            pos += line.length;
            continue;
        }
        else if ((match = line.match(/(\s+)[^\s]*$/)) &&
            match[0].length - (afterSpace ? (match[1] || '').length : 0) < line.length) {
            line = line.slice(0, line.length - (match[0].length - (afterSpace ? (match[1] || '').length : 0)));
        }
        else if ((match = str.slice(pos + line.length).match(/^[^\s]+(\s*)/))) {
            line = line + match[0].slice(0, match[0].length - (!afterSpace ? (match[1] || '').length : 0));
        }
        result += line;
        pos += line.length;
        if (pos < len) {
            result += '\r\n';
        }
    }
    return result;
}
function formatTextHeader(message) {
    let rows = [];
    if (message.from) {
        // through the plural formatter, because `From:` may hold RFC 5322 group syntax
        // and a group has no address of its own
        rows.push({ key: 'From', val: formatTextAddresses([message.from]) });
    }
    if (message.subject) {
        rows.push({ key: 'Subject', val: message.subject });
    }
    if (message.date) {
        rows.push({ key: 'Date', val: formatDate(message.date) });
    }
    if (message.to && message.to.length) {
        rows.push({ key: 'To', val: formatTextAddresses(message.to) });
    }
    if (message.cc && message.cc.length) {
        rows.push({ key: 'Cc', val: formatTextAddresses(message.cc) });
    }
    if (message.bcc && message.bcc.length) {
        rows.push({ key: 'Bcc', val: formatTextAddresses(message.bcc) });
    }
    // Align keys and values by adding space between these two
    // Also make sure that the separator line is as long as the longest line
    // Should end up with something like this:
    /*
    -----------------------------
    From:    xx xx <xxx@xxx.com>
    Subject: Example Subject
    Date:    16/02/2021, 02:57:06
    To:      not@found.com
    -----------------------------
    */
    let maxKeyLength = rows
        .map(r => r.key.length)
        .reduce((acc, cur) => {
        return cur > acc ? cur : acc;
    }, 0);
    const lines = rows.flatMap(row => {
        let sepLen = maxKeyLength - row.key.length;
        let prefix = `${row.key}: ${' '.repeat(sepLen)}`;
        let emptyPrefix = `${' '.repeat(row.key.length + 1)} ${' '.repeat(sepLen)}`;
        let foldedLines = foldLines(row.val, 80, true)
            .split(/\r?\n/)
            .map(line => line.trim());
        return foldedLines.map((line, i) => `${i ? emptyPrefix : prefix}${line}`);
    });
    let maxLineLength = lines
        .map(r => r.length)
        .reduce((acc, cur) => {
        return cur > acc ? cur : acc;
    }, 0);
    let lineMarker = '-'.repeat(maxLineLength);
    let template = `
${lineMarker}
${lines.join('\n')}
${lineMarker}
`;
    return template;
}
function formatHtmlHeader(message) {
    let rows = [];
    if (message.from) {
        rows.push(
        // through the plural formatter, because `From:` may hold RFC 5322 group syntax
        // and a group has no address of its own
        `<div class="postal-email-header-key">From</div><div class="postal-email-header-value">${formatHtmlAddresses([message.from])}</div>`);
    }
    if (message.subject) {
        rows.push(`<div class="postal-email-header-key">Subject</div><div class="postal-email-header-value postal-email-header-subject">${escapeHtml(message.subject)}</div>`);
    }
    if (message.date) {
        rows.push(`<div class="postal-email-header-key">Date</div><div class="postal-email-header-value postal-email-header-date" data-date="${escapeHtml(message.date)}">${escapeHtml(formatDate(message.date))}</div>`);
    }
    if (message.to && message.to.length) {
        rows.push(`<div class="postal-email-header-key">To</div><div class="postal-email-header-value">${formatHtmlAddresses(message.to)}</div>`);
    }
    if (message.cc && message.cc.length) {
        rows.push(`<div class="postal-email-header-key">Cc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.cc)}</div>`);
    }
    if (message.bcc && message.bcc.length) {
        rows.push(`<div class="postal-email-header-key">Bcc</div><div class="postal-email-header-value">${formatHtmlAddresses(message.bcc)}</div>`);
    }
    let template = `<div class="postal-email-header">${rows.length ? '<div class="postal-email-header-row">' : ''}${rows.join('</div>\n<div class="postal-email-header-row">')}${rows.length ? '</div>' : ''}</div>`;
    return template;
}

// --- mime-node.js ---------------------------------------------------
// Header lines are decoded with ignoreBOM so that a U+FEFF at the start of a line is
// kept as a character instead of being swallowed. A stripped BOM turns a line a strict
// parser skips into a genuine header, which is how a second `From:` gets smuggled past
// anything that inspects the raw message.
//
// Raw 8-bit header text is UTF-8 (RFC 6532), and a line that is not is legacy mail in a
// single byte charset, read as windows-1252 rather than as replacement characters, see
// decodeUtf8OrWindows1252.
const headerDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
// number of pieces decodeFlowedText collects before joining them
const FLOWED_JOIN_INTERVAL = 4096;
// What a header line costs to hold, at the least. The decoded line, its entry in
// rawHeaderLines and the parsed header come to a few hundred bytes for a line of one
// byte, so two million such lines stayed inside maxHeadersSize while they held a few
// hundred megabytes. Counting every line for at least this much keeps the memory in step
// with the budget, 32768 lines at the default 2 MiB.
const HEADER_LINE_MIN_COST = 64;
// Trims the SP and HTAB around a field body, the only whitespace RFC 5322 reads as padding
// there. String.prototype.trim also strips U+00A0, U+FEFF, U+2028 and the rest of the
// Unicode spaces, which a raw UTF-8 header (RFC 6532) may carry as content.
//
// An index scan rather than `/^[ \t]+|[ \t]+$/g`, which retries the trailing branch at
// every position of a blank run that is followed by other text, so a single header with
// a long run of spaces in the middle took seconds to trim.
const trimWsp = (str) => {
    let start = 0;
    let end = str.length;
    while (start < end && isWsp(str.charCodeAt(start))) {
        start++;
    }
    while (end > start && isWsp(str.charCodeAt(end - 1))) {
        end--;
    }
    return str.slice(start, end);
};
// The start of a header field, the shape Python's header pattern reads: a field name of
// printable ASCII other than the colon (RFC 5322 3.6.8 ftext), an empty one included, and
// the colon itself, with the whitespace in between that processHeaders tolerates as well,
// or the `From ` of an mbox separator line, which every reader lets through
const FIELD_START = /^(?:From |[!-9;-~]*[ \t]*:)/;
// Headers that decide how this part's body is read, see processHeaders
const CONTENT_HEADERS = new Set([
    'content-type',
    'content-transfer-encoding',
    'content-disposition',
    'content-id',
    'content-description'
]);
class MimeNode {
    constructor(options) {
        this.options = options;
        this.postalMime = options.postalMime;
        // Counted across the whole message like the header size, nested message/rfc822
        // parts included, so that neither a multipart nor a forward can carry the budget
        // again for every part it declares
        const limits = this.postalMime.limits;
        this.postalMime.counters.partCount++;
        if (this.postalMime.counters.partCount > limits.maxPartCount) {
            throw createError('EMAXPARTCOUNT', `Maximum MIME part count of ${limits.maxPartCount} parts exceeded`);
        }
        this.childNodes = [];
        // Cursor into childNodes for finalizeChildNodes. Every new part of a multipart
        // finalizes its parent's children, so re-walking the whole array each time is
        // quadratic in the number of parts.
        this.finalizedChildCount = 0;
        if (options.parentNode) {
            this.parentNode = options.parentNode;
            this.depth = this.parentNode.depth + 1;
            if (this.depth > limits.maxNestingDepth) {
                throw createError('EMAXNESTINGDEPTH', `Maximum MIME nesting depth of ${limits.maxNestingDepth} levels exceeded`);
            }
            options.parentNode.childNodes.push(this);
        }
        else {
            this.depth = 0;
        }
        this.state = 'header';
        this.headerLines = [];
        // RFC 2046 Section 5.1.5: multipart/digest defaults to message/rfc822
        const parentMultipartType = options.parentMultipartType || null;
        const defaultContentType = parentMultipartType === 'digest' ? 'message/rfc822' : 'text/plain';
        // The value is replaced by the first matching header and the rest is derived
        // from it, see the CONTENT_HEADERS pass in processHeaders
        this.contentType = {
            value: defaultContentType,
            parsed: { value: defaultContentType, params: {} },
            multipart: false
        };
        this.contentTransferEncoding = {
            value: '8bit',
            encoding: ''
        };
        this.contentDisposition = {
            value: '',
            parsed: { value: '', params: {} }
        };
        this.headers = [];
        this.rawHeaderLines = [];
        this.contentDecoder = null;
        this.content = null;
    }
    // `transferEncoding` is the lowercased token of the header, see processHeaders. It is
    // matched whole: `x-base64` or `7bit-base64` is no encoding Python or mailparser
    // decode, and decoding it here rendered as markup a body every other reader keeps as
    // inert base64
    setupContentDecoder(transferEncoding) {
        if (transferEncoding === 'base64') {
            this.contentDecoder = new Base64Decoder();
        }
        else if (transferEncoding === 'quoted-printable') {
            this.contentDecoder = new QPDecoder();
        }
        else {
            this.contentDecoder = new PassThroughDecoder();
        }
    }
    // `boundaryEnded` tells that the part was ended by a multipart boundary, which owns
    // the line break after the last line of the part (RFC 2046 5.1.1)
    async finalize(boundaryEnded = false) {
        if (this.state === 'finished') {
            return;
        }
        if (this.state === 'header') {
            this.endHeaders();
        }
        // remove self from boundary listing
        this.postalMime.boundaries.remove(this);
        await this.finalizeChildNodes(boundaryEnded);
        this.content = this.contentDecoder ? await this.contentDecoder.finalize(boundaryEnded) : null;
        // The decoder buffers every body line it received, so keeping it around
        // retains a second copy of the content for the lifetime of the node.
        // Nothing reads it once the node is finished, so release it here.
        this.contentDecoder = null;
        this.state = 'finished';
    }
    async finalizeChildNodes(boundaryEnded = false) {
        // Children are only ever appended, so everything before the cursor is already
        // finished and re-visiting it only costs time.
        while (this.finalizedChildCount < this.childNodes.length) {
            await this.childNodes[this.finalizedChildCount++].finalize(boundaryEnded);
        }
    }
    // Strip RFC 822 comments (parenthesized text) from structured header values.
    //
    // Inside an unquoted parameter value a parenthesis that continues the current token is
    // content, because `filename=Invoice(1).pdf` is a filename and not a token followed by
    // a comment, and deleting the parens silently renames the attachment.
    stripComments(str) {
        let result = '';
        let depth = 0;
        let escaped = false;
        let inQuote = false;
        // where the outermost comment opened, for the unbalanced case below
        let commentStart = -1;
        // A parameter value starts at `=` and ends at the `;` that begins the next one
        let inParameterValue = false;
        // The characters kept are copied into the result as runs, a run ending at the
        // next character dropped. Appended one at a time they made a cons string of a
        // node per character, tens of megabytes of pointer chasing for the collector on a
        // header of a megabyte, and the parse grew faster than the header did
        let runStart = 0;
        const drop = (i) => {
            result += str.slice(runStart, i);
            runStart = i + 1;
        };
        // Whether anything has been kept, and whether the last character kept is SP or
        // HTAB. Kept up to date on every character, because testing `/[ \t]$/` against the
        // result flattens the whole string on each `(` and is quadratic in the length of
        // the header.
        let keptAny = false;
        let endsWithWsp = false;
        const keep = (i) => {
            keptAny = true;
            endsWithWsp = isWsp(str.charCodeAt(i));
        };
        // A comment may only appear where linear whitespace is allowed, so inside a
        // parameter value the parenthesis has to follow whitespace to open one. Outside
        // one, eg. after the type itself, anything goes.
        const opensComment = () => !inParameterValue || !keptAny || endsWithWsp;
        for (let i = 0; i < str.length; i++) {
            const chr = str.charAt(i);
            if (escaped) {
                escaped = false;
            }
            else if (chr === '\\') {
                escaped = true;
            }
            else if (chr === '"' && depth === 0) {
                inQuote = !inQuote;
            }
            else if (!inQuote) {
                if (chr === '(' && opensComment()) {
                    if (depth === 0) {
                        commentStart = i;
                    }
                    depth++;
                    drop(i);
                    continue;
                }
                if (chr === ')' && depth > 0) {
                    depth--;
                    drop(i);
                    continue;
                }
                if (depth === 0) {
                    if (chr === '=') {
                        inParameterValue = true;
                    }
                    else if (chr === ';') {
                        inParameterValue = false;
                    }
                }
            }
            if (depth === 0) {
                keep(i);
            }
            else {
                drop(i);
            }
        }
        if (depth === 0) {
            return result + str.slice(runStart);
        }
        // An unbalanced `(` is not a comment. Dropping everything after it would take any
        // parameter that follows with it, including the boundary that holds the message
        // together, so the dangling text is only discarded when nothing follows it.
        return str.indexOf(';', commentStart) < 0 ? result + str.slice(runStart) : str;
    }
    parseStructuredHeader(str) {
        // Strip RFC 822 comments before parsing
        str = this.stripComments(str);
        let response = {
            value: '',
            params: {}
        };
        let key = false;
        let value = '';
        let stage = 'value';
        // Whitespace seen outside a quoted string is held back until a significant
        // character follows it, so surrounding whitespace can be dropped without
        // trimming spaces the sender quoted on purpose. Trimming the stored value
        // instead loses the trailing space in `filename*0="Annual Report "`, which the
        // next continuation section is meant to be appended to.
        let pendingSpace = '';
        let quoteClosed = false;
        let quote = false;
        let escaped = false;
        let chr;
        // Whitespace ahead of the first character of a value is padding and is dropped, the
        // whitespace between two characters of it is content
        const flushSpace = () => {
            if (value.length) {
                value += pendingSpace;
            }
            pendingSpace = '';
        };
        // The characters of the value are copied as runs, see stripComments. A run is the
        // characters from runStart on, none is open while it is -1, and it is closed by
        // whatever is not a character of the value
        let runStart = -1;
        const closeRun = (end) => {
            if (runStart >= 0) {
                value += str.slice(runStart, end);
                runStart = -1;
            }
        };
        // the character at i is part of the value
        const addChr = (i) => {
            if (runStart < 0) {
                flushSpace();
                runStart = i;
            }
        };
        const takeValue = () => {
            const result = value;
            value = '';
            pendingSpace = '';
            quoteClosed = false;
            return result;
        };
        // A duplicated parameter resolves to its first occurrence, matching how duplicated
        // headers are resolved. Letting the last one win means `boundary="b"; boundary="c"`
        // registers a boundary that no delimiter in the message matches, which drops the
        // body without an error. hasOwnProperty, because a parameter may be named
        // `constructor` or `toString`. A name is a token and a token is never empty, so the
        // nameless parameter of `text/plain; =v` names nothing and is dropped.
        const storeParam = (name, result) => {
            if (name && !Object.prototype.hasOwnProperty.call(response.params, name)) {
                response.params[name] = result;
            }
        };
        const storeValue = () => {
            const result = takeValue();
            if (key === false) {
                response.value = result;
            }
            else {
                storeParam(key, result);
            }
        };
        // A parameter name with no `=` is a valueless parameter, not the start of the
        // next one. Without this the name would keep growing across the `;` and swallow
        // whatever followed, which is how `x=1; flag; boundary="AAA"` loses its boundary.
        const storeEmptyKey = () => {
            storeParam(takeValue().trim().toLowerCase(), '');
        };
        for (let i = 0, len = str.length; i < len; i++) {
            chr = str.charAt(i);
            switch (stage) {
                case 'key':
                    if (chr === '=') {
                        closeRun(i);
                        key = takeValue().trim().toLowerCase();
                        stage = 'value';
                        break;
                    }
                    if (chr === ';') {
                        closeRun(i);
                        storeEmptyKey();
                        break;
                    }
                    if (runStart < 0) {
                        runStart = i;
                    }
                    break;
                case 'value':
                    if (quoteClosed && chr !== ';') {
                        // Nothing behind a closed quoted string reaches the value. RFC 2045
                        // says a parameter value is a token or a quoted string, not both, so
                        // what follows one is junk and only the `;` that ends the parameter
                        // still counts. Tested ahead of the branches rather than beside the
                        // append at the foot of them, where each branch above was a way
                        // around it. A second `"` reopened quoting, which both carried the
                        // whitespace in front of it into the value and took the `;` along, so
                        // `boundary="AAA" "; boundary=BBB"` registered a boundary of `AAA `
                        // that no delimiter matches and the whole body was dropped without an
                        // error; the escape branch appended arbitrary characters the same way.
                        // quoteClosed is only ever set while no quote is open, and this is
                        // what keeps one from being opened afterwards.
                        escaped = false;
                        break;
                    }
                    if (escaped) {
                        addChr(i);
                    }
                    else if (quote && chr === '\\') {
                        // backslash only escapes inside a quoted string, everywhere else
                        // it is an ordinary character. Treating it as an escape turns
                        // `filename=C:\Users\me\a.txt` into `C:Usersmea.txt`.
                        closeRun(i);
                        escaped = true;
                        continue;
                    }
                    else if (quote && chr === quote) {
                        closeRun(i);
                        quote = false;
                        quoteClosed = true;
                    }
                    else if (!quote && chr === '"') {
                        closeRun(i);
                        quote = chr;
                        flushSpace();
                    }
                    else if (!quote && chr === ';') {
                        closeRun(i);
                        storeValue();
                        stage = 'key';
                    }
                    else if (!quote && (chr === ' ' || chr === '\t')) {
                        closeRun(i);
                        pendingSpace += chr;
                    }
                    else {
                        addChr(i);
                    }
                    escaped = false;
                    break;
            }
        }
        closeRun(str.length);
        // finalize remainder
        if (stage === 'value') {
            storeValue();
        }
        else {
            // treat as key without value, see emptykey:
            // Header-Key: somevalue; key=value; emptykey
            storeEmptyKey();
        }
        if (response.value) {
            response.value = response.value.toLowerCase();
        }
        // convert Parameter Value Continuations into single strings
        decodeParameterValueContinuations(response);
        return response;
    }
    // Unfolds format=flowed text (RFC 3676 4.1). A line is read as its quote marks, one
    // space of stuffing and its content, in that order, and a line whose content ends in a
    // space is flowed: the next line of the same quote depth continues its paragraph. The
    // paragraph ends at a fixed line, at a change of quote depth and at the signature
    // separator, which is neither flowed nor fixed. Joining a quoted paragraph used to
    // leave the quote marks of the continuation lines inside the text, so a quoted reply
    // read `> one > two` instead of `> one two`.
    //
    // The quote marks and stuffing of the first line of a paragraph are kept as they were
    // written, so a fixed quoted line comes out exactly as it went in. An unquoted stuffed
    // line loses its stuffing, which is all the stuffing is for.
    decodeFlowedText(str, delSp) {
        // Pieces of the result. Growing a single string instead flattens the whole
        // paragraph again on each line, which is quadratic in the length of a paragraph.
        // `parts` holds an entry or two per line, so it is joined into `chunks` every few
        // thousand entries to keep memory following the length of the text rather than
        // the number of lines. Its last entry stays behind, since delsp trims it when
        // the next line continues the paragraph.
        const chunks = [];
        let parts = [];
        // whether the previous line was flowed, and the quote depth of its paragraph
        let flowed = false;
        let depth = 0;
        for (let lineStart = 0; lineStart <= str.length;) {
            let lineEnd = str.indexOf('\n', lineStart);
            if (lineEnd < 0) {
                lineEnd = str.length;
            }
            const line = str.slice(lineStart, lineEnd);
            let quoteDepth = 0;
            while (line.charCodeAt(quoteDepth) === 0x3e /* > */) {
                quoteDepth++;
            }
            const contentStart = line.charCodeAt(quoteDepth) === 0x20 ? quoteDepth + 1 : quoteDepth;
            const content = line.slice(contentStart);
            const isSignature = content === '-- ';
            if (flowed && quoteDepth === depth && !isSignature) {
                if (delSp) {
                    // delsp adds the space to make the text foldable, so it is not content
                    const last = parts[parts.length - 1];
                    parts[parts.length - 1] = last.slice(0, -1);
                }
                parts.push(content);
            }
            else {
                if (lineStart) {
                    parts.push('\n');
                }
                parts.push(quoteDepth ? line : content);
            }
            flowed = !isSignature && content.endsWith(' ');
            depth = quoteDepth;
            if (parts.length >= FLOWED_JOIN_INTERVAL) {
                const last = parts.pop();
                chunks.push(parts.join(''));
                parts = [last];
            }
            lineStart = lineEnd + 1;
        }
        chunks.push(parts.join(''));
        return chunks.join('');
    }
    getTextContent() {
        if (!this.content) {
            return '';
        }
        // The bytes keep the line endings the part was sent with, see PassThroughDecoder,
        // which differ from one transfer encoding to the next. Text is normalized to LF so
        // that a consumer does not get CRLF from one message and LF from another
        let str = decodeText(this.content, this.contentType.parsed.params.charset, this.contentType.parsed.value === 'text/html').replace(/\r\n/g, '\n');
        // format=flowed is defined for text/plain (RFC 3676), and a browser never unfolds
        // an html part. Unfolded here anyway, `<scri \r\npt>` under delsp=yes was joined
        // into a tag that neither Python nor a browser given the raw bytes sees
        if (this.contentType.parsed.value === 'text/plain' && /^flowed$/i.test(this.contentType.parsed.params.format)) {
            str = this.decodeFlowedText(str, /^yes$/i.test(this.contentType.parsed.params.delsp));
        }
        return str;
    }
    processHeaders() {
        // First pass: group folded continuation lines with the header they belong to.
        //
        // Only SP and HTAB continue a header (RFC 5322 3.2.2 WSP). JS `\s` also matches
        // NBSP, vertical tab, form feed and U+2028, so a line starting with one of those
        // used to be absorbed into the header above it and disappear from both `headers`
        // and `headerLines` while a strict parser still sees it as a header of its own.
        //
        // Collecting into an array and joining once keeps this linear. Appending onto the
        // previous string in a backward pass re-scans the joined value on every line,
        // which is quadratic in the number of folds and lets a message that fits inside
        // maxHeadersSize burn seconds of CPU.
        let foldedLines = [];
        for (let line of this.headerLines) {
            if (foldedLines.length && /^[ \t]/.test(line)) {
                foldedLines[foldedLines.length - 1].push(line);
            }
            else {
                foldedLines.push([line]);
            }
        }
        let seenContentHeaders = new Set();
        // Second pass: process headers in document order
        for (let parts of foldedLines) {
            let rawLine = parts.join('\n');
            // The field name is kept as it was written, whitespace included. RFC 5322 puts
            // the colon right after the name and only its obsolete syntax lets whitespace
            // come between the two, so `From :` names a different field than `From:`, as
            // Go reads it, and the first line of a message may start with whitespace while
            // it is a fold of nothing, a line Python drops and Go rejects the message for.
            // Trimming the name made such a line the canonical header, and since the first
            // occurrence of a header wins, a ` From:` first line or a `From :` ahead of the
            // genuine From named the sender here while a verifier reading the other had
            // authenticated the one this parser ignored. The same put a Content-Type ahead
            // of the one every other parser reads the body by. Leaving the whitespace in
            // the key keeps the line visible without letting it collide with a genuine
            // header. A line whose name holds anything else, a non-ASCII space say, is no
            // field at all and ends the headers, see feed.
            let sep = rawLine.indexOf(':');
            let rawKey = sep < 0 ? rawLine : rawLine.slice(0, sep);
            // Store raw line with lowercase key
            this.rawHeaderLines.push({
                key: rawKey.toLowerCase(),
                line: rawLine
            });
            // Unfolding removes the line break and keeps the folding whitespace, so
            // `Subject: Hello\r\n    World` stays `Hello    World`. Collapsing every
            // whitespace run instead also rewrote boundary values and filenames, and it
            // replaced the non-ASCII spaces that raw UTF-8 headers (RFC 6532) may carry.
            let unfoldedLine = parts.join('');
            sep = unfoldedLine.indexOf(':');
            let key = sep < 0 ? unfoldedLine : unfoldedLine.slice(0, sep);
            // A bare CR is not legal in a field body, see foldLineBreaks
            let value = sep < 0 ? '' : trimWsp(foldLineBreaks(unfoldedLine.slice(sep + 1)));
            this.headers.push({ key: key.toLowerCase(), originalKey: key, value });
            // A header that decides how the body is read must resolve the same way every
            // time it is duplicated, otherwise a message can present one Content-Type to a
            // scanner and a different one here. Every one of these takes the first
            // occurrence and later copies are ignored.
            const lowerKey = key.toLowerCase();
            if (CONTENT_HEADERS.has(lowerKey) && !seenContentHeaders.has(lowerKey)) {
                seenContentHeaders.add(lowerKey);
                switch (lowerKey) {
                    case 'content-type':
                        this.contentType.value = value;
                        break;
                    case 'content-transfer-encoding':
                        this.contentTransferEncoding.value = value;
                        break;
                    case 'content-disposition':
                        this.contentDisposition.value = value;
                        break;
                    case 'content-id':
                        this.contentId = value;
                        break;
                    case 'content-description':
                        this.contentDescription = value;
                        break;
                }
            }
        }
        this.contentType.parsed = this.parseStructuredHeader(this.contentType.value);
        this.contentType.multipart = /^multipart\//i.test(this.contentType.parsed.value)
            ? this.contentType.parsed.value.slice(this.contentType.parsed.value.indexOf('/') + 1)
            : false;
        // A boundary does not end in whitespace (RFC 2046 5.1.1, bcharsnospace), and one
        // written with some anyway, `boundary="abc "`, is `abc` to Python. Registered as
        // written it matched no delimiter line and the whole body was dropped without a
        // trace, an attachment included. A delimiter line written with the space still
        // matches, since a boundary line may end in whitespace. trimEnd rather than
        // trimWsp, because Python strips any whitespace here.
        //
        // A boundary is ASCII as well (RFC 2046 5.1.1, bchars), and Python matches no line
        // against one that is not. One holding a non-ASCII character came out of a header
        // line decoded as windows-1252 and re-encoded as UTF-8, or was written in UTF-8 to
        // begin with. Matched here, `boundary="ab\xE9cd"` found the parts under lines of
        // `--ab\xC3\xA9cd` that a scanner built on Python never saw, and with the same byte
        // on both sides nothing matched and the body was dropped without a trace. Such a
        // boundary counts as none, so the body reads as text below
        let boundary = this.contentType.multipart ? (this.contentType.parsed.params.boundary || '').trimEnd() : '';
        if (/[^\x00-\x7f]/.test(boundary)) {
            boundary = '';
        }
        if (this.contentType.multipart && !boundary) {
            // A multipart without the boundary RFC 2046 5.1.1 requires, or with one it does
            // not allow, has no parts to find, and its body used to be dropped without a
            // trace. RFC 2045 5.2 recommends reading an invalid Content-Type as plain text,
            // which is also what the body of such a message usually is
            this.contentType.parsed.value = 'text/plain';
            this.contentType.multipart = false;
        }
        if (this.contentType.multipart) {
            // add self to boundary terminator listing
            this.postalMime.boundaries.push(boundary, this);
        }
        this.contentDisposition.parsed = this.parseStructuredHeader(this.contentDisposition.value);
        // The disposition type is a token, so it ends at the first whitespace. Read whole,
        // `attachment garbage` was neither attachment nor inline, and a text/html part
        // declaring it was rendered as the body while Python and mailparser keep it an
        // attachment. The type of a Content-Type stays as it is: `text/html garbage` is no
        // html to them either, and reading it as html here would be the reverse mistake
        const disposition = this.contentDisposition.parsed.value;
        const dispositionEnd = disposition.search(/[ \t]/);
        if (dispositionEnd >= 0) {
            this.contentDisposition.parsed.value = disposition.slice(0, dispositionEnd);
        }
        // The token at the start of the value, behind the whitespace a leading comment
        // leaves: `(comment) base64`, `base64 (comment)` and `base64 x` decode, as they do
        // for Python. A quoted token does not. `"base64"` is raw base64 to Python and to
        // mailparser, and decoding it here rendered as markup a body both hand through as
        // it is. Taking the first token anywhere in the value read it, and `x "base64"`.
        this.contentTransferEncoding.encoding = (this.stripComments(this.contentTransferEncoding.value)
            .toLowerCase()
            .match(/^[ \t]*([\w-]+)/) || ['', ''])[1];
        this.setupContentDecoder(this.contentTransferEncoding.encoding);
        // the lines live on in rawHeaderLines and headers, so the raw copies are released
        this.headerLines = [];
    }
    // Ends the header section and sets up the body
    endHeaders() {
        this.state = 'body';
        this.processHeaders();
    }
    // Returns true when the line was not consumed: the headers ended with the line before
    // it, and the parser has to read it again, since the boundary this part declares was
    // not known yet when the line was checked for one
    feed(line, lineBreak) {
        switch (this.state) {
            case 'header': {
                if (!line.length) {
                    this.endHeaders();
                    return false;
                }
                // Counted across the whole message, not per part. A per-node budget lets a
                // multipart carry the limit again for every part it declares, so a message
                // many times over the limit still parses.
                this.postalMime.counters.headerSize += Math.max(line.length, HEADER_LINE_MIN_COST);
                const maxHeadersSize = this.postalMime.limits.maxHeadersSize;
                if (this.postalMime.counters.headerSize > maxHeadersSize) {
                    throw createError('EMAXHEADERSIZE', `Maximum header size of ${maxHeadersSize} bytes exceeded`);
                }
                const text = decodeUtf8OrWindows1252(line, headerDecoder);
                // A line that is neither a header field nor a fold ends the headers, as it
                // does for Python and for an MTA that stores the header block on its own,
                // and Go rejects the message for it. Read on as a header here, a Content-Type
                // or a From behind such a line was honoured where a scanner built on Python
                // had read it as the first line of a text/plain body.
                //
                // A line of nothing but whitespace is a fold (RFC 5322 4.2, obs-FWS), but
                // broken generators also put one where the empty line that ends the headers
                // belongs, and reading it as a fold used to turn the whole body into one
                // more header. The next line decides: a field or a fold keeps it a fold,
                // anything else ends the headers, as it does for Python
                if (!isWsp(line[0]) && !FIELD_START.test(text)) {
                    this.endHeaders();
                    return true;
                }
                this.headerLines.push(text);
                break;
            }
            case 'body':
                // add line to body. processHeaders installs a decoder before the state
                // becomes body, and the only time the decoder is released is finalize,
                // which moves the state on to finished, so the guard only narrows the type
                if (this.contentDecoder) {
                    this.contentDecoder.update(line, lineBreak);
                }
                break;
        }
        return false;
    }
}

// --- address-parser.js ----------------------------------------------
/** The token is an operator, a text run otherwise */
const TOKEN_OPERATOR = 1;
/** The next character continues the same run without whitespace in between */
const TOKEN_NO_BREAK = 2;
/** The text run holds characters its value leaves out or changes, so it is no plain slice */
const TOKEN_DIRTY = 4;
/** A backslash escapes the next character in the text run, inside a quoted string or a comment */
const TOKEN_ESCAPES = 8;
/** The text run opens on a character an escaping backslash in front of it has escaped */
const TOKEN_STARTS_ESCAPED = 16;
/** The text run held a control character other than a line break or a tab, left out of its value */
const TOKEN_CONTROL = 32;
/**
 * The tokens of an address field, kept as offsets into it.
 *
 * Every token used to be an object of its own, an operator for every ',' and a value string
 * for every run of text, and a list of one letter names, 'a,a,a,...', took some 65 times its
 * size in tokens before any address was read. A token is now three numbers in one typed
 * array, its kind and the range of the field it covers, and its value is sliced off the field
 * when it is read. The few text runs whose value differs from their slice, as they hold an
 * escaping backslash, a line break or a control character, are rebuilt once and kept aside.
 */
class TokenList {
    constructor(str) {
        this.str = str;
        this.slots = new Int32Array(48);
        this.length = 0;
        this.cleaned = new Map();
    }
    /**
     * Appends a token
     *
     * @param kind Kind and flags of the token
     * @param start Offset of its first character
     * @param end Offset just past its last character
     * @return Index of the token
     */
    push(kind, start, end) {
        if ((this.length + 1) * 3 > this.slots.length) {
            const grown = new Int32Array(this.slots.length * 2);
            grown.set(this.slots);
            this.slots = grown;
        }
        const at = this.length * 3;
        this.slots[at] = kind;
        this.slots[at + 1] = start;
        this.slots[at + 2] = end;
        return this.length++;
    }
    /**
     * Offset of the first character of a token that is part of its value. A text run that is
     * no plain slice of the field still spans the whitespace and control characters its value
     * is trimmed of.
     */
    contentStart(index) {
        let start = this.slots[index * 3 + 1];
        const end = this.slots[index * 3 + 2];
        while (start < end && isDroppedCode(this.str.charCodeAt(start))) {
            start++;
        }
        return start;
    }
    /**
     * Offset just past the last character of a token that is part of its value
     */
    contentEnd(index) {
        const start = this.slots[index * 3 + 1];
        let end = this.slots[index * 3 + 2];
        while (end > start && isDroppedCode(this.str.charCodeAt(end - 1))) {
            end--;
        }
        return end;
    }
    /**
     * The character of an operator token, an empty string for a text run
     */
    operatorAt(index) {
        const at = index * 3;
        return this.slots[at] & TOKEN_OPERATOR ? this.str.charAt(this.slots[at + 1]) : '';
    }
    /**
     * Whether a token is an operator
     */
    isOperator(index) {
        return (this.slots[index * 3] & TOKEN_OPERATOR) !== 0;
    }
    /**
     * Whether the next character continues the run of a token without whitespace in between
     */
    noBreak(index) {
        return (this.slots[index * 3] & TOKEN_NO_BREAK) !== 0;
    }
    /**
     * Whether a control character was left out of the value of a token
     */
    hasControl(index) {
        return (this.slots[index * 3] & TOKEN_CONTROL) !== 0;
    }
    /**
     * Value of a token
     */
    value(index) {
        const cleaned = this.cleaned.get(index);
        if (cleaned !== undefined) {
            return cleaned;
        }
        return this.str.slice(this.slots[index * 3 + 1], this.slots[index * 3 + 2]);
    }
}
/**
 * Any whitespace, the test for an angle-addr that needs recovering
 */
const HAS_WHITESPACE = /\s/;
/**
 * An addr-spec that carries its whitespace legally, inside a quoted local part. The
 * optional tail is the malformed shape: a real mailbox with wreckage trailing it.
 */
const QUOTED_LOCAL_ADDR = /^("(?:[^"\\]|\\[\s\S])*"@\S+)(?:\s+([\s\S]+))?$/;
/**
 * One run holding a single '@' and no whitespace, the shape an addr-spec has to have
 */
const ADDR_SPEC = /^[^@\s]+@[^@\s]+$/;
/**
 * The same with a domain literal for the domain, which may hold an '@' of its own
 */
const LITERAL_ADDR_SPEC = /^[^@\s]+@\[[^[\]\\\s]*\]$/;
/**
 * The '@' and domain that follow a quoted local part in the same run
 */
const QUOTED_LOCAL_DOMAIN = /^@(?:[^@\s"]+|\[[^[\]\\\s]*\])$/;
/**
 * Whether a whitespace free run reads as an addr-spec under the strict grammar
 *
 * @param value Run to check
 * @return true when it does
 */
function isAddrSpec(value) {
    return ADDR_SPEC.test(value) || LITERAL_ADDR_SPEC.test(value);
}
/**
 * The looser reading applied once the strict one finds nothing, which tolerates the
 * further '@' that a domain should not have but malformed headers carry anyway
 */
const LOOSE_ADDR_SPEC = /^[^@\s]+@\S+$/;
/**
 * An addr-spec sitting inside free text, together with the whitespace around it. Sticky
 * on purpose: it is only run at the offset looseAddressStart picks, see there.
 */
const LOOSE_TEXT_ADDR = /\s*\b[^@\s]+@[^\s]+\b\s*/y;
/**
 * A domain literal that ends an address. dtext includes '@' (RFC 5322 3.4.1), so the '@'
 * in front of the literal is the one that splits the domain off, not the last one: reading
 * 'a@[x@evil.com]' at its last '@' made it an address at evil.com.
 */
const DOMAIN_LITERAL_TAIL = /@(\[[^[\]\\]*\])$/;
/**
 * Offset of the '@' that splits the domain off an address, or -1 when there is none
 *
 * @param address Address to split
 * @return Offset of the '@'
 */
function domainAt(address) {
    const literal = address.charAt(address.length - 1) === ']' ? DOMAIN_LITERAL_TAIL.exec(address) : null;
    return literal ? address.length - literal[1].length - 1 : address.lastIndexOf('@');
}
/**
 * Restores the quoting of a local part that was read out of a quoted string.
 *
 * RFC 5321 allows '@' inside a quoted local part, so handing '"user@evil.com"@good.com'
 * on as the bare 'user@evil.com@good.com' leaves it to the consumer which '@' splits the
 * domain off. Getting that wrong is a misrouting vector, so the quotes go back on. The
 * same holds for the other specials: a ',' or a ';' that loses its quotes reads as a
 * recipient separator once the consumer puts the address back into a header.
 *
 * @param address Address with an unquoted local part
 * @return Address with the local part as a quoted-string
 */
function quoteLocalPart(address) {
    const lastAt = domainAt(address);
    if (lastAt < 0) {
        // no domain to split off, nothing can be misrouted
        return address;
    }
    const user = address.substring(0, lastAt);
    if (/^[^\s"(),:;<>@[\\\]]+$/.test(user) || /^"(?:[^"\\]|\\[\s\S])*"$/.test(user)) {
        // a local part that carries no special reads the same with or without the quotes,
        // and one that is already a complete quoted-string needs nothing either
        return address;
    }
    return '"' + user.replace(/["\\]/g, '\\$&') + '"@' + address.substring(lastAt + 1);
}
/**
 * The characters JS `\s` matches, which the scan below has to agree with to land on the
 * same match LOOSE_TEXT_ADDR would.
 */
function isSpaceCode(code) {
    return (code === 0x20 ||
        (code >= 0x09 && code <= 0x0d) ||
        code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000 ||
        code === 0xfeff);
}
/**
 * Checks for the whitespace RFC 5322 folding whitespace is made of: SP and HTAB, plus the
 * line break a fold carries. The other characters isSpaceCode accepts are atext under
 * RFC 6532, and parsers disagree on them: mailauth keeps U+00A0 in a domain, so joining a
 * domain across one names a domain that reader never sees
 *
 * @param code Character code
 * @return true if the character is folding whitespace
 */
function isFoldingSpaceCode(code) {
    return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a;
}
/**
 * Checks if every character in a stretch of the field is folding whitespace
 *
 * @param str The field
 * @param from Offset of the first character
 * @param to Offset just past the last one
 * @return true if the stretch holds nothing but folding whitespace
 */
function isFoldingGap(str, from, to) {
    for (let i = from; i < to; i++) {
        if (!isFoldingSpaceCode(str.charCodeAt(i))) {
            return false;
        }
    }
    return true;
}
/**
 * Checks for a character the value of a text run is trimmed of, or leaves out: whitespace,
 * C0 controls and DEL
 *
 * @param code Character code
 * @return true if the character is not part of the value at the edge of a run
 */
function isDroppedCode(code) {
    return code < 0x20 || code === 0x7f || isSpaceCode(code);
}
/**
 * The characters JS `\w` matches without the unicode flag, the set the `\b` in
 * LOOSE_TEXT_ADDR is read against. charCodeAt off either end of the string gives NaN,
 * which compares false throughout, so out of range reads as a non-word character.
 */
function isWordCode(code) {
    return ((code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a) ||
        code === 0x5f);
}
/**
 * Whether `\b` holds at an offset
 */
function isBoundary(text, at) {
    return isWordCode(text.charCodeAt(at - 1)) !== isWordCode(text.charCodeAt(at));
}
/**
 * Offset of the first '@' in `text` between `from` and `to`, or -1 when the range holds none.
 * Bounded rather than indexOf, which would scan on to the end of the header once for every
 * whitespace delimited run and make the walk below quadratic.
 */
function indexOfAt(text, from, to) {
    for (let i = from; i < to; i++) {
        if (text.charCodeAt(i) === 0x40) {
            return i;
        }
    }
    return -1;
}
/**
 * A quoted-string a value opens with
 */
const LEADING_QUOTED_STRING = /^"(?:[^"\\]|\\[\s\S])*"/;
/**
 * Drops the whitespace on either side of the '@' at an offset.
 *
 * obs-local-part and obs-domain allow CFWS around the '@' (RFC 5322 4.4), so 'user @ good.com'
 * names user@good.com. Kept, the whitespace became part of the address as '"user "@ good.com'.
 * The scan is by index, a pattern such as /\s+@/ backtracks over a long whitespace run that
 * no '@' follows.
 *
 * The whitespace around the dots of the domain that follows is dropped as well, see
 * joinDomainDotSpacing.
 *
 * @param value Value holding the '@'
 * @param at Offset of the '@', or -1
 * @return The value with the whitespace beside that '@' removed
 */
function joinAtSpacing(value, at) {
    if (at < 0) {
        return value;
    }
    let start = at;
    while (start > 0 && isSpaceCode(value.charCodeAt(start - 1))) {
        start--;
    }
    let end = at + 1;
    while (end < value.length && isSpaceCode(value.charCodeAt(end))) {
        end++;
    }
    const joined = start === at && end === at + 1 ? value : value.slice(0, start) + '@' + value.slice(end);
    return joinDomainDotSpacing(joined, start);
}
// The ASCII atext characters: printable, and none of the RFC 5322 specials
const ASCII_ATEXT = new Uint8Array(0x80);
for (let code = 0x21; code < 0x7f; code++) {
    ASCII_ATEXT[code] = '()<>[]:;@\\,."'.indexOf(String.fromCharCode(code)) < 0 ? 1 : 0;
}
/**
 * Checks if a character can be part of an atom: anything but the specials, whitespace and
 * the control characters (RFC 5322 3.2.3, with non-ASCII allowed as RFC 6532 does)
 *
 * @param code Character code
 * @return true if the character is atext
 */
function isAtextCode(code) {
    return code < 0x80 ? ASCII_ATEXT[code] === 1 : !isSpaceCode(code);
}
/**
 * Drops the whitespace around the dots of the domain behind the '@' at an offset.
 *
 * obs-domain is atoms with CFWS around the dots (RFC 5322 4.4), so 'user@victim.example
 * .allowed.example' names user@victim.example.allowed.example. Read as two runs, the domain
 * ended at the whitespace and the mailbox was shown as victim.example, a different domain
 * than the one an RFC 5322 parser, and a DMARC verifier built on one, reads. A comment
 * around a dot reaches here as whitespace.
 *
 * Only SP, HTAB and a fold count as the whitespace, see isFoldingSpaceCode.
 *
 * Only a dot with an atom on both sides joins, as for a conformant parser: whitespace that
 * is not beside a dot ends the domain, and so does a dot that no atom follows, which keeps
 * 'user@example.com .' from becoming a domain with a trailing dot. A domain literal is left
 * alone. Everything from where the domain ends is kept as it is.
 *
 * @param value Value holding the '@'
 * @param at Offset of the '@'
 * @return The value with the whitespace around the dots of that domain removed
 */
function joinDomainDotSpacing(value, at) {
    const len = value.length;
    // '[' is no atext, so a domain literal ends the walk before it starts
    let pos = at + 1;
    let spaced = false;
    for (;;) {
        const labelStart = pos;
        while (pos < len && isAtextCode(value.charCodeAt(pos))) {
            pos++;
        }
        if (pos === labelStart) {
            break;
        }
        // the dot, with the whitespace on either side of it, and the label behind it
        let next = pos;
        while (next < len && isFoldingSpaceCode(value.charCodeAt(next))) {
            next++;
        }
        if (value.charCodeAt(next) !== 0x2e) {
            break;
        }
        next++;
        while (next < len && isFoldingSpaceCode(value.charCodeAt(next))) {
            next++;
        }
        if (next >= len || !isAtextCode(value.charCodeAt(next))) {
            break;
        }
        spaced = spaced || next !== pos + 1;
        pos = next;
    }
    if (!spaced) {
        return value;
    }
    // every whitespace character the walk covered sits beside a dot
    let domain = '';
    for (let k = at + 1; k < pos; k++) {
        if (!isFoldingSpaceCode(value.charCodeAt(k))) {
            domain += value.charAt(k);
        }
    }
    return value.slice(0, at + 1) + domain + value.slice(pos);
}
/**
 * Drops the whitespace beside the '@' that splits the domain off a value. That is the '@'
 * right after a quoted local part the value opens with, or else the only '@' it holds outside
 * any quoted string. With several it is not clear which one the whitespace belongs to, and
 * '<x@evil.com @good.com>' is left to the addr-spec recovery to read as it always has.
 *
 * @param value Value to clean up
 * @return The value with the whitespace beside that '@' removed
 */
function collapseAtSpacing(value) {
    const quoted = LEADING_QUOTED_STRING.exec(value);
    if (quoted) {
        let at = quoted[0].length;
        while (at < value.length && isSpaceCode(value.charCodeAt(at))) {
            at++;
        }
        if (value.charAt(at) === '@' && value.indexOf('@', at + 1) < 0) {
            return joinAtSpacing(value, at);
        }
    }
    const at = value.indexOf('@');
    if (at < 0 || value.indexOf('@', at + 1) >= 0 || value.lastIndexOf('"') > at) {
        return value;
    }
    return joinAtSpacing(value, at);
}
/**
 * Finds the offset LOOSE_TEXT_ADDR matches at, or -1 when it does not match at all.
 *
 * Letting the pattern search for itself is quadratic: '[^@\s]+' is retried from every
 * offset and rescans the run to the next '@' each time, so a single header well inside
 * the default size limit could hold a core busy for minutes. The search is also
 * unnecessary. '[^@\s]+' crosses neither whitespace nor a '@', so a match can only begin
 * at the head of a whitespace delimited run or just past a '@' inside one, and '[^\s]+\b'
 * gives characters back until it lands on a boundary, so the only end it can take in that
 * run is the last boundary in it. Both are found in one pass, and the pattern is then run
 * at that single offset.
 *
 * @param text Free text to look in
 * @return Offset to match at, or -1
 */
function looseAddressStart(text) {
    const len = text.length;
    let pos = 0;
    while (pos < len) {
        while (pos < len && isSpaceCode(text.charCodeAt(pos))) {
            pos++;
        }
        if (pos >= len) {
            break;
        }
        const runStart = pos;
        let runEnd = pos;
        while (runEnd < len && !isSpaceCode(text.charCodeAt(runEnd))) {
            runEnd++;
        }
        let at = indexOfAt(text, runStart, runEnd);
        if (at >= 0) {
            let lastBoundary = -1;
            for (let k = runEnd; k > runStart; k--) {
                if (isBoundary(text, k)) {
                    lastBoundary = k;
                    break;
                }
            }
            let atomStart = runStart;
            while (lastBoundary >= 0 && at >= 0) {
                // '[^@\s]+' has to cover a character before the '@' and '[^\s]+' one after it,
                // and the boundary that ends the match has to sit past both
                if (at > atomStart && runEnd > at + 1 && lastBoundary > at + 1) {
                    for (let start = atomStart; start < at; start++) {
                        if (isBoundary(text, start)) {
                            if (start > runStart) {
                                return start;
                            }
                            // the leading '\s*' is greedy, so a match that begins at the run
                            // takes the whitespace in front of it along
                            let padded = runStart;
                            while (padded > 0 && isSpaceCode(text.charCodeAt(padded - 1))) {
                                padded--;
                            }
                            return padded;
                        }
                    }
                }
                atomStart = at + 1;
                at = indexOfAt(text, atomStart, runEnd);
            }
        }
        pos = runEnd;
    }
    return -1;
}
/**
 * Recovers the addr-spec from an angle-addr that came back holding unquoted whitespace.
 *
 * A malformed header can put more than a mailbox between the angle brackets, most often
 * because the generator wrote the recipient twice: '<user@example.com user@example.com>'
 * or '<example.com user@example.com>'. Whitespace is not addr-spec, so the whole run can
 * never be a mailbox, and passing it on as the address loses the recipient that is
 * sitting right there in the header.
 *
 * The run that still reads as an addr-spec is kept and whatever is left over becomes
 * display text. Candidates are read strictly first and then under the looser grammar,
 * the same two tiers the unquoted text fallback applies, so that '<a@b@c.com junk>' and a
 * bare 'a@b@c.com junk' agree on the recipient.
 *
 * A quoted local part is left alone: RFC 5321 allows whitespace inside it, so
 * '<"user name"@example.com>' is well formed and means exactly what it says.
 *
 * @param address Collected address
 * @param text Collected display text
 * @return The address and the display text, with any leftovers moved to the text
 */
function recoverAddrSpec(address, text) {
    address = collapseAtSpacing(address);
    if (!HAS_WHITESPACE.test(address)) {
        return { address, text };
    }
    let rest;
    const quoted = address.match(QUOTED_LOCAL_ADDR);
    if (quoted) {
        if (!quoted[2]) {
            // the whitespace sits inside the quoted local part, this is a well formed mailbox
            return { address, text };
        }
        // a real mailbox with wreckage trailing it, so peel the addr-spec off whole rather
        // than splitting into the quotes
        address = quoted[1];
        rest = [quoted[2]];
    }
    else {
        if (address.indexOf('"') >= 0) {
            // Splitting on whitespace loses track of where a quoted string starts and ends,
            // and addresses are never taken out of quoted strings: the run picked out of
            // '<junk "user@evil.com b"@good.com>' would be an address from the domain the
            // quotes were hiding. Every well formed shape was handled above, so the original
            // is the honest answer
            return { address, text };
        }
        const parts = address.split(/\s+/);
        let addrIndex = parts.findIndex(isAddrSpec);
        if (addrIndex < 0) {
            addrIndex = parts.findIndex(part => LOOSE_ADDR_SPEC.test(part));
        }
        if (addrIndex < 0) {
            // nothing in there reads as an address, there is no better answer than the original
            return { address, text };
        }
        address = parts.splice(addrIndex, 1)[0];
        rest = parts;
    }
    return {
        address,
        text: [text, ...rest].filter(part => part).join(' ')
    };
}
/**
 * Takes the RFC 5322 comments out of the contents of an angle-addr.
 *
 * The tokenizer tracks a single open operator, so once '<' is open a '(' is plain text and
 * a comment inside the brackets reached the address verbatim: 'Name <user@example.com(x)evil.com>'
 * put 'user@example.com(x)evil.com' into the address, a value that is no mailbox and that a
 * consumer stripping the comment reads as 'user@example.comevil.com'. A comment is folding
 * whitespace, so it is read as a space that splits two atoms and as nothing next to an '@',
 * the same rule the token walk applies outside the brackets. Quoted strings and domain
 * literals are copied through untouched, a '(' in there is not a comment. An unexpected '<'
 * outside them drops everything in front of it, comments included.
 *
 * RFC 822 also let an angle-addr name the relays to go through in front of the mailbox,
 * '<@relay1,@relay2:user@example.com>', which RFC 5322 still parses as obs-route. The route
 * is not part of the mailbox, and folded into the local part it made
 * '"@relay1,@relay2:user"@example.com' a recipient that does not exist. A local part can not
 * start with '@', so contents that do, up to the first ':' outside a domain literal and in
 * front of any quoted string, are a route and are dropped, as long as a mailbox with an '@'
 * of its own follows.
 *
 * @param address Contents of the angle brackets
 * @return The address with the comments removed, and the text of the comments
 */
function stripAddressComments(address) {
    const comments = [];
    let result = '';
    let comment = '';
    let depth = 0;
    let closer = '';
    // carried along rather than read back off the growing result, which would flatten it on
    // every comment (see lastChars in _handleAddress)
    let lastChar = '';
    // A comment that just closed stands for a space, written once the next character shows
    // whether one is wanted: not beside an '@', and not on top of whitespace that follows.
    // Deciding on the spot saw only the character right after the ')', so a second comment
    // in a row hid the '@' behind it and 'a(x)(y)@b' read as 'a @b'
    let pendingSpace = false;
    // first character of the result and whether a quoted string has opened since, which
    // together tell a route from a local part
    let firstChar = '';
    let quoteSeen = false;
    let routeEnd = -1;
    for (let i = 0, len = address.length; i < len; i++) {
        const chr = address.charAt(i);
        if (depth) {
            if (chr === '\\' && i < len - 1) {
                comment += address.charAt(++i);
            }
            else if (chr === '(') {
                depth++;
                comment += chr;
            }
            else if (chr === ')' && !--depth) {
                comments.push(comment.trim());
                comment = '';
                pendingSpace = lastChar !== '@';
            }
            else {
                comment += chr;
            }
            continue;
        }
        if (pendingSpace && chr !== '(') {
            pendingSpace = false;
            if (chr !== '@' && chr !== '<' && !isSpaceCode(address.charCodeAt(i))) {
                result += ' ';
                lastChar = ' ';
            }
        }
        if (closer) {
            if (chr === '\\' && closer === '"' && i < len - 1) {
                result += chr + address.charAt(++i);
                lastChar = address.charAt(i);
                continue;
            }
            if (chr === closer) {
                closer = '';
            }
        }
        else if (chr === '"') {
            closer = '"';
            quoteSeen = true;
        }
        else if (chr === ':' && routeEnd < 0 && firstChar === '@' && !quoteSeen) {
            routeEnd = result.length + 1;
        }
        else if (chr === '[') {
            closer = ']';
        }
        else if (chr === '(') {
            depth = 1;
            continue;
        }
        else if (chr === '<') {
            // Apple Mail drops everything between an unexpected '<' and the address after it.
            // Read here rather than off the raw brackets so that a '<' inside a quoted string,
            // a comment or a domain literal stays where it is: '<"a<b"@victim.com>' cut at
            // the first '<' left the address 'b"@victim.com'
            result = '';
            lastChar = '';
            comments.length = 0;
            firstChar = '';
            quoteSeen = false;
            routeEnd = -1;
            continue;
        }
        result += chr;
        lastChar = chr;
        if (!firstChar && !isSpaceCode(address.charCodeAt(i))) {
            firstChar = chr;
        }
    }
    if (routeEnd >= 0 && result.indexOf('@', routeEnd) >= 0) {
        result = result.slice(routeEnd);
    }
    if (depth) {
        // an unterminated comment runs to the end of the address
        comments.push(comment.trim());
    }
    return { address: result.trim(), comments: comments.filter(text => text) };
}
/**
 * Walks the tokens of one entry of an address list and sorts them into the runs of display
 * text, angle-addr and comment they belong to
 *
 * @param tokens Tokens of the whole address list
 * @param from Index of the first token of the entry
 * @param to Index just past the last token of the entry
 * @return The collected runs, and whether the display text came out of a comment
 */
function collectAddressParts(tokens, from, to) {
    let state = 'text';
    let data = {
        address: [],
        comment: [],
        text: [],
        addressControl: [],
        textControl: [],
        textWasQuoted: [], // Track which text tokens came from inside quotes
        // For a text run that is a quoted local part followed by the unquoted '@' and domain
        // of an addr-spec, '"user"@example.com', the length of the local part, -1 otherwise
        quotedLocalAt: []
    };
    // whether the last text run holds nothing but quoted text so far, which is what a quoted
    // local part is until the '@' after it joins the run
    let lastTextPureQuoted = false;
    // whether the last text run holds an unquoted '@', so that it runs on into a domain, and
    // whether nothing but comments has come since it, see the join below
    let lastTextHasAt = false;
    let lastTextOpen = false;
    // Where the last text run, or the last comment since it, ended in the field, and whether
    // everything between it and the comments since was folding whitespace. The tokens are
    // trimmed of any whitespace, so this is read off the field itself.
    let gapFrom = 0;
    let gapsFolding = true;
    let i;
    let insideQuotes = false; // Track if we're currently inside a quoted string
    // Last character of the run each state is currently accumulating. Reading it back off
    // the accumulator with slice(-1) makes the engine flatten the whole growing string on
    // every token, which is quadratic over an address built from many comment-joined atoms.
    // A run only ever grows by the token appended below, so the character is carried along.
    const lastChars = { address: '', comment: '', text: '' };
    // Filter out <addresses>, (comments) and regular text
    for (i = from; i < to; i++) {
        const value = tokens.value(i);
        // the operator in front of this token, if there is one, and whether it runs on into it
        const prevOperator = i > from ? tokens.operatorAt(i - 1) : '';
        const prevNoBreak = i > from && tokens.noBreak(i - 1);
        if (tokens.isOperator(i)) {
            switch (value) {
                case '<':
                    state = 'address';
                    insideQuotes = false;
                    lastTextOpen = false;
                    break;
                case '(':
                    state = 'comment';
                    insideQuotes = false;
                    gapsFolding = gapsFolding && isFoldingGap(tokens.str, gapFrom, tokens.contentStart(i));
                    break;
                case '"':
                    // Track quote state for text tokens
                    insideQuotes = !insideQuotes;
                    state = 'text';
                    lastTextOpen = false;
                    break;
                default:
                    state = 'text';
                    insideQuotes = false;
                    if (value !== ')') {
                        lastTextOpen = false;
                    }
                    else {
                        gapFrom = tokens.contentEnd(i);
                    }
                    break;
            }
        }
        else {
            // An empty quoted string is dropped by the tokenizer, leaving no text token of its
            // own to record the quoting on, so the pair of quote operators right in front of
            // this token is all that is left of it and the run it opens carries the quoting
            // instead. Without this '""@example.com' reads as the bare '@example.com'. It only
            // ever opens a run: a run already holding unquoted text is not a quoted string
            const opensAfterEmptyQuotedString = prevOperator === '"' && prevNoBreak && i > from + 1 && tokens.operatorAt(i - 2) === '"';
            // A comment is folding whitespace. It may sit inside an addr-spec, on either side
            // of the '@', but it cannot join two atoms into one: gluing across it would read
            // 'user@example.com(x)evil.com' as the single domain 'example.comevil.com' and
            // name a domain the sender never wrote.
            // A comment beside a dot of a domain is CFWS inside obs-domain, with or without
            // folding whitespace around it, so 'user@victim.example(x).allowed.example' names
            // one domain. Any other whitespace in between keeps them apart.
            // A ')' always leaves the walk in unquoted text, so neither needs checking here.
            // Neither join across a comment takes in a second '@' once the run holds one: the
            // address would then split at the last '@', and 'user@company(x).com@attacker.net',
            // which an RFC 5322 parser reads as user@company.com, would go to attacker.net.
            const secondAt = lastTextHasAt && prevOperator === ')' && value.indexOf('@') >= 0;
            const joinsDomain = !secondAt &&
                lastTextOpen &&
                lastTextHasAt &&
                prevOperator === ')' &&
                (lastChars.text === '.' || value.charAt(0) === '.') &&
                gapsFolding &&
                isFoldingGap(tokens.str, gapFrom, tokens.contentStart(i));
            const joins = joinsDomain ||
                (!secondAt &&
                    prevNoBreak &&
                    data[state].length > 0 &&
                    (prevOperator !== ')' || lastChars[state] === '@' || value.charAt(0) === '@'));
            if (joins) {
                // join values
                const last = data[state].length - 1;
                if (state === 'text' && !insideQuotes) {
                    if (lastTextPureQuoted && value.charAt(0) === '@') {
                        data.quotedLocalAt[last] = data.text[last].length;
                    }
                    lastTextPureQuoted = false;
                }
                data[state][last] += value;
                if (state === 'text' && insideQuotes) {
                    data.textWasQuoted[last] = true;
                }
                if (tokens.hasControl(i) && state !== 'comment') {
                    data[state === 'text' ? 'textControl' : 'addressControl'][last] = true;
                }
            }
            else {
                data[state].push(value);
                if (state !== 'comment') {
                    data[state === 'text' ? 'textControl' : 'addressControl'].push(tokens.hasControl(i));
                }
                if (state === 'text') {
                    data.textWasQuoted.push(insideQuotes || opensAfterEmptyQuotedString);
                    // an empty quoted string leaves no text of its own, so the '@' opens the run
                    data.quotedLocalAt.push(opensAfterEmptyQuotedString && value.charAt(0) === '@' ? 0 : -1);
                    lastTextPureQuoted = insideQuotes;
                }
            }
            lastChars[state] = value.charAt(value.length - 1);
            if (state === 'text') {
                lastTextHasAt = (joins && lastTextHasAt) || (!insideQuotes && value.indexOf('@') >= 0);
                lastTextOpen = true;
                gapFrom = tokens.contentEnd(i);
                gapsFolding = true;
            }
        }
    }
    // If there is no text but a comment, replace the two. A comment is never part of a
    // mailbox, so text that came out of one only ever names it: reading an address out of it
    // made '(a@evil.com)' a recipient where no conformant reading has a mailbox at all
    let textFromComment = false;
    if (!data.text.length && data.comment.length) {
        data.text = data.comment;
        data.textControl = data.comment.map(() => false);
        data.comment = [];
        textFromComment = true;
    }
    return { data, textFromComment };
}
/**
 * Name of a group, from the tokens in front of its ':'. A comment names it when no text
 * does, as it names a mailbox.
 *
 * @param tokens Tokens of the whole address list
 * @param from Index of the first token in front of the ':'
 * @param to Index of the ':'
 * @return Decoded name of the group
 */
function groupName(tokens, from, to) {
    // http://tools.ietf.org/html/rfc2822#appendix-A.1.3
    return decodeWords(collectAddressParts(tokens, from, to).data.text.join(' '));
}
/**
 * Converts tokens for a single address into an address object
 *
 * @param tokens Tokens of the whole address list
 * @param from Index of the first token of this address
 * @param to Index just past the last token of this address
 * @return The address object
 */
function _handleAddress(tokens, from, to) {
    const collected = collectAddressParts(tokens, from, to);
    const data = collected.data;
    let textFromComment = collected.textFromComment;
    let i;
    // Comments come out of the angle-addr before anything asks whether one was found, so
    // that brackets holding nothing but a comment read the same as empty ones
    const addressComments = [];
    const addressParts = [];
    // whether a control character was left out of the run the mailbox is read from
    let addressControlled = false;
    data.address.forEach((part, index) => {
        const stripped = stripAddressComments(part);
        for (const comment of stripped.comments) {
            addressComments.push(comment);
        }
        if (stripped.address) {
            if (!addressParts.length) {
                addressControlled = data.addressControl[index];
            }
            addressParts.push(stripped.address);
        }
    });
    data.address = addressParts;
    // If no address was found, try to detect one from regular text
    if (!data.address.length && data.text.length && !textFromComment) {
        // Whitespace beside the '@' is CFWS, so 'user @ good.com' is read as one run. Both
        // tiers read the collapsed runs, and only a run an address comes out of is replaced
        // by its collapsed form, the display text keeps its spacing
        const candidates = data.text.map(part => collapseAtSpacing(part));
        // The first addr-spec in the text is the mailbox, as it is for a conformant parser
        // reading as far as it can. Taking the last one let a comment part two of them and
        // pick the second, 'user@good.com (x) evil@evil.com' named evil.com, while the
        // same two without the comment, one run, named good.com
        for (i = 0; i < data.text.length; i++) {
            // Security fix: Do not extract email addresses from quoted strings
            // RFC 5321 allows @ inside quoted local-parts like "user@domain"@example.com
            // Extracting emails from quoted text leads to misrouting vulnerabilities
            // A run that is a quoted local part with its '@' and domain is an addr-spec of
            // its own, with the quoting put back on, and takes its turn like any other
            const local = data.quotedLocalAt[i];
            const quotedLocal = data.textWasQuoted[i] && local >= 0 && QUOTED_LOCAL_DOMAIN.test(data.text[i].slice(local))
                ? quoteLocalPart(data.text[i])
                : '';
            if (quotedLocal || (!data.textWasQuoted[i] && isAddrSpec(candidates[i]))) {
                data.address = [quotedLocal || candidates[i]];
                addressControlled = data.textControl[i];
                data.text.splice(i, 1);
                data.textWasQuoted.splice(i, 1);
                data.quotedLocalAt.splice(i, 1);
                data.textControl.splice(i, 1);
                break;
            }
        }
        // still no address
        if (!data.address.length) {
            for (i = 0; i < data.text.length; i++) {
                // Security fix: Do not extract email addresses from quoted strings
                if (!data.textWasQuoted[i]) {
                    // handles an email address that has more than one @. The strict tier
                    // found nothing, so it spliced nothing and the indexes still line up
                    const part = candidates[i];
                    const start = looseAddressStart(part);
                    if (start >= 0) {
                        LOOSE_TEXT_ADDR.lastIndex = start;
                        const match = LOOSE_TEXT_ADDR.exec(part);
                        if (match) {
                            data.address = [match[0].trim()];
                            addressControlled = data.textControl[i];
                            // the match takes the whitespace around the address along, so
                            // the text on either side is joined with a single space
                            data.text[i] = (part.slice(0, start) + ' ' + part.slice(start + match[0].length)).trim();
                            break;
                        }
                    }
                    data.text[i] = data.text[i].trim();
                }
            }
        }
    }
    // If there's still no text but a comment exists, replace the two
    if (!data.text.length && data.comment.length) {
        data.text = data.comment;
        data.comment = [];
    }
    // Keep only the first address occurrence, push others to regular text
    if (data.address.length > 1) {
        data.text = data.text.concat(data.address.splice(1));
    }
    // An address is only taken from unquoted text, so anything left in the text at this
    // point that still has to serve as the address carries its quoting in this flag
    const addressFromQuotedText = !data.address.length && data.textWasQuoted.some(wasQuoted => wasQuoted);
    // Join values with spaces
    let text = data.text.join(' ');
    let addressValue = data.address.join(' ');
    // A field that is nothing but encoded words names the mailbox and is not one. The
    // decoded text used to be parsed again when it held an angle-addr, so a word decoding
    // to `CEO <ceo@victim.example>` became that mailbox. Nothing that authenticates the
    // message reads it that way: a DMARC verifier takes the author from the raw header,
    // where the word holds no mailbox, so the message has no author domain to check and
    // the sender it showed here was one no verifier had seen. nodemailer, mailparser and
    // Python read the field as a name as well.
    //
    // `^=\?[^=]+?=$` could not match a base64 word whose padding puts an '=' inside it,
    // so whether a bare encoded word was decoded or left to become the address itself
    // came down to whether its payload happened to need padding.
    if (!addressValue && isEncodedWordsOnly(text.trim())) {
        return { address: '', name: decodeWords(text) };
    }
    if (addressFromQuotedText && text.indexOf('@') >= 0) {
        // The mailbox is still sitting in the text, so it moves over here and is quoted
        // before the recovery below rather than after it. Anything else the text holds
        // came along with it: a comment ends the domain but leaves the atoms behind it in
        // the same text, so '"user"@example.com(x)evil.com' would otherwise hand on
        // 'user@example.com evil.com', a second domain riding along in a value that is no
        // addr-spec at all. Putting the quotes back first is what lets the recovery tell
        // the whitespace a quoted local part may carry from the wreckage trailing one
        // The quotes are gone at this point, so the '@' the domain splits off at is the
        // last one, not the single one collapseAtSpacing insists on
        addressValue = quoteLocalPart(joinAtSpacing(text, domainAt(text)));
        addressControlled = data.textControl.some(Boolean);
        text = '';
    }
    ({ address: addressValue, text } = recoverAddrSpec(addressValue, text));
    // a comment names the mailbox only when nothing else does, as one outside the brackets
    if (!text && addressComments.length) {
        text = addressComments.join(' ');
        textFromComment = true;
    }
    let mailbox = addressValue || (textFromComment ? '' : text) || '';
    let rawName = text || addressValue || '';
    // A control character has no place in an addr-spec. Left out, as it is from a name,
    // 'ceo@vic\x01tim.example' read as ceo@victim.example where Python keeps the character
    // and reads a domain no one can authenticate for, so a run that held one names no
    // mailbox. Nor is the address shown as the name, which would be the same clean
    // looking address again. Decided for the whole run, as a control character the
    // extraction read as a delimiter would otherwise leave a clean address beside it
    if (mailbox && (addressControlled || (!addressValue && data.textControl.some(Boolean)))) {
        if (rawName === mailbox) {
            rawName = '';
        }
        mailbox = '';
    }
    const address = {
        address: mailbox,
        name: decodeWords(rawName)
    };
    // The raw comparison is the check Nodemailer makes, it holds when a single source
    // filled both fields. The decoded one is added because postal-mime decodes names,
    // which also catches a name that decodes to the address itself. Comparing only the
    // decoded name kept a name that mixes an encoded word with plain text as the address
    if (address.address === rawName || address.address === address.name) {
        if (address.address.match(/@/)) {
            address.name = '';
        }
        else {
            address.address = '';
        }
    }
    return address;
}
/**
 * Tokenizer for address field strings
 */
class Tokenizer {
    /**
     * @param str Address field string
     */
    constructor(str) {
        this.str = (str || '').toString();
        this.operatorCurrent = '';
        this.operatorExpecting = '';
        this.node = -1;
        this.escaped = false;
        this.inDomainLiteral = false;
        this.afterAt = false;
        this.inGroup = false;
        this.innerQuoted = false;
        this.innerComment = 0;
        this.innerLiteral = false;
        this.innerEscaped = false;
        this.list = new TokenList(this.str);
        this.operators = {
            '"': '"',
            '(': ')',
            '<': '>',
            ',': '',
            // A group is read in the same pass as the rest of the list, so its ':' only marks
            // where the name ends and its members are tokenized like any other address
            ':': '',
            // Semicolons are not a legal delimiter per the RFC2822 grammar other
            // than for terminating a group, but they are also not valid for any
            // other use in this context.  Given that some mail clients have
            // historically allowed the semicolon as a delimiter equivalent to the
            // comma in their UI, it makes sense to treat them the same as a comma
            // when used outside of a group.
            ';': ''
        };
    }
    /**
     * Tokenizes the original input string
     *
     * @return An array of operator|text tokens
     */
    tokenize() {
        const str = this.str;
        const len = str.length;
        for (let i = 0; i < len; i++) {
            this.checkChar(str.charAt(i), i);
        }
        this.closeText(len);
        // Compacted in place: a text run is trimmed to its value and one left empty is
        // dropped, and the value of a run that is no plain slice is rebuilt and kept aside
        const list = this.list;
        const slots = list.slots;
        let kept = 0;
        for (let i = 0, count = list.length; i < count; i++) {
            const kind = slots[i * 3];
            let start = slots[i * 3 + 1];
            let end = slots[i * 3 + 2];
            if (kind & TOKEN_DIRTY) {
                const value = this.cleanValue(start, end, kind).trim();
                if (!value) {
                    continue;
                }
                list.cleaned.set(kept, value);
            }
            else if (!(kind & TOKEN_OPERATOR)) {
                while (start < end && isSpaceCode(str.charCodeAt(start))) {
                    start++;
                }
                while (end > start && isSpaceCode(str.charCodeAt(end - 1))) {
                    end--;
                }
                if (start === end) {
                    continue;
                }
            }
            slots[kept * 3] = kind;
            slots[kept * 3 + 1] = start;
            slots[kept * 3 + 2] = end;
            kept++;
        }
        list.length = kept;
        return list;
    }
    /**
     * Ends the text run being collected, if there is one
     *
     * @param end Offset just past its last character
     */
    closeText(end) {
        if (this.node >= 0) {
            this.list.slots[this.node * 3 + 2] = end;
            this.node = -1;
        }
    }
    /**
     * Rebuilds the value of a text run that is no plain slice of the field, applying the
     * rules checkChar collects characters by: an escaping backslash is dropped, a line break
     * reads as a space and any other control character is left out
     *
     * @param start Offset of the first character of the run
     * @param end Offset just past its last character
     * @param kind Kind and flags of the run
     * @return Value of the run
     */
    cleanValue(start, end, kind) {
        const str = this.str;
        const escapes = (kind & TOKEN_ESCAPES) !== 0;
        let escaped = (kind & TOKEN_STARTS_ESCAPED) !== 0;
        let value = '';
        for (let i = start; i < end; i++) {
            const chr = str.charAt(i);
            if (escapes && !escaped && chr === '\\') {
                escaped = true;
                continue;
            }
            escaped = false;
            if (chr === '\n') {
                value += ' ';
            }
            else if (chr.charCodeAt(0) >= 0x21 || chr === ' ' || chr === '\t') {
                value += chr;
            }
        }
        return value;
    }
    /**
     * Checks if a character is an operator or text and acts accordingly
     *
     * @param chr Character from the address field
     * @param i Offset of the character in the field
     */
    checkChar(chr, i) {
        // Track RFC 5322 domain-literals ("[" *dtext "]"). The ":" of an IPv6 address-literal
        // (user@[IPv6:2001:db8::1]) is dtext and must not be read as the group delimiter while
        // inside the brackets. That is the only operator the literal hides: letting it hide
        // the others as well meant a "[" could turn the comment, quoted string or angle-addr
        // after it into text and pick a different mailbox, '[ ( ] <a@victim.com> ) <b@evil.com>'
        // yielded a@victim.com where RFC 5322 reads b@evil.com. A "[" also only opens a literal
        // right after the "@" of an addr-spec, so the group delimiter of a display name
        // holding one stays intact. Quoted strings and comments are handled via
        // operatorExpecting, so this state is only entered when no operator is open. The list
        // separators "," and ";" always end the literal, so that an unclosed "[" can not
        // swallow later recipients.
        if (!this.escaped && !this.operatorExpecting) {
            if (!this.inDomainLiteral && chr === '[' && this.afterAt) {
                this.inDomainLiteral = true;
            }
            else if (this.inDomainLiteral && (chr === ']' || chr === ',' || chr === ';')) {
                this.inDomainLiteral = false;
            }
        }
        // The closer of an angle-addr is only read outside the quoted strings, comments and
        // domain literals it holds. Looking for nothing but the closer let a '>' inside a
        // quoted local part end the angle-addr, '<"a@evil.com>"@good.com>' was read as an
        // address at evil.com. The characters are still collected as they are, the angle-addr
        // is read again later
        let nested = false;
        if (this.operatorExpecting === '>') {
            nested = this.trackInner(chr);
            if (!nested && chr === ';' && this.inGroup) {
                // The ';' of a group ends an angle-addr left open inside it, as it always did
                // when a group was cut out of the field at its ';' and parsed on its own. Read
                // as text instead, an unclosed '<' swallowed the end of the group and every
                // recipient after it
                this.closeText(i);
                this.operatorExpecting = '';
                this.resetInner();
            }
        }
        else if (this.operatorExpecting === ')' && !this.escaped) {
            // Comments nest (RFC 5322 3.2.2). Ending one at the first ')' let the ')' of a
            // nested comment close the outer one and released the rest of it, an address
            // included, into the header
            if (chr === '(') {
                this.innerComment++;
            }
            else if (chr === ')' && this.innerComment) {
                this.innerComment--;
                nested = true;
            }
        }
        if (this.escaped) {
            // ignore next condition blocks
        }
        else if (chr === this.operatorExpecting && !nested) {
            const nextChr = this.str.charAt(i + 1);
            this.closeText(i);
            this.list.push(nextChr && ![' ', '\t', '\r', '\n', ',', ';'].includes(nextChr)
                ? TOKEN_OPERATOR | TOKEN_NO_BREAK
                : TOKEN_OPERATOR, i, i + 1);
            if (chr !== ')') {
                // a comment is folding whitespace, it does not part the "@" from the "["
                this.afterAt = false;
            }
            this.operatorExpecting = '';
            this.escaped = false;
            this.resetInner();
            return;
        }
        else if (!this.operatorExpecting && !(this.inDomainLiteral && chr === ':') && chr in this.operators) {
            this.closeText(i);
            this.list.push(TOKEN_OPERATOR, i, i + 1);
            if (chr === ':') {
                this.inGroup = true;
            }
            else if (chr === ';') {
                this.inGroup = false;
            }
            if (chr !== '(') {
                this.afterAt = false;
            }
            this.operatorExpecting = this.operators[chr];
            this.escaped = false;
            this.resetInner();
            return;
        }
        else if ((this.operatorExpecting === '"' || this.operatorExpecting === ')') && chr === '\\') {
            // A backslash escapes the next character inside a quoted string and inside a
            // comment alike (RFC 5322 3.2.2, ccontent includes quoted-pair). Honouring it
            // only in quoted strings let an escaped parenthesis close the comment, which
            // released the rest of it, an address included, into the header
            this.escaped = true;
            if (this.node >= 0) {
                // the backslash is left out of the value
                this.list.slots[this.node * 3] |= TOKEN_DIRTY;
            }
            return;
        }
        if (this.node < 0) {
            this.node = this.list.push((this.operatorExpecting === '"' || this.operatorExpecting === ')' ? TOKEN_ESCAPES : 0) |
                (this.escaped ? TOKEN_STARTS_ESCAPED : 0), i, i);
        }
        if (chr === '\n') {
            // Convert newlines to spaces. Carriage return is ignored as \r and \n usually
            // go together anyway and there already is a WS for \n. Lone \r means something is fishy.
            chr = ' ';
            this.list.slots[this.node * 3] |= TOKEN_DIRTY;
        }
        if (chr.charCodeAt(0) >= 0x21 || chr === ' ' || chr === '\t') {
            // the character is part of the value, which is read off the field later
            // text inside a quoted string or a comment is not part of an addr-spec. Tracked
            // as it goes rather than read back off the value (see lastChars in _handleAddress)
            if (!this.operatorExpecting && chr !== ' ' && chr !== '\t') {
                this.afterAt = chr === '@';
            }
        }
        else {
            // skip command bytes
            this.list.slots[this.node * 3] |= chr === '\r' ? TOKEN_DIRTY : TOKEN_DIRTY | TOKEN_CONTROL;
        }
        this.escaped = false;
    }
    /**
     * Tracks the quoted strings, comments and domain literals inside an angle-addr, which its
     * closer must not be read from. A backslash escapes the next character inside a quoted
     * string and a comment. A domain literal opens right after an "@" and ends at the "]".
     * dtext holds the list separators as well, and inside the brackets they never split the
     * list anyway.
     *
     * @param chr Character from the address field
     * @return true while the character sits inside one of them, the one that closes it included
     */
    trackInner(chr) {
        if (this.innerEscaped) {
            this.innerEscaped = false;
            return true;
        }
        if (this.innerQuoted) {
            if (chr === '\\') {
                this.innerEscaped = true;
            }
            else if (chr === '"') {
                this.innerQuoted = false;
            }
            return true;
        }
        if (this.innerComment) {
            if (chr === '\\') {
                this.innerEscaped = true;
            }
            else if (chr === '(') {
                this.innerComment++;
            }
            else if (chr === ')') {
                this.innerComment--;
            }
            return true;
        }
        if (this.innerLiteral) {
            if (chr === ']') {
                this.innerLiteral = false;
            }
            return true;
        }
        if (chr === '"') {
            this.innerQuoted = true;
            return true;
        }
        if (chr === '(') {
            this.innerComment = 1;
            return true;
        }
        if (chr === '[' && this.afterAt) {
            this.innerLiteral = true;
            return true;
        }
        // afterAt is otherwise only kept outside the operators and is cleared when one opens
        // or ends, so inside an angle-addr it serves the literal tracked here
        if (!isSpaceCode(chr.charCodeAt(0))) {
            this.afterAt = chr === '@';
        }
        return false;
    }
    /**
     * Forgets the nesting collected for the operator that just opened or ended
     */
    resetInner() {
        this.innerQuoted = false;
        this.innerComment = 0;
        this.innerLiteral = false;
        this.innerEscaped = false;
    }
}
/**
 * Folds the fragments an unquoted display name holding a comma is split into back together.
 *
 * "Joe Foo, PhD <joe@example.com>" is split on the comma into
 * [{name:"Joe Foo", address:""}, {name:"PhD", address:"joe@example.com"}]. A name-only entry
 * followed by an entry with both name and address is recombined. Walked back to front so
 * that a run of fragments folds into one entry in a single pass. Splicing each fragment out
 * of the list instead would be quadratic.
 *
 * @param list Parsed entries, in order
 * @return The entries with the fragments folded in
 */
function mergeNameFragments(list) {
    const merged = [];
    for (let i = list.length - 1; i >= 0; i--) {
        const current = list[i];
        const next = merged.length ? merged[merged.length - 1] : null;
        if (next && current.address === '' && current.name && !current.group && next.address && next.name) {
            next.name = current.name + ', ' + next.name;
        }
        else {
            merged.push(current);
        }
    }
    return merged.reverse();
}
/**
 * Parses an address list, groups included, in a single pass over its tokens.
 *
 * A group used to be cut out of the field at the ';' that ends it and parsed again as an
 * address list of its own, recursively, so every level of nesting parsed what was left of
 * the field once more. RFC 5322 does not nest groups at all, and the nested ones were
 * flattened anyway. The tokens are now walked once: a ':' opens a group, its members are
 * read as they come, a ';' closes it. A ':' inside an open group stands for a group nested
 * in it, whose name is dropped and whose members belong to the outer one, and the first ';'
 * ends the group, nested or not, as before.
 *
 * @param str Address field
 * @return An array of address objects
 */
function parseAddressList(str) {
    const tokens = new Tokenizer(str).tokenize();
    const parsedAddresses = [];
    let group = null;
    let members = [];
    // Every address is handed over as the range of the token list it covers, as soon as the
    // separator after it is seen. Copying the tokens of each address into an array of its own,
    // and collecting those before handling any, held a second structure as large as the token
    // list for the whole parse, and an array that receives a single push is allocated room for
    // seventeen: a list of one letter names took some 80 times its size in that alone
    let from = 0;
    for (let i = 0, len = tokens.length; i <= len; i++) {
        const operator = i < len ? tokens.operatorAt(i) : '';
        if (i < len && operator !== ',' && operator !== ';' && operator !== ':') {
            continue;
        }
        if (operator === ':') {
            if (!group) {
                group = { name: groupName(tokens, from, i), group: [] };
                members = [];
            }
            from = i + 1;
            continue;
        }
        if (i > from) {
            // Appended in place. Rebuilding the list with concat() for every address copies
            // everything parsed so far and is quadratic in the number of addresses.
            (group ? members : parsedAddresses).push(_handleAddress(tokens, from, i));
        }
        from = i + 1;
        if (group && (operator === ';' || i === len)) {
            group.group = mergeNameFragments(members);
            parsedAddresses.push(group);
            group = null;
        }
    }
    return mergeNameFragments(parsedAddresses);
}
/**
 * Parses structured e-mail addresses from an address field
 *
 * Example:
 *
 *    'Name <address@domain>'
 *
 * will be converted to
 *
 *     [{name: 'Name', address: 'address@domain'}]
 *
 * @param str Address field
 * @param options Optional options object
 * @return An array of address objects
 */
function addressParser(str, options) {
    const parsedAddresses = parseAddressList(str);
    if (options && options.flatten) {
        let addresses = [];
        let walkAddressList = (list) => {
            list.forEach(address => {
                if (address.group) {
                    return walkAddressList(address.group);
                }
                else {
                    addresses.push(address);
                }
            });
        };
        walkAddressList(parsedAddresses);
        return addresses;
    }
    return parsedAddresses;
}
// expose to the world

// --- postal-mime.js -------------------------------------------------
function isReadableStream(value) {
    return !!value && typeof value.getReader === 'function';
}
function isBlob(value) {
    return value instanceof Blob || Object.prototype.toString.call(value) === '[object Blob]';
}
// Checked by tag rather than instanceof, which fails for a buffer from another realm
function isArrayBuffer(value) {
    const tag = Object.prototype.toString.call(value);
    return tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]';
}
const ATTACHMENT_ENCODINGS = new Set(['arraybuffer', 'base64', 'utf8']);
// Checked up front, an unknown encoding used to reject only once the whole message had
// been parsed
function parseAttachmentEncoding(value) {
    const encoding = String(value || '')
        .replace(/[-_\s]/g, '')
        .toLowerCase() || 'arraybuffer';
    if (!ATTACHMENT_ENCODINGS.has(encoding)) {
        throw createError('EINVALIDOPTION', `Unknown attachment encoding ${encoding}`);
    }
    return encoding;
}
// Renders one entry of a node as the requested text type. A text part of the other type
// is converted, and a nested message becomes a header block in that format
function renderEntry(textEntry, textType, convert) {
    if (textEntry.type === 'subMessage') {
        return textType === 'html' ? formatHtmlHeader(textEntry.value) : formatTextHeader(textEntry.value);
    }
    if (!convert) {
        return textEntry.value;
    }
    return textType === 'html' ? textToHtml(textEntry.value) : htmlToText(textEntry.value);
}
// The line break given to the last line of a message that ends without one, see readLine
const LINE_FEED = new Uint8Array([0x0a]);
const MAX_NESTING_DEPTH = 256;
const MAX_HEADERS_SIZE = 2 * 1024 * 1024;
// The depth limit does not bound the size of the tree. An empty part costs six bytes of
// input (`--b` and a blank line) and over a kilobyte of parser state at its peak, so a
// flat multipart of a million empty parts took a 7 MB message to 1.4 GB of memory.
const MAX_PART_COUNT = 10000;
// Inline message/rfc822 parts are parsed recursively. Without a dedicated limit
// each nesting level spawns a new parser that retains the full nested message,
// so a small crafted email can exhaust memory (OOM crash). Cap the recursion and
// treat deeper nested messages as regular attachments instead.
const MAX_RFC822_NESTING_DEPTH = 10;
// The From, To, Cc and Bcc of every inline message/rfc822 part are rendered into the
// text and html of the parent, an address of one or two bytes as some 60 characters of
// html. maxHeadersSize bounds the header bytes, not the addresses they hold, so without
// a limit of their own the output grows with the number of forwards.
const MAX_FORWARDED_ADDRESSES = 10000;
// the number of entries the header formatters render for a list of addresses, a group
// counted along with each of its members
function countAddresses(addresses) {
    if (!addresses) {
        return 0;
    }
    let count = 0;
    for (const address of Array.isArray(addresses) ? addresses : [addresses]) {
        count += 1 + (address.group ? address.group.length : 0);
    }
    return count;
}
// Limit options must be validated rather than falsy-coalesced. `0` would silently
// restore the default, and a string or NaN disables the limit altogether, because
// every `size > limit` comparison against such a value is false. Callers that
// forward a request supplied options object would otherwise hand an attacker a way
// to turn the limits off.
function parseLimitOption(value, defaultValue, name, min = 0) {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
        throw createError('EINVALIDOPTION', `${name} must be a ${min ? 'positive' : 'non-negative'} integer`);
    }
    return value;
}
function parseLimits(options) {
    return {
        maxNestingDepth: parseLimitOption(options.maxNestingDepth, MAX_NESTING_DEPTH, 'maxNestingDepth'),
        maxHeadersSize: parseLimitOption(options.maxHeadersSize, MAX_HEADERS_SIZE, 'maxHeadersSize'),
        // The root part is always counted, so a limit of zero can parse nothing, not even
        // an empty message, and it threw EMAXPARTCOUNT from the constructor, where only
        // EINVALIDOPTION is thrown
        maxPartCount: parseLimitOption(options.maxPartCount, MAX_PART_COUNT, 'maxPartCount', 1),
        // A limit of 0 disables inline parsing entirely, so every message/rfc822 part
        // becomes an attachment.
        maxRfc822NestingDepth: parseLimitOption(options.maxRfc822NestingDepth, MAX_RFC822_NESTING_DEPTH, 'maxRfc822NestingDepth'),
        maxForwardedAddresses: parseLimitOption(options.maxForwardedAddresses, MAX_FORWARDED_ADDRESSES, 'maxForwardedAddresses')
    };
}
class PostalMime {
    /**
     * Parses a raw email message
     *
     * @param buf Raw email message
     * @param options Parser options
     * @returns The parsed email
     */
    // async so that an invalid option rejects the returned promise instead of throwing
    // synchronously, which would escape a `.catch()` chain
    static async parse(buf, options) {
        const parser = new PostalMime(options);
        return parser.parse(buf);
    }
    constructor(options, parent) {
        this.options = options || {};
        // Internal state that a nested parser receives from its parent. It is deliberately
        // not an option, so that forwarding a caller supplied options object can not seed
        // it and switch the recursion limit off or start the counters over.
        this.rfc822NestingDepth = parent ? parent.rfc822NestingDepth + 1 : 0;
        // Set before the root part is created, since the root is counted and checked too
        this.limits = parent ? parent.limits : parseLimits(this.options);
        this.counters = parent ? parent.counters : { headerSize: 0, partCount: 0, forwardedAddresses: 0 };
        this.root = this.currentNode = new MimeNode({ postalMime: this });
        this.boundaries = new BoundaryStack();
        this.textContent = {};
        this.textMap = new Map();
        this.textTypes = new Set();
        this.attachments = [];
        this.forceRfc822Attachments = false;
        this.attachmentEncoding = parseAttachmentEncoding(this.options.attachmentEncoding);
        this.started = false;
    }
    /** @internal */
    async finalize() {
        // close all pending nodes
        await this.root.finalize();
    }
    /** @internal */
    async processLine(line, lineBreak, isFinal) {
        const match = this.boundaries.match(line);
        if (match) {
            if (match.isTerminator) {
                await match.node.finalize(true);
                this.currentNode = match.node.parentNode || this.root;
            }
            else {
                // finalize any open child nodes (should be just one though)
                await match.node.finalizeChildNodes(true);
                this.currentNode = new MimeNode({
                    postalMime: this,
                    parentNode: match.node,
                    parentMultipartType: match.node.contentType.multipart
                });
            }
            if (isFinal) {
                return this.finalize();
            }
            return;
        }
        if (this.currentNode.feed(line, lineBreak)) {
            // The headers ended with the line before this one, so the boundary this part
            // declares was not registered when the line was checked above. Read it again
            return this.processLine(line, lineBreak, isFinal);
        }
        if (isFinal) {
            return this.finalize();
        }
    }
    // Reads the next line without its line break. The break itself, the exact bytes between
    // the line and the next one, is returned alongside, because the body decoders write it
    // back out: a part has to keep the line endings it was sent with, see PassThroughDecoder.
    /** @internal */
    readLine() {
        let startPos = this.readPos;
        let endPos = this.readPos;
        while (this.readPos < this.av.length) {
            const c = this.av[this.readPos++];
            if (c !== 0x0d && c !== 0x0a) {
                endPos = this.readPos;
            }
            if (c === 0x0a) {
                return {
                    bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
                    lineBreak: this.av.subarray(endPos, this.readPos),
                    done: this.readPos >= this.av.length
                };
            }
        }
        // A message that ends without a line break still gets one after its last line, the
        // decoders write it out unless a boundary ended the part
        return {
            bytes: new Uint8Array(this.buf, startPos, endPos - startPos),
            lineBreak: LINE_FEED,
            done: this.readPos >= this.av.length
        };
    }
    // Records a text part or a nested message under the node that selects it
    /** @internal */
    addTextEntry(selector, textType, item) {
        let textEntry = this.textMap.get(selector);
        if (!textEntry) {
            textEntry = {};
            this.textMap.set(selector, textEntry);
        }
        const entries = textEntry[textType] || [];
        textEntry[textType] = entries;
        entries.push(item);
        this.textTypes.add(textType);
    }
    // Sorts every leaf of the tree into text content, nested messages and attachments.
    // `alternative` is the closest enclosing multipart/alternative, if any: its text parts
    // are collected under the alternative itself, so that the body is assembled from one
    // representation of it rather than from every one. `related` tells whether the part
    // sits inside a multipart/related, where a Content-ID makes it an inline resource
    /** @internal */
    async collectNode(node, alternative, related) {
        if (!node.contentType.multipart) {
            const inlineRfc822 = this.isInlineMessageRfc822(node);
            const rfc822DepthExceeded = inlineRfc822 && this.rfc822NestingDepth >= this.limits.maxRfc822NestingDepth;
            if (inlineRfc822 && !rfc822DepthExceeded) {
                await this.collectSubMessage(node);
            }
            else if (this.isInlineTextNode(node)) {
                const textType = node.contentType.parsed.value === 'text/html' ? 'html' : 'plain';
                this.addTextEntry(alternative || node, textType, { type: 'text', value: node.getTextContent() });
            }
            else if (node.content) {
                this.collectAttachment(node, node.content, related, rfc822DepthExceeded);
            }
        }
        else if (node.contentType.multipart === 'alternative') {
            alternative = node;
        }
        else if (node.contentType.multipart === 'related') {
            related = true;
        }
        for (let childNode of node.childNodes) {
            await this.collectNode(childNode, alternative, related);
        }
    }
    // Parses an inline message/rfc822 part with a nested parser and takes over its text
    // parts and attachments
    /** @internal */
    async collectSubMessage(node) {
        const subParser = new PostalMime({
            // Options that decide how a part is classified stay with the parser that
            // was configured, the limits and their counters come from this parser.
            // Attachments are encoded by the parent parser, so raw buffers are kept here.
            attachmentEncoding: 'arraybuffer'
        }, this);
        const subMessage = await subParser.parse(node.content || new ArrayBuffer(0));
        // counted before the header block below is rendered into the text and html
        this.counters.forwardedAddresses +=
            countAddresses(subMessage.from) +
                countAddresses(subMessage.to) +
                countAddresses(subMessage.cc) +
                countAddresses(subMessage.bcc);
        if (this.counters.forwardedAddresses > this.limits.maxForwardedAddresses) {
            throw createError('EMAXFORWARDEDADDRESSES', `Maximum forwarded address count of ${this.limits.maxForwardedAddresses} addresses exceeded`);
        }
        // The nested parser renders no text, see parse, its text parts are taken over below
        // and rendered by the root parser along with everything else. What it holds of each
        // kind is read off its text types instead of its text and html
        const hasPlain = subParser.textTypes.has('plain');
        const hasHtml = subParser.textTypes.has('html');
        // default to text if there is no content
        if (hasPlain || !hasHtml) {
            this.addTextEntry(node, 'plain', { type: 'subMessage', value: subMessage });
        }
        if (hasHtml) {
            this.addTextEntry(node, 'html', { type: 'subMessage', value: subMessage });
        }
        subParser.textMap.forEach((subTextEntry, subTextNode) => {
            this.textMap.set(subTextNode, subTextEntry);
        });
        for (let attachment of subMessage.attachments) {
            this.attachments.push(attachment);
        }
    }
    /** @internal */
    collectAttachment(node, content, related, rfc822DepthExceeded) {
        const filename = node.contentDisposition.parsed.params.filename || node.contentType.parsed.params.name || null;
        // `content` is filled in below once the part type is known, hence the cast
        const attachment = {
            // An RFC 2231 filename is percent decoded without folding, since the same decoder
            // produces the boundary, so the fold happens here, see foldLineBreaks
            filename: filename ? decodeWords(foldLineBreaks(filename)) : null,
            mimeType: node.contentType.parsed.value,
            disposition: node.contentDisposition.parsed.value || null
        };
        // A nested message that was not parsed is not a renderable inline
        // resource, so it must not join the cid map behind an <img src>.
        if (related && node.contentId && !rfc822DepthExceeded) {
            attachment.related = true;
        }
        if (rfc822DepthExceeded) {
            // Tell the caller this part would have been parsed inline but hit
            // maxRfc822NestingDepth, so anything inside it is not reflected in
            // email.text, email.html or email.attachments.
            attachment.rfc822DepthExceeded = true;
        }
        if (node.contentDescription) {
            // decoded like filename, it is an unstructured header that may
            // carry encoded words
            attachment.description = decodeWords(node.contentDescription);
        }
        if (node.contentId) {
            attachment.contentId = node.contentId;
        }
        switch (node.contentType.parsed.value) {
            // Special handling for calendar events
            case 'text/calendar':
            case 'application/ics': {
                if (node.contentType.parsed.params.method) {
                    attachment.method = node.contentType.parsed.params.method.toString().toUpperCase().trim();
                }
                // Enforce into unicode, ending in exactly one newline. The trailing
                // newlines are counted rather than replaced with `/\n*$/`, which
                // retries at every newline of a run that does not end the text.
                const decodedText = node.getTextContent();
                let end = decodedText.length;
                while (end > 0 && decodedText.charCodeAt(end - 1) === 0x0a) {
                    end--;
                }
                attachment.content = textEncoder.encode(decodedText.slice(0, end) + '\n');
                break;
            }
            // Regular attachments
            default:
                attachment.content = content;
        }
        this.attachments.push(attachment);
    }
    // Joins the collected text parts into the plain and html bodies
    /** @internal */
    renderTextContent() {
        const textContent = {};
        this.textMap.forEach(mapEntry => {
            this.textTypes.forEach(textType => {
                const output = textContent[textType] || [];
                textContent[textType] = output;
                // a node without a part of this type is rendered from the other type
                const ownEntries = mapEntry[textType];
                const entries = ownEntries || mapEntry[textType === 'html' ? 'plain' : 'html'] || [];
                for (const textEntry of entries) {
                    output.push(renderEntry(textEntry, textType, !ownEntries));
                }
            });
        });
        Object.keys(textContent).forEach(textType => {
            this.textContent[textType] = textContent[textType].join('\n');
        });
    }
    /** @internal */
    isInlineTextNode(node) {
        if (node.contentDisposition.parsed.value === 'attachment') {
            // no matter the type, this is an attachment
            return false;
        }
        switch (node.contentType.parsed.value) {
            case 'text/html':
            case 'text/plain':
                return true;
            case 'text/calendar':
            case 'text/csv':
            default:
                return false;
        }
    }
    /** @internal */
    isInlineMessageRfc822(node) {
        if (this.forceRfc822Attachments || node.contentType.parsed.value !== 'message/rfc822') {
            return false;
        }
        // RFC 2046 5.2.1 allows no encoding but 7bit, 8bit and binary for a message/rfc822
        // body. Python parses the lines of a base64 or quoted-printable part as they are, so
        // the nested message it sees has no headers and holds the encoded text, and
        // mailparser keeps the part as one attachment. Decoding and inlining it here
        // rendered the html and listed the attachments of a message no scanner built on
        // either reads, so such a part is an attachment, with its content decoded
        const encoding = node.contentTransferEncoding.encoding;
        if (encoding === 'base64' || encoding === 'quoted-printable') {
            return false;
        }
        let disposition = node.contentDisposition.parsed.value || (this.options.rfc822Attachments ? 'attachment' : 'inline');
        return disposition === 'inline';
    }
    // A delivery status or feedback report carries the offending message as a part. It is
    // evidence rather than content, so it is not inlined into the body of the report
    /** @internal */
    hasReportParts() {
        let found = false;
        let walk = (node) => {
            if (!node.contentType.multipart) {
                if (['message/delivery-status', 'message/feedback-report'].includes(node.contentType.parsed.value)) {
                    found = true;
                }
            }
            for (let childNode of node.childNodes) {
                walk(childNode);
            }
        };
        walk(this.root);
        return found;
    }
    /** @internal */
    async resolveStream(stream) {
        let chunkLen = 0;
        let chunks = [];
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            // A chunk that is not a byte view, eg. a string from a text stream, used to be
            // copied in as zeros
            if (!ArrayBuffer.isView(value)) {
                const error = createError('EINVALIDINPUT', 'Stream chunks must be Uint8Array values');
                // Not awaited, a source that fails or stalls on cancel must not hide this error
                reader.cancel(error).catch(() => { });
                throw error;
            }
            chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
            chunkLen += value.byteLength;
        }
        const result = new Uint8Array(chunkLen);
        let chunkPointer = 0;
        for (let chunk of chunks) {
            result.set(chunk, chunkPointer);
            chunkPointer += chunk.length;
        }
        return result;
    }
    /** @internal */
    async resolveInput(buf) {
        let input = buf;
        // Check if the input is a readable stream and resolve it into an ArrayBuffer
        if (isReadableStream(input)) {
            input = await this.resolveStream(input);
        }
        // Should it throw for an empty value instead of defaulting to an empty ArrayBuffer?
        input = input || new ArrayBuffer(0);
        // Cast string input to Uint8Array
        if (typeof input === 'string') {
            input = textEncoder.encode(input);
        }
        // Cast Blob to ArrayBuffer
        if (isBlob(input)) {
            input = await blobToArrayBuffer(input);
        }
        // Cast a Node.js Buffer, a typed array or a DataView into an ArrayBuffer.
        // `new Uint8Array(view)` only works for array-likes, so a DataView produced an
        // empty buffer and the message parsed to nothing without an error. Slicing off
        // byteOffset also keeps views over a larger buffer from reading their neighbours.
        if (ArrayBuffer.isView(input)) {
            return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        }
        // Anything else, eg. a number or a plain object, was handed to the Uint8Array
        // constructor as it is and parsed into an empty or zero filled message
        if (!isArrayBuffer(input)) {
            throw createError('EINVALIDINPUT', 'Unsupported email input type');
        }
        return input;
    }
    // Properties are added in the order the output has always had them, so the required
    // ones are filled in below rather than in the literal
    /** @internal */
    buildMessage() {
        const headers = this.root.headers;
        const message = {
            headers: headers.map(entry => ({
                key: entry.key,
                originalKey: entry.originalKey,
                value: entry.value
            }))
        };
        for (const key of ['from', 'sender']) {
            const addressHeader = headers.find(line => line.key === key);
            if (addressHeader && addressHeader.value) {
                const addresses = addressParser(addressHeader.value);
                if (addresses && addresses.length) {
                    message[key] = addresses[0];
                }
            }
        }
        for (const [key, camelKey] of [
            ['delivered-to', 'deliveredTo'],
            ['return-path', 'returnPath']
        ]) {
            const addressHeader = headers.find(line => line.key === key);
            if (addressHeader && addressHeader.value) {
                const addresses = addressParser(addressHeader.value);
                if (addresses && addresses.length && addresses[0].address) {
                    message[camelKey] = addresses[0].address;
                }
            }
        }
        for (const [key, camelKey] of [
            ['to', 'to'],
            ['cc', 'cc'],
            ['bcc', 'bcc'],
            ['reply-to', 'replyTo']
        ]) {
            // Appended in place, concat() copies the whole list for every header
            const addresses = [];
            for (const entry of headers) {
                if (entry.key === key && entry.value) {
                    for (const address of addressParser(entry.value)) {
                        addresses.push(address);
                    }
                }
            }
            if (addresses.length) {
                message[camelKey] = addresses;
            }
        }
        for (const [key, camelKey] of [
            ['subject', 'subject'],
            ['message-id', 'messageId'],
            ['in-reply-to', 'inReplyTo'],
            ['references', 'references']
        ]) {
            const header = headers.find(line => line.key === key);
            if (header && header.value) {
                message[camelKey] = decodeWords(header.value);
            }
        }
        let dateHeader = headers.find(line => line.key === 'date');
        if (dateHeader) {
            let date = new Date(dateHeader.value);
            // enforce ISO format if seems to be a valid date
            message.date = date.toString() === 'Invalid Date' ? dateHeader.value : date.toISOString();
        }
        const otp = getOtp(headers);
        if (otp) {
            message.otp = otp;
        }
        if (this.textContent.html) {
            message.html = this.textContent.html;
        }
        if (this.textContent.plain) {
            message.text = this.textContent.plain;
        }
        message.attachments = this.attachments;
        // Expose raw header lines, in the same order as the headers array
        message.headerLines = this.root.rawHeaderLines.slice();
        return message;
    }
    // Every attachment holds binary content at this point, since nested parsers are
    // created with the arraybuffer encoding. The string check narrows the public content
    // type rather than handling a reachable case
    /** @internal */
    encodeAttachments() {
        switch (this.attachmentEncoding) {
            case 'arraybuffer':
                break;
            case 'base64':
                for (let attachment of this.attachments) {
                    if (attachment.content && typeof attachment.content !== 'string') {
                        attachment.content = base64ArrayBuffer(attachment.content);
                        attachment.encoding = 'base64';
                    }
                }
                break;
            case 'utf8': {
                let attachmentDecoder = new TextDecoder('utf8');
                for (let attachment of this.attachments) {
                    if (attachment.content && typeof attachment.content !== 'string') {
                        attachment.content = attachmentDecoder.decode(attachment.content);
                        attachment.encoding = 'utf8';
                    }
                }
                break;
            }
        }
    }
    /**
     * Parses a raw email message. A parser instance can be used once
     *
     * @param buf Raw email message
     * @returns The parsed email
     */
    async parse(buf) {
        if (this.started) {
            throw createError('EPARSERREUSED', 'Can not reuse parser, create a new PostalMime object');
        }
        this.started = true;
        this.buf = await this.resolveInput(buf);
        this.av = new Uint8Array(this.buf);
        this.readPos = 0;
        while (this.readPos < this.av.length) {
            const line = this.readLine();
            await this.processLine(line.bytes, line.lineBreak, line.done);
        }
        this.forceRfc822Attachments = Boolean(this.options.forceRfc822Attachments) || this.hasReportParts();
        await this.collectNode(this.root, false, false);
        // A nested parser hands its text parts to its parent, see collectSubMessage, and the
        // root parser renders them all at once. Rendering at every level as well cost each
        // level the text and html of everything below it, and kept them until the root was
        // done: a chain of forwards as deep as maxRfc822NestingDepth allows took ten times
        // the time and the memory of the flat message it held
        if (this.rfc822NestingDepth === 0) {
            this.renderTextContent();
        }
        const message = this.buildMessage();
        this.encodeAttachments();
        return message;
    }
}

// ------------------------------------------------------------
// ÚNICA línia afegida pel projecte «Què fas?»: obre la classe al
// worker.js. Si concatenes aquest fitxer dins worker.js, esborra-la.
// ------------------------------------------------------------

// ============================================================
// ============================================================
//
//   FI DE LA DEPENDÈNCIA VENDORITZADA — COMENÇA EL WORKER
//
//   Tot el que hi ha a SOBRE d'aquesta línia és postal-mime
//   4.2.1, copiat tal qual de worker/postal-mime.js (CLAUDE.md
//   §3). No l'editis: si algun dia cal actualitzar-lo, es torna
//   a generar aquest fitxer sencer, no es pedaça aquí.
//
//   Tot el que hi ha a SOTA és worker/worker.js, idèntic llevat
//   de tres línies: se n'ha tret l'`import PostalMime from
//   './postal-mime.js'` i les dues línies en blanc que l'envolten.
//   L'import no cal perquè la classe ja és definida més amunt, al
//   mateix fitxer. Ho comprova eines/verifica-worker-concatenat.js.
//
//   AQUEST FITXER ÉS EL QUE S'ENGANXA AL TAULER DE CLOUDFLARE.
//   És generat, no escrit a mà: no és la font de veritat. Els
//   canvis es fan a worker/worker.js i després es torna a
//   generar aquest.
//
// ============================================================
// ============================================================

// ============================================================

// ============================================================
// WORKER — «Què fas?» · l'únic servidor del projecte
//
// Té dues portes d'entrada, i totes dues acaben al mateix lloc: una
// fila pendent a `pendents.json`, que el curador revisa.
//   `email()`  (Fase 2)  — un correu a agenda@clm.cat. L'original
//                          SEMPRE acaba arxivat al Gmail.
//   `fetch()`  (Fase 3a) — el POST del webhook del formulari
//                          Typebot, amb secret compartit.
//   `scheduled()` (Fase 3b) — el digest setmanal de Brevo. És
//                          l'única porta que no escriu res enlloc:
//                          llegeix `events.json` i envia correu.
//
// EL CAMÍ D'UN CORREU, en ordre:
//   1. reenviament a l'arxiu  ← el primer de tot, i passi el que passi
//   2. postal-mime            → assumpte + cos de text + adjunts
//   3. Cloudinary             → fins a quatre cartells adjunts, ABANS de
//                               Claude, perquè el model els pugui veure
//                               (D-13). Un cartell que no puja es perd,
//                               la fila no
//   4. Claude                 → UNA crida: el text i els cartells, i
//                               torna una llista d'actes (fins a deu),
//                               cadascun amb el número del seu cartell
//   5. pendents.json          → filaSegura() per a cada acte; fora els
//                               que ja han passat i els que ja són a la
//                               cua; totes les files en un sol commit.
//                               Cap acte trobat = una fila buida amb
//                               l'avís, perquè el curador ho vegi
//
// EL CAMÍ D'UNA TRAMESA DEL FORMULARI, en ordre:
//   1. el secret de la capçalera  ← el primer de tot; si no, 403
//   2. només POST                 → qualsevol altre mètode, 405
//   3. mapa determinista          → camp a camp: el formulari ja dona
//                                   els camps separats, i el cartell
//                                   ja ha pujat a Cloudinary des del
//                                   navegador de qui l'envia
//   4. Claude                     → UNA crida, només per traduir la
//                                   descripció a la llengua que falta
//                                   i donar el títol en català (D-12).
//                                   Si falla, la fila entra igual,
//                                   amb un avís al curador
//   5. pendents.json              → filaSegura(), com el correu
//
// LA INVARIANT: cap correu no es perd mai. El reenviament a l'arxiu
// es fa ABANS de qualsevol altra cosa i no llança mai. Tot el que ve
// després pot fallar tant com vulgui: l'original ja és a l'arxiu i
// l'error queda al registre. I si no hi ha on arxivar-lo —falta la
// variable ADRECA_ARXIU—, el correu es REBUTJA: el remitent rep un
// avís de no-entrega i el pot tornar a enviar. Empassar-se un correu
// en silenci és l'única cosa que no ens podem permetre.
// Res no arriba mai al web públic sense passar pel curador.
//
// EL CAMÍ DEL DIGEST, en ordre:
//   1. la porta de l'hora     ← el cron de Cloudflare és en UTC i no
//                               sap res de l'horari d'estiu: el
//                               Worker es desperta cada deu minuts
//                               entre les 13.00 i les 14.59 UTC dels
//                               dimarts, i només treballa quan a
//                               París són les 15
//   2. events.json            → per l'API de GitHub, mai de Pages
//   3. la finestra            → els actes «publicat» que comencen
//                               d'avui a d'aquí a set dies, comarca
//                               per comarca
//   4. el registre de Brevo   → a qui ja s'ha enviat el digest d'avui
//   5. un correu per persona  → transaccional, mai cap campanya
//
// LA IDEMPOTÈNCIA DEL DIGEST. No hi ha cap tercer fitxer ni cap base
// de dades on apuntar «ja enviat»: el registre d'enviaments de Brevo
// ÉS l'apunt. Cada correu surt etiquetat `digest-AAAA-MM-DD-comarca`,
// i abans d'enviar res el Worker es llegeix els enviaments d'avui i
// en fa un conjunt. Té dues conseqüències bones: la guarda és per
// PERSONA i no per dia, o sigui que una execució que es mori a mig
// camí no repeteix ningú i la següent continua per on era; i no
// s'inventa cap lloc nou on desar estat (CLAUDE.md §3). I si el
// registre NO es pot llegir, no s'envia res: val més un digest de
// menys que dos digests a tothom.
//
// SECRETS I VARIABLES. Cap valor no viu mai dins d'aquest fitxer.
// Als Secrets del tauler de Cloudflare (Worker > Settings >
// Variables and Secrets):
//   ANTHROPIC_API_KEY      (la clau de la consola d'Anthropic,
//                           platform.claude.com)
//   GITHUB_TOKEN           (gra fi, només aquest repositori, permís
//                           únic `contents: write`)
//   ADRECA_ARXIU           (el Gmail d'arxiu; ha de ser una destinació
//                           VERIFICADA a l'Email Routing, si no el
//                           reenviament falla. És Secret perquè el
//                           repositori és públic i és una adreça
//                           personal, no perquè sigui cap contrasenya.
//                           El digest de prova hi envia la mostra)
//   TYPEBOT_SECRET         (el secret compartit del webhook del
//                           formulari; el mateix valor va al bloc
//                           webhook del Typebot, dins la capçalera
//                           X-Typebot-Secret)
//   BREVO_API_KEY          (la clau d'API de Brevo; viatja només a la
//                           capçalera `api-key`, mai al registre)
//   BREVO_LIST_ROSSELLO    (l'id numèric de la llista de subscriptors
//   BREVO_LIST_CONFLENT     de cada comarca a Brevo: cinc Secrets, un
//   BREVO_LIST_VALLESPIR    per llista. No són contrasenyes, però són
//   BREVO_LIST_CAPCIR       dades del compte i el repositori és
//   BREVO_LIST_CERDANYA     públic)
// I una viu al tauler com a variable de text (no com a Secret):
//   CLOUDINARY_CLOUD_NAME  (no és secreta de cap manera: surt a l'URL
//                           de cada cartell del web públic)
//
// DESPLEGAMENT: vegeu docs/pas-fase2-worker-email.md (el correu),
// docs/pas-fase3a-worker-formulari.md (el formulari) i
// docs/pas-fase3b-worker-digest.md (el digest).
// ============================================================
// --- El repositori. Les mateixes coordenades que curador.html ---
var GITHUB_OWNER = 'CLMVallespir';
var GITHUB_REPO = 'agenda-catalogne-nord';
var GITHUB_BRANCH = 'main';
var FITXER_PENDENTS = 'pendents.json';
var FITXER_EVENTS = 'events.json';

// --- L'API de Claude (Anthropic) ---
// Es paga amb el crèdit mensual de l'organització, que ha de tenir un límit de despesa a la consola:
// quan s'acaba, les crides fallen en lloc de cobrar res (§3 de
// CLAUDE.md).
// El nom del model viu en UNA constant i prou. Si algun dia torna un
// 404 amb el nom del model a dins, és el cicle de vida normal
// d'Anthropic: mira quin Haiku hi ha vigent i canvia-la. Haiku i
// prou: el model següent costa vint vegades més.
var CLAUDE_MODEL = 'claude-haiku-5-5';
var CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
// La versió de l'API, a la capçalera `anthropic-version`. Fixa a
// posta: una versió nova pot canviar el que torna, i es canvia a mà.
var CLAUDE_VERSIO_API = '2026-10-21';
// Els 17 camps fan menys de 2 048 tokens; la resta és per al
// pensament, que compta dins d'aquest sostre (vegeu
// demanaExtraccioClaude()). Els que no s'usen no es paguen.
var CLAUDE_MAX_TOKENS = 8192;

// Les claus de cada `acte` que ha de tornar el model: les 17 de la
// regla 4 del prompt, en el mateix ordre. L'API les fa complir
// (`output_config.format`, vegeu esquemaExtraccio()). SI LA REGLA 4 DEL PROMPT CANVIA
// DE CLAUS, AQUESTA LLISTA CANVIA AMB ELLA.
var CLAUS_EXTRACCIO = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'periodicitat'
];

// --- Un correu, diversos actes (D-13) ---
// Els actes que s'encuen d'un sol correu, com a molt. El prompt diu el
// mateix («fins a deu»); aquí es torna a tallar per si el model no hi fa
// cas. Si en sobren, es queden els més propers en el temps.
var MAX_ACTES_PER_CORREU = 10;

// Els cartells adjunts que pugen a Cloudinary i que el model veu, com a
// molt. Cada un és una crida més al Worker (el pla gratuït en permet 50
// per execució) i uns 1 200 tokens més d'entrada a Claude.
var MAX_CARTELLS_PER_CORREU = 4;

// --- La traducció del formulari (D-12) ---
// Les claus de l'objecte que ha de tornar el model quan tradueix la
// descripció d'una tramesa del formulari. SI EL PROMPT DE TRADUCCIÓ
// CANVIA DE CLAUS, AQUESTA LLISTA CANVIA AMB ELL.
var CLAUS_TRADUCCIO_FORMULARI = ['titol', 'traduccio'];

// El temps màxim de la crida de traducció. El Typebot espera la
// resposta del Worker, i una crida penjada li faria esgotar el seu
// temps d'espera (que s'ha d'haver apujat a 60 s, vegeu
// docs/pas-fase3a-worker-formulari.md). Passat aquest temps la fila
// entra sense traducció i amb l'avís.
var TEMPS_MAXIM_TRADUCCIO_MS = 30000;

// Els avisos que la traducció deixa a nota_curador.
var AVIS_TRADUIT_DEL_FRANCES = 'Descripció catalana traduïda per un model a partir del francès de l\'associació. Comprova-la abans de publicar.';
var AVIS_TRADUIT_DEL_CATALA = 'Descripció francesa traduïda per un model a partir del català de l\'associació. Comprova-la abans de publicar.';
var AVIS_TRADUCCIO_FALLIDA = 'La traducció automàtica de la descripció ha fallat: completa l\'altra llengua abans de publicar.';

// --- Cloudinary: pujada sense signatura (docs/pas-3-cloudinary.md) ---
// El preset ja porta la carpeta (clm-agenda/posters) i la
// transformació d'entrada (w_800,c_limit,q_80,f_webp), que és la que
// converteix un PDF en un WebP de la primera pàgina. Aquí només cal
// el nom del cloud: cap signatura, cap secret.
var CLOUDINARY_PRESET = 'agenda-posters';

// --- El formulari Typebot: el secret compartit ---
// El bloc webhook del Typebot ha d'enviar aquesta capçalera amb el
// valor del Secret TYPEBOT_SECRET. L'URL del Worker és públic: sense
// aquesta comprovació, qualsevol que el trobés podria injectar files
// a la cua del curador.
var CAPCALERA_SECRET = 'X-Typebot-Secret';

// --- El digest setmanal de Brevo (Fase 3b) ---
// L'HORA. El cron de Cloudflare és sempre en UTC i no sap res de
// l'horari d'estiu. Les 15.00 de París són les 13.00 UTC a l'estiu i
// les 14.00 UTC a l'hivern, i no hi ha cap manera d'escriure això en
// una expressió cron. La solució més simple que ho garanteix tot
// l'any: el cron desperta el Worker cada deu minuts durant les DUES
// hores candidates, i el Worker mira quina hora és a París i se'n
// torna a dormir si no són les 15. L'expressió es configura al tauler
// (Settings -> Trigger Events -> Cron Triggers) i és una de sola:
// "*/10 13,14 * * 2".
var HORA_DIGEST_PARIS = 15;

// Cada despertada envia com a molt aquests correus, i la següent
// —deu minuts després— continua per on era. El motiu és el límit del
// pla gratuït de Cloudflare: 50 subpeticions per execució, i cada
// correu n'és una (i unes quantes se'n van a llegir el GitHub, el
// registre de Brevo i les llistes). Amb sis despertades dins l'hora
// hi caben uns 240 correus, per sota del sostre diari de Brevo.
// Això només funciona perquè la guarda d'idempotència és per
// persona: si fos per dia, la segona despertada no enviaria res.
var MAX_ENVIAMENTS_PER_EXECUCIO = 40;

// Quants dies endavant mira el digest, avui inclòs.
var DIES_FINESTRA = 7;

// El sostre diari de correus transaccionals del pla gratuït de Brevo
// i el llindar on val la pena deixar-ne un avís al registre. No es
// talla res: només s'avisa, perquè es pugui planificar el pas a
// campanyes abans que els enviaments comencin a fallar.
var BREVO_MAX_DIARI = 300;
var BREVO_LLINDAR_AVIS = 280;

// --- Brevo: els tres punts de l'API que fa servir el digest ---
var BREVO_ENVIA_URL = 'https://api.brevo.com/v3/smtp/email';
var BREVO_CONTACTES_URL = 'https://api.brevo.com/v3/contacts/lists/';
var BREVO_HISTORIAL_URL = 'https://api.brevo.com/v3/smtp/emails';
var BREVO_PER_PAGINA = 500;

// Una pausa curta entre correus, per no atabalar l'API de Brevo.
var PAUSA_ENTRE_CORREUS_MS = 150;

// --- El remitent del digest ---
// Cap dels tres no és secret: totes dues adreces són públiques i el
// nom també. L'adreça de RESPOSTA no és agenda@clm.cat a posta:
// agenda@ va a parar al gestor email() d'aquest mateix Worker, i una
// resposta demanant la baixa hi entraria com una fila nova a la cua
// del curador. Les baixes, doncs, van a contacte@clm.cat.
var DIGEST_REMITENT_EMAIL = 'agenda@clm.cat';
var DIGEST_REMITENT_NOM = 'Agenda cultural de la Catalunya Nord';
var DIGEST_ADRECA_BAIXA = 'contacte@clm.cat';
var AGENDA_URL = 'https://agenda.clm.cat';

// --- Les cinc comarques i el que Brevo en necessita ---
// Una sola taula explícita, sense cap truc de transliteració: el nom
// de la comarca tal com surt a l'esquema, el nom del Secret que en
// guarda l'id de llista, i el tros d'etiqueta (sense accents) que
// marca els correus ja enviats.
var COMARQUES_BREVO = [
  { comarca: 'Rosselló', secret: 'BREVO_LIST_ROSSELLO', etiqueta: 'rossello' },
  { comarca: 'Conflent', secret: 'BREVO_LIST_CONFLENT', etiqueta: 'conflent' },
  { comarca: 'Vallespir', secret: 'BREVO_LIST_VALLESPIR', etiqueta: 'vallespir' },
  { comarca: 'Capcir', secret: 'BREVO_LIST_CAPCIR', etiqueta: 'capcir' },
  { comarca: 'Cerdanya', secret: 'BREVO_LIST_CERDANYA', etiqueta: 'cerdanya' }
];

// --- Els valors permesos dels dos camps d'enumeració (CLAUDE.md §4) ---
var COMARCA_VALUES = ['Rosselló', 'Conflent', 'Vallespir', 'Capcir', 'Cerdanya'];
var CATEGORIA_VALUES = [
  'Música',
  'Teatre',
  'Dansa i ball',
  'Conferència',
  'Exposició',
  'Mercat',
  'Cinema',
  'Taller',
  'Activitat infantil',
  'Patrimoni i tradicions',
  'Concentració',
  'Esports',
  'Vida associativa'
];

// El prompt d'extracció. És una còpia LITERAL de
// prompts/extract-event.txt, que n'és el mestre llegible i provable.
// Si en canvies un, canvia l'altre: han de dir exactament el mateix.
// Acaba amb la línia "CORREU:"; el text del correu s'afegeix després.
// (L'únic caràcter escapat aquí baix és la tanca markdown ```, que
// s'escriu \`\`\` perquè aquest text viu entre cometes invertides.)
var EXTRACTION_PROMPT = `Ets un extractor de dades per a l'agenda cultural de la Catalunya Nord. Llegeixes el correu electrònic que hi ha al final d'aquest missatge, després de la línia "CORREU:", i els cartells que hi van adjunts, i en retreus la informació de cada esdeveniment cultural que anuncien.

DATA DE REFERÈNCIA
Avui és: {{AVUI}}
Fes servir aquesta data únicament per deduir l'any quan el correu esmenta una data sense any: tria la pròxima ocurrència futura d'aquesta data.

CARTELLS
Cartells adjunts a aquest correu: {{CARTELLS}}.
Mira'ls sencers: un cartell pot anunciar un acte que el text del correu no esmenta, i aquell acte també compta.

FORMAT DE RESPOSTA — REGLES ABSOLUTES
1. Respon NOMÉS amb un objecte JSON vàlid. Cap text abans ni després. Cap explicació. Cap bloc de codi markdown (res de \`\`\`).
2. L'objecte té una sola clau, "esdeveniments": una llista amb un element per esdeveniment. Cada element té dues claus, "cartell" i "acte".
3. "cartell" és el número del cartell adjunt que anuncia aquest esdeveniment ("1", "2"…), o cadena buida "" si cap cartell no l'anuncia. Un mateix cartell pot anar amb diversos esdeveniments, per exemple el programa d'un mes.
4. "acte" és un objecte que conté exactament aquestes 17 claus, totes presents sempre, en aquest ordre:
   id, titol, data_inici, data_fi, hora, lloc, municipi, comarca, categoria, descripcio_ca, descripcio_fr, associacio, imatge_url, font_url, estat, data_entrada, periodicitat
5. Tots els valors són cadenes de text (strings).
6. Si no pots determinar un camp amb certesa a partir del correu o dels cartells, el seu valor és una cadena buida "". No facis servir mai null. No ometis mai cap clau. No inventis mai cap dada.
7. Si el correu no anuncia cap esdeveniment, la llista és buida.

QUÈ ÉS UN ESDEVENIMENT
- Un acte obert al públic, amb una data o una periodicitat. Un element de la llista per acte.
- Un correu o un butlletí en pot anunciar diversos: extreu-los tots, fins a deu. Si n'anuncia més de deu, queda't amb els deu més propers en el temps.
- No extreguis els actes que ja han passat: els repassos i els resums («el mes passat…», «retour sur…») no són esdeveniments.
- Un cicle amb sessions en dates diferents (un cicle de cinema, unes jornades amb una conferència cada dia) dona un esdeveniment per sessió.
- Una activitat que es repeteix amb regularitat (un curs setmanal, un mercat de cada dissabte) és un sol esdeveniment, amb la regularitat al camp periodicitat.
- Un mateix acte que surt dues vegades (al text i al cartell, per exemple) és un sol esdeveniment.

CAMPS QUE HAS D'EXTREURE
- titol: títol de l'esdeveniment, en català. Si el correu el dona en francès, escriu-lo en català, però conserva els noms propis (grups, obres, llocs) tal com apareixen.
- data_inici: format AAAA-MM-DD.
- data_fi: format AAAA-MM-DD. Si l'esdeveniment dura un sol dia, el mateix valor que data_inici.
- hora: format HH:MM (24 hores). Cadena buida si dura tot el dia o si el correu no ho indica.
- lloc: nom del local o de l'espai (per exemple: "Sala polivalent", "Església de Sant Pere", "Plaça de la República").
- municipi: nom del municipi, en la forma catalana si la coneixes (per exemple: "Perpinyà", "Prada", "Ceret").
- comarca: NOMÉS una d'aquestes cinc, escrita exactament així: Rosselló, Conflent, Vallespir, Capcir, Cerdanya. Dedueix-la del municipi només si la correspondència és clara i segura. Si tens cap dubte, cadena buida.
- categoria: NOMÉS una d'aquestes tretze, escrita exactament així: Música, Teatre, Dansa i ball, Conferència, Exposició, Mercat, Cinema, Taller, Activitat infantil, Patrimoni i tradicions, Concentració, Esports, Vida associativa. Si cap no encaixa clarament, cadena buida.
- descripcio_ca: de 2 a 4 frases en català. Redacta-la tu directament en català natural i correcte a partir de la informació del correu i del cartell; no facis una traducció literal del francès. To informatiu i acollidor, sense exclamacions publicitàries. No hi afegeixis informació que el correu o el cartell no donin.
- descripcio_fr: traducció francesa fidel de descripcio_ca, també de 2 a 4 frases.
- associacio: nom de l'entitat o associació organitzadora.
- periodicitat: si el correu diu que l'esdeveniment es repeteix amb regularitat (un curs setmanal, un mercat de cada dissabte, un taller de cada dimarts), escriu-ho en una frase curta i natural en català (per exemple: "cada dissabte al matí", "els dijous a les 18h"). Si l'acte és puntual o el correu no ho diu amb claredat, cadena buida "". No inventis mai cap periodicitat que el correu no digui.

CAMPS QUE NO HAS D'OMPLIR MAI
- id, imatge_url, font_url, estat, data_entrada: retorna sempre cadena buida "". Aquests camps els omple el sistema, no tu.

EXEMPLE DE RESPOSTA (només per il·lustrar el format; no copiïs aquestes dades)
{
  "esdeveniments": [
    {
      "cartell": "1",
      "acte": {
        "id": "",
        "titol": "Ball de la festa major",
        "data_inici": "2026-09-14",
        "data_fi": "2026-09-14",
        "hora": "18:30",
        "lloc": "Plaça del Firal",
        "municipi": "Prats de Molló",
        "comarca": "Vallespir",
        "categoria": "Dansa i ball",
        "descripcio_ca": "La festa major de Prats de Molló es tanca amb un ball obert a tothom a la plaça del Firal. L'orquestra local farà ballar petits i grans fins a mitjanit. L'entrada és gratuïta.",
        "descripcio_fr": "La fête patronale de Prats-de-Mollo se termine par un bal ouvert à tous sur la place du Firal. L'orchestre local fera danser petits et grands jusqu'à minuit. L'entrée est gratuite.",
        "associacio": "Comitè de festes de Prats de Molló",
        "imatge_url": "",
        "font_url": "",
        "estat": "",
        "data_entrada": "",
        "periodicitat": ""
      }
    }
  ]
}

CORREU:
`;

// El prompt de traducció del formulari (D-12). NO és el prompt
// d'extracció ni el de l'Action: aquell treu disset camps d'un correu,
// el de l'Action reescriu el francès cru de l'ADT66; aquest TRADUEIX el
// text que una associació ja ha escrit, sense reescriure'l. Les regles
// dels noms propis i dels pobles venen de les lliçons de l'Action
// (NOTES.md, «La Menera» / «Le Tech»). La fitxa s'enganxa darrere de
// la línia `FITXA:`, com el correu darrere de `CORREU:`.
var PROMPT_TRADUCCIO_FORMULARI = [
  'Ets el traductor de l\'agenda cultural «Què fas?» de la Catalunya Nord, que es publica en català i en francès.',
  'Una associació ha omplert el formulari de l\'agenda i n\'ha escrit la descripció en una sola llengua. La teva feina és traduir aquesta descripció a l\'altra llengua i donar el títol de l\'acte en català. Res més.',
  '',
  'FORMAT DE RESPOSTA — REGLES ABSOLUTES',
  '1. Respon NOMÉS amb un objecte JSON vàlid, amb exactament aquestes 2 claus: titol, traduccio. Tots dos valors són cadenes de text.',
  '2. Cap text abans ni després, cap explicació, cap bloc de codi markdown.',
  '',
  'ELS DOS CAMPS',
  '- titol: el títol de l\'acte en català. Si el TÍTOL que reps ja és en català, copia\'l lletra per lletra, sense corregir-lo ni millorar-lo. Si és en francès, tradueix-lo, llevat del que sigui nom propi (regla de sota). Mai tot en majúscules.',
  '- traduccio: la DESCRIPCIÓ traduïda a la LLENGUA DE DESTINACIÓ. Traducció fidel: la mateixa informació, ni més ni menys, en el mateix ordre. No resumeixis, no hi afegeixis res, no la milloris. Si porta horaris, preus o adreces, tradueix-los també: són de l\'associació.',
  '',
  'LA LLENGUA HA DE SER DE DEBÒ',
  '- En català: cap paraula ni expressió francesa sense traduir dins d\'una frase catalana, i formes catalanes de debò, no calcs del francès: «saveurs du terroir» és «sabors de la terra».',
  '- En francès: un francès correcte i natural, no un calc del català.',
  '- El to és el de l\'original. No hi posis exclamacions ni crides al lector que l\'original no porti.',
  '',
  'ELS NOMS PROPIS NO ES TRADUEIXEN MAI',
  '- Un nom propi es copia tal com surt: noms de grup, de companyia, d\'artista, de festival, de sala, d\'associació, títols d\'obra, i noms de lloc com masos, rius, serres o barris.',
  '- Els pobles de la Catalunya Nord tenen una forma catalana i una de francesa (Perpinyà · Perpignan, Prada · Prades, Ceret · Céret): fes servir la de la llengua en què escrius, i si no la saps del cert, copia la que surt al text. Mai no canviïs un poble per un altre: «La Menera» no és «Le Tech».',
  '- Una descripció genèrica amb majúscules («Forum des Associations», «Marché de Noël») no és cap nom propi: diu què és l\'acte, no com es diu, i es tradueix.',
  '',
  'NO INVENTIS RES',
  'Tradueix només el que diu la DESCRIPCIÓ. No hi afegeixis el poble, la data, l\'hora ni res que només surti al TÍTOL o al MUNICIPI. Si la DESCRIPCIÓ és il·legible o no és ni en català ni en francès, torna traduccio com a cadena buida.',
  '',
  'EXEMPLE DE RESPOSTA (només per il·lustrar el format; no copiïs aquestes dades)',
  '{"titol":"Castanyada de l\'escola","traduccio":"L\'associació de pares organitza una castanyada al pati de l\'escola. Hi haurà castanyes torrades, música i jocs per a la mainada. L\'entrada és lliure."}',
  '',
  'FITXA:'
].join('\n');

// ============================================================
// EL GESTOR
// ============================================================

export default {
  // ------------------------------------------------------------
  // Un correu rebut a agenda@clm.cat. Arxiva primer, analitza
  // després. No torna res i no llança mai: si alguna cosa peta,
  // queda al registre i el correu ja és a l'arxiu.
  // ------------------------------------------------------------
  async email(message, env, ctx) {
    // Sense adreça d'arxiu no hi ha manera de desar l'original, i
    // empassar-se un correu en silenci és l'única cosa que no ens
    // podem permetre. Val més rebutjar-lo: el remitent rep un avís de
    // no-entrega amb el text de sota i el pot tornar a enviar quan la
    // configuració estigui posada. És un rebuig PERMANENT (un 5xx):
    // el servidor del remitent no ho reintentarà sol, ho ha de fer la
    // persona — per això el text li diu què fer.
    if (!env.ADRECA_ARXIU) {
      console.log('email(): falta la variable ADRECA_ARXIU. Rebutjo el correu en comptes d\'empassar-me\'l.');
      message.setReject('L\'agenda no ha pogut acceptar aquest correu; torna a enviar-lo més tard. · L\'agenda n\'a pas pu accepter ce message ; merci de le renvoyer plus tard.');
      return;
    }

    // PRIMER de tot, l'arxiu. Aquest ordre és la invariant de la
    // Fase 2: si reenviéssim al final, un error a mig camí (o un
    // límit de CPU) deixaria el correu sense cap còpia enlloc.
    await reenviaAArxiu(message, env);

    // A partir d'aquí res no és crític: l'original ja està desat.
    try {
      await processaCorreu(message, env);
    } catch (error) {
      console.log('email(): no he pogut fer la fila d\'aquest correu: ' + error.message);
    }
  },

  // ------------------------------------------------------------
  // Una petició HTTP. L'única que s'accepta és el POST del webhook
  // del formulari Typebot, amb el secret compartit a la capçalera.
  // Torna sempre una Response, també quan rebutja.
  // ------------------------------------------------------------
  async fetch(request, env, ctx) {
    // EL SECRET PRIMER, abans de mirar res més: ni el mètode, ni el
    // cos, ni res. L'URL del Worker és públic, i qui no porta el
    // secret no ha de saber ni què hi ha darrere ni per què l'hem
    // rebutjat: rep un 403 pelat. El motiu real va al registre, que
    // és on el mira el propietari.
    if (!secretCorrecte(request, env)) {
      return respostaJson(403, { ok: false, error: 'no autoritzat' });
    }

    // Només POST (docs/pas-fase3a-worker-formulari.md). Aquí ja sabem que qui pregunta
    // porta el secret, o sigui que sí que li podem dir la veritat:
    // un 405 li estalvia mitja tarda de buscar on és l'error.
    if (request.method !== 'POST') {
      console.log('fetch(): mètode ' + request.method + ' rebutjat; només POST.');
      return respostaJson(405, { ok: false, error: 'només POST' });
    }

    // LA PORTA DE PROVA DEL DIGEST (Fase 3b). Mateix secret i mateix
    // POST que el formulari; només hi ha una marca a l'URL. Envia el
    // digest d'avui NOMÉS a l'adreça d'arxiu, amb una etiqueta de
    // prova que no toca ni consulta la guarda del digest de debò.
    // Existeix perquè, si no, l'única manera de provar la Fase 3b
    // seria esperar el dimarts a les tres de la tarda.
    var url = new URL(request.url);
    if (url.searchParams.get('digest') === 'prova') {
      return await respostaDigestDeProva(request, env);
    }

    return await respostaDelFormulari(request, env);
  },

  // ------------------------------------------------------------
  // El despertador setmanal del digest. El cron de Cloudflare és en
  // UTC, així que el Worker es desperta cada deu minuts durant les
  // dues hores que poden ser les 15.00 de París (13.00 UTC a l'estiu,
  // 14.00 a l'hivern) i només treballa quan de debò ho són. No torna
  // res i no llança mai: el que falli queda al registre.
  // ------------------------------------------------------------
  async scheduled(event, env, ctx) {
    var ara = new Date(event.scheduledTime);
    var hora = horaDeParis(ara);
    if (hora !== HORA_DIGEST_PARIS) {
      console.log('scheduled(): a París són les ' + hora + ', no les ' + HORA_DIGEST_PARIS + '. Cap digest.');
      return;
    }

    try {
      await enviaDigestSetmanal(env, ara);
    } catch (error) {
      console.log('scheduled(): el digest d\'aquesta setmana ha fallat: ' + error.message);
    }
  }
};

// ------------------------------------------------------------
// Reenvia el correu original al Gmail d'arxiu. NO LLANÇA MAI: un
// arxiu que falla es registra i prou, perquè el gestor ha de
// continuar igualment. Torna cert si s'ha reenviat.
// ------------------------------------------------------------
async function reenviaAArxiu(message, env) {
  // Que l'adreça hi sigui, ja ho ha comprovat email(): si faltés, el
  // correu s'hauria rebutjat i aquí no hi arribaríem.
  var adreca = env.ADRECA_ARXIU;

  try {
    await message.forward(adreca);
    return true;
  } catch (error) {
    // Causa més probable: l'adreça no és una destinació verificada
    // a l'Email Routing de Cloudflare.
    console.log('reenviaAArxiu(): el reenviament ha fallat: ' + error.message);
    return false;
  }
}

// ------------------------------------------------------------
// Afegeix un text a la nota_curador de la fila, separat per un espai.
// ------------------------------------------------------------
function afegeixNota(fila, text) {
  if (typeof fila.nota_curador === 'string' && fila.nota_curador !== '') {
    fila.nota_curador = fila.nota_curador + ' ' + text;
  } else {
    fila.nota_curador = text;
  }
}

// ------------------------------------------------------------
// Diu si l'URL és del Cloudinary de l'agenda (el nom del cloud).
// ------------------------------------------------------------
function esDelNostreCloudinary(url, nomCloud) {
  if (typeof nomCloud !== 'string' || nomCloud === '') {
    return false;
  }
  if (typeof url !== 'string') {
    return false;
  }
  return url.indexOf('https://res.cloudinary.com/' + nomCloud + '/') === 0;
}

// ------------------------------------------------------------
// L'amfitrió d'una URL per al registre; mai l'URL sencer.
// ------------------------------------------------------------
function amfitrioDeLUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return 'URL no vàlid';
  }
}

// ------------------------------------------------------------
// Si la data de fi és anterior a la d'inici, avisa el curador.
// ------------------------------------------------------------
function avisaDatesInvertides(fila) {
  if (fila.data_inici !== '' && fila.data_fi !== '' && fila.data_fi < fila.data_inici) {
    afegeixNota(fila, 'Atenció: la data de fi és anterior a la d\'inici. Corregeix-la abans de publicar.');
  }
}

// ------------------------------------------------------------
// El correu, de MIME cru a files a la cua: una per acte (D-13).
// Llança si res del camí falla; qui el crida ja ho recull. No torna
// res.
// ------------------------------------------------------------
async function processaCorreu(message, env) {
  var correu = await PostalMime.parse(message.raw);
  var textCorreu = textDelCorreu(correu);

  // Un correu sense gens de text no es pot analitzar: seria una
  // crida a Claude llençada i una fila buida a la cua. L'original
  // ja és a l'arxiu, que és l'únic que importa.
  if (textCorreu === '') {
    console.log('processaCorreu(): correu sense text. Arxivat, sense fila.');
    return;
  }

  // LA PORTA, ABANS DE PAGAR RES (D-09): llegir la cua, admetre, i
  // només llavors cridar Claude. Un correu no admès ja és a l'arxiu.
  var decisio = await decideixAdmissio(textCorreu, env.GITHUB_TOKEN);
  if (decisio.admesa === false) {
    console.log('processaCorreu(): no admès: ' + decisio.motiu + ' Arxivat, sense fila.');
    return;
  }

  // Els cartells PRIMER, Claude després (D-13): el model els ha de
  // veure per saber quin va amb quin acte, i els veu per l'URL de
  // Cloudinary. Si l'extracció falla, els cartells pujats queden
  // orfes a Cloudinary: és el preu acceptat.
  var urlsCartells = await pujaCartells(cartellsAdjunts(correu), env.CLOUDINARY_CLOUD_NAME);

  var avui = new Date().toISOString().slice(0, 10);
  var resposta = await demanaExtraccioClaude(decisio.text, urlsCartells, env.ANTHROPIC_API_KEY, avui);
  var elements = elementsDeLaResposta(resposta);

  // CAP ACTE TROBAT: una fila buida amb l'avís, no res. Pot ser una
  // confirmació de subscripció o un correu bo mal llegit, i només el
  // curador ho pot dir; sense fila no ho veuria ningú.
  if (elements.length === 0) {
    var buida = filaSegura(construeixFila({}, ''), 'correu');
    afegeixNota(buida, 'El model no hi ha trobat cap acte. Mira l\'original a l\'arxiu: «' +
      assumpteNet(correu) + '».');
    afegeixAvisosDelCorreu(buida, decisio.avis, urlsCartells, []);
    await afegeixAPendents([buida], env.GITHUB_TOKEN, 'correu');
    console.log('processaCorreu(): cap acte trobat. Fila buida afegida a la cua.');
    return;
  }

  // Cada acte surt per filaSegura(): divuit camps, els sostres, el
  // títol d'una línia (va al missatge del commit) i les dates.
  var files = [];
  var cartellsUsats = [];
  for (var i = 0; i < elements.length; i++) {
    var numero = numeroDeCartell(elements[i].cartell, urlsCartells.length);
    var imatgeUrl = '';
    if (numero > 0) {
      imatgeUrl = urlsCartells[numero - 1];
      cartellsUsats.push(numero);
    }
    var fila = filaSegura(construeixFila(elements[i].acte, imatgeUrl), 'correu');
    avisaDatesInvertides(fila);
    if (numero > 0 && (urlsCartells.length > 1 || elements.length > 1)) {
      afegeixNota(fila, 'El model hi ha posat el cartell ' + numero + ' del correu: comprova que és el d\'aquest acte.');
    }
    files.push(fila);
  }

  var triades = triaFilesDelCorreu(files, decisio.cua, decisio.lloc, avui);
  if (triades.files.length === 0) {
    console.log('processaCorreu(): ' + triades.motiu + ' Cap fila nova.');
    return;
  }

  for (var j = 0; j < triades.files.length; j++) {
    var triada = triades.files[j];
    if (elements.length > 1) {
      afegeixNota(triada, 'Correu amb ' + elements.length + ' actes (' + (j + 1) + ' de ' +
        triades.files.length + ' encuats).');
    }
    if (triades.motiu !== '') {
      afegeixNota(triada, triades.motiu);
    }
  }
  // Els avisos que són del correu i no de cap acte (el text tallat, els
  // cartells que no han anat enlloc) van a la primera fila i prou.
  afegeixAvisosDelCorreu(triades.files[0], decisio.avis, urlsCartells, cartellsUsats);

  await afegeixAPendents(triades.files, env.GITHUB_TOKEN, 'correu');
  console.log('processaCorreu(): ' + triades.files.length + ' files afegides a la cua.');
}

// ------------------------------------------------------------
// Els avisos d'un correu que no són de cap acte: el text tallat per
// admetEntrada(), i cada cartell que el model no ha posat a cap acte,
// amb el seu URL perquè el curador el pugui fer servir. Modifica la
// fila; no torna res.
// ------------------------------------------------------------
function afegeixAvisosDelCorreu(fila, avisAdmissio, urlsCartells, cartellsUsats) {
  if (avisAdmissio !== '') {
    afegeixNota(fila, avisAdmissio);
  }
  for (var i = 0; i < urlsCartells.length; i++) {
    var numero = i + 1;
    if (cartellsUsats.indexOf(numero) === -1) {
      afegeixNota(fila, 'El cartell ' + numero + ' del correu no s\'ha posat a cap acte: ' + urlsCartells[i]);
    }
  }
}

// ------------------------------------------------------------
// L'assumpte del correu per a una nota: una línia, sense claudàtors
// (filaSegura() no en deixa cap a nota_curador) i curt. Torna el text.
// ------------------------------------------------------------
function assumpteNet(correu) {
  var assumpte = '';
  if (correu.subject) {
    assumpte = String(correu.subject);
  }
  assumpte = assumpte.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (assumpte === '') {
    return '(sense assumpte)';
  }
  return talla(assumpte, 150);
}

// ------------------------------------------------------------
// La llista d'actes de la resposta del model, cadascun com a
// { cartell, acte }. Un element que no sigui un objecte amb un `acte`
// objecte es llença; si n'hi ha més de MAX_ACTES_PER_CORREU, es queden
// els primers (triaFilesDelCorreu() ja ordena per data després).
// Torna la llista, buida si el model no n'ha trobat cap.
// ------------------------------------------------------------
function elementsDeLaResposta(resposta) {
  var llista = resposta.esdeveniments;
  if (!Array.isArray(llista)) {
    throw new Error('la resposta del model no porta la llista «esdeveniments».');
  }

  var elements = [];
  for (var i = 0; i < llista.length; i++) {
    var element = llista[i];
    if (element === null || typeof element !== 'object') {
      continue;
    }
    if (element.acte === null || typeof element.acte !== 'object' || Array.isArray(element.acte)) {
      continue;
    }
    elements.push({ cartell: campText(element, 'cartell'), acte: element.acte });
    if (elements.length === MAX_ACTES_PER_CORREU) {
      break;
    }
  }
  return elements;
}

// ------------------------------------------------------------
// El número de cartell que ha dit el model, si és un dels que hi ha
// ("1" fins a `quants`). Torna el número, o 0 si no n'hi ha cap de bo.
// ------------------------------------------------------------
function numeroDeCartell(text, quants) {
  for (var numero = 1; numero <= quants; numero++) {
    if (text === String(numero)) {
      return numero;
    }
  }
  return 0;
}

// ------------------------------------------------------------
// De les files d'un correu, les que s'encuen: fora les que ja han
// passat (esCaducada()), fora les que ja són a la cua o que el mateix
// correu repeteix (jaHiEs()), i com a molt `lloc` files, les més
// properes en el temps. Torna { files, motiu }: `motiu` diu què
// s'ha deixat fora, o "" si res.
// ------------------------------------------------------------
function triaFilesDelCorreu(files, cua, lloc, avui) {
  var queden = [];
  var passades = 0;
  var repetides = 0;

  for (var i = 0; i < files.length; i++) {
    if (esCaducada(files[i], avui)) {
      passades++;
    } else if (jaHiEs(files[i], cua) || jaHiEs(files[i], queden)) {
      repetides++;
    } else {
      queden.push(files[i]);
    }
  }

  queden.sort(comparaPerDataInici);
  var sobrants = 0;
  if (queden.length > lloc) {
    sobrants = queden.length - lloc;
    queden = queden.slice(0, lloc);
  }

  var parts = [];
  if (passades > 0) {
    parts.push(passades + ' ja havien passat');
  }
  if (repetides > 0) {
    parts.push(repetides + ' ja eren a la cua');
  }
  if (sobrants > 0) {
    parts.push(sobrants + ' no hi cabien pel sostre del dia (l\'original és a l\'arxiu)');
  }

  var motiu = '';
  if (parts.length > 0) {
    motiu = 'Del mateix correu, ' + parts.join(', ') + '.';
  }
  return { files: queden, motiu: motiu };
}

// ------------------------------------------------------------
// Diu si la fila ja és a la llista, sigui quin sigui l'estat: mateix
// id, mateix títol i mateix municipi (CLAUDE.md §4). Exacte i prou: el
// que no coincideixi del tot s'encua, i el curador el resol.
// ------------------------------------------------------------
function jaHiEs(fila, llista) {
  if (fila.id === '' && fila.titol === '') {
    return false;
  }
  for (var i = 0; i < llista.length; i++) {
    var altra = llista[i] || {};
    if (altra.id === fila.id && altra.titol === fila.titol && altra.municipi === fila.municipi) {
      return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// Ordre per data d'inici, i les files sense data al final. Per a sort().
// ------------------------------------------------------------
function comparaPerDataInici(a, b) {
  if (a.data_inici === b.data_inici) {
    return 0;
  }
  if (a.data_inici === '') {
    return 1;
  }
  if (b.data_inici === '') {
    return -1;
  }
  if (a.data_inici < b.data_inici) {
    return -1;
  }
  return 1;
}

// ============================================================
// EL FORMULARI (TYPEBOT)
// ============================================================

// ------------------------------------------------------------
// El secret compartit de la capçalera. Torna cert només si el
// Worker té el secret configurat I la petició porta el mateix
// valor. No registra mai el valor de cap dels dos.
// ------------------------------------------------------------
function secretCorrecte(request, env) {
  var esperat = env.TYPEBOT_SECRET;

  // Sense secret configurat, la porta queda tancada per a tothom.
  // Sembla exagerat i no ho és: l'alternativa —acceptar-ho tot
  // mentre falti el secret— obriria la cua al primer que trobés
  // l'URL, i justament el dia que la configuració no és a lloc.
  if (!esperat) {
    console.log('secretCorrecte(): falta el Secret TYPEBOT_SECRET. Rebutjo tota petició fins que hi sigui.');
    return false;
  }

  var rebut = request.headers.get(CAPCALERA_SECRET);
  if (rebut === null) {
    console.log('secretCorrecte(): petició sense la capçalera ' + CAPCALERA_SECRET + '.');
    return false;
  }

  if (rebut !== esperat) {
    console.log('secretCorrecte(): la capçalera ' + CAPCALERA_SECRET + ' no coincideix.');
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// El POST del formulari, de JSON a fila a la cua. Qui la crida ja
// ha comprovat el secret i el mètode. No llança: torna sempre la
// Response que toca, i registra el detall de tot el que falla.
// ------------------------------------------------------------
async function respostaDelFormulari(request, env) {
  var cos = null;
  try {
    cos = await request.json();
  } catch (error) {
    console.log('respostaDelFormulari(): el cos no és JSON vàlid: ' + error.message);
    return respostaJson(400, { ok: false, error: 'el cos ha de ser un objecte JSON' });
  }

  // Un JSON vàlid també pot ser una llista, un número o null, i
  // d'aquests campText() en trauria bestieses. Només un objecte val.
  if (cos === null || typeof cos !== 'object' || Array.isArray(cos)) {
    console.log('respostaDelFormulari(): el cos és JSON, però no és un objecte.');
    return respostaJson(400, { ok: false, error: 'el cos ha de ser un objecte JSON' });
  }

  var fila = construeixFilaFormulari(cos);

  // Una tramesa sense títol ni data no és cap esdeveniment: seria
  // una fila buida per revisar. El correu fa servir un llindar més
  // baix (només rebutja un correu sense text): les portes manuals
  // són permissives a posta (D-04).
  if (fila.titol === '' && fila.data_inici === '') {
    console.log('respostaDelFormulari(): tramesa sense títol ni data. Cap fila.');
    return respostaJson(400, { ok: false, error: 'cal com a mínim un títol o una data' });
  }

  // El sostre de files del dia (D-09), comptat a la cua, ABANS de pagar
  // la traducció. Aquí només hi compta el nombre de files: el text que
  // va al model és la descripció, ja limitada pel sostre del camp.
  var decisio = null;
  try {
    decisio = await decideixAdmissio('', env.GITHUB_TOKEN);
  } catch (error) {
    console.log('respostaDelFormulari(): no he pogut llegir la cua: ' + error.message);
    return respostaJson(500, { ok: false, error: 'no he pogut desar la tramesa' });
  }
  if (decisio.admesa === false) {
    console.log('respostaDelFormulari(): no admès: ' + decisio.motiu);
    return respostaJson(429, { ok: false, error: 'massa trameses avui; torna-ho a provar demà' });
  }

  // La llengua que falta (D-12). ABANS de filaSegura(), perquè el que
  // escriu el model passi pels mateixos sostres i pel mateix id que la
  // resta de la fila. No llança mai: si falla, la fila entra igual.
  await completaTraduccio(fila, env.ANTHROPIC_API_KEY);

  // La forma, DESPRÉS de la comprovació de dalt, que es fa sobre el que
  // ha enviat el formulari: filaSegura() només sanitza i no ha de canviar
  // què s'accepta (D-04). Divuit camps, sostres, títol d'una línia, dates.
  fila = filaSegura(fila, 'formulari');

  // Només es fia d'una imatge del nostre Cloudinary: qualsevol
  // altra URL es descarta i el curador en queda avisat a la nota.
  if (fila.imatge_url !== '' && !esDelNostreCloudinary(fila.imatge_url, env.CLOUDINARY_CLOUD_NAME)) {
    console.log('respostaDelFormulari(): imatge descartada, amfitrió: ' + amfitrioDeLUrl(fila.imatge_url) + '.');
    fila.imatge_url = '';
    afegeixNota(fila, 'Imatge descartada: l\'URL del formulari no era del Cloudinary de l\'agenda.');
  }

  avisaDatesInvertides(fila);

  try {
    await afegeixAPendents([fila], env.GITHUB_TOKEN, 'formulari');
  } catch (error) {
    console.log('respostaDelFormulari(): no he pogut escriure la fila: ' + error.message);
    return respostaJson(500, { ok: false, error: 'no he pogut desar la tramesa' });
  }

  console.log('respostaDelFormulari(): fila afegida a la cua. id: "' + fila.id + '".');
  return respostaJson(200, { ok: true, id: fila.id });
}

// ------------------------------------------------------------
// Munta la fila de 17 camps a partir del cos del formulari. Mapa
// determinista, camp a camp, sense cap crida a Claude: el formulari
// ja dona la informació separada. La traducció ve després, a
// completaTraduccio(). Torna l'objecte de la fila.
// ------------------------------------------------------------
function construeixFilaFormulari(cos) {
  var titol = campText(cos, 'titol');
  var dataInici = campText(cos, 'data_inici');
  var dataFi = campText(cos, 'data_fi');

  // El formulari no demana data_fi si l'acte és d'un sol dia, i
  // l'esquema diu que en aquest cas data_fi és igual a data_inici.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  // El formulari recull UNA descripció i un senyal de quina llengua
  // és (CLAUDE.md §7): el text va a la banda que toca i l'altra
  // queda buida, fins que completaTraduccio() l'omple (D-12).
  // Es compara en minúscules per si el Typebot envia "FR" o "Fr".
  var descripcio = campText(cos, 'descripcio');
  var idioma = campText(cos, 'idioma_descripcio').toLowerCase();
  var descripcioCa = '';
  var descripcioFr = '';
  if (idioma === 'fr') {
    descripcioFr = descripcio;
  } else {
    descripcioCa = descripcio;
  }

  return {
    // --- L'id el reconstrueix sempre el sistema, mai el formulari ---
    id: creaId(dataInici, titol),
    // --- Els camps que omple l'associació al formulari ---
    titol: titol,
    data_inici: dataInici,
    data_fi: dataFi,
    hora: campText(cos, 'hora'),
    lloc: campText(cos, 'lloc'),
    municipi: campText(cos, 'municipi'),
    // La interfície del formulari ja constreny aquests dos a la
    // llista, però l'endpoint accepta qualsevol POST que porti el
    // secret: es filtren igual, com al camí del correu.
    comarca: valorPermes(campText(cos, 'comarca'), COMARCA_VALUES),
    categoria: valorPermes(campText(cos, 'categoria'), CATEGORIA_VALUES),
    descripcio_ca: descripcioCa,
    descripcio_fr: descripcioFr,
    associacio: campText(cos, 'associacio'),
    // El cartell ja ha pujat del navegador a Cloudinary dins el flux
    // del Typebot: l'URL arriba fet i es desa tal qual (o "" si
    // l'associació s'ha saltat el pas).
    imatge_url: campText(cos, 'imatge_url'),
    // --- Els camps que omple el sistema, mai el formulari ---
    font_url: '',                             // el formulari no demana cap enllaç d'origen
    estat: 'pendent',                         // sempre: espera el curador
    data_entrada: new Date().toISOString(),   // quan s'ha creat la fila
    // El Typebot ho demana al pas 5bis (docs/pas-5-typebot-questionari.md):
    // si l'usuari diu que és puntual, o el pas no s'ha configurat encara al
    // servei, arriba buida — mai s'inventa ni es dedueix d'altres camps.
    periodicitat: campText(cos, 'periodicitat')
  };
}

// ------------------------------------------------------------
// Omple la descripció que falta d'una fila del formulari, i el títol
// en català, amb una crida a Claude (D-12). El text de l'associació
// no es toca mai: només s'omple la banda buida. Si les dues bandes ja
// són plenes, o totes dues buides, no crida res. NO LLANÇA MAI: aquesta
// porta no té cap arxiu, i una traducció fallida no pot costar la
// tramesa (D-04); la fila entra igual, amb l'avís a nota_curador.
// Modifica la fila que rep; no torna res.
// ------------------------------------------------------------
async function completaTraduccio(fila, apiKey) {
  var llenguaOriginal = '';
  var original = '';
  if (fila.descripcio_fr !== '' && fila.descripcio_ca === '') {
    llenguaOriginal = 'fr';
    original = fila.descripcio_fr;
  } else if (fila.descripcio_ca !== '' && fila.descripcio_fr === '') {
    llenguaOriginal = 'ca';
    original = fila.descripcio_ca;
  } else {
    return;
  }

  var resposta = null;
  try {
    resposta = await demanaTraduccioClaude(fila, llenguaOriginal, original, apiKey);
  } catch (error) {
    console.log('completaTraduccio(): la traducció ha fallat: ' + error.message);
    afegeixNota(fila, AVIS_TRADUCCIO_FALLIDA);
    return;
  }

  var traduccio = campText(resposta, 'traduccio');
  if (traduccio === '') {
    console.log('completaTraduccio(): el model no ha tornat cap traducció.');
    afegeixNota(fila, AVIS_TRADUCCIO_FALLIDA);
    return;
  }

  if (llenguaOriginal === 'fr') {
    fila.descripcio_ca = traduccio;
    afegeixNota(fila, AVIS_TRADUIT_DEL_FRANCES);
  } else {
    fila.descripcio_fr = traduccio;
    afegeixNota(fila, AVIS_TRADUIT_DEL_CATALA);
  }

  // El títol, només si el model n'ha tornat un i és diferent. L'original
  // queda a la nota: el curador hi ha de poder veure si un nom propi
  // s'ha traduït per error.
  var titol = campText(resposta, 'titol');
  if (titol !== '' && titol !== fila.titol) {
    afegeixNota(fila, 'Títol traduït; l\'original era «' + fila.titol + '».');
    fila.titol = titol;
  }
}

// ------------------------------------------------------------
// Una Response de JSON amb el codi que se li digui. Un sol lloc on
// es decideix la forma de la resposta, perquè totes siguin iguals.
// ------------------------------------------------------------
function respostaJson(codi, objecte) {
  return new Response(JSON.stringify(objecte), {
    status: codi,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// ============================================================
// EL CORREU
// ============================================================

// ------------------------------------------------------------
// El text que enviarem al model: l'assumpte, una línia buida i el
// cos. Torna "" si el correu no porta gens de text (ni assumpte ni
// cos): així qui la crida sap que no val la pena cridar Claude.
// ------------------------------------------------------------
function textDelCorreu(correu) {
  var assumpte = '';
  if (correu.subject) {
    assumpte = correu.subject.trim();
  }

  var cos = '';
  if (correu.text) {
    cos = correu.text.trim();
  } else if (correu.html) {
    // Molts correus d'associació arriben NOMÉS en HTML, i postal-mime
    // no els converteix: el camp `text` hi ve buit. Els desbrossem
    // nosaltres perquè el model rebi text i no desenes de kB
    // d'etiquetes i estils.
    cos = textDeHtml(correu.html);
  }

  if (assumpte === '' && cos === '') {
    return '';
  }
  return 'Assumpte: ' + assumpte + '\n\n' + cos;
}

// ------------------------------------------------------------
// Un HTML a text pla, de la manera més tosca que serveix: fora
// <script> i <style>, un salt de línia allà on l'HTML el marca, fora
// la resta d'etiquetes, i quatre entitats desxifrades. No pretén ser
// un navegador: només ha de deixar el text llegible per al model.
// Torna el text.
// ------------------------------------------------------------
function textDeHtml(html) {
  var text = html;
  // El contingut de <script> i <style> no és text del correu.
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  // Les etiquetes que de debò fan salt de línia.
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|table)>/gi, '\n');
  // La resta d'etiquetes, fora.
  text = text.replace(/<[^>]*>/g, ' ');
  // Les entitats que surten de debò en un correu (les altres, si en
  // queda alguna, el model ja les entén pel context).
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/g, '\'');
  // Espais i línies buides repetides, a un.
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]*\n[\s]*\n+/g, '\n\n');
  return text.trim();
}

// ------------------------------------------------------------
// Els adjunts que serveixen de cartell (imatges o PDF), en l'ordre
// del correu i com a molt MAX_CARTELLS_PER_CORREU. Les imatges EN
// LÍNIA s'ignoren expressament: són logotips de signatura i icones de
// xarxes, no cartells. Torna la llista, buida si no n'hi ha cap.
// ------------------------------------------------------------
function cartellsAdjunts(correu) {
  var cartells = [];
  var adjunts = correu.attachments;
  if (!adjunts) {
    return cartells;
  }

  for (var i = 0; i < adjunts.length; i++) {
    var adjunt = adjunts[i];
    if (adjunt.related === true || adjunt.disposition === 'inline') {
      continue;
    }
    var tipus = adjunt.mimeType;
    if (!tipus) {
      continue;
    }
    if (tipus.indexOf('image/') === 0 || tipus === 'application/pdf') {
      cartells.push(adjunt);
      if (cartells.length === MAX_CARTELLS_PER_CORREU) {
        break;
      }
    }
  }
  return cartells;
}

// ------------------------------------------------------------
// Puja els cartells a Cloudinary, d'un en un. Un cartell que no puja
// es registra i es deixa: sense ell les files encara són bones. Torna
// els URL dels que han pujat, en ordre; el model els veu numerats així.
// ------------------------------------------------------------
async function pujaCartells(cartells, cloudName) {
  var urls = [];
  for (var i = 0; i < cartells.length; i++) {
    try {
      urls.push(await pujaCartellCloudinary(cartells[i], cloudName));
    } catch (error) {
      console.log('pujaCartells(): el cartell ' + (i + 1) + ' no s\'ha pogut pujar: ' + error.message);
    }
  }
  return urls;
}

// ============================================================
// CLOUDINARY
// ============================================================

// ------------------------------------------------------------
// Puja un cartell (imatge o PDF) a Cloudinary amb el preset sense
// signatura. Torna l'URL pública (secure_url) o llança un error clar.
// ------------------------------------------------------------
async function pujaCartellCloudinary(adjunt, cloudName) {
  if (!cloudName) {
    throw new Error('falta la variable CLOUDINARY_CLOUD_NAME.');
  }

  var url = 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload';
  var nom = adjunt.filename;
  if (!nom) {
    nom = 'cartell';
  }

  var formulari = new FormData();
  formulari.append('upload_preset', CLOUDINARY_PRESET);
  formulari.append('file', new Blob([adjunt.content], { type: adjunt.mimeType }), nom);

  var resposta = await fetch(url, {
    method: 'POST',
    body: formulari
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Cloudinary ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var dades = await resposta.json();
  if (!dades.secure_url) {
    throw new Error('Cloudinary no ha tornat cap secure_url.');
  }
  return dades.secure_url;
}

// ============================================================
// CLAUDE
// ============================================================

// ------------------------------------------------------------
// Envia el text del correu i els cartells a Claude amb el prompt
// d'extracció, i torna la resposta ja convertida en objecte:
// { esdeveniments: [{ cartell, acte }] } (D-13). Els cartells van
// davant del text, com a imatges per URL de Cloudinary, en l'ordre de
// `urlsCartells`: el primer és el cartell 1. Llança si la crida falla
// o la resposta no és JSON.
// ------------------------------------------------------------
async function demanaExtraccioClaude(textCorreu, urlsCartells, apiKey, avui) {
  var cartells = 'cap';
  if (urlsCartells.length > 0) {
    var numeros = [];
    for (var i = 0; i < urlsCartells.length; i++) {
      numeros.push('cartell ' + (i + 1));
    }
    cartells = urlsCartells.length + ', les imatges que van abans d\'aquest text, en aquest ordre: ' +
      numeros.join(', ');
  }

  var prompt = EXTRACTION_PROMPT.replace('{{AVUI}}', avui).replace('{{CARTELLS}}', cartells);

  var contingut = [];
  for (var j = 0; j < urlsCartells.length; j++) {
    contingut.push({ type: 'image', source: { type: 'url', url: urlsCartells[j] } });
  }
  contingut.push({ type: 'text', text: prompt + textCorreu });

  return await cridaClaude(contingut, esquemaExtraccio(), apiKey, null);
}

// ------------------------------------------------------------
// L'esquema de la resposta d'extracció: un objecte amb la llista
// `esdeveniments`, i cada element amb `cartell` (cadena) i `acte` (les
// 17 claus de CLAUS_EXTRACCIO). És el que l'API fa complir. Torna
// l'esquema.
// ------------------------------------------------------------
function esquemaExtraccio() {
  var element = {
    type: 'object',
    properties: {
      cartell: { type: 'string' },
      acte: esquemaDeCadenes(CLAUS_EXTRACCIO)
    },
    required: ['cartell', 'acte'],
    additionalProperties: false
  };
  return {
    type: 'object',
    properties: {
      esdeveniments: { type: 'array', items: element }
    },
    required: ['esdeveniments'],
    additionalProperties: false
  };
}

// ------------------------------------------------------------
// Demana a Claude la traducció de la descripció d'una tramesa del
// formulari a l'altra llengua, i el títol en català (D-12). Torna
// l'objecte de dues claus (CLAUS_TRADUCCIO_FORMULARI) sense mirar-ne
// cap: qui decideix què se n'escriu és completaTraduccio(). Llança si
// la crida falla, passa de TEMPS_MAXIM_TRADUCCIO_MS o no torna JSON.
// ------------------------------------------------------------
async function demanaTraduccioClaude(fila, llenguaOriginal, original, apiKey) {
  var llenguaOrigen = 'català';
  var llenguaDesti = 'francès';
  if (llenguaOriginal === 'fr') {
    llenguaOrigen = 'francès';
    llenguaDesti = 'català';
  }

  // El text va limitat al sostre del camp, com quedarà a la fila: no
  // es paga la traducció de res que filaSegura() hauria tallat.
  var fitxa = 'LLENGUA ORIGINAL: ' + llenguaOrigen +
    '\nLLENGUA DE DESTINACIÓ: ' + llenguaDesti +
    '\nMUNICIPI: ' + fila.municipi +
    '\nTÍTOL: ' + fila.titol +
    '\nDESCRIPCIÓ: ' + talla(original, SOSTRES.descripcio_ca);

  var senyal = AbortSignal.timeout(TEMPS_MAXIM_TRADUCCIO_MS);
  return await cridaClaude(PROMPT_TRADUCCIO_FORMULARI + '\n' + fitxa, esquemaDeCadenes(CLAUS_TRADUCCIO_FORMULARI), apiKey, senyal);
}

// ------------------------------------------------------------
// Una crida a Claude amb un sol missatge `user` i la resposta obligada
// a aquest esquema JSON. `contingut` és el text del missatge, o una
// llista de blocs (imatges i text). `senyal` és un AbortSignal per
// tallar-la a temps, o null per esperar el que calgui. Torna
// l'objecte. Llança si la crida falla o la resposta no és JSON.
// ------------------------------------------------------------
async function cridaClaude(contingut, esquema, apiKey, senyal) {
  if (!apiKey) {
    throw new Error('falta el secret ANTHROPIC_API_KEY.');
  }

  var cos = {
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    // AMB PENSAMENT, I A ESFORÇ ALT, com a l'Action. A la prova del
    // 23 d'octubre de 2026 sobre 19 files de l'ADT66, Haiku sense
    // pensar saltava les regles del prompt en 15 i amb pensament en
    // cap (NOTES.md). L'extracció també és seguir regles: no
    // inventar, comarca i categoria de la llista, dates. El
    // pensament no torna cap text (un bloc `thinking` buit, que
    // extreuTextResposta() salta) però es paga com a sortida i compta
    // dins de CLAUDE_MAX_TOKENS. Cap `temperature`: la versió
    // CLAUDE_VERSIO_API la rebutja.
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: esquema }
    },
    messages: [
      { role: 'user', content: contingut }
    ]
  };

  var peticio = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': CLAUDE_VERSIO_API
    },
    body: JSON.stringify(cos)
  };
  if (senyal !== null) {
    peticio.signal = senyal;
  }

  var resposta = await fetch(CLAUDE_URL, peticio);

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Claude ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var dades = await resposta.json();
  var text = extreuTextResposta(dades);
  return analitzaJsonResposta(text);
}

// ------------------------------------------------------------
// Treu el text de resposta de dins l'objecte que torna Claude.
// Llança un error clar si la resposta ve tallada, declinada o
// sense text. El text es busca pel TIPUS de bloc, mai per la
// posició: només el bloc `type === 'text'` és la resposta.
// Torna el text.
// ------------------------------------------------------------
function extreuTextResposta(dades) {
  if (dades.stop_reason === 'max_tokens') {
    throw new Error('la resposta de Claude s\'ha tallat (max_tokens): apuja CLAUDE_MAX_TOKENS.');
  }
  if (dades.stop_reason === 'refusal') {
    throw new Error('Claude ha declinat la petició (stop_reason: refusal).');
  }

  var blocs = Array.isArray(dades.content) ? dades.content : [];
  for (var i = 0; i < blocs.length; i++) {
    if (blocs[i] && blocs[i].type === 'text' && typeof blocs[i].text === 'string') {
      return blocs[i].text;
    }
  }
  throw new Error('la resposta de Claude no conté text (stop_reason: ' + dades.stop_reason + ').');
}

// ------------------------------------------------------------
// L'esquema JSON d'un objecte amb aquestes claus: totes cadenes,
// totes obligatòries i cap més. És el que l'API fa complir a la
// resposta. Torna l'esquema.
// ------------------------------------------------------------
function esquemaDeCadenes(claus) {
  var propietats = {};
  for (var i = 0; i < claus.length; i++) {
    propietats[claus[i]] = { type: 'string' };
  }
  return {
    type: 'object',
    properties: propietats,
    required: claus.slice(),
    additionalProperties: false
  };
}

// ------------------------------------------------------------
// Converteix el text del model en objecte. Se li demana JSON i prou,
// però per si de cas es talla del primer "{" a l'últim "}" abans de
// parsejar. Llança si no hi ha objecte JSON. Torna l'objecte.
// ------------------------------------------------------------
function analitzaJsonResposta(text) {
  var inici = text.indexOf('{');
  var fi = text.lastIndexOf('}');
  if (inici === -1 || fi === -1 || fi < inici) {
    throw new Error('la resposta del model no conté cap objecte JSON.');
  }

  var objecte = JSON.parse(text.substring(inici, fi + 1));
  if (typeof objecte !== 'object' || objecte === null || Array.isArray(objecte)) {
    throw new Error('la resposta del model no és un objecte JSON.');
  }
  return objecte;
}

// ============================================================
// LA FILA
// ============================================================

// ------------------------------------------------------------
// Munta la fila de 17 camps, cadascun pel seu nom i en l'ordre de
// l'esquema (CLAUDE.md §4). Tot són cadenes; cap valor buit no és
// mai null. Torna l'objecte de la fila.
// ------------------------------------------------------------
function construeixFila(dadesExtretes, imatgeUrl) {
  var titol = campText(dadesExtretes, 'titol');
  var dataInici = campText(dadesExtretes, 'data_inici');
  var dataFi = campText(dadesExtretes, 'data_fi');

  // Un acte d'un sol dia pot arribar sense data_fi. L'esquema diu
  // que en aquest cas data_fi és igual a data_inici.
  if (dataFi === '') {
    dataFi = dataInici;
  }

  return {
    // --- L'id el reconstrueix sempre el sistema, mai el model ---
    id: creaId(dataInici, titol),
    // --- Els camps que dedueix el model ---
    titol: titol,
    data_inici: dataInici,
    data_fi: dataFi,
    hora: campText(dadesExtretes, 'hora'),
    lloc: campText(dadesExtretes, 'lloc'),
    municipi: campText(dadesExtretes, 'municipi'),
    comarca: valorPermes(campText(dadesExtretes, 'comarca'), COMARCA_VALUES),
    categoria: valorPermes(campText(dadesExtretes, 'categoria'), CATEGORIA_VALUES),
    descripcio_ca: campText(dadesExtretes, 'descripcio_ca'),
    descripcio_fr: campText(dadesExtretes, 'descripcio_fr'),
    associacio: campText(dadesExtretes, 'associacio'),
    // --- Els camps que omple el sistema, mai el model ---
    imatge_url: imatgeUrl,                    // Cloudinary, o "" si no n'hi ha
    font_url: '',                             // un correu no porta cap enllaç de font
    estat: 'pendent',                         // sempre: espera el curador
    data_entrada: new Date().toISOString(),   // quan s'ha creat la fila
    periodicitat: campText(dadesExtretes, 'periodicitat')
  };
}

// ------------------------------------------------------------
// Llegeix un camp d'un objecte i el torna com a cadena neta. Un camp
// que falta, buit o null torna "". Així la resta del codi no ha de
// comprovar mai res.
// ------------------------------------------------------------
function campText(objecte, clau) {
  var valor = objecte[clau];
  if (valor === undefined || valor === null) {
    return '';
  }
  return String(valor).trim();
}

// ------------------------------------------------------------
// Còpia literal de creaId (curador.html). Fa
// l'id: la data d'inici, un guió, i un pedaç curt fet de les tres
// primeres paraules del títol. El sistema RECONSTRUEIX sempre l'id,
// mai es refia del que hagi tornat el model. Torna "" si no hi ha
// data d'inici.
// ------------------------------------------------------------
function creaId(dataInici, titol) {
  if (dataInici === '') {
    return '';
  }

  var text = titol.toLowerCase();
  // Parteix les lletres accentuades en lletra + accent i llença els
  // accents (à -> a, é -> e, ç -> c...).
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Fora apòstrofs, drets i corbats.
  text = text.replace(/['’]/g, '');
  // Tot el que no sigui lletra, xifra o espai es torna espai.
  text = text.replace(/[^a-z0-9]+/g, ' ');
  text = text.trim();

  if (text === '') {
    return dataInici;
  }

  var paraules = text.split(/\s+/);
  var paraulesCurtes = paraules.slice(0, 3);
  return dataInici + '-' + paraulesCurtes.join('-');
}

// ------------------------------------------------------------
// Còpia literal de valorPermes (curador.html).
// Torna el valor si és a la llista permesa, si no "".
// ------------------------------------------------------------
function valorPermes(valor, llistaPermesa) {
  if (llistaPermesa.indexOf(valor) === -1) {
    return '';
  }
  return valor;
}

// ============================================================
// LA FILA SEGURA — CÒPIA LITERAL
// ============================================================
//
// Tot el que hi ha d'aquí fins a la secció GITHUB és una còpia LITERAL
// d'eines/fila-segura.js (llevat de campSegur(), que aquí no cal) i de
// l'esUrlSegura() d'url-segura.js. Les dues portes passen la fila per
// filaSegura() abans d'escriure-la: divuit camps, tots cadenes, els
// sostres, el títol d'una línia, les dates, les adreces i la nota.
// creaId() i valorPermes() ja són més amunt.
//
// NO ES TOCA AQUÍ. Es toca l'original, es copia aquí, i
// `node eines/verifica-copies-worker.js` ha de sortir en verd.

// Els únics esquemes que poden anar a un enllaç. `http:` hi és a posta:
// encara hi ha webs d'organitzadors que no tenen `https:`.
var ESQUEMES_SEGURS = ['http:', 'https:'];

// Els divuit camps de la fila, amb el nom i l'ordre del §4 de CLAUDE.md.
var CAMPS = [
  'id', 'titol', 'data_inici', 'data_fi', 'hora', 'lloc', 'municipi',
  'comarca', 'categoria', 'descripcio_ca', 'descripcio_fr', 'associacio',
  'imatge_url', 'font_url', 'estat', 'data_entrada', 'periodicitat',
  'nota_curador'
];

// El sostre de cada camp de text, en caràcters. No són cap regla editorial:
// impedeixen que una sola fila faci créixer la cua sense límit (l'API de
// continguts de GitHub no torna res per damunt d'1 MB, D-08) i que es pagui
// la traducció d'un text desmesurat.
//
// Mesurats el 29 d'octubre de 2026 sobre el flux sencer de l'ADT66 (1 367
// ofertes, ja mapejades) i les 1 225 files de pendents.json i events.json: el
// valor més llarg de cada camp hi cap amb marge. El que més s'hi acosta és
// una descripció de l'ADT66 de 5 610 caràcters; la segona en fa 3 872.
var SOSTRES = {
  titol: 200,
  hora: 20,
  lloc: 300,
  municipi: 100,
  descripcio_ca: 6000,
  descripcio_fr: 6000,
  associacio: 300,
  periodicitat: 200,
  nota_curador: 2000
};

// Una adreça més llarga no és de cap cartell ni de cap web de debò (la més
// llarga del 29 d'octubre en fa 199). Es buida i no es talla: una adreça
// tallada ja no porta enlloc.
var SOSTRE_ADRECA = 2000;

var PATRO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// El tag d'ancoratge al davant de la nota, amb la forma que li dona
// creaTagIdentificador() a eines/adt66-identificador.js.
var PATRO_TAG_AL_DAVANT = /^\[ADT66 id: [^\s\]]+\]/;

// ------------------------------------------------------------
// La fila neta que pot entrar a la cua, feta dels camps que dona una porta.
// `origen` és 'adt66', 'correu' o 'formulari': només l'ADT66 pot dur el tag
// d'ancoratge al davant de la nota. Torna una fila nova; la d'entrada no es
// toca.
// ------------------------------------------------------------
function filaSegura(campsBruts, origen) {
  var bruts = campsBruts || {};
  var avisos = [];
  var fila = {};

  for (var i = 0; i < CAMPS.length; i++) {
    fila[CAMPS[i]] = textDelCamp(CAMPS[i], bruts[CAMPS[i]]);
  }

  tallaAlsSostres(fila, avisos);

  fila.data_inici = dataSegura(fila.data_inici, 'La data d\'inici', avisos);
  fila.data_fi = dataSegura(fila.data_fi, 'La data de fi', avisos);
  fila.comarca = valorPermes(fila.comarca, COMARCA_VALUES);
  fila.categoria = valorPermes(fila.categoria, CATEGORIA_VALUES);
  fila.imatge_url = adrecaSegura(fila.imatge_url, 'El cartell', avisos);
  fila.font_url = adrecaSegura(fila.font_url, 'L\'enllaç de la font', avisos);

  // Els tres camps del sistema: mai els que arriben.
  fila.id = creaId(fila.data_inici, fila.titol);
  fila.estat = 'pendent';
  fila.data_entrada = new Date().toISOString();

  fila.nota_curador = ajuntaAvisos(notaSenseTagsFalsos(fila.nota_curador, origen), avisos);

  return fila;
}

// ------------------------------------------------------------
// Un valor qualsevol com a cadena retallada; el títol, a més, en una sola
// línia. Un valor desconegut és "" (§4 de CLAUDE.md: mai null, mai omès).
// ------------------------------------------------------------
function textDelCamp(camp, valor) {
  var text = '';
  if (valor !== undefined && valor !== null) {
    text = String(valor).trim();
  }

  if (camp === 'titol') {
    text = text.replace(/\s+/g, ' ');
  }

  return text;
}

// ------------------------------------------------------------
// Talla cada camp de text al seu sostre i avisa de cada camp tallat.
// ------------------------------------------------------------
function tallaAlsSostres(fila, avisos) {
  var camps = Object.keys(SOSTRES);

  for (var i = 0; i < camps.length; i++) {
    var camp = camps[i];
    var tallat = talla(fila[camp], SOSTRES[camp]);
    if (tallat !== fila[camp]) {
      fila[camp] = tallat;
      avisos.push('El camp ' + camp + ' passava de ' + SOSTRES[camp] + ' caràcters i s\'ha tallat: reviseu-ne el final.');
    }
  }
}

// ------------------------------------------------------------
// El text tallat a `sostre` caràcters. Compta caràcters de debò i no unitats
// UTF-16, perquè el tall no parteixi mai un emoji per la meitat. Sense
// sostre, o si ja hi cap, el torna igual.
// ------------------------------------------------------------
function talla(text, sostre) {
  if (sostre === undefined || text.length <= sostre) {
    return text;
  }

  var caracters = Array.from(text);
  if (caracters.length <= sostre) {
    return text;
  }

  return caracters.slice(0, sostre).join('').trim();
}

// ------------------------------------------------------------
// La data si té la forma AAAA-MM-DD, o "" amb un avís. L'avís no copia el
// valor: cap text de fora no ha d'anar a parar a la nota.
// ------------------------------------------------------------
function dataSegura(valor, quina, avisos) {
  if (valor === '' || PATRO_DATA.test(valor)) {
    return valor;
  }

  avisos.push(quina + ' no tenia la forma AAAA-MM-DD i queda buida: poseu-la a mà.');
  return '';
}

// ------------------------------------------------------------
// L'adreça si pot anar a un enllaç (http o https, url-segura.js) i no és
// desmesurada, o "" amb un avís. Com a la data, l'avís no la copia.
// ------------------------------------------------------------
function adrecaSegura(adreca, quina, avisos) {
  if (adreca === '') {
    return '';
  }
  if (adreca.length <= SOSTRE_ADRECA && esUrlSegura(adreca)) {
    return adreca;
  }

  avisos.push(quina + ' no era cap adreça web (http o https) o era massa llarga: queda buit.');
  return '';
}

// ------------------------------------------------------------
// La nota sense cap claudàtor, llevat del tag d'ancoratge que una fila de
// l'ADT66 porta al davant. Així cap text de dins la nota no pot ser un tag
// [ADT66 id: …] que dedup-contra-fitxers.js llegiria com a bo.
// ------------------------------------------------------------
function notaSenseTagsFalsos(nota, origen) {
  var tag = '';
  var resta = nota;

  if (origen === 'adt66') {
    var trobat = nota.match(PATRO_TAG_AL_DAVANT);
    if (trobat !== null) {
      tag = trobat[0];
      resta = nota.slice(tag.length);
    }
  }

  return tag + resta.replace(/[\[\]]/g, '');
}

// ------------------------------------------------------------
// Els avisos d'aquest mòdul darrere de la nota, separats per un espai: la
// mateixa regla que ajuntaNotes() (eines/dedup-esdeveniments.js).
// ------------------------------------------------------------
function ajuntaAvisos(nota, avisos) {
  var parts = [];
  if (nota !== '') {
    parts.push(nota);
  }
  return parts.concat(avisos).join(' ');
}

// ------------------------------------------------------------
// Diu si una adreça es pot posar a un `href`: absoluta, i amb esquema
// `http:` o `https:`. Una cadena buida, o qualsevol cosa que no sigui una
// cadena, no. L'analitza `new URL()`, el mateix analitzador del navegador:
// els espais i tabuladors que el navegador ignoraria dins `java script:`
// també els ignora aquí, i l'esquema surt igual que el veuria el navegador.
// ------------------------------------------------------------
function esUrlSegura(url) {
  if (typeof url !== 'string' || url === '') {
    return false;
  }

  var analitzada;
  try {
    analitzada = new URL(url);
  } catch (error) {
    return false;
  }

  return ESQUEMES_SEGURS.indexOf(analitzada.protocol) !== -1;
}

// ============================================================
// LA PORTA D'ENTRADA — CÒPIA LITERAL
// ============================================================
//
// Les constants i les dues funcions de sota són una còpia LITERAL
// d'eines/admet-entrada.js: quantes files poden entrar per dia per les
// dues portes, i quant del text d'un correu va al model (D-09).
//
// NO ES TOCA AQUÍ. Es toca l'original, es copia aquí, i
// `node eines/verifica-copies-worker.js` ha de sortir en verd.

// Les files que poden entrar en un dia per les dues portes manuals juntes.
// Mesurat el 29 d'octubre de 2026 a l'historial de git: des del 28 d'agost hi
// han entrat 4 files (1 per correu, 3 pel formulari), com a molt 3 en un dia,
// i totes de prova. Vint és molt per sobre de l'ús d'avui i encara para una
// riuada el mateix dia.
var MAX_FILES_PORTES_PER_DIA = 20;

// Els caràcters d'un correu que van al model, assumpte inclòs. Un anunci
// d'associació en fa uns quants centenars; vint mil ja és un butlletí sencer.
var MAX_CARACTERS_CORREU = 20000;

// El començament del tag que posa el mapeig de l'ADT66 al davant de la nota.
var MARCA_ADT66 = '[ADT66 id: ';

// ------------------------------------------------------------
// La decisió d'una tramesa: { admesa, text, avis, motiu }. `text` és el que
// pot anar al model (tallat si calia), `avis` el que s'ha de dir al curador si
// s'ha tallat, i `motiu` el que va al registre si no s'admet.
// ------------------------------------------------------------
function admetEntrada(text, filesAvui) {
  if (filesAvui >= MAX_FILES_PORTES_PER_DIA) {
    return {
      admesa: false,
      text: '',
      avis: '',
      motiu: 'avui ja han entrat ' + filesAvui + ' files per les portes manuals (sostre: ' +
        MAX_FILES_PORTES_PER_DIA + '). No s\'admet res més fins demà.'
    };
  }

  var caracters = Array.from(text);
  if (caracters.length <= MAX_CARACTERS_CORREU) {
    return { admesa: true, text: text, avis: '', motiu: '' };
  }

  return {
    admesa: true,
    text: caracters.slice(0, MAX_CARACTERS_CORREU).join(''),
    avis: 'El correu passava de ' + MAX_CARACTERS_CORREU + ' caràcters i el model només n\'ha llegit el principi: l\'original és a l\'arxiu.',
    motiu: ''
  };
}

// ------------------------------------------------------------
// Quantes files de la cua han entrat avui per les portes manuals: data_entrada
// d'avui (AAAA-MM-DD en UTC, com la marca ISO) i cap tag de l'ADT66 al davant.
// ------------------------------------------------------------
function filesDeLesPortesDAvui(cua, avui) {
  var quantes = 0;

  for (var i = 0; i < cua.length; i++) {
    var fila = cua[i] || {};
    var entrada = typeof fila.data_entrada === 'string' ? fila.data_entrada : '';
    var nota = typeof fila.nota_curador === 'string' ? fila.nota_curador : '';
    if (entrada.slice(0, 10) === avui && nota.indexOf(MARCA_ADT66) !== 0) {
      quantes++;
    }
  }

  return quantes;
}

// ============================================================
// ELS ACTES PASSATS — CÒPIA LITERAL
// ============================================================
//
// Les tres funcions de sota són una còpia LITERAL de les de
// curador-cua.js: la regla única de «ja ha passat» (CLAUDE.md §4). El
// correu la fa servir per no encuar els actes d'un butlletí que ja
// han passat (D-13).
//
// NO ES TOCA AQUÍ. Es toca l'original, es copia aquí, i
// `node eines/verifica-copies-worker.js` ha de sortir en verd.

// ------------------------------------------------------------
// Diu si l'acte d'una fila ja ha passat: el seu últim dia és anterior a
// `avui` (AAAA-MM-DD). Una fila sense cap data utilitzable no ha passat:
// no es pot dir, i es queda.
// ------------------------------------------------------------
function esCaducada(fila, avui) {
  var darrerDia = darrerDiaDeLActe(fila);

  if (darrerDia === '') {
    return false;
  }

  return darrerDia < avui;
}

// ------------------------------------------------------------
// L'últim dia de l'acte: `data_fi`, o `data_inici` si `data_fi` és buida.
// Torna '' si la data que toca no té la forma AAAA-MM-DD.
// ------------------------------------------------------------
function darrerDiaDeLActe(fila) {
  var dataFi = fila.data_fi;

  if (dataFi === undefined || dataFi === null || String(dataFi).trim() === '') {
    dataFi = fila.data_inici;
  }

  if (!esData(dataFi)) {
    return '';
  }

  return dataFi;
}

// ------------------------------------------------------------
// Diu si un valor té la forma AAAA-MM-DD. No comprova que el dia existeixi:
// aquí només cal saber si es pot comparar com a data.
// ------------------------------------------------------------
function esData(valor) {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

// ============================================================
// GITHUB
// ============================================================

// ------------------------------------------------------------
// Llegeix pendents.json i hi aplica admetEntrada(): quantes files han
// entrat avui per les portes manuals, i quant del text pot anar al
// model. Llança si falta el token o la cua no es pot llegir: sense
// saber-ho no s'admet res, i encara no s'ha pagat cap crida. Torna la
// decisió d'admetEntrada(), amb dues dades més que fan servir els
// correus de diversos actes (D-13): `cua`, la cua que s'ha llegit, i
// `lloc`, quantes files poden entrar encara avui.
// ------------------------------------------------------------
async function decideixAdmissio(text, token) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var actual = await llegeixFitxerGitHub(FITXER_PENDENTS, token);
  if (!Array.isArray(actual.dades)) {
    throw new Error(FITXER_PENDENTS + ' no conté una llista.');
  }

  var avui = new Date().toISOString().slice(0, 10);
  var filesAvui = filesDeLesPortesDAvui(actual.dades, avui);
  var decisio = admetEntrada(text, filesAvui);
  decisio.cua = actual.dades;
  decisio.lloc = MAX_FILES_PORTES_PER_DIA - filesAvui;
  return decisio;
}

// ------------------------------------------------------------
// Afegeix una o més files a pendents.json, en un sol commit. Llegeix
// el fitxer fresc, hi posa les files al DAVANT i en el seu ordre (el
// curador vol veure primer el que acaba d'arribar, i curador.html
// pinta la cua en l'ordre del fitxer) i l'escriu. Si el sha ha canviat
// perquè algú altre ha escrit al mateix moment, torna a llegir i
// reintenta un cop. No torna res.
//
// La comparteixen els dos camins d'entrada: `origen` ('correu' o
// 'formulari') només serveix per al missatge del commit, que és
// l'única traça de per quina porta ha entrat cada fila.
// ------------------------------------------------------------
async function afegeixAPendents(files, token, origen) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var titols = [];
  for (var i = 0; i < files.length; i++) {
    var titol = files[i].titol;
    if (titol === '') {
      titol = '(sense títol)';
    }
    titols.push(titol);
  }
  var missatgeCommit = 'Fila nova a la cua (' + origen + '): ' + titols[0];
  if (files.length > 1) {
    missatgeCommit = files.length + ' files noves a la cua (' + origen + '): ' + titols.join(' · ');
  }

  var intents = 0;
  while (intents < 2) {
    var actual = await llegeixFitxerGitHub(FITXER_PENDENTS, token);
    if (!Array.isArray(actual.dades)) {
      throw new Error(FITXER_PENDENTS + ' no conté una llista.');
    }
    var cua = files.concat(actual.dades);

    try {
      await escriuFitxerGitHub(FITXER_PENDENTS, cua, actual.sha, missatgeCommit, token);
      return;
    } catch (error) {
      intents++;
      // Un conflicte de sha és l'únic error que val la pena reintentar.
      var esConflicte = error.message.indexOf('codi 409') !== -1 ||
        error.message.indexOf('codi 422') !== -1;
      if (!esConflicte || intents >= 2) {
        throw error;
      }
    }
  }
}

// ------------------------------------------------------------
// Les capçaleres de cada crida a l'API de GitHub. El User-Agent hi
// és perquè l'API el demana sempre: sense ell respon 403 (al
// navegador el posa el navegador, aquí l'hem de posar nosaltres).
// ------------------------------------------------------------
function capcaleresGitHub(token) {
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'quefas-worker',
    'Authorization': 'Bearer ' + token
  };
}

// ------------------------------------------------------------
// Llegeix un fitxer JSON del repositori per l'API de continguts.
// Sempre per l'API, mai de Pages, que serveix còpies de CDN
// endarrerides. Torna { dades, sha } o llança un error clar.
// ------------------------------------------------------------
async function llegeixFitxerGitHub(nomFitxer, token) {
  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/contents/' + nomFitxer + '?ref=' + GITHUB_BRANCH;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: capcaleresGitHub(token)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('no he pogut llegir ' + nomFitxer + ' (codi ' + resposta.status + '). ' + detall);
  }

  var fitxer = await resposta.json();

  // Per damunt d'1 MB l'API de continguts torna `content` buit
  // (encoding "none"): el contingut es demana a l'API de blobs.
  if (fitxer.encoding === 'none') {
    var respostaBlob = await fetch(fitxer.git_url, {
      method: 'GET',
      headers: capcaleresGitHub(token)
    });
    if (!respostaBlob.ok) {
      throw new Error('no he pogut llegir el blob de ' + nomFitxer + ' (codi ' + respostaBlob.status + ').');
    }
    var blob = await respostaBlob.json();
    fitxer.content = blob.content;
  }

  return {
    dades: JSON.parse(descodificaBase64(fitxer.content)),
    sha: fitxer.sha
  };
}

// ------------------------------------------------------------
// Escriu un fitxer JSON al repositori amb un sol PUT. Cal el sha
// actual: l'API el demana per acceptar la substitució. No torna res
// i llança un error amb el codi a dins (el reintent el llegeix).
// ------------------------------------------------------------
async function escriuFitxerGitHub(nomFitxer, dades, sha, missatgeCommit, token) {
  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/contents/' + nomFitxer;

  var cos = {
    message: missatgeCommit,
    content: codificaBase64(JSON.stringify(dades, null, 2) + '\n'),
    sha: sha,
    branch: GITHUB_BRANCH
  };

  var resposta = await fetch(url, {
    method: 'PUT',
    headers: capcaleresGitHub(token),
    body: JSON.stringify(cos)
  });

  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('GitHub ha rebutjat l\'escriptura de ' + nomFitxer +
      ' (codi ' + resposta.status + '). ' + detall);
  }
}

// ------------------------------------------------------------
// Text UTF-8 a base64, que és com l'API de GitHub vol el contingut.
// Es passa per bytes perquè btoa sol no sap res dels accents.
// ------------------------------------------------------------
function codificaBase64(text) {
  var bytes = new TextEncoder().encode(text);
  var binari = '';
  for (var i = 0; i < bytes.length; i++) {
    binari += String.fromCharCode(bytes[i]);
  }
  return btoa(binari);
}

// ------------------------------------------------------------
// Base64 a text UTF-8. El contingut que torna GitHub ve amb salts
// de línia cada 60 caràcters: es treuen abans de descodificar.
// ------------------------------------------------------------
function descodificaBase64(base64) {
  var binari = atob(base64.replace(/\n/g, ''));
  var bytes = new Uint8Array(binari.length);
  for (var i = 0; i < binari.length; i++) {
    bytes[i] = binari.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ============================================================
// EL DIGEST SETMANAL (BREVO)
// ============================================================

// ------------------------------------------------------------
// L'hora que és a París en un moment donat, com a número de 0 a 23.
// El cron és en UTC i no sap res de l'horari d'estiu; aquesta funció
// sí, perquè el fus «Europe/Paris» el resol el motor de JavaScript.
// Torna el número de l'hora.
// ------------------------------------------------------------
function horaDeParis(data) {
  var format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hourCycle: 'h23'
  });
  return parseInt(format.format(data), 10);
}

// ------------------------------------------------------------
// La data que és a París en un moment donat, com a "AAAA-MM-DD". Es
// munta per parts, i no amb un format sencer, perquè es vegi que
// l'ordre és any-mes-dia i no cap altre. Torna la cadena.
// ------------------------------------------------------------
function dataDeParis(data) {
  var format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  var parts = format.formatToParts(data);
  var any = '';
  var mes = '';
  var dia = '';
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === 'year') {
      any = parts[i].value;
    }
    if (parts[i].type === 'month') {
      mes = parts[i].value;
    }
    if (parts[i].type === 'day') {
      dia = parts[i].value;
    }
  }
  return any + '-' + mes + '-' + dia;
}

// ------------------------------------------------------------
// La data "AAAA-MM-DD" que hi haurà d'aquí a tants dies. Tanca la
// finestra del digest. Es compta a partir de mitjanit UTC perquè el
// resultat només serveix per comparar-lo amb altres cadenes ISO, i
// les cadenes ISO s'ordenen igual que les dates. Torna la cadena.
// ------------------------------------------------------------
function dataMesDies(dataText, dies) {
  var milisegonsPerDia = 24 * 60 * 60 * 1000;
  var inici = new Date(dataText + 'T00:00:00Z');
  var futur = new Date(inici.getTime() + dies * milisegonsPerDia);
  return futur.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// El digest de la setmana, de cap a cap: llegeix els actes publicats
// dels propers dies i, per cada comarca que en tingui, envia un
// correu a cada subscriptor que encara no l'hagi rebut avui. Llança
// si no pot llegir events.json o el registre de Brevo; una comarca
// que falla, en canvi, no atura les altres. No torna res.
// ------------------------------------------------------------
async function enviaDigestSetmanal(env, ara) {
  var apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('falta el secret BREVO_API_KEY.');
  }

  var avui = dataDeParis(ara);
  var final = dataMesDies(avui, DIES_FINESTRA);
  var setmanaText = dataLlegibleCatala(avui);

  var llistes = await llegeixEsdevenimentsDeLaSetmana(env.GITHUB_TOKEN, avui, final);
  var setmana = llistes.setmana;
  var permanents = llistes.permanents;
  if (setmana.length === 0) {
    console.log('enviaDigestSetmanal(): cap acte publicat entre ' + avui + ' i ' + final + '. No s\'envia res.');
    return;
  }

  // LA GUARDA, abans de tocar cap llista i abans d'enviar res. Si
  // aquesta lectura peta, la funció sencera peta i no s'envia res:
  // sense saber a qui ja s'ha enviat, val més quedar-se curt.
  var jaEnviats = await adrecesJaEnviadesAvui(apiKey, avui);

  var pressupost = MAX_ENVIAMENTS_PER_EXECUCIO;
  var totalEnviats = 0;

  for (var i = 0; i < COMARQUES_BREVO.length; i++) {
    var fila = COMARQUES_BREVO[i];
    var actes = actesDeLaComarca(setmana, fila.comarca);
    var actesPermanents = actesDeLaComarca(permanents, fila.comarca);
    if (actes.length === 0) {
      continue; // una comarca sense actes aquesta setmana no envia res; les permanents no fan enviar cap digest per si soles
    }
    if (pressupost <= 0) {
      console.log('enviaDigestSetmanal(): pressupost exhaurit. La propera despertada continuarà per ' + fila.comarca + '.');
      break;
    }

    // Una comarca que peta —un id de llista dolent, Brevo caigut— no
    // ha d'endur-se el digest de les altres quatre.
    try {
      var enviats = await enviaDigestComarca(fila, actes, actesPermanents, env, apiKey, jaEnviats, avui, setmanaText, pressupost);
      pressupost = pressupost - enviats;
      totalEnviats = totalEnviats + enviats;
    } catch (error) {
      console.log('enviaDigestSetmanal(): el digest de ' + fila.comarca + ' ha fallat sencer: ' + error.message);
    }
  }

  var totalAvui = jaEnviats.size + totalEnviats;
  console.log('enviaDigestSetmanal(): ' + totalEnviats + ' correus en aquesta despertada, ' + totalAvui + ' en tot el dia.');

  if (totalAvui >= BREVO_LLINDAR_AVIS) {
    console.log('enviaDigestSetmanal(): AVÍS — ' + totalAvui + ' correus avui, a prop del sostre gratuït de Brevo (' +
      BREVO_MAX_DIARI + ' al dia). Convé planificar el pas a campanyes.');
  }
}

// ------------------------------------------------------------
// Una sola lectura d'events.json, SEMPRE per l'API de continguts de
// GitHub (mai de Pages, que serveix còpies de CDN endarrerides), que
// en treu DUES llistes (Q4 de NOTES.md, «Activitats permanents»):
// «setmana» — els actes publicats que comencen entre dues dates, totes
// dues incloses — i «permanents» — els actes publicats amb
// `periodicitat` no buida i `data_fi >= avui`, tinguin o no ocurrència
// aquella setmana. Cada acte es torna a muntar camp a camp perquè tots
// els valors siguin cadenes. Totes dues llistes, ordenades per data i
// hora, potser buides. Torna { setmana, permanents }.
// ------------------------------------------------------------
async function llegeixEsdevenimentsDeLaSetmana(token, avui, final) {
  if (!token) {
    throw new Error('falta el secret GITHUB_TOKEN.');
  }

  var actual = await llegeixFitxerGitHub(FITXER_EVENTS, token);
  var tots = actual.dades;
  if (!Array.isArray(tots)) {
    throw new Error(FITXER_EVENTS + ' no conté una llista.');
  }

  var setmana = [];
  var permanents = [];

  for (var i = 0; i < tots.length; i++) {
    var acte = tots[i];

    if (campText(acte, 'estat') !== 'publicat') {
      continue;
    }

    var dataInici = campText(acte, 'data_inici');
    var dataFi = campText(acte, 'data_fi');
    var periodicitat = campText(acte, 'periodicitat');

    var muntat = {
      titol: campText(acte, 'titol'),
      data_inici: dataInici,
      data_fi: dataFi,
      hora: campText(acte, 'hora'),
      lloc: campText(acte, 'lloc'),
      municipi: campText(acte, 'municipi'),
      comarca: campText(acte, 'comarca'),
      categoria: campText(acte, 'categoria'),
      descripcio_ca: campText(acte, 'descripcio_ca'),
      descripcio_fr: campText(acte, 'descripcio_fr'),
      associacio: campText(acte, 'associacio'),
      periodicitat: periodicitat
    };

    if (periodicitat !== '' && dataFi >= avui) {
      permanents.push(muntat);
    }

    // Una data buida és "" i queda per sota d'avui: els actes sense
    // data cauen aquí, que és exactament on han de caure.
    if (dataInici >= avui && dataInici <= final) {
      setmana.push(muntat);
    }
  }

  setmana.sort(comparaPerDataIHora);
  permanents.sort(comparaPerDataIHora);
  return { setmana: setmana, permanents: permanents };
}

// ------------------------------------------------------------
// Comparador per a sort: ordena els actes per data d'inici i, dins
// del mateix dia, per hora. Tots dos camps són cadenes. Torna un
// número negatiu, zero o positiu.
// ------------------------------------------------------------
function comparaPerDataIHora(a, b) {
  if (a.data_inici < b.data_inici) {
    return -1;
  }
  if (a.data_inici > b.data_inici) {
    return 1;
  }
  if (a.hora < b.hora) {
    return -1;
  }
  if (a.hora > b.hora) {
    return 1;
  }
  return 0;
}

// ------------------------------------------------------------
// Els actes d'una comarca i prou. Un acte amb la comarca buida o
// desconeguda no surt en cap digest: no hi ha cap llista on posar-lo.
// Torna una llista, potser buida.
// ------------------------------------------------------------
function actesDeLaComarca(esdeveniments, comarca) {
  var triats = [];
  for (var i = 0; i < esdeveniments.length; i++) {
    if (esdeveniments[i].comarca === comarca) {
      triats.push(esdeveniments[i]);
    }
  }
  return triats;
}

// ------------------------------------------------------------
// A qui ja s'ha enviat el digest d'avui, segons el registre
// d'enviaments del mateix Brevo. Torna un conjunt de claus
// "etiqueta|adreça": per comarca I per persona, no només per dia.
// Això és tot el sistema d'idempotència del digest — no hi ha cap
// altre lloc on es desi estat. LLANÇA si el registre no es pot
// llegir, i és a posta: qui la crida no ha d'enviar res.
// ------------------------------------------------------------
async function adrecesJaEnviadesAvui(apiKey, avui) {
  var prefix = 'digest-' + avui + '-';
  var jaEnviats = new Set();
  var desplacament = 0;

  while (true) {
    var pagina = await paginaHistorialBrevo(apiKey, avui, desplacament);
    var correus = pagina.transactionalEmails;

    if (!Array.isArray(correus) || correus.length === 0) {
      break; // cap enviament més
    }

    for (var i = 0; i < correus.length; i++) {
      var correu = correus[i];
      var etiquetes = correu.tags;
      if (!Array.isArray(etiquetes)) {
        continue; // un correu sense etiquetes no és cap digest nostre
      }
      for (var j = 0; j < etiquetes.length; j++) {
        if (etiquetes[j].indexOf(prefix) === 0) {
          jaEnviats.add(etiquetes[j] + '|' + correu.email);
        }
      }
    }

    // Una pàgina més curta que el màxim vol dir que ja no n'hi ha més.
    if (correus.length < BREVO_PER_PAGINA) {
      break;
    }
    desplacament = desplacament + BREVO_PER_PAGINA;
  }

  return jaEnviats;
}

// ------------------------------------------------------------
// UNA pàgina del registre d'enviaments d'avui. Un 204 vol dir «cap
// enviament» i Brevo el respon amb el cos buit: es tracta com una
// pàgina buida i prou. Llança en qualsevol altre error. Torna
// l'objecte de la resposta, que porta .transactionalEmails.
// ------------------------------------------------------------
async function paginaHistorialBrevo(apiKey, avui, desplacament) {
  var url = BREVO_HISTORIAL_URL +
    '?startDate=' + avui +
    '&endDate=' + avui +
    '&limit=' + BREVO_PER_PAGINA +
    '&offset=' + desplacament;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (resposta.status === 204) {
    return { transactionalEmails: [] };
  }
  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Brevo (registre d\'enviaments) ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var text = await resposta.text();
  if (text.trim() === '') {
    return { transactionalEmails: [] };
  }
  return JSON.parse(text);
}

// ------------------------------------------------------------
// El digest d'UNA comarca: busca l'id de la llista, es baixa els
// contactes, munta el correu UN SOL COP i l'envia a qui encara no
// l'ha rebut avui. Torna quants correus ha enviat. Llança si la
// configuració de la comarca és dolenta o si no pot llegir la
// llista; un destinatari que falla, en canvi, només es registra.
// ------------------------------------------------------------
async function enviaDigestComarca(fila, actes, actesPermanents, env, apiKey, jaEnviats, avui, setmanaText, pressupost) {
  var llistaId = idDeLlistaBrevo(env, fila);
  var etiqueta = 'digest-' + avui + '-' + fila.etiqueta;
  var assumpte = construeixAssumpte(fila.comarca, setmanaText);
  var html = construeixHtmlDigest(fila.comarca, actes, setmanaText, actesPermanents);

  var destinataris = await contactesDeLlista(llistaId, apiKey);
  var enviats = 0;
  var saltats = 0;

  for (var i = 0; i < destinataris.length; i++) {
    var adreca = destinataris[i];

    // La guarda: aquesta persona ja té el digest d'avui d'aquesta
    // comarca. Se salta sense gastar cap subpetició.
    if (jaEnviats.has(etiqueta + '|' + adreca)) {
      saltats = saltats + 1;
      continue;
    }

    if (enviats >= pressupost) {
      console.log('enviaDigestComarca(): ' + fila.comarca + ' s\'atura al pressupost d\'aquesta despertada; la següent continuarà.');
      break;
    }

    // Un destinatari que falla no ha d'aturar la resta de la llista.
    try {
      await enviaCorreuTransaccional(apiKey, adreca, assumpte, html, etiqueta);
      enviats = enviats + 1;
    } catch (error) {
      console.log('enviaDigestComarca(): un contacte de ' + fila.comarca + ' no ha rebut el digest: ' + error.message);
    }
    await dorm(PAUSA_ENTRE_CORREUS_MS);
  }

  console.log('enviaDigestComarca(): ' + fila.comarca + ' — ' + destinataris.length + ' contactes, ' +
    enviats + ' enviats, ' + saltats + ' ja el tenien.');
  return enviats;
}

// ------------------------------------------------------------
// L'id de la llista de Brevo d'una comarca, llegit del seu Secret.
// Llança amb un missatge clar si el Secret falta o no és un número:
// una configuració dolenta ha de petar aquí, i no més endins, dins
// d'una URL estranya. El valor no surt mai al missatge d'error.
// Torna l'id com a cadena.
// ------------------------------------------------------------
function idDeLlistaBrevo(env, fila) {
  var valor = env[fila.secret];
  if (!valor) {
    throw new Error('falta el secret ' + fila.secret + ' (l\'id de la llista de ' + fila.comarca + ').');
  }
  if (!/^[0-9]+$/.test(valor)) {
    throw new Error('el secret ' + fila.secret + ' ha de ser un número: és l\'id de la llista de Brevo.');
  }
  return valor;
}

// ------------------------------------------------------------
// Totes les adreces d'una llista de Brevo, pàgina a pàgina. Els
// contactes que Brevo té a la llista negra —baixes i rebots— no hi
// surten. Torna una llista d'adreces, potser buida. Llança si l'API
// falla.
// ------------------------------------------------------------
async function contactesDeLlista(llistaId, apiKey) {
  var adreces = [];
  var desplacament = 0;

  while (true) {
    var pagina = await paginaContactesBrevo(llistaId, apiKey, desplacament);
    var contactes = pagina.contacts;

    if (!Array.isArray(contactes) || contactes.length === 0) {
      break; // cap contacte més
    }

    for (var i = 0; i < contactes.length; i++) {
      var contacte = contactes[i];
      if (contacte.emailBlacklisted === true) {
        continue; // es respecten les baixes i els rebots
      }
      if (contacte.email) {
        adreces.push(contacte.email);
      }
    }

    if (contactes.length < BREVO_PER_PAGINA) {
      break;
    }
    desplacament = desplacament + BREVO_PER_PAGINA;
  }

  return adreces;
}

// ------------------------------------------------------------
// UNA pàgina de contactes d'una llista. Com el registre: un 204 és
// una llista buida, no un error. Llança en qualsevol altre cas.
// Torna l'objecte de la resposta, que porta .contacts.
// ------------------------------------------------------------
async function paginaContactesBrevo(llistaId, apiKey, desplacament) {
  var url = BREVO_CONTACTES_URL + llistaId + '/contacts' +
    '?limit=' + BREVO_PER_PAGINA + '&offset=' + desplacament;

  var resposta = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (resposta.status === 204) {
    return { contacts: [] };
  }
  if (!resposta.ok) {
    var detall = await resposta.text();
    throw new Error('Brevo (contactes de la llista ' + llistaId + ') ha respost amb codi ' + resposta.status + '. ' + detall);
  }

  var text = await resposta.text();
  if (text.trim() === '') {
    return { contacts: [] };
  }
  return JSON.parse(text);
}

// ------------------------------------------------------------
// UN correu transaccional a UNA adreça. Mai cap campanya, i mai
// diverses adreces al mateix correu: així ningú no veu l'adreça de
// ningú. L'etiqueta és el que després permetrà saber que aquesta
// persona ja té el digest d'avui. La clau només viatja a la
// capçalera. No torna res; llança si Brevo no l'accepta.
// ------------------------------------------------------------
async function enviaCorreuTransaccional(apiKey, adreca, assumpte, html, etiqueta) {
  var cos = {
    sender: { name: DIGEST_REMITENT_NOM, email: DIGEST_REMITENT_EMAIL },
    to: [ { email: adreca } ],
    replyTo: { email: DIGEST_ADRECA_BAIXA },
    subject: assumpte,
    htmlContent: html,
    tags: [ etiqueta ],
    headers: {
      'List-Unsubscribe': '<mailto:' + DIGEST_ADRECA_BAIXA + '?subject=baixa>'
    }
  };

  var resposta = await fetch(BREVO_ENVIA_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cos)
  });

  if (resposta.status !== 201 && resposta.status !== 202) {
    var detall = await resposta.text();
    throw new Error('Brevo (enviament) ha respost amb codi ' + resposta.status + '. ' + detall);
  }
}

// ------------------------------------------------------------
// Espera els mil·lisegons que se li diguin. Serveix per no engegar
// els correus l'un darrere l'altre sense respirar.
// ------------------------------------------------------------
function dorm(milisegons) {
  return new Promise(function (resol) {
    setTimeout(resol, milisegons);
  });
}

// ------------------------------------------------------------
// El digest de PROVA. Munta el digest de debò a partir d'events.json
// però l'envia NOMÉS a l'adreça d'arxiu —la del propietari— i amb
// una etiqueta de prova, de manera que no consulta ni embruta la
// guarda del digest real. Serveix per provar la Fase 3b qualsevol
// dia i a qualsevol hora, sense esperar el dimarts a les tres.
// El cos pot dur { "comarca": "Vallespir" }; si no en duu cap, envia
// una mostra de cada comarca que tingui actes. Torna la Response.
// ------------------------------------------------------------
async function respostaDigestDeProva(request, env) {
  var adreca = env.ADRECA_ARXIU;
  if (!adreca) {
    console.log('respostaDigestDeProva(): falta la variable ADRECA_ARXIU; no sé on enviar la prova.');
    return respostaJson(500, { ok: false, error: 'falta ADRECA_ARXIU' });
  }

  var apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('respostaDigestDeProva(): falta el secret BREVO_API_KEY.');
    return respostaJson(500, { ok: false, error: 'falta BREVO_API_KEY' });
  }

  // El cos és opcional: un cos buit vol dir «totes les comarques».
  var comarcaDemanada = '';
  try {
    var cos = await request.json();
    if (cos !== null && typeof cos === 'object' && !Array.isArray(cos)) {
      comarcaDemanada = campText(cos, 'comarca');
    }
  } catch (error) {
    comarcaDemanada = '';
  }

  var ara = new Date();
  var avui = dataDeParis(ara);
  var final = dataMesDies(avui, DIES_FINESTRA);
  var setmanaText = dataLlegibleCatala(avui);

  var llistes = null;
  try {
    llistes = await llegeixEsdevenimentsDeLaSetmana(env.GITHUB_TOKEN, avui, final);
  } catch (error) {
    console.log('respostaDigestDeProva(): no he pogut llegir ' + FITXER_EVENTS + ': ' + error.message);
    return respostaJson(500, { ok: false, error: 'no he pogut llegir ' + FITXER_EVENTS });
  }
  var setmana = llistes.setmana;
  var permanents = llistes.permanents;

  var enviats = 0;
  var comarques = [];

  for (var i = 0; i < COMARQUES_BREVO.length; i++) {
    var fila = COMARQUES_BREVO[i];
    if (comarcaDemanada !== '' && comarcaDemanada !== fila.comarca) {
      continue;
    }

    var actes = actesDeLaComarca(setmana, fila.comarca);
    var actesPermanents = actesDeLaComarca(permanents, fila.comarca);
    if (actes.length === 0) {
      continue;
    }

    var assumpte = '[PROVA] ' + construeixAssumpte(fila.comarca, setmanaText);
    var html = construeixHtmlDigest(fila.comarca, actes, setmanaText, actesPermanents);

    try {
      await enviaCorreuTransaccional(apiKey, adreca, assumpte, html, 'digest-prova-' + avui);
      enviats = enviats + 1;
      comarques.push(fila.comarca);
    } catch (error) {
      console.log('respostaDigestDeProva(): la prova de ' + fila.comarca + ' ha fallat: ' + error.message);
    }
  }

  console.log('respostaDigestDeProva(): ' + enviats + ' correus de prova a l\'adreça d\'arxiu. Finestra ' + avui + ' … ' + final + '.');
  return respostaJson(200, {
    ok: true,
    finestra: avui + ' … ' + final,
    actes: setmana.length,
    permanents: permanents.length,
    enviats: enviats,
    comarques: comarques
  });
}

// ============================================================
// L'HTML DEL DIGEST
//
// La meitat PURA del digest: només munta text i dates, i no crida
// cap API. És el mateix disseny que ja estava aprovat al
// primer digest: targeta blanca sobre fons
// clar, actes agrupats per dia sota una capçalera amb un punt
// daurat, el vermell només a l'hora i al «Fins al…», la categoria
// com una etiqueta negra. Taules i estils en línia, sense fonts
// externes ni imatges, perquè es vegi bé a tots els clients de
// correu — que és per què aquí NO hi ha ni Fraunces ni Montserrat.
// ============================================================

// --- Els colors del web («sang i or» només com a accent) ---
var COLOR_TINTA = '#1a1a1a';        // quasi negre: títols i capçaleres de dia
var COLOR_TINTA_SUAU = '#6f6862';   // tinta apagada: francès i text secundari
var COLOR_ACCENT = '#b5121b';       // vermell: només data i hora
var COLOR_OR = '#fcdd09';           // or: només el punt del dia
var COLOR_VORA = '#e7e4df';         // filets i vora de la targeta
var COLOR_VORA_SUAU = '#f0ede7';    // separador entre actes
var COLOR_FONS = '#f2f1ed';         // fons de la pàgina, darrere la targeta

// --- Els noms dels mesos i dels dies, idèntics als del web ---
var MESOS_CATALA = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];
var MESOS_FRANCES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];
var DIES_CATALA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
var DIES_FRANCES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ------------------------------------------------------------
// L'assumpte del digest d'una comarca, en el format acordat:
// «Agenda cultural — [Comarca] — setmana del [data]». Torna la línia.
// ------------------------------------------------------------
function construeixAssumpte(comarca, setmanaText) {
  return 'Agenda cultural — ' + comarca + ' — setmana del ' + setmanaText;
}

// ------------------------------------------------------------
// L'HTML sencer del correu d'una comarca: una targeta blanca amb la
// capçalera, els actes agrupats per dia, el bloc compacte de
// permanents (fora del bucle de dies, i sí quan la setmana és buida)
// i el peu de baixa. Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixHtmlDigest(comarca, esdeveniments, setmanaText, permanents) {
  var contextLinia = escapaHtml(comarca + ' · setmana del ' + setmanaText);

  var cos = '';
  var diaAnterior = '';
  for (var i = 0; i < esdeveniments.length; i++) {
    var esdeveniment = esdeveniments[i];
    if (esdeveniment.data_inici !== diaAnterior) {
      cos = cos + construeixCapcaleraDia(esdeveniment.data_inici);
      diaAnterior = esdeveniment.data_inici;
    }
    cos = cos + construeixBlocEsdeveniment(esdeveniment);
  }

  cos = cos + construeixBlocPermanents(permanents);

  var peu = construeixPeuBaixa();

  var html =
    '<!DOCTYPE html>' +
    '<html lang="ca"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background-color:' + COLOR_FONS + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + COLOR_FONS + ';">' +
    '<tr><td align="center" style="padding:16px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ' + COLOR_VORA + ';">' +
    '<tr><td style="padding:24px 26px 16px;border-bottom:1px solid ' + COLOR_VORA + ';">' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;color:' + COLOR_TINTA + ';letter-spacing:0.02em;">Agenda cultural</div>' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:23px;color:' + COLOR_TINTA + ';line-height:1.1;">Catalunya Nord</div>' +
    '<div lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:4px;">Agenda culturel — Catalogne Nord</div>' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:8px;">' + contextLinia + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:0 26px 6px;">' + cos + '</td></tr>' +
    '<tr><td style="padding:16px 26px 24px;border-top:1px solid ' + COLOR_VORA + ';">' + peu + '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return html;
}

// ------------------------------------------------------------
// La capçalera d'un dia, «30 Juny, Dimarts · 30 Juin, Mardi», amb el
// punt daurat, igual que al web. Català primer, francès en cursiva.
// Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixCapcaleraDia(dataText) {
  var data = objecteDataDe(dataText);
  var textCa;
  var textFr;
  if (data === null) {
    textCa = dataText;
    textFr = '';
  } else {
    textCa = etiquetaDiaCatala(data);
    textFr = etiquetaDiaFrances(data);
  }

  var punt = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:' + COLOR_OR + ';margin-right:8px;vertical-align:middle;"></span>';

  var html =
    '<div style="border-bottom:1px solid ' + COLOR_VORA + ';padding-bottom:6px;margin:22px 0 10px;">' +
    punt +
    '<span style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:15px;color:' + COLOR_TINTA + ';vertical-align:middle;">' + escapaHtml(textCa) + '</span>';
  if (textFr !== '') {
    html = html + '<span lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;color:' + COLOR_TINTA_SUAU + ';vertical-align:middle;"> · ' + escapaHtml(textFr) + '</span>';
  }
  html = html + '</div>';
  return html;
}

// ------------------------------------------------------------
// El bloc d'UN acte: l'etiqueta negra de categoria, el títol, la
// línia de dades (hora i «Fins al…» en vermell, més el lloc), la
// descripció catalana, la francesa en cursiva i qui l'organitza.
// Tot valor dinàmic passa per escapaHtml. Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixBlocEsdeveniment(esdeveniment) {
  var xipCategoria = construeixXipCategoria(esdeveniment.categoria);
  var titol = escapaHtml(esdeveniment.titol);
  var meta = construeixMeta(esdeveniment);
  var descCa = escapaHtml(esdeveniment.descripcio_ca);
  var descFr = escapaHtml(esdeveniment.descripcio_fr);
  var associacio = esdeveniment.associacio;

  var bloc =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ' + COLOR_VORA_SUAU + ';">' +
    '<tr><td style="padding:14px 0;">';

  if (xipCategoria !== '') {
    bloc = bloc + '<div style="padding-bottom:8px;">' + xipCategoria + '</div>';
  }

  bloc = bloc + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:17px;line-height:1.25;color:' + COLOR_TINTA + ';">' + titol + '</div>';

  if (meta !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + COLOR_TINTA_SUAU + ';padding-top:6px;">' + meta + '</div>';
  }
  if (descCa !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + COLOR_TINTA + ';padding-top:8px;line-height:1.5;">' + descCa + '</div>';
  }
  if (descFr !== '') {
    bloc = bloc + '<div lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:13px;color:' + COLOR_TINTA_SUAU + ';padding-top:4px;line-height:1.5;">' + descFr + '</div>';
  }
  if (associacio !== '') {
    bloc = bloc + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + COLOR_TINTA_SUAU + ';padding-top:6px;">Organitza · Organise : ' + escapaHtml(associacio) + '</div>';
  }

  bloc = bloc + '</td></tr></table>';
  return bloc;
}

// ------------------------------------------------------------
// El bloc compacte de les activitats permanents (regla 3 i Q4 de
// NOTES.md, «Activitats permanents»): germana de
// construeixBlocEsdeveniment(), però sense cartell, sense categoria i
// amb la periodicitat escrita tal com és —una línia per acte, mai una
// línia per ocurrència. Surt també quan la finestra de la setmana és
// buida. Torna "" si no hi ha cap permanent vigent per a la comarca.
// ------------------------------------------------------------
function construeixBlocPermanents(permanents) {
  if (permanents.length === 0) {
    return '';
  }

  var files = '';
  for (var i = 0; i < permanents.length; i++) {
    files = files + construeixLiniaPermanent(permanents[i]);
  }

  return (
    '<div style="margin:22px 0 4px;padding:12px 14px;background-color:' + COLOR_FONS + ';border:1px solid ' + COLOR_VORA + ';">' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;font-size:13px;color:' + COLOR_TINTA + ';text-transform:uppercase;letter-spacing:0.04em;">Activitats permanents</div>' +
    '<div lang="fr" style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:11px;color:' + COLOR_TINTA_SUAU + ';padding-bottom:8px;">Activités permanentes</div>' +
    files +
    '</div>'
  );
}

// ------------------------------------------------------------
// Una línia d'UNA activitat permanent: el títol, la periodicitat tal
// com s'ha escrit (en vermell, com la resta de dades) i el lloc, si en
// té. Sense cartell, sense categoria, sense descripció. Torna la
// cadena d'HTML.
// ------------------------------------------------------------
function construeixLiniaPermanent(esdeveniment) {
  var titol = escapaHtml(esdeveniment.titol);
  var lloc = escapaHtml(textLloc(esdeveniment));

  var linia =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + COLOR_TINTA + ';padding:4px 0;line-height:1.4;">' +
    '<strong>' + titol + '</strong> — ' + spanAccent(esdeveniment.periodicitat);
  if (lloc !== '') {
    linia = linia + ' · ' + lloc;
  }
  linia = linia + '</div>';
  return linia;
}

// ------------------------------------------------------------
// L'etiqueta negra amb el nom de la categoria, o "" si l'acte no en
// té cap. Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixXipCategoria(categoria) {
  if (categoria === '') {
    return '';
  }
  var text = escapaHtml(categoria);
  return '<span style="display:inline-block;background-color:' + COLOR_TINTA + ';color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;padding:3px 9px;">' + text + '</span>';
}

// ------------------------------------------------------------
// La línia de dades d'un acte: l'hora («18:30 h», en vermell), el
// lloc i el municipi, i per als actes de més d'un dia el «Fins al…
// · Jusqu'au…» (també en vermell). Les parts s'uneixen amb « · ».
// Torna la línia, o "" si no hi ha res a dir.
// ------------------------------------------------------------
function construeixMeta(esdeveniment) {
  var parts = [];

  if (esdeveniment.hora !== '') {
    parts.push(spanAccent(esdeveniment.hora + ' h'));
  }

  var lloc = textLloc(esdeveniment);
  if (lloc !== '') {
    parts.push(escapaHtml(lloc));
  }

  if (esdeveniment.data_fi !== '' && esdeveniment.data_fi !== esdeveniment.data_inici) {
    var fins = finsAl(esdeveniment.data_fi);
    if (fins !== '') {
      parts.push(spanAccent(fins));
    }
  }

  if (parts.length === 0) {
    return '';
  }
  return parts.join(' · ');
}

// ------------------------------------------------------------
// Embolcalla un tros de text amb el vermell d'accent, en negreta.
// El text s'escapa aquí dins. Torna la cadena d'HTML.
// ------------------------------------------------------------
function spanAccent(text) {
  return '<span style="color:' + COLOR_ACCENT + ';font-weight:bold;">' + escapaHtml(text) + '</span>';
}

// ------------------------------------------------------------
// El lloc de l'acte com a text: «lloc, municipi», només un dels dos,
// o "" si no se'n sap cap. Torna text CRU, sense escapar: qui la
// crida ja l'escapa.
// ------------------------------------------------------------
function textLloc(esdeveniment) {
  var lloc = esdeveniment.lloc;
  var municipi = esdeveniment.municipi;
  if (lloc !== '' && municipi !== '') {
    return lloc + ', ' + municipi;
  }
  if (lloc !== '') {
    return lloc;
  }
  if (municipi !== '') {
    return municipi;
  }
  return '';
}

// ------------------------------------------------------------
// El «Fins al … · Jusqu'au …» d'una data de fi, amb les
// contraccions catalanes correctes (a l'1, al 20, d'agost) i el
// «1er» francès, com al web. Torna "" si la data no és bona.
// ------------------------------------------------------------
function finsAl(dataText) {
  var data = objecteDataDe(dataText);
  if (data === null) {
    return '';
  }
  var dia = data.getDate();
  var mesCa = MESOS_CATALA[data.getMonth()];
  var mesFr = MESOS_FRANCES[data.getMonth()];

  var diaCa;
  if (dia === 1 || dia === 11) {
    diaCa = 'a l’' + dia;
  } else {
    diaCa = 'al ' + dia;
  }

  var prepMes;
  if (comencaAmbVocal(mesCa)) {
    prepMes = 'd’';
  } else {
    prepMes = 'de ';
  }

  var ca = 'Fins ' + diaCa + ' ' + prepMes + mesCa;

  var diaFr;
  if (dia === 1) {
    diaFr = '1er';
  } else {
    diaFr = String(dia);
  }

  return ca + ' · Jusqu’au ' + diaFr + ' ' + mesFr;
}

// ------------------------------------------------------------
// Cert si una paraula comença per vocal, per triar entre «de» i «d'».
// ------------------------------------------------------------
function comencaAmbVocal(paraula) {
  return 'aeiouàéèíòóú'.indexOf(paraula.charAt(0)) !== -1;
}

// ------------------------------------------------------------
// Converteix "AAAA-MM-DD" en un objecte Date, només per llegir-ne el
// dia del mes i el dia de la setmana. Torna null si el format no és
// bo.
// ------------------------------------------------------------
function objecteDataDe(dataText) {
  if (dataText === '') {
    return null;
  }
  var parts = dataText.split('-');
  if (parts.length !== 3) {
    return null;
  }
  var any = parseInt(parts[0], 10);
  var mes = parseInt(parts[1], 10);
  var dia = parseInt(parts[2], 10);
  if (isNaN(any) || isNaN(mes) || isNaN(dia) || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }
  return new Date(any, mes - 1, dia);
}

// ------------------------------------------------------------
// L'etiqueta catalana d'un dia: «30 Juny, Dimarts».
// ------------------------------------------------------------
function etiquetaDiaCatala(data) {
  return data.getDate() + ' ' + majuscula(MESOS_CATALA[data.getMonth()]) + ', ' + DIES_CATALA[data.getDay()];
}

// ------------------------------------------------------------
// L'etiqueta francesa d'un dia: «30 Juin, Mardi» («1er» el dia u).
// ------------------------------------------------------------
function etiquetaDiaFrances(data) {
  var dia = data.getDate();
  var diaFr;
  if (dia === 1) {
    diaFr = '1er';
  } else {
    diaFr = String(dia);
  }
  return diaFr + ' ' + majuscula(MESOS_FRANCES[data.getMonth()]) + ', ' + DIES_FRANCES[data.getDay()];
}

// ------------------------------------------------------------
// La paraula amb la primera lletra en majúscula.
// ------------------------------------------------------------
function majuscula(paraula) {
  if (paraula === '') {
    return '';
  }
  return paraula.charAt(0).toUpperCase() + paraula.slice(1);
}

// ------------------------------------------------------------
// El peu del correu: l'enllaç al web i la nota de baixa bilingüe.
// Brevo NO afegeix cap enllaç de baixa als correus transaccionals,
// així que la nota hi ha de ser sempre, a tots els missatges. Les
// baixes van a contacte@clm.cat i no a agenda@clm.cat: agenda@ el
// llegeix el gestor email() d'aquest mateix Worker, i una petició de
// baixa hi entraria com una fila nova a la cua del curador.
// Torna la cadena d'HTML.
// ------------------------------------------------------------
function construeixPeuBaixa() {
  var enllac =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;padding-bottom:10px;">' +
    '<a href="' + escapaHtml(AGENDA_URL) + '" style="color:' + COLOR_ACCENT + ';font-weight:bold;text-decoration:none;">Veure tota l’agenda · Voir tout l’agenda</a>' +
    '</div>';

  var text =
    'Reps aquest correu perquè estàs subscrit/a a l’agenda cultural de la Catalunya Nord. ' +
    'Per donar-te de baixa, respon a aquest correu amb la paraula «baixa» o escriu a ' +
    escapaHtml(DIGEST_ADRECA_BAIXA) + '.' +
    '<br><span style="font-style:italic;">' +
    'Vous recevez ce message car vous êtes abonné·e à l’agenda culturel de Catalogne Nord. ' +
    'Pour vous désabonner, répondez « baixa » à ce courriel ou écrivez à ' +
    escapaHtml(DIGEST_ADRECA_BAIXA) + '.' +
    '</span>';

  return enllac + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:' + COLOR_TINTA_SUAU + ';line-height:1.5;">' + text + '</div>';
}

// ------------------------------------------------------------
// Converteix "2026-09-14" en «14 de setembre de 2026». Serveix per
// a la línia d'assumpte. Torna "" si la data és buida o dolenta.
// ------------------------------------------------------------
function dataLlegibleCatala(dataText) {
  var data = objecteDataDe(dataText);
  if (data === null) {
    return '';
  }
  var dia = data.getDate();
  var mesNom = MESOS_CATALA[data.getMonth()];
  var any = data.getFullYear();

  var preposicio;
  if (comencaAmbVocal(mesNom)) {
    preposicio = 'd’';
  } else {
    preposicio = 'de ';
  }
  return dia + ' ' + preposicio + mesNom + ' de ' + any;
}

// ------------------------------------------------------------
// El text amb els caràcters especials de l'HTML convertits en
// entitats. El contingut dels actes ve de fora —correus
// d'associacions, formularis— i no pot injectar mai marcatge dins
// del correu. Torna "" si no hi ha res.
// ------------------------------------------------------------
function escapaHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  var resultat = String(text);
  resultat = resultat.replace(/&/g, '&amp;');
  resultat = resultat.replace(/</g, '&lt;');
  resultat = resultat.replace(/>/g, '&gt;');
  resultat = resultat.replace(/"/g, '&quot;');
  resultat = resultat.replace(/'/g, '&#39;');
  return resultat;
}
