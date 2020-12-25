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

// General utilities for building Slack blocks.

abstract class Renderable {
    abstract render(): any;
}

abstract class Block extends Renderable { }

abstract class Section extends Block { }

abstract class Text extends Renderable { }

export class PlainText extends Text {
    constructor(private text: string, private emoji: boolean = true) { super(); }

    render(): any {
        return {
            type: 'plain_text',
            text: this.text,
            emoji: this.emoji
        };
    }
}

export class MarkdownText extends Text {
    constructor(private text: string) { super(); }

    render(): any {
        return {
            type: 'mrkdwn',
            text: this.text
        };
    }
}

export class TextSection extends Section {
    constructor(private text: Text) { super(); }

    render(): any {
        return {
            type: 'section',
            text: this.text.render()
        };
    }
}

abstract class Action extends Renderable { }

export class ButtonAction extends Action {
    constructor(private text: Text, private value: string, private action_id: string) { super(); }

    render(): any {
        return {
            type: 'button',
            text: this.text.render(),
            value: this.value,
            action_id: this.action_id
        };
    }
}

export class ActionsSection extends Section {
    constructor(private actions: Action[]) { super(); }

    render(): any {
        return {
            type: 'actions',
            elements: this.actions.map(action => action.render())
        }
    }
}

export class Blocks extends Renderable {
    constructor(private sections: Block[]) { super(); }

    render(): any {
        return this.sections.map(section => section.render());
    }
}

/**

type BuilderMarkerType = 'actions' | 'plain_text' | 'button' | 'text_section' | 'input_section';

type BuilderSpan = BuilderMarker | BuilderItem | BuilderTag;

interface BuilderMarker {
    type: 'begin' | 'end';
    marker_type: BuilderMarkerType;
}

interface BuilderItem {
    type: 'item';
    item: Renderable;
}

interface BuilderTag {
    type: 'tag';
    tag_name: string;
    tag_value: string;
}

type BuilderFn = (builder: BlocksBuilder) => void;

function prettySpan(span: BuilderSpan): string {
    if (span.type == 'begin') {
        return `Begin ${span.marker_type}`;
    } else if (span.type == 'end') {
        return `End ${span.marker_type}`;
    } else if (span.type == 'item') {
        return `Item ${JSON.stringify(span.item.render(), null, 2)}`;
    } else if (span.type == 'tag') {
        return `Tag \`${span.tag_name}\` = \`${span.tag_value}\``;
    }
    throw new Error('Unreachable');
}

class PrettySpanner {
    private level: number = 0;

    static print(spans: BuilderSpan[]) {
        const spanner = new PrettySpanner();
        for (const span of spans) {
            const s = spanner.pretty(span);
            if (s != null) {
                console.log(s);
            }
        }
    }

    private pretty(span: BuilderSpan): string | null {
        if (span.type == 'begin') {
            const s = this.withIndent(`+ ${span.marker_type}`);
            this.level++;
            return s;
        } else if (span.type == 'end') {
            this.level = this.level <= 0 ? 0 : this.level - 1;
            return null;
        } else if (span.type == 'item') {
            return this.withIndent(`\\ Item ${JSON.stringify(span.item.render(), null, 2)}\n`);
        } else if (span.type == 'tag') {
            return this.withIndent(`\\ Tag \`${span.tag_name}\` = \`${span.tag_value}\`\n`);
        }
        throw new Error(`Unreachable`);
    }

    private withIndent(s: string): string {
        let new_s1 = '';
        let new_s = '';
        for (let i = 0; i < this.level; i++) {
            new_s += '| ';
            if (i != this.level - 1) {
                new_s1 += '| ';
            } else {
                new_s1 += '|-';
            }
        }
        const lines = s.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (i == 0) {
                lines[i] = new_s1 + lines[i];
            } else {
                lines[i] = new_s + lines[i];
            }
        }
        // return s.split('\n').map(line => new_s + line).join('\n');
        return lines.join('\n');
    }
}

// I'm aware this class contains a lot of 300-character long lines.
// I'm not changing it.
export class BlocksBuilder extends Renderable {
    spans: BuilderSpan[] = [];
    static trace: boolean = true;

    static render(f: BuilderFn): any {
        const builder = new BlocksBuilder();
        f(builder);
        return builder.render();
    }

    private open(name: BuilderMarkerType) { if (BlocksBuilder.trace) console.log(`trace: opening span ${name}`); this.spans.push({ type: 'begin', marker_type: name }); }
    private close(name: BuilderMarkerType) { if (BlocksBuilder.trace) console.log(`trace: closing span ${name}`); this.assert_in_span(name); this.spans.push({ type: 'end', marker_type: name }); }

    private spanned(name: BuilderMarkerType, f: BuilderFn) {
        this.open(name);
        f(this);
        this.close(name);
    }

    private item(i: Renderable) { if (BlocksBuilder.trace) console.log(`trace: pushing item of type ${typeof i}`); this.spans.push({ type: 'item', item: i }); }

    private static in_spans(spans: BuilderSpan[]): BuilderMarkerType[] {
        let in_spans: BuilderMarkerType[] = [];
        for (const span of spans) {
            if (span.type == 'begin') {
                in_spans.push(span.marker_type);
            } else if (span.type == 'end') {
                if (in_spans[in_spans.length - 1] !== span.marker_type) {
                    console.log(JSON.stringify(spans, null, 2));
                    throw new Error(`Ending span ${span.marker_type} without ending inner span ${in_spans[in_spans.length - 1]}`);
                } else {
                    const begin_index = in_spans.lastIndexOf(span.marker_type);
                    if (begin_index >= 0) {
                        in_spans = in_spans.splice(begin_index, 1);
                        console.log(`Removed ${span.marker_type}`);
                    }
                }
            }
        }
        return in_spans;
    }

    private assert_in_span(name: BuilderMarkerType) {
        const spans = BlocksBuilder.in_spans(this.spans);
        if (!spans.includes(name)) {
            console.log(JSON.stringify(spans, null, 2));
            throw new Error(`Not in span ${name}`);
        }
    }

    private tag(name: string, value: string) { this.spans.push({ type: 'tag', tag_name: name, tag_value: value }); }

    actions(f: BuilderFn): BlocksBuilder { this.spanned('actions', f); return this; }
    button(f: BuilderFn): BlocksBuilder { this.spanned('button', f); return this; }
    text_section(f: BuilderFn): BlocksBuilder { this.spanned('text_section', f); return this; }
    input_section(f: BuilderFn): BlocksBuilder { this.spanned('input_section', f); return this; }
    plain_text(text: string, emoji: boolean = true): BlocksBuilder { this.item(new PlainText(text, emoji)); return this; }
    plain_text_input(action_id: string, multiline: boolean = false): BlocksBuilder { this.item(new PlainTextInput(action_id, multiline)); return this; }
    markdown(text: string): BlocksBuilder { this.item(new MarkdownText(text)); return this; }
    action_id(id: string): BlocksBuilder { this.tag('action_id', id); return this; }
    value(val: string): BlocksBuilder { this.tag('value', val); return this; }

    render(): any {
        if (BlocksBuilder.trace) PrettySpanner.print(this.spans);
        let state = [...this.spans];
        const popNext = function (): BuilderSpan | null {
            if (state.length > 0) {
                const item = state[0];
                state = state.slice(1);
                // console.log(prettySpan(item));
                return item;
            }
            return null;
        };
        const peek = function (): BuilderSpan | null { return state.length > 0 ? state[0] : null; };
        const peek_is_end = function (type: BuilderMarkerType): boolean { const p = peek(); return p?.type == 'end' && p?.marker_type == type; };
        const advance = function (): BuilderSpan { const item = popNext(); if (!item) throw new Error(`state is empty`); return item; };
        //const in_span = function (type: BuilderMarkerType): boolean { return BlocksBuilder.in_spans(state, true).includes(type); };
        const expect_end = function (type: BuilderMarkerType) { const span = advance(); if (span.type != 'end' || span.marker_type != type) throw new Error(`Expected end of ${type}, found ${JSON.stringify(span)}`); };
        const expect_text = function (): Text {
            const i = advance();
            if (i.type != 'item') throw new Error(`Expected item`);
            const item = i.item;
            if (!(item instanceof Text)) throw new Error(`Expected instance of Text, found ${JSON.stringify(item.render(), null, 2)}`);
            return item;
        };

        // parse toplevels
        const toplevels: Renderable[] = [];
        while (state.length > 0) {
            const open = advance();
            if (open.type != 'begin') throw new Error(`Expected begin, found ${prettySpan(open)}`);
            const allowed_toplevels: BuilderMarkerType[] = ['actions', 'text_section', 'input_section'];
            if (!allowed_toplevels.includes(open.marker_type)) throw new Error(`Expected one of ${allowed_toplevels}, found ${open.marker_type}`);
            if (open.marker_type == 'text_section') {
                const parse_text_section = function (): TextSection {
                    // Expect *one* text item.
                    const text = expect_text();
                    expect_end('text_section');
                    return new TextSection(text);
                };
                toplevels.push(parse_text_section());
            } else if (open.marker_type == 'actions') {
                const parse_actions = function (): ActionsSection {
                    // Expect *many* Actions.
                    const actions = [];
                    while (!peek_is_end('actions')) {
                        // // If end, take it.
                        // if (peek_is_end('actions')) break;
                        const parse_action = function (): Action {
                            const open = advance();
                            if (open.type != 'begin') throw new Error(`Expected open, found ${prettySpan(open)}`);
                            const allowed_actions: BuilderMarkerType[] = ['button'];
                            if (!allowed_actions.includes(open.marker_type)) {
                                throw new Error(`Found <not an action>`);
                            }
                            if (open.marker_type == 'button') {
                                const parse_button = function (): ButtonAction {
                                    // Expect *one* text item.
                                    const text = expect_text();
                                    // Expect an action id and value.
                                    let action_id: string | null = null;
                                    let value: string | null = null;
                                    while (!peek_is_end('button')) {
                                        const tag = advance();
                                        if (tag.type != 'tag') throw new Error(`Expected tag, found ${prettySpan(tag)}`);
                                        const allowed_tags = ['action_id', 'value'];
                                        if (!allowed_tags.includes(tag.tag_name)) throw new Error(`Expected one of ${allowed_tags}, found ${tag.tag_name}`);
                                        if (tag.tag_name == 'action_id') {
                                            action_id = tag.tag_value;
                                        } else if (tag.tag_name == 'value') {
                                            value = tag.tag_value;
                                        }
                                    }
                                    if (action_id == null) {
                                        throw new Error(`Expected action_id tag, none processed`);
                                    }
                                    if (value == null) {
                                        throw new Error(`Expected value tag, none processed`);
                                    }
                                    // Expect button end.
                                    expect_end('button');
                                    return new ButtonAction(text, value, action_id);
                                };
                                return parse_button();
                            }
                            throw new Error(`Unreachable`);
                        };
                        const action = parse_action();
                        actions.push(action);
                    }
                    expect_end('actions');
                    return new ActionsSection(actions);
                };
                toplevels.push(parse_actions());
            } else if (open.marker_type == 'input_section') {
                const parse_input_section = function (): InputSection {
                    // Expect *one* input and label. Optional block_id.
                    let block_id: string | null = null;
                    while (!peek_is_end('input_section')) {
                        const open = pee
                    }
                };
                toplevels.push(parse_input_section());
            }
        }

        return toplevels.map(t => t.render());
    }
}

*/
