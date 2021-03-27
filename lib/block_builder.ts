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

abstract class Block extends Renderable {
  constructor(protected block_id: string | null = null) {
    super();
  }
}

abstract class Section extends Block {}

abstract class Text extends Renderable {}

export class PlainText extends Text {
  constructor(private text: string, private emoji: boolean = true) {
    super();
  }

  render(): any {
    return {
      type: "plain_text",
      text: this.text,
      emoji: this.emoji,
    };
  }
}

export class MarkdownText extends Text {
  constructor(private text: string) {
    super();
  }

  render(): any {
    return {
      type: "mrkdwn",
      text: this.text,
    };
  }
}

abstract class Action extends Renderable {
  constructor(protected action_id: string) {
    super();
  }
}

abstract class Accessory extends Renderable {}

export class ExternalSelectAction extends Action implements Accessory {
  constructor(
    private placeholder: Text,
    private min_query_length: number,
    action_id: string
  ) {
    super(action_id);
  }

  render(): any {
    return {
      type: "external_select",
      placeholder: this.placeholder.render(),
      min_query_length: this.min_query_length,
      action_id: this.action_id,
    };
  }
}

export class TextSection extends Section {
  constructor(
    private text: Text,
    block_id: string | null = null,
    private accessory: Accessory | null = null
  ) {
    super(block_id);
  }

  render(): any {
    let r: any = {
      type: "section",
      text: this.text.render(),
      accessory: this.accessory?.render(),
    };
    if (this.block_id != null) r.block_id = this.block_id;
    return r;
  }
}

abstract class Input extends Renderable {}

export class PlainTextInput extends Input {
  constructor(private action_id: string, private multiline: boolean = false) {
    super();
  }

  render(): any {
    return {
      type: "plain_text_input",
      multiline: this.multiline,
      action_id: this.action_id,
    };
  }
}

export class InputSection extends Section {
  constructor(
    private input: Input,
    private label: Text,
    block_id: string | null = null
  ) {
    super(block_id);
  }

  render(): any {
    return {
      type: "input",
      element: this.input.render(),
      label: this.label.render(),
      block_id: this.block_id,
    };
  }
}

export class ButtonAction extends Action {
  constructor(
    private text: PlainText,
    private value: string,
    action_id: string
  ) {
    super(action_id);
  }

  render(): any {
    return {
      type: "button",
      text: this.text.render(),
      value: this.value,
      action_id: this.action_id,
    };
  }
}

export class ActionsSection extends Section {
  constructor(private actions: Action[]) {
    super();
  }

  render(): any {
    return {
      type: "actions",
      elements: this.actions.map((action) => action.render()),
    };
  }
}

export class Blocks extends Renderable {
  constructor(private sections: Block[]) {
    super();
  }

  render(): any {
    return this.sections.map((section) => section.render());
  }
}
