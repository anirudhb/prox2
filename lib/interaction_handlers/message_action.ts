import { confessions_channel } from "../secrets_wrapper";
import { sameUser, succeedRequest, web } from "../main";
import { Blocks, ExternalSelectAction, InputSection, PlainText, PlainTextInput, TextSection } from "../block_builder";
import { In } from "typeorm";
import { InteractionHandler, MessageActionInteraction } from "../../pages/api/interaction_work";
import getRepository from "../db";

const message_action: InteractionHandler<MessageActionInteraction> = async (data, res) => {
    if (data.channel.id != confessions_channel) {
        throw "Invalid channel ID";
    }
    switch(data.callback_id) {
        case "reply_anonymous": {
            // try to fetch record
            const repo = await getRepository();
            const record = await repo.findOne({ published_ts: data.message.ts });
            if (record === undefined) {
                throw `Failed to find single Postgres record with published_ts=${data.message.ts}`;
            }

            // Check user...
            if (!sameUser(record, data.user.id)) {
                await succeedRequest(
                    data.response_url,
                    "You are not the original poster of the confession, so you cannot reply anonymously."
                );
                res.writeHead(200).end();
                return false;
            }

            const resp = await web.views.open({
                trigger_id: data.trigger_id,
                view: {
                    callback_id: `reply_modal_${record.published_ts}`,
                    type: "modal",
                    title: new PlainText(`Replying to #${record.id}`).render(),
                    submit: new PlainText("Reply").render(),
                    close: new PlainText("Cancel").render(),
                    blocks: new Blocks([
                        new InputSection(
                            new PlainTextInput("confession_reply", true),
                            new PlainText("Reply"),
                            "reply"
                        ),
                    ]).render(),
                },
            });
            if (!resp.ok) {
                throw "Failed to open modal";
            }
            break;
        }
        case "react_anonymous": {
            // try to fetch record
            let valid_ts = [data.message.ts];
            if (data.message.thread_ts !== undefined)
                valid_ts.push(data.message.thread_ts);
            const repo = await getRepository();
            const record = await repo.findOne({ published_ts: In(valid_ts) });
            if (record === undefined) {
                throw `Failed to find single Postgres record with published_ts=${data.message.ts}`;
            }

            // Check user...
            if (!sameUser(record, data.user.id)) {
                await succeedRequest(
                    data.response_url,
                    "You are not the original poster of the confession, so you cannot react anonymously."
                );
                res.writeHead(200).end();
                return false;
            }

            const modal_res = await web.views.open({
                trigger_id: data.trigger_id,
                view: {
                    type: "modal",
                    callback_id: `react_modal_${record.published_ts}_${data.message.ts}`,
                    title: new PlainText(`Reacting to #${record.id}`).render(),
                    submit: new PlainText("React").render(),
                    close: new PlainText("Cancel").render(),
                    blocks: new Blocks([
                        new TextSection(
                            new PlainText("Pick an emoji to react with"),
                            "emoji",
                            new ExternalSelectAction(
                                new PlainText("Select an emoji"),
                                2,
                                "emoji"
                            )
                        ),
                    ]).render(),
                },
            });
            if (!modal_res.ok) throw `Failed to open modal`;
            break;
        }
        default: {
            console.log(`Unknown callback ${data.callback_id}`);
        }
    }

    return true;
};

export default message_action;