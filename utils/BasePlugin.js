class BasePlugin {
  /**
   * @param {Client} client The Discord Client that gets passed into this Plugin
   */
  constructor(client, requireDatastore = false) {
    this.client = client;
    this.requireDatastore = false;
    this.datastore = null;
    this.init();
  }

  init() {
    //no-op;
  }

  getCommands() {
    // sub-classes can return a list of commands
    return [];
  }

  getDatastore() {
    if (this.datastore === null) {
      console.warn("No datastore has been provisioned for this plugin!");
    }
    return this.datastore;
  }

  setDatastore(datastore) {
    // Datastore is auto-provisioned by the plugin loader
    this.datastore = datastore;
  }
}

module.exports = BasePlugin;