"use strict";

import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { BeautifyModule } from "./libs/beautify.js";
import { MTGA, AutoPairModule, AutoCompleteModule } from "./libs/mtga.mjs";

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
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/load`, {
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
  const ac = mtga.getModule(AutoCompleteModule.name);

  ac.tags = Tags;
  ac.indexes = Indexes;

  let items = [],
      index = 0;

  const origParser = ac.parser;
  ac.parser = function (el) {
    // console.log("parser", el);
    const r = origParser(el);
    r.body = r.body.toLowerCase().replace(/\s/g, "_");

    hide();

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
          el.style.color = "#FFF";
          el.style.backgroundColor = "#000"
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

  const hide = (kill) => {
    items = [];
    index = 0;
    listEl.innerHTML = "";
    listEl.style.visibility = "hidden";
    if (kill) {
      ac.stop(true);
    }
  }

  const keydownHandler = (e) => {
    const { key } = e;
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
          hide(true);
          break;
        case "Escape":
          e.preventDefault();
          hide(true);
          break;
        case "Enter":
          e.preventDefault();
          load();
          hide(true);
          break;
        default:
          if (e.defaultPrevented) {
            hide(true);
          }
      }
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
      const { match } = this.compare(query.body, tag.key);
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
  elem.addEventListener("click", () => hide(true));
  elem.addEventListener("blur", () => hide(true));
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

    // bugfix
    // don't interrupt workflow loading
    setTimeout(() => {

      getTags()
        .then(({ tags }) => {
          console.log(`[shinich39-mtga] Danbooru tags loaded successfully: ${tags.length}`);

          // [
          //   // [ NAME, TYPE, COUNT ],
          //   // [ string, "artist"|"character"|"copyright"|"general"|"meta", number ],
          //   // [ "landscape", "general", 1 ]
          //   ...
          // ]

          const min = app.extensionManager.setting.get('shinich39.MTGA.MinDanbooruCount');
          const suffix = app.extensionManager.setting.get('shinich39.MTGA.Suffix') || "";

          tags = tags
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

          console.log(`[shinich39-mtga] Tags filter with count >= ${min}: ${tags.length}`);

          Tags.push(...tags);

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
            } else if (!(ch === "@" || ch === "#")) {
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

          console.timeEnd("[shinich39-mtga] indexing...");
          console.log("[shinich39-mtga] indexing result:", Indexes);
        });
        
    }, 1024);

  },
});