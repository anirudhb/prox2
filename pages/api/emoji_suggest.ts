import { NextApiRequest, NextApiResponse } from "next";

import emojis from 'emojis-keywords';
import { setupMiddlewares, verifySignature, web } from "../../lib/main";

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

    if (data.type == 'block_suggestion') {
        console.log(`Block suggestion!`);
        // Enumerate emojis to build select box
        let emojis_list = emojis;
        const custom_emojis = await web.emoji.list();
        if (!custom_emojis.ok) throw `Failed to fetch custom emoji`;
        emojis_list = [...emojis_list, ...Object.keys(custom_emojis.emoji as { [emoji: string]: string }).map(x => `:${x}:`)];
        let search = data.value.replace(/:/g, '');
        emojis_list = emojis_list.filter(emoji => emoji.includes(search)).slice(0, 100);
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