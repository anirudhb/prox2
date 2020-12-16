import crypto from 'crypto';

import { NextApiRequest, NextApiResponse } from "next";

import { api_config, failRequest, setupMiddlewares, stageConfession, succeedRequest, validateData } from "../../lib/main";

export const config = api_config;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

    console.log(`Validating nonce...`);
    const my_nonce = process.env.PROX2_NONCE;
    if (my_nonce === undefined) {
        throw `PROX2_NONCE not defined!`;
    }
    const nonce = req.headers['x-prox2-nonce'];
    if (nonce === undefined) {
        console.log(`Invalid X-Prox2-Nonce`);
        res.writeHead(400).end();
        return;
    }
    if (!crypto.timingSafeEqual(Buffer.from(my_nonce), Buffer.from(nonce))) {
        console.log(`Nonces are not equal!`);
        res.writeHead(400).end();
        return;
    }

    console.log(`Validating request...`);
    const data = await validateData(req);
    if (data == null) {
        console.log(`Invalid request!`);
        res.writeHead(400).end();
        return;
    }

    console.log(`Fake 5s delay to see if Slack still works...`);
    await new Promise(r => setTimeout(r, 5000));
    if (data.text.trim().length <= 0) {
        console.log(`Text is none, sending help!`);
        res.end();
        return await failRequest(data.response_url, `Uh oh! Try again with a message you\'d like to confess!
Tip: Draft your confession in a DM so others don\'t see that you\'re typing!`);
    }
    try {
        await stageConfession(data.text, data.user_id);
    } catch (e) {
        res.end();
        return await failRequest(data.response_url, e);
    }
    console.log(`Notifying user...`);
    await succeedRequest(data.response_url, 'Your message has been staged and will appear here after review by the confessions team!');
    console.log(`Request success`);
    res.writeHead(200).end();
}