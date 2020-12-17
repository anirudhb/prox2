import crypto from 'crypto';
import http from 'http';

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
    const req2 = http.request({
        host: req.headers.host,
        path: '/api/prox2_work',
        method: 'POST',
        headers: req.headers,
    });
    await new Promise(resolve => {
        req2.end((req as unknown as { rawBody: string }).rawBody, () => {
            resolve(null);
        });
    });
    console.log(`Acknowledging request...`);
    res.writeHead(200).end();

}