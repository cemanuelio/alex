const { EmbedBuilder } = require('discord.js');

class ComandosCommand {
  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.comandos;
    this.command = this.i18n.command;
  }

  tipoComando(comando) {
    let retorno = this.i18n.undefined;
    if (comando) {
      if (comando.text) {
        retorno = this.i18n.text;
      } else if (comando.image) {
        retorno = this.i18n.image;
      } else if (comando.video) {
        retorno = this.i18n.video;
      } else if (comando.audio) {
        retorno = this.i18n.audio;
      }
    }
    return retorno;
  }

  listBuiltInCommands() {
    return this.client.commands
      .filter(it => it.command)
      .sort((a, b) => a.command.localeCompare(b.command))
      .map(it => `**!${it.command}** - ${this.i18n.descriptions[it.command] || this.i18n.noDescription}`)
      .join('\n');
  }

  async listCustomCommands() {
    const commands = await this.client.databaseService.models.command.findAll();
    return commands.map(comando => `!${comando.command} - ${this.i18n.type}: ${this.tipoComando(comando)}`).join('\n');
  }

  async exec(event) {
    const builtIn = this.listBuiltInCommands();
    const custom = await this.listCustomCommands();

    let description = `${this.i18n.builtInTitle}\n${builtIn}`;

    if (custom) {
      description += `\n\n${this.i18n.customTitle}\n${custom}`;
    }

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(this.i18n.title)
      .setDescription(description);

    await event.channel.send({ embeds: [embed] });
  }
}

module.exports = ComandosCommand;
