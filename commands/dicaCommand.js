class DicaCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.dica;
    this.command = this.i18n.command;
  }

  async exec(event) {
    const wordDay = await this.client.wordDayService.findToday();

    if (!wordDay) {
      await event.reply(this.i18n.unavailable);
      return;
    }

    if (wordDay.answeredUserId) {
      await event.reply(this.i18n.alreadyAnswered);
      return;
    }

    const hintsUsedSoFar = await this.client.wordDayService.countHintsUsed(wordDay, event.author.id);

    if (hintsUsedSoFar >= wordDay.word.length - 1) {
      await event.reply(this.i18n.noMoreHints);
      return;
    }

    const hintsUsed = await this.client.wordDayService.useHint(wordDay, event.author.id);
    const mask = this.client.wordDayService.getMaskedWord(wordDay.word, hintsUsed);
    const prize = this.client.wordDayService.calculatePrize(hintsUsed);

    try {
      await event.author.send(`${this.i18n.hint.replace('{{V}}', prize)}\n${mask}`);
      event.react('✅');
    } catch (e) {
      await event.reply(this.i18n.dmBlocked);
    }
  }
}

module.exports = DicaCommand;
