class BasePlugin {
  /**
   * @param {Client} client The Discord Client that gets passed into this Plugin
   */
  constructor(client) {
    this.client = client;
    this.init();
  }

	init() {
	  //no-op;
	}

	getCommands() {
	  // sub-classes can return a list of commands
	  return [];
	}
}

module.exports = BasePlugin;