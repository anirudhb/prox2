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

import emojis from 'emojis-keywords';
import { api_config, setupMiddlewares, verifySignature, web, withTimeout } from "../../lib/main";

export const config = api_config;

interface BlockSuggestionInteraction {
    type: 'block_suggestion';
    action_id: 'emoji';
    block_id: 'emoji';
    value: string;
}

// Note:
// We can't put this behind a _work handler like we would with other handlers
// since this requires that we return data in the response itself. That also makes
// it unnecessary as well :)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);
    // console.log(`Rawbody=`);
    // console.log((req as unknown as { rawBody: string }).rawBody);
    // console.log(`Body=`);
    // console.log(JSON.stringify(req.body));
    // console.log(`Setup middlewares`);
    // res.writeHead(204).end();
    // return;

    console.log(`Emoji suggestion!`);
    console.log(`Validating signature...`);
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log(`Invalid!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Valid!`);
    const data = JSON.parse((req.body as { payload: string }).payload) as BlockSuggestionInteraction;
    // console.log(`Success!`);
    // res.writeHead(204).end();
    // return;

    if (data.type == 'block_suggestion') {
        console.log(`Block suggestion!`);
        // Enumerate emojis to build select box
        let emojis_list = emojis;
        let custom_emojis: string[] = [];
        try {
            const custom_emojis_r = await withTimeout(3000, web.emoji.list());
            if (!custom_emojis_r.ok) throw `Failed to fetch custom emoji`;
            custom_emojis = Object.keys(custom_emojis_r.emoji as { [emoji: string]: string }).map(x => `:${x}:`);
        } catch (_) {
            console.log(`Failed to retrieve custom emoji`);
        }
        emojis_list = [...emojis_list, ...custom_emojis];
        let search = data.value.replace(/[^a-zA-Z]/g, '');
        //let search_re = new RegExp(search);
        emojis_list = emojis_list.filter(emoji => emoji.startsWith(':' + search)).slice(0, 100);
        res.json({
            options: emojis_list.map(emoji => {
                return {
                    text: {
                        type: 'plain_text',
                        text: emoji,
                        emoji: true
                    },
                    value: emoji
                }
            })
        });
        console.log(`Request success`);
    } else {
        console.log(`Unknown type ${data.type}`);
    }
}