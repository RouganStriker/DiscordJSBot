roll(message, args) {
  return this.getRandomInt(6);
}

getRandomInt(max) {
  return Math.floor(Math.random() * max + 1);
}

module.exports = {
  'name': 'roll',
  'description': 'Roll a six-sided dice',
  'callback': roll
};
