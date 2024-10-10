const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ejs = require("ejs");

const homeDir = process.env.HOME_DIR || __dirname;
const port = process.env.PORT || 8080;

const templatePath = path.join(homeDir, "template.ejs");
const animationsDir = path.join(homeDir, "animations/");

function generateHtmlText() {
  const template = ejs.compile(fs.readFileSync(templatePath).toString());

  const animations = fs.readdirSync(animationsDir).map((file) => {
    const fileText = fs.readFileSync(path.join(animationsDir, file)).toString().replace(/\r/g, "");

    const name = /^(.*)\./.exec(file)[1];
    const style = /<style.*?<\/style>/is.exec(fileText)[0];
    const div = /<div.*<\/div>/is.exec(fileText)[0];
    const source = fileText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .split("\n")
      .map((line) => `<code>${line}</code>`)
      .join("\n");

    return { name, style, div, source };
  });

  return template({ animations });
}

let htmlText = "";
fs.watch(homeDir, () => {
  htmlText = generateHtmlText();
});

const server = http.createServer((request, response) => {
  if (request.url === "/favicon.ico") {
    return;
  }

  if (!htmlText) {
    htmlText = generateHtmlText();
  }

  response.writeHead(200, { "Content-Type": "text/html" });
  response.end(htmlText);
});

server.listen(port);
console.log(`Server listening on port ${port}`);
