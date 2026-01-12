"use strict";

import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { BeautifyModule } from "./libs/beautify.js";
import { getDiffs, matchStrings } from "./libs/diff.js";
import {
  MTGA, 
  AutoPairModule, 
  AutoCompleteModule, 
  LineBreakModule, 
  HistoryModule, 
  LineRemoveModule
} from "./libs/mtga.mjs?v=20251217"; // prevent load mgta-js cache like "./libs/mtga.mjs?v=2";

// import getCaretCoordinates from "./libs/textarea-caret-position.js";

AutoPairModule.defaults.pairs = {
  "{": "}",
  "(": ")",
}

AutoCompleteModule.defaults.parser = function(e) {
  const el = e.target;
  const parts = el.value.split(/[,.․‧・｡。{}()<>[\]\\/|]|\r\n|\r|\n/);
  const index = el.selectionStart;
  let selectionStart = 0, selectionEnd = 0;
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
  return {
    head,
    body,
    tail
  };
}

const Settings = {
  DanbooruTags: true,
  CivitaiTags: true,
  MaxVisibleItemCount: 11,
  MaxResultItemCount: 3939,
  MinUsedCount: 39,
  MaxTagLength: 39,
  Suffix: ",",
  ShowNumber: false,
  ShowCount: true,
  ShowCategory: false,
}

const eventMap = new WeakSet();

const Tags = [];
const Indexes = [];

const COLOR1 = "#ddd";
const COLOR2 = "#333";
const COLOR3 = "#ffff00";
const COLOR4 = "#00FF00";

const listEl = document.createElement("div");
listEl.style.position = "absolute";
listEl.style.visibility = "hidden";
listEl.style.backgroundColor = COLOR2;
listEl.style.color = COLOR1;
listEl.style.fontFamily = "monospace";
listEl.style.borderTop = "1px solid";
listEl.style.borderLeft = "1px solid";
document.body.appendChild(listEl);

let listHeaderEl;

document.addEventListener("mousemove", (e) => {
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  listEl.style.top = (mouseY + 12) + "px";
  listEl.style.left = (mouseX + 12) + "px";
});

async function getDanbooruTags() {
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/get-danbooru-tags`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return await response.json();
}

async function getCivitaiTags() {
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/get-civitai-tags`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return await response.json();
}

async function getLocalModels() {
  const response = await api.fetchApi(`/shinich39/comfyui-mtga/get-local-models`, {
    method: "GET",
    headers: { "Content-Type": "application/json", },
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return await response.json();
}

function init(elem) {
  if (MTGA.exists(elem)) {
    // console.warn("Already initialized");
    return;
  }

  elem.style.wordBreak = "break-all";

  const mtga = new MTGA(elem);
  // mtga.setModule(new BeautifyModule(mtga));
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

  // Remove line to Ctrl + K 
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
  ac.parser = function (e) {
    // console.log("parser", e);
    const r = origParser(e);

    hide(false);

    if (r.body.length < 1 || r.body.length > 39) {
      this.kill();
      return r;
    }

    // prevent auto-complete with backspace key if it is not the last character.
    const el = e.target;
    const isBackspace = e.key.toLowerCase() === "backspace";
    const isLastChar = el.selectionStart === r.head.length + r.body.length;
    if (isBackspace && !isLastChar) {
      this.kill();
      return r;
    }

    // r.body = r.body.toLowerCase().replace(/\s/g, "_");
    r.body = r.body.replace(/\s/g, "_");

    return r;
  }

  ac.filter = function (query, tag, i, tags) {
    // console.log("filter", query, tag);
    const result = this.result;
    const a = query.body;
    const b = tag.key;

    if (result.length >= Settings.MaxResultItemCount) {
      this.stop();
      return false;
    }

    if (a.startsWith("@")) {
      const { matches } = matchStrings(a.substring(1), b);
      return matches >= a.length - 1;
    }

    if (a.startsWith("#")) {
      const { matches } = matchStrings(a.substring(1), b);
      return matches >= a.length - 1;
    }

    if (a.startsWith("$$$")) {
      const { matches } = matchStrings(a.substring(3), b);
      return matches >= a.length - 3;
    }

    if (a.startsWith("$$")) {
      const { matches } = matchStrings(a.substring(2), b);
      return matches >= a.length - 2;
    }

    if (a.startsWith("$")) {
      const { matches } = matchStrings(a.substring(1), b);
      return matches >= a.length - 1;
    }

    const { matches } = matchStrings(a, b);
    return matches >= a.length;

    // 100000 items, 5332ms
    // return matches >= a.length;

    // 100000 items, 4529ms
    // return b.indexOf(a) > -1;
  }

  const load = () => {
    const tag = items[index]?.tag;
    if (tag && ac.query) {
      // remove double commas
      ac.query.tail = ac.query.tail.replace(/^,/, "");
      ac.set(tag);
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
          el.style.color = COLOR4;
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

    // create a new header
    listHeaderEl = document.createElement("div");
    listHeaderEl.style.padding = "2px 4px";
    listHeaderEl.style.borderRight = "1px solid " + COLOR1;
    listHeaderEl.style.borderBottom = "1px solid " + COLOR1;
    listHeaderEl.style.color = COLOR3;
    listEl.appendChild(listHeaderEl);

    if (kill) {
      ac.kill();
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

  const onData = function (chunks) {
    // if (chunks.length) {
    //   console.log("onData", chunks);
    // }

    const result = this.result;
    const query = this.query;

    // write header
    listHeaderEl.innerHTML = `Searching ${result.length} tags...`;

    // render items
    for (let i = 0; i < chunks.length; i++) {
      const idx = i + 1;
      const tag = chunks[i];
      const diffs = (query.body.startsWith("$") || query.body.startsWith("$$") || query.body.startsWith("$$$"))
        ? getDiffs(query.body.replace(/^\$+/, ""), tag.key)
        : getDiffs(query.body, tag.key);

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

      for (const [type, value] of diffs) {
        if (type === -1) {
          continue;
        }

        html += type === 0
          ? `<span style="background-color: ${COLOR3}; color: black;">${value}</span>` 
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
        tag,
        element: itemEl,
      });

      listEl.appendChild(itemEl);
    }

    if (items.length > 0 && !isShown()) {
      show();
    }

    render();
  }

  const onEnd = function() {
    const result = this.result;
    const query = this.query;
    listHeaderEl.innerHTML = `${result.length} tags found.`;
  }

  elem.addEventListener("keydown", keydownHandler);
  elem.addEventListener("click", () => hide());
  elem.addEventListener("blur", () => hide());
  ac.onData = onData;
  ac.onEnd = onEnd;
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
      onChange: (v) => {
        Settings.Suffix = v;
      }
    },
    {
      id: 'shinich39.MTGA.MaxVisibleItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxVisibleItemCount'],
      name: 'Max visible item count',
      type: 'number',
      defaultValue: Settings.MaxVisibleItemCount,
      onChange: (v) => {
        Settings.MaxVisibleItemCount = v;
      }
    },
    {
      id: 'shinich39.MTGA.MaxResultItemCount',
      category: ['MTGA', 'Typing is so boring', 'MaxResultItemCount'],
      name: 'Max result count',
      type: 'number',
      defaultValue: Settings.MaxResultItemCount,
      onChange: (v) => {
        Settings.MaxResultItemCount = v;
      }
    },
    {
      id: 'shinich39.MTGA.MinUsedCount',
      category: ['MTGA', 'Typing is so boring', 'MinUsedCount'],
      name: 'Min used count',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.MinUsedCount,
      onChange: (v) => {
        Settings.MinUsedCount = v;
      }
    },
    {
      id: 'shinich39.MTGA.MaxTagLength',
      category: ['MTGA', 'Typing is so boring', 'MaxTagLength'],
      name: 'Max tag length',
      type: 'number',
      tooltip: 'Refresh required',
      defaultValue: Settings.MaxTagLength,
      onChange: (v) => {
        Settings.MaxTagLength = v;
      }
    },
    {
      id: 'shinich39.MTGA.CivitaiTags',
      category: ['MTGA', 'Typing is so boring', 'CivitaiTags'],
      name: 'Enable civitai tags',
      type: 'boolean',
      tooltip: 'Refresh required',
      defaultValue: Settings.CivitaiTags,
      onChange: (v) => {
        Settings.CivitaiTags = v;
      }
    },
    {
      id: 'shinich39.MTGA.DanbooruTags',
      category: ['MTGA', 'Typing is so boring', 'DanbooruTags'],
      name: 'Enable danbooru tags',
      type: 'boolean',
      tooltip: 'Refresh required',
      defaultValue: Settings.DanbooruTags,
      onChange: (v) => {
        Settings.DanbooruTags = v;
      }
    },
  ],
  init() {
    // Nodes 1.0
    if (ComfyWidgets.STRING) {
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
    }
    
    // Nodes 2.0
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const nodeEl of mutation.addedNodes) {
          try {
            if (!nodeEl.getAttribute) {
              continue;
            }

            // const nodeType = nodeEl.getAttribute("node-type");
            const nodeId = nodeEl.getAttribute("node-id");
            const node = app.graph.getNodeById(nodeId);

            if (!node) {
              continue;
            }

            for (const el of nodeEl.children) {
              if (el.tagName !== "TEXTAREA") {
                continue;
              }

              if (eventMap.has(el)) {
                continue;
              }

              eventMap.add(el);

              init(el);
            }
          } catch(err) {
            console.error(err);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
	},
  setup() {
    // bugfix: don't interrupt workflow loading
    setTimeout(async () => {
      try {
        const minUsedCount = app.extensionManager.setting.get('shinich39.MTGA.MinUsedCount');
        const maxTagLength = app.extensionManager.setting.get('shinich39.MTGA.MaxTagLength');
        const suffix = app.extensionManager.setting.get('shinich39.MTGA.Suffix') ?? "";
        const enableDanbooruTags = app.extensionManager.setting.get('shinich39.MTGA.DanbooruTags') || false;
        const enableCivitaiTags = app.extensionManager.setting.get('shinich39.MTGA.CivitaiTags') || false;

        let danbooruTags = [];
        let civitaiTags = [];

        if (enableDanbooruTags) {
          try {
            danbooruTags = (await getDanbooruTags())?.tags || [];
            console.log(`[shinich39-mtga] Danbooru tags loaded successfully: ${danbooruTags.length}`);
          } catch(err) {
            console.log(`[shinich39-mtga] Failed to load danbooru tags: ${err.message}`);
          }
        }

        if (enableCivitaiTags) {
          try {
            civitaiTags = (await getCivitaiTags())?.tags || [];
            console.log(`[shinich39-mtga] Civitai tags loaded successfully: ${civitaiTags.length}`);
          } catch(err) {
            console.log(`[shinich39-mtga] Failed to load civitai tags: ${err.message}`);
          }
        }

        // [
        //   // [ NAME, TYPE, COUNT ],
        //   // [ string, "artist"|"character"|"copyright"|"general"|"meta", number ],
        //   // [ "landscape", "general", 1 ]
        //   ...
        // ]


        // key, { key, value, type, count }
        const tagMap = new Map();

        // Add danbooru tags
        for (const tag of danbooruTags) {
          if (!Array.isArray(tag)) {
            continue;
          }

          const [name, type, count] = tag;

          if (typeof name !== "string" || typeof type !== "string" || typeof count !== "number") {
            continue;
          }

          if (count < minUsedCount) {
            continue;
          }

          const key = name.toLowerCase().trim().replace(/\s/g, "_");

          if (!key) {
            continue;
          }

          if (maxTagLength && key.length > maxTagLength) {
            continue;
          }

          const newTag = {
            key,
            value: name + suffix,
            type,
            count
          }

          if (tagMap.has(newTag.key)) {
            tagMap.get(newTag.key).count += newTag.count;
          } else {
            tagMap.set(newTag.key, newTag);
          }
        }

        for (const tag of civitaiTags) {
          if (typeof tag !== "object" || typeof tag.value !== "string" || typeof tag.count !== "number") {
            continue;
          }

          const { value, count } = tag;

          // Skip lora
          if (value.startsWith("<")) {
            continue;
          }

          if (count < minUsedCount) {
            continue;
          }

          const key = value.toLowerCase().trim().replace(/\s/g, "_");

          if (!key) {
            continue;
          }

          if (maxTagLength && key.length > maxTagLength) {
            continue;
          }

          const newTag = {
            key,
            value: key + suffix,
            type: "general",
            count,
          }

          if (tagMap.has(newTag.key)) {
            tagMap.get(newTag.key).count += newTag.count;
          } else {
            tagMap.set(newTag.key, newTag);
          }
        }

        const convertedTags = [...tagMap.values()].sort((a, b) => b.count - a.count);

        console.log(`[shinich39-mtga] Filtered tags: ${convertedTags.length}`);

        Tags.push(...convertedTags);

        console.time("[shinich39-mtga] Indexing...");

        // type indexing

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
          }

          if (type === "artist") {
            Indexes[0].tags.push(tag);
          } else if (type === "character") {
            Indexes[1].tags.push(tag);
          }
        }

        // character indexing

        const alphabets = 'abcdefghijklmnopqrstuvwxyz'.split('');

        for (const ch of alphabets) {
          Indexes.push({
            pattern: new RegExp("^" + ch),
            tags: Tags.filter((t) => t.key.indexOf(ch) > -1),
          });
        }

        // local model indexing

        try {
          const models = await getLocalModels();
          
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

        console.timeEnd("[shinich39-mtga] Indexing...");

        console.log("[shinich39-mtga] Indexing result:", Indexes);
      } catch(err) {
        console.error(err);
      }
    }, 1024);
  },
});