import { NextApiRequest, NextApiResponse } from 'next';
import { api_config, setupMiddlewares, validateNonce, verifySignature, web } from '../../lib/main';

import { confessions_channel } from '../../lib/secrets_wrapper';

export const config = api_config;

interface UrlVerificationEvent {
    type: 'url_verification';
    token?: string;
    challenge: string;
}

interface DMEvent {
    type: 'message';
    channel_type: 'im';
    text: string;
    user: string;
    bot_profile?: {
        app_id: string;
    };
    channel: string;
}

export type SlackEventPayload = UrlVerificationEvent | {
    type: 'event_callback';
    event: DMEvent;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    if (payload.type == 'event_callback') {
        const data = payload.event;
        console.log(JSON.stringify(payload.event, null, 2));
        if (data.type == 'message' && data.channel_type == 'im') {
            console.log('DM!');
            if (!data.bot_profile) {
                await web.chat.postMessage({
                    channel: data.channel,
                    text: `Uh oh! You can't DM me! Try typing /prox2 in <#${confessions_channel}> to get started!`,
                });
            }
        }
    }
    console.log(`Request success`);
    res.writeHead(204).end();
}