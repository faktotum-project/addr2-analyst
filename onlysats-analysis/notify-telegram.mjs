#!/usr/bin/env node
// Run only after the new site version is live. Requires a configured bot and channel.
import { readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const siteDir = dirname(fileURLToPath(import.meta.url));
const outboxDir = join(siteDir, 'outbox');
const { values: args } = parseArgs({ options: {
  id: { type: 'string' },
  'dry-run': { type: 'boolean', default: false }
} });
const siteUrl = process.env.ONLYSATS_SITE_URL?.replace(/\/$/, '');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!args['dry-run'] && (!siteUrl || !token || !chatId)) {
  throw new Error('Configura ONLYSATS_SITE_URL, TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID prima di inviare.');
}
if (!args['dry-run'] && new URL(siteUrl).protocol !== 'https:') {
  throw new Error('ONLYSATS_SITE_URL deve essere un URL HTTPS pubblico.');
}

const files = args.id ? [`${args.id}.json`] : (await readdir(outboxDir)).filter(file => file.endsWith('.json')).sort();
for (const file of files) {
  const path = join(outboxDir, file);
  const item = JSON.parse(await readFile(path, 'utf8'));
  if (item.status !== 'pending') continue;
  if (!args.id && Date.now() - Date.parse(item.createdAt) > 48 * 60 * 60 * 1000) {
    console.log(`Messaggio datato, saltato: ${item.id}`);
    continue;
  }
  const link = siteUrl ? `${siteUrl}/#${encodeURIComponent(item.id)}` : `[URL del sito]/#${item.id}`;
  const message = item.text.replace(`Lettura completa: #${item.id}`, `Lettura completa: ${link}`);
  if (message.length > 4096) throw new Error(`Messaggio troppo lungo: ${item.id}`);
  if (args['dry-run']) { console.log(`--- ${item.id} ---\n${message}`); continue; }

  const liveDataUrl = new URL('data.js', `${siteUrl}/`);
  const liveResponse = await fetch(liveDataUrl, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!liveResponse.ok || !(await liveResponse.text()).includes(`"id":"${item.id}"`)) {
    throw new Error(`L'articolo ${item.id} non è ancora visibile nel sito pubblico; Telegram non è stato chiamato.`);
  }

  // Telegram has no idempotency key for sendMessage. A lost response leaves the item in
  // "sending" so it cannot be retried blindly and create a duplicate announcement.
  item.status = 'sending';
  await writeFile(`${path}.tmp`, JSON.stringify(item, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error(`Esito Telegram incerto per ${item.id}; verifica il canale prima di riprovare.`);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(`Telegram non ha confermato ${item.id} (HTTP ${response.status}). Verifica il canale prima di riprovare.`);
  }
  item.status = 'sent';
  item.sentAt = new Date().toISOString();
  item.telegramMessageId = result.result.message_id;
  await writeFile(`${path}.tmp`, JSON.stringify(item, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
  console.log(`Inviato ${item.id} al canale Telegram.`);
}
