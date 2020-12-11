import { NextApiRequest, NextApiResponse } from 'next'

import { web, table, validateData, failRequest, TableRecord } from '../../lib/main';
import { staging_channel } from '../../token';

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
        await fetch(data.response_url, {
            method: 'POST',
            body: JSON.stringify({
                response_type: 'ephemeral',
                text: 'Uh oh! Try again with a message you\'d like to confess!'
            })
        });
        return;
    }
    // console.log(`Sending ephermal progress...`);
    // const ephemeral_res = await fetch(data.response_url, {
    //     method: 'POST',
    //     body: JSON.stringify({
    //         response_type: 'ephemeral',
    //         text: 'Working on it...'
    //     })
    // });
    // const ephemeral_ts = ((await ephemeral_res.json()) as { ts: string }).ts;
    console.log(`Inserting into Airtable...`);
    let record;
    try {
        record = await table.create({
            text: data.text,
            approved: false
        } as Partial<TableRecord>);
    } catch (_) {
        return await failRequest(data, 'Failed to insert Airtable record');
    }
    console.log(`Inserted!`);
    console.log(`Posting message to staging channel...`);
    const fields = record.fields as TableRecord;
    const staging_message = await web.chat.postMessage({
        channel: staging_channel,
        text: `${fields.id}: ${fields.text}`,
    });
    if (!staging_message.ok) {
        console.log(`Failed to post message. Rolling back Airtable record...`);
        await record.destroy();
        console.log(`Rolled back changes. Notifying user...`);
        return await failRequest(data, 'Failed to post message to staging channel');
    }
    console.log(`Posted message!`);
    console.log(`Updating Airtable record...`);
    try {
        await record.patchUpdate({
            staging_ts: staging_message.ts as string,
        } as Partial<TableRecord>);
    } catch (_) {
        return await failRequest(data, 'Failed to update Airtable record');
    }
    console.log(`Updated!`);
    console.log(`Notifying user...`);
    await fetch(data.response_url, {
        method: 'POST',
        body: JSON.stringify({
            response_type: 'ephemeral',
            text: 'Your message has been staged and will appear here after review by the confessions team!'
        })
    });
    // console.log(`Deleting ephemeral...`);
    // await web.chat.delete({
    //     channel: data.channel_id,
    //     ts: ephemeral_ts
    // });
    // console.log(`Deleting ephmeral...`)
    // await fetch(data.response_url, {
    //     method: 'POST',
    //     body: JSON.stringify({
    //         // replace_original: 'true',
    //         // text: 'Done! Your message has been published anonymously.'
    //         delete_original: 'true'
    //     })
    // })
    console.log(`Request success`);
}