const Command = require('../../utils/Command');


class DiceCommand extends Comment {
  constructor() {
    super('roll', 'Roll a six-sided dice', this.roll);
  }

  roll(message, args) {
    return this.getRandomInt(6);
  }

  cgetRandomInt(max) {
    return Math.floor(Math.random() * max + 1);
  }
}

module.exports = DiceCommand;
