const Command = require('./Command');

class CommandManager {
  constructor(client) {
    this.client = client;
    this.commands = {};
    this.pluginCommands = {};
    this.regexCmd = new RegExp(/^!(\S+)/);
    this.cachedHelpText = null;

    this.registerCommand(Command(
      'help',
      'Display this help text',
      this.handleHelp.bind(this)
    ));

    this.client.on('message', this.handleMessage.bind(this));
  }

  registerCommand(command) {
    if (command.name in command) {
      throw new Error("Attempted to register duplicate command: " + command.name);
    }

    this.commands[command.name] = command;
  }

  registerPluginCommands(commands) {
    commands.forEach((command) => {
      this.registerCommand(command);
    });
  }

  handleHelp(message) {
    if (self.cachedHelpText != null) {
      return self.cachedHelpText;
    }

    const helpTexts = [];
    let cmd = null;

    for (const i in this.commands) {
      cmd = this.commands[i];
      helpTexts.push('!' + cmd.name + ' - ' + cmd.description);
    }

    self.cachedHelpText = "```" + helpTexts.join('\n') + "```";

    return self.cachedHelpText;
  }

  handleMessage(message) {
    if (message.author == this.client.user) {
      return;
    }

    const match = this.regexCmd.exec(message.content)

    // Check if message is a command
    if (match === null || !(match[1] in this.commands)) {
      return;
    }

    // Check permissions on command
    const { member } = message;
    const {
      permissions,
      callback
    } = this.commands[match[1]];

    if (permissions.length > 0 && (member === null || !member.hasPermissions(permissions))) {
      return;
    }

    // Execute command
    message.channel.sendMessage(callback(message), {split: true});
  }
}

module.exports = CommandManager;
