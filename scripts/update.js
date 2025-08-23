import fs from "node:fs";

const files = {
  "./js/libs/mtga.mjs": "https://raw.githubusercontent.com/shinich39/mtga-js/refs/heads/main/dist/mtga.mjs",
  "./js/libs/mtga.min.mjs": "https://raw.githubusercontent.com/shinich39/mtga-js/refs/heads/main/dist/mtga.min.mjs",
}

for (const [ path, url ] of Object.entries(files)) {
  const res = await fetch(url);
  const data = await res.text();
  fs.writeFileSync(path, data, "utf8");
}