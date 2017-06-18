class BasePlugin {
  /**
   * @param {Client} client The Discord Client that gets passed into this Plugin
   */
  constructor(client, provision_datastore, plugin_name) {
    // Discord client
    this.client = client;
    // Datastore provisioning function
    // Usage: provision_datastore(db_name, timestampData=false, onload=true)
    this.provision_datastore = provision_datastore;
    this.initDB();
    this.init();
    this.name = plugin_name;
  }

  initDB() {
    // initialize DB structure
  }

  init() {
    //no-op;
  }

  getCommands() {
    // sub-classes can return a list of commands
    return [];
  }

  getDB(db_name, timestampData=false, autoload=true) {
    return this.provision_datastore(db_name, timestampData, autoload);
  }

  log(message) {
    console.log('[' + this.name +'] ' + message);
  }
}

module.exports = BasePlugin;