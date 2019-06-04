const log = require('fancy-log');

let escapedChars = {
  'b': '\b',
  'f': '\f',
  'n': '\n',
  'r': '\r',
  't': '\t',
  '"': '"',
  '/': '/',
  '\\': '\\'
};

let A_CODE = 'a'.charCodeAt(0);


export function positionParse (source) {
  let line = 0;
  let column = 0;
  let pos = 0;
  return _parse('', true);



  function _parse(ptr, topLevel) {

    whitespace();
    let data;
    let char = getChar();
    switch (char) {
      case 't': read('rue'); data = true; break;
      case 'f': read('alse'); data = false; break;
      case 'n': read('ull'); data = null; break;
      case '"': data = parseString(); break;
      case '[': data = parseArray(ptr); break;
      case '{': data = parseObject(ptr); break;
      default:
        backChar();
        if ('-0123456789'.indexOf(char) >= 0) {
          data = parseNumber();
        }
        else {
          unexpectedToken();
        }
    }
    whitespace();
    if (topLevel && pos < source.length) { unexpectedToken(); }
    return data;
  }

  function whitespace() {
    loop:
      while (pos < source.length) {
        switch (source[pos]) {
          case ' ': column++; break;
          case '\t': column += 4; break;
          case '\r': column = 0; break;
          case '\n': column = 0; line++; break;
          default: break loop;
        }
        pos++;
      }
  }

  function parseString() {
    let str = '';
    let char;
    while (true) {
      char = getChar();
      if (char === '"') {
        break;
      } else if (char === '\\') {
        char = getChar();
        if (char in escapedChars) {
          str += escapedChars[char];
        }
        else if (char === 'u') {
          str += getCharCode();
 }
        else {
          wasUnexpectedToken();
 }
      } else {
        str += char;
      }
    }
    return str;
  }

  function parseNumber() {
    let numStr = '';
    if (source[pos] === '-') { numStr += getChar(); }

    numStr += source[pos] === '0'
              ? getChar()
              : getDigits();

    if (source[pos] === '.') {
      numStr += getChar() + getDigits();
    }

    if (source[pos] === 'e' || source[pos] === 'E') {
      numStr += getChar();
      if (source[pos] === '+' || source[pos] === '-') { numStr += getChar(); }
      numStr += getDigits();
    }

    return +numStr;
  }

  function parseArray(ptr) {
    whitespace();
    let arr = [];
    let i = 0;
    if (getChar() === ']') { return arr; }
    backChar();

    while (true) {
      let itemPtr = ptr + '/' + i;
      arr.push(_parse(itemPtr, false));
      whitespace();
      let char = getChar();
      if (char === ']') { break; }
      if (char !== ',') { wasUnexpectedToken(); }
      whitespace();
      i++;
    }
    return arr;
  }

  function parseObject(ptr) {
    whitespace();
    let obj = {};
    if (getChar() === '}') { return obj; }
    backChar();

    while (true) {
      let loc = getLoc();
      if (getChar() !== '"') { wasUnexpectedToken(); }
 
      let oldpos = pos;
      let key = parseString();
      let metaKey = "meta" + key;
      obj[metaKey] = {pos: pos, posEnd: oldpos};

      let propPtr = ptr + '/' + escapeJsonPointer(key);
      whitespace();
      if (getChar() !== ':') { wasUnexpectedToken(); }
      whitespace();
      obj[key] = _parse(propPtr, false);

      whitespace();
      let char = getChar();
      if (char === '}') { break; }
      if (char !== ',') { wasUnexpectedToken(); }
      whitespace();
    }
    return obj;
  }

  function read(str) {
    for (let i=0; i<str.length; i++) {
      if (getChar() !== str[i]) { wasUnexpectedToken();
    } }
  }

  function getChar() {
    checkUnexpectedEnd();
    let char = source[pos];
    pos++;
    column++; // new line?
    return char;
  }

  function backChar() {
    pos--;
    column--;
  }

  function getCharCode() {
    let count = 4;
    let code = 0;
    while (count--) {
      code <<= 4;
      let char = getChar().toLowerCase();
      if (char >= 'a' && char <= 'f') {
        code += char.charCodeAt() - A_CODE + 10;
      }
      else if (char >= '0' && char <= '9') {
        code += +char;
 }
      else {
        wasUnexpectedToken();
 }
    }
    return String.fromCharCode(code);
  }

  function getDigits() {
    let digits = '';
    while (source[pos] >= '0' && source[pos] <= '9') {
      digits += getChar();
    }

    if (digits.length) { return digits; }
    checkUnexpectedEnd();
    unexpectedToken();
  }



  function getLoc() {
    return {
      line: line,
      column: column,
      pos: pos
    };
  }

  function unexpectedToken() {
    throw new SyntaxError('Unexpected token ' + source[pos] + ' in JSON at position ' + pos);
  }

  function wasUnexpectedToken() {
    backChar();
    unexpectedToken();
  }

  function checkUnexpectedEnd() {
    if (pos >= source.length) {
      throw new SyntaxError('Unexpected end of JSON input');
    }
  }
}

/*
export function stringify (data, _, whitespace) {
  if (!validType(data)) { return; }
  let wsLine = 0;
  let wsPos, wsColumn;
  switch (typeof whitespace) {
    case 'number':
      let len = whitespace > 10
                  ? 10
                  : whitespace < 0
                    ? 0
                    : Math.floor(whitespace);
      whitespace = len && repeat(len, ' ');
      wsPos = len;
      wsColumn = len;
      break;
    case 'string':
      whitespace = whitespace.slice(0, 10);
      wsPos = 0;
      wsColumn = 0;
      for (let j=0; j<whitespace.length; j++) {
        let char = whitespace[j];
        switch (char) {
          case ' ': wsColumn++; break;
          case '\t': wsColumn += 4; break;
          case '\r': wsColumn = 0; break;
          case '\n': wsColumn = 0; wsLine++; break;
          default: throw new Error('whitespace characters not allowed in JSON');
        }
        wsPos++;
      }
      break;
    default:
      whitespace = undefined;
  }

  let json = '';
  let line = 0;
  let column = 0;
  let pos = 0;
  _stringify(data, 0, '');
  return {
    json: json,
  };

  function _stringify(_data, lvl, ptr) {
    switch (typeof _data) {
      case 'number':
      case 'boolean':
        out('' + _data); break;
      case 'string':
        out(quoted(_data)); break;
      case 'object':
        if (_data === null) {
          out('null');
        }
        else if (typeof _data.toJSON === 'function') {
          out(quoted(_data.toJSON()));
 }
        else if (Array.isArray(_data)) {
          stringifyArray();
 }
        else {
          stringifyObject();
 }
    }


    function stringifyArray() {
      if (_data.length) {
        out('[');
        let itemLvl = lvl + 1;
        for (let i=0; i<_data.length; i++) {
          if (i) { out(','); }
          indent(itemLvl);
          let item = validType(_data[i]) ? _data[i] : null;
          let itemPtr = ptr + '/' + i;
          _stringify(item, itemLvl, itemPtr);
        }
        indent(lvl);
        out(']');
      } else {
        out('[]');
      }
    }

    function stringifyObject() {
      let keys = Object.keys(_data);
      if (keys.length) {
        out('{');
        let propLvl = lvl + 1;
        for (let i=0; i<keys.length; i++) {
          let key = keys[i];
          let value = _data[key];
          if (validType(value)) {
            if (i) { out(','); }
            let propPtr = ptr + '/' + escapeJsonPointer(key);
            indent(propLvl);
            out(quoted(key));
            out(':');
            if (whitespace) { out(' '); }
            _stringify(value, propLvl, propPtr);
          }
        }
        indent(lvl);
        out('}');
      } else {
        out('{}');
      }
    }
  }

  function out(str) {
    column += str.length;
    pos += str.length;
    json += str;
  }

  function indent(lvl) {
    if (whitespace) {
      json += '\n' + repeat(lvl, whitespace);
      line++;
      column = 0;
      while (lvl--) {
        if (wsLine) {
          line += wsLine;
          column = wsColumn;
        } else {
          column += wsColumn;
        }
        pos += wsPos;
      }
      pos += 1; // \n character
    }
  }


  function repeat(n, str) {
    return Array(n + 1).join(str);
  }
}
*/

let VALID_TYPES = ['number', 'boolean', 'string', 'object'];
function validType(data) {
  return VALID_TYPES.indexOf(typeof data) >= 0;
}


let ESC_QUOTE = /"|\\/g;
let ESC_B = /[\b]/g;
let ESC_F = /\f/g;
let ESC_N = /\n/g;
let ESC_R = /\r/g;
let ESC_T = /\t/g;
function quoted(str) {
  str = str.replace(ESC_QUOTE, '\\$&')
           .replace(ESC_F, '\\f')
           .replace(ESC_B, '\\b')
           .replace(ESC_N, '\\n')
           .replace(ESC_R, '\\r')
           .replace(ESC_T, '\\t');
  return '"' + str + '"';
}


let ESC_0 = /~/g;
let ESC_1 = /\//g;
function escapeJsonPointer(str) {
  return str.replace(ESC_0, '~0')
            .replace(ESC_1, '~1');
}