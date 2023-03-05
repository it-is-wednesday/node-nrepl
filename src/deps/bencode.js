var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// util.js
var require_util = __commonJS({
  "util.js"(exports2, module2) {
    var util = module2.exports;
    util.digitCount = function digitCount(value) {
      const sign = value < 0 ? 1 : 0;
      value = Math.abs(Number(value || 1));
      return Math.floor(Math.log10(value)) + 1 + sign;
    };
    util.getType = function getType(value) {
      if (Buffer.isBuffer(value))
        return "buffer";
      if (ArrayBuffer.isView(value))
        return "arraybufferview";
      if (Array.isArray(value))
        return "array";
      if (value instanceof Number)
        return "number";
      if (value instanceof Boolean)
        return "boolean";
      if (value instanceof Set)
        return "set";
      if (value instanceof Map)
        return "map";
      if (value instanceof String)
        return "string";
      if (value instanceof ArrayBuffer)
        return "arraybuffer";
      return typeof value;
    };
  }
});

// encode.js
var require_encode = __commonJS({
  "encode.js"(exports2, module2) {
    var { getType } = require_util();
    function encode(data, buffer, offset) {
      const buffers = [];
      let result = null;
      encode._encode(buffers, data);
      result = Buffer.concat(buffers);
      encode.bytes = result.length;
      if (Buffer.isBuffer(buffer)) {
        result.copy(buffer, offset);
        return buffer;
      }
      return result;
    }
    encode.bytes = -1;
    encode._floatConversionDetected = false;
    encode._encode = function(buffers, data) {
      if (data == null) {
        return;
      }
      switch (getType(data)) {
        case "buffer":
          encode.buffer(buffers, data);
          break;
        case "object":
          encode.dict(buffers, data);
          break;
        case "map":
          encode.dictMap(buffers, data);
          break;
        case "array":
          encode.list(buffers, data);
          break;
        case "set":
          encode.listSet(buffers, data);
          break;
        case "string":
          encode.string(buffers, data);
          break;
        case "number":
          encode.number(buffers, data);
          break;
        case "boolean":
          encode.number(buffers, data);
          break;
        case "arraybufferview":
          encode.buffer(buffers, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
          break;
        case "arraybuffer":
          encode.buffer(buffers, Buffer.from(data));
          break;
      }
    };
    var buffE = Buffer.from("e");
    var buffD = Buffer.from("d");
    var buffL = Buffer.from("l");
    encode.buffer = function(buffers, data) {
      buffers.push(Buffer.from(data.length + ":"), data);
    };
    encode.string = function(buffers, data) {
      buffers.push(Buffer.from(Buffer.byteLength(data) + ":" + data));
    };
    encode.number = function(buffers, data) {
      const maxLo = 2147483648;
      const hi = data / maxLo << 0;
      const lo = data % maxLo << 0;
      const val = hi * maxLo + lo;
      buffers.push(Buffer.from("i" + val + "e"));
      if (val !== data && !encode._floatConversionDetected) {
        encode._floatConversionDetected = true;
        console.warn(
          'WARNING: Possible data corruption detected with value "' + data + '":',
          'Bencoding only defines support for integers, value was converted to "' + val + '"'
        );
        console.trace();
      }
    };
    encode.dict = function(buffers, data) {
      buffers.push(buffD);
      let j = 0;
      let k;
      const keys = Object.keys(data).sort();
      const kl = keys.length;
      for (; j < kl; j++) {
        k = keys[j];
        if (data[k] == null)
          continue;
        encode.string(buffers, k);
        encode._encode(buffers, data[k]);
      }
      buffers.push(buffE);
    };
    encode.dictMap = function(buffers, data) {
      buffers.push(buffD);
      const keys = Array.from(data.keys()).sort();
      for (const key of keys) {
        if (data.get(key) == null)
          continue;
        Buffer.isBuffer(key) ? encode._encode(buffers, key) : encode.string(buffers, String(key));
        encode._encode(buffers, data.get(key));
      }
      buffers.push(buffE);
    };
    encode.list = function(buffers, data) {
      let i = 0;
      const c = data.length;
      buffers.push(buffL);
      for (; i < c; i++) {
        if (data[i] == null)
          continue;
        encode._encode(buffers, data[i]);
      }
      buffers.push(buffE);
    };
    encode.listSet = function(buffers, data) {
      buffers.push(buffL);
      for (const item of data) {
        if (item == null)
          continue;
        encode._encode(buffers, item);
      }
      buffers.push(buffE);
    };
    module2.exports = encode;
  }
});

// decode.js
var require_decode = __commonJS({
  "decode.js"(exports2, module2) {
    var INTEGER_START = 105;
    var STRING_DELIM = 58;
    var DICTIONARY_START = 100;
    var LIST_START = 108;
    var END_OF_TYPE = 101;
    function getIntFromBuffer(buffer, start, end) {
      let sum = 0;
      let sign = 1;
      for (let i = start; i < end; i++) {
        const num = buffer[i];
        if (num < 58 && num >= 48) {
          sum = sum * 10 + (num - 48);
          continue;
        }
        if (i === start && num === 43) {
          continue;
        }
        if (i === start && num === 45) {
          sign = -1;
          continue;
        }
        if (num === 46) {
          break;
        }
        throw new Error("not a number: buffer[" + i + "] = " + num);
      }
      return sum * sign;
    }
    function decode(data, start, end, encoding) {
      if (data == null || data.length === 0) {
        return null;
      }
      if (typeof start !== "number" && encoding == null) {
        encoding = start;
        start = void 0;
      }
      if (typeof end !== "number" && encoding == null) {
        encoding = end;
        end = void 0;
      }
      decode.position = 0;
      decode.encoding = encoding || null;
      decode.data = !Buffer.isBuffer(data) ? Buffer.from(data) : data.slice(start, end);
      decode.bytes = decode.data.length;
      return decode.next();
    }
    decode.bytes = 0;
    decode.position = 0;
    decode.data = null;
    decode.encoding = null;
    decode.next = function() {
      switch (decode.data[decode.position]) {
        case DICTIONARY_START:
          return decode.dictionary();
        case LIST_START:
          return decode.list();
        case INTEGER_START:
          return decode.integer();
        default:
          return decode.buffer();
      }
    };
    decode.find = function(chr) {
      let i = decode.position;
      const c = decode.data.length;
      const d = decode.data;
      while (i < c) {
        if (d[i] === chr)
          return i;
        i++;
      }
      throw new Error(
        'Invalid data: Missing delimiter "' + String.fromCharCode(chr) + '" [0x' + chr.toString(16) + "]"
      );
    };
    decode.dictionary = function() {
      decode.position++;
      const dict = {};
      while (decode.data[decode.position] !== END_OF_TYPE) {
        dict[decode.buffer()] = decode.next();
      }
      decode.position++;
      return dict;
    };
    decode.list = function() {
      decode.position++;
      const lst = [];
      while (decode.data[decode.position] !== END_OF_TYPE) {
        lst.push(decode.next());
      }
      decode.position++;
      return lst;
    };
    decode.integer = function() {
      const end = decode.find(END_OF_TYPE);
      const number = getIntFromBuffer(decode.data, decode.position + 1, end);
      decode.position += end + 1 - decode.position;
      return number;
    };
    decode.buffer = function() {
      let sep = decode.find(STRING_DELIM);
      const length = getIntFromBuffer(decode.data, decode.position, sep);
      const end = ++sep + length;
      decode.position = end;
      return decode.encoding ? decode.data.toString(decode.encoding, sep, end) : decode.data.slice(sep, end);
    };
    module2.exports = decode;
  }
});

// encoding-length.js
var require_encoding_length = __commonJS({
  "encoding-length.js"(exports2, module2) {
    var { digitCount, getType } = require_util();
    function listLength(list) {
      let length = 1 + 1;
      for (const value of list) {
        length += encodingLength(value);
      }
      return length;
    }
    function mapLength(map) {
      let length = 1 + 1;
      for (const [key, value] of map) {
        const keyLength = Buffer.byteLength(key);
        length += digitCount(keyLength) + 1 + keyLength;
        length += encodingLength(value);
      }
      return length;
    }
    function objectLength(value) {
      let length = 1 + 1;
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) {
        const keyLength = Buffer.byteLength(keys[i]);
        length += digitCount(keyLength) + 1 + keyLength;
        length += encodingLength(value[keys[i]]);
      }
      return length;
    }
    function stringLength(value) {
      const length = Buffer.byteLength(value);
      return digitCount(length) + 1 + length;
    }
    function arrayBufferLength(value) {
      const length = value.byteLength - value.byteOffset;
      return digitCount(length) + 1 + length;
    }
    function encodingLength(value) {
      const length = 0;
      if (value == null)
        return length;
      const type = getType(value);
      switch (type) {
        case "buffer":
          return digitCount(value.length) + 1 + value.length;
        case "arraybufferview":
          return arrayBufferLength(value);
        case "string":
          return stringLength(value);
        case "array":
        case "set":
          return listLength(value);
        case "number":
          return 1 + digitCount(Math.floor(value)) + 1;
        case "bigint":
          return 1 + value.toString().length + 1;
        case "object":
          return objectLength(value);
        case "map":
          return mapLength(value);
        default:
          throw new TypeError(`Unsupported value of type "${type}"`);
      }
    }
    module2.exports = encodingLength;
  }
});

// index.js
var bencode = module.exports;
bencode.encode = require_encode();
bencode.decode = require_decode();
bencode.byteLength = bencode.encodingLength = require_encoding_length();
