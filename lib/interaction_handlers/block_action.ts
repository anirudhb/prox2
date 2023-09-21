import { BlockActionInteraction, InteractionHandler } from "../../pages/api/interaction_work";
import { stageConfession, viewConfession, web } from "../main";
import { Blocks, InputSection, MarkdownText, PlainText, PlainTextInput, TextSection } from "../block_builder";
import getRepository from "../db";
import { approve_tw_id, undo_confirm_id } from "./view_submission";

const block_action: InteractionHandler<BlockActionInteraction> = async data => {
    console.log(`Block action!`);
    const repo = await getRepository();
    if (data.actions.length <= 0) {
        console.log(`No action found`);
        return false;
    }
    const action = data.actions[0].value;
    switch(action) {
        case "approve": {
            console.log(`Approval of message ts=${data.message.ts}`);
            await viewConfession(repo, data.message.ts, true, data.user.id);
            break;
        }
        case "disapprove": {
            console.log(`Disapproval of message ts=${data.message.ts}`);
            await viewConfession(repo, data.message.ts, false, data.user.id);
            break;
        }
        case "approve:tw": {
            console.log(`Trigger Warning Approval!`);
            const resp = await web.views.open({
                trigger_id: data.trigger_id,
                view: {
                    callback_id: approve_tw_id(data.message.ts),
                    type: "modal",
                    title: new PlainText(`Approve with TW`).render(),
                    submit: new PlainText("Approve").render(),
                    close: new PlainText("Cancel").render(),
                    blocks: new Blocks([
                        new InputSection(
                            new PlainTextInput("approve_tw_input", true),
                            new PlainText("TW"),
                            "tw"
                        )
                    ]).render()
                }
            });
            if (!resp.ok) {
                throw "Failed to open modal";
            }
            break;
        }
        case "stage": {
            console.log(`Stage of message thread_ts=${data.message.thread_ts}`);
            // Get message contents
            const resp = await web.conversations.history({
                channel: data.channel.id,
                inclusive: true,
                latest: data.message.thread_ts,
                limit: 1
            });
            if (!resp.ok) {
                throw `Failed to fetch message contents!`;
            }
            const message_contents = (resp as any).messages[0].text;
            // Stage
            const id = await stageConfession(
                repo,
                message_contents,
                data.user.id
            );
            // Edit
            const resp2 = await web.chat.update({
                channel: data.channel.id,
                ts: data.message.ts,
                text: "",
                blocks: new Blocks([
                    new TextSection(
                        new MarkdownText(`:true: Staged as confession #${id}`),
                        null,
                        null
                    )
                ]).render()
            });
            if (!resp2.ok) {
                throw `Failed to update message!`;
            }
            break;
        }
        case "undo": {
            console.log(`Undo staging of message ts=${data.message.ts}`);
            const blocks = (data.message as any).blocks;
            const reviewer_uid =  (/by <@([A-Za-z0-9]+)>/g).exec(blocks[blocks.length - 2].text.text)?.[1] ?? "";
            const undoer_uid = data.user.id;

            // await unviewConfession(repo, data.message.ts, reviewer_uid, undoer_uid);

            const resp = await web.views.open({
                trigger_id: data.trigger_id,
                view: {
                    callback_id: undo_confirm_id({
                        ts: data.message.ts,
                        reviewer_uid,
                        undoer_uid
                    }),
                    type: "modal",
                    title: new PlainText(`Undo confession review`).render(),
                    submit: new PlainText("Undo").render(),
                    close: new PlainText("Cancel").render(),
                    blocks: new Blocks([
                        // text
                        new TextSection(
                            new MarkdownText(
                                "Undoing approval is undoable, however replies will not be preserved."
                            )
                        )
                    ]).render()
                }
            });
            if (!resp.ok) {
                throw "Failed to open modal";
            }

            break;
        }
        case "cancel": {
            console.log(`Cancel of message thread_ts=${data.message.thread_ts}`);
            const resp = await web.chat.delete({
                channel: data.channel.id,
                ts: data.message.ts
            });
            if (!resp.ok) {
                throw `Failed to delete message!`;
            }
            break;
        }
        default: {
            console.log(`Unknown value ${action}`);
        }
    }

    return true;
};

export default block_action;