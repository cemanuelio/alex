const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

class AudiosCommand {

  constructor(client) {
    this.client = client;
    this.i18n = client.i18n.audios;
    this.command = this.i18n.command;
  }

  async saveStatistic(command, user) {
    await this.client.databaseService.models.commandsStatistic.create({ user, command });
  }

  async onInteraction(interaction) {
    try {
      if (interaction.isButton() && interaction.customId.indexOf('audiosCommand') === 0) {
        const command = await this.client.databaseService.models.command.findOne({
          where: { 
            command: interaction.customId.replace('audiosCommand-', ''),
          },
        });
        
        if (command) {
          this.saveStatistic(command.command, interaction.user.id);
          const audio = await axios.get(command.audio, { responseType: 'arraybuffer' }).then(res => res.data);
          await this.client.voiceService.stream(interaction, audio);
          await interaction.deferUpdate();
        }
      }
    } catch (e) {
      if (e.request && e.response) {
        console.error(e.response.config.url, e.response.status, e.response.data.toString('utf8'), '\n');
      } else {
        console.error(e.message);
      } 
    }
  }

  async exec(event) {
    const commands = await this.client.databaseService.models.command.findAll({
      where: { 
        playAudio: true
      },
      order: [
        ['command']
      ],
    });

    const rows = [];

    for (let i = 0; i < Math.ceil(commands.length / 5); i++) {
      const arr = Array.from(Array(5), (_, k) => commands[k + (5 * i)]);
      const row = new ActionRowBuilder();

      arr.filter(it => !!it).forEach(it => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`audiosCommand-${it.command}`)
            .setLabel(it.command)
            .setStyle(ButtonStyle.Primary)
        );
      });

      rows.push(row);
    }

    for (let i = 0; i < Math.ceil(rows.length / 5); i++) {
      const arr = Array.from(Array(5), (_, k) => rows[k + (5 * i)]);
      event.channel.send({
        content: i == 0 ? this.i18n.title : Array.from(Array(100), (_, k) => '-').join(''),
        components: arr.filter(it => !!it)
      });
    }
  }

}

module.exports = AudiosCommand;
