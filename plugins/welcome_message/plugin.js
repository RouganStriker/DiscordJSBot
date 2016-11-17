const BasePlugin = require('../../utils/BasePlugin');
const Message = require('./message.conf');

class WelcomeMessagePlugin extends BasePlugin {
  init() {
    this.client.on('guildMemberAdd', (guild, member) => {
      if (guild.available && guild.id in Message && member.roles.size == 1 && !member.user.bot) {
        member.user.sendMessage(Message[guild.id])
                   .then(() => console.log("Sent welcome message to " + member.user.username));
      }
    });
  }
}

module.exports = WelcomeMessagePlugin;
