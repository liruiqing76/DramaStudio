const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const TEMPLATES_DIR = path.join(__dirname);

function loadYamlTemplate(filename) {
  const filePath = path.join(TEMPLATES_DIR, filename);
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return yaml.safeLoad(fileContent);
  } catch (err) {
    console.error(`Error loading template ${filename}:`, err.message);
    return null;
  }
}

function listAll() {
  const templates = [];
  const files = fs.readdirSync(TEMPLATES_DIR);
  
  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const template = loadYamlTemplate(file);
      if (template) {
        // Return simplified template info for listing
        templates.push({
          id: template.id,
          name: template.name,
          name_en: template.name_en,
          description: template.description
        });
      }
    }
  }
  
  return templates;
}

function get(templateId) {
  const files = fs.readdirSync(TEMPLATES_DIR);
  
  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const template = loadYamlTemplate(file);
      if (template && template.id === templateId) {
        return template;
      }
    }
  }
  
  return null;
}

module.exports = {
  listAll,
  get
};