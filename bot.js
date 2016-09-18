require('log-timestamp');

const fs = require('fs');
const path_module = require('path');
const Discord = require('discord.js');
const BasePlugin = require('./utils/BasePlugin');
const bot = new Discord.Client();
const plugin_dir = path_module.join(__dirname, 'plugins');
var plugin_holder = {};

const isClass = (v) => {
   return typeof v === 'function' && v.prototype.constructor === v;
}

const LoadPlugins = () => {
  var num_plugins = 0;
  var num_loaded = 0;

  fs.lstat(plugin_dir, function(err, stat) {
    if (!stat.isDirectory()) {
      console.log("Expected plugins to be a directory");
      exit(1);
    }

    fs.readdir(plugin_dir, function(err, files) {
      const num_plugins = files.length;
      var num_loaded = 0;
      var plugin = null;

      console.log("Found " + num_plugins + " plugins");

      for (var i = 0; i < num_plugins; i++) {
        f = path_module.join(plugin_dir, files[i]);

        try {
          plugin = require(f);

          if (!isClass(plugin) || plugin.prototype instanceof BasePlugin) {
            console.log("Invalid plugin : " + files[i]);
            continue;
          }

          // Initialize plugin
          plugin_holder[files[i]] = plugin(bot);
        } catch(e) {
          console.log("Failed to load " + files[i] + ". Reason : " + e);
          continue;
        }

        console.log("Loaded plugin " + files[i]);
        num_loaded++;
      }

      console.log("Loaded " + num_loaded + "/" + num_plugins + " plugins");
    });
  });
};

bot.on('ready', () => {
  console.log("Discord Bot is ready.");

  // Load plugins
  LoadPlugins();
});

bot.on('message', message => {
  if (message.content.match(/^!help$/i)) {
    message.channel.sendMessage("```!help Display this message```");
  }
});

bot.login(process.env.DISCORD_BOT_TOKEN)
   .catch((reason) => console.log);

