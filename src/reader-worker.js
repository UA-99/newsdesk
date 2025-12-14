const { workerData, parentPort } = require("worker_threads");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

function parseArticle(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  return reader.parse();
}

(async () => {
  try {
    const article = parseArticle(workerData.html, workerData.url);
    parentPort.postMessage({ article });
  } catch (err) {
    parentPort.postMessage({ error: err?.message || String(err) });
  }
})();
