const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const templateLoader = require('../templates/index');

function listAll() {
  return templateLoader.listAll();
}

function get(templateId) {
  return templateLoader.get(templateId);
}

function buildStoryPrompt(template, userConcept) {
  // 构建基于模板的 story prompt
  let prompt = `你是一位专业的短剧编剧。请根据以下模板和用户概念，创作一个完整的短剧故事梗概。\n\n`;
  
  prompt += `【模板信息】\n`;
  prompt += `名称：${template.name}\n`;
  prompt += `描述：${template.description}\n`;
  prompt += `角色原型：\n`;
  prompt += `  男主：${template.character_archetypes.male}\n`;
  prompt += `  女主：${template.character_archetypes.female}\n`;
  prompt += `  配角：${template.character_archetypes.support.join('、')}\n`;
  prompt += `\n`;
  
  prompt += `【经典套路】\n`;
  template.classic_tropes.forEach((trope, index) => {
    prompt += `  ${index + 1}. ${trope}\n`;
  });
  prompt += `\n`;
  
  prompt += `【三幕结构】\n`;
  prompt += `  第一幕：${template.three_act_structure.act1}\n`;
  prompt += `  第二幕：${template.three_act_structure.act2}\n`;
  prompt += `  第三幕：${template.three_act_structure.act3}\n`;
  prompt += `\n`;
  
  prompt += `【用户概念】\n`;
  prompt += `${userConcept}\n`;
  prompt += `\n`;
  
  prompt += `【创作要求】\n`;
  prompt += `1. 严格按照以上模板的角色原型、经典套路和三幕结构来创作故事；\n`;
  prompt += `2. 融入用户提供的概念元素，使其成为故事的核心亮点；\n`;
  prompt += `3. 故事要有起承转合，冲突鲜明，情感真挚；\n`;
  prompt += `4. 适合制作成短剧形式，每幕内容浓缩但完整；\n`;
  prompt += `5. 请输出JSON格式，包含以下字段：\n`;
  prompt += `   {title: "故事标题", logline: "一句话概括", summary: "完整故事梗概（500-800字）", acts: [{act: 1, content: "第一幕内容"}, {act: 2, content: "第二幕内容"}, {act: 3, content: "第三幕内容"}], characters: [{name: "角色名", description: "角色描述", archetype: "male/female/support"}]}\n`;
  
  return prompt;
}

async function scoreQuality(storyJson, aiClient, db, log) {
  // 调用 AI 五维评分
  const evaluationPrompt = `你是一位资深短剧评审专家。请从以下五个维度对短剧故事进行评分（每维度0-10分），并给出简要评语：\n\n`;
  
  evaluationPrompt += `【评分维度】\n`;
  evaluationPrompt += `1. 创新性：故事是否有新意，是否避免了老套陈词滥调？\n`;
  evaluationPrompt += `2. 角色饱满度：角色是否立体，动机是否清晰，是否有成长弧线？\n`;
  evaluationPrompt += `3. 情感真实度：情感表达是否真挚，是否能引起共鸣？\n`;
  evaluationPrompt += `4. 节奏张力：故事节奏是否得当，冲突是否足够吸引人？\n`;
  evaluationPrompt += `5. 主题深度：故事是否有内涵，是否传达了积极向上的价值观？\n\n`;
  
  evaluationPrompt += `【待评故事】\n`;
  evaluationPrompt += `标题：${storyJson.title}\n`;
  evaluationPrompt += `概况：${storyJson.logline}\n`;
  evaluationPrompt += `梗概：${storyJson.summary}\n`;
  evaluationPrompt += `\n`;
  
  evaluationPrompt += `【输出要求】\n`;
  evaluationPrompt += `请严格按照以下JSON格式输出：\n`;
  evaluationPrompt += `{\n`;
  evaluationPrompt += `  "scores": {\n`;
  evaluationPrompt += `    "innovation": 分数(0-10),\n`;
  evaluationPrompt += `    "character": 分数(0-10),\n`;
  evaluationPrompt += `    "emotion": 分数(0-10),\n`;
  evaluationPrompt += `    "pacing": 分数(0-10),\n`;
  evaluationPrompt += `    "theme": 分数(0-10)\n`;
  evaluationPrompt += `  },\n`;
  evaluationPrompt += `  "comments": {\n`;
  evaluationPrompt += `    "innovation": "对创新性的评语，一两句话\n`;
  evaluationPrompt += `    "character": "对角色饱满度的评语，一两句话\n`;
  evaluationPrompt += `    "emotion": "对情感真实度的评语，一两句话\n`;
  evaluationPrompt += `    "pacing": "对节奏张力的评语，一两句话\n`;
  evaluationPrompt += `    "theme": "对主题深度的评语，一两句话\n`;
  evaluationPrompt += `  }\n`;
  evaluationPrompt += `}\n`;
  
  try {
    // 调用 AI 进行评分
    const result = await aiClient.generateText(
      db,
      log,
      'text', // serviceType
      evaluationPrompt, // userPrompt
      `你是一位资深短剧评审专家，擅长从专业角度评估短剧故事质量。`, // systemPrompt
      { json_mode: true } // options
    );
    
    // 解析返回的JSON
    const scoreResult = JSON.parse(result);
    return scoreResult;
  } catch (error) {
    log.error('Error in scoreQuality:', error);
    // 返回默认得分
    return {
      scores: {
        innovation: 5,
        character: 5,
        emotion: 5,
        pacing: 5,
        theme: 5
      },
      comments: {
        innovation: "评分过程中出现错误，使用默认分数",
        character: "评分过程中出现错误，使用默认分数",
        emotion: "评分过程中出现错误，使用默认分数",
        pacing: "评分过程中出现错误，使用默认分数",
        theme: "评分过程中出现错误，使用默认分数"
      }
    };
  }
}

module.exports = {
  listAll,
  get,
  buildStoryPrompt,
  scoreQuality
};