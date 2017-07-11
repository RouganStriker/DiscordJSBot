/*
  Replicate boss callouts from IHAU discord channel

  Listener Bot joins IHAU and relies messages to the bot on your Discord Server

  Setup:
  * Bot must have manage message permission on #boss_timer and #boss_callouts channel on your server
  * Token for a listener user stored in the env variable BDO_BOSS_TRACKER_LISTENER_TOKEN
*/
const Discord = require('discord.js');
const BasePlugin = require('../../utils/BasePlugin');
const Command = require('../../utils/Command');


class ChannelUpdateLock {
  constructor() {
    this.count = 0;
  }

  isLocked() {
    return this.count > 0;
  }

  unlock() {
    // Remove 1 layer of lock
    if (this.count > 0) {
      this.count -= 1;
    }
  }

  setLock(amount=1) {
    // Apply x layers of lock
    if (amount < 0) {
      throw("Expected non-negative amount.");
    }
    this.count = amount;
  }

  getLock() {
    // Attempt to retrieve the lock
    if (this.isLocked()) {
      return false;
    }

    // Lock it and return
    this.count = 1;
    return true;
  }
}


class BDOBossTrackerPlugin extends BasePlugin {

  init() {
    this.LISTENER_CLIENT = new Discord.Client();

    this.REMOTE_GUILD_ID = "171908522269736969";
    this.REMOTE_BOSS_TIMER_CHANNEL_ID = "246364525438173184";
    this.REMOTE_BOSS_LIVE_CHANNEL_ID = "172146835656278016";
    this.REMOTE_BOSS_NOTIFICATION_CHANNEL_ID = "171931874350989312";
    this.REMOTE_BOT_ID = "249221836380962816";

    this.GUILD_BOSS_TIMER_CHANNELS = null;    // Auto-populated by looking for a #boss_timer channel
    this.GUILD_BOSS_CALLOUTS_CHANNELS = null; // Auto-populated by looking for a #boss_callouts channel
    this.REMOTE_UPDATE_CHANNEL = null;
    this.REMOTE_TIMER_CHANNEL = null;

    // Cache callout messages
    this.callout_message_cache = {};
    this.BOSS_NAMES = ["kutum", "karanda", "kzarka", "bheg", "mudster", "tree", "rednose", "nouver"];

    this.initListener();
    this.initRelay();
    this.initCommands();

    this.lastLiveUpdate = null;
    this.liveUpdateLock = new ChannelUpdateLock();

    this.lastTimerUpdate = '';
    this.timerUpdateLock = new ChannelUpdateLock();

  }

  fetchChannels() {
    const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
    this.GUILD_BOSS_TIMER_CHANNELS = availableTextChannels.findAll('name', "boss_timer");
    this.GUILD_BOSS_CALLOUTS_CHANNELS = availableTextChannels.findAll('name', "boss_callouts");
    console.log("Found " + this.GUILD_BOSS_TIMER_CHANNELS.length + " timer channels");
    console.log("Found " + this.GUILD_BOSS_CALLOUTS_CHANNELS.length + " callout channels");

    // Build cache for callouts
    this.GUILD_BOSS_CALLOUTS_CHANNELS.forEach(channel => {
      this.callout_message_cache[channel.id] = {};
    });
  }

  fetchLatestTimer() {
    // There is at most 1 message on the timer channel
    this.REMOTE_TIMER_CHANNEL.fetchMessages()
      .then(messages => {
        if (messages.size > 0) {
          const new_timer = messages.first();
          this.queueTimerPageRefresh(new_timer);
        }
      })
      .catch(console.error);
  }

  deleteMessageInChannel(channel, onSuccess, onError, filter = null) {
    channel.fetchMessages()
           .then(messages => {
             if (filter) {
               messages = messages.filter(filter);
             }
             if (messages.size > 1) {
               channel.bulkDelete(messages)
                      .then(onSuccess)
                      .catch(onError);
             } else if (messages.size == 1) {
               messages.first().delete()
                               .then(onSuccess)
                               .catch(onError);
             } else {
               onSuccess();
             }
          })
          .catch(onError);
  }

  refreshTimerPage() {
    const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
    const timer_channels = availableTextChannels.findAll('name', "boss_timer");

    // Unlock after we have updated every channel
    this.timerUpdateLock.setLock(timer_channels.length);

    timer_channels.forEach((channel) => {
      const performUpdate = () => {
        this.postToChannel(
          channel,
          this.lastTimerUpdate,
          "Refreshing boss timer",
          this.timerUpdateLock.unlock()
        );
      };
      const handleError = (error) => {
        this.timerUpdateLock.unlock();
        console.error(error);
      }

      this.deleteMessageInChannel(channel, performUpdate, handleError);
    });
  }


  fetchLatestCallout() {
    // The latest callout should be the latest post by the IHA Bot
    this.REMOTE_UPDATE_CHANNEL.fetchMessages()
      .then(messages => {
        const filteredMessages = messages.filter((message) => {
           return message.author.bot;
        });
        if (filteredMessages.size > 0) {
          const new_callout = filteredMessages.first();
          this.queueLivePageRefresh(new_callout);
        }
      })
      .catch(console.error);
  }

  initListener() {
    console.log("Initializing Listeners");
    this.fetchChannels();
    this.LISTENER_CLIENT.on('ready', () => {
      console.log(this.LISTENER_CLIENT.user.username + " user is ready");
      this.REMOTE_UPDATE_CHANNEL = this.LISTENER_CLIENT.channels.find('id', this.REMOTE_BOSS_LIVE_CHANNEL_ID);
      this.REMOTE_TIMER_CHANNEL = this.LISTENER_CLIENT.channels.find('id', this.REMOTE_BOSS_TIMER_CHANNEL_ID);

      this.fetchLatestTimer();
    });

    this.LISTENER_CLIENT.on('message', message => {
      // Listen for boss timer changes
      const guild = message.guild;
      const author = message.author;
      const channel = message.channel;

      if (channel.type == "text" && guild.available && guild.id == this.REMOTE_GUILD_ID && author.bot) {
        // Bot Update
        if (channel.id == this.REMOTE_BOSS_TIMER_CHANNEL_ID) {
          // Boss Timer update
          this.queueTimerPageRefresh(message);
        } else if (channel.id == this.REMOTE_BOSS_LIVE_CHANNEL_ID) {
          // Live updates
          this.queueLivePageRefresh(message);
        } else if (channel.id == this.REMOTE_BOSS_NOTIFICATION_CHANNEL_ID) {
          // Spawn
          const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
          const callout_channels = availableTextChannels.findAll('name', "boss_callouts");
          callout_channels.forEach((channel) => {
            this.postToChannel(
              channel,
              message.content,
              "Refreshing live call-outs"
            );
          });
        }
      } else if (author.id != this.LISTENER_CLIENT.user.id && !author.bot && channel.type == "dm") {
        // Auto-respond to non-bot direct messages
        channel.send("You've caught me! I am actually a bot. For more information please message @rouganstriker#5241")
      }
    });

    this.LISTENER_CLIENT.on('reconnecting', () => {
      console.warn("Attempting to reconnect...");
    });

    this.LISTENER_CLIENT.on('error', (error) => {
      console.error(error);
    });

    this.LISTENER_CLIENT.login(process.env.BDO_BOSS_TRACKER_LISTENER_TOKEN);
  }

  postToChannel(channel, message, log, callback) {
    if (!this.client.channels.exists('id', channel.id)) {
      console.log("Channel no longer exists, pending purge from cache: " + channel.id);
      return;
    }

    if (message.content) {
      channel.send(message.content).then(callback).catch(console.error);
    } else if (message.embeds) {
      for (var i=0; i < message.embeds.length; i++) {
        const embed = new Discord.RichEmbed(message.embeds[i])
        const _callback = i == message.embeds.length ? callback : null;
        channel.send({embed}).then(_callback).catch(console.error);
      }
    } else {
      channel.send(message).then(callback).catch(console.error);
    }
  }

  queueTimerPageRefresh(new_update) {
    this.lastTimerUpdate = new_update;

    if (this.timerUpdateLock.getLock()) {
      this.refreshTimerPage();
    }
  }

  queueLivePageRefresh(new_update) {
    if (new_update.author.id == this.REMOTE_BOT_ID && new_update.mentions.users.size > 0) {
      // Bot is responding to somoene, ignore these
      return;
    }

    this.lastLiveUpdate = new_update;

    if (this.liveUpdateLock.getLock()) {
      this.refreshLivePage();
    }
  }

  refreshLivePage() {
    let new_update = this.lastLiveUpdate;
    const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
    const callout_channels = availableTextChannels.findAll('name', "boss_callouts");
    var new_embed = null;
    var boss_name = null;

    // Unlock after we have updated every channel
    this.liveUpdateLock.setLock(callout_channels.length);

    // Fix the message
    if (new_update.attachments.size > 0) {
      // Get bossname from filename. e.g. Kutum.png
      boss_name = new_update.attachments.first().filename.split('.')[0].toLowerCase();

      new_embed = new Discord.RichEmbed();
      new_embed.setTitle(new_update.author.username.split('-')[0]);
      new_embed.setImage(new_update.attachments.first().url);
      new_update.embeds.push(new_embed);
    }

    callout_channels.forEach((channel) => {
      const performUpdate = () => {
        this.postToChannel(
          channel,
          new_update,
          "Refreshing live call-outs",
          this.liveUpdateLock.unlock()
        );
      };
      const handleError = (error) => {
        this.liveUpdateLock.unlock();
        console.error(error);
      };

      const filter = (message) => {
        if (message.id == "254105100111446016") {
          // Leave help message alone
          return false;
        }
        if (!message.author.bot) {
          // Clear messages posted by people
          return true;
        }
        if (new_update.author.id == this.REMOTE_BOT_ID) {
          // Check for boss dead message
          const boss_names = ["karanda", "kzarka", "kutum", "tree", "rednose", "nouver", "bheg", "mudster"];
          const boss_regex = new RegExp('(' + boss_names.join('|') + ')', 'i');
          const found_boss = boss_regex.exec(new_update.content);

          if (found_boss &&  message.embeds.length > 0 && message.embeds[message.embeds.length-1].title.match(new RegExp(found_boss[0], 'i'))) {
            return true
          }
        }
        if (new_update.embeds.length > 0 && message.embeds.length > 0 && new_update.embeds[0].title.trim() == message.embeds[message.embeds.length-1].title.trim()) {
          // Delete Old HP updates
          return true;
        }

        return false;
      };

      // Find message to update
      if (boss_name) {
        const cached_message = this.callout_message_cache[channel.id][boss_name];

        if (cached_message) {
          cached_message.edit({embed: new_embed});
        } else {
          const existing_message = channel.messages.find(message => message.embeds.length > 0 && message.embeds[message.embeds.length-1].title == boss_name);

          if (existing_message) {
            existing_message.edit({embed: new_embed})
                          .then(message => this.callout_message_cache[channel.id][boss_name] = message)
                          .catch(console.error);
          } else {
            channel.send(`@everyone ${boss_name} has spawned`, {embed: new_embed})
                   .then(message => this.callout_message_cache[channel.id][boss_name] = message)
                   .catch(console.error);
          }
        }
      }
      this.deleteMessageInChannel(channel, performUpdate, handleError, filter);
    });
  }

  initRelay() {
    // Relay messages back to IHAU
    const validBosses = [
      'rn',
      'dt',
      'bh',
      'gm',
      'ku',
      'ka',
      'kz',
    ];

    const validChannels = [
      'vel', 've', 'velia',
      'bal', 'b', 'balenos',
      'cal', 'c', 'calpheon',
      'ser', 's', 'serendia',
      'med', 'm', 'mediah',
      'val', 'va', 'valencia'
    ];

    const initRegex = new RegExp('^(' + validBosses.join('|') + ') (up|spawned|unconfirmed)', 'i');
    const liveRegex = new RegExp('^(' + validBosses.join('|') + ') (' + validChannels.join('|') + ')[1-6] (\\d{1,3}%?|d|dead)', 'i');

    this.client.on('message', message => {
      const {
        author,
        channel
      } = message;

      if (author === this.client.user || !this.GUILD_BOSS_CALLOUTS_CHANNELS.includes(channel)) {
        return;
      }

//      if (message.content.match(initRegex) || message.content.match(liveRegex)) {
//        //console.info("Relaying update: " + message.author.username + " - " + message.content);
//        this.REMOTE_UPDATE_CHANNEL.send(message.content)
//                                .then("Relayed update to IHANA")
//                                .catch("Failed to relay update to IHANA");
//      }
    });
  }

  configureSetting(message) {
    const params = message.content.split(' ');

    if (params.length == 1 || params[1].strip() == '') {
      // Return current config

    }
  }

  initCommands() {
    /*
     *  BDO boss tracker related commands
     *  - !refreshBossTimer
     *  - !refreshBossCallouts
     *  - !configure
     */
     this.commands = [];

     this.commands.push(new Command(
       'refreshBossTimer',
       'Refresh the boss timer',
       this.fetchLatestTimer.bind(this)
     ));

     this.commands.push(new Command(
       'refreshBossCallouts',
       'Refresh the boss callouts',
       this.fetchLatestCallout.bind(this)
     ));

     this.commands.push(new Command(
       'configure',
       'Configure a one of the bot\'s settings',
       this.configureSetting.bind(this),
       ['ADMINISTRATOR']
     ));
  }

  getCommands() {
    return this.commands;
  }
}

module.exports = BDOBossTrackerPlugin;
