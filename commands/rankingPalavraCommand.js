const { RIGHT } = require('../models/enum/wordDayAnswerStatusEnum');

class RankingPalavraCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.rankingPalavra;
    this.command = this.i18n.command;
  }

  async exec(event) {
    const answers = await this.client.databaseService.models.wordDayAnswer.findAll({
      where: { status: RIGHT },
      raw: true,
    });

    const counts = answers.reduce((acc, it) => {
      acc[it.userId] = (acc[it.userId] || 0) + 1;
      return acc;
    }, {});

    const userIds = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);

    if (userIds.length === 0) {
      await event.channel.send(this.i18n.empty);
      return;
    }

    const users = await Promise.all(userIds.map(id => this.client.users.fetch(id)));

    const message = users.map((user, index) => `${index + 1}º - ${counts[user.id]}x - ${user.username}`).join('\n');

    await event.channel.send(`\`\`\`${message}\`\`\``);
  }
}

module.exports = RankingPalavraCommand;
