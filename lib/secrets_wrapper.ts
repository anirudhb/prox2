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
  const contents = fs.readFileSync("./secrets.json", { encoding: "utf-8" });
  const secrets = JSON.parse(contents);
  token = secrets.token;
  airtable_api_key = secrets.airtable_api_key;
  airtable_base = secrets.airtable_base;
  staging_channel = secrets.staging_channel;
  confessions_channel = secrets.confessions_channel;
  slack_signing_secret = secrets.slack_signing_secret;
} catch (_) {
  token = check_env("SLACK_BOT_TOKEN");
  airtable_api_key = check_env("AIRTABLE_API_KEY");
  airtable_base = check_env("AIRTABLE_BASE_ID");
  staging_channel = check_env("STAGING_CHANNEL_ID");
  confessions_channel = check_env("CONFESSIONS_CHANNEL_ID");
  slack_signing_secret = check_env("SLACK_SIGNING_SECRET");
}
