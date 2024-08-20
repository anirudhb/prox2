// "view submissions" are responses to the dialog modal things that were opened elsewhere

import { InteractionHandler, ViewSubmissionInteraction } from "../../pages/api/interaction_work";
import { sameUser, unviewConfession, viewConfession, web } from "../main";
import { MarkdownText, TextSection } from "../block_builder";
import { confessions_channel, confessions_meta_channel, meta_channel } from "../secrets_wrapper";
import { sanitize } from "../sanitizer";
import getRepository from "../db";

const make_dialog = <T>(name: string): [(d: T) => string, (f: ((d: T | string[]) => Promise<boolean>)) => (id: string) => Promise<boolean | null>] => [
    // generate callback id
    d => `${name}_${btoa(JSON.stringify(d))}`,
    // callback handler
    f => async id => {
        if(!id.startsWith(name)) return null;
        const data = id.slice(name.length + 1);
        try {
            return await f(JSON.parse(atob(data)) as T);
        } catch(_) {
            // old format
            return await f(data.split("_"));
        }
    }
];

export const [reply_modal_id, reply_modal_handler] = make_dialog<string>("reply_modal");

export const [react_modal_id, react_modal_handler] = make_dialog<{
    published_ts: string,
    thread_ts: string
}>("react_modal");

export const [approve_tw_id, approve_tw_handler] = make_dialog<string>("approve_tw");

export const [undo_confirm_id, undo_confirm_handler] = make_dialog<{
    ts: string,
    reviewer_uid: string,
    undoer_uid: string
}>("undo_confirm");

export const [reject_id, reject_handler] = make_dialog<string>("reject");

const view_submission: InteractionHandler<ViewSubmissionInteraction> = async (data, res) => {
    // todo passthrough return
    const dialogs = [
        reject_handler(async (staging_ts) => {
            if (Array.isArray(staging_ts)) {
              staging_ts = staging_ts[0];
            }
            const repo = await getRepository();
            const record = await repo.findOne({ staging_ts });
            if (record === undefined) {
              throw `Failed to find single Postgres record with staging_ts=${staging_ts}`;
            }

            // quick assert for typeck
            if (
              data.view.state.values.reason.reject_input.type !=
              "plain_text_input"
            )
              return false;


            await viewConfession(
              repo,
              staging_ts,
              false,
              data.user.id,
              data.view.state.values.reason.reject_input.value
            );

            const r = await web.chat.postMessage({
              channel: confessions_meta_channel,
              text: `*rejected #${record.id}:* ${data.view.state.values.reason.reject_input.value}`,
            });
            if (!r.ok) throw `Failed to send reject message`;
            return true;
        }),

        reply_modal_handler(async (published_ts) => {
            if(Array.isArray(published_ts)) {
                published_ts = published_ts[0];
            }
            const repo = await getRepository();
            const record = await repo.findOne({ published_ts });
            if (record === undefined) {
                throw `Failed to find single Postgres record with published_ts=${published_ts}`;
            }

            // Check user...
            if (!sameUser(record, data.user.id)) {
                // update view
                res.json({
                    response_action: "update",
                    view: {
                        ...data.view,
                        blocks: [
                            ...data.view.blocks,
                            new TextSection(
                                new MarkdownText(
                                    "Failed to reply: \
                You are not the original poster of the confession, so cannot reply anonymously."
                                )
                            ).render(),
                        ],
                    },
                } as {
                    response_action: "update";
                    view: {
                        blocks: any[];
                    };
                });
                return false;
                // throw `Different user, cannot reply!`;
            }

            // quick assert for typeck
            if (
                data.view.state.values.reply.confession_reply.type !=
                "plain_text_input"
            )
                return false;

            // Reply in thread
            const r = await web.chat.postMessage({
                channel: record.meta ? meta_channel : confessions_channel,
                text: sanitize(data.view.state.values.reply.confession_reply.value),
                thread_ts: published_ts,
            });
            if (!r.ok) throw `Failed to reply in thread`;
            return true;
        }),

        react_modal_handler(async (args) => {
            if(Array.isArray(args)) {
                args = {
                    published_ts: args[0],
                    thread_ts: args[1]
                };
            }
            const { published_ts, thread_ts } = args;
            // try to fetch record
            const repo = await getRepository();
            const record = await repo.findOne({ published_ts });
            if (record === undefined) {
                throw `Failed to find single Postgres record with published_ts=${published_ts}`;
            }

            // Check user...
            if (!sameUser(record, data.user.id)) {
                // update view
                res.json({
                    response_action: "update",
                    view: {
                        ...data.view,
                        blocks: [
                            ...data.view.blocks,
                            new TextSection(
                                new MarkdownText(
                                    "Failed to react: \
                 *You are not the original poster of the confession, so cannot react anonymously.*"
                                )
                            ).render(),
                        ],
                    },
                } as {
                    response_action: "update";
                    view: {
                        blocks: any[];
                    };
                });
                return false;
                // throw `Different user, cannot reply!`;
            }

            // quick assert for typeck
            if (data.view.state.values.emoji.emoji.type != "external_select")
                return false;

            // React to message
            const react_res = await web.reactions.add({
                name: data.view.state.values.emoji.emoji.selected_option.value.replace(
                    /\:/g,
                    ""
                ),
                channel: record.meta ? meta_channel : confessions_channel,
                timestamp: thread_ts,
            });
            if (!react_res.ok) throw `Failed to react`;
            return true;
        }),

        approve_tw_handler(async (staging_ts) => {
            if(Array.isArray(staging_ts)) {
                staging_ts = staging_ts[0];
            }
            const repo = await getRepository();
            const record = await repo.findOne({ staging_ts });
            if (record === undefined) {
                throw `Failed to find single Postgres record with staging_ts=${staging_ts}`;
            }

            // quick assert for typeck
            if (
                data.view.state.values.tw.approve_tw_input.type != "plain_text_input"
            )
                return false;

            record.tw_text = data.view.state.values.tw.approve_tw_input.value;
            await repo.save(record);

            await viewConfession(
                repo,
                staging_ts,
                true,
                data.user.id,
                data.view.state.values.tw.approve_tw_input.value
            );

            const updatedRecord = await repo.findOne({ staging_ts });

            // Reply in thread
            const r = await web.chat.postMessage({
                // NOTE: no TWs for meta approvals
                channel: confessions_channel,
                text: sanitize(updatedRecord!.text),
                thread_ts: updatedRecord?.published_ts,
            });
            if (!r.ok) throw `Failed to reply in thread`;
            return true;
        }),

        undo_confirm_handler(async (args) => {
            if(Array.isArray(args)) {
                throw `undo_confirm_handler is old format!`;
            }
            const { ts, reviewer_uid, undoer_uid } = args;
            const repo = await getRepository();
            await unviewConfession(repo, ts, reviewer_uid, undoer_uid);
            return true;
        })
    ];

    const r = await dialogs.reduce<Promise<null | boolean>>(async (a, c) => (await a) ?? await c(data.view.callback_id), Promise.resolve(null));
    if(r === null) {
        throw `Failed to find dialog handler for ${data.view.callback_id}`;
    }
    return r;
};

export default view_submission;
