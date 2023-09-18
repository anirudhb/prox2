import { InteractionHandler, ViewSubmissionInteraction } from "../../pages/api/interaction_work";
import { sameUser, viewConfession, web } from "../main";
import { MarkdownText, TextSection } from "../block_builder";
import { confessions_channel } from "../secrets_wrapper";
import { sanitize } from "../sanitizer";
import getRepository from "../db";

const view_submission: InteractionHandler<ViewSubmissionInteraction> = async (data, res) => {
    if (data.view.callback_id.startsWith("reply_modal")) {
        const published_ts_res = /^reply_modal_(.*)$/.exec(
            data.view.callback_id
        );
        if (!published_ts_res) throw "Failed to exec regex";
        const published_ts = published_ts_res[1];
        if (!published_ts) throw "Failed to get regex group";

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
                                "Failed to reply: \
            You are not the original poster of the confession, so cannot reply anonymously.*"
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
            channel: confessions_channel,
            text: sanitize(data.view.state.values.reply.confession_reply.value),
            thread_ts: published_ts,
        });
        if (!r.ok) throw `Failed to reply in thread`;
    } else if (data.view.callback_id.startsWith("react_modal")) {
        const published_ts_res = /^react_modal_(.*)_(.*)$/.exec(
            data.view.callback_id
        );
        if (!published_ts_res) throw "Failed to exec regex";
        const [published_ts, thread_ts] = [
            published_ts_res[1],
            published_ts_res[2],
        ];
        if (!published_ts || !thread_ts) throw "Failed to get regex group";

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
            channel: confessions_channel,
            timestamp: thread_ts,
        });
        if (!react_res.ok) throw `Failed to react`;
    } else if (data.view.callback_id.startsWith("approve_tw")) {
        const staging_ts_res = /^approve_tw_(.*)$/.exec(data.view.callback_id);
        if (!staging_ts_res) throw "Failed to exec regex";
        const staging_ts = staging_ts_res[1];
        if (!staging_ts) throw "Failed to get regex group";

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
            channel: confessions_channel,
            text: sanitize(updatedRecord!.text),
            thread_ts: updatedRecord?.published_ts,
        });
        if (!r.ok) throw `Failed to reply in thread`;
    }
};

export default view_submission;