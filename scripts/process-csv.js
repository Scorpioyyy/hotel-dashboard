const fs = require('fs');

// 简单的 CSV 解析器（处理带引号的字段）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.replace(/\r$/, '')); // 移除行尾的 \r
  return result;
}

// 读取原始 CSV
const content = fs.readFileSync('public/enriched_comments.csv', 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

// 解析 header
const header = parseCSVLine(lines[0]);
console.log('Original columns:', header.length);

// 需要保留的列
const keepCols = ['_id', 'comment', 'images', 'score', 'useful_count', 'publish_date',
                  'room_type', 'travel_type', 'review_count', 'room_type_fuzzy',
                  'quality_score', 'categories'];
const keepIndices = keepCols.map(c => header.indexOf(c));

// 处理并写入新 CSV
const output = [];
output.push(keepCols.join(','));

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  const newRow = keepIndices.map(idx => {
    let value = row[idx] || '';
    // 如果值包含逗号或引号，需要用引号包裹
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      value = '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  });
  output.push(newRow.join(','));
}

fs.writeFileSync('public/comments_processed.csv', output.join('\n'), 'utf-8');
console.log('Processed', lines.length - 1, 'rows');
console.log('Output: public/comments_processed.csv');
