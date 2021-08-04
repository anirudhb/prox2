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

import { Block, KnownBlock } from "@slack/web-api";
import { NextApiRequest, NextApiResponse } from "next";
import { In } from "typeorm";
import {
  Blocks,
  ExternalSelectAction,
  InputSection,
  MarkdownText,
  PlainText,
  PlainTextInput,
  TextSection,
} from "../../lib/block_builder";
import getRepository from "../../lib/db";
import {
  api_config,
  failRequest,
  sameUser,
  setupMiddlewares,
  stageConfession,
  succeedRequest,
  validateNonce,
  verifySignature,
  viewConfession,
  web,
} from "../../lib/main";
import { sanitize } from "../../lib/sanitizer";
import { confessions_channel } from "../../lib/secrets_wrapper";

export const config = api_config;

interface BlockActionInteraction {
  type: "block_actions";
  trigger_id: string;
  response_url: string;
  user: {
    id: string;
  };
  channel: {
    id: string;
    name: string;
  };
  message: {
    type: "message";
    text: string;
    ts: string;
    thread_ts?: string;
  };
  actions: {
    block_id: string;
    action_id: string;
    value: string;
  }[];
  token?: string;
  hash: string;
}

interface MessageActionInteraction {
  type: "message_action";
  callback_id: string;
  trigger_id: string;
  response_url: string;
  user: {
    id: string;
  };
  message: {
    type: "message";
    text: string;
    ts: string;
    thread_ts?: string;
  };
  channel: {
    id: string;
  };
  token?: string;
}

interface ViewSubmissionInteraction {
  type: "view_submission";
  user: {
    id: string;
  };
  view: {
    callback_id: string;
    blocks: (Block | KnownBlock)[];
    state: {
      values: {
        [key: string]: {
          [input: string]:
            | {
                type: "plain_text_input";
                value: string;
              }
            | {
                type: "external_select";
                selected_option: {
                  value: string;
                };
              };
        };
      };
    };
  };
}

type SlackInteractionPayload =
  | MessageActionInteraction
  | ViewSubmissionInteraction
  | (BlockActionInteraction & {
      type: string;
    });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await setupMiddlewares(req, res);

  try {
    await validateNonce(req);
  } catch (e) {
    console.log(e);
    res.writeHead(400).end();
    return;
  }

  console.log(`Interaction!`);
  console.log(`Validating signature...`);
  const isValid = verifySignature(req);
  if (!isValid) {
    console.log(`Invalid!`);
    res.writeHead(400).end();
    return;
  }
  console.log(`Valid!`);
  const repo = await getRepository();
  const data = JSON.parse(
    (req.body as { payload: string }).payload
  ) as SlackInteractionPayload;
  console.log(`Type = ${data.type}`);
  if (data.type == "block_actions") {
    console.log(`Block action!`);
    if (data.actions.length > 0) {
      const action = data.actions[0];
      try {
        if (action.value == "approve") {
          console.log(`Approval of message ts=${data.message.ts}`);
          await viewConfession(repo, data.message.ts, true, data.user.id);
        } else if (action.value == "disapprove") {
          console.log(`Disapproval of message ts=${data.message.ts}`);
          await viewConfession(repo, data.message.ts, false, data.user.id);
        } else if (action.value == "stage") {
          console.log(`Stage of message thread_ts=${data.message.thread_ts}`);
          // Get message contents
          const resp = await web.conversations.history({
            channel: data.channel.id,
            inclusive: true,
            latest: data.message.thread_ts,
            limit: 1,
          });
          if (!resp.ok) {
            throw `Failed to fetch message contents!`;
          }
          const message_contents = (resp as any).messages[0].text;
          // Stage
          const id = await stageConfession(
            repo,
            message_contents,
            data.user.id
          );
          // Edit
          const resp2 = await web.chat.update({
            channel: data.channel.id,
            ts: data.message.ts,
            text: "",
            blocks: new Blocks([
              new TextSection(
                new MarkdownText(`:true: Staged as confession #${id}`),
                null,
                null
              ),
            ]).render(),
          });
          if (!resp2.ok) {
            throw `Failed to update message!`;
          }
        } else if (action.value == "cancel") {
          console.log(`Cancel of message thread_ts=${data.message.thread_ts}`);
          const resp = await web.chat.delete({
            channel: data.channel.id,
            ts: data.message.ts,
          });
          if (!resp.ok) {
            throw `Failed to delete message!`;
          }
        } else {
          console.log(`Unknown value ${action.value}`);
        }
      } catch (e) {
        await failRequest(data.response_url, e);
        res.writeHead(500).end();
        return;
      }
    } else {
      console.log(`No action found`);
    }
  } else if (data.type == "message_action") {
    console.log(`Message action!`);
    try {
      if (data.channel.id != confessions_channel) {
        throw "Invalid channel ID";
      }
      if (data.callback_id == "reply_anonymous") {
        // try to fetch record
        const record = await repo.findOne({ published_ts: data.message.ts });
        if (record === undefined) {
          throw `Failed to find single Postgres record with published_ts=${data.message.ts}`;
        }

        // Check user...
        if (!sameUser(record, data.user.id)) {
          await succeedRequest(
            data.response_url,
            "You are not the original poster of the confession, so you cannot reply anonymously."
          );
          res.writeHead(200).end();
          return;
        }

        const resp = await web.views.open({
          trigger_id: data.trigger_id,
          view: {
            callback_id: `reply_modal_${record.published_ts}`,
            type: "modal",
            title: new PlainText(`Replying to #${record.id}`).render(),
            submit: new PlainText("Reply").render(),
            close: new PlainText("Cancel").render(),
            blocks: new Blocks([
              new InputSection(
                new PlainTextInput("confession_reply", true),
                new PlainText("Reply"),
                "reply"
              ),
            ]).render(),
          },
        });
        if (!resp.ok) {
          throw "Failed to open modal";
        }
      } else if (data.callback_id == "react_anonymous") {
        // try to fetch record
        let valid_ts = [data.message.ts];
        if (data.message.thread_ts !== undefined)
          valid_ts.push(data.message.thread_ts);
        const record = await repo.findOne({ published_ts: In(valid_ts) });
        if (record === undefined) {
          throw `Failed to find single Postgres record with published_ts=${data.message.ts}`;
        }

        // Check user...
        if (!sameUser(record, data.user.id)) {
          await succeedRequest(
            data.response_url,
            "You are not the original poster of the confession, so you cannot react anonymously."
          );
          res.writeHead(200).end();
          return;
        }

        const modal_res = await web.views.open({
          trigger_id: data.trigger_id,
          view: {
            type: "modal",
            callback_id: `react_modal_${record.published_ts}_${data.message.ts}`,
            title: new PlainText(`Reacting to #${record.id}`).render(),
            submit: new PlainText("React").render(),
            close: new PlainText("Cancel").render(),
            blocks: new Blocks([
              new TextSection(
                new PlainText("Pick an emoji to react with"),
                "emoji",
                new ExternalSelectAction(
                  new PlainText("Select an emoji"),
                  2,
                  "emoji"
                )
              ),
            ]).render(),
          },
        });
        if (!modal_res.ok) throw `Failed to open modal`;
      } else if (data.callback_id == "delete_confession") {
        // try to fetch record
        let valid_ts = [data.message.ts];
        if (data.message.thread_ts !== undefined)
          valid_ts.push(data.message.thread_ts);
        const record = await repo.findOne({ published_ts: In(valid_ts) });
        if (record === undefined) {
          throw `Failed to find single Postgres record with published_ts=${data.message.ts}`;
        }

        // Check user...
        if (!sameUser(record, data.user.id)) {
          await succeedRequest(
            data.response_url,
            "You are not the original poster of the confession, so you cannot react anonymously."
          );
          res.writeHead(200).end();
          return;
        }
        await web.chat.delete({
          channel: confessions_channel,
          ts: data.message.thread_ts!,
        });
        await repo.delete(record);
        await succeedRequest(data.response_url, "Whoosh. It's gone now!");
        res.writeHead(200).end();
        return;
      } else {
        console.log(`Unknown callback ${data.callback_id}`);
      }
    } catch (e) {
      await failRequest(data.response_url, JSON.stringify(e));
      res.writeHead(500).end();
      return;
    }
  } else if (data.type == "view_submission") {
    console.log(`View submission!`);
    try {
      if (data.view.callback_id.startsWith("reply_modal")) {
        const published_ts_res = /^reply_modal_(.*)$/.exec(
          data.view.callback_id
        );
        if (!published_ts_res) throw "Failed to exec regex";
        const published_ts = published_ts_res[1];
        if (!published_ts) throw "Failed to get regex group";

        // try to fetch record
        const record = await repo.findOne({ published_ts });
        if (record === undefined) {
          throw `Failed to find single Postgres record with published_ts=${published_ts}`;
        }

        // Check user...
        if (!sameUser(record, data.user.id)) {
          // update view
          res.json({
            response_action: "update",
            view: {
              ...data.view,
              blocks: [
                ...data.view.blocks,
                new TextSection(
                  new MarkdownText(
                    "Failed to reply: \
You are not the original poster of the confession, so cannot reply anonymously.*"
                  )
                ).render(),
              ],
            },
          } as {
            response_action: "update";
            view: {
              blocks: any[];
            };
          });
          return;
          // throw `Different user, cannot reply!`;
        }

        // quick assert for typeck
        if (
          data.view.state.values.reply.confession_reply.type !=
          "plain_text_input"
        )
          return;

        // Reply in thread
        const r = await web.chat.postMessage({
          channel: confessions_channel,
          text: sanitize(data.view.state.values.reply.confession_reply.value),
          thread_ts: published_ts,
        });
        if (!r.ok) throw `Failed to reply in thread`;
      } else if (data.view.callback_id.startsWith("react_modal")) {
        const published_ts_res = /^react_modal_(.*)_(.*)$/.exec(
          data.view.callback_id
        );
        if (!published_ts_res) throw "Failed to exec regex";
        const [published_ts, thread_ts] = [
          published_ts_res[1],
          published_ts_res[2],
        ];
        if (!published_ts || !thread_ts) throw "Failed to get regex group";

        // try to fetch record
        const record = await repo.findOne({ published_ts });
        if (record === undefined) {
          throw `Failed to find single Postgres record with published_ts=${published_ts}`;
        }

        // Check user...
        if (!sameUser(record, data.user.id)) {
          // update view
          res.json({
            response_action: "update",
            view: {
              ...data.view,
              blocks: [
                ...data.view.blocks,
                new TextSection(
                  new MarkdownText(
                    "Failed to react: \
 *You are not the original poster of the confession, so cannot react anonymously.*"
                  )
                ).render(),
              ],
            },
          } as {
            response_action: "update";
            view: {
              blocks: any[];
            };
          });
          return;
          // throw `Different user, cannot reply!`;
        }

        // quick assert for typeck
        if (data.view.state.values.emoji.emoji.type != "external_select")
          return;

        // React to message
        const react_res = await web.reactions.add({
          name: data.view.state.values.emoji.emoji.selected_option.value.replace(
            /\:/g,
            ""
          ),
          channel: confessions_channel,
          timestamp: thread_ts,
        });
        if (!react_res.ok) throw `Failed to react`;
      }
    } catch (e) {
      console.log(e);
      res.writeHead(500).end();
      return;
    }
  }
  console.log(`Request success`);
  res.writeHead(204).end();
}
