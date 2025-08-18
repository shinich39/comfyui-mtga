// src/modules/utils.ts
var getState = function(el, withValue) {
  const isReversed = el.selectionStart > el.selectionEnd;
  const short = Math.min(el.selectionStart, el.selectionEnd);
  const long = Math.max(el.selectionStart, el.selectionEnd);
  const dir = el.selectionDirection;
  if (withValue) {
    return {
      isReversed,
      short,
      long,
      dir,
      value: el.value
    };
  }
  return {
    isReversed,
    short,
    long,
    dir
  };
};
var setState = function(el, state) {
  if (state.value) {
    el.value = state.value;
  }
  if (!state.isReversed) {
    el.setSelectionRange(state.short, state.long, state.dir || "none");
  } else {
    el.setSelectionRange(state.long, state.short, state.dir || "none");
  }
  el.focus();
};
var parseKeyboardEvent = function(e) {
  const key = e.key;
  const altKey = e.altKey;
  const shiftKey = e.shiftKey;
  const ctrlKey = e.ctrlKey || e.metaKey;
  return {
    key,
    altKey,
    shiftKey,
    ctrlKey
  };
};
function compareString(from, to) {
  const dp = Array.from(
    { length: from.length + 1 },
    () => Array(to.length + 1).fill(0)
  );
  for (let i2 = 1; i2 <= from.length; i2++) {
    for (let j2 = 1; j2 <= to.length; j2++) {
      if (from[i2 - 1] === to[j2 - 1]) {
        dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
      } else {
        dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
      }
    }
  }
  const result = [];
  let score = 0;
  let i = from.length, j = to.length;
  let currentType = null;
  let buffer = [];
  const flush = function() {
    if (currentType !== null && buffer.length > 0) {
      result.push([currentType, buffer.reverse().join("")]);
    }
    currentType = null;
    buffer = [];
  };
  while (i > 0 || j > 0) {
    const a = from[i - 1];
    const b = to[j - 1];
    if (i > 0 && j > 0 && a === b) {
      if (currentType !== 0) {
        flush();
      }
      currentType = 0;
      buffer.push(a);
      score++;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      if (currentType !== 1) {
        flush();
      }
      currentType = 1;
      buffer.push(b);
      j--;
    } else if (i > 0) {
      if (currentType !== -1) {
        flush();
      }
      currentType = -1;
      buffer.push(a);
      i--;
    }
  }
  flush();
  return {
    accuracy: score * 2 / (from.length + to.length),
    score,
    match: result.reverse()
  };
}
function getAllCombinations(arr) {
  const result = [];
  const n = arr.length;
  for (let i = 1; i < 1 << n; i++) {
    const combo = [];
    for (let j = 0; j < n; j++) {
      if (i >> j & 1) {
        combo.push(arr[j]);
      }
    }
    result.push(combo);
  }
  return result;
}
var getRows = function(el) {
  const { short, long } = getState(el);
  const arr = el.value.split(/\n/);
  const rows = [];
  const selectedRows = [];
  let offset = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const isLastRow = i === arr.length - 1;
    const value = isLastRow ? item : item + "\n";
    const startIndex = offset;
    const endIndex = offset + item.length + 1;
    let selectionStart = -1, selectionEnd = -1, selectionValue = "";
    if (short >= startIndex && short < endIndex) {
      selectionStart = short - startIndex;
    }
    if (long > startIndex && long < endIndex) {
      selectionEnd = long - startIndex;
    }
    if (short <= startIndex && long >= endIndex) {
      selectionStart = 0;
      selectionEnd = value.length;
    }
    if (selectionStart > -1 && selectionEnd === -1) {
      selectionEnd = value.length;
    }
    if (selectionEnd > -1 && selectionStart === -1) {
      selectionStart = 0;
    }
    const isSelected = selectionStart > -1 && selectionEnd > -1;
    if (isSelected) {
      selectionValue = value.substring(selectionStart, selectionEnd);
    }
    const newRow = {
      rowIndex: i,
      startIndex,
      endIndex,
      value,
      selectionStart,
      selectionEnd,
      selectionValue
    };
    rows.push(newRow);
    if (isSelected) {
      selectedRows.push(newRow);
    }
    offset = endIndex;
  }
  return {
    rows,
    selectedRows
  };
};
var updateRows = function(el, rows, callback) {
  const { short, long, dir, isReversed } = getState(el);
  let newShort = short, newLong = long;
  const rowValues = [];
  for (const r of rows) {
    const { startIndex, endIndex } = r;
    const origValue = r.value;
    const newValue = callback(r);
    const diff = newValue.length - origValue.length;
    if (short >= startIndex && short < endIndex) {
      if (diff >= 0) {
        newShort += diff;
        newLong += diff;
      } else {
        newShort += Math.max(diff, startIndex - short);
        newLong += Math.max(diff, startIndex - long);
      }
    } else if (long >= startIndex && short < endIndex) {
      if (diff >= 0) {
        newLong += diff;
      } else {
        newLong += Math.max(diff, startIndex - long);
      }
    } else {
      newLong += diff;
    }
    rowValues.push(newValue);
  }
  return {
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: rowValues.join("")
  };
};

// src/modules/auto-pairing.ts
var isOpening = function(pairs, value) {
  return Object.keys(pairs).includes(value);
};
var getClosing = function(pairs, value) {
  return pairs[value];
};
var AutoPairing = class {
  element;
  pairs;
  constructor(el, pairs) {
    this.element = el;
    this.pairs = pairs;
  }
  isInsert(e) {
    const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
    return !altKey && !ctrlKey && isOpening(this.pairs, key);
  }
  isDelete(e) {
    const el = this.element;
    const pairs = this.pairs;
    const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
    if (altKey || ctrlKey || shiftKey || key !== "Backspace") {
      return false;
    }
    const { short, long, dir, isReversed } = getState(el);
    const isRange = short !== long;
    if (isRange) {
      return false;
    }
    const currChar = el.value.charAt(long - 1);
    const nextChar = el.value.charAt(long);
    return isOpening(pairs, currChar) && getClosing(pairs, currChar) === nextChar;
  }
  insert(e) {
    const el = this.element;
    const pairs = this.pairs;
    const { key } = parseKeyboardEvent(e);
    const { short, long, dir, isReversed } = getState(el);
    const isRange = short !== long;
    const opening = key;
    const closing = getClosing(pairs, opening);
    const left = el.value.substring(0, short);
    const center = el.value.substring(short, long);
    const right = el.value.substring(long);
    let newShort, newLong, newValue;
    if (!isRange) {
      const start = (left + opening).length;
      newValue = left + opening + closing + right;
      newShort = start;
      newLong = start;
    } else {
      newValue = left + opening + center + closing + right;
      newShort = (left + opening).length;
      newLong = (left + opening + center).length;
    }
    setState(el, {
      isReversed,
      short: newShort,
      long: newLong,
      dir,
      value: newValue
    });
  }
  delete(e) {
    const el = this.element;
    const pairs = this.pairs;
    const { long } = getState(el);
    const left = el.value.substring(0, long - 1);
    const right = el.value.substring(long + 1);
    const newValue = left + right;
    const newShort = left.length;
    const newLong = left.length;
    setState(el, {
      isReversed: false,
      short: newShort,
      long: newLong,
      dir: "forward",
      value: newValue
    });
  }
};

// src/modules/history.ts
var isUndo = function(e) {
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  return ctrlKey && !shiftKey && key.toLowerCase() === "z";
};
var isRedo = function(e) {
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  return ctrlKey && shiftKey && key.toLowerCase() === "z";
};
var History = class {
  element;
  histories;
  index;
  maxCount;
  constructor(el) {
    this.element = el;
    this.histories = [];
    this.index = 1;
    this.maxCount = 390;
  }
  prune() {
    if (this.index > 1) {
      this.histories = this.histories.slice(0, this.histories.length - (this.index - 1));
      this.index = 1;
    }
  }
  add(prune = true) {
    const el = this.element;
    if (prune) {
      this.prune();
    } else if (this.index !== 1) {
      return;
    }
    const state = getState(el, true);
    this.histories.push(state);
    if (this.histories.length > this.maxCount) {
      this.histories.shift();
    }
  }
  prev() {
    if (this.index < this.histories.length) {
      this.index += 1;
    }
  }
  next() {
    if (this.index > 1) {
      this.index -= 1;
    }
  }
  curr() {
    return this.histories[this.histories.length - this.index];
  }
  undo(e) {
    const el = this.element;
    this.prev();
    const h = this.curr();
    if (!h) {
      return;
    }
    setState(el, h);
  }
  redo(e) {
    const el = this.element;
    this.next();
    const h = this.curr();
    if (!h) {
      return;
    }
    setState(el, h);
  }
};

// src/modules/commentify.ts
var hasComment = function(selectedRows) {
  for (const r of selectedRows) {
    const _hasComment = r.value.startsWith("//");
    if (_hasComment) {
      return true;
    }
  }
  return false;
};
var Commentify = class {
  element;
  key;
  removePattern;
  newValue;
  constructor(el) {
    this.element = el;
    this.key = "/";
    this.removePattern = /^\/\/\s?/;
    this.newValue = "// ";
  }
  isValid(e) {
    const { key, altKey, shiftKey } = e;
    const ctrlKey = e.ctrlKey || e.metaKey;
    return ctrlKey && !altKey && !shiftKey && key === this.key;
  }
  exec(e) {
    const el = this.element;
    const { rows, selectedRows } = getRows(el);
    const isMultiple = selectedRows.length > 1;
    const shouldRemove = hasComment(selectedRows);
    const state = updateRows(el, rows, (row) => {
      const isSelected = row.selectionStart > -1 || row.selectionEnd > -1;
      if (!isSelected) {
        return row.value;
      }
      if (isMultiple) {
        const isEmpty = !row.value.trim();
        if (shouldRemove) {
          return row.value.replace(this.removePattern, "");
        } else if (isEmpty) {
          return row.value;
        } else {
          return this.newValue + row.value;
        }
      } else {
        if (shouldRemove) {
          return row.value.replace(this.removePattern, "");
        } else {
          return this.newValue + row.value;
        }
      }
    });
    setState(el, state);
  }
};

// src/modules/indentify.ts
var Indentify = class {
  element;
  key;
  removePattern;
  newValue;
  constructor(el) {
    this.element = el;
    this.key = "Tab";
    this.removePattern = /^[^\S\n\r][^\S\n\r]?/;
    this.newValue = "  ";
  }
  isValid(e) {
    const { key, altKey, shiftKey } = e;
    const ctrlKey = e.ctrlKey || e.metaKey;
    return !ctrlKey && !altKey && key === this.key;
  }
  exec(e) {
    const el = this.element;
    const { rows, selectedRows } = getRows(el);
    const isMultiple = selectedRows.length > 1;
    const shouldRemove = e.shiftKey;
    const state = updateRows(el, rows, (row) => {
      const isSelected = row.selectionStart > -1 || row.selectionEnd > -1;
      if (!isSelected) {
        return row.value;
      }
      if (isMultiple) {
        const isEmpty = !row.value.trim();
        if (shouldRemove) {
          return row.value.replace(this.removePattern, "");
        } else if (isEmpty) {
          return row.value;
        } else {
          return this.newValue + row.value;
        }
      } else {
        if (shouldRemove) {
          return row.value.replace(this.removePattern, "");
        } else {
          return this.newValue + row.value;
        }
      }
    });
    setState(el, state);
  }
};

// src/modules/auto-complete.ts
var AutoComplete = class {
  element;
  tags;
  index;
  timeout;
  result;
  parser;
  filter;
  onLoad;
  _reqId;
  _state;
  constructor(el) {
    this.element = el;
    this.tags = [];
    this.index = {};
    this.timeout = 0;
    this.result = [];
    this.parser = (el2) => {
      const parts = el2.value.split(/[,.\s․‧・｡。{}()<>[\]\\/|'"`!?]/);
      const index = el2.selectionStart;
      let selectionStart = 0, selectionEnd = 0;
      for (const part of parts) {
        selectionEnd = selectionStart + part.length;
        if (index >= selectionStart && index <= selectionEnd) {
          break;
        }
        selectionStart = selectionEnd + 1;
      }
      const head = el2.value.substring(0, selectionStart);
      const body = el2.value.substring(selectionStart, selectionEnd).trim();
      const tail = el2.value.substring(selectionEnd);
      return {
        head,
        body,
        tail
      };
    };
    this.filter = () => true;
    this.onLoad = () => void 0;
    this._state = getState(el, true);
    this._reqId = 0;
  }
  findIndex(value) {
    const index = this.index;
    const keys = Object.keys(index).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      const { score } = compareString(k, value);
      if (score === k.length) {
        return index[k];
      }
    }
  }
  createIndex(size) {
    const tags = this.tags;
    const result = this.index;
    this.index = result;
    return new Promise((resolve) => {
      let i = 0;
      const processChunk = () => {
        let j = i + 100;
        while (i < tags.length) {
          if (i >= j) {
            setTimeout(processChunk, 0);
            return;
          }
          const tag = tags[i];
          const acc = [];
          const combos = getAllCombinations(tag.key.split(""));
          for (const c of combos) {
            const v = c.join("");
            if (v.length === size) {
              acc.push(v);
            }
          }
          const uniqCombos = [...new Set(acc)];
          for (const c of uniqCombos) {
            if (!result[c]) {
              result[c] = [tag];
            } else {
              result[c].push(tag);
            }
          }
          i++;
        }
        resolve(result);
      };
      processChunk();
    });
  }
  compare(a, b) {
    return compareString(a, b);
  }
  reset() {
    setState(this.element, this._state);
  }
  set(result) {
    const short = result.parts.head.length + result.tag.value.length;
    const long = result.parts.head.length + result.tag.value.length;
    const value = result.parts.head + result.tag.value + result.parts.tail;
    const state = {
      short,
      long,
      value
    };
    setState(this.element, state);
  }
  exec() {
    const reqId = this._reqId + 1;
    const startedAt = Date.now();
    const result = [];
    let isStopped = false, isKilled = false, i = 0;
    const stop = (kill) => {
      isStopped = true;
      isKilled = kill || false;
    };
    const parts = this.parser(this.element, stop);
    const text = parts.body;
    const candidates = !text ? [] : this.findIndex(text) || this.tags;
    this.result = result;
    this._state = getState(this.element, true);
    this._reqId = reqId;
    const processChunk = () => {
      if (this._reqId !== reqId || isKilled) {
        return;
      }
      if (isStopped || this.timeout && Date.now() - startedAt >= this.timeout) {
        this.onLoad?.(result);
        return;
      }
      let j = i + 100;
      while (i < candidates.length) {
        if (i >= j) {
          setTimeout(processChunk, 0);
          return;
        }
        const tag = candidates[i];
        const req = {
          tag,
          parts
        };
        const ok = this.filter(req, i, candidates, stop);
        if (ok) {
          result.push(req);
        }
        i++;
      }
      isStopped = true;
      setTimeout(processChunk, 0);
    };
    processChunk();
  }
};

// src/index.ts
var MTGA = class {
  element;
  _keydownState;
  History;
  Commentify;
  Indentify;
  AutoPairing;
  AutoComplete;
  constructor(el) {
    this.element = el;
    this._keydownState = null;
    this.History = new History(el);
    this.Commentify = new Commentify(el);
    this.Indentify = new Indentify(el);
    this.AutoPairing = new AutoPairing(el, {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
      "'": "'",
      '"': '"',
      "`": "`"
    });
    this.AutoComplete = new AutoComplete(el);
    el.addEventListener("keydown", (e) => {
      if (isUndo(e)) {
        e.preventDefault();
        this.History.undo(e);
        this._clearKeydownState();
      } else if (isRedo(e)) {
        e.preventDefault();
        this.History.redo(e);
        this._clearKeydownState();
      } else if (this.AutoPairing.isInsert(e)) {
        e.preventDefault();
        this.AutoPairing.insert(e);
        this.History.add();
        this._clearKeydownState();
      } else if (this.AutoPairing.isDelete(e)) {
        e.preventDefault();
        this.AutoPairing.delete(e);
        this.History.add();
        this._clearKeydownState();
      } else if (this.Commentify.isValid(e)) {
        e.preventDefault();
        this.Commentify.exec(e);
        this.History.add();
        this._clearKeydownState();
      } else if (this.Indentify.isValid(e)) {
        e.preventDefault();
        this.Indentify.exec(e);
        this.History.add();
        this._clearKeydownState();
      } else if (![
        // "Backspace",
        "Meta",
        "Control",
        "Alt",
        "Shift"
      ].includes(e.key)) {
        this._setKeydownState(e);
      }
    }, true);
    el.addEventListener("keyup", (e) => {
      const keydownState = this._keydownState;
      this._clearKeydownState();
      if (!keydownState) {
        return;
      }
      const prevValue = keydownState.value;
      if (prevValue !== el.value) {
        this.History.add();
      } else {
        const prevState = keydownState.state;
        const currState = getState(el);
        if (prevState.short !== currState.short || prevState.long !== currState.long) {
          this.History.add(false);
        }
      }
    }, true);
    el.addEventListener("keyup", (e) => {
      if (e.key.length === 1 || e.key === "Backspace") {
        this.AutoComplete.exec();
      }
    }, true);
    this.element.addEventListener("mouseup", (e) => {
      this.History.add(false);
    }, true);
  }
  getState(withValue) {
    return getState(this.element, withValue);
  }
  setState(state) {
    setState(this.element, state);
  }
  _clearKeydownState() {
    this._keydownState = null;
  }
  _setKeydownState(e) {
    this._keydownState = {
      value: this.element.value,
      state: getState(this.element),
      key: e.key
    };
  }
};
export {
  MTGA
};
