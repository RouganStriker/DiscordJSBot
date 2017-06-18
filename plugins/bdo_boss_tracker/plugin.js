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
  initDB() {
    this.configDB = this.getDB('config');

    this.configDB.findOne({}, function(err, config) {
      if (doc != null) {
        // Load the default values into the DB
        config = {
          IHAU_GUILD_ID: "246230860645269504",
          IHAU_BOT_ID: "249857283717201920",
          IHAU_BOSS_TIMER_CHANNEL_ID: "250988763155660801",
          IHAU_BOSS_LIVE_CHANNEL_ID: "250988782051000321"
        };

        this.configDB.insert(config);
      }

      this.IHAU_GUILD_ID = config.IHAU_GUILD_ID;
      this.IHAU_BOT_ID = config.IHAU_BOT_ID;
      this.IHAU_BOSS_TIMER_CHANNEL_ID = config.IHAU_BOSS_TIMER_CHANNEL_ID;
      this.IHAU_BOSS_LIVE_CHANNEL_ID = config.IHAU_BOSS_LIVE_CHANNEL_ID;
    });

  }

  init() {
    // Data is taken from the IHAU discord server
    this.LISTENER_CLIENT = new Discord.Client();
    this.GUILD_BOSS_TIMER_CHANNELS = null;    // Auto-populated by looking for a #boss_timer channel
    this.GUILD_BOSS_CALLOUTS_CHANNELS = null; // Auto-populated by looking for a #boss_callouts channel
    this.IHAU_UPDATE_CHANNEL = null;
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
  }

  fetchLatestTimer() {
    // There is at most 1 message on the timer channel
    this.IHAU_TIMER_CHANNEL.fetchMessages()
      .then(messages => {
        if (messages.size > 0) {
          const new_timer = messages.first().content;
          this.queueTimerPageRefresh(new_timer);
        }
      })
      .catch(console.error);
  }

  fetchLatestCallout() {
    // The latest callout should be the latest post by the IHA Bot
    this.IHAU_UPDATE_CHANNEL.fetchMessages()
      .then(messages => {
        const filteredMessages = messages.filter((message) => {
           return message.author.id === this.IHAU_BOT_ID;
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
      this.IHAU_UPDATE_CHANNEL = this.LISTENER_CLIENT.channels.find('id', this.IHAU_BOSS_LIVE_CHANNEL_ID);
      this.IHAU_TIMER_CHANNEL = this.LISTENER_CLIENT.channels.find('id', this.IHAU_BOSS_TIMER_CHANNEL_ID);

      this.fetchLatestTimer();
    });

    this.LISTENER_CLIENT.on('message', message => {
      // Listen for boss timer changes
      const guild = message.guild;
      const author = message.author;
      const channel = message.channel;

      if (channel.type == "text" && guild.available && guild.id == this.IHAU_GUILD_ID && author.id == this.IHAU_BOT_ID) {
        // Update from IHAU's bot
        if (channel.id == this.IHAU_BOSS_TIMER_CHANNEL_ID) {
          // Boss Timer update
          this.queueTimerPageRefresh(message.content);
        } else if (channel.id == this.IHAU_BOSS_LIVE_CHANNEL_ID) {
          // Live updates
          this.queueLivePageRefresh(message);
        }
      } else if (author.id != this.LISTENER_CLIENT.user.id && !author.bot && channel.type == "dm") {
        // Auto-respond to non-bot direct messages
        channel.sendMessage("You've caught me! I am actually a bot. For more information please message @rouganstriker#5241")
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

    //console.info("[" + channel.guild.name + "] " + log);
    channel.sendMessage(message).then(callback).catch(console.error);
  }

  queueTimerPageRefresh(new_update) {
    this.lastTimerUpdate = new_update;

    if (this.timerUpdateLock.getLock()) {
      this.refreshTimerPage();
    }
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

      channel.fetchMessages()
         .then(messages => {
           if (messages.size > 1) {
             channel.bulkDelete(channel.messages)
                    .then(performUpdate)
                    .catch(handleError);
           } else if (messages.size == 1) {
             messages.first().delete()
                             .then(performUpdate)
                             .catch(handleError);
           } else {
             performUpdate();
           }
        })
        .catch((e) => {
          this.timerUpdateLock.unlock();
          console.error(handleError);
        });
    });
  }

  queueLivePageRefresh(new_update) {
    this.lastLiveUpdate = new_update;

    if (new_update.mentions.roles.size > 0) {
      // Boss call-out, post right away
      const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
      const callout_channels = availableTextChannels.findAll('name', "boss_callouts");
      const postMessage = "@everyone " + new_update.cleanContent;

      callout_channels.forEach((channel) => {
        this.postToChannel(
          channel,
          postMessage,
          "Refreshing live call-outs"
        );
      });
    } else if (this.liveUpdateLock.getLock()) {
      this.refreshLivePage();
    }
  }

  refreshLivePage() {
    let new_update = this.lastLiveUpdate.cleanContent;
    const availableTextChannels = this.client.channels.filter((c) => c.type == "text");
    const callout_channels = availableTextChannels.findAll('name', "boss_callouts");

    // Unlock after we have updated every channel
    this.liveUpdateLock.setLock(callout_channels.length);

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
      }

      channel.fetchMessages({limit: 100})
             .then(messages => {
               let filtered_messages = null;

               if (new_update.indexOf("Currently no Bosses alive") >= 0) {
                 // Clear everything but the pinned messages
                 filtered_messages = messages.filter((message) => {
                   return !message.pinned;
                 });
               } else {
                 filtered_messages = messages.filter((message) => {
                   // Delete the bot's updates excluding the callouts
                   return message.author.id === this.client.user.id && !message.mentions.everyone;
                 });
               }

               if (filtered_messages != null && filtered_messages.size > 1) {
                 channel.bulkDelete(filtered_messages)
                        .then(performUpdate)
                        .catch(handleError);
               } else if (filtered_messages != null && filtered_messages.size == 1) {
                 filtered_messages.first().delete()
                                          .then(performUpdate)
                                          .catch(handleError);
               } else {
                 performUpdate();
               }
            })
            .catch(handleError);
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
    const liveRegex = new RegExp('^(' + validBosses.join('|') + ') (' + validChannels.join('|') + ')[12] (\\d{1,7}%?|d|dead)', 'i');

    this.client.on('message', message => {
      const {
        author,
        channel
      } = message;

      if (author === this.client.user || !this.GUILD_BOSS_CALLOUTS_CHANNELS.includes(channel)) {
        return;
      }

      if (message.content.match(initRegex) || message.content.match(liveRegex)) {
        //console.info("Relaying update: " + message.author.username + " - " + message.content);
        this.IHAU_UPDATE_CHANNEL.sendMessage(message.content)
                                .then("Relayed update to IHANA")
                                .catch("Failed to relay update to IHANA");
      }
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
