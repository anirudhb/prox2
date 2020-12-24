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