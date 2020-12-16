// Safe wrapper around secrets,
// which tries secrets.ts first
// then falls back to env variables.
import fs from 'fs';

export let token: string;
export let airtable_api_key: string;
export let airtable_base: string;
export let staging_channel: string;
export let confessions_channel: string;
export let slack_signing_secret: string;

function check_env(name: string): string {
    const val = process.env[name];
    if (val === undefined) {
        throw `Check failed: ${name} is undefined`;
    }
    return val;
}

try {
    const contents = fs.readFileSync('./secrets.json', { encoding: 'utf-8' });
    const secrets = JSON.parse(contents);
    token = secrets.token;
    airtable_api_key = secrets.airtable_api_key;
    airtable_base = secrets.airtable_base;
    staging_channel = secrets.staging_channel;
    confessions_channel = secrets.confessions_channel;
    slack_signing_secret = secrets.slack_signing_secret;
} catch (_) {
    token = check_env('SLACK_BOT_TOKEN');
    airtable_api_key = check_env('AIRTABLE_API_KEY');
    airtable_base = check_env('AIRTABLE_BASE_ID');
    staging_channel = check_env('STAGING_CHANNEL_ID');
    confessions_channel = check_env('CONFESSIONS_CHANNEL_ID');
    slack_signing_secret = check_env('SLACK_SIGNING_SECRET');
}