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
  if (typeof state.value === "string") {
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

// src/types/module.ts
var IModule = class {
  parent;
  name;
  index;
  onKeydown;
  onKeyup;
  constructor(parent, name, index = 9999) {
    this.parent = parent;
    this.name = name;
    this.index = index;
  }
  static defaults = {};
};

// src/modules/history.ts
var onKeydown = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && key.toLowerCase() === "z";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const module = this.getModule(HistoryModule.name);
  if (!module) {
    console.warn(`Module not found: ${HistoryModule.name}`);
    return;
  }
  let h;
  if (!shiftKey) {
    h = module.prev();
  } else {
    h = module.next();
  }
  if (h) {
    this.setState(h);
  }
};
var onKeyup = function(e) {
  const keydownState = this._keydownState;
  this._clearKeydownState();
  if (!keydownState) {
    return;
  }
  const el = this.element;
  const prevValue = keydownState.value;
  const currValue = el.value;
  if (prevValue !== currValue) {
    this.addHistory();
  } else {
    const prevState = keydownState.state;
    const currState = getState(el);
    if (prevState.short !== currState.short || prevState.long !== currState.long) {
      this.addHistory(false);
    }
  }
};
var HistoryModule = class _HistoryModule extends IModule {
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
    const el = this.parent.element;
    if (withPrune) {
      this.prune();
    } else if (this._i !== 1) {
      return;
    }
    const prevState = this.items[this.items.length - 1];
    const currState = getState(el, true);
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

// src/modules/comment.ts
var isCommentified = function(selectedRows) {
  for (const r of selectedRows) {
    const ok = r.value.startsWith("//");
    if (!ok) {
      return false;
    }
  }
  return true;
};
var singleLineHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const module = this.getModule(CommentModule.name);
  if (!module) {
    console.warn(`Module not found: ${CommentModule.name}`);
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && !shiftKey && key === "/";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const { pattern, value } = module;
  const rows = getRows(el);
  const { short, long, dir, isReversed } = getState(el);
  const selectedRows = rows.filter((r) => r.isSelected);
  const isMultiple = selectedRows.length > 1;
  const shouldRemove = isCommentified(selectedRows);
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
  this.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
  this.addHistory();
};
var multiLineHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const module = this.getModule(CommentModule.name);
  if (!module) {
    console.warn(`Module not found: ${CommentModule.name}`);
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && shiftKey && key === "*";
  if (!isValid) {
    return;
  }
  const el = this.element;
  const { short, long, dir, isReversed } = getState(el);
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
  this.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
  this.addHistory();
};
var onKeydown2 = function(e) {
  singleLineHandler.call(this, e);
  multiLineHandler.call(this, e);
};
var CommentModule = class _CommentModule extends IModule {
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
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && key === "Tab";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const module = this.getModule(IndentModule.name);
  if (!module) {
    console.warn(`Module not found: ${IndentModule.name}`);
    return;
  }
  const el = this.element;
  const { pattern, value } = module;
  const rows = getRows(el);
  const { short, long, dir, isReversed } = getState(el);
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
  this.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
  this.addHistory();
};
var IndentModule = class _IndentModule extends IModule {
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
var isPair = function(pairs, opening, closing) {
  return pairs[opening] && pairs[opening] === closing;
};
var getClosing = function(pairs, value) {
  return pairs[value];
};

// src/modules/auto-indent.ts
var getIndent = function(str) {
  const rows = str.split(/\r\n|\r|\n/);
  const currRow = rows[rows.length - 1];
  const currIndent = currRow.match(/^(\s*)/)?.[1] || "";
  return currIndent;
};
var onKeydown4 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const module = this.getModule(AutoIndentModule.name);
  if (!module) {
    console.warn(`Module not found: ${AutoIndentModule.name}`);
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && !shiftKey && key === "Enter";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const { pairs, indentUnit } = module;
  const el = this.element;
  const { short, long, dir, isReversed } = getState(el);
  const prevChar = el.value.charAt(short - 1);
  const currChar = el.value.charAt(short);
  const left = el.value.substring(0, short);
  let center = "\n";
  const right = el.value.substring(long);
  const rows = left.split(/\r\n|\r|\n/);
  const currRow = rows[rows.length - 1];
  const currIndent = getIndent(currRow);
  let newShort = short + 1;
  if (isPair(pairs, prevChar, currChar)) {
    center += currIndent + indentUnit + "\n" + currIndent;
    newShort += currIndent.length + indentUnit.length;
  } else {
    center += currIndent;
    newShort += currIndent.length;
  }
  const newValue = left + center + right;
  const newLong = newShort;
  this.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "none",
    value: newValue
  });
  this.addHistory();
};
var AutoIndentModule = class _AutoIndentModule extends IModule {
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
  const module = this.getModule(AutoPairModule.name);
  if (!module) {
    console.warn(`Module not found: ${AutoPairModule.name}`);
    return;
  }
  const pairs = module.pairs;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && isOpening(pairs, key);
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
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
  this.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
  this.addHistory();
};
var clearPairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const module = this.getModule(AutoPairModule.name);
  if (!module) {
    console.warn(`Module not found: ${AutoPairModule.name}`);
    return;
  }
  const pairs = module.pairs;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const el = this.element;
  const isRemoveKey = !ctrlKey && !altKey && !shiftKey && key === "Backspace";
  if (!isRemoveKey) {
    return;
  }
  const { short, long } = getState(el);
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
  this.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "forward",
    value: newValue
  });
  this.addHistory();
};
var onKeydown5 = function(e) {
  closePairHandler.call(this, e);
  clearPairHandler.call(this, e);
};
var AutoPairModule = class _AutoPairModule extends IModule {
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
  const module = this.getModule(AutoCompleteModule.name);
  if (!module) {
    console.warn(`Module not found: ${AutoCompleteModule.name}`);
    return;
  }
  module.stop(true);
  const requestId = module._requestId + 1;
  const chunkSize = module._chunkSize;
  const result = [];
  let isStopped = false, isKilled = false, i = 0;
  const stop = (kill) => {
    isStopped = true;
    isKilled = kill || false;
  };
  module._requestId = requestId;
  module._stop = stop;
  const query = module.parser.call(module, this.element);
  const text = query.body;
  let candidates = [];
  if (text) {
    const index = findIndex(module.indexes, text);
    if (index) {
      candidates = index.tags;
    } else {
      candidates = module.tags;
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
      const ok = module.filter?.call(module, chunk, result, i, candidates);
      if (ok) {
        chunks.push(chunk);
        result.push(chunk);
      }
      i++;
    }
    if (isKilled || module._requestId !== requestId) {
      return;
    }
    if (isStopped || i >= candidates.length) {
      module.onData?.call(module, chunks, result);
      module.onEnd?.call(module, result);
      return;
    }
    module.onData?.call(module, chunks, result);
    setTimeout(processChunk, 0);
  };
  processChunk();
};
var AutoCompleteModule = class _AutoCompleteModule extends IModule {
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
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && key === "Enter";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const { short, long, dir, isReversed } = getState(el);
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
  this.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "none",
    value: newValues.join("")
  });
  this.addHistory();
};
var LineBreakModule = class _LineBreakModule extends IModule {
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
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = ctrlKey && !altKey && shiftKey && key.toLowerCase() === "k";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const el = this.element;
  const rows = getRows(el);
  const selectedRows = rows.filter((r) => r.isSelected);
  const firstSelectedRow = selectedRows[0];
  let newValues = [], newShort = 0, newLong = 0;
  for (const row of rows) {
    const isSelected = row.isSelected;
    if (isSelected) {
      continue;
    }
    if (row.index === firstSelectedRow.index - 1) {
      newShort = row.startIndex;
      newLong = row.startIndex;
    }
    newValues.push(row.value);
  }
  let value = newValues.join("");
  const removeLastLinebreak = selectedRows.length === 1 && selectedRows[0].value === "" && rows[rows.length - 1].index === selectedRows[0].index;
  if (removeLastLinebreak) {
    value = value.substring(0, value.length - 1);
  }
  this.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "none",
    value
  });
  this.addHistory();
};
var LineRemoveModule = class _LineRemoveModule extends IModule {
  constructor(parent) {
    super(parent, _LineRemoveModule.name);
  }
  onKeydown = onKeydown7;
  static name = "LineRemove";
  static defaults = {};
};

// src/modules/line-cut.ts
var IS_SUPPORTED = !!navigator.clipboard?.writeText;
var onKeydown8 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (!IS_SUPPORTED) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
  const el = this.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const { short, long, dir, isReversed } = getState(el);
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
    console.warn(`No data selected`);
    return;
  }
  navigator.clipboard.writeText(data).then(() => {
    this.setState({
      isReversed: false,
      short: newShort,
      long: newLong,
      dir: "none",
      value: newValues.join("")
    });
    this.addHistory();
  });
};
var LineCutModule = class _LineCutModule extends IModule {
  constructor(parent) {
    super(parent, _LineCutModule.name);
  }
  onKeydown = onKeydown8;
  static name = "LineCut";
  static defaults = {};
};

// src/modules/line-copy.ts
var IS_SUPPORTED2 = !!navigator.clipboard?.writeText;
var onKeydown9 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (!IS_SUPPORTED2) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
  const el = this.element;
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const { short, long, dir, isReversed } = getState(el);
  const isRange = short !== long;
  const isValid = !isRange && ctrlKey && !altKey && !shiftKey && key.toLowerCase() === "c";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const rows = getRows(el);
  const data = rows.find((r) => r.isSelected)?.value;
  if (!data) {
    console.warn(`No data selected`);
    return;
  }
  navigator.clipboard.writeText(data);
};
var LineCopyModule = class _LineCopyModule extends IModule {
  constructor(parent) {
    super(parent, _LineCopyModule.name);
  }
  onKeydown = onKeydown9;
  static name = "LineCopy";
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
    this.modules[AutoIndentModule.name] = new AutoIndentModule(this);
    this.modules[AutoPairModule.name] = new AutoPairModule(this);
    this.modules[AutoCompleteModule.name] = new AutoCompleteModule(this);
    this.moduleOrder = [];
    this._keydownState = null;
    this._keydownEvent = (e) => {
      for (const m of this.moduleOrder) {
        m.onKeydown?.call(this, e);
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
    this._keyupEvent = (e) => {
      for (const m of this.moduleOrder) {
        m.onKeyup?.call(this, e);
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
    this.element.addEventListener("focus", this._focusEvent, true);
    this.element.addEventListener("blur", this._blurEvent, true);
    this.initOrder();
  }
  initOrder() {
    this.moduleOrder = Object.values(this.modules).sort((a, b) => a.index - b.index);
  }
  getModule(name) {
    return this.modules[name];
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
  LineRemoveModule,
  MTGA
};
