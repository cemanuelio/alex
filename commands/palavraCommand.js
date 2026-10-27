const { Op } = require('sequelize');
const moment = require('moment');
const axios = require('axios');
const { parse } = require('node-html-parser');
const { RIGHT, WRONG } = require('../models/enum/wordDayAnswerStatusEnum');

class PalavraCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.palavra;
    this.command = this.i18n.command;
    this.args = [
      { name: 'guess', defaultOption: true },
    ];

    this.emojiMap = {
      a: '🇦',
      b: '🇧',
      c: '🇨',
      d: '🇩',
      e: '🇪',
      f: '🇫',
      g: '🇬',
      h: '🇭',
      i: '🇮',
      j: '🇯',
      k: '🇰',
      l: '🇱',
      m: '🇲',
      n: '🇳',
      o: '🇴',
      p: '🇵',
      q: '🇶',
      r: '🇷',
      s: '🇸',
      t: '🇹',
      u: '🇺',
      v: '🇻',
      w: '🇼',
      x: '🇽',
      y: '🇾',
      z: '🇿',
    };
  }

  normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  getMeaningString(meaning, word) {
    const meanings = meaning.querySelectorAll('> span:not(.cl)').map(it => it.innerText);
    let meaningString = meanings.find(it => this.normalize(it).indexOf(this.normalize(word)) === -1);

    if (!meaningString) {
      meaningString = meanings[0];
      const end = meaningString.indexOf(';');
      if (end !== -1) {
        meaningString = meaningString.substr(0, end);
      }
    }

    return meaningString;
  }

  async getNewWord() {
    try {
      const html = parse(await axios.get(process.env.WORDS_API_URL).then(r => r.data));
      const word = html.querySelector('[data="palavra"]').nextElementSibling.innerText.toLowerCase();

      const dicioWord = this.normalize(word);
      const checkDicio = parse(await axios.get(process.env.DICIO_URL.replace('%s', dicioWord)).then(r => r.data));
      const meaning = checkDicio.querySelector('.significado');

      if (!meaning || meaning.classList.contains('word-nf')) {
        return null;
      }

      return { word, meaning: this.getMeaningString(meaning, word) };
    } catch (e) {
      return null;
    }
  }

  async createWord() {
    let retry = 0;
    let word = null;

    do {
      word = await this.getNewWord();
      retry++;
    } while(word === null && retry < 3);

    if (word) {
      await this.client.databaseService.models.wordDay.create(word);
    }

    return word;
  }

  async printWord(event, wordDay, revealCount = 0) {
    const mask = this.client.wordDayService.getMaskedWord(wordDay.word, revealCount);
    await event.channel.send(
      `${this.i18n.message}\nDica: ${wordDay.meaning}\n${mask}`
    );
  }

  getEmojiWord(word) {
    return this.normalize(word).split('').map(l => this.emojiMap[l]).join(' ');
  }

  async checkAnswer(event, wordDay, guess) {
    let right = false;

    if (this.normalize(guess) === this.normalize(wordDay.word)) {
      const [affected] = await this.client.databaseService.models.wordDay.update(
        { answeredUserId: event.author.id },
        { where: { id: wordDay.id, answeredUserId: null } }
      );

      if (affected > 0) {
        right = true;

        const hintsUsed = await this.client.wordDayService.countHintsUsed(wordDay, event.author.id);
        const prize = this.client.wordDayService.calculatePrize(hintsUsed);

        await this.client.bankService.register(event.author.id);
        await this.client.bankService.credit(event.author.id, prize, this.i18n.bankLabel);

        event.reply(`${this.i18n.right.replace('{{V}}', prize)}\n${this.getEmojiWord(wordDay.word)}`);
      } else {
        const current = await this.client.databaseService.models.wordDay.findByPk(wordDay.id);
        const user = await this.client.users.fetch(current.answeredUserId);
        await event.reply(`${this.i18n.alreadyAnswered.replace('{{U}}', user.username)}\n${this.getEmojiWord(wordDay.word)}`);
      }
    } else {
      await event.reply(this.i18n.wrong);
    }

    await this.client.databaseService.models.wordDayAnswer.create({
      wordId: wordDay.id,
      userId: event.author.id,
      status: right ? RIGHT : WRONG,
    });
  }

  async exec(event, args) {
    let wordDay = await this.client.wordDayService.findToday();

    if (!wordDay) {
      wordDay = await this.createWord();

      if (!wordDay) {
        await event.reply(this.i18n.unavailable);
        return;
      }

      await this.printWord(event, wordDay);
      return;
    }

    if (wordDay.answeredUserId) {
      const user = await this.client.users.fetch(wordDay.answeredUserId);
      await event.reply(`${this.i18n.alreadyAnswered.replace('{{U}}', user.username)}\n${this.getEmojiWord(wordDay.word)}`);
    } else if (args.guess) {
      const lastGuessUser = await this.client.databaseService.models.wordDayAnswer.findOne({
        where: {
          wordId: wordDay.id,
          userId: event.author.id,
          status: { [Op.in]: [RIGHT, WRONG] },
        },
        order: [['createdAt', 'DESC']]
      });

      if (!lastGuessUser || moment().diff(moment(lastGuessUser.createdAt)) >= 120000) {
        await this.checkAnswer(event, wordDay, args.guess);
      } else {
        await event.reply(this.i18n.nextTry.replace('{{H}}', moment(lastGuessUser.createdAt).add(2, 'minutes').format('HH:mm:ss')));
      }
    } else {
      const hintsUsed = await this.client.wordDayService.countHintsUsed(wordDay, event.author.id);
      await this.printWord(event, wordDay, hintsUsed);
    }
  }
}

module.exports = PalavraCommand;
