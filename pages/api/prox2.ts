import { NextApiRequest, NextApiResponse } from 'next'

import { validateData, failRequest, succeedRequest, stageConfession } from '../../lib/main';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(`Request!`);
    console.log(`Validating request...`);
    const data = await validateData(req);
    if (data == null) {
        console.log(`Invalid request!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Acknowledging request...`);
    res.writeHead(200).end();
    if (data.text.trim().length <= 0) {
        console.log(`Text is none, sending help!`);
        return await failRequest(data.response_url, 'Uh oh! Try again with a message you\'d like to confess!');
    }
    try {
        await stageConfession(data.text, data.user_id);
    } catch (e) {
        return await failRequest(data.response_url, e);
    }
    console.log(`Notifying user...`);
    await succeedRequest(data.response_url, 'Your message has been staged and will appear here after review by the confessions team!');
    console.log(`Request success`);
}