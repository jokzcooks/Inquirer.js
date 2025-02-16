import cliWidth from 'cli-width';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import ansiEscapes from 'ansi-escapes';
import * as util from './readline.js';
import { breakLines } from './utils.js';
import { InquirerReadline } from '../index.js';

const height = (content: string): number => content.split('\n').length;
const lastLine = (content: string): string => content.split('\n').pop() ?? '';

export default class ScreenManager {
  height: number;
  extraLinesUnderPrompt: number;

  constructor(private readonly rl: InquirerReadline) {
    // These variables are keeping information to allow correct prompt re-rendering
    this.height = 0;
    this.extraLinesUnderPrompt = 0;

    this.rl = rl;
  }

  render(content: string, bottomContent: string | void = '') {
    this.rl.output.unmute();
    this.clean(this.extraLinesUnderPrompt);

    /**
     * Write message to screen and setPrompt to control backspace
     */

    const promptLine = lastLine(content);
    const rawPromptLine = stripAnsi(promptLine);

    // Remove the rl.line from our prompt. We can't rely on the content of
    // rl.line (mainly because of the password prompt), so just rely on it's
    // length.
    let prompt = rawPromptLine;
    if (this.rl.line.length) {
      prompt = prompt.slice(0, -this.rl.line.length);
    }

    this.rl.setPrompt(prompt);

    // SetPrompt will change cursor position, now we can get correct value
    const cursorPos = (this.rl as any)._getCursorPos();
    const width = cliWidth({ defaultWidth: 80, output: this.rl.output });

    content = breakLines(content, width);
    if (bottomContent) {
      bottomContent = breakLines(bottomContent, width);
    }

    // Manually insert an extra line if we're at the end of the line.
    // This prevent the cursor from appearing at the beginning of the
    // current line.
    if (rawPromptLine.length % width === 0) {
      content += '\n';
    }

    const fullContent = content + (bottomContent ? '\n' + bottomContent : '');
    this.rl.output.write(fullContent);

    /**
     * Re-adjust the cursor at the correct position.
     */

    // We need to consider parts of the prompt under the cursor as part of the bottom
    // content in order to correctly cleanup and re-render.
    const promptLineUpDiff = Math.floor(rawPromptLine.length / width) - cursorPos.rows;
    const bottomContentHeight =
      promptLineUpDiff + (bottomContent ? height(bottomContent) : 0);
    if (bottomContentHeight > 0) {
      util.up(this.rl, bottomContentHeight);
    }

    // Reset cursor at the beginning of the line
    util.left(this.rl, stringWidth(lastLine(fullContent)));

    // Adjust cursor on the right
    if (cursorPos.cols > 0) {
      util.right(this.rl, cursorPos.cols);
    }

    /**
     * Set up state for next re-rendering
     */
    this.extraLinesUnderPrompt = bottomContentHeight;
    this.height = height(fullContent);

    this.rl.output.mute();
  }

  clean(extraLines: number) {
    if (extraLines > 0) {
      util.down(this.rl, extraLines);
    }

    util.clearLine(this.rl, this.height);
  }

  done() {
    this.releaseCursor();
    this.rl.setPrompt('');
    this.rl.output.unmute();
    this.rl.output.write('\n');
    this.rl.output.write(ansiEscapes.cursorShow);
    this.rl.close();
  }

  releaseCursor() {
    if (this.extraLinesUnderPrompt > 0) {
      util.down(this.rl, this.extraLinesUnderPrompt);
    }
  }
}
