import { createServer } from "node:http";
import { resolve } from "node:path";
import { tryHandleValidate } from "../src/core/validate/httpHandler.ts";
import { serveDocs } from "./docs.ts";
import { serveStatic } from "./static.ts";

function resolvePort(): number {
  const flag = process.argv.indexOf("--port");
  const fromFlag = flag !== -1 ? Number(process.argv[flag + 1]) : NaN;
  if (Number.isFinite(fromFlag) && fromFlag > 0) return fromFlag;
  return Number(process.env.PORT) || 5000;
}

function resolveDistRoot(): string {
  return process.env.DIST_DIR
    ? resolve(process.env.DIST_DIR)
    : resolve(process.cwd(), "dist");
}

const port = resolvePort();
const distRoot = resolveDistRoot();

const server = createServer((req, res) => {
  if (tryHandleValidate(req, res)) return;
  if (serveDocs(req, res, distRoot)) return;
  serveStatic(req, res, distRoot);
});

server.listen(port, () => {
  console.log(
    `[archidraw] dist=${distRoot} listening on http://localhost:${port}`,
  );
});
