import { NextApiRequest, NextApiResponse } from 'next';

import { verifySignature, api_config, setupMiddlewares, forwardReq } from '../../lib/main';

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
    await forwardReq(req);
    console.log(`Acknowledging request...`);
    res.writeHead(200).end();
}