const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { generateIndex } = require("./generate-index.cjs");

const homeDir = process.env.HOME_DIR ?? __dirname;
const animationsDir = path.join(homeDir, "animations/");
const port = (process.env.PORT && parseInt(process.env.PORT)) ?? 8080;

let htmlText = "";
fs.watch(animationsDir, () => {
  htmlText = generateIndex();
});

const server = http.createServer((request, response) => {
  if (request.url === "/favicon.ico") {
    return;
  }

  if (!htmlText) {
    htmlText = generateIndex();
  }

  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(htmlText);
});

server.listen(port);
console.log(`Server listening on port ${port}`);
