// src/types/state.ts
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
  if (typeof state.value === "string") {
    el.value = state.value;
  }
  if (!state.isReversed) {
    el.setSelectionRange(state.short, state.long, state.dir);
  } else {
    el.setSelectionRange(state.long, state.short, state.dir);
  }
  el.focus();
};

// src/types/module.ts
var MTGAModule = class {
  parent;
  name;
  index;
  onKeydown;
  onKeydownAsync;
  onKeyup;
  onKeyupAsync;
  onPaste;
  onPasteAsync;
  constructor(parent, name, index = 9999) {
    this.parent = parent;
    this.name = name;
    this.index = index;
  }
  static defaults = {};
};

// src/modules/utils.ts
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

// src/modules/history.ts
var onKeydown = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && key.toLowerCase() === "z";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  let h;
  if (!shiftKey) {
    h = this.prev();
  } else {
    h = this.next();
  }
  if (h) {
    mtga.setState(h);
  }
};
var onKeyup = function(e) {
  const mtga = this.parent;
  const keydownState = mtga._keydownState;
  mtga._clearKeydownState();
  if (!keydownState) {
    return;
  }
  const el = mtga.element;
  const prevValue = keydownState.value;
  const currValue = el.value;
  if (prevValue !== currValue) {
    mtga.addHistory();
  } else {
    const prevState = keydownState.state;
    const currState = mtga.getState();
    if (prevState.short !== currState.short || prevState.long !== currState.long) {
      mtga.addHistory(false);
    }
  }
};
var HistoryModule = class _HistoryModule extends MTGAModule {
  items;
  maxCount;
  _i;
  constructor(parent) {
    super(parent, _HistoryModule.name, 0);
    this.items = [];
    this.maxCount = _HistoryModule.defaults.maxCount;
    this._i = 1;
  }
  static name = "History";
  static defaults = {
    maxCount: 390
  };
  onKeydown = onKeydown;
  onKeyup = onKeyup;
  prune() {
    if (this._i > 1) {
      this.items = this.items.slice(0, this.items.length - (this._i - 1));
      this._i = 1;
    }
  }
  add(withPrune = true) {
    const mtga = this.parent;
    if (withPrune) {
      this.prune();
    } else if (this._i !== 1) {
      return;
    }
    const prevState = this.items[this.items.length - 1];
    const currState = mtga.getState(true);
    const isChanged = !prevState || prevState.short !== currState.short || prevState.long !== currState.long || prevState.value !== currState.value;
    if (!isChanged) {
      return;
    }
    this.items.push(currState);
    if (this.items.length > this.maxCount) {
      this.items.shift();
    }
  }
  prev() {
    if (this._i < this.items.length) {
      this._i += 1;
    }
    return this.curr();
  }
  next() {
    if (this._i > 1) {
      this._i -= 1;
    }
    return this.curr();
  }
  curr() {
    return this.items[this.items.length - this._i];
  }
};

// src/types/row.ts
var getRows = function(el) {
  const { short, long } = getState(el);
  const arr = el.value.split(/\n/);
  const rows = [];
  let offset = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const isLastRow = i === arr.length - 1;
    const value = isLastRow ? item : item + "\n";
    const startIndex = offset;
    const endIndex = startIndex + value.length;
    let selectionStart = -1, selectionEnd = -1, selectionValue = "";
    if (short >= startIndex && short < endIndex) {
      selectionStart = short - startIndex;
    }
    if (long > startIndex && (!isLastRow ? long < endIndex : long <= endIndex)) {
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
    const newRow = {
      isSelected,
      index: i,
      startIndex,
      endIndex,
      value,
      selectionStart,
      selectionEnd
      // selectionValue,
    };
    rows.push(newRow);
    offset = endIndex;
  }
  return rows;
};

// src/modules/comment.ts
var singleLineHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && !shiftKey && key === "/";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const { pattern, value } = this;
  const rows = getRows(el);
  const { short, long, dir, isReversed } = mtga.getState();
  const selectedRows = rows.filter((r) => r.isSelected);
  const selectedEmptyRows = selectedRows.filter((r) => !r.value.trim());
  const isMultiple = selectedRows.length > 1;
  const isIgnoreEmptyRows = isMultiple && selectedRows.length !== selectedEmptyRows.length;
  let shouldRemove = true;
  for (const r of selectedRows) {
    if (isIgnoreEmptyRows && selectedEmptyRows.some((_r) => _r.index === r.index)) {
      continue;
    }
    if (!r.value.startsWith("//")) {
      shouldRemove = false;
      break;
    }
  }
  let newShort = short, newLong = long;
  const newValues = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { startIndex, endIndex } = row;
    const origValue = row.value;
    const isSelected = row.isSelected;
    if (!isSelected) {
      newValues.push(row.value);
      continue;
    }
    let newValue;
    if (isMultiple) {
      if (shouldRemove) {
        newValue = row.value.replace(pattern, "");
      } else if (isIgnoreEmptyRows && selectedEmptyRows.some((r) => r.index === row.index)) {
        newValue = row.value;
      } else {
        newValue = value + row.value;
      }
    } else {
      if (shouldRemove) {
        newValue = row.value.replace(pattern, "");
      } else {
        newValue = value + row.value;
      }
    }
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
      newShort += diff;
      newLong += diff;
    }
    newValues.push(newValue);
  }
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
  mtga.addHistory();
};
var multiLineHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && shiftKey && key === "*";
  if (!isValid) {
    return;
  }
  const { short, long, dir, isReversed } = mtga.getState();
  const isRange = short !== long;
  if (isRange) {
    return;
  }
  const prevChar = el.value.charAt(short - 1);
  if (prevChar !== "/") {
    return;
  }
  e.preventDefault();
  const newShort = short + 1, newLong = long + 1;
  const newValue = el.value.substring(0, short) + "**/" + el.value.substring(long);
  mtga.addHistory();
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
  mtga.addHistory();
};
var onKeydown2 = function(e) {
  singleLineHandler.call(this, e);
  multiLineHandler.call(this, e);
};
var CommentModule = class _CommentModule extends MTGAModule {
  pattern;
  value;
  constructor(parent) {
    super(parent, _CommentModule.name);
    this.pattern = _CommentModule.defaults.pattern;
    this.value = _CommentModule.defaults.value;
  }
  static name = "Comment";
  static defaults = {
    pattern: /^\/\/\s?/,
    value: "// "
  };
  onKeydown = onKeydown2;
};

// src/modules/indent.ts
var onKeydown3 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && key === "Tab";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const { pattern, value } = this;
  const rows = getRows(el);
  const { short, long, dir, isReversed } = mtga.getState();
  const selectedRows = rows.filter((r) => r.isSelected);
  const isMultiple = selectedRows.length > 1;
  const shouldRemove = e.shiftKey;
  let newShort = short, newLong = long;
  const newValues = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { startIndex, endIndex } = row;
    const origValue = row.value;
    const isSelected = row.isSelected;
    if (!isSelected) {
      newValues.push(row.value);
      continue;
    }
    let newValue;
    if (isMultiple) {
      const isEmpty = !row.value.trim();
      if (shouldRemove) {
        newValue = row.value.replace(pattern, "");
      } else if (isEmpty) {
        newValue = row.value;
      } else {
        newValue = value + row.value;
      }
    } else {
      if (shouldRemove) {
        newValue = row.value.replace(pattern, "");
      } else {
        newValue = value + row.value;
      }
    }
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
      newShort += diff;
      newLong += diff;
    }
    newValues.push(newValue);
  }
  mtga.addHistory();
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
  mtga.addHistory();
};
var IndentModule = class _IndentModule extends MTGAModule {
  pattern;
  value;
  constructor(parent) {
    super(parent, _IndentModule.name);
    this.pattern = _IndentModule.defaults.pattern;
    this.value = _IndentModule.defaults.value;
  }
  onKeydown = onKeydown3;
  static name = "Indent";
  static defaults = {
    pattern: /^[^\S\n\r][^\S\n\r]?/,
    value: "  "
  };
};

// src/types/pair.ts
var isOpening = function(pairs, value) {
  return Object.keys(pairs).includes(value);
};
var isClosing = function(pairs, value) {
  return Object.values(pairs).includes(value);
};
var isPair = function(pairs, opening, closing) {
  return pairs[opening] && pairs[opening] === closing;
};
var getClosing = function(pairs, value) {
  return pairs[value];
};

// src/modules/auto-indent.ts
var createIndent = function(unit, size) {
  return unit.repeat(Math.ceil(size / unit.length)).slice(0, size);
};
var getIndent = function(pairs, indentUnit, rows) {
  const openingChars = Object.keys(pairs).join("");
  const closingChars = Object.values(pairs).join("");
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    for (let j = row.length - 1; j >= 0; j--) {
      const ch = row[j];
      if (closingChars.includes(ch)) {
        const depth = row.match(/^\s*/)?.[0].length || 0;
        return createIndent(indentUnit, depth);
      }
      if (openingChars.includes(ch)) {
        const depth = (row.match(/^\s*/)?.[0].length || 0) + indentUnit.length;
        return createIndent(indentUnit, depth);
      }
    }
  }
  return "";
};
var onKeydown4 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && key === "Enter";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const mtga = this.parent;
  const el = this.parent.element;
  const { pairs, indentUnit } = this;
  const { short, long, dir, isReversed } = mtga.getState();
  const currChar = el.value.charAt(short);
  const left = el.value.substring(0, short);
  let center = "\n";
  const right = el.value.substring(long);
  const rows = left.split(/\r\n|\r|\n/);
  const currIndent = getIndent(pairs, indentUnit, rows);
  let newShort = short + 1;
  if (isClosing(pairs, currChar)) {
    const nextIndent = currIndent.substring(0, currIndent.length - indentUnit.length);
    center += currIndent + "\n" + nextIndent;
    newShort += currIndent.length;
  } else {
    center += currIndent;
    newShort += currIndent.length;
  }
  const newValue = left + center + right;
  const newLong = newShort;
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value: newValue
  });
  mtga.addHistory();
};
var AutoIndentModule = class _AutoIndentModule extends MTGAModule {
  pairs;
  indentUnit;
  constructor(parent) {
    super(parent, _AutoIndentModule.name);
    this.pairs = _AutoIndentModule.defaults.pairs;
    this.indentUnit = _AutoIndentModule.defaults.indentUnit;
  }
  onKeydown = onKeydown4;
  static name = "AutoIndent";
  static defaults = {
    pairs: {
      "(": ")",
      "[": "]",
      "{": "}"
    },
    indentUnit: "  "
  };
};

// src/modules/auto-pair.ts
var closePairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const pairs = this.pairs;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && isOpening(pairs, key);
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const { short, long, dir, isReversed } = mtga.getState();
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
  mtga.addHistory();
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
  mtga.addHistory();
};
var clearPairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const pairs = this.pairs;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isRemoveKey = !ctrlKey && !altKey && key === "Backspace";
  if (!isRemoveKey) {
    return;
  }
  const { short, long } = mtga.getState();
  const isRange = short !== long;
  if (isRange) {
    return;
  }
  const prevChar = el.value.charAt(short - 1);
  const currChar = el.value.charAt(short);
  if (!isPair(pairs, prevChar, currChar)) {
    return;
  }
  e.preventDefault();
  const left = el.value.substring(0, short - 1);
  const right = el.value.substring(short + 1);
  const newValue = left + right;
  const newShort = left.length;
  const newLong = left.length;
  mtga.addHistory();
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "forward",
    value: newValue
  });
  mtga.addHistory();
};
var onKeydown5 = function(e) {
  closePairHandler.call(this, e);
  clearPairHandler.call(this, e);
};
var AutoPairModule = class _AutoPairModule extends MTGAModule {
  pairs;
  constructor(parent) {
    super(parent, _AutoPairModule.name);
    this.pairs = { ..._AutoPairModule.defaults.pairs };
  }
  onKeydown = onKeydown5;
  static name = "AutoPair";
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

// src/modules/auto-complete.ts
var findIndex = function(indexes, value) {
  for (const index of indexes) {
    const pattern = index.pattern;
    if (pattern.test(value)) {
      return index;
    }
  }
};
var onKeyup2 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && (key.length === 1 || key === "Backspace");
  if (!isValid) {
    return;
  }
  this.stop(true);
  const mtga = this.parent;
  const el = this.parent.element;
  const requestId = this._requestId + 1;
  const chunkSize = this._chunkSize;
  const result = [];
  let isStopped = false, isKilled = false, i = 0;
  const stop = (kill) => {
    isStopped = true;
    isKilled = kill || false;
  };
  this._requestId = requestId;
  this._stop = stop;
  const query = this.parser.call(this, el);
  const text = query.body;
  let candidates = [];
  if (text) {
    const index = findIndex(this.indexes, text);
    if (index) {
      candidates = index.tags;
    } else {
      candidates = this.tags;
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
      const ok = this.filter?.call(this, chunk, result, i, candidates);
      if (ok) {
        chunks.push(chunk);
        result.push(chunk);
      }
      i++;
    }
    if (isKilled || this._requestId !== requestId) {
      return;
    }
    if (isStopped || i >= candidates.length) {
      this.onData?.call(this, chunks, result);
      this.onEnd?.call(this, result);
      return;
    }
    this.onData?.call(this, chunks, result);
    setTimeout(processChunk, 0);
  };
  processChunk();
};
var AutoCompleteModule = class _AutoCompleteModule extends MTGAModule {
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
    super(parent, _AutoCompleteModule.name, 1);
    this.tags = [];
    this.indexes = [];
    this.parser = _AutoCompleteModule.defaults.parser;
    this.filter = _AutoCompleteModule.defaults.filter;
    this.onData = () => void 0;
    this.onEnd = () => void 0;
    this._requestId = 0;
    this._chunkSize = _AutoCompleteModule.defaults.chunkSize;
    this._stop = () => void 0;
  }
  onKeyup = onKeyup2;
  static name = "AutoComplete";
  static defaults = {
    chunkSize: 100,
    parser: function(el) {
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
    filter: function(chunk, index, candidates, result) {
      const { tag, query } = chunk;
      const a = query.body;
      const b = tag.key;
      return b.indexOf(a) > -1;
    }
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
    this.parent.setState(state);
  }
};

// src/modules/line-break.ts
var onKeydown6 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && key === "Enter";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const { short, long, dir, isReversed } = mtga.getState();
  const rows = getRows(el);
  const selectedRows = rows.filter((r) => r.isSelected);
  const targetRow = e.shiftKey ? selectedRows[0] : selectedRows[selectedRows.length - 1];
  const isLastRowSelected = rows[rows.length - 1].index === selectedRows[selectedRows.length - 1].index;
  let newValues = [], newShort = short, newLong = long;
  for (const row of rows) {
    const isTarget = targetRow.index === row.index;
    if (!isTarget) {
      newValues.push(row.value);
      continue;
    }
    if (!shiftKey) {
      newValues.push(row.value + "\n");
      newShort = row.endIndex;
      newLong = row.endIndex;
    } else {
      newValues.push("\n" + row.value);
      newShort = row.startIndex;
      newLong = row.startIndex;
    }
  }
  if (!shiftKey && isLastRowSelected) {
    newShort += 1;
    newLong += 1;
  }
  mtga.addHistory();
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value: newValues.join("")
  });
  mtga.addHistory();
};
var LineBreakModule = class _LineBreakModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineBreakModule.name);
  }
  onKeydown = onKeydown6;
  static name = "LineBreak";
  static defaults = {};
};

// src/modules/line-remove.ts
var onKeydown7 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && shiftKey && key.toLowerCase() === "k";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const rows = getRows(el);
  const selectedRows = rows.filter((r) => r.isSelected);
  const firstSelectedRow = selectedRows[0];
  const lastSelectedRow = selectedRows[selectedRows.length - 1];
  let newValues = [], newShort = 0, newLong = 0, maxRowIndex = 0;
  for (const row of rows) {
    if (row.isSelected) {
      continue;
    }
    if (row.index === firstSelectedRow.index - 1) {
      newShort = row.endIndex;
      newLong = row.endIndex;
    } else if (row.index === lastSelectedRow.index + 1) {
      maxRowIndex = row.value.length;
    }
    newValues.push(row.value);
  }
  const rowIndex = Math.min(
    Math.max(0, lastSelectedRow.selectionStart, lastSelectedRow.selectionEnd - 1),
    Math.max(0, maxRowIndex - 1)
  );
  newShort += rowIndex;
  newLong += rowIndex;
  let value = newValues.join("");
  const removeLastLinebreak = selectedRows.length === 1 && selectedRows[0].value === "" && rows[rows.length - 1].index === selectedRows[0].index;
  if (removeLastLinebreak) {
    value = value.substring(0, value.length - 1);
  }
  mtga.addHistory();
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value
  });
  mtga.addHistory();
};
var LineRemoveModule = class _LineRemoveModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineRemoveModule.name);
  }
  onKeydown = onKeydown7;
  static name = "LineRemove";
  static defaults = {};
};

// src/modules/line-cut.ts
var IS_SUPPORTED = !!navigator.clipboard?.writeText;
var onKeydownAsync = async function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (!IS_SUPPORTED) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const { short, long, dir, isReversed } = mtga.getState();
  const isRange = short !== long;
  const isValid = !isRange && ctrlKey && !altKey && !shiftKey && key.toLowerCase() === "x";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const rows = getRows(el);
  let data = "", newValues = [], newShort = short, newLong = long;
  for (const row of rows) {
    const isSelected = row.isSelected;
    if (!isSelected) {
      newValues.push(row.value);
    } else {
      newShort = row.startIndex;
      newLong = row.startIndex;
      data = row.value;
    }
  }
  if (!data) {
    return;
  }
  if (!data.endsWith("\n")) {
    data += "\n";
  }
  await navigator.clipboard.writeText(data);
  mtga.addHistory();
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value: newValues.join("")
  });
  mtga.addHistory();
};
var LineCutModule = class _LineCutModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineCutModule.name);
  }
  onKeydownAsync = onKeydownAsync;
  static name = "LineCut";
  static defaults = {};
};

// src/modules/line-copy.ts
var IS_SUPPORTED2 = !!navigator.clipboard?.writeText;
var onKeydownAsync2 = async function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (!IS_SUPPORTED2) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const { short, long, dir, isReversed } = mtga.getState();
  const isRange = short !== long;
  const isValid = !isRange && ctrlKey && !altKey && !shiftKey && key.toLowerCase() === "c";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const rows = getRows(el);
  let data = rows.find((r) => r.isSelected)?.value;
  if (!data) {
    return;
  }
  if (!data.endsWith("\n")) {
    data += "\n";
  }
  await navigator.clipboard.writeText(data);
};
var LineCopyModule = class _LineCopyModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineCopyModule.name);
  }
  onKeydownAsync = onKeydownAsync2;
  static name = "LineCopy";
  static defaults = {};
};

// src/modules/line-paste.ts
var onPaste = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { short, long, dir, isReversed } = mtga.getState();
  const isRange = short !== long;
  const isValid = !isRange;
  if (!isValid) {
    return;
  }
  let copiedText = e.clipboardData?.getData("text");
  if (!copiedText) {
    return;
  }
  copiedText = copiedText.replace(/\r\n|\r/g, "\n");
  const copiedRows = copiedText.split("\n");
  const isSingleLine = copiedRows.length === 2;
  const isLastLineEmpty = copiedRows[copiedRows.length - 1] === "";
  if (!isSingleLine || !isLastLineEmpty) {
    return;
  }
  e.preventDefault();
  const rows = getRows(el);
  let newValues = [], newShort = short + copiedText.length, newLong = long + copiedText.length;
  for (const row of rows) {
    const isSelected = row.isSelected;
    if (isSelected) {
      newValues.push(copiedText);
    }
    newValues.push(row.value);
  }
  mtga.addHistory();
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
  mtga.addHistory();
};
var LinePasteModule = class _LinePasteModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LinePasteModule.name);
  }
  onPaste = onPaste;
  static name = "LinePaste";
  static defaults = {};
};

// src/mtga.ts
var MTGA = class {
  element;
  modules;
  moduleOrder;
  _keydownState;
  _keydownEvent;
  _keyupEvent;
  _pasteEvent;
  _focusEvent;
  _blurEvent;
  constructor(el) {
    this.element = el;
    this.modules = {};
    this.modules[HistoryModule.name] = new HistoryModule(this);
    this.modules[CommentModule.name] = new CommentModule(this);
    this.modules[IndentModule.name] = new IndentModule(this);
    this.modules[LineBreakModule.name] = new LineBreakModule(this);
    this.modules[LineRemoveModule.name] = new LineRemoveModule(this);
    this.modules[LineCutModule.name] = new LineCutModule(this);
    this.modules[LineCopyModule.name] = new LineCopyModule(this);
    this.modules[LinePasteModule.name] = new LinePasteModule(this);
    this.modules[AutoIndentModule.name] = new AutoIndentModule(this);
    this.modules[AutoPairModule.name] = new AutoPairModule(this);
    this.modules[AutoCompleteModule.name] = new AutoCompleteModule(this);
    this.moduleOrder = [];
    this._keydownState = null;
    this._keydownEvent = async (e) => {
      for (const m of this.moduleOrder) {
        m.onKeydown?.call(m, e);
        await m.onKeydownAsync?.call(m, e);
      }
      if (e.defaultPrevented) {
        this._clearKeydownState();
      } else if (![
        "Meta",
        "Control",
        "Alt",
        "Shift"
      ].includes(e.key)) {
        this._setKeydownState(e);
      }
    };
    this._keyupEvent = async (e) => {
      for (const m of this.moduleOrder) {
        m.onKeyup?.call(m, e);
        await m.onKeyupAsync?.call(m, e);
      }
    };
    this._pasteEvent = async (e) => {
      for (const m of this.moduleOrder) {
        m.onPaste?.call(m, e);
        await m.onPasteAsync?.call(m, e);
      }
    };
    const _selectionEvent = (e) => {
      this.addHistory(false);
    };
    this._focusEvent = (e) => {
      setTimeout(() => {
        this.addHistory(false);
        this.element.addEventListener("pointerup", _selectionEvent, true);
      }, 0);
    };
    this._blurEvent = (e) => {
      this.element.removeEventListener("pointerup", _selectionEvent, true);
    };
    this.element.addEventListener("keydown", this._keydownEvent, true);
    this.element.addEventListener("keyup", this._keyupEvent, true);
    this.element.addEventListener("paste", this._pasteEvent, true);
    this.element.addEventListener("focus", this._focusEvent, true);
    this.element.addEventListener("blur", this._blurEvent, true);
    this.initModuleOrder();
  }
  initModuleOrder() {
    this.moduleOrder = Object.values(this.modules).sort((a, b) => a.index - b.index);
  }
  getModule(name) {
    return this.modules[name];
  }
  setModule(module) {
    this.modules[module.name] = module;
    this.initModuleOrder();
  }
  removeModule(name) {
    if (this.modules[name]) {
      delete this.modules[name];
      this.initModuleOrder();
    }
  }
  getState(withValue) {
    return getState(this.element, withValue);
  }
  setState(state) {
    setState(this.element, state);
  }
  addHistory(withPrune = true) {
    this.getModule(HistoryModule.name)?.add(withPrune);
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
  destroy() {
    this.element.removeEventListener("keydown", this._keydownEvent);
    this.element.removeEventListener("keyup", this._keyupEvent);
    this.element.removeEventListener("paste", this._pasteEvent);
    this.element.removeEventListener("focus", this._focusEvent);
    this.element.removeEventListener("blur", this._blurEvent);
  }
};
export {
  AutoCompleteModule,
  AutoIndentModule,
  AutoPairModule,
  CommentModule,
  HistoryModule,
  IndentModule,
  LineBreakModule,
  LineCopyModule,
  LineCutModule,
  LinePasteModule,
  LineRemoveModule,
  MTGA,
  MTGAModule
};
