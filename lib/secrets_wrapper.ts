// Prox2
// Copyright (C) 2020  anirudhb
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Safe wrapper around secrets,
// which tries secrets.ts first
// then falls back to env variables.
import fs from "fs";

export let token: string;
export let airtable_api_key: string | null;
export let airtable_base: string | null;
export let staging_channel: string;
export let confessions_channel: string;
export let meta_channel: string;
export let confessions_meta_channel: string;
export let slack_signing_secret: string;
export let postgres_url: string;

function check_env(name: string): string {
  const val = process.env[name];
  if (val === undefined) {
    throw `Check failed: ${name} is undefined`;
  }
  return val;
}

function check_null_env(name: string): string | null {
  const val = process.env[name]
  return val ?? null;
}

try {
  const contents = fs.readFileSync("./secrets.json", { encoding: "utf-8" });
  const secrets = JSON.parse(contents);
  token = secrets.token;
  staging_channel = secrets.staging_channel;
  confessions_channel = secrets.confessions_channel;
  meta_channel = secrets.meta_channel;
  confessions_meta_channel = secrets.confessions_meta_channel;
  slack_signing_secret = secrets.slack_signing_secret;
  postgres_url = secrets.postgres_url;
  airtable_api_key = secrets.airtable_api_key ?? null;
  airtable_base = secrets.airtable_base ?? null;
} catch (_) {
  token = check_env("SLACK_BOT_TOKEN");
  staging_channel = check_env("STAGING_CHANNEL_ID");
  confessions_channel = check_env("CONFESSIONS_CHANNEL_ID");
  meta_channel = check_env("META_CHANNEL_ID");
  confessions_meta_channel = check_env("CONFESSIONS_META_CHANNEL_ID");
  slack_signing_secret = check_env("SLACK_SIGNING_SECRET");
  postgres_url = check_env("POSTGRES_URL");
  airtable_api_key = null;
  airtable_base = null;
}

if (airtable_api_key == null) airtable_api_key = check_null_env("AIRTABLE_API_KEY");
if (airtable_base == null) airtable_base = check_null_env("AIRTABLE_BASE_ID");
