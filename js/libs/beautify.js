import { MTGAModule } from "./mtga.min.mjs";

const onKeydown = function(e) {
  if (e.defaultPrevented) {
    return;
  }

  const { key, altKey, shiftKey } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;

  const isValid = ctrlKey && !altKey && key.toLowerCase() === "b";
  if (!isValid) {
    return;
  }

  e.preventDefault();

  const mtga = this.parent;
  const el = mtga.element;
  const { indentUnit, pairs, breakers } = this;
  const { short, long, dir, isReversed } = mtga.getState();

  const openingsChars = Object.keys(pairs);
  const closingChars = Object.values(pairs);
  const isOpening = (ch) => openingsChars.includes(ch);
  const isClosing = (ch) => closingChars.includes(ch);
  const getOpening = (ch) => Object.entries(pairs).find((e) => e[1] === ch)[0];
  const getClosing = (ch) => pairs[ch];

  let newShort = 0,
      newLong = 0;

  let src = el.value
    .replace(/\r\n|\r/g, "\n") // normalize
    .trim();

  let res = "",
      depth = 0,
      i = 0;

  const emit = (str = "") => {
    res += str;
  }

  const skipSingleLineComment = () => {
    while(i < src.length && src[i] !== "\n") {
      i++;
    }
  }

  const skipMultiLineComment = () => {
    while(i < src.length && !(src[i] === "/" && src[i - 1] === "*")) {
      i++;
    }
    i = Math.min(i + 1, src.length);
  }

  const skipSpaces = () => {
    while(i < src.length && /\s/.test(src[i])) {
      i++;
    }
  }

  const trim = () => {
    res = res.trim();
  }

  while (i < src.length) {
    const ch = src[i];

    if (ch === "\n") {
      emit("\n" + indentUnit.repeat(depth));
      i++;
      continue;
    }

    if (breakers.includes(ch)) {
      trim();
      if (!shiftKey && !breakers.includes(res[res.length - 1])) {
        emit(ch + "\n" + indentUnit.repeat(depth));
      } else {
        emit(ch);
      }
      i++;
      skipSpaces();
      continue;
    }

    if (ch === "\\") {
      let j = i;
      i+=2;
      emit(src.substring(j, i));
      continue;
    }

    if (ch === "/" && src[i + 1] === "/") {
      let j = i;
      i++;
      skipSingleLineComment();
      emit(src.substring(j, i));
      continue;
    }

    if (ch === "/" && src[i + 1] === "*") {
      let j = i;
      i++;
      skipMultiLineComment();
      emit(src.substring(j, i));
      continue;
    }

    if (isOpening(ch)) {
      depth++;
      if (!shiftKey) {
        emit(ch + "\n" + indentUnit.repeat(depth));
      } else {
        emit(ch);
      }
      i++;
      skipSpaces();
      continue;
    }

    if (isClosing(ch)) {
      trim();
      depth--;
      if (!shiftKey && !/\n\s*?$/.test(res)) {
        emit("\n" + indentUnit.repeat(depth) + ch);
      } else {
        emit(ch);
      }
      i++;
      // skipSpaces();
      continue;
    }

    emit(ch);
    i++;
  }

  mtga.setState({
    isReversed: false,
    short: newShort,
    long: newLong,
    dir: "none",
    value: res,
  });

  mtga.addHistory();
}

export class BeautifyModule extends MTGAModule {
  constructor(parent) {
    super(parent, BeautifyModule.name);
    this.indentUnit = BeautifyModule.defaults.indentUnit;
    this.pairs = BeautifyModule.defaults.pairs;
    this.breakers = BeautifyModule.defaults.breakers;
  }

  onKeydown = onKeydown;

  static name = "Beautify";

  static defaults = {
    indentUnit: "  ",
    pairs: {
      "{": "}",
      // "[": "]",
      // "(": ")",
    },
    breakers: [
      "|",
      // ","
    ],
  };
}