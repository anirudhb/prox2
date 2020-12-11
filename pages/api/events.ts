import { NextApiRequest, NextApiResponse } from 'next';
import { api_config, approveConfession, setupMiddlewares, verifySignature } from '../../lib/main';

import { staging_channel } from '../../secrets';

export const config = api_config;

interface UrlVerificationEvent {
    type: 'url_verification';
    token?: string;
    challenge: string;
}

interface ReactionAddedEvent {
    type: 'reaction_added';
    user: string;
    reaction: string;
    item_user?: string;
    item: {
        type: 'message';
        channel: string;
        ts: string;
    };
    event_ts: string;
}

type SlackEventPayload = UrlVerificationEvent | {
    type: 'event_callback';
    event: ReactionAddedEvent;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

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
    if (payload.type == 'url_verification') {
        console.log(`Responding with value of challenge...`);
        res.end(payload.challenge);
        return;
    } else if (payload.type == 'event_callback') {
        const data = payload.event;
        if (data.type == 'reaction_added') {
            console.log(`Reaction added!`);
            console.log(`Reaction = ${data.reaction} user = ${data.user} channel = ${data.item.channel} ts = ${data.item.ts}`);
            if (data.reaction == 'true' && data.item.channel == staging_channel) {
                try {
                    await approveConfession(data.item.ts);
                } catch (e) {
                    console.log(e);
                    res.writeHead(500).end();
                    return;
                }
            }
        }
    }
    console.log(`Request success`);
    res.writeHead(204).end();
}