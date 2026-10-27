const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuid } = require('uuid');

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

class VelhaCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.velha;
    this.command = this.i18n.command;
    this.args = [
      { name: 'time', alias: 't', type: Number },
      { name: 'value', alias: 'v', type: Number },
    ];

    this.games = new Map();
  }

  checkWinner(board) {
    return WIN_LINES.find(line => board[line[0]] && line.every(i => board[i] === board[line[0]])) || null;
  }

  buildButtons(game) {
    const rows = [];

    for (let r = 0; r < 3; r++) {
      const row = new ActionRowBuilder();

      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        const cell = game.board[i];

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`velha:${game.id}:${i}`)
            .setLabel(cell || '➖')
            .setStyle(cell === 'X' ? ButtonStyle.Danger : cell === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(!!cell || game.finished)
        );
      }

      rows.push(row);
    }

    return rows;
  }

  render(game, extra = '') {
    const turnUser = game.turn === 'X' ? game.playerX : game.playerO;
    let content = this.i18n.title.replace('{{X}}', game.playerX).replace('{{O}}', game.playerO);

    if (!game.finished) {
      content += `\n${this.i18n.turn.replace('{{U}}', turnUser).replace('{{S}}', game.turn)}`;
    }

    if (extra) {
      content += `\n\n${extra}`;
    }

    return content;
  }

  async finish(interaction, game, extra) {
    game.finished = true;
    await interaction.update({ content: this.render(game, extra), components: this.buildButtons(game) });
    this.games.delete(game.id);
  }

  async onInteraction(interaction) {
    if (!interaction.isButton() || interaction.customId.indexOf('velha:') !== 0) {
      return;
    }

    const [, gameId, cellStr] = interaction.customId.split(':');
    const cell = Number(cellStr);
    const game = this.games.get(gameId);

    if (!game || game.finished) {
      await interaction.reply({ content: this.i18n.gameOver, ephemeral: true });
      return;
    }

    const currentUserId = game.turn === 'X' ? game.playerXId : game.playerOId;

    if (interaction.user.id !== currentUserId) {
      await interaction.reply({ content: this.i18n.notYourTurn, ephemeral: true });
      return;
    }

    if (game.board[cell]) {
      await interaction.reply({ content: this.i18n.cellTaken, ephemeral: true });
      return;
    }

    game.board[cell] = game.turn;

    const winLine = this.checkWinner(game.board);

    if (winLine) {
      const winnerId = game.turn === 'X' ? game.playerXId : game.playerOId;
      const winnerName = game.turn === 'X' ? game.playerX : game.playerO;
      await this.client.bankService.credit(winnerId, game.pot, this.i18n.bankLabelPrize);
      await this.finish(interaction, game, this.i18n.win.replace('{{U}}', winnerName).replace('{{V}}', game.pot));
      return;
    }

    if (game.board.every(it => it)) {
      await this.client.bankService.credit(game.playerXId, game.value, this.i18n.bankLabelPrize);
      await this.client.bankService.credit(game.playerOId, game.value, this.i18n.bankLabelPrize);
      await this.finish(interaction, game, this.i18n.draw);
      return;
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    await interaction.update({ content: this.render(game), components: this.buildButtons(game) });
  }

  async startMatch(event, message, challengerId, value) {
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

    const challenger = await this.client.users.fetch(challengerId);
    const opponent = await this.client.users.fetch(opponentId);

    const gameId = uuid();
    const game = {
      id: gameId,
      playerX: challenger.username,
      playerXId: challengerId,
      playerO: opponent.username,
      playerOId: opponentId,
      board: new Array(9).fill(null),
      turn: 'X',
      value,
      pot: value * 2,
      finished: false,
    };

    this.games.set(gameId, game);

    await event.channel.send({ content: this.render(game), components: this.buildButtons(game) });
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

    setTimeout(() => this.startMatch(event, message, event.author.id, args.value), args.time * 1000);
  }
}

module.exports = VelhaCommand;
