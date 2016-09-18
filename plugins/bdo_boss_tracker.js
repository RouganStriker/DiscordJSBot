/*
  Replicate boss callouts from IHAU discord channel

  Listener Bot joins IHAU and relies messages to the bot on your Discord Server

  Setup:
  * Bot must have manage message permission on #boss_timer and #boss_callouts channel on your server
  * Token for a listener user stored in the env variable BDO_BOSS_TRACKER_LISTENER_TOKEN
*/
require('log-timestamp');
const BasePlugin = require('../utils/BasePlugin');

// Data is taken from the IHAU discord server
const IHAU_GUILD_ID = "208190699701665793";
const IHAU_BOT_ID = "213245982308171776";
const IHAU_BOSS_TIMER_CHANNEL_ID = "214032289254998016";
const IHAU_BOSS_LIVE_CHANNEL_ID = "214032387674210304";


class BDOBossTrackerPlugin extends BasePlugin {
    constructor(client) {
      super(client);

      this.LISTENER_CLIENT = new Discord.Client();
      this.GUILD_BOSS_TIMER_CHANNELS = null;    // Auto-populated by looking for a #boss_timer channel
      this.GUILD_BOSS_CALLOUTS_CHANNELS = null; // Auto-populated by looking for a #boss_callouts channel
      this.initListener();
    }

    initListener() {
      const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
      this.GUILD_BOSS_TIMER_CHANNELS = availableTextChannels.findAll('name', "boss_timer");
      this.GUILD_BOSS_CALLOUTS_CHANNELS = availableTextChannels.findAll('name', "boss_callouts");

      console.log(this.GUILD_BOSS_TIMER_CHANNELS.length > 0 ? "Found timer channel" : "Did not find timer channel");
      console.log(this.GUILD_BOSS_CALLOUTS_CHANNELS.length > 0 ? "Found callout channel" : "Did not find callout channel");

      this.LISTENER_CLIENT.login(process.env.BDO_BOSS_TRACKER_LISTENER_TOKEN)
                          .catch(console.log);

      this.LISTENER_CLIENT.on('ready', () => {
        console.log(this.LISTENER_CLIENT.user.username + " user is ready");
        const ihau_timer_channel = this.LISTENER_CLIENT.channels.find('id', IHAU_BOSS_TIMER_CHANNEL_ID);
        ihau_timer_channel.fetchMessages()
          .then(messages => {
              if (messages.size > 0) {
                const new_timer = messages.first().content;
                refresh_timer_page(new_timer);
              }
          })
          .catch(console.log);
      });

      this.listener_bot.on('message', message => {
        // Listen for boss timer changes
        const guild = message.guild;
        const author = message.author;
        const channel = message.channel;

        if (channel.type == "text" && guild.available && guild.id == IHAU_GUILD_ID && author.id == IHAU_BOT_ID) {
          // Update from IHAU's bot
          if (channel.id == IHAU_BOSS_TIMER_CHANNEL_ID) {
            // Boss Timer update
            this.refresh_timer_page(message.content);
          } else if (channel.id == IHAU_BOSS_LIVE_CHANNEL_ID) {
            // Live updates
            this.GUILD_BOSS_CALLOUTS_CHANNELS.every((channel) => channel.sendMessage(message.content));
          }
        }
      });
    }

    post_boss_timers(new_timer) {
      console.log("Updating boss timer");
      this.GUILD_BOSS_TIMER_CHANNELS.every((channel) => channel.sendMessage(new_timer));
    }

    refreshTimerPage(new_timer) {
      if (this.GUILD_BOSS_TIMER_CHANNEL == null) {
        console.log("Attempted to refresh boss timer channel but no discord server found");
        return;
      }

      this.GUILD_BOSS_TIMER_CHANNEL.fetchMessages()
        .then(messages => {
          if (messages.size > 1) {
            this.GUILD_BOSS_TIMER_CHANNEL.bulkDelete(this.GUILD_BOSS_TIMER_CHANNEL.messages)
            .then(() => this.post_boss_timers(new_timer))
            .catch(console.log);
          } else if (messages.size == 1) {
            messages.first().delete()
              .then(() => this.post_boss_timers(new_timer))
              .catch(console.log);
          } else {
            this.post_boss_timers(new_timer);
          }
        })
        .catch(console.log);
    }
}

module.exports = BDOBossTrackerPlugin;