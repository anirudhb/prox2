import Airtable from 'airtable';
import { WebClient } from '@slack/web-api';

import { NextApiRequest } from 'next';

import { token, airtable_api_key, airtable_base, staging_channel, confessions_channel } from '../secrets';

export const web = new WebClient(token);

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: airtable_api_key,
    apiVersion: Airtable.apiVersion,
    noRetryIfRateLimited: Airtable.noRetryIfRateLimited
});

export const base = Airtable.base(airtable_base);
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

export async function succeedRequest(data: CommandData, message: string) {
    console.log(`Succeeding with message: ${message}`);
    await fetch(data.response_url, {
        method: 'POST',
        body: JSON.stringify({
            response_type: 'ephemeral',
            text: message
        })
    });
}

export async function stageConfession(message: string): Promise<void> {
    console.log(`Staging confession...`);
    console.log(`Inserting into Airtable...`);
    let record;
    try {
        record = await table.create({
            text: message,
            approved: false
        } as Partial<TableRecord>);
    } catch (_) {
        throw 'Failed to insert Airtable record';
    }
    console.log(`Inserted!`);
    console.log(`Posting message to staging channel...`);
    const fields = record.fields as TableRecord;
    const staging_message = await web.chat.postMessage({
        channel: staging_channel,
        text: `(staging) ${fields.id}: ${fields.text}`,
    });
    if (!staging_message.ok) {
        console.log(`Failed to post message. Rolling back Airtable record...`);
        await record.destroy();
        console.log(`Rolled back changes. Notifying user...`);
        throw 'Failed to post message to staging channel';
    }
    console.log(`Posted message!`);
    console.log(`Updating Airtable record...`);
    try {
        await record.patchUpdate({
            staging_ts: staging_message.ts as string,
        } as Partial<TableRecord>);
    } catch (_) {
        throw 'Failed to update Airtable record';
    }
    console.log(`Updated!`);
}

export async function approveConfession(staging_ts: string): Promise<void> {
    console.log(`Approving confession with staging_ts=${staging_ts}...`);
    // Check if message is in Airtable
    let records;
    try {
        records = await (await table.select({
            filterByFormula: `{staging_ts} = ${staging_ts}`
        })).firstPage();
    } catch (_) {
        throw `Failed to fetch Airtable record!`;
    }
    if (records.length == 1) {
        const record = records[0];
        const fields = record.fields as TableRecord;
        // Publish record and update
        console.log(`Publishing message...`);
        const published_message = await web.chat.postMessage({
            channel: confessions_channel,
            text: `${fields.id}: ${fields.text}`
        });
        if (!published_message.ok) {
            throw `Failed to publish message!`;
        }
        console.log(`Published message!`);
        console.log(`Updating Airtable record...`);
        try {
            await record.patchUpdate({
                approved: true,
                published_ts: published_message.ts as string
            } as Partial<TableRecord>);
        } catch (_) {
            throw `Failed to update Airtable record`;
        }
        console.log(`Updated!`);
    } else {
        throw `Failed to find single record with staging_ts=${staging_ts}, got ${records.length}`;
    }
}