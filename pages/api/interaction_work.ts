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

import { NextApiRequest, NextApiResponse } from "next";

import { Block, KnownBlock } from "@slack/web-api";

import {
  api_config,
  failRequest,
  setupMiddlewares,
  validateNonce,
  verifySignature
} from "../../lib/main";
import block_action from "../../lib/interaction_handlers/block_action";
import message_action from "../../lib/interaction_handlers/message_action";
import view_submission from "../../lib/interaction_handlers/view_submission";

export const config = api_config;

export interface BlockActionInteraction {
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
    edited?: {
      user: string;
      ts: string;
    }
  };
  actions: {
    block_id: string;
    action_id: string;
    value: string;
  }[];
  token?: string;
  hash: string;
}

export interface MessageActionInteraction {
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

export interface ViewSubmissionInteraction {
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

export type InteractionHandler<T extends SlackInteractionPayload> = (data: T, res: NextApiResponse) => Promise<boolean>;

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

  const data = JSON.parse(
    (req.body as { payload: string }).payload
  ) as SlackInteractionPayload;
  console.log(`Type = ${data.type}`);
  const handler = {
    "block_actions": block_action,
    "message_action": message_action,
    "view_submission": view_submission,
  }[data.type];

  if(!handler) {
    console.log("Invalid interaction type!", data.type);
  } else {
    try {
      console.log("Handling interaction", data.type);
      //@ts-expect-error
      if(!await handler(data, res)) return;
    } catch (e) {
      console.log(e);
      if(data.type !== "view_submission") {
        await failRequest(data.response_url, typeof e === "string" ? e : JSON.stringify(e));
      }
      res.writeHead(500).end();
      return;
    }
  }

  console.log(`Request success`);
  res.writeHead(204).end();
}
