import crypto from 'crypto';

import { NextApiRequest, NextApiResponse } from 'next';
import { approveConfession } from '../../lib/main';

import { slack_signing_secret, staging_channel } from '../../secrets';

function verifySignature(req: NextApiRequest): boolean {
    const timestamp = req.headers['x-slack-request-timestamp'];
    if (timestamp == undefined || typeof timestamp != 'string') {
        console.log(`Invalid X-Slack-Request-Timestamp`);
        return false;
    }
    const timestamp_int = parseInt(timestamp, 10);
    const current_timestamp_int = Math.floor(Date.now() / 1000);
    if (Math.abs(current_timestamp_int - timestamp_int) > 60 * 5) {
        // >5min, invalid (possibly replay attack)
        console.log(`Timestamp is more than 5 minutes from local time, possible replay attack!`);
        console.log(`Our timestamp was ${current_timestamp_int}; theirs was ${timestamp_int}`);
        return false;
    }
    const sig_base = 'v0:' + timestamp + ':' + JSON.stringify(req.body);
    const my_sig = 'v0=' + crypto.createHmac('sha256', slack_signing_secret)
        .update(sig_base)
        .digest('hex');
    const slack_sig = req.headers['x-slack-signature'];
    if (slack_sig == 'undefined' || typeof slack_sig != 'string') {
        console.log(`Invalid X-Slack-Signature`);
        return false;
    }
    if (!crypto.timingSafeEqual(Buffer.from(my_sig), Buffer.from(slack_sig))) {
        console.log(`Signatures do not match`);
        return false;
    }
    return true;
}

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