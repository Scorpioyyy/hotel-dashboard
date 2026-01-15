// lib/qa.ts - 智能问答服务
import { ai } from './insforge';
import { getHighQualityComments } from './api';
import { Comment } from '@/types';

export interface QAResponse {
  answer: string;
  references: Comment[];
}

// 从问题中提取相关类别
function extractCategories(question: string): string[] {
  const categories: string[] = [];

  const categoryKeywords: Record<string, string[]> = {
    '房间设施': ['房间', '设施', '床', '空调', '电视', '洗手间', '浴室', '卫生间'],
    '公共设施': ['泳池', '健身房', '电梯', '大堂', '花园', '停车'],
    '餐饮设施': ['早餐', '餐厅', '自助餐', '美食', '吃饭', '用餐'],
    '前台服务': ['前台', '接待', '办理', '入住', '服务员'],
    '客房服务': ['打扫', '清洁', '送餐', '客房'],
    '退房/入住效率': ['退房', '入住', '效率', '等待', '排队', '办理入住'],
    '交通便利性': ['交通', '地铁', '打车', '位置', '出行'],
    '周边配套': ['周边', '附近', '逛街', '购物', '景点'],
    '景观/朝向': ['景观', '风景', '朝向', '窗户', '视野'],
    '性价比': ['性价比', '值不值', '划算'],
    '价格合理性': ['价格', '贵', '便宜', '收费'],
    '整体满意度': ['整体', '总体', '满意', '推荐', '体验'],
    '安静程度': ['安静', '噪音', '吵', '隔音'],
    '卫生状况': ['卫生', '干净', '整洁', '清洁']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => question.includes(kw))) {
      categories.push(category);
    }
  }

  return categories;
}

// 构建系统提示词
function buildSystemPrompt(references: Comment[]): string {
  const referencesText = references
    .map((r, i) => `
【评论 ${i + 1}】
- 评分: ${r.score}/5
- 房型: ${r.room_type}
- 出行类型: ${r.travel_type}
- 发布日期: ${r.publish_date}
- 内容: ${r.comment}
`)
    .join('\n');

  return `你是广州花园酒店的智能客服助手。请根据以下真实住客评论来回答用户的问题。

## 参考评论
${referencesText}

## 回答要求
1. 基于上述评论内容进行回答，确保信息准确
2. 如果评论中没有相关信息，请如实说明
3. 回答要简洁明了，重点突出
4. 可以综合多条评论给出全面的回答
5. 在回答中适当引用评论内容作为依据
6. 保持友好专业的语气
7. 可以使用 Markdown 格式组织回答`;
}

// 获取相关评论（供外部调用）
export async function getReferencesForQuestion(question: string): Promise<Comment[]> {
  const categories = extractCategories(question);
  return await getHighQualityComments(
    categories.length > 0 ? categories : undefined,
    5
  );
}

// 流式问答服务
export async function* askQuestionStream(
  question: string,
  references: Comment[]
): AsyncGenerator<string, void, unknown> {
  if (references.length === 0) {
    yield '抱歉，暂时没有找到相关的评论信息来回答您的问题。请尝试换一种方式提问。';
    return;
  }

  const systemPrompt = buildSystemPrompt(references);

  try {
    const stream = await ai.chat.completions.create({
      model: 'google/gemini-3-flash-preview',  // openai/gpt-4o
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      maxTokens: 1000,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error('AI 调用失败:', error);
    yield '抱歉，生成回答时出现问题，请稍后重试。';
  }
}

// 非流式问答（保留兼容）
export async function askQuestion(question: string): Promise<QAResponse> {
  const categories = extractCategories(question);
  const references = await getHighQualityComments(
    categories.length > 0 ? categories : undefined,
    5
  );

  if (references.length === 0) {
    return {
      answer: '抱歉，暂时没有找到相关的评论信息来回答您的问题。请尝试换一种方式提问。',
      references: []
    };
  }

  const systemPrompt = buildSystemPrompt(references);

  try {
    const response = await ai.chat.completions.create({
      model: 'google/gemini-3-flash-preview',  // openai/gpt-4o
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      maxTokens: 1000
    });

    const answer = response.choices[0]?.message?.content || '抱歉，生成回答时出现问题，请稍后重试。';

    return {
      answer,
      references
    };
  } catch (error) {
    console.error('AI 调用失败:', error);
    throw new Error('生成回答失败，请稍后重试');
  }
}
