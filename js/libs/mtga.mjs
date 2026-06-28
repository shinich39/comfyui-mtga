// src/types/module.ts
var MTGAModule = class {
  parent;
  name;
  index;
  onKeydown;
  onKeyup;
  onPaste;
  constructor(parent, name, index = 9999) {
    this.parent = parent;
    this.name = name;
    this.index = index;
  }
  static defaults = {};
};

// src/utils/event.ts
var parseKeyboardEvent = (e) => {
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
var isComposingKeyboardEvent = (e) => e.isComposing || e.key === "Process" || e.keyCode === 229;

// src/modules/auto-complete.ts
var onKeyup = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const { key, altKey, ctrlKey, shiftKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && (key.length === 1 || key === "Backspace");
  if (!isValid) {
    return;
  }
  this.kill();
  const chunkSize = this.chunkSize;
  let isStopped = false, isKilled = false, i = 0;
  const stop = (kill) => {
    isStopped = true;
    isKilled = kill || false;
  };
  this._stop = stop;
  const query = this.parser.call(this, e);
  const text = query?.body;
  if (!text) {
    this.query = null;
    this.candidates = [];
    this.result = [];
    return;
  }
  const candidates = this.getIndex(text)?.tags || this.tags;
  const result = [];
  this.query = query;
  this.candidates = candidates;
  this.result = result;
  const processChunk = () => {
    const chunks = [];
    let j = i + chunkSize;
    while (i < j && i < candidates.length) {
      const tag = candidates[i];
      if (isKilled || isStopped) {
        break;
      }
      const ok = this.filter?.call(this, query, tag, i, candidates);
      if (ok) {
        chunks.push(tag);
        result.push(tag);
      }
      i++;
    }
    if (isKilled) {
      return;
    }
    if (isStopped || i >= candidates.length) {
      this.onData?.call(this, chunks);
      this.onEnd?.call(this);
      return;
    }
    this.onData?.call(this, chunks);
    setTimeout(processChunk, 0);
  };
  processChunk();
};
var AutoCompleteModule = class _AutoCompleteModule extends MTGAModule {
  tags;
  indexes;
  chunkSize;
  query;
  candidates;
  result;
  parser;
  filter;
  onData;
  onEnd;
  _stop;
  constructor(parent) {
    super(parent, _AutoCompleteModule.name, 1);
    this.tags = [];
    this.indexes = [];
    this.chunkSize = _AutoCompleteModule.defaults.chunkSize;
    this.query = null;
    this.candidates = [];
    this.result = [];
    this.parser = _AutoCompleteModule.defaults.parser;
    this.filter = _AutoCompleteModule.defaults.filter;
    this.onData = () => void 0;
    this.onEnd = () => void 0;
    this._stop = () => void 0;
  }
  static name = "AutoComplete";
  static defaults = {
    chunkSize: 100,
    parser: (e) => {
      const el = e.target;
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
    filter: (query, tag, index, tags) => {
      const a = query.body;
      const b = tag.key;
      return b.indexOf(a) > -1;
    }
  };
  onKeyup = onKeyup;
  getIndex(value) {
    return this.indexes.find(
      (i) => typeof i.pattern === "string" ? i.pattern === value : i.pattern.test(value)
    );
  }
  stop() {
    const stop = this._stop;
    stop?.(false);
  }
  kill() {
    const stop = this._stop;
    stop?.(true);
  }
  set(tag, query) {
    const mtga = this.parent;
    if (!query) {
      query = this.query;
    }
    if (!query) {
      throw new Error("Query not found");
    }
    const short = query.head.length + tag.value.length;
    const long = query.head.length + tag.value.length;
    const value = query.head + tag.value + query.tail;
    mtga.setState({
      short,
      long,
      value
    });
  }
};

// src/utils/pair.ts
var isOpening = (pairs, value) => Object.keys(pairs).includes(value);
var isClosing = (pairs, value) => Object.values(pairs).includes(value);
var isPair = (pairs, opening, closing) => !!pairs[opening] && pairs[opening] === closing;
var getOpening = (pairs, value) => Object.entries(pairs).find((entry) => entry[1] === value)?.[0];
var getClosing = (pairs, value) => pairs[value];
function getIndent(pairs, indentUnit, rows) {
  const createIndent = (unit, size) => unit.repeat(Math.ceil(size / unit.length)).slice(0, size);
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
}

// src/modules/auto-indent.ts
var getLeadingWhitespace = (value) => value.match(/^[^\S\r\n]*/) ? value.match(/^[^\S\r\n]*/)[0] : "";
var getOutdentedWhitespace = (value, indentUnit) => value.length >= indentUnit.length ? value.slice(0, value.length - indentUnit.length) : "";
var outdentClosingHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (isComposingKeyboardEvent(e)) {
    return;
  }
  const { key, altKey, ctrlKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && isClosing(this.pairs, key);
  if (!isValid) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { indentUnit, pairs } = this;
  const { short, long, dir, isReversed } = mtga.getState();
  if (short !== long) {
    return;
  }
  const left = el.value.substring(0, short);
  const currentRow = left.split(/\r\n|\r|\n/).pop() || "";
  const leadingWhitespace = getLeadingWhitespace(currentRow);
  if (currentRow.trim().length > 0 || leadingWhitespace.length < indentUnit.length) {
    return;
  }
  const opening = getOpening(pairs, key);
  if (!opening) {
    return;
  }
  const beforeRow = currentRow.slice(0, currentRow.length - leadingWhitespace.length);
  const prevChar = beforeRow.charAt(beforeRow.length - 1);
  const currChar = el.value.charAt(short);
  if (currChar === key || isPair(pairs, prevChar, key)) {
    return;
  }
  e.preventDefault();
  const newShort = short - indentUnit.length + 1;
  const newValue = el.value.substring(0, short - indentUnit.length) + key + el.value.substring(long);
  mtga.setState({
    isReversed,
    short: newShort,
    long: newShort,
    dir,
    value: newValue
  });
};
var enterHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (isComposingKeyboardEvent(e)) {
    return;
  }
  const { key, altKey, ctrlKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && key === "Enter";
  if (!isValid) {
    return;
  }
  e.preventDefault();
  const mtga = this.parent;
  const el = this.parent.element;
  const { pairs, indentUnit } = this;
  const { short, long } = mtga.getState();
  const left = el.value.substring(0, short);
  const currentRow = left.split(/\r\n|\r|\n/).pop() || "";
  const baseIndent = getLeadingWhitespace(currentRow);
  const trimmedCurrentRow = currentRow.trimEnd();
  const prevChar = trimmedCurrentRow.charAt(trimmedCurrentRow.length - 1);
  const currChar = el.value.charAt(short);
  const isWhitespaceOnlyBeforeClosing = !currentRow.trim().length && isClosing(pairs, currChar);
  let center = "\n";
  const right = el.value.substring(long);
  const nextIndent = isOpening(pairs, prevChar) ? baseIndent + indentUnit : baseIndent;
  let newShort = short + 1;
  if (isWhitespaceOnlyBeforeClosing) {
    center = "\n";
  } else if (isClosing(pairs, currChar)) {
    const closingIndent = isOpening(pairs, prevChar) ? baseIndent : getOutdentedWhitespace(baseIndent, indentUnit);
    center += nextIndent + "\n" + closingIndent;
    newShort += nextIndent.length;
  } else {
    center += nextIndent;
    newShort += nextIndent.length;
  }
  const newValue = left + center + right;
  const newLong = newShort;
  mtga.setState(
    {
      isReversed: false,
      short: newShort,
      long: newLong,
      value: newValue
    },
    false,
    true
  );
};
var onKeydown = function(e) {
  outdentClosingHandler.call(this, e);
  enterHandler.call(this, e);
};
var AutoIndentModule = class _AutoIndentModule extends MTGAModule {
  pairs;
  indentUnit;
  constructor(parent) {
    super(parent, _AutoIndentModule.name);
    this.pairs = _AutoIndentModule.defaults.pairs;
    this.indentUnit = _AutoIndentModule.defaults.indentUnit;
  }
  static name = "AutoIndent";
  static defaults = {
    pairs: {
      "(": ")",
      "[": "]",
      "{": "}"
    },
    indentUnit: "  "
  };
  onKeydown = onKeydown;
};

// src/modules/auto-pair.ts
var overtypeClosingHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (isComposingKeyboardEvent(e)) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const pairs = this.pairs;
  const { key, altKey, ctrlKey } = parseKeyboardEvent(e);
  const isValid = !ctrlKey && !altKey && isClosing(pairs, key);
  if (!isValid) {
    return;
  }
  const { short, long, dir, isReversed } = mtga.getState();
  if (short !== long) {
    return;
  }
  const currChar = el.value.charAt(short);
  if (currChar !== key) {
    return;
  }
  if (!getOpening(pairs, key)) {
    return;
  }
  e.preventDefault();
  mtga.setState({
    isReversed,
    short: short + 1,
    long: long + 1,
    dir
  });
};
var closePairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (isComposingKeyboardEvent(e)) {
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
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
};
var clearPairHandler = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  if (isComposingKeyboardEvent(e)) {
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
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "forward",
    value: newValue
  });
};
var onKeydown2 = function(e) {
  overtypeClosingHandler.call(this, e);
  closePairHandler.call(this, e);
  clearPairHandler.call(this, e);
};
var AutoPairModule = class _AutoPairModule extends MTGAModule {
  pairs;
  constructor(parent) {
    super(parent, _AutoPairModule.name);
    this.pairs = { ..._AutoPairModule.defaults.pairs };
  }
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
  onKeydown = onKeydown2;
};

// src/utils/state.ts
var getState = (el, withValue) => {
  const isReversed = el.selectionDirection === "backward";
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
var setState = (el, state) => {
  let isChanged = false;
  if (typeof state.value === "string") {
    if (el.value !== state.value) {
      el.value = state.value;
      isChanged = true;
    }
  }
  el.setSelectionRange(state.short, state.long, state.dir);
  el.focus();
  if (isChanged) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
};

// src/utils/row.ts
var getRows = (el) => {
  const { short, long } = getState(el);
  const arr = [];
  let startIndex = 0;
  for (const match of el.value.matchAll(/\r\n|\r|\n/g)) {
    const endIndex = match.index + match[0].length;
    arr.push(el.value.substring(startIndex, endIndex));
    startIndex = endIndex;
  }
  arr.push(el.value.substring(startIndex));
  const rows = [];
  let offset = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const isLastRow = i === arr.length - 1;
    const value = item;
    const startIndex2 = offset;
    const endIndex = startIndex2 + value.length;
    let selectionStart = -1, selectionEnd = -1, selectionValue = "";
    if (short >= startIndex2 && short < endIndex) {
      selectionStart = short - startIndex2;
    }
    if (long > startIndex2 && (!isLastRow ? long < endIndex : long <= endIndex)) {
      selectionEnd = long - startIndex2;
    }
    if (short <= startIndex2 && long >= endIndex) {
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
      startIndex: startIndex2,
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
var getLeadingWhitespace2 = (value) => value.match(/^[^\S\r\n]*/) ? value.match(/^[^\S\r\n]*/)[0] : "";
var escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var getCommentParts = (value, baseIndent) => {
  const base = value.startsWith(baseIndent) ? baseIndent : "";
  const rest = value.substring(base.length);
  return {
    base,
    rest
  };
};
var getSharedLeadingWhitespace = (values) => {
  const indents = values.filter((value) => value.trim()).map((value) => getLeadingWhitespace2(value));
  if (indents.length === 0) {
    return "";
  }
  const minSize = Math.min(...indents.map((indent) => indent.length));
  return indents.find((indent) => indent.length === minSize) || "";
};
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
  const targetRows = isIgnoreEmptyRows ? selectedRows.filter((r) => r.value.trim()) : selectedRows;
  const sharedLeadingWhitespace = getSharedLeadingWhitespace(targetRows.map((row) => row.value));
  const sharedCommentPattern = new RegExp(
    `^${escapeRegExp(sharedLeadingWhitespace)}${pattern.source}`
  );
  let shouldRemove = true;
  for (const r of targetRows) {
    if (!sharedCommentPattern.test(r.value)) {
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
        newValue = row.value.replace(sharedCommentPattern, sharedLeadingWhitespace);
      } else if (isIgnoreEmptyRows && selectedEmptyRows.some((r) => r.index === row.index)) {
        newValue = row.value;
      } else {
        const { base, rest } = getCommentParts(row.value, sharedLeadingWhitespace);
        newValue = `${base}${value}${rest}`;
      }
    } else {
      const rowLeadingWhitespace = getLeadingWhitespace2(row.value);
      const rowCommentPattern = new RegExp(
        `^${escapeRegExp(rowLeadingWhitespace)}${pattern.source}`
      );
      if (shouldRemove) {
        newValue = row.value.replace(rowCommentPattern, rowLeadingWhitespace);
      } else {
        const { base, rest } = getCommentParts(row.value, rowLeadingWhitespace);
        newValue = `${base}${value}${rest}`;
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
  mtga.setState(
    {
      isReversed,
      short: newShort,
      long: newLong,
      dir,
      value: newValues.join("")
    },
    false,
    true
  );
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
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValue
  });
};
var onKeydown3 = function(e) {
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
    pattern: /\/\/\s?/,
    value: "// "
  };
  onKeydown = onKeydown3;
};

// src/modules/history.ts
var onKeydown4 = function(e) {
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
    mtga.setState(h, false, false);
  }
};
var onKeyup2 = function(e) {
  const mtga = this.parent;
  const keydownState = mtga._keydownState;
  mtga._removeKeydownState();
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
  onKeydown = onKeydown4;
  onKeyup = onKeyup2;
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
  remove() {
    this.items.pop();
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

// src/modules/indent.ts
var onKeydown5 = function(e) {
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
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
};
var IndentModule = class _IndentModule extends MTGAModule {
  pattern;
  value;
  constructor(parent) {
    super(parent, _IndentModule.name);
    this.pattern = _IndentModule.defaults.pattern;
    this.value = _IndentModule.defaults.value;
  }
  onKeydown = onKeydown5;
  static name = "Indent";
  static defaults = {
    pattern: /^[^\S\n\r][^\S\n\r]?/,
    value: "  "
  };
};

// src/modules/line-break.ts
var onKeydown6 = function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const el = this.parent.element;
  const { pairs, indentUnit } = this;
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
  let newValue = newValues.join("");
  const left = newValue.substring(0, newShort);
  const leftRows = left.split(/\r\n|\r|\n/);
  const currIndent = getIndent(pairs, indentUnit, leftRows);
  newValue = newValue.substring(0, newShort) + currIndent + newValue.substring(newLong);
  newShort += currIndent.length;
  newLong += currIndent.length;
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value: newValue
  });
};
var LineBreakModule = class _LineBreakModule extends MTGAModule {
  pairs;
  indentUnit;
  constructor(parent) {
    super(parent, _LineBreakModule.name);
    this.pairs = _LineBreakModule.defaults.pairs;
    this.indentUnit = _LineBreakModule.defaults.indentUnit;
  }
  onKeydown = onKeydown6;
  static name = "LineBreak";
  static defaults = {
    pairs: {
      "(": ")",
      "[": "]",
      "{": "}"
    },
    indentUnit: "  "
  };
};

// src/modules/line-copy.ts
var onKeydown7 = async function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const MTGAClass = mtga.constructor;
  if (!MTGAClass.isClipboardWriteSupported()) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
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
  onKeydown = onKeydown7;
  static name = "LineCopy";
  static defaults = {};
};

// src/modules/line-cut.ts
var onKeydown8 = async function(e) {
  if (e.defaultPrevented) {
    return;
  }
  const mtga = this.parent;
  const MTGAClass = mtga.constructor;
  if (!MTGAClass.isClipboardWriteSupported()) {
    console.warn(`navigator.clipboard.writeText not found`);
    return;
  }
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
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value: newValues.join("")
  });
};
var LineCutModule = class _LineCutModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineCutModule.name);
  }
  onKeydown = onKeydown8;
  static name = "LineCut";
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
  mtga.setState({
    isReversed,
    short: newShort,
    long: newLong,
    dir,
    value: newValues.join("")
  });
};
var LinePasteModule = class _LinePasteModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LinePasteModule.name);
  }
  onPaste = onPaste;
  static name = "LinePaste";
  static defaults = {};
};

// src/modules/line-remove.ts
var onKeydown9 = function(e) {
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
  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    value
  });
};
var LineRemoveModule = class _LineRemoveModule extends MTGAModule {
  constructor(parent) {
    super(parent, _LineRemoveModule.name);
  }
  onKeydown = onKeydown9;
  static name = "LineRemove";
  static defaults = {};
};

// src/index.ts
var MTGAMap = /* @__PURE__ */ new WeakMap();
var MTGA = class _MTGA {
  element;
  modules;
  moduleOrder;
  _keydownState;
  _keydownEvent;
  _keyupEvent;
  _pasteEvent;
  _focusEvent;
  _blurEvent;
  _selectionEvent;
  static exists(el) {
    return !!_MTGA.getMTGA(el);
  }
  static getMTGA(el) {
    return MTGAMap.get(el);
  }
  static isNavigatorSupported() {
    return typeof navigator !== "undefined";
  }
  static isClipboardWriteSupported() {
    return _MTGA.isNavigatorSupported() && !!navigator.clipboard?.writeText;
  }
  static defaults = {
    eventListenerOptions: {
      capture: true,
      once: false,
      passive: false
    }
  };
  constructor(el) {
    if (_MTGA.exists(el)) {
      throw new Error("Already initialized");
    }
    MTGAMap.set(el, this);
    this.element = el;
    this.moduleOrder = [];
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
    this.setModuleOrder();
    this._keydownState = null;
    this._keydownEvent = async (e) => {
      for (const m of this.moduleOrder) {
        await m.onKeydown?.call(m, e);
      }
      if (e.defaultPrevented) {
        this._removeKeydownState();
      } else if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
        this._setKeydownState(e);
      }
    };
    this._keyupEvent = async (e) => {
      for (const m of this.moduleOrder) {
        await m.onKeyup?.call(m, e);
      }
    };
    this._pasteEvent = async (e) => {
      for (const m of this.moduleOrder) {
        await m.onPaste?.call(m, e);
      }
    };
    this._selectionEvent = (e) => {
      this.addHistory(false);
    };
    this._focusEvent = (e) => {
      setTimeout(() => {
        this.addHistory(false);
        this.element.addEventListener(
          "pointerup",
          this._selectionEvent,
          _MTGA.defaults.eventListenerOptions
        );
      }, 0);
    };
    this._blurEvent = (e) => {
      this.element.removeEventListener(
        "pointerup",
        this._selectionEvent,
        _MTGA.defaults.eventListenerOptions
      );
    };
    this.setEvents();
  }
  setEvents() {
    this.element.addEventListener(
      "keydown",
      this._keydownEvent,
      _MTGA.defaults.eventListenerOptions
    );
    this.element.addEventListener("keyup", this._keyupEvent, _MTGA.defaults.eventListenerOptions);
    this.element.addEventListener("paste", this._pasteEvent, _MTGA.defaults.eventListenerOptions);
    this.element.addEventListener("focus", this._focusEvent, _MTGA.defaults.eventListenerOptions);
    this.element.addEventListener("blur", this._blurEvent, _MTGA.defaults.eventListenerOptions);
  }
  removeEvents() {
    this.element.removeEventListener(
      "keydown",
      this._keydownEvent,
      _MTGA.defaults.eventListenerOptions
    );
    this.element.removeEventListener("keyup", this._keyupEvent, _MTGA.defaults.eventListenerOptions);
    this.element.removeEventListener("paste", this._pasteEvent, _MTGA.defaults.eventListenerOptions);
    this.element.removeEventListener("focus", this._focusEvent, _MTGA.defaults.eventListenerOptions);
    this.element.removeEventListener("blur", this._blurEvent, _MTGA.defaults.eventListenerOptions);
    this.element.removeEventListener(
      "pointerup",
      this._selectionEvent,
      _MTGA.defaults.eventListenerOptions
    );
  }
  destroy() {
    this.removeEvents();
    this.modules = {};
    this.moduleOrder = [];
    this._keydownState = null;
    MTGAMap.delete(this.element);
  }
  setModuleOrder() {
    this.moduleOrder = Object.values(this.modules).sort((a, b) => a.index - b.index);
  }
  getModule(name) {
    return this.modules[name];
  }
  setModule(module) {
    this.modules[module.name] = module;
    this.setModuleOrder();
  }
  removeModule(name) {
    if (this.modules[name]) {
      delete this.modules[name];
      this.setModuleOrder();
    }
  }
  getState(withValue) {
    return getState(this.element, withValue);
  }
  setState(state, beforeHistory = true, afterHistory = true) {
    if (beforeHistory) {
      this.addHistory();
    }
    setState(this.element, state);
    if (afterHistory) {
      this.addHistory();
    }
  }
  addHistory(withPrune = true) {
    this.getModule(HistoryModule.name)?.add(withPrune);
  }
  removeHistory() {
    this.getModule(HistoryModule.name)?.remove();
  }
  _setKeydownState(e) {
    this._keydownState = {
      value: this.element.value,
      state: getState(this.element),
      key: e.key
    };
  }
  _removeKeydownState() {
    this._keydownState = null;
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
//# sourceMappingURL=mtga.mjs.map
