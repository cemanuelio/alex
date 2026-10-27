const { Client, GatewayIntentBits } = require('discord.js');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { parse } = require('discord-command-parser');
const commandLineArgs = require('command-line-args');

const DatabaseService = require('./services/databaseService');
const VoiceService = require('./services/voiceService');
const BankService = require('./services/bankService');
const WordDayService = require('./services/wordDayService');

class Alex extends Client {
  constructor(config) {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
      ],
    });

    if (!config) {
      throw new Error("Config required");
    }

    this.config = config;
    this.commands = [];
    this.i18n = {};

    this.voiceService = new VoiceService();
    this.databaseService = new DatabaseService();
    this.bankService = new BankService(this);
    this.wordDayService = new WordDayService(this);

    this.loadLanguage();
    this.registerEvents();
    this.registerCommands();
  }

  loadLanguage() {
    const lang = this.config.lang || 'pt_BR';
    const dir = join(__dirname, 'langs');
    let file = join(dir, `${lang}.json`);

    if (!existsSync(file)) {
      file = join(dir, 'pt_BR.json');
    }

    const i18n = require(file);
    Object.keys(i18n).forEach(key => (this.i18n[key] = i18n[key]));
  }

  registerEvents() {
    this.on('ready', () => console.log(`Connected as ${this.user.tag}!`));
    this.on('messageCreate', this.onMessage);
    this.on('interactionCreate', this.onInteraction);
  }

  onInteraction(interaction) {
    this.commands.forEach(it => {
      if (it.onInteraction) {
        it.onInteraction(interaction);
      }
    })
  }

  registerCommands() {
    readdirSync(this.config.commands).forEach(file => {
      const commandClass = require(join(this.config.commands, file));
      if (typeof commandClass === 'function') {
        const instance = new commandClass(this);
        if (!instance.command && !instance.conditional) {
          throw new Error(`Invalid command declaration ${file}`);
        }
        this.commands.push(instance);
      }
    });
  }

  runCommand(message, command, action) {
    let args = {};
    if (command.args) {
      args = commandLineArgs(command.args, {
        argv: action.arguments,
        partial: true,
      });
    }
    command.exec(message, args, action.command);
  }

  onMessage(message) {
    const action = parse(message, this.config.prefix);
    if (action.success) {
      const command = this.commands.find(it => it.command && it.command.toLowerCase() === action.command.toLowerCase());
      if (command) {
        this.runCommand(message, command, action);
      } else {
        this.commands
          .filter(it => it.conditional)
          .forEach(command => this.runCommand(message, command, action));
      }
    }
  }
}

module.exports = Alex;
