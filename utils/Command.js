class Command {
  constructor(name, description, callback, permissions=[]) {
    this.name = name;                 // Command name
    this.description = description;   // Command description
    this.callback = callback;         // Function to call on match
    this.permissions = permissions;   // Optional. Required user permissions to see and use this command
  }
}
