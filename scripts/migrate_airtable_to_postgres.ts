import 'reflect-metadata';

import getRepository from './../lib/db';

import {
    airtable_api_key,
    airtable_base,
} from './../lib/secrets_wrapper';

import Airtable from 'airtable';
import {Confession} from './../lib/models';

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: airtable_api_key!,
    apiVersion: Airtable.apiVersion,
    noRetryIfRateLimited: Airtable.noRetryIfRateLimited,
});

const base = Airtable.base(airtable_base!);
const table = base.table("Main");

(async () => {
    const repo = await getRepository();

    table
        .select
        // {
        // // Selecting the first 100 records in Grid view:
        // maxRecords: 100,
        // view: 'Grid view',
        // }
        ()
        .eachPage(
            async function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.

                const batch = records.map(record => ({
                    text: record.fields.text ?? '',
                    approved: record.fields.approved ?? false,
                    viewed: record.fields.viewed ?? false,
                    uid_salt: record.fields.uid_salt ?? '',
                    uid_hash: record.fields.uid_hash ?? '',
                    staging_ts: record.fields.staging_ts ?? '',
                    published_ts: record.fields.published_ts ?? '',
                    id: record.fields.id,
                } as Confession));
                await repo.save(batch);
                console.log(`Saved ${records.length} new records`);

                // To fetch the next page of records, call `fetchNextPage`.
                // If there are more records, `page` will get called again.
                // If there are no more records, `done` will get called.
                fetchNextPage();
            },
            function done(err) {
                if (err) {
                    console.error(err);
                    return;
                }
            },
        );
})();
