import { NextApiRequest, NextApiResponse } from 'next'

import { validateData, failRequest, succeedRequest, stageConfession, verifySignature, api_config, setupMiddlewares } from '../../lib/main';

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
    console.log(`Validating request...`);
    const data = await validateData(req);
    if (data == null) {
        console.log(`Invalid request!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Acknowledging request...`);
    res.writeHead(200);
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
    res.end();
}