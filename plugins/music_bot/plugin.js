const BasePlugin = require('../../utils/BasePlugin');

class ManageMemberPlugin extends BasePlugin {
  init() {
    this.initDB();
    this.initCommands();
    this.initListener();
  }

  initDB() {
    // Setup music DB
    this.membersDB = this.getDB('songs', true);
    this.fieldsDB.ensureIndex({ fieldName: 'name' }, function (err) {
      console.error("[songsDB] 'name' field error : " + err);
    });
    this.fieldsDB.ensureIndex({ fieldName: 'link', unique: true }, function (err) {
      console.error("[songsDB] 'link' field error : " + err);
    });
    this.fieldsDB.ensureIndex({ fieldName: 'playCount' }, function (err) {
      console.error("[songsDB] 'playCount' field error : " + err);
    });

    // Setup the config DB
    this.configDB = this.getDB('config');
    this.configDB.findOne({}, function(err, config) {
      if (doc != null) {
        // Load the default values into the DB
        config = {
          MUSIC_CHANNEL_ID: "246230860645269504",   // Channel to monitor for new music links
          VOICE_CHANNEL_ID: "249857283717201920",   // Channel to play music
          AUTO_ADD_NEW_LINKS: true                  // Whether to auto add new links from MUSIC_CHANNEL_ID to playlist
        };

        this.configDB.insert(config);
      }

      this.MUSIC_CHANNEL_ID = config.MUSIC_CHANNEL_ID;
      this.VOICE_CHANNEL_ID = config.VOICE_CHANNEL_ID;
      this.AUTO_ADD_NEW_LINKS = config.AUTO_ADD_NEW_LINKS;
    });
  }

  initCommands() {
    /*
     *  MusicBot related commands
     */
     this.commands = [];
  }

  initListener() {
    this.client.on('message', message => {
      if (!this.AUTO_ADD_NEW_LINKS || message.channel.id != this.MUSIC_CHANNEL_ID) {
        return;
      }

      this.log(`Got new message ${message.content}`);
    }
  }
}