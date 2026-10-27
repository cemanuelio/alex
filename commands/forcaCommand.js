class ForcaCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.forca;
    this.command = this.i18n.command;
    this.args = [
      { name: 'letter', defaultOption: true },
    ];

    this.games = new Map();
    this.maxWrong = 6;
    this.prize = 100;

    this.words = [
      'abacaxi', 'banana', 'cachorro', 'elefante', 'girafa', 'floresta', 'montanha',
      'computador', 'discord', 'javascript', 'teclado', 'monitor', 'cadeira', 'parede',
      'janela', 'bicicleta', 'foguete', 'planeta', 'estrela', 'oceano', 'tartaruga',
      'borboleta', 'guitarra', 'chocolate', 'sorvete', 'futebol', 'basquete', 'piscina',
      'biblioteca', 'hospital', 'aeroporto', 'restaurante', 'mercado', 'padaria',
      'lampada', 'relogio', 'telefone', 'camera', 'headset', 'controle',
    ];

    this.stages = [
      '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========\n```',
      '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========\n```',
    ];
  }

  normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  getMask(word, guessed) {
    return word.split('').map(letter => (guessed.has(this.normalize(letter)) ? letter.toUpperCase() : '🔳')).join(' ');
  }

  render(game) {
    const mask = this.getMask(game.word, game.guessed);
    const wrongLetters = Array.from(game.wrongLetters).join(', ') || '-';
    return `${this.stages[game.wrong]}\n${mask}\n${this.i18n.wrongLetters.replace('{{L}}', wrongLetters)}`;
  }

  async exec(event, args) {
    const channelId = event.channel.id;
    let game = this.games.get(channelId);

    if (!args.letter) {
      if (!game) {
        const word = this.words[Math.floor(Math.random() * this.words.length)];
        game = { word, guessed: new Set(), wrongLetters: new Set(), wrong: 0 };
        this.games.set(channelId, game);
        await event.channel.send(`${this.i18n.start}\n${this.render(game)}`);
      } else {
        await event.channel.send(this.render(game));
      }
      return;
    }

    if (!game) {
      await event.reply(this.i18n.noGame);
      return;
    }

    const letter = this.normalize(args.letter.toString());

    if (letter.length !== 1 || !/^[a-z]$/.test(letter)) {
      await event.reply(this.i18n.invalidLetter);
      return;
    }

    if (game.guessed.has(letter) || game.wrongLetters.has(letter)) {
      await event.reply(this.i18n.alreadyGuessed);
      return;
    }

    const normalizedWord = this.normalize(game.word);

    if (normalizedWord.includes(letter)) {
      game.guessed.add(letter);

      const won = normalizedWord.split('').every(l => game.guessed.has(l));

      if (won) {
        this.games.delete(channelId);
        await this.client.bankService.register(event.author.id);
        await this.client.bankService.credit(event.author.id, this.prize, this.i18n.bankLabel);
        await event.channel.send(this.i18n.win.replace('{{W}}', game.word).replace('{{V}}', this.prize));
        return;
      }

      await event.channel.send(this.render(game));
    } else {
      game.wrongLetters.add(letter);
      game.wrong++;

      if (game.wrong >= this.maxWrong) {
        this.games.delete(channelId);
        await event.channel.send(`${this.render(game)}\n${this.i18n.lose.replace('{{W}}', game.word)}`);
        return;
      }

      await event.channel.send(this.render(game));
    }
  }
}

module.exports = ForcaCommand;
