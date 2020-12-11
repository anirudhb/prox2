import Airtable from 'airtable';
import { WebClient } from '@slack/web-api';

import { NextApiRequest } from 'next';

import { token, airtable_api_key } from '../token';

export const web = new WebClient(token);

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: airtable_api_key,
    apiVersion: Airtable.apiVersion,
    noRetryIfRateLimited: Airtable.noRetryIfRateLimited
});

export const base = Airtable.base('appt7EdY82RgaB5SR');
export const table = base.table('Main');

export interface CommandData {
    token?: string;
    command: string;
    text: string;
    response_url: string;
    trigger_id: string;
    user_id: string;
    user_name?: string;
    team_id: string;
    enterprise_id?: string;
    channel_id: string;
    api_app_id: string;
};

export function isCommandData(x: any): x is CommandData {
    return (x.token == undefined || typeof x.token == 'string')
        && typeof x.command == 'string'
        && typeof x.text == 'string'
        && typeof x.response_url == 'string'
        && typeof x.trigger_id == 'string'
        && typeof x.user_id == 'string'
        && (x.user_name == undefined || typeof x.user_name == 'string')
        && typeof x.team_id == 'string'
        && (x.enterprise_id == undefined || typeof x.enterprise_id == 'string')
        && typeof x.channel_id == 'string'
        && typeof x.api_app_id == 'string';
}

export interface TableRecord {
    id: number;
    approved: boolean;
    text: string;
    staging_ts: string;
    published_ts: string;
};

export async function validateData(req: NextApiRequest): Promise<CommandData | null> {
    if (!isCommandData(req.body)) {
        return null;
    } else {
        return req.body;
    }
}

export async function failRequest(data: CommandData, error: string) {
    console.log(`Failing with error: ${error}`);
    await fetch(data.response_url, {
        method: 'POST',
        body: JSON.stringify({
            response_type: 'ephemeral',
            text: error
        })
    });
}