const BasePlugin = require('../../utils/BasePlugin');
const Command = require('../../utils/Command');

class MusicPlugin extends BasePlugin {
  init() {
    this.initCommands();
    this.initListener();
  }

  updateConfig(err, config){
      if (err) {
        this.log(err).bind(this);
        return;
      }
      if (config == null) {
        // Load the default values into the DB
        config = {
          MUSIC_CHANNEL_ID: null,   // Channel to monitor for new music links
          VOICE_CHANNEL_ID: null,   // Channel to play music
          AUTO_ADD_NEW_LINKS: true                  // Whether to auto add new links from MUSIC_CHANNEL_ID to playlist
        };

        this.configDB.insert(config, this.updateConfig.bind(this));
      } else {
        this.MUSIC_CHANNEL_ID = config.MUSIC_CHANNEL_ID;
        this.VOICE_CHANNEL_ID = config.VOICE_CHANNEL_ID;
        this.AUTO_ADD_NEW_LINKS = config.AUTO_ADD_NEW_LINKS;
        this.configID = config._id;
      }
  }

  initDB() {
    // Setup music DB
    this.musicDB = this.getDB('music');
    this.musicDB.ensureIndex({ fieldName: 'name' }, function (err) {
      console.error("[musicDB] 'name' field error : " + err);
    });
    this.musicDB.ensureIndex({ fieldName: 'link', unique: true }, function (err) {
      console.error("[musicDB] 'link' field error : " + err);
    });
    this.musicDB.ensureIndex({ fieldName: 'playCount' }, function (err) {
      console.error("[musicDB] 'playCount' field error : " + err);
    });

    // Setup the config DB
    this.configDB = this.getDB('config');
    this.configDB.findOne({}, this.updateConfig.bind(this));
  }

  initCommands() {
    /*
     *  MusicBot related commands
     */
     this.commands = [];

     this.commands.push(new Command(
       'setMusicChannelID',
       'Set music channel for MusicBot',
       this.setMusicChannelID.bind(this),
       ['ADMINISTRATOR']
     ));

     this.commands.push(new Command(
       'setVoiceChannelID',
       'Set voice channel for MusicBot',
       this.setVoiceChannelID.bind(this),
       ['ADMINISTRATOR']
     ));
  }

  initListener() {
    this.client.on('message', message => {
      if (!this.AUTO_ADD_NEW_LINKS || message.channel.id != this.MUSIC_CHANNEL_ID) {
        return;
      }

      this.log(`Got new message ${message.content}`).bind(this);
    });
  }

  getCommands() {
    return this.commands;
  }

  setMusicChannelID(message) {
    const args = message.content.split(' ');

    this.configDB.update(
      { _id: this.configID },
      { $set: { MUSIC_CHANNEL_ID: args[1] } },
      {},
      this.log.bind(this)
    );

    return `Setting music channel ID to ${args[1]}`;
  }

  setVoiceChannelID(message) {
    const args = message.content.split(' ');

    this.configDB.update(
      { _id: this.configID },
      { $set: { VOICE_CHANNEL_ID: args[1] } },
      {},
      this.log.bind(this)
    );

    return `Setting voice channel ID to ${args[1]}`;
  }
}

module.exports = MusicPlugin;