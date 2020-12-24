import { NextApiRequest, NextApiResponse } from 'next';

import { verifySignature, api_config, setupMiddlewares, forwardReq } from '../../lib/main';
import { SlackEventPayload } from './events_work';

export const config = api_config;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

    console.log(`Request!`);
    console.log(`Verifying signature...`);
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log(`Invalid!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Valid!`);
    console.log(`Inspecting request to see if url_verification...`);
    const payload = req.body as SlackEventPayload;
    console.log(`Type = ${payload.type}`);
    if (payload.type == 'url_verification') {
        console.log(`URL verification: Responding with value of challenge...`);
        res.end(payload.challenge);
    } else {
        console.log(`Starting real work in new request...`);
        await forwardReq(req);
        console.log(`Acknowledging request...`);
        res.writeHead(200).end();
    }
}