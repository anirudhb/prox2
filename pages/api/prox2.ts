import crypto from 'crypto';

import { NextApiRequest, NextApiResponse } from 'next';

import { verifySignature, api_config, setupMiddlewares } from '../../lib/main';

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
    console.log(`Starting real work in new request...`);
    if (process.env.PROX2_NONCE === undefined) {
        /// create new nonce for use in request
        process.env.PROX2_NONCE = crypto.randomBytes(256).toString('hex');
    }
    req.headers['x-prox2-nonce'] = process.env.PROX2_NONCE;
    fetch('https://' + req.headers.host + '/api/prox2_work', {
        headers: req.headers as any,
        method: 'POST',
        body: (req as unknown as { rawBody: string }).rawBody,
    });
    console.log(`Acknowledging request...`);
    res.writeHead(200).end();

}