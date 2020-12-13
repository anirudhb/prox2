import { NextApiRequest, NextApiResponse } from "next";

import { api_config, failRequest, sameUser, setupMiddlewares, succeedRequest, table, TableRecord, verifySignature, viewConfession, web } from "../../lib/main";
import { confessions_channel } from "../../secrets";

export const config = api_config;

interface BlockActionInteraction {
    type: 'block_actions';
    trigger_id: string;
    response_url: string;
    user: string;
    message: {
        type: 'message';
        text: string;
        ts: string;
    };
    actions: {
        block_id: string;
        action_id: string;
        value: string;
    }[];
    token?: string;
    hash: string;
}

interface MessageActionInteraction {
    type: 'message_action';
    callback_id: string;
    trigger_id: string;
    response_url: string;
    user: {
        id: string;
    };
    message: {
        type: 'message';
        text: string;
        ts: string;
        thread_ts?: string;
    };
    channel: {
        id: string;
    };
    token?: string;
}

interface ViewSubmissionInteraction {
    type: 'view_submission';
    user: {
        id: string;
    };
    view: {
        callback_id: string;
        state: {
            values: {
                [key: string]: {
                    [input: string]: {
                        value: string;
                    }
                };
            };
        };
    };
}

type SlackInteractionPayload = MessageActionInteraction | ViewSubmissionInteraction | BlockActionInteraction & {
    type: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await setupMiddlewares(req, res);

    console.log(`Interaction!`);
    console.log(`Validating signature...`);
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log(`Invalid!`);
        res.writeHead(400).end();
        return;
    }
    console.log(`Valid!`);
    const data = JSON.parse((req.body as { payload: string }).payload) as SlackInteractionPayload;
    console.log(`Type = ${data.type}`);
    if (data.type == 'block_actions') {
        console.log(`Block action!`);
        if (data.actions.length > 0) {
            const action = data.actions[0];
            try {
                if (action.value == 'approve') {
                    console.log(`Approval of message ts=${data.message.ts}`);
                    await viewConfession(data.message.ts, true);
                } else if (action.value == 'disapprove') {
                    console.log(`Disapproval of message ts=${data.message.ts}`);
                    await viewConfession(data.message.ts, false);
                } else {
                    console.log(`Unknown value ${action.value}`);
                }
            } catch (e) {
                await failRequest(data.response_url, e);
                res.writeHead(500).end();
                return;
            }
        } else {
            console.log(`No action found`);
        }
    } else if (data.type == 'message_action') {
        console.log(`Message action!`);
        try {
            if (data.channel.id != confessions_channel) {
                throw 'Invalid channel ID';
            }
            if (data.callback_id == 'reply_anonymous') {
                // try to fetch record
                const records = await (await table.select({
                    filterByFormula: `{published_ts} = ${data.message.ts}`
                })).firstPage();
                if (records.length != 1) {
                    throw `Failed to find single record with published_ts=${data.message.ts}, got ${records.length}`;
                }
                const record = records[0];
                const fields = record.fields as TableRecord;

                // Check user...
                if (!sameUser(fields, data.user.id)) {
                    await succeedRequest(data.response_url,
                        'You are not the original poster of the confession, so you cannot reply anonymously.');
                    res.writeHead(200).end();
                    return;
                }

                const resp = await web.views.open({
                    trigger_id: data.trigger_id,
                    view: {
                        callback_id: `reply_modal_${fields.published_ts}`,
                        type: 'modal',
                        title: {
                            type: 'plain_text',
                            text: `Replying to #${fields.id}`
                        },
                        submit: {
                            type: 'plain_text',
                            text: 'Reply',
                            emoji: true
                        },
                        close: {
                            type: 'plain_text',
                            text: 'Cancel',
                            emoji: true
                        },
                        blocks: [
                            {
                                type: 'input',
                                block_id: 'reply',
                                element: {
                                    type: 'plain_text_input',
                                    multiline: true,
                                    action_id: 'confession_reply'
                                },
                                label: {
                                    type: 'plain_text',
                                    text: 'Reply',
                                    emoji: true
                                }
                            }
                        ]
                    }
                });
                if (!resp.ok) {
                    throw 'Failed to open modal';
                }
            } else {
                console.log(`Unknown callback ${data.callback_id}`);
            }
        } catch (e) {
            await failRequest(data.response_url, e);
            res.writeHead(500).end();
            return;
        }
    } else if (data.type == 'view_submission') {
        console.log(`View submission!`);
        try {
            const published_ts_res = /^reply_modal_(.*)$/.exec(data.view.callback_id);
            if (!published_ts_res) throw 'Failed to exec regex';
            const published_ts = published_ts_res[1];
            if (!published_ts) throw 'Failed to get regex group';

            // try to fetch record
            const records = await (await table.select({
                filterByFormula: `{published_ts} = ${published_ts}`
            })).firstPage();
            if (records.length != 1) {
                throw `Failed to find single record with published_ts=${published_ts}, got ${records.length}`;
            }
            const record = records[0];
            const fields = record.fields as TableRecord;

            // Check user...
            if (!sameUser(fields, data.user.id)) {
                // update view
                res.json({
                    response_action: 'update',
                    view: {
                        callback_id: `reply_modal_${fields.published_ts}`,
                        type: 'modal',
                        title: {
                            type: 'plain_text',
                            text: `Replying to #${fields.id}`
                        },
                        submit: {
                            type: 'plain_text',
                            text: 'Reply',
                            emoji: true
                        },
                        close: {
                            type: 'plain_text',
                            text: 'Cancel',
                            emoji: true
                        },
                        blocks: [
                            {
                                type: 'input',
                                block_id: 'reply',
                                element: {
                                    type: 'plain_text_input',
                                    multiline: true,
                                    action_id: 'confession_reply'
                                },
                                label: {
                                    type: 'plain_text',
                                    text: 'Reply',
                                    emoji: true
                                }
                            },
                            {
                                type: 'section',
                                text: {
                                    type: 'mrkdwn',
                                    text: 'Failed to reply: \
*You are not the original poster of the confession, so cannot reply anonymously.*',
                                }
                            }
                        ]
                    }
                });
                return;
                // throw `Different user, cannot reply!`;
            }

            // Reply in thread
            const r = await web.chat.postMessage({
                channel: confessions_channel,
                text: data.view.state.values.reply.confession_reply.value,
                thread_ts: published_ts
            });
            if (!r.ok) throw `Failed to reply in thread`;
        } catch (e) {
            console.log(e);
            res.writeHead(500).end();
            return;
        }
    }
    console.log(`Request success`);
    res.writeHead(204).end();
}