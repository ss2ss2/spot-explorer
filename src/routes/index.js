const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const app = new Hono();

function scheduleTable(schedules) {
  return html`
    <table class="table table-hover align-middle" style="border-color: #e2e8f0 !important;">
      <tr>
        <th>テーマ名</th>
        <th>更新日時</th>
      </tr>
      ${schedules.map(
        (schedule) => html`
          <tr>
            <td>
              <a class="text-decoration-none fw-bold" style="color: #f59e0b !important;" href="/schedules/${schedule.scheduleId}">${schedule.scheduleName}</a>
            </td>
            <td>${schedule.formattedUpdatedAt}</td>
          </tr>
        `,
      )}
    </table>
  `;
}

app.get('/', async (c) => {
  const { user } = c.get('session') ?? {};
  const schedules = user
    ? await prisma.schedule.findMany({
        orderBy: { updatedAt: 'desc' },
      })
    : [];
  schedules.forEach((schedule) => {
    schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });

  return c.html(
    layout(
      c,
      null,
      html`
        <div class="my-4">
          <div class="p-5 rounded-4 shadow-sm border-0" style="background-color: #fff5e6;">
            <h1 class="text-body">グルメ＆スポットアプリ</h1>
            <p class="lead">
              グルメ＆スポットアプリは、GitHubで認証でき、休日の行き先や隠れた名店をみんなで共有・開拓できるサービスです。
            </p>
          </div>
        </div>
        ${user
          ? html`
              <div class="my-4">
                <a class="btn btn-primary" href="/schedules/new">テーマを作る</a>
              </div>

              ${schedules.length > 0
                ? html`
                    <h3 class="my-3">みんなの開拓テーマ一覧</h3>
                    ${scheduleTable(schedules)}
                  `
                : html`<p class="my-3 text-muted fs-5 py-5 my-3">まだ開拓テーマがありません！<br>みんなで最初のテーマを作りましょう</p>`}
            `
          : ''}
      `,
    ),
  );
});

module.exports = app;