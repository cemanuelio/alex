const { Op } = require('sequelize');
const moment = require('moment');
const { HINT } = require('../models/enum/wordDayAnswerStatusEnum');

class WordDayService {
  constructor({ databaseService }) {
    this.databaseService = databaseService;
    this.basePrize = 200;
    this.hintPenaltyRate = 0.2;
    this.minPrizeRate = 0.1;
  }

  getDate(h, m, s) {
    return moment().hour(h).minute(m).second(s).millisecond(0);
  }

  findToday() {
    return this.databaseService.models.wordDay.findOne({
      where: {
        createdAt: {
          [Op.between]: [this.getDate(0, 0, 0), this.getDate(23, 59, 59)],
        },
      },
    });
  }

  countHintsUsed(wordDay, userId) {
    return this.databaseService.models.wordDayAnswer.count({
      where: { wordId: wordDay.id, userId, status: HINT },
    });
  }

  async useHint(wordDay, userId) {
    const hintsUsed = await this.countHintsUsed(wordDay, userId);

    await this.databaseService.models.wordDayAnswer.create({
      wordId: wordDay.id,
      userId,
      status: HINT,
    });

    return hintsUsed + 1;
  }

  getMaskedWord(word, revealCount) {
    const capped = Math.min(revealCount, word.length - 1);
    return word.split('').map((letter, i) => (i < capped ? letter.toUpperCase() : '🔳')).join(' ');
  }

  calculatePrize(hintsUsed) {
    const reduction = Math.min(hintsUsed * this.hintPenaltyRate, 1 - this.minPrizeRate);
    return Math.round(this.basePrize * (1 - reduction));
  }
}

module.exports = WordDayService;
