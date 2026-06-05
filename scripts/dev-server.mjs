import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = "127.0.0.1";
const port = Number(readArg("--port") || process.env.PORT || 5173);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
    const filePath = resolveRequestPath(requestUrl.pathname);
    const fileStat = await stat(filePath);
    const finalPath = fileStat.isDirectory() ? join(filePath, "index.html") : filePath;
    const finalStat = await stat(finalPath);

    if (!finalStat.isFile()) {
      return send(response, 404, "Not found");
    }

    response.writeHead(200, {
      "Content-Length": finalStat.size,
      "Content-Type": mimeTypes.get(extname(finalPath).toLowerCase()) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(finalPath).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return send(response, 404, "Not found");
    }
    if (error?.statusCode) {
      return send(response, error.statusCode, error.message);
    }
    console.error(error);
    return send(response, 500, "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`TMS local server running at http://${host}:${port}/`);
});

function resolveRequestPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relativePath = normalize(decoded).replace(/^[/\\]+/, "");
  const filePath = resolve(root, relativePath);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

  if (filePath !== root && !filePath.startsWith(rootPrefix)) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }

  return filePath;
}

function send(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}
