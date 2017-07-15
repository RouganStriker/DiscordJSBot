require('log-timestamp');

const fs = require('fs');
const path_module = require('path');
const Discord = require('discord.js');
const Datastore = require('nedb')
const CommandManager = require('./utils/CommandManager');

const disabled_plugins = require('./disabled_plugins.conf');
const disabled_extensions = require('./disabled_commands.conf');

const config = require('config');
const client = new Discord.Client();
const plugins_dir = path_module.join(__dirname, 'plugins');
const commands_dir = path_module.join(__dirname, 'commands');

const commandMgr = new CommandManager(client);
const loadedPlugins = [];

let hasLoaded = false;

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
    commandMgr.registerCommand(new command());

    console.log("Loaded command from " + command_path);
  });
};

const loadPlugins = () => {
  let plugin = null;
  const disabledPlugins = config.get('disabledPlugins');

  loader(plugins_dir, 'plugin.js', (plugin_path) => {
    const dirname = path_module.dirname(plugin_path);
    const pluginName = path_module.basename(dirname);

    if (disabledPlugins.indexOf(pluginName) >= 0) {
      console.log(`Skipping plugin ${pluginName}`);
      return;
    }

    plugin = require(plugin_path);

    const provision_datastore = (db_name='', timestampData=false, autoload=true) => {
      // Prefix the db_name with the plugin name to avoid db files clashing
      const dsName = path_module.format({
        dir: path_module.dirname(plugin_path),
        name: db_name,
        ext: '.db'
      });
      return new Datastore({
        filename: dsName,
        timestampData,
        autoload,
        onload: console.error
      });
    }
    const newPlugin = new plugin(client, provision_datastore, pluginName);

    commandMgr.registerPluginCommands(newPlugin.getCommands());
    loadedPlugins.push(newPlugin);

    console.log("Loaded plugin from " + plugin_path + " with " + newPlugin.getCommands().length + " commands.");
  });
};

client.on('ready', () => {
  console.log("Discord Bot is ready.");

  if (hasLoaded) {
    // Prevent reloading of commands and plugins when client re-connects
    return;
  }

  hasLoaded = true;

  loadCommands();
  loadPlugins();
});

client.on('reconnecting', () => {
  console.warn("Discord Bot attempting to reconnect...");
});

client.on('error', (error) => {
  console.error(error);
});

client.on('disconnect', (error) => {
  console.warn("Discord Bot disconnected, starting reconnect...");
  console.error(error);
  client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);
})

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);
