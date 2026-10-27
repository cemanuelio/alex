const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { v4: uuid } = require('uuid');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class BlackjackCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.blackjack;
    this.command = this.i18n.command;
    this.args = [
      { name: 'value', type: Number, defaultOption: true },
    ];

    this.games = new Map();
  }

  buildDeck() {
    const deck = [];
    SUITS.forEach(suit => RANKS.forEach(rank => deck.push({ suit, rank })));

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  cardValue(card) {
    if (card.rank === 'A') return 11;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    return Number(card.rank);
  }

  handValue(hand) {
    let total = hand.reduce((sum, card) => sum + this.cardValue(card), 0);
    let aces = hand.filter(card => card.rank === 'A').length;

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  formatCard(card) {
    return `${card.rank}${card.suit}`;
  }

  formatHand(hand) {
    return hand.map(card => this.formatCard(card)).join(' ');
  }

  renderMessage(game, { reveal = false, result = null } = {}) {
    const dealerLabel = reveal
      ? `${this.formatHand(game.dealer)} (${this.handValue(game.dealer)})`
      : `${this.formatCard(game.dealer[0])} 🂠`;

    let content = `${this.i18n.title}\n`
      + `${this.i18n.player.replace('{{H}}', this.formatHand(game.player)).replace('{{V}}', this.handValue(game.player))}\n`
      + `${this.i18n.dealer.replace('{{H}}', dealerLabel)}`;

    if (result) {
      content += `\n\n${result}`;
    }

    return content;
  }

  buildButtons(gameId, disabled = false) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`blackjack:${gameId}:hit`).setLabel(this.i18n.hit).setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`blackjack:${gameId}:stand`).setLabel(this.i18n.stand).setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      ),
    ];
  }

  async resolve(interaction, game, outcome) {
    game.finished = true;
    let resultText;

    if (outcome === 'win') {
      const prize = game.value * 2;
      await this.client.bankService.credit(game.userId, prize, this.i18n.bankLabelPrize);
      resultText = this.i18n.win.replace('{{V}}', prize);
    } else if (outcome === 'push') {
      await this.client.bankService.credit(game.userId, game.value, this.i18n.bankLabelPrize);
      resultText = this.i18n.push;
    } else {
      resultText = this.i18n.lose.replace('{{V}}', game.value);
    }

    const content = this.renderMessage(game, { reveal: true, result: resultText });
    await interaction.update({ content, components: this.buildButtons(game.id, true) });
    this.games.delete(game.id);
  }

  async dealerPlay(interaction, game) {
    while (this.handValue(game.dealer) < 17) {
      game.dealer.push(game.deck.pop());
    }

    const dealerValue = this.handValue(game.dealer);
    const playerValue = this.handValue(game.player);

    if (dealerValue > 21 || playerValue > dealerValue) {
      await this.resolve(interaction, game, 'win');
    } else if (playerValue === dealerValue) {
      await this.resolve(interaction, game, 'push');
    } else {
      await this.resolve(interaction, game, 'lose');
    }
  }

  async onInteraction(interaction) {
    if (!interaction.isButton() || interaction.customId.indexOf('blackjack:') !== 0) {
      return;
    }

    const [, gameId, action] = interaction.customId.split(':');
    const game = this.games.get(gameId);

    if (!game || game.finished) {
      await interaction.reply({ content: this.i18n.gameOver, ephemeral: true });
      return;
    }

    if (interaction.user.id !== game.userId) {
      await interaction.reply({ content: this.i18n.notYourGame, ephemeral: true });
      return;
    }

    if (action === 'hit') {
      game.player.push(game.deck.pop());

      if (this.handValue(game.player) > 21) {
        await this.resolve(interaction, game, 'lose');
        return;
      }

      await interaction.update({ content: this.renderMessage(game), components: this.buildButtons(game.id) });
    } else if (action === 'stand') {
      await this.dealerPlay(interaction, game);
    }
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

    const deck = this.buildDeck();
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];

    const gameId = uuid();
    const game = { id: gameId, userId: event.author.id, value, deck, player, dealer, finished: false };

    const playerBlackjack = this.handValue(player) === 21;
    const dealerBlackjack = this.handValue(dealer) === 21;

    if (playerBlackjack || dealerBlackjack) {
      let resultText;

      if (playerBlackjack && dealerBlackjack) {
        await this.client.bankService.credit(event.author.id, value, this.i18n.bankLabelPrize);
        resultText = this.i18n.push;
      } else if (playerBlackjack) {
        const prize = Math.round(value * 2.5);
        await this.client.bankService.credit(event.author.id, prize, this.i18n.bankLabelPrize);
        resultText = this.i18n.blackjackWin.replace('{{V}}', prize);
      } else {
        resultText = this.i18n.lose.replace('{{V}}', value);
      }

      await event.channel.send(this.renderMessage(game, { reveal: true, result: resultText }));
      return;
    }

    this.games.set(gameId, game);

    await event.channel.send({ content: this.renderMessage(game), components: this.buildButtons(gameId) });
  }
}

module.exports = BlackjackCommand;
