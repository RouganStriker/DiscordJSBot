const Command = require('../../utils/Command');


class DiceCommand extends Command {
  constructor() {
    super('roll', 'Roll a six-sided dice');
  }

  runCommand(message, args) {
    return this.getRandomInt(6);
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * max + 1);
  }
}

module.exports = DiceCommand;
