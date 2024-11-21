const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");
const chokidar = require("chokidar");
const { generateIndex } = require("./generate-index");

const configPath = process.env.CONFIG_PATH || "config.json";
const host = process.env.HOST || "localhost";
const port = (process.env.PORT && parseInt(process.env.PORT)) ?? 8080;

let indexText;

const connectedClients = [];
const server = http.createServer((request, response) => {
  const path = url.parse(request.url).pathname;
  switch (path) {
    case "/":
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(indexText);
      return;
    case "/refresh":
      connectedClients.push(response);
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      response.write("retry: 10000\n");
      response.write("event: refresh\n");
      request.on("close", () => {
        connectedClients.splice(connectedClients.indexOf(response), 1);
      });
      return;
    case "/favicon.ico":
      return;
  }
});

const injectedScript = (() => {
  const source = new EventSource("/refresh");
  source.addEventListener("refresh", () => {
    location.reload();
  });
}).toString();

const update = () => {
  const config = JSON.parse(fs.readFileSync(configPath).toString());
  indexText = generateIndex({ config, injectedScript });
};

update();
chokidar.watch(__dirname, { ignoreInitial: true }).on("all", (_, file) => {
  update();
  connectedClients.forEach((client) => {
    client.write("data: refresh\n\n");
  });
  if (file) {
    console.log(`Update ${path.basename(file)}`);
  }
});

server.listen(port, host);
console.log(`Server listening on http://${host}:${port}`);
