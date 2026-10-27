class SlotsCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.slots;
    this.command = this.i18n.command;
    this.args = [
      { name: 'value', type: Number, defaultOption: true },
    ];

    this.symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
    this.spinTicks = 4;
    this.tickInterval = 600;
  }

  spinSymbol() {
    return this.symbols[Math.floor(Math.random() * this.symbols.length)];
  }

  calculatePrize(value, reels) {
    const [a, b, c] = reels;

    if (a === b && b === c) {
      return a === '7️⃣' ? value * 10 : value * 5;
    }

    if (a === b || b === c || a === c) {
      return Math.round(value * 1.5);
    }

    return 0;
  }

  render(reels) {
    return `\`\`\`[ ${reels.join(' | ')} ]\`\`\``;
  }

  async exec(event, args) {
    const value = args.value;

    if (!value || value <= 0) {
      await event.reply(this.i18n.invalid);
      return;
    }

    await this.client.bankService.register(event.author.id);
    const balance = await this.client.bankService.getBalance(event.author.id);

    if (balance < value) {
      await event.reply(this.i18n.noBalance);
      return;
    }

    await this.client.bankService.debit(event.author.id, value, this.i18n.bankLabelBet);

    const message = await event.channel.send(this.render(['🎰', '🎰', '🎰']));

    let reels = ['🎰', '🎰', '🎰'];
    for (let i = 0; i < this.spinTicks; i++) {
      await new Promise(resolve => setTimeout(resolve, this.tickInterval));
      reels = [this.spinSymbol(), this.spinSymbol(), this.spinSymbol()];
      await message.edit(this.render(reels));
    }

    const prize = this.calculatePrize(value, reels);

    if (prize > 0) {
      await this.client.bankService.credit(event.author.id, prize, this.i18n.bankLabelPrize);
      await message.edit(`${this.render(reels)}\n${this.i18n.win.replace('{{V}}', prize)}`);
    } else {
      await message.edit(`${this.render(reels)}\n${this.i18n.lose.replace('{{V}}', value)}`);
    }
  }
}

module.exports = SlotsCommand;
