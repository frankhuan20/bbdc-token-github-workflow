import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./token-utils.mjs";

const dir = path.resolve(rootDir, process.argv[2] || "dist");
const port = Number(process.argv[3] || 8787);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(dir, decodeURIComponent(requestedPath));
    if (!filePath.startsWith(dir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const data = await fs.readFile(filePath);
    response.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Preview running at http://localhost:${port}/`);
});
