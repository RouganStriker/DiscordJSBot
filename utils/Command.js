class Command {
  constructor(name, description, callback=null, permissions=[]) {
    this.name = name;                               // Command name
    this.description = description;                 // Command description
    this.callback = callback || this.runCommand;    // Optional. Function to call on match
    this.permissions = permissions;                 // Optional. Required user permissions to see and use this command
  }

  runCommand() {
    //no-op
  }
}

module.exports = Command;
