// Prox2
// Copyright (C) 2020  anirudhb
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import "source-map-support/register";

import crypto from "crypto";
import https from "https";

import { Repository } from "typeorm";
import { WebClient, ErrorCode } from "@slack/web-api";
import body_parser from "body-parser";

import { NextApiRequest, NextApiResponse, PageConfig } from "next";

import { Confession } from "./models";

import { sanitize } from "./sanitizer";

import {
  token,
  staging_channel,
  confessions_channel,
  slack_signing_secret,
  meta_channel,
  log_channel,
} from "./secrets_wrapper";
import {
  ActionsSection,
  Blocks,
  ButtonAction,
  MarkdownText,
  PlainText,
  TextSection,
} from "./block_builder";

export const api_config = {
  api: {
    bodyParser: false,
  },
} as PageConfig;

export function withTimeout<T>(
  millis: number,
  promise: Promise<T>
): Promise<T> {
  const timeout = new Promise((_, r) =>
    setTimeout(() => r(`Promise timed out after ${millis}ms`), millis)
  );
  return Promise.race([promise, timeout]) as Promise<T>;
}

function applyMiddleware<T>(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (arg0: any, arg1: any, cb: (arg0: T) => void) => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}

function rawbody_verify(req: any, _res: any, buf: any, encoding: any) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
}

export async function setupMiddlewares(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    urlencoded?: boolean;
    json?: boolean;
  } = {}
) {
  const useParsers = [];
  if (options.urlencoded !== false) {
    useParsers.push(
      body_parser.urlencoded({
        verify: rawbody_verify,
        extended: true,
      })
    );
  }
  if (options.json !== false) {
    useParsers.push(
      body_parser.json({
        verify: rawbody_verify,
      })
    );
  }
  for (const parser of useParsers) {
    try {
      await withTimeout(1000, applyMiddleware(req, res, parser));
    } catch (_) {
      console.log(`Middleware ${parser} timed out`);
    }
  }
}

export const web = new WebClient(token);

export interface CommandData {
  token?: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name?: string;
  team_id: string;
  enterprise_id?: string;
  channel_id: string;
  api_app_id: string;
}

export function isCommandData(x: any): x is CommandData {
  return (
    (x.token == undefined || typeof x.token == "string") &&
    typeof x.command == "string" &&
    typeof x.text == "string" &&
    typeof x.response_url == "string" &&
    typeof x.trigger_id == "string" &&
    typeof x.user_id == "string" &&
    (x.user_name == undefined || typeof x.user_name == "string") &&
    typeof x.team_id == "string" &&
    (x.enterprise_id == undefined || typeof x.enterprise_id == "string") &&
    typeof x.channel_id == "string" &&
    typeof x.api_app_id == "string"
  );
}

export async function validateData(
  req: NextApiRequest
): Promise<CommandData | null> {
  if (!isCommandData(req.body)) {
    return null;
  } else {
    return req.body;
  }
}

export async function failRequest(response_url: string, error: string) {
  console.log(`Failing with error: ${error}`);
  await fetch(response_url, {
    method: "POST",
    body: JSON.stringify({
      response_type: "ephemeral",
      text: error,
      replace_original: false
    }),
  });
}

export async function succeedRequest(
  response_url: string,
  message: string,
  in_channel: boolean = false
) {
  console.log(`Succeeding with message: ${message}`);
  await fetch(response_url, {
    method: "POST",
    body: JSON.stringify({
      response_type: in_channel ? "in_channel" : "ephemeral",
      replace_original: "true",
      text: message,
    }),
  });
}

function hashUser(uid: string, salt: string): string {
  return crypto.scryptSync(Buffer.from(uid), salt, 64).toString("hex");
}

export function sameUser(fields: Confession, uid: string): boolean {
  const new_uid_hash = hashUser(uid, fields.uid_salt);
  return crypto.timingSafeEqual(
    Buffer.from(fields.uid_hash),
    Buffer.from(new_uid_hash)
  );
}

export async function stageDMConfession(
  message_ts: string,
  uid: string
): Promise<void> {
  console.log(`Posting confirmation message...`);
  const confirmation_message = await web.chat.postMessage({
    channel: uid,
    text: "Would you like to stage this confession?",
    thread_ts: message_ts,
    reply_broadcast: true,
    blocks: new Blocks([
      new TextSection(
        new MarkdownText("Would you like to stage this confession?"),
        null,
        null
      ),
      new ActionsSection([
        new ButtonAction(new PlainText(":true: Stage"), "stage", "stage"),
        new ButtonAction(new PlainText(":x: Cancel"), "cancel", "cancel"),
      ]),
    ]).render(),
  });
  if (!confirmation_message.ok) {
    console.log(`Failed to post confirmation message!`);
    throw `Failed to post confirmation message!`;
  }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function reviveConfessions(repository: Repository<Confession>) {
  console.log(`Getting unviewed confessions...`);
  let unviewedConfessions;
  try {
    unviewedConfessions = await repository.find({ viewed: false });
  } catch (_) {
    throw `Failed to fetch unviewed confessions!`;
  }
  for (const record of unviewedConfessions) {
    console.log(`Removing old message (if any) and ignoring errors...`);
    if (record.staging_ts) {
      try {
        await web.chat.delete({
          channel: staging_channel,
          ts: record.staging_ts,
        });
      } catch (_) {
        console.log(
          `Warning: failed to delete staging message... continuing anyways`
        );
      }
    }
    let newTs;
    try {
      newTs = await postStagingMessage(record.id, record.text);
    } catch (err) {
	    if (err.code === ErrorCode.RateLimitedError) {
        console.log(`Rate limited - trying again after ${err.retryAfter} seconds`);
        await sleep(err.retryAfter * 1000);
        newTs = await postStagingMessage(record.id, record.text);
      } else {
        console.log(`Failed to post staging message... rethrowing error`);
        throw err;
      }
    }
    console.log(`Updating record...`);
    try {
      record.staging_ts = newTs;
      await repository.save(record);
    } catch (_) {
      throw `Failed to update Postgres record!`;
    }
  }
  console.log(`Restaged all unviewed confessions!`);
}

function createStagingBlocks(id: number, text: string): TextSection[] {
  let chunks = [`(staging) *${id}*`];
  const words = text.split(" ");
  for (const word of words) {
    if (chunks[chunks.length - 1].length + word.length + 1 < 3000) {
      // Add
      chunks[chunks.length - 1] += ` ${word}`;
    } else {
      // New chunk
      chunks.push(word);
    }
  }
  return chunks.map((chunk) => new TextSection(new MarkdownText(chunk)));
}

const getStagingMessageBlocks = (id: number, text: string) => new Blocks([
  ...createStagingBlocks(id, sanitize(text)),
  new ActionsSection([
    new ButtonAction(new PlainText(":true: Approve"), "approve", "approve"),
    new ButtonAction(
        new PlainText(":x: Reject"),
        "disapprove",
        "disapprove"
    ),
    new ButtonAction(
        new PlainText(":angerydog: Approve with TW"),
        "approve:tw",
        "approve:tw"
    ),
    new ButtonAction(
        new PlainText(":office: Approve for meta"),
        "approve:meta",
        "approve:meta"
    ),
  ]),
]).render();

export async function postStagingMessage(
  id: number,
  text: string
): Promise<string> {
  console.log(`Posting message to staging channel...`);
  const staging_message = await web.chat.postMessage({
    channel: staging_channel,
    text: "",
    blocks: getStagingMessageBlocks(id, text),
  });
  if (!staging_message.ok) {
    throw "Failed to post message to staging channel";
  }
  console.log(`Posted message!`);
  return staging_message.ts as string;
}

export async function stageConfession(
  repository: Repository<Confession>,
  message: string,
  uid: string
): Promise<number> {
  console.log(`Staging confession...`);
  console.log(`Creating new UID salt...`);
  const uid_salt = crypto.randomBytes(16).toString("hex");
  console.log(`Hashing UID...`);
  const uid_hash = hashUser(uid, uid_salt);
  console.log(`Salt = ${uid_salt} hashed = ${uid_hash}`);
  console.log(`Inserting into Postgres...`);
  let record;
  try {
    record = await repository.save({
      approved: false,
      viewed: false,
      text: message,
      staging_ts: "",
      published_ts: "",
      uid_salt,
      uid_hash,
    });
  } catch (_) {
    throw "Failed to insert Postgres record";
  }
  console.log(`Inserted!`);
  console.log(`Posting message to staging channel...`);
  let staging_ts;
  try {
    staging_ts = await postStagingMessage(record.id, record.text);
  } catch (e) {
    console.log(`Failed to post message. Rolling back Postgres record...`);
    await repository.remove(record);
    console.log(`Rolled back changes. Notifying user...`);
    throw e;
  }
  console.log(`Updating Postgres record...`);
  try {
    record.staging_ts = staging_ts;
    await repository.save(record);
  } catch (_) {
    throw "Failed to update Postgres record";
  }
  console.log(`Updated!`);
  return record.id;
}

export async function viewConfession(
  repository: Repository<Confession>,
  staging_ts: string,
  approved: boolean,
  reviewer_uid: string,
  tw_text: string | null = null,
  isMeta: boolean = false
): Promise<void> {
  console.log(
    `${
      approved ? "Approving" : "Disapproving"
    } confession with staging_ts=${staging_ts}...`
  );
  // Check if message is in Postgres
  let record;
  try {
    record = await repository.findOne({
      staging_ts,
    });
  } catch (_) {
    throw `Failed to fetch Postgres record!`;
  }
  if (record === undefined) {
    throw `Failed to find single Postgres record with staging_ts=${staging_ts}`;
  }
  if (record.viewed) {
    // return, already viewed
    console.log(`Record already viewed, returning`);
    return;
  }
  // Publish record and update
  let ts = null;
  const target_channel = isMeta ? meta_channel : confessions_channel;
  if (approved) {
    console.log(`Publishing message...`);
    const published_message = await web.chat.postMessage({
      channel: target_channel,
      text: sanitize(
        `*${record.id}*:${tw_text ? " TW:" : ""} ${tw_text ?? record.text} ${
          tw_text?.trim() ? "— open thread to view" : ""
        }`
      ),
    });
    if (!published_message.ok) {
      throw `Failed to publish message!`;
    }
    ts = published_message.ts as string;
    console.log(`Published message!`);
  }
  console.log(`Updating Postgres record...`);
  try {
    record.meta = isMeta;
    record.approved = approved;
    record.viewed = true;
    record.published_ts = ts ?? "";
    await repository.save(record);
  } catch (_) {
    throw `Failed to update Postgres record`;
  }
  console.log(`Updated!`);
  console.log(`Updating staging message...`);
  try {
    const statusText = `${
      approved ? `:true: Approved${isMeta ? ' for meta' : ''}` : `:x: Rejected`
    } by <@${reviewer_uid}> <!date^${Math.floor(
      Date.now() / 1000
    )}^{date_short_pretty} at {time}|${new Date().toISOString()}>.`;
    await web.chat.update({
      channel: staging_channel,
      ts: staging_ts,
      text: "",
      blocks: new Blocks([
        ...createStagingBlocks(record.id, sanitize(record.text)),
        new TextSection(new MarkdownText(statusText)),
        new ActionsSection([
            new ButtonAction(
                new PlainText(":rewind: Undo"),
                "undo",
                "undo"
            )
        ])
      ]).render(),
    });
  } catch (e) {
    console.log(`Failed to update staging message!`);
    console.log(JSON.stringify(e));
    throw `Failed to update staging message`;
  }
  await postConfessionLog(record.id, { type: "view", approved: record.approved, meta: record.meta });
  console.log(`Deleted!`);
}

export async function unviewConfession(
    repository: Repository<Confession>,
    staging_ts: string,
    reviewer_uid: string,
    undoer_uid: string
): Promise<void> {
  // FIXME: staging_ts race condition? e.g. two messages in confessions/meta
  // both with the same staging_ts
  console.log(`Unviewing confession with staging_ts=${staging_ts}...`);
  // Check if message is in Postgres
  let record;
  try {
    record = await repository.findOne({
      staging_ts,
    });
  } catch (_) {
    throw `Failed to fetch Postgres record!`;
  }

  if (record === undefined) {
    throw `Failed to find single Postgres record with staging_ts=${staging_ts}`;
  }
  if (!record.viewed) {
    console.log("record wasn't viewed in the first place");
    return;
  }

  console.log(`Updating Postgres record...`);
  const old_approved = record.approved;
  const old_published_ts = record.published_ts;
  try {
    record.viewed = false;
    record.approved = undefined;
    record.published_ts = undefined;
    await repository.save(record);
  } catch (_) {
    throw `Failed to update Postgres record`;
  }

  // delete the message in confessions channel (and responses in thread if they exist)
  if(old_approved && old_published_ts) {
    console.log(`Deleting thread messages in confessions channel...`);
    const target_channel = record.meta ? meta_channel : confessions_channel;
    const thread_messages = await web.conversations.replies({
        channel: target_channel,
        ts: old_published_ts
    });
    if (!thread_messages.ok) {
        throw `Failed to fetch thread messages`;
    }
    if(thread_messages.messages) {
      for (const message of thread_messages.messages) {
        // idk of an elegant way to check if the user who sent the message is the bot,
        // so let's just try deleting all of them and ignore failures
        try {
          if(!message.ts) break;
          await web.chat.delete({
              channel: target_channel,
              ts: message.ts
          });
        } catch (_) {
          console.log(`Failed to delete message in confessions channel`);
        }
      }
    }
    /*console.log("Deleting message in confessions channel...");
    try {
      await web.chat.delete({
        channel: confessions_channel,
        ts: old_published_ts
      });
    } catch (_) {
        throw `Failed to delete message in confessions channel`;
    }*/
  }

  // Update staging message
  console.log(`Updating staging message...`);
  try {
    await web.chat.update({
      channel: staging_channel,
      ts: staging_ts,
      text: "",
      blocks: getStagingMessageBlocks(record.id, record.text),
    })
  } catch (e) {
    console.log("failed to update staging message!", JSON.stringify(e));
    throw `Failed to update staging message`;
  }

  // Log undo
  console.log(`Logging undo...`);
  const log_message_text = `:rewind: ${old_approved ? `Approval${record.meta ? ' for meta' : ''}` : "Rejection"} (by <@${reviewer_uid}>) of confession #${record.id} undone by <@${undoer_uid}>`;
  const log_message = await web.chat.postMessage({
    channel: staging_channel,
    text: "",
    thread_ts: staging_ts,
    reply_broadcast: true,
    blocks: new Blocks([
      new TextSection(new MarkdownText(log_message_text)),
    ]).render(),
  });
  if (!log_message.ok) {
    console.log(`Failed to post log message!`);
    throw `Failed to post log message!`;
  }

  await postConfessionLog(record.id, { type: "undo" });
}

export async function postConfessionLog(
  id: number,
  action: {
    type: "view";
    approved: boolean;
    meta?: boolean;
  } | {
    type: "undo";
  },
): Promise<void> {
  if (log_channel == null) return;

  let actionText;
  if (action.type == "view") {
    actionText = action.approved ? action.meta ? "approved for meta" : "approved" : "rejected";
  } else if (action.type == "undo") {
    actionText = "unapproved";
  }

  const logText = `Confession *#${id}* was *${actionText}*`;
  console.log(`Sending message to log channel...`);
  try {
    await web.chat.postMessage({
      channel: log_channel,
      text: logText,
    });
  } catch (e) {
    console.log(`Failed to send log message!`);
    console.log(JSON.stringify(e));
    // non-fatal error
    return;
  }
  console.log(`Sent!`);
}

export function verifySignature(req: NextApiRequest): boolean {
  const timestamp = req.headers["x-slack-request-timestamp"];
  if (timestamp == undefined || typeof timestamp != "string") {
    console.log(`Invalid X-Slack-Request-Timestamp, got ${timestamp}`);
    return false;
  }
  const timestamp_int = parseInt(timestamp, 10);
  const current_timestamp_int = Math.floor(Date.now() / 1000);
  if (Math.abs(current_timestamp_int - timestamp_int) > 60 * 5) {
    // >5min, invalid (possibly replay attack)
    console.log(
      `Timestamp is more than 5 minutes from local time, possible replay attack!`
    );
    console.log(
      `Our timestamp was ${current_timestamp_int}; theirs was ${timestamp_int}`
    );
    return false;
  }
  let rawBody = (req as unknown as { rawBody: string }).rawBody;
  // if (!rawBody || rawBody.length <= 0) {
  //     rawBody = JSON.stringify(req.body);
  // }
  const sig_base = "v0:" + timestamp + ":" + rawBody;
  const my_sig =
    "v0=" +
    crypto
      .createHmac("sha256", slack_signing_secret)
      .update(sig_base)
      .digest("hex");
  const slack_sig = req.headers["x-slack-signature"];
  if (slack_sig == "undefined" || typeof slack_sig != "string") {
    console.log(`Invalid X-Slack-Signature, got ${slack_sig}`);
    return false;
  }
  if (!crypto.timingSafeEqual(Buffer.from(my_sig), Buffer.from(slack_sig))) {
    console.log(
      `Signatures do not match, ours = ${my_sig}, theirs = ${slack_sig}`
    );
    return false;
  }
  return true;
}

export async function forwardReq(req: NextApiRequest) {
  if (req.url == null) throw "URL is null";
  const path = req.url + "_work";
  const append = crypto.createHash("sha256").update(path).digest("hex");
  const env_name = `PROX2_NONCE_${append.toUpperCase()}`;

  if (process.env[env_name] === undefined) {
    /// create new nonce for use in request
    process.env[env_name] = crypto.randomBytes(256).toString("hex");
  }
  req.headers["x-prox2-nonce"] = process.env[env_name];
  console.log(`New path is ${path}`);
  const req2 = https.request({
    host: req.headers.host,
    path,
    method: "POST",
    headers: req.headers,
  });

  await new Promise((resolve) => {
    req2.end((req as unknown as { rawBody: string }).rawBody, () => {
      resolve(null);
    });
  });
}

export async function validateNonce(req: NextApiRequest) {
  if (req.url == null) throw "URL is null";
  const path = req.url;
  const append = crypto.createHash("sha256").update(path).digest("hex");
  const env_name = `PROX2_NONCE_${append.toUpperCase()}`;

  console.log(`Validating nonce...`);
  const my_nonce = process.env[env_name];
  if (my_nonce === undefined) {
    throw `${env_name} not defined!`;
  }
  const nonce = req.headers["x-prox2-nonce"];
  if (nonce === undefined) {
    throw `Invalid X-Prox2-Nonce`;
  }
  if (
    !crypto.timingSafeEqual(Buffer.from(my_nonce), Buffer.from(nonce as string))
  ) {
    throw `Nonces are not equal!`;
  }
}
