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

// src/modules/pairify.ts
var isOpening = function(pairs, value) {
  return Object.keys(pairs).includes(value);
};
var getClosing = function(pairs, value) {
  return pairs[value];
};
var closePairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const el = this.element;
  const pairs = this.pairify.pairs;
  const isValid = !ctrlKey && !altKey && isOpening(pairs, key);
  if (!isValid) {
    return;
  }
  e.preventDefault();
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
  this.history.add();
};
var clearPairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValidKey = !ctrlKey && !altKey && !shiftKey && key === "Backspace";
  if (!isValidKey) {
    return;
  }
  const el = this.element;
  const pairs = this.pairify.pairs;
  const { short, long, dir, isReversed } = getState(el);
  const isRange = short !== long;
  if (isRange) {
    return;
  }
  const opening = el.value.charAt(long - 1);
  const closing = getClosing(pairs, opening);
  const isValidChars = isOpening(pairs, opening) && getClosing(pairs, opening) === closing;
  if (!isValidChars) {
    return;
  }
  e.preventDefault();
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
  this.history.add();
};
var Pairify = class _Pairify {
  parent;
  pairs;
  constructor(parent) {
    this.parent = parent;
    this.pairs = { ..._Pairify.defaults.pairs };
    parent.modules.push(
      {
        name: "ClosePair",
        onKeydown: closePairHandler
      },
      {
        name: "ClearPair",
        onKeydown: clearPairHandler
      }
    );
  }
  static defaults = {
    pairs: {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
      "'": "'",
      '"': '"',
      "`": "`"
    }
  };
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
var commentifyHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && !shiftKey && key === "/";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const { pattern, value } = this.commentify;
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
        return row.value.replace(pattern, "");
      } else if (isEmpty) {
        return row.value;
      } else {
        return value + row.value;
      }
    } else {
      if (shouldRemove) {
        return row.value.replace(pattern, "");
      } else {
        return value + row.value;
      }
    }
  });
  setState(el, state);
  this.history.add();
};
var Commentify = class _Commentify {
  parent;
  pattern;
  value;
  constructor(parent) {
    this.parent = parent;
    this.pattern = _Commentify.defaults.pattern;
    this.value = _Commentify.defaults.value;
    parent.modules.push(
      {
        name: "Commentify",
        onKeydown: commentifyHandler
      }
    );
  }
  static defaults = {
    pattern: /^\/\/\s?/,
    value: "// "
  };
};

// src/modules/indentify.ts
var indentifyHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && key === "Tab";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const { pattern, value } = this.indentify;
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
        return row.value.replace(pattern, "");
      } else if (isEmpty) {
        return row.value;
      } else {
        return value + row.value;
      }
    } else {
      if (shouldRemove) {
        return row.value.replace(pattern, "");
      } else {
        return value + row.value;
      }
    }
  });
  setState(el, state);
  this.history.add();
};
var Indentify = class _Indentify {
  parent;
  pattern;
  value;
  constructor(parent) {
    this.parent = parent;
    this.pattern = _Indentify.defaults.pattern;
    this.value = _Indentify.defaults.value;
    parent.modules.push(
      {
        name: "Indentify",
        onKeydown: indentifyHandler
      }
    );
  }
  static defaults = {
    pattern: /^[^\S\n\r][^\S\n\r]?/,
    value: "  "
  };
};

// src/modules/tagify.ts
var findIndex = function(indexes, value) {
  for (const index of indexes) {
    const pattern = index.pattern;
    if (pattern.test(value)) {
      return index;
    }
  }
};
var tagifyHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && (key.length === 1 || key === "Backspace");
  if (!isValid) {
    return;
  }
  const tagify = this.tagify;
  tagify.stop(true);
  const requestId = tagify._requestId + 1;
  const chunkSize = tagify._chunkSize;
  const result = [];
  let isStopped = false, isKilled = false, i = 0;
  const stop = (kill) => {
    isStopped = true;
    isKilled = kill || false;
  };
  tagify._requestId = requestId;
  tagify._stop = stop;
  const query = tagify.parser.call(this, this.element);
  const text = query.body;
  let candidates = [];
  if (text) {
    const index = findIndex(tagify.indexes, text);
    if (index) {
      candidates = index.tags;
    } else {
      candidates = tagify.tags;
    }
  }
  const processChunk = () => {
    const chunks = [];
    let j = i + chunkSize;
    while (i < j && i < candidates.length) {
      const tag = candidates[i];
      const chunk = {
        tag,
        query
      };
      const ok = tagify.filter?.call(this, chunk, i, candidates, result);
      if (ok) {
        chunks.push(chunk);
        result.push(chunk);
      }
      i++;
    }
    if (isKilled || tagify._requestId !== requestId) {
      return;
    }
    if (isStopped || i >= candidates.length) {
      tagify.onData?.call(this, chunks, result);
      tagify.onEnd?.call(this, result);
      return;
    }
    tagify.onData?.call(this, chunks, result);
    setTimeout(processChunk, 0);
  };
  processChunk();
};
var Tagify = class _Tagify {
  parent;
  tags;
  indexes;
  parser;
  filter;
  onData;
  onEnd;
  _requestId;
  _chunkSize;
  _stop;
  constructor(parent) {
    this.parent = parent;
    this.tags = [];
    this.indexes = [];
    this.parser = _Tagify.defaults.parser;
    this.filter = _Tagify.defaults.filter;
    this.onData = () => void 0;
    this.onEnd = () => void 0;
    this._requestId = 0;
    this._chunkSize = _Tagify.defaults.chunkSize;
    this._stop = () => void 0;
    parent.modules.push(
      {
        name: "Tagify",
        onKeyup: tagifyHandler
      }
    );
  }
  static defaults = {
    chunkSize: 100,
    parser: (el) => {
      const parts = el.value.split(/[,.․‧・｡。{}()<>[\]\\/|'"`!?]|\r\n|\r|\n/);
      const index = el.selectionStart;
      let selectionStart = 0, selectionEnd = 0;
      for (const part of parts) {
        selectionEnd = selectionStart + part.length;
        if (index >= selectionStart && index <= selectionEnd) {
          break;
        }
        selectionStart = selectionEnd + 1;
      }
      let head = el.value.substring(0, selectionStart), body = el.value.substring(selectionStart, selectionEnd), tail = el.value.substring(selectionEnd);
      const match = body.match(/^(\s*)(.*?)(\s*)$/);
      if (match) {
        head = head + (match[1] || "");
        body = match[2];
        tail = (match[3] || "") + tail;
      }
      return {
        head,
        body,
        tail
      };
    },
    filter: () => true
  };
  compare(a, b) {
    return compareString(a, b);
  }
  stop(kill) {
    const stop = this._stop;
    stop?.(kill);
  }
  set(chunk) {
    const short = chunk.query.head.length + chunk.tag.value.length;
    const long = chunk.query.head.length + chunk.tag.value.length;
    const value = chunk.query.head + chunk.tag.value + chunk.query.tail;
    const state = {
      short,
      long,
      value
    };
    setState(this.parent.element, state);
  }
};

// src/modules/history.ts
var undoHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && !shiftKey && key.toLowerCase() === "z";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const h = this.history.prev();
  if (!h) {
    return;
  }
  setState(el, h);
};
var redoHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && shiftKey && key.toLowerCase() === "z";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const h = this.history.next();
  if (!h) {
    return;
  }
  setState(el, h);
};
var historyHandler = function(e) {
  const keydownState = this._keydownState;
  this._clearKeydownState();
  if (!keydownState) {
    return;
  }
  const el = this.element;
  const prevValue = keydownState.value;
  if (prevValue !== el.value) {
    this.history.add();
  } else {
    const prevState = keydownState.state;
    const currState = getState(el);
    if (prevState.short !== currState.short || prevState.long !== currState.long) {
      this.history.add(false);
    }
  }
};
var History = class _History {
  parent;
  items;
  index;
  maxCount;
  constructor(parent) {
    this.parent = parent;
    this.items = [];
    this.index = 1;
    this.maxCount = _History.defaults.maxCount;
    parent.modules.push(
      {
        name: "Undo",
        onKeydown: undoHandler
      },
      {
        name: "Redo",
        onKeydown: redoHandler
      },
      {
        name: "History",
        onKeyup: historyHandler
      }
    );
  }
  static defaults = {
    maxCount: 390
  };
  prune() {
    if (this.index > 1) {
      this.items = this.items.slice(0, this.items.length - (this.index - 1));
      this.index = 1;
    }
  }
  add(withPrune = true) {
    const el = this.parent.element;
    if (withPrune) {
      this.prune();
    } else if (this.index !== 1) {
      return;
    }
    const state = getState(el, true);
    this.items.push(state);
    if (this.items.length > this.maxCount) {
      this.items.shift();
    }
  }
  prev() {
    if (this.index < this.items.length) {
      this.index += 1;
    }
    return this.curr();
  }
  next() {
    if (this.index > 1) {
      this.index -= 1;
    }
    return this.curr();
  }
  curr() {
    return this.items[this.items.length - this.index];
  }
};

// src/mtga.ts
var MTGA = class {
  element;
  modules;
  _keydownState;
  _keydownEvent;
  _keyupEvent;
  _mouseupEvent;
  constructor(el) {
    this.element = el;
    this.modules = [];
    this.history = new History(this);
    this.commentify = new Commentify(this);
    this.indentify = new Indentify(this);
    this.pairify = new Pairify(this);
    this.tagify = new Tagify(this);
    this._keydownState = null;
    this._keydownEvent = (e) => {
      for (const m of this.modules) {
        m.onKeydown?.call(this, e);
        if (e.defaultPrevented) {
          this._clearKeydownState();
          return;
        }
      }
      if (![
        "Meta",
        "Control",
        "Alt",
        "Shift"
      ].includes(e.key)) {
        this._setKeydownState(e);
      }
    };
    this._keyupEvent = (e) => {
      const el2 = this.element;
      for (const m of this.modules) {
        m.onKeyup?.call(this, e);
        if (e.defaultPrevented) {
          break;
        }
      }
      const keydownState = this._keydownState;
      this._clearKeydownState();
      if (!keydownState) {
        return;
      }
      const prevValue = keydownState.value;
      if (prevValue !== el2.value) {
        this.history.add();
      } else {
        const prevState = keydownState.state;
        const currState = getState(el2);
        if (prevState.short !== currState.short || prevState.long !== currState.long) {
          this.history.add(false);
        }
      }
    };
    this._mouseupEvent = (e) => {
      this.history.add(false);
    };
    this.element.addEventListener("keydown", this._keydownEvent, true);
    this.element.addEventListener("keyup", this._keyupEvent, true);
    this.element.addEventListener("mouseup", this._mouseupEvent, true);
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
  Commentify,
  History,
  Indentify,
  MTGA,
  Pairify,
  Tagify
};
