const config = require('../config');
const repositories = require('../database/repositories');
const { chance, pick } = require('../utils/random');

const templates = {
  roast: [
    ['spawned_again', 'bro spawned again'],
    ['happiness_dropped', 'server happiness just dropped'],
    ['professional_npc', 'professional npc'],
    ['local_menace', 'the local menace arrived'],
    ['side_quest', 'bro got another side quest'],
    ['nerf_this', 'someone nerf this guy'],
    ['spectating_life', 'bro is spectating life'],
    ['cpu_100', "man's CPU usage is 100%"],
    ['downloaded_lag', 'bro downloaded lag'],
    ['patch_notes', 'bro needs patch notes'],
    ['loading_screen', 'walking loading screen'],
    ['quest_marker', 'quest marker appeared'],
    ['npc_dialogue', 'npc dialogue detected'],
    ['late_entry', 'late entry as usual'],
    ['server_lag', 'server lag just increased']
  ],
  target_spoke: [
    ['finally', 'finally'],
    ['there_he_is', 'there he is'],
    ['remembered_server', 'bro remembered the server exists'],
    ['classic', 'classic'],
    ['didnt_ask', "didn't ask"],
    ['npc_energy', 'real npc energy'],
    ['professional_yapper', 'professional yapper'],
    ['buffering_again', "man's buffering again"],
    ['new_patch', 'new patch dropped?'],
    ['rare_spawn', 'rare spawn event']
  ],
  mention: [
    ['dont_encourage', "don't encourage him"],
    ['summoned_him', 'you summoned him'],
    ['here_we_go', 'here we go again'],
    ['wont_end_well', "this won't end well"],
    ['bold_ping', 'bold choice'],
    ['why_would_you', 'why would you do that']
  ],
  defender: [
    ['youre_next', "you're next"],
    ['guilty_association', 'guilty by association'],
    ['interesting_choice', 'interesting choice'],
    ['bold_of_you', 'bold of you'],
    ['noted', 'noted.'],
    ['dangerous_side', 'dangerous side to pick']
  ],
  fake_accusation: [
    ['know_what_you_did', 'i know what you did.\n\n...\n\nnever mind.'],
    ['interesting', 'interesting.\n\nvery interesting.'],
    ['watching', "i'm watching."],
    ['noted_suspicious', 'noted.\n\nsuspicious.'],
    ['case_file', 'adding this to the case file.']
  ],
  achievement: [
    ['professional_yapper', '🏆 Achievement Unlocked\n\nProfessional Yapper\n\n+0 XP'],
    ['suspicious_online', '🏆 Achievement Unlocked\n\nMost Suspicious Online Status'],
    ['late_spawn', '🏆 Achievement Unlocked\n\nLate Spawn Any%'],
    ['npc_dialogue', '🏆 Achievement Unlocked\n\nNPC Dialogue Speedrun'],
    ['lag_detected', '🏆 Achievement Unlocked\n\nDownloaded Lag']
  ],
  argument: [
    ['cope', 'cope'],
    ['nah', 'nah'],
    ['still_wrong', 'still wrong'],
    ['source', 'source?'],
    ['skill_issue', 'skill issue'],
    ['prove_it', 'prove it'],
    ['wild_take', 'wild take'],
    ['said_what_i_said', 'i said what i said'],
    ['still_right', 'still right'],
    ['crazy_take', 'crazy take']
  ],
  secrecy: [
    ['vibes', 'vibes'],
    ['algorithm', 'the algorithm decided'],
    ['you_know', 'you know what you did'],
    ['fate', 'fate'],
    ['dont_worry', "don't worry about it"],
    ['classified', 'classified information'],
    ['no_reason', 'no reason. probably.']
  ]
};

const DEFENDER = /\b(leave|stop|chill|valid|right|true|agree|facts|nice|good|let him|let them|he is right|she is right|they are right|don't roast|dont roast)\b/i;
const ARGUMENT = /\b(no|nah|wrong|cap|prove|source|stop|why|bro|shut|not true|false|l take|bad take|leave me|what did i do)\b/i;
const WHY_ROAST = /\bwhy\b.*\b(always|keep|roast|hate|target|bully|after me|me)\b/i;

function currentDay() {
  return new Date().toISOString().slice(0, 10);
}

function getSettings(guildId) {
  const settings = repositories.getTargetGremlinSettings(guildId);
  return {
    enabled: Boolean(settings.enabled),
    targetUserId: settings.target_user_id || '',
    nextCheckAt: settings.next_check_at || null
  };
}

function getDaily(guildId) {
  return repositories.getTargetGremlinDaily(guildId, currentDay());
}

function canRoast(guildId, mentionWanted = false) {
  const daily = getDaily(guildId);
  if (daily.roast_count >= config.bot.maxDailyRoasts) return false;
  if (mentionWanted && daily.mention_count >= config.bot.maxMentionsPerDay) return false;
  return true;
}

function selectTemplate(guildId, type) {
  const options = templates[type] || templates.roast;
  let used = new Set(repositories.getUsedGremlinTemplates(guildId, type));

  if (used.size >= options.length) {
    repositories.clearGremlinTemplates(guildId, type);
    used = new Set();
  }

  const fresh = options.filter(([key]) => !used.has(key));
  const [key, text] = pick(fresh.length ? fresh : options);
  return { key, type, text };
}

function chooseRoastType(trigger) {
  if (trigger === 'secrecy') return 'secrecy';
  if (trigger === 'argument') return 'argument';
  if (trigger === 'mention') return 'mention';
  if (trigger === 'defender') return 'defender';

  const roll = Math.random();
  if (roll < 0.12) return 'fake_accusation';
  if (roll < 0.24) return 'achievement';
  return trigger === 'target_spoke' ? 'target_spoke' : 'roast';
}

function createAction({ guildId, trigger, targetUserId, targetName, allowMention = false }) {
  const type = chooseRoastType(trigger);
  const mentionWanted = allowMention && chance(config.bot.mentionChance);
  if (!canRoast(guildId, mentionWanted)) return null;

  const template = selectTemplate(guildId, type);
  return {
    trigger,
    type,
    template,
    targetUserId,
    targetName,
    targetMention: `<@${targetUserId}>`,
    mentionAllowed: mentionWanted,
    maxWords: type === 'argument' ? 15 : 12
  };
}

function recordAction(guildId, action, sent = true) {
  if (!sent || !action) return;
  repositories.markGremlinTemplateUsed(guildId, action.template.type, action.template.key);
  repositories.incrementTargetGremlinDaily({
    guildId,
    mentionUsed: action.mentionAllowed
  });
}

function fallbackContent(action) {
  if (!action) return 'classic';
  const prefix = action.mentionAllowed ? `${action.targetMention} ` : '';
  return `${prefix}${action.template.text}`.trim();
}

function targetMentioned(message, targetUserId) {
  return message.mentions.users.has(targetUserId) ||
    new RegExp(`<@!?${targetUserId}>`).test(message.content || '');
}

function isTargetDefended(content, mentionedTarget) {
  return mentionedTarget && DEFENDER.test(content);
}

function targetIsArguing(content, mentioned, repliedToBot) {
  return mentioned || repliedToBot || ARGUMENT.test(content);
}

function asksWhyRoasted(content) {
  return WHY_ROAST.test(content);
}

function evaluateMessage({ message, content, mentioned, repliedToBot, targetName }) {
  const settings = getSettings(message.guild.id);
  if (!settings.enabled || !settings.targetUserId) return null;

  const targetUserId = settings.targetUserId;
  const authorIsTarget = message.author.id === targetUserId;
  const mentionedTarget = targetMentioned(message, targetUserId);
  const defended = !authorIsTarget && isTargetDefended(content, mentionedTarget);

  if (authorIsTarget && asksWhyRoasted(content)) {
    return createAction({
      guildId: message.guild.id,
      trigger: 'secrecy',
      targetUserId,
      targetName
    });
  }

  if (authorIsTarget) {
    const arguing = targetIsArguing(content, mentioned, repliedToBot);
    const probability = arguing
      ? config.bot.gremlinArgumentReplyChance
      : config.bot.replyChanceDuringGremlin;
    if (!chance(probability)) return null;

    return createAction({
      guildId: message.guild.id,
      trigger: arguing ? 'argument' : 'target_spoke',
      targetUserId,
      targetName
    });
  }

  if (defended) {
    if (!chance(config.bot.defenderReplyChance)) return null;
    return createAction({
      guildId: message.guild.id,
      trigger: 'defender',
      targetUserId,
      targetName
    });
  }

  if (mentionedTarget) {
    if (!chance(config.bot.mentionChance)) return null;
    return createAction({
      guildId: message.guild.id,
      trigger: 'mention',
      targetUserId,
      targetName
    });
  }

  return null;
}

function shouldReactInstead(action) {
  return Boolean(action && !['secrecy', 'argument'].includes(action.type) && chance(0.15));
}

module.exports = {
  canRoast,
  createAction,
  evaluateMessage,
  fallbackContent,
  getDaily,
  getSettings,
  recordAction,
  shouldReactInstead,
  targetMentioned,
  templates
};
