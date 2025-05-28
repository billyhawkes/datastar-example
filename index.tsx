import { Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { streamSSE } from "hono/streaming";
import { Database } from "bun:sqlite";

const db = new Database("persist/sqlite.db");
db.exec(`CREATE TABLE IF NOT EXISTS key_value (
  key TEXT NOT NULL PRIMARY KEY,
  value,
  UNIQUE(key)
);`);

const CountExample = ({ count = 0 }: { count?: number }) => {
  return (
    <div data-signals={`{ count: ${count} }`}>
      <div data-text="$count"></div>
      <div
        data-computed-doublecount="$count * 2"
        data-text="$doublecount"
      ></div>
      <button data-on-click="@put('/count')">Increment</button>
    </div>
  );
};

const Layout = ({
  children,
  title,
}: {
  children: JSX.Element;
  title?: string;
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DataStar Examples: {title}</title>
        <script
          type="module"
          src="https://cdn.jsdelivr.net/gh/starfederation/datastar@1.0.0-beta.11/bundles/datastar.js"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
};

const countRouter = new Hono()
  .get("/", async (c) => {
    const count = db
      .query<
        { value: string },
        string
      >(`SELECT value FROM key_value WHERE key = ?;`)
      .get("count");

    return c.html(
      <Layout title="Count">
        <CountExample count={count ? parseInt(count.value) : undefined} />
      </Layout>,
    );
  })
  .put("/", async (c) => {
    const signals = await c.req.json();
    const newCount = signals.count + 1;
    await db
      .query(
        `INSERT OR REPLACE INTO key_value (key, value) VALUES ('count', '${newCount}')`,
      )
      .get();

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        data: "signals " + JSON.stringify({ count: newCount }),
        event: "datastar-merge-signals",
      });
    });
  });

const app = new Hono();

app.route("/count", countRouter);

export default app;
