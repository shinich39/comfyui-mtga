"use strict";

import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { BeautifyModule } from "./libs/beautify.js";
import { MTGA, AutoPairModule, AutoCompleteModule, LineBreakModule, HistoryModule, LineRemoveModule } from "./libs/mtga.mjs";
// prevent load mgta-js cache
// import { MTGA, AutoPairModule, AutoCompleteModule, LineBreakModule, HistoryModule, LineRemoveModule } from "./libs/mtga.mjs?v=1";

// import getCaretCoordinates from "./libs/textarea-caret-position.js";

AutoPairModule.defaults.pairs = {
  "{": "}",
  "(": ")",
}

const Settings = {
  MaxVisibleItemCount: 11,
  MaxItemCount: 3939,
  MinDanbooruCount: 39,
  Suffix: ",",
  StartsWithFirstCharacter: false,
  ShowNumber: false,
  ShowCount: true,
  ShowCategory: false,
}

const Tags = [];
const Indexes = [];

const COLOR1 = "#ddd";
const COLOR2 = "#333";

const listEl = document.createElement("div");
listEl.style.position = "absolute";
listEl.style.visibility = "hidden";
listEl.style.backgroundColor = COLOR2;
listEl.style.color = COLOR1;
listEl.style.fontFamily = "monospace";
listEl.style.borderTop = "1px solid";
listEl.style.borderLeft = "1px solid";
document.body.appendChild(listEl);

document.addEventListener("mousemove", (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  listEl.style.top = (mouseY + 12) + "px";
  listEl.style.left = (mouseX + 12) + "px";
});

async function getTags() {
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/get-tags`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return await response.json();
}

async function getModels() {
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/get-models`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return await response.json();
}

function init(elem) {
  elem.style.wordBreak = "break-all";

  const mtga = new MTGA(elem);
  mtga.setModule(new BeautifyModule(mtga));
  const his = mtga.getModule(HistoryModule.name);
  const ac = mtga.getModule(AutoCompleteModule.name);
  const lb = mtga.getModule(LineBreakModule.name);
  const lr = mtga.getModule(LineRemoveModule.name);

  ;(() => {
    const origKeydown = lb.onKeydown;
    lb.onKeydown = function(e) {
      const defaultPrevented = e.defaultPrevented;
      const r = origKeydown.call(this, (e));
      if (!defaultPrevented && e.defaultPrevented) {
        e.stopPropagation(); // prevent ComfyUI RUN
      }
      return r;
    }
  })();

  ;(() => {
    const origKeydown = lr.onKeydown;
    lr.onKeydown = function(e) {
      const r = origKeydown.call(this, (e));

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        // prevent ComfyUI shortcut
        e.preventDefault();
        e.stopPropagation(); 
      }

      return r;
    }
  })();

  ac.tags = Tags;
  ac.indexes = Indexes;

  let items = [],
      index = 0;

  const origParser = ac.parser;
  ac.parser = function (el) {
    // console.log("parser", el);
    const r = origParser(el);
    // r.body = r.body.toLowerCase().replace(/\s/g, "_");
    r.body = r.body.replace(/\s/g, "_");

    hide(false);

    if (r.body.length < 1 || r.body.length > 39) {
      this.stop(true);
      return r;
    }

    return r;
  }

  ac.filter = function (chunk, result, i, candidates) {
    // console.log("filter", chunk);
    const { tag, query } = chunk;
    const a = query.body;
    const b = tag.key;

    if (result.length >= Settings.MaxItemCount) {
      this.stop(true);
      return false;
    }

    if (a.startsWith("@")) {
      const { score } = ac.compare(a.substring(1), b);
      return score >= a.length - 1;
    }

    if (a.startsWith("#")) {
      const { score } = ac.compare(a.substring(1), b);
      return score >= a.length - 1;
    }

    if (a.startsWith("$$$")) {
      const { score } = ac.compare(a.substring(3), b);
      return score >= a.length - 3;
    }

    if (a.startsWith("$$")) {
      const { score } = ac.compare(a.substring(2), b);
      return score >= a.length - 2;
    }

    if (a.startsWith("$")) {
      const { score } = ac.compare(a.substring(1), b);
      return score >= a.length - 1;
    }

    const { score } = ac.compare(a, b);
    
    return score >= a.length;

    // 100000 items, 5332ms
    // return score >= a.length;

    // 100000 items, 4529ms
    // return b.indexOf(a) > -1;
  }

  const load = () => {
    const chunk = items[index]?.chunk;
    if (chunk) {
      // remove double commas
      chunk.query.tail = chunk.query.tail.replace(/^,/, "");
      ac.set(chunk);
    }
  }

  const render = () => {
    let min = Math.max(0, index - Settings.MaxVisibleItemCount / 2);
    const max = Math.min(items.length, min + Settings.MaxVisibleItemCount);
    if (max - min < Settings.MaxVisibleItemCount) {
      min = Math.max(0, max - Settings.MaxVisibleItemCount);
    }

    for (let i = 0; i < items.length; i++) {
      const el = items[i].element;
      el.style.color = "";
      el.style.backgroundColor = "";
      if (i >= min && i < max) {
        el.style.display = "";
        if (i === index) {
          el.style.color = "#00FF00";
          el.style.backgroundColor = "#000";
        }
      } else {
        el.style.display = "none";
      }
    }
  }

  const isShown = () => {
    return listEl.style.visibility === "";
  }
  
  const show = () => {
    if (!isShown()) {
      // const caretPosition = getCaretCoordinates(mtga.element, mtga.element.selectionEnd);
      // const taRect = mtga.element.getBoundingClientRect();
      // const listRect = listEl.getBoundingClientRect();
      // listEl.style.visibility = "";
      // listEl.style.zIndex = 3939;
      // listEl.style.top = (taRect.top + caretPosition.top + 18) + "px";
      // listEl.style.left = Math.min(
      //   taRect.left + document.documentElement.clientWidth - listRect.width, 
      //   taRect.left + caretPosition.left - 11,
      // ) + "px";

      listEl.style.visibility = "";
      listEl.style.zIndex = 3939;
    }
  }

  const hide = (kill = true) => {
    items = [];
    index = 0;
    listEl.innerHTML = "";
    listEl.style.visibility = "hidden";
    if (kill) {
      ac.stop(true);
    }
  }

  const keydownHandler = (e) => {
    const { key, ctrlKey, metaKey, } = e;
    if (isShown()) {
      switch(key) {
        case "ArrowUp":
          e.preventDefault();
          if (index > 0) {
            index = Math.max(-1, index - 1);
          } else {
            index = items.length - 1;
          }
          render();
          break;
        case "ArrowDown":
          e.preventDefault();
          if (index < items.length - 1) {
            index = Math.min(items.length - 1, index + 1);
          } else {
            index = 0;
          }
          render();
          break;
        case "ArrowLeft":
        case "ArrowRight":
          hide();
          break;
        case "Escape":
          e.preventDefault();
          hide();
          break;
        case "Enter":
          e.preventDefault();
          load();
          his.items.splice(his.items.length - 2, 1); // bugfix: remove linebreak history
          hide();
          break;
        default:
          if (e.defaultPrevented) {
            hide();
          }
      }
    } else if ((ctrlKey || metaKey) && (key === "ArrowUp" || key === "ArrowDown")) {
      // from mtga default parser
      const el = e.target;
      const parts = el.value.split(/[,{}|/]|\r\n|\r|\n/);
      const index = el.selectionStart;

      let selectionStart = 0,
          selectionEnd = 0;

      for (const part of parts) {
        selectionEnd = selectionStart + part.length;
        if (index >= selectionStart && index <= selectionEnd) {
          break;
        }
        selectionStart = selectionEnd + 1;
      }

      let head = el.value.substring(0, selectionStart), 
          body = el.value.substring(selectionStart, selectionEnd),
          tail = el.value.substring(selectionEnd);

      const match = body.match(/^(\s*)(.*?)(\s*)$/);

      if (match) {
        head = head + (match[1] || "");
        body = match[2];
        tail = (match[3] || "") + tail;
      }

      if (!body) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (body.startsWith("(") && body.endsWith(")")) {
        body = body.substring(1, body.length - 1);
      }

      let weight = 10;

      const weightMatch = body.match(/:(\d+(?:\.\d+)?)$/);

      if (weightMatch) {
        body = body.replace(weightMatch[0], "");
        weight = parseFloat(weightMatch[1]) * 10;
      }

      switch(key) {
        case "ArrowUp": weight = weight + 1; break;
        case "ArrowDown": weight = weight - 1; break;
      }

      weight = (weight / 10).toString(10);

      if (weight !== "1") {
        body = `(${body}:${weight})`;
      }

      const short = head.length;
      const long = head.length + body.length;

      mtga.setState({
        short,
        long,
        value: head + body + tail,
      });
    }
  }

  const onData = function (chunks, result) {
    // if (chunks.length) {
    //   console.log("onData", chunks, result);
    // }

    // render items
    for (let i = 0; i < chunks.length; i++) {
      const idx = i + 1;
      const chunk = chunks[i];
      const { tag, query } = chunk;
      const { match } = (query.body.startsWith("$") || query.body.startsWith("$$") || query.body.startsWith("$$$"))
        ? this.compare(query.body.replace(/^\$+/, ""), tag.key)
        : this.compare(query.body, tag.key);

      const itemEl = document.createElement("div");
      itemEl.style.padding = "2px 4px";
      itemEl.style.borderRight = "1px solid " + COLOR1;
      itemEl.style.borderBottom = "1px solid " + COLOR1;

      let html = ""
      
      if (Settings.ShowNumber) {
        html += `[${idx}]`;
      }

      if (Settings.ShowCategory) {
        html += `[${tag.type}]`;
      }

      if (html) {
        html += " ";
      }

      for (const [type, value] of match) {
        if (type === -1) {
          continue;
        }

        html += type === 0
          ? `<span style="background-color: yellow; color: black;">${value}</span>` 
          : `<span>${value}</span>`;
      }

      if (Settings.ShowCount) {
        html += ` (${tag.count})`;
      }

      itemEl.innerHTML = html;
      // itemEl.addEventListener("click", (e) => {
      //   e.preventDefault();
      //   index = idx;
      //   render();
      // });

      items.push({
        chunk,
        element: itemEl,
      });

      listEl.appendChild(itemEl);
    }

    if (items.length > 0 && !isShown()) {
      show();
    }

    render();
  }

  elem.addEventListener("keydown", keydownHandler);
  elem.addEventListener("click", () => hide());
  elem.addEventListener("blur", () => hide());
  ac.onData = onData;
}

app.registerExtension({
	name: "shinich39.MTGA",
  settings: [
    {
      id: 'shinich39.MTGA.ShowCount',
      category: ['MTGA', 'Typing is so boring', 'ShowCount'],
      name: 'Show count',
      type: 'boolean',
      defaultValue: Settings.ShowCount,
      onChange: (v) => {
        Settings.ShowCount = v;
      }
    },
    {
      id: 'shinich39.MTGA.ShowCategory',
      category: ['MTGA', 'Typing is so boring', 'ShowCategory'],
      name: 'Show category',
      type: 'boolean',
      defaultValue: Settings.ShowCategory,
      onChange: (v) => {
        Settings.ShowCategory = v;
      }
    },
    {
      id: 'shinich39.MTGA.ShowNumber',
      category: ['MTGA', 'Typing is so boring', 'ShowNumber'],
      name: 'Show number',
      type: 'boolean',
      defaultValue: Settings.ShowNumber,
      onChange: (v) => {
        Settings.ShowNumber = v;
      }
    },
    {
      id: 'shinich39.MTGA.StartsWithFirstCharacter',
      category: ['MTGA', 'Typing is so boring', 'StartsWithFirstCharacter'],
      name: 'Starts with first character',
      type: 'boolean',
      tooltip: 'Starts with first character, refresh required',
      defaultValue: Settings.StartsWithFirstCharacter,
    },
    {
      id: 'shinich39.MTGA.Suffix',
      category: ['MTGA', 'Typing is so boring', 'Suffix'],
      name: 'Suffix',
      type: 'string',
      tooltip: 'Refresh required',
      defaultValue: Settings.Suffix,
    },
    {
      id: 'shinich39.MTGA.MaxVisibleItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxVisibleItemCount'],
      name: 'Max visible item count',
      type: 'number',
      defaultValue: Settings.MaxVisibleItemCount,
    },
    {
      id: 'shinich39.MTGA.MaxItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxItemCount'],
      name: 'Max item count',
      type: 'number',
      defaultValue: Settings.MaxItemCount,
    },
    {
      id: 'shinich39.MTGA.MinDanbooruCount',
      category: ['MTGA', 'Typing is so boring', 'MinDanbooruCount'],
      name: 'Min danbooru count',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.MinDanbooruCount,
    },
  ],
  init() {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData) {
      const r = STRING.apply(this, arguments);

      if (!inputData[1]?.multiline) {
        return r;
      }
      
      if (!r.widget?.element) {
        return r;
      }
    
      const elem = r.widget.element;

      init(elem);

      return r;
    };
	},
  setup() {

    // bugfix: don't interrupt workflow loading
    setTimeout(async () => {
      try {
        const loadedTags = (await getTags())?.tags || [];

        console.log(`[shinich39-mtga] Danbooru tags loaded successfully: ${loadedTags.length}`);

        // [
        //   // [ NAME, TYPE, COUNT ],
        //   // [ string, "artist"|"character"|"copyright"|"general"|"meta", number ],
        //   // [ "landscape", "general", 1 ]
        //   ...
        // ]

        const min = app.extensionManager.setting.get('shinich39.MTGA.MinDanbooruCount') || Settings.MinDanbooruCount;
        const suffix = app.extensionManager.setting.get('shinich39.MTGA.Suffix') || "";
        const matchFirstChar = app.extensionManager.setting.get('shinich39.MTGA.StartsWithFirstCharacter');

        const convertedTags = loadedTags
          .filter((arr) => {
            const [name, type, count] = arr;
            return count >= min;
          })
          .map((arr) => {
            const [name, type, count] = arr;
            return {
              key: name,
              value: name + suffix,
              type,
              count
            };
          })
          .sort((a, b) => b.count - a.count);

        console.log(`[shinich39-mtga] Tags filter with count >= ${min}: ${convertedTags.length}`);

        Tags.push(...convertedTags);

        console.time("[shinich39-mtga] indexing...");

        Indexes.push({
          pattern: new RegExp("^@"),
          tags: [],
        }, {
          pattern: new RegExp("^#"),
          tags: [],
        });

        for (const tag of Tags) {
          const key = tag.key;
          const ch = tag.key[0];
          const type = tag.type;

          let escaped = ch;
          
          if (".^$*+?()[]{}|\\".includes(ch)) {
            escaped = "\\" + escaped;
          }

          const found = Indexes.find(({ pattern }) => 
            pattern.test(key));

          if (found) {
            found.tags.push(tag);
          } // starts with first character
          else if (matchFirstChar && !(ch === "@" || ch === "#")) {
            Indexes.push({
              pattern: new RegExp("^"+escaped),
              tags: [tag],
            });
          }

          if (type === "artist") {
            Indexes[0].tags.push(tag);
          } else if (type === "character") {
            Indexes[1].tags.push(tag);
          }

          // if (type === "artist" || type === "character") {
          //   const prefix = type === "artist" ? "@" : "#";

          //   const found = Indexes.find(({ pattern }) => 
          //     pattern.test(prefix+key));

          //   if (found) {
          //     found.tags.push(tag);
          //   } else if (!(ch === "@" || ch === "#")) {
          //     Indexes.push({
          //       pattern: new RegExp("^"+prefix+escaped),
          //       tags: [tag],
          //     });
          //   }
          // }
        }

        // let models = {
        //   "checkpoints": [],
        //   "clips": [],
        //   "loras": [],
        //   "vaes": [],
        //   "embeddings": [],
        // }

        try {
          const models = await getModels();
          
          console.log(`[shinich39-mtga] ComfyUI models loaded successfully:\n`, models);

          const convertedCheckpoints = models.checkpoints.map((e) => {
            const filename = e.replace(/[\\\/]/g, "/").split("/").pop() || "ERROR";
            return {
              key: e,
              value: `<checkpoint:${filename}:1.0>`,
              type: "",
              count: 0,
            }
          });

          const convertedLoras = models.loras.map((e) => {
            const filename = e.replace(/[\\\/]/g, "/").split("/").pop() || "ERROR";
            return {
              key: e,
              value: `<lora:${filename}:1.0>`,
              type: "",
              count: 0,
            }
          });

          const convertedEmbeddings = models.embeddings.map((e) => {
            const filename = e.replace(/[\\\/]/g, "/").split("/").pop() || "ERROR";
            return {
              key: e,
              value: `<embedding:${filename}:1.0>`,
              type: "",
              count: 0,
            }
          });
          
          Indexes.push({
            pattern: new RegExp("^\\$\\$\\$"),
            tags: convertedCheckpoints,
          }, {
            pattern: new RegExp("^\\$\\$"),
            tags: convertedLoras,
          }, {
            pattern: new RegExp("^\\$"),
            tags: convertedEmbeddings,
          });
        } catch(err) {
          console.error(err);
        }

        console.timeEnd("[shinich39-mtga] indexing...");
        console.log("[shinich39-mtga] indexing result:", Indexes);
      } catch(err) {
        console.error(err);
      }
    }, 1024);
  },
});