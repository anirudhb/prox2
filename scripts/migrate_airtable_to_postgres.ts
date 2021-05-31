import 'reflect-metadata';

import getRepository from './../lib/db.js';

import {
    airtable_api_key,
    airtable_base,
    airtable_table,
} from './../lib/secrets_wrapper.js';

import Airtable from 'airtable';

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: airtable_api_key,
    apiVersion: Airtable.apiVersion,
    noRetryIfRateLimited: Airtable.noRetryIfRateLimited,
});

const base = Airtable.base(airtable_base);
const table = base.table(airtable_table);

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
            function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.

                records.forEach(async function (record) {
                    console.log('Retrieved', record.get('id'));

                    await repo.save({
                        // `typeorm` requires all fields to be here for some reason, even though they should be optional, so I am just setting them to `false` or `''`.
                        text: 'message',
                        approved: false,
                        viewed: false,
                        uid_salt: '',
                        uid_hash: '',
                        staging_ts: '',
                        published_ts: '',
                        ...record.fields,
                    });
                });

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
