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