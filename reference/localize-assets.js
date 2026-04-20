const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const readline = require("readline");

function askInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().replace(/["']/g, ""));
    });
  });
}

function isExternal(url) {
  return /^https?:\/\//.test(url);
}

function getFileType(url) {
  if (/\.(png|jpg|jpeg|gif|webp|svg)/i.test(url)) return "images";
  if (/\.(css)/i.test(url)) return "styles";
  if (/\.(js|mjs)/i.test(url)) return "scripts";
  return "images";
}

/* =========================
   EXTRACTORS
========================= */

function extractCssUrls(html) {
  const regex = /url\(["']?(https?:\/\/[^"')]+)["']?\)/g;
  const urls = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

function extractJsImports(html) {
  const regex = /import\s+.*?from\s+["'](https?:\/\/[^"']+)["']/g;
  const urls = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

/* =========================
   DOWNLOAD
========================= */

async function downloadFile(url, folder) {
  fs.ensureDirSync(folder);

  const fileName = path.basename(url.split("?")[0]);
  const filePath = path.join(folder, fileName);

  if (fs.existsSync(filePath)) return filePath;

  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer"
    });

    fs.writeFileSync(filePath, res.data);
    console.log("Downloaded:", url);

    return filePath;
  } catch (err) {
    console.error("Fail:", url);
    return null;
  }
}

/* =========================
   PROCESS FILE
========================= */

async function processFile(filePath) {
  let html = fs.readFileSync(filePath, "utf-8");
  const $ = cheerio.load(html);

  const tasks = [];
  const allUrls = new Set();

  // 👉 assets root cạnh file HTML
  const baseDir = path.dirname(filePath);
  const assetRoot = path.join(baseDir, "assets");

  const assetDirs = {
    images: path.join(assetRoot, "images"),
    styles: path.join(assetRoot, "styles"),
    scripts: path.join(assetRoot, "scripts")
  };

  function addUrl(url) {
    if (url && isExternal(url)) {
      allUrls.add(url);
    }
  }

  function rewritePath(filePath) {
    return "./" + path.relative(baseDir, filePath).replace(/\\/g, "/");
  }

  async function handleDownload(url) {
    const type = getFileType(url);
    return await downloadFile(url, assetDirs[type]);
  }

  /* =========================
     COLLECT URL
  ========================= */

  $("img").each((_, el) => addUrl($(el).attr("src")));
  $("link").each((_, el) => addUrl($(el).attr("href")));
  $("script[src]").each((_, el) => addUrl($(el).attr("src")));

  extractCssUrls(html).forEach(addUrl);
  extractJsImports(html).forEach(addUrl);

  /* =========================
     DOWNLOAD + REWRITE
  ========================= */

  for (const url of allUrls) {
    tasks.push(
      (async () => {
        const file = await handleDownload(url);
        if (!file) return;

        const localPath = rewritePath(file);

        html = html.replaceAll(url, localPath);
      })()
    );
  }

  await Promise.all(tasks);

  /* =========================
     OUTPUT
  ========================= */

  const outFile = filePath.replace(/\.html$/, ".local.html");
  fs.writeFileSync(outFile, html);

  console.log("Done →", outFile);
}

/* =========================
   RUN
========================= */

async function run() {
  const input = await askInput("Nhập file hoặc thư mục cần xử lý: ");

  if (!fs.existsSync(input)) {
    console.log("Không tồn tại đường dẫn");
    return;
  }

  const stat = fs.statSync(input);

  if (stat.isFile()) {
    await processFile(input);
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(input)
      .filter(f => f.endsWith(".html"))
      .map(f => path.join(input, f));

    for (const f of files) {
      await processFile(f);
    }
  } else {
    console.log("Đường dẫn không hợp lệ");
  }
}

run();