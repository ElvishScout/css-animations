const http = require("node:http");
const path = require("node:path");
const url = require("node:url");
const chokidar = require("chokidar");
const { generateIndex } = require("./generate-index");

const host = process.env.HOST || "localhost";
const port = (process.env.PORT && parseInt(process.env.PORT)) ?? 8080;

/**
 * @param {{host?: string; port?: number;}} options
 * @returns {Promise<void>}
 */
const start = async ({ host, port }) => {
  const injectedScript = (() => {
    const source = new EventSource("/refresh");
    source.addEventListener("refresh", () => {
      location.reload();
    });
  }).toString();

  /** @type {Set<http.ServerResponse>} */
  const connectedClients = new Set();
  let indexText = "";

  const server = http.createServer((request, response) => {
    const path = url.parse(request.url).pathname;
    switch (path) {
      case "/":
        response.writeHead(200, { "content-type": "text/html" });
        response.end(indexText);
        break;
      case "/refresh":
        connectedClients.add(response);
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        response.write("retry: 10000\n");
        response.write("event: refresh\n");
        request.on("close", () => {
          connectedClients.delete(response);
        });
        break;
    }
  });

  indexText = await generateIndex(injectedScript);

  chokidar.watch(__dirname, { ignoreInitial: true }).on("all", async (_, file) => {
    indexText = await generateIndex(injectedScript);
    for (const client of connectedClients) {
      client.write("data: refresh\n\n");
    }
    if (file) {
      console.log(`Update ${path.basename(file)}`);
    }
  });

  server.listen(port, host);
};

start({ host, port }).then(() => {
  console.log(`Server listening on http://${host}:${port}`);
});
