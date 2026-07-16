const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const { z } = require('zod');
const { zValidator } = require('@hono/zod-validator');
const { HTTPException } = require('hono/http-exception');

const app = new Hono();
app.use(ensureAuthenticated());

const scheduleIdValidator = zValidator('param', z.object({ scheduleId: z.string().uuid() }), (result) => {
  if (!result.success) throw new HTTPException(400, { message: 'URL の形式が正しくありません。' });
});

const scheduleFormValidator = zValidator('form', z.object({
  scheduleName: z.string(),
  memo: z.string(),
  candidates: z.string(),
}), (result) => {
  if (!result.success) throw new HTTPException(400, { message: '入力された情報が不十分または正しくありません' });
});

async function createCandidates(candidatesData, scheduleId) {
  const candidates = candidatesData.map((data) => ({ candidateName: data.candidateName, url: data.url, scheduleId }));
  await prisma.candidate.createMany({ data: candidates });
}

function parseCandidateNames(candidatesStr) {
  return candidatesStr.split('\n').map((s) => s.trim()).filter((s) => s !== '' && s.split(/[,，、]/)[0].trim() !== '').map((line) => {
    const [name, url] = line.split(/[,，、]/).map((s) => s.trim());
    return { candidateName: name, url: url || null };
  });
}

function isMine(userId, schedule) { return schedule && parseInt(schedule.createdBy, 10) === parseInt(userId, 10); }

app.get('/new', (c) => c.html(layout(c, '', html`
  <form method="post" action="/schedules" class="my-3">
    <div class="mb-3"><label class="form-label">テーマ名</label><input type="text" name="scheduleName" class="form-control" /></div>
    <div class="mb-3"><label class="form-label">メモ</label><textarea name="memo" class="form-control"></textarea></div>
    <div class="mb-3">
      <label class="form-label">候補スポット（店名, 共有リンクURL）</label>
      <textarea name="candidates" class="form-control" rows="4" placeholder="例：〇〇イタリアン、https://maps... （「,」や「、」でつなぐ）&#13;※複数ある場合は1行に1店ずつ改行して入力してください"></textarea></div>
    <button class="btn btn-primary" type="submit">作成</button>
  </form>
`)));

app.post('/', scheduleFormValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const body = c.req.valid('form');

  // もしデータベースの名簿に自分が無ければ、自動で登録（復活）させる
  const username = user.username || user.login || user.name || 'shin';
  await prisma.user.upsert({
    where: { userId: parseInt(user.id, 10) },
    update: { username: username },
    create: { userId: parseInt(user.id, 10), username: username }, 
  });

  const { scheduleId } = await prisma.schedule.create({
    data: { scheduleId: randomUUID(), scheduleName: body.scheduleName || '（名称未設定）', memo: body.memo, createdBy: user.id, updatedAt: new Date() },
  });
  const candidateNames = parseCandidateNames(body.candidates);
  await createCandidates(candidateNames, scheduleId);
  return c.redirect('/');
});

app.get('/:scheduleId', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({ where: { scheduleId: c.req.valid('param').scheduleId }, include: { user: { select: { userId: true, username: true } } } });
  if (!schedule) return c.notFound();

  const candidates = await prisma.candidate.findMany({ where: { scheduleId: schedule.scheduleId }, orderBy: { candidateId: 'asc' } });
  const availabilities = await prisma.availability.findMany({ where: { scheduleId: schedule.scheduleId }, include: { user: { select: { userId: true, username: true } } } });
  
  const comments = await prisma.comment.findMany({ 
    where: { scheduleId: schedule.scheduleId },
    include: { user: { select: { userId: true, username: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const availabilityMapMap = new Map();
  availabilities.forEach((a) => {
    const map = availabilityMapMap.get(a.user.userId) || new Map();
    map.set(a.candidateId, a.availability);
    availabilityMapMap.set(a.user.userId, map);
  });

  const userMap = new Map();
  userMap.set(parseInt(user.id, 10), { isSelf: true, userId: parseInt(user.id, 10), username: user.username });
  availabilities.forEach((a) => userMap.set(a.user.userId, { isSelf: parseInt(user.id, 10) === a.user.userId, userId: a.user.userId, username: a.user.username }));

  const users = Array.from(userMap.values());
  const buttonStyles = ['btn-info', 'btn-primary', 'btn-success'];
  const labels = ['❓', '🔥 行きたい', '⭐ 行ったことある'];

  return c.html(layout(c, `テーマ: ${schedule.scheduleName}`, html`
    <div class="card my-3"><h4 class="card-header">${schedule.scheduleName}</h4><div class="card-body"><p style="white-space: pre;">${schedule.memo}</p></div><div class="card-footer">作成者: ${schedule.user.username}</div></div>
    ${isMine(user.id, schedule) ? html`<a href="/schedules/${schedule.scheduleId}/edit" class="btn btn-primary">編集する</a>` : ''}
    
    <table class="table table-bordered my-3" style="table-layout: fixed; width: 100%;">
      <colgroup>
        <col style="width: 40%;" />
        ${users.map(() => html`<col style="width: ${60 / users.length}%;" />`)}
      </colgroup>
      
      <thead>
        <tr>
          <th>
            スポット
          </th>
          ${users.map((u) => html`
            <th>
              ${u.username}
              <span class="text-muted fw-normal ms-1" style="font-size: 0.8rem;">
              （クリックで「❓」➔「🔥 行きたい」➔「⭐ 行ったことある」の切替できます）
            </span>
            </th>`)}
        </tr>
      </thead>
      
      <tbody>
        ${candidates.map((cand) => html`
          <tr>
            <td style="word-wrap: break-word; overflow-wrap: break-word; vertical-align: middle;">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <span class="fw-bold">${cand.candidateName}</span>
                ${cand.url ? html`<a href="${cand.url}" target="_blank" class="btn btn-sm btn-outline-primary text-nowrap">📍マップ</a>` : ''}
              </div>
            </td>
            ${users.map((u) => {
              const avail = availabilityMapMap.get(u.userId)?.get(cand.candidateId) ?? 0;
              return html`<td class="text-center" style="vertical-align: middle;">
                ${u.isSelf 
                  ? html`<button data-schedule-id="${schedule.scheduleId}" data-user-id="${u.userId}" data-candidate-id="${cand.candidateId}" data-availability="${avail}" class="availability-toggle-button btn btn-sm ${buttonStyles[avail]} px-3 text-nowrap shadow-sm">${labels[avail]}</button>`
                  : html`<span class="fs-4">${labels[avail]}</span>`}
              </td>`;
            })}
          </tr>
        `)}
        </tbody>
    </table>

    <div class="card border border-light-subtle rounded-3 shadow-sm p-4 mt-4 bg-white">
      <h5 class="fw-bold mb-3" style="color: #d97706 !important;">
        新しいお店（候補）を追加する
      </h5>
      <form method="post" action="/schedules/${schedule.scheduleId}/candidates">
        <div class="input-group">
          <input
            type="text"
            name="candidateName"
            class="form-control form-control-lg"
            placeholder="例：〇〇イタリアン、https://maps... （「,」か「、」を挟んで入力）"
            required
          >
          <button class="btn fw-bold px-4 text-white" type="submit" style="background-color: #f59e0b !important; border-color: #f59e0b !important;">
            ＋ 追加する
          </button>
        </div>
      </form>
    </div>

    <div class="card border border-light-subtle rounded-3 shadow-sm p-4 mt-4 bg-white">
      <h5 class="fw-bold mb-3" style="color: #0284c7 !important;">
        チャット掲示板
      </h5>
      
      <div class="mb-4" style="max-height: 350px; overflow-y: auto;">
        ${comments.length > 0 ? html`
          <div class="d-flex flex-column gap-2">
            ${comments.map((c) => html`
              <div class="p-3 rounded-3 bg-light border-start border-4 border-info shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <span class="fw-bold text-dark">👤 ${c.user.username}</span>
                  <small class="text-muted">${new Date(c.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <p class="mb-0 text-break" style="white-space: pre-wrap;">${c.comment}</p>
              </div>
            `)}
          </div>
        ` : html`
          <p class="text-muted mb-0">まだメッセージはありません。</p>
        `}
      </div>

      <form method="post" action="/schedules/${schedule.scheduleId}/comments">
        <div class="input-group">
          <input
            type="text"
            name="comment"
            class="form-control form-control-lg"
            placeholder="例：ここのイタリアン、駐車場もあるみたいで良さそう！（メッセージを入力）"
            required
          >
          <button class="btn fw-bold px-4 text-white" type="submit" style="background-color: #0284c7 !important; border-color: #0284c7 !important;">
            送信
          </button>
        </div>
      </form>
    </div>
  `));
});

app.get('/:scheduleId/edit', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const schedule = await prisma.schedule.findUnique({ where: { scheduleId: c.req.valid('param').scheduleId } });
  if (!isMine(user.id, schedule)) return c.notFound();
  const candidates = await prisma.candidate.findMany({ where: { scheduleId: schedule.scheduleId }, orderBy: { candidateId: 'asc' } });
  return c.html(layout(c, `編集`, html`
    <form method="post" action="/schedules/${schedule.scheduleId}/update">
      <div class="mb-3"><label>テーマ名</label><input type="text" name="scheduleName" value="${schedule.scheduleName}" class="form-control" /></div>
      <div class="mb-3"><label>メモ</label><textarea name="memo" class="form-control">${schedule.memo}</textarea></div>
      <div class="mb-3">
        <label>候補スポット（店名, 共有リンクURL）</label>
        <textarea name="candidates" class="form-control" rows="5" placeholder="例：〇〇イタリアン、https://maps...&#13;※複数ある場合は1行に1店ずつ改行して入力してください">${candidates.map((c) => `${c.candidateName}${c.url ? `, ${c.url}` : ''}`).join('\n')}</textarea></div>
      <button type="submit" class="btn btn-primary">更新</button>
    </form>
    <form method="post" action="/schedules/${schedule.scheduleId}/delete" class="mt-3"><button class="btn btn-danger">削除</button></form>
  `));
});

app.post('/:scheduleId/update', scheduleIdValidator, scheduleFormValidator, async (c) => {
  const body = c.req.valid('form');
  const scheduleId = c.req.valid('param').scheduleId;
  await prisma.schedule.update({ where: { scheduleId }, data: { scheduleName: body.scheduleName, memo: body.memo, updatedAt: new Date() } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  const candidates = parseCandidateNames(body.candidates);
  if (candidates.length) await createCandidates(candidates, scheduleId);
  return c.redirect('/schedules/' + scheduleId);
});

app.post('/:scheduleId/delete', scheduleIdValidator, async (c) => {
  const scheduleId = c.req.valid('param').scheduleId;
  await prisma.availability.deleteMany({ where: { scheduleId } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  await prisma.comment.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { scheduleId } });
  return c.redirect('/');
});

// 新しいお店を追加保存
app.post('/:scheduleId/candidates', scheduleIdValidator, async (c) => {
  const scheduleId = c.req.valid('param').scheduleId;
  const body = await c.req.parseBody();
  const candidateNameInput = body.candidateName || '';

  const candidateNames = parseCandidateNames(candidateNameInput);
  
  if (candidateNames.length > 0) {
    await createCandidates(candidateNames, scheduleId);
  }

  return c.redirect('/schedules/' + scheduleId);
});

// 新しいチャットメッセージを保存
app.post('/:scheduleId/comments', scheduleIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const scheduleId = c.req.valid('param').scheduleId;
  const body = await c.req.parseBody();
  const commentText = body.comment || '';

  if (commentText.trim() !== '') {
    await prisma.comment.create({
      data: {
        scheduleId: scheduleId,
        userId: parseInt(user.id, 10),
        comment: commentText
      }
    });
  }

  return c.redirect('/schedules/' + scheduleId);
});

module.exports = app;