const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const { generateIndex } = require("./generate-index.cjs");

const homeDir = process.env.HOME_DIR ?? __dirname;
const animationsDir = path.join(homeDir, "animations/");
const port = (process.env.PORT && parseInt(process.env.PORT)) ?? 8080;

let indexText;

const connectingClients = [];
const server = http.createServer((request, response) => {
  const path = url.parse(request.url).pathname;
  switch (path) {
    case "/":
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(indexText);
      return;
    case "/refresh":
      connectingClients.push(response);
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      response.write("retry: 10000\n");
      response.write("event: refresh\n");
      request.on("close", () => {
        connectingClients.splice(connectingClients.indexOf(response), 1);
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

indexText = generateIndex({ injectedScript });
fs.watch(animationsDir, () => {
  indexText = generateIndex({ injectedScript });

  for (let i = connectingClients.length - 1; i >= 0; i--) {
    connectingClients[i].write("data: refresh\n\n");
  }
});

server.listen(port);
console.log(`Server listening on port ${port}`);
