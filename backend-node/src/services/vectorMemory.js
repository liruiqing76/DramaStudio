/**
 * 轻量级向量记忆服务
 *
 * 用 TF-IDF + 余弦相似度实现语义搜索，无需外部嵌入 API。
 * 为角色/场景/道具建立文本索引，支持语义检索。
 *
 * 用法：
 *   const { search, indexDocument, rebuildIndex } = require('./vectorMemory');
 *   indexDocument('char:1', '勇敢的女战士，红色长发，擅长剑术');
 *   const results = search('勇敢的女性角色', ['char:1', 'char:2', ...]);
 */

const TOKENIZER_REGEX = /[\u4e00-\u9fa5]|[a-zA-Z]+|[0-9]+/g;

function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  const matches = String(text).toLowerCase().match(TOKENIZER_REGEX);
  if (!matches) return tokens;
  for (const m of matches) {
    if (/[\u4e00-\u9fa5]/.test(m)) {
      tokens.push(m);
      if (matches.indexOf(m) < matches.length - 1) {
        const next = matches[matches.indexOf(m) + 1];
        if (/[\u4e00-\u9fa5]/.test(next)) {
          tokens.push(m + next);
        }
      }
    } else {
      tokens.push(m);
    }
  }
  return tokens;
}

function termFreq(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const total = tokens.length || 1;
  for (const t in tf) {
    tf[t] /= total;
  }
  return tf;
}

const documents = new Map();
const df = {};
let docCount = 0;

function indexDocument(id, text) {
  const tokens = tokenize(text);
  const tf = termFreq(tokens);

  if (documents.has(id)) {
    const old = documents.get(id);
    for (const t in old.tf) {
      df[t] = Math.max(0, (df[t] || 0) - 1);
      if (df[t] === 0) delete df[t];
    }
    docCount--;
  }

  documents.set(id, { tf, tokens, text });
  for (const t in tf) {
    df[t] = (df[t] || 0) + 1;
  }
  docCount++;
}

function removeDocument(id) {
  if (!documents.has(id)) return;
  const old = documents.get(id);
  for (const t in old.tf) {
    df[t] = Math.max(0, (df[t] || 0) - 1);
    if (df[t] === 0) delete df[t];
  }
  documents.delete(id);
  docCount--;
}

function idf(term) {
  const d = df[term] || 0;
  if (d === 0) return 0;
  return Math.log((docCount + 1) / (d + 1)) + 1;
}

function tfidfVector(docId) {
  const doc = documents.get(docId);
  if (!doc) return {};
  const vec = {};
  for (const t in doc.tf) {
    vec[t] = doc.tf[t] * idf(t);
  }
  return vec;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const keys = Object.keys(vecA).length < Object.keys(vecB).length ? vecA : vecB;
  for (const t in keys) {
    const a = vecA[t] || 0;
    const b = vecB[t] || 0;
    dot += a * b;
  }
  for (const t in vecA) normA += vecA[t] * vecA[t];
  for (const t in vecB) normB += vecB[t] * vecB[t];
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function search(query, docIds = null, limit = 20) {
  const queryTokens = tokenize(query);
  const queryTf = termFreq(queryTokens);
  const queryVec = {};
  for (const t in queryTf) {
    queryVec[t] = queryTf[t] * idf(t);
  }

  const ids = docIds || Array.from(documents.keys());
  const results = [];
  for (const id of ids) {
    if (!documents.has(id)) continue;
    const docVec = tfidfVector(id);
    const score = cosineSimilarity(queryVec, docVec);
    if (score > 0) {
      results.push({ id, score, text: documents.get(id).text });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

function rebuildIndex(items) {
  documents.clear();
  for (const k in df) delete df[k];
  docCount = 0;
  for (const item of items) {
    indexDocument(item.id, item.text);
  }
}

function getIndexSize() {
  return documents.size;
}

module.exports = {
  tokenize,
  indexDocument,
  removeDocument,
  search,
  rebuildIndex,
  getIndexSize,
};