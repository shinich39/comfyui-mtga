"use strict";

import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { MTGA } from "./libs/mtga.mjs";
// import getCaretCoordinates from "./libs/textarea-caret-position.js";

const Settings = {
  MaxVisibleItemCount: 10,
  MaxItemCount: 139,
  Timeout: 0,
  MinDanbooruCount: 39,
}
const Tags = [];

const COLOR1 = "#ddd";
const COLOR2 = "#333";

const listEl = document.createElement("div");
listEl.style.position = "absolute";
listEl.style.visibility = "hidden";
listEl.style.backgroundColor = COLOR2;
listEl.style.color = COLOR1;
listEl.style.borderTop = "1px solid";
listEl.style.borderLeft = "1px solid";
document.body.appendChild(listEl);

document.addEventListener("mousemove", (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  listEl.style.top = (mouseY + 12) + "px";
  listEl.style.left = (mouseX + 12) + "px";
})

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
  const mtga = new MTGA(elem);
  mtga.AutoPairing.pairs = {
    "{": "}",
    "(": ")",
  }

  const ac = mtga.AutoComplete;
  ac.timeout = app.extensionManager.setting.get('shinich39.MTGA.Timeout');
  ac.tags = Tags;

  const MAX_ITEM_COUNT = app.extensionManager.setting.get('shinich39.MTGA.MaxItemCount');
  const VISIBLE_COUNT = app.extensionManager.setting.get('shinich39.MTGA.MaxVisibleItemCount');

  let items = [],
      index = -1;

  const origParser = ac.parser;
  ac.parser = (el, stop) => {
    // console.log("parser", el);
    const r = origParser(el, stop);
    const text = r.body.toLowerCase();

    hide();

    if (text.length < 1 || text.length > 16) {
      stop();
      return r;
    }

    return r;
  }

  ac.filter = (req, i, candidates, stop) => {
    // console.log("filter", res);
    const { tag, parts } = req;
    const a = parts.body;
    const b = tag.key;

    if (ac.result.length >= MAX_ITEM_COUNT) {
      stop();
      return false;
    }

    if (a.startsWith("@")) {
      const { score } = ac.compare(a.substring(1), b);
      return tag.type === "artist" && score >= a.length - 1;
    }

    if (a.startsWith("#")) {
      const { score } = ac.compare(a.substring(1), b);
      return tag.type === "character" && score >= a.length - 1;
    }
    
    const { score } = ac.compare(a, b);
    return score >= a.length;

    // 100000 items, 5332ms
    // return score >= a.length;

    // 100000 items, 4529ms
    // return b.indexOf(a) > -1;
  }

  const load = () => {
    if (index === -1) {
      ac.reset();
    } else if (items[index]?.result) {
      ac.set(items[index].result);
    }
    
    render();
  }

  const render = () => {
    let min = Math.max(0, index - VISIBLE_COUNT / 2);
    const max = Math.min(items.length, min + VISIBLE_COUNT);
    if (max - min < VISIBLE_COUNT) {
      min = Math.max(0, max - VISIBLE_COUNT);
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
    index = -1;
  }

  const hide = () => {
    items = [];
    index = -1;
    listEl.innerHTML = "";
    listEl.style.visibility = "hidden";
  }

  const keydownHandler = (e) => {
    const { key } = e;
    if (isShown()) {
      switch(key) {
        case "ArrowUp":
          e.preventDefault();
          index = Math.max(-1, index - 1);
          load();
          break;
        case "ArrowDown":
          e.preventDefault();
          index = Math.min(items.length - 1, index + 1);
          load();
          break;
        case "Escape":
          e.preventDefault();
          index = -1;
          load();
          hide();
          break;
        case "Enter":
        // case "ArrowLeft":
        // case "ArrowRight":
          e.preventDefault();
          mtga.History.add();
          hide();
          break;
      }
    }
  }

  const onData = (chunks) => {
    // console.log("onData", chunks);

    // render items
    for (let i = 0; i < chunks.length; i++) {
      const idx = i;
      const res = chunks[i];
      const { tag, parts } = res;
      const { match } = ac.compare(parts.body, tag.key);
      const itemEl = document.createElement("div");
      itemEl.style.padding = "2px 4px";
      itemEl.style.borderRight = "1px solid " + COLOR1;
      itemEl.style.borderBottom = "1px solid " + COLOR1;

      let html = "";
      for (const [type, value] of match) {
        if (type === -1) {
          continue;
        }

        html += type === 0
          ? `<span style="background-color: yellow; color: black;">${value}</span>` 
          : `<span>${value}</span>`;
      }

      itemEl.innerHTML = html;
      itemEl.addEventListener("click", (e) => {
        e.preventDefault();
        index = idx;
        load();
      });

      items.push({
        result: res,
        element: itemEl,
      });

      listEl.appendChild(itemEl);
    }

    if (items.length > 0 && !isShown()) {
      show();
    }

    render();
  }

  ac.element.addEventListener("keydown", keydownHandler, true);
  ac.element.addEventListener("click", hide, true);
  ac.element.addEventListener("blur", hide, true);
  ac.onData = onData;
}

app.registerExtension({
	name: "shinich39.MTGA",
  settings: [
    {
      id: 'shinich39.MTGA.MaxVisibleItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxVisibleItemCount'],
      name: 'Max visible item count',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.MaxVisibleItemCount,
    },
    {
      id: 'shinich39.MTGA.MaxItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxItemCount'],
      name: 'Max item count',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.MaxItemCount,
    },
    {
      id: 'shinich39.MTGA.Timeout',
      category: ['MTGA', 'Typing is so boring', 'Timeout'],
      name: 'Timeout',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.Timeout,
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

          tags = tags
            .filter((arr) => {
              const [name, type, count] = arr;
              return count >= min;
            })
            .map((arr) => {
              const [name, type, count] = arr;
              return {
                key: name,
                value: name,
                type,
                count
              };
            })
            .sort((a, b) => b.count - a.count);

          console.log(`[shinich39-mtga] Tags filter with count >= ${min}: ${tags.length}`);

          Tags.push(...tags);
        });
        
    }, 1024);

  },
});