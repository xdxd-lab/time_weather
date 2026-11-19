#!/usr/bin/env node
/**
 * Zero-dependency static server for local development.
 *
 * Serves the repository under /time_weather/, the same subpath GitHub Pages
 * uses, so an absolute-path mistake shows up locally instead of in production.
 *
 *   npm run dev                 # http://127.0.0.1:4173/time_weather/
 *   npm run dev -- --port 8080
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE = "/time_weather/";
const HOST = "127.0.0.1";
const portIndex = process.argv.indexOf("--port");
const PORT = Number(
  portIndex === -1 ? (process.env.PORT ?? 4173) : process.argv[portIndex + 1],
);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

/**
 * Maps a URL path to a file inside ROOT, or null. Rejects path traversal and
 * dot-files (such as .git) so the server never exposes more than Pages would.
 * @param {string} pathname
 * @returns {Promise<string | null>}
 */
async function resolveFile(pathname) {
  const relative = decodeURIComponent(pathname.slice(BASE.length));
  if (relative.split("/").some((part) => part.startsWith("."))) return null;
  const candidate = resolve(ROOT, relative);
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  const info = await stat(candidate).catch(() => null);
  if (!info) return null;
  if (info.isDirectory()) {
    const index = join(candidate, "index.html");
    return (await stat(index).catch(() => null)) ? index : null;
  }
  return candidate;
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {string} message
 */
function sendText(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", `http://${HOST}`);
  if (pathname === "/" || pathname === BASE.slice(0, -1)) {
    response.writeHead(302, { Location: BASE });
    response.end();
    return;
  }
  if (!pathname.startsWith(BASE)) {
    sendText(response, 404, "Not found");
    return;
  }
  try {
    const file = await resolveFile(pathname);
    if (!file) {
      sendText(response, 404, "Not found");
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    if (error instanceof URIError) {
      sendText(response, 400, "Bad request");
      return;
    }
    console.error(error);
    sendText(response, 500, "Internal server error");
  }
});

server.listen(PORT, HOST, () => {
  console.info(`Time Weather dev server: http://${HOST}:${PORT}${BASE}`);
});
