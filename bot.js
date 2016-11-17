require('log-timestamp');

const fs = require('fs');
const path_module = require('path');
const Discord = require('discord.js');
const CommandManager = require('./utils/CommandManager');

const disabled_plugins = require('./disabled_plugins.conf');
const disabled_extensions = require('./disabled_commands.conf');

const client = new Discord.Client();
const plugins_dir = path_module.join(__dirname, 'plugins');
const commands_dir = path_module.join(__dirname, 'commands');

const commandMgr = new CommandManager(client);
const loadedPlugins = [];

const loader = (directory, fileName, callback) => {
  // Navigates the directory and looks for all occurrences of fileName in the subdirectories

  if (!fs.lstatSync(directory).isDirectory()) {
    console.log("Expected " + directory + " to be a directory");
    exit(1);
  }

  fs.readdir(directory, function(err, subdirectories) {
    for (const i in subdirectories) {
      const f = path_module.join(directory, subdirectories[i]);
      if (!fs.lstatSync(f).isDirectory()) {
        continue;
      }

      // Look for fileName in subdirectory
      fs.readdir(f, function(err, files) {
        for (const j in files) {
          if (files[j] === fileName) {
            callback(path_module.join(f, files[j]));
          }
        }
      });
    }
  });
};

const loadCommands = () => {
  let command = null;

  loader(commands_dir, 'command.js', (command_path) => {
    command = require(command_path);
    commandMgr.registerCommand(command);
  });
};

const loadPlugins = () => {
  let plugin = null;

  loader(plugins_dir, 'plugin.js', (plugin_path) => {
    plugin = require(plugin_path);

    const newPlugin = new plugin(client);
    commandMgr.registerPluginCommands(newPlugin.getCommands());
    loadedPlugins.push(newPlugin);
  });
};

client.on('ready', () => {
  console.log("Discord Bot is ready.");

  // Load commands
  loadCommands();

  loadPlugins();
});

client.on('reconnecting', () => {
  console.warn("Discord Bot attempting to reconnect...");
});

client.on('error', (error) => {
  console.error(error);
});

client.login(process.env.DISCORD_BOT_TOKEN)
      .catch((reason) => console.log);
