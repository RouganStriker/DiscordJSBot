const parseFunction = require('parse-function');


class Command {
  constructor(commandFn) {
    const obj = parseFunction(commandFn);

    this.name = obj.name;
    this.commandFn = commandFn;
  }
}

class BasePlugin {
    /**
     * @param {Client} client The Discord Client that gets passed into this Plugin
     */
    constructor(client) {
      this.client = client;
      this.commandMapping = {};

      //this.client.on('message', this.callCommand);
    }

    /**
     *  Execute a command if one matches a command's regex pattern in the mapping
     */
    callCommand(message) {
      for (var command in this.commandMapping) {
        if message.content.match(command) {
          this.commandMapping[command](message);
          break;
        }
      }
    }

    /**
     * Register a command function.
     *
     * The function will be parsed and a regex pattern will be generated for it using the function name and params.
     * @param {Function} command The command to be added.
     */
    registerCommand(commandFn) {
      const command = Command(commandFn);

    }
}

module.exports = BasePlugin;