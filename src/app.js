'use strict';

const { Hono } = require('hono');
const { logger } = require('hono/logger');
const { html } = require('hono/html');
const { HTTPException } = require('hono/http-exception');
const { secureHeaders } = require('hono/secure-headers');
const { env } = require('hono/adapter');
const { serveStatic } = require('@hono/node-server/serve-static');
const { trimTrailingSlash } = require('hono/trailing-slash');
const layout = require('./layout');

const indexRouter = require('./routes/index');

const app = new Hono();

app.use(logger());
app.use(serveStatic({ root: './public' }));
app.use(secureHeaders());
app.use(trimTrailingSlash());

// ルーティング
app.route('/', indexRouter);

// 404 Not Found
app.notFound((c) => {
  return c.html(
    layout(
      c,
      'Not Found',
      html`
        <h1>Not Found</h1>
        <p>${c.req.url} の内容が見つかりませんでした。</p>
      `,
    ),
    404,
  );
});

// エラーハンドリング
app.onError((error, c) => {
  console.error(error);
  const statusCode = error instanceof HTTPException ? error.status : 500;
  const { NODE_ENV } = env(c);
  return c.html(
    layout(
      c,
      'Error',
      html`
        <h1>Error</h1>
        <h2>${error.name} (${statusCode})</h2>
        <p>${error.message}</p>
        ${NODE_ENV === 'development' ? html`<pre>${error.stack}</pre>` : ''}
      `,
    ),
    statusCode,
  );
});

module.exports = app;