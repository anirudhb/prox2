import { NextApiRequest, NextApiResponse } from "next";

import { api_config, failRequest, setupMiddlewares, verifySignature, viewConfession } from "../../lib/main";

export const config = api_config;

interface BlockActionInteraction {
    type: 'block_actions';
    trigger_id: string;
    response_url: string;
    user: string;
    message: {
        type: 'message';
        text: string;
        ts: string;
    };
    actions: {
        block_id: string;
        action_id: string;
        value: string;
    }[];
    token?: string;
    hash: string;
}

type SlackInteractionPayload = BlockActionInteraction & {
    type: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

    console.log(`Interaction!`);
    console.log(`Validating signature...`);
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log(`Invalid!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Valid!`);
    const data = JSON.parse((req.body as { payload: string }).payload) as SlackInteractionPayload;
    console.log(`Type = ${data.type}`);
    if (data.type == 'block_actions') {
        console.log(`Block action!`);
        if (data.actions.length > 0) {
            const action = data.actions[0];
            try {
                if (action.value == 'approve') {
                    console.log(`Approval of message ts=${data.message.ts}`);
                    await viewConfession(data.message.ts, true);
                } else if (action.value == 'disapprove') {
                    console.log(`Disapproval of message ts=${data.message.ts}`);
                    await viewConfession(data.message.ts, false);
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
    }
    console.log(`Request success`);
    res.writeHead(204).end();
}