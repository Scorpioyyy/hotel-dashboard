const fs = require('fs');
const path = require('path');

// 标准的14个小类
const STANDARD_CATEGORIES = [
  '房间设施', '公共设施', '餐饮设施',
  '前台服务', '客房服务', '退房/入住效率',
  '交通便利性', '周边配套', '景观/朝向',
  '性价比', '价格合理性',
  '整体满意度', '安静程度', '卫生状况'
];

// 解析中文日期 "2025年4月5日" -> "2025-04-05"
function parseChineseDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// 解析评论数 "7条点评" -> 7
function parseReviewCount(str) {
  if (!str) return 0;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// 过滤非标准类别
function filterCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.filter(c => STANDARD_CATEGORIES.includes(c));
}

// 简单CSV解析器 - 处理带引号的字段
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
  result.push(current.replace(/\r$/, ''));
  return result;
}

// 解析数组字段 (images, categories)
function parseArrayField(str) {
  if (!str || str === '') return [];
  try {
    const cleaned = str.trim();
    if (!cleaned.startsWith('[')) return [];

    // 首先尝试直接 JSON 解析
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 继续尝试其他方式
    }

    // 处理 Python 风格的单引号列表: ['a', 'b', 'c']
    // 将单引号替换为双引号
    const converted = cleaned
      .replace(/^\['/g, '["')           // 开头 [' -> ["
      .replace(/'\]$/g, '"]')           // 结尾 '] -> "]
      .replace(/', '/g, '", "')         // 中间 ', ' -> ", "
      .replace(/",'/g, '","')           // 处理没有空格的情况
      .replace(/'"/g, '""');            // 处理混合引号

    return JSON.parse(converted);
  } catch (e) {
    // 静默失败，不打印警告
  }
  return [];
}

// 解析整个 CSV 内容，正确处理多行字段
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++; // 跳过 \r\n 中的 \n
      currentRow.push(currentField.replace(/\r$/, ''));
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // 处理最后一行
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.replace(/\r$/, ''));
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  return rows;
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'public', 'enriched_comments.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');

  // 使用新的解析器
  const allRows = parseCSV(content);
  console.log('Total rows parsed:', allRows.length);

  // 解析header
  const header = allRows[0];
  console.log('Header:', header);

  // 列索引
  const colIndex = {};
  header.forEach((col, idx) => {
    colIndex[col.trim()] = idx;
  });

  const records = [];
  let errors = 0;

  for (let i = 1; i < allRows.length; i++) {
    try {
      const row = allRows[i];

      const _id = row[colIndex['_id']];
      if (!_id) continue;

      const images = parseArrayField(row[colIndex['images']]);
      const rawCategories = parseArrayField(row[colIndex['categories']]);
      const categories = filterCategories(rawCategories);

      const record = {
        _id,
        comment: row[colIndex['comment']] || '',
        images: JSON.stringify(images),
        score: parseInt(row[colIndex['score']]) || 5,
        useful_count: parseInt(row[colIndex['useful_count']]) || 0,
        publish_date: parseChineseDate(row[colIndex['publish_date']]),
        room_type: row[colIndex['room_type']] || '',
        travel_type: row[colIndex['travel_type']] || '',
        review_count: parseReviewCount(row[colIndex['review_count']]),
        room_type_fuzzy: row[colIndex['room_type_fuzzy']] || '',
        quality_score: parseInt(row[colIndex['quality_score']]) || 5,
        categories: JSON.stringify(categories)
      };

      // 验证必要字段
      if (record.publish_date && record.score >= 1 && record.score <= 5) {
        records.push(record);
      } else {
        errors++;
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`Error at line ${i}:`, err.message);
      }
    }
  }

  console.log(`\nParsed ${records.length} valid records (${errors} errors)`);

  // 输出为JSON文件，供后续导入使用
  const outputPath = path.join(__dirname, '..', 'public', 'comments_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`Output saved to: ${outputPath}`);

  // 显示示例数据
  if (records.length > 0) {
    console.log('\nSample record:');
    console.log(JSON.stringify(records[0], null, 2));
  }
}

main().catch(console.error);
