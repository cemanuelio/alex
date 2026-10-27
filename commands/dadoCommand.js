class DadoCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.dado;
    this.command = this.i18n.command;
    this.args = [
      { name: 'time', alias: 't', type: Number },
      { name: 'value', alias: 'v', type: Number },
    ];
  }

  rollDice() {
    return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  }

  async resolveDuel(event, message, challengerId, value) {
    const reactions = await message.reactions.resolve('✅').users.fetch();
    const opponentId = Array.from(reactions.keys()).find(id => id !== challengerId && id !== this.client.user.id);

    if (!opponentId) {
      await message.reply(this.i18n.cancel);
      return;
    }

    await this.client.bankService.register(opponentId);
    const opponentBalance = await this.client.bankService.getBalance(opponentId);

    if (opponentBalance < value) {
      await message.reply(this.i18n.noBalance.replace('{{USER}}', opponentId));
      return;
    }

    await this.client.bankService.debit(challengerId, value, this.i18n.bankLabelBet);
    await this.client.bankService.debit(opponentId, value, this.i18n.bankLabelBet);

    const rollMessage = await event.channel.send(this.i18n.rolling);

    const challengerRoll = this.rollDice();
    const opponentRoll = this.rollDice();

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (challengerRoll === opponentRoll) {
      await this.client.bankService.credit(challengerId, value, this.i18n.bankLabelPrize);
      await this.client.bankService.credit(opponentId, value, this.i18n.bankLabelPrize);
      await rollMessage.edit(
        this.i18n.tie
          .replace('{{A}}', challengerId).replace('{{RA}}', challengerRoll)
          .replace('{{B}}', opponentId).replace('{{RB}}', opponentRoll)
      );
      return;
    }

    const pot = value * 2;
    const winnerId = challengerRoll > opponentRoll ? challengerId : opponentId;
    await this.client.bankService.credit(winnerId, pot, this.i18n.bankLabelPrize);

    await rollMessage.edit(
      this.i18n.result
        .replace('{{A}}', challengerId).replace('{{RA}}', challengerRoll)
        .replace('{{B}}', opponentId).replace('{{RB}}', opponentRoll)
        .replace('{{WINNER}}', winnerId).replace('{{PRIZE}}', pot)
    );
  }

  async exec(event, args) {
    if (!args.time || !args.value) {
      await event.reply(this.i18n.invalid);
      return;
    }

    await this.client.bankService.register(event.author.id);
    const balance = await this.client.bankService.getBalance(event.author.id);

    if (balance < args.value) {
      await event.reply(this.i18n.noBalance.replace('{{USER}}', event.author.id));
      return;
    }

    const message = await event.channel.send(
      this.i18n.message.replace('{{U}}', event.author.username).replace('{{T}}', args.time).replace('{{V}}', args.value)
    );
    message.react('✅');

    setTimeout(() => this.resolveDuel(event, message, event.author.id, args.value), args.time * 1000);
  }
}

module.exports = DadoCommand;
