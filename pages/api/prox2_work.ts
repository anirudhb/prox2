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
        await failRequest(data.response_url, `Uh oh! Try again with a message you\'d like to confess!
Tip: Draft your confession in a DM so others don\'t see that you\'re typing!`);
        res.end();
        return;
    }
    try {
        await stageConfession(data.text, data.user_id);
    } catch (e) {
        await failRequest(data.response_url, e);
        res.end();
        return;
    }
    console.log(`Notifying user...`);
    await succeedRequest(data.response_url, 'Your message has been staged and will appear here after review by the confessions team!');
    console.log(`Request success`);
    res.writeHead(200).end();
}