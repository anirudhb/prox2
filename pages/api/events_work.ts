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
import {
  api_config,
  setupMiddlewares,
  stageDMConfession,
  validateNonce,
  verifySignature,
} from "../../lib/main";

export const config = api_config;

interface UrlVerificationEvent {
  type: "url_verification";
  token?: string;
  challenge: string;
}

interface DMEvent {
  type: "message";
  subtype?: "bot_message";
  channel_type: "im";
  ts: string;
  text: string;
  user: string;
  bot_profile?: {
    app_id: string;
  };
  channel: string;
}

export type SlackEventPayload =
  | UrlVerificationEvent
  | {
      type: "event_callback";
      event: DMEvent;
    };

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

  console.log(`Event!`);
  console.log(`Validating signature...`);
  const isValid = verifySignature(req);
  if (!isValid) {
    console.log(`Invalid!`);
    res.writeHead(400).end();
    return;
  }
  console.log(`Valid!`);
  const payload = req.body as SlackEventPayload;
  console.log(`Type = ${payload.type}`);
  if (payload.type == "event_callback") {
    const data = payload.event;
    if (data.type == "message" && data.channel_type == "im") {
      console.log("DM!");
      if (!data.bot_profile && data.subtype != "bot_message") {
        // Handle DM staging...
        console.log(`User = ${data.user}, ts = ${data.ts}, subtype = ${data.subtype}`);
        await stageDMConfession(data.ts, data.user);
      }
    }
  }
  console.log(`Request success`);
  res.writeHead(204).end();
}
