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

import { api_config, failRequest, setupMiddlewares, stageConfession, succeedRequest, validateData, validateNonce, verifySignature } from "../../lib/main";

export const config = api_config;

const HELP = `
Welcome to Prox2! I can help you submit confessions anonymously!

To get started, open a DM with Prox2 (or yourself.) Then, start typing your confession with

/prox2 <confession>

It's as simple as that!

You can reply to an existing confession using the "Reply anonymously" message shortcut, or react to a message in the thread using the "React anonymously" shortcut!

When a confession of yours gets published, I recommend you "follow thread" on it, so that you will be notified if someone replies in its thread.
Prox2 can't do this automatically since it really doesn't know who published the confession.

Prox2 will be open source forever at https://github.com/anirudhb/prox2!
`.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

    try {
        await validateNonce(req);
    } catch (e) {
        console.log(e);
        res.writeHead(400).end();
        return;
    }

    console.log(`Verifying signature...`);
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log(`Invalid!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Valid!`);

    console.log(`Validating request...`);
    const data = await validateData(req);
    if (data == null) {
        console.log(`Invalid request!`);
        res.writeHead(400).end();
        return;
    }

    if (data.text.trim().length <= 0) {
        console.log(`Text is none, sending help!`);
        await failRequest(data.response_url, HELP);
        res.end();
        return;
    }

    // Check if context was in a DM or not
    if (!data.channel_id.startsWith("D")) {
        // Fail since they are trying to use the confessions channel to submit a confession
        // Make sure to include the original command for easy copy-pasting
        console.log(`User tried to stage confession outside of DM!`);
        await failRequest(data.response_url, `Uh oh! You tried to stage a confession outside a DM. Try re-running this command inside a DM:\n/prox2 ${data.text}`);
        res.end();
        return;
    }

    let confession_id;
    try {
        confession_id = await stageConfession(data.text, data.user_id);
    } catch (e) {
        await failRequest(data.response_url, e);
        res.end();
        return;
    }
    console.log(`Notifying user...`);
    await succeedRequest(data.response_url, `Your message has been staged as confession #${confession_id} and will appear here after review by the confessions team!`, true);
    console.log(`Request success`);
    res.writeHead(200).end();
}